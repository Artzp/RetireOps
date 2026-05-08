/**
 * Contribution-Room Ledger Scenarios (M005/S02)
 *
 * Validates that `runSingleProjectionCore` wires the contribution-room ledger
 * correctly for the RRSP branch: pension-adjustment throttles accrual and
 * over-buffer contributions surface `overContributionPenalty.rrsp` and
 * `ledgerWarnings` on the yearly result.
 *
 * @see docs/source-of-truth/02-account-types.md — RRSP Room, Over-Contribution Penalty
 */
import { describe, it, expect } from 'vitest';
import { runSingleProjection, runCoupleProjection } from './multi-year.js';
import { calculateRRSPContributionRoom } from '../accounts/rrsp.js';
import type { ProjectionInput, SpouseInput } from '@retireops/shared';
import { getCurrentYear } from '@retireops/shared';

function baseInput(overrides: Partial<ProjectionInput> = {}): ProjectionInput {
  const startYear = getCurrentYear();
  return {
    birthdate: new Date(startYear - 40, 0, 1),
    province: 'ON',
    retirementAge: 65,
    lifeExpectancy: 85,
    employmentIncome: 100_000,
    employmentGrowthRate: 0,
    rrspBalance: 0,
    rrspAnnualContribution: 0,
    tfsaBalance: 0,
    tfsaAnnualContribution: 0,
    nonRegBalance: 0,
    retirementSpending: 40_000,
    investmentReturn: 0.04,
    inflationRate: 0,
    expectedCPPAt65: 12_000,
    cppStartAge: 65,
    oasStartAge: 65,
    ...overrides,
  };
}

describe('runSingleProjectionCore × ContributionRoomLedger (M005/S02)', () => {
  it('starts year-0 RRSP room from the unused-room seed', () => {
    const startYear = getCurrentYear();
    const seed = 25_000;
    const fullAccrual = calculateRRSPContributionRoom(100_000, 0, startYear);

    const output = runSingleProjection(
      baseInput({
        rrspUnusedRoomSeed: seed,
      })
    );

    const year0 = output.yearlyResults.find((r) => r.year === startYear);
    expect(year0).toBeDefined();
    expect(year0!.rrspContributionRoom).toBe(seed + fullAccrual);
  });

  it('throttles RRSP room accrual when pensionAdjustment is applied', () => {
    const startYear = getCurrentYear();
    const noPA = runSingleProjection(baseInput({ pensionAdjustment: 0 }));
    const withPA = runSingleProjection(baseInput({ pensionAdjustment: 10_000 }));

    // K014 positive-case guard: ensure both projections produced the target year.
    const noPAYear1 = noPA.yearlyResults.find((r) => r.year === startYear + 1);
    const withPAYear1 = withPA.yearlyResults.find((r) => r.year === startYear + 1);
    expect(noPAYear1).toBeDefined();
    expect(withPAYear1).toBeDefined();

    // Baseline year-1 room: prior-year accrual carried forward + current-year accrual.
    // With PA=10k/yr, each year's accrual is reduced by $10k before being added to carry.
    const fullAccrual = calculateRRSPContributionRoom(100_000, 0, startYear);
    const throttledAccrual = Math.max(0, fullAccrual - 10_000);

    expect(noPAYear1!.rrspContributionRoom).toBe(fullAccrual * 2);
    expect(withPAYear1!.rrspContributionRoom).toBe(throttledAccrual * 2);
    expect(withPAYear1!.rrspContributionRoom!).toBeLessThan(noPAYear1!.rrspContributionRoom!);
  });

  it('surfaces rrsp overContributionPenalty and ledgerWarnings when contribution exceeds room + buffer', () => {
    const startYear = getCurrentYear();
    const fullAccrual = calculateRRSPContributionRoom(100_000, 0, startYear);
    // Contribution = room + $2000 buffer + $5000 overage → penalty = 5000 × 1% × 12 = $600.
    const contribution = fullAccrual + 2_000 + 5_000;

    const output = runSingleProjection(
      baseInput({
        rrspAnnualContribution: contribution,
      })
    );

    const year0 = output.yearlyResults.find((r) => r.year === startYear);
    expect(year0).toBeDefined();

    expect(year0!.rrspContributionRoom).toBe(fullAccrual);
    expect(year0!.overContributionPenalty).toBeDefined();
    expect(year0!.overContributionPenalty!.rrsp).toBeCloseTo(600, 6);
    expect(year0!.overContributionPenalty!.tfsa).toBe(0);
    expect(year0!.overContributionPenalty!.fhsa).toBe(0);

    expect(year0!.ledgerWarnings).toBeDefined();
    expect(year0!.ledgerWarnings!.length).toBeGreaterThan(0);
    expect(year0!.ledgerWarnings![0]!.kind).toBe('over-contribution');
    expect(year0!.ledgerWarnings![0]!.accountType).toBe('rrsp');
    expect(year0!.ledgerWarnings![0]!.person).toBe('primary');
  });

  it('leaves overContributionPenalty and ledgerWarnings unset on baseline projections', () => {
    const output = runSingleProjection(baseInput({ rrspAnnualContribution: 5_000 }));
    const hasPenalty = output.yearlyResults.some((r) => r.overContributionPenalty !== undefined);
    const hasWarnings = output.yearlyResults.some((r) => r.ledgerWarnings !== undefined);
    expect(hasPenalty).toBe(false);
    expect(hasWarnings).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Couple-path scenarios (M005/S02 T03)
// ---------------------------------------------------------------------------

function coupleInput(
  overrides: Partial<ProjectionInput> = {},
  spouseOverrides: Partial<SpouseInput> = {}
): ProjectionInput {
  const startYear = getCurrentYear();
  const spouse: SpouseInput = {
    birthdate: new Date(startYear - 40, 0, 1),
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
    birthdate: new Date(startYear - 40, 0, 1),
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
    ...overrides,
  };
}

describe('runCoupleProjectionCore × ContributionRoomLedger (M005/S02)', () => {
  it('seeds primary and spouse RRSP room independently at year 0', () => {
    const startYear = getCurrentYear();
    const primarySeed = 30_000;
    const spouseSeed = 12_000;
    const primaryAccrual = calculateRRSPContributionRoom(100_000, 0, startYear);
    const spouseAccrual = calculateRRSPContributionRoom(80_000, 0, startYear);

    const output = runCoupleProjection(
      coupleInput({ rrspUnusedRoomSeed: primarySeed }, { rrspUnusedRoomSeed: spouseSeed })
    );

    const year0 = output.yearlyResults.find((r) => r.year === startYear);
    expect(year0).toBeDefined();
    expect(year0!.primary.rrspContributionRoom).toBe(primarySeed + primaryAccrual);
    expect(year0!.spouse.rrspContributionRoom).toBe(spouseSeed + spouseAccrual);
  });

  it('throttles primary RRSP room with primary PA; spouse unaffected', () => {
    const startYear = getCurrentYear();
    const noPA = runCoupleProjection(coupleInput());
    const withPA = runCoupleProjection(coupleInput({ pensionAdjustment: 10_000 }));

    const noPAYear1 = noPA.yearlyResults.find((r) => r.year === startYear + 1);
    const withPAYear1 = withPA.yearlyResults.find((r) => r.year === startYear + 1);
    expect(noPAYear1).toBeDefined();
    expect(withPAYear1).toBeDefined();

    const primaryFullAccrual = calculateRRSPContributionRoom(100_000, 0, startYear);
    const primaryThrottledAccrual = Math.max(0, primaryFullAccrual - 10_000);
    const spouseFullAccrual = calculateRRSPContributionRoom(80_000, 0, startYear);

    expect(noPAYear1!.primary.rrspContributionRoom).toBe(primaryFullAccrual * 2);
    expect(withPAYear1!.primary.rrspContributionRoom).toBe(primaryThrottledAccrual * 2);
    expect(withPAYear1!.primary.rrspContributionRoom!).toBeLessThan(
      noPAYear1!.primary.rrspContributionRoom!
    );
    // Spouse's room must be identical across the two runs — primary PA must not leak.
    expect(withPAYear1!.spouse.rrspContributionRoom).toBe(noPAYear1!.spouse.rrspContributionRoom);
    expect(withPAYear1!.spouse.rrspContributionRoom).toBe(spouseFullAccrual * 2);
  });

  it('spousal contribution: charges primary room, grows spouse RRSP, appends spousalRrspLedger', () => {
    const startYear = getCurrentYear();
    const spousalContribution = 10_000;
    const personalContribution = 5_000;
    const shortHorizon = 45; // person is age 40; projects 5 years

    const baseline = runCoupleProjection(
      coupleInput(
        {
          rrspAnnualContribution: personalContribution,
          lifeExpectancy: shortHorizon,
        },
        { lifeExpectancy: shortHorizon }
      )
    );

    // Pre-seed an empty ledger so we can read mutations after the projection.
    const sharedLedger: import('@retireops/shared').SpousalRRSPLedger = [];
    const withSpousalInput = coupleInput(
      {
        rrspAnnualContribution: personalContribution + spousalContribution,
        spousalRrspContribution: spousalContribution,
        lifeExpectancy: shortHorizon,
      },
      { lifeExpectancy: shortHorizon, spousalRrspLedger: sharedLedger }
    );
    const withSpousal = runCoupleProjection(withSpousalInput);

    // Primary's room next year (year+1) must drop by the full combined total
    // vs. the baseline (which only spent `personalContribution`).
    const baselineYr1 = baseline.yearlyResults.find((r) => r.year === startYear + 1);
    const withSpousalYr1 = withSpousal.yearlyResults.find((r) => r.year === startYear + 1);
    expect(baselineYr1).toBeDefined();
    expect(withSpousalYr1).toBeDefined();
    const delta =
      baselineYr1!.primary.rrspContributionRoom! - withSpousalYr1!.primary.rrspContributionRoom!;
    expect(delta).toBeCloseTo(spousalContribution, 6);

    // Spouse's room must be identical in both runs — spousal deposit does not
    // touch spouse's own room.
    expect(withSpousalYr1!.spouse.rrspContributionRoom).toBe(
      baselineYr1!.spouse.rrspContributionRoom
    );

    // Spouse's RRSP balance must be strictly larger in the spousal-contribution run.
    const finalBaselineSpouseRRSP =
      baseline.yearlyResults[baseline.yearlyResults.length - 1]!.spouse.rrspBalance;
    const finalWithSpousalSpouseRRSP =
      withSpousal.yearlyResults[withSpousal.yearlyResults.length - 1]!.spouse.rrspBalance;
    expect(finalWithSpousalSpouseRRSP).toBeGreaterThan(finalBaselineSpouseRRSP);

    // K014 guard: ledger must have entries before asserting shape.
    expect(sharedLedger.length).toBeGreaterThan(0);
    // Each contributing year appends one entry; remediation re-runs (if the
    // projection goes red) may add more, so assert lower bound + shape.
    expect(sharedLedger.length).toBeGreaterThanOrEqual(withSpousal.yearlyResults.length);
    for (const entry of sharedLedger) {
      expect(entry.amount).toBeCloseTo(spousalContribution, 6);
      expect(entry.annuitant).toBe('spouse');
      expect(entry.contributor).toBe('primary');
    }
  });

  it('surfaces primary RRSP penalty when combined contribution exceeds room + buffer; spouse result unaffected', () => {
    const startYear = getCurrentYear();
    const primaryFullAccrual = calculateRRSPContributionRoom(100_000, 0, startYear);
    const contribution = primaryFullAccrual + 2_000 + 5_000;

    const output = runCoupleProjection(coupleInput({ rrspAnnualContribution: contribution }));

    const year0 = output.yearlyResults.find((r) => r.year === startYear);
    expect(year0).toBeDefined();
    expect(year0!.primary.overContributionPenalty).toBeDefined();
    expect(year0!.primary.overContributionPenalty!.rrsp).toBeCloseTo(600, 6);
    expect(year0!.primary.ledgerWarnings).toBeDefined();
    expect(year0!.primary.ledgerWarnings!.length).toBeGreaterThan(0);
    expect(year0!.primary.ledgerWarnings![0]!.accountType).toBe('rrsp');
    expect(year0!.primary.ledgerWarnings![0]!.person).toBe('primary');

    expect(year0!.spouse.overContributionPenalty).toBeUndefined();
    expect(year0!.spouse.ledgerWarnings).toBeUndefined();
  });

  it('single-person baseline regression: rrspContributionRoom matches calculateRRSPContributionRoom', () => {
    const output = runSingleProjection(baseInput({ rrspAnnualContribution: 0 }));
    expect(output.yearlyResults.length).toBeGreaterThan(0);

    let carry = 0;
    const earned = 100_000;
    for (const r of output.yearlyResults) {
      const expectedRoom = calculateRRSPContributionRoom(earned, carry, r.year);
      expect(r.rrspContributionRoom).toBeCloseTo(expectedRoom, 6);
      // No contributions, no PA → all room carries forward.
      carry = expectedRoom;
    }
  });
});
