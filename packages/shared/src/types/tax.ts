/**
 * Tax Types and Structures
 * @see docs/source-of-truth/04-tax-engine.md
 */
import type { ProvinceCode } from './province.js';
import type { AccountOwner } from './accounts.js';

export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

export interface TaxTable {
  year: number;
  jurisdiction: 'federal' | ProvinceCode;
  brackets: TaxBracket[];
  basicPersonalAmount: number;
  /** Provincial dividend tax credit rate for eligible dividends (% of grossed-up amount) */
  eligibleDividendCreditRate?: number;
  /** Provincial dividend tax credit rate for non-eligible dividends (% of grossed-up amount) */
  nonEligibleDividendCreditRate?: number;
}

/**
 * Tax Credits
 * @see docs/source-of-truth/04-tax-engine.md - Tax Credits Detail
 */
export interface TaxCredits {
  basicPersonalAmount: number;
  ageAmount: number;
  pensionIncomeAmount: number;
  spouseAmount: number;
  disabilityAmount: number;
  medicalExpenses: number;
  donations: number;
  dividendTaxCredit: number;
}

/**
 * Tax Calculation Result
 * @see docs/source-of-truth/04-tax-engine.md - Tax Calculation Data Model
 */
export interface TaxCalculation {
  year: number;
  owner: AccountOwner;

  // Income components
  employmentIncome: number;
  pensionIncome: number;
  rrifIncome: number;
  cppIncome: number;
  oasIncome: number;
  investmentIncome: number;
  interestIncome?: number;
  capitalGains: number;
  dividendIncomeEligible: number;
  dividendIncomeNonEligible: number;

  // Calculated amounts
  grossIncome: number;
  deductions: number;
  netIncome: number;
  taxableIncome: number;

  // Tax amounts
  federalTaxGross: number;
  federalCredits: number;
  federalTaxNet: number;
  provincialTaxGross: number;
  provincialCredits: number;
  provincialTaxNet: number;
  totalTax: number;

  // Rates
  marginalRateFederal: number;
  marginalRateProvincial: number;
  marginalRateCombined: number;
  effectiveRate: number;

  // Special calculations
  oasClawback: number;
  ageCredit: number;
  pensionCredit: number;
}

/**
 * Dividend Tax Treatment
 * @see docs/source-of-truth/04-tax-engine.md - Dividend Tax Treatment
 */
export interface DividendTaxRates {
  eligibleGrossUp: number;
  eligibleFederalCredit: number;
  nonEligibleGrossUp: number;
  nonEligibleFederalCredit: number;
}

/**
 * OAS Clawback Parameters
 * @see docs/source-of-truth/04-tax-engine.md - OAS Clawback
 */
export interface OASClawbackParams {
  threshold: number;
  fullClawbackThreshold: number;
  recoveryRate: number;
  maxOASAnnual: number;
}

/**
 * Pension Income Splitting
 * @see docs/source-of-truth/04-tax-engine.md - Pension Income Splitting
 */
export interface PensionSplitResult {
  optimalSplitPercentage: number;
  primaryPensionAfterSplit: number;
  spousePensionAfterSplit: number;
  taxSavings: number;
}
