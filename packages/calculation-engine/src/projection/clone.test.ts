/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it, expect } from 'vitest';
import { cloneProjectionInput } from './clone.js';
import type { ProjectionInput } from '@retireops/shared';

/**
 * @see docs/TESTABLE-SURFACES.md — TC-OPT-CLONE-001
 * @see STATE.md — OPT-3: shallow spread corrupts shared state
 */
describe('cloneProjectionInput', () => {
  const makeInput = (): ProjectionInput => ({
    birthdate: new Date('1965-06-15'),
    province: 'ON' as const,
    retirementAge: 65,
    lifeExpectancy: 90,
    rrspBalance: 500000,
    rrspAnnualContribution: 10000,
    tfsaBalance: 80000,
    tfsaAnnualContribution: 6500,
    nonRegBalance: 100000,
    retirementSpending: 60000,
    investmentReturn: 0.05,
    inflationRate: 0.02,
    employmentIncome: 100000,
    employmentGrowthRate: 0.02,
    spouse: {
      birthdate: new Date('1967-03-20'),
      retirementAge: 65,
      lifeExpectancy: 92,
      employmentIncome: 60000,
      expectedCPPAt65: 8000,
      rrspBalance: 200000,
      rrspAnnualContribution: 5000,
      tfsaBalance: 50000,
      tfsaAnnualContribution: 6500,
      nonRegBalance: 30000,
    },
    coupleSettings: {
      optimizePensionSplitting: true,
      useYoungerSpouseForRRIF: true,
    },
    rrspMeltdown: {
      enabled: true,
      annualAmount: 20000,
      startYear: 2030,
      endYear: 2036,
    },
    ageBandReductions: [
      { fromAge: 75, reductionPercent: 10 },
      { fromAge: 85, reductionPercent: 20 },
    ],
  });

  it('produces a deeply equal clone', () => {
    const original = makeInput();
    const cloned = cloneProjectionInput(original);
    expect(cloned).toEqual(original);
  });

  it('does not mutate source when rrspMeltdown.annualAmount is changed', () => {
    const original = makeInput();
    const cloned = cloneProjectionInput(original);
    cloned.rrspMeltdown!.annualAmount = 99999;
    expect(original.rrspMeltdown!.annualAmount).toBe(20000);
  });

  it('does not mutate source when spouse.birthdate is changed', () => {
    const original = makeInput();
    const originalSpouseBirthdate = original.spouse!.birthdate.getTime();
    const cloned = cloneProjectionInput(original);
    cloned.spouse!.birthdate = new Date('2000-01-01');
    expect(original.spouse!.birthdate.getTime()).toBe(originalSpouseBirthdate);
  });

  it('preserves birthdate as a Date instance', () => {
    const original = makeInput();
    const cloned = cloneProjectionInput(original);
    expect(cloned.birthdate).toBeInstanceOf(Date);
    expect(cloned.birthdate.getFullYear()).toBe(1965);
  });

  it('preserves spouse.birthdate as a Date instance', () => {
    const original = makeInput();
    const cloned = cloneProjectionInput(original);
    expect(cloned.spouse!.birthdate).toBeInstanceOf(Date);
    expect(cloned.spouse!.birthdate.getFullYear()).toBe(1967);
  });

  it('does not mutate source when ageBandReductions array item is changed', () => {
    const original = makeInput();
    const cloned = cloneProjectionInput(original);
    cloned.ageBandReductions![0]!.fromAge = 999;
    expect(original.ageBandReductions![0]!.fromAge).toBe(75);
  });

  it('clones input with no optional fields without error', () => {
    const minimal: ProjectionInput = {
      birthdate: new Date('1970-01-01'),
      province: 'BC' as const,
      retirementAge: 65,
      lifeExpectancy: 90,
      rrspBalance: 0,
      rrspAnnualContribution: 0,
      tfsaBalance: 0,
      tfsaAnnualContribution: 0,
      nonRegBalance: 0,
      retirementSpending: 40000,
      investmentReturn: 0.04,
      inflationRate: 0.02,
      employmentIncome: 50000,
      employmentGrowthRate: 0.01,
    };
    const cloned = cloneProjectionInput(minimal);
    expect(cloned).toEqual(minimal);
    expect(cloned.spouse).toBeUndefined();
    expect(cloned.rrspMeltdown).toBeUndefined();
  });
});
