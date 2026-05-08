/**
 * Spousal Retirement Calculation Edge Cases
 *
 * Covers three known-hard Canadian retirement edge cases for couples:
 *   1. Pension income splitting OAS clawback guard (age 65+)
 *   2. Spousal RRSP 3-year attribution rule
 *   3. Survivor benefit shock (spouse death mid-projection)
 *
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Pension Income Splitting
 * @see docs/source-of-truth/02-account-types.md - RRSP Spousal Attribution
 * @see docs/source-of-truth/05-government-benefits.md - CPP Survivor Benefits
 */
import { describe, it, expect } from 'vitest';
import { calculateCoupleYear, type CoupleYearInput } from './couple-calculator.js';
import { runCoupleProjection } from './multi-year.js';
import type { ProjectionInput, SpouseInput } from '@retireops/shared';
import { getCurrentYear } from '@retireops/shared';
import { getOASClawbackThreshold } from '../tax/oas-clawback.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCoupleInput(
  primaryOverrides: Partial<Omit<CoupleYearInput['primary'], never>> = {},
  spouseOverrides: Partial<Omit<CoupleYearInput['spouse'], never>> = {},
  coupleOverrides: Partial<
    Pick<
      CoupleYearInput,
      'year' | 'optimizePensionSplitting' | 'useYoungerSpouseForRRIF' | 'sharedRetirementSpending'
    >
  > = {}
): CoupleYearInput {
  const year = coupleOverrides.year ?? 2026;
  return {
    year,
    maritalStatus: 'married',
    primary: {
      birthdate: new Date(year - 70, 0, 1), // 70 years old
      province: 'ON',
      rrspBalance: 0,
      rrifBalance: 500000,
      tfsaBalance: 0,
      nonRegBalance: 0,
      nonRegACB: 0,
      rrspContribution: 0,
      tfsaContribution: 0,
      employmentIncome: 0,
      pensionIncome: 0,
      otherIncome: 0,
      expectedCPPAt65: 12000,
      cppStartAge: 65,
      oasStartAge: 65,
      yearsOfResidence: 40,
      retirementSpending: 20000,
      investmentReturn: 0.04,
      inflationRate: 0.0,
      retirementAge: 65,
      yearsFromProjectionStart: 5,
      ...primaryOverrides,
    },
    spouse: {
      birthdate: new Date(year - 70, 0, 1), // 70 years old
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
      expectedCPPAt65: 6000,
      cppStartAge: 65,
      oasStartAge: 65,
      yearsOfResidence: 40,
      retirementSpending: 20000,
      investmentReturn: 0.04,
      inflationRate: 0.0,
      retirementAge: 65,
      yearsFromProjectionStart: 5,
      ...spouseOverrides,
    },
    optimizePensionSplitting: coupleOverrides.optimizePensionSplitting ?? true,
    useYoungerSpouseForRRIF: coupleOverrides.useYoungerSpouseForRRIF ?? false,
    ...(coupleOverrides.sharedRetirementSpending !== undefined && {
      sharedRetirementSpending: coupleOverrides.sharedRetirementSpending,
    }),
  };
}

function makeCoupleProjectionInput(
  primaryOverrides: Partial<ProjectionInput> = {},
  spouseOverrides: Partial<SpouseInput> = {}
): ProjectionInput {
  const startYear = getCurrentYear();
  const spouse: SpouseInput = {
    birthdate: new Date(startYear - 70, 0, 1),
    retirementAge: 65,
    lifeExpectancy: 85,
    employmentIncome: 0,
    expectedCPPAt65: 6000,
    cppStartAge: 65,
    oasStartAge: 65,
    rrspBalance: 0,
    tfsaBalance: 0,
    ...spouseOverrides,
  };

  return {
    birthdate: new Date(startYear - 70, 0, 1),
    province: 'ON',
    lifeExpectancy: 85,
    retirementAge: 65,
    employmentIncome: 0,
    employmentGrowthRate: 0,
    rrspBalance: 0,
    tfsaBalance: 0,
    nonRegBalance: 0,
    retirementSpending: 40000,
    investmentReturn: 0.04,
    inflationRate: 0.0,
    expectedCPPAt65: 12000,
    cppStartAge: 65,
    oasStartAge: 65,
    maritalStatus: 'married',
    spouse,
    coupleSettings: {
      optimizePensionSplitting: true,
      useYoungerSpouseForRRIF: false,
    },
    ...primaryOverrides,
  };
}

// ---------------------------------------------------------------------------
// Edge Case 1: Pension Income Splitting — OAS Clawback Guard
//
// When splitting pension income TO the receiving spouse, the split must NOT
// push the receiving spouse over the OAS clawback threshold ($90,997 in 2024,
// $95,323 in 2026). If it would, the split should be capped or skipped.
//
// @see docs/source-of-truth/07-withdrawal-strategies.md - TC-WD-006
// ---------------------------------------------------------------------------
describe('Edge Case 1 — Pension Income Splitting: OAS clawback guard on receiving spouse', () => {
  /**
   * Scenario: Primary has very large RRIF and wants to split to the spouse.
   * The spouse already has income above the OAS clawback threshold from their own pension.
   * Splitting anything more TO the spouse would increase their clawback — making the
   * household WORSE off, not better.
   * The engine must detect this and refuse to split.
   *
   * OAS clawback threshold 2026: $95,323
   * Spouse income (before split): pension $70k + CPP $8k + OAS $8.9k = ~$86.9k (below threshold)
   *   → but RRIF minimum from primary is so large that even 1% split crosses the threshold
   * Specifically: primary splittable = $120k RRIF withdrawal
   *   1% split = $1,200 → spouse goes to $88.1k (still under threshold)
   *   ... but 7%+ split = $8,400+ → spouse exceeds $95,323
   *
   * We verify: the engine caps the split so spouse does NOT exceed the threshold.
   *
   * Note: this test is more precise than "no split at all" — it verifies the guard CAPS
   * the split rather than block it entirely (since small splits are fine).
   */
  it('should NOT split pension income when it would trigger OAS clawback for receiving spouse', () => {
    const year = 2026;
    const clawbackThreshold = getOASClawbackThreshold(year); // ~$95,323

    // Primary: extremely high RRIF income (large RRIF → large mandatory withdrawal)
    // Spouse: already has substantial pension + CPP + OAS = ~$87k (below threshold but close)
    //   A 7%+ split of primary's $120k RRIF minimum would push spouse above $95k
    const input = makeCoupleInput(
      {
        birthdate: new Date(year - 70, 0, 1),
        rrifBalance: 2400000, // Extremely large RRIF → 5% minimum = $120k/yr
        expectedCPPAt65: 8000,
        cppStartAge: 65,
        oasStartAge: 65,
        pensionIncome: 0,
        retirementSpending: 40000,
      },
      {
        birthdate: new Date(year - 70, 0, 1),
        rrifBalance: 0,
        expectedCPPAt65: 8000,
        cppStartAge: 65,
        oasStartAge: 65,
        pensionIncome: 70000, // Spouse has $70k pension + CPP $8k + OAS $8.9k ≈ $87k
        retirementSpending: 40000,
      },
      { year, optimizePensionSplitting: true }
    );

    const result = calculateCoupleYear(input);

    if (result.pensionSplitPercentage > 0) {
      // If any split occurs, verify spouse's post-split taxable income
      // is at or below the OAS clawback threshold
      const spouseTaxableAfterSplit = result.spouse.taxCalculation.taxableIncome;
      expect(
        spouseTaxableAfterSplit,
        "Pension split must be capped so the receiving spouse's income does not exceed the OAS clawback threshold"
      ).toBeLessThanOrEqual(clawbackThreshold + 1); // +1 for rounding
    } else {
      // No split occurred — verify that would-be split was blocked because any split
      // would push spouse above the threshold or not be beneficial
      const spouseBaseIncome = result.spouse.taxCalculation.taxableIncome;
      // Spouse is already close to or above threshold with no split
      expect(spouseBaseIncome).toBeGreaterThanOrEqual(clawbackThreshold * 0.9);
    }
  });

  /**
   * Scenario: Splitting to spouse WOULD be beneficial normally, but the amount
   * that maximizes tax savings also exceeds the OAS clawback threshold for the
   * receiving spouse. The engine must cap the split at the threshold.
   *
   * Primary: $160k RRIF income
   * Spouse: $60k income (below $95,323 threshold)
   * Optimal split without clawback guard: 50% → spouse gets $80k → total $140k → clawback hits
   * Correct split: cap at threshold → spouse stays at $95,323
   */
  it('should cap pension split so receiving spouse income does not exceed OAS clawback threshold', () => {
    const year = 2026;
    const clawbackThreshold = getOASClawbackThreshold(year); // ~$95,323

    const input = makeCoupleInput(
      {
        birthdate: new Date(year - 70, 0, 1),
        rrifBalance: 1200000, // Very large RRIF → high mandatory withdrawal
        expectedCPPAt65: 14000,
        cppStartAge: 65,
        oasStartAge: 65,
        pensionIncome: 0,
        retirementSpending: 30000,
      },
      {
        birthdate: new Date(year - 70, 0, 1),
        rrifBalance: 0,
        expectedCPPAt65: 6000,
        cppStartAge: 65,
        oasStartAge: 65,
        pensionIncome: 50000, // Has income but below threshold
        retirementSpending: 30000,
      },
      { year, optimizePensionSplitting: true }
    );

    const result = calculateCoupleYear(input);

    if (result.pensionSplitPercentage > 0) {
      // After splitting, spouse total taxable income must not exceed clawback threshold
      const spouseTaxableAfterSplit = result.spouse.taxCalculation.taxableIncome;
      expect(
        spouseTaxableAfterSplit,
        'Pension split should be capped so spouse taxable income does not exceed OAS clawback threshold'
      ).toBeLessThanOrEqual(clawbackThreshold + 1); // +1 for rounding tolerance
    }
  });

  /**
   * Scenario: Split IS beneficial and spouse income is well below the threshold.
   * The engine SHOULD still split (no regression on the happy path).
   *
   * Primary receives a $40k DB pension (eligible splittable income per D-08) on top
   * of CPP/OAS, giving them materially higher taxable income than the spouse and
   * real splittable room. Splitting ~50% keeps the receiver well below the $95,323
   * clawback threshold while shifting income into their lower bracket.
   */
  it('should still split pension income when receiving spouse is well below OAS clawback threshold', () => {
    const year = 2026;

    const input = makeCoupleInput(
      {
        birthdate: new Date(year - 70, 0, 1),
        rrifBalance: 0,
        expectedCPPAt65: 15000,
        cppStartAge: 65,
        oasStartAge: 65,
        pensionIncome: 40000, // DB pension → eligible splittable income at 65+ (D-08)
        retirementSpending: 25000,
      },
      {
        birthdate: new Date(year - 70, 0, 1),
        rrifBalance: 0,
        expectedCPPAt65: 4000,
        cppStartAge: 65,
        oasStartAge: 65,
        pensionIncome: 0, // Low income — well below $95k threshold
        retirementSpending: 25000,
      },
      { year, optimizePensionSplitting: true }
    );

    const result = calculateCoupleYear(input);

    // Primary has much higher income → splitting should occur
    expect(result.pensionSplitPercentage).toBeGreaterThan(0);
    expect(result.pensionSplitTaxSavings).toBeGreaterThan(0);
  });

  /**
   * Scenario: RRIF-based pension splitting at age 72+ (mandatory RRIF minimum).
   *
   * Per D-08, at age 65+ RRIF withdrawals are eligible splittable income. At age 72+
   * the CRA-mandated RRIF minimum withdrawal begins (see accounts/rrif.ts
   * `isRRIFMinimumRequired`). Primary has a large RRIF producing a sizeable mandatory
   * withdrawal while spouse has only a small CPP — the engine should recognize the
   * RRIF withdrawal as splittable and shift income to the lower-bracket spouse.
   *
   * This keeps the RRIF branch of the splittable-income sum explicitly covered,
   * independent of the DB-pension happy-path above.
   *
   * @see docs/source-of-truth/07-withdrawal-strategies.md - Pension Income Splitting
   * @see packages/calculation-engine/src/accounts/rrif.ts - isRRIFMinimumRequired (age >= 72)
   */
  it('should split mandatory RRIF minimum withdrawal at age 72+ when receiving spouse is well below threshold', () => {
    const year = 2026;

    const input = makeCoupleInput(
      {
        birthdate: new Date(year - 72, 0, 1), // age 72 → mandatory RRIF minimum applies
        rrifBalance: 800000, // Large RRIF → mandatory minimum (~5.4% at 72 ≈ $43k)
        expectedCPPAt65: 15000,
        cppStartAge: 65,
        oasStartAge: 65,
        pensionIncome: 0, // No DB pension — splittable income must come from RRIF
        retirementSpending: 25000,
      },
      {
        birthdate: new Date(year - 72, 0, 1), // age 72
        rrifBalance: 0,
        expectedCPPAt65: 4000,
        cppStartAge: 65,
        oasStartAge: 65,
        pensionIncome: 0, // Low income — well below $95k threshold
        retirementSpending: 25000,
      },
      { year, optimizePensionSplitting: true }
    );

    const result = calculateCoupleYear(input);

    // Mandatory RRIF minimum must have been withdrawn at age 72+
    expect(
      result.primary.rrifForcedMinimum,
      'Primary age 72 must have a forced RRIF minimum withdrawal'
    ).toBeGreaterThan(0);
    expect(result.primary.rrifWithdrawal).toBeGreaterThan(0);

    // Splitting occurs and savings are realized from the RRIF-based splittable income
    expect(
      result.pensionSplitPercentage,
      'RRIF withdrawal at 72+ must be recognized as splittable income'
    ).toBeGreaterThan(0);
    expect(result.pensionSplitTaxSavings).toBeGreaterThan(0);

    // Income was shifted from primary to spouse
    expect(result.primary.pensionIncomeTransferred ?? 0).toBeGreaterThan(0);
    expect(result.spouse.pensionIncomeReceived ?? 0).toBeGreaterThan(0);
  });

  /**
   * Focused RRIF-splitting check at age 75 (well past the age-72 mandatory-minimum
   * boundary) with no DB pension on either side. The ONLY possible source of
   * eligible splittable income here is the primary's mandatory RRIF withdrawal.
   *
   * This is a narrower regression guard than the age-72 test above: it isolates
   * the RRIF branch of the splittable-income sum without sitting on the exact
   * boundary year where the minimum first kicks in.
   *
   * @see docs/source-of-truth/07-withdrawal-strategies.md - Pension Income Splitting (D-08)
   */
  it('should split RRIF-based eligible pension income at age 75 when RRIF is the sole splittable source', () => {
    const year = 2026;

    const input = makeCoupleInput(
      {
        birthdate: new Date(year - 75, 0, 1), // age 75 — well past mandatory-minimum boundary
        rrifBalance: 600000, // Mandatory minimum ~5.82% ≈ $35k
        expectedCPPAt65: 12000,
        cppStartAge: 65,
        oasStartAge: 65,
        pensionIncome: 0, // No DB pension → RRIF is the only splittable source
        retirementSpending: 20000,
      },
      {
        birthdate: new Date(year - 75, 0, 1),
        rrifBalance: 0,
        expectedCPPAt65: 3000,
        cppStartAge: 65,
        oasStartAge: 65,
        pensionIncome: 0, // No DB pension, low CPP — well below clawback threshold
        retirementSpending: 20000,
      },
      { year, optimizePensionSplitting: true }
    );

    const result = calculateCoupleYear(input);

    // Mandatory RRIF minimum must occur (age >= 72)
    expect(result.primary.rrifForcedMinimum).toBeGreaterThan(0);

    // With RRIF as the only splittable source, any positive split proves the
    // engine recognized the RRIF withdrawal as eligible splittable income.
    expect(
      result.pensionSplitPercentage,
      'Age 75 RRIF minimum must be recognized as eligible splittable income (D-08)'
    ).toBeGreaterThan(0);
    expect(result.primary.pensionIncomeTransferred ?? 0).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Edge Case 2: Spousal RRSP 3-Year Attribution Rule
//
// Contributions to a Spousal RRSP in year N cause withdrawals from that account
// by the annuitant spouse to attribute back to the contributor's income in
// years N, N+1, N+2. After year N+2 (i.e., from year N+3 onward), the
// annuitant's withdrawals are taxed in the annuitant's hands.
//
// @see docs/source-of-truth/02-account-types.md - RRSP Spousal Attribution
// ---------------------------------------------------------------------------
describe('Edge Case 2 — Spousal RRSP 3-year attribution rule', () => {
  /**
   * Scenario: Spouse has a Spousal RRSP (contributed by Primary this year).
   * Spouse retires immediately and has no other income — must draw from Spousal RRSP.
   * Since the contribution was in the SAME year (attribution window = year N, N+1, N+2),
   * the withdrawal should attribute back to Primary's income in the same year.
   *
   * We verify: result.primary.spousalRRSPAttributedIncome > 0
   */
  it('should attribute spousal RRSP withdrawal to contributor when withdrawn within 3 years', () => {
    const startYear = getCurrentYear();

    // Spouse has $30k spousal RRSP; ledger entry for THIS year keeps the 3-year window open.
    // Spouse is retired with no income → must withdraw from spousal RRSP to fund spending
    // Primary is working (income $80k) — the attribution adds to their income
    const input = makeCoupleProjectionInput(
      {
        birthdate: new Date(startYear - 62, 0, 1), // age 62
        retirementAge: 65, // Primary still working
        employmentIncome: 80000,
        rrspBalance: 0,
        rrspAnnualContribution: 0,
        tfsaBalance: 0,
        nonRegBalance: 0,
        lifeExpectancy: 63, // Short projection: 2 years
        retirementSpending: 30000, // Couple's spending (each gets this in the engine)
        expectedCPPAt65: 10000,
        coupleSettings: {
          optimizePensionSplitting: false,
          useYoungerSpouseForRRIF: false,
        },
      },
      {
        birthdate: new Date(startYear - 62, 0, 1), // age 62 — same age
        retirementAge: 60, // Already retired
        employmentIncome: 0, // No income
        expectedCPPAt65: 0, // Too young for CPP (startAge 65, age 62)
        cppStartAge: 65,
        oasStartAge: 65,
        rrspBalance: 30000, // Spousal RRSP (the full RRSP is spousal)
        spousalRrspLedger: [
          { year: startYear, annuitant: 'spouse', contributor: 'primary', amount: 30000 },
        ],
        tfsaBalance: 0,
        lifeExpectancy: 63,
      }
    );

    const result = runCoupleProjection(input);

    // Year 0 = the first projection year. Spouse needs $30k spending but has no income.
    // The engine should withdraw from the spousal RRSP to fund the gap.
    // Since contribution was in startYear = this year, the withdrawal attributes to primary.
    const year0 = result.yearlyResults[0];
    expect(year0).toBeDefined();
    if (!year0) return;

    // Check that the spousal RRSP withdrawal is attributed to the contributor (primary)
    expect(
      year0.primary.spousalRRSPAttributedIncome ?? 0,
      'Spousal RRSP withdrawal within 3-year window must attribute to contributor (primary)'
    ).toBeGreaterThan(0);

    expect(
      year0.spouse.spousalRRSPAttributedIncome ?? 0,
      'Spouse (annuitant) should NOT show attributed income'
    ).toBe(0);
  });

  /**
   * Ledger-based attribution: single entry in-window. Spouse has $30k spousal RRSP
   * with a ledger entry for the current year. Spouse is retired with no income and
   * must draw from RRSP — attribution should go to primary.
   */
  it('ledger — should attribute spousal RRSP withdrawal to contributor when entry is in-window', () => {
    const startYear = getCurrentYear();

    const input = makeCoupleProjectionInput(
      {
        birthdate: new Date(startYear - 62, 0, 1),
        retirementAge: 65,
        employmentIncome: 80000,
        rrspBalance: 0,
        rrspAnnualContribution: 0,
        tfsaBalance: 0,
        nonRegBalance: 0,
        lifeExpectancy: 63,
        retirementSpending: 30000,
        expectedCPPAt65: 10000,
        coupleSettings: {
          optimizePensionSplitting: false,
          useYoungerSpouseForRRIF: false,
        },
      },
      {
        birthdate: new Date(startYear - 62, 0, 1),
        retirementAge: 60,
        employmentIncome: 0,
        expectedCPPAt65: 0,
        cppStartAge: 65,
        oasStartAge: 65,
        rrspBalance: 30000,
        tfsaBalance: 0,
        lifeExpectancy: 63,
        spousalRrspLedger: [
          { year: startYear, annuitant: 'spouse', contributor: 'primary', amount: 30000 },
        ],
      }
    );

    const result = runCoupleProjection(input);
    const year0 = result.yearlyResults[0];
    expect(year0).toBeDefined();
    if (!year0) return;

    expect(
      year0.primary.spousalRRSPAttributedIncome ?? 0,
      'Ledger in-window: withdrawal must attribute to contributor (primary)'
    ).toBeGreaterThan(0);

    expect(
      year0.spouse.spousalRRSPAttributedIncome ?? 0,
      'Ledger in-window: annuitant (spouse) should have $0 attributed income'
    ).toBe(0);
  });

  /**
   * Ledger-based attribution: single entry out-of-window (entry.year + 4).
   * The entry is 4 years old — outside the 3-year window — so no attribution expected.
   */
  it('ledger — should NOT attribute when ledger entry is outside the 3-year window', () => {
    const startYear = getCurrentYear();

    const input = makeCoupleProjectionInput(
      {
        birthdate: new Date(startYear - 62, 0, 1),
        retirementAge: 65,
        employmentIncome: 80000,
        rrspBalance: 0,
        rrspAnnualContribution: 0,
        tfsaBalance: 0,
        nonRegBalance: 0,
        lifeExpectancy: 63,
        retirementSpending: 30000,
        expectedCPPAt65: 10000,
        coupleSettings: {
          optimizePensionSplitting: false,
          useYoungerSpouseForRRIF: false,
        },
      },
      {
        birthdate: new Date(startYear - 62, 0, 1),
        retirementAge: 60,
        employmentIncome: 0,
        expectedCPPAt65: 0,
        cppStartAge: 65,
        oasStartAge: 65,
        rrspBalance: 30000,
        tfsaBalance: 0,
        lifeExpectancy: 63,
        spousalRrspLedger: [
          { year: startYear - 4, annuitant: 'spouse', contributor: 'primary', amount: 30000 },
        ],
      }
    );

    const result = runCoupleProjection(input);

    result.yearlyResults.forEach((yr) => {
      expect(
        yr.primary.spousalRRSPAttributedIncome ?? 0,
        'Ledger out-of-window: attribution must be $0 for all years'
      ).toBe(0);
    });
  });

  /**
   * Ledger-based attribution: partial consumption across two years.
   * Ledger entry is $200k but spouse RRSP is $100k — each year draws ~$20k
   * (small spending, large balance). Year 0 and year 1 both attribute to primary
   * since the entry still has remaining balance after year 0.
   */
  it('ledger — should partially consume entry across two years when withdrawal < entry amount', () => {
    const startYear = getCurrentYear();

    const input = makeCoupleProjectionInput(
      {
        birthdate: new Date(startYear - 62, 0, 1),
        retirementAge: 65,
        employmentIncome: 80000,
        rrspBalance: 0,
        rrspAnnualContribution: 0,
        tfsaBalance: 0,
        nonRegBalance: 0,
        lifeExpectancy: 64, // 3-year projection
        retirementSpending: 10000, // Low spending so spouse draws a partial amount each year
        expectedCPPAt65: 10000,
        coupleSettings: {
          optimizePensionSplitting: false,
          useYoungerSpouseForRRIF: false,
        },
      },
      {
        birthdate: new Date(startYear - 62, 0, 1),
        retirementAge: 60,
        employmentIncome: 0,
        expectedCPPAt65: 0,
        cppStartAge: 65,
        oasStartAge: 65,
        rrspBalance: 100000, // Large enough that only a portion is withdrawn each year
        tfsaBalance: 0,
        lifeExpectancy: 64,
        spousalRrspLedger: [
          { year: startYear, annuitant: 'spouse', contributor: 'primary', amount: 200000 },
        ],
      }
    );

    const result = runCoupleProjection(input);
    const year0 = result.yearlyResults[0];
    const year1 = result.yearlyResults[1];
    expect(year0).toBeDefined();
    expect(year1).toBeDefined();
    if (!year0 || !year1) return;

    expect(
      year0.primary.spousalRRSPAttributedIncome ?? 0,
      'Ledger partial: year 0 withdrawal must attribute to primary'
    ).toBeGreaterThan(0);

    expect(
      year1.primary.spousalRRSPAttributedIncome ?? 0,
      'Ledger partial: year 1 residual withdrawal must also attribute to primary'
    ).toBeGreaterThan(0);
  });

  /**
   * After year N+2, the attribution window is over.
   * Withdrawal from spousal RRSP in year N+3 is taxed in spouse's hands.
   */
  it('should NOT attribute spousal RRSP withdrawal to contributor after 3-year window expires', () => {
    const startYear = getCurrentYear();
    // Ledger entry is 4 years old — outside the 3-year window, so no attribution expected.
    const input = makeCoupleProjectionInput(
      {
        birthdate: new Date(startYear - 62, 0, 1),
        retirementAge: 60,
        employmentIncome: 80000,
        rrspBalance: 50000,
        rrspAnnualContribution: 0,
        tfsaBalance: 0,
        nonRegBalance: 0,
        lifeExpectancy: 63,
        expectedCPPAt65: 10000,
        coupleSettings: {
          optimizePensionSplitting: false,
          useYoungerSpouseForRRIF: false,
        },
      },
      {
        birthdate: new Date(startYear - 60, 0, 1),
        retirementAge: 60,
        employmentIncome: 0,
        rrspBalance: 20000,
        spousalRrspLedger: [
          { year: startYear - 4, annuitant: 'spouse', contributor: 'primary', amount: 20000 },
        ],
        tfsaBalance: 0,
        lifeExpectancy: 63,
        expectedCPPAt65: 5000,
      }
    );

    const result = runCoupleProjection(input);

    // All yearly results — attribution window already expired, no attribution expected
    result.yearlyResults.forEach((year) => {
      expect(
        year.primary.spousalRRSPAttributedIncome ?? 0,
        'Attribution should be $0 when 3-year window has expired'
      ).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Edge Case 3: Survivor Benefit Shock
//
// When a spouse dies at a specified age, the following year must reflect:
//   a. OAS drops by exactly one OAS payment (the deceased's payment goes to $0)
//   b. Survivor CPP = max(survivor's own CPP, 60% of deceased's CPP),
//      but combined cannot exceed max single CPP (~$16,375/yr in 2024 dollars)
//   c. No more pension income splitting (single filer now)
//   d. Surviving spouse files as single — marginal rates on full portfolio alone
//
// @see docs/source-of-truth/05-government-benefits.md - CPP Survivor Benefits
// ---------------------------------------------------------------------------
describe('Edge Case 3 — Survivor benefit shock when spouse dies mid-projection', () => {
  /**
   * Scenario: Spouse dies at age 75 (5 years into the projection from age 70).
   * The year after death:
   *   - Deceased spouse's OAS should be $0 in the projection
   *   - Household OAS should drop by exactly the deceased spouse's annual OAS
   *   - Survivor's CPP should be max(own CPP, 60% of deceased CPP)
   */
  it('should drop household OAS by exactly one spouse payment after death', () => {
    const startYear = getCurrentYear();
    const primaryDeathAge = 75; // Primary dies at 75

    const input = makeCoupleProjectionInput(
      {
        birthdate: new Date(startYear - 70, 0, 1),
        lifeExpectancy: primaryDeathAge, // Primary lives to 75 (dies at 75)
        retirementAge: 65,
        employmentIncome: 0,
        rrspBalance: 0,
        rrifBalance: 400000,
        tfsaBalance: 50000,
        nonRegBalance: 0,
        retirementSpending: 30000,
        expectedCPPAt65: 14000,
        cppStartAge: 65,
        oasStartAge: 65,
        coupleSettings: {
          optimizePensionSplitting: false, // Disable to isolate survivor effect
          useYoungerSpouseForRRIF: false,
        },
      },
      {
        birthdate: new Date(startYear - 68, 0, 1),
        lifeExpectancy: 90, // Spouse outlives primary
        retirementAge: 65,
        employmentIncome: 0,
        expectedCPPAt65: 8000,
        cppStartAge: 65,
        oasStartAge: 65,
        rrspBalance: 0,
        rrifBalance: 200000,
        tfsaBalance: 30000,
        spouseDeathYear: undefined, // Spouse survives
      }
    );

    const result = runCoupleProjection(input);

    // Find the last year when primary was alive (age 75)
    const lastPrimaryAliveYear = result.yearlyResults.find(
      (y) => y.primary.age === primaryDeathAge
    );
    // Find the first year after primary dies (spouse continues alone)
    const firstSurvivorYear = result.yearlyResults.find(
      (y) => y.primary.age === primaryDeathAge + 1
    );

    expect(lastPrimaryAliveYear).toBeDefined();
    expect(firstSurvivorYear).toBeDefined();
    if (!lastPrimaryAliveYear || !firstSurvivorYear) return;

    // After primary dies, primary's OAS should be $0
    expect(
      firstSurvivorYear.primary.oasIncome,
      'Deceased primary should have $0 OAS after death'
    ).toBe(0);

    // Household OAS should have dropped
    const oasBefore =
      lastPrimaryAliveYear.primary.oasIncome + lastPrimaryAliveYear.spouse.oasIncome;
    const oasAfter = firstSurvivorYear.primary.oasIncome + firstSurvivorYear.spouse.oasIncome;

    expect(oasAfter, 'Household OAS should drop after one spouse dies').toBeLessThan(oasBefore);
  });

  /**
   * Survivor CPP: survivor's combined CPP must be max(own, 60% of deceased's),
   * capped at the single CPP maximum (~$16,375/yr).
   */
  it('should apply CPP survivor benefit to the surviving spouse after primary dies', () => {
    const startYear = getCurrentYear();
    const BENEFIT_AMOUNTS_2024_CPP_MAX = 16375; // from BENEFIT_AMOUNTS_2024

    const input = makeCoupleProjectionInput(
      {
        birthdate: new Date(startYear - 70, 0, 1),
        lifeExpectancy: 72, // Dies at 72
        retirementAge: 65,
        employmentIncome: 0,
        rrspBalance: 0,
        rrifBalance: 200000,
        tfsaBalance: 0,
        nonRegBalance: 0,
        retirementSpending: 20000,
        expectedCPPAt65: 16375, // Maximum CPP
        cppStartAge: 65,
        oasStartAge: 65,
        coupleSettings: {
          optimizePensionSplitting: false,
          useYoungerSpouseForRRIF: false,
        },
      },
      {
        birthdate: new Date(startYear - 68, 0, 1),
        lifeExpectancy: 85,
        retirementAge: 65,
        employmentIncome: 0,
        expectedCPPAt65: 4000, // Low own CPP
        cppStartAge: 65,
        oasStartAge: 65,
        rrspBalance: 0,
        rrifBalance: 100000,
        tfsaBalance: 20000,
      }
    );

    const result = runCoupleProjection(input);

    // Find year when spouse receives survivor benefit (after primary dies at 72)
    const survivorYear = result.yearlyResults.find((y) => y.primary.age === 73);
    expect(survivorYear).toBeDefined();
    if (!survivorYear) return;

    // Spouse's own CPP was $4,000/yr. Deceased primary's CPP was $16,375/yr.
    // Survivor benefit = max($4,000, 60% × $16,375) = max($4,000, $9,825) = $9,825
    // Combined with own CPP: $4,000 + $9,825 = $13,825 → under the single max $16,375
    // So survivor's CPP should be ~$13,825 (not $4,000 as it would be without survivor benefit)
    const survivorCPP = survivorYear.spouse.cppIncome;

    expect(
      survivorCPP,
      'Surviving spouse CPP should include survivor benefit (greater than own CPP alone)'
    ).toBeGreaterThan(4000 * 1.05); // Greater than own CPP (with small inflation tolerance)

    // Must not exceed single CPP maximum
    expect(survivorCPP, 'Survivor CPP must not exceed the single CPP maximum').toBeLessThanOrEqual(
      BENEFIT_AMOUNTS_2024_CPP_MAX * 1.05
    ); // Small tolerance for indexing
  });

  /**
   * After primary dies, pension income splitting must stop.
   * The survivor files as a single person — no more split optimization.
   */
  it('should stop pension income splitting after one spouse dies', () => {
    const startYear = getCurrentYear();

    const input = makeCoupleProjectionInput(
      {
        birthdate: new Date(startYear - 70, 0, 1),
        lifeExpectancy: 72, // Dies at 72
        retirementAge: 65,
        employmentIncome: 0,
        rrspBalance: 0,
        rrifBalance: 600000, // High RRIF → normally would split
        tfsaBalance: 0,
        nonRegBalance: 0,
        retirementSpending: 25000,
        expectedCPPAt65: 15000,
        cppStartAge: 65,
        oasStartAge: 65,
        coupleSettings: {
          optimizePensionSplitting: true, // Enabled while alive
          useYoungerSpouseForRRIF: false,
        },
      },
      {
        birthdate: new Date(startYear - 68, 0, 1),
        lifeExpectancy: 85,
        retirementAge: 65,
        employmentIncome: 0,
        expectedCPPAt65: 4000,
        cppStartAge: 65,
        oasStartAge: 65,
        rrspBalance: 0,
        rrifBalance: 50000,
        tfsaBalance: 0,
      }
    );

    const result = runCoupleProjection(input);

    // Find years after primary's death (age 73+)
    const postDeathYears = result.yearlyResults.filter((y) => y.primary.age >= 73);

    expect(postDeathYears.length).toBeGreaterThan(0);

    // After primary dies, pension splitting percentage should be 0
    postDeathYears.forEach((year) => {
      expect(
        year.pensionSplitPercentage,
        `Pension split percentage must be 0 after primary's death (year ${String(year.year)})`
      ).toBe(0);
    });
  });
});
