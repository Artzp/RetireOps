/**
 * VR-TAX-PSPLIT-001 Worked Example — engine parity test (M002/S03/T01)
 *
 * Reproduces every row of the Worked Example table in the authoritative rule
 * block to the cent. If a 2026 tax constant drifts (federal BPA, OAS clawback
 * threshold, bracket indexing), this test fails with expected-vs-actual cents
 * on the drifting row — localizing the drift before it silently invalidates
 * the doc.
 *
 * @see docs/source-of-truth/04-tax-engine.md — VR-TAX-PSPLIT-001 Worked Example
 */
import { describe, it, expect } from 'vitest';
import { calculateCoupleYear, type CoupleYearInput } from './couple-calculator.js';
import type { PersonYearInput } from './yearly-calculator.js';

// Fixed tax year for determinism. 2026 constants are stable per CLAUDE.md.
// Birthdate(1961,0,1) => age 65 at end of 2026.
const TAX_YEAR = 2026;

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

describe('VR-TAX-PSPLIT-001 Worked Example parity', () => {
  it('reproduces every row of the Worked Example table in docs/source-of-truth/04-tax-engine.md to the cent', () => {
    const favourableInput = createCoupleInput({
      primary: createPersonInput({
        pensionIncome: 80000,
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

    // Worked Example row assertions — every number is captured from the engine
    // and pinned to the cent. The Worked Example table in
    // docs/source-of-truth/04-tax-engine.md carries the same numbers; if an
    // engine constant drifts (federal BPA, OAS clawback threshold, bracket
    // indexing), this test fails with expected-vs-actual cents on the drifting
    // row, localizing the drift before the doc goes out of sync.
    //
    // A-01 migration (2026-06-10): OAS gross moved from the deprecated Q1-derived
    // $8,908/yr to the citation-anchored Q2 amount $8,916.60/yr
    // (743.05 × 12, per docs/source-of-truth/18-pensions-2026.md#2026-oas-q2-amount-65to74).
    // Each person's OAS rose by exactly +$8.60. The primary is in OAS-clawback
    // territory, so the primary's taxable income rises by 8.60 − 15% × 8.60 =
    // +$7.31 (the extra OAS net of the 15% recovery tax it triggers); the spouse
    // is below the $95,323 threshold so the spouse's taxable income rises by the
    // full +$8.60. Both deltas verified against doc-18 arithmetic.

    // 2026 tax-table refresh (audit A-09/A-10): federal thresholds indexed +2.0%
    // (#2026-fed-indexation), federal BPA 16452 (#2026-fed-bpa-max), Ontario age
    // amount 6342 (#2026-on-age-amount) / pension amount 1796
    // (#2026-on-pension-income-amount). The split optimizer re-searched against the
    // new tables and the household-tax-minimizing split moved 45% → 48% (transfer
    // 36000 → 38400). OAS gross is unchanged (A-01 Q2 $8,916.60). Household taxes
    // fall on the more generous 2026 credits + wider brackets. All post-split
    // taxable incomes follow algebraically from the 48% transfer.

    // Input echoes
    expect(withoutSplit.primary.pensionIncome).toBeCloseTo(80000, 2);
    expect(withoutSplit.spouse.pensionIncome).toBeCloseTo(5000, 2);
    // Both persons' gross OAS equals the anchored 2026 Q2 amount (A-01)
    expect(withoutSplit.primary.oasGrossIncome).toBeCloseTo(8916.6, 2);
    expect(withoutSplit.spouse.oasGrossIncome).toBeCloseTo(8916.6, 2);
    // Primary pre-split taxable income (unchanged: 101770.25 + 7.31 OAS-net-of-clawback delta)
    expect(withoutSplit.primary.taxCalculation.taxableIncome).toBeCloseTo(101777.56, 2);
    // Primary post-split taxable income (101777.56 − 38400 transfer)
    expect(withSplit.primary.taxCalculation.taxableIncome).toBeCloseTo(63377.56, 2);
    // Spouse pre-split taxable income (unchanged: 21908.00 + 8.60 full OAS delta, no clawback)
    expect(withoutSplit.spouse.taxCalculation.taxableIncome).toBeCloseTo(21916.6, 2);
    // Spouse post-split taxable income (21916.6 + 38400 transfer)
    expect(withSplit.spouse.taxCalculation.taxableIncome).toBeCloseTo(60316.6, 2);
    // Split amount transferred (primary → spouse) — re-optimized to 48% on 2026 tables
    expect(withSplit.primary.pensionIncomeTransferred ?? 0).toBeCloseTo(38400.0, 2);
    // Split percentage (1% steps; 0.48 == 48%) — re-optimized on 2026 tables
    expect(withSplit.pensionSplitPercentage).toBeCloseTo(0.48, 2);
    // Household tax (no split)
    expect(withoutSplit.householdTaxesPaid).toBeCloseTo(21006.564948, 2);
    // Household tax (optimal split)
    expect(withSplit.householdTaxesPaid).toBeCloseTo(15833.229312, 2);
    // Total savings (tax + OAS clawback; see couple-calculator.ts:116,227)
    expect(withSplit.pensionSplitTaxSavings).toBeCloseTo(6141.519636, 2);
  });
});
