/**
 * Isolation tests for getEligiblePensionIncomeForSplitting.
 *
 * Covers the documented CRA branches: under-65 (RPP only) and 65+
 * (RRIF + LIF + RPP). Province-agnostic — the helper never reads province.
 *
 * @see docs/source-of-truth/07-withdrawal-strategies.md — Pension Income Splitting Integration
 */
import { describe, it, expect } from 'vitest';
import type { PersonYearlyResult } from '@retireops/shared';
import { getEligiblePensionIncomeForSplitting } from './pension-splitting-eligibility.js';

/**
 * Build a PersonYearlyResult populated only with the fields the helper reads.
 * Other fields are filled with safe zero/empty defaults so the partial cast is sound.
 */
function makePerson(overrides: {
  pensionIncome?: number;
  rrifWithdrawal?: number;
  lifWithdrawal?: number;
}): PersonYearlyResult {
  return {
    pensionIncome: overrides.pensionIncome ?? 0,
    rrifWithdrawal: overrides.rrifWithdrawal ?? 0,
    lifWithdrawal: overrides.lifWithdrawal,
  } as unknown as PersonYearlyResult;
}

describe('getEligiblePensionIncomeForSplitting', () => {
  it('under 65: RRIF and LIF only → 0 (RRIF/LIF not splittable before 65)', () => {
    const person = makePerson({
      rrifWithdrawal: 20_000,
      lifWithdrawal: 5_000,
      pensionIncome: 0,
    });
    expect(getEligiblePensionIncomeForSplitting(person, 60)).toBe(0);
  });

  it('under 65: RPP/annuity only → full pensionIncome (RPP life annuity always eligible)', () => {
    const person = makePerson({
      rrifWithdrawal: 0,
      lifWithdrawal: 0,
      pensionIncome: 30_000,
    });
    expect(getEligiblePensionIncomeForSplitting(person, 60)).toBe(30_000);
  });

  it('age 70: RRIF + LIF + pension → exact sum', () => {
    const person = makePerson({
      rrifWithdrawal: 20_000,
      lifWithdrawal: 5_000,
      pensionIncome: 15_000,
    });
    expect(getEligiblePensionIncomeForSplitting(person, 70)).toBe(40_000);
  });

  it('age 70: all zeros → 0', () => {
    const person = makePerson({
      rrifWithdrawal: 0,
      lifWithdrawal: 0,
      pensionIncome: 0,
    });
    expect(getEligiblePensionIncomeForSplitting(person, 70)).toBe(0);
  });

  it('age 65 boundary: 65+ branch activates, RRIF becomes eligible', () => {
    const person = makePerson({
      rrifWithdrawal: 10_000,
      lifWithdrawal: 0,
      pensionIncome: 0,
    });
    expect(getEligiblePensionIncomeForSplitting(person, 65)).toBe(10_000);
  });

  it('age 65 with undefined lifWithdrawal: treats LIF as 0 (no NaN)', () => {
    const person = makePerson({
      rrifWithdrawal: 12_000,
      pensionIncome: 8_000,
      // lifWithdrawal omitted → undefined
    });
    expect(getEligiblePensionIncomeForSplitting(person, 65)).toBe(20_000);
  });

  it('under 65 with undefined lifWithdrawal: still returns pensionIncome only', () => {
    const person = makePerson({
      rrifWithdrawal: 50_000,
      pensionIncome: 7_500,
      // lifWithdrawal omitted → undefined
    });
    expect(getEligiblePensionIncomeForSplitting(person, 64)).toBe(7_500);
  });
});
