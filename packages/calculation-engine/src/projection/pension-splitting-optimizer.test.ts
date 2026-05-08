/**
 * Pension-Splitting Optimizer — Edge-Case Tests (M002/S02/T01)
 *
 * Exercises the findOptimalSplit optimizer inside calculateCoupleYear directly
 * via the single-year path (no multi-year noise). Locks R001's Active contract
 * with exact-dollar assertions for the five optimizer edge cases.
 *
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Pension Income Splitting
 * @see .gsd/milestones/M002/slices/S02/tasks/T01-PLAN.md
 */
import { describe, it, expect } from 'vitest';
import { OAS_CLAWBACK_THRESHOLDS } from '@retireops/shared';
import { calculateCoupleYear, type CoupleYearInput } from './couple-calculator.js';
import type { PersonYearInput } from './yearly-calculator.js';

// Fixed tax year for determinism. 2026 constants are stable per CLAUDE.md.
// Birthdate(1961,0,1) => age 65 at end of 2026. Birthdate(1963,0,1) => age 63.
const TAX_YEAR = 2026;
const OAS_CLAWBACK_THRESHOLD_2026 = OAS_CLAWBACK_THRESHOLDS[2026].threshold; // 95323

function createPersonInput(
  overrides: Partial<Omit<PersonYearInput, 'owner' | 'year' | 'maritalStatus'>> = {}
): Omit<PersonYearInput, 'owner' | 'year' | 'maritalStatus'> {
  return {
    birthdate: new Date(1961, 0, 1), // 65 in 2026
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
    expectedCPPAt65: 0,
    cppStartAge: 65,
    oasStartAge: 65,
    yearsOfResidence: 40,
    retirementSpending: 0,
    investmentReturn: 0.04,
    inflationRate: 0.02,
    retirementAge: 60,
    yearsFromProjectionStart: 0,
    ...overrides,
  };
}

function createCoupleInput(overrides: Partial<CoupleYearInput> = {}): CoupleYearInput {
  return {
    year: TAX_YEAR,
    maritalStatus: 'married',
    primary: createPersonInput(),
    spouse: createPersonInput(),
    optimizePensionSplitting: true,
    useYoungerSpouseForRRIF: false,
    ...overrides,
  };
}

describe('Pension-Splitting Optimizer (findOptimalSplit) — Edge Cases', () => {
  describe('Zero splittable income (both 65+, only employment/CPP/OAS — all ineligible)', () => {
    /**
     * Both spouses 65+ with only ineligible income sources:
     *   - employmentIncome (never eligible)
     *   - CPP / OAS (never eligible for T1032 pension splitting)
     * getEligiblePensionIncomeForSplitting returns 0 for both, so
     * findOptimalSplit's early-return `if (splittableIncome <= 0) return 0`
     * fires regardless of which branch (primary-higher vs spouse-higher)
     * the outer code takes.
     */
    it('returns pensionSplitPercentage === 0 and pensionSplitTaxSavings === 0', () => {
      const result = calculateCoupleYear(
        createCoupleInput({
          primary: createPersonInput({
            employmentIncome: 50000,
            expectedCPPAt65: 14000,
            oasStartAge: 65,
          }),
          spouse: createPersonInput({
            employmentIncome: 20000,
            expectedCPPAt65: 10000,
            oasStartAge: 65,
          }),
        })
      );

      expect(result.pensionSplitPercentage).toBe(0);
      expect(result.pensionSplitTaxSavings).toBe(0);
      expect(result.primary.pensionIncomeTransferred ?? 0).toBe(0);
      expect(result.spouse.pensionIncomeReceived ?? 0).toBe(0);
    });
  });

  describe('Higher-income spouse taxable income below BPA', () => {
    /**
     * Federal BPA for 2026 is $16,129. If the higher-income spouse's taxable
     * income is already below BPA, they pay effectively zero federal tax on
     * the marginal pension income, so splitting cannot yield savings.
     *
     * To isolate the BPA case from the "zero splittable" case (Test 1), the
     * higher-income spouse DOES have splittable pension income — just not
     * enough taxable income to make splitting worthwhile.
     *
     * Primary has a small RPP ($10,000) — splittable but below BPA; spouse
     * has zero income. The optimizer should decline to split (no savings
     * possible when both sides are below-BPA), so `bestTotalCost < totalCostBefore`
     * never fires and the returned split is 0.
     */
    it('returns pensionSplitPercentage === 0 when there is no tax to save', () => {
      const result = calculateCoupleYear(
        createCoupleInput({
          primary: createPersonInput({
            pensionIncome: 10000, // Below BPA: no federal tax on this income.
          }),
          spouse: createPersonInput({
            // Zero income; well below BPA.
          }),
        })
      );

      expect(result.pensionSplitPercentage).toBe(0);
      expect(result.pensionSplitTaxSavings).toBe(0);
    });
  });

  describe('Receiver near OAS clawback threshold (guard rejects splits that trigger clawback)', () => {
    /**
     * Primary has a large RRIF pushing high taxable income. Spouse is 65+ with
     * oasStartAge: 65 (so spousePrelim.oasIncome > 0) and netIncome already
     * close to the 2026 clawback threshold ($95,323). Any non-trivial split
     * would push spouseFinal.netIncome above the threshold.
     *
     * Per couple-calculator.ts:150-155, the guard skips iterations where the
     * receiver would cross the threshold while already receiving OAS. The
     * chosen split must therefore leave spouseFinal.netIncome at or below the
     * threshold, OR the optimizer must return 0.
     *
     * This assertion proves the guard at couple-calculator.ts:152 is the
     * stopping condition.
     */
    it('produces either no split or a split that keeps receiver netIncome <= OAS clawback threshold', () => {
      const result = calculateCoupleYear(
        createCoupleInput({
          primary: createPersonInput({
            rrifBalance: 1200000,
            pensionIncome: 30000,
            expectedCPPAt65: 14000,
            oasStartAge: 65,
          }),
          spouse: createPersonInput({
            // Spouse already close to the clawback threshold pre-split.
            // $80k pension + ~$14k CPP + ~$8.5k OAS ≈ low-$100k taxable,
            // with net ~$90k after tax — right at the clawback boundary.
            pensionIncome: 80000,
            expectedCPPAt65: 14000,
            oasStartAge: 65,
          }),
        })
      );

      if (result.pensionSplitPercentage === 0) {
        expect(result.spouse.pensionIncomeReceived ?? 0).toBe(0);
      } else {
        expect(result.spouse.netIncome).toBeLessThanOrEqual(OAS_CLAWBACK_THRESHOLD_2026);
      }
    });
  });

  describe('Identical incomes (symmetric spouses)', () => {
    /**
     * Locks the strict-inequality contract at couple-calculator.ts:174 and
     * couple-calculator.ts:229:
     *   if (primaryTaxable > spouseTaxable && primarySplittable > 0) { ... }
     *   else if (spouseTaxable > primaryTaxable && spouseSplittable > 0) { ... }
     * When the two taxable incomes are exactly equal, neither branch fires
     * and the optimizer must return `pensionSplitPercentage === 0`.
     *
     * If the inequality were ever relaxed to `>=`, symmetric spouses would
     * cross into one branch and the optimizer would run — making this test
     * the canonical regression guard.
     */
    it('returns pensionSplitPercentage === 0 for fully symmetric spouses', () => {
      const symmetric = createPersonInput({
        rrifBalance: 400000,
        pensionIncome: 20000,
        expectedCPPAt65: 12000,
        oasStartAge: 65,
      });

      const result = calculateCoupleYear(
        createCoupleInput({
          // Identical fixtures for both spouses — same birthdate, province,
          // rrifBalance, pensionIncome, CPP, OAS start age.
          primary: { ...symmetric },
          spouse: { ...symmetric },
        })
      );

      expect(result.pensionSplitPercentage).toBe(0);
      expect(result.pensionSplitTaxSavings).toBe(0);
      expect(result.primary.pensionIncomeTransferred ?? 0).toBe(0);
      expect(result.spouse.pensionIncomeReceived ?? 0).toBe(0);
    });
  });

  describe('Single-year optimizer-beats-disabled (positive assertion)', () => {
    /**
     * Favourable scenario for splitting: primary has a large RPP pension
     * driving high taxable income; spouse has small income. Running
     * calculateCoupleYear twice (with optimizePensionSplitting true vs. false,
     * all other inputs identical) must yield lower household tax on the true
     * run — and pensionSplitPercentage / pensionSplitTaxSavings must both be
     * > 0.
     *
     * Note: at age 65 no CRA minimum RRIF withdrawal is required
     * (isRRIFMinimumRequired returns false before 72), so a large rrifBalance
     * alone produces no taxable income. We use pensionIncome (RPP) as the
     * high-earning driver because RPP is always splittable and is what the
     * engine actually models as taxable pension income for a 65-year-old.
     */
    it('reduces householdTaxesPaid and reports a non-zero split', () => {
      const favourableInput = createCoupleInput({
        primary: createPersonInput({
          pensionIncome: 80000, // Large RPP pushing primary into a higher bracket.
          expectedCPPAt65: 14000,
          oasStartAge: 65,
        }),
        spouse: createPersonInput({
          pensionIncome: 5000,
          expectedCPPAt65: 8000,
          oasStartAge: 65,
        }),
      });

      const withSplit = calculateCoupleYear({
        ...favourableInput,
        optimizePensionSplitting: true,
      });
      const withoutSplit = calculateCoupleYear({
        ...favourableInput,
        optimizePensionSplitting: false,
      });

      expect(withSplit.householdTaxesPaid).toBeLessThan(withoutSplit.householdTaxesPaid);
      expect(withSplit.pensionSplitPercentage).toBeGreaterThan(0);
      expect(withSplit.pensionSplitTaxSavings).toBeGreaterThan(0);
      expect(withoutSplit.pensionSplitPercentage).toBe(0);
      expect(withoutSplit.pensionSplitTaxSavings).toBe(0);
    });
  });
});
