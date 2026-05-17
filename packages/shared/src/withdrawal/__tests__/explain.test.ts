/**
 * Phase 30 — Explainability adapter unit tests.
 *
 * Coverage:
 *  - Pitfall 4 (MANDATORY) — table of 4 derivation branches:
 *      1. rrif.forced-min      (RRIF withdrawal with forced minimum)
 *      2. bracket-fill         (withdrawal driven by bracket-fill strategy)
 *      3. user-override        (override matches account + year)
 *      4. strategy-drawdown-order (residual / default)
 *  - taxImpactApprox = amount * effectiveTaxRate (numeric invariant)
 *  - Zero-amount cells are skipped (no reason emitted)
 *  - LIF withdrawal classification (optional account branch)
 *  - Default behaviour when overrides param is undefined
 *  - User-override beats forced-minimum (derivation-order priority — RRIF)
 *
 * Every emitted reason MUST have a non-empty `ruleId` — assertion repeated in
 * the table to make a future "ruleId drift" regression impossible to miss.
 *
 * @see ../explain.ts
 * @see .planning/phases/30-explainability-adapter-override-summary/30-01-PLAN.md
 * @see .planning/phases/30-explainability-adapter-override-summary/30-CONTEXT.md
 */
import { describe, it, expect } from 'vitest';
import {
  explainYearWithdrawals,
  type ProjectionYearRowLike,
  type WithdrawalReason,
  type ExplainInput,
} from '../explain.js';

// ---------------------------------------------------------------------------
// Base fixture — no withdrawals fire from this row. Each test overrides only
// the fields relevant to the branch under test.
// ---------------------------------------------------------------------------
function baseRow(overrides: Partial<ProjectionYearRowLike> = {}): ProjectionYearRowLike {
  return {
    year: 2030,
    age: 65,
    rrifWithdrawal: 0,
    rrifForcedMinimum: 0,
    bracketFillWithdrawal: 0,
    tfsaWithdrawal: 0,
    nonRegWithdrawal: 0,
    lifWithdrawal: 0,
    effectiveTaxRate: 0.25,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Pitfall 4 — the four derivation branches (HARD TEST TABLE)
// ---------------------------------------------------------------------------

describe('explainYearWithdrawals — Pitfall 4 derivation table', () => {
  const cases: Array<{
    name: string;
    input: ExplainInput;
    expected: Pick<WithdrawalReason, 'account' | 'reason' | 'classification' | 'ruleId'>;
  }> = [
    {
      // row1 — RRIF withdrawal matches the engine's forced minimum.
      // No override; forced minimum is non-zero → mandatory-minimum branch.
      name: 'row1: RRIF + rrifForcedMinimum > 0 → mandatory minimum / required',
      input: {
        row: baseRow({ rrifWithdrawal: 5_000, rrifForcedMinimum: 5_000 }),
      },
      expected: {
        account: 'rrif',
        reason: 'mandatory minimum',
        classification: 'required',
        ruleId: 'rrif.forced-min',
      },
    },
    {
      // row2 — RRIF withdrawal driven by bracket-fill (no forced min, no override).
      // Same shape the engine uses: bracketFillWithdrawal > 0 surfaces on the row,
      // and the RRIF cell carries the chosen amount.
      name: 'row2: RRIF + bracketFillWithdrawal > 0, no forced min → bracket fill / strategic',
      input: {
        row: baseRow({ rrifWithdrawal: 10_000, bracketFillWithdrawal: 10_000 }),
      },
      expected: {
        account: 'rrif',
        reason: 'bracket fill',
        classification: 'strategic',
        ruleId: 'bracket-fill',
      },
    },
    {
      // row3 — User override for TFSA in the row's year. amount matches the
      // withdrawal cell. Per Zod schema, `field` is lowercase ('tfsa').
      name: 'row3: TFSA withdrawal + matching user override → user-forced / user-override',
      input: {
        row: baseRow({ year: 2030, tfsaWithdrawal: 8_000 }),
        overrides: [{ field: 'tfsa', year: 2030, amount: 8_000, applyForward: false }],
      },
      expected: {
        account: 'tfsa',
        reason: 'user override',
        classification: 'user-forced',
        ruleId: 'user-override',
      },
    },
    {
      // row4 — Residual branch: TFSA withdrawal, no override, no forced min,
      // no bracket-fill → strategy-driven drawdown order.
      name: 'row4: TFSA withdrawal, no override / no forced min / no bracket-fill → strategy-drawdown-order',
      input: {
        row: baseRow({ tfsaWithdrawal: 5_000 }),
      },
      expected: {
        account: 'tfsa',
        reason: 'strategy-driven drawdown order',
        classification: 'strategic',
        ruleId: 'strategy-drawdown-order',
      },
    },
  ];

  it.each(cases)('$name', ({ input, expected }) => {
    const result = explainYearWithdrawals(input);
    expect(result.length).toBeGreaterThanOrEqual(1);
    // Find the reason whose account matches — there is exactly one in each table case.
    const match = result.find((r) => r.account === expected.account);
    expect(match).toBeDefined();
    expect(match?.reason).toBe(expected.reason);
    expect(match?.classification).toBe(expected.classification);
    expect(match?.ruleId).toBe(expected.ruleId);
    // Hard invariant: ruleId is non-empty (regression guard).
    expect(match?.ruleId?.length ?? 0).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Numeric invariants
// ---------------------------------------------------------------------------

describe('explainYearWithdrawals — taxImpactApprox invariant', () => {
  it('emits taxImpactApprox = amount * effectiveTaxRate', () => {
    const reasons = explainYearWithdrawals({
      row: baseRow({
        rrifWithdrawal: 12_000,
        rrifForcedMinimum: 12_000,
        effectiveTaxRate: 0.3,
      }),
    });
    expect(reasons).toHaveLength(1);
    expect(reasons[0]?.taxImpactApprox).toBeCloseTo(12_000 * 0.3, 6);
  });

  it('emits taxImpactApprox = 0 when effectiveTaxRate = 0 (TFSA-like)', () => {
    const reasons = explainYearWithdrawals({
      row: baseRow({ tfsaWithdrawal: 4_000, effectiveTaxRate: 0 }),
    });
    expect(reasons).toHaveLength(1);
    expect(reasons[0]?.taxImpactApprox).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Zero-amount cells are skipped
// ---------------------------------------------------------------------------

describe('explainYearWithdrawals — skip-zero behaviour', () => {
  it('returns an empty array when no cell has a non-zero withdrawal', () => {
    expect(explainYearWithdrawals({ row: baseRow() })).toEqual([]);
  });

  it('skips zero TFSA / nonReg / LIF cells when only RRIF is non-zero', () => {
    const reasons = explainYearWithdrawals({
      row: baseRow({ rrifWithdrawal: 7_000, rrifForcedMinimum: 7_000 }),
    });
    expect(reasons).toHaveLength(1);
    expect(reasons[0]?.account).toBe('rrif');
  });
});

// ---------------------------------------------------------------------------
// LIF — optional account branch + strategy-drawdown-order default
// ---------------------------------------------------------------------------

describe('explainYearWithdrawals — LIF branch', () => {
  it('classifies LIF withdrawal as strategy-driven by default', () => {
    const reasons = explainYearWithdrawals({
      row: baseRow({ lifWithdrawal: 3_000 }),
    });
    const lif = reasons.find((r) => r.account === 'lif');
    expect(lif).toBeDefined();
    expect(lif?.ruleId).toBe('strategy-drawdown-order');
    expect(lif?.classification).toBe('strategic');
  });

  it('classifies LIF withdrawal as user-forced when an override matches', () => {
    const reasons = explainYearWithdrawals({
      row: baseRow({ year: 2032, lifWithdrawal: 2_000 }),
      overrides: [{ field: 'lif', year: 2032, amount: 2_000, applyForward: false }],
    });
    const lif = reasons.find((r) => r.account === 'lif');
    expect(lif?.ruleId).toBe('user-override');
    expect(lif?.classification).toBe('user-forced');
  });

  it('omits LIF entry when lifWithdrawal is undefined', () => {
    const row = baseRow({ rrifWithdrawal: 1_000, rrifForcedMinimum: 1_000 });
    // Force the optional to be absent (not just zero).
    delete (row as { lifWithdrawal?: number }).lifWithdrawal;
    const reasons = explainYearWithdrawals({ row });
    expect(reasons.find((r) => r.account === 'lif')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Derivation-order priority — user override beats forced minimum on RRIF
// ---------------------------------------------------------------------------

describe('explainYearWithdrawals — derivation-order priority', () => {
  it('user override beats forced minimum on RRIF (override > forced-min)', () => {
    const reasons = explainYearWithdrawals({
      row: baseRow({
        year: 2030,
        rrifWithdrawal: 9_000,
        rrifForcedMinimum: 5_000,
      }),
      overrides: [{ field: 'rrif', year: 2030, amount: 9_000, applyForward: false }],
    });
    expect(reasons).toHaveLength(1);
    expect(reasons[0]?.ruleId).toBe('user-override');
    expect(reasons[0]?.classification).toBe('user-forced');
  });
});

// ---------------------------------------------------------------------------
// Override param default
// ---------------------------------------------------------------------------

describe('explainYearWithdrawals — overrides defaulting', () => {
  it('treats omitted overrides as []', () => {
    const reasons = explainYearWithdrawals({
      row: baseRow({ nonRegWithdrawal: 6_000 }),
    });
    expect(reasons).toHaveLength(1);
    expect(reasons[0]?.account).toBe('nonReg');
    expect(reasons[0]?.ruleId).toBe('strategy-drawdown-order');
  });

  it('ignores overrides whose year does not match the row', () => {
    const reasons = explainYearWithdrawals({
      row: baseRow({ year: 2030, tfsaWithdrawal: 5_000 }),
      overrides: [{ field: 'tfsa', year: 2031, amount: 5_000, applyForward: false }],
    });
    expect(reasons[0]?.ruleId).toBe('strategy-drawdown-order');
  });
});
