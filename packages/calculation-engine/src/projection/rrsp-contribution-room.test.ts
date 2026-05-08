/**
 * RRSP Contribution Room Surfacing on PersonYearlyResult
 *
 * Verifies that `rrspContributionRoom` is populated on each year's primary
 * and spouse results using the same value the engine computes internally
 * via calculateRRSPContributionRoom.
 *
 * @see docs/source-of-truth/02-account-types.md — RRSP Contribution Room
 */
import { describe, it, expect } from 'vitest';
import { runCoupleProjection } from './multi-year.js';
import { calculateRRSPContributionRoom } from '../accounts/rrsp.js';
import type { ProjectionInput, SpouseInput } from '@retireops/shared';
import { getCurrentYear } from '@retireops/shared';

function makeCoupleProjectionInput(
  primaryOverrides: Partial<ProjectionInput> = {},
  spouseOverrides: Partial<SpouseInput> = {}
): ProjectionInput {
  const startYear = getCurrentYear();
  const spouse: SpouseInput = {
    birthdate: new Date(startYear - 70, 0, 1),
    retirementAge: 65,
    lifeExpectancy: 85,
    employmentIncome: 0,
    expectedCPPAt65: 6000,
    cppStartAge: 65,
    oasStartAge: 65,
    rrspBalance: 0,
    tfsaBalance: 0,
    ...spouseOverrides,
  };

  return {
    birthdate: new Date(startYear - 70, 0, 1),
    province: 'ON',
    lifeExpectancy: 85,
    retirementAge: 65,
    employmentIncome: 0,
    employmentGrowthRate: 0,
    rrspBalance: 0,
    tfsaBalance: 0,
    nonRegBalance: 0,
    retirementSpending: 40000,
    investmentReturn: 0.04,
    inflationRate: 0.0,
    expectedCPPAt65: 12000,
    cppStartAge: 65,
    oasStartAge: 65,
    maritalStatus: 'married',
    spouse,
    coupleSettings: {
      optimizePensionSplitting: true,
      useYoungerSpouseForRRIF: false,
    },
    ...primaryOverrides,
  };
}

describe('PersonYearlyResult.rrspContributionRoom', () => {
  it('reports CRA RRSP room for a pre-retirement primary earning $100k', () => {
    const startYear = getCurrentYear();
    const input = makeCoupleProjectionInput({
      // Age 50 → pre-retirement at retirementAge 65
      birthdate: new Date(startYear - 50, 0, 1),
      retirementAge: 65,
      employmentIncome: 100000,
      employmentGrowthRate: 0,
    });

    const output = runCoupleProjection(input);
    const year0 = output.yearlyResults[0];
    expect(year0).toBeDefined();

    const expected = calculateRRSPContributionRoom(100000, 0, startYear);
    expect(year0!.primary.rrspContributionRoom).toBe(expected);
  });

  it('reports non-negative room for a retired spouse with $0 employment income', () => {
    const startYear = getCurrentYear();
    const input = makeCoupleProjectionInput(
      {},
      {
        // Spouse is already 70 (past retirementAge 65) with no employment income
        birthdate: new Date(startYear - 70, 0, 1),
        retirementAge: 65,
        employmentIncome: 0,
      }
    );

    const output = runCoupleProjection(input);
    const year0 = output.yearlyResults[0];
    expect(year0).toBeDefined();

    const room = year0!.spouse.rrspContributionRoom;
    expect(room).toBeDefined();
    expect(room!).toBeGreaterThanOrEqual(0);

    const expected = calculateRRSPContributionRoom(0, 0, startYear);
    expect(room).toBe(expected);
  });
});
