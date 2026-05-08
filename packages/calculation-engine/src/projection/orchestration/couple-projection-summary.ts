/**
 * Couple-projection summary builder.
 *
 * Extracted from multi-year.ts (Phase 10 plan 10-04 LOC cleanup, ENG-05).
 * Computes household-level summary metrics + per-spouse sub-summaries for the
 * couple ProjectionOutput. The `remediationPlan` slot is populated to `null`;
 * Phase 49 wiring in `runCoupleProjection` populates it for Red-state projections.
 *
 * @see docs/source-of-truth/09-success-metrics.md
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 */

import type {
  CoupleProjectionSummary,
  CoupleYearlyResult,
  ProjectionInput,
  YearlyResult,
} from '@retireops/shared';
import { ageAtEndOfYear, getCurrentYear } from '@retireops/shared';
import { computeFundedStatus } from '../funded-status.js';
import { calculatePersonSummary } from './person-summary.js';

export function calculateCoupleProjectionSummary(
  results: CoupleYearlyResult[],
  input: ProjectionInput
): CoupleProjectionSummary {
  if (results.length === 0) {
    throw new Error('No yearly results to summarize');
  }

  const firstResult = results[0];
  const lastResult = results[results.length - 1];

  // Household-level metrics
  let peakNetWorth = 0;
  let peakNetWorthYear = firstResult?.year ?? 0;
  let lowestNetWorth = Infinity;
  let lowestNetWorthYear = firstResult?.year ?? 0;
  let totalTaxesPaid = 0;
  let retirementIncomeSum = 0;
  let bothRetiredYears = 0;
  let totalPensionSplitSavings = 0;
  let pensionSplitYears = 0;

  // Find retirement years
  const primaryRetirementYear =
    results.find((r) => r.primary.isRetired)?.year ?? lastResult?.year ?? 0;
  const spouseRetirementYear =
    results.find((r) => r.spouse.isRetired)?.year ?? lastResult?.year ?? 0;
  const bothRetiredYear = results.find((r) => r.bothRetired)?.year ?? lastResult?.year ?? 0;

  // Find when money runs out
  let portfolioLongevityAge: number | null = null;

  for (const result of results) {
    // Track peak net worth
    if (result.householdNetWorth > peakNetWorth) {
      peakNetWorth = result.householdNetWorth;
      peakNetWorthYear = result.year;
    }

    // Track lowest net worth
    if (result.householdNetWorth < lowestNetWorth) {
      lowestNetWorth = result.householdNetWorth;
      lowestNetWorthYear = result.year;
    }

    // Sum taxes
    totalTaxesPaid += result.householdTaxesPaid;

    // Track retirement income
    if (result.bothRetired) {
      retirementIncomeSum += result.householdNetIncome;
      bothRetiredYears++;
    }

    // Track pension splitting
    if (result.pensionSplitPercentage > 0) {
      totalPensionSplitSavings += result.pensionSplitTaxSavings;
      pensionSplitYears++;
    }

    // Check if money ran out (use primary age as reference)
    if (result.householdNetWorth <= 0 && portfolioLongevityAge === null) {
      portfolioLongevityAge = result.primary.age;
    }
  }

  const averageRetirementIncome = bothRetiredYears > 0 ? retirementIncomeSum / bothRetiredYears : 0;
  const averageEffectiveTaxRate =
    totalTaxesPaid > 0
      ? results.reduce(
          (sum, r) =>
            sum +
            (r.primary.taxCalculation.effectiveRate + r.spouse.taxCalculation.effectiveRate) / 2,
          0
        ) / results.length
      : 0;
  const averagePensionSplitPercentage =
    pensionSplitYears > 0
      ? results.reduce((sum, r) => sum + r.pensionSplitPercentage, 0) / pensionSplitYears
      : 0;

  const moneyLastsToLifeExpectancy = portfolioLongevityAge === null;

  // Calculate individual summaries
  const primaryResults = results.map((r) => ({
    ...r.primary,
    totalIncome: r.primary.totalGrossIncome,
  }));
  const spouseResults = results.map((r) => ({
    ...r.spouse,
    totalIncome: r.spouse.totalGrossIncome,
  }));

  // Build per-spouse summaries using existing function logic
  const primarySummary = calculatePersonSummary(primaryResults);
  const spouseSummary = calculatePersonSummary(spouseResults);

  // Calculate life expectancy years
  // WR-07: Honor input.projectionStartYear when provided, matching
  // computeCoupleProjection. Internally consistent today (firstResult.year
  // derives from the same anchor), but the explicit fallback prevents
  // divergence if a caller drives just this summary function.
  const startYear = input.projectionStartYear ?? getCurrentYear();
  const primaryLifeExpectancyYear =
    startYear + (input.lifeExpectancy - ageAtEndOfYear(input.birthdate, startYear));
  const spouseLifeExpectancyYear = input.spouse
    ? startYear + (input.spouse.lifeExpectancy - ageAtEndOfYear(input.spouse.birthdate, startYear))
    : primaryLifeExpectancyYear;

  const coupleHouseholdResults: YearlyResult[] = results.map((r) => ({
    ...r.primary,
    totalNetWorth: r.householdNetWorth,
    totalIncome: r.primary.totalGrossIncome,
  }));
  const fundedStatus = computeFundedStatus(coupleHouseholdResults, input);

  return {
    // Base summary fields
    startYear: firstResult?.year ?? 0,
    endYear: lastResult?.year ?? 0,
    retirementYear: Math.min(primaryRetirementYear, spouseRetirementYear),
    yearsInRetirement: bothRetiredYears,
    peakNetWorth,
    peakNetWorthYear,
    portfolioLongevityAge,
    totalTaxesPaid,
    averageRetirementIncome,
    averageEffectiveTaxRate,
    moneyLastsToLifeExpectancy,
    lowestNetWorth: lowestNetWorth === Infinity ? 0 : lowestNetWorth,
    lowestNetWorthYear,
    fundedStatus,
    remediationPlan: null, // Phase 49 populates this for Red projections

    // Couple-specific fields
    primarySummary,
    spouseSummary,
    primaryRetirementYear,
    spouseRetirementYear,
    bothRetiredYear,
    totalPensionSplitTaxSavings: totalPensionSplitSavings,
    averagePensionSplitPercentage,
    primaryLifeExpectancyYear,
    spouseLifeExpectancyYear,
    longestLivingSpouseEndYear: Math.max(primaryLifeExpectancyYear, spouseLifeExpectancyYear),
  };
}
