/**
 * Inflation Display Constants — Feature 3.4
 *
 * Single source of truth for display-mode type and the monetary field list
 * used by both the calculation engine and the web UI to deflate
 * ProjectionYearRow values into today's-dollar terms.
 *
 * @see docs/source-of-truth/06-investment-engine.md — Real vs. Nominal Dollars
 */

import type { ProjectionYearRow } from '../types/projection.js';

/**
 * Display mode for projection results presentation.
 * - `'nominal'` — future dollars (default, preserves current behaviour)
 * - `'real'`    — today's dollars, deflated by scenario inflation rate
 */
export type DisplayMode = 'nominal' | 'real';

/**
 * Monetary fields on ProjectionYearRow that should be deflated when
 * switching to real display mode.
 *
 * Excluded (non-monetary / rate fields):
 *   year, age, spouseAge — identity
 *   isRetired, isRRIFConversionYear, rrifConversionYear, spouseRrifConversionYear — flags
 *   effectiveTaxRate, spouseEffectiveTaxRate — percentage rates
 *   rrifMinimumRate, spouseRrifMinimumRate — percentage rates
 *
 * @see docs/source-of-truth/06-investment-engine.md — Real vs. Nominal Dollars
 */
export const MONETARY_FIELDS: readonly (keyof ProjectionYearRow)[] = [
  // Primary income
  'employmentIncome',
  'selfEmploymentIncome',
  'rentalIncome',
  'pensionIncome',
  'cppIncome',
  'oasGrossIncome',
  'oasNetIncome',
  'oasIncome',
  'gisIncome',
  'rrifWithdrawal',
  'lifWithdrawal',
  'tfsaWithdrawal',
  'nonRegWithdrawal',
  'totalGrossIncome',
  // Primary taxes (dollar amounts only)
  'federalTax',
  'provincialTax',
  'oasClawback',
  'cppContributions',
  'eiPremiums',
  'totalTax',
  'totalTaxIncludingOASRecovery',
  // Primary spending
  'livingExpenses',
  'goalSpending',
  'debtPayments',
  'netCashFlow',
  // Primary balances
  'rrspBalance',
  'rrifBalance',
  'liraBalance',
  'lifBalance',
  'tfsaBalance',
  'nonRegBalance',
  'totalNetWorth',
  // RRIF dollar output (not rate)
  'rrifForcedMinimum',
  // Spouse income
  'spouseEmploymentIncome',
  'spousePensionIncome',
  'spouseCppIncome',
  'spouseOasGrossIncome',
  'spouseOasNetIncome',
  'spouseOasIncome',
  'spouseGisIncome',
  'spouseRrifWithdrawal',
  'spouseLifWithdrawal',
  'spouseTfsaWithdrawal',
  'spouseNonRegWithdrawal',
  // Spouse taxes
  'spouseFederalTax',
  'spouseProvincialTax',
  'spouseOasClawback',
  'spouseTotalTax',
  'spouseTotalTaxIncludingOASRecovery',
  // Spouse balances
  'spouseRrspBalance',
  'spouseRrifBalance',
  'spouseLiraBalance',
  'spouseLifBalance',
  'spouseTfsaBalance',
  'spouseNonRegBalance',
  'spouseRrifForcedMinimum',
  // Spouse spending (per-person split of livingExpenses + netCashFlow)
  'spouseLivingExpenses',
  'spouseNetCashFlow',
  // Pension splitting per-year cash flows (M005/P3)
  'pensionIncomeReceived',
  'pensionIncomeTransferred',
  'spousePensionIncomeReceived',
  'spousePensionIncomeTransferred',
  'pensionSplitTaxSavings',
  // Contribution room per-year (M005/P4) — dollar amounts, not percentages
  'rrspContributionRoom',
  'spouseRrspContributionRoom',
  // Bracket-fill withdrawal per-year (M005/P5) — dollar amounts
  'bracketFillWithdrawal',
  'spouseBracketFillWithdrawal',
  // Household aggregates
  'householdTotalIncome',
  'householdTotalTax',
  'householdNetCashFlow',
  'householdNetWorth',
];
