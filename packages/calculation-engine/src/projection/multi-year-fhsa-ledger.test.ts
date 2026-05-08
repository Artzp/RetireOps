/**
 * Multi-Year Couple Projection × FHSA Ledger Wiring (M005/S04 T02)
 *
 * Validates that `runCoupleProjectionCore` seeds the per-person FHSA ledger
 * from `fhsaLifetimeContributedSeed`, feeds `fhsaAnnualContribution` into
 * applyContributionRoomYear on each loop iteration, surfaces
 * `fhsaContributionRoom` on PersonYearlyResult, and that over-contribution /
 * lifetime-cap warning-kind precedence (MEM002) survives the K006 merge.
 *
 * @see docs/source-of-truth/02-account-types.md — VR-FHSA-CARRY-001
 */
import { describe, it, expect } from 'vitest';
import { runCoupleProjection } from './multi-year.js';
import type { ProjectionInput, SpouseInput } from '@retireops/shared';
import { getCurrentYear } from '@retireops/shared';

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
    ...overrides,
  };
}

describe('runCoupleProjectionCore × FHSA ContributionRoomLedger (M005/S04)', () => {
  /**
   * Scenario (a) — steady-state absorb: primary contributes $8k/yr for 2 years.
   * Annual limit = $8k, carry starts at 0. Each year fully absorbs against
   * annual room with no penalty and no warnings.
   * @see VR-FHSA-CARRY-001
   */
  it('absorbs steady-state $8k/yr primary FHSA contribution with no penalty over a 2-year horizon', () => {
    const startYear = getCurrentYear();
    const output = runCoupleProjection(
      coupleInput({
        fhsaAnnualContribution: 8_000,
        lifeExpectancy: startYear - 1997 + 2, // cap horizon to ~2 years
      })
    );

    const year0 = output.yearlyResults.find((r) => r.year === startYear);
    const year1 = output.yearlyResults.find((r) => r.year === startYear + 1);
    expect(year0).toBeDefined();
    expect(year1).toBeDefined();

    // Full annual absorb → annualRoomRemaining after contribution = 0 on both years.
    expect(year0!.primary.fhsaContributionRoom).toBe(0);
    expect(year1!.primary.fhsaContributionRoom).toBe(0);

    // No over-contribution penalty, no warnings.
    expect(year0!.primary.overContributionPenalty).toBeUndefined();
    expect(year1!.primary.overContributionPenalty).toBeUndefined();
    expect(year0!.primary.ledgerWarnings).toBeUndefined();
    expect(year1!.primary.ledgerWarnings).toBeUndefined();

    // Spouse did not contribute — room stays at the full annual limit.
    expect(year0!.spouse.fhsaContributionRoom).toBe(8_000);
  });

  /**
   * Scenario (b) — over-contribution by $1: $8,001 against $8k single-year
   * effective room with seed=0 triggers a $0.12 penalty and an
   * 'over-contribution' (not 'lifetime-cap-exceeded') warning kind.
   * @see VR-FHSA-CARRY-001, MEM002
   */
  it('surfaces $0.12 over-contribution penalty on primary FHSA when contribution exceeds single-year cap by $1', () => {
    const startYear = getCurrentYear();
    const output = runCoupleProjection(
      coupleInput({
        fhsaAnnualContribution: 8_001,
        fhsaLifetimeContributedSeed: 0,
        lifeExpectancy: startYear - 1997 + 1, // 1-year horizon
      })
    );

    const year0 = output.yearlyResults.find((r) => r.year === startYear);
    expect(year0).toBeDefined();

    expect(year0!.primary.overContributionPenalty).toBeDefined();
    expect(year0!.primary.overContributionPenalty!.fhsa).toBeCloseTo(0.12, 6);
    expect(year0!.primary.overContributionPenalty!.rrsp).toBe(0);
    expect(year0!.primary.overContributionPenalty!.tfsa).toBe(0);

    expect(year0!.primary.ledgerWarnings).toBeDefined();
    const fhsaWarning = year0!.primary.ledgerWarnings!.find((w) => w.accountType === 'fhsa');
    expect(fhsaWarning).toBeDefined();
    expect(fhsaWarning!.kind).toBe('over-contribution');
    expect(fhsaWarning!.person).toBe('primary');
    expect(fhsaWarning!.penaltyAmount).toBeCloseTo(0.12, 6);
  });

  /**
   * Scenario (c) — lifetime cap precedence: seed=$36k + $8k contribution
   * means effective room = min($8k, $4k lifetime remaining) = $4k, over-amount
   * = $4k, penalty = $480, and the warning kind must be 'lifetime-cap-exceeded'
   * (MEM002: lifetime-cap-exceeded takes precedence over over-contribution).
   * @see VR-FHSA-CARRY-001, MEM002
   */
  it('surfaces $480 lifetime-cap-exceeded penalty on primary FHSA when seeded $36k + $8k pushes past the $40k lifetime limit', () => {
    const startYear = getCurrentYear();
    const output = runCoupleProjection(
      coupleInput({
        fhsaAnnualContribution: 8_000,
        fhsaLifetimeContributedSeed: 36_000,
        lifeExpectancy: startYear - 1997 + 1, // 1-year horizon
      })
    );

    const year0 = output.yearlyResults.find((r) => r.year === startYear);
    expect(year0).toBeDefined();

    expect(year0!.primary.overContributionPenalty).toBeDefined();
    expect(year0!.primary.overContributionPenalty!.fhsa).toBeCloseTo(480, 6);

    expect(year0!.primary.ledgerWarnings).toBeDefined();
    const fhsaWarning = year0!.primary.ledgerWarnings!.find((w) => w.accountType === 'fhsa');
    expect(fhsaWarning).toBeDefined();
    expect(fhsaWarning!.kind).toBe('lifetime-cap-exceeded');
    expect(fhsaWarning!.penaltyAmount).toBeCloseTo(480, 6);
  });
});
