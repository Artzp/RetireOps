/**
 * TFSA Account Calculation Tests
 * @see docs/source-of-truth/02-account-types.md - TFSA Section
 */
import { describe, it, expect } from 'vitest';
import {
  getTFSAAnnualLimit,
  getTFSACumulativeLimit,
  calculateTFSAContributionRoom,
  isValidTFSAContribution,
  isEligibleForTFSA,
  calculateTFSAWithdrawalTax,
  tfsaAffectsOASClawback,
  processTFSAContribution,
  processTFSAWithdrawal,
  projectTFSABalance,
} from './tfsa.js';
import { TFSA_CUMULATIVE_LIMITS } from '@retireops/shared';

describe('TFSA Account Calculations', () => {
  describe('getTFSAAnnualLimit', () => {
    it('should return correct limits for historical years', () => {
      expect(getTFSAAnnualLimit(2009)).toBe(5000);
      expect(getTFSAAnnualLimit(2015)).toBe(10000); // Special year
      expect(getTFSAAnnualLimit(2019)).toBe(6000);
      expect(getTFSAAnnualLimit(2023)).toBe(6500);
    });

    it('should return current year limits', () => {
      expect(getTFSAAnnualLimit(2024)).toBe(7000);
      expect(getTFSAAnnualLimit(2025)).toBe(7000);
    });

    it('should default to $7,000 for future years', () => {
      expect(getTFSAAnnualLimit(2030)).toBe(7000);
    });
  });

  describe('getTFSACumulativeLimit', () => {
    it('should return $95,000 for 2024', () => {
      expect(getTFSACumulativeLimit(2024)).toBe(95000);
    });

    it('should return $102,000 for 2025', () => {
      expect(getTFSACumulativeLimit(2025)).toBe(102000);
    });

    it('should calculate historical cumulative limits', () => {
      // 2009-2012: 4 * $5,000 = $20,000
      // 2013-2014: 2 * $5,500 = $11,000
      // Total 2014: $31,000
      const limit2014 = getTFSACumulativeLimit(2014);
      expect(limit2014).toBe(31000);
    });

    it('should calculate cumulative for 2020', () => {
      // Sum from 2009-2020
      const limit2020 = getTFSACumulativeLimit(2020);
      expect(limit2020).toBe(69500);
    });

    it('should use stored value for recent years', () => {
      expect(getTFSACumulativeLimit(2025)).toBe(TFSA_CUMULATIVE_LIMITS[2025]);
    });
  });

  describe('calculateTFSAContributionRoom', () => {
    it('should add annual limit to previous room', () => {
      // Previous room $10,000 + 2024 limit $7,000 = $17,000
      const room = calculateTFSAContributionRoom(10000, 0, 2024);
      expect(room).toBe(17000);
    });

    it('should restore room from previous year withdrawals', () => {
      // Previous room $10,000 + annual $7,000 + withdrew $5,000 = $22,000
      const room = calculateTFSAContributionRoom(10000, 5000, 2024);
      expect(room).toBe(22000);
    });

    it('should handle zero previous room', () => {
      const room = calculateTFSAContributionRoom(0, 0, 2024);
      expect(room).toBe(7000);
    });

    it('should accumulate large unused room', () => {
      // Someone who never contributed since 2009 would have ~$95k
      const room = calculateTFSAContributionRoom(88000, 0, 2024);
      expect(room).toBe(95000);
    });
  });

  describe('isValidTFSAContribution', () => {
    it('should return true when contribution within room', () => {
      expect(isValidTFSAContribution(5000, 10000)).toBe(true);
    });

    it('should return true when contribution equals room', () => {
      expect(isValidTFSAContribution(10000, 10000)).toBe(true);
    });

    it('should return false when contribution exceeds room', () => {
      expect(isValidTFSAContribution(15000, 10000)).toBe(false);
    });
  });

  describe('isEligibleForTFSA', () => {
    it('should return true for age 18+', () => {
      expect(isEligibleForTFSA(18)).toBe(true);
      expect(isEligibleForTFSA(30)).toBe(true);
      expect(isEligibleForTFSA(80)).toBe(true);
    });

    it('should return false for age under 18', () => {
      expect(isEligibleForTFSA(17)).toBe(false);
      expect(isEligibleForTFSA(0)).toBe(false);
    });
  });

  describe('calculateTFSAWithdrawalTax', () => {
    it('should always return 0', () => {
      expect(calculateTFSAWithdrawalTax()).toBe(0);
    });
  });

  describe('tfsaAffectsOASClawback', () => {
    it('should always return false', () => {
      expect(tfsaAffectsOASClawback()).toBe(false);
    });
  });

  describe('processTFSAContribution', () => {
    it('should update balance and room for valid contribution', () => {
      const result = processTFSAContribution(50000, 5000, 10000, 30);
      expect(result.valid).toBe(true);
      expect(result.newBalance).toBe(55000);
      expect(result.newContributionRoom).toBe(5000);
    });

    it('should reject contribution for underage person', () => {
      const result = processTFSAContribution(0, 5000, 10000, 17);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('18');
      expect(result.newBalance).toBe(0);
    });

    it('should reject over-contribution', () => {
      const result = processTFSAContribution(50000, 15000, 10000, 30);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds');
      expect(result.newBalance).toBe(50000);
    });

    it('should allow contribution at exactly 18', () => {
      const result = processTFSAContribution(0, 5000, 7000, 18);
      expect(result.valid).toBe(true);
    });
  });

  describe('processTFSAWithdrawal', () => {
    it('should process withdrawal correctly', () => {
      const result = processTFSAWithdrawal(50000, 10000);
      expect(result.withdrawalAmount).toBe(10000);
      expect(result.newBalance).toBe(40000);
      expect(result.roomRestoredNextYear).toBe(10000);
      expect(result.taxableAmount).toBe(0);
    });

    it('should cap withdrawal at balance', () => {
      const result = processTFSAWithdrawal(5000, 10000);
      expect(result.withdrawalAmount).toBe(5000);
      expect(result.newBalance).toBe(0);
      expect(result.roomRestoredNextYear).toBe(5000);
    });

    it('should restore room equal to withdrawal', () => {
      const result = processTFSAWithdrawal(100000, 25000);
      expect(result.roomRestoredNextYear).toBe(25000);
    });

    it('should always report zero tax', () => {
      const result = processTFSAWithdrawal(100000, 50000);
      expect(result.taxableAmount).toBe(0);
    });
  });

  describe('projectTFSABalance', () => {
    it('should project balance over time', () => {
      const projection = projectTFSABalance(50000, 7000, 0.05, 10);
      expect(projection.length).toBe(10);
      expect(projection[0].year).toBe(1);
      expect(projection[9].year).toBe(10);
    });

    it('should show growth with contributions', () => {
      const projection = projectTFSABalance(50000, 7000, 0.05, 5);
      // Each year: (balance + contribution) * 1.05
      expect(projection[0].balance).toBeCloseTo((50000 + 7000) * 1.05, 0);
    });

    it('should compound growth over years', () => {
      const projection = projectTFSABalance(50000, 7000, 0.05, 20);
      // After 20 years with 5% return and $7k contributions
      const finalBalance = projection[19].balance;
      expect(finalBalance).toBeGreaterThan(300000);
    });

    it('should handle zero growth rate', () => {
      const projection = projectTFSABalance(50000, 7000, 0, 5);
      // No growth, just accumulation
      expect(projection[4].balance).toBe(50000 + 5 * 7000);
    });

    it('should handle zero contribution', () => {
      const projection = projectTFSABalance(50000, 0, 0.05, 5);
      const expectedFinal = 50000 * Math.pow(1.05, 5);
      expect(projection[4].balance).toBeCloseTo(expectedFinal, 0);
    });
  });

  describe('Real-world TFSA scenarios', () => {
    it('should calculate room for someone who turned 18 in 2020', () => {
      // 2020, 2021, 2022, 2023, 2024 = 5 years
      // $6000 + $6000 + $6000 + $6500 + $7000 = $31,500
      // Assuming they had no previous room
      const _startRoom = 0; // Intentionally unused - documents starting condition
      const limit2024 = getTFSACumulativeLimit(2024) - getTFSACumulativeLimit(2019);
      expect(limit2024).toBe(31500);
    });

    it('should show value of maxing TFSA for 10 years', () => {
      // Start at 0, contribute $7,000/year for 10 years, 6% return
      const projection = projectTFSABalance(0, 7000, 0.06, 10);
      const finalBalance = projection[9].balance;
      // Should have over $95,000 after 10 years
      expect(finalBalance).toBeGreaterThan(95000);
    });

    it('should demonstrate withdrawal flexibility', () => {
      // Have $80,000, withdraw $20,000 for emergency
      const withdrawal = processTFSAWithdrawal(80000, 20000);
      expect(withdrawal.newBalance).toBe(60000);
      expect(withdrawal.taxableAmount).toBe(0); // No tax impact
      expect(withdrawal.roomRestoredNextYear).toBe(20000); // Can put it back
    });

    it('should show OAS clawback protection', () => {
      // TFSA withdrawal does not affect OAS clawback calculation
      expect(tfsaAffectsOASClawback()).toBe(false);
      // This is why TFSA is valuable in retirement
    });

    it('should calculate lifetime accumulation potential', () => {
      // Maxed TFSA from age 18 to 65, 6% average return
      const projection = projectTFSABalance(0, 7000, 0.06, 47);
      const finalBalance = projection[46].balance;
      // Should accumulate substantial tax-free wealth
      expect(finalBalance).toBeGreaterThan(1000000);
    });

    it('should handle re-contribution after withdrawal', () => {
      // Start with $50k, $10k room
      // Withdraw $15k, room next year = $10k + $7k + $15k = $32k
      const withdrawResult = processTFSAWithdrawal(50000, 15000);
      const nextYearRoom = calculateTFSAContributionRoom(
        10000 - 0, // unused from current year (assuming $0 contributed)
        withdrawResult.roomRestoredNextYear,
        2025
      );
      // Room should be significant
      expect(nextYearRoom).toBe(10000 + 7000 + 15000);
    });
  });
});
