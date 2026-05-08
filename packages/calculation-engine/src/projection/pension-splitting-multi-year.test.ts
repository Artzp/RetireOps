/**
 * Pension-Splitting Multi-Year Integration Tests (M002/S02/T02)
 *
 * Exercises pension-splitting behavior across the full multi-year projection
 * via `runCoupleProjection`. Locks R001's Active contract for three multi-year
 * surfaces that the single-year optimizer tests (T01) cannot reach:
 *
 *   1. Spouse death mid-projection: post-death years must degrade splitting
 *      to zero (`multi-year.ts:891` — optimizePensionSplitting forced false
 *      once either spouse is deceased) while keeping household numbers finite.
 *   2. Summary aggregation consistency: `totalPensionSplitTaxSavings` and
 *      `averagePensionSplitPercentage` must match the filtered sums/averages
 *      over years where `pensionSplitPercentage > 0`
 *      (`multi-year.ts:1102-1106`, `1124-1127`, `1184-1185`).
 *   3. Full-projection optimizer-beats-disabled: running the same input twice
 *      with `optimizePensionSplitting` true vs. false must yield strictly
 *      lower `totalTaxesPaid` on the optimized run.
 *
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Pension Income Splitting
 * @see .gsd/milestones/M002/slices/S02/tasks/T02-PLAN.md
 */
import { describe, it, expect } from 'vitest';
import { runCoupleProjection } from './multi-year.js';
import { getCurrentYear, type ProjectionInput, type SpouseInput } from '@retireops/shared';

/**
 * Local mirror of `createCoupleProjectionInput` from couple-projection.test.ts.
 * Replicated (not imported) to keep this file self-contained; the pattern is
 * already proven by the sibling suite.
 */
function createCoupleProjectionInput(
  overrides: Partial<ProjectionInput> = {},
  spouseOverrides: Partial<SpouseInput> = {}
): ProjectionInput {
  const startYear = getCurrentYear();
  const spouse: SpouseInput = {
    birthdate: new Date(startYear - 65, 0, 1),
    retirementAge: 63,
    lifeExpectancy: 88,
    employmentIncome: 0,
    expectedCPPAt65: 10000,
    rrspBalance: 200000,
    tfsaBalance: 50000,
    ...spouseOverrides,
  };

  return {
    birthdate: new Date(startYear - 65, 0, 1),
    province: 'ON',
    lifeExpectancy: 90,
    retirementAge: 65,
    employmentIncome: 0,
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

describe('Pension Splitting Multi-Year Integration', () => {
  describe('Spouse death mid-projection degrades splitting to zero', () => {
    /**
     * Both spouses start age 65 with eligible RPP pension income, so the
     * optimizer WOULD run every year if both were alive. We set the spouse's
     * lifeExpectancy to 70 (primary lives to 80) so the spouse dies mid-run
     * and `spouseDeceased` flips true partway through the projection.
     *
     * multi-year.ts:891 forces `optimizePensionSplitting: false` once either
     * spouse is deceased, so every post-death year must report
     * `pensionSplitPercentage === 0` and `pensionSplitTaxSavings === 0`.
     * Household numbers must remain finite (no NaN) through the survivor
     * years to prove the degradation path doesn't break downstream math.
     *
     * spouseEndYear = startYear + (spouseLifeExpectancy - spouseStartAge)
     *               = startYear + (70 - 65) = startYear + 5
     * so the spouse is deceased for all `year > startYear + 5`.
     */
    it('reports zero split and finite household numbers for every year after spouseEndYear', () => {
      const startYear = getCurrentYear();
      const input = createCoupleProjectionInput(
        {
          birthdate: new Date(startYear - 65, 0, 1),
          lifeExpectancy: 80,
          retirementAge: 60,
          employmentIncome: 0,
          rrspBalance: 0,
          rrifBalance: 600000,
          pensionIncome: 60000,
          tfsaBalance: 0,
          nonRegBalance: 0,
          rrspAnnualContribution: 0,
          tfsaAnnualContribution: 0,
          retirementSpending: 30000,
          investmentReturn: 0.03,
          inflationRate: 0,
          expectedCPPAt65: 14000,
          cppStartAge: 65,
          oasStartAge: 65,
          coupleSettings: {
            optimizePensionSplitting: true,
            sharedRetirementSpending: 50000,
            useYoungerSpouseForRRIF: false,
          },
        },
        {
          birthdate: new Date(startYear - 65, 0, 1),
          retirementAge: 60,
          lifeExpectancy: 70, // Dies 5 years in
          employmentIncome: 0,
          pensionIncome: 5000,
          expectedCPPAt65: 10000,
          cppStartAge: 65,
          oasStartAge: 65,
          rrspBalance: 0,
          tfsaBalance: 0,
          nonRegBalance: 0,
        }
      );

      const result = runCoupleProjection(input);
      const spouseEndYear = startYear + (70 - 65);

      // Sanity: projection must actually span past spouse death.
      const postDeathYears = result.yearlyResults.filter((y) => y.year > spouseEndYear);
      expect(postDeathYears.length).toBeGreaterThan(0);

      postDeathYears.forEach((year) => {
        expect(year.pensionSplitPercentage).toBe(0);
        expect(year.pensionSplitTaxSavings).toBe(0);
        expect(Number.isFinite(year.householdTaxesPaid)).toBe(true);
        expect(Number.isFinite(year.householdNetWorth)).toBe(true);
      });
    });
  });

  describe('Multi-year aggregation consistency', () => {
    /**
     * Summary `totalPensionSplitTaxSavings` and `averagePensionSplitPercentage`
     * are computed in multi-year.ts:1102-1127 by a **filtered** reduction over
     * years with `pensionSplitPercentage > 0`. The filter at line 1104 is the
     * contract — the test reconstructs the same filtered sums and asserts the
     * summary matches.
     *
     * Favourable fixture: both spouses 65+ with RPP pension income on primary
     * and small income on spouse, plus the `rrspBalance: 0, rrifBalance: 800000`
     * pattern from couple-projection.test.ts:209. This guarantees at least
     * some years where the optimizer finds a positive split, exercising the
     * aggregation path (not the trivial `pensionSplitYears === 0` fallback).
     */
    it('summary.totalPensionSplitTaxSavings equals sum over years where pensionSplitPercentage > 0', () => {
      const startYear = getCurrentYear();
      const input = createCoupleProjectionInput(
        {
          birthdate: new Date(startYear - 65, 0, 1),
          lifeExpectancy: 85,
          rrspBalance: 0,
          rrifBalance: 800000,
          pensionIncome: 50000,
        },
        {
          birthdate: new Date(startYear - 65, 0, 1),
          lifeExpectancy: 85,
          employmentIncome: 0,
          pensionIncome: 5000,
        }
      );

      const result = runCoupleProjection(input);

      const splittingYears = result.yearlyResults.filter((y) => y.pensionSplitPercentage > 0);

      // Fixture must produce at least one splitting year — otherwise the
      // filtered-aggregation path is not being exercised and the assertions
      // below are meaningless.
      expect(splittingYears.length).toBeGreaterThan(0);

      const expectedTotalSavings = splittingYears.reduce(
        (sum, y) => sum + y.pensionSplitTaxSavings,
        0
      );
      const expectedAveragePercentage =
        splittingYears.reduce((sum, y) => sum + y.pensionSplitPercentage, 0) /
        splittingYears.length;

      expect(result.summary.totalPensionSplitTaxSavings).toBeCloseTo(expectedTotalSavings, 2);
      expect(result.summary.averagePensionSplitPercentage).toBeCloseTo(
        expectedAveragePercentage,
        2
      );
    });
  });

  describe('Full-projection optimizer-beats-disabled', () => {
    /**
     * Same favourable couple run twice — once with `optimizePensionSplitting`
     * true, once false, every other input identical. The optimizer must
     * strictly reduce `summary.totalTaxesPaid` and produce positive
     * `totalPensionSplitTaxSavings`; the disabled run must report zero split
     * savings.
     *
     * This is the multi-year counterpart to T01's single-year
     * "optimizer-beats-disabled" assertion and locks the R001 Active contract
     * that engine-driven splitting is load-bearing on household tax outcomes.
     */
    it('strictly reduces total household taxes when optimizePensionSplitting is true', () => {
      const startYear = getCurrentYear();
      const baseOverrides: Partial<ProjectionInput> = {
        birthdate: new Date(startYear - 65, 0, 1),
        lifeExpectancy: 85,
        rrspBalance: 0,
        rrifBalance: 800000,
        pensionIncome: 50000,
      };
      const baseSpouseOverrides: Partial<SpouseInput> = {
        birthdate: new Date(startYear - 65, 0, 1),
        lifeExpectancy: 85,
        employmentIncome: 0,
        pensionIncome: 5000,
      };

      const withSplit = runCoupleProjection(
        createCoupleProjectionInput(
          {
            ...baseOverrides,
            coupleSettings: {
              optimizePensionSplitting: true,
              sharedRetirementSpending: 55000,
              useYoungerSpouseForRRIF: false,
            },
          },
          baseSpouseOverrides
        )
      );

      const withoutSplit = runCoupleProjection(
        createCoupleProjectionInput(
          {
            ...baseOverrides,
            coupleSettings: {
              optimizePensionSplitting: false,
              sharedRetirementSpending: 55000,
              useYoungerSpouseForRRIF: false,
            },
          },
          baseSpouseOverrides
        )
      );

      expect(withSplit.summary.totalTaxesPaid).toBeLessThan(withoutSplit.summary.totalTaxesPaid);
      expect(withSplit.summary.totalPensionSplitTaxSavings).toBeGreaterThan(0);
      expect(withoutSplit.summary.totalPensionSplitTaxSavings).toBe(0);
    });
  });
});
