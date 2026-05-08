/**
 * Federal Tax Calculations
 * @see docs/source-of-truth/04-tax-engine.md - Federal Tax Brackets
 */
import {
  type TaxBracket,
  FEDERAL_TAX_2024,
  FEDERAL_TAX_2025,
  FEDERAL_TAX_2026,
  AGE_CREDIT_2024,
  PENSION_INCOME_CREDIT_2024,
} from '@retireops/shared';
import type { TaxYearParams } from './indexing.js';

/**
 * Calculate tax using bracket rates
 * @see docs/source-of-truth/04-tax-engine.md - Step 4: Calculate Federal Tax
 */
export function calculateBracketTax(taxableIncome: number, brackets: TaxBracket[]): number {
  if (taxableIncome <= 0) return 0;

  let totalTax = 0;
  let remainingIncome = taxableIncome;

  for (const bracket of brackets) {
    if (remainingIncome <= 0) break;

    const taxableInBracket = Math.min(remainingIncome, bracket.max - bracket.min);
    totalTax += taxableInBracket * bracket.rate;
    remainingIncome -= taxableInBracket;
  }

  return totalTax;
}

/**
 * Get federal tax brackets for a given year
 */
export function getFederalTaxBrackets(year: number): TaxBracket[] {
  if (year >= 2026) {
    return FEDERAL_TAX_2026.brackets;
  }
  if (year >= 2025) {
    return FEDERAL_TAX_2025.brackets;
  }
  if (year >= 2024) {
    return FEDERAL_TAX_2024.brackets;
  }
  // Default to 2024 for historical (should add historical data)
  return FEDERAL_TAX_2024.brackets;
}

/**
 * Get federal basic personal amount for a given year
 * @see docs/source-of-truth/04-tax-engine.md - Federal Basic Personal Amount
 */
export function getFederalBasicPersonalAmount(year: number): number {
  if (year >= 2026) return FEDERAL_TAX_2026.basicPersonalAmount;
  if (year >= 2025) return FEDERAL_TAX_2025.basicPersonalAmount;
  if (year >= 2024) return 15705;
  return 15705; // Default
}

function getFederalNonRefundableCreditRate(year: number): number {
  return getFederalTaxBrackets(year)[0]?.rate ?? 0.15;
}

/**
 * Calculate federal tax before credits
 * @see docs/source-of-truth/04-tax-engine.md - Step 4
 */
export function calculateFederalTaxBeforeCredits(
  taxableIncome: number,
  year: number,
  taxYearParams?: TaxYearParams
): number {
  const brackets = taxYearParams?.federalBrackets ?? getFederalTaxBrackets(year);
  return calculateBracketTax(taxableIncome, brackets);
}

/**
 * Calculate federal basic personal amount credit
 */
export function calculateBasicPersonalAmountCredit(
  year: number,
  taxYearParams?: TaxYearParams
): number {
  const bpa = taxYearParams?.federalBpa ?? getFederalBasicPersonalAmount(year);
  return bpa * getFederalNonRefundableCreditRate(year);
}

/**
 * Calculate federal age credit
 * @see docs/source-of-truth/04-tax-engine.md - Age Credit Section
 */
export function calculateFederalAgeCredit(
  age: number,
  netIncome: number,
  year: number,
  taxYearParams?: TaxYearParams
): number {
  if (age < 65) return 0;

  const base = AGE_CREDIT_2024.federal;
  const ageAmount = taxYearParams?.federalAgeAmount ?? base.ageAmount;
  const incomeThreshold = taxYearParams?.federalAgeAmountThreshold ?? base.incomeThreshold;
  const { reductionRate, creditRate } = base;

  const reduction = Math.max(0, (netIncome - incomeThreshold) * reductionRate);
  const netAgeAmount = Math.max(0, ageAmount - reduction);

  return netAgeAmount * getFederalNonRefundableCreditRate(year) * (creditRate / 0.15);
}

/**
 * Calculate federal pension income credit
 * @see docs/source-of-truth/04-tax-engine.md - Pension Income Credit
 */
export function calculateFederalPensionIncomeCredit(
  eligiblePensionIncome: number,
  year: number
): number {
  const params = PENSION_INCOME_CREDIT_2024.federal;
  const { maxAmount, creditRate } = params;

  const creditBase = Math.min(eligiblePensionIncome, maxAmount);
  const credit = creditBase * getFederalNonRefundableCreditRate(year) * (creditRate / 0.15);
  const maxCredit = maxAmount * getFederalNonRefundableCreditRate(year);

  return Math.min(credit, maxCredit);
}

/**
 * Calculate total federal non-refundable credits
 * @see docs/source-of-truth/04-tax-engine.md - Step 4
 */
export function calculateFederalNonRefundableCredits(
  age: number,
  netIncome: number,
  eligiblePensionIncome: number,
  year: number,
  taxYearParams?: TaxYearParams
): number {
  let totalCredits = 0;

  // Basic personal amount credit
  totalCredits += calculateBasicPersonalAmountCredit(year, taxYearParams);

  // Age credit (65+)
  totalCredits += calculateFederalAgeCredit(age, netIncome, year, taxYearParams);

  // Pension income credit (not indexed in this pass)
  totalCredits += calculateFederalPensionIncomeCredit(eligiblePensionIncome, year);

  return totalCredits;
}

/**
 * Calculate net federal tax
 * @see docs/source-of-truth/04-tax-engine.md - Step 4
 */
export function calculateFederalTax(
  taxableIncome: number,
  age: number,
  netIncome: number,
  eligiblePensionIncome: number,
  year: number,
  isQuebec: boolean = false,
  taxYearParams?: TaxYearParams
): number {
  const taxBeforeCredits = calculateFederalTaxBeforeCredits(taxableIncome, year, taxYearParams);
  const credits = calculateFederalNonRefundableCredits(
    age,
    netIncome,
    eligiblePensionIncome,
    year,
    taxYearParams
  );

  let netTax = Math.max(0, taxBeforeCredits - credits);

  // Apply Quebec abatement if applicable
  // @see docs/source-of-truth/04-tax-engine.md - Quebec special handling
  if (isQuebec) {
    netTax = netTax * (1 - 0.165); // 16.5% abatement
  }

  return netTax;
}

/**
 * Get federal marginal tax rate for a given income level
 */
export function getFederalMarginalRate(taxableIncome: number, year: number): number {
  const brackets = getFederalTaxBrackets(year);

  for (const bracket of brackets) {
    if (taxableIncome <= bracket.max) {
      return bracket.rate;
    }
  }

  // Return top rate if above all brackets
  return brackets[brackets.length - 1]?.rate ?? 0;
}
