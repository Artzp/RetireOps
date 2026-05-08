/**
 * Couple Year Calculator
 * @see docs/source-of-truth/08-projection-engine.md
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Pension Income Splitting
 */
import type {
  CoupleYearlyResult,
  PersonYearlyResult,
  ProvinceCode,
  MaritalStatus,
} from '@retireops/shared';
import { ageAtEndOfYear } from '@retireops/shared';
import type { PersonYearInput } from './yearly-calculator.js';
import { calculateTotalTax, type TaxCalculationInput } from '../tax/index.js';
import { computeCouplePrelim } from './orchestration/couple-prelim-pass.js';
import { computeCouplePensionSplit } from './orchestration/couple-pension-split-pass.js';

// Re-exported to preserve the public surface used by orchestration/spousal-rrsp-attribution.ts
export { recalculateTaxWithPensionSplit } from './orchestration/pension-split-optimizer.js';

/**
 * Input for calculating a couple's yearly projection
 */
export interface CoupleYearInput {
  year: number;
  maritalStatus: MaritalStatus;

  // Primary person input
  primary: Omit<PersonYearInput, 'owner' | 'year' | 'maritalStatus'>;

  // Spouse input
  spouse: Omit<PersonYearInput, 'owner' | 'year' | 'maritalStatus'>;

  // Couple settings
  sharedRetirementSpending?: number;
  optimizePensionSplitting: boolean;
  useYoungerSpouseForRRIF: boolean;

  /**
   * TAX-03: User-chosen fixed income splitting (D-08, D-09, D-10).
   * When enabled, a fixed percentage of the primary's eligible pension/RRIF income
   * is moved to the spouse's taxable income. Overrides the engine's pension split
   * optimizer when set.
   * @see docs/source-of-truth/07-withdrawal-strategies.md - Pension Income Splitting
   */
  incomeSplitting?: {
    enabled: boolean;
    splitPercent: number;
  };

  /**
   * Household spending mode (couple-only).
   * - 'per-owner' (default when undefined): each spouse funds their own share from
   *    their own accounts. Owner-tagged overrides authoritative.
   * - 'household': when both spouses retired and one spouse's accounts cannot fully
   *    fund their spending share, the unfunded remainder is added to the other
   *    spouse's withdrawal gap and pulled from their accounts in tax-efficient order.
   *    Pension splitting unaffected.
   *
   * Absent → preserves additive-invariant (engine treats as 'per-owner').
   */
  householdSpendingMode?: 'per-owner' | 'household';
}

/**
 * Calculate a couple's combined yearly projection with optimization
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Pension Income Splitting
 */
export function calculateCoupleYear(input: CoupleYearInput): CoupleYearlyResult {
  const {
    year,
    maritalStatus,
    primary,
    spouse,
    optimizePensionSplitting,
    useYoungerSpouseForRRIF,
    incomeSplitting,
  } = input;

  // Calculate ages
  const primaryAge = ageAtEndOfYear(primary.birthdate, year);
  const spouseAge = ageAtEndOfYear(spouse.birthdate, year);

  // Determine if each spouse is receiving OAS
  const primaryReceivingOAS = primaryAge >= primary.oasStartAge;
  const spouseReceivingOAS = spouseAge >= spouse.oasStartAge;

  // Step 1: Calculate preliminary results for each spouse
  const primaryInput: PersonYearInput = {
    ...primary,
    owner: 'primary',
    year,
    maritalStatus,
    spouseReceivingOAS,
    ...(useYoungerSpouseForRRIF && { spouseAge }),
    useYoungerSpouseForRRIF,
  };

  const spouseInput: PersonYearInput = {
    ...spouse,
    owner: 'spouse',
    year,
    maritalStatus,
    spouseReceivingOAS: primaryReceivingOAS,
    ...(useYoungerSpouseForRRIF && { spouseAge: primaryAge }),
    useYoungerSpouseForRRIF,
  };

  // Step 1: Preliminary calculation with household-spending semantics
  const { primaryPrelim, spousePrelim } = computeCouplePrelim({
    primaryInput,
    spouseInput,
    primaryIsRetired: primaryAge >= primary.retirementAge,
    spouseIsRetired: spouseAge >= spouse.retirementAge,
    sharedRetirementSpending: input.sharedRetirementSpending,
    householdSpendingMode: input.householdSpendingMode,
  });

  // Step 2: Pension splitting — engine optimizer (both 65+) + TAX-03 user-chosen fixed split
  const {
    primaryFinal,
    spouseFinal,
    pensionSplitPct,
    pensionSplitSavings,
    appliedSplitPercent,
    useFixedSplit,
  } = computeCouplePensionSplit({
    primaryPrelim,
    spousePrelim,
    primaryAge,
    spouseAge,
    primaryProvince: primary.province,
    spouseProvince: spouse.province,
    year,
    optimizePensionSplitting,
    incomeSplitting,
    maritalStatus,
  });

  // Step 3: Calculate household aggregates
  const householdGrossIncome = primaryFinal.totalGrossIncome + spouseFinal.totalGrossIncome;
  const householdTaxesPaid = primaryFinal.taxesPaid + spouseFinal.taxesPaid;
  const householdNetIncome = householdGrossIncome - householdTaxesPaid;
  const householdLivingExpenses = primaryFinal.livingExpenses + spouseFinal.livingExpenses;
  const householdNetCashFlow = householdNetIncome - householdLivingExpenses;
  const householdNetWorth = primaryFinal.totalNetWorth + spouseFinal.totalNetWorth;

  return {
    year,

    // Individual results
    primary: primaryFinal,
    spouse: spouseFinal,

    // Household aggregates
    householdGrossIncome,
    householdNetIncome,
    householdTaxesPaid,
    householdLivingExpenses,
    householdNetCashFlow,
    householdNetWorth,

    // Optimization metrics
    // TAX-03g: when fixed split was applied, reflect the actual applied percentage for traceability
    pensionSplitPercentage: useFixedSplit ? appliedSplitPercent : pensionSplitPct,
    pensionSplitTaxSavings: pensionSplitSavings,

    // Flags
    bothRetired: primaryFinal.isRetired && spouseFinal.isRetired,
    eitherRRIFConversion: primaryFinal.isRRIFConversionYear || spouseFinal.isRRIFConversionYear,
  };
}

/**
 * CORR-03 / SCEN-07: Recalculate taxes after a spousal-RRSP 3-year-rule
 * attribution shift. Mirrors recalculateTaxWithPensionSplit (above) — same
 * shape, but the signed shift lands in attributedSpousalRRSPIncome rather
 * than pensionIncome. The attributed slice is intentionally NOT routed through
 * pensionIncome because CRA T1032 forbids pension splitting from transferring
 * attributed RRSP income back to the annuitant.
 *
 * Sign convention:
 *   attributionShift > 0  → contributor gains taxable income (call site: primary)
 *   attributionShift < 0  → annuitant loses taxable income (call site: spouse)
 *
 * The annuitant's RRIF withdrawal already counted in their preliminary tax
 * (rrifWithdrawal lands in pensionIncome at line 481 of the pension-split
 * helper, but here we keep the original prelim shape — pensionIncome,
 * rrifIncome, cppIncome, oasIncome, otherIncome are taken from the existing
 * result fields, and the negative shift in attributedSpousalRRSPIncome reduces
 * gross income to net out the attributed slice).
 *
 * WR-01 (Phase 8 review): When pension splitting AND in-window spousal-RRSP
 * attribution both fire in the same year, the prelim's pensionIncome /
 * rrifWithdrawal fields are the PRE-SPLIT values (couple-calculator.ts only
 * mutates pensionIncomeTransferred / pensionIncomeReceived / taxesPaid /
 * taxCalculation / netIncome / netCashFlow — not the underlying source
 * fields). Without compensating, this helper would silently undo the pension
 * split. The pensionSplitAdjustment parameter (signed: negative on the
 * transferor, positive on the receiver) re-applies the split inside the
 * pension/rrif aggregation so the recomputed tax reflects BOTH the T1032
 * split AND the s.146(8.3) attribution shift.
 *
 * Sign convention for pensionSplitAdjustment (matches recalculateTaxWithPensionSplit):
 *   pensionSplitAdjustment < 0  → transferor (loses income to spouse)
 *   pensionSplitAdjustment > 0  → receiver (gains income from spouse)
 *
 * D-11: carries forward existing capitalGains so realized non-reg gains stay
 * in the recomputed tax.
 *
 * @see docs/source-of-truth/02-account-types.md VR-RRSP-003
 * @see docs/source-of-truth/07-withdrawal-strategies.md
 */
export function recalculateTaxWithSpousalAttribution(
  result: PersonYearlyResult,
  attributionShift: number,
  province: ProvinceCode,
  pensionSplitAdjustment = 0
) {
  const taxInput: TaxCalculationInput = {
    year: result.year,
    owner: result.owner,
    province,
    age: result.age,
    employmentIncome: result.employmentIncome,
    // Preserve the prelim's pension/RRIF income on both sides; the attribution
    // adjustment is carried by attributedSpousalRRSPIncome only. (For the
    // primary, rrifIncome stays at 0 because the prelim's tax already used the
    // pensionIncome+rrifWithdrawal aggregation pattern from
    // recalculateTaxWithPensionSplit at line 481 when pension splitting fired;
    // when it did NOT fire, the original calculatePersonYear tax computation
    // already counted rrifWithdrawal — so we must also pass it here to avoid
    // dropping it from the recomputed total.)
    //
    // WR-01: pensionSplitAdjustment re-applies the T1032 split that
    // calculateCoupleYear baked into result.taxesPaid but not into the
    // underlying pensionIncome / rrifWithdrawal fields. Default 0 preserves
    // backward compatibility for callers that don't have a split to thread.
    pensionIncome: Math.max(
      0,
      result.pensionIncome + result.rrifWithdrawal + pensionSplitAdjustment
    ),
    rrifIncome: 0, // already included in pensionIncome above
    cppIncome: result.cppIncome,
    oasIncome: result.oasIncome,
    otherIncome: 0,
    interestIncome: 0,
    eligibleDividends: 0,
    nonEligibleDividends: 0,
    // D-11: carry forward realized capital gains from preliminary calculation
    capitalGains: result.taxCalculation.capitalGains,
    rrspContribution: 0,
    otherDeductions: 0,
    // The signed shift: contributor positive, annuitant negative
    attributedSpousalRRSPIncome: attributionShift,
  };

  return calculateTotalTax(taxInput);
}
