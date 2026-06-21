/**
 * OAS Benefit Calculation Tests
 * @see docs/source-of-truth/05-government-benefits.md - OAS Section
 */
import { describe, it, expect } from 'vitest';
import {
  calculateOASResidencyFactor,
  calculateOASDeferralFactor,
  calculateAge75Bonus,
  calculateOASEntitlement,
  calculateOASBenefit,
  indexOASBenefit,
  getOASDeferralTable,
  calculateOASBreakEvenAge,
  isEligibleForOAS,
  isReceivingOAS,
} from './oas.js';
import { OAS_ADJUSTMENT_FACTORS } from '@retireops/shared';
import { OAS_2026 } from '@retireops/shared/benefits';

const { DEFERRAL_INCREASE_PER_MONTH } = OAS_ADJUSTMENT_FACTORS;

// Engine now consumes the citation-anchored 2026 Q2 amounts (same source as the
// wizard estimator) per docs/source-of-truth/18-pensions-2026.md#2026-oas-q2-amount-65to74.
// Annual = monthly × 12: 743.05 × 12 = 8916.60, 817.36 × 12 = 9808.32.
const MAX_OAS_65_74 = OAS_2026.q2.maxMonthlyAge65To74 * 12;
const MAX_OAS_75_PLUS = OAS_2026.q2.maxMonthlyAge75Plus * 12;

describe('OAS Benefit Calculations', () => {
  describe('calculateOASResidencyFactor', () => {
    it('should return 0 for less than 10 years residency', () => {
      expect(calculateOASResidencyFactor(0)).toBe(0);
      expect(calculateOASResidencyFactor(5)).toBe(0);
      expect(calculateOASResidencyFactor(9)).toBe(0);
    });

    it('should return 1 for 40+ years residency', () => {
      expect(calculateOASResidencyFactor(40)).toBe(1);
      expect(calculateOASResidencyFactor(50)).toBe(1);
      expect(calculateOASResidencyFactor(60)).toBe(1);
    });

    it('should calculate pro-rated factor for partial residency', () => {
      // 10 years = 10/40 = 0.25
      expect(calculateOASResidencyFactor(10)).toBeCloseTo(0.25, 2);
      // 20 years = 20/40 = 0.50
      expect(calculateOASResidencyFactor(20)).toBeCloseTo(0.5, 2);
      // 30 years = 30/40 = 0.75
      expect(calculateOASResidencyFactor(30)).toBeCloseTo(0.75, 2);
    });

    it('should handle edge cases at boundaries', () => {
      expect(calculateOASResidencyFactor(10)).toBe(0.25); // Minimum for eligibility
      expect(calculateOASResidencyFactor(39)).toBeCloseTo(0.975, 2);
    });
  });

  describe('calculateOASDeferralFactor', () => {
    it('should return 1.0 at age 65', () => {
      expect(calculateOASDeferralFactor(65)).toBe(1);
    });

    it('should apply 36% increase at age 70', () => {
      // 60 months * 0.6% = 36% increase
      const factor = calculateOASDeferralFactor(70);
      const expectedFactor = 1 + 60 * DEFERRAL_INCREASE_PER_MONTH;
      expect(factor).toBeCloseTo(expectedFactor, 4);
      expect(factor).toBeCloseTo(1.36, 2);
    });

    it('should calculate correct factor for each deferral year', () => {
      // Age 66: 12 months = 7.2% increase
      expect(calculateOASDeferralFactor(66)).toBeCloseTo(1 + 12 * 0.006, 4);
      // Age 67: 24 months = 14.4% increase
      expect(calculateOASDeferralFactor(67)).toBeCloseTo(1 + 24 * 0.006, 4);
      // Age 68: 36 months = 21.6% increase
      expect(calculateOASDeferralFactor(68)).toBeCloseTo(1 + 36 * 0.006, 4);
      // Age 69: 48 months = 28.8% increase
      expect(calculateOASDeferralFactor(69)).toBeCloseTo(1 + 48 * 0.006, 4);
    });

    it('should throw error for age below 65', () => {
      expect(() => calculateOASDeferralFactor(64)).toThrow();
      expect(() => calculateOASDeferralFactor(60)).toThrow();
    });

    it('should cap at max deferral for ages above 70', () => {
      // Ages above 70 should still return max deferral factor
      const factor70 = calculateOASDeferralFactor(70);
      const factor75 = calculateOASDeferralFactor(75);
      const factor80 = calculateOASDeferralFactor(80);
      expect(factor75).toBeCloseTo(factor70, 4);
      expect(factor80).toBeCloseTo(factor70, 4);
    });
  });

  describe('calculateAge75Bonus', () => {
    it('should return 1.0 for age under 75', () => {
      expect(calculateAge75Bonus(65)).toBe(1);
      expect(calculateAge75Bonus(70)).toBe(1);
      expect(calculateAge75Bonus(74)).toBe(1);
    });

    it('should return 1.10 for age 75+', () => {
      expect(calculateAge75Bonus(75)).toBeCloseTo(1.1, 2);
      expect(calculateAge75Bonus(80)).toBeCloseTo(1.1, 2);
      expect(calculateAge75Bonus(90)).toBeCloseTo(1.1, 2);
    });
  });

  describe('calculateOASEntitlement', () => {
    it('should return 0 for ineligible residency', () => {
      expect(calculateOASEntitlement(5, 2024, 65)).toBe(0);
    });

    it('should return full amount for 40+ years residency', () => {
      expect(calculateOASEntitlement(40, 2024, 65)).toBe(MAX_OAS_65_74);
    });

    it('should return partial amount for partial residency', () => {
      // 20 years = 50% of max
      expect(calculateOASEntitlement(20, 2024, 65)).toBeCloseTo(MAX_OAS_65_74 * 0.5, 2);
    });

    it('should return higher base for age 75+', () => {
      const entitlement65 = calculateOASEntitlement(40, 2024, 65);
      const entitlement75 = calculateOASEntitlement(40, 2024, 75);
      expect(entitlement75).toBeGreaterThan(entitlement65);
      expect(entitlement75).toBe(MAX_OAS_75_PLUS);
    });

    it('should use the 2026 Q2 anchored age 65-74 amount', () => {
      // per docs/source-of-truth/18-pensions-2026.md#2026-oas-q2-amount-65to74
      expect(calculateOASEntitlement(40, 2026, 65)).toBeCloseTo(MAX_OAS_65_74, 6);
      expect(calculateOASEntitlement(40, 2026, 65)).toBeCloseTo(8916.6, 2);
    });

    it('should use the 2026 Q2 anchored age 75+ amount', () => {
      // per docs/source-of-truth/18-pensions-2026.md#2026-oas-q2-amount-75plus
      expect(calculateOASEntitlement(40, 2026, 75)).toBeCloseTo(MAX_OAS_75_PLUS, 6);
      expect(calculateOASEntitlement(40, 2026, 75)).toBeCloseTo(9808.32, 2);
    });

    it('should fall back to the nearest known table for years before 2026', () => {
      // The year-indexed structure falls back to the earliest known table (2026)
      // for out-of-range earlier years; mainline projections are always >= 2026.
      expect(calculateOASEntitlement(40, 2024, 65)).toBeCloseTo(MAX_OAS_65_74, 6);
      expect(calculateOASEntitlement(40, 2025, 65)).toBeCloseTo(MAX_OAS_65_74, 6);
    });
  });

  describe('calculateOASBenefit', () => {
    it('should return 0 for ineligible residency', () => {
      expect(calculateOASBenefit(5, 65, 65)).toBe(0);
    });

    it('should return base amount for full residency at 65', () => {
      const benefit = calculateOASBenefit(40, 65, 65);
      expect(benefit).toBeCloseTo(MAX_OAS_65_74, 2);
    });

    it('should apply deferral increase', () => {
      const benefit = calculateOASBenefit(40, 70, 70);
      // 36% increase for 5 year deferral
      expect(benefit).toBeCloseTo(MAX_OAS_65_74 * 1.36, 2);
    });

    it('should use the age 75+ base amount without applying a second top-up', () => {
      const benefit65 = calculateOASBenefit(40, 65, 65);
      const benefit75 = calculateOASBenefit(40, 65, 75);
      expect(benefit65).toBe(MAX_OAS_65_74);
      expect(benefit75).toBe(MAX_OAS_75_PLUS);
    });

    it('should combine residency and deferral using the age 75+ base amount only once', () => {
      // 20 years residency (50%), deferred to 70 (36%), at age 75
      const benefit = calculateOASBenefit(20, 70, 75);
      const expectedBase = MAX_OAS_75_PLUS * 0.5; // 50% residency, 75+ base
      const withDeferral = expectedBase * 1.36; // 36% deferral
      expect(benefit).toBeCloseTo(withDeferral, 2);
    });
  });

  describe('indexOASBenefit', () => {
    it('should return base amount for 0 years', () => {
      expect(indexOASBenefit(8000, 0.02, 0)).toBe(8000);
    });

    it('should apply single year of inflation', () => {
      expect(indexOASBenefit(8000, 0.02, 1)).toBeCloseTo(8160, 2);
    });

    it('should compound inflation over multiple years', () => {
      const expected = 8000 * Math.pow(1.02, 10);
      expect(indexOASBenefit(8000, 0.02, 10)).toBeCloseTo(expected, 2);
    });
  });

  describe('getOASDeferralTable', () => {
    it('should return table with entries for ages 65-70', () => {
      const table = getOASDeferralTable(40);
      expect(table.length).toBe(6); // 65, 66, 67, 68, 69, 70
      expect(table[0].age).toBe(65);
      expect(table[5].age).toBe(70);
    });

    it('should have factor 1.0 at age 65', () => {
      const table = getOASDeferralTable(40);
      const age65Entry = table.find((e) => e.age === 65);
      expect(age65Entry?.factor).toBe(1);
    });

    it('should have increasing amounts', () => {
      const table = getOASDeferralTable(40);
      for (let i = 1; i < table.length; i++) {
        expect(table[i].amount).toBeGreaterThan(table[i - 1].amount);
      }
    });

    it('should reflect residency in amounts', () => {
      const tableFull = getOASDeferralTable(40);
      const tableHalf = getOASDeferralTable(20);

      // Half residency should have half the amounts
      expect(tableHalf[0].amount).toBeCloseTo(tableFull[0].amount * 0.5, 2);
    });
  });

  describe('calculateOASBreakEvenAge', () => {
    it('should calculate break-even for 65 vs 70 start', () => {
      const breakEven = calculateOASBreakEvenAge(40, 65, 70);
      // Starting at 65: 5 years of ~$8,560/year = ~$42,800 head start
      // Starting at 70: $11,642/year vs $8,560/year = ~$3,082/year difference
      // Years to catch up: $42,800 / $3,082 = ~13.9 years
      // Break-even: 70 + 13.9 = ~83.9
      expect(breakEven).toBeGreaterThan(82);
      expect(breakEven).toBeLessThan(86);
    });

    it('should return Infinity if later start never catches up', () => {
      // This tests the edge case where early start is preferred
      const breakEven = calculateOASBreakEvenAge(40, 70, 65);
      expect(breakEven).toBe(Infinity);
    });

    it('should work with partial residency', () => {
      const breakEvenFull = calculateOASBreakEvenAge(40, 65, 70);
      const breakEvenHalf = calculateOASBreakEvenAge(20, 65, 70);
      // Break-even age should be the same regardless of residency
      // (proportional amounts don't change the ratio)
      expect(breakEvenHalf).toBeCloseTo(breakEvenFull, 1);
    });
  });

  describe('isEligibleForOAS', () => {
    it('should return true for age 65+ with sufficient residency', () => {
      expect(isEligibleForOAS(65, 10)).toBe(true);
      expect(isEligibleForOAS(70, 40)).toBe(true);
      expect(isEligibleForOAS(80, 25)).toBe(true);
    });

    it('should return false for age under 65', () => {
      expect(isEligibleForOAS(64, 40)).toBe(false);
      expect(isEligibleForOAS(60, 40)).toBe(false);
    });

    it('should return false for insufficient residency', () => {
      expect(isEligibleForOAS(65, 9)).toBe(false);
      expect(isEligibleForOAS(70, 5)).toBe(false);
    });

    it('should return false for both conditions unmet', () => {
      expect(isEligibleForOAS(64, 5)).toBe(false);
    });
  });

  describe('isReceivingOAS', () => {
    it('should return true when current age >= start age', () => {
      expect(isReceivingOAS(65, 65)).toBe(true);
      expect(isReceivingOAS(70, 65)).toBe(true);
      expect(isReceivingOAS(68, 68)).toBe(true);
    });

    it('should return false when current age < start age', () => {
      expect(isReceivingOAS(64, 65)).toBe(false);
      expect(isReceivingOAS(67, 70)).toBe(false);
    });
  });

  describe('Real-world OAS scenarios', () => {
    it('should calculate typical Canadian retiree OAS', () => {
      // Born in Canada, lived entire life there, starts at 65
      const benefit = calculateOASBenefit(40, 65, 65);
      expect(benefit).toBe(MAX_OAS_65_74);
      expect(benefit).toBeGreaterThan(8000);
      expect(benefit).toBeLessThan(9000);
    });

    it('A-01 regression: 2026 single-person gross OAS equals OAS_2026.q2 × 12', () => {
      // Engine and wizard must agree on gross OAS for the same person.
      // per docs/source-of-truth/18-pensions-2026.md#2026-oas-q2-amount-65to74
      const grossOAS = calculateOASBenefit(40, 65, 65, 2026);
      expect(grossOAS).toBeCloseTo(OAS_2026.q2.maxMonthlyAge65To74 * 12, 6);
      expect(grossOAS).toBeCloseTo(8916.6, 2);
    });

    it('A-01 regression: 2026 age-75+ gross OAS equals OAS_2026.q2 75+ × 12', () => {
      // per docs/source-of-truth/18-pensions-2026.md#2026-oas-q2-amount-75plus
      const grossOAS75 = calculateOASBenefit(40, 65, 75, 2026);
      expect(grossOAS75).toBeCloseTo(OAS_2026.q2.maxMonthlyAge75Plus * 12, 6);
      expect(grossOAS75).toBeCloseTo(9808.32, 2);
    });

    it('should calculate immigrant with partial residency', () => {
      // Immigrant with 25 years in Canada
      const benefit = calculateOASBenefit(25, 65, 65);
      expect(benefit).toBeCloseTo(MAX_OAS_65_74 * 0.625, 2);
    });

    it('should calculate deferred OAS for someone who delayed', () => {
      // Waited until 70 to maximize benefits
      const benefit = calculateOASBenefit(40, 70, 70);
      expect(benefit).toBeCloseTo(MAX_OAS_65_74 * 1.36, 2);
      expect(benefit).toBeGreaterThan(11000);
    });

    it('should calculate OAS for 80-year-old who deferred', () => {
      // Started at 70, now 80
      const benefit = calculateOASBenefit(40, 70, 80);
      // Base at 75+ with deferral only; the 75+ amount already includes the top-up
      const expectedBase = MAX_OAS_75_PLUS;
      const withDeferral = expectedBase * 1.36;
      expect(benefit).toBeCloseTo(withDeferral, 2);
    });

    it('should project indexed OAS over retirement', () => {
      const startingBenefit = 8560;
      const yearsInRetirement = 20;
      const inflationRate = 0.02;

      const finalBenefit = indexOASBenefit(startingBenefit, inflationRate, yearsInRetirement);

      // After 20 years of 2% inflation
      expect(finalBenefit).toBeGreaterThan(12000);
      expect(finalBenefit).toBeLessThan(14000);
    });

    it('should show value of maximum deferral', () => {
      const atAge65 = calculateOASBenefit(40, 65, 65);
      const atAge70 = calculateOASBenefit(40, 70, 70);

      // 36% increase for waiting 5 years
      expect((atAge70 - atAge65) / atAge65).toBeCloseTo(0.36, 2);
    });
  });
});
