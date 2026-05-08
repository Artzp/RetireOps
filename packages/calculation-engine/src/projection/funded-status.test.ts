/* eslint-disable @typescript-eslint/restrict-template-expressions */
/**
 * Funded Status Classification Tests
 * @see docs/TESTABLE-SURFACES.md — TC-PROJ-036, TC-PROJ-037, TC-PROJ-038, TC-PROJ-042, TC-PROJ-043
 * @see .specify/specs/007-funded-indicator/spec.md — FR-002, FR-003, FR-004, FR-005, FR-012
 */
import { describe, it, expect, vi } from 'vitest';
import type { YearlyResult, ProjectionInput } from '@retireops/shared';
import { getCurrentYear } from '@retireops/shared';
import { computeFundedStatus, computeRemediationPlan } from './funded-status.js';
import { runProjection, runSingleProjection } from './multi-year.js';
import * as fundedStatusModule from './funded-status.js';

// ---------------------------------------------------------------------------
// Minimal fixture builders
// ---------------------------------------------------------------------------

/**
 * Build a minimal YearlyResult for classification tests.
 * Only the fields computeFundedStatus reads:
 * - age, totalNetWorth, isRetired
 * - rrifWithdrawal, tfsaWithdrawal, nonRegWithdrawal (no lifWithdrawal on YearlyResult)
 */
function makeYear(age: number, totalNetWorth: number, isRetired: boolean = false): YearlyResult {
  return {
    year: 2020 + age,
    age,
    employmentIncome: 0,
    pensionIncome: 0,
    cppIncome: 0,
    oasIncome: 0,
    rrifWithdrawal: 0,
    tfsaWithdrawal: 0,
    nonRegWithdrawal: 0,
    totalIncome: 0,
    livingExpenses: 0,
    taxesPaid: 0,
    netCashFlow: 0,
    rrspBalance: 0,
    rrifBalance: 0,
    tfsaBalance: 0,
    nonRegBalance: totalNetWorth,
    totalNetWorth,
    taxCalculation: {
      year: 2020 + age,
      owner: 'primary',
      grossIncome: 0,
      netIncome: 0,
      taxableIncome: 0,
      federalTax: 0,
      provincialTax: 0,
      totalTax: 0,
      effectiveRate: 0,
      marginalRate: 0,
      oasClawback: 0,
    },
    isRetired,
    isRRIFConversionYear: false,
    rrifForcedMinimum: 0,
    rrifMinimumRate: 0,
    rrifConversionYear: false,
  };
}

/**
 * Build a YearlyResult with explicit retirement withdrawals.
 */
function makeRetiredYear(
  age: number,
  totalNetWorth: number,
  withdrawals: {
    rrifWithdrawal?: number;
    tfsaWithdrawal?: number;
    nonRegWithdrawal?: number;
  } = {}
): YearlyResult {
  const base = makeYear(age, totalNetWorth, true);
  return {
    ...base,
    rrifWithdrawal: withdrawals.rrifWithdrawal ?? 0,
    tfsaWithdrawal: withdrawals.tfsaWithdrawal ?? 0,
    nonRegWithdrawal: withdrawals.nonRegWithdrawal ?? 0,
  };
}

/**
 * Minimal ProjectionInput for single-person tests.
 */
function makeSingleInput(retirementAge: number, lifeExpectancy: number): ProjectionInput {
  return {
    birthdate: new Date(1960, 0, 1),
    province: 'ON',
    retirementAge,
    lifeExpectancy,
    employmentIncome: 0,
    employmentGrowthRate: 0,
    rrspBalance: 0,
    rrspAnnualContribution: 0,
    tfsaBalance: 0,
    tfsaAnnualContribution: 0,
    nonRegBalance: 0,
    retirementSpending: 0,
    investmentReturn: 0.04,
    inflationRate: 0.02,
  };
}

/**
 * Minimal ProjectionInput for couple tests.
 */
function makeCoupleInput(
  retirementAge: number,
  primaryLE: number,
  spouseLE: number
): ProjectionInput {
  return {
    ...makeSingleInput(retirementAge, primaryLE),
    spouse: {
      birthdate: new Date(1962, 0, 1),
      retirementAge,
      lifeExpectancy: spouseLE,
      employmentIncome: 0,
      expectedCPPAt65: 0,
      rrspBalance: 0,
      tfsaBalance: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// TC-PROJ-036 — Green classification
// ---------------------------------------------------------------------------

/**
 * @see docs/TESTABLE-SURFACES.md — TC-PROJ-036
 * Green when portfolio lasts to LE with ≥10% buffer (FR-002).
 * balanceAtLifeExpectancy / totalRetirementWithdrawals >= 0.10 → 'green'
 */
describe('TC-PROJ-036 — Green classification (single person)', () => {
  it('classifies Green when balance at LE is ≥ 10% of total withdrawals', () => {
    const retirementAge = 65;
    const lifeExpectancy = 90;
    const withdrawalPerYear = 40_000;

    // 25 retirement years × $40k = $1,000,000 total withdrawals
    // Balance at LE = $500,000 → ratio 0.5 ≥ 0.10 → Green
    const results: YearlyResult[] = [];

    // Pre-retirement years
    for (let age = 60; age < retirementAge; age++) {
      results.push(makeYear(age, 2_000_000));
    }
    // Retirement years — non-depleting
    for (let age = retirementAge; age <= lifeExpectancy; age++) {
      results.push(
        makeRetiredYear(age, 500_000, {
          rrifWithdrawal: withdrawalPerYear,
        })
      );
    }

    const input = makeSingleInput(retirementAge, lifeExpectancy);
    const status = computeFundedStatus(results, input);

    expect(status.state).toBe('green');
    expect(status.depletionAge).toBeNull();
    expect(status.balanceAtLifeExpectancy).toBe(500_000);
    expect(status.totalRetirementWithdrawals).toBe(
      (lifeExpectancy - retirementAge + 1) * withdrawalPerYear
    );
  });
});

// ---------------------------------------------------------------------------
// TC-PROJ-037 — Yellow classification
// ---------------------------------------------------------------------------

/**
 * @see docs/TESTABLE-SURFACES.md — TC-PROJ-037
 * Yellow when portfolio lasts to LE but balance < 10% of total withdrawals (FR-003).
 */
describe('TC-PROJ-037 — Yellow classification (< 10% buffer)', () => {
  it('classifies Yellow when balance at LE is < 10% of total withdrawals', () => {
    const retirementAge = 65;
    const lifeExpectancy = 90;

    // 25 years × $40k = $1,000,000 total withdrawals
    // Balance at LE = $50,000 → ratio 0.05 < 0.10 → Yellow
    const results: YearlyResult[] = [];

    for (let age = 60; age < retirementAge; age++) {
      results.push(makeYear(age, 1_000_000));
    }
    for (let age = retirementAge; age <= lifeExpectancy; age++) {
      results.push(
        makeRetiredYear(age, 50_000, {
          tfsaWithdrawal: 40_000,
        })
      );
    }

    const input = makeSingleInput(retirementAge, lifeExpectancy);
    const status = computeFundedStatus(results, input);

    expect(status.state).toBe('yellow');
    expect(status.depletionAge).toBeNull();
    expect(status.balanceAtLifeExpectancy).toBe(50_000);
    expect(status.totalRetirementWithdrawals).toBe((lifeExpectancy - retirementAge + 1) * 40_000);
  });
});

// ---------------------------------------------------------------------------
// TC-PROJ-038 — Red classification with depletion age
// ---------------------------------------------------------------------------

/**
 * @see docs/TESTABLE-SURFACES.md — TC-PROJ-038
 * Red when portfolio depletes before LE (FR-004, FR-005).
 * Parametrized with 3 distinct depletion ages to prove lookup is dynamic.
 */
describe('TC-PROJ-038 — Red classification with depletion age', () => {
  function buildDepletingResults(
    retirementAge: number,
    lifeExpectancy: number,
    depletionAge: number
  ): YearlyResult[] {
    const results: YearlyResult[] = [];
    for (let age = retirementAge; age <= lifeExpectancy; age++) {
      const netWorth = age < depletionAge ? 100_000 : 0;
      results.push(
        makeRetiredYear(age, netWorth, {
          rrifWithdrawal: 30_000,
        })
      );
    }
    return results;
  }

  const testCases = [
    { depletionAge: 68, retirementAge: 65, lifeExpectancy: 90 },
    { depletionAge: 77, retirementAge: 65, lifeExpectancy: 90 },
    { depletionAge: 82, retirementAge: 65, lifeExpectancy: 90 },
  ];

  for (const { depletionAge, retirementAge, lifeExpectancy } of testCases) {
    it(`classifies Red and captures depletion age = ${depletionAge}`, () => {
      const results = buildDepletingResults(retirementAge, lifeExpectancy, depletionAge);
      const input = makeSingleInput(retirementAge, lifeExpectancy);
      const status = computeFundedStatus(results, input);

      expect(status.state).toBe('red');
      expect(status.depletionAge).toBe(depletionAge);
      expect(status.balanceAtLifeExpectancy).toBe(0);
      expect(status.totalRetirementWithdrawals).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// TC-PROJ-038 (parametrized) — Red classification verified against real runProjection() output
// ---------------------------------------------------------------------------

/**
 * TC-PROJ-038 parametrized — 3 depletion-age fixtures via real runProjection() calls.
 *
 * Proves the classifier reads depletionAge correctly from real engine output, not
 * just hand-crafted arrays. Each case uses a different starting balance to produce
 * an early / mid / late depletion pattern.
 *
 * Assertion invariant per FUND-05:
 *   fundedStatus.depletionAge === result.yearlyResults.find(r => r.totalNetWorth <= 0)?.age
 *
 * @see docs/TESTABLE-SURFACES.md — TC-PROJ-038 (parametrized — 3 depletion ages)
 * @see .specify/specs/007-funded-indicator/spec.md — FR-004, FR-005
 */

/**
 * Build a single-person ProjectionInput tuned to deplete within a specific range.
 * Person is currently age 65 (retires immediately), lifeExpectancy 90, ON province.
 * No CPP/OAS (start ages set to 100 to exclude government benefits from the equation).
 * 0% investment return, 0% inflation — deterministic drawdown.
 *
 * rrspBalance / retirementSpending controls years to depletion.
 */
function buildDepletingEngineFixture(
  rrspBalance: number,
  retirementSpending: number
): ProjectionInput {
  const startYear = getCurrentYear();
  const birthYear = startYear - 65;
  return {
    birthdate: new Date(birthYear, 0, 1),
    province: 'ON' as const,
    retirementAge: 65,
    lifeExpectancy: 90,
    employmentIncome: 0,
    employmentGrowthRate: 0,
    rrspBalance,
    rrspAnnualContribution: 0,
    tfsaBalance: 0,
    tfsaAnnualContribution: 0,
    nonRegBalance: 0,
    retirementSpending,
    investmentReturn: 0,
    inflationRate: 0,
    // Exclude government benefits so depletion depends only on rrspBalance vs spending
    expectedCPPAt65: 0,
    cppStartAge: 100,
    oasStartAge: 100,
  };
}

describe.each([
  {
    name: 'early depletion (severe underfunding, ~3 yrs)',
    fixture: buildDepletingEngineFixture(200_000, 75_000),
  },
  {
    name: 'mid depletion (moderate underfunding, ~8 yrs)',
    fixture: buildDepletingEngineFixture(550_000, 75_000),
  },
  {
    name: 'late depletion (mild underfunding, ~13 yrs)',
    fixture: buildDepletingEngineFixture(900_000, 75_000),
  },
])('TC-PROJ-038 parametrized — $name', ({ fixture }) => {
  it('state is red, depletionAge is non-null, and matches first zero-net-worth row', () => {
    // No spouse → runProjection returns ProjectionOutput with YearlyResult[]
    const result = runProjection(fixture) as {
      yearlyResults: YearlyResult[];
      summary: { portfolioLongevityAge: number | null };
    };
    const fundedStatus = computeFundedStatus(result.yearlyResults, fixture);

    // Must be red (portfolio depletes before LE)
    expect(fundedStatus.state).toBe('red');

    // depletionAge must be non-null (red always has a depletion row)
    expect(fundedStatus.depletionAge).not.toBeNull();

    // FUND-05 invariant: classifier agrees with raw engine output
    const firstDepletionRow = result.yearlyResults.find((r) => r.totalNetWorth <= 0);
    expect(firstDepletionRow).toBeDefined();
    expect(fundedStatus.depletionAge).toBe(firstDepletionRow?.age);
  });
});

// ---------------------------------------------------------------------------
// TC-PROJ-042 — Zero retirement withdrawals edge case → Green
// ---------------------------------------------------------------------------

/**
 * @see docs/TESTABLE-SURFACES.md — TC-PROJ-042
 * When totalRetirementWithdrawals === 0, treat ratio as ∞ → Green (spec Assumptions).
 * Prevents NaN from 0 / 0 (T-48-07 DoS mitigation).
 */
describe('TC-PROJ-042 — Zero retirement withdrawals → Green', () => {
  it('classifies Green when all retirement withdrawals are zero', () => {
    const retirementAge = 65;
    const lifeExpectancy = 90;

    const results: YearlyResult[] = [];
    for (let age = 60; age <= lifeExpectancy; age++) {
      // All withdrawals are 0 — full pension coverage scenario
      results.push(makeRetiredYear(age, 100_000));
    }

    const input = makeSingleInput(retirementAge, lifeExpectancy);
    const status = computeFundedStatus(results, input);

    expect(status.state).toBe('green');
    expect(status.totalRetirementWithdrawals).toBe(0);
    expect(status.balanceAtLifeExpectancy).toBe(100_000);
    expect(status.depletionAge).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// TC-PROJ-043 — Couple projection uses longer-lived spouse horizon (FUND-12)
// ---------------------------------------------------------------------------

/**
 * @see docs/TESTABLE-SURFACES.md — TC-PROJ-043
 * For couple projections, horizon = Math.max(primary.LE, spouse.LE).
 * Tests both directions: spouse > primary and primary > spouse.
 */
describe('TC-PROJ-043 — Couple uses Math.max(primary, spouse) life expectancy horizon', () => {
  /**
   * Build results array extending to maxAge.
   * Row at age 85 has totalNetWorth = 200_000.
   * Row at age 92 has totalNetWorth = 20_000.
   */
  function buildCoupleResults(retirementAge: number, maxAge: number): YearlyResult[] {
    const results: YearlyResult[] = [];
    for (let age = retirementAge; age <= maxAge; age++) {
      const netWorth = age === 85 ? 200_000 : age === 92 ? 20_000 : 150_000;
      results.push(
        makeRetiredYear(age, netWorth, {
          tfsaWithdrawal: 20_000,
        })
      );
    }
    return results;
  }

  it('uses spouse LE (92) when spouse lives longer than primary (85)', () => {
    // primary.LE = 85, spouse.LE = 92 → horizon = 92
    // totalRetirementWithdrawals = 28 years × $20k = $560,000
    // balanceAtLifeExpectancy = $20,000 (row at age 92)
    // ratio = 20,000 / 560,000 = 0.0357 → Yellow
    const retirementAge = 65;
    const results = buildCoupleResults(retirementAge, 92);
    const input = makeCoupleInput(retirementAge, 85, 92);
    const status = computeFundedStatus(results, input);

    // Should use age 92 row (spouse LE), not age 85 row (primary LE)
    expect(status.balanceAtLifeExpectancy).toBe(20_000);
    expect(status.state).toBe('yellow');
    expect(status.depletionAge).toBeNull();
  });

  it('uses primary LE when primary lives longer than spouse', () => {
    // primary.LE = 92, spouse.LE = 85 → horizon = 92 (still primary)
    // Same results array; horizon lookup = 92 → same balance
    const retirementAge = 65;
    const results = buildCoupleResults(retirementAge, 92);
    const input = makeCoupleInput(retirementAge, 92, 85);
    const status = computeFundedStatus(results, input);

    // Should use age 92 row (primary LE is longer)
    expect(status.balanceAtLifeExpectancy).toBe(20_000);
    expect(status.state).toBe('yellow');
  });

  it('mirror case: primary LE (85) row has 200k — not used when spouse LE (92) governs', () => {
    // This confirms Math.max is actually applied: if we used primary LE (85),
    // balanceAtLifeExpectancy would be 200_000 and state would be green.
    // But with spouse LE (92) governing, balance is 20_000 → yellow.
    const retirementAge = 65;
    const results = buildCoupleResults(retirementAge, 92);
    const input = makeCoupleInput(retirementAge, 85, 92);
    const status = computeFundedStatus(results, input);

    // If the test passed primary LE without Math.max, balance would be 200_000 → green
    // Correct behaviour uses spouse LE (92) → balance = 20_000 → yellow
    expect(status.state).not.toBe('green');
    expect(status.balanceAtLifeExpectancy).not.toBe(200_000);
  });
});

// ---------------------------------------------------------------------------
// computeRemediationPlan binary search (Phase 49)
// ---------------------------------------------------------------------------

/**
 * Helper: build a solvable Red-state single-person ProjectionInput.
 * The input must be Red under the base projection, but become Yellow/Green
 * when any one of the three levers is sufficiently adjusted.
 *
 * @see .specify/specs/007-funded-indicator/spec.md — FR-006, FR-007, FR-008
 */
function buildSolvableRedInput(): ProjectionInput {
  // Person is currently age 55 with 10 pre-retirement years before age 65.
  // employmentIncome: 200_000 generates maximum RRSP room (~$31.5k/yr at 2026 limit)
  // so the savings lever can deposit contributions.
  //
  // Calibration (4% return, 2% inflation from projection start at age 55):
  //   Base (retire 65): balance $888k, need PV ~$994k (45k×1.02^10/0.02×0.362) → Red ✓
  //   Savings: +$31.5k/yr×10yr adds ~$378k → $1.27M > $994k → non-Red ✓
  //   Spending: reduce by ~$5k/yr (45k→40k) → PV ~$883k ≤ $888k → non-Red ✓
  //   Delay=3 (retire 68): balance $999k, need PV ~$965k (45k×1.02^13/0.02×0.337) → non-Red ✓
  const startYear = getCurrentYear();
  const birthYear = startYear - 55;
  return {
    birthdate: new Date(birthYear, 0, 1),
    province: 'ON' as const,
    retirementAge: 65,
    lifeExpectancy: 90,
    employmentIncome: 200_000,
    employmentGrowthRate: 0,
    rrspBalance: 600_000,
    rrspAnnualContribution: 0,
    tfsaBalance: 0,
    tfsaAnnualContribution: 0,
    nonRegBalance: 0,
    retirementSpending: 45_000,
    investmentReturn: 0.04,
    inflationRate: 0.02,
    expectedCPPAt65: 0,
    cppStartAge: 100,
    oasStartAge: 100,
  };
}

/**
 * Helper: build an unsolvable (cap-reached) Red-state single-person ProjectionInput.
 * Even delaying retirement to age 70 still leaves the projection Red.
 * Used only by the delay-cap edge-case test.
 */
function buildUnsolvableDelayRedInput(): ProjectionInput {
  // Person is age 65 → retirementAge 68 → maxDelay = 70-68 = 2 years.
  // Very high spending ($200k/yr) + low balance ($100k) ensures even
  // delaying 2 years (to age 70) leaves the projection Red — the extra
  // accumulation from 2 years is far smaller than the $200k/yr spending gap.
  const startYear = getCurrentYear();
  const birthYear = startYear - 65;
  return {
    birthdate: new Date(birthYear, 0, 1),
    province: 'ON' as const,
    retirementAge: 68,
    lifeExpectancy: 90,
    employmentIncome: 0,
    employmentGrowthRate: 0,
    rrspBalance: 100_000,
    rrspAnnualContribution: 0,
    tfsaBalance: 0,
    tfsaAnnualContribution: 0,
    nonRegBalance: 0,
    retirementSpending: 200_000,
    investmentReturn: 0.04,
    inflationRate: 0.02,
    expectedCPPAt65: 0,
    cppStartAge: 100,
    oasStartAge: 100,
  };
}

describe('TC-PROJ-039 — savings lever (FUND-06/07/08)', () => {
  /**
   * @see docs/TESTABLE-SURFACES.md — TC-PROJ-039
   * @see .specify/specs/007-funded-indicator/spec.md — FR-006, FR-007, FR-008
   */
  it('returns non-zero additionalAnnualSavings and applying it moves state out of red', () => {
    const input = buildSolvableRedInput();
    const baseOutput = runSingleProjection(input);
    const baseStatus = computeFundedStatus(baseOutput.yearlyResults, input);
    expect(baseStatus.state).toBe('red'); // precondition

    const plan = computeRemediationPlan(input, baseStatus, runSingleProjection);
    expect(plan.additionalAnnualSavings).toBeGreaterThan(0);
    expect(plan.additionalAnnualSavings).toBeLessThanOrEqual(200_000);

    const mutated: ProjectionInput = {
      ...input,
      rrspAnnualContribution: input.rrspAnnualContribution + plan.additionalAnnualSavings,
    };
    const mutatedOutput = runSingleProjection(mutated);
    const mutatedStatus = computeFundedStatus(mutatedOutput.yearlyResults, mutated);
    expect(mutatedStatus.state).not.toBe('red');
  });
});

describe('TC-PROJ-040 — spending lever (FUND-06/07/08)', () => {
  /**
   * @see docs/TESTABLE-SURFACES.md — TC-PROJ-040
   * @see .specify/specs/007-funded-indicator/spec.md — FR-006, FR-007, FR-008
   */
  it('returns non-zero annualSpendingReduction and applying it moves state out of red', () => {
    const input = buildSolvableRedInput();
    const baseStatus = computeFundedStatus(runSingleProjection(input).yearlyResults, input);
    expect(baseStatus.state).toBe('red');

    const plan = computeRemediationPlan(input, baseStatus, runSingleProjection);
    expect(plan.annualSpendingReduction).toBeGreaterThan(0);
    expect(plan.annualSpendingReduction).toBeLessThanOrEqual(input.retirementSpending);

    const mutated: ProjectionInput = {
      ...input,
      retirementSpending: input.retirementSpending - plan.annualSpendingReduction,
    };
    const mutatedStatus = computeFundedStatus(runSingleProjection(mutated).yearlyResults, mutated);
    expect(mutatedStatus.state).not.toBe('red');
  });

  it('returns 0 annualSpendingReduction when retirementSpending is 0 (guard)', () => {
    const input: ProjectionInput = { ...buildSolvableRedInput(), retirementSpending: 0 };
    const baseStatus = computeFundedStatus(runSingleProjection(input).yearlyResults, input);
    const plan = computeRemediationPlan(input, baseStatus, runSingleProjection);
    expect(plan.annualSpendingReduction).toBe(0);
  });
});

describe('TC-PROJ-041 — delay lever (FUND-06/07/08)', () => {
  /**
   * @see docs/TESTABLE-SURFACES.md — TC-PROJ-041
   * @see .specify/specs/007-funded-indicator/spec.md — FR-006, FR-007, FR-008
   */
  it('returns integer retirementDelayYears ≥ 1 and applying it moves state out of red', () => {
    const input = buildSolvableRedInput();
    const baseStatus = computeFundedStatus(runSingleProjection(input).yearlyResults, input);
    expect(baseStatus.state).toBe('red');

    const plan = computeRemediationPlan(input, baseStatus, runSingleProjection);
    expect(Number.isInteger(plan.retirementDelayYears)).toBe(true);
    expect(plan.retirementDelayYears).toBeGreaterThanOrEqual(1);
    expect(plan.retirementDelayYears).toBeLessThanOrEqual(Math.max(0, 70 - input.retirementAge));
    expect(plan.delayCapReached).toBe(false);

    const mutated: ProjectionInput = {
      ...input,
      retirementAge: input.retirementAge + plan.retirementDelayYears,
    };
    const mutatedStatus = computeFundedStatus(runSingleProjection(mutated).yearlyResults, mutated);
    expect(mutatedStatus.state).not.toBe('red');
  });

  it('sets delayCapReached=true and retirementDelayYears=maxDelay when still red at age 70', () => {
    const input = buildUnsolvableDelayRedInput();
    const baseStatus = computeFundedStatus(runSingleProjection(input).yearlyResults, input);
    expect(baseStatus.state).toBe('red');

    const plan = computeRemediationPlan(input, baseStatus, runSingleProjection);
    const maxDelay = Math.max(0, 70 - input.retirementAge);
    expect(plan.retirementDelayYears).toBe(maxDelay);
    expect(plan.delayCapReached).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// REGR-011 — computeRemediationPlan not invoked for Green/Yellow (Phase 50)
// ---------------------------------------------------------------------------

/**
 * @see docs/TESTABLE-SURFACES.md — REGR-011
 * REGR-011 guard: synchronous projection cost for Green/Yellow states must not regress.
 * Phase 49 added computeRemediationPlan as a 60-runProjection-call cost on Red projections;
 * this test pins that Green and Yellow incur zero such calls by asserting
 * summary.remediationPlan === null (primary) and vi.spyOn call count === 0 (secondary).
 * Phase 50 T026.
 */
describe('REGR-011 — computeRemediationPlan is never invoked for Green/Yellow', () => {
  /**
   * Green fixture: large balance, low spending, short retirement.
   * 500k RRSP, 30k/yr spending, 4% return, 2% inflation, age 65 retire, LE 75.
   * 10-year retirement period → well-funded Green state.
   */
  function buildGreenInput(): ProjectionInput {
    const startYear = getCurrentYear();
    const birthYear = startYear - 65;
    return {
      birthdate: new Date(birthYear, 0, 1),
      province: 'ON' as const,
      retirementAge: 65,
      lifeExpectancy: 75,
      employmentIncome: 0,
      employmentGrowthRate: 0,
      rrspBalance: 500_000,
      rrspAnnualContribution: 0,
      tfsaBalance: 0,
      tfsaAnnualContribution: 0,
      nonRegBalance: 0,
      retirementSpending: 30_000,
      investmentReturn: 0.05,
      inflationRate: 0.02,
      expectedCPPAt65: 0,
      cppStartAge: 100,
      oasStartAge: 100,
    };
  }

  /**
   * Yellow fixture: moderate balance that lasts to LE but with < 10% buffer.
   * 480k RRSP, 22k/yr spending, 4% return, 2% inflation, age 65 retire, LE 90.
   * Calibrated: balance at LE / total withdrawals ≈ 0.099 < 0.10 → Yellow.
   * (400k is Red at age 90; 500k is Green at ratio 0.17; 480k sits in the Yellow band.)
   */
  function buildYellowInput(): ProjectionInput {
    const startYear = getCurrentYear();
    const birthYear = startYear - 65;
    return {
      birthdate: new Date(birthYear, 0, 1),
      province: 'ON' as const,
      retirementAge: 65,
      lifeExpectancy: 90,
      employmentIncome: 0,
      employmentGrowthRate: 0,
      rrspBalance: 480_000,
      rrspAnnualContribution: 0,
      tfsaBalance: 0,
      tfsaAnnualContribution: 0,
      nonRegBalance: 0,
      retirementSpending: 22_000,
      investmentReturn: 0.04,
      inflationRate: 0.02,
      expectedCPPAt65: 0,
      cppStartAge: 100,
      oasStartAge: 100,
    };
  }

  it('REGR-011a: Green projection returns summary.remediationPlan === null (no remediation computed)', () => {
    const input = buildGreenInput();
    const output = runSingleProjection(input);

    // Primary guard: Green state means remediationPlan is never computed
    expect(output.summary.fundedStatus.state).toBe('green');
    // REGR-011: remediationPlan must be null — if not, computeRemediationPlan was called for Green
    expect(output.summary.remediationPlan).toBeNull();
  });

  it('REGR-011b: Yellow projection returns summary.remediationPlan === null (no remediation computed)', () => {
    const input = buildYellowInput();
    const output = runSingleProjection(input);

    // Primary guard: Yellow state means remediationPlan is never computed
    expect(output.summary.fundedStatus.state).toBe('yellow');
    // REGR-011: remediationPlan must be null — if not, computeRemediationPlan was called for Yellow
    expect(output.summary.remediationPlan).toBeNull();
  });

  it('REGR-011c: spy on computeRemediationPlan — not invoked during Green projection', () => {
    const spy = vi.spyOn(fundedStatusModule, 'computeRemediationPlan');
    const input = buildGreenInput();

    runSingleProjection(input);

    // NOTE: ESM named-binding — spy may not intercept from consumer side (multi-year.ts imports
    // computeRemediationPlan as a named binding). Primary guard is REGR-011a null-assertion.
    // This test still acts as a grep-friendly signal and will catch calls from within funded-status.ts.
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('REGR-011d: spy on computeRemediationPlan — not invoked during Yellow projection', () => {
    const spy = vi.spyOn(fundedStatusModule, 'computeRemediationPlan');
    const input = buildYellowInput();

    runSingleProjection(input);

    // NOTE: ESM named-binding — spy may not intercept from consumer side (multi-year.ts imports
    // computeRemediationPlan as a named binding). Primary guard is REGR-011b null-assertion.
    // This test still acts as a grep-friendly signal and will catch calls from within funded-status.ts.
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
