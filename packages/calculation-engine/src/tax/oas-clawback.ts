/**
 * OAS Clawback Calculations
 * @see docs/source-of-truth/04-tax-engine.md - OAS Clawback (Recovery Tax)
 * @see docs/source-of-truth/05-government-benefits.md - OAS Clawback
 */
import { OAS_CLAWBACK_THRESHOLDS, OAS_RATES } from '@retireops/shared';

/**
 * Resolve the tabled OAS clawback threshold set for `year`.
 *
 * Fallback rule (audit A-06): pick the largest tabled year that is <= `year`;
 * when `year` predates the earliest tabled year, clamp to that earliest year.
 * Exact keys resolve to themselves (they are the largest year <= themselves).
 * Years past the latest tabled year resolve to the latest set (callers index
 * those forward via buildTaxYearParams; this function only supplies the base).
 */
function getOASClawbackThresholdSet(year: number) {
  const knownYears = Object.keys(OAS_CLAWBACK_THRESHOLDS)
    .map(Number)
    .sort((a, b) => a - b);
  const earliestKnownYear = knownYears[0];
  if (earliestKnownYear === undefined) {
    throw new Error('OAS clawback thresholds are not configured');
  }

  // Largest tabled year <= year; clamp to the earliest when year is below range.
  let resolvedYear = earliestKnownYear;
  for (const knownYear of knownYears) {
    if (knownYear <= year) resolvedYear = knownYear;
  }

  return OAS_CLAWBACK_THRESHOLDS[resolvedYear as keyof typeof OAS_CLAWBACK_THRESHOLDS];
}

/**
 * Get OAS clawback threshold for a given year
 */
export function getOASClawbackThreshold(year: number): number {
  const thresholds = getOASClawbackThresholdSet(year);
  return thresholds.threshold;
}

/**
 * Get OAS full clawback threshold based on age
 */
export function getOASFullClawbackThreshold(year: number, age: number): number {
  const thresholds = getOASClawbackThresholdSet(year);
  return age >= 75 ? thresholds.fullClawbackAge75Plus : thresholds.fullClawbackAge65To74;
}

/**
 * Calculate OAS clawback amount
 * @see docs/source-of-truth/04-tax-engine.md - OAS Clawback Calculation
 * @see docs/source-of-truth/05-government-benefits.md - TC-GOV-004
 *
 * Net income includes:
 * - All taxable income
 * - Dividend gross-up amounts
 * - Taxable capital gains (50% of gains)
 *
 * Net income EXCLUDES:
 * - TFSA withdrawals
 * - Non-taxable income (inheritance, lottery, etc.)
 */
export function calculateOASClawback(
  netIncome: number,
  oasAmount: number,
  year: number,
  indexedThreshold?: number
): number {
  const threshold = indexedThreshold ?? getOASClawbackThreshold(year);

  if (netIncome <= threshold) {
    return 0;
  }

  const excessIncome = netIncome - threshold;
  const clawback = excessIncome * OAS_RATES.clawbackRate; // 15%

  // Clawback cannot exceed OAS amount
  return Math.min(clawback, oasAmount);
}

/**
 * Calculate net OAS after clawback
 */
export function calculateNetOAS(grossOAS: number, netIncome: number, year: number): number {
  const clawback = calculateOASClawback(netIncome, grossOAS, year);
  return Math.max(0, grossOAS - clawback);
}

/**
 * Check if OAS is fully clawed back
 */
export function isOASFullyClawedBack(netIncome: number, year: number, age: number): boolean {
  const fullClawbackThreshold = getOASFullClawbackThreshold(year, age);
  return netIncome >= fullClawbackThreshold;
}

/**
 * Calculate income that would trigger a specific clawback amount
 * Useful for planning optimal withdrawal amounts
 */
export function incomeForTargetClawback(targetClawback: number, year: number): number {
  const threshold = getOASClawbackThreshold(year);
  return threshold + targetClawback / OAS_RATES.clawbackRate;
}

/**
 * Calculate maximum income to avoid any OAS clawback
 */
export function maxIncomeToAvoidClawback(year: number): number {
  return getOASClawbackThreshold(year);
}
