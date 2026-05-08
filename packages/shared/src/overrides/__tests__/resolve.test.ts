/**
 * Parity tests for the shared apply-forward resolver.
 *
 * These tests verify the shared module is byte-identical in behavior to
 * packages/calculation-engine/src/projection/overrides.ts lines 81-141.
 *
 * @see .planning/phases/06-apply-forward-consolidation/06-CONTEXT.md - D-111
 * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-07, D-08, A2
 */

import { describe, it, expect } from 'vitest';
import {
  resolveActiveWithdrawalOverride,
  resolveActiveSpendingOverride,
  type WithdrawalOverrideRecord,
  type SpendingOverrideRecord,
} from '../resolve.js';

// ---------------------------------------------------------------------------
// resolveActiveWithdrawalOverride
// ---------------------------------------------------------------------------

describe('resolveActiveWithdrawalOverride', () => {
  it('returns undefined for undefined overrides', () => {
    expect(resolveActiveWithdrawalOverride('rrsp', 2030, undefined)).toBeUndefined();
  });

  it('returns undefined for empty array', () => {
    expect(resolveActiveWithdrawalOverride('rrsp', 2030, [])).toBeUndefined();
  });

  it('returns single-year override at exact target year', () => {
    const overrides: WithdrawalOverrideRecord[] = [
      { field: 'rrsp', year: 2030, amount: 50000, applyForward: false },
    ];
    expect(resolveActiveWithdrawalOverride('rrsp', 2030, overrides)).toEqual(overrides[0]);
  });

  it('returns apply-forward anchor when target year > anchor year', () => {
    const overrides: WithdrawalOverrideRecord[] = [
      { field: 'rrsp', year: 2030, amount: 50000, applyForward: true },
    ];
    expect(resolveActiveWithdrawalOverride('rrsp', 2035, overrides)).toEqual(overrides[0]);
  });

  it('returns latest apply-forward anchor when multiple anchors precede target', () => {
    const overrides: WithdrawalOverrideRecord[] = [
      { field: 'rrsp', year: 2030, amount: 50000, applyForward: true },
      { field: 'rrsp', year: 2032, amount: 60000, applyForward: true },
    ];
    expect(resolveActiveWithdrawalOverride('rrsp', 2035, overrides)).toEqual(overrides[1]);
  });

  it('returns undefined when only future overrides exist', () => {
    const overrides: WithdrawalOverrideRecord[] = [
      { field: 'rrsp', year: 2040, amount: 50000, applyForward: false },
    ];
    expect(resolveActiveWithdrawalOverride('rrsp', 2030, overrides)).toBeUndefined();
  });

  it('ignores overrides for a different field', () => {
    const overrides: WithdrawalOverrideRecord[] = [
      { field: 'tfsa', year: 2030, amount: 50000, applyForward: true },
    ];
    expect(resolveActiveWithdrawalOverride('rrsp', 2035, overrides)).toBeUndefined();
  });

  it('A2: single-year-after-apply-forward does NOT terminate the apply-forward chain', () => {
    // D-08/A2: applyForward=true at 2030, then single-year at 2032 (applyForward=false)
    // Querying 2035 must still resolve to the 2030 anchor (not 2032, not undefined)
    const overrides: WithdrawalOverrideRecord[] = [
      { field: 'rrsp', year: 2030, amount: 50000, applyForward: true },
      { field: 'rrsp', year: 2032, amount: 99999, applyForward: false },
    ];
    expect(resolveActiveWithdrawalOverride('rrsp', 2035, overrides)).toEqual(overrides[0]);
  });

  it('throws when amount is not finite (NaN) — T-02', () => {
    const overrides: WithdrawalOverrideRecord[] = [
      { field: 'rrsp', year: 2030, amount: NaN, applyForward: false },
    ];
    expect(() => resolveActiveWithdrawalOverride('rrsp', 2030, overrides)).toThrow(/not finite/);
  });

  it('throws when amount is not finite (Infinity) — T-02', () => {
    const overrides: WithdrawalOverrideRecord[] = [
      { field: 'rrsp', year: 2030, amount: Infinity, applyForward: true },
    ];
    expect(() => resolveActiveWithdrawalOverride('rrsp', 2035, overrides)).toThrow(/not finite/);
  });

  it('record at targetYear wins over earlier apply-forward anchor — D-07', () => {
    const overrides: WithdrawalOverrideRecord[] = [
      { field: 'rrsp', year: 2030, amount: 50000, applyForward: true },
      { field: 'rrsp', year: 2035, amount: 75000, applyForward: false },
    ];
    expect(resolveActiveWithdrawalOverride('rrsp', 2035, overrides)).toEqual(overrides[1]);
  });

  it('handles mixed-field overrides: only resolves matching field', () => {
    const overrides: WithdrawalOverrideRecord[] = [
      { field: 'rrsp', year: 2030, amount: 50000, applyForward: true },
      { field: 'tfsa', year: 2031, amount: 20000, applyForward: true },
      { field: 'rrsp', year: 2033, amount: 55000, applyForward: false },
    ];
    // tfsa query at 2035 should only see the tfsa record
    expect(resolveActiveWithdrawalOverride('tfsa', 2035, overrides)).toEqual(overrides[1]);
    // rrsp query at 2035 should see rrsp 2030 anchor (2033 is single-year, A2 preserves 2030)
    expect(resolveActiveWithdrawalOverride('rrsp', 2035, overrides)).toEqual(overrides[0]);
  });

  it('returns undefined when apply-forward anchor exists but query year is before it', () => {
    const overrides: WithdrawalOverrideRecord[] = [
      { field: 'rrsp', year: 2030, amount: 50000, applyForward: true },
    ];
    expect(resolveActiveWithdrawalOverride('rrsp', 2025, overrides)).toBeUndefined();
  });

  it('nonreg field resolves independently from rrsp', () => {
    const overrides: WithdrawalOverrideRecord[] = [
      { field: 'nonreg', year: 2030, amount: 10000, applyForward: true },
      { field: 'rrsp', year: 2031, amount: 40000, applyForward: true },
    ];
    expect(resolveActiveWithdrawalOverride('nonreg', 2035, overrides)).toEqual(overrides[0]);
    expect(resolveActiveWithdrawalOverride('rrsp', 2035, overrides)).toEqual(overrides[1]);
  });
});

// ---------------------------------------------------------------------------
// resolveActiveSpendingOverride
// ---------------------------------------------------------------------------

describe('resolveActiveSpendingOverride', () => {
  it('returns undefined for undefined overrides', () => {
    expect(resolveActiveSpendingOverride(2030, undefined)).toBeUndefined();
  });

  it('returns undefined for empty array', () => {
    expect(resolveActiveSpendingOverride(2030, [])).toBeUndefined();
  });

  it('returns single-year override at exact target year', () => {
    const overrides: SpendingOverrideRecord[] = [
      { year: 2030, amount: 80000, applyForward: false },
    ];
    expect(resolveActiveSpendingOverride(2030, overrides)).toEqual(overrides[0]);
  });

  it('returns apply-forward anchor when target year > anchor year', () => {
    const overrides: SpendingOverrideRecord[] = [{ year: 2030, amount: 80000, applyForward: true }];
    expect(resolveActiveSpendingOverride(2035, overrides)).toEqual(overrides[0]);
  });

  it('A2: single-year-after-apply-forward does NOT terminate spending chain', () => {
    const overrides: SpendingOverrideRecord[] = [
      { year: 2030, amount: 80000, applyForward: true },
      { year: 2032, amount: 99999, applyForward: false },
    ];
    expect(resolveActiveSpendingOverride(2035, overrides)).toEqual(overrides[0]);
  });

  it('throws when amount is not finite — T-02', () => {
    const overrides: SpendingOverrideRecord[] = [{ year: 2030, amount: NaN, applyForward: false }];
    expect(() => resolveActiveSpendingOverride(2030, overrides)).toThrow(/not finite/);
  });

  it('returns undefined when only future overrides exist', () => {
    const overrides: SpendingOverrideRecord[] = [{ year: 2040, amount: 80000, applyForward: true }];
    expect(resolveActiveSpendingOverride(2030, overrides)).toBeUndefined();
  });

  it('record at targetYear wins over earlier apply-forward anchor', () => {
    const overrides: SpendingOverrideRecord[] = [
      { year: 2030, amount: 80000, applyForward: true },
      { year: 2035, amount: 90000, applyForward: false },
    ];
    expect(resolveActiveSpendingOverride(2035, overrides)).toEqual(overrides[1]);
  });

  it('returns latest apply-forward anchor when multiple anchors precede target', () => {
    const overrides: SpendingOverrideRecord[] = [
      { year: 2030, amount: 70000, applyForward: true },
      { year: 2033, amount: 85000, applyForward: true },
    ];
    expect(resolveActiveSpendingOverride(2040, overrides)).toEqual(overrides[1]);
  });
});
