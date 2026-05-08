/**
 * Provincial Tax Calculation Tests
 * @see docs/source-of-truth/04-tax-engine.md
 */
import { describe, it, expect, test } from 'vitest';
import {
  getProvincialTaxBrackets,
  getProvincialBasicPersonalAmount,
  getProvincialCreditRate,
  calculateProvincialTaxBeforeCredits,
  calculateOntarioSurtax,
  calculateProvincialBPACredit,
  calculateProvincialAgeCredit,
  calculateProvincialPensionCredit,
  calculateProvincialTax,
  getProvincialMarginalRate,
  getCombinedMarginalRate,
} from './provincial-tax.js';
import {
  ONTARIO_TAX_2024,
  ONTARIO_TAX_2025,
  BC_TAX_2024,
  BC_TAX_2025,
  ALBERTA_TAX_2024,
  ALBERTA_TAX_2025,
  QUEBEC_TAX_2024,
  type ProvinceCode,
} from '@retireops/shared';

describe('Provincial Tax Calculations', () => {
  describe('getProvincialTaxBrackets', () => {
    it('should return Ontario brackets', () => {
      const brackets = getProvincialTaxBrackets('ON', 2024);
      expect(brackets).toEqual(ONTARIO_TAX_2024.brackets);
    });

    it('should return BC brackets', () => {
      const brackets = getProvincialTaxBrackets('BC', 2024);
      expect(brackets).toEqual(BC_TAX_2024.brackets);
    });

    it('should return Alberta brackets', () => {
      const brackets = getProvincialTaxBrackets('AB', 2024);
      expect(brackets).toEqual(ALBERTA_TAX_2024.brackets);
    });

    it('should return Quebec brackets', () => {
      const brackets = getProvincialTaxBrackets('QC', 2024);
      expect(brackets).toEqual(QUEBEC_TAX_2024.brackets);
    });

    it('should throw error for invalid province', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      expect(() => getProvincialTaxBrackets('XX' as any, 2024)).toThrow();
    });
  });

  describe('getProvincialBasicPersonalAmount', () => {
    it('should return Ontario BPA', () => {
      expect(getProvincialBasicPersonalAmount('ON', 2024)).toBe(12399);
    });

    it('should return BC BPA', () => {
      expect(getProvincialBasicPersonalAmount('BC', 2024)).toBe(12580);
    });

    it('should return Alberta BPA', () => {
      expect(getProvincialBasicPersonalAmount('AB', 2024)).toBe(21003);
    });

    it('should return Quebec BPA', () => {
      expect(getProvincialBasicPersonalAmount('QC', 2024)).toBe(18056);
    });
  });

  describe('getProvincialCreditRate', () => {
    it('should return Ontario lowest bracket rate', () => {
      expect(getProvincialCreditRate('ON')).toBe(0.0505);
    });

    it('should return BC lowest bracket rate', () => {
      expect(getProvincialCreditRate('BC')).toBe(0.0506);
    });

    it('should return Alberta lowest bracket rate', () => {
      expect(getProvincialCreditRate('AB')).toBe(0.1);
    });
  });

  describe('calculateProvincialTaxBeforeCredits', () => {
    it('should calculate Ontario tax for income in first bracket', () => {
      const tax = calculateProvincialTaxBeforeCredits(40000, 'ON', 2024);
      expect(tax).toBeCloseTo(40000 * 0.0505, 2);
    });

    it('should calculate Ontario tax spanning brackets', () => {
      const tax = calculateProvincialTaxBeforeCredits(80000, 'ON', 2024);
      const expected = 51446 * 0.0505 + (80000 - 51446) * 0.0915;
      expect(tax).toBeCloseTo(expected, 2);
    });

    it('should calculate Alberta tax (flat rate in first bracket)', () => {
      const tax = calculateProvincialTaxBeforeCredits(100000, 'AB', 2024);
      expect(tax).toBeCloseTo(100000 * 0.1, 2);
    });
  });

  describe('calculateOntarioSurtax', () => {
    it('should return 0 for tax below tier 1 threshold', () => {
      const surtax = calculateOntarioSurtax(5000);
      expect(surtax).toBe(0);
    });

    it('should calculate tier 1 surtax only', () => {
      // Tax = $6,000, above tier 1 ($5,554) but below tier 2 ($7,108)
      const surtax = calculateOntarioSurtax(6000);
      const expected = (6000 - 5554) * 0.2;
      expect(surtax).toBeCloseTo(expected, 2);
    });

    it('should calculate both tier 1 and tier 2 surtax', () => {
      // Tax = $8,000, above both thresholds
      const surtax = calculateOntarioSurtax(8000);
      const tier1 = (8000 - 5554) * 0.2;
      const tier2 = (8000 - 7108) * 0.36;
      expect(surtax).toBeCloseTo(tier1 + tier2, 2);
    });

    it('should calculate surtax for high tax amount', () => {
      const surtax = calculateOntarioSurtax(15000);
      const tier1 = (15000 - 5554) * 0.2;
      const tier2 = (15000 - 7108) * 0.36;
      expect(surtax).toBeCloseTo(tier1 + tier2, 2);
    });
  });

  describe('calculateProvincialBPACredit', () => {
    it('should calculate Ontario BPA credit', () => {
      const credit = calculateProvincialBPACredit('ON', 2024);
      expect(credit).toBeCloseTo(12399 * 0.0505, 2);
    });

    it('should calculate Alberta BPA credit', () => {
      const credit = calculateProvincialBPACredit('AB', 2024);
      expect(credit).toBeCloseTo(21003 * 0.1, 2);
    });
  });

  describe('calculateProvincialAgeCredit', () => {
    it('should return 0 for age under 65', () => {
      expect(calculateProvincialAgeCredit(64, 50000, 'ON', 2024)).toBe(0);
    });

    it('should calculate Ontario age credit for 65+', () => {
      const credit = calculateProvincialAgeCredit(65, 30000, 'ON', 2024);
      // Ontario age amount = $6,026, threshold = $44,325
      // Low income = full credit = $6,026 * 0.0505
      expect(credit).toBeCloseTo(6026 * 0.0505, 2);
    });

    it('should reduce age credit for higher income', () => {
      const credit = calculateProvincialAgeCredit(65, 50000, 'ON', 2024);
      // Reduction applies
      const reduction = (50000 - 44325) * 0.15;
      const netAge = Math.max(0, 6026 - reduction);
      expect(credit).toBeCloseTo(netAge * 0.0505, 2);
    });
  });

  describe('calculateProvincialPensionCredit', () => {
    it('should return 0 for no pension income', () => {
      expect(calculateProvincialPensionCredit(0, 'ON', 2024)).toBe(0);
    });

    it('should calculate Ontario pension credit', () => {
      const credit = calculateProvincialPensionCredit(1671, 'ON', 2024);
      expect(credit).toBeCloseTo(1671 * 0.0505, 2);
    });

    it('should cap Ontario pension credit at max amount', () => {
      const credit = calculateProvincialPensionCredit(5000, 'ON', 2024);
      expect(credit).toBeCloseTo(1671 * 0.0505, 2);
    });
  });

  describe('calculateProvincialTax', () => {
    it('should return 0 for income below BPA', () => {
      const tax = calculateProvincialTax(10000, 40, 10000, 0, 'ON', 2024);
      expect(tax).toBe(0);
    });

    it('should include Ontario surtax for high income', () => {
      const taxON = calculateProvincialTax(200000, 50, 200000, 0, 'ON', 2024);
      const taxBC = calculateProvincialTax(200000, 50, 200000, 0, 'BC', 2024);
      // Both should be positive for high income
      expect(taxON).toBeGreaterThan(0);
      expect(taxBC).toBeGreaterThan(0);
    });

    it('should never return negative tax', () => {
      const tax = calculateProvincialTax(5000, 70, 5000, 2000, 'ON', 2024);
      expect(tax).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getProvincialMarginalRate', () => {
    it('should return Ontario first bracket rate', () => {
      expect(getProvincialMarginalRate(40000, 'ON', 2024)).toBe(0.0505);
    });

    it('should return Ontario second bracket rate', () => {
      expect(getProvincialMarginalRate(60000, 'ON', 2024)).toBe(0.0915);
    });

    it('should return Alberta flat rate for low income', () => {
      expect(getProvincialMarginalRate(100000, 'AB', 2024)).toBe(0.1);
    });

    it('should return BC top bracket rate', () => {
      expect(getProvincialMarginalRate(200000, 'BC', 2024)).toBe(0.205);
    });
  });

  describe('getCombinedMarginalRate', () => {
    it('should combine federal and provincial rates for Ontario', () => {
      const combined = getCombinedMarginalRate(50000, 'ON', 2024);
      // Federal 15% + Ontario 5.05% = 20.05%
      expect(combined).toBeCloseTo(0.15 + 0.0505, 4);
    });

    it('should combine federal and provincial rates for Alberta', () => {
      const combined = getCombinedMarginalRate(100000, 'AB', 2024);
      // Federal 20.5% + Alberta 10% = 30.5%
      expect(combined).toBeCloseTo(0.205 + 0.1, 4);
    });
  });

  describe('Provincial tax comparisons', () => {
    it('should show differences between provinces', () => {
      const taxON = calculateProvincialTax(80000, 40, 80000, 0, 'ON', 2024);
      const taxAB = calculateProvincialTax(80000, 40, 80000, 0, 'AB', 2024);
      // Both should be positive
      expect(taxON).toBeGreaterThan(0);
      expect(taxAB).toBeGreaterThan(0);
      // They may differ due to different rate structures and credits
    });

    it('should show Quebec has higher tax than Ontario for same income', () => {
      const taxON = calculateProvincialTax(100000, 40, 100000, 0, 'ON', 2024);
      const taxQC = calculateProvincialTax(100000, 40, 100000, 0, 'QC', 2024);
      // Quebec generally has higher provincial rates
      expect(taxQC).toBeGreaterThan(taxON);
    });
  });

  describe('Real-world provincial tax scenarios (2024)', () => {
    it('should calculate reasonable Ontario tax for $60,000 income', () => {
      const tax = calculateProvincialTax(60000, 40, 60000, 0, 'ON', 2024);
      // Approximate expected: $3,000 - $4,000
      expect(tax).toBeGreaterThan(2500);
      expect(tax).toBeLessThan(4500);
    });

    it('should calculate reasonable BC tax for $75,000 income', () => {
      const tax = calculateProvincialTax(75000, 40, 75000, 0, 'BC', 2024);
      // Approximate expected: $3,500 - $5,000
      expect(tax).toBeGreaterThan(3000);
      expect(tax).toBeLessThan(5500);
    });

    it('should calculate reasonable Alberta tax for $90,000 income', () => {
      const tax = calculateProvincialTax(90000, 40, 90000, 0, 'AB', 2024);
      // At 10% flat rate minus BPA credit: ~$6,900
      expect(tax).toBeGreaterThan(5500);
      expect(tax).toBeLessThan(8000);
    });
  });

  describe('2025 Provincial Tax Tables', () => {
    it('should return Ontario 2025 brackets for year 2025', () => {
      const brackets = getProvincialTaxBrackets('ON', 2025);
      expect(brackets).toEqual(ONTARIO_TAX_2025.brackets);
    });

    it('should return BC 2025 brackets for year 2025', () => {
      const brackets = getProvincialTaxBrackets('BC', 2025);
      expect(brackets).toEqual(BC_TAX_2025.brackets);
    });

    it('should return Alberta 2025 brackets for year 2025', () => {
      const brackets = getProvincialTaxBrackets('AB', 2025);
      expect(brackets).toEqual(ALBERTA_TAX_2025.brackets);
    });

    it('should return 2025 BPA for Ontario', () => {
      expect(getProvincialBasicPersonalAmount('ON', 2025)).toBe(12734);
    });

    it('should return 2025 BPA for BC', () => {
      expect(getProvincialBasicPersonalAmount('BC', 2025)).toBe(12920);
    });

    it('should return 2025 BPA for Alberta', () => {
      expect(getProvincialBasicPersonalAmount('AB', 2025)).toBe(21570);
    });

    it('should calculate Ontario 2025 tax higher bracket thresholds', () => {
      // 2025 first bracket goes up to $52,835 (vs $51,446 in 2024)
      const tax2024 = calculateProvincialTaxBeforeCredits(52000, 'ON', 2024);
      const tax2025 = calculateProvincialTaxBeforeCredits(52000, 'ON', 2025);
      // In 2024, $52,000 spans brackets; in 2025, all in first bracket
      expect(tax2025).toBeLessThan(tax2024);
    });

    it('should show inflation indexing benefit for taxpayers', () => {
      // Same nominal income should result in slightly lower tax in 2025 due to indexing
      const tax2024 = calculateProvincialTax(80000, 40, 80000, 0, 'ON', 2024);
      const tax2025 = calculateProvincialTax(80000, 40, 80000, 0, 'ON', 2025);
      // 2025 tax should be slightly lower due to higher brackets and BPA
      expect(tax2025).toBeLessThan(tax2024);
    });
  });

  /**
   * Territory tax tables (D-01, D-02)
   * @see docs/source-of-truth/04-tax-engine.md - TAX-CA-01
   */
  describe('all 13 jurisdictions — TAX-CA-01', () => {
    const ALL_PROVINCE_CODES: ProvinceCode[] = [
      'ON',
      'BC',
      'AB',
      'QC',
      'SK',
      'MB',
      'NS',
      'NB',
      'PE',
      'NL',
      'YT',
      'NT',
      'NU',
    ];

    test.each(ALL_PROVINCE_CODES)(
      '%s: getProvincialTaxBrackets returns non-empty array for 2024',
      (code) => {
        const brackets = getProvincialTaxBrackets(code, 2024);
        expect(brackets).toBeDefined();
        expect(brackets.length).toBeGreaterThan(0);
      }
    );

    test.each(ALL_PROVINCE_CODES)(
      '%s: getProvincialTaxBrackets returns non-empty array for 2025',
      (code) => {
        const brackets = getProvincialTaxBrackets(code, 2025);
        expect(brackets).toBeDefined();
        expect(brackets.length).toBeGreaterThan(0);
      }
    );
  });

  describe('territory brackets — D-01', () => {
    it('should return Yukon 2024 brackets with 5 entries and first rate 0.064', () => {
      const brackets = getProvincialTaxBrackets('YT', 2024);
      expect(brackets).toHaveLength(5);
      expect(brackets[0]?.rate).toBe(0.064);
    });

    it('should return NWT 2024 brackets with 4 entries and first rate 0.059', () => {
      const brackets = getProvincialTaxBrackets('NT', 2024);
      expect(brackets).toHaveLength(4);
      expect(brackets[0]?.rate).toBe(0.059);
    });

    it('should return Nunavut 2024 brackets with 4 entries and first rate 0.04', () => {
      const brackets = getProvincialTaxBrackets('NU', 2024);
      expect(brackets).toHaveLength(4);
      expect(brackets[0]?.rate).toBe(0.04);
    });

    it('should return Yukon 2025 brackets with 5 entries', () => {
      const brackets = getProvincialTaxBrackets('YT', 2025);
      expect(brackets).toHaveLength(5);
    });

    it('should return NWT 2025 brackets with 4 entries', () => {
      const brackets = getProvincialTaxBrackets('NT', 2025);
      expect(brackets).toHaveLength(4);
    });

    it('should return Nunavut 2025 brackets with 4 entries', () => {
      const brackets = getProvincialTaxBrackets('NU', 2025);
      expect(brackets).toHaveLength(4);
    });
  });

  describe('territory BPA — D-01', () => {
    it('should return Yukon 2024 BPA of 15705', () => {
      expect(getProvincialBasicPersonalAmount('YT', 2024)).toBe(15705);
    });

    it('should return NWT 2024 BPA of 16593', () => {
      expect(getProvincialBasicPersonalAmount('NT', 2024)).toBe(16593);
    });

    it('should return Nunavut 2024 BPA of 17925', () => {
      expect(getProvincialBasicPersonalAmount('NU', 2024)).toBe(17925);
    });
  });

  describe('2025 table completeness — D-06', () => {
    it('Quebec 2025 brackets differ from 2024', () => {
      const b2024 = getProvincialTaxBrackets('QC', 2024);
      const b2025 = getProvincialTaxBrackets('QC', 2025);
      // 2025 first bracket max is 53255 vs 51780 in 2024
      expect(b2025[0]?.max).not.toBe(b2024[0]?.max);
    });

    it('Saskatchewan 2025 brackets differ from 2024', () => {
      const b2024 = getProvincialTaxBrackets('SK', 2024);
      const b2025 = getProvincialTaxBrackets('SK', 2025);
      expect(b2025[0]?.max).not.toBe(b2024[0]?.max);
    });

    it('Manitoba 2025 brackets are identical to 2024 (frozen per provincial budget)', () => {
      const b2024 = getProvincialTaxBrackets('MB', 2024);
      const b2025 = getProvincialTaxBrackets('MB', 2025);
      expect(b2025).toEqual(b2024);
    });

    it('Nova Scotia 2025 brackets differ from 2024', () => {
      const b2024 = getProvincialTaxBrackets('NS', 2024);
      const b2025 = getProvincialTaxBrackets('NS', 2025);
      expect(b2025[0]?.max).not.toBe(b2024[0]?.max);
    });

    it('New Brunswick 2025 brackets differ from 2024', () => {
      const b2024 = getProvincialTaxBrackets('NB', 2024);
      const b2025 = getProvincialTaxBrackets('NB', 2025);
      expect(b2025[0]?.max).not.toBe(b2024[0]?.max);
    });

    it('PEI 2025 brackets differ from 2024', () => {
      const b2024 = getProvincialTaxBrackets('PE', 2024);
      const b2025 = getProvincialTaxBrackets('PE', 2025);
      expect(b2025[0]?.max).not.toBe(b2024[0]?.max);
    });

    it('Newfoundland 2025 brackets differ from 2024 (extra high-income brackets)', () => {
      const b2024 = getProvincialTaxBrackets('NL', 2024);
      const b2025 = getProvincialTaxBrackets('NL', 2025);
      // 2025 NL has 8 brackets vs 7 in 2024
      expect(b2025.length).toBeGreaterThan(b2024.length);
    });
  });

  describe('provincial tax smoke — territories', () => {
    it('should compute positive YT tax for $80,000 income at age 40', () => {
      const tax = calculateProvincialTax(80000, 40, 80000, 0, 'YT', 2024);
      expect(tax).toBeGreaterThan(0);
    });

    it('should compute positive NT tax for $80,000 income at age 40', () => {
      const tax = calculateProvincialTax(80000, 40, 80000, 0, 'NT', 2024);
      expect(tax).toBeGreaterThan(0);
    });

    it('should compute positive NU tax for $80,000 income at age 40', () => {
      const tax = calculateProvincialTax(80000, 40, 80000, 0, 'NU', 2024);
      expect(tax).toBeGreaterThan(0);
    });
  });
});
