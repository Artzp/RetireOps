/**
 * Dividend Tax Calculations
 * @see docs/source-of-truth/04-tax-engine.md - Dividend Tax Treatment
 */
import type { ProvinceCode } from '@retireops/shared';
import { DIVIDEND_RATES, getProvincialTaxTables } from '@retireops/shared';

/**
 * Calculate grossed-up dividend amount for eligible dividends
 * @see docs/source-of-truth/04-tax-engine.md - Eligible Dividends
 */
export function grossUpEligibleDividend(actualDividend: number): number {
  return actualDividend * (1 + DIVIDEND_RATES.eligibleGrossUp);
}

/**
 * Calculate grossed-up dividend amount for non-eligible dividends
 * @see docs/source-of-truth/04-tax-engine.md - Non-Eligible Dividends
 */
export function grossUpNonEligibleDividend(actualDividend: number): number {
  return actualDividend * (1 + DIVIDEND_RATES.nonEligibleGrossUp);
}

/**
 * Calculate federal dividend tax credit for eligible dividends
 */
export function calculateEligibleDividendCredit(grossedUpDividend: number): number {
  return grossedUpDividend * DIVIDEND_RATES.eligibleFederalCredit;
}

/**
 * Calculate federal dividend tax credit for non-eligible dividends
 */
export function calculateNonEligibleDividendCredit(grossedUpDividend: number): number {
  return grossedUpDividend * DIVIDEND_RATES.nonEligibleFederalCredit;
}

/**
 * Calculate total dividend income to include in taxable income
 * Returns the grossed-up amount (which is what gets taxed)
 */
export function calculateTaxableDividendIncome(
  eligibleDividends: number,
  nonEligibleDividends: number
): number {
  const grossedUpEligible = grossUpEligibleDividend(eligibleDividends);
  const grossedUpNonEligible = grossUpNonEligibleDividend(nonEligibleDividends);
  return grossedUpEligible + grossedUpNonEligible;
}

/**
 * Calculate total federal dividend tax credits
 */
export function calculateTotalDividendTaxCredits(
  eligibleDividends: number,
  nonEligibleDividends: number
): number {
  const grossedUpEligible = grossUpEligibleDividend(eligibleDividends);
  const grossedUpNonEligible = grossUpNonEligibleDividend(nonEligibleDividends);

  const eligibleCredit = calculateEligibleDividendCredit(grossedUpEligible);
  const nonEligibleCredit = calculateNonEligibleDividendCredit(grossedUpNonEligible);

  return eligibleCredit + nonEligibleCredit;
}

/**
 * Result of dividend tax calculation
 */
export interface DividendTaxResult {
  actualDividends: number;
  grossedUpAmount: number;
  federalTaxCredit: number;
  netTaxImpact: number;
}

/**
 * Calculate provincial dividend tax credit for eligible and non-eligible dividends
 * Applied to grossed-up dividend amounts at province-specific rates (per D-03, D-04, D-05)
 * @see docs/source-of-truth/04-tax-engine.md - Provincial Dividend Credits
 */
export function calculateProvincialDividendCredit(
  eligibleDividends: number,
  nonEligibleDividends: number,
  province: ProvinceCode,
  year: number
): number {
  const tables = getProvincialTaxTables(year);
  const table = tables[province];
  if (!table) return 0;

  const eligibleRate = table.eligibleDividendCreditRate ?? 0;
  const nonEligibleRate = table.nonEligibleDividendCreditRate ?? 0;

  const grossedUpEligible = grossUpEligibleDividend(eligibleDividends);
  const grossedUpNonEligible = grossUpNonEligibleDividend(nonEligibleDividends);

  return grossedUpEligible * eligibleRate + grossedUpNonEligible * nonEligibleRate;
}

/**
 * Calculate complete dividend tax impact
 * @see docs/source-of-truth/04-tax-engine.md - TC-TAX-005
 */
export function calculateDividendTaxImpact(
  eligibleDividends: number,
  nonEligibleDividends: number,
  combinedMarginalRate: number
): DividendTaxResult {
  const actualDividends = eligibleDividends + nonEligibleDividends;
  const grossedUpAmount = calculateTaxableDividendIncome(eligibleDividends, nonEligibleDividends);
  const federalTaxCredit = calculateTotalDividendTaxCredits(
    eligibleDividends,
    nonEligibleDividends
  );

  // Tax on grossed-up amount minus credit
  const grossTax = grossedUpAmount * combinedMarginalRate;
  const netTaxImpact = grossTax - federalTaxCredit;

  return {
    actualDividends,
    grossedUpAmount,
    federalTaxCredit,
    netTaxImpact,
  };
}
