/**
 * Unit tests for applyScenarioDecisions
 * @see .planning/phases/17-schema-assembler-foundation/17-CONTEXT.md - D-07, D-08
 * @see .planning/phases/25-scenario-decision-engine-wiring/25-CONTEXT.md - D-01, D-02
 */
import { describe, it, expect } from 'vitest';
import { applyScenarioDecisions } from './scenario-decisions.js';
import type { FrontendInputData } from './projection-transformer.js';
import type { ScenarioDecisions } from '@retireops/shared';

const BASE_SINGLE: FrontendInputData = {
  personalInfo: {
    dateOfBirth: '1965-01-01',
    province: 'ON',
    retirementAge: 65,
    lifeExpectancy: 90,
  },
  accounts: [{ type: 'RRSP', balance: 300000 }],
  incomeSources: [{ type: 'employment', annualAmount: 80000 }],
  governmentBenefits: { cppStartAge: 65, oasStartAge: 65 },
  expenses: { currentAnnualExpenses: 60000, retirementAnnualExpenses: 50000 },
};

const BASE_COUPLE: FrontendInputData = {
  ...BASE_SINGLE,
  spouse: {
    dateOfBirth: '1968-05-15',
    retirementAge: 63,
    lifeExpectancy: 92,
    cppStartAge: 65,
    oasStartAge: 65,
  },
};

/** Base with accounts that carry id fields for UUID→type translation tests (SAV-01, D-02) */
function makeBaseWithIds(): FrontendInputData {
  return {
    personalInfo: {
      dateOfBirth: '1965-01-01',
      province: 'ON',
      retirementAge: 65,
      lifeExpectancy: 90,
    },
    accounts: [
      { id: 'uuid-rrsp', type: 'RRSP', balance: 100000, annualContribution: 10000 },
      { id: 'uuid-tfsa', type: 'TFSA', balance: 50000, annualContribution: 6000 },
      { id: 'uuid-nonreg', type: 'NonRegistered', balance: 25000, annualContribution: 0 },
    ] as unknown as FrontendInputData['accounts'],
    incomeSources: [],
    governmentBenefits: { cppStartAge: 65, oasStartAge: 65 },
    expenses: { currentAnnualExpenses: 60000, retirementAnnualExpenses: 50000 },
  } as unknown as FrontendInputData;
}

// ---------------------------------------------------------------------------
// Existing v1.3 wiring tests (preserved)
// ---------------------------------------------------------------------------

describe('applyScenarioDecisions — v1.3 wiring (preserved)', () => {
  it('empty decisions returns clone equal to base', () => {
    const result = applyScenarioDecisions(BASE_SINGLE, {});
    expect(result).toEqual(BASE_SINGLE);
    expect(result).not.toBe(BASE_SINGLE);
  });

  it('does not mutate the original base', () => {
    const result = applyScenarioDecisions(BASE_SINGLE, { retirementAge: 60 });
    expect(BASE_SINGLE.personalInfo.retirementAge).toBe(65);
    expect(result.personalInfo.retirementAge).toBe(60);
  });

  it('applies retirementAge to personalInfo', () => {
    const result = applyScenarioDecisions(BASE_SINGLE, { retirementAge: 62 });
    expect(result.personalInfo.retirementAge).toBe(62);
  });

  it('applies lifeExpectancy to personalInfo', () => {
    const result = applyScenarioDecisions(BASE_SINGLE, { lifeExpectancy: 97 });
    expect(result.personalInfo.lifeExpectancy).toBe(97);
  });

  it('applies cppStartAge to governmentBenefits', () => {
    const result = applyScenarioDecisions(BASE_SINGLE, { cppStartAge: 60 });
    expect(result.governmentBenefits.cppStartAge).toBe(60);
  });

  it('applies oasStartAge to governmentBenefits', () => {
    const result = applyScenarioDecisions(BASE_SINGLE, { oasStartAge: 67 });
    expect(result.governmentBenefits.oasStartAge).toBe(67);
  });

  it('applies CPP estimate and OAS residency overrides', () => {
    const result = applyScenarioDecisions(BASE_SINGLE, {
      expectedCPPAt65: 14000,
      yearsOfResidence: 32,
    });
    expect(result.governmentBenefits.estimatedCppAmount).toBe(14000);
    expect(result.governmentBenefits.yearsOfResidence).toBe(32);
  });

  it('applies spouse decisions in couple case', () => {
    const result = applyScenarioDecisions(BASE_COUPLE, {
      spouseRetirementAge: 60,
      spouseLifeExpectancy: 99,
      spouseCppStartAge: 62,
      spouseOasStartAge: 67,
      spouseExpectedCPPAt65: 9000,
      spouseYearsOfResidence: 28,
    });
    expect(result.spouse?.retirementAge).toBe(60);
    expect(result.spouse?.lifeExpectancy).toBe(99);
    expect(result.spouse?.cppStartAge).toBe(62);
    expect(result.spouse?.oasStartAge).toBe(67);
    expect(result.spouse?.expectedCppAt65).toBe(9000);
    expect(result.spouse?.yearsOfResidence).toBe(28);
  });

  it('applies targetRetirementSpending to expenses', () => {
    const result = applyScenarioDecisions(BASE_SINGLE, {
      targetRetirementSpending: 40000,
    });
    expect(result.expenses.retirementAnnualExpenses).toBe(40000);
    // Single person: no coupleSettings wiring
    expect(result.coupleSettings).toBeUndefined();
  });

  it('couple: targetRetirementSpending also updates coupleSettings.sharedRetirementSpending', () => {
    const baseCouple = {
      ...BASE_SINGLE,
      spouse: { dateOfBirth: '1982-01-01' },
      coupleSettings: { sharedRetirementSpending: 80000 },
    } as typeof BASE_SINGLE;
    const result = applyScenarioDecisions(baseCouple, {
      targetRetirementSpending: 50000,
    });
    expect(result.expenses.retirementAnnualExpenses).toBe(50000);
    expect(result.coupleSettings?.sharedRetirementSpending).toBe(50000);
  });

  it('applies multiple decisions simultaneously', () => {
    const result = applyScenarioDecisions(BASE_SINGLE, {
      retirementAge: 60,
      cppStartAge: 62,
      targetRetirementSpending: 45000,
    });
    expect(result.personalInfo.retirementAge).toBe(60);
    expect(result.governmentBenefits.cppStartAge).toBe(62);
    expect(result.expenses.retirementAnnualExpenses).toBe(45000);
  });

  it('skips spouse decisions safely when base has no spouse', () => {
    const result = applyScenarioDecisions(BASE_SINGLE, {
      spouseRetirementAge: 60,
      spouseCppStartAge: 62,
    });
    expect(result.spouse).toBeUndefined();
    expect(result.personalInfo.retirementAge).toBe(65); // untouched
  });

  it('ignores dbPensionStartAge (stored-only stub)', () => {
    const result = applyScenarioDecisions(BASE_SINGLE, { dbPensionStartAge: 60 });
    expect(result).toEqual(BASE_SINGLE);
  });

  it('ignores propertySaleDecisions (stored-only stub)', () => {
    const result = applyScenarioDecisions(BASE_SINGLE, {
      propertySaleDecisions: [{ propertyId: 'p1', saleYear: 2028, sellingCostsPercent: 0.05 }],
    });
    expect(result).toEqual(BASE_SINGLE);
  });
});

// ---------------------------------------------------------------------------
// Phase 25 strategy wiring tests (new)
// ---------------------------------------------------------------------------

describe('applyScenarioDecisions — strategy wiring (Phase 25)', () => {
  it('drawdownOrder passes through as a copy (TAX-01)', () => {
    const order = ['nonReg', 'rrif', 'rrsp', 'tfsa'];
    const result = applyScenarioDecisions(BASE_SINGLE, {
      drawdownOrder: order,
    } as ScenarioDecisions);
    expect(result.drawdownOrder).toEqual(order);
    expect(result.drawdownOrder).not.toBe(order); // copy, not reference
  });

  it('rrspMeltdown passes through (TAX-02)', () => {
    const decisions = {
      rrspMeltdown: { enabled: true, annualAmount: 20000, startYear: 2030, endYear: 2035 },
    } as ScenarioDecisions;
    const result = applyScenarioDecisions(BASE_SINGLE, decisions);
    expect(result.rrspMeltdown).toEqual(decisions.rrspMeltdown);
  });

  it('incomeSplitting passes through (TAX-03)', () => {
    const result = applyScenarioDecisions(BASE_SINGLE, {
      incomeSplitting: { enabled: true, splitPercent: 0.5 },
    } as ScenarioDecisions);
    expect(result.incomeSplitting).toEqual({ enabled: true, splitPercent: 0.5 });
  });

  it('oasClawbackAvoidance passes through (TAX-04)', () => {
    const result = applyScenarioDecisions(BASE_SINGLE, {
      oasClawbackAvoidance: { enabled: true, incomeThreshold: 90000 },
    } as ScenarioDecisions);
    expect(result.oasClawbackAvoidance).toEqual({ enabled: true, incomeThreshold: 90000 });
  });

  it('inflationRate override sets result.inflationRate (SPD-02)', () => {
    const result = applyScenarioDecisions(BASE_SINGLE, {
      inflationRate: 0.03,
    } as ScenarioDecisions);
    expect(result.inflationRate).toBe(0.03);
  });

  it('investmentReturn override sets scenario-level assumptions', () => {
    const result = applyScenarioDecisions(BASE_SINGLE, {
      investmentReturn: 0.055,
    } as ScenarioDecisions);
    expect(result.investmentReturn).toBe(0.055);
    expect(result.assumptions?.investmentReturnRate).toBe(5.5);
  });

  it('ageBandReductions passes through (SPD-03)', () => {
    const bands = [
      { fromAge: 75, reductionPercent: 0.1 },
      { fromAge: 85, reductionPercent: 0.2 },
    ];
    const result = applyScenarioDecisions(BASE_SINGLE, {
      ageBandReductions: bands,
    } as ScenarioDecisions);
    expect(result.ageBandReductions).toEqual(bands);
  });

  it('legacyTarget passes through (SPD-04)', () => {
    const result = applyScenarioDecisions(BASE_SINGLE, {
      legacyTarget: 500000,
    } as ScenarioDecisions);
    expect(result.legacyTarget).toBe(500000);
  });

  it('contributionOverrides translates accountId UUID to accountType (SAV-01, D-02)', () => {
    const base = makeBaseWithIds();
    const result = applyScenarioDecisions(base, {
      contributionOverrides: [
        { accountId: 'uuid-rrsp', annualAmount: 15000, startYear: 2026, endYear: 2030 },
        { accountId: 'uuid-tfsa', annualAmount: 7000, startYear: 2026, endYear: 2030 },
      ],
    } as ScenarioDecisions);
    expect(result.contributionOverrides).toEqual([
      { accountType: 'rrsp', annualAmount: 15000, startYear: 2026, endYear: 2030 },
      { accountType: 'tfsa', annualAmount: 7000, startYear: 2026, endYear: 2030 },
    ]);
  });

  it('contributionOverrides accepts direct accountType targets from planning UX', () => {
    const result = applyScenarioDecisions(BASE_SINGLE, {
      contributionOverrides: [
        { accountType: 'rrsp', annualAmount: 15000, startYear: 2026, endYear: 2030 },
        { accountType: 'tfsa', annualAmount: 7000, startYear: 2026, endYear: 2030 },
      ],
    } as ScenarioDecisions);
    expect(result.contributionOverrides).toEqual([
      { accountType: 'rrsp', annualAmount: 15000, startYear: 2026, endYear: 2030 },
      { accountType: 'tfsa', annualAmount: 7000, startYear: 2026, endYear: 2030 },
    ]);
  });

  it('contributionOverrides silently drops unknown accountId (D-02)', () => {
    const base = makeBaseWithIds();
    const result = applyScenarioDecisions(base, {
      contributionOverrides: [
        { accountId: 'does-not-exist', annualAmount: 1000, startYear: 2026, endYear: 2030 },
      ],
    } as ScenarioDecisions);
    expect(result.contributionOverrides).toBeUndefined();
  });

  it('contributionOverrides silently drops non-rrsp/tfsa account types (D-02)', () => {
    const base = makeBaseWithIds();
    const result = applyScenarioDecisions(base, {
      contributionOverrides: [
        { accountId: 'uuid-nonreg', annualAmount: 5000, startYear: 2026, endYear: 2030 },
      ],
    } as ScenarioDecisions);
    expect(result.contributionOverrides).toBeUndefined();
  });

  it('empty decisions leaves all new fields undefined', () => {
    const result = applyScenarioDecisions(BASE_SINGLE, {} as ScenarioDecisions);
    expect(result.drawdownOrder).toBeUndefined();
    expect(result.rrspMeltdown).toBeUndefined();
    expect(result.incomeSplitting).toBeUndefined();
    expect(result.oasClawbackAvoidance).toBeUndefined();
    expect(result.contributionOverrides).toBeUndefined();
    expect(result.ageBandReductions).toBeUndefined();
    expect(result.legacyTarget).toBeUndefined();
  });

  it('preserves existing v1.3 wiring (retirementAge, targetRetirementSpending)', () => {
    const result = applyScenarioDecisions(BASE_SINGLE, {
      retirementAge: 62,
      targetRetirementSpending: 55000,
    } as ScenarioDecisions);
    expect(result.personalInfo.retirementAge).toBe(62);
    expect(result.expenses.retirementAnnualExpenses).toBe(55000);
  });
});

// ---------------------------------------------------------------------------
// Phase 1 override pass-through tests (new)
// @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-01, D-02, D-15
// ---------------------------------------------------------------------------

describe('applyScenarioDecisions — Phase 1 override pass-through', () => {
  it('passes withdrawalOverrides through unchanged (D-01, D-02)', () => {
    const overrides = [{ field: 'rrsp' as const, year: 2031, amount: 50000, applyForward: true }];
    const result = applyScenarioDecisions(BASE_SINGLE, {
      withdrawalOverrides: overrides,
    } as ScenarioDecisions);
    expect(result).toHaveProperty('withdrawalOverrides');
    expect(result.withdrawalOverrides).toEqual(overrides);
  });

  it('passes spendingOverrides through unchanged', () => {
    const result = applyScenarioDecisions(BASE_SINGLE, {
      spendingOverrides: [{ year: 2035, amount: 80000, applyForward: true }],
    } as ScenarioDecisions);
    expect(result.spendingOverrides).toEqual([{ year: 2035, amount: 80000, applyForward: true }]);
  });

  it('passes surplusDestination through unchanged (D-15, Assumption A1)', () => {
    const result = applyScenarioDecisions(BASE_SINGLE, {
      surplusDestination: 'nonreg',
    } as ScenarioDecisions);
    expect(result.surplusDestination).toBe('nonreg');
  });

  it('omits the three override fields when decisions has none set (additive invariant, criterion #5)', () => {
    const result = applyScenarioDecisions(BASE_SINGLE, {} as ScenarioDecisions);
    expect(result.withdrawalOverrides).toBeUndefined();
    expect(result.spendingOverrides).toBeUndefined();
    expect(result.surplusDestination).toBeUndefined();
  });

  it('does not mutate the base input (structuredClone invariant)', () => {
    const base: FrontendInputData = structuredClone(BASE_SINGLE);
    const snapshot = structuredClone(base);
    applyScenarioDecisions(base, {
      withdrawalOverrides: [
        { field: 'rrsp' as const, year: 2031, amount: 50000, applyForward: true },
      ],
    } as ScenarioDecisions);
    expect(base).toEqual(snapshot);
  });

  it('passes all three fields together without interference', () => {
    const withdrawalOverrides = [
      { field: 'tfsa' as const, year: 2030, amount: 20000, applyForward: false },
    ];
    const spendingOverrides = [{ year: 2032, amount: 60000, applyForward: true }];
    const result = applyScenarioDecisions(BASE_SINGLE, {
      withdrawalOverrides,
      spendingOverrides,
      surplusDestination: 'tfsa',
    } as ScenarioDecisions);
    expect(result.withdrawalOverrides).toEqual(withdrawalOverrides);
    expect(result.spendingOverrides).toEqual(spendingOverrides);
    expect(result.surplusDestination).toBe('tfsa');
  });

  it('withdrawal override reference is the same object (no deep clone of arrays — pass-through)', () => {
    const overrides = [{ field: 'rrif' as const, year: 2040, amount: 30000, applyForward: false }];
    const result = applyScenarioDecisions(BASE_SINGLE, {
      withdrawalOverrides: overrides,
    } as ScenarioDecisions);
    // Pass-through assigns the array reference from decisions (not a deep clone)
    expect(result.withdrawalOverrides).toBe(overrides);
  });

  it('surplusDestination supports all five account-type literals (D-15)', () => {
    const destinations = ['rrsp', 'rrif', 'lif', 'tfsa', 'nonreg'] as const;
    for (const dest of destinations) {
      const result = applyScenarioDecisions(BASE_SINGLE, {
        surplusDestination: dest,
      } as ScenarioDecisions);
      expect(result.surplusDestination).toBe(dest);
    }
  });
});
