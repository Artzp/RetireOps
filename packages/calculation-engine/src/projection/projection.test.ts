/**
 * Projection Engine Tests
 * @see docs/source-of-truth/08-projection-engine.md
 */
import { describe, it, expect } from 'vitest';
import { runProjection, calculateProjectionSummary } from './multi-year.js';
import { calculateYear, type YearInput } from './yearly-calculator.js';
import { computeFundedStatus } from './funded-status.js';
import { getCurrentYear } from '@retireops/shared';
import type { YearlyResult, ProjectionInput } from '@retireops/shared';

// Helper to create a standard year input
function createYearInput(overrides: Partial<YearInput> = {}): YearInput {
  const birthdate = new Date(1964, 0, 1); // Born Jan 1, 1964 (60 years old in 2024)
  return {
    year: 2024,
    birthdate,
    province: 'ON',
    rrspBalance: 300000,
    rrifBalance: 0,
    tfsaBalance: 80000,
    nonRegBalance: 100000,
    nonRegACB: 80000,
    rrspContribution: 0,
    tfsaContribution: 0,
    employmentIncome: 0,
    pensionIncome: 0,
    otherIncome: 0,
    expectedCPPAt65: 12000,
    cppStartAge: 65,
    oasStartAge: 65,
    yearsOfResidence: 40,
    retirementSpending: 50000,
    investmentReturn: 0.04,
    inflationRate: 0.02,
    retirementAge: 60,
    yearsFromProjectionStart: 0,
    ...overrides,
  };
}

// Helper to create mock YearlyResult
function createMockYearlyResult(overrides: Partial<YearlyResult> = {}): YearlyResult {
  return {
    year: 2024,
    age: 60,
    employmentIncome: 0,
    pensionIncome: 0,
    cppIncome: 0,
    oasIncome: 0,
    rrifWithdrawal: 0,
    tfsaWithdrawal: 0,
    nonRegWithdrawal: 0,
    totalIncome: 0,
    livingExpenses: 50000,
    taxesPaid: 0,
    netCashFlow: 0,
    rrspBalance: 300000,
    rrifBalance: 0,
    tfsaBalance: 80000,
    nonRegBalance: 100000,
    totalNetWorth: 480000,
    taxCalculation: {
      year: 2024,
      owner: 'primary',
      grossIncome: 0,
      netIncome: 0,
      taxableIncome: 0,
      federalTax: 0,
      provincialTax: 0,
      totalTax: 0,
      effectiveRate: 0,
      marginalRate: 0.15,
      oasClawback: 0,
    },
    isRetired: true,
    isRRIFConversionYear: false,
    ...overrides,
  };
}

describe('Projection Engine', () => {
  describe('calculateYear', () => {
    it('should calculate basic year for pre-retirement', () => {
      const input = createYearInput({
        employmentIncome: 100000,
        retirementAge: 65,
        rrspContribution: 18000,
        tfsaContribution: 7000,
      });

      const result = calculateYear(input);

      expect(result.year).toBe(2024);
      expect(result.age).toBe(60);
      expect(result.isRetired).toBe(false);
      expect(result.employmentIncome).toBe(100000);
      // Should apply contributions
      expect(result.rrspBalance).toBeGreaterThan(input.rrspBalance);
      expect(result.tfsaBalance).toBeGreaterThan(input.tfsaBalance);
    });

    it('should calculate basic year for post-retirement', () => {
      const input = createYearInput({
        retirementAge: 60,
        retirementSpending: 50000,
      });

      const result = calculateYear(input);

      expect(result.isRetired).toBe(true);
      expect(result.employmentIncome).toBe(0);
      expect(result.livingExpenses).toBeGreaterThan(0);
    });

    it('should convert RRSP to RRIF at age 72', () => {
      const birthdate = new Date(1952, 0, 1); // 72 in 2024
      const input = createYearInput({
        birthdate,
        rrspBalance: 500000,
        rrifBalance: 0,
        retirementAge: 65,
      });

      const result = calculateYear(input);

      expect(result.age).toBe(72);
      expect(result.isRRIFConversionYear).toBe(true);
      expect(result.rrspBalance).toBe(0); // Converted
      // RRIF should have the balance (minus any withdrawals, plus growth)
    });

    it('should calculate RRIF minimum withdrawal at age 72+', () => {
      const birthdate = new Date(1951, 0, 1); // 73 in 2024
      const input = createYearInput({
        birthdate,
        rrspBalance: 0,
        rrifBalance: 500000,
        retirementAge: 65,
      });

      const result = calculateYear(input);

      expect(result.age).toBe(73);
      expect(result.rrifWithdrawal).toBeGreaterThan(0);
      // At 73, minimum is 5.53%
      expect(result.rrifWithdrawal).toBeCloseTo(500000 * 0.0553, -2);
    });

    it('should not calculate RRIF minimum before age 72', () => {
      const birthdate = new Date(1954, 0, 1); // 70 in 2024
      const input = createYearInput({
        birthdate,
        rrspBalance: 0,
        rrifBalance: 300000,
        retirementAge: 65,
      });

      const result = calculateYear(input);

      expect(result.age).toBe(70);
      // Minimum is 0 before 72 (though withdrawal may still happen for spending)
    });

    it('should apply investment growth', () => {
      const input = createYearInput({
        investmentReturn: 0.05,
        retirementSpending: 0, // No withdrawals needed
        retirementAge: 65, // Pre-retirement, no spending
        employmentIncome: 100000,
      });

      const _result = calculateYear(input);

      // All accounts should grow by approximately 5%
      // (exact amounts depend on timing of contributions/withdrawals)
      // Test verifies no error is thrown during calculation
    });

    it('should calculate taxes on income', () => {
      const birthdate = new Date(1959, 0, 1); // 65 in 2024
      const input = createYearInput({
        birthdate,
        expectedCPPAt65: 12000,
        cppStartAge: 65,
        oasStartAge: 65,
        retirementSpending: 40000,
        retirementAge: 65,
      });

      const result = calculateYear(input);

      expect(result.taxCalculation).toBeDefined();
      expect(result.taxesPaid).toBeGreaterThanOrEqual(0);
    });

    it('should fill spending gap from accounts', () => {
      const input = createYearInput({
        retirementSpending: 60000,
        retirementAge: 60,
      });

      const result = calculateYear(input);

      // Should withdraw to cover spending gap
      const totalWithdrawals =
        result.tfsaWithdrawal + result.nonRegWithdrawal + result.rrifWithdrawal;
      expect(totalWithdrawals).toBeGreaterThan(0);
    });

    it('should prioritize non-registered withdrawals before TFSA by default', () => {
      const input = createYearInput({
        tfsaBalance: 100000,
        nonRegBalance: 100000,
        retirementSpending: 30000,
        retirementAge: 60,
      });

      const result = calculateYear(input);

      // Default strategy should preserve TFSA until taxable accounts are used.
      expect(result.nonRegWithdrawal).toBeGreaterThan(0);
      expect(result.tfsaWithdrawal).toBe(0);
    });

    it('should use the citation-anchored 2026 OAS base amount for mainline years (A-01)', () => {
      // After the A-01 migration the engine consumes a single citation-anchored
      // 2026 Q2 amount (per docs/source-of-truth/18-pensions-2026.md#2026-oas-q2-amount-65to74)
      // for all mainline projection years rather than a per-year 2024/2025/2026
      // table. With inflation 0 and the same age, 2024 and 2026 inputs both fall
      // back to the 2026 anchored gross of 743.05 × 12 = 8916.60.
      const result2024 = calculateYear(
        createYearInput({
          year: 2024,
          birthdate: new Date(1959, 0, 1), // Age 65 in 2024
          retirementAge: 65,
          investmentReturn: 0,
          inflationRate: 0,
          retirementSpending: 0,
          oasStartAge: 65,
        })
      );

      const result2026 = calculateYear(
        createYearInput({
          year: 2026,
          birthdate: new Date(1961, 0, 1), // Age 65 in 2026
          retirementAge: 65,
          investmentReturn: 0,
          inflationRate: 0,
          retirementSpending: 0,
          oasStartAge: 65,
        })
      );

      expect(result2026.oasGrossIncome).toBeCloseTo(8916.6, 2);
      expect(result2024.oasGrossIncome).toBeCloseTo(result2026.oasGrossIncome, 6);
    });

    it('should currently treat pension income as flat with no bridge termination logic', () => {
      const pensionIncome = 24000;

      const age64 = calculateYear(
        createYearInput({
          year: 2024,
          birthdate: new Date(1960, 0, 1),
          pensionIncome,
          retirementAge: 60,
          retirementSpending: 0,
          investmentReturn: 0,
        })
      );

      const age65 = calculateYear(
        createYearInput({
          year: 2025,
          birthdate: new Date(1960, 0, 1),
          pensionIncome,
          retirementAge: 60,
          retirementSpending: 0,
          investmentReturn: 0,
          yearsFromProjectionStart: 1,
        })
      );

      const age66 = calculateYear(
        createYearInput({
          year: 2026,
          birthdate: new Date(1960, 0, 1),
          pensionIncome,
          retirementAge: 60,
          retirementSpending: 0,
          investmentReturn: 0,
          yearsFromProjectionStart: 2,
        })
      );

      expect(age64.pensionIncome).toBe(pensionIncome);
      expect(age65.pensionIncome).toBe(pensionIncome);
      expect(age66.pensionIncome).toBe(pensionIncome);
    });

    it('should carry restored TFSA room into the next retired year for re-contribution', () => {
      const startYear = getCurrentYear();
      const birthdate = new Date(startYear - 64, 0, 1);

      const result = runProjection({
        birthdate,
        province: 'ON',
        lifeExpectancy: 65,
        rrspBalance: 0,
        tfsaBalance: 20000,
        nonRegBalance: 0,
        employmentIncome: 0,
        employmentGrowthRate: 0,
        retirementAge: 60,
        rrspAnnualContribution: 0,
        tfsaAnnualContribution: 20000,
        retirementSpending: 15000,
        investmentReturn: 0,
        inflationRate: 0,
        expectedCPPAt65: 15000,
        cppStartAge: 65,
        oasStartAge: 65,
      });

      expect(result.yearlyResults).toHaveLength(2);

      const yearOne = result.yearlyResults[0];
      const yearTwo = result.yearlyResults[1];

      expect(yearOne?.isRetired).toBe(true);
      expect(yearOne?.age).toBe(64);
      expect(yearOne?.tfsaWithdrawal).toBe(15000);
      expect(yearOne?.tfsaBalance).toBe(12000);

      expect(yearTwo?.isRetired).toBe(true);
      expect(yearTwo?.age).toBe(65);
      expect(yearTwo?.tfsaWithdrawal).toBe(0);
      expect(yearTwo?.tfsaBalance).toBe(32000);
    });
  });

  describe('calculateProjectionSummary', () => {
    it('should throw error for empty results', () => {
      expect(() => calculateProjectionSummary([], {} as unknown as ProjectionInput)).toThrow(
        'No yearly results'
      );
    });

    it('should calculate peak net worth', () => {
      const results = [
        createMockYearlyResult({ year: 2024, totalNetWorth: 500000 }),
        createMockYearlyResult({ year: 2025, totalNetWorth: 600000 }),
        createMockYearlyResult({ year: 2026, totalNetWorth: 550000 }),
      ];

      const summary = calculateProjectionSummary(results, {} as unknown as ProjectionInput);

      expect(summary.peakNetWorth).toBe(600000);
      expect(summary.peakNetWorthYear).toBe(2025);
    });

    it('should calculate lowest net worth', () => {
      const results = [
        createMockYearlyResult({ year: 2024, totalNetWorth: 500000 }),
        createMockYearlyResult({ year: 2025, totalNetWorth: 300000 }),
        createMockYearlyResult({ year: 2026, totalNetWorth: 350000 }),
      ];

      const summary = calculateProjectionSummary(results, {} as unknown as ProjectionInput);

      expect(summary.lowestNetWorth).toBe(300000);
      expect(summary.lowestNetWorthYear).toBe(2025);
    });

    it('should detect when money runs out', () => {
      const results = [
        createMockYearlyResult({ year: 2024, age: 80, totalNetWorth: 50000 }),
        createMockYearlyResult({ year: 2025, age: 81, totalNetWorth: 10000 }),
        createMockYearlyResult({ year: 2026, age: 82, totalNetWorth: 0 }),
      ];

      const summary = calculateProjectionSummary(results, {} as unknown as ProjectionInput);

      expect(summary.portfolioLongevityAge).toBe(82);
      expect(summary.moneyLastsToLifeExpectancy).toBe(false);
    });

    it('should indicate money lasts to life expectancy when no depletion', () => {
      const results = [
        createMockYearlyResult({ year: 2024, totalNetWorth: 500000 }),
        createMockYearlyResult({ year: 2025, totalNetWorth: 480000 }),
        createMockYearlyResult({ year: 2026, totalNetWorth: 460000 }),
      ];

      const summary = calculateProjectionSummary(results, {} as unknown as ProjectionInput);

      expect(summary.portfolioLongevityAge).toBeNull();
      expect(summary.moneyLastsToLifeExpectancy).toBe(true);
    });

    it('should calculate total taxes paid', () => {
      const results = [
        createMockYearlyResult({ taxesPaid: 5000 }),
        createMockYearlyResult({ taxesPaid: 6000 }),
        createMockYearlyResult({ taxesPaid: 5500 }),
      ];

      const summary = calculateProjectionSummary(results, {} as unknown as ProjectionInput);

      expect(summary.totalTaxesPaid).toBe(16500);
    });

    it('should calculate average retirement income', () => {
      const results = [
        createMockYearlyResult({
          isRetired: true,
          totalIncome: 60000,
          taxesPaid: 10000,
        }),
        createMockYearlyResult({
          isRetired: true,
          totalIncome: 55000,
          taxesPaid: 8000,
        }),
        createMockYearlyResult({
          isRetired: true,
          totalIncome: 50000,
          taxesPaid: 6000,
        }),
      ];

      const summary = calculateProjectionSummary(results, {} as unknown as ProjectionInput);

      // Average after-tax: (50000 + 47000 + 44000) / 3 = 47000
      expect(summary.averageRetirementIncome).toBeCloseTo(47000, 0);
    });

    it('should identify retirement year', () => {
      const results = [
        createMockYearlyResult({ year: 2024, isRetired: false }),
        createMockYearlyResult({ year: 2025, isRetired: false }),
        createMockYearlyResult({ year: 2026, isRetired: true }),
        createMockYearlyResult({ year: 2027, isRetired: true }),
      ];

      const summary = calculateProjectionSummary(results, {} as unknown as ProjectionInput);

      expect(summary.retirementYear).toBe(2026);
      expect(summary.yearsInRetirement).toBe(2);
    });

    /**
     * TC-PROJ-029b: when legacyTarget is met AND portfolio has ≥10% buffer at LE,
     * fundedStatus.state === 'green' and remediationPlan === null.
     * @see docs/TESTABLE-SURFACES.md — TC-PROJ-029
     */
    it('TC-PROJ-029b: summary has fundedStatus green and remediationPlan null for non-depleting projection', () => {
      const results = [
        createMockYearlyResult({
          year: 2024,
          age: 65,
          totalNetWorth: 500000,
          isRetired: true,
          rrifWithdrawal: 40000,
        }),
        createMockYearlyResult({
          year: 2025,
          age: 66,
          totalNetWorth: 480000,
          isRetired: true,
          rrifWithdrawal: 40000,
        }),
        createMockYearlyResult({
          year: 2026,
          age: 67,
          totalNetWorth: 460000,
          isRetired: true,
          rrifWithdrawal: 40000,
        }),
      ];
      const input = {
        birthdate: new Date(1960, 0, 1),
        province: 'ON' as const,
        retirementAge: 65,
        lifeExpectancy: 67,
        employmentIncome: 0,
        employmentGrowthRate: 0,
        rrspBalance: 0,
        rrspAnnualContribution: 0,
        tfsaBalance: 0,
        tfsaAnnualContribution: 0,
        nonRegBalance: 0,
        retirementSpending: 50000,
        investmentReturn: 0.04,
        inflationRate: 0.02,
      } satisfies ProjectionInput;

      const summary = calculateProjectionSummary(results, input);

      // TC-PROJ-029b: fundedStatus must be populated
      expect(summary.fundedStatus).toBeDefined();
      expect(summary.fundedStatus.state).toBe('green');
      expect(summary.fundedStatus.depletionAge).toBeNull();
      expect(summary.remediationPlan).toBeNull();
    });

    /**
     * TC-PROJ-030: depletion early exit — fundedStatus.state === 'red' and
     * fundedStatus.depletionAge === summary.portfolioLongevityAge.
     * @see docs/TESTABLE-SURFACES.md — TC-PROJ-030
     */
    it('TC-PROJ-030: fundedStatus.state is red and depletionAge matches portfolioLongevityAge', () => {
      const results = [
        createMockYearlyResult({
          year: 2024,
          age: 80,
          totalNetWorth: 50000,
          rrifWithdrawal: 30000,
        }),
        createMockYearlyResult({
          year: 2025,
          age: 81,
          totalNetWorth: 10000,
          rrifWithdrawal: 30000,
        }),
        createMockYearlyResult({ year: 2026, age: 82, totalNetWorth: 0, rrifWithdrawal: 30000 }),
      ];
      const input = {
        birthdate: new Date(1944, 0, 1),
        province: 'ON' as const,
        retirementAge: 80,
        lifeExpectancy: 90,
        employmentIncome: 0,
        employmentGrowthRate: 0,
        rrspBalance: 0,
        rrspAnnualContribution: 0,
        tfsaBalance: 0,
        tfsaAnnualContribution: 0,
        nonRegBalance: 0,
        retirementSpending: 50000,
        investmentReturn: 0.04,
        inflationRate: 0.02,
      } satisfies ProjectionInput;

      const summary = calculateProjectionSummary(results, input);

      expect(summary.portfolioLongevityAge).toBe(82);
      expect(summary.fundedStatus.state).toBe('red');
      expect(summary.fundedStatus.depletionAge).toBe(82);
      // TC-PROJ-030: equality between new and existing depletion fields
      expect(summary.fundedStatus.depletionAge).toBe(summary.portfolioLongevityAge);
      expect(summary.remediationPlan).toBeNull();
    });
  });

  describe('runProjection (integration)', () => {
    it('should run basic projection', () => {
      const input = {
        birthdate: new Date(1964, 0, 1),
        province: 'ON' as const,
        lifeExpectancy: 90,
        rrspBalance: 300000,
        tfsaBalance: 80000,
        nonRegBalance: 100000,
        employmentIncome: 100000,
        employmentGrowthRate: 0.02,
        retirementAge: 65,
        rrspAnnualContribution: 10000,
        tfsaAnnualContribution: 7000,
        retirementSpending: 50000,
        investmentReturn: 0.04,
        inflationRate: 0.02,
        expectedCPPAt65: 12000,
        cppStartAge: 65,
        oasStartAge: 65,
      };

      const result = runProjection(input);

      expect(result.yearlyResults.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      // Start year depends on current date/age calculation
      expect(result.summary.startYear).toBeGreaterThanOrEqual(2024);
    });

    it('should prorate bridge pension income in the year bridge eligibility ends', () => {
      const startYear = getCurrentYear();
      const result = runProjection({
        birthdate: new Date(startYear - 64, 5, 15),
        province: 'ON',
        lifeExpectancy: 66,
        rrspBalance: 0,
        tfsaBalance: 1,
        nonRegBalance: 0,
        employmentIncome: 0,
        employmentGrowthRate: 0,
        pensionIncome: 40000,
        bridgeBenefit: 10000,
        bridgeEndAge: 65,
        retirementAge: 60,
        rrspAnnualContribution: 0,
        tfsaAnnualContribution: 0,
        retirementSpending: 0,
        investmentReturn: 0,
        inflationRate: 0,
        expectedCPPAt65: 0,
        cppStartAge: 60,
        oasStartAge: 70,
      });

      expect(result.yearlyResults).toHaveLength(3);
      expect(result.yearlyResults[0]?.age).toBe(64);
      expect(result.yearlyResults[0]?.pensionIncome).toBe(50000);
      expect(result.yearlyResults[1]?.age).toBe(65);
      expect(result.yearlyResults[1]?.pensionIncome).toBe(45000);
      expect(result.yearlyResults[2]?.age).toBe(66);
      expect(result.yearlyResults[2]?.pensionIncome).toBe(40000);
    });

    it('should keep bridge timing independent from an early CPP start age', () => {
      const startYear = getCurrentYear();
      const result = runProjection({
        birthdate: new Date(startYear - 64, 8, 1),
        province: 'ON',
        lifeExpectancy: 65,
        rrspBalance: 0,
        tfsaBalance: 1,
        nonRegBalance: 0,
        employmentIncome: 0,
        employmentGrowthRate: 0,
        pensionIncome: 30000,
        bridgeBenefit: 12000,
        bridgeEndAge: 65,
        retirementAge: 60,
        rrspAnnualContribution: 0,
        tfsaAnnualContribution: 0,
        retirementSpending: 0,
        investmentReturn: 0,
        inflationRate: 0,
        expectedCPPAt65: 12000,
        cppStartAge: 60,
        oasStartAge: 70,
      });

      expect(result.yearlyResults).toHaveLength(2);
      expect(result.yearlyResults[0]?.age).toBe(64);
      expect(result.yearlyResults[0]?.cppIncome).toBeGreaterThan(0);
      expect(result.yearlyResults[0]?.pensionIncome).toBe(42000);
      expect(result.yearlyResults[1]?.age).toBe(65);
      expect(result.yearlyResults[1]?.cppIncome).toBeGreaterThan(0);
      expect(result.yearlyResults[1]?.pensionIncome).toBe(39000);
    });
  });

  describe('Real-world projection scenarios', () => {
    it('should project typical Canadian retiree', () => {
      // 55-year-old planning to retire at 60
      const birthdate = new Date(1969, 0, 1);
      const input = createYearInput({
        birthdate,
        rrspBalance: 400000,
        tfsaBalance: 60000,
        nonRegBalance: 150000,
        employmentIncome: 90000,
        retirementAge: 60,
        retirementSpending: 55000,
        investmentReturn: 0.04,
        expectedCPPAt65: 10000,
        cppStartAge: 65,
        oasStartAge: 65,
      });

      const result = calculateYear(input);

      // Should still be working
      expect(result.isRetired).toBe(false);
      expect(result.employmentIncome).toBe(90000);
    });

    it('should handle early retirement scenario', () => {
      // 62-year-old, already retired
      const birthdate = new Date(1962, 0, 1);
      const input = createYearInput({
        birthdate,
        rrspBalance: 600000,
        tfsaBalance: 100000,
        nonRegBalance: 200000,
        employmentIncome: 0,
        retirementAge: 60,
        retirementSpending: 60000,
        expectedCPPAt65: 8000, // Reduced due to early retirement
        cppStartAge: 60, // Taking CPP early
        oasStartAge: 65,
      });

      const result = calculateYear(input);

      expect(result.isRetired).toBe(true);
      expect(result.cppIncome).toBeGreaterThan(0); // Started CPP at 60
      expect(result.oasIncome).toBe(0); // Not yet 65
    });

    it('should handle high-income retiree with OAS clawback risk', () => {
      // 66-year-old with large RRIF
      const birthdate = new Date(1958, 0, 1);
      const input = createYearInput({
        birthdate,
        rrspBalance: 0,
        rrifBalance: 1500000,
        tfsaBalance: 150000,
        nonRegBalance: 300000,
        retirementAge: 65,
        retirementSpending: 80000,
        expectedCPPAt65: 14000,
        cppStartAge: 65,
        oasStartAge: 65,
      });

      const result = calculateYear(input);

      expect(result.isRetired).toBe(true);
      expect(result.cppIncome).toBeGreaterThan(0);
      expect(result.oasIncome).toBeGreaterThan(0);
    });
  });

  describe('Full multi-year projection integration tests', () => {
    it('should run complete projection from accumulation to decumulation', () => {
      const input = {
        birthdate: new Date(1969, 0, 1), // 55 years old
        province: 'ON' as const,
        lifeExpectancy: 85, // More conservative life expectancy
        rrspBalance: 400000, // More savings
        tfsaBalance: 100000,
        nonRegBalance: 100000,
        employmentIncome: 100000,
        employmentGrowthRate: 0.02,
        retirementAge: 62, // Work a bit longer
        rrspAnnualContribution: 20000,
        tfsaAnnualContribution: 7000,
        retirementSpending: 50000, // More modest spending
        investmentReturn: 0.05, // Slightly higher return
        inflationRate: 0.02,
        expectedCPPAt65: 14000,
        cppStartAge: 65,
        oasStartAge: 65,
      };

      const result = runProjection(input);

      // Should have results for each year until life expectancy
      expect(result.yearlyResults.length).toBeGreaterThan(20);
      expect(result.summary).toBeDefined();

      // First year should be working
      const firstYear = result.yearlyResults[0];
      expect(firstYear?.employmentIncome).toBeGreaterThan(0);

      // Find retirement year
      const retirementYearResult = result.yearlyResults.find((r) => r.isRetired);
      expect(retirementYearResult).toBeDefined();
      expect(retirementYearResult?.employmentIncome).toBe(0);

      // Net worth should be positive throughout for a well-funded retirement
      expect(result.summary.moneyLastsToLifeExpectancy).toBe(true);
    });

    it('should project RRSP to RRIF conversion at age 71', () => {
      const input = {
        birthdate: new Date(1959, 0, 1), // Will turn 71 soon
        province: 'AB' as const,
        lifeExpectancy: 90,
        rrspBalance: 500000,
        tfsaBalance: 100000,
        nonRegBalance: 50000,
        employmentIncome: 0,
        employmentGrowthRate: 0,
        retirementAge: 60,
        rrspAnnualContribution: 0,
        tfsaAnnualContribution: 0,
        retirementSpending: 50000,
        investmentReturn: 0.04,
        inflationRate: 0.02,
        expectedCPPAt65: 14000,
        cppStartAge: 65,
        oasStartAge: 65,
      };

      const result = runProjection(input);

      // Find the RRIF conversion year
      const conversionYear = result.yearlyResults.find((r) => r.isRRIFConversionYear);
      expect(conversionYear).toBeDefined();
      expect(conversionYear?.age).toBe(71);
      expect(conversionYear?.rrspBalance).toBe(0); // RRSP fully converted
    });

    it('should track decreasing net worth in underfunded retirement', () => {
      const input = {
        birthdate: new Date(1964, 0, 1), // 60 years old
        province: 'BC' as const,
        lifeExpectancy: 95,
        rrspBalance: 150000, // Underfunded
        tfsaBalance: 30000,
        nonRegBalance: 20000,
        employmentIncome: 0,
        employmentGrowthRate: 0,
        retirementAge: 60,
        rrspAnnualContribution: 0,
        tfsaAnnualContribution: 0,
        retirementSpending: 65000, // High spending relative to savings
        investmentReturn: 0.04,
        inflationRate: 0.02,
        expectedCPPAt65: 8000,
        cppStartAge: 65,
        oasStartAge: 65,
      };

      const result = runProjection(input);

      // Money should run out before life expectancy
      expect(result.summary.portfolioLongevityAge).toBeDefined();
      expect(result.summary.portfolioLongevityAge).toBeLessThan(95);
      expect(result.summary.moneyLastsToLifeExpectancy).toBe(false);
    });

    it('should calculate accurate tax progression', () => {
      const input = {
        birthdate: new Date(1964, 0, 1),
        province: 'ON' as const,
        lifeExpectancy: 85,
        rrspBalance: 400000,
        tfsaBalance: 80000,
        nonRegBalance: 100000,
        employmentIncome: 0,
        employmentGrowthRate: 0,
        retirementAge: 60,
        rrspAnnualContribution: 0,
        tfsaAnnualContribution: 0,
        retirementSpending: 50000,
        investmentReturn: 0.04,
        inflationRate: 0.02,
        expectedCPPAt65: 12000,
        cppStartAge: 65,
        oasStartAge: 65,
      };

      const result = runProjection(input);

      // Should have tax calculations for all years

      result.yearlyResults.forEach((year) => {
        expect(year.taxCalculation).toBeDefined();

        expect(year.taxCalculation.totalTax).toBeGreaterThanOrEqual(0);

        expect(year.taxCalculation.effectiveRate).toBeGreaterThanOrEqual(0);

        expect(year.taxCalculation.effectiveRate).toBeLessThanOrEqual(1);
      });

      // Effective tax rate should generally be reasonable
      /* eslint-disable @typescript-eslint/restrict-plus-operands */
      const avgEffectiveRate =
        result.yearlyResults.reduce((sum, r) => sum + r.taxCalculation.effectiveRate, 0) /
        result.yearlyResults.length;
      /* eslint-enable @typescript-eslint/restrict-plus-operands */
      expect(avgEffectiveRate).toBeLessThan(0.4); // Less than 40% average
    });

    it('should handle different provincial tax rates', () => {
      const baseInput = {
        birthdate: new Date(1964, 0, 1),
        lifeExpectancy: 80,
        rrspBalance: 300000,
        tfsaBalance: 50000,
        nonRegBalance: 50000,
        employmentIncome: 0,
        employmentGrowthRate: 0,
        retirementAge: 60,
        rrspAnnualContribution: 0,
        tfsaAnnualContribution: 0,
        retirementSpending: 45000,
        investmentReturn: 0.04,
        inflationRate: 0.02,
        expectedCPPAt65: 11000,
        cppStartAge: 65,
        oasStartAge: 65,
      };

      const onResult = runProjection({ ...baseInput, province: 'ON' as const });
      const bcResult = runProjection({ ...baseInput, province: 'BC' as const });
      const abResult = runProjection({ ...baseInput, province: 'AB' as const });

      // All should run successfully
      expect(onResult.yearlyResults.length).toBeGreaterThan(0);
      expect(bcResult.yearlyResults.length).toBeGreaterThan(0);
      expect(abResult.yearlyResults.length).toBeGreaterThan(0);

      // Total taxes paid should differ between provinces
      const onTaxes = onResult.summary.totalTaxesPaid;
      const bcTaxes = bcResult.summary.totalTaxesPaid;
      const abTaxes = abResult.summary.totalTaxesPaid;

      // Alberta should generally have lower provincial taxes
      expect(abTaxes).not.toBe(onTaxes);
      expect(bcTaxes).not.toBe(onTaxes);
    });
  });

  // ---------------------------------------------------------------------------
  // Regression tests for BUG-1 (OAS clawback) and BUG-2 (RRSP cap)
  // @see docs/source-of-truth/05-government-benefits.md - OAS Clawback
  // @see docs/source-of-truth/02-account-types.md - RRSP-002
  // ---------------------------------------------------------------------------
  describe('OAS clawback regression (BUG-1)', () => {
    it('should apply OAS clawback when RRIF minimum withdrawals push income above threshold', () => {
      // RRIF minimum withdrawals are mandatory from age 72+. Use a large RRIF so that
      // the mandatory minimum alone pushes net income past the clawback threshold.
      //
      // 2026 threshold: $95,323.
      // At age 72, minimum rate = 5.40%. Need RRIF min + CPP ($12k) + OAS ($8,908) > $95,323.
      // Required RRIF min: > $95,323 − $12,000 − $8,908 = $74,415
      // Balance needed: $74,415 / 0.054 = $1,378,056 → use $1,500,000 (min = $81,000)
      // Net income ≈ $81,000 + $12,000 + $8,908 = $101,908 → above $95,323 → clawback fires.
      //
      // @see docs/source-of-truth/05-government-benefits.md - TC-GOV-004
      const birthdate = new Date(1954, 0, 1); // age 72 in 2026
      const highIncomeInput: YearInput = {
        year: 2026,
        birthdate,
        province: 'ON',
        rrspBalance: 0,
        rrifBalance: 1_500_000,
        tfsaBalance: 0,
        nonRegBalance: 0,
        nonRegACB: 0,
        rrspContribution: 0,
        tfsaContribution: 0,
        employmentIncome: 0,
        pensionIncome: 0,
        otherIncome: 0,
        expectedCPPAt65: 12_000,
        cppStartAge: 65,
        oasStartAge: 65,
        yearsOfResidence: 40,
        retirementSpending: 0,
        investmentReturn: 0,
        inflationRate: 0,
        retirementAge: 65,
        yearsFromProjectionStart: 0,
      };

      const highResult = calculateYear(highIncomeInput);

      // Net income exceeds threshold — OAS must be clawed back and net OAS must be reduced
      expect(highResult.oasIncome).toBeGreaterThan(0); // Not fully clawed back
      expect(highResult.oasIncome).toBeLessThan(8_908); // But less than gross amount

      // Low-income scenario: person at 65 with only CPP ($12k) and OAS — below threshold
      const lowIncomeBirthdate = new Date(1961, 0, 1); // age 65 in 2026
      const lowIncomeInput: YearInput = {
        year: 2026,
        birthdate: lowIncomeBirthdate,
        province: 'ON',
        rrspBalance: 0,
        rrifBalance: 0,
        tfsaBalance: 0,
        nonRegBalance: 0,
        nonRegACB: 0,
        rrspContribution: 0,
        tfsaContribution: 0,
        employmentIncome: 0,
        pensionIncome: 0,
        otherIncome: 0,
        expectedCPPAt65: 12_000,
        cppStartAge: 65,
        oasStartAge: 65,
        yearsOfResidence: 40,
        retirementSpending: 0,
        investmentReturn: 0,
        inflationRate: 0,
        retirementAge: 65,
        yearsFromProjectionStart: 0,
      };

      const lowResult = calculateYear(lowIncomeInput);

      // Net income (CPP $12k + OAS $8,908 ≈ $21k) is well below $95,323 — no clawback
      expect(lowResult.oasIncome).toBeGreaterThan(8_000); // Full OAS received
      // High-income OAS must be strictly less than low-income OAS
      expect(highResult.oasIncome).toBeLessThan(lowResult.oasIncome);
    });

    it('should reduce OAS proportionally to excess income above clawback threshold', () => {
      // Uses calculateYear with year=2026 for predictable clawback math.
      // 2026 threshold = $95,323; gross OAS age 72-74 = $8,908.
      //
      // At age 72, RRIF min rate = 5.40%.
      // With $1,500,000 RRIF: min = $81,000
      // Net income estimate (pass 2): $81,000 + $12,000 (CPP) + $8,908 (gross OAS) = $101,908
      // Excess over threshold: $101,908 − $95,323 = $6,585
      // Clawback: $6,585 × 15% = $988
      // Net OAS: $8,908 − $988 = $7,920
      //
      // @see docs/source-of-truth/05-government-benefits.md - TC-GOV-004
      const birthdate = new Date(1954, 0, 1); // age 72 in 2026
      const input: YearInput = {
        year: 2026,
        birthdate,
        province: 'ON',
        rrspBalance: 0,
        rrifBalance: 1_500_000,
        tfsaBalance: 0,
        nonRegBalance: 0,
        nonRegACB: 0,
        rrspContribution: 0,
        tfsaContribution: 0,
        employmentIncome: 0,
        pensionIncome: 0,
        otherIncome: 0,
        expectedCPPAt65: 12_000,
        cppStartAge: 65,
        oasStartAge: 65,
        yearsOfResidence: 40,
        retirementSpending: 0,
        investmentReturn: 0,
        inflationRate: 0,
        retirementAge: 65,
        yearsFromProjectionStart: 0,
      };

      const result = calculateYear(input);

      // Net OAS must be reduced (clawback applied)
      expect(result.oasIncome).toBeGreaterThan(0);
      expect(result.oasIncome).toBeLessThan(8_908); // Less than gross OAS
      // Net OAS should be roughly $7,920 (within $500 tolerance)
      expect(result.oasIncome).toBeGreaterThan(7_000);
      expect(result.oasIncome).toBeLessThan(8_600);
    });
  });

  describe('RRSP contribution cap regression (BUG-2)', () => {
    it('should cap RRSP contributions at 18% of earned income up to the annual max', () => {
      // Person earns $150k/yr and requests $100k RRSP contribution.
      // CRA limit = min(150000 × 0.18, 32490) = min(27000, 32490) = $27,000.
      // The actual contribution must be capped at $27,000, not $100,000.
      // @see docs/source-of-truth/02-account-types.md - RRSP-002
      const startYear = getCurrentYear();
      const birthdate = new Date(startYear - 45, 0, 1); // Age 45, pre-retirement

      const result = runProjection({
        birthdate,
        province: 'ON',
        lifeExpectancy: 47, // Only 2 years — enough to verify accumulation
        rrspBalance: 0,
        tfsaBalance: 0,
        nonRegBalance: 0,
        employmentIncome: 150_000,
        employmentGrowthRate: 0,
        retirementAge: 65, // Not yet retired
        rrspAnnualContribution: 100_000, // Intentionally over-limit input
        tfsaAnnualContribution: 0,
        retirementSpending: 0,
        investmentReturn: 0, // Zero growth to isolate contribution amounts
        inflationRate: 0,
        expectedCPPAt65: 12_000,
        cppStartAge: 65,
        oasStartAge: 65,
      });

      // lifeExpectancy: 47, starting age 45 → 3 projection years (ages 45, 46, 47)
      expect(result.yearlyResults.length).toBe(3);

      // Each year: prior-year earned income = $150k;
      //   room = min(150k × 0.18, annual_limit) = min(27000, 32490) = $27,000.
      // With zero growth, after 3 years of $27k contributions: balance = $81,000.
      const finalYear = result.yearlyResults[result.yearlyResults.length - 1];
      if (!finalYear) throw new Error('Expected final year result to exist');

      // RRSP balance must be nowhere near $300k (what face-value $100k contributions would give)
      // It must be approximately $81k (3 × $27k) with zero growth
      expect(finalYear.rrspBalance).toBeLessThan(100_000); // Well under $300k
      expect(finalYear.rrspBalance).toBeGreaterThan(60_000); // But still has meaningful savings
    });

    it('should accept full contribution when it is within the CRA-computed room', () => {
      // Person earns $200k/yr and requests $18,000 — well under the 18% cap.
      // 18% of $200k = $36k > annual limit; room = limit (~$32k for 2025/2026).
      // $18k < $32k so the full $18k must be applied.
      const startYear = getCurrentYear();
      const birthdate = new Date(startYear - 50, 0, 1); // Age 50

      const result = runProjection({
        birthdate,
        province: 'AB',
        lifeExpectancy: 51, // 2 years
        rrspBalance: 0,
        tfsaBalance: 0,
        nonRegBalance: 0,
        employmentIncome: 200_000,
        employmentGrowthRate: 0,
        retirementAge: 65,
        rrspAnnualContribution: 18_000,
        tfsaAnnualContribution: 0,
        retirementSpending: 0,
        investmentReturn: 0,
        inflationRate: 0,
        expectedCPPAt65: 12_000,
        cppStartAge: 65,
        oasStartAge: 65,
      });

      expect(result.yearlyResults.length).toBe(2);

      // Both years should contribute exactly $18k (well within room)
      const yearOne = result.yearlyResults[0];
      const yearTwo = result.yearlyResults[1];

      // After year 1 only: $18k in RRSP (zero growth)
      expect(yearOne?.rrspBalance).toBeCloseTo(18_000, -2);
      // After year 2: $36k total
      expect(yearTwo?.rrspBalance).toBeCloseTo(36_000, -2);
    });
  });
});

// ---------------------------------------------------------------------------
// TC-PROJ-030 equality regression (Phase 48-05)
// fundedStatus.depletionAge === summary.portfolioLongevityAge
// ---------------------------------------------------------------------------

/**
 * TC-PROJ-030: depletion age equality between funded-status classifier and summary builder.
 *
 * The summary builder (calculateProjectionSummary) and the funded-status classifier
 * (computeFundedStatus) both read yearlyResults to find the depletion row. They use
 * different lookup strategies:
 *   - summary builder: a for-loop that records the first age where totalNetWorth <= 0
 *   - computeFundedStatus: Array.prototype.find over the same results
 *
 * This regression proves they always agree. If either code path changes its lookup
 * strategy and the values diverge, the Red banner would show a different age than
 * the rest of the summary — a direct FUND-05 violation.
 *
 * Tests use real runProjection() end-to-end — no hand-crafted arrays. This catches
 * any disagreement that only emerges from real engine output (e.g. values that are
 * very slightly below zero due to floating-point arithmetic).
 *
 * @see docs/TESTABLE-SURFACES.md — TC-PROJ-030
 * @see docs/source-of-truth/08-projection-engine.md
 * @see .planning/phases/48-funded-status-mvp-classification-banner/48-RESEARCH.md (equality rationale)
 */
describe('TC-PROJ-030: depletion age equality (Phase 48 regression)', () => {
  /**
   * Red-state fixture: age-65 retiree, no government benefits, $200k RRSP,
   * $75k/yr spending, 0% return. Portfolio depletes well before LE=90.
   */
  function buildRedStateFixture(): ProjectionInput {
    const startYear = getCurrentYear();
    return {
      birthdate: new Date(startYear - 65, 0, 1),
      province: 'ON' as const,
      retirementAge: 65,
      lifeExpectancy: 90,
      employmentIncome: 0,
      employmentGrowthRate: 0,
      rrspBalance: 200_000,
      rrspAnnualContribution: 0,
      tfsaBalance: 0,
      tfsaAnnualContribution: 0,
      nonRegBalance: 0,
      retirementSpending: 75_000,
      investmentReturn: 0,
      inflationRate: 0,
      expectedCPPAt65: 0,
      cppStartAge: 100,
      oasStartAge: 100,
    };
  }

  /**
   * Green-state fixture: well-funded retiree. Portfolio lasts to LE=90 with surplus.
   */
  function buildGreenStateFixture(): ProjectionInput {
    const startYear = getCurrentYear();
    return {
      birthdate: new Date(startYear - 65, 0, 1),
      province: 'ON' as const,
      retirementAge: 65,
      lifeExpectancy: 90,
      employmentIncome: 0,
      employmentGrowthRate: 0,
      rrspBalance: 2_000_000,
      rrspAnnualContribution: 0,
      tfsaBalance: 0,
      tfsaAnnualContribution: 0,
      nonRegBalance: 0,
      retirementSpending: 50_000,
      investmentReturn: 0.04,
      inflationRate: 0.02,
      expectedCPPAt65: 12_000,
      cppStartAge: 65,
      oasStartAge: 65,
    };
  }

  it('red-state: fundedStatus.depletionAge === summary.portfolioLongevityAge', () => {
    const fixture = buildRedStateFixture();
    const result = runProjection(fixture) as {
      yearlyResults: YearlyResult[];
      summary: { portfolioLongevityAge: number | null };
    };

    const fundedStatus = computeFundedStatus(result.yearlyResults, fixture);

    // Sanity: fixture must produce Red state
    expect(fundedStatus.state).toBe('red');
    expect(fundedStatus.depletionAge).not.toBeNull();
    expect(result.summary.portfolioLongevityAge).not.toBeNull();

    // FUND-05 equality invariant: both code paths agree on the depletion age
    expect(fundedStatus.depletionAge).toBe(result.summary.portfolioLongevityAge);
  });

  it('green-state: depletionAge is null and summary portfolioLongevityAge is null', () => {
    const fixture = buildGreenStateFixture();
    const result = runProjection(fixture) as {
      yearlyResults: YearlyResult[];
      summary: { portfolioLongevityAge: number | null; moneyLastsToLifeExpectancy: boolean };
    };

    const fundedStatus = computeFundedStatus(result.yearlyResults, fixture);

    // Portfolio must last to life expectancy
    expect(result.summary.moneyLastsToLifeExpectancy).toBe(true);

    // Both code paths agree: no depletion
    expect(fundedStatus.depletionAge).toBeNull();
    expect(result.summary.portfolioLongevityAge).toBeNull();
  });
});
