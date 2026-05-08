/**
 * Tax Credits Tests
 * @see docs/source-of-truth/04-tax-engine.md - Tax Credits Detail
 */
import { describe, it, expect } from 'vitest';
import {
  calculateSpouseAmountCredit,
  calculateDisabilityTaxCredit,
  calculateMedicalExpensesCredit,
  calculateCharitableDonationsCredit,
  calculateCaregiverCredit,
  calculateHomeAccessibilityCredit,
  calculateEmploymentCredit,
  calculateClimateActionIncentive,
  calculateComprehensiveTaxCredits,
} from './credits.js';

describe('Tax Credits', () => {
  describe('calculateSpouseAmountCredit', () => {
    it('should return full credit when spouse has no income', () => {
      const result = calculateSpouseAmountCredit({ spouseNetIncome: 0 }, 'ON');
      // Federal: $15,705 * 15% = $2,355.75
      expect(result.federal).toBeCloseTo(15705 * 0.15, 2);
      // Ontario: $12,399 * 5.05% = $626.15
      expect(result.provincial).toBeCloseTo(12399 * 0.0505, 2);
    });

    it('should reduce credit by spouse income', () => {
      const result = calculateSpouseAmountCredit({ spouseNetIncome: 5000 }, 'ON');
      // Federal: ($15,705 - $5,000) * 15% = $1,605.75
      expect(result.federal).toBeCloseTo((15705 - 5000) * 0.15, 2);
      // Ontario: ($12,399 - $5,000) * 5.05% = $373.65
      expect(result.provincial).toBeCloseTo((12399 - 5000) * 0.0505, 2);
    });

    it('should return zero when spouse income exceeds threshold', () => {
      const result = calculateSpouseAmountCredit({ spouseNetIncome: 20000 }, 'ON');
      expect(result.federal).toBe(0);
      expect(result.provincial).toBe(0);
    });

    it('should calculate correctly for BC', () => {
      const result = calculateSpouseAmountCredit({ spouseNetIncome: 0 }, 'BC');
      // BC: $12,580 * 5.06% = $636.55
      expect(result.provincial).toBeCloseTo(12580 * 0.0506, 2);
    });

    it('should calculate correctly for Alberta', () => {
      const result = calculateSpouseAmountCredit({ spouseNetIncome: 0 }, 'AB');
      // Alberta: $21,003 * 10% = $2,100.30
      expect(result.provincial).toBeCloseTo(21003 * 0.1, 2);
    });

    it('should use default rate for other provinces', () => {
      const result = calculateSpouseAmountCredit({ spouseNetIncome: 0 }, 'SK');
      expect(result.federal).toBeCloseTo(15705 * 0.15, 2);
      expect(result.provincial).toBeCloseTo(15705 * 0.05, 2);
    });
  });

  describe('calculateDisabilityTaxCredit', () => {
    it('should return zero when no disability', () => {
      const result = calculateDisabilityTaxCredit({ hasDisability: false }, 'ON');
      expect(result.federal).toBe(0);
      expect(result.provincial).toBe(0);
    });

    it('should return base credit for adult with disability', () => {
      const result = calculateDisabilityTaxCredit({ hasDisability: true }, 'ON');
      // Federal: $9,428 * 15% = $1,414.20
      expect(result.federal).toBeCloseTo(9428 * 0.15, 2);
      // Ontario: $9,586 * 5.05% = $484.09
      expect(result.provincial).toBeCloseTo(9586 * 0.0505, 2);
    });

    it('should add supplement for child under 18', () => {
      const result = calculateDisabilityTaxCredit({ hasDisability: true, isUnder18: true }, 'ON');
      // Federal: ($9,428 + $5,500) * 15% = $2,239.20
      expect(result.federal).toBeCloseTo((9428 + 5500) * 0.15, 2);
    });

    it('should calculate correctly for BC', () => {
      const result = calculateDisabilityTaxCredit({ hasDisability: true }, 'BC');
      expect(result.provincial).toBeCloseTo(9428 * 0.0506, 2);
    });

    it('should calculate correctly for Alberta', () => {
      const result = calculateDisabilityTaxCredit({ hasDisability: true }, 'AB');
      expect(result.provincial).toBeCloseTo(16635 * 0.1, 2);
    });
  });

  describe('calculateMedicalExpensesCredit', () => {
    it('should return zero when expenses below threshold', () => {
      // With $100,000 income, threshold is $2,759 (max)
      const result = calculateMedicalExpensesCredit(
        { eligibleExpenses: 1000, netIncome: 100000 },
        'ON'
      );
      expect(result.federal).toBe(0);
      expect(result.provincial).toBe(0);
    });

    it('should calculate credit for expenses above threshold (high income)', () => {
      // Income $100,000, threshold = $2,759 (max cap)
      // Expenses $5,000 - claimable = $2,241
      const result = calculateMedicalExpensesCredit(
        { eligibleExpenses: 5000, netIncome: 100000 },
        'ON'
      );
      expect(result.federal).toBeCloseTo((5000 - 2759) * 0.15, 2);
      expect(result.provincial).toBeCloseTo((5000 - 2759) * 0.0505, 2);
    });

    it('should use 3% of income when lower than cap', () => {
      // Income $50,000, threshold = $1,500 (3% of income)
      // Expenses $3,000 - claimable = $1,500
      const result = calculateMedicalExpensesCredit(
        { eligibleExpenses: 3000, netIncome: 50000 },
        'ON'
      );
      expect(result.federal).toBeCloseTo((3000 - 1500) * 0.15, 2);
    });

    it('should include dependant medical expenses', () => {
      const result = calculateMedicalExpensesCredit(
        { eligibleExpenses: 5000, netIncome: 100000, dependantExpenses: 3000 },
        'ON'
      );
      // Main: ($5,000 - $2,759) * 15% = $336.15
      // Dependant: ($3,000 - $2,759) * 15% = $36.15
      expect(result.federal).toBeCloseTo((5000 - 2759) * 0.15 + (3000 - 2759) * 0.15, 2);
    });

    it('should calculate correctly for Alberta', () => {
      const result = calculateMedicalExpensesCredit(
        { eligibleExpenses: 5000, netIncome: 100000 },
        'AB'
      );
      expect(result.provincial).toBeCloseTo((5000 - 2759) * 0.1, 2);
    });
  });

  describe('calculateCharitableDonationsCredit', () => {
    it('should return zero for zero donations', () => {
      const result = calculateCharitableDonationsCredit(
        { donations: 0, taxableIncome: 50000 },
        'ON'
      );
      expect(result.federal).toBe(0);
      expect(result.provincial).toBe(0);
    });

    it('should return zero for negative donations', () => {
      const result = calculateCharitableDonationsCredit(
        { donations: -100, taxableIncome: 50000 },
        'ON'
      );
      expect(result.federal).toBe(0);
      expect(result.provincial).toBe(0);
    });

    it('should calculate 15% on first $200', () => {
      const result = calculateCharitableDonationsCredit(
        { donations: 100, taxableIncome: 50000 },
        'ON'
      );
      expect(result.federal).toBeCloseTo(100 * 0.15, 2);
    });

    it('should calculate tiered rates for donations over $200', () => {
      // $500 donation: $200 at 15% + $300 at 29%
      const result = calculateCharitableDonationsCredit(
        { donations: 500, taxableIncome: 50000 },
        'ON'
      );
      expect(result.federal).toBeCloseTo(200 * 0.15 + 300 * 0.29, 2);
    });

    it('should use 33% rate for high-income earners', () => {
      // $1,000 donation, income over $246,752: $200 at 15% + $800 at 33%
      const result = calculateCharitableDonationsCredit(
        { donations: 1000, taxableIncome: 300000 },
        'ON'
      );
      expect(result.federal).toBeCloseTo(200 * 0.15 + 800 * 0.33, 2);
    });

    it('should calculate Ontario provincial credit correctly', () => {
      // $500 donation: $200 at 5.05% + $300 at 11.16%
      const result = calculateCharitableDonationsCredit(
        { donations: 500, taxableIncome: 50000 },
        'ON'
      );
      expect(result.provincial).toBeCloseTo(200 * 0.0505 + 300 * 0.1116, 2);
    });

    it('should calculate BC provincial credit correctly', () => {
      const result = calculateCharitableDonationsCredit(
        { donations: 500, taxableIncome: 50000 },
        'BC'
      );
      expect(result.provincial).toBeCloseTo(200 * 0.0506 + 300 * 0.165, 2);
    });

    it('should calculate Alberta provincial credit correctly', () => {
      const result = calculateCharitableDonationsCredit(
        { donations: 500, taxableIncome: 50000 },
        'AB'
      );
      expect(result.provincial).toBeCloseTo(200 * 0.1 + 300 * 0.21, 2);
    });
  });

  describe('calculateCaregiverCredit', () => {
    it('should return zero when no infirm dependant', () => {
      const result = calculateCaregiverCredit({
        infirmDependant: false,
        dependantType: 'parent',
      });
      expect(result.federal).toBe(0);
      expect(result.provincial).toBe(0);
    });

    it('should return base credit for parent dependant', () => {
      const result = calculateCaregiverCredit({
        infirmDependant: true,
        dependantType: 'parent',
        dependantNetIncome: 0,
      });
      // Base amount: $7,999 * 15% = $1,199.85
      expect(result.federal).toBeCloseTo(7999 * 0.15, 2);
    });

    it('should return enhanced credit for spouse', () => {
      const result = calculateCaregiverCredit({
        infirmDependant: true,
        dependantType: 'spouse',
        dependantNetIncome: 0,
      });
      // Enhanced: ($7,999 + $2,499) * 15% = $1,574.70
      expect(result.federal).toBeCloseTo((7999 + 2499) * 0.15, 2);
    });

    it('should return enhanced credit for child', () => {
      const result = calculateCaregiverCredit({
        infirmDependant: true,
        dependantType: 'child',
        dependantNetIncome: 0,
      });
      expect(result.federal).toBeCloseTo((7999 + 2499) * 0.15, 2);
    });

    it('should reduce credit by dependant income over threshold', () => {
      // Income $20,000, threshold $18,783
      // Reduction = $1,217
      // Net amount = $7,999 - $1,217 = $6,782
      const result = calculateCaregiverCredit({
        infirmDependant: true,
        dependantType: 'parent',
        dependantNetIncome: 20000,
      });
      const reduction = 20000 - 18783;
      expect(result.federal).toBeCloseTo((7999 - reduction) * 0.15, 2);
    });

    it('should return zero when dependant income eliminates credit', () => {
      const result = calculateCaregiverCredit({
        infirmDependant: true,
        dependantType: 'parent',
        dependantNetIncome: 30000,
      });
      expect(result.federal).toBe(0);
    });
  });

  describe('calculateHomeAccessibilityCredit', () => {
    it('should return zero for non-qualifying individual', () => {
      const result = calculateHomeAccessibilityCredit({
        eligibleExpenses: 10000,
        isQualifyingIndividual: false,
      });
      expect(result.federal).toBe(0);
    });

    it('should calculate credit for qualifying individual', () => {
      const result = calculateHomeAccessibilityCredit({
        eligibleExpenses: 10000,
        isQualifyingIndividual: true,
      });
      expect(result.federal).toBeCloseTo(10000 * 0.15, 2);
    });

    it('should cap expenses at $20,000', () => {
      const result = calculateHomeAccessibilityCredit({
        eligibleExpenses: 30000,
        isQualifyingIndividual: true,
      });
      // Max credit = $20,000 * 15% = $3,000
      expect(result.federal).toBe(3000);
    });

    it('should handle zero expenses', () => {
      const result = calculateHomeAccessibilityCredit({
        eligibleExpenses: 0,
        isQualifyingIndividual: true,
      });
      expect(result.federal).toBe(0);
    });
  });

  describe('calculateEmploymentCredit', () => {
    it('should return zero for no employment income', () => {
      const result = calculateEmploymentCredit(0);
      expect(result.federal).toBe(0);
    });

    it('should return zero for negative employment income', () => {
      const result = calculateEmploymentCredit(-1000);
      expect(result.federal).toBe(0);
    });

    it('should calculate credit for income under cap', () => {
      const result = calculateEmploymentCredit(1000);
      expect(result.federal).toBeCloseTo(1000 * 0.15, 2);
    });

    it('should cap credit at $1,433', () => {
      const result = calculateEmploymentCredit(50000);
      // Max credit = $1,433 * 15% = $214.95
      expect(result.federal).toBeCloseTo(1433 * 0.15, 2);
    });

    it('should return max credit for income at cap', () => {
      const result = calculateEmploymentCredit(1433);
      expect(result.federal).toBeCloseTo(1433 * 0.15, 2);
    });
  });

  describe('calculateClimateActionIncentive', () => {
    it('should return zero for ineligible provinces', () => {
      // BC and QC have their own carbon pricing
      const resultBC = calculateClimateActionIncentive({
        province: 'BC',
        numAdults: 2,
        numChildren: 2,
        isRural: false,
      });
      expect(resultBC).toBe(0);

      const resultQC = calculateClimateActionIncentive({
        province: 'QC',
        numAdults: 2,
        numChildren: 2,
        isRural: false,
      });
      expect(resultQC).toBe(0);
    });

    it('should calculate for single adult in Ontario', () => {
      const result = calculateClimateActionIncentive({
        province: 'ON',
        numAdults: 1,
        numChildren: 0,
        isRural: false,
      });
      expect(result).toBe(280);
    });

    it('should add 50% for spouse', () => {
      const result = calculateClimateActionIncentive({
        province: 'ON',
        numAdults: 2,
        numChildren: 0,
        isRural: false,
      });
      // $280 + $140 = $420
      expect(result).toBe(280 + 280 * 0.5);
    });

    it('should add 25% per child', () => {
      const result = calculateClimateActionIncentive({
        province: 'ON',
        numAdults: 1,
        numChildren: 2,
        isRural: false,
      });
      // $280 + 2 * $70 = $420
      expect(result).toBe(280 + 2 * 280 * 0.25);
    });

    it('should apply 20% rural supplement', () => {
      const result = calculateClimateActionIncentive({
        province: 'ON',
        numAdults: 1,
        numChildren: 0,
        isRural: true,
      });
      expect(result).toBeCloseTo(280 * 1.2, 2);
    });

    it('should calculate complete family with rural supplement', () => {
      const result = calculateClimateActionIncentive({
        province: 'ON',
        numAdults: 2,
        numChildren: 2,
        isRural: true,
      });
      // Base: $280 + $140 (spouse) + $140 (children) = $560
      // Rural: $560 * 1.2 = $672
      const base = 280 + 280 * 0.5 + 2 * 280 * 0.25;
      expect(result).toBeCloseTo(base * 1.2, 2);
    });

    it('should calculate correctly for Alberta', () => {
      const result = calculateClimateActionIncentive({
        province: 'AB',
        numAdults: 1,
        numChildren: 0,
        isRural: false,
      });
      expect(result).toBe(450);
    });

    it('should calculate correctly for Saskatchewan', () => {
      const result = calculateClimateActionIncentive({
        province: 'SK',
        numAdults: 1,
        numChildren: 0,
        isRural: false,
      });
      expect(result).toBe(376);
    });
  });

  describe('calculateComprehensiveTaxCredits', () => {
    it('should calculate basic credits for young worker', () => {
      const result = calculateComprehensiveTaxCredits({
        age: 35,
        netIncome: 60000,
        taxableIncome: 60000,
        employmentIncome: 60000,
        eligiblePensionIncome: 0,
        province: 'ON',
      });

      // Basic personal amount: $15,705 * 15% = $2,355.75
      expect(result.federal.basicPersonalAmount).toBeCloseTo(15705 * 0.15, 2);
      // No age credit (under 65)
      expect(result.federal.ageCredit).toBe(0);
      // Employment credit: $1,433 * 15% = $214.95
      expect(result.federal.employmentCredit).toBeCloseTo(1433 * 0.15, 2);
      expect(result.totalCredits).toBeGreaterThan(0);
    });

    it('should include age credit for 65+ with low income', () => {
      const result = calculateComprehensiveTaxCredits({
        age: 67,
        netIncome: 30000,
        taxableIncome: 30000,
        employmentIncome: 0,
        eligiblePensionIncome: 15000,
        province: 'ON',
      });

      // Age credit: $8,790 * 15% = $1,318.50 (no reduction, income below threshold)
      expect(result.federal.ageCredit).toBeCloseTo(8790 * 0.15, 2);
      // Pension credit: $2,000 * 15% = $300
      expect(result.federal.pensionIncomeCredit).toBe(300);
    });

    it('should reduce age credit for high income seniors', () => {
      const result = calculateComprehensiveTaxCredits({
        age: 70,
        netIncome: 80000,
        taxableIncome: 80000,
        employmentIncome: 0,
        eligiblePensionIncome: 20000,
        province: 'ON',
      });

      // Age credit reduction: ($80,000 - $44,325) * 15% = $5,351.25
      // Net age amount: $8,790 - $5,351.25 = $3,438.75
      const reduction = (80000 - 44325) * 0.15;
      const netAgeAmount = Math.max(0, 8790 - reduction);
      expect(result.federal.ageCredit).toBeCloseTo(netAgeAmount * 0.15, 2);
    });

    it('should include all applicable credits', () => {
      const result = calculateComprehensiveTaxCredits({
        age: 70,
        netIncome: 50000,
        taxableIncome: 50000,
        employmentIncome: 0,
        eligiblePensionIncome: 10000,
        province: 'ON',
        spouseNetIncome: 5000,
        hasDisability: true,
        medicalExpenses: 5000,
        charitableDonations: 1000,
        hasCaregiverDependant: true,
        homeAccessibilityExpenses: 10000,
      });

      expect(result.federal.basicPersonalAmount).toBeGreaterThan(0);
      expect(result.federal.ageCredit).toBeGreaterThan(0);
      expect(result.federal.pensionIncomeCredit).toBeGreaterThan(0);
      expect(result.federal.spouseCredit).toBeGreaterThan(0);
      expect(result.federal.disabilityCredit).toBeGreaterThan(0);
      expect(result.federal.medicalExpensesCredit).toBeGreaterThan(0);
      expect(result.federal.donationsCredit).toBeGreaterThan(0);
      expect(result.federal.caregiverCredit).toBeGreaterThan(0);
      expect(result.federal.homeAccessibilityCredit).toBeGreaterThan(0);

      expect(result.federal.total).toBe(
        result.federal.basicPersonalAmount +
          result.federal.ageCredit +
          result.federal.pensionIncomeCredit +
          result.federal.spouseCredit +
          result.federal.disabilityCredit +
          result.federal.medicalExpensesCredit +
          result.federal.donationsCredit +
          result.federal.caregiverCredit +
          result.federal.homeAccessibilityCredit +
          result.federal.employmentCredit
      );
    });

    it('should calculate provincial credits for different provinces', () => {
      const provinces: Array<'ON' | 'BC' | 'AB'> = ['ON', 'BC', 'AB'];

      for (const province of provinces) {
        const result = calculateComprehensiveTaxCredits({
          age: 40,
          netIncome: 60000,
          taxableIncome: 60000,
          employmentIncome: 60000,
          eligiblePensionIncome: 0,
          province,
        });

        expect(result.provincial.basicPersonalAmount).toBeGreaterThan(0);
        expect(result.provincial.total).toBeGreaterThan(0);
      }
    });

    it('should enable home accessibility for seniors', () => {
      const result = calculateComprehensiveTaxCredits({
        age: 65,
        netIncome: 40000,
        taxableIncome: 40000,
        employmentIncome: 0,
        eligiblePensionIncome: 20000,
        province: 'ON',
        homeAccessibilityExpenses: 10000,
      });

      // Should qualify due to age 65+
      expect(result.federal.homeAccessibilityCredit).toBeCloseTo(10000 * 0.15, 2);
    });

    it('should enable home accessibility for disabled individuals', () => {
      const result = calculateComprehensiveTaxCredits({
        age: 45,
        netIncome: 40000,
        taxableIncome: 40000,
        employmentIncome: 40000,
        eligiblePensionIncome: 0,
        province: 'ON',
        hasDisability: true,
        homeAccessibilityExpenses: 10000,
      });

      // Should qualify due to disability
      expect(result.federal.homeAccessibilityCredit).toBeCloseTo(10000 * 0.15, 2);
    });
  });

  describe('Real-world credit scenarios', () => {
    it('should calculate typical retiree credits in Ontario', () => {
      const result = calculateComprehensiveTaxCredits({
        age: 68,
        netIncome: 55000,
        taxableIncome: 55000,
        employmentIncome: 0,
        eligiblePensionIncome: 25000,
        province: 'ON',
        charitableDonations: 500,
      });

      // Should have basic, age, and pension credits
      expect(result.federal.basicPersonalAmount).toBeCloseTo(15705 * 0.15, 2);
      expect(result.federal.ageCredit).toBeGreaterThan(0); // Partially reduced
      expect(result.federal.pensionIncomeCredit).toBe(300); // Max
      expect(result.federal.donationsCredit).toBeGreaterThan(0);
      expect(result.totalCredits).toBeGreaterThan(3000);
    });

    it('should calculate credits for low-income senior couple', () => {
      const result = calculateComprehensiveTaxCredits({
        age: 72,
        netIncome: 25000,
        taxableIncome: 25000,
        employmentIncome: 0,
        eligiblePensionIncome: 10000,
        province: 'ON',
        spouseNetIncome: 8000,
      });

      // Full age credit (below threshold)
      expect(result.federal.ageCredit).toBeCloseTo(8790 * 0.15, 2);
      // Partial spouse credit ($15,705 - $8,000 = $7,705)
      expect(result.federal.spouseCredit).toBeCloseTo((15705 - 8000) * 0.15, 2);
    });

    it('should calculate credits for high-income donor', () => {
      const result = calculateComprehensiveTaxCredits({
        age: 55,
        netIncome: 300000,
        taxableIncome: 300000,
        employmentIncome: 300000,
        eligiblePensionIncome: 0,
        province: 'ON',
        charitableDonations: 10000,
      });

      // Donations: $200 at 15% + $9,800 at 33% (high income rate)
      expect(result.federal.donationsCredit).toBeCloseTo(200 * 0.15 + 9800 * 0.33, 2);
    });

    it('should calculate credits for senior with significant medical expenses', () => {
      const result = calculateComprehensiveTaxCredits({
        age: 75,
        netIncome: 40000,
        taxableIncome: 40000,
        employmentIncome: 0,
        eligiblePensionIncome: 20000,
        province: 'ON',
        medicalExpenses: 8000,
      });

      // Threshold = min(3% of $40,000, $2,759) = $1,200
      // Claimable = $8,000 - $1,200 = $6,800
      expect(result.federal.medicalExpensesCredit).toBeCloseTo(6800 * 0.15, 2);
    });
  });
});
