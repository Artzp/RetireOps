/**
 * Phase 7 — Characterization snapshot suite.
 *
 * Locks the engine's current ProjectionYearRow[] output across six canonical
 * scenarios (≥2 single-person, ≥4 couple) so any monetary-field drift caused
 * by the Phase 9–11 refactors fails CI immediately. Snapshots are byte-stable:
 * `ProjectionYearRow` has no timestamps, projectionStartYear is pinned, and
 * the engine is pure (no Date.now / Math.random).
 *
 * @see .planning/phases/07-characterization-tests/07-CONTEXT.md
 * @see .planning/phases/07-characterization-tests/07-RESEARCH.md (Finding 4: scenario triggers; Finding 6: pipeline)
 * @see docs/source-of-truth/04-tax-engine.md
 * @see docs/source-of-truth/05-government-benefits.md
 * @see docs/source-of-truth/07-withdrawal-strategies.md
 *
 * Test isolation is provided by structuredClone in the fixture builders;
 * snapshots commit to packages/api/src/services/__snapshots__/.
 */
import { describe, expect, it } from 'vitest';
import { runProjection } from '@retireops/calculation-engine';
import type { FrontendInputData } from './projection-transformer.js';
import {
  transformToProjectionInput,
  transformToProjectionYearRows,
} from './projection-transformer.js';
import {
  CHARACTERIZATION_START_YEAR,
  buildCharacterizationSingleAccumulationFixture,
  buildCharacterizationSingleRetiredFixture,
  buildCharacterizationCouplePensionSplitFixture,
  buildCharacterizationCoupleHouseholdPoolingFixture,
  buildCharacterizationCoupleTfsaFirstFixture,
  buildCharacterizationCoupleBracketFillFixture,
} from '../test/fixtures/characterization.fixtures.js';

/**
 * Canonical pipeline. Mirrors demo-household-2026.regression.test.ts:
 *   FrontendInputData → ProjectionInput → ProjectionOutput → ProjectionYearRow[]
 * `projectionStartYear` is pinned on the ProjectionInput AFTER the transformer
 * so the engine's `input.projectionStartYear ?? getCurrentYear()` fallback
 * (multi-year.ts:140) cannot pull the wall clock into the snapshot.
 */
function runCharacterizationPipeline(frontendInput: FrontendInputData): string {
  const calcInput = transformToProjectionInput(frontendInput);
  calcInput.projectionStartYear = CHARACTERIZATION_START_YEAR;
  const calcOutput = runProjection(calcInput);
  const rows = transformToProjectionYearRows(calcOutput);
  // ProjectionYearRow has no timestamps / volatile fields — stringify is byte-stable.
  return JSON.stringify(rows);
}

describe('Phase 7 characterization', () => {
  describe('single-person', () => {
    it('SINGLE-01: accumulation phase — pre-retirement, working, contributing', () => {
      const serialized = runCharacterizationPipeline(
        buildCharacterizationSingleAccumulationFixture()
      );
      expect(serialized).toMatchSnapshot();
    });

    it('SINGLE-02: retired drawdown — RRSP→RRIF→TFSA→Non-Reg', () => {
      const serialized = runCharacterizationPipeline(buildCharacterizationSingleRetiredFixture());
      expect(serialized).toMatchSnapshot();
    });
  });

  describe('couple (demo household 2026 base)', () => {
    it('COUPLE-01: pension-split contrast — coupleSettings.optimizePensionSplitting = false (departs from transformer default true)', () => {
      const serialized = runCharacterizationPipeline(
        buildCharacterizationCouplePensionSplitFixture()
      );
      expect(serialized).toMatchSnapshot();
    });

    it('COUPLE-02: household-pooling — householdSpendingMode = "household"', () => {
      const serialized = runCharacterizationPipeline(
        buildCharacterizationCoupleHouseholdPoolingFixture()
      );
      expect(serialized).toMatchSnapshot();
    });

    it('COUPLE-03: TFSA-first strategy — strategyId = "tfsaFirst"', () => {
      const serialized = runCharacterizationPipeline(buildCharacterizationCoupleTfsaFirstFixture());
      expect(serialized).toMatchSnapshot();
    });

    it('COUPLE-04: bracket-fill strategy — bracketFill.enabled = true', () => {
      const serialized = runCharacterizationPipeline(
        buildCharacterizationCoupleBracketFillFixture()
      );
      expect(serialized).toMatchSnapshot();
    });

    it('REGRESSION: all four COUPLE-* serialized bodies are pairwise distinct (guards against silent no-ops in transformer or fixture overrides)', () => {
      const c01 = runCharacterizationPipeline(buildCharacterizationCouplePensionSplitFixture());
      const c02 = runCharacterizationPipeline(buildCharacterizationCoupleHouseholdPoolingFixture());
      const c03 = runCharacterizationPipeline(buildCharacterizationCoupleTfsaFirstFixture());
      const c04 = runCharacterizationPipeline(buildCharacterizationCoupleBracketFillFixture());

      // All six pairwise comparisons must differ. If any two match, a fixture
      // override is no-oping (e.g., setting a value equal to a transformer
      // default) or the transformer is silently dropping the override field
      // (the original Gap G-01 root cause for COUPLE-03's strategyId).
      // @see .planning/phases/07-characterization-tests/07-VERIFICATION.md G-01
      expect(c01).not.toEqual(c02);
      expect(c01).not.toEqual(c03);
      expect(c01).not.toEqual(c04);
      expect(c02).not.toEqual(c03);
      expect(c02).not.toEqual(c04);
      expect(c03).not.toEqual(c04);
    });
  });
});
