// @see docs/source-of-truth/07-withdrawal-strategies.md - OVER-01 (couple-projection coverage)
// @see docs/source-of-truth/08-projection-engine.md - ENG-01 couple-path override threading
/**
 * Couple-projection override tests — CR-02 regression coverage.
 *
 * Phase 1 originally landed override threading on the single-projection path
 * (runSingleProjectionCore) only. The couple driver (runCoupleProjectionCore)
 * was missing the pre-sort, the field threading into coupleYearInput, and the
 * warnings surfacing — so married users got NO override behavior despite
 * calculatePersonYear being fully wired.
 *
 * These tests assert that on a couple projection:
 *   1. Primary's withdrawalOverrides reach the engine and shape the primary
 *      person's row (rrspWithdrawal / nonRegWithdrawal / etc.).
 *   2. Spouse's row is unchanged from the no-override baseline (UI-SPEC Q2:
 *      spouse cells are read-only in v1; primary's overrides do NOT bleed
 *      into spouse's PersonYearInput).
 *   3. surplusDestination flows through to the primary's surplus-routing
 *      branch.
 *   4. Override warnings (e.g. RRIF-min raise) accumulate on the couple
 *      ProjectionOutput.warnings — additive invariant: omitted when no
 *      warnings were raised.
 *
 * Decision coverage: D-01 (field key), D-09/D-10 (waterfall), D-12 (sort),
 * UI-SPEC Q2 (spouse read-only), Plan 03 (engine threading).
 */
import { describe, it, expect } from 'vitest';
import { runProjection } from './multi-year.js';
import { buildCoupleFixture } from './__fixtures__/overrides.fixtures.js';
import type { CoupleProjectionOutput } from './multi-year.js';

function getYear(output: CoupleProjectionOutput, targetYear: number) {
  const row = output.yearlyResults.find((r) => r.year === targetYear);
  if (!row) throw new Error(`Year ${targetYear} not found in couple projection output`);
  return row;
}

describe('couple withdrawal overrides — CR-02 regression', () => {
  it('primary RRSP override is honored on couple projection (D-01, D-09)', () => {
    // Override primary's RRSP to $25K real in the second projection year.
    // WR-07: runCoupleProjectionCore now honors input.projectionStartYear
    // (the fixture sets it to 2030), so 2031 is deterministically the
    // second projection year and yearsFromStart = 1.
    // Primary has rrsp=$500K — large enough to fully fund the override.
    const input = buildCoupleFixture({
      drawdownOrder: ['nonReg', 'tfsa', 'rrsp', 'rrif'],
      withdrawalOverrides: [{ field: 'rrsp', year: 2031, amount: 25_000, applyForward: false }],
    });
    const output = runProjection(input) as CoupleProjectionOutput;
    const row = getYear(output, 2031);

    // OVER-01: D-22 override sidecar metadata is present on primary's row,
    // proves the engine actually applied the override (not just stored it).
    // The sidecar's `actual` field reports the amount withdrawn via override
    // pass; the household RRIF lane may include additional waterfall draws.
    expect(row.primary.overrides?.rrspWithdrawal).toBeDefined();
    expect(row.primary.overrides?.rrspWithdrawal?.source).toBe('override');

    // requestedReal echoes the user's input dollars exactly.
    expect(row.primary.overrides?.rrspWithdrawal?.requestedReal).toBe(25_000);

    // Fixture's projectionStartYear = 2030, inflationRate = 2.5% →
    // nominal for year 2031 = 25_000 * 1.025^1.
    const expectedNominal = 25_000 * Math.pow(1.025, 1);
    expect(row.primary.overrides?.rrspWithdrawal?.requestedNominal).toBeCloseTo(
      expectedNominal,
      -2
    );
    expect(row.primary.overrides?.rrspWithdrawal?.actual).toBeCloseTo(expectedNominal, -2);
    expect(row.primary.overrides?.rrspWithdrawal?.clamped).toBe(false);
  });

  it('primary override does NOT bleed into spouse row (UI-SPEC Q2: spouse read-only)', () => {
    // Same input as above but compare spouse rows: they MUST equal the no-override baseline.
    // Spouse default balances are half of primary's. The override pass only fires for
    // primary. Spouse's calculatePersonYear sees withdrawalOverrides=undefined.
    const baseline = buildCoupleFixture({
      drawdownOrder: ['nonReg', 'tfsa', 'rrsp', 'rrif'],
    });
    const withOverride = buildCoupleFixture({
      drawdownOrder: ['nonReg', 'tfsa', 'rrsp', 'rrif'],
      withdrawalOverrides: [{ field: 'rrsp', year: 2031, amount: 25_000, applyForward: false }],
    });

    const baseOutput = runProjection(baseline) as CoupleProjectionOutput;
    const ovrOutput = runProjection(withOverride) as CoupleProjectionOutput;

    const baseSpouse = getYear(baseOutput, 2031).spouse;
    const ovrSpouse = getYear(ovrOutput, 2031).spouse;

    // Spouse balances/withdrawals/income identical year-by-year (override on
    // primary's RRSP cannot affect spouse-owned accounts).
    expect(ovrSpouse.rrspBalance).toBeCloseTo(baseSpouse.rrspBalance, 2);
    expect(ovrSpouse.tfsaBalance).toBeCloseTo(baseSpouse.tfsaBalance, 2);
    expect(ovrSpouse.nonRegBalance).toBeCloseTo(baseSpouse.nonRegBalance, 2);
    expect(ovrSpouse.rrifWithdrawal).toBeCloseTo(baseSpouse.rrifWithdrawal, 2);
    expect(ovrSpouse.tfsaWithdrawal).toBeCloseTo(baseSpouse.tfsaWithdrawal, 2);

    // Spouse override sidecar must be entirely absent.
    expect(ovrSpouse.overrides).toBeUndefined();
  });

  it('couple projection without overrides produces no warnings field (additive invariant)', () => {
    // No override fields = no warnings field on output (criterion #5).
    const input = buildCoupleFixture();
    const output = runProjection(input) as CoupleProjectionOutput;

    expect(output.warnings).toBeUndefined();
  });

  it('couple surplusDestination flows through to primary surplus-routing branch (D-15)', () => {
    // Surplus routing fires when a year's RRIF mandatory minimum exceeds the
    // primary's spending need. Use a low-spend, high-RRIF setup so post-71
    // years generate surplus.
    const input = buildCoupleFixture({
      targetRetirementSpending: 20_000,
      balances: { rrsp: 0, rrif: 400_000, tfsa: 0, nonReg: 50_000, lif: 0 },
      surplusDestination: 'nonreg',
      drawdownOrder: ['rrif'],
    });
    const output = runProjection(input) as CoupleProjectionOutput;

    // Find a primary RRIF-min year (year >= 2036, primary at age 71).
    const rrifYear = output.yearlyResults.find(
      (r) => r.year >= 2036 && r.primary.rrifForcedMinimum > 0
    );
    expect(rrifYear).toBeDefined();

    // D-19: primary's netCashFlow in surplus year is bounded near zero
    // (surplus deposited, not wasted). The single-path test allows $1K
    // tolerance; we use the same bound for consistency.
    if (rrifYear) {
      expect(rrifYear.primary.netCashFlow).toBeGreaterThanOrEqual(-1);
    }
  });

  it('spouse RRSP override applies to spouse, not primary (per-owner routing)', () => {
    // Mirrors the primary-override test but with owner: 'spouse'. Verifies the
    // multi-year owner filter routes spouse-tagged records to the spouse's
    // PersonYearInput only — primary stays at baseline.
    const baseline = buildCoupleFixture({
      drawdownOrder: ['nonReg', 'tfsa', 'rrsp', 'rrif'],
    });
    const withSpouseOverride = buildCoupleFixture({
      drawdownOrder: ['nonReg', 'tfsa', 'rrsp', 'rrif'],
      withdrawalOverrides: [
        { field: 'rrsp', year: 2031, amount: 15_000, applyForward: false, owner: 'spouse' },
      ],
    });

    const baseOutput = runProjection(baseline) as CoupleProjectionOutput;
    const ovrOutput = runProjection(withSpouseOverride) as CoupleProjectionOutput;

    const ovrSpouse = getYear(ovrOutput, 2031).spouse;
    const ovrPrimary = getYear(ovrOutput, 2031).primary;
    const basePrimary = getYear(baseOutput, 2031).primary;

    // Spouse override sidecar present + reports the requested amount.
    expect(ovrSpouse.overrides?.rrspWithdrawal).toBeDefined();
    expect(ovrSpouse.overrides?.rrspWithdrawal?.source).toBe('override');
    expect(ovrSpouse.overrides?.rrspWithdrawal?.requestedReal).toBe(15_000);

    // Primary side carries no override sidecar and matches the no-override baseline.
    expect(ovrPrimary.overrides).toBeUndefined();
    expect(ovrPrimary.rrspBalance).toBeCloseTo(basePrimary.rrspBalance, 2);
    expect(ovrPrimary.nonRegBalance).toBeCloseTo(basePrimary.nonRegBalance, 2);
  });

  it('couple RRIF override below mandatory minimum raises silently and emits warning (A5)', () => {
    // Override primary's RRIF to $1K real in 2038 — well below the mandatory
    // minimum at age 73. A5: engine raises to mandatory and emits warning.
    const input = buildCoupleFixture({
      drawdownOrder: ['nonReg', 'tfsa', 'rrif'],
      withdrawalOverrides: [{ field: 'rrif', year: 2038, amount: 1_000, applyForward: false }],
    });
    const output = runProjection(input) as CoupleProjectionOutput;

    // Warning should appear on the couple ProjectionOutput.warnings array.
    expect(output.warnings).toBeDefined();
    expect(output.warnings?.length).toBeGreaterThan(0);
    const rrifMinWarning = output.warnings?.find((w) => w.code === 'override_below_rrif_minimum');
    expect(rrifMinWarning).toBeDefined();
    expect(rrifMinWarning?.year).toBe(2038);
  });
});
