/**
 * Couple Projection Integration Tests
 * Tests multi-year projections for married/common-law couples
 * @see docs/source-of-truth/08-projection-engine.md
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Pension Income Splitting
 */
import { describe, it, expect } from 'vitest';
import { runProjection, runCoupleProjection } from './multi-year.js';
import type { CoupleProjectionOutput as _CoupleProjectionOutput } from './multi-year.js';
type _CoupleResult = _CoupleProjectionOutput;

// Re-export as used type (workaround for ESLint unused-vars rule on type-only usage)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _assertCoupleType = (x: unknown): x is _CoupleResult => true;
void _assertCoupleType;
import { getCurrentYear, type ProjectionInput, type SpouseInput } from '@retireops/shared';

// Helper to create a standard couple projection input
function createCoupleProjectionInput(
  overrides: Partial<ProjectionInput> = {},
  spouseOverrides: Partial<SpouseInput> = {}
): ProjectionInput {
  const spouse: SpouseInput = {
    birthdate: new Date(1961, 0, 1), // 2 years younger than primary
    retirementAge: 63,
    lifeExpectancy: 88,
    employmentIncome: 60000,
    expectedCPPAt65: 10000,
    rrspBalance: 200000,
    tfsaBalance: 50000,
    ...spouseOverrides,
  };

  return {
    // Primary person
    birthdate: new Date(1959, 0, 1), // 65 years old in 2024
    province: 'ON',
    lifeExpectancy: 90,
    retirementAge: 65,
    employmentIncome: 0, // Already retired
    employmentGrowthRate: 0.02,
    rrspBalance: 400000,
    tfsaBalance: 80000,
    nonRegBalance: 100000,
    rrspAnnualContribution: 0,
    tfsaAnnualContribution: 0,
    retirementSpending: 50000,
    investmentReturn: 0.04,
    inflationRate: 0.02,
    expectedCPPAt65: 14000,
    cppStartAge: 65,
    oasStartAge: 65,

    // Couple-specific
    maritalStatus: 'married',
    spouse,
    coupleSettings: {
      optimizePensionSplitting: true,
      sharedRetirementSpending: 55000,
      useYoungerSpouseForRRIF: false,
    },
    ...overrides,
  };
}

describe('Couple Projection Integration', () => {
  describe('runProjection routing', () => {
    it('should route to single projection when no spouse', () => {
      const input: ProjectionInput = {
        birthdate: new Date(1964, 0, 1),
        province: 'ON',
        lifeExpectancy: 85,
        retirementAge: 65,
        employmentIncome: 100000,
        rrspBalance: 300000,
        tfsaBalance: 80000,
        nonRegBalance: 50000,
        retirementSpending: 50000,
        investmentReturn: 0.04,
        inflationRate: 0.02,
        expectedCPPAt65: 12000,
        maritalStatus: 'single',
      };

      const result = runProjection(input);

      // Single projection result structure
      expect(result.yearlyResults.length).toBeGreaterThan(0);
      const firstResult = result.yearlyResults[0];
      expect(firstResult).toBeDefined();
      expect(firstResult && 'age' in firstResult).toBe(true);
      expect(firstResult && 'primary' in firstResult).toBe(false);
    });

    it('should route to couple projection when married with spouse', () => {
      const input = createCoupleProjectionInput();

      const result = runProjection(input);

      // Couple projection result structure
      expect(result.yearlyResults.length).toBeGreaterThan(0);
      const firstResult = result.yearlyResults[0];
      expect(firstResult).toBeDefined();
      expect(firstResult && 'primary' in firstResult).toBe(true);
      expect(firstResult && 'spouse' in firstResult).toBe(true);
    });

    it('should route to single projection when married but no spouse data', () => {
      const input: ProjectionInput = {
        birthdate: new Date(1964, 0, 1),
        province: 'ON',
        lifeExpectancy: 85,
        retirementAge: 65,
        employmentIncome: 100000,
        rrspBalance: 300000,
        tfsaBalance: 80000,
        nonRegBalance: 50000,
        retirementSpending: 50000,
        investmentReturn: 0.04,
        inflationRate: 0.02,
        expectedCPPAt65: 12000,
        maritalStatus: 'married', // Married but no spouse data
      };

      const result = runProjection(input);

      // Should still be single projection
      const firstResult = result.yearlyResults[0];
      expect(firstResult).toBeDefined();
      expect(firstResult && 'age' in firstResult).toBe(true);
    });
  });

  describe('runCoupleProjection', () => {
    it('should project multiple years for couple', () => {
      const input = createCoupleProjectionInput();

      const result = runCoupleProjection(input);

      // Should have results for each year until primary's life expectancy
      expect(result.yearlyResults.length).toBeGreaterThan(20);

      // First and last years should be defined
      const firstYear = result.yearlyResults[0];
      const lastYear = result.yearlyResults[result.yearlyResults.length - 1];
      expect(firstYear).toBeDefined();
      expect(lastYear).toBeDefined();
    });

    it('should track both spouses balances over time', () => {
      const input = createCoupleProjectionInput();

      const result = runCoupleProjection(input);

      const firstYear = result.yearlyResults[0];
      const midYear = result.yearlyResults[Math.floor(result.yearlyResults.length / 2)];
      expect(firstYear).toBeDefined();
      expect(midYear).toBeDefined();
      if (!firstYear || !midYear) return;

      // Both should have account balances tracked
      expect(firstYear.primary.totalNetWorth).toBeGreaterThan(0);
      expect(firstYear.spouse.totalNetWorth).toBeGreaterThan(0);

      // Balances should change over time
      expect(midYear.primary.totalNetWorth).not.toBe(firstYear.primary.totalNetWorth);
    });

    it('should calculate household totals correctly each year', () => {
      const input = createCoupleProjectionInput();

      const result = runCoupleProjection(input);

      result.yearlyResults.forEach((year) => {
        // Household net worth should be sum of both
        expect(year.householdNetWorth).toBeCloseTo(
          year.primary.totalNetWorth + year.spouse.totalNetWorth,
          0
        );

        // Household taxes should be sum of both
        expect(year.householdTaxesPaid).toBeCloseTo(
          year.primary.taxesPaid + year.spouse.taxesPaid,
          0
        );
      });
    });
  });

  describe('Couple Projection Summary', () => {
    it('should calculate couple projection summary', () => {
      const input = createCoupleProjectionInput();

      const result = runCoupleProjection(input);

      expect(result.summary).toBeDefined();
      expect(result.summary.startYear).toBeGreaterThanOrEqual(2024);
      expect(result.summary.endYear).toBeGreaterThan(result.summary.startYear);
    });

    it('should track peak household net worth', () => {
      const input = createCoupleProjectionInput();

      const result = runCoupleProjection(input);

      expect(result.summary.peakNetWorth).toBeGreaterThan(0);
      expect(result.summary.peakNetWorthYear).toBeGreaterThanOrEqual(result.summary.startYear);
    });

    it('should calculate total pension split savings', () => {
      const input = createCoupleProjectionInput({
        // High RRIF for primary to enable pension splitting
        rrspBalance: 0,
        rrifBalance: 800000,
      });

      const result = runCoupleProjection(input);

      // Should have pension split tax savings tracked
      expect(result.summary.totalPensionSplitTaxSavings).toBeDefined();
      expect(result.summary.totalPensionSplitTaxSavings).toBeGreaterThanOrEqual(0);
    });

    it('should calculate total taxes paid', () => {
      const input = createCoupleProjectionInput();

      const result = runCoupleProjection(input);

      expect(result.summary.totalTaxesPaid).toBeGreaterThan(0);

      // Total should equal sum of all yearly taxes
      const sumYearlyTaxes = result.yearlyResults.reduce(
        (sum, year) => sum + year.householdTaxesPaid,
        0
      );
      expect(result.summary.totalTaxesPaid).toBeCloseTo(sumYearlyTaxes, 0);
    });

    it('should determine if money lasts to life expectancy', () => {
      const input = createCoupleProjectionInput({
        lifeExpectancy: 85,
        rrspBalance: 500000,
        tfsaBalance: 100000,
        nonRegBalance: 100000,
      });

      const result = runCoupleProjection(input);

      // Well-funded couple should have money last
      expect(result.summary.moneyLastsToLifeExpectancy).toBe(true);
    });

    it('should detect when couple runs out of money', () => {
      const input = createCoupleProjectionInput({
        lifeExpectancy: 95,
        rrspBalance: 100000, // Underfunded
        tfsaBalance: 20000,
        nonRegBalance: 10000,
        coupleSettings: {
          optimizePensionSplitting: true,
          sharedRetirementSpending: 80000, // High spending
          useYoungerSpouseForRRIF: false,
        },
      });

      const result = runCoupleProjection(input);

      // Underfunded couple should run out
      expect(result.summary.moneyLastsToLifeExpectancy).toBe(false);
      expect(result.summary.portfolioLongevityAge).toBeLessThan(95);
    });
  });

  describe('Pension Splitting Optimization Over Time', () => {
    it('should accumulate pension split savings across years', () => {
      const input = createCoupleProjectionInput(
        {
          birthdate: new Date(1959, 0, 1), // Both 65+
          rrspBalance: 0,
          rrifBalance: 600000,
        },
        {
          birthdate: new Date(1959, 0, 1), // Same age
        }
      );

      const result = runCoupleProjection(input);

      // Find years where pension splitting occurred
      const splittingYears = result.yearlyResults.filter((year) => year.pensionSplitPercentage > 0);

      if (splittingYears.length > 0) {
        // Should have tax savings in those years
        splittingYears.forEach((year) => {
          expect(year.pensionSplitTaxSavings).toBeGreaterThanOrEqual(0);
        });
      }
    });

    it('should not split before both are 65', () => {
      // Using birthdates that make spouse clearly under 65 for several years
      const input = createCoupleProjectionInput(
        {
          birthdate: new Date(1961, 0, 1), // 65 in 2026
          rrifBalance: 500000,
        },
        {
          birthdate: new Date(1971, 0, 1), // 55 in 2026 - under 65 until 2036
        }
      );

      const result = runCoupleProjection(input);

      // First 8 years spouse is under 65 (55-62)
      const firstEightYears = result.yearlyResults.slice(0, 8);
      firstEightYears.forEach((year) => {
        expect(year.pensionSplitPercentage).toBe(0);
      });
    });
  });

  describe('Staggered Retirement Timing', () => {
    it('should handle staggered retirement dates', () => {
      // Using birthdates that make them clearly pre-retirement in 2026
      const input = createCoupleProjectionInput(
        {
          birthdate: new Date(1971, 0, 1), // 55 in 2026
          retirementAge: 60,
          employmentIncome: 100000,
        },
        {
          birthdate: new Date(1973, 0, 1), // 53 in 2026
          retirementAge: 58,
          employmentIncome: 80000,
        }
      );

      const result = runCoupleProjection(input);

      // Year 0: both working (ages 55 and 53)
      expect(result.yearlyResults[0]?.primary.isRetired).toBe(false);
      expect(result.yearlyResults[0]?.spouse.isRetired).toBe(false);
      expect(result.yearlyResults[0]?.bothRetired).toBe(false);

      // Find year when both are retired
      const bothRetiredYear = result.yearlyResults.find((year) => year.bothRetired);
      expect(bothRetiredYear).toBeDefined();
    });

    it('should track income transition during retirement transition', () => {
      const input = createCoupleProjectionInput(
        {
          birthdate: new Date(1964, 0, 1),
          retirementAge: 62,
          employmentIncome: 120000,
        },
        {
          birthdate: new Date(1966, 0, 1),
          retirementAge: 65,
          employmentIncome: 90000,
        }
      );

      const result = runCoupleProjection(input);

      // Employment income should decrease over time as they retire. Household
      // gross income may include replacement withdrawals once cashflow is pooled.
      const earlyYears = result.yearlyResults.slice(0, 3);
      const laterYears = result.yearlyResults.slice(10, 13);

      const avgEarlyEmployment =
        earlyYears.reduce(
          (sum, y) => sum + y.primary.employmentIncome + y.spouse.employmentIncome,
          0
        ) / earlyYears.length;
      const avgLaterEmployment =
        laterYears.reduce(
          (sum, y) => sum + y.primary.employmentIncome + y.spouse.employmentIncome,
          0
        ) / laterYears.length;

      expect(avgEarlyEmployment).toBeGreaterThan(avgLaterEmployment);
    });
  });

  describe('RRIF Conversion Tracking', () => {
    it('should track RRIF conversion for each spouse', () => {
      const input = createCoupleProjectionInput(
        {
          birthdate: new Date(1959, 0, 1), // Will be 71 in 2030
          rrspBalance: 400000,
        },
        {
          birthdate: new Date(1961, 0, 1), // Will be 71 in 2032
          rrspBalance: 200000,
        }
      );

      const result = runCoupleProjection(input);

      // Find primary's RRIF conversion year (age 71)
      const primaryConversion = result.yearlyResults.find(
        (year) => year.primary.isRRIFConversionYear
      );
      expect(primaryConversion).toBeDefined();
      expect(primaryConversion?.primary.age).toBe(71);

      // Find spouse's RRIF conversion year (age 71)
      const spouseConversion = result.yearlyResults.find(
        (year) => year.spouse.isRRIFConversionYear
      );
      expect(spouseConversion).toBeDefined();
      expect(spouseConversion?.spouse.age).toBe(71);
    });

    it('should flag eitherRRIFConversion correctly', () => {
      const input = createCoupleProjectionInput(
        {
          birthdate: new Date(1953, 0, 1), // 71 in 2024
          rrspBalance: 500000,
        },
        {
          birthdate: new Date(1959, 0, 1), // 65 in 2024
        }
      );

      const result = runCoupleProjection(input);

      const conversionYear = result.yearlyResults[0];
      expect(conversionYear?.eitherRRIFConversion).toBe(true);
    });

    it('should reduce the spouse RRIF minimum when the younger-spouse election is enabled', () => {
      const startYear = getCurrentYear();
      const withoutElection = createCoupleProjectionInput(
        {
          birthdate: new Date(startYear - 65, 0, 1),
          retirementAge: 65,
          tfsaBalance: 200000,
          nonRegBalance: 0,
          retirementSpending: 0,
          coupleSettings: {
            optimizePensionSplitting: false,
            sharedRetirementSpending: 0,
            useYoungerSpouseForRRIF: false,
          },
        },
        {
          birthdate: new Date(startYear - 74, 0, 1),
          retirementAge: 65,
          rrspBalance: 0,
          rrifBalance: 500000,
          tfsaBalance: 100000,
          employmentIncome: 0,
        }
      );

      const withElection = createCoupleProjectionInput(
        {
          birthdate: withoutElection.birthdate,
          retirementAge: withoutElection.retirementAge,
          rrspBalance: withoutElection.rrspBalance,
          tfsaBalance: withoutElection.tfsaBalance,
          nonRegBalance: withoutElection.nonRegBalance,
          retirementSpending: withoutElection.retirementSpending,
          coupleSettings: {
            optimizePensionSplitting: false,
            sharedRetirementSpending: 0,
            useYoungerSpouseForRRIF: true,
          },
        },
        {
          birthdate: withoutElection.spouse?.birthdate ?? new Date(startYear - 65, 0, 1),
          retirementAge: withoutElection.spouse?.retirementAge ?? 65,
          rrspBalance: withoutElection.spouse?.rrspBalance ?? 0,
          rrifBalance: withoutElection.spouse?.rrifBalance ?? 0,
          tfsaBalance: withoutElection.spouse?.tfsaBalance ?? 0,
          employmentIncome: withoutElection.spouse?.employmentIncome ?? 0,
        }
      );

      const withoutElectionResult = runCoupleProjection(withoutElection);
      const withElectionResult = runCoupleProjection(withElection);

      const firstYearWithoutElection = withoutElectionResult.yearlyResults[0];
      const firstYearWithElection = withElectionResult.yearlyResults[0];

      expect(firstYearWithoutElection).toBeDefined();
      expect(firstYearWithElection).toBeDefined();
      expect(firstYearWithElection?.spouse.rrifWithdrawal).toBeLessThan(
        firstYearWithoutElection?.spouse.rrifWithdrawal ?? Infinity
      );
    });
  });

  describe('Younger-Spouse RRIF Wire Gap (TC-RRIF-018, TC-RRIF-019)', () => {
    /**
     * TC-RRIF-018: End-to-end couple projection with useYoungerSpouseForRRIF=true
     * confirms the flag reaches calculatePersonYear via multi-year.ts -> couple-calculator.ts.
     * Owner age 75, spouse age 65; election active -> rrifMinimumRate = 0.04 (spouse age rate).
     * @see docs/source-of-truth/02-account-types.md - RRIF-002
     * @see docs/TESTABLE-SURFACES.md - TC-RRIF-018
     */
    it('TC-RRIF-018: active younger-spouse election uses spouse age rate in end-to-end projection', () => {
      const startYear = getCurrentYear();
      const input = createCoupleProjectionInput(
        {
          birthdate: new Date(startYear - 75, 0, 1), // primary age 75
          lifeExpectancy: 76,
          retirementAge: 60,
          employmentIncome: 0,
          rrspBalance: 0,
          rrifBalance: 500000,
          tfsaBalance: 0,
          nonRegBalance: 0,
          rrspAnnualContribution: 0,
          tfsaAnnualContribution: 0,
          retirementSpending: 0,
          investmentReturn: 0,
          inflationRate: 0,
          expectedCPPAt65: 0,
          cppStartAge: 65,
          oasStartAge: 70,
          coupleSettings: {
            optimizePensionSplitting: false,
            sharedRetirementSpending: 0,
            useYoungerSpouseForRRIF: true,
          },
        },
        {
          birthdate: new Date(startYear - 65, 0, 1), // spouse age 65 — 10 years younger
          lifeExpectancy: 80,
          retirementAge: 65,
          employmentIncome: 0,
          expectedCPPAt65: 0,
          cppStartAge: 65,
          oasStartAge: 70,
          rrspBalance: 0,
          tfsaBalance: 0,
          nonRegBalance: 0,
        }
      );

      const result = runCoupleProjection(input);
      const firstYear = result.yearlyResults[0];

      expect(firstYear).toBeDefined();
      // Spouse age 65 -> rate 0.04; owner age 75 -> rate 0.0582 without election
      // Election active: must use spouse's rate
      expect(firstYear?.primary.rrifMinimumRate).toBe(0.04);
    });

    /**
     * TC-RRIF-019: After spouse death the useYoungerSpouseForRRIF election lapses.
     * Owner age 75 in year 1 (election active -> rate 0.04), spouse dies after year 1.
     * Year 2: owner age 76, election inactive -> rate 0.0598 (own age rate).
     * @see docs/source-of-truth/02-account-types.md - RRIF-002
     * @see docs/TESTABLE-SURFACES.md - TC-RRIF-019
     */
    it('TC-RRIF-019: younger-spouse election lapses in the year following spouse death', () => {
      const startYear = getCurrentYear();
      const input = createCoupleProjectionInput(
        {
          birthdate: new Date(startYear - 75, 0, 1), // primary age 75
          lifeExpectancy: 77,
          retirementAge: 60,
          employmentIncome: 0,
          rrspBalance: 0,
          rrifBalance: 500000,
          tfsaBalance: 0,
          nonRegBalance: 0,
          rrspAnnualContribution: 0,
          tfsaAnnualContribution: 0,
          retirementSpending: 0,
          investmentReturn: 0,
          inflationRate: 0,
          expectedCPPAt65: 0,
          cppStartAge: 65,
          oasStartAge: 70,
          coupleSettings: {
            optimizePensionSplitting: false,
            sharedRetirementSpending: 0,
            useYoungerSpouseForRRIF: true,
          },
        },
        {
          birthdate: new Date(startYear - 65, 0, 1), // spouse age 65
          lifeExpectancy: 65, // dies after year 1
          retirementAge: 65,
          employmentIncome: 0,
          expectedCPPAt65: 0,
          cppStartAge: 65,
          oasStartAge: 70,
          rrspBalance: 0,
          tfsaBalance: 0,
          nonRegBalance: 0,
        }
      );

      const result = runCoupleProjection(input);

      // Year 1: spouse alive, election active -> rate for age 65 = 0.04
      const year1 = result.yearlyResults[0];
      expect(year1).toBeDefined();
      expect(year1?.primary.rrifMinimumRate).toBe(0.04);

      // Year 2: spouse deceased, election must lapse -> rate for owner age 76 = 0.0598
      const year2 = result.yearlyResults[1];
      expect(year2).toBeDefined();
      expect(year2?.primary.rrifMinimumRate).toBe(0.0598);
    });
  });

  describe('TFSA restored room', () => {
    it('should carry restored TFSA room into the next retired year for a spouse re-contribution', () => {
      const startYear = getCurrentYear();
      const result = runCoupleProjection(
        createCoupleProjectionInput(
          {
            birthdate: new Date(startYear - 64, 0, 1),
            lifeExpectancy: 65,
            retirementAge: 60,
            employmentIncome: 0,
            rrspBalance: 0,
            tfsaBalance: 1,
            nonRegBalance: 0,
            rrspAnnualContribution: 0,
            tfsaAnnualContribution: 0,
            retirementSpending: 15000,
            investmentReturn: 0,
            inflationRate: 0,
            expectedCPPAt65: 15000,
            cppStartAge: 64,
            oasStartAge: 70,
            // FIX-04/FIX-05: sharedRetirementSpending/2 becomes perPersonSpending.
            // Omit it so perPersonSpending falls back to input.retirementSpending (15000 each).
            coupleSettings: {
              optimizePensionSplitting: false,
              useYoungerSpouseForRRIF: false,
            },
          },
          {
            birthdate: new Date(startYear - 64, 0, 1),
            lifeExpectancy: 65,
            retirementAge: 60,
            employmentIncome: 0,
            expectedCPPAt65: 15000,
            cppStartAge: 65,
            oasStartAge: 70,
            rrspBalance: 0,
            tfsaBalance: 20000,
            tfsaAnnualContribution: 20000,
            nonRegBalance: 0,
          }
        )
      );

      expect(result.yearlyResults.length).toBeGreaterThanOrEqual(2);

      const yearOne = result.yearlyResults[0];
      const yearTwo = result.yearlyResults[1];

      expect(yearOne?.spouse.age).toBe(64);
      expect(yearOne?.spouse.tfsaWithdrawal).toBe(15000);
      expect(yearOne?.spouse.tfsaBalance).toBe(12000);

      expect(yearTwo?.spouse.age).toBe(65);
      expect(yearTwo?.spouse.tfsaWithdrawal).toBe(0);
      expect(yearTwo?.spouse.tfsaBalance).toBe(32000);
    });
  });

  describe('Ontario LIF prior-year return in projection state', () => {
    it('should use the initial Ontario prior-year return input in the first projected year', () => {
      const startYear = getCurrentYear();
      const result = runCoupleProjection(
        createCoupleProjectionInput(
          {
            birthdate: new Date(startYear - 75, 0, 1),
            lifeExpectancy: 75,
            retirementAge: 60,
            employmentIncome: 0,
            rrspBalance: 0,
            tfsaBalance: 0,
            nonRegBalance: 0,
            rrspAnnualContribution: 0,
            tfsaAnnualContribution: 0,
            retirementSpending: 100000,
            investmentReturn: 0.04,
            inflationRate: 0,
            expectedCPPAt65: 0,
            cppStartAge: 65,
            oasStartAge: 70,
            // FIX-04/FIX-05: omit sharedRetirementSpending so perPersonSpending
            // falls back to input.retirementSpending (100000 each), forcing the
            // spouse gap-fill to hit the Ontario LIF max (500000 * 0.12).
            coupleSettings: {
              optimizePensionSplitting: false,
              useYoungerSpouseForRRIF: false,
            },
          },
          {
            birthdate: new Date(startYear - 75, 0, 1),
            retirementAge: 60,
            lifeExpectancy: 75,
            employmentIncome: 0,
            expectedCPPAt65: 0,
            cppStartAge: 70,
            oasStartAge: 70,
            rrspBalance: 0,
            lifBalance: 500000,
            lifJurisdiction: 'ON',
            lifPriorYearReturnRate: 0.12,
            tfsaBalance: 0,
            nonRegBalance: 0,
          }
        )
      );

      const firstYear = result.yearlyResults[0];
      expect(firstYear?.spouse.age).toBe(75);
      expect(firstYear?.spouse.lifWithdrawal).toBeCloseTo(500000 * 0.12, 2);
    });

    it('should carry the current projected return into the next Ontario LIF year', () => {
      const startYear = getCurrentYear();
      const result = runCoupleProjection(
        createCoupleProjectionInput(
          {
            birthdate: new Date(startYear - 75, 0, 1),
            lifeExpectancy: 76,
            retirementAge: 60,
            employmentIncome: 0,
            rrspBalance: 0,
            tfsaBalance: 0,
            nonRegBalance: 0,
            rrspAnnualContribution: 0,
            tfsaAnnualContribution: 0,
            retirementSpending: 100000,
            investmentReturn: 0.04,
            inflationRate: 0,
            expectedCPPAt65: 0,
            cppStartAge: 65,
            oasStartAge: 70,
            // FIX-04/FIX-05: omit sharedRetirementSpending so perPersonSpending
            // falls back to input.retirementSpending (100000 each), forcing the
            // spouse gap-fill to hit the Ontario LIF max (500000 * 0.12).
            coupleSettings: {
              optimizePensionSplitting: false,
              useYoungerSpouseForRRIF: false,
            },
          },
          {
            birthdate: new Date(startYear - 75, 0, 1),
            retirementAge: 60,
            lifeExpectancy: 76,
            employmentIncome: 0,
            expectedCPPAt65: 0,
            cppStartAge: 70,
            oasStartAge: 70,
            rrspBalance: 0,
            lifBalance: 500000,
            lifJurisdiction: 'ON',
            lifPriorYearReturnRate: 0.12,
            tfsaBalance: 0,
            nonRegBalance: 0,
          }
        )
      );

      expect(result.yearlyResults).toHaveLength(2);

      const firstYear = result.yearlyResults[0];
      const secondYear = result.yearlyResults[1];

      expect(firstYear?.spouse.lifWithdrawal).toBeCloseTo(500000 * 0.12, 2);
      expect(secondYear?.spouse.age).toBe(76);
      expect(secondYear?.spouse.lifWithdrawal).toBeLessThan(
        firstYear?.spouse.lifWithdrawal ?? Infinity
      );
    });
  });

  describe('Different Provincial Tax Scenarios', () => {
    it('should handle spouses in same province', () => {
      const input = createCoupleProjectionInput(
        {
          province: 'ON',
        },
        {
          province: 'ON',
        }
      );

      const result = runCoupleProjection(input);

      expect(result.yearlyResults.length).toBeGreaterThan(0);
      expect(result.summary.totalTaxesPaid).toBeGreaterThan(0);
    });

    it('should handle spouses in different provinces', () => {
      const input = createCoupleProjectionInput(
        {
          province: 'ON',
        },
        {
          province: 'AB',
        }
      );

      const result = runCoupleProjection(input);

      expect(result.yearlyResults.length).toBeGreaterThan(0);

      // Both should have their own tax calculations
      result.yearlyResults.forEach((year) => {
        expect(year.primary.taxCalculation).toBeDefined();
        expect(year.spouse.taxCalculation).toBeDefined();
      });
    });
  });

  describe('Real-world Couple Scenarios', () => {
    it('should project well-funded Canadian couple to successful retirement', () => {
      const input = createCoupleProjectionInput(
        {
          birthdate: new Date(1969, 0, 1), // 55
          lifeExpectancy: 90,
          retirementAge: 62,
          employmentIncome: 120000,
          rrspBalance: 500000,
          tfsaBalance: 100000,
          nonRegBalance: 150000,
          rrspAnnualContribution: 20000,
          tfsaAnnualContribution: 7000,
          expectedCPPAt65: 15000,
          coupleSettings: {
            optimizePensionSplitting: true,
            sharedRetirementSpending: 60000,
            useYoungerSpouseForRRIF: false,
          },
        },
        {
          birthdate: new Date(1971, 0, 1), // 53
          retirementAge: 60,
          lifeExpectancy: 92,
          employmentIncome: 90000,
          expectedCPPAt65: 12000,
          rrspBalance: 350000,
          tfsaBalance: 80000,
          rrspAnnualContribution: 15000,
          tfsaAnnualContribution: 7000,
        }
      );

      const result = runCoupleProjection(input);

      // Should have successful projection
      expect(result.summary.moneyLastsToLifeExpectancy).toBe(true);
      expect(result.summary.peakNetWorth).toBeGreaterThan(1000000);
      expect(result.summary.averageRetirementIncome).toBeGreaterThan(40000);
    });

    it('should project underfunded couple with early money depletion', () => {
      const input = createCoupleProjectionInput(
        {
          birthdate: new Date(1964, 0, 1), // 60
          lifeExpectancy: 95,
          retirementAge: 60,
          employmentIncome: 0,
          rrspBalance: 100000,
          tfsaBalance: 20000,
          nonRegBalance: 10000,
          expectedCPPAt65: 8000,
          coupleSettings: {
            optimizePensionSplitting: true,
            sharedRetirementSpending: 70000, // High spending
            useYoungerSpouseForRRIF: false,
          },
        },
        {
          birthdate: new Date(1966, 0, 1), // 58
          retirementAge: 58,
          lifeExpectancy: 93,
          employmentIncome: 0,
          expectedCPPAt65: 6000,
          rrspBalance: 50000,
          tfsaBalance: 10000,
        }
      );

      const result = runCoupleProjection(input);

      // Should run out of money
      expect(result.summary.moneyLastsToLifeExpectancy).toBe(false);
      expect(result.summary.portfolioLongevityAge).toBeDefined();
      expect(result.summary.portfolioLongevityAge).toBeLessThan(90);
    });
  });
});
