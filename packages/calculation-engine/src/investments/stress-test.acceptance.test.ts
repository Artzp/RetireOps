/**
 * Feature 3.3 Stress Testing — Acceptance Tests (RED step)
 *
 * TC-ST-001..005: Engine + Scenario Semantics
 *
 * These tests cover the precise numeric contracts from the approved acceptance
 * scenario set. Some tests duplicate or extend coverage from the broader
 * monte-carlo.test.ts (TC-FUTURE-017); the acceptance tests here are the
 * authoritative source for feature-gate behaviour.
 *
 * @see retireops-acceptance-tests/feature-3.3-stress-testing.md
 * @see docs/source-of-truth/06-investment-engine.md — Stress Test Scenarios Table
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { runStressTest } from './monte-carlo.js';
import type { StressTestResult } from './monte-carlo.js';

// ---------------------------------------------------------------------------
// TC-ST-001: Market crash scenario injects -30% in year 1
// ---------------------------------------------------------------------------
describe('TC-ST-001: market_crash_at_retirement — year-1 shock and subsequent normal return', () => {
  /**
   * @see retireops-acceptance-tests/feature-3.3-stress-testing.md TC-ST-001
   * @see docs/source-of-truth/06-investment-engine.md — Stress Test Scenarios Table
   *
   * Given: initialBalance=1_000_000, annualWithdrawal=50_000, projectionYears=30
   * Then:  yearlyData[0].returnRate === -0.30
   *        yearlyData[0].balance  === 650_000  (1_000_000 × 0.70 − 50_000)
   *        yearlyData[1].returnRate === 0.055
   */
  let result: StressTestResult;

  beforeAll(() => {
    result = runStressTest({
      scenario: 'market_crash_at_retirement',
      initialBalance: 1_000_000,
      annualWithdrawal: 50_000,
      projectionYears: 30,
    });
  });

  it('TC-ST-001a: year-1 returnRate === -0.30', () => {
    expect(result.yearlyData[0]?.returnRate).toBe(-0.3);
  });

  it('TC-ST-001b: year-1 balance === 650_000', () => {
    // 1_000_000 × (1 − 0.30) − 50_000 = 700_000 − 50_000 = 650_000
    expect(result.yearlyData[0]?.balance).toBe(650_000);
  });

  it('TC-ST-001c: year-2 returnRate === 0.055 (base return after shock)', () => {
    expect(result.yearlyData[1]?.returnRate).toBe(0.055);
  });
});

// ---------------------------------------------------------------------------
// TC-ST-002: 2008 replay scenario applies 2008 then 2009 returns
// ---------------------------------------------------------------------------
describe('TC-ST-002: 2008_replay — historical two-year sequence and balances', () => {
  /**
   * @see retireops-acceptance-tests/feature-3.3-stress-testing.md TC-ST-002
   *
   * Given: initialBalance=1_000_000, annualWithdrawal=50_000, projectionYears=30
   * Then:  yearlyData[0].returnRate === -0.37
   *        yearlyData[1].returnRate === 0.27
   *        yearlyData[0].balance   === 580_000  (1_000_000 × 0.63 − 50_000)
   *        yearlyData[1].balance   === 686_600  (580_000 × 1.27 − 50_000)
   */
  let result: StressTestResult;

  beforeAll(() => {
    result = runStressTest({
      scenario: '2008_replay',
      initialBalance: 1_000_000,
      annualWithdrawal: 50_000,
      projectionYears: 30,
    });
  });

  it('TC-ST-002a: year-1 returnRate === -0.37', () => {
    expect(result.yearlyData[0]?.returnRate).toBe(-0.37);
  });

  it('TC-ST-002b: year-2 returnRate === 0.27', () => {
    expect(result.yearlyData[1]?.returnRate).toBe(0.27);
  });

  it('TC-ST-002c: year-1 balance === 580_000', () => {
    // 1_000_000 × (1 − 0.37) − 50_000 = 630_000 − 50_000 = 580_000
    expect(result.yearlyData[0]?.balance).toBe(580_000);
  });

  it('TC-ST-002d: year-2 balance === 686_600', () => {
    // 580_000 × (1 + 0.27) − 50_000 = 736_600 − 50_000 = 686_600
    expect(result.yearlyData[1]?.balance).toBeCloseTo(686_600, 0);
  });
});

// ---------------------------------------------------------------------------
// TC-ST-003: Lost decade scenario uses 0% for first 10 years
// ---------------------------------------------------------------------------
describe('TC-ST-003: lost_decade — zero return for 10 years, then base rate', () => {
  /**
   * @see retireops-acceptance-tests/feature-3.3-stress-testing.md TC-ST-003
   *
   * Given: initialBalance=1_000_000, annualWithdrawal=50_000, projectionYears=30
   * Then:  years 1..10 each have returnRate === 0
   *        year 11 returnRate === 0.055
   */
  let result: StressTestResult;

  beforeAll(() => {
    result = runStressTest({
      scenario: 'lost_decade',
      initialBalance: 1_000_000,
      annualWithdrawal: 50_000,
      projectionYears: 30,
    });
  });

  it('TC-ST-003a: years 1..10 all have returnRate === 0', () => {
    for (let i = 0; i < 10; i++) {
      expect(result.yearlyData[i]?.returnRate).toBe(0);
    }
  });

  it('TC-ST-003b: year 11 returnRate === 0.055', () => {
    expect(result.yearlyData[10]?.returnRate).toBe(0.055);
  });
});

// ---------------------------------------------------------------------------
// TC-ST-004: High inflation scenario applies reduced real return for 5 years
// ---------------------------------------------------------------------------
describe('TC-ST-004: high_inflation — net return is baseExpectedReturn − 0.035 for first 5 years', () => {
  /**
   * @see retireops-acceptance-tests/feature-3.3-stress-testing.md TC-ST-004
   *
   * Given: baseExpectedReturn=0.055, initialBalance=1_000_000, annualWithdrawal=50_000
   * Then:  years 1..5 returnRate === 0.020  (0.055 − 0.035)
   *        year 6   returnRate === 0.055
   */
  const baseExpectedReturn = 0.055;
  let result: StressTestResult;

  beforeAll(() => {
    result = runStressTest({
      scenario: 'high_inflation',
      initialBalance: 1_000_000,
      annualWithdrawal: 50_000,
      projectionYears: 30,
      baseExpectedReturn,
    });
  });

  it('TC-ST-004a: years 1..5 returnRate === 0.02 (0.055 − 0.035)', () => {
    const expected = baseExpectedReturn - 0.035; // 0.02
    for (let i = 0; i < 5; i++) {
      expect(result.yearlyData[i]?.returnRate).toBeCloseTo(expected, 10);
    }
  });

  it('TC-ST-004b: year 6 returnRate === 0.055', () => {
    expect(result.yearlyData[5]?.returnRate).toBe(0.055);
  });
});

// ---------------------------------------------------------------------------
// TC-ST-005: Stress test run is deterministic
// ---------------------------------------------------------------------------
describe('TC-ST-005: determinism — identical inputs produce identical outputs', () => {
  /**
   * @see retireops-acceptance-tests/feature-3.3-stress-testing.md TC-ST-005
   *
   * Given identical stress-test input payloads
   * When executed twice
   * Then results are deeply equal (same balances, depletionYear, status)
   */

  const SCENARIOS = [
    'market_crash_at_retirement',
    '2008_replay',
    'lost_decade',
    'high_inflation',
  ] as const;

  for (const scenario of SCENARIOS) {
    it(`TC-ST-005[${scenario}]: two runs with same inputs are deeply equal`, () => {
      const params = {
        scenario,
        initialBalance: 750_000,
        annualWithdrawal: 45_000,
        projectionYears: 25,
        baseExpectedReturn: 0.055,
      } as const;

      const run1 = runStressTest(params);
      const run2 = runStressTest(params);

      expect(run1.finalBalance).toBe(run2.finalBalance);
      expect(run1.depletionYear).toBe(run2.depletionYear);
      expect(run1.yearlyData).toEqual(run2.yearlyData);
    });
  }
});
