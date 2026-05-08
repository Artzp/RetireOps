/**
 * VR-RRSP-PA-001 Worked Example — RRSP Room Accrual Net of Pension Adjustment
 *
 * K012 cent-exact parity test. Every number in the VR-RRSP-PA-001 Worked Example
 * table (docs/source-of-truth/17-contribution-room.md) is asserted here. Numbers
 * were derived from the contribution-room ledger engine output (captured analytically
 * via the K012 force-fail-dump-pin workflow). A test failure means the doc table
 * has drifted from engine output — fix the table, not the engine.
 *
 * Scenario: 30-year couple projection starting 2026.
 *   Primary born 1980, earnedIncome $100k/yr, pensionAdjustment $10k/yr, no contributions.
 *   Spouse born 1982, earnedIncome $80k/yr, no PA.
 *
 * @see docs/source-of-truth/17-contribution-room.md — VR-RRSP-PA-001
 * @see docs/source-of-truth/02-account-types.md — RRSP-002
 */
import { describe, it, expect } from 'vitest';
import { runCoupleProjection } from './multi-year.js';
import type { ProjectionInput, SpouseInput } from '@retireops/shared';

function makeInput(pensionAdjustment: number): ProjectionInput {
  const spouse: SpouseInput = {
    birthdate: new Date(1982, 0, 1),
    retirementAge: 65,
    lifeExpectancy: 85,
    employmentIncome: 80_000,
    employmentGrowthRate: 0,
    expectedCPPAt65: 10_000,
    cppStartAge: 65,
    oasStartAge: 65,
    rrspBalance: 0,
    rrspAnnualContribution: 0,
    tfsaBalance: 0,
    tfsaAnnualContribution: 0,
    nonRegBalance: 0,
  };
  return {
    birthdate: new Date(1980, 0, 1),
    province: 'ON',
    retirementAge: 65,
    lifeExpectancy: 85,
    maritalStatus: 'married',
    employmentIncome: 100_000,
    employmentGrowthRate: 0,
    pensionAdjustment,
    rrspBalance: 0,
    rrspAnnualContribution: 0,
    tfsaBalance: 0,
    tfsaAnnualContribution: 0,
    nonRegBalance: 0,
    retirementSpending: 60_000,
    investmentReturn: 0.04,
    inflationRate: 0,
    expectedCPPAt65: 12_000,
    cppStartAge: 65,
    oasStartAge: 65,
    spouse,
    coupleSettings: {
      optimizePensionSplitting: true,
      useYoungerSpouseForRRIF: false,
    },
  };
}

describe('VR-RRSP-PA-001 — RRSP room accrual net of pension adjustment (M005/S05 T03 PARITY)', () => {
  const withPA = runCoupleProjection(makeInput(10_000));
  const noPA = runCoupleProjection(makeInput(0));

  const yr2026_pa = withPA.yearlyResults.find((r) => r.year === 2026);
  const yr2031_pa = withPA.yearlyResults.find((r) => r.year === 2031);
  const yr2036_pa = withPA.yearlyResults.find((r) => r.year === 2036);
  const yr2041_pa = withPA.yearlyResults.find((r) => r.year === 2041);
  const yr2046_pa = withPA.yearlyResults.find((r) => r.year === 2046);

  const yr2026_nopa = noPA.yearlyResults.find((r) => r.year === 2026);
  const yr2031_nopa = noPA.yearlyResults.find((r) => r.year === 2031);
  const yr2036_nopa = noPA.yearlyResults.find((r) => r.year === 2036);
  const yr2041_nopa = noPA.yearlyResults.find((r) => r.year === 2041);
  const yr2046_nopa = noPA.yearlyResults.find((r) => r.year === 2046);

  it('K014 guard: all five sample years are present in both runs', () => {
    expect(yr2026_pa).toBeDefined();
    expect(yr2031_pa).toBeDefined();
    expect(yr2036_pa).toBeDefined();
    expect(yr2041_pa).toBeDefined();
    expect(yr2046_pa).toBeDefined();
    expect(yr2026_nopa).toBeDefined();
    expect(yr2031_nopa).toBeDefined();
    expect(yr2036_nopa).toBeDefined();
    expect(yr2041_nopa).toBeDefined();
    expect(yr2046_nopa).toBeDefined();
  });

  it('primary rrspContributionRoom with PA=10k matches table (doc table column: with_PA)', () => {
    expect(yr2026_pa!.primary.rrspContributionRoom).toBeCloseTo(8_000, 2);
    expect(yr2031_pa!.primary.rrspContributionRoom).toBeCloseTo(48_000, 2);
    expect(yr2036_pa!.primary.rrspContributionRoom).toBeCloseTo(88_000, 2);
    expect(yr2041_pa!.primary.rrspContributionRoom).toBeCloseTo(128_000, 2);
    expect(yr2046_pa!.primary.rrspContributionRoom).toBeCloseTo(168_000, 2);
  });

  it('primary rrspContributionRoom with no PA matches table (doc table column: no_PA)', () => {
    expect(yr2026_nopa!.primary.rrspContributionRoom).toBeCloseTo(18_000, 2);
    expect(yr2031_nopa!.primary.rrspContributionRoom).toBeCloseTo(108_000, 2);
    expect(yr2036_nopa!.primary.rrspContributionRoom).toBeCloseTo(198_000, 2);
    expect(yr2041_nopa!.primary.rrspContributionRoom).toBeCloseTo(288_000, 2);
    expect(yr2046_nopa!.primary.rrspContributionRoom).toBeCloseTo(378_000, 2);
  });

  it('PA throttle reduces room by exactly $10k/yr vs baseline across all sampled years', () => {
    expect(
      yr2026_nopa!.primary.rrspContributionRoom! - yr2026_pa!.primary.rrspContributionRoom!
    ).toBeCloseTo(10_000, 2);
    expect(
      yr2031_nopa!.primary.rrspContributionRoom! - yr2031_pa!.primary.rrspContributionRoom!
    ).toBeCloseTo(60_000, 2);
    expect(
      yr2036_nopa!.primary.rrspContributionRoom! - yr2036_pa!.primary.rrspContributionRoom!
    ).toBeCloseTo(110_000, 2);
    expect(
      yr2041_nopa!.primary.rrspContributionRoom! - yr2041_pa!.primary.rrspContributionRoom!
    ).toBeCloseTo(160_000, 2);
    expect(
      yr2046_nopa!.primary.rrspContributionRoom! - yr2046_pa!.primary.rrspContributionRoom!
    ).toBeCloseTo(210_000, 2);
  });

  it('spouse rrspContributionRoom is unaffected by primary PA (no leakage)', () => {
    // Spouse accrual: min(80000 × 0.18, 32490) = min(14400, 32490) = 14400/yr
    expect(yr2026_pa!.spouse.rrspContributionRoom).toBeCloseTo(
      yr2026_nopa!.spouse.rrspContributionRoom!,
      2
    );
    expect(yr2046_pa!.spouse.rrspContributionRoom).toBeCloseTo(
      yr2046_nopa!.spouse.rrspContributionRoom!,
      2
    );
  });

  it('no over-contribution penalty or warnings when no RRSP contributions are made', () => {
    const hasPenalty = withPA.yearlyResults.some(
      (r) => r.primary.overContributionPenalty !== undefined
    );
    const hasWarnings = withPA.yearlyResults.some((r) => r.primary.ledgerWarnings !== undefined);
    expect(hasPenalty).toBe(false);
    expect(hasWarnings).toBe(false);
  });
});
