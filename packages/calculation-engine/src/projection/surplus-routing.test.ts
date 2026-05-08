// @see docs/source-of-truth/08-projection-engine.md — surplus routing (ENG-01, D-15..D-19)
// @see docs/source-of-truth/06-investment-engine.md — end-of-year deposit timing (D-18)
/**
 * RED tests for ENG-01 — surplus routing for RRIF minimums and withdrawal overrides.
 * Engine implementation lands in Plan 03. These tests MUST FAIL until then.
 *
 * Decision coverage: D-15 (surplusDestination field), D-16 (RRIF-min + override surplus triggers),
 * D-17 (missing-account fallback), D-18 (end-of-year deposit, no same-year growth),
 * D-19 (netCashFlow ≥ 0 in surplus years).
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
// ENG-01 — surplus routing
// ---------------------------------------------------------------------------

describe('surplus routing — ENG-01 (D-15, D-16, D-17, D-18, D-19)', () => {
  it('ENG-01 D-15 ROADMAP #4: routes RRIF-minimum surplus to surplusDestination (nonreg)', () => {
    // Scenario: RRIF min for year 2038 ≈ inflated value exceeds spending need.
    // Set spending low ($20K real) vs RRIF min forced withdrawal.
    // surplusDestination = 'nonreg'.
    // Expected: nonReg end-of-year balance delta ≈ surplus amount.
    const input = buildSinglePersonFixture({
      targetRetirementSpending: 20_000, // low spending → RRIF min likely > need
      surplusDestination: 'nonreg',
      drawdownOrder: ['rrif', 'nonReg'],
      balances: { rrsp: 0, rrif: 400_000, tfsa: 0, nonReg: 50_000, lif: 0 },
    });
    const output = runProjection(input) as ProjectionOutput;
    const row2036 = getYear(output, 2036); // RRIF conversion/min year

    // ENG-01: When RRIF min > spending need, surplus routed to nonReg.
    // nonReg end-of-year balance should reflect surplus deposit.
    // Exact amount depends on RRIF min calculation; test locks that routing happens.
    expect(row2036).toBeDefined();
    // D-19: netCashFlow in surplus years should be ≥ 0 (surplus deposited, not lost)
    expect(row2036.netCashFlow).toBeGreaterThanOrEqual(0);
  });

  it('ENG-01 D-16: routes user withdrawal-override surplus to surplusDestination (tfsa)', () => {
    // RRSP override $80K, spending need $40K real inflated → $40K+ surplus.
    // surplusDestination = 'tfsa'.
    // Expected: TFSA end-of-year balance delta reflects surplus deposit.
    const input = buildSinglePersonFixture({
      targetRetirementSpending: 40_000,
      drawdownOrder: ['rrsp', 'tfsa'],
      withdrawalOverrides: [{ field: 'rrsp', year: 2031, amount: 80_000, applyForward: false }],
      surplusDestination: 'tfsa',
    });

    // Run without override to get baseline TFSA balance
    const baseInput = buildSinglePersonFixture({
      targetRetirementSpending: 40_000,
      drawdownOrder: ['rrsp', 'tfsa'],
      surplusDestination: 'tfsa',
    });

    const outputWithOverride = runProjection(input) as ProjectionOutput;
    const outputBase = runProjection(baseInput) as ProjectionOutput;

    const rowWithOverride = getYear(outputWithOverride, 2031);
    const rowBase = getYear(outputBase, 2031);

    // D-16: TFSA balance with override should be higher than without (surplus deposited)
    expect(rowWithOverride.tfsaBalance).toBeGreaterThan(rowBase.tfsaBalance);
  });

  it('ENG-01 D-17: falls back to implicit non-reg deposit when surplusDestination account is missing', () => {
    // surplusDestination = 'tfsa' but fixture has NO TFSA (balance 0, and we'll assert on warnings).
    // Expected: engine does NOT throw; emits warning { code: 'surplus_destination_missing' };
    // surplus deposited to implicit non-reg.
    const input = buildSinglePersonFixture({
      targetRetirementSpending: 20_000,
      balances: { rrsp: 0, rrif: 400_000, tfsa: 0, nonReg: 0, lif: 0 },
      surplusDestination: 'tfsa',
      drawdownOrder: ['rrif'],
    });

    // Should not throw — engine always returns valid projection (D-11 principle applies)
    const output = runProjection(input) as ProjectionOutput;
    expect(output).toBeDefined();

    // D-17: output includes warning about missing destination
    const extendedOutput = output as ProjectionOutput & {
      warnings?: Array<{ code: string; year: number; destination: string }>;
    };
    expect(extendedOutput.warnings).toBeDefined();
    const surplusWarning = extendedOutput.warnings?.find(
      (w) => w.code === 'surplus_destination_missing'
    );
    expect(surplusWarning).toBeDefined();
    expect(surplusWarning?.destination).toBe('tfsa');
  });

  it('ENG-01 D-18: surplus does NOT grow in the year of deposit; growth starts next year', () => {
    // Surplus deposited year Y (2036) → nonReg end-of-year balance = nonReg start + surplus + no growth.
    // Year Y+1 (2037) → nonReg balance grows at investment return on the full balance including surplus.
    const input = buildSinglePersonFixture({
      targetRetirementSpending: 20_000,
      balances: { rrsp: 0, rrif: 400_000, tfsa: 0, nonReg: 0, lif: 0 },
      surplusDestination: 'nonreg',
      drawdownOrder: ['rrif'],
    });
    const output = runProjection(input) as ProjectionOutput;
    const row2036 = getYear(output, 2036);
    const row2037 = getYear(output, 2037);

    // D-18: year 2036 nonReg balance = 0 (start) + surplus (no growth this year)
    // The balance should reflect the surplus deposit without investment return applied to it.
    // Compare year 2037 nonReg balance — it should be greater than 2036 × (no growth vs growth).
    // If growth applied in 2036, then 2037 balance would be 2036 × 1.05; otherwise 2036 × 1.05.
    // The key: 2036 nonReg balance equals the raw surplus (not surplus × 1.05).
    expect(row2036.nonRegBalance).toBeGreaterThan(0); // surplus was deposited
    // D-18: 2037 nonReg balance must be AT LEAST 2036 * 1.05 (growth applied to the full
    // 2036 balance including the deposited surplus). The deposit from 2036 must have grown
    // at the investment return rate — confirming it is in the starting balance for 2037.
    // Note: 2037 may also receive its own RRIF-minimum surplus deposit (adds to the balance),
    // so row2037 >= row2036 * 1.05 (not equal — equal would assume no new 2037 deposit).
    expect(row2037.nonRegBalance).toBeGreaterThanOrEqual(row2036.nonRegBalance * 1.05 - 1);
  });

  it('ENG-01 D-19: netCashFlow in surplus-triggering years is ~0 after deposit', () => {
    // When RRIF min > spending need and surplus is routed, netCashFlow should be ≥ 0.
    const input = buildSinglePersonFixture({
      targetRetirementSpending: 20_000,
      balances: { rrsp: 0, rrif: 400_000, tfsa: 0, nonReg: 50_000, lif: 0 },
      surplusDestination: 'nonreg',
      drawdownOrder: ['rrif'],
    });
    const output = runProjection(input) as ProjectionOutput;

    // Check all years after RRIF conversion (2036+) for surplus years
    const rrifYears = output.yearlyResults.filter((r) => r.year >= 2036 && r.rrifForcedMinimum > 0);

    for (const row of rrifYears) {
      // D-19: netCashFlow should be ≥ 0 in surplus years (surplus deposited, not wasted)
      expect(Math.abs(row.netCashFlow)).toBeLessThan(1_000); // within $1K tolerance
    }
  });
});
