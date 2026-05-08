// @see docs/source-of-truth/08-projection-engine.md — override layering semantics (OVER-03, D-07, D-08)
/**
 * GREEN tests for OVER-03 — apply-forward layering semantics.
 * Engine implementation lands in Plan 03.
 *
 * Decision coverage: D-07 (single record + engine interprets apply-forward),
 * D-08 (layering across different anchor years), Assumption A2 (single-year
 * override does not terminate a prior applyForward anchor).
 *
 * Override amounts are in real (2030) dollars. Assertions use nominal:
 *   nominal = amount * 1.025^yearsFromProjectionStart
 *
 * All target years are < 2036 to avoid RRIF conversion (RRSP → RRIF at age 71).
 * After conversion RRSP balance = 0 so RRSP overrides would produce 0.
 */
import { describe, it, expect } from 'vitest';
import { runProjection } from './multi-year.js';
import { buildSinglePersonFixture } from './__fixtures__/overrides.fixtures.js';
import type { ProjectionOutput } from '@retireops/shared';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function getYear(output: ProjectionOutput, targetYear: number) {
  const row = output.yearlyResults.find((r) => r.year === targetYear);
  if (!row) throw new Error(`Year ${targetYear} not found in projection output`);
  return row;
}

// ---------------------------------------------------------------------------
// OVER-03 — apply-forward layering
// ---------------------------------------------------------------------------

describe('apply-forward layering — OVER-03 (D-07, D-08, Assumption A2)', () => {
  it('OVER-03 D-08: layers two apply-forward RRSP overrides (2031 $20K + 2033 $25K)', () => {
    // Override 1: 2031 $20K applyForward=true → years 2031-2032 use $20K real.
    // Override 2: 2033 $25K applyForward=true → years 2033+ use $25K real.
    // All years < 2036 (pre-RRIF, RRSP balance available).
    const input = buildSinglePersonFixture({
      drawdownOrder: ['rrsp', 'tfsa', 'nonReg'],
      withdrawalOverrides: [
        { field: 'rrsp', year: 2031, amount: 20_000, applyForward: true },
        { field: 'rrsp', year: 2033, amount: 25_000, applyForward: true },
      ],
    });
    const output = runProjection(input) as ProjectionOutput;

    // 2032: apply-forward from 2031 → RRSP withdrawal ≈ $20K nominal (year 2 = 1.025^2)
    const row2032 = getYear(output, 2032);
    expect(row2032.rrifWithdrawal).toBeCloseTo(20_000 * Math.pow(1.025, 2), -2);

    // 2033: apply-forward from 2033 anchor → RRSP withdrawal ≈ $25K nominal (year 3 = 1.025^3)
    const row2033 = getYear(output, 2033);
    expect(row2033.rrifWithdrawal).toBeCloseTo(25_000 * Math.pow(1.025, 3), -2);

    // 2034: still on 2033 anchor → $25K nominal (year 4 = 1.025^4)
    const row2034 = getYear(output, 2034);
    expect(row2034.rrifWithdrawal).toBeCloseTo(25_000 * Math.pow(1.025, 4), -2);
  });

  it('OVER-03 Assumption A2: single-year override at Y applies only at Y and does NOT terminate a prior applyForward', () => {
    // Override 1: 2031 $20K applyForward=true — establishes a running floor.
    // Override 2: 2032 $25K applyForward=false — a one-year blip at 2032 only.
    // Expected:
    //   2031 → $20K applies (anchor year itself).
    //   2032 → $25K applies (single-year override wins for 2032).
    //   2033 → $20K RESUMES (the applyForward 2031 anchor is still active; A2 semantics).
    const input = buildSinglePersonFixture({
      drawdownOrder: ['rrsp', 'tfsa', 'nonReg'],
      withdrawalOverrides: [
        { field: 'rrsp', year: 2031, amount: 20_000, applyForward: true },
        { field: 'rrsp', year: 2032, amount: 25_000, applyForward: false },
      ],
    });
    const output = runProjection(input) as ProjectionOutput;

    const row2031 = getYear(output, 2031);
    const row2032 = getYear(output, 2032);
    const row2033 = getYear(output, 2033);

    // 2031: anchor year itself
    expect(row2031.rrifWithdrawal).toBeCloseTo(20_000 * Math.pow(1.025, 1), -2);
    // 2032: single-year override at 2032
    expect(row2032.rrifWithdrawal).toBeCloseTo(25_000 * Math.pow(1.025, 2), -2);
    // 2033: resumes applyForward from 2031 (Assumption A2)
    expect(row2033.rrifWithdrawal).toBeCloseTo(20_000 * Math.pow(1.025, 3), -2);
  });

  it('OVER-03 D-07: resolveActiveOverride returns the anchor-year override for years between two anchors', () => {
    // Direct behavioral test: year 2032 (between 2031 and 2033 anchors) uses 2031 anchor.
    const input = buildSinglePersonFixture({
      drawdownOrder: ['rrsp', 'tfsa'],
      withdrawalOverrides: [
        { field: 'rrsp', year: 2031, amount: 20_000, applyForward: true },
        { field: 'rrsp', year: 2033, amount: 25_000, applyForward: true },
      ],
    });
    const output = runProjection(input) as ProjectionOutput;

    const row2032 = getYear(output, 2032);
    expect(row2032.rrifWithdrawal).toBeCloseTo(20_000 * Math.pow(1.025, 2), -2);
  });

  it('OVER-03: no override before first anchor year — normal drawdown applies', () => {
    // Year 2030 (before first anchor 2031) → no override, normal drawdown.
    const input = buildSinglePersonFixture({
      drawdownOrder: ['nonReg', 'rrsp'],
      withdrawalOverrides: [{ field: 'rrsp', year: 2031, amount: 20_000, applyForward: true }],
    });
    const output = runProjection(input) as ProjectionOutput;

    const row2030 = getYear(output, 2030);
    // Without override, RRSP withdrawal driven by spending need and drawdown order.
    // nonReg is first, so RRSP should be 0 if nonReg covers the gap.
    // The test locks that override is NOT applied before its anchor year.
    expect(row2030.rrifWithdrawal).not.toBeCloseTo(20_000, -2);
  });
});
