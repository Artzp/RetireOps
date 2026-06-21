/**
 * Tax Calculation Module
 * @see docs/source-of-truth/04-tax-engine.md
 */
import type { ProvinceCode, TaxCalculation, AccountOwner } from '@retireops/shared';
import { calculateFederalTax, getFederalMarginalRate } from './federal-tax.js';
import { calculateProvincialTax, getProvincialMarginalRate } from './provincial-tax.js';
import { calculateOASClawback } from './oas-clawback.js';
import { buildTaxYearParams } from './indexing.js';
import {
  calculateTaxableDividendIncome,
  calculateTotalDividendTaxCredits,
  calculateProvincialDividendCredit,
} from './dividends.js';
import { calculateTaxableCapitalGain } from './capital-gains.js';
import { calculateBCRentersCredit, calculateOntarioSeniorsTransitTaxCredit } from './credits.js';

// Re-export all tax modules
export * from './federal-tax.js';
export * from './provincial-tax.js';
export * from './oas-clawback.js';
export * from './dividends.js';
export * from './capital-gains.js';
export * from './credits.js';
export { buildTaxYearParams, type TaxYearParams, type IndexingOptions } from './indexing.js';
export { calculateTerminalReturn } from './terminal-return.js';
export type { TerminalReturnInput, TerminalReturnResult } from './terminal-return.js';

/**
 * Input for complete tax calculation
 */
export interface TaxCalculationInput {
  year: number;
  owner: AccountOwner;
  province: ProvinceCode;
  age: number;

  // Income sources
  employmentIncome: number;
  pensionIncome: number;
  rrifIncome: number;
  cppIncome: number;
  oasIncome: number;
  otherIncome: number;

  // Investment income
  interestIncome: number;
  eligibleDividends: number;
  nonEligibleDividends: number;
  capitalGains: number;

  // Deductions
  rrspContribution: number;
  otherDeductions: number;

  // Targeted credits
  bcRentersCreditEligible?: boolean;
  bcRentersCreditAdjustedIncome?: number;
  onSeniorsTransitEligibleExpenses?: number;

  /** Annual inflation rate for indexing tax tables past last tabled year (Issue 8). */
  inflationRate?: number;
  /** Base year for indexing extrapolation (typically projection start year). */
  indexingBaseYear?: number;

  /**
   * CORR-03 (SCEN-07): Spousal-RRSP attribution income shifted from annuitant
   * to contributor under the CRA 3-year rule. Routed into the taxable-income
   * aggregation as a NON-pension bucket — pension splitting must NOT be able to
   * transfer it back (CRA T1032 forbids splitting attributed RRSP income).
   * @see docs/source-of-truth/02-account-types.md VR-RRSP-003
   * @see docs/source-of-truth/07-withdrawal-strategies.md
   */
  attributedSpousalRRSPIncome?: number;
}

/**
 * Calculate complete tax for a single year
 * @see docs/source-of-truth/04-tax-engine.md - Tax Calculation Algorithm
 */
export function calculateTotalTax(input: TaxCalculationInput): TaxCalculation {
  const {
    year,
    owner,
    province,
    age,
    employmentIncome,
    pensionIncome,
    rrifIncome,
    cppIncome,
    oasIncome,
    otherIncome,
    interestIncome,
    eligibleDividends,
    nonEligibleDividends,
    capitalGains,
    rrspContribution,
    otherDeductions,
    bcRentersCreditEligible = false,
    bcRentersCreditAdjustedIncome,
    onSeniorsTransitEligibleExpenses = 0,
    inflationRate,
    indexingBaseYear,
    // CORR-03: signed attribution shift (positive on contributor, negative on
    // annuitant). Threaded into grossIncome below as a non-pension bucket.
    attributedSpousalRRSPIncome = 0,
  } = input;

  const taxYearParams = buildTaxYearParams(
    year,
    inflationRate !== undefined && indexingBaseYear !== undefined
      ? { inflationRate, baseYear: indexingBaseYear }
      : undefined
  );

  // Step 1: Calculate Gross Income
  // @see docs/source-of-truth/04-tax-engine.md - Step 1
  const taxableDividends = calculateTaxableDividendIncome(eligibleDividends, nonEligibleDividends);
  const taxableCapitalGains = calculateTaxableCapitalGain(capitalGains);

  const investmentIncome = interestIncome + taxableDividends + taxableCapitalGains;

  // CORR-03: attributed spousal-RRSP income — non-pension bucket, intentionally
  // separate from pensionIncome / rrifIncome so pension splitting cannot
  // redirect it (CRA T1032). Signed: positive shift adds taxable income for the
  // contributor; negative shift removes it from the annuitant.
  // @see docs/source-of-truth/02-account-types.md VR-RRSP-003
  const grossIncome =
    employmentIncome +
    pensionIncome +
    rrifIncome +
    cppIncome +
    oasIncome +
    otherIncome +
    investmentIncome +
    attributedSpousalRRSPIncome;

  // Step 2: Calculate Net Income
  // @see docs/source-of-truth/04-tax-engine.md - Step 2
  const deductions = rrspContribution + otherDeductions;
  const netIncome = Math.max(0, grossIncome - deductions);

  // Step 3: Calculate Taxable Income
  // @see docs/source-of-truth/04-tax-engine.md - Step 3
  const taxableIncome = netIncome; // Simplified; could add loss carryforwards

  // Eligible pension income for credits
  // @see docs/source-of-truth/04-tax-engine.md - Pension Income Credit
  // RRIF qualifies at any age; other pension income requires age 65+
  const eligiblePensionIncome = rrifIncome + (age >= 65 ? pensionIncome : 0);

  // Step 4: Calculate Federal Tax
  // @see docs/source-of-truth/04-tax-engine.md - Step 4
  const isQuebec = province === 'QC';
  const federalTaxGross = calculateFederalTax(
    taxableIncome,
    age,
    netIncome,
    eligiblePensionIncome,
    year,
    isQuebec,
    taxYearParams
  );

  // Dividend tax credits reduce federal tax
  const dividendCredit = calculateTotalDividendTaxCredits(eligibleDividends, nonEligibleDividends);
  const federalTaxNet = Math.max(0, federalTaxGross - dividendCredit);

  // Step 5: Calculate Provincial Tax
  // @see docs/source-of-truth/04-tax-engine.md - Step 5
  const provincialTaxGross = calculateProvincialTax(
    taxableIncome,
    age,
    netIncome,
    eligiblePensionIncome,
    province,
    year,
    taxYearParams
  );
  // Provincial dividend tax credits (D-05)
  const provincialDividendCredit = calculateProvincialDividendCredit(
    eligibleDividends,
    nonEligibleDividends,
    province,
    year
  );

  const provincialCredits =
    provincialDividendCredit +
    (province === 'BC'
      ? calculateBCRentersCredit({
          adjustedIncome: bcRentersCreditAdjustedIncome ?? netIncome,
          eligible: bcRentersCreditEligible,
          year,
        })
      : 0) +
    (province === 'ON'
      ? calculateOntarioSeniorsTransitTaxCredit({
          age,
          eligibleExpenses: onSeniorsTransitEligibleExpenses,
        })
      : 0);
  const provincialTaxNet = Math.max(0, provincialTaxGross - provincialCredits);

  // Step 6: Calculate Total Tax
  // @see docs/source-of-truth/04-tax-engine.md - Step 6
  const totalTax = federalTaxNet + provincialTaxNet;

  // Calculate marginal rates
  const marginalRateFederal = getFederalMarginalRate(taxableIncome, year);
  const marginalRateProvincial = getProvincialMarginalRate(
    taxableIncome,
    province,
    year,
    taxYearParams
  );
  const marginalRateCombined = marginalRateFederal + marginalRateProvincial;

  // Calculate effective rate
  const effectiveRate = grossIncome > 0 ? totalTax / grossIncome : 0;

  // Calculate OAS clawback
  // @see docs/source-of-truth/04-tax-engine.md - OAS Clawback
  const oasClawback = calculateOASClawback(
    netIncome,
    oasIncome,
    year,
    taxYearParams.oasClawbackThreshold
  );

  // Calculate credits used
  const ageCredit = age >= 65 ? federalTaxGross * 0.05 : 0; // Approximate
  const pensionCredit = eligiblePensionIncome > 0 ? Math.min(300, federalTaxGross * 0.02) : 0;

  return {
    year,
    owner,

    // Income components
    employmentIncome,
    pensionIncome,
    rrifIncome,
    cppIncome,
    oasIncome,
    investmentIncome,
    interestIncome,
    capitalGains,
    dividendIncomeEligible: eligibleDividends,
    dividendIncomeNonEligible: nonEligibleDividends,

    // Calculated amounts
    grossIncome,
    deductions,
    netIncome,
    taxableIncome,

    // Tax amounts
    federalTaxGross,
    federalCredits: dividendCredit,
    federalTaxNet,
    provincialTaxGross,
    provincialCredits,
    provincialTaxNet,
    totalTax,

    // Rates
    marginalRateFederal,
    marginalRateProvincial,
    marginalRateCombined,
    effectiveRate,

    // Special calculations
    oasClawback,
    ageCredit,
    pensionCredit,
  };
}
