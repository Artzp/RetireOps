/**
 * Multi-Year Single Projection × FHSA Ledger Surface
 *
 * Validates that runSingleProjection seeds and advances the FHSA
 * ContributionRoomLedger and SURFACES the full ledger output on
 * YearlyResult, mirroring the couple-path behavior:
 *   - fhsaContributionRoom on every row (annual room remaining)
 *   - overContributionPenalty.fhsa on rows that over-contribute
 *   - ledgerWarnings entries with accountType='fhsa' on rows that over-contribute
 *
 * Closes the v4.4 deferral gap where single users silently lost FHSA
 * over-contribution warnings (RRSP-only filter at the helper). The single
 * and couple paths now diverge only in result-row type, not in which
 * diagnostics they surface.
 *
 * @see docs/source-of-truth/02-account-types.md — VR-FHSA-CARRY-001, VR-ROOM-PENALTY-001
 */
import { describe, it, expect } from 'vitest';
import { runSingleProjection } from './multi-year.js';
import type { ProjectionInput } from '@retireops/shared';
import { getCurrentYear } from '@retireops/shared';

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

describe('runSingleProjection × FHSA ContributionRoomLedger surface', () => {
  it('surfaces fhsaContributionRoom on every YearlyResult row when fhsaAnnualContribution is provided', () => {
    const output = runSingleProjection(
      singleInput({
        fhsaAnnualContribution: 8_000,
        fhsaLifetimeContributedSeed: 0,
      })
    );

    for (const row of output.yearlyResults) {
      expect(row.fhsaContributionRoom).toBeDefined();
      expect(row.fhsaContributionRoom).toBeGreaterThanOrEqual(0);
    }
  });

  it('absorbs steady-state $8k/yr FHSA contribution with no penalty and no warnings', () => {
    const output = runSingleProjection(
      singleInput({
        fhsaAnnualContribution: 8_000,
        fhsaLifetimeContributedSeed: 0,
        // Cap horizon so the test stays fast.
        lifeExpectancy: 32,
      })
    );

    const hasPenalty = output.yearlyResults.some((r) => r.overContributionPenalty !== undefined);
    expect(hasPenalty).toBe(false);

    const fhsaWarnings = output.yearlyResults.flatMap((r) =>
      (r.ledgerWarnings ?? []).filter((w) => w.accountType === 'fhsa')
    );
    expect(fhsaWarnings).toEqual([]);
  });

  it('surfaces $0.12 FHSA over-contribution penalty + warning when contribution exceeds single-year cap by $1', () => {
    const startYear = getCurrentYear();
    const output = runSingleProjection(
      singleInput({
        fhsaAnnualContribution: 8_001,
        fhsaLifetimeContributedSeed: 0,
        // Cap horizon to 1 year so we only assert on the over-contribution year.
        lifeExpectancy: startYear - 1997 + 1,
      })
    );

    const year0 = output.yearlyResults.find((r) => r.year === startYear);
    expect(year0).toBeDefined();

    expect(year0!.overContributionPenalty).toBeDefined();
    expect(year0!.overContributionPenalty!.fhsa).toBeCloseTo(0.12, 6);
    expect(year0!.overContributionPenalty!.rrsp).toBe(0);
    expect(year0!.overContributionPenalty!.tfsa).toBe(0);

    expect(year0!.ledgerWarnings).toBeDefined();
    const fhsaWarning = year0!.ledgerWarnings!.find((w) => w.accountType === 'fhsa');
    expect(fhsaWarning).toBeDefined();
    expect(fhsaWarning!.kind).toBe('over-contribution');
    expect(fhsaWarning!.person).toBe('primary');
    expect(fhsaWarning!.penaltyAmount).toBeCloseTo(0.12, 6);
  });
});
