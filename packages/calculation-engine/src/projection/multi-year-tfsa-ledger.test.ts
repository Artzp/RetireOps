/**
 * Multi-Year Couple Projection × TFSA Ledger Wiring (M005/S03 T02)
 *
 * Validates that `runCoupleProjectionCore` seeds the per-person TFSA ledger
 * with a residency-sliced cumulative-room baseline, feeds tfsaContribution
 * and residencyStartYear into applyContributionRoomYear on each loop
 * iteration, and surfaces tfsaContributionRoom + zero-buffer TFSA penalty /
 * ledgerWarnings on PersonYearlyResult.
 *
 * @see docs/source-of-truth/02-account-types.md — VR-TFSA-RESIDENCY-001, VR-ROOM-PENALTY-001
 */
import { describe, it, expect } from 'vitest';
import { runCoupleProjection } from './multi-year.js';
import type { ProjectionInput, SpouseInput } from '@retireops/shared';
import { TFSA_ANNUAL_LIMITS, getCurrentYear } from '@retireops/shared';

function sumTfsaLimits(fromYear: number, toYearInclusive: number): number {
  let total = 0;
  for (let y = fromYear; y <= toYearInclusive; y++) {
    total += TFSA_ANNUAL_LIMITS[y] ?? 0;
  }
  return total;
}

function coupleInput(
  overrides: Partial<ProjectionInput> = {},
  spouseOverrides: Partial<SpouseInput> = {}
): ProjectionInput {
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
    ...spouseOverrides,
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
    spouse,
    coupleSettings: {
      optimizePensionSplitting: true,
      useYoungerSpouseForRRIF: false,
    },
    // Cap the horizon so the projection stays inside the extended TFSA schedule
    // (2009–2045) and keeps the test fast.
    ...overrides,
  };
}

describe('runCoupleProjectionCore × TFSA ContributionRoomLedger (M005/S03)', () => {
  it('seeds residency-sliced TFSA baseline and surfaces tfsaContributionRoom for year 0 (primary born 1997, residencyStartYear=2021)', () => {
    const startYear = getCurrentYear();
    const output = runCoupleProjection(
      coupleInput({
        residencyStartYear: 2021,
        // Short horizon so we only care about the first year's ledger seeding.
        lifeExpectancy: 30,
      })
    );

    const year0 = output.yearlyResults.find((r) => r.year === startYear);
    expect(year0).toBeDefined();

    // Baseline: sum of TFSA_ANNUAL_LIMITS for 2021..startYear-1 (residency slice).
    // Year-0 tfsaContributionRoom = baseline + current-year accrual − contribution (0).
    const baseline = sumTfsaLimits(2021, startYear - 1);
    const currentYearLimit = TFSA_ANNUAL_LIMITS[startYear] ?? 0;
    const expectedRoom = baseline + currentYearLimit;

    expect(year0!.primary.tfsaContributionRoom).toBe(expectedRoom);
  });

  it('surfaces $120 TFSA over-contribution penalty and a ledgerWarnings entry when primary contributes $1k over available room', () => {
    const startYear = getCurrentYear();
    const baseline = sumTfsaLimits(2021, startYear - 1);
    const currentYearLimit = TFSA_ANNUAL_LIMITS[startYear] ?? 0;
    const availableRoom = baseline + currentYearLimit;
    const overBy = 1_000;

    const output = runCoupleProjection(
      coupleInput({
        residencyStartYear: 2021,
        tfsaAnnualContribution: availableRoom + overBy,
        // Raise TFSA balance so the projection can actually source the
        // contribution; the ledger math is independent of balance but we
        // keep the scenario internally coherent.
        tfsaBalance: availableRoom + overBy,
        lifeExpectancy: 30,
      })
    );

    const year0 = output.yearlyResults.find((r) => r.year === startYear);
    expect(year0).toBeDefined();

    expect(year0!.primary.overContributionPenalty).toBeDefined();
    expect(year0!.primary.overContributionPenalty!.tfsa).toBeCloseTo(120, 6);
    expect(year0!.primary.overContributionPenalty!.rrsp).toBe(0);
    expect(year0!.primary.overContributionPenalty!.fhsa).toBe(0);

    expect(year0!.primary.ledgerWarnings).toBeDefined();
    const tfsaWarning = year0!.primary.ledgerWarnings!.find(
      (w) => w.accountType === 'tfsa' && w.kind === 'over-contribution'
    );
    expect(tfsaWarning).toBeDefined();
    expect(tfsaWarning!.person).toBe('primary');
    expect(tfsaWarning!.penaltyAmount).toBeCloseTo(120, 6);
  });

  it('leaves overContributionPenalty undefined on non-over cases (MEM001/K002 conditional spread)', () => {
    const output = runCoupleProjection(
      coupleInput({
        residencyStartYear: 2021,
        tfsaAnnualContribution: 0,
        lifeExpectancy: 30,
      })
    );

    const hasPenalty = output.yearlyResults.some(
      (r) => r.primary.overContributionPenalty !== undefined
    );
    expect(hasPenalty).toBe(false);

    const hasWarnings = output.yearlyResults.some((r) => r.primary.ledgerWarnings !== undefined);
    expect(hasWarnings).toBe(false);
  });
});
