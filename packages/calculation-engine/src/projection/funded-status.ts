/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import type {
  YearlyResult,
  ProjectionInput,
  ProjectionOutput,
  FundedStatus,
  RemediationPlan,
} from '@retireops/shared';

/**
 * Threshold below which a non-depleting projection is classified Yellow.
 * balanceAtLifeExpectancy / totalRetirementWithdrawals < 0.10 → Yellow.
 * @see .specify/specs/007-funded-indicator/spec.md — FR-003
 */
const YELLOW_GREEN_BUFFER_THRESHOLD = 0.1;

const BINARY_SEARCH_ITERATIONS = 20;
const SAVINGS_LEVER_MAX = 200_000;

/**
 * Classify a completed projection's funded state from its year-by-year results.
 *
 * Pure function over the already-computed results[] array — zero new runProjection()
 * calls (FR-001). Single-pass O(n) over n ≤ ~90 rows.
 *
 * Classification rules (FR-002, FR-003, FR-004):
 * - Red:    first row where totalNetWorth <= 0 exists before life expectancy
 * - Green:  portfolio lasts to LE with balanceAtLE / totalWithdrawals >= 0.10
 * - Yellow: portfolio lasts to LE with balanceAtLE / totalWithdrawals < 0.10
 * - Edge:   totalRetirementWithdrawals === 0 → Green (ratio is ∞)
 *
 * For couple projections, uses Math.max(primary, spouse) life expectancy as
 * the horizon age (FUND-12).
 *
 * @see .specify/specs/007-funded-indicator/spec.md — FR-002, FR-003, FR-004, FR-005, FR-012
 * @see docs/MODULE-MAP.md — packages/calculation-engine/src/projection/funded-status.ts
 */
export function computeFundedStatus(results: YearlyResult[], input: ProjectionInput): FundedStatus {
  // FUND-12: couple horizon = longer-lived spouse's LE
  const horizonAge =
    input.spouse !== undefined
      ? Math.max(input.lifeExpectancy, input.spouse.lifeExpectancy)
      : input.lifeExpectancy;

  // Detect first depletion row (Red trigger)
  const depletionResult = results.find((r) => r.totalNetWorth <= 0);
  const totalRetirementWithdrawals = sumRetirementWithdrawals(results, input);

  if (depletionResult !== undefined) {
    return {
      state: 'red',
      depletionAge: depletionResult.age,
      balanceAtLifeExpectancy: 0,
      totalRetirementWithdrawals,
    };
  }

  // Non-depleting — find LE-horizon row
  const leResult = results.find((r) => r.age === horizonAge) ?? results[results.length - 1];
  const balanceAtLifeExpectancy = leResult?.totalNetWorth ?? 0;

  // Edge case (TC-PROJ-042): zero-withdrawal retirement → Green (spec Assumptions)
  if (totalRetirementWithdrawals === 0) {
    return {
      state: 'green',
      depletionAge: null,
      balanceAtLifeExpectancy,
      totalRetirementWithdrawals: 0,
    };
  }

  const bufferRatio = balanceAtLifeExpectancy / totalRetirementWithdrawals;
  const state = bufferRatio >= YELLOW_GREEN_BUFFER_THRESHOLD ? 'green' : 'yellow';

  return {
    state,
    depletionAge: null,
    balanceAtLifeExpectancy,
    totalRetirementWithdrawals,
  };
}

/**
 * Binary-search three remediation levers to find minimum adjustments that
 * move a Red-state projection to Yellow or Green. 20 iterations per lever
 * (savings, spending) plus integer iteration for delay.
 *
 * `runProjection` is injected as a callback to avoid a circular module
 * dependency between funded-status.ts and multi-year.ts. Callers pass
 * `runSingleProjection` or `runCoupleProjection` at call time.
 *
 * Only call when fundedStatus.state === 'red' (REGR-011 — no overhead on
 * non-Red projections).
 *
 * @see .specify/specs/007-funded-indicator/spec.md — FR-006, FR-007, FR-008
 * @see .specify/specs/007-funded-indicator/data-model.md §Exported functions
 */
export function computeRemediationPlan(
  input: ProjectionInput,
  _fundedStatus: FundedStatus,
  runProjection: (input: ProjectionInput) => ProjectionOutput
): RemediationPlan {
  const additionalAnnualSavings = searchSavingsLever(input, runProjection);
  const annualSpendingReduction = searchSpendingLever(input, runProjection);
  const { years: retirementDelayYears, capReached: delayCapReached } = searchDelayLever(
    input,
    runProjection
  );

  return {
    additionalAnnualSavings: Math.ceil(additionalAnnualSavings),
    annualSpendingReduction: Math.ceil(annualSpendingReduction),
    retirementDelayYears,
    delayCapReached,
  };
}

// ---------------------------------------------------------------------------
// Binary-search helpers (Phase 49)
// ---------------------------------------------------------------------------

function isNoLongerRed(
  input: ProjectionInput,
  runProjection: (i: ProjectionInput) => ProjectionOutput
): boolean {
  const output = runProjection(input);
  const status = computeFundedStatus(output.yearlyResults, input);
  return status.state !== 'red';
}

function searchSavingsLever(
  input: ProjectionInput,
  runProjection: (i: ProjectionInput) => ProjectionOutput
): number {
  // Cap at 40% of gross employment income so recommendations stay realistic
  const incomeCap = input.employmentIncome > 0 ? input.employmentIncome * 0.4 : SAVINGS_LEVER_MAX;
  const effectiveMax = Math.min(SAVINGS_LEVER_MAX, incomeCap);

  // Fast rejection: if even the max savings can't fix it, return the ceiling.
  const ceilingInput: ProjectionInput = {
    ...input,
    rrspAnnualContribution: input.rrspAnnualContribution + effectiveMax,
  };
  if (!isNoLongerRed(ceilingInput, runProjection)) {
    return effectiveMax;
  }

  let lo = 0;
  let hi = effectiveMax;
  for (let i = 0; i < BINARY_SEARCH_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    const mutated: ProjectionInput = {
      ...input,
      rrspAnnualContribution: input.rrspAnnualContribution + mid,
    };
    if (isNoLongerRed(mutated, runProjection)) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return hi;
}

function searchSpendingLever(
  input: ProjectionInput,
  runProjection: (i: ProjectionInput) => ProjectionOutput
): number {
  const maxReduction = input.retirementSpending;
  if (maxReduction <= 0) return 0; // guard zero-spend edge case (Pitfall 5)

  const ceilingInput: ProjectionInput = {
    ...input,
    retirementSpending: 0,
  };
  if (!isNoLongerRed(ceilingInput, runProjection)) {
    return maxReduction; // silent ceiling (v2: spendingCapReached)
  }

  let lo = 0;
  let hi = maxReduction;
  for (let i = 0; i < BINARY_SEARCH_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    const mutated: ProjectionInput = {
      ...input,
      retirementSpending: input.retirementSpending - mid,
    };
    if (isNoLongerRed(mutated, runProjection)) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return hi;
}

function searchDelayLever(
  input: ProjectionInput,
  runProjection: (i: ProjectionInput) => ProjectionOutput
): { years: number; capReached: boolean } {
  const retirementAge = input.retirementAge;
  const maxDelay = Math.max(0, 70 - retirementAge);

  for (let delay = 0; delay <= maxDelay; delay++) {
    const mutated: ProjectionInput = {
      ...input,
      retirementAge: retirementAge + delay,
    };
    if (isNoLongerRed(mutated, runProjection)) {
      return { years: delay, capReached: false };
    }
  }
  return { years: maxDelay, capReached: true };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Sum of gross account withdrawals across all retirement-phase years.
 * Retirement phase = years where age >= input.retirementAge.
 *
 * YearlyResult (legacy single type) has: rrifWithdrawal, tfsaWithdrawal, nonRegWithdrawal.
 * There is no lifWithdrawal field on YearlyResult (that lives on PersonYearlyResult).
 *
 * Verified withdrawal field names per 48-RESEARCH.md Open Question 1 (RESOLVED).
 */
function sumRetirementWithdrawals(results: YearlyResult[], input: ProjectionInput): number {
  const retirementAge = input.retirementAge;
  if (retirementAge === undefined) {
    return 0;
  }
  return results
    .filter((r) => r.age >= retirementAge)
    .reduce((sum, r) => sum + r.rrifWithdrawal + r.tfsaWithdrawal + r.nonRegWithdrawal, 0);
}
