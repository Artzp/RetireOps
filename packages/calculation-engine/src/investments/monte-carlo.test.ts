/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * Monte Carlo Engine — Comprehensive Unit Test Suite
 *
 * Covers TC-FUTURE-015..018 (promoted from future to active) and
 * TC-NEW-MC-001..003 (new surfaces). Resolves REGR-020.
 *
 * @see docs/source-of-truth/06-investment-engine.md - Monte Carlo Simulation
 * @see docs/source-of-truth/09-success-metrics.md - Success Rate Definition
 * @see specs/009-monte-carlo-simulation/data-model.md
 * @see docs/TESTABLE-SURFACES.md TC-FUTURE-015, TC-FUTURE-016, TC-FUTURE-017, TC-FUTURE-018, TC-NEW-MC-001, TC-NEW-MC-002, TC-NEW-MC-003
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MONTE_CARLO_PARAMS,
  runMonteCarloSimulation,
  runMonteCarloWithInflation,
  runStressTest,
  computePercentileBands,
  extractWorstCaseTrials,
  runMonteCarloEngine,
  runMonteCarloEngineWithInflation,
} from './monte-carlo.js';
import type {
  SimulationScenario,
  SimulationYearData,
  PercentileBandResult,
  WorstCaseTrial,
  MonteCarloEngineResult,
} from './monte-carlo.js';

// ---------------------------------------------------------------------------
// Fixture helper
// ---------------------------------------------------------------------------

/**
 * Build a minimal SimulationScenario for isolated unit testing.
 * Matches the factory function pattern from the plan's TC-NEW-MC-003 spec.
 */
function makeScenario(
  id: number,
  finalBalance: number,
  depletionYear: number | null,
  years = 5
): SimulationScenario {
  const yearlyData: SimulationYearData[] = Array.from(
    { length: depletionYear ?? years },
    (_, i) => ({
      year: i + 1,
      balance: depletionYear !== null && i >= depletionYear - 1 ? 0 : finalBalance,
      returnRate: 0.06,
    })
  );
  return { scenarioId: id, finalBalance: Math.max(0, finalBalance), depletionYear, yearlyData };
}

// ---------------------------------------------------------------------------
// DEFAULT_MONTE_CARLO_PARAMS
// ---------------------------------------------------------------------------
describe('DEFAULT_MONTE_CARLO_PARAMS', () => {
  it('should have expectedReturn === 0.065 and volatility === 0.11 per spec FR-004', () => {
    expect(DEFAULT_MONTE_CARLO_PARAMS.expectedReturn).toBe(0.065);
    expect(DEFAULT_MONTE_CARLO_PARAMS.volatility).toBe(0.11);
  });
});

// ---------------------------------------------------------------------------
// TC-FUTURE-015: runMonteCarloSimulation (1000 trials; log-normal returns)
// @see docs/TESTABLE-SURFACES.md TC-FUTURE-015
// @see docs/source-of-truth/06-investment-engine.md - Simulation Algorithm
// ---------------------------------------------------------------------------
describe('TC-FUTURE-015: runMonteCarloSimulation (1000 trials; log-normal returns)', () => {
  /**
   * @see docs/TESTABLE-SURFACES.md TC-FUTURE-015
   * @see docs/source-of-truth/06-investment-engine.md - Simulation Algorithm
   */
  it('should run 1000 trials and return result with numSimulations === 1000', () => {
    const result = runMonteCarloSimulation(500_000, 40_000, 30, {
      numSimulations: 1000,
      expectedReturn: 0.065,
      volatility: 0.11,
      seed: 42,
    });
    expect(result.numSimulations).toBe(1000);
    expect(result.scenarios.length).toBe(1000);
  });

  it('should have probabilityOfSuccess between 0 and 100 (inclusive)', () => {
    const result = runMonteCarloSimulation(500_000, 40_000, 30, {
      numSimulations: 1000,
      expectedReturn: 0.065,
      volatility: 0.11,
      seed: 42,
    });
    expect(result.probabilityOfSuccess).toBeGreaterThanOrEqual(0);
    expect(result.probabilityOfSuccess).toBeLessThanOrEqual(100);
  });

  it('should populate scenarios with valid yearlyData entries', () => {
    const result = runMonteCarloSimulation(300_000, 30_000, 10, {
      numSimulations: 50,
      seed: 7,
    });
    for (const scenario of result.scenarios) {
      expect(scenario.yearlyData.length).toBeGreaterThan(0);
      expect(scenario.yearlyData.length).toBeLessThanOrEqual(10);
    }
  });
});

// ---------------------------------------------------------------------------
// TC-FUTURE-016: runMonteCarloWithInflation
// @see docs/TESTABLE-SURFACES.md TC-FUTURE-016
// ---------------------------------------------------------------------------
describe('TC-FUTURE-016: runMonteCarloWithInflation', () => {
  /**
   * @see docs/TESTABLE-SURFACES.md TC-FUTURE-016
   * @see docs/source-of-truth/06-investment-engine.md - Inflation-Adjusted Withdrawals
   */
  it('should run without throwing and return valid probabilityOfSuccess', () => {
    const result = runMonteCarloWithInflation(500_000, 40_000, 0.025, 30, {
      numSimulations: 100,
      seed: 1,
    });
    expect(result.probabilityOfSuccess).toBeGreaterThanOrEqual(0);
    expect(result.probabilityOfSuccess).toBeLessThanOrEqual(100);
    expect(result.numSimulations).toBe(100);
  });

  it('should return scenarios with yearlyData present in each scenario', () => {
    const result = runMonteCarloWithInflation(500_000, 20_000, 0.02, 10, {
      numSimulations: 20,
      seed: 5,
    });
    for (const scenario of result.scenarios) {
      expect(scenario.yearlyData.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// TC-FUTURE-017: runStressTest (4 named scenarios)
// @see docs/TESTABLE-SURFACES.md TC-FUTURE-017
// @see docs/source-of-truth/06-investment-engine.md - Stress Test Scenarios Table
// ---------------------------------------------------------------------------
describe('TC-FUTURE-017: runStressTest (4 named scenarios)', () => {
  /**
   * @see docs/TESTABLE-SURFACES.md TC-FUTURE-017
   * @see docs/source-of-truth/06-investment-engine.md - Stress Test Scenarios Table
   */
  it('market_crash_at_retirement: year 1 returnRate should be -0.3', () => {
    const result = runStressTest({
      scenario: 'market_crash_at_retirement',
      initialBalance: 1_000_000,
      annualWithdrawal: 50_000,
      projectionYears: 30,
    });
    expect(result.yearlyData[0]?.returnRate).toBe(-0.3);
  });

  it('2008_replay: year 1 returnRate should be -0.37 and year 2 returnRate should be 0.27', () => {
    const result = runStressTest({
      scenario: '2008_replay',
      initialBalance: 1_000_000,
      annualWithdrawal: 50_000,
      projectionYears: 30,
    });
    expect(result.yearlyData[0]?.returnRate).toBe(-0.37);
    expect(result.yearlyData[1]?.returnRate).toBe(0.27);
  });

  it('lost_decade: first 10 years returnRate should be 0', () => {
    const result = runStressTest({
      scenario: 'lost_decade',
      initialBalance: 2_000_000,
      annualWithdrawal: 50_000,
      projectionYears: 20,
    });
    for (let i = 0; i < 10; i++) {
      expect(result.yearlyData[i]?.returnRate).toBe(0);
    }
  });

  it('high_inflation: first 5 years returnRate should be baseExpectedReturn - 0.035', () => {
    const baseExpectedReturn = 0.055;
    const result = runStressTest({
      scenario: 'high_inflation',
      initialBalance: 2_000_000,
      annualWithdrawal: 50_000,
      projectionYears: 20,
      baseExpectedReturn,
    });
    const expectedNetReturn = baseExpectedReturn - 0.035;
    for (let i = 0; i < 5; i++) {
      expect(result.yearlyData[i]?.returnRate).toBeCloseTo(expectedNetReturn, 10);
    }
  });
});

// ---------------------------------------------------------------------------
// TC-FUTURE-018 / SC-004: PRNG reproducibility (SeededRandom / mulberry32)
// @see docs/TESTABLE-SURFACES.md TC-FUTURE-018
// @see specs/009-monte-carlo-simulation/tasks.md T005, SC-004
// ---------------------------------------------------------------------------
describe('TC-FUTURE-018 / SC-004: PRNG reproducibility (SeededRandom / mulberry32)', () => {
  /**
   * @see docs/TESTABLE-SURFACES.md TC-FUTURE-018
   * @see specs/009-monte-carlo-simulation/tasks.md T005, SC-004
   *
   * CRITICAL: Each call uses a fresh function invocation with the same seed.
   * Do NOT share a SeededRandom instance between calls.
   */
  it('should produce identical probabilityOfSuccess for the same seed', () => {
    const params = {
      numSimulations: 1000,
      expectedReturn: 0.065,
      volatility: 0.11,
      seed: 42,
    } as const;

    // Two completely independent calls — each creates a fresh SeededRandom internally
    const result1 = runMonteCarloSimulation(500_000, 40_000, 30, params);
    const result2 = runMonteCarloSimulation(500_000, 40_000, 30, params);

    // Must be === (not approximately equal) — identical PRNG sequence
    expect(result1.probabilityOfSuccess).toBe(result2.probabilityOfSuccess);
  });

  it('should produce different probabilityOfSuccess for different seeds (with high probability)', () => {
    const result1 = runMonteCarloSimulation(500_000, 40_000, 30, {
      numSimulations: 100,
      seed: 42,
    });
    const result2 = runMonteCarloSimulation(500_000, 40_000, 30, {
      numSimulations: 100,
      seed: 99,
    });
    // Different seeds should (almost certainly) produce different sequences
    // This is a probabilistic check — different seeds produce different PRNG trajectories
    // For 100 trials, the chance of identical probabilityOfSuccess is extremely small
    expect(result1.probabilityOfSuccess).not.toBe(result2.probabilityOfSuccess);
  });
});

// ---------------------------------------------------------------------------
// TC-NEW-MC-001: computePercentileBands
// @see docs/TESTABLE-SURFACES.md TC-NEW-MC-001
// @see specs/009-monte-carlo-simulation/data-model.md - computePercentileBands
// ---------------------------------------------------------------------------
describe('TC-NEW-MC-001: computePercentileBands', () => {
  /**
   * @see docs/TESTABLE-SURFACES.md TC-NEW-MC-001
   * @see specs/009-monte-carlo-simulation/data-model.md - computePercentileBands
   */
  it('should return [] for empty scenarios', () => {
    const result: PercentileBandResult[] = computePercentileBands([], 65);
    expect(result).toEqual([]);
  });

  it('should return array of length equal to maxYears across all scenarios', () => {
    const scenarios: SimulationScenario[] = Array.from({ length: 10 }, (_, i) =>
      makeScenario(i + 1, (i + 1) * 30_000, null, 30)
    );
    const result = computePercentileBands(scenarios, 65);
    expect(result).toHaveLength(30);
  });

  it('should have monotone p10 <= p25 <= p50 <= p75 <= p90 at each year', () => {
    // 20 varied scenarios to produce spread percentile values
    const scenarios: SimulationScenario[] = Array.from({ length: 20 }, (_, i) =>
      makeScenario(i + 1, (i + 1) * 50_000, null, 10)
    );
    const result = computePercentileBands(scenarios, 65);
    for (const band of result) {
      expect(band.p10).toBeLessThanOrEqual(band.p25);
      expect(band.p25).toBeLessThanOrEqual(band.p50);
      expect(band.p50).toBeLessThanOrEqual(band.p75);
      expect(band.p75).toBeLessThanOrEqual(band.p90);
    }
  });

  it('should set age = retirementAge + yearIdx at each position', () => {
    const scenarios = [makeScenario(1, 300_000, null, 5)];
    const result = computePercentileBands(scenarios, 65);
    expect(result[0]).toMatchObject({ year: 1, age: 65 });
    expect(result[4]).toMatchObject({ year: 5, age: 69 });
  });

  it('should contribute 0 for depleted trials at years after depletion', () => {
    // One trial depletes at year 2 (yearlyData has 2 entries); other survives 5 years
    const depleted = makeScenario(1, 0, 2, 5);
    const surviving = makeScenario(2, 500_000, null, 5);
    const result = computePercentileBands([depleted, surviving], 65);
    // Year 3 (index 2): depleted trial contributes 0 — p10 must be 0
    expect(result[2]).toBeDefined();
    expect(result[2]!.p10).toBe(0);
    // p10 >= 0 invariant
    for (const band of result) {
      expect(band.p10).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// TC-NEW-MC-002: success rate (SC-3 and SC-4)
// @see docs/TESTABLE-SURFACES.md TC-NEW-MC-002
// @see docs/source-of-truth/09-success-metrics.md - Success Rate Definition
// ---------------------------------------------------------------------------
describe('TC-NEW-MC-002: success rate (SC-3 and SC-4)', () => {
  /**
   * @see docs/TESTABLE-SURFACES.md TC-NEW-MC-002
   * @see docs/source-of-truth/09-success-metrics.md - Success Rate Definition
   * @see specs/009-monte-carlo-simulation/tasks.md SC-003, SC-004
   */
  it('SC-3: well-funded projection should have successRate between 0.70 and 1.00', () => {
    // $1M balance, only $20K/yr withdrawal, 30 years, seed 42
    // Generous ratio — expect high probability of success
    const result = runMonteCarloSimulation(1_000_000, 20_000, 30, {
      numSimulations: 1000,
      expectedReturn: 0.065,
      volatility: 0.11,
      seed: 42,
    });
    const successRate = result.probabilityOfSuccess / 100;
    expect(successRate).toBeGreaterThanOrEqual(0.7);
    expect(successRate).toBeLessThanOrEqual(1.0);
  });

  it('SC-4: zero-withdrawal zero-balance projection should not throw and successRate === 1.0', () => {
    // Zero balance + zero withdrawal: no depletion ever possible
    // All trials succeed (balance stays at 0, withdrawal deducted is 0)
    expect(() => {
      const result = runMonteCarloSimulation(0, 0, 30, {
        numSimulations: 100,
        seed: 1,
      });
      const successRate = result.probabilityOfSuccess / 100;
      expect(successRate).toBe(1.0);
    }).not.toThrow();
  });

  it('guaranteed-depletion case: very small balance, very large withdrawal → successRate === 0', () => {
    // TC-NEW-MC-002b from TESTING.md
    // $10K balance, $500K/yr withdrawal — all trials deplete in year 1
    const result = runMonteCarloSimulation(10_000, 500_000, 30, {
      numSimulations: 100,
      seed: 99,
    });
    expect(result.probabilityOfSuccess / 100).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// TC-NEW-MC-003: extractWorstCaseTrials
// @see docs/TESTABLE-SURFACES.md TC-NEW-MC-003
// @see specs/009-monte-carlo-simulation/data-model.md - extractWorstCaseTrials
// ---------------------------------------------------------------------------
describe('TC-NEW-MC-003: extractWorstCaseTrials', () => {
  /**
   * @see docs/TESTABLE-SURFACES.md TC-NEW-MC-003
   * @see specs/009-monte-carlo-simulation/data-model.md - extractWorstCaseTrials
   */
  it('should return count entries when enough failures exist; all have depletionYear !== null', () => {
    // 5 failed scenarios + 2 passing
    const scenarios: SimulationScenario[] = [
      makeScenario(1, 0, 5, 5),
      makeScenario(2, 0, 3, 5),
      makeScenario(3, 0, 4, 5),
      makeScenario(4, 0, 2, 5),
      makeScenario(5, 0, 1, 5),
      makeScenario(6, 500_000, null, 10),
      makeScenario(7, 600_000, null, 10),
    ];
    const result: WorstCaseTrial[] = extractWorstCaseTrials(scenarios, 3);
    expect(result).toHaveLength(3);
    for (const t of result) {
      expect(t.depletionYear).not.toBeNull();
    }
  });

  it('should sort failed entries by finalBalance ascending (worst-first)', () => {
    const scenarios: SimulationScenario[] = [
      makeScenario(1, 0, 5, 5),
      makeScenario(2, 0, 3, 5),
      makeScenario(3, 0, 4, 5),
    ];
    const result: WorstCaseTrial[] = extractWorstCaseTrials(scenarios, 3);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i]!.finalBalance).toBeLessThanOrEqual(result[i + 1]!.finalBalance);
    }
  });

  it('should pad with passing trials when failures < count', () => {
    // 1 failed + 9 passing; request count=3 → 1 failed + 2 padded passing
    const scenarios: SimulationScenario[] = [
      makeScenario(1, 0, 3, 5),
      ...Array.from({ length: 9 }, (_, i) => makeScenario(i + 2, (i + 1) * 100_000, null, 10)),
    ];
    const result: WorstCaseTrial[] = extractWorstCaseTrials(scenarios, 3);
    expect(result).toHaveLength(3);
    // First entry: the failed trial
    expect(result[0]!.depletionYear).not.toBeNull();
    // Padded entries: passing trials
    expect(result[1]!.depletionYear).toBeNull();
    expect(result[2]!.depletionYear).toBeNull();
  });

  it('should return all passing entries with depletionYear === null when 0 failures', () => {
    // TC-NEW-MC-003 (all-passing case from TESTING.md)
    const scenarios: SimulationScenario[] = [
      makeScenario(1, 100_000, null, 10),
      makeScenario(2, 200_000, null, 10),
      makeScenario(3, 300_000, null, 10),
      makeScenario(4, 400_000, null, 10),
    ];
    const result: WorstCaseTrial[] = extractWorstCaseTrials(scenarios, 3);
    expect(result).toHaveLength(3);
    for (const t of result) {
      expect(t.depletionYear).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// runMonteCarloEngine orchestrator (existing coverage preserved)
// @see specs/009-monte-carlo-simulation/data-model.md - MonteCarloEngineResult
// ---------------------------------------------------------------------------
describe('runMonteCarloEngine orchestrator', () => {
  it('returns successRate in 0–1 range', () => {
    const result: MonteCarloEngineResult = runMonteCarloEngine(1_000_000, 40_000, 30, {
      numSimulations: 50,
      seed: 42,
    });
    expect(result.successRate).toBeGreaterThanOrEqual(0);
    expect(result.successRate).toBeLessThanOrEqual(1);
  });

  it('returns percentileBands with length equal to projectionYears', () => {
    const projectionYears = 20;
    const result = runMonteCarloEngine(1_000_000, 40_000, projectionYears, {
      numSimulations: 50,
      seed: 42,
    });
    expect(result.percentileBands).toHaveLength(projectionYears);
  });

  it('returns numSimulations matching params', () => {
    const result = runMonteCarloEngine(1_000_000, 40_000, 20, {
      numSimulations: 100,
      seed: 42,
    });
    expect(result.numSimulations).toBe(100);
  });

  it('returns worstCaseTrials array with length <= 10', () => {
    const result = runMonteCarloEngine(1_000_000, 40_000, 20, {
      numSimulations: 50,
      seed: 42,
    });
    expect(Array.isArray(result.worstCaseTrials)).toBe(true);
    expect(result.worstCaseTrials.length).toBeGreaterThanOrEqual(0);
    expect(result.worstCaseTrials.length).toBeLessThanOrEqual(10);
  });

  it('converts probabilityOfSuccess correctly (0–100 → 0–1 successRate)', () => {
    // Large balance, small withdrawal, short horizon → near-certain success
    const result = runMonteCarloEngine(10_000_000, 10_000, 10, {
      numSimulations: 100,
      seed: 1,
    });
    expect(result.successRate).toBeLessThanOrEqual(1.0);
    expect(result.successRate).toBeGreaterThan(0.9);
  });
});

// ---------------------------------------------------------------------------
// runMonteCarloEngineWithInflation orchestrator
// Parallel to runMonteCarloEngine but escalates the withdrawal at inflationRate
// each year. Matches the deterministic projection's inflation-escalating
// spending so MC portfolio draws stay in real terms across the horizon.
// ---------------------------------------------------------------------------
describe('runMonteCarloEngineWithInflation orchestrator', () => {
  it('reference-scenario inputs yield a high success rate', () => {
    // $1.85M portfolio, $79,337 net withdrawal (= $140k living − $60,663 guaranteed),
    // 2.5% inflation, 25 years, 6.5% return, 11% vol. Under these conditions the
    // deterministic projection shows portfolio growth; MC should agree.
    const result = runMonteCarloEngineWithInflation(1_850_000, 79_337, 0.025, 25, {
      numSimulations: 500,
      expectedReturn: 0.065,
      volatility: 0.11,
      seed: 42,
    });
    expect(result.successRate).toBeGreaterThanOrEqual(0.85);
    expect(result.percentileBands).toHaveLength(25);
    expect(result.numSimulations).toBe(500);
  });

  it('successRate is monotonically non-increasing in inflation rate', () => {
    const base = runMonteCarloEngineWithInflation(1_850_000, 79_337, 0.025, 25, {
      numSimulations: 500,
      expectedReturn: 0.065,
      volatility: 0.11,
      seed: 42,
    });
    const highInflation = runMonteCarloEngineWithInflation(1_850_000, 79_337, 0.08, 25, {
      numSimulations: 500,
      expectedReturn: 0.065,
      volatility: 0.11,
      seed: 42,
    });
    expect(highInflation.successRate).toBeLessThan(base.successRate);
  });

  it('returns successRate in 0–1 range and worstCaseTrials bounded by 10', () => {
    const result = runMonteCarloEngineWithInflation(1_000_000, 40_000, 0.025, 30, {
      numSimulations: 50,
      seed: 7,
    });
    expect(result.successRate).toBeGreaterThanOrEqual(0);
    expect(result.successRate).toBeLessThanOrEqual(1);
    expect(result.worstCaseTrials.length).toBeLessThanOrEqual(10);
  });
});
