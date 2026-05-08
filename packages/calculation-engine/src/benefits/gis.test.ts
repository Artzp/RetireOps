/**
 * GIS Benefit Calculation Tests
 * @see docs/source-of-truth/05-government-benefits.md - GIS Section
 */
import { describe, it, expect } from 'vitest';
import {
  getGISIncomeThreshold,
  getMaxGISAmount,
  calculateGISIncome,
  isEligibleForGIS,
  calculateGISBenefit,
  calculateGIS,
} from './gis.js';
import { BENEFIT_AMOUNTS_2024 } from '@retireops/shared';

const { gis } = BENEFIT_AMOUNTS_2024;

describe('GIS Benefit Calculations', () => {
  describe('getGISIncomeThreshold', () => {
    it('should return single threshold for single person', () => {
      const threshold = getGISIncomeThreshold('single');
      expect(threshold).toBe(gis.incomeThresholdSingle);
      expect(threshold).toBeGreaterThan(20000);
    });

    it('should return married-both threshold when spouse receives OAS', () => {
      const threshold = getGISIncomeThreshold('married', true);
      expect(threshold).toBe(gis.incomeThresholdMarriedBoth);
    });

    it('should return higher threshold when spouse not receiving OAS', () => {
      const thresholdBoth = getGISIncomeThreshold('married', true);
      const thresholdOne = getGISIncomeThreshold('married', false);
      expect(thresholdOne).toBeGreaterThan(thresholdBoth);
      expect(thresholdOne).toBe(51840);
    });

    it('should treat common_law same as married', () => {
      const married = getGISIncomeThreshold('married', true);
      const commonLaw = getGISIncomeThreshold('common_law', true);
      expect(commonLaw).toBe(married);
    });
  });

  describe('getMaxGISAmount', () => {
    it('should return single max for single person', () => {
      const max = getMaxGISAmount('single');
      expect(max).toBe(gis.maxAnnualSingle);
      expect(max).toBeGreaterThan(12000);
    });

    it('should return annual married amount for married person', () => {
      const max = getMaxGISAmount('married');
      expect(max).toBe(gis.maxMonthlyMarried * 12);
    });

    it('should show single max is higher than married max (per person)', () => {
      const singleMax = getMaxGISAmount('single');
      const marriedMax = getMaxGISAmount('married');
      expect(singleMax).toBeGreaterThan(marriedMax);
    });
  });

  describe('calculateGISIncome', () => {
    it('should exclude OAS income', () => {
      // Total income $20,000, OAS $8,000, no employment
      const gisIncome = calculateGISIncome(20000, 8000, 0);
      expect(gisIncome).toBe(12000);
    });

    it('should exclude first $5,000 of employment income', () => {
      // Total income $15,000, no OAS, $10,000 employment
      const gisIncome = calculateGISIncome(15000, 0, 10000);
      expect(gisIncome).toBe(10000); // $15,000 - $0 - $5,000
    });

    it('should cap employment exemption at actual employment', () => {
      // Total income $15,000, no OAS, $3,000 employment
      const gisIncome = calculateGISIncome(15000, 0, 3000);
      expect(gisIncome).toBe(12000); // $15,000 - $0 - $3,000
    });

    it('should combine both exclusions', () => {
      // Total income $25,000, OAS $8,000, $6,000 employment
      const gisIncome = calculateGISIncome(25000, 8000, 6000);
      expect(gisIncome).toBe(12000); // $25,000 - $8,000 - $5,000
    });

    it('should handle zero income scenario', () => {
      const gisIncome = calculateGISIncome(0, 0, 0);
      expect(gisIncome).toBe(0);
    });

    it('should handle OAS-only income', () => {
      const gisIncome = calculateGISIncome(8560, 8560, 0);
      expect(gisIncome).toBe(0);
    });
  });

  describe('isEligibleForGIS', () => {
    it('should return false for age under 65', () => {
      expect(isEligibleForGIS(64, true, 5000, 'single')).toBe(false);
    });

    it('should return false if not receiving OAS', () => {
      expect(isEligibleForGIS(65, false, 5000, 'single')).toBe(false);
    });

    it('should return false if income exceeds threshold', () => {
      const threshold = getGISIncomeThreshold('single');
      expect(isEligibleForGIS(65, true, threshold + 1, 'single')).toBe(false);
    });

    it('should return true when all conditions met', () => {
      expect(isEligibleForGIS(65, true, 5000, 'single')).toBe(true);
      expect(isEligibleForGIS(70, true, 10000, 'married', true)).toBe(true);
    });

    it('should handle income at exactly threshold', () => {
      const threshold = getGISIncomeThreshold('single');
      // At threshold is NOT eligible (must be below)
      expect(isEligibleForGIS(65, true, threshold, 'single')).toBe(false);
    });

    it('should handle zero income', () => {
      expect(isEligibleForGIS(65, true, 0, 'single')).toBe(true);
    });
  });

  describe('calculateGISBenefit', () => {
    it('should return max benefit for zero income', () => {
      const benefit = calculateGISBenefit(0, 'single');
      expect(benefit).toBe(getMaxGISAmount('single'));
    });

    it('should reduce by 50 cents per dollar of income', () => {
      // $10,000 GIS income should reduce by $5,000
      const maxBenefit = getMaxGISAmount('single');
      const benefit = calculateGISBenefit(10000, 'single');
      expect(benefit).toBe(maxBenefit - 5000);
    });

    it('should return zero when income exceeds threshold', () => {
      const threshold = getGISIncomeThreshold('single');
      const benefit = calculateGISBenefit(threshold, 'single');
      expect(benefit).toBe(0);
    });

    it('should never return negative', () => {
      const threshold = getGISIncomeThreshold('single');
      const benefit = calculateGISBenefit(threshold + 10000, 'single');
      expect(benefit).toBe(0);
    });

    it('should calculate correctly for married couple', () => {
      const maxBenefit = getMaxGISAmount('married');
      const benefit = calculateGISBenefit(5000, 'married', true);
      expect(benefit).toBe(maxBenefit - 2500);
    });

    it('should handle married with spouse not receiving OAS', () => {
      const benefit = calculateGISBenefit(10000, 'married', false);
      const maxBenefit = getMaxGISAmount('married');
      expect(benefit).toBe(maxBenefit - 5000);
    });
  });

  describe('calculateGIS (complete calculation)', () => {
    it('should return full result for eligible single person', () => {
      const result = calculateGIS(
        67, // age
        true, // receiving OAS
        10000, // total income
        8560, // OAS income
        0, // employment income
        'single'
      );

      expect(result.isEligible).toBe(true);
      expect(result.gisIncome).toBe(1440); // $10,000 - $8,560
      expect(result.maxAmount).toBe(getMaxGISAmount('single'));
      expect(result.reduction).toBeCloseTo(720, 2); // $1,440 * 0.5
      expect(result.benefit).toBe(result.maxAmount - result.reduction);
    });

    it('should return ineligible result for person under 65', () => {
      const result = calculateGIS(64, true, 10000, 8560, 0, 'single');

      expect(result.isEligible).toBe(false);
      expect(result.benefit).toBe(0);
      expect(result.maxAmount).toBe(0);
    });

    it('should return ineligible result for person not receiving OAS', () => {
      const result = calculateGIS(67, false, 10000, 0, 0, 'single');

      expect(result.isEligible).toBe(false);
      expect(result.benefit).toBe(0);
    });

    it('should apply employment income exemption', () => {
      // Total income $20,000: $8,560 OAS, $6,000 employment, $5,440 other
      const result = calculateGIS(67, true, 20000, 8560, 6000, 'single');

      // GIS income = $20,000 - $8,560 - $5,000 = $6,440
      expect(result.gisIncome).toBe(6440);
      expect(result.isEligible).toBe(true);
    });

    it('should calculate married couple with both receiving OAS', () => {
      const result = calculateGIS(
        70,
        true,
        25000, // combined income
        17120, // both OAS
        0,
        'married',
        true // spouse receiving OAS
      );

      expect(result.isEligible).toBe(true);
      expect(result.gisIncome).toBe(7880); // $25,000 - $17,120
      expect(result.maxAmount).toBe(getMaxGISAmount('married'));
    });

    it('should return zero benefit when income eliminates GIS', () => {
      const threshold = getGISIncomeThreshold('single');
      const result = calculateGIS(
        65,
        true,
        threshold + 10000, // Well over threshold
        8560,
        0,
        'single'
      );

      expect(result.isEligible).toBe(false);
      expect(result.benefit).toBe(0);
    });
  });

  describe('Real-world GIS scenarios', () => {
    it('should calculate GIS for low-income single senior', () => {
      // Senior with only OAS and small pension
      const result = calculateGIS(
        68,
        true,
        12000, // Total income (OAS + small pension)
        8560, // OAS
        0,
        'single'
      );

      // GIS income = $3,440
      expect(result.isEligible).toBe(true);
      expect(result.gisIncome).toBe(3440);
      expect(result.benefit).toBeGreaterThan(10000);
    });

    it('should calculate GIS for senior with part-time work', () => {
      // Senior with OAS and part-time job
      const result = calculateGIS(
        67,
        true,
        20000, // Total income
        8560, // OAS
        8000, // Part-time employment
        'single'
      );

      // GIS income = $20,000 - $8,560 - $5,000 = $6,440
      expect(result.isEligible).toBe(true);
      expect(result.gisIncome).toBe(6440);
      expect(result.benefit).toBeGreaterThan(8000);
    });

    it('should calculate GIS for married couple, one working', () => {
      const result = calculateGIS(
        70,
        true,
        30000, // Combined income
        17120, // Both receiving OAS
        8000, // One spouse part-time work
        'married',
        true
      );

      // GIS income = $30,000 - $17,120 - $5,000 = $7,880
      expect(result.isEligible).toBe(true);
      expect(result.gisIncome).toBe(7880);
    });

    it('should show GIS phaseout for moderate income', () => {
      // Test multiple income levels to show phaseout
      const maxGIS = getMaxGISAmount('single');

      const result5k = calculateGIS(67, true, 13560, 8560, 0, 'single');
      const result10k = calculateGIS(67, true, 18560, 8560, 0, 'single');
      const result15k = calculateGIS(67, true, 23560, 8560, 0, 'single');

      // Each $2 of income reduces GIS by $1
      expect(result5k.benefit).toBe(maxGIS - 2500);
      expect(result10k.benefit).toBe(maxGIS - 5000);
      expect(result15k.benefit).toBe(maxGIS - 7500);
    });

    it('should demonstrate total income support for poorest seniors', () => {
      // Senior with only OAS (minimal other income)
      const result = calculateGIS(65, true, 8560, 8560, 0, 'single');

      const totalSupport = 8560 + result.benefit; // OAS + GIS
      // Should provide basic income security
      expect(totalSupport).toBeGreaterThan(20000);
    });

    it('should show different thresholds for married couples', () => {
      const thresholdBothOAS = getGISIncomeThreshold('married', true);
      const thresholdOneOAS = getGISIncomeThreshold('married', false);

      // Higher threshold when only one spouse gets OAS (more need)
      expect(thresholdOneOAS).toBeGreaterThan(thresholdBothOAS);
      expect(thresholdOneOAS - thresholdBothOAS).toBeGreaterThan(20000);
    });
  });
});
