/**
 * GIS Benefit Calculation Tests
 * @see docs/source-of-truth/05-government-benefits.md - GIS Section
 * @see docs/source-of-truth/18-pensions-2026.md - GIS 2026 Q2 parameter values
 *
 * Pinned to the citation-anchored 2026 Q2 values (audit A-02): single max
 * 1109.85/mo (= $13,318.20/yr), couple-on-OAS / couple-on-Allowance max
 * 668.08/mo (= $8,016.96/yr), couple-no-OAS max 1109.85/mo (= $13,318.20/yr);
 * cutoffs 22512 / 29760 / 41664 / 53952; single reduction 50%, couple 25%/
 * recipient; two-band earnings exemption ($5,000 full + 50% of next $10,000).
 */
import { describe, it, expect } from 'vitest';
import {
  getGISIncomeThreshold,
  getMaxGISAmount,
  calculateGISIncome,
  calculateGISEarningsExemption,
  isEligibleForGIS,
  calculateGISBenefit,
  calculateGIS,
} from './gis.js';
import { GIS_2026 } from '@retireops/shared/benefits';

// Anchored 2026 Q2 derived constants used by the tests below.
const SINGLE_MAX = GIS_2026.q2.single.maxMonthly * 12; // 13_318.20
const SINGLE_CUTOFF = GIS_2026.q2.single.annualIncomeCutoff; // 22_512
const COUPLE_ON_OAS_MAX = GIS_2026.q2.spouseOnOas.maxMonthly * 12; // 8_016.96
const COUPLE_ON_OAS_CUTOFF = GIS_2026.q2.spouseOnOas.combinedAnnualCutoff; // 29_760
const COUPLE_NO_OAS_CUTOFF = GIS_2026.q2.spouseNoOas.combinedAnnualCutoff; // 53_952
const COUPLE_RATE = GIS_2026.reductionRateCoupleBothOas; // 0.25

describe('GIS Benefit Calculations (2026 anchored)', () => {
  describe('getGISIncomeThreshold', () => {
    it('should return single threshold for single person', () => {
      const threshold = getGISIncomeThreshold('single');
      expect(threshold).toBe(SINGLE_CUTOFF);
      expect(threshold).toBe(22_512);
    });

    it('should return spouse-on-OAS combined threshold when spouse receives OAS', () => {
      const threshold = getGISIncomeThreshold('married', true);
      expect(threshold).toBe(COUPLE_ON_OAS_CUTOFF);
      expect(threshold).toBe(29_760);
    });

    it('should return higher threshold when spouse not receiving OAS or Allowance', () => {
      const thresholdBoth = getGISIncomeThreshold('married', true);
      const thresholdNoOas = getGISIncomeThreshold('married', false);
      expect(thresholdNoOas).toBeGreaterThan(thresholdBoth);
      expect(thresholdNoOas).toBe(COUPLE_NO_OAS_CUTOFF);
      expect(thresholdNoOas).toBe(53_952);
    });

    it('should return spouse-on-Allowance combined threshold', () => {
      const threshold = getGISIncomeThreshold('married', false, true);
      expect(threshold).toBe(GIS_2026.q2.spouseOnAllowance.combinedAnnualCutoff);
      expect(threshold).toBe(41_664);
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
      expect(max).toBeCloseTo(SINGLE_MAX, 2);
      expect(max).toBeCloseTo(13_318.2, 2);
    });

    it('should return couple-on-OAS annual amount when married + spouse on OAS', () => {
      const max = getMaxGISAmount('married', true);
      expect(max).toBeCloseTo(COUPLE_ON_OAS_MAX, 2);
      expect(max).toBeCloseTo(8_016.96, 2);
    });

    it('should show single max is higher than couple-on-OAS max (per person)', () => {
      const singleMax = getMaxGISAmount('single');
      const coupleMax = getMaxGISAmount('married', true);
      expect(singleMax).toBeGreaterThan(coupleMax);
    });
  });

  describe('calculateGISEarningsExemption (two-band)', () => {
    it('fully exempts the first $5,000', () => {
      expect(calculateGISEarningsExemption(5_000)).toBe(5_000);
      expect(calculateGISEarningsExemption(3_000)).toBe(3_000);
    });

    it('exempts 50% of the $5,000–$15,000 band', () => {
      // $10,000 employment → 5,000 full + 0.5 × 5,000 = 7,500 exempt
      expect(calculateGISEarningsExemption(10_000)).toBe(7_500);
      // $15,000 employment → 5,000 full + 0.5 × 10,000 = 10,000 exempt
      expect(calculateGISEarningsExemption(15_000)).toBe(10_000);
    });

    it('caps the second band at $15,000 (income above is fully counted)', () => {
      // $25,000 employment → still only 10,000 exempt (5,000 + 5,000)
      expect(calculateGISEarningsExemption(25_000)).toBe(10_000);
    });

    it('returns 0 for non-positive employment income', () => {
      expect(calculateGISEarningsExemption(0)).toBe(0);
      expect(calculateGISEarningsExemption(-100)).toBe(0);
    });
  });

  describe('calculateGISIncome', () => {
    it('should exclude OAS income', () => {
      // Total income $20,000, OAS $8,000, no employment
      const gisIncome = calculateGISIncome(20000, 8000, 0);
      expect(gisIncome).toBe(12000);
    });

    it('should fully exempt first $5,000 of employment income', () => {
      // Total income $15,000, no OAS, $5,000 employment (fully exempt)
      const gisIncome = calculateGISIncome(15000, 0, 5000);
      expect(gisIncome).toBe(10000); // $15,000 - $0 - $5,000
    });

    it('should apply the second-band 50% exemption on employment income', () => {
      // Total income $15,000, no OAS, $10,000 employment → 7,500 exempt
      const gisIncome = calculateGISIncome(15000, 0, 10000);
      expect(gisIncome).toBe(7500); // $15,000 - $0 - $7,500
    });

    it('should cap employment exemption when employment is below first band', () => {
      // Total income $15,000, no OAS, $3,000 employment
      const gisIncome = calculateGISIncome(15000, 0, 3000);
      expect(gisIncome).toBe(12000); // $15,000 - $0 - $3,000
    });

    it('should combine OAS and employment exclusions', () => {
      // Total income $25,000, OAS $8,000, $6,000 employment
      // exemption = 5,000 + 0.5 × 1,000 = 5,500
      const gisIncome = calculateGISIncome(25000, 8000, 6000);
      expect(gisIncome).toBe(11500); // $25,000 - $8,000 - $5,500
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
      expect(benefit).toBeCloseTo(getMaxGISAmount('single'), 2);
    });

    it('single: should reduce by 50 cents per dollar of income', () => {
      // $10,000 GIS income should reduce a single recipient by $5,000
      const maxBenefit = getMaxGISAmount('single');
      const benefit = calculateGISBenefit(10000, 'single');
      expect(benefit).toBeCloseTo(maxBenefit - 5000, 2);
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

    it('couple: should reduce by 25 cents per dollar of income (per recipient)', () => {
      // $5,000 GIS income on a couple-on-OAS recipient → reduction $1,250
      const maxBenefit = getMaxGISAmount('married', true);
      const benefit = calculateGISBenefit(5000, 'married', true);
      expect(benefit).toBeCloseTo(maxBenefit - 5000 * COUPLE_RATE, 2);
      expect(benefit).toBeCloseTo(maxBenefit - 1250, 2);
    });

    it('A-02 regression: couple-both-OAS uses the 25% rate, not the single 50%', () => {
      // Same GIS income, single is reduced twice as fast as a couple recipient.
      const singleReduction = getMaxGISAmount('single') - calculateGISBenefit(8000, 'single');
      const coupleReduction =
        getMaxGISAmount('married', true) - calculateGISBenefit(8000, 'married', true);
      expect(singleReduction).toBeCloseTo(8000 * 0.5, 2);
      expect(coupleReduction).toBeCloseTo(8000 * 0.25, 2);
    });

    it('should handle married with spouse not receiving OAS (higher cutoff, 25% rate)', () => {
      const benefit = calculateGISBenefit(10000, 'married', false);
      const maxBenefit = getMaxGISAmount('married', false);
      expect(benefit).toBeCloseTo(maxBenefit - 10000 * COUPLE_RATE, 2);
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
      expect(result.maxAmount).toBeCloseTo(getMaxGISAmount('single'), 2);
      expect(result.reduction).toBeCloseTo(720, 2); // $1,440 * 0.5
      expect(result.benefit).toBeCloseTo(result.maxAmount - result.reduction, 2);
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

    it('A-02 regression: applies the two-band employment income exemption', () => {
      // Total income $20,000: $8,560 OAS, $10,000 employment, $1,440 other
      // exemption = 5,000 + 0.5 × 5,000 = 7,500
      const result = calculateGIS(67, true, 20000, 8560, 10000, 'single');
      // GIS income = $20,000 - $8,560 - $7,500 = $3,940
      expect(result.gisIncome).toBe(3940);
      expect(result.isEligible).toBe(true);
    });

    it('should calculate married couple with both receiving OAS at the 25% rate', () => {
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
      expect(result.maxAmount).toBeCloseTo(getMaxGISAmount('married', true), 2);
      expect(result.reduction).toBeCloseTo(7880 * COUPLE_RATE, 2);
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

    it('should calculate GIS for senior with part-time work (two-band exemption)', () => {
      // Senior with OAS and part-time job
      const result = calculateGIS(
        67,
        true,
        20000, // Total income
        8560, // OAS
        8000, // Part-time employment
        'single'
      );

      // exemption = 5,000 + 0.5 × 3,000 = 6,500
      // GIS income = $20,000 - $8,560 - $6,500 = $4,940
      expect(result.isEligible).toBe(true);
      expect(result.gisIncome).toBe(4940);
      expect(result.benefit).toBeGreaterThan(8000);
    });

    it('should show GIS phaseout for moderate income (single, 50% rate)', () => {
      // Test multiple income levels to show phaseout
      const maxGIS = getMaxGISAmount('single');

      const result5k = calculateGIS(67, true, 13560, 8560, 0, 'single');
      const result10k = calculateGIS(67, true, 18560, 8560, 0, 'single');
      const result15k = calculateGIS(67, true, 23560, 8560, 0, 'single');

      // Each $2 of income reduces single GIS by $1
      expect(result5k.benefit).toBeCloseTo(maxGIS - 2500, 2);
      expect(result10k.benefit).toBeCloseTo(maxGIS - 5000, 2);
      expect(result15k.benefit).toBeCloseTo(maxGIS - 7500, 2);
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
      const thresholdNoOAS = getGISIncomeThreshold('married', false);

      // Higher combined threshold when the spouse gets neither OAS nor Allowance
      expect(thresholdNoOAS).toBeGreaterThan(thresholdBothOAS);
      expect(thresholdNoOAS - thresholdBothOAS).toBeGreaterThan(20000);
    });
  });
});
