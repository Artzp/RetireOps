/**
 * Single-projection summary builder.
 *
 * Extracted from multi-year.ts (Phase 10 plan 10-04 LOC cleanup, ENG-05).
 * Computes the household-level summary stats (peaks, longevity, taxes,
 * retirement income, fundedStatus) for a single-person ProjectionOutput.
 * The remediationPlan slot is populated to `null` here; Phase 49 wiring in
 * `runSingleProjection` populates it for Red-state projections.
 *
 * @see docs/source-of-truth/09-success-metrics.md
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 */

import type { ProjectionInput, ProjectionSummary, YearlyResult } from '@retireops/shared';
import { computeFundedStatus } from '../funded-status.js';

export function calculateProjectionSummary(
  results: YearlyResult[],
  input: ProjectionInput // was _input — renamed because we now use it for computeFundedStatus
): ProjectionSummary {
  if (results.length === 0) {
    throw new Error('No yearly results to summarize');
  }

  const firstResult = results[0];
  const lastResult = results[results.length - 1];

  // Find peak net worth
  let peakNetWorth = 0;
  let peakNetWorthYear = firstResult?.year ?? 0;

  // Find lowest net worth
  let lowestNetWorth = Infinity;
  let lowestNetWorthYear = firstResult?.year ?? 0;

  // Calculate totals
  let totalTaxesPaid = 0;
  let retirementIncomeSum = 0;
  let retirementYears = 0;

  // Find retirement year
  const retirementYear = results.find((r) => r.isRetired)?.year ?? lastResult?.year ?? 0;

  // Find when money runs out
  let portfolioLongevityAge: number | null = null;

  for (const result of results) {
    // Track peak net worth
    if (result.totalNetWorth > peakNetWorth) {
      peakNetWorth = result.totalNetWorth;
      peakNetWorthYear = result.year;
    }

    // Track lowest net worth
    if (result.totalNetWorth < lowestNetWorth) {
      lowestNetWorth = result.totalNetWorth;
      lowestNetWorthYear = result.year;
    }

    // Sum taxes
    totalTaxesPaid += result.taxesPaid;

    // Track retirement income
    if (result.isRetired) {
      retirementIncomeSum += result.totalIncome - result.taxesPaid;
      retirementYears++;
    }

    // Check if money ran out
    if (result.totalNetWorth <= 0 && portfolioLongevityAge === null) {
      portfolioLongevityAge = result.age;
    }
  }

  const averageRetirementIncome = retirementYears > 0 ? retirementIncomeSum / retirementYears : 0;
  const averageEffectiveTaxRate =
    totalTaxesPaid > 0
      ? results.reduce((sum, r) => sum + r.taxCalculation.effectiveRate, 0) / results.length
      : 0;

  const moneyLastsToLifeExpectancy = portfolioLongevityAge === null;

  const fundedStatus = computeFundedStatus(results, input);

  return {
    startYear: firstResult?.year ?? 0,
    endYear: lastResult?.year ?? 0,
    retirementYear,
    yearsInRetirement: retirementYears,

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
  };
}
