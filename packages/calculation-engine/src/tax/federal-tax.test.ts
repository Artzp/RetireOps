/**
 * Federal Tax Calculation Tests
 * @see docs/source-of-truth/04-tax-engine.md
 */
import { describe, it, expect } from 'vitest';
import {
  calculateBracketTax,
  getFederalTaxBrackets,
  getFederalBasicPersonalAmount,
  calculateFederalTaxBeforeCredits,
  calculateBasicPersonalAmountCredit,
  calculateFederalAgeCredit,
  calculateFederalPensionIncomeCredit,
  calculateFederalNonRefundableCredits,
  calculateFederalTax,
  getFederalMarginalRate,
} from './federal-tax.js';
import { FEDERAL_TAX_2024, FEDERAL_TAX_2025, FEDERAL_TAX_2026 } from '@retireops/shared';

describe('Federal Tax Calculations', () => {
  describe('calculateBracketTax', () => {
    it('should return 0 for zero income', () => {
      const brackets = FEDERAL_TAX_2024.brackets;
      expect(calculateBracketTax(0, brackets)).toBe(0);
    });

    it('should return 0 for negative income', () => {
      const brackets = FEDERAL_TAX_2024.brackets;
      expect(calculateBracketTax(-1000, brackets)).toBe(0);
    });

    it('should calculate tax correctly for income in first bracket only', () => {
      const brackets = FEDERAL_TAX_2024.brackets;
      // $50,000 income, all in 15% bracket
      const tax = calculateBracketTax(50000, brackets);
      expect(tax).toBeCloseTo(50000 * 0.15, 2);
    });

    it('should calculate tax correctly for income spanning two brackets', () => {
      const brackets = FEDERAL_TAX_2024.brackets;
      // $80,000 income: $55,867 at 15% + $24,133 at 20.5%
      const tax = calculateBracketTax(80000, brackets);
      const expected = 55867 * 0.15 + (80000 - 55867) * 0.205;
      expect(tax).toBeCloseTo(expected, 2);
    });

    it('should calculate tax correctly for high income spanning all brackets', () => {
      const brackets = FEDERAL_TAX_2024.brackets;
      // $300,000 income
      const tax = calculateBracketTax(300000, brackets);
      const expected =
        55867 * 0.15 + // First bracket
        (111733 - 55867) * 0.205 + // Second bracket
        (173205 - 111733) * 0.26 + // Third bracket
        (246752 - 173205) * 0.29 + // Fourth bracket
        (300000 - 246752) * 0.33; // Fifth bracket
      expect(tax).toBeCloseTo(expected, 2);
    });
  });

  describe('getFederalTaxBrackets', () => {
    it('should return 2024 brackets for year 2024', () => {
      const brackets = getFederalTaxBrackets(2024);
      expect(brackets).toEqual(FEDERAL_TAX_2024.brackets);
    });

    it('should return 2025 brackets for year 2025', () => {
      const brackets = getFederalTaxBrackets(2025);
      expect(brackets).toEqual(FEDERAL_TAX_2025.brackets);
    });

    it('should return 2026 brackets for year 2026', () => {
      const brackets = getFederalTaxBrackets(2026);
      expect(brackets).toEqual(FEDERAL_TAX_2026.brackets);
    });

    it('should return 2026 brackets for future years', () => {
      const brackets = getFederalTaxBrackets(2030);
      expect(brackets).toEqual(FEDERAL_TAX_2026.brackets);
    });

    it('should return 5 brackets', () => {
      const brackets = getFederalTaxBrackets(2024);
      expect(brackets.length).toBe(5);
    });
  });

  describe('getFederalBasicPersonalAmount', () => {
    it('should return $15,705 for 2024', () => {
      expect(getFederalBasicPersonalAmount(2024)).toBe(15705);
    });

    it('should return projected amount for 2025', () => {
      expect(getFederalBasicPersonalAmount(2025)).toBe(16129);
    });
  });

  describe('calculateFederalTaxBeforeCredits', () => {
    it('should match bracket tax calculation', () => {
      const income = 75000;
      const taxBefore = calculateFederalTaxBeforeCredits(income, 2024);
      const brackets = getFederalTaxBrackets(2024);
      const expected = calculateBracketTax(income, brackets);
      expect(taxBefore).toBe(expected);
    });

    it('should apply the blended 14.5% first-bracket rate for 2025', () => {
      const income = 50000;
      expect(calculateFederalTaxBeforeCredits(income, 2025)).toBeCloseTo(income * 0.145, 2);
    });

    it('should apply the 14.0% first-bracket rate for 2026', () => {
      const income = 50000;
      expect(calculateFederalTaxBeforeCredits(income, 2026)).toBeCloseTo(income * 0.14, 2);
    });
  });

  describe('calculateBasicPersonalAmountCredit', () => {
    it('should calculate BPA credit at 15% of BPA', () => {
      const credit = calculateBasicPersonalAmountCredit(2024);
      expect(credit).toBeCloseTo(15705 * 0.15, 2);
    });

    it('should use the 14.5% blended rate for the 2025 BPA credit', () => {
      const credit = calculateBasicPersonalAmountCredit(2025);
      expect(credit).toBeCloseTo(16129 * 0.145, 2);
    });
  });

  describe('calculateFederalAgeCredit', () => {
    it('should return 0 for age under 65', () => {
      expect(calculateFederalAgeCredit(64, 50000, 2024)).toBe(0);
      expect(calculateFederalAgeCredit(30, 50000, 2024)).toBe(0);
    });

    it('should return full credit for low income at age 65+', () => {
      // Income below threshold ($44,325)
      const credit = calculateFederalAgeCredit(65, 30000, 2024);
      // Full age amount ($8,790) * credit rate (15%)
      expect(credit).toBeCloseTo(8790 * 0.15, 2);
    });

    it('should reduce credit for income above threshold', () => {
      // Income $50,000, threshold $44,325
      // Reduction = ($50,000 - $44,325) * 0.15 = $851.25
      // Net age amount = $8,790 - $851.25 = $7,938.75
      // Credit = $7,938.75 * 0.15 = $1,190.81
      const credit = calculateFederalAgeCredit(65, 50000, 2024);
      const reduction = (50000 - 44325) * 0.15;
      const netAgeAmount = 8790 - reduction;
      expect(credit).toBeCloseTo(netAgeAmount * 0.15, 2);
    });

    it('should return 0 when income is high enough to eliminate credit', () => {
      // When income eliminates the age amount entirely
      // $8,790 / 0.15 = $58,600 above threshold = $102,925 total income
      const credit = calculateFederalAgeCredit(65, 110000, 2024);
      expect(credit).toBe(0);
    });
  });

  describe('calculateFederalPensionIncomeCredit', () => {
    it('should return 0 for no pension income', () => {
      expect(calculateFederalPensionIncomeCredit(0, 2024)).toBe(0);
    });

    it('should calculate credit for pension income under max', () => {
      // $1,500 pension income * 15% = $225
      const credit = calculateFederalPensionIncomeCredit(1500, 2024);
      expect(credit).toBeCloseTo(1500 * 0.15, 2);
    });

    it('should cap credit at max amount', () => {
      // Max pension amount is $2,000, credit rate 15%, max credit $300
      const credit = calculateFederalPensionIncomeCredit(5000, 2024);
      expect(credit).toBe(300);
    });

    it('should return max credit for exactly $2,000 pension income', () => {
      const credit = calculateFederalPensionIncomeCredit(2000, 2024);
      expect(credit).toBe(300);
    });
  });

  describe('calculateFederalNonRefundableCredits', () => {
    it('should include only BPA for young person with no pension', () => {
      const credits = calculateFederalNonRefundableCredits(40, 60000, 0, 2024);
      const expectedBPA = 15705 * 0.15;
      expect(credits).toBeCloseTo(expectedBPA, 2);
    });

    it('should include BPA and age credit for person 65+', () => {
      const credits = calculateFederalNonRefundableCredits(65, 30000, 0, 2024);
      const expectedBPA = 15705 * 0.15;
      const expectedAge = 8790 * 0.15;
      expect(credits).toBeCloseTo(expectedBPA + expectedAge, 2);
    });

    it('should include all credits for 65+ with pension income', () => {
      const credits = calculateFederalNonRefundableCredits(70, 40000, 2000, 2024);
      const expectedBPA = 15705 * 0.15;
      const expectedAge = 8790 * 0.15; // Low income, full credit
      const expectedPension = 300; // Max pension credit
      expect(credits).toBeCloseTo(expectedBPA + expectedAge + expectedPension, 2);
    });
  });

  describe('calculateFederalTax', () => {
    it('should return 0 for income below BPA', () => {
      const tax = calculateFederalTax(10000, 40, 10000, 0, 2024);
      expect(tax).toBe(0);
    });

    it('should calculate net tax after credits', () => {
      // $60,000 income, age 40, no pension
      const tax = calculateFederalTax(60000, 40, 60000, 0, 2024);
      const taxBefore = calculateFederalTaxBeforeCredits(60000, 2024);
      const credits = calculateFederalNonRefundableCredits(40, 60000, 0, 2024);
      expect(tax).toBeCloseTo(Math.max(0, taxBefore - credits), 2);
    });

    it('should apply Quebec abatement for Quebec residents', () => {
      const taxNonQC = calculateFederalTax(100000, 50, 100000, 0, 2024, false);
      const taxQC = calculateFederalTax(100000, 50, 100000, 0, 2024, true);
      // Quebec gets 16.5% abatement
      expect(taxQC).toBeCloseTo(taxNonQC * (1 - 0.165), 2);
    });

    it('should never return negative tax', () => {
      // Very low income - credits exceed tax
      const tax = calculateFederalTax(5000, 70, 5000, 2000, 2024);
      expect(tax).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getFederalMarginalRate', () => {
    it('should return 15% for income in first bracket', () => {
      expect(getFederalMarginalRate(30000, 2024)).toBe(0.15);
      expect(getFederalMarginalRate(55000, 2024)).toBe(0.15);
    });

    it('should return 20.5% for income in second bracket', () => {
      expect(getFederalMarginalRate(60000, 2024)).toBe(0.205);
      expect(getFederalMarginalRate(100000, 2024)).toBe(0.205);
    });

    it('should return 26% for income in third bracket', () => {
      expect(getFederalMarginalRate(120000, 2024)).toBe(0.26);
      expect(getFederalMarginalRate(170000, 2024)).toBe(0.26);
    });

    it('should return 29% for income in fourth bracket', () => {
      expect(getFederalMarginalRate(200000, 2024)).toBe(0.29);
      expect(getFederalMarginalRate(240000, 2024)).toBe(0.29);
    });

    it('should return 33% for income in top bracket', () => {
      expect(getFederalMarginalRate(250000, 2024)).toBe(0.33);
      expect(getFederalMarginalRate(500000, 2024)).toBe(0.33);
    });
  });

  describe('Real-world tax scenarios (2024)', () => {
    it('should calculate reasonable tax for $50,000 income single person', () => {
      const tax = calculateFederalTax(50000, 40, 50000, 0, 2024);
      // Approximate expected federal tax around $5,100 - $5,300
      expect(tax).toBeGreaterThan(4500);
      expect(tax).toBeLessThan(6000);
    });

    it('should calculate reasonable tax for $100,000 income single person', () => {
      const tax = calculateFederalTax(100000, 45, 100000, 0, 2024);
      // Approximate expected federal tax around $14,000 - $16,000
      expect(tax).toBeGreaterThan(13000);
      expect(tax).toBeLessThan(17000);
    });

    it('should calculate lower tax for retiree with pension credit', () => {
      // Retiree age 68 with $60,000 income including $20,000 pension
      const taxWithPension = calculateFederalTax(60000, 68, 60000, 20000, 2024);
      const taxWithoutPension = calculateFederalTax(60000, 40, 60000, 0, 2024);
      expect(taxWithPension).toBeLessThan(taxWithoutPension);
    });
  });
});
