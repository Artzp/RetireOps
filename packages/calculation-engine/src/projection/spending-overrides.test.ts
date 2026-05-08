// @see docs/source-of-truth/08-projection-engine.md — spending calculation pipeline (OVER-02, D-20, D-21)
/**
 * RED tests for OVER-02 — base-spending overrides.
 * Engine implementation lands in Plan 03. These tests MUST FAIL until then.
 *
 * Decision coverage: D-20 (override replaces targetRetirementSpending + ageBandReductions for window),
 * D-21 (ageBandReductions apply in years WITHOUT an active spending override).
 */
import { describe, it, expect } from 'vitest';
import { runProjection } from './multi-year.js';
import { buildSinglePersonFixture } from './__fixtures__/overrides.fixtures.js';
import type { ProjectionOutput } from '@retireops/shared';

// ---------------------------------------------------------------------------
// Helper: get yearly result for a given projection year
// ---------------------------------------------------------------------------
function getYear(output: ProjectionOutput, targetYear: number) {
  const row = output.yearlyResults.find((r) => r.year === targetYear);
  if (!row) throw new Error(`Year ${targetYear} not found in projection output`);
  return row;
}

// ---------------------------------------------------------------------------
// OVER-02 + D-20 + D-21
// ---------------------------------------------------------------------------

describe('spending overrides — OVER-02 (D-20, D-21)', () => {
  it('OVER-02 D-20: spending override replaces targetRetirementSpending AND ageBandReductions for the override window', () => {
    // Base: $60K/year spending; age-band: 20% reduction at age 75 (year 2040).
    // Spending override: $80K at year 2040, applyForward: true.
    // Expected year 2040: livingExpenses = $80K inflated (NOT $60K × 0.8 inflated = $48K).
    // Override wins absolutely (D-20) — age-band does NOT apply on top.
    const input = buildSinglePersonFixture({
      targetRetirementSpending: 60_000,
      ageBandReductions: [{ fromAge: 75, reductionPercent: 0.2 }],
      spendingOverrides: [{ year: 2040, amount: 80_000, applyForward: true }],
    });
    const output = runProjection(input) as ProjectionOutput;
    const row2040 = getYear(output, 2040);

    // OVER-02 D-20: $80K real inflated to nominal for year 2040
    // Inflation 2.5% over 10 years (2030→2040): $80K × 1.025^10 ≈ $102K nominal
    const inflated80k = 80_000 * Math.pow(1.025, 10);
    // livingExpenses should be close to the inflated override, NOT the age-banded base
    expect(row2040.livingExpenses).toBeCloseTo(inflated80k, -2);

    // Also confirm it is NOT the age-banded base ($60K × 0.8 × 1.025^10 ≈ $61K)
    const ageBandedBase = 60_000 * 0.8 * Math.pow(1.025, 10);
    expect(row2040.livingExpenses).not.toBeCloseTo(ageBandedBase, -2);
  });

  it('OVER-02 D-21: ageBandReductions apply in years WITHOUT an active spending override', () => {
    // Same setup: $60K base, 20% age-band at 75 (year 2040), BUT single-year override at 2040 only.
    // Year 2041 has no active override → age-band should apply: $60K × 0.8 inflated.
    const input = buildSinglePersonFixture({
      targetRetirementSpending: 60_000,
      ageBandReductions: [{ fromAge: 75, reductionPercent: 0.2 }],
      spendingOverrides: [{ year: 2040, amount: 80_000, applyForward: false }],
    });
    const output = runProjection(input) as ProjectionOutput;
    const row2041 = getYear(output, 2041);

    // D-21: year 2041 has no active spending override → age-band applies
    // Expected: $60K × 0.8 × 1.025^11 ≈ $62K nominal
    const ageBandedBase2041 = 60_000 * 0.8 * Math.pow(1.025, 11);
    expect(row2041.livingExpenses).toBeCloseTo(ageBandedBase2041, -2);

    // And it should NOT be the override amount inflated
    const inflated80k2041 = 80_000 * Math.pow(1.025, 11);
    expect(row2041.livingExpenses).not.toBeCloseTo(inflated80k2041, -2);
  });

  it('OVER-02: single-year spending override does not affect years before or after', () => {
    // Year 2032 override; year 2031 and 2033 should use normal base spending.
    const input = buildSinglePersonFixture({
      targetRetirementSpending: 60_000,
      spendingOverrides: [{ year: 2032, amount: 90_000, applyForward: false }],
    });
    const output = runProjection(input) as ProjectionOutput;

    const row2031 = getYear(output, 2031);
    const row2033 = getYear(output, 2033);
    const inflated60k2031 = 60_000 * Math.pow(1.025, 1);
    const inflated60k2033 = 60_000 * Math.pow(1.025, 3);

    expect(row2031.livingExpenses).toBeCloseTo(inflated60k2031, -2);
    expect(row2033.livingExpenses).toBeCloseTo(inflated60k2033, -2);
  });
});
