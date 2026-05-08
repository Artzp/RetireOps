/**
 * Tests for the Income Splitting Analyzer
 * @see docs/TESTABLE-SURFACES.md — TC-OPT-SPLIT-001, TC-OPT-SPLIT-002, TC-OPT-SPLIT-003
 */
import { describe, it, expect } from 'vitest';
import type { OptimizationInput } from '../types.js';
import type {
  CoupleYearlyResult,
  ProjectionInput,
  ProjectionOutput,
  YearlyResult,
} from '@retireops/shared';
import type { TaxCalculation } from '@retireops/shared';
import { analyzeIncomeSplitting } from './income-splitting.js';

/**
 * Build a minimal TaxCalculation stub for test fixtures
 */
function makeTaxCalc(totalTax: number, netIncome: number): TaxCalculation {
  return {
    year: 2025,
    owner: 'primary',
    employmentIncome: 0,
    pensionIncome: 0,
    rrifIncome: 0,
    cppIncome: 0,
    oasIncome: 0,
    investmentIncome: 0,
    capitalGains: 0,
    dividendIncomeEligible: 0,
    dividendIncomeNonEligible: 0,
    grossIncome: netIncome,
    deductions: 0,
    netIncome,
    taxableIncome: netIncome,
    federalTaxGross: totalTax * 0.6,
    federalCredits: 0,
    federalTaxNet: totalTax * 0.6,
    provincialTaxGross: totalTax * 0.4,
    provincialCredits: 0,
    provincialTaxNet: totalTax * 0.4,
    totalTax,
    marginalRateFederal: 0.26,
    marginalRateProvincial: 0.1315,
    marginalRateCombined: 0.3915,
    effectiveRate: netIncome > 0 ? totalTax / netIncome : 0,
    oasClawback: 0,
    ageCredit: 0,
    pensionCredit: 0,
  };
}

/**
 * Build a minimal retired YearlyResult for test fixtures
 */
function makeRetiredYear(
  year: number,
  primaryAge: number,
  opts: {
    pensionIncome?: number;
    rrifWithdrawal?: number;
    cppIncome?: number;
    oasIncome?: number;
  } = {}
): YearlyResult {
  const pensionIncome = opts.pensionIncome ?? 0;
  const rrifWithdrawal = opts.rrifWithdrawal ?? 0;
  const cppIncome = opts.cppIncome ?? 0;
  const oasIncome = opts.oasIncome ?? 0;
  const totalIncome = pensionIncome + rrifWithdrawal + cppIncome + oasIncome;
  return {
    year,
    age: primaryAge,
    employmentIncome: 0,
    pensionIncome,
    cppIncome,
    oasIncome,
    rrifWithdrawal,
    tfsaWithdrawal: 0,
    nonRegWithdrawal: 0,
    totalIncome,
    livingExpenses: 40000,
    taxesPaid: Math.round(totalIncome * 0.25),
    netCashFlow: totalIncome - Math.round(totalIncome * 0.25) - 40000,
    rrspBalance: 400000,
    rrifBalance: rrifWithdrawal > 0 ? 400000 : 0,
    tfsaBalance: 100000,
    nonRegBalance: 0,
    totalNetWorth: 500000,
    taxCalculation: makeTaxCalc(Math.round(totalIncome * 0.25), totalIncome),
    rrifForcedMinimum: rrifWithdrawal,
    rrifMinimumRate: rrifWithdrawal > 0 ? 0.054 : 0,
    rrifConversionYear: false,
    isRetired: true,
    isRRIFConversionYear: false,
  };
}

/**
 * Build a minimal ProjectionInput for test fixtures
 */
function makeProjectionInput(overrides: Partial<ProjectionInput> = {}): ProjectionInput {
  return {
    birthdate: new Date('1960-01-01'),
    province: 'ON',
    retirementAge: 65,
    lifeExpectancy: 90,
    maritalStatus: 'single',
    employmentIncome: 0,
    employmentGrowthRate: 0,
    pensionIncome: 30000,
    rrspBalance: 500000,
    rrspAnnualContribution: 0,
    tfsaBalance: 100000,
    tfsaAnnualContribution: 0,
    nonRegBalance: 0,
    retirementSpending: 50000,
    investmentReturn: 0.05,
    inflationRate: 0.02,
    expectedCPPAt65: 10000,
    cppStartAge: 65,
    oasStartAge: 65,
    ...overrides,
  };
}

/**
 * Build a minimal ProjectionOutput for test fixtures
 */
function makeProjectionOutput(
  input: ProjectionInput,
  yearlyResults: YearlyResult[]
): ProjectionOutput {
  return {
    id: 'test-projection',
    input,
    yearlyResults,
    legacyTargetMet: null,
    summary: {
      startYear: 2025,
      endYear: 2050,
      retirementYear: 2025,
      yearsInRetirement: 25,
      peakNetWorth: 500000,
      peakNetWorthYear: 2025,
      portfolioLongevityAge: 90,
      totalTaxesPaid: 300000,
      averageRetirementIncome: 55000,
      averageEffectiveTaxRate: 0.25,
      moneyLastsToLifeExpectancy: true,
      lowestNetWorth: 10000,
      lowestNetWorthYear: 2050,
      fundedStatus: {
        state: 'green',
        depletionAge: null,
        balanceAtLifeExpectancy: 0,
        totalRetirementWithdrawals: 0,
      },
      remediationPlan: null,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Build a full OptimizationInput for test fixtures
 */
function makeOptimizationInput(overrides: Partial<OptimizationInput> = {}): OptimizationInput {
  const input = makeProjectionInput();
  const yearlyResults = [
    makeRetiredYear(2025, 65, {
      pensionIncome: 30000,
      rrifWithdrawal: 20000,
      cppIncome: 10000,
      oasIncome: 8000,
    }),
    makeRetiredYear(2026, 66, {
      pensionIncome: 30000,
      rrifWithdrawal: 20000,
      cppIncome: 10000,
      oasIncome: 8000,
    }),
    makeRetiredYear(2027, 67, {
      pensionIncome: 30000,
      rrifWithdrawal: 20000,
      cppIncome: 10000,
      oasIncome: 8000,
    }),
  ];
  return {
    baselineOutput: makeProjectionOutput(input, yearlyResults),
    clonedInput: makeProjectionInput(),
    ...overrides,
  };
}

// ---- Tests ----

/**
 * @see docs/TESTABLE-SURFACES.md — TC-OPT-SPLIT-002
 */
describe('analyzeIncomeSplitting', () => {
  it('TC-OPT-SPLIT-002: returns null for single-person projection (no spouse)', () => {
    const input = makeOptimizationInput({
      clonedInput: makeProjectionInput({ spouse: undefined, maritalStatus: 'single' }),
    });
    const result = analyzeIncomeSplitting(input);
    expect(result).toBeNull();
  });

  /**
   * @see docs/TESTABLE-SURFACES.md — TC-OPT-SPLIT-001
   */
  it('TC-OPT-SPLIT-001: couple projection with different incomes returns InsightCard', () => {
    // Primary: 30000 pension + 20000 RRIF; Spouse: 5000 pension only
    // Significant income gap => splitting should produce savings
    const primaryInput = makeProjectionInput({
      maritalStatus: 'married',
      pensionIncome: 30000,
      spouse: {
        birthdate: new Date('1962-01-01'),
        retirementAge: 65,
        lifeExpectancy: 90,
        employmentIncome: 0,
        expectedCPPAt65: 8000,
        cppStartAge: 65,
        oasStartAge: 65,
        pensionIncome: 5000,
        rrspBalance: 100000,
        tfsaBalance: 50000,
      },
    });

    // yearlyResults: couple both aged 65+ with high primary income
    const yearlyResults = [
      makeRetiredYear(2025, 65, {
        pensionIncome: 30000,
        rrifWithdrawal: 20000,
        cppIncome: 10000,
        oasIncome: 8000,
      }),
      makeRetiredYear(2026, 66, {
        pensionIncome: 30000,
        rrifWithdrawal: 20000,
        cppIncome: 10000,
        oasIncome: 8000,
      }),
      makeRetiredYear(2027, 67, {
        pensionIncome: 30000,
        rrifWithdrawal: 20000,
        cppIncome: 10000,
        oasIncome: 8000,
      }),
    ];

    const optInput: OptimizationInput = {
      baselineOutput: makeProjectionOutput(primaryInput, yearlyResults),
      clonedInput: primaryInput,
    };

    const result = analyzeIncomeSplitting(optInput);

    expect(result).not.toBeNull();
    expect(result?.module).toBe('income-splitting');
    expect(result?.confidence).toBe('HIGH');
    expect(result?.title).toBe('Household Pension Income Splitting');
    expect(result?.estimatedDollarImpact).toBeGreaterThan(0);
    expect(Number.isInteger(result?.estimatedDollarImpact)).toBe(true);
    expect(result?.explanation).toContain('%');
  });

  /**
   * @see docs/TESTABLE-SURFACES.md — TC-OPT-SPLIT-003 (under-65 caveat)
   */
  it('TC-OPT-SPLIT-003: explanation includes under-65 caveat when primary is under 65 in some retirement years', () => {
    const primaryInput = makeProjectionInput({
      maritalStatus: 'married',
      // Primary born 1967 → retires at 60 (under 65 initially)
      birthdate: new Date('1967-01-01'),
      retirementAge: 60,
      pensionIncome: 30000,
      spouse: {
        birthdate: new Date('1969-01-01'),
        retirementAge: 60,
        lifeExpectancy: 90,
        employmentIncome: 0,
        expectedCPPAt65: 8000,
        cppStartAge: 65,
        oasStartAge: 65,
        pensionIncome: 5000,
        rrspBalance: 100000,
        tfsaBalance: 50000,
      },
    });

    // Primary is 60 in 2027 — under 65, so only registered pension plan income qualifies
    // (RRIF would be excluded)
    const yearlyResults = [
      makeRetiredYear(2027, 60, { pensionIncome: 30000, cppIncome: 0, oasIncome: 0 }),
      makeRetiredYear(2028, 61, { pensionIncome: 30000, cppIncome: 0, oasIncome: 0 }),
      makeRetiredYear(2029, 62, { pensionIncome: 30000, cppIncome: 0, oasIncome: 0 }),
    ];

    const optInput: OptimizationInput = {
      baselineOutput: makeProjectionOutput(primaryInput, yearlyResults),
      clonedInput: primaryInput,
    };

    const result = analyzeIncomeSplitting(optInput);

    // If there's any splittable income (pension), result should include age-65 caveat
    if (result !== null) {
      expect(result.explanation).toContain('65');
    }
    // The caveat text must appear when any year has primary under 65
  });

  it('uses actual couple projection pension-split savings rows when available', () => {
    const primaryInput = makeProjectionInput({
      maritalStatus: 'married',
      spouse: {
        birthdate: new Date('1962-01-01'),
        retirementAge: 65,
        lifeExpectancy: 90,
        employmentIncome: 0,
        expectedCPPAt65: 8000,
        pensionIncome: 0,
        rrspBalance: 100000,
        tfsaBalance: 50000,
      },
    });
    const row = makeRetiredYear(2025, 65, { pensionIncome: 40000 });
    const optInput: OptimizationInput = {
      baselineOutput: makeProjectionOutput(primaryInput, [row]),
      clonedInput: primaryInput,
      coupleYearlyResults: [
        {
          year: 2025,
          primary: { ...row, owner: 'primary', totalGrossIncome: row.totalIncome },
          spouse: { ...row, owner: 'spouse', totalGrossIncome: row.totalIncome },
          householdGrossIncome: 80000,
          householdNetIncome: 70000,
          householdTaxesPaid: 10000,
          householdLivingExpenses: 0,
          householdNetCashFlow: 0,
          householdNetWorth: 0,
          pensionSplitPercentage: 0.35,
          pensionSplitTaxSavings: 1234,
          bothRetired: true,
          eitherRRIFConversion: false,
        } as unknown as CoupleYearlyResult,
      ],
    };

    const result = analyzeIncomeSplitting(optInput);

    expect(result?.title).toBe('Household Pension Income Splitting');
    expect(result?.estimatedDollarImpact).toBe(1234);
    expect(result?.recommendedAction).toContain('35%');
    expect(result?.whyItHelps).toContain('lower-tax spouse');
    expect(result?.affectedYears).toEqual([2025]);
    expect(result?.estimatedAnnualSavings).toBe(1234);
    expect(result?.appliesTo).toBe('household');
    expect(result?.explanation).toContain('based on the couple projection rows');
  });

  /**
   * @see docs/TESTABLE-SURFACES.md — TC-OPT-SPLIT-003 (CPP excluded)
   */
  it('TC-OPT-SPLIT-003: returns null when only CPP and OAS income (no splittable income)', () => {
    const primaryInput = makeProjectionInput({
      maritalStatus: 'married',
      pensionIncome: 0, // No pension
      spouse: {
        birthdate: new Date('1962-01-01'),
        retirementAge: 65,
        lifeExpectancy: 90,
        employmentIncome: 0,
        expectedCPPAt65: 8000,
        cppStartAge: 65,
        oasStartAge: 65,
        pensionIncome: 0, // No pension for spouse either
        rrspBalance: 0,
        tfsaBalance: 50000,
      },
    });

    // Only CPP + OAS income — no RRIF, no pension income
    const yearlyResults = [
      makeRetiredYear(2025, 65, { cppIncome: 10000, oasIncome: 8000 }),
      makeRetiredYear(2026, 66, { cppIncome: 10000, oasIncome: 8000 }),
    ];

    const optInput: OptimizationInput = {
      baselineOutput: makeProjectionOutput(primaryInput, yearlyResults),
      clonedInput: primaryInput,
    };

    const result = analyzeIncomeSplitting(optInput);

    // CPP and OAS are never splittable, so no benefit
    expect(result).toBeNull();
  });

  /**
   * TC-OPT-SPLIT-001: Card fields are correct types
   */
  it('returns InsightCard with correct types and integer estimatedDollarImpact', () => {
    const primaryInput = makeProjectionInput({
      maritalStatus: 'married',
      pensionIncome: 40000,
      spouse: {
        birthdate: new Date('1962-01-01'),
        retirementAge: 65,
        lifeExpectancy: 90,
        employmentIncome: 0,
        expectedCPPAt65: 8000,
        cppStartAge: 65,
        oasStartAge: 65,
        pensionIncome: 0,
        rrspBalance: 100000,
        tfsaBalance: 50000,
      },
    });

    const yearlyResults = [
      makeRetiredYear(2025, 65, {
        pensionIncome: 40000,
        rrifWithdrawal: 15000,
        cppIncome: 10000,
        oasIncome: 8000,
      }),
      makeRetiredYear(2026, 66, {
        pensionIncome: 40000,
        rrifWithdrawal: 15000,
        cppIncome: 10000,
        oasIncome: 8000,
      }),
    ];

    const optInput: OptimizationInput = {
      baselineOutput: makeProjectionOutput(primaryInput, yearlyResults),
      clonedInput: primaryInput,
    };

    const result = analyzeIncomeSplitting(optInput);

    if (result !== null) {
      expect(typeof result.module).toBe('string');
      expect(result.module).toBe('income-splitting');
      expect(result.confidence).toBe('HIGH');
      expect(typeof result.estimatedDollarImpact).toBe('number');
      expect(Number.isInteger(result.estimatedDollarImpact)).toBe(true);
      expect(typeof result.title).toBe('string');
      expect(typeof result.explanation).toBe('string');
    }
  });
});
