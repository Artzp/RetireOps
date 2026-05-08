/**
 * RED unit tests for diffProjectionRows(prev, next, displayMode): Map<string, true>
 *
 * These tests MUST FAIL until Plan 03-02 creates packages/web/src/lib/cascade-diff.ts.
 * The import below will produce "Cannot find module '@/lib/cascade-diff'" — RED state confirmed.
 *
 * Decision refs: D-55, D-56, D-57, D-58, D-59, D-60, D-64
 * @see .planning/phases/03-cascade-undo/03-CONTEXT.md
 */

import { describe, it, expect } from 'vitest';
// cascade-diff.ts does NOT exist yet — module not found = RED
import { diffProjectionRows } from '../cascade-diff';
import type { ProjectionYearRow } from '@retireops/shared';

// ---------------------------------------------------------------------------
// Row factory — all required fields, override-able via Partial
// ---------------------------------------------------------------------------

function makeRow(year: number, overrides: Partial<ProjectionYearRow> = {}): ProjectionYearRow {
  return {
    year,
    age: 65 + (year - 2031),
    employmentIncome: 0,
    pensionIncome: 0,
    cppIncome: 0,
    oasIncome: 0,
    rrifWithdrawal: 0,
    tfsaWithdrawal: 0,
    nonRegWithdrawal: 0,
    totalGrossIncome: 0,
    federalTax: 0,
    provincialTax: 0,
    oasClawback: 0,
    totalTax: 0,
    effectiveTaxRate: 0,
    livingExpenses: 0,
    netCashFlow: 0,
    householdNetCashFlow: 0,
    rrspBalance: 0,
    rrifBalance: 0,
    tfsaBalance: 0,
    nonRegBalance: 0,
    totalNetWorth: 0,
    householdNetWorth: 0,
    ...overrides,
  } as ProjectionYearRow;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('diffProjectionRows', () => {
  it('returns empty Map when prev and next are identical (same reference)', () => {
    const rows = [makeRow(2031), makeRow(2032)];
    const result = diffProjectionRows(rows, rows, 'nominal');
    expect(result.size).toBe(0);
  });

  it('returns empty Map when both arrays are empty', () => {
    const result = diffProjectionRows([], [], 'nominal');
    expect(result.size).toBe(0);
  });

  it('detects single changed currency cell', () => {
    const prev = [makeRow(2031, { rrifWithdrawal: 1000 })];
    const next = [makeRow(2031, { rrifWithdrawal: 2000 })];
    const result = diffProjectionRows(prev, next, 'nominal');
    expect(result.has('2031::rrifWithdrawal')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('detects multiple changed cells in same row', () => {
    const prev = [makeRow(2031, { rrifWithdrawal: 1000, tfsaWithdrawal: 500, federalTax: 10000 })];
    const next = [makeRow(2031, { rrifWithdrawal: 2000, tfsaWithdrawal: 600, federalTax: 11000 })];
    const result = diffProjectionRows(prev, next, 'nominal');
    expect(result.has('2031::rrifWithdrawal')).toBe(true);
    expect(result.has('2031::tfsaWithdrawal')).toBe(true);
    expect(result.has('2031::federalTax')).toBe(true);
    expect(result.size).toBe(3);
  });

  it('ignores noise below display precision (D-56) — currency column', () => {
    // Both format to $80,000 at display precision — should NOT be flagged
    const prev = [makeRow(2031, { livingExpenses: 80000.0001 })];
    const next = [makeRow(2031, { livingExpenses: 80000.0002 })];
    const result = diffProjectionRows(prev, next, 'nominal');
    expect(result.has('2031::livingExpenses')).toBe(false);
  });

  it('detects percentage column change at 1-decimal precision (D-56)', () => {
    // 0.205 → "20.5%", 0.206 → "20.6%" — must detect
    const prev = [makeRow(2031, { effectiveTaxRate: 0.205 })];
    const next = [makeRow(2031, { effectiveTaxRate: 0.206 })];
    const result = diffProjectionRows(prev, next, 'nominal');
    expect(result.has('2031::effectiveTaxRate')).toBe(true);
  });

  it('ignores percentage column change below 1-decimal precision', () => {
    // 0.20503 and 0.20507 both render as "20.5%" — should NOT be flagged
    const prev = [makeRow(2031, { effectiveTaxRate: 0.20503 })];
    const next = [makeRow(2031, { effectiveTaxRate: 0.20507 })];
    const result = diffProjectionRows(prev, next, 'nominal');
    expect(result.has('2031::effectiveTaxRate')).toBe(false);
  });

  it('detects integer column change', () => {
    const prev = [makeRow(2031, { age: 65 })];
    const next = [makeRow(2031, { age: 66 })];
    const result = diffProjectionRows(prev, next, 'nominal');
    expect(result.has('2031::age')).toBe(true);
  });

  it('skips rows present in only one snapshot (D-60) — prev has extra row', () => {
    // prev has years 2030+2031, next has only year 2031 (post-death in prev)
    const prev = [makeRow(2030, { rrifWithdrawal: 1000 }), makeRow(2031, { rrifWithdrawal: 2000 })];
    const next = [makeRow(2031, { rrifWithdrawal: 3000 })];
    const result = diffProjectionRows(prev, next, 'nominal');
    // Year 2030 only in prev — NOT highlighted
    expect(result.has('2030::rrifWithdrawal')).toBe(false);
    // Year 2031 changed — highlighted
    expect(result.has('2031::rrifWithdrawal')).toBe(true);
  });

  it('skips rows added in next only (D-60) — next has extra row', () => {
    // prev has year 2030, next has years 2030+2031 (extra year added)
    const prev = [makeRow(2030, { rrifWithdrawal: 1000 })];
    const next = [makeRow(2030, { rrifWithdrawal: 2000 }), makeRow(2031, { rrifWithdrawal: 3000 })];
    const result = diffProjectionRows(prev, next, 'nominal');
    // Year 2030 changed — highlighted
    expect(result.has('2030::rrifWithdrawal')).toBe(true);
    // Year 2031 only in next — NOT highlighted
    expect(result.has('2031::rrifWithdrawal')).toBe(false);
  });

  it('returns no entries for unchanged rows when many cells exist', () => {
    const rows = [makeRow(2031), makeRow(2032), makeRow(2033), makeRow(2034), makeRow(2035)];
    // Deep copy — different object refs but identical values
    const rowsCopy = rows.map((r) => ({ ...r })) as ProjectionYearRow[];
    const result = diffProjectionRows(rows, rowsCopy, 'nominal');
    expect(result.size).toBe(0);
  });

  it('displayMode argument is accepted (v4.3 forward-compat, D-64)', () => {
    const prev = [makeRow(2031)];
    const next = [makeRow(2031)];
    // Both modes must succeed without throwing
    expect(() => diffProjectionRows(prev, next, 'real')).not.toThrow();
    expect(() => diffProjectionRows(prev, next, 'nominal')).not.toThrow();
  });

  it('handles undefined optional sparse columns gracefully — undefined vs 0 treated as $0 → no change', () => {
    // prev gisIncome undefined, next gisIncome: 0
    // formatCurrency(undefined → 0) === formatCurrency(0) === '$0' → no key
    const prev = [makeRow(2031, { gisIncome: undefined })];
    const next = [makeRow(2031, { gisIncome: 0 })];
    const result = diffProjectionRows(prev, next, 'nominal');
    expect(result.has('2031::gisIncome')).toBe(false);
  });

  it('handles undefined optional sparse columns — undefined vs non-zero is a change', () => {
    // prev gisIncome undefined ($0), next gisIncome: 5001 ($5,001) → change detected
    const prev = [makeRow(2031, { gisIncome: undefined })];
    const next = [makeRow(2031, { gisIncome: 5001 })];
    const result = diffProjectionRows(prev, next, 'nominal');
    expect(result.has('2031::gisIncome')).toBe(true);
  });
});
