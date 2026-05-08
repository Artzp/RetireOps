// @see docs/source-of-truth/08-projection-engine.md — clamp-to-balance (OVER-04, D-11..D-14)
// @see docs/source-of-truth/04-tax-engine.md — silent re-tax on clamped amount (D-14)
/**
 * GREEN tests for OVER-04 — clamp-to-balance semantics.
 * Engine implementation lands in Plan 03.
 *
 * Decision coverage: D-11 (shortfall spills into waterfall), D-12 (persist original intent),
 * D-13 (sidecar clamped flag + badge surface), D-14 (tax on clamped amount).
 *
 * Tests target year 2030 (projection start) so that yearsFromProjectionStart=0
 * and requestedNominal = amount * 1.025^0 = amount exactly — no inflation factor.
 * This also ensures RRSP balance is at the fixture starting value before any drawdown.
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
// OVER-04 — clamp-to-balance
// ---------------------------------------------------------------------------

describe('clamp-to-balance — OVER-04 (D-11, D-12, D-13, D-14)', () => {
  it('OVER-04 D-11: clamps override to balance when override > start-of-year balance', () => {
    // RRSP balance starts at $30K (set via balances), override is $50K real.
    // Year 2030: yearsFromProjectionStart=0 → requestedNominal = $50K exactly.
    // $50K > $30K → clamps to $30K. Remaining ~$5K+ gap filled by waterfall (nonReg).
    const input = buildSinglePersonFixture({
      balances: { rrsp: 30_000, nonReg: 200_000 },
      drawdownOrder: ['rrsp', 'nonReg'],
      withdrawalOverrides: [{ field: 'rrsp', year: 2030, amount: 50_000, applyForward: false }],
    });
    const output = runProjection(input) as ProjectionOutput;
    const row = getYear(output, 2030);

    // D-11: RRSP clamped to available balance ($30K, no inflation at year 0)
    expect(row.rrifWithdrawal).toBeCloseTo(30_000, -2);

    // D-11: remaining gap spills to nonReg (waterfall continues)
    expect(row.nonRegWithdrawal).toBeGreaterThan(0);
  });

  it('OVER-04 D-12: original intent preserved in input.withdrawalOverrides after clamped run', () => {
    // After running, the input object's override array must be unchanged (original $50K persists).
    const input = buildSinglePersonFixture({
      balances: { rrsp: 30_000, nonReg: 200_000 },
      drawdownOrder: ['rrsp', 'nonReg'],
      withdrawalOverrides: [{ field: 'rrsp', year: 2030, amount: 50_000, applyForward: false }],
    });
    const originalOverrides = JSON.parse(
      JSON.stringify((input as unknown as Record<string, unknown>).withdrawalOverrides)
    );

    runProjection(input);

    // D-12: input unchanged — original $50K intent preserved
    expect((input as unknown as Record<string, unknown>).withdrawalOverrides).toEqual(
      originalOverrides
    );
  });

  it('OVER-04 D-13 + D-22: sidecar records clamped=true with requestedReal and clampedTo', () => {
    // After clamping RRSP from $50K to $30K, the result sidecar must record:
    //   result.yearlyResults[n].overrides.rrspWithdrawal.clamped === true
    //   result.yearlyResults[n].overrides.rrspWithdrawal.requestedReal === 50_000
    const input = buildSinglePersonFixture({
      balances: { rrsp: 30_000, nonReg: 200_000 },
      drawdownOrder: ['rrsp', 'nonReg'],
      withdrawalOverrides: [{ field: 'rrsp', year: 2030, amount: 50_000, applyForward: false }],
    });
    const output = runProjection(input) as ProjectionOutput;
    const row = getYear(output, 2030) as Record<string, unknown>;

    // D-13/D-22: engine emits overrides sidecar on YearlyResult
    const overrides = row['overrides'] as Record<string, unknown> | undefined;
    expect(overrides).toBeDefined();
    const rrspClamp = (overrides as Record<string, Record<string, unknown>>)?.['rrspWithdrawal'];
    expect(rrspClamp?.['clamped']).toBe(true);
    expect(rrspClamp?.['requestedReal']).toBe(50_000);
  });

  it('OVER-04 D-14: tax is computed on the clamped amount only (silent re-tax)', () => {
    // Two runs:
    //   Run A: override $50K, RRSP balance $30K → clamps to $30K.
    //   Run B: override $30K explicitly (no clamp, same effective withdrawal).
    // Tax in Run A year 2030 must equal tax in Run B year 2030 (both $30K taxable RRSP income).
    const inputA = buildSinglePersonFixture({
      balances: { rrsp: 30_000, nonReg: 200_000 },
      drawdownOrder: ['rrsp', 'nonReg'],
      withdrawalOverrides: [{ field: 'rrsp', year: 2030, amount: 50_000, applyForward: false }],
    });
    const inputB = buildSinglePersonFixture({
      balances: { rrsp: 30_000, nonReg: 200_000 },
      drawdownOrder: ['rrsp', 'nonReg'],
      withdrawalOverrides: [{ field: 'rrsp', year: 2030, amount: 30_000, applyForward: false }],
    });

    const outputA = runProjection(inputA) as ProjectionOutput;
    const outputB = runProjection(inputB) as ProjectionOutput;

    const rowA = getYear(outputA, 2030);
    const rowB = getYear(outputB, 2030);

    // D-14: taxes on clamped amount must match taxes on explicitly-$30K override
    expect(rowA.taxesPaid).toBeCloseTo(rowB.taxesPaid, 0);
  });
});

// ---------------------------------------------------------------------------
// Empty-balance regression: when an owner-tagged withdrawal override targets
// $X and the relevant account is fully depleted (balance == 0), the engine must
// still emit `overrides.<field>.clamped === true` with `actual === 0` so the
// UI's amber clamp badge fires for "couldn't honor — balance empty" years.
//
// This was the unobserved condition behind the user's mid-2058 → 2074 stretch
// in a 2026 demo scenario where primary's RRSP/TFSA were $0 but the
// $40K/yr withdrawal override kept firing without surfacing the failure.
//
// ---------------------------------------------------------------------------
describe('clamp-to-balance — empty-balance regression (D-13)', () => {
  it('rrsp override against $0 RRSP balance → clamped=true, actual=0, requestedReal=$40K', () => {
    const input = buildSinglePersonFixture({
      balances: { rrsp: 0, nonReg: 200_000 },
      drawdownOrder: ['rrsp', 'nonReg'],
      withdrawalOverrides: [{ field: 'rrsp', year: 2030, amount: 40_000, applyForward: false }],
    });
    const output = runProjection(input) as ProjectionOutput;
    const row = getYear(output, 2030) as Record<string, unknown>;

    const overrides = row['overrides'] as Record<string, Record<string, unknown>> | undefined;
    expect(overrides).toBeDefined();
    const rrspMeta = overrides?.['rrspWithdrawal'];
    expect(rrspMeta?.['clamped']).toBe(true);
    expect(rrspMeta?.['actual']).toBe(0);
    expect(rrspMeta?.['requestedReal']).toBe(40_000);
  });

  it('tfsa override against $0 TFSA balance → clamped=true, actual=0', () => {
    const input = buildSinglePersonFixture({
      balances: { tfsa: 0, nonReg: 200_000 },
      drawdownOrder: ['tfsa', 'nonReg'],
      withdrawalOverrides: [{ field: 'tfsa', year: 2030, amount: 40_000, applyForward: false }],
    });
    const output = runProjection(input) as ProjectionOutput;
    const row = getYear(output, 2030) as Record<string, unknown>;

    const overrides = row['overrides'] as Record<string, Record<string, unknown>> | undefined;
    const tfsaMeta = overrides?.['tfsaWithdrawal'];
    expect(tfsaMeta?.['clamped']).toBe(true);
    expect(tfsaMeta?.['actual']).toBe(0);
    expect(tfsaMeta?.['requestedReal']).toBe(40_000);
  });

  it('nonreg override against $0 non-registered balance → clamped=true, actual=0', () => {
    const input = buildSinglePersonFixture({
      balances: { nonReg: 0, rrsp: 500_000 },
      drawdownOrder: ['nonReg', 'rrsp'],
      withdrawalOverrides: [{ field: 'nonreg', year: 2030, amount: 40_000, applyForward: false }],
    });
    const output = runProjection(input) as ProjectionOutput;
    const row = getYear(output, 2030) as Record<string, unknown>;

    const overrides = row['overrides'] as Record<string, Record<string, unknown>> | undefined;
    const nonRegMeta = overrides?.['nonRegWithdrawal'];
    expect(nonRegMeta?.['clamped']).toBe(true);
    expect(nonRegMeta?.['actual']).toBe(0);
    expect(nonRegMeta?.['requestedReal']).toBe(40_000);
  });

  it('lif override against $0 LIF balance → clamped=true, actual=0', () => {
    const input = buildSinglePersonFixture({
      balances: { lif: 0, nonReg: 200_000 },
      drawdownOrder: ['lif', 'nonReg'],
      withdrawalOverrides: [{ field: 'lif', year: 2030, amount: 20_000, applyForward: false }],
    });
    const output = runProjection(input) as ProjectionOutput;
    const row = getYear(output, 2030) as Record<string, unknown>;

    const overrides = row['overrides'] as Record<string, Record<string, unknown>> | undefined;
    const lifMeta = overrides?.['lifWithdrawal'];
    expect(lifMeta?.['clamped']).toBe(true);
    expect(lifMeta?.['actual']).toBe(0);
    expect(lifMeta?.['requestedReal']).toBe(20_000);
  });
});
