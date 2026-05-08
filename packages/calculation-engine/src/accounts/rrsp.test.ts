/**
 * RRSP Account Calculation Tests
 * @see docs/source-of-truth/02-account-types.md - RRSP Section
 */
import { describe, it, expect } from 'vitest';
import {
  getRRSPAnnualLimit,
  calculateRRSPContributionRoom,
  canContributeToRRSP,
  mustConvertRRSPToRRIF,
  getRRSPWithholdingTaxRate,
  calculateRRSPWithholdingTax,
  validateRRSPContribution,
  calculateRRSPTaxBenefit,
  processRRSPContribution,
} from './rrsp.js';
import { AGE_MILESTONES } from '@retireops/shared';

describe('RRSP Account Calculations', () => {
  describe('getRRSPAnnualLimit', () => {
    it('should return 2024 limit for year 2024', () => {
      expect(getRRSPAnnualLimit(2024)).toBe(31560);
    });

    it('should return 2025 limit for year 2025', () => {
      expect(getRRSPAnnualLimit(2025)).toBe(32490);
    });

    it('should default to 2025 limit for future years', () => {
      expect(getRRSPAnnualLimit(2030)).toBe(32490);
    });
  });

  describe('calculateRRSPContributionRoom', () => {
    it('should calculate 18% of earned income', () => {
      // $100,000 income * 18% = $18,000, no carry-forward
      const room = calculateRRSPContributionRoom(100000, 0, 2024);
      expect(room).toBe(18000);
    });

    it('should cap at annual maximum', () => {
      // $200,000 income * 18% = $36,000, but capped at $31,560
      const room = calculateRRSPContributionRoom(200000, 0, 2024);
      expect(room).toBe(31560);
    });

    it('should add carry-forward room', () => {
      // $100,000 income * 18% = $18,000 + $10,000 carry-forward
      const room = calculateRRSPContributionRoom(100000, 10000, 2024);
      expect(room).toBe(28000);
    });

    it('should handle zero income', () => {
      // No income, but $15,000 carry-forward
      const room = calculateRRSPContributionRoom(0, 15000, 2024);
      expect(room).toBe(15000);
    });

    it('should calculate room for low income', () => {
      // $50,000 income * 18% = $9,000
      const room = calculateRRSPContributionRoom(50000, 0, 2024);
      expect(room).toBe(9000);
    });

    it('should accumulate carry-forward over years', () => {
      // Simulating someone who never contributed
      // Year 1: $100k income = $18k room, $0 used = $18k carry-forward
      // Year 2: $100k income = $18k + $18k carry = $36k
      const room = calculateRRSPContributionRoom(100000, 18000, 2024);
      expect(room).toBe(36000);
    });
  });

  describe('canContributeToRRSP', () => {
    it('should return true for age 71 and under', () => {
      expect(canContributeToRRSP(30)).toBe(true);
      expect(canContributeToRRSP(65)).toBe(true);
      expect(canContributeToRRSP(71)).toBe(true);
    });

    it('should return false for age over 71', () => {
      expect(canContributeToRRSP(72)).toBe(false);
      expect(canContributeToRRSP(80)).toBe(false);
    });

    it('should use AGE_MILESTONES constant', () => {
      expect(canContributeToRRSP(AGE_MILESTONES.RRSP_CONTRIBUTION_DEADLINE_AGE)).toBe(true);
      expect(canContributeToRRSP(AGE_MILESTONES.RRSP_CONTRIBUTION_DEADLINE_AGE + 1)).toBe(false);
    });
  });

  describe('mustConvertRRSPToRRIF', () => {
    it('should return false for age under 71', () => {
      expect(mustConvertRRSPToRRIF(69)).toBe(false);
      expect(mustConvertRRSPToRRIF(70)).toBe(false);
    });

    it('should return true for age 71 and over', () => {
      // RRSP must be converted to RRIF by end of year turning 71
      expect(mustConvertRRSPToRRIF(71)).toBe(true);
      expect(mustConvertRRSPToRRIF(72)).toBe(true);
      expect(mustConvertRRSPToRRIF(80)).toBe(true);
    });
  });

  describe('getRRSPWithholdingTaxRate', () => {
    describe('Rest of Canada rates', () => {
      it('should return 10% for withdrawals up to $5,000', () => {
        expect(getRRSPWithholdingTaxRate(1000)).toBe(0.1);
        expect(getRRSPWithholdingTaxRate(5000)).toBe(0.1);
      });

      it('should return 20% for withdrawals $5,001 to $15,000', () => {
        expect(getRRSPWithholdingTaxRate(5001)).toBe(0.2);
        expect(getRRSPWithholdingTaxRate(10000)).toBe(0.2);
        expect(getRRSPWithholdingTaxRate(15000)).toBe(0.2);
      });

      it('should return 30% for withdrawals over $15,000', () => {
        expect(getRRSPWithholdingTaxRate(15001)).toBe(0.3);
        expect(getRRSPWithholdingTaxRate(50000)).toBe(0.3);
      });
    });

    describe('Quebec rates (lower federal component)', () => {
      it('should return 5% for withdrawals up to $5,000', () => {
        expect(getRRSPWithholdingTaxRate(1000, true)).toBe(0.05);
        expect(getRRSPWithholdingTaxRate(5000, true)).toBe(0.05);
      });

      it('should return 10% for withdrawals $5,001 to $15,000', () => {
        expect(getRRSPWithholdingTaxRate(5001, true)).toBe(0.1);
        expect(getRRSPWithholdingTaxRate(15000, true)).toBe(0.1);
      });

      it('should return 15% for withdrawals over $15,000', () => {
        expect(getRRSPWithholdingTaxRate(15001, true)).toBe(0.15);
        expect(getRRSPWithholdingTaxRate(50000, true)).toBe(0.15);
      });
    });
  });

  describe('calculateRRSPWithholdingTax', () => {
    it('should calculate withholding for small withdrawal', () => {
      // $5,000 * 10% = $500
      expect(calculateRRSPWithholdingTax(5000)).toBe(500);
    });

    it('should calculate withholding for medium withdrawal', () => {
      // $10,000 * 20% = $2,000
      expect(calculateRRSPWithholdingTax(10000)).toBe(2000);
    });

    it('should calculate withholding for large withdrawal', () => {
      // $50,000 * 30% = $15,000
      expect(calculateRRSPWithholdingTax(50000)).toBe(15000);
    });

    it('should calculate lower withholding for Quebec', () => {
      // $50,000 * 15% = $7,500 (Quebec)
      expect(calculateRRSPWithholdingTax(50000, true)).toBe(7500);
    });
  });

  describe('validateRRSPContribution', () => {
    it('should validate contribution within room', () => {
      const result = validateRRSPContribution(5000, 10000, 50);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject contribution exceeding room', () => {
      const result = validateRRSPContribution(15000, 10000, 50);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds');
    });

    it('should reject contribution after age 71', () => {
      const result = validateRRSPContribution(5000, 10000, 72);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('71');
    });

    it('should allow contribution at exactly age 71', () => {
      const result = validateRRSPContribution(5000, 10000, 71);
      expect(result.valid).toBe(true);
    });

    it('should reject contribution at age 72', () => {
      const result = validateRRSPContribution(5000, 100000, 72);
      expect(result.valid).toBe(false);
    });
  });

  describe('calculateRRSPTaxBenefit', () => {
    it('should calculate tax savings at marginal rate', () => {
      // $10,000 contribution * 30% marginal rate = $3,000 savings
      expect(calculateRRSPTaxBenefit(10000, 0.3)).toBe(3000);
    });

    it('should calculate tax savings for different rates', () => {
      // $20,000 contribution * 45% marginal rate = $9,000 savings
      expect(calculateRRSPTaxBenefit(20000, 0.45)).toBe(9000);
    });

    it('should return 0 for zero contribution', () => {
      expect(calculateRRSPTaxBenefit(0, 0.3)).toBe(0);
    });

    it('should handle zero tax rate', () => {
      expect(calculateRRSPTaxBenefit(10000, 0)).toBe(0);
    });
  });

  describe('processRRSPContribution', () => {
    it('should update balance and room correctly', () => {
      const result = processRRSPContribution(100000, 10000, 20000, 0.3);
      expect(result.newBalance).toBe(110000);
      expect(result.newContributionRoom).toBe(10000);
      expect(result.taxBenefit).toBe(3000);
    });

    it('should handle contribution from zero balance', () => {
      const result = processRRSPContribution(0, 5000, 10000, 0.25);
      expect(result.newBalance).toBe(5000);
      expect(result.newContributionRoom).toBe(5000);
      expect(result.taxBenefit).toBe(1250);
    });

    it('should calculate tax benefit based on marginal rate', () => {
      const result = processRRSPContribution(50000, 31560, 31560, 0.45);
      expect(result.taxBenefit).toBeCloseTo(31560 * 0.45, 2);
    });
  });

  describe('Real-world RRSP scenarios', () => {
    it('should calculate room for typical income earner', () => {
      // Person earning $80,000, no carry-forward
      const room = calculateRRSPContributionRoom(80000, 0, 2024);
      expect(room).toBe(14400); // $80,000 * 18%
    });

    it('should calculate room for high earner', () => {
      // Person earning $300,000 (capped at max)
      const room = calculateRRSPContributionRoom(300000, 0, 2024);
      expect(room).toBe(31560); // Capped
    });

    it('should calculate accumulated room over career', () => {
      // Someone with 5 years of unused room ($20k/year) + current year
      const room = calculateRRSPContributionRoom(100000, 100000, 2024);
      expect(room).toBe(118000); // $18,000 + $100,000
    });

    it('should show tax benefit of max contribution', () => {
      // Max contribution at 45% marginal rate
      const benefit = calculateRRSPTaxBenefit(31560, 0.45);
      expect(benefit).toBeCloseTo(14202, 0); // Significant tax savings
    });

    it('should calculate withholding impact of early withdrawal', () => {
      // $30,000 early withdrawal (worst case)
      const withheld = calculateRRSPWithholdingTax(30000);
      expect(withheld).toBe(9000); // 30%
    });
  });
});
