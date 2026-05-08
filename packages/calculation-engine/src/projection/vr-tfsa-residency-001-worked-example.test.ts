/**
 * VR-TFSA-RESIDENCY-001 Worked Example — Residency-Sliced TFSA Cumulative Baseline
 *
 * K012 cent-exact parity test. Every number in the VR-TFSA-RESIDENCY-001 Worked Example
 * table (docs/source-of-truth/17-contribution-room.md) is asserted here. Numbers were
 * derived from the TFSA ledger engine output. A test failure means the doc table has
 * drifted from engine output — fix the table, not the engine.
 *
 * Scenario: couple projection. Primary born 1997, residencyStartYear 2021.
 * Projection starts in 2026. tfsaAnnualContribution = 0.
 *
 * Baseline calculation (engine-derived):
 *   sum(TFSA_ANNUAL_LIMITS, 2021..2025) = 6000+6000+6500+7000+7000 = 32500
 *   year-2026 accrual = 7000
 *   tfsaContributionRoom for year 2026 = 32500 + 7000 = 39500
 *
 * @see docs/source-of-truth/17-contribution-room.md — VR-TFSA-RESIDENCY-001
 * @see docs/source-of-truth/02-account-types.md — TFSA cumulative room
 */
import { describe, it, expect } from 'vitest';
import { runCoupleProjection } from './multi-year.js';
import type { ProjectionInput, SpouseInput } from '@retireops/shared';

function makeInput(): ProjectionInput {
  const spouse: SpouseInput = {
    birthdate: new Date(1997, 0, 1),
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
    birthdate: new Date(1997, 0, 1),
    province: 'ON',
    retirementAge: 65,
    lifeExpectancy: 85,
    maritalStatus: 'married',
    employmentIncome: 100_000,
    employmentGrowthRate: 0,
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
    residencyStartYear: 2021,
    spouse,
    coupleSettings: {
      optimizePensionSplitting: true,
      useYoungerSpouseForRRIF: false,
    },
  };
}

describe('VR-TFSA-RESIDENCY-001 — residency-sliced TFSA cumulative baseline (M005/S05 T03 PARITY)', () => {
  const output = runCoupleProjection(makeInput());
  const year2026 = output.yearlyResults.find((r) => r.year === 2026);

  it('K014 guard: year 2026 result is present', () => {
    expect(year2026).toBeDefined();
  });

  it('primary tfsaContributionRoom for year 2026 equals 39500.00 (doc table row: year=2026)', () => {
    // Residency baseline: sum 2021..2025 = 32500; year-2026 accrual = 7000; total = 39500.
    expect(year2026!.primary.tfsaContributionRoom).toBeCloseTo(39_500, 2);
  });

  it('no TFSA penalty or warnings when contribution is zero', () => {
    const hasPenalty = output.yearlyResults.some(
      (r) => r.primary.overContributionPenalty !== undefined
    );
    const hasWarnings = output.yearlyResults.some((r) => r.primary.ledgerWarnings !== undefined);
    expect(hasPenalty).toBe(false);
    expect(hasWarnings).toBe(false);
  });

  it('full-lifetime spouse (no residencyStartYear) has higher TFSA room than residency-sliced primary', () => {
    // Spouse born 1997 with no residencyStartYear → full room from age 18 (2015).
    // sum(2015..2025) = 10000+5500+5500+5500+6000+6000+6000+6000+6500+7000+7000 = 71000; +7000 for 2026 = 78000.
    expect(year2026!.spouse.tfsaContributionRoom).toBeGreaterThan(
      year2026!.primary.tfsaContributionRoom!
    );
  });
});
