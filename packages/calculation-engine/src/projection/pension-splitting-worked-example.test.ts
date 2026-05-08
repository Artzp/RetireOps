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

    // Input echoes
    expect(withoutSplit.primary.pensionIncome).toBeCloseTo(80000, 2);
    expect(withoutSplit.spouse.pensionIncome).toBeCloseTo(5000, 2);
    // Primary pre-split taxable income
    expect(withoutSplit.primary.taxCalculation.taxableIncome).toBeCloseTo(101770.25, 2);
    // Primary post-split taxable income
    expect(withSplit.primary.taxCalculation.taxableIncome).toBeCloseTo(65770.25, 2);
    // Spouse pre-split taxable income
    expect(withoutSplit.spouse.taxCalculation.taxableIncome).toBeCloseTo(21908.0, 2);
    // Spouse post-split taxable income
    expect(withSplit.spouse.taxCalculation.taxableIncome).toBeCloseTo(57908.0, 2);
    // Split amount transferred (primary → spouse)
    expect(withSplit.primary.pensionIncomeTransferred ?? 0).toBeCloseTo(36000.0, 2);
    // Split percentage (1% steps; 0.45 == 45%)
    expect(withSplit.pensionSplitPercentage).toBeCloseTo(0.45, 2);
    // Household tax (no split)
    expect(withoutSplit.householdTaxesPaid).toBeCloseTo(21236.95, 2);
    // Household tax (optimal split)
    expect(withSplit.householdTaxesPaid).toBeCloseTo(16279.46, 2);
    // Total savings (tax + OAS clawback; see couple-calculator.ts:116,227)
    expect(withSplit.pensionSplitTaxSavings).toBeCloseTo(5924.58, 2);
  });
});
