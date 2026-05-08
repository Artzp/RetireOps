import { describe, it, expect } from 'vitest';
import { calculateYear, calculatePersonYear } from './yearly-calculator.js';
import type { YearInput, PersonYearInput } from './yearly-calculator.js';

/**
 * RRSP Meltdown Guard Regression Tests (FIX-06 / FIX-07)
 * @see .planning/REQUIREMENTS.md — FIX-06, FIX-07
 */

const BASE_YEAR = 2030;

/** Minimal YearInput for calculateYear — pre-retirement by default (age 55 < retirementAge 65) */
function createYearInput(overrides: Partial<YearInput> = {}): YearInput {
  return {
    year: BASE_YEAR,
    birthdate: new Date(1975, 0, 1), // age 55 in 2030
    province: 'ON',
    rrspBalance: 200000,
    rrifBalance: 0,
    tfsaBalance: 50000,
    nonRegBalance: 0,
    nonRegACB: 0,
    rrspContribution: 10000,
    tfsaContribution: 7000,
    employmentIncome: 80000,
    pensionIncome: 0,
    otherIncome: 0,
    expectedCPPAt65: 8000,
    cppStartAge: 65,
    oasStartAge: 65,
    yearsOfResidence: 40,
    retirementSpending: 60000,
    investmentReturn: 0.05,
    inflationRate: 0.025,
    retirementAge: 65,
    yearsFromProjectionStart: 4,
    ...overrides,
  };
}

/** Minimal PersonYearInput for calculatePersonYear */
function createPersonYearInput(overrides: Partial<PersonYearInput> = {}): PersonYearInput {
  return {
    owner: 'primary',
    year: BASE_YEAR,
    birthdate: new Date(1975, 0, 1), // age 55 in 2030
    province: 'ON',
    maritalStatus: 'single',
    rrspBalance: 200000,
    rrifBalance: 0,
    tfsaBalance: 50000,
    nonRegBalance: 0,
    nonRegACB: 0,
    rrspContribution: 10000,
    tfsaContribution: 7000,
    employmentIncome: 80000,
    pensionIncome: 0,
    otherIncome: 0,
    expectedCPPAt65: 8000,
    cppStartAge: 65,
    oasStartAge: 65,
    yearsOfResidence: 40,
    retirementSpending: 60000,
    investmentReturn: 0.05,
    inflationRate: 0.025,
    retirementAge: 65,
    yearsFromProjectionStart: 4,
    ...overrides,
  };
}

// Also covers RMLT-04 (employment guard suppresses meltdown)
describe('RRSP Meltdown Guard — REGR (FIX-06/FIX-07)', () => {
  describe('calculateYear (single-person path)', () => {
    it('should produce zero meltdown withdrawal when person is still employed (pre-retirement)', () => {
      // age 55 in 2030, retirementAge 65 — NOT retired
      // meltdown year range 2028–2035 overlaps with working years
      const input = createYearInput({
        rrspMeltdown: { enabled: true, annualAmount: 20000, startYear: 2028, endYear: 2035 },
      });

      const result = calculateYear(input);

      // rrifWithdrawal includes rrspWithdrawal + meltdownRRSPWithdrawal
      // For a pre-retirement year with employment income, the person should NOT
      // be drawing down RRSP via meltdown — livingExpenses is 0 (not retired),
      // so no gap-driven withdrawal either. The RRSP balance should stay at ~200k*growth.
      // We verify by checking RRSP balance didn't decrease by the meltdown amount (20000).
      // Starting RRSP: 200000. After growth and contribution, it should be > 200000.
      // If meltdown fired, it would be ~200k + growth + contribution - 20000 = LOWER than without.
      const withoutMeltdown = calculateYear({ ...input, rrspMeltdown: undefined });
      expect(result.rrspBalance).toBeCloseTo(withoutMeltdown.rrspBalance, -2);
    });

    it('should produce non-zero meltdown withdrawal in a retirement year within the configured range', () => {
      // age 66 in 2030 (birthdate 1964), retirementAge 65 — RETIRED
      // meltdown enabled for 2028–2035
      const input = createYearInput({
        birthdate: new Date(1964, 0, 1), // age 66 in 2030
        employmentIncome: 0,
        rrspMeltdown: { enabled: true, annualAmount: 20000, startYear: 2028, endYear: 2035 },
      });

      const result = calculateYear(input);
      const withoutMeltdown = calculateYear({ ...input, rrspMeltdown: undefined });

      // With meltdown active in a retirement year, RRSP should be LOWER than without
      expect(result.rrspBalance).toBeLessThan(withoutMeltdown.rrspBalance);
    });
  });

  describe('calculatePersonYear (couple path)', () => {
    it('should produce zero meltdown withdrawal when person is still employed (pre-retirement)', () => {
      // age 55 in 2030, retirementAge 65 — NOT retired
      const input = createPersonYearInput({
        rrspMeltdown: { enabled: true, annualAmount: 20000, startYear: 2028, endYear: 2035 },
      });

      const result = calculatePersonYear(input);
      const withoutMeltdown = calculatePersonYear({ ...input, rrspMeltdown: undefined });

      // Meltdown must not fire for employed person — RRSP balances should match
      expect(result.rrspBalance).toBeCloseTo(withoutMeltdown.rrspBalance, -2);
    });

    it('should produce non-zero meltdown withdrawal in a retirement year within the configured range', () => {
      // age 66 in 2030 (birthdate 1964), retirementAge 65 — RETIRED
      const input = createPersonYearInput({
        birthdate: new Date(1964, 0, 1),
        employmentIncome: 0,
        rrspMeltdown: { enabled: true, annualAmount: 20000, startYear: 2028, endYear: 2035 },
      });

      const result = calculatePersonYear(input);
      const withoutMeltdown = calculatePersonYear({ ...input, rrspMeltdown: undefined });

      // Meltdown fires in retirement — RRSP should be lower than without meltdown
      expect(result.rrspBalance).toBeLessThan(withoutMeltdown.rrspBalance);
    });
  });
});

describe('Non-registered investment income breakdown', () => {
  it('calculateYear passes supported interest, dividend, and capital gains fields into tax calculation', () => {
    const base = calculateYear(createYearInput());
    const result = calculateYear(
      createYearInput({
        nonRegBalance: 100000,
        nonRegACB: 80000,
        nonRegInterestIncome: 1000,
        nonRegEligibleDividends: 2000,
        nonRegNonEligibleDividends: 500,
        nonRegRealizedCapitalGains: 1500,
      })
    );

    expect(result.taxCalculation.interestIncome).toBe(1000);
    expect(result.taxCalculation.dividendIncomeEligible).toBe(2000);
    expect(result.taxCalculation.dividendIncomeNonEligible).toBe(500);
    expect(result.taxCalculation.capitalGains).toBe(1500);
    expect(result.taxCalculation.taxableIncome).toBeGreaterThan(base.taxCalculation.taxableIncome);
    expect(result.taxCalculation.totalTax).toBeGreaterThan(base.taxCalculation.totalTax);
    expect(result.totalIncome).toBe(base.totalIncome + 5000);
  });

  it('calculatePersonYear includes supported non-registered income buckets in gross income', () => {
    const base = calculatePersonYear(createPersonYearInput());
    const result = calculatePersonYear(
      createPersonYearInput({
        nonRegBalance: 100000,
        nonRegACB: 80000,
        nonRegInterestIncome: 1000,
        nonRegEligibleDividends: 2000,
        nonRegNonEligibleDividends: 500,
        nonRegRealizedCapitalGains: 1500,
      })
    );

    expect(result.totalGrossIncome).toBe(base.totalGrossIncome + 5000);
    expect(result.netIncome).toBe(result.totalGrossIncome - result.taxCalculation.totalTax);
  });

  it('calculatePersonYear keeps legacy scenarios at zero when breakdown fields are absent', () => {
    const result = calculatePersonYear(createPersonYearInput());

    expect(result.taxCalculation.interestIncome).toBe(0);
    expect(result.taxCalculation.dividendIncomeEligible).toBe(0);
    expect(result.taxCalculation.dividendIncomeNonEligible).toBe(0);
    expect(result.taxCalculation.capitalGains).toBe(0);
  });
});

/**
 * RRSP Meltdown Wiring and Guard Audit Tests
 * @see docs/TESTABLE-SURFACES.md — TC-MLT-001 through TC-MLT-004
 * @see .planning/REQUIREMENTS.md — RMLT-01, RMLT-02, RMLT-03, RMLT-04
 */
describe('RRSP Meltdown Wiring and Guard Audit — TC-MLT-001 through TC-MLT-004', () => {
  /**
   * TC-MLT-001 (RMLT-01): Meltdown fires in retirement — RRSP decreases
   * @see docs/TESTABLE-SURFACES.md — TC-MLT-001
   */
  describe('TC-MLT-001: Meltdown fires in retirement', () => {
    it('calculateYear: retired person RRSP balance is lower with meltdown enabled', () => {
      const input = createYearInput({
        birthdate: new Date(1964, 0, 1), // age 66 in 2030, retired (retirementAge 65)
        employmentIncome: 0,
        rrspMeltdown: { enabled: true, annualAmount: 25000, startYear: 2028, endYear: 2035 },
      });
      const result = calculateYear(input);
      const withoutMeltdown = calculateYear({ ...input, rrspMeltdown: undefined });
      expect(result.rrspBalance).toBeLessThan(withoutMeltdown.rrspBalance);
    });

    it('calculatePersonYear: retired person RRSP balance is lower with meltdown enabled', () => {
      const input = createPersonYearInput({
        birthdate: new Date(1964, 0, 1),
        employmentIncome: 0,
        rrspMeltdown: { enabled: true, annualAmount: 25000, startYear: 2028, endYear: 2035 },
      });
      const result = calculatePersonYear(input);
      const withoutMeltdown = calculatePersonYear({ ...input, rrspMeltdown: undefined });
      expect(result.rrspBalance).toBeLessThan(withoutMeltdown.rrspBalance);
    });
  });

  /**
   * TC-MLT-002 (RMLT-02): Meltdown capped at available RRSP balance — no overdraft
   * @see docs/TESTABLE-SURFACES.md — TC-MLT-002
   */
  describe('TC-MLT-002: Meltdown overdraft cap', () => {
    it('calculateYear: RRSP balance >= 0 when annualAmount exceeds balance', () => {
      const input = createYearInput({
        birthdate: new Date(1964, 0, 1),
        employmentIncome: 0,
        rrspBalance: 5000,
        rrspMeltdown: { enabled: true, annualAmount: 25000, startYear: 2028, endYear: 2035 },
      });
      const result = calculateYear(input);
      const withoutMeltdown = calculateYear({ ...input, rrspMeltdown: undefined });
      expect(result.rrspBalance).toBeGreaterThanOrEqual(0);
      expect(withoutMeltdown.rrspBalance - result.rrspBalance).toBeLessThanOrEqual(5000);
    });

    it('calculatePersonYear: RRSP balance >= 0 when annualAmount exceeds balance', () => {
      const input = createPersonYearInput({
        birthdate: new Date(1964, 0, 1),
        employmentIncome: 0,
        rrspBalance: 5000,
        rrspMeltdown: { enabled: true, annualAmount: 25000, startYear: 2028, endYear: 2035 },
      });
      const result = calculatePersonYear(input);
      const withoutMeltdown = calculatePersonYear({ ...input, rrspMeltdown: undefined });
      expect(result.rrspBalance).toBeGreaterThanOrEqual(0);
      expect(withoutMeltdown.rrspBalance - result.rrspBalance).toBeLessThanOrEqual(5000);
    });
  });

  /**
   * TC-MLT-003 (RMLT-03): Meltdown respects targetAmount floor
   * @see docs/TESTABLE-SURFACES.md — TC-MLT-003
   */
  describe('TC-MLT-003: targetAmount floor guard', () => {
    it('calculateYear: meltdown withdrawal limited when targetAmount constrains it', () => {
      const input = createYearInput({
        birthdate: new Date(1964, 0, 1),
        employmentIncome: 0,
        rrspBalance: 200000,
        rrspMeltdown: {
          enabled: true,
          annualAmount: 50000,
          startYear: 2028,
          endYear: 2035,
          targetAmount: 180000,
        },
      });
      const result = calculateYear(input);
      // Without targetAmount, meltdown would withdraw full annualAmount (50000).
      // With targetAmount=180000, meltdown is limited to (currentRRSP - 180000) which
      // is less than 50000, so the RRSP balance is higher with the guard.
      const withoutTarget = calculateYear({
        ...input,
        rrspMeltdown: { enabled: true, annualAmount: 50000, startYear: 2028, endYear: 2035 },
      });
      expect(result.rrspBalance).toBeGreaterThan(withoutTarget.rrspBalance);
    });

    it('calculateYear: zero meltdown when balance already below targetAmount', () => {
      const input = createYearInput({
        birthdate: new Date(1964, 0, 1),
        employmentIncome: 0,
        rrspBalance: 170000,
        rrspMeltdown: {
          enabled: true,
          annualAmount: 50000,
          startYear: 2028,
          endYear: 2035,
          targetAmount: 180000,
        },
      });
      const result = calculateYear(input);
      const withoutMeltdown = calculateYear({ ...input, rrspMeltdown: undefined });
      // Balance already below floor — meltdown should not fire
      expect(result.rrspBalance).toBeCloseTo(withoutMeltdown.rrspBalance, -2);
    });

    it('calculatePersonYear: meltdown withdrawal limited when targetAmount constrains it', () => {
      const input = createPersonYearInput({
        birthdate: new Date(1964, 0, 1),
        employmentIncome: 0,
        rrspBalance: 200000,
        rrspMeltdown: {
          enabled: true,
          annualAmount: 50000,
          startYear: 2028,
          endYear: 2035,
          targetAmount: 180000,
        },
      });
      const result = calculatePersonYear(input);
      // Without targetAmount, meltdown would withdraw full annualAmount (50000).
      // With targetAmount=180000, meltdown is limited to (currentRRSP - 180000) which
      // is less than 50000, so the RRSP balance is higher with the guard.
      const withoutTarget = calculatePersonYear({
        ...input,
        rrspMeltdown: { enabled: true, annualAmount: 50000, startYear: 2028, endYear: 2035 },
      });
      expect(result.rrspBalance).toBeGreaterThan(withoutTarget.rrspBalance);
    });

    it('calculatePersonYear: zero meltdown when balance already below targetAmount', () => {
      const input = createPersonYearInput({
        birthdate: new Date(1964, 0, 1),
        employmentIncome: 0,
        rrspBalance: 170000,
        rrspMeltdown: {
          enabled: true,
          annualAmount: 50000,
          startYear: 2028,
          endYear: 2035,
          targetAmount: 180000,
        },
      });
      const result = calculatePersonYear(input);
      const withoutMeltdown = calculatePersonYear({ ...input, rrspMeltdown: undefined });
      expect(result.rrspBalance).toBeCloseTo(withoutMeltdown.rrspBalance, -2);
    });
  });

  /**
   * TC-MLT-004 (RMLT-04): Employment guard suppresses meltdown even with targetAmount
   * @see docs/TESTABLE-SURFACES.md — TC-MLT-004
   */
  describe('TC-MLT-004: Employment guard with targetAmount', () => {
    it('calculateYear: employed person with targetAmount shows zero meltdown impact', () => {
      // Default createYearInput: age 55, retirementAge 65 — NOT retired
      const input = createYearInput({
        rrspMeltdown: {
          enabled: true,
          annualAmount: 20000,
          startYear: 2028,
          endYear: 2035,
          targetAmount: 100000,
        },
      });
      const result = calculateYear(input);
      const withoutMeltdown = calculateYear({ ...input, rrspMeltdown: undefined });
      expect(result.rrspBalance).toBeCloseTo(withoutMeltdown.rrspBalance, -2);
    });

    it('calculatePersonYear: employed person with targetAmount shows zero meltdown impact', () => {
      const input = createPersonYearInput({
        rrspMeltdown: {
          enabled: true,
          annualAmount: 20000,
          startYear: 2028,
          endYear: 2035,
          targetAmount: 100000,
        },
      });
      const result = calculatePersonYear(input);
      const withoutMeltdown = calculatePersonYear({ ...input, rrspMeltdown: undefined });
      expect(result.rrspBalance).toBeCloseTo(withoutMeltdown.rrspBalance, -2);
    });
  });
});

/**
 * RRIF Conversion and Mandatory Minimum Tests
 * @see docs/TESTABLE-SURFACES.md — TC-RRIF-010 through TC-RRIF-015
 * @see .planning/REQUIREMENTS.md — CONV-01, CONV-02, RMIN-01, RMIN-02, RMIN-03, RMIN-04
 * @see docs/source-of-truth/02-account-types.md — RRIF-002
 */
describe('RRIF Conversion and Mandatory Minimum — TC-RRIF-010 through TC-RRIF-015', () => {
  describe('calculatePersonYear RRIF conversion year (age 71)', () => {
    /**
     * TC-RRIF-010: rrifConversionYear=true at age 71 with RRSP balance
     * @see docs/TESTABLE-SURFACES.md — TC-RRIF-010
     */
    it('TC-RRIF-010: rrifConversionYear is true when RRSP balance > 0 at age 71', () => {
      // birthdate 1959-01-01 → age 71 in 2030
      const input = createPersonYearInput({
        birthdate: new Date(1959, 0, 1),
        rrspBalance: 200000,
        rrifBalance: 0,
        employmentIncome: 0,
        retirementAge: 65,
      });

      const result = calculatePersonYear(input);

      expect(result.rrifConversionYear).toBe(true);
    });

    /**
     * TC-RRIF-011: rrifForcedMinimum=0 at age 71 (conversion year — minimums start at 72)
     * @see docs/TESTABLE-SURFACES.md — TC-RRIF-011
     * @see docs/source-of-truth/02-account-types.md — RRIF-002
     */
    it('TC-RRIF-011: rrifForcedMinimum is exactly 0 in the conversion year (age 71)', () => {
      const input = createPersonYearInput({
        birthdate: new Date(1959, 0, 1), // age 71 in 2030
        rrspBalance: 200000,
        rrifBalance: 0,
        employmentIncome: 0,
        retirementAge: 65,
      });

      const result = calculatePersonYear(input);

      expect(result.rrifForcedMinimum).toBe(0);
    });
  });

  describe('calculatePersonYear forced minimum at age 72', () => {
    /**
     * TC-RRIF-012: rrifForcedMinimum = opening balance × rate at age 72
     * Opening balance $500,000, rate 0.054 → forced minimum = 27000.00
     * @see docs/TESTABLE-SURFACES.md — TC-RRIF-012
     * @see docs/source-of-truth/02-account-types.md — RRIF-002
     */
    it('TC-RRIF-012: rrifForcedMinimum equals $500,000 × 0.054 = $27,000 at age 72', () => {
      // birthdate 1958-01-01 → age 72 in 2030
      const input = createPersonYearInput({
        birthdate: new Date(1958, 0, 1),
        rrspBalance: 0,
        rrifBalance: 500000,
        employmentIncome: 0,
        retirementAge: 65,
      });

      const result = calculatePersonYear(input);

      expect(result.rrifForcedMinimum).toBeCloseTo(500000 * 0.054, 2);
    });

    /**
     * TC-RRIF-013: rrifMinimumRate stores exact CRA decimal (0.0540 at age 72, not a percentage)
     * @see docs/TESTABLE-SURFACES.md — TC-RRIF-013
     * @see docs/source-of-truth/02-account-types.md — RRIF-002
     */
    it('TC-RRIF-013: rrifMinimumRate is 0.054 (decimal) at age 72', () => {
      const input = createPersonYearInput({
        birthdate: new Date(1958, 0, 1), // age 72 in 2030
        rrspBalance: 0,
        rrifBalance: 500000,
        employmentIncome: 0,
        retirementAge: 65,
      });

      const result = calculatePersonYear(input);

      expect(result.rrifMinimumRate).toBe(0.054);
    });

    /**
     * TC-RRIF-015: forced minimum uses opening balance (before growth), not end-of-year balance
     * Opening: $500,000 → forced minimum ≈ 27,000. Post-growth balance × rate would be higher.
     * @see docs/TESTABLE-SURFACES.md — TC-RRIF-015
     * @see .planning/REQUIREMENTS.md — RMIN-02
     */
    it('TC-RRIF-015: forced minimum is computed against opening RRIF balance, not post-growth balance', () => {
      const openingBalance = 500000;
      const investmentReturn = 0.05;
      const input = createPersonYearInput({
        birthdate: new Date(1958, 0, 1), // age 72 in 2030
        rrspBalance: 0,
        rrifBalance: openingBalance,
        employmentIncome: 0,
        retirementAge: 65,
        investmentReturn,
      });

      const result = calculatePersonYear(input);

      // If using opening balance: 500000 × 0.054 = 27000
      // If wrongly using end-of-year (post-growth, post-withdrawal): higher value
      const expectedFromOpening = openingBalance * 0.054;
      const wrongValueFromPostGrowth = openingBalance * (1 + investmentReturn) * 0.054;

      expect(result.rrifForcedMinimum).toBeCloseTo(expectedFromOpening, 2);
      expect(result.rrifForcedMinimum).not.toBeCloseTo(wrongValueFromPostGrowth, 2);
    });
  });

  describe('calculatePersonYear no RRIF when RRSP=0 at age 71', () => {
    /**
     * TC-RRIF-014: CONV-02 — no RRIF created when RRSP=0, all RRIF minimum fields remain 0
     * @see docs/TESTABLE-SURFACES.md — TC-RRIF-014
     * @see .planning/REQUIREMENTS.md — CONV-02
     */
    it('TC-RRIF-014: rrifConversionYear=false and all RRIF fields=0 when RRSP balance is $0 at age 71', () => {
      const input = createPersonYearInput({
        birthdate: new Date(1959, 0, 1), // age 71 in 2030
        rrspBalance: 0,
        rrifBalance: 0,
        employmentIncome: 0,
        retirementAge: 65,
      });

      const result = calculatePersonYear(input);

      expect(result.rrifConversionYear).toBe(false);
      expect(result.rrifForcedMinimum).toBe(0);
      expect(result.rrifMinimumRate).toBe(0);
    });
  });
});

/**
 * Younger-Spouse RRIF Rate Election Tests
 * @see docs/TESTABLE-SURFACES.md — TC-RRIF-016, TC-RRIF-017
 * @see .planning/REQUIREMENTS.md — RYSP-01, RYSP-02
 * @see docs/source-of-truth/02-account-types.md — RRIF-002
 */
describe('Younger-Spouse RRIF Rate Election — TC-RRIF-016 through TC-RRIF-017', () => {
  /**
   * TC-RRIF-016: younger-spouse election uses spouse age 65 rate (0.04) instead of owner age 75 rate (0.0582)
   * @see docs/TESTABLE-SURFACES.md — TC-RRIF-016
   * @see .planning/REQUIREMENTS.md — RYSP-01
   */
  it('TC-RRIF-016: rrifMinimumRate uses spouse age 65 rate (0.04) when useYoungerSpouseForRRIF=true', () => {
    const input = createPersonYearInput({
      birthdate: new Date(1955, 0, 1), // age 75 in 2030
      rrspBalance: 0,
      rrifBalance: 500000,
      retirementAge: 60,
      employmentIncome: 0,
      rrspContribution: 0,
      useYoungerSpouseForRRIF: true,
      spouseAge: 65,
    });
    const result = calculatePersonYear(input);
    expect(result.rrifMinimumRate).toBe(0.04);
    expect(result.rrifForcedMinimum).toBe(20000); // 500000 * 0.04
  });

  /**
   * TC-RRIF-017: without younger-spouse election, owner age 75 rate (0.0582) is used
   * @see docs/TESTABLE-SURFACES.md — TC-RRIF-017
   * @see .planning/REQUIREMENTS.md — RYSP-02
   */
  it('TC-RRIF-017: rrifMinimumRate uses owner age 75 rate (0.0582) when useYoungerSpouseForRRIF=false', () => {
    const input = createPersonYearInput({
      birthdate: new Date(1955, 0, 1), // age 75 in 2030
      rrspBalance: 0,
      rrifBalance: 500000,
      retirementAge: 60,
      employmentIncome: 0,
      rrspContribution: 0,
      useYoungerSpouseForRRIF: false,
    });
    const result = calculatePersonYear(input);
    expect(result.rrifMinimumRate).toBe(0.0582);
    expect(result.rrifForcedMinimum).toBe(29100); // 500000 * 0.0582
  });
});
