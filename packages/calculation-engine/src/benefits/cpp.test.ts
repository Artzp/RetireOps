/**
 * CPP/QPP Benefit Calculation Tests
 * @see docs/source-of-truth/05-government-benefits.md - CPP/QPP Section
 */
import { describe, it, expect } from 'vitest';
import {
  calculateCPPAdjustmentFactor,
  calculateCPPBenefit,
  indexCPPBenefit,
  calculateCPPSurvivorBenefit,
  calculateCombinedCPP,
  getCPPAdjustmentTable,
  calculateCPPBreakEvenAge,
  isEligibleForCPP,
  isMaxDeferral,
} from './cpp.js';
import { CPP_ADJUSTMENT_FACTORS } from '@retireops/shared';
import { CPP_2026 } from '@retireops/shared/benefits';

const { EARLY_REDUCTION_PER_MONTH, LATE_INCREASE_PER_MONTH } = CPP_ADJUSTMENT_FACTORS;

// Engine survivor/combined caps now default to the citation-anchored 2026 maximum
// per docs/source-of-truth/18-pensions-2026.md#2026-cpp-max-retirement-pension
// (1_507.65 × 12 = 18_091.80), replacing the deprecated 2024 maximum ($16,375).
const MAX_CPP_AT_65 = CPP_2026.maxRetirementPensionAnnual;

describe('CPP/QPP Benefit Calculations', () => {
  describe('calculateCPPAdjustmentFactor', () => {
    it('should return 1.0 at standard age 65', () => {
      expect(calculateCPPAdjustmentFactor(65)).toBe(1);
    });

    it('should apply 36% reduction at age 60', () => {
      // 60 months early * 0.6% = 36% reduction
      const factor = calculateCPPAdjustmentFactor(60);
      const expectedFactor = 1 - 60 * EARLY_REDUCTION_PER_MONTH;
      expect(factor).toBeCloseTo(expectedFactor, 4);
      expect(factor).toBeCloseTo(0.64, 2);
    });

    it('should apply 42% increase at age 70', () => {
      // 60 months late * 0.7% = 42% increase
      const factor = calculateCPPAdjustmentFactor(70);
      const expectedFactor = 1 + 60 * LATE_INCREASE_PER_MONTH;
      expect(factor).toBeCloseTo(expectedFactor, 4);
      expect(factor).toBeCloseTo(1.42, 2);
    });

    it('should calculate correct factor for each year between 60-64', () => {
      // Age 61: 48 months early = 28.8% reduction
      expect(calculateCPPAdjustmentFactor(61)).toBeCloseTo(1 - 48 * 0.006, 4);
      // Age 62: 36 months early = 21.6% reduction
      expect(calculateCPPAdjustmentFactor(62)).toBeCloseTo(1 - 36 * 0.006, 4);
      // Age 63: 24 months early = 14.4% reduction
      expect(calculateCPPAdjustmentFactor(63)).toBeCloseTo(1 - 24 * 0.006, 4);
      // Age 64: 12 months early = 7.2% reduction
      expect(calculateCPPAdjustmentFactor(64)).toBeCloseTo(1 - 12 * 0.006, 4);
    });

    it('should calculate correct factor for each year between 66-69', () => {
      // Age 66: 12 months late = 8.4% increase
      expect(calculateCPPAdjustmentFactor(66)).toBeCloseTo(1 + 12 * 0.007, 4);
      // Age 67: 24 months late = 16.8% increase
      expect(calculateCPPAdjustmentFactor(67)).toBeCloseTo(1 + 24 * 0.007, 4);
      // Age 68: 36 months late = 25.2% increase
      expect(calculateCPPAdjustmentFactor(68)).toBeCloseTo(1 + 36 * 0.007, 4);
      // Age 69: 48 months late = 33.6% increase
      expect(calculateCPPAdjustmentFactor(69)).toBeCloseTo(1 + 48 * 0.007, 4);
    });

    it('should throw error for age below 60', () => {
      expect(() => calculateCPPAdjustmentFactor(59)).toThrow();
      expect(() => calculateCPPAdjustmentFactor(55)).toThrow();
    });

    it('should throw error for age above 70', () => {
      expect(() => calculateCPPAdjustmentFactor(71)).toThrow();
      expect(() => calculateCPPAdjustmentFactor(75)).toThrow();
    });
  });

  describe('calculateCPPBenefit', () => {
    it('should return expected amount at age 65', () => {
      const expectedAt65 = 12000;
      const benefit = calculateCPPBenefit(expectedAt65, 65);
      expect(benefit).toBe(12000);
    });

    it('should apply reduction for early start', () => {
      const expectedAt65 = 12000;
      const benefit = calculateCPPBenefit(expectedAt65, 60);
      // 36% reduction
      expect(benefit).toBeCloseTo(12000 * 0.64, 2);
    });

    it('should apply increase for late start', () => {
      const expectedAt65 = 12000;
      const benefit = calculateCPPBenefit(expectedAt65, 70);
      // 42% increase
      expect(benefit).toBeCloseTo(12000 * 1.42, 2);
    });

    it('should handle maximum CPP amount', () => {
      const benefit = calculateCPPBenefit(MAX_CPP_AT_65, 65);
      expect(benefit).toBe(MAX_CPP_AT_65);
    });

    it('should handle zero expected amount', () => {
      const benefit = calculateCPPBenefit(0, 65);
      expect(benefit).toBe(0);
    });
  });

  describe('indexCPPBenefit', () => {
    it('should return base amount for 0 years', () => {
      expect(indexCPPBenefit(10000, 0.02, 0)).toBe(10000);
    });

    it('should apply single year of inflation', () => {
      // $10,000 with 2% inflation for 1 year
      expect(indexCPPBenefit(10000, 0.02, 1)).toBeCloseTo(10200, 2);
    });

    it('should compound inflation over multiple years', () => {
      // $10,000 with 2% inflation for 5 years
      const expected = 10000 * Math.pow(1.02, 5);
      expect(indexCPPBenefit(10000, 0.02, 5)).toBeCloseTo(expected, 2);
    });

    it('should handle high inflation rates', () => {
      // $10,000 with 5% inflation for 10 years
      const expected = 10000 * Math.pow(1.05, 10);
      expect(indexCPPBenefit(10000, 0.05, 10)).toBeCloseTo(expected, 2);
    });

    it('should handle zero inflation', () => {
      expect(indexCPPBenefit(10000, 0, 10)).toBe(10000);
    });
  });

  describe('calculateCPPSurvivorBenefit', () => {
    it('should calculate 60% of deceased benefit', () => {
      const deceasedBenefit = 10000;
      const survivorBenefit = calculateCPPSurvivorBenefit(deceasedBenefit);
      expect(survivorBenefit).toBe(6000);
    });

    it('should cap at 60% of maximum CPP', () => {
      // If deceased had maximum benefit
      const survivorBenefit = calculateCPPSurvivorBenefit(MAX_CPP_AT_65);
      expect(survivorBenefit).toBe(MAX_CPP_AT_65 * 0.6);
    });

    it('should use custom max amount if provided', () => {
      const customMax = 20000;
      const survivorBenefit = calculateCPPSurvivorBenefit(15000, customMax);
      // 60% of 15000 = 9000, max = 12000 (60% of 20000), so 9000
      expect(survivorBenefit).toBe(9000);
    });

    it('should handle zero deceased benefit', () => {
      const survivorBenefit = calculateCPPSurvivorBenefit(0);
      expect(survivorBenefit).toBe(0);
    });
  });

  describe('calculateCombinedCPP', () => {
    it('should sum own and survivor benefits', () => {
      const combined = calculateCombinedCPP(8000, 5000);
      expect(combined).toBe(13000);
    });

    it('should cap at maximum CPP amount', () => {
      const combined = calculateCombinedCPP(MAX_CPP_AT_65, 5000);
      expect(combined).toBe(MAX_CPP_AT_65);
    });

    it('should use custom max if provided', () => {
      const customMax = 18000;
      const combined = calculateCombinedCPP(12000, 10000, customMax);
      expect(combined).toBe(customMax);
    });

    it('should handle zero survivor benefit', () => {
      const combined = calculateCombinedCPP(10000, 0);
      expect(combined).toBe(10000);
    });
  });

  describe('getCPPAdjustmentTable', () => {
    it('should return table with entries for ages 60-70', () => {
      const table = getCPPAdjustmentTable(10000);
      expect(table.length).toBe(11); // 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70
      expect(table[0].age).toBe(60);
      expect(table[10].age).toBe(70);
    });

    it('should have factor 1.0 at age 65', () => {
      const table = getCPPAdjustmentTable(10000);
      const age65Entry = table.find((e) => e.age === 65);
      expect(age65Entry?.factor).toBe(1);
      expect(age65Entry?.amount).toBe(10000);
    });

    it('should have increasing amounts from 60 to 70', () => {
      const table = getCPPAdjustmentTable(10000);
      for (let i = 1; i < table.length; i++) {
        expect(table[i].amount).toBeGreaterThan(table[i - 1].amount);
      }
    });

    it('should calculate correct amounts', () => {
      const expectedAt65 = 12000;
      const table = getCPPAdjustmentTable(expectedAt65);

      const age60 = table.find((e) => e.age === 60);
      expect(age60?.amount).toBeCloseTo(12000 * 0.64, 2);

      const age70 = table.find((e) => e.age === 70);
      expect(age70?.amount).toBeCloseTo(12000 * 1.42, 2);
    });
  });

  describe('calculateCPPBreakEvenAge', () => {
    it('should calculate break-even for 60 vs 65 start', () => {
      const breakEven = calculateCPPBreakEvenAge(10000, 60, 65);
      // Starting at 60: 5 years of $6,400/year = $32,000 head start
      // Starting at 65: $10,000/year vs $6,400/year = $3,600/year difference
      // Years to catch up: $32,000 / $3,600 = ~8.9 years
      // Break-even: 65 + 8.9 = ~73.9
      expect(breakEven).toBeGreaterThan(73);
      expect(breakEven).toBeLessThan(75);
    });

    it('should calculate break-even for 65 vs 70 start', () => {
      const breakEven = calculateCPPBreakEvenAge(10000, 65, 70);
      // Starting at 65: 5 years of $10,000/year = $50,000 head start
      // Starting at 70: $14,200/year vs $10,000/year = $4,200/year difference
      // Years to catch up: $50,000 / $4,200 = ~11.9 years
      // Break-even: 70 + 11.9 = ~81.9
      expect(breakEven).toBeGreaterThan(80);
      expect(breakEven).toBeLessThan(83);
    });

    it('should calculate break-even for 60 vs 70 start', () => {
      const breakEven = calculateCPPBreakEvenAge(10000, 60, 70);
      // Starting at 60: 10 years of $6,400/year = $64,000 head start
      // Starting at 70: $14,200/year vs $6,400/year = $7,800/year difference
      // Years to catch up: $64,000 / $7,800 = ~8.2 years
      // Break-even: 70 + 8.2 = ~78.2
      expect(breakEven).toBeGreaterThan(77);
      expect(breakEven).toBeLessThan(80);
    });

    it('should return Infinity if later start never catches up', () => {
      // This shouldn't happen with normal CPP rates, but test the logic
      const breakEven = calculateCPPBreakEvenAge(10000, 70, 65);
      expect(breakEven).toBe(Infinity);
    });
  });

  describe('isEligibleForCPP', () => {
    it('should return true for age 60 and above', () => {
      expect(isEligibleForCPP(60)).toBe(true);
      expect(isEligibleForCPP(65)).toBe(true);
      expect(isEligibleForCPP(70)).toBe(true);
      expect(isEligibleForCPP(80)).toBe(true);
    });

    it('should return false for age below 60', () => {
      expect(isEligibleForCPP(59)).toBe(false);
      expect(isEligibleForCPP(50)).toBe(false);
      expect(isEligibleForCPP(0)).toBe(false);
    });
  });

  describe('isMaxDeferral', () => {
    it('should return true for age 70 and above', () => {
      expect(isMaxDeferral(70)).toBe(true);
      expect(isMaxDeferral(71)).toBe(true);
      expect(isMaxDeferral(80)).toBe(true);
    });

    it('should return false for age below 70', () => {
      expect(isMaxDeferral(69)).toBe(false);
      expect(isMaxDeferral(65)).toBe(false);
      expect(isMaxDeferral(60)).toBe(false);
    });
  });

  describe('Real-world CPP scenarios', () => {
    it('should calculate typical early retiree CPP', () => {
      // Person with 50% of max CPP starting at 60
      const expectedAt65 = MAX_CPP_AT_65 * 0.5;
      const benefit = calculateCPPBenefit(expectedAt65, 60);
      // Should be reduced by 36%
      expect(benefit).toBeCloseTo(expectedAt65 * 0.64, 2);
      expect(benefit).toBeGreaterThan(5000);
      expect(benefit).toBeLessThan(6000);
    });

    it('should calculate delayed CPP for high earner', () => {
      // Person with max CPP waiting until 70
      const benefit = calculateCPPBenefit(MAX_CPP_AT_65, 70);
      // Should be increased by 42%
      expect(benefit).toBeCloseTo(MAX_CPP_AT_65 * 1.42, 2);
      expect(benefit).toBeGreaterThan(20000);
    });

    it('should project indexed benefit over retirement', () => {
      const startingBenefit = 12000;
      const yearsInRetirement = 25;
      const inflationRate = 0.02;

      const finalBenefit = indexCPPBenefit(startingBenefit, inflationRate, yearsInRetirement);

      // After 25 years of 2% inflation
      expect(finalBenefit).toBeGreaterThan(18000);
      expect(finalBenefit).toBeLessThan(22000);
    });

    it('should calculate survivor scenario', () => {
      // Spouse passes away with $14,000 CPP benefit
      const survivorBenefit = calculateCPPSurvivorBenefit(14000);
      expect(survivorBenefit).toBe(8400); // 60% of $14,000

      // Combined with own $10,000 benefit (capped at the 2026 max CPP of $18,091.80)
      // per docs/source-of-truth/18-pensions-2026.md#2026-cpp-max-retirement-pension
      const combined = calculateCombinedCPP(10000, survivorBenefit);
      expect(combined).toBeCloseTo(18091.8, 2); // Capped at 2026 max CPP annual amount
    });

    it('A-03 regression: combined CPP defaults cap to the 2026 maximum (18091.80), not 2024 (16375)', () => {
      // A survivor whose own + survivor CPP lands between the old 2024 cap (16375)
      // and the 2026 cap (18091.80) must NOT be clipped at 16375 on the live path.
      // per docs/source-of-truth/18-pensions-2026.md#2026-cpp-max-retirement-pension
      const combined = calculateCombinedCPP(12000, 5000); // 17000 total
      expect(combined).toBe(17000); // below 2026 cap → uncapped (would have been clipped to 16375)
      expect(combined).toBeGreaterThan(16375);
    });

    it('A-03 regression: survivor benefit cap derives from the 2026 maximum', () => {
      // With a very large deceased benefit the survivor amount is capped at 60% of
      // the 2026 maximum (18091.80 × 0.6 = 10855.08), not 60% of 16375 (9825).
      // per docs/source-of-truth/18-pensions-2026.md#2026-cpp-max-retirement-pension
      const survivor = calculateCPPSurvivorBenefit(100000);
      expect(survivor).toBeCloseTo(18091.8 * 0.6, 2);
      expect(survivor).toBeCloseTo(10855.08, 2);
    });
  });
});
