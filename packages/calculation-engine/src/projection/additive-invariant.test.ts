// @see docs/source-of-truth/08-projection-engine.md — additive-schema invariant (OVER-03, ENG-01)
// @see docs/source-of-truth/00-design-philosophy.md — pure deterministic engine invariants
/**
 * RED tests for ROADMAP success criterion #5:
 * "Removing all overrides produces byte-identical ProjectionOutput."
 *
 * Engine implementation lands in Plan 03. These tests MUST FAIL until then.
 *
 * Decision coverage: D-03 (additive schema only), D-15 (surplusDestination has no Zod default),
 * Assumption A1 (absence of override fields = engine behavior unchanged).
 */
import { describe, it, expect } from 'vitest';
import { runProjection } from './multi-year.js';
import { buildSinglePersonFixture } from './__fixtures__/overrides.fixtures.js';
import type { ProjectionOutput } from '@retireops/shared';

// ---------------------------------------------------------------------------
// Helper: deterministic serialization (strip timestamps + createdAt/updatedAt)
// ---------------------------------------------------------------------------
function serializeForComparison(output: ProjectionOutput): string {
  // Remove volatile fields that differ between runs by design (timestamps).
  // Also strip override input fields (withdrawalOverrides, spendingOverrides,
  // surplusDestination) from the echoed input — they are absent vs. empty-array
  // variants of the same scenario must compare equal (D-03 additive invariant).
  const inputWithoutOverrides = {
    ...(output.input as Record<string, unknown>),
    withdrawalOverrides: undefined,
    spendingOverrides: undefined,
    surplusDestination: undefined,
    projectionStartYear: undefined,
  };
  const stripped = {
    ...output,
    input: inputWithoutOverrides,
    createdAt: undefined,
    updatedAt: undefined,
    id: undefined,
  };
  return JSON.stringify(stripped);
}

// ---------------------------------------------------------------------------
// ROADMAP criterion #5 — additive invariant
// ---------------------------------------------------------------------------

describe('additive invariant — ROADMAP success criterion #5 (D-03, D-15, Assumption A1)', () => {
  it('produces byte-identical ProjectionOutput when override fields are absent from decisions', () => {
    // Baseline: no override fields at all (pre-Phase-1 scenario shape).
    const baseline = buildSinglePersonFixture();

    // Run twice to confirm determinism.
    const outputA = runProjection(baseline) as ProjectionOutput;
    const outputB = runProjection(baseline) as ProjectionOutput;

    const serialA = serializeForComparison(outputA);
    const serialB = serializeForComparison(outputB);

    // Determinism: two runs with same input = same output.
    expect(serialA).toBe(serialB);

    // Snapshot: lock the baseline for regression.
    expect(serialA).toMatchSnapshot();
  });

  it('produces byte-identical output when override arrays are present but empty (D-03)', () => {
    // Scenario with explicitly-empty override arrays should produce identical output to baseline.
    const baselineInput = buildSinglePersonFixture();
    const withEmptyArraysInput = buildSinglePersonFixture({
      withdrawalOverrides: [],
      spendingOverrides: [],
      surplusDestination: undefined,
    });

    const baselineOutput = runProjection(baselineInput) as ProjectionOutput;
    const withEmptyOutput = runProjection(withEmptyArraysInput) as ProjectionOutput;

    const baselineSerial = serializeForComparison(baselineOutput);
    const withEmptySerial = serializeForComparison(withEmptyOutput);

    // D-03: empty override arrays = same as no override fields (additive invariant).
    expect(baselineSerial).toBe(withEmptySerial);
  });

  it('produces byte-identical output for a pre-Phase-1 scenario (targetRetirementSpending only)', () => {
    // Simulate a pre-v4.2 scenario that only has targetRetirementSpending as a decision field.
    // No withdrawal/spending override fields at all.
    const prePhase1 = buildSinglePersonFixture({
      targetRetirementSpending: 60_000,
    });
    const withExplicitUndefined = buildSinglePersonFixture({
      targetRetirementSpending: 60_000,
      withdrawalOverrides: undefined,
      spendingOverrides: undefined,
      surplusDestination: undefined,
    });

    const outputPrePhase1 = runProjection(prePhase1) as ProjectionOutput;
    const outputWithUndefined = runProjection(withExplicitUndefined) as ProjectionOutput;

    expect(serializeForComparison(outputPrePhase1)).toBe(
      serializeForComparison(outputWithUndefined)
    );
  });

  /**
   * WR-02 — DOCUMENTED divergence: the additive invariant ("byte-identical
   * output when overrides are absent") requires ALL THREE override fields
   * absent — withdrawalOverrides AND spendingOverrides AND surplusDestination.
   *
   * Setting `surplusDestination` alone (no override arrays) toggles the
   * surplus-routing branch in yearly-calculator.ts. In retired surplus years
   * (totalIncome - taxes - livingExpenses > 0), the new branch routes the
   * surplus into the destination account and zeroes netCashFlow, while the
   * pre-Phase-1 path leaves the surplus on netCashFlow. This trajectory
   * difference is observable by computeRemediationPlan when a Red-state
   * scenario carries `surplusDestination` without overrides.
   *
   * This test ENCODES the documented constraint: scenarios with
   * surplusDestination-only input do NOT preserve byte-identity. This is
   * intentional (D-19 requires netCashFlow be net-of-deposit), but downstream
   * code that depends on byte-identity (e.g. cached pre-Phase-1 baselines)
   * must keep all three Phase-1 fields undefined.
   *
   * @see WR-02 (gsd-code-reviewer 2026-04-24)
   * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-19
   */
  it('DOCUMENTS divergence: surplusDestination set without overrides changes netCashFlow trajectory (not byte-identical)', () => {
    const baseline = buildSinglePersonFixture();
    const withSurplusOnly = buildSinglePersonFixture({
      surplusDestination: 'nonreg',
    });

    const baselineOutput = runProjection(baseline) as ProjectionOutput;
    const withSurplusOutput = runProjection(withSurplusOnly) as ProjectionOutput;

    // INTENTIONAL DIVERGENCE: surplus-routing branch fires whenever
    // surplusDestination is set, even without override arrays. The branch
    // produces D-19-compliant netCashFlow (net-of-deposit) which differs
    // from the pre-Phase-1 raw cash-flow value in any retired surplus year.
    //
    // This `not.toBe` assertion is the documentation: if a future change
    // makes surplus-routing a true no-op when no overrides exist (Option b
    // from WR-02 review), this test will FAIL and force a deliberate update
    // to the additive-invariant contract.
    expect(serializeForComparison(baselineOutput)).not.toBe(
      serializeForComparison(withSurplusOutput)
    );

    // Total net worth equality holds — surplus is just deposited into a
    // tracked balance instead of sitting in netCashFlow, so household wealth
    // is conserved across the boundary.
    const baselineFinalNW =
      baselineOutput.yearlyResults[baselineOutput.yearlyResults.length - 1]?.totalNetWorth ?? 0;
    const withSurplusFinalNW =
      withSurplusOutput.yearlyResults[withSurplusOutput.yearlyResults.length - 1]?.totalNetWorth ??
      0;
    expect(withSurplusFinalNW).toBeCloseTo(baselineFinalNW, 0);
  });
});
