/**
 * Per-person sub-summary builder for couple projections.
 *
 * Extracted from multi-year.ts (Phase 10 plan 10-04 LOC cleanup, ENG-05).
 * Used by `calculateCoupleProjectionSummary` to build the `primarySummary`
 * and `spouseSummary` halves that hang off the couple-level summary. The
 * household summary carries the authoritative fundedStatus classification;
 * this helper produces a stub `state` derived from `portfolioLongevityAge`
 * for per-person UI rendering only.
 *
 * @see docs/source-of-truth/09-success-metrics.md
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 */

import type { ProjectionSummary } from '@retireops/shared';

export function calculatePersonSummary(
  results: Array<{
    year: number;
    age: number;
    totalNetWorth: number;
    taxesPaid: number;
    totalIncome: number;
    isRetired: boolean;
    taxCalculation: { effectiveRate: number };
  }>
): ProjectionSummary {
  if (results.length === 0) {
    return {
      startYear: 0,
      endYear: 0,
      retirementYear: 0,
      yearsInRetirement: 0,
      peakNetWorth: 0,
      peakNetWorthYear: 0,
      portfolioLongevityAge: null,
      totalTaxesPaid: 0,
      averageRetirementIncome: 0,
      averageEffectiveTaxRate: 0,
      moneyLastsToLifeExpectancy: true,
      lowestNetWorth: 0,
      lowestNetWorthYear: 0,
      // Per-person sub-summary: fundedStatus stub (household summary has authoritative classification)
      fundedStatus: {
        state: 'green',
        depletionAge: null,
        balanceAtLifeExpectancy: 0,
        totalRetirementWithdrawals: 0,
      },
      remediationPlan: null,
    };
  }

  const firstResult = results[0];
  const lastResult = results[results.length - 1];
  if (!firstResult || !lastResult) {
    throw new Error('Unexpected empty results after length check');
  }

  let peakNetWorth = 0;
  let peakNetWorthYear = firstResult.year;
  let lowestNetWorth = Infinity;
  let lowestNetWorthYear = firstResult.year;
  let totalTaxesPaid = 0;
  let retirementIncomeSum = 0;
  let retirementYears = 0;
  let portfolioLongevityAge: number | null = null;

  const retirementYear = results.find((r) => r.isRetired)?.year ?? lastResult.year;

  for (const result of results) {
    if (result.totalNetWorth > peakNetWorth) {
      peakNetWorth = result.totalNetWorth;
      peakNetWorthYear = result.year;
    }
    if (result.totalNetWorth < lowestNetWorth) {
      lowestNetWorth = result.totalNetWorth;
      lowestNetWorthYear = result.year;
    }
    totalTaxesPaid += result.taxesPaid;
    if (result.isRetired) {
      retirementIncomeSum += result.totalIncome - result.taxesPaid;
      retirementYears++;
    }
    if (result.totalNetWorth <= 0 && portfolioLongevityAge === null) {
      portfolioLongevityAge = result.age;
    }
  }

  // Per-person sub-summary stub (household summary has authoritative classification)
  const personFundedStatus = {
    state: (portfolioLongevityAge !== null ? 'red' : 'green') as 'green' | 'yellow' | 'red',
    depletionAge: portfolioLongevityAge,
    balanceAtLifeExpectancy: lastResult.totalNetWorth,
    totalRetirementWithdrawals: 0,
  };

  return {
    startYear: firstResult.year,
    endYear: lastResult.year,
    retirementYear,
    yearsInRetirement: retirementYears,
    peakNetWorth,
    peakNetWorthYear,
    portfolioLongevityAge,
    totalTaxesPaid,
    averageRetirementIncome: retirementYears > 0 ? retirementIncomeSum / retirementYears : 0,
    averageEffectiveTaxRate:
      results.reduce((sum, r) => sum + r.taxCalculation.effectiveRate, 0) / results.length,
    moneyLastsToLifeExpectancy: portfolioLongevityAge === null,
    lowestNetWorth: lowestNetWorth === Infinity ? 0 : lowestNetWorth,
    lowestNetWorthYear,
    fundedStatus: personFundedStatus,
    remediationPlan: null,
  };
}
