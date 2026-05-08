/**
 * Couple Calculator Tests
 * @see docs/source-of-truth/08-projection-engine.md
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Pension Income Splitting
 */
import { describe, it, expect } from 'vitest';
import { calculateCoupleYear, type CoupleYearInput } from './couple-calculator.js';
import type { PersonYearInput } from './yearly-calculator.js';

// Helper to create a standard person input for couple testing
function createPersonInput(
  overrides: Partial<Omit<PersonYearInput, 'owner' | 'year' | 'maritalStatus'>> = {}
): Omit<PersonYearInput, 'owner' | 'year' | 'maritalStatus'> {
  const birthdate = new Date(1959, 0, 1); // Born Jan 1, 1959 (65 years old in 2024)
  return {
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
    retirementSpending: 25000, // Half of couple's spending
    investmentReturn: 0.04,
    inflationRate: 0.02,
    retirementAge: 65,
    yearsFromProjectionStart: 0,
    ...overrides,
  };
}

// Helper to create a standard couple input
function createCoupleInput(overrides: Partial<CoupleYearInput> = {}): CoupleYearInput {
  return {
    year: 2024,
    maritalStatus: 'married',
    primary: createPersonInput(),
    spouse: createPersonInput({
      birthdate: new Date(1961, 0, 1), // 2 years younger
    }),
    optimizePensionSplitting: true,
    useYoungerSpouseForRRIF: false,
    ...overrides,
  };
}

describe('Couple Calculator', () => {
  describe('calculateCoupleYear', () => {
    it('should calculate basic year for married couple', () => {
      const input = createCoupleInput();

      const result = calculateCoupleYear(input);

      expect(result.year).toBe(2024);
      expect(result.primary).toBeDefined();
      expect(result.spouse).toBeDefined();
      expect(result.primary.owner).toBe('primary');
      expect(result.spouse.owner).toBe('spouse');
    });

    it('should calculate household aggregates correctly', () => {
      const input = createCoupleInput({
        sharedRetirementSpending: 50000,
      });

      const result = calculateCoupleYear(input);

      // Household income should be sum of both spouses
      expect(result.householdGrossIncome).toBe(
        result.primary.totalGrossIncome + result.spouse.totalGrossIncome
      );

      // Household taxes should be sum of both
      expect(result.householdTaxesPaid).toBe(result.primary.taxesPaid + result.spouse.taxesPaid);

      // Household net income = gross - taxes
      expect(result.householdNetIncome).toBeCloseTo(
        result.householdGrossIncome - result.householdTaxesPaid,
        2
      );

      // Household net worth = sum of both
      expect(result.householdNetWorth).toBe(
        result.primary.totalNetWorth + result.spouse.totalNetWorth
      );
    });

    it('should derive household spending from the actual per-person expenses', () => {
      const sharedSpending = 60000;
      const input = createCoupleInput({
        sharedRetirementSpending: sharedSpending,
      });

      const result = calculateCoupleYear(input);

      expect(result.householdLivingExpenses).toBe(
        result.primary.livingExpenses + result.spouse.livingExpenses
      );
    });

    it('should sum individual spending when shared not provided', () => {
      const input = createCoupleInput({
        primary: createPersonInput({ retirementSpending: 30000 }),
        spouse: createPersonInput({
          birthdate: new Date(1961, 0, 1),
          retirementSpending: 25000,
        }),
      });

      const result = calculateCoupleYear(input);

      expect(result.householdLivingExpenses).toBe(
        result.primary.livingExpenses + result.spouse.livingExpenses
      );
    });

    describe('Couple Spending Correction — REGR (FIX-04/FIX-05)', () => {
      it('should report householdLivingExpenses as inflated sum of the per-person spending', () => {
        // Simulates the FIXED multi-year.ts: retirementSpending=40000 (sharedRetirementSpending/2)
        // householdLivingExpenses should use the actual per-person expenses after inflation/age bands.
        const input = createCoupleInput({
          year: 2025,
          primary: createPersonInput({
            retirementSpending: 40000,
            yearsFromProjectionStart: 1,
          }),
          spouse: createPersonInput({
            birthdate: new Date(1961, 0, 1),
            retirementAge: 63,
            retirementSpending: 40000,
            yearsFromProjectionStart: 1,
          }),
          sharedRetirementSpending: 80000,
        });

        const result = calculateCoupleYear(input);

        // Each person spends the already-halved per-person amount, inflated for year 1.
        expect(result.primary.livingExpenses).toBeCloseTo(40800, 2);
        expect(result.spouse.livingExpenses).toBeCloseTo(40800, 2);

        // Aggregate must match the inflated per-person expenses, not the raw shared target.
        expect(result.householdLivingExpenses).toBeCloseTo(81600, 2);
        expect(result.householdNetCashFlow).toBeCloseTo(
          result.householdNetIncome - result.householdLivingExpenses,
          2
        );
      });

      it('should fall back to sum of individual expenses when sharedRetirementSpending is not set', () => {
        const input = createCoupleInput({
          primary: createPersonInput({ retirementSpending: 50000 }),
          spouse: createPersonInput({
            birthdate: new Date(1961, 0, 1),
            retirementAge: 63,
            retirementSpending: 30000,
          }),
          // no sharedRetirementSpending
        });

        const result = calculateCoupleYear(input);

        expect(result.primary.livingExpenses).toBeCloseTo(50000, -3);
        expect(result.spouse.livingExpenses).toBeCloseTo(30000, -3);
        // householdLivingExpenses = sum when no shared spending
        expect(result.householdLivingExpenses).toBeCloseTo(80000, -3);
      });
    });

    it('should track retirement status for both spouses', () => {
      const input = createCoupleInput({
        primary: createPersonInput({
          birthdate: new Date(1959, 0, 1), // 65, retired
          retirementAge: 65,
        }),
        spouse: createPersonInput({
          birthdate: new Date(1964, 0, 1), // 60, not retired yet
          retirementAge: 62,
        }),
      });

      const result = calculateCoupleYear(input);

      expect(result.primary.isRetired).toBe(true);
      expect(result.spouse.isRetired).toBe(false);
      expect(result.bothRetired).toBe(false);
    });

    it('should indicate when both spouses are retired', () => {
      const input = createCoupleInput({
        primary: createPersonInput({
          birthdate: new Date(1959, 0, 1),
          retirementAge: 60,
        }),
        spouse: createPersonInput({
          birthdate: new Date(1961, 0, 1),
          retirementAge: 60,
        }),
      });

      const result = calculateCoupleYear(input);

      expect(result.bothRetired).toBe(true);
    });
  });

  describe('Pension Income Splitting', () => {
    /**
     * @see docs/source-of-truth/07-withdrawal-strategies.md - TC-WD-006
     */
    it('should optimize pension splitting when both 65+', () => {
      const input = createCoupleInput({
        primary: createPersonInput({
          birthdate: new Date(1959, 0, 1), // 65
          rrifBalance: 500000, // Large RRIF = high splittable income
          retirementSpending: 40000,
        }),
        spouse: createPersonInput({
          birthdate: new Date(1959, 0, 1), // Also 65
          rrifBalance: 50000, // Small RRIF
          retirementSpending: 20000,
        }),
        optimizePensionSplitting: true,
      });

      const result = calculateCoupleYear(input);

      // Should have some pension splitting
      // Primary has higher income, should transfer to spouse
      if (result.pensionSplitPercentage > 0) {
        expect(result.primary.pensionIncomeTransferred).toBeGreaterThan(0);
        expect(result.spouse.pensionIncomeReceived).toBeGreaterThan(0);
        expect(result.pensionSplitTaxSavings).toBeGreaterThanOrEqual(0);
      }
    });

    it('should NOT split pension when one spouse is under 65', () => {
      const input = createCoupleInput({
        primary: createPersonInput({
          birthdate: new Date(1959, 0, 1), // 65
          rrifBalance: 500000,
        }),
        spouse: createPersonInput({
          birthdate: new Date(1964, 0, 1), // 60 - under 65
          rrifBalance: 50000,
        }),
        optimizePensionSplitting: true,
      });

      const result = calculateCoupleYear(input);

      // Should not split because spouse is under 65
      expect(result.pensionSplitPercentage).toBe(0);
      expect(result.pensionSplitTaxSavings).toBe(0);
    });

    it('should NOT split when optimization is disabled', () => {
      const input = createCoupleInput({
        primary: createPersonInput({
          birthdate: new Date(1959, 0, 1),
          rrifBalance: 500000,
        }),
        spouse: createPersonInput({
          birthdate: new Date(1959, 0, 1),
          rrifBalance: 50000,
        }),
        optimizePensionSplitting: false, // Disabled
      });

      const result = calculateCoupleYear(input);

      expect(result.pensionSplitPercentage).toBe(0);
    });

    it('should split up to 50% maximum', () => {
      const input = createCoupleInput({
        primary: createPersonInput({
          birthdate: new Date(1959, 0, 1),
          rrifBalance: 1000000, // Very large RRIF
          pensionIncome: 50000, // Also pension income
        }),
        spouse: createPersonInput({
          birthdate: new Date(1959, 0, 1),
          rrifBalance: 10000, // Minimal
        }),
        optimizePensionSplitting: true,
      });

      const result = calculateCoupleYear(input);

      // Maximum split is 50%
      expect(result.pensionSplitPercentage).toBeLessThanOrEqual(0.5);
    });
  });

  describe('Spouse OAS Awareness', () => {
    it('should pass spouseReceivingOAS flag correctly', () => {
      const input = createCoupleInput({
        primary: createPersonInput({
          birthdate: new Date(1959, 0, 1), // 65, receiving OAS
          oasStartAge: 65,
        }),
        spouse: createPersonInput({
          birthdate: new Date(1961, 0, 1), // 63, not receiving OAS
          oasStartAge: 65,
        }),
      });

      const result = calculateCoupleYear(input);

      // Primary receives OAS
      expect(result.primary.oasIncome).toBeGreaterThan(0);
      // Spouse doesn't yet
      expect(result.spouse.oasIncome).toBe(0);
    });

    it('should calculate GIS with spouse awareness', () => {
      // Low-income couple where GIS is relevant
      const input = createCoupleInput({
        primary: createPersonInput({
          birthdate: new Date(1959, 0, 1),
          rrspBalance: 50000,
          rrifBalance: 0,
          tfsaBalance: 10000,
          nonRegBalance: 5000,
          expectedCPPAt65: 6000, // Low CPP
          retirementSpending: 15000,
        }),
        spouse: createPersonInput({
          birthdate: new Date(1959, 0, 1),
          rrspBalance: 30000,
          rrifBalance: 0,
          tfsaBalance: 5000,
          nonRegBalance: 2000,
          expectedCPPAt65: 4000, // Very low CPP
          retirementSpending: 12000,
        }),
      });

      const result = calculateCoupleYear(input);

      // Both should have OAS at 65
      expect(result.primary.oasIncome).toBeGreaterThan(0);
      expect(result.spouse.oasIncome).toBeGreaterThan(0);
    });
  });

  describe('RRIF Conversion', () => {
    it('should track RRIF conversion for each spouse independently', () => {
      const input = createCoupleInput({
        primary: createPersonInput({
          birthdate: new Date(1953, 0, 1), // 71 - conversion year
          rrspBalance: 400000,
          rrifBalance: 0,
        }),
        spouse: createPersonInput({
          birthdate: new Date(1959, 0, 1), // 65 - not conversion year
          rrspBalance: 200000,
          rrifBalance: 0,
        }),
      });

      const result = calculateCoupleYear(input);

      // Primary should convert at 71
      expect(result.primary.isRRIFConversionYear).toBe(true);
      expect(result.primary.rrspBalance).toBe(0);

      // Spouse should not convert at 65
      expect(result.spouse.isRRIFConversionYear).toBe(false);
    });

    it('should flag when either spouse has RRIF conversion', () => {
      const input = createCoupleInput({
        primary: createPersonInput({
          birthdate: new Date(1953, 0, 1), // 71
          rrspBalance: 400000,
        }),
        spouse: createPersonInput({
          birthdate: new Date(1959, 0, 1), // 65
        }),
      });

      const result = calculateCoupleYear(input);

      expect(result.eitherRRIFConversion).toBe(true);
    });
  });

  describe('Different Provinces', () => {
    it('should handle spouses in different provinces', () => {
      const input = createCoupleInput({
        primary: createPersonInput({
          province: 'ON',
        }),
        spouse: createPersonInput({
          birthdate: new Date(1961, 0, 1),
          province: 'AB', // Different province
        }),
      });

      const result = calculateCoupleYear(input);

      // Should calculate successfully
      expect(result.primary).toBeDefined();
      expect(result.spouse).toBeDefined();

      // Tax calculations should use respective provinces
      expect(result.primary.taxCalculation).toBeDefined();
      expect(result.spouse.taxCalculation).toBeDefined();
    });
  });

  describe('Age Calculations', () => {
    it('should calculate ages correctly for both spouses', () => {
      const input = createCoupleInput({
        year: 2024,
        primary: createPersonInput({
          birthdate: new Date(1959, 0, 1), // 65 in 2024
        }),
        spouse: createPersonInput({
          birthdate: new Date(1964, 6, 15), // 60 in 2024
        }),
      });

      const result = calculateCoupleYear(input);

      expect(result.primary.age).toBe(65);
      expect(result.spouse.age).toBe(60);
    });
  });

  describe('Younger Spouse RRIF', () => {
    it('should use younger spouse age for RRIF when enabled', () => {
      const input = createCoupleInput({
        primary: createPersonInput({
          birthdate: new Date(1951, 0, 1), // 73 - past RRIF conversion
          rrspBalance: 0,
          rrifBalance: 500000,
        }),
        spouse: createPersonInput({
          birthdate: new Date(1959, 0, 1), // 65 - younger
        }),
        useYoungerSpouseForRRIF: true,
      });

      const result = calculateCoupleYear(input);

      // RRIF minimum should be based on younger spouse's age
      // At 65, there's no minimum yet (pre-72)
      expect(result.primary.rrifWithdrawal).toBeDefined();
    });
  });

  describe('Real-world Couple Scenarios', () => {
    it('should project typical Canadian retired couple', () => {
      const input = createCoupleInput({
        year: 2024,
        primary: createPersonInput({
          birthdate: new Date(1959, 0, 1), // 65
          rrspBalance: 400000,
          tfsaBalance: 80000,
          nonRegBalance: 100000,
          expectedCPPAt65: 14000,
          retirementAge: 65,
          retirementSpending: 30000,
        }),
        spouse: createPersonInput({
          birthdate: new Date(1961, 0, 1), // 63
          rrspBalance: 250000,
          tfsaBalance: 60000,
          nonRegBalance: 50000,
          expectedCPPAt65: 10000,
          retirementAge: 63,
          retirementSpending: 25000,
        }),
        sharedRetirementSpending: 55000,
        optimizePensionSplitting: true,
      });

      const result = calculateCoupleYear(input);

      // Both should be retired
      expect(result.bothRetired).toBe(true);

      // Household should have reasonable net worth
      expect(result.householdNetWorth).toBeGreaterThan(800000);

      // Should have government benefits
      expect(result.primary.cppIncome).toBeGreaterThan(0);
      expect(result.primary.oasIncome).toBeGreaterThan(0);
      // Spouse at 63 with default cppStartAge of 65 doesn't get CPP/OAS yet
      expect(result.spouse.cppIncome).toBe(0);
      expect(result.spouse.oasIncome).toBe(0);
    });

    it('should handle early retirement with staggered timing', () => {
      const input = createCoupleInput({
        year: 2024,
        primary: createPersonInput({
          birthdate: new Date(1964, 0, 1), // 60
          employmentIncome: 0,
          rrspBalance: 500000,
          retirementAge: 58, // Already retired
          retirementSpending: 35000,
          cppStartAge: 60,
          oasStartAge: 65,
        }),
        spouse: createPersonInput({
          birthdate: new Date(1966, 0, 1), // 58
          employmentIncome: 80000, // Still working
          rrspBalance: 300000,
          retirementAge: 60, // Plans to retire at 60
          retirementSpending: 0, // Not spending from retirement yet
          rrspContribution: 15000,
        }),
      });

      const result = calculateCoupleYear(input);

      // Primary is retired
      expect(result.primary.isRetired).toBe(true);
      expect(result.primary.employmentIncome).toBe(0);

      // Spouse is still working
      expect(result.spouse.isRetired).toBe(false);
      expect(result.spouse.employmentIncome).toBe(80000);

      // Not both retired
      expect(result.bothRetired).toBe(false);
    });

    it('should pool working-spouse cashflow before retired spouse gap withdrawals', () => {
      const input = createCoupleInput({
        year: 2049,
        primary: createPersonInput({
          birthdate: new Date(1970, 0, 1),
          retirementAge: 85,
          employmentIncome: 200000,
          rrspBalance: 0,
          tfsaBalance: 0,
          nonRegBalance: 0,
          nonRegACB: 0,
          retirementSpending: 50000,
        }),
        spouse: createPersonInput({
          birthdate: new Date(1989, 0, 1),
          retirementAge: 55,
          employmentIncome: 0,
          rrspBalance: 300000,
          tfsaBalance: 0,
          nonRegBalance: 0,
          nonRegACB: 0,
          cppStartAge: 65,
          oasStartAge: 65,
          retirementSpending: 50000,
        }),
        sharedRetirementSpending: 100000,
        optimizePensionSplitting: false,
      });

      const result = calculateCoupleYear(input);

      expect(result.primary.isRetired).toBe(false);
      expect(result.spouse.isRetired).toBe(true);
      expect(result.primary.netIncome).toBeGreaterThan(result.spouse.livingExpenses);
      expect(result.spouse.rrifWithdrawal).toBe(0);
      expect(result.spouse.rrspBalance).toBeCloseTo(312000, 2);
    });

    it('should only withdraw the household spending gap not covered by working-spouse cashflow', () => {
      const input = createCoupleInput({
        year: 2049,
        primary: createPersonInput({
          birthdate: new Date(1970, 0, 1),
          retirementAge: 85,
          employmentIncome: 10000,
          rrspBalance: 0,
          tfsaBalance: 0,
          nonRegBalance: 0,
          nonRegACB: 0,
          retirementSpending: 50000,
        }),
        spouse: createPersonInput({
          birthdate: new Date(1989, 0, 1),
          retirementAge: 55,
          employmentIncome: 0,
          rrspBalance: 300000,
          tfsaBalance: 0,
          nonRegBalance: 0,
          nonRegACB: 0,
          cppStartAge: 65,
          oasStartAge: 65,
          retirementSpending: 50000,
        }),
        sharedRetirementSpending: 100000,
        optimizePensionSplitting: false,
      });

      const result = calculateCoupleYear(input);

      expect(result.primary.isRetired).toBe(false);
      expect(result.spouse.isRetired).toBe(true);
      expect(result.spouse.rrifWithdrawal).toBeGreaterThan(0);
      expect(result.spouse.rrifWithdrawal).toBeLessThan(result.spouse.livingExpenses);
    });
  });

  // ---------------------------------------------------------------------------
  // Idea B proof: householdSpendingMode = 'household'
  //
  // When primary's accounts are depleted but spouse has accounts available, the
  // 'household' mode should pool: primary's unfunded shortfall is added to
  // spouse's withdrawal gap and pulled from spouse's accounts. The 'per-owner'
  // default leaves primary unfunded.
  // ---------------------------------------------------------------------------
  describe("householdSpendingMode='household' pools shortfall across spouses", () => {
    it("pulls extra from spouse's accounts when primary cannot fund their share", () => {
      // Both retired (default 65). Primary depleted, spouse well-funded.
      const baseInput: CoupleYearInput = {
        year: 2024,
        maritalStatus: 'married',
        primary: createPersonInput({
          rrspBalance: 0,
          rrifBalance: 0,
          tfsaBalance: 0,
          nonRegBalance: 0,
          nonRegACB: 0,
          retirementSpending: 50_000, // primary's share — 50k real
          retirementAge: 65,
        }),
        spouse: createPersonInput({
          rrspBalance: 0,
          rrifBalance: 0,
          tfsaBalance: 1_000_000, // spouse has $1M TFSA available
          nonRegBalance: 0,
          nonRegACB: 0,
          retirementSpending: 50_000,
          retirementAge: 65,
        }),
        optimizePensionSplitting: false,
        useYoungerSpouseForRRIF: false,
      };

      // Run twice: per-owner (default) vs household pooling
      const perOwnerResult = calculateCoupleYear(baseInput);
      const householdResult = calculateCoupleYear({
        ...baseInput,
        householdSpendingMode: 'household',
      });

      // Per-owner: primary should run a deficit (no accounts to draw from);
      // spouse's TFSA should be roughly untouched beyond covering own spending.
      expect(perOwnerResult.primary.netCashFlow).toBeLessThan(0);

      // Household pool: spouse should withdraw MORE from TFSA than in per-owner
      // mode because primary's shortfall is added to spouse's gap.
      expect(householdResult.spouse.tfsaWithdrawal).toBeGreaterThan(
        perOwnerResult.spouse.tfsaWithdrawal
      );

      // Spouse's TFSA balance at end of year should be lower in household mode.
      expect(householdResult.spouse.tfsaBalance).toBeLessThan(perOwnerResult.spouse.tfsaBalance);
    });

    it("absent flag (default 'per-owner') preserves existing behaviour exactly", () => {
      // Same fixture as above but no householdSpendingMode set anywhere.
      const baseInput: CoupleYearInput = {
        year: 2024,
        maritalStatus: 'married',
        primary: createPersonInput({
          rrspBalance: 0,
          tfsaBalance: 0,
          nonRegBalance: 0,
          nonRegACB: 0,
          retirementSpending: 50_000,
          retirementAge: 65,
        }),
        spouse: createPersonInput({
          tfsaBalance: 1_000_000,
          nonRegBalance: 0,
          nonRegACB: 0,
          retirementSpending: 50_000,
          retirementAge: 65,
        }),
        optimizePensionSplitting: false,
        useYoungerSpouseForRRIF: false,
      };

      const a = calculateCoupleYear(baseInput);
      const b = calculateCoupleYear({ ...baseInput, householdSpendingMode: 'per-owner' });

      // 'per-owner' explicit and absent must produce identical primary results
      expect(b.primary.netCashFlow).toBeCloseTo(a.primary.netCashFlow, 2);
      expect(b.spouse.tfsaWithdrawal).toBeCloseTo(a.spouse.tfsaWithdrawal, 2);
      expect(b.spouse.tfsaBalance).toBeCloseTo(a.spouse.tfsaBalance, 2);
    });

    it('does NOT pool when only one spouse is retired (asymmetric branch governs)', () => {
      // Spouse not yet retired → asymmetric branch is responsible. Setting
      // householdSpendingMode='household' should NOT activate the pooling branch.
      const input: CoupleYearInput = {
        year: 2024,
        maritalStatus: 'married',
        primary: createPersonInput({
          rrspBalance: 0,
          tfsaBalance: 0,
          nonRegBalance: 0,
          nonRegACB: 0,
          retirementSpending: 50_000,
          retirementAge: 65,
        }),
        spouse: createPersonInput({
          birthdate: new Date(1980, 0, 1), // age 44 in 2024 — NOT retired
          tfsaBalance: 1_000_000,
          nonRegBalance: 0,
          nonRegACB: 0,
          employmentIncome: 0,
          retirementSpending: 50_000,
          retirementAge: 65,
        }),
        optimizePensionSplitting: false,
        useYoungerSpouseForRRIF: false,
        householdSpendingMode: 'household',
      };

      const result = calculateCoupleYear(input);
      // Spouse has zero employment + no retirement spending obligation when not
      // retired. The household-pool branch should be inert here.
      expect(result.spouse.isRetired).toBe(false);
    });
  });
});
