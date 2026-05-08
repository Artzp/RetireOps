/**
 * Annualized pension income calculation with bridge benefit handling.
 *
 * Extracted from multi-year.ts (Phase 10 plan 10-04 LOC cleanup, ENG-05).
 * Computes the per-year pension cash flow including any bridge-benefit top-up
 * paid until the bridgeEndAge. Approximates the monthly cutoff inside the
 * yearly engine by paying the bridge only for months up to and including the
 * birthday month in the bridgeEndYear.
 *
 * @see docs/source-of-truth/03-income-sources.md - Pension Income / Bridge Benefit
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 */

export function calculateAnnualizedPensionIncome(
  basePensionIncome: number | undefined,
  bridgeBenefit: number | undefined,
  bridgeEndAge: number | undefined,
  birthdate: Date,
  year: number
): number {
  const pensionIncome = basePensionIncome ?? 0;
  const annualBridgeBenefit = bridgeBenefit ?? 0;

  if (annualBridgeBenefit <= 0 || bridgeEndAge === undefined) {
    return pensionIncome;
  }

  const bridgeEndYear = birthdate.getFullYear() + bridgeEndAge;

  if (year < bridgeEndYear) {
    return pensionIncome + annualBridgeBenefit;
  }

  if (year > bridgeEndYear) {
    return pensionIncome;
  }

  // Approximate the monthly cutoff inside the yearly engine by paying the bridge
  // only for the months up to and including the birthday month.
  const bridgeActiveMonths = birthdate.getMonth() + 1;
  return pensionIncome + annualBridgeBenefit * (bridgeActiveMonths / 12);
}
