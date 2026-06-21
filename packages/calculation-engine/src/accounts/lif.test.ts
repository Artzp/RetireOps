/**
 * LIF Module Tests
 * @see docs/source-of-truth/02-account-types.md - LIF Section
 */
import { describe, it, expect } from 'vitest';
import { getRRIFMinimumRate } from '@retireops/shared';
import {
  calculateLIFMinimumWithdrawal,
  calculateLIFMinimumWithYoungerSpouse,
  calculateLIFMaximumWithdrawal,
  getLIFWithdrawalLimits,
  processLIFWithdrawal,
  isLIFMinimumRequired,
  projectLIFBalance,
  calculateTotalLIFIncome,
  suggestOptimalLIFWithdrawal,
  getLIFMaximumRateForAge,
  getLIFMinimumRateForAge,
} from './lif.js';

describe('LIF Module', () => {
  describe('calculateLIFMinimumWithdrawal', () => {
    /**
     * @see docs/source-of-truth/02-account-types.md - TC-LIF-001
     * LIF minimum matches RRIF minimum at same age
     */
    it('should match RRIF minimum withdrawal at same age', () => {
      const balance = 500000;

      for (let age = 72; age <= 94; age++) {
        const lifMinimum = calculateLIFMinimumWithdrawal(balance, age);
        const rrifRate = getRRIFMinimumRate(age);
        const expectedMinimum = balance * rrifRate;

        expect(lifMinimum).toBeCloseTo(expectedMinimum, 2);
      }
    });

    it('should return 0 for ages below 72', () => {
      expect(calculateLIFMinimumWithdrawal(500000, 65)).toBe(0);
      expect(calculateLIFMinimumWithdrawal(500000, 71)).toBe(0);
    });

    it('should return 0 for zero balance', () => {
      expect(calculateLIFMinimumWithdrawal(0, 72)).toBe(0);
    });

    it('should calculate correct minimum at age 72', () => {
      const balance = 500000;
      const expected = balance * 0.054; // 5.40% at age 72
      expect(calculateLIFMinimumWithdrawal(balance, 72)).toBeCloseTo(expected, 2);
    });

    it('should calculate correct minimum at age 85', () => {
      const balance = 500000;
      const expected = balance * 0.0851; // 8.51% at age 85
      expect(calculateLIFMinimumWithdrawal(balance, 85)).toBeCloseTo(expected, 2);
    });
  });

  describe('calculateLIFMinimumWithYoungerSpouse', () => {
    it('should use younger spouse age for lower minimum', () => {
      const balance = 500000;
      const ownerAge = 75;
      const spouseAge = 70;

      const result = calculateLIFMinimumWithYoungerSpouse(balance, ownerAge, spouseAge);
      const expectedWithOwner = calculateLIFMinimumWithdrawal(balance, ownerAge);

      // Should be 0 because spouse is under 72
      expect(result).toBe(0);
      expect(result).toBeLessThan(expectedWithOwner);
    });

    it('should use owner age if younger than spouse', () => {
      const balance = 500000;
      const ownerAge = 72;
      const spouseAge = 80;

      const result = calculateLIFMinimumWithYoungerSpouse(balance, ownerAge, spouseAge);
      const expected = calculateLIFMinimumWithdrawal(balance, ownerAge);

      expect(result).toBeCloseTo(expected, 2);
    });

    it('should use younger spouse age when both 72+', () => {
      const balance = 500000;
      const ownerAge = 80;
      const spouseAge = 75;

      const result = calculateLIFMinimumWithYoungerSpouse(balance, ownerAge, spouseAge);
      const expectedWithSpouse = calculateLIFMinimumWithdrawal(balance, spouseAge);

      expect(result).toBeCloseTo(expectedWithSpouse, 2);
    });
  });

  describe('calculateLIFMaximumWithdrawal', () => {
    /**
     * @see docs/source-of-truth/02-account-types.md - TC-LIF-002
     * LIF maximum calculated correctly by CANSIM formula
     */
    it('should calculate maximum using CANSIM formula for federal', () => {
      const balance = 500000;
      const age = 71;
      const result = calculateLIFMaximumWithdrawal(balance, age, 'federal');

      // At age 71 with 19 years to 90, rate ≈ 6% / (1 - 1.06^-19) ≈ 5.37%
      // Formula: r / (1 - (1+r)^-n) = 0.06 / (1 - 1.06^-19)
      const referenceRate = 0.06;
      const yearsTo90 = 90 - 71;
      const expectedRate = referenceRate / (1 - Math.pow(1 + referenceRate, -yearsTo90));
      const expectedMax = balance * expectedRate;

      expect(result).toBeCloseTo(expectedMax, 0);
    });

    it('should return 0 for zero balance', () => {
      expect(calculateLIFMaximumWithdrawal(0, 71, 'federal')).toBe(0);
    });

    /**
     * @see docs/source-of-truth/02-account-types.md - TC-LIF-003
     * LIF maximum rate increases as age approaches 90
     */
    it('should increase maximum rate as age approaches 90', () => {
      const balance = 500000;

      const max71 = calculateLIFMaximumWithdrawal(balance, 71, 'federal');
      const max80 = calculateLIFMaximumWithdrawal(balance, 80, 'federal');
      const max85 = calculateLIFMaximumWithdrawal(balance, 85, 'federal');
      const max89 = calculateLIFMaximumWithdrawal(balance, 89, 'federal');

      expect(max80).toBeGreaterThan(max71);
      expect(max85).toBeGreaterThan(max80);
      expect(max89).toBeGreaterThan(max85);
    });

    it('should return balance (100%) at age 90+', () => {
      const balance = 500000;
      const max90 = calculateLIFMaximumWithdrawal(balance, 90, 'federal');

      // At age 90, years to target = 0, so rate approaches 100%
      expect(max90).toBeCloseTo(balance, 0);
    });
  });

  describe('getLIFWithdrawalLimits', () => {
    it('should return both minimum and maximum limits', () => {
      const balance = 500000;
      const age = 75;

      const limits = getLIFWithdrawalLimits(balance, age, 'federal');

      expect(limits.minimum).toBeGreaterThan(0);
      expect(limits.maximum).toBeGreaterThan(limits.minimum);
      expect(limits.minimumRate).toBeGreaterThan(0);
      expect(limits.maximumRate).toBeGreaterThan(limits.minimumRate);
    });

    it('should return zero limits for zero balance', () => {
      const limits = getLIFWithdrawalLimits(0, 75, 'federal');

      expect(limits.minimum).toBe(0);
      expect(limits.maximum).toBe(0);
    });

    it('should return zero minimum before age 72', () => {
      const limits = getLIFWithdrawalLimits(500000, 65, 'federal');

      expect(limits.minimum).toBe(0);
      expect(limits.minimumRate).toBe(0);
      expect(limits.maximum).toBeGreaterThan(0);
    });

    /**
     * @see docs/source-of-truth/02-account-types.md - TC-LIF-004
     * Younger spouse age reduces LIF minimum
     */
    it('should use younger spouse age for minimum calculation', () => {
      const balance = 500000;
      const ownerAge = 75;
      const spouseAge = 70;

      const limitsWithSpouse = getLIFWithdrawalLimits(
        balance,
        ownerAge,
        'federal',
        true,
        spouseAge
      );
      const limitsWithoutSpouse = getLIFWithdrawalLimits(balance, ownerAge, 'federal', false);

      // Spouse age 70 means no minimum (under 72)
      expect(limitsWithSpouse.minimum).toBe(0);
      expect(limitsWithoutSpouse.minimum).toBeGreaterThan(0);
    });
  });

  describe('processLIFWithdrawal', () => {
    it('should enforce minimum withdrawal when requested is below', () => {
      const balance = 500000;
      const age = 75;

      const result = processLIFWithdrawal(balance, age, 10000, 'federal');

      expect(result.actualWithdrawal).toBeGreaterThanOrEqual(result.minimumRequired);
      expect(result.wasConstrained).toBe(true);
      expect(result.constraintType).toBe('minimum');
    });

    it('should enforce maximum withdrawal when requested exceeds limit', () => {
      const balance = 500000;
      const age = 71;

      // Request more than maximum
      const result = processLIFWithdrawal(balance, age, 100000, 'federal');

      expect(result.actualWithdrawal).toBeLessThanOrEqual(result.maximumAllowed);
      expect(result.wasConstrained).toBe(true);
      expect(result.constraintType).toBe('maximum');
    });

    it('should allow withdrawal within limits without constraint', () => {
      const balance = 500000;
      const age = 75;

      const limits = getLIFWithdrawalLimits(balance, age, 'federal');
      const requestedWithdrawal = (limits.minimum + limits.maximum) / 2;

      const result = processLIFWithdrawal(balance, age, requestedWithdrawal, 'federal');

      expect(result.actualWithdrawal).toBeCloseTo(requestedWithdrawal, 2);
      expect(result.wasConstrained).toBe(false);
      expect(result.constraintType).toBe('none');
    });

    it('should calculate correct new balance', () => {
      const balance = 500000;
      const age = 75;

      const result = processLIFWithdrawal(balance, age, 30000, 'federal');

      expect(result.newBalance).toBe(balance - result.actualWithdrawal);
    });

    it('should not withdraw more than balance', () => {
      const balance = 10000;
      const age = 75;

      const result = processLIFWithdrawal(balance, age, 50000, 'federal');

      expect(result.actualWithdrawal).toBeLessThanOrEqual(balance);
    });

    it('should mark entire withdrawal as taxable', () => {
      const balance = 500000;
      const age = 75;

      const result = processLIFWithdrawal(balance, age, 30000, 'federal');

      expect(result.taxableAmount).toBe(result.actualWithdrawal);
    });
  });

  describe('isLIFMinimumRequired', () => {
    it('should return true at age 72 and above', () => {
      expect(isLIFMinimumRequired(72)).toBe(true);
      expect(isLIFMinimumRequired(85)).toBe(true);
    });

    it('should return false below age 72', () => {
      expect(isLIFMinimumRequired(71)).toBe(false);
      expect(isLIFMinimumRequired(65)).toBe(false);
    });
  });

  describe('projectLIFBalance', () => {
    it('should project balance over time with withdrawals and growth', () => {
      const projections = projectLIFBalance(500000, 72, 80, 0.05, 30000, 'federal', 2024);

      expect(projections.length).toBe(9); // Ages 72-80 inclusive

      // First entry
      expect(projections[0].age).toBe(72);
      expect(projections[0].year).toBe(2024);
      expect(projections[0].startingBalance).toBe(500000);

      // Balance should decrease over time with withdrawals
      for (let i = 1; i < projections.length; i++) {
        expect(projections[i].age).toBe(72 + i);
        expect(projections[i].year).toBe(2024 + i);
      }
    });

    it('should enforce minimum withdrawals', () => {
      const projections = projectLIFBalance(500000, 72, 75, 0.05, 0, 'federal');

      // Even with zero target, should withdraw minimum
      for (const entry of projections) {
        expect(entry.actualWithdrawal).toBeGreaterThanOrEqual(entry.minimumWithdrawal);
      }
    });

    it('should enforce maximum withdrawals', () => {
      const projections = projectLIFBalance(500000, 72, 75, 0.05, 1000000, 'federal');

      // Should cap at maximum
      for (const entry of projections) {
        expect(entry.actualWithdrawal).toBeLessThanOrEqual(entry.maximumWithdrawal);
      }
    });

    it('should apply investment growth', () => {
      const projections = projectLIFBalance(500000, 65, 66, 0.05, 0, 'federal');

      const entry = projections[0];
      const expectedGrowth = entry.startingBalance * 0.05; // No withdrawals before 72
      expect(entry.growth).toBeCloseTo(expectedGrowth, 0);
    });

    it('should stop when balance depletes', () => {
      const projections = projectLIFBalance(50000, 72, 100, 0.0, 20000, 'federal');

      // Should end before age 100 due to depletion
      expect(projections.length).toBeLessThan(29);

      const lastEntry = projections[projections.length - 1];
      expect(lastEntry.endingBalance).toBeCloseTo(0, 0);
    });
  });

  describe('calculateTotalLIFIncome', () => {
    it('should sum all withdrawals', () => {
      const projections = projectLIFBalance(500000, 72, 75, 0.05, 30000, 'federal');

      const total = calculateTotalLIFIncome(projections);
      const manualSum = projections.reduce((sum, p) => sum + p.actualWithdrawal, 0);

      expect(total).toBeCloseTo(manualSum, 2);
    });
  });

  describe('suggestOptimalLIFWithdrawal', () => {
    it('should suggest at least minimum withdrawal', () => {
      const balance = 500000;
      const age = 75;

      const limits = getLIFWithdrawalLimits(balance, age, 'federal');
      const suggested = suggestOptimalLIFWithdrawal(balance, age, 'federal', 1000);

      expect(suggested).toBeGreaterThanOrEqual(limits.minimum);
    });

    it('should not exceed maximum', () => {
      const balance = 500000;
      const age = 71;

      const limits = getLIFWithdrawalLimits(balance, age, 'federal');
      const suggested = suggestOptimalLIFWithdrawal(balance, age, 'federal', 200000);

      expect(suggested).toBeLessThanOrEqual(limits.maximum);
    });

    it('should meet spending need when within limits', () => {
      const balance = 500000;
      const age = 75;
      const spendingNeed = 35000;

      const limits = getLIFWithdrawalLimits(balance, age, 'federal');
      const suggested = suggestOptimalLIFWithdrawal(balance, age, 'federal', spendingNeed);

      // If spending need is within limits, should match it
      if (spendingNeed >= limits.minimum && spendingNeed <= limits.maximum) {
        expect(suggested).toBeCloseTo(spendingNeed, 2);
      }
    });
  });

  describe('getLIFMaximumRateForAge', () => {
    it('should return rate as percentage', () => {
      const rate71 = getLIFMaximumRateForAge(71, 'federal');
      const rate80 = getLIFMaximumRateForAge(80, 'federal');

      // Rates should be in percentage form (e.g., 5.37 not 0.0537)
      expect(rate71).toBeGreaterThan(1);
      expect(rate71).toBeLessThan(100);
      expect(rate80).toBeGreaterThan(rate71);
    });
  });

  describe('getLIFMinimumRateForAge', () => {
    it('should return rate as percentage', () => {
      const rate72 = getLIFMinimumRateForAge(72);
      const rate85 = getLIFMinimumRateForAge(85);

      // Rates should be in percentage form
      expect(rate72).toBeCloseTo(5.4, 1); // 5.40%
      expect(rate85).toBeCloseTo(8.51, 1); // 8.51%
    });

    it('should apply CRA pre-71 factor 1/(90-age) for ages below 65 (RRIF-007, audit B-05)', () => {
      // getLIFMinimumRateForAge delegates to getRRIFMinimumRate, which now returns
      // the CRA pre-71 factor 1/(90-age)*100 instead of a zero floor. The LIF
      // minimum-REQUIRED gate (age >= 72) still lives in calculateLIFMinimumWithdrawal.
      expect(getLIFMinimumRateForAge(60)).toBeCloseTo((1 / 30) * 100, 4); // ~3.333%
      expect(getLIFMinimumRateForAge(60)).toBeGreaterThan(0);
    });
  });

  describe('Jurisdiction-specific behavior', () => {
    it('should currently produce identical maximums for jurisdictions the blueprint expects to diverge', () => {
      const balance = 500000;
      const age = 75;

      // Ontario, BC, and NL are called out in the blueprint as needing
      // distinct "greater of statutory % or prior-year return" handling,
      // but the current implementation still uses the same CANSIM formula.
      const maxFederal = calculateLIFMaximumWithdrawal(balance, age, 'federal');
      const maxON = calculateLIFMaximumWithdrawal(balance, age, 'ON');
      const maxBC = calculateLIFMaximumWithdrawal(balance, age, 'BC');
      const maxNL = calculateLIFMaximumWithdrawal(balance, age, 'NL');

      expect(maxON).toBeCloseTo(maxFederal, 2);
      expect(maxBC).toBeCloseTo(maxFederal, 2);
      expect(maxNL).toBeCloseTo(maxFederal, 2);
    });

    it('should let Ontario use prior-year return when it is higher than the statutory maximum', () => {
      const balance = 500000;
      const age = 75;
      const previousYearReturnRate = 0.12;

      const statutoryMaximum = calculateLIFMaximumWithdrawal(balance, age, 'ON');
      const returnBasedMaximum = calculateLIFMaximumWithdrawal(
        balance,
        age,
        'ON',
        undefined,
        previousYearReturnRate
      );

      expect(returnBasedMaximum).toBe(balance * previousYearReturnRate);
      expect(returnBasedMaximum).toBeGreaterThan(statutoryMaximum);
    });

    it('should keep Ontario on the statutory maximum when prior-year return is lower', () => {
      const balance = 500000;
      const age = 75;
      const previousYearReturnRate = 0.03;

      const statutoryMaximum = calculateLIFMaximumWithdrawal(balance, age, 'ON');
      const returnBasedMaximum = calculateLIFMaximumWithdrawal(
        balance,
        age,
        'ON',
        undefined,
        previousYearReturnRate
      );

      expect(returnBasedMaximum).toBeCloseTo(statutoryMaximum, 2);
    });

    it('should let BC use prior-year return when it is higher than the statutory maximum', () => {
      const balance = 500000;
      const age = 75;
      const previousYearReturnRate = 0.12;

      const statutoryMaximum = calculateLIFMaximumWithdrawal(balance, age, 'BC');
      const returnBasedMaximum = calculateLIFMaximumWithdrawal(
        balance,
        age,
        'BC',
        undefined,
        previousYearReturnRate
      );

      expect(returnBasedMaximum).toBe(balance * previousYearReturnRate);
      expect(returnBasedMaximum).toBeGreaterThan(statutoryMaximum);
    });

    it('should keep BC on the statutory maximum when prior-year return is lower', () => {
      const balance = 500000;
      const age = 75;
      const previousYearReturnRate = 0.03;

      const statutoryMaximum = calculateLIFMaximumWithdrawal(balance, age, 'BC');
      const returnBasedMaximum = calculateLIFMaximumWithdrawal(
        balance,
        age,
        'BC',
        undefined,
        previousYearReturnRate
      );

      expect(returnBasedMaximum).toBeCloseTo(statutoryMaximum, 2);
    });

    it('should let NL use prior-year return when it is higher than the statutory maximum', () => {
      const balance = 500000;
      const age = 75;
      const previousYearReturnRate = 0.12;

      const statutoryMaximum = calculateLIFMaximumWithdrawal(balance, age, 'NL');
      const returnBasedMaximum = calculateLIFMaximumWithdrawal(
        balance,
        age,
        'NL',
        undefined,
        previousYearReturnRate
      );

      expect(returnBasedMaximum).toBe(balance * previousYearReturnRate);
      expect(returnBasedMaximum).toBeGreaterThan(statutoryMaximum);
    });

    it('should keep NL on the statutory maximum when prior-year return is lower', () => {
      const balance = 500000;
      const age = 75;
      const previousYearReturnRate = 0.03;

      const statutoryMaximum = calculateLIFMaximumWithdrawal(balance, age, 'NL');
      const returnBasedMaximum = calculateLIFMaximumWithdrawal(
        balance,
        age,
        'NL',
        undefined,
        previousYearReturnRate
      );

      expect(returnBasedMaximum).toBeCloseTo(statutoryMaximum, 2);
    });

    it('should ignore prior-year return for jurisdictions outside the Ontario, BC, and NL slices', () => {
      const balance = 500000;
      const age = 75;
      const previousYearReturnRate = 0.12;

      const federalStatutoryMaximum = calculateLIFMaximumWithdrawal(balance, age, 'federal');
      const federalWithReturnInput = calculateLIFMaximumWithdrawal(
        balance,
        age,
        'federal',
        undefined,
        previousYearReturnRate
      );

      expect(federalWithReturnInput).toBeCloseTo(federalStatutoryMaximum, 2);
    });
  });
});
