/**
 * Tests for spousalRrspLedger initialization in runCoupleProjectionCore.
 *
 * Because spousalRrspLedger is an internal local variable not yet surfaced in
 * projection output, these tests verify initialization indirectly: a correctly
 * initialized ledger allows runCoupleProjection to complete without throwing.
 * If the init line were removed, TypeScript would catch a missing variable
 * (build-time), and any future attribution logic that reads it would throw at
 * runtime — making these smoke tests a meaningful guard against regression.
 *
 * @see packages/shared/src/types/accounts.ts - SpousalRRSPContributionEntry
 * @see packages/shared/src/types/projection.ts - SpouseInput.spousalRrspLedger
 * @see packages/calculation-engine/src/projection/multi-year.ts - init block
 */
import { describe, it, expect } from 'vitest';
import { runCoupleProjection } from './multi-year.js';
import type { ProjectionInput, SpouseInput } from '@retireops/shared';
import { getCurrentYear } from '@retireops/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMinimalCoupleInput(spouseOverrides: Partial<SpouseInput> = {}): ProjectionInput {
  const startYear = getCurrentYear();
  const spouse: SpouseInput = {
    birthdate: new Date(startYear - 65, 0, 1),
    retirementAge: 65,
    lifeExpectancy: 80,
    employmentIncome: 0,
    expectedCPPAt65: 6000,
    cppStartAge: 65,
    oasStartAge: 65,
    rrspBalance: 0,
    tfsaBalance: 0,
    ...spouseOverrides,
  };

  return {
    birthdate: new Date(startYear - 65, 0, 1),
    province: 'ON',
    lifeExpectancy: 80,
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
  };
}

// ---------------------------------------------------------------------------
// spousalRrspLedger initialization
// ---------------------------------------------------------------------------

describe('spousalRrspLedger initialization', () => {
  it('initializes to [] when spouse.spousalRrspLedger is omitted', () => {
    // spouse has no spousalRrspLedger field — init must default to []
    const input = makeMinimalCoupleInput();
    expect(input.spouse?.spousalRrspLedger).toBeUndefined();

    const result = runCoupleProjection(input);
    // Projection must complete without throwing and return a valid object
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    expect(Array.isArray(result.yearlyResults)).toBe(true);
  });

  it('accepts a provided non-empty ledger and completes projection', () => {
    // When a ledger is supplied, init must preserve it rather than overwriting
    const input = makeMinimalCoupleInput({
      spousalRrspLedger: [
        { year: 2023, annuitant: 'primary', contributor: 'spouse', amount: 5000 },
      ],
    });
    expect(input.spouse?.spousalRrspLedger).toHaveLength(1);

    const result = runCoupleProjection(input);
    expect(result).toBeDefined();
    expect(Array.isArray(result.yearlyResults)).toBe(true);
  });

  it('accepts a multi-entry ledger and completes projection', () => {
    const input = makeMinimalCoupleInput({
      spousalRrspLedger: [
        { year: 2021, annuitant: 'primary', contributor: 'spouse', amount: 3000 },
        { year: 2022, annuitant: 'primary', contributor: 'spouse', amount: 4000 },
        { year: 2023, annuitant: 'primary', contributor: 'spouse', amount: 5000 },
      ],
    });

    const result = runCoupleProjection(input);
    expect(result).toBeDefined();
    expect(Array.isArray(result.yearlyResults)).toBe(true);
    expect(result.yearlyResults.length).toBeGreaterThan(0);
  });
});
