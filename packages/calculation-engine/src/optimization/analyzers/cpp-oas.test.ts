/**
 * CPP/OAS Timing Analyzer Tests
 *
 * @see docs/TESTABLE-SURFACES.md — TC-OPT-CPP-001, TC-OPT-CPP-002, TC-OPT-CPP-003
 * @see REQUIREMENTS.md — CPP-01, CPP-02, CPP-03
 */
import { describe, it, expect } from 'vitest';
import { analyzeCPPOAS } from './cpp-oas.js';
import type { OptimizationInput } from '../types.js';
import type { CoupleYearlyResult, ProjectionOutput, YearlyResult } from '@retireops/shared';
import type { TaxCalculation } from '@retireops/shared';

// ---------------------------------------------------------------------------
// Test fixture helpers
// ---------------------------------------------------------------------------

function makeTaxCalc(oasClawback = 0): TaxCalculation {
  return {
    federalTaxGross: 0,
    federalCredits: 0,
    federalTaxNet: 0,
    provincialTaxGross: 0,
    provincialCredits: 0,
    provincialTaxNet: 0,
    totalTax: 0,
    effectiveRate: 0,
    netIncome: 0,
    oasClawback,
    ageCredit: 0,
    pensionCredit: 0,
  };
}

function makeYear(year: number, age: number, oasClawback = 0, oasIncome = 0): YearlyResult {
  return {
    year,
    age,
    employmentIncome: 0,
    pensionIncome: 0,
    cppIncome: 0,
    oasIncome,
    rrifWithdrawal: 0,
    tfsaWithdrawal: 0,
    nonRegWithdrawal: 0,
    totalIncome: oasIncome,
    livingExpenses: 50000,
    taxesPaid: 0,
    netCashFlow: 0,
    rrspBalance: 0,
    rrifBalance: 0,
    tfsaBalance: 0,
    nonRegBalance: 0,
    totalNetWorth: 0,
    taxCalculation: makeTaxCalc(oasClawback),
    rrifForcedMinimum: 0,
    rrifMinimumRate: 0,
    rrifConversionYear: false,
    isRetired: age >= 65,
    isRRIFConversionYear: false,
  };
}

/**
 * Create a minimal OptimizationInput for a single-person projection.
 * birthdate 1960-01-01, ON province, retirementAge 65, lifeExpectancy 90,
 * expectedCPPAt65 12000, yearsOfResidence 40.
 */
function makeSingleInput(
  overrides: {
    lifeExpectancy?: number;
    expectedCPPAt65?: number;
    yearsOfResidence?: number;
    yearlyResults?: YearlyResult[];
  } = {}
): OptimizationInput {
  const birthdate = new Date('1960-01-01');
  const lifeExpectancy = overrides.lifeExpectancy ?? 90;
  const expectedCPPAt65 = overrides.expectedCPPAt65 ?? 12000;
  const yearsOfResidence = overrides.yearsOfResidence ?? 40;

  // Build yearly results: age 65-90 retired years (no clawback by default)
  const yearlyResults: YearlyResult[] =
    overrides.yearlyResults ??
    Array.from({ length: lifeExpectancy - 65 + 1 }, (_, i) => {
      const age = 65 + i;
      return makeYear(1960 + age, age);
    });

  const baselineOutput = {
    id: 'test-single',
    input: {} as OptimizationInput['clonedInput'],
    yearlyResults,
    projectionRows: undefined,
    legacyTargetMet: null,
    summary: {} as ProjectionOutput['summary'],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as ProjectionOutput;

  const clonedInput = {
    birthdate,
    province: 'ON' as const,
    retirementAge: 65,
    lifeExpectancy,
    maritalStatus: 'single' as const,
    employmentIncome: 0,
    employmentGrowthRate: 0,
    rrspBalance: 0,
    rrspAnnualContribution: 0,
    tfsaBalance: 0,
    tfsaAnnualContribution: 0,
    nonRegBalance: 0,
    retirementSpending: 50000,
    investmentReturn: 0.05,
    inflationRate: 0.02,
    expectedCPPAt65,
    cppStartAge: 65,
    oasStartAge: 65,
    yearsOfResidence,
    spouse: undefined,
  };

  return { baselineOutput, clonedInput };
}

/**
 * Create a couple OptimizationInput.
 * Primary: birthdate 1960-01-01, expectedCPPAt65 12000
 * Spouse: birthdate 1962-01-01, expectedCPPAt65 8000
 */
function makeCoupleInput(): OptimizationInput {
  const base = makeSingleInput();
  const spouseBirthdate = new Date('1962-01-01');

  const clonedInput = {
    ...base.clonedInput,
    maritalStatus: 'married' as const,
    spouse: {
      birthdate: spouseBirthdate,
      province: 'ON' as const,
      retirementAge: 65,
      lifeExpectancy: 88,
      employmentIncome: 0,
      employmentGrowthRate: 0,
      expectedCPPAt65: 8000,
      cppStartAge: 65 as number | undefined,
      oasStartAge: 65 as number | undefined,
      yearsOfResidence: 40 as number | undefined,
      rrspBalance: 0,
      tfsaBalance: 0,
      pensionIncome: undefined,
    },
  };

  return { baselineOutput: base.baselineOutput, clonedInput };
}

/**
 * Create high-income single input where OAS clawback is triggered.
 */
function makeHighIncomeInput(): OptimizationInput {
  // Build years where OAS is received (age 65+) and clawback is present
  const yearlyResults: YearlyResult[] = Array.from({ length: 26 }, (_, i) => {
    const age = 65 + i;
    const year = 2025 + i;
    // Clawback of $3000/year in OAS-receiving years
    return makeYear(year, age, 3000, 8128);
  });

  return makeSingleInput({ yearlyResults });
}

// ---------------------------------------------------------------------------
// TC-OPT-CPP-001: Breakeven ages for 60-vs-65 and 65-vs-70
// ---------------------------------------------------------------------------

describe('TC-OPT-CPP-001: CPP breakeven age calculations', () => {
  it('single person with lifeExpectancy=90: explanation includes breakeven ages for 60-vs-65 and 65-vs-70', () => {
    /**
     * @see docs/TESTABLE-SURFACES.md — TC-OPT-CPP-001
     */
    const input = makeSingleInput({ lifeExpectancy: 90, expectedCPPAt65: 12000 });
    const cards = analyzeCPPOAS(input);

    expect(cards).toHaveLength(1);
    const card = cards[0];
    expect(card).toBeDefined();
    if (!card) return;

    expect(card.module).toBe('cpp-timing');
    expect(card.title).toBe('CPP/OAS Timing');
    // Both breakeven ages should be within life expectancy 90, so both appear
    expect(card.explanation).toMatch(/breaks even at age/i);
    expect(card.recommendedAction).toMatch(/CPP/);
    expect(card.whyItHelps).toMatch(/inflation-indexed benefits/);
    expect(card.affectedYears?.[0]).toBe(2025);
    expect(card.appliesTo).toBe('primary');
    expect(card.confidence).toBe('MEDIUM');
    expect(Number.isInteger(card.estimatedDollarImpact)).toBe(true);

    // Regression guard (CPP timing units bug): the lifetime impact is an
    // INCREMENTAL gain from shifting the CPP start age — it can never exceed
    // total lifetime CPP itself. A mis-scaled early-start factor (the 60-month
    // early window read as 60 *years*: `60 * 12 * 0.006`) once inflated this
    // ~7x, surfacing a ludicrous ">$900k lifetime impact" in the Optimizations
    // tab. Bound it to the lifetime-CPP ceiling.
    const lifetimeCPPCeiling = 12000 * (90 - 65); // expectedCPPAt65 × retirement years
    expect(card.estimatedDollarImpact).toBeGreaterThan(0);
    expect(card.estimatedDollarImpact).toBeLessThan(lifetimeCPPCeiling);
  });

  it('TC-OPT-CPP-001 life expectancy 72: 65-vs-70 deferral recommendation suppressed', () => {
    /**
     * @see docs/TESTABLE-SURFACES.md — TC-OPT-CPP-001
     * CPP 65-vs-70 breakeven is ~74 which exceeds lifeExpectancy=72, so it should be suppressed.
     */
    const input = makeSingleInput({ lifeExpectancy: 72, expectedCPPAt65: 12000 });
    const cards = analyzeCPPOAS(input);

    expect(cards).toHaveLength(1);
    const card = cards[0];
    expect(card).toBeDefined();
    if (!card) return;

    // The 65-vs-70 deferral text should NOT appear
    expect(card.explanation).not.toMatch(/deferring to 70/i);
  });
});

// ---------------------------------------------------------------------------
// TC-OPT-CPP-002: OAS clawback risk detection
// ---------------------------------------------------------------------------

describe('TC-OPT-CPP-002: OAS clawback risk detection', () => {
  it('high-income person with OAS clawback: explanation includes clawback warning with estimated amount', () => {
    /**
     * @see docs/TESTABLE-SURFACES.md — TC-OPT-CPP-002
     */
    const input = makeHighIncomeInput();
    const cards = analyzeCPPOAS(input);

    expect(cards).toHaveLength(1);
    const card = cards[0];
    expect(card).toBeDefined();
    if (!card) return;

    expect(card.explanation).toMatch(/clawback/i);
    expect(card.explanation).toMatch(/\$3,000/);
    // Impact should reflect the clawback cost (negative or combined)
  });

  it('low-income person (no clawback): explanation does NOT include clawback warning', () => {
    /**
     * @see docs/TESTABLE-SURFACES.md — TC-OPT-CPP-002
     */
    const input = makeSingleInput(); // no clawback in default yearly results
    const cards = analyzeCPPOAS(input);

    const card = cards[0];
    expect(card).toBeDefined();
    if (!card) return;

    expect(card.explanation).not.toMatch(/clawback/i);
  });
});

// ---------------------------------------------------------------------------
// TC-OPT-CPP-003: Couple returns 2 separate InsightCards; single returns 1
// ---------------------------------------------------------------------------

describe('TC-OPT-CPP-003: Couple produces separate InsightCards per person', () => {
  it('couple projection returns 2 InsightCards, each with module=cpp-timing', () => {
    /**
     * @see docs/TESTABLE-SURFACES.md — TC-OPT-CPP-003
     */
    const input = makeCoupleInput();
    const cards = analyzeCPPOAS(input);

    expect(cards).toHaveLength(2);
    for (const card of cards) {
      expect(card.module).toBe('cpp-timing');
    }
    // Titles should identify each person separately
    const [primary, spouse] = cards;
    expect(primary).toBeDefined();
    expect(spouse).toBeDefined();
    if (!primary || !spouse) return;
    expect(primary.title).toMatch(/primary|you/i);
    expect(spouse.title).toMatch(/spouse/i);
  });

  it('couple projection uses spouse-specific OAS clawback rows', () => {
    const input = makeCoupleInput();
    input.coupleYearlyResults = [
      {
        year: 2027,
        primary: {
          ...makeYear(2027, 67, 0, 8128),
          owner: 'primary',
          totalGrossIncome: 8128,
          oasClawback: 0,
        },
        spouse: {
          ...makeYear(2027, 65, 2500, 8128),
          owner: 'spouse',
          totalGrossIncome: 8128,
          oasClawback: 2500,
        },
        householdGrossIncome: 16256,
        householdNetIncome: 13756,
        householdTaxesPaid: 2500,
        householdLivingExpenses: 0,
        householdNetCashFlow: 0,
        householdNetWorth: 0,
        pensionSplitPercentage: 0,
        pensionSplitTaxSavings: 0,
        bothRetired: true,
        eitherRRIFConversion: false,
      } as unknown as CoupleYearlyResult,
    ];

    const cards = analyzeCPPOAS(input);
    const spouseCard = cards.find((card) => card.title.includes('Spouse'));

    expect(spouseCard?.explanation).toMatch(/clawback/i);
    expect(spouseCard?.explanation).toContain('$2,500');
  });

  it('single projection returns exactly 1-element array', () => {
    /**
     * @see docs/TESTABLE-SURFACES.md — TC-OPT-CPP-003
     */
    const input = makeSingleInput();
    const cards = analyzeCPPOAS(input);
    expect(cards).toHaveLength(1);
  });
});
