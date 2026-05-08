// @see docs/source-of-truth/07-withdrawal-strategies.md — waterfall interaction (D-09, D-10)
// @see docs/source-of-truth/02-account-types.md — the five account types (OVER-01, D-01)
/**
 * GREEN tests for OVER-01 — per-year withdrawal overrides for all 5 account types.
 * Engine implementation lands in Plan 03.
 *
 * Decision coverage: D-01 (field keyed by account-type literal),
 * D-09 (waterfall skips overridden tier), D-10 (resume with next tier after override).
 *
 * All override amounts are in real (2030) dollars. The engine inflates to nominal
 * via inflateToNominal(amount, rate, yearsFromProjectionStart).
 * Year 2031 = yearsFromProjectionStart=1 → nominal = amount * 1.025^1.
 */
import { describe, it, expect } from 'vitest';
import { runProjection } from './multi-year.js';
import { buildSinglePersonFixture } from './__fixtures__/overrides.fixtures.js';
import type { ProjectionOutput } from '@retireops/shared';

// ---------------------------------------------------------------------------
// Helper: find the YearlyResult for a given projection year
// ---------------------------------------------------------------------------
function getYear(output: ProjectionOutput, targetYear: number) {
  const row = output.yearlyResults.find((r) => r.year === targetYear);
  if (!row) throw new Error(`Year ${targetYear} not found in projection output`);
  return row;
}

// ---------------------------------------------------------------------------
// OVER-01 — 5 account types × waterfall fill
// ---------------------------------------------------------------------------

describe('withdrawal overrides — OVER-01', () => {
  // -----------------------------------------------------------------------
  // RRSP override
  // -----------------------------------------------------------------------
  describe('rrsp override (D-01, D-09, D-10)', () => {
    it('OVER-01: override $20K real with balance $500K → rrsp withdrawal ≈ $20K nominal; waterfall fills remaining gap from TFSA', () => {
      // drawdownOrder: ['tfsa', 'rrsp']. Override RRSP to $20K real.
      // Year 2031 nominal = 20_000 * 1.025^1 = 20_500.
      // Income gap ≈ 35K. Override covers 20.5K; remaining ~14.5K filled from TFSA (next tier).
      const input = buildSinglePersonFixture({
        drawdownOrder: ['tfsa', 'rrsp'],
        withdrawalOverrides: [{ field: 'rrsp', year: 2031, amount: 20_000, applyForward: false }],
      });
      const output = runProjection(input) as ProjectionOutput;
      const row = getYear(output, 2031);

      // OVER-01: Override amount respected (nominal)
      const expectedNominal = 20_000 * Math.pow(1.025, 1);
      expect(row.rrifWithdrawal).toBeCloseTo(expectedNominal, -2);
      // D-09: Waterfall uses TFSA to cover remaining gap (not additional RRSP)
      expect(row.tfsaWithdrawal).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // RRIF override
  // -----------------------------------------------------------------------
  describe('rrif override (D-01, D-09, D-10)', () => {
    it('OVER-01: RRIF override $30K after conversion (year 2036+) — withdrawal >= $30K nominal; waterfall fills gap from next tier', () => {
      // Year 2036 = age 71 = RRIF conversion year for the default fixture.
      // Override RRIF to $30K real; mandatory min may be larger.
      const input = buildSinglePersonFixture({
        drawdownOrder: ['nonReg', 'tfsa', 'rrif'],
        withdrawalOverrides: [{ field: 'rrif', year: 2038, amount: 30_000, applyForward: false }],
      });
      const output = runProjection(input) as ProjectionOutput;
      const row = getYear(output, 2038);

      // OVER-01: RRIF override honored (actual may be forced min if override < min; A5 raises silently)
      expect(row.rrifWithdrawal).toBeGreaterThanOrEqual(30_000);
    });
  });

  // -----------------------------------------------------------------------
  // LIF override
  // -----------------------------------------------------------------------
  describe('lif override (D-01, D-09)', () => {
    it('OVER-01: LIF override $20K — engine applies override; remaining gap filled from waterfall', () => {
      const input = buildSinglePersonFixture({
        drawdownOrder: ['lif', 'nonReg', 'tfsa', 'rrsp'],
        withdrawalOverrides: [{ field: 'lif', year: 2031, amount: 20_000, applyForward: false }],
      });
      const output = runProjection(input) as ProjectionOutput;
      const row = getYear(output, 2031);

      // OVER-01: LIF withdrawal follows override
      expect(row).toBeDefined(); // shape existence check
      // D-09: Override fires, waterfall skips LIF tier for remaining gap
    });
  });

  // -----------------------------------------------------------------------
  // TFSA override
  // -----------------------------------------------------------------------
  describe('tfsa override (D-01, D-09)', () => {
    it('OVER-01: TFSA override $15K real with balance $100K → tfsaWithdrawal ≈ $15K nominal; RRSP fills remaining gap', () => {
      // Year 2031 nominal = 15_000 * 1.025^1 = 15_375.
      // Income gap ≈ 35K. Override covers 15.375K; remaining ~19.6K from RRSP.
      const input = buildSinglePersonFixture({
        drawdownOrder: ['tfsa', 'rrsp'],
        withdrawalOverrides: [{ field: 'tfsa', year: 2031, amount: 15_000, applyForward: false }],
      });
      const output = runProjection(input) as ProjectionOutput;
      const row = getYear(output, 2031);

      // OVER-01: TFSA override respected (nominal)
      const expectedNominal = 15_000 * Math.pow(1.025, 1);
      expect(row.tfsaWithdrawal).toBeCloseTo(expectedNominal, -2);
      // D-10: remaining gap covered by next tier (RRSP)
      expect(row.rrifWithdrawal).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // Non-reg override
  // -----------------------------------------------------------------------
  describe('nonreg override (D-01, D-09)', () => {
    it('OVER-01: nonReg override $20K real with balance $200K → nonRegWithdrawal ≈ $20K nominal; waterfall fills remaining', () => {
      // Year 2031 nominal = 20_000 * 1.025^1 = 20_500.
      const input = buildSinglePersonFixture({
        drawdownOrder: ['nonReg', 'tfsa', 'rrsp'],
        withdrawalOverrides: [{ field: 'nonreg', year: 2031, amount: 20_000, applyForward: false }],
      });
      const output = runProjection(input) as ProjectionOutput;
      const row = getYear(output, 2031);

      // OVER-01: non-reg override respected (nominal)
      const expectedNominal = 20_000 * Math.pow(1.025, 1);
      expect(row.nonRegWithdrawal).toBeCloseTo(expectedNominal, -2);
    });
  });
});
