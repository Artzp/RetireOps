/**
 * Multi-Year Single Projection × TFSA Ledger Surface
 *
 * Validates that runSingleProjection seeds and advances the residency-sliced
 * TFSA ContributionRoomLedger and SURFACES the full ledger output on
 * YearlyResult, mirroring the couple-path behavior:
 *   - tfsaContributionRoom on every row (cumulative ledger)
 *   - overContributionPenalty.tfsa on rows that over-contribute
 *   - ledgerWarnings entries with accountType='tfsa' on rows that over-contribute
 *
 * Closes the v4.4 deferral gap where single users silently lost TFSA
 * over-contribution warnings (RRSP-only filter at the helper). The single
 * and couple paths now diverge only in result-row type, not in which
 * diagnostics they surface.
 *
 * @see docs/source-of-truth/02-account-types.md — VR-TFSA-RESIDENCY-001, VR-ROOM-PENALTY-001
 */
import { describe, it, expect } from 'vitest';
import { runSingleProjection } from './multi-year.js';
import type { ProjectionInput } from '@retireops/shared';
import { TFSA_ANNUAL_LIMITS, getCurrentYear } from '@retireops/shared';

function singleInput(overrides: Partial<ProjectionInput> = {}): ProjectionInput {
  return {
    birthdate: new Date(1997, 0, 1),
    province: 'ON',
    retirementAge: 65,
    lifeExpectancy: 70,
    employmentIncome: 80_000,
    employmentGrowthRate: 0,
    rrspBalance: 0,
    rrspAnnualContribution: 0,
    tfsaBalance: 0,
    tfsaAnnualContribution: 0,
    nonRegBalance: 0,
    retirementSpending: 50_000,
    investmentReturn: 0.04,
    inflationRate: 0,
    expectedCPPAt65: 12_000,
    cppStartAge: 65,
    oasStartAge: 65,
    ...overrides,
  };
}

function sumTfsaLimits(fromYear: number, toYearInclusive: number): number {
  let total = 0;
  for (let y = fromYear; y <= toYearInclusive; y++) {
    total += TFSA_ANNUAL_LIMITS[y] ?? 0;
  }
  return total;
}

describe('runSingleProjection × TFSA ContributionRoomLedger surface', () => {
  it('runs without throwing when residencyStartYear is provided and tfsaAnnualContribution=0', () => {
    expect(() =>
      runSingleProjection(
        singleInput({
          residencyStartYear: 2021,
          tfsaAnnualContribution: 0,
        })
      )
    ).not.toThrow();
  });

  it('surfaces tfsaContributionRoom on every YearlyResult row using the residency-sliced cumulative baseline', () => {
    const startYear = getCurrentYear();
    const output = runSingleProjection(
      singleInput({
        residencyStartYear: 2021,
        tfsaAnnualContribution: 0,
      })
    );

    const year0 = output.yearlyResults.find((r) => r.year === startYear);
    expect(year0).toBeDefined();

    const baseline = sumTfsaLimits(2021, startYear - 1);
    const currentYearLimit = TFSA_ANNUAL_LIMITS[startYear] ?? 0;
    const expectedRoom = baseline + currentYearLimit;

    expect(year0!.tfsaContributionRoom).toBe(expectedRoom);

    for (const row of output.yearlyResults) {
      expect(row.tfsaContributionRoom).toBeDefined();
      expect(row.tfsaContributionRoom).toBeGreaterThanOrEqual(0);
    }
  });

  it('surfaces $120 TFSA over-contribution penalty + ledgerWarnings entry when contribution exceeds available room by $1k', () => {
    const startYear = getCurrentYear();
    const baseline = sumTfsaLimits(2021, startYear - 1);
    const currentYearLimit = TFSA_ANNUAL_LIMITS[startYear] ?? 0;
    const availableRoom = baseline + currentYearLimit;
    const overBy = 1_000;

    const output = runSingleProjection(
      singleInput({
        residencyStartYear: 2021,
        tfsaAnnualContribution: availableRoom + overBy,
        // Seed the TFSA balance so the projection can source the contribution;
        // ledger penalty math is independent of balance.
        tfsaBalance: availableRoom + overBy,
      })
    );

    const year0 = output.yearlyResults.find((r) => r.year === startYear);
    expect(year0).toBeDefined();

    expect(year0!.overContributionPenalty).toBeDefined();
    expect(year0!.overContributionPenalty!.tfsa).toBeCloseTo(120, 6);
    expect(year0!.overContributionPenalty!.rrsp).toBe(0);
    expect(year0!.overContributionPenalty!.fhsa).toBe(0);

    expect(year0!.ledgerWarnings).toBeDefined();
    const tfsaWarning = year0!.ledgerWarnings!.find(
      (w) => w.accountType === 'tfsa' && w.kind === 'over-contribution'
    );
    expect(tfsaWarning).toBeDefined();
    expect(tfsaWarning!.person).toBe('primary');
    expect(tfsaWarning!.penaltyAmount).toBeCloseTo(120, 6);
  });

  it('leaves overContributionPenalty + ledgerWarnings undefined when no over-contribution occurs', () => {
    const output = runSingleProjection(
      singleInput({
        residencyStartYear: 2021,
        tfsaAnnualContribution: 0,
      })
    );

    const hasPenalty = output.yearlyResults.some((r) => r.overContributionPenalty !== undefined);
    expect(hasPenalty).toBe(false);

    const hasWarnings = output.yearlyResults.some((r) => r.ledgerWarnings !== undefined);
    expect(hasWarnings).toBe(false);
  });
});
