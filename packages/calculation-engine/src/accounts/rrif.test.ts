/**
 * RRIF Account Calculation Tests
 * @see docs/source-of-truth/02-account-types.md - RRIF Section
 */
import { describe, it, expect } from 'vitest';
import {
  calculateRRIFMinimumWithdrawal,
  calculateRRIFMinimumWithYoungerSpouse,
  isRRIFMinimumRequired,
  getRRIFMinimumRateForAge,
  convertRRSPToRRIF,
  processRRIFWithdrawal,
  projectRRIFBalance,
} from './rrif.js';
// Note: getRRIFMinimumRate and RRIF_MINIMUM_RATES available from @retireops/shared if needed

describe('RRIF Account Calculations', () => {
  describe('calculateRRIFMinimumWithdrawal', () => {
    it('should return 0 for age under 65', () => {
      expect(calculateRRIFMinimumWithdrawal(100000, 60)).toBe(0);
      expect(calculateRRIFMinimumWithdrawal(100000, 64)).toBe(0);
    });

    it('should calculate minimum at age 72', () => {
      // Age 72 rate: 5.40%
      const minimum = calculateRRIFMinimumWithdrawal(100000, 72);
      expect(minimum).toBeCloseTo(5400, 0);
    });

    it('should calculate minimum at age 80', () => {
      // Age 80 rate: 6.82%
      const minimum = calculateRRIFMinimumWithdrawal(100000, 80);
      expect(minimum).toBeCloseTo(6820, 0);
    });

    it('should calculate minimum at age 90', () => {
      // Age 90 rate: 11.92%
      const minimum = calculateRRIFMinimumWithdrawal(100000, 90);
      expect(minimum).toBeCloseTo(11920, 0);
    });

    it('should use 20% for age 95+', () => {
      const min95 = calculateRRIFMinimumWithdrawal(100000, 95);
      const min100 = calculateRRIFMinimumWithdrawal(100000, 100);
      expect(min95).toBe(20000);
      expect(min100).toBe(20000);
    });

    it('should scale with balance', () => {
      const small = calculateRRIFMinimumWithdrawal(100000, 75);
      const large = calculateRRIFMinimumWithdrawal(500000, 75);
      expect(large).toBe(small * 5);
    });

    it('should return 0 for zero balance', () => {
      expect(calculateRRIFMinimumWithdrawal(0, 80)).toBe(0);
    });
  });

  describe('calculateRRIFMinimumWithYoungerSpouse', () => {
    it('should use spouse age when younger', () => {
      // Owner 80, spouse 70
      const withYounger = calculateRRIFMinimumWithYoungerSpouse(100000, 80, 70);
      const ownerRate = calculateRRIFMinimumWithdrawal(100000, 80);
      const spouseRate = calculateRRIFMinimumWithdrawal(100000, 70);
      expect(withYounger).toBe(spouseRate);
      expect(withYounger).toBeLessThan(ownerRate);
    });

    it('should use owner age when younger', () => {
      // Owner 70, spouse 75
      const withYounger = calculateRRIFMinimumWithYoungerSpouse(100000, 70, 75);
      const ownerRate = calculateRRIFMinimumWithdrawal(100000, 70);
      expect(withYounger).toBe(ownerRate);
    });

    it('should use same age when equal', () => {
      const result = calculateRRIFMinimumWithYoungerSpouse(100000, 75, 75);
      const expected = calculateRRIFMinimumWithdrawal(100000, 75);
      expect(result).toBe(expected);
    });

    it('should reduce minimum withdrawal significantly', () => {
      // 80-year-old with 65-year-old spouse
      const withOwner = calculateRRIFMinimumWithdrawal(500000, 80);
      const withSpouse = calculateRRIFMinimumWithYoungerSpouse(500000, 80, 65);
      // Should save over $10,000 in forced withdrawals
      expect(withOwner - withSpouse).toBeGreaterThan(10000);
    });
  });

  describe('isRRIFMinimumRequired', () => {
    it('should return false for age under 72', () => {
      expect(isRRIFMinimumRequired(71)).toBe(false);
      expect(isRRIFMinimumRequired(65)).toBe(false);
    });

    it('should return true for age 72 and over', () => {
      expect(isRRIFMinimumRequired(72)).toBe(true);
      expect(isRRIFMinimumRequired(80)).toBe(true);
      expect(isRRIFMinimumRequired(95)).toBe(true);
    });
  });

  describe('getRRIFMinimumRateForAge', () => {
    it('should return rate as percentage', () => {
      const rate72 = getRRIFMinimumRateForAge(72);
      expect(rate72).toBeCloseTo(5.4, 1); // 5.40%
    });

    it('should return 20% for age 95+', () => {
      expect(getRRIFMinimumRateForAge(95)).toBe(20);
      expect(getRRIFMinimumRateForAge(100)).toBe(20);
    });

    it('should increase with age', () => {
      const rate72 = getRRIFMinimumRateForAge(72);
      const rate80 = getRRIFMinimumRateForAge(80);
      const rate90 = getRRIFMinimumRateForAge(90);
      expect(rate80).toBeGreaterThan(rate72);
      expect(rate90).toBeGreaterThan(rate80);
    });
  });

  describe('convertRRSPToRRIF', () => {
    it('should transfer full balance', () => {
      const result = convertRRSPToRRIF(500000, 2024);
      expect(result.rrifBalance).toBe(500000);
    });

    it('should set conversion year', () => {
      const result = convertRRSPToRRIF(500000, 2024);
      expect(result.conversionYear).toBe(2024);
    });

    it('should set first withdrawal year to next year', () => {
      const result = convertRRSPToRRIF(500000, 2024);
      expect(result.firstWithdrawalYear).toBe(2025);
    });

    it('should handle zero balance', () => {
      const result = convertRRSPToRRIF(0, 2024);
      expect(result.rrifBalance).toBe(0);
    });
  });

  describe('processRRIFWithdrawal', () => {
    it('should enforce minimum withdrawal', () => {
      // Request $0 but minimum is required at age 75
      const result = processRRIFWithdrawal(100000, 75, 0);
      expect(result.actualWithdrawal).toBe(result.minimumRequired);
      expect(result.actualWithdrawal).toBeGreaterThan(0);
    });

    it('should allow withdrawal above minimum', () => {
      const result = processRRIFWithdrawal(100000, 75, 20000);
      expect(result.actualWithdrawal).toBe(20000);
      expect(result.actualWithdrawal).toBeGreaterThan(result.minimumRequired);
    });

    it('should not exceed balance', () => {
      const result = processRRIFWithdrawal(10000, 75, 50000);
      expect(result.actualWithdrawal).toBe(10000);
      expect(result.newBalance).toBe(0);
    });

    it('should update balance correctly', () => {
      const result = processRRIFWithdrawal(100000, 75, 10000);
      expect(result.newBalance).toBe(100000 - result.actualWithdrawal);
    });

    it('should record full amount as taxable', () => {
      const result = processRRIFWithdrawal(100000, 75, 10000);
      expect(result.taxableAmount).toBe(result.actualWithdrawal);
    });

    it('should use younger spouse age when specified', () => {
      const withoutSpouse = processRRIFWithdrawal(100000, 80, 0);
      const withSpouse = processRRIFWithdrawal(100000, 80, 0, true, 70);
      expect(withSpouse.minimumRequired).toBeLessThan(withoutSpouse.minimumRequired);
    });

    it('should calculate minimum even for age under 72', () => {
      // RRIF rate table has values for ages 65+, even though mandatory min starts at 72
      // At age 70, rate is 5% = $5,000 on $100,000
      const result = processRRIFWithdrawal(100000, 70, 5000);
      expect(result.minimumRequired).toBeCloseTo(5000, 0);
      expect(result.actualWithdrawal).toBe(5000);
    });
  });

  describe('projectRRIFBalance', () => {
    it('should project balance over time', () => {
      const projection = projectRRIFBalance(500000, 72, 85, 0.04);
      expect(projection.length).toBeGreaterThan(0);
      expect(projection[0].age).toBe(72);
      expect(projection[projection.length - 1].age).toBeLessThanOrEqual(85);
    });

    it('should show declining balance', () => {
      const projection = projectRRIFBalance(500000, 72, 90, 0.04);
      // With minimum withdrawals increasing, balance should decline
      const firstBalance = projection[0].balance;
      const lastBalance = projection[projection.length - 1].balance;
      expect(lastBalance).toBeLessThan(firstBalance);
    });

    it('should show increasing withdrawal rates', () => {
      const projection = projectRRIFBalance(500000, 72, 85, 0);
      // Without growth, withdrawals should represent increasing percentages
      for (let i = 1; i < projection.length && projection[i].balance > 0; i++) {
        const prevRate =
          projection[i - 1].withdrawal / (projection[i - 1].balance + projection[i - 1].withdrawal);
        const currRate =
          projection[i].withdrawal / (projection[i].balance + projection[i].withdrawal);
        // Rate should generally increase (or stay same if depleted)
        expect(currRate).toBeGreaterThanOrEqual(prevRate * 0.99); // Allow small variance
      }
    });

    it('should stop when balance depleted', () => {
      // High additional withdrawal to deplete faster
      const projection = projectRRIFBalance(100000, 72, 100, 0, 20000);
      const lastEntry = projection[projection.length - 1];
      expect(lastEntry.balance).toBeLessThanOrEqual(0.01);
    });

    it('should apply investment growth', () => {
      // Compare with and without growth
      const noGrowth = projectRRIFBalance(500000, 72, 80, 0);
      const withGrowth = projectRRIFBalance(500000, 72, 80, 0.05);
      const lastNoGrowth = noGrowth[noGrowth.length - 1].balance;
      const lastWithGrowth = withGrowth[withGrowth.length - 1].balance;
      expect(lastWithGrowth).toBeGreaterThan(lastNoGrowth);
    });

    it('should include additional withdrawals', () => {
      const withoutExtra = projectRRIFBalance(500000, 72, 80, 0.04, 0);
      const withExtra = projectRRIFBalance(500000, 72, 80, 0.04, 10000);
      // With extra withdrawals, balance should be lower
      expect(withExtra[withExtra.length - 1].balance).toBeLessThan(
        withoutExtra[withoutExtra.length - 1].balance
      );
    });
  });

  describe('Real-world RRIF scenarios', () => {
    it('should calculate typical retiree minimum at 72', () => {
      // $600,000 RRIF at age 72
      const minimum = calculateRRIFMinimumWithdrawal(600000, 72);
      expect(minimum).toBeCloseTo(32400, 0); // 5.4% of $600k
    });

    it('should show impact of forced withdrawals at 85', () => {
      // $400,000 RRIF at age 85
      const minimum = calculateRRIFMinimumWithdrawal(400000, 85);
      expect(minimum).toBeCloseTo(34040, 0); // 8.51% of $400k
    });

    it('should demonstrate younger spouse strategy', () => {
      // 75-year-old with $500,000 RRIF, spouse is 68
      const withoutStrategy = calculateRRIFMinimumWithdrawal(500000, 75);
      const withStrategy = calculateRRIFMinimumWithYoungerSpouse(500000, 75, 68);
      const savings = withoutStrategy - withStrategy;
      expect(savings).toBeGreaterThan(5000); // Significant savings
    });

    it('should project RRIF longevity with typical assumptions', () => {
      // $500,000 at 72, 4% return, $10k extra withdrawals
      const projection = projectRRIFBalance(500000, 72, 95, 0.04, 10000);
      // Should last well into 90s with moderate assumptions
      const ageWhenDepleted = projection.find((p) => p.balance <= 0)?.age ?? 100;
      expect(ageWhenDepleted).toBeGreaterThan(85);
    });

    it('should show aggressive withdrawal impact', () => {
      // $500,000 at 72, 4% return, $30k extra withdrawals
      const projection = projectRRIFBalance(500000, 72, 95, 0.04, 30000);
      const ageWhenDepleted = projection.find((p) => p.balance <= 0)?.age ?? 100;
      // Should deplete faster
      expect(ageWhenDepleted).toBeLessThan(90);
    });
  });
});
