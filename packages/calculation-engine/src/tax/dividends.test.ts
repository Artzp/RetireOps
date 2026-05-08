/**
 * Dividend Tax Calculation Tests
 * @see docs/source-of-truth/04-tax-engine.md - Dividend Tax Treatment
 */
import { describe, it, expect } from 'vitest';
import {
  grossUpEligibleDividend,
  grossUpNonEligibleDividend,
  calculateEligibleDividendCredit,
  calculateNonEligibleDividendCredit,
  calculateTaxableDividendIncome,
  calculateTotalDividendTaxCredits,
  calculateDividendTaxImpact,
  calculateProvincialDividendCredit,
} from './dividends.js';
import { DIVIDEND_RATES } from '@retireops/shared';

describe('Dividend Tax Calculations', () => {
  describe('grossUpEligibleDividend', () => {
    it('should gross up eligible dividend by 38%', () => {
      // $1,000 dividend becomes $1,380
      const grossedUp = grossUpEligibleDividend(1000);
      expect(grossedUp).toBe(1000 * 1.38);
    });

    it('should return 0 for zero dividend', () => {
      expect(grossUpEligibleDividend(0)).toBe(0);
    });

    it('should handle large dividends', () => {
      const grossedUp = grossUpEligibleDividend(50000);
      expect(grossedUp).toBe(69000);
    });
  });

  describe('grossUpNonEligibleDividend', () => {
    it('should gross up non-eligible dividend by 15%', () => {
      // $1,000 dividend becomes $1,150
      const grossedUp = grossUpNonEligibleDividend(1000);
      expect(grossedUp).toBe(1000 * 1.15);
    });

    it('should return 0 for zero dividend', () => {
      expect(grossUpNonEligibleDividend(0)).toBe(0);
    });

    it('should handle large dividends', () => {
      const grossedUp = grossUpNonEligibleDividend(50000);
      expect(grossedUp).toBeCloseTo(57500, 0);
    });
  });

  describe('calculateEligibleDividendCredit', () => {
    it('should calculate credit at ~15.02% of grossed-up amount', () => {
      const grossedUp = 1380; // From $1,000 eligible dividend
      const credit = calculateEligibleDividendCredit(grossedUp);
      expect(credit).toBeCloseTo(grossedUp * DIVIDEND_RATES.eligibleFederalCredit, 2);
    });

    it('should return 0 for zero grossed-up amount', () => {
      expect(calculateEligibleDividendCredit(0)).toBe(0);
    });
  });

  describe('calculateNonEligibleDividendCredit', () => {
    it('should calculate credit at ~9.03% of grossed-up amount', () => {
      const grossedUp = 1150; // From $1,000 non-eligible dividend
      const credit = calculateNonEligibleDividendCredit(grossedUp);
      expect(credit).toBeCloseTo(grossedUp * DIVIDEND_RATES.nonEligibleFederalCredit, 2);
    });

    it('should return 0 for zero grossed-up amount', () => {
      expect(calculateNonEligibleDividendCredit(0)).toBe(0);
    });
  });

  describe('calculateTaxableDividendIncome', () => {
    it('should calculate total taxable from eligible dividends only', () => {
      const taxable = calculateTaxableDividendIncome(10000, 0);
      expect(taxable).toBe(10000 * 1.38);
    });

    it('should calculate total taxable from non-eligible dividends only', () => {
      const taxable = calculateTaxableDividendIncome(0, 10000);
      expect(taxable).toBe(10000 * 1.15);
    });

    it('should combine both dividend types', () => {
      const taxable = calculateTaxableDividendIncome(10000, 5000);
      const expected = 10000 * 1.38 + 5000 * 1.15;
      expect(taxable).toBe(expected);
    });

    it('should return 0 for no dividends', () => {
      expect(calculateTaxableDividendIncome(0, 0)).toBe(0);
    });
  });

  describe('calculateTotalDividendTaxCredits', () => {
    it('should calculate total credits for eligible dividends only', () => {
      const credits = calculateTotalDividendTaxCredits(10000, 0);
      const grossedUp = 10000 * 1.38;
      const expectedCredit = grossedUp * DIVIDEND_RATES.eligibleFederalCredit;
      expect(credits).toBeCloseTo(expectedCredit, 2);
    });

    it('should calculate total credits for non-eligible dividends only', () => {
      const credits = calculateTotalDividendTaxCredits(0, 10000);
      const grossedUp = 10000 * 1.15;
      const expectedCredit = grossedUp * DIVIDEND_RATES.nonEligibleFederalCredit;
      expect(credits).toBeCloseTo(expectedCredit, 2);
    });

    it('should combine credits from both dividend types', () => {
      const credits = calculateTotalDividendTaxCredits(10000, 5000);

      const eligibleGrossedUp = 10000 * 1.38;
      const nonEligibleGrossedUp = 5000 * 1.15;
      const expectedEligibleCredit = eligibleGrossedUp * DIVIDEND_RATES.eligibleFederalCredit;
      const expectedNonEligibleCredit =
        nonEligibleGrossedUp * DIVIDEND_RATES.nonEligibleFederalCredit;

      expect(credits).toBeCloseTo(expectedEligibleCredit + expectedNonEligibleCredit, 2);
    });

    it('should return 0 for no dividends', () => {
      expect(calculateTotalDividendTaxCredits(0, 0)).toBe(0);
    });
  });

  describe('calculateDividendTaxImpact', () => {
    it('should calculate complete impact for eligible dividends', () => {
      const result = calculateDividendTaxImpact(10000, 0, 0.4);

      expect(result.actualDividends).toBe(10000);
      expect(result.grossedUpAmount).toBeCloseTo(13800, 0);

      // Tax on $13,800 at 40% = $5,520
      // Credit = $13,800 * 0.150198 = $2,072.73
      // Net impact = $5,520 - $2,072.73 = $3,447.27
      const expectedGrossTax = 13800 * 0.4;
      const expectedCredit = 13800 * DIVIDEND_RATES.eligibleFederalCredit;
      expect(result.federalTaxCredit).toBeCloseTo(expectedCredit, 2);
      expect(result.netTaxImpact).toBeCloseTo(expectedGrossTax - expectedCredit, 2);
    });

    it('should calculate complete impact for non-eligible dividends', () => {
      const result = calculateDividendTaxImpact(0, 10000, 0.3);

      expect(result.actualDividends).toBe(10000);
      expect(result.grossedUpAmount).toBe(11500);

      const expectedGrossTax = 11500 * 0.3;
      const expectedCredit = 11500 * DIVIDEND_RATES.nonEligibleFederalCredit;
      expect(result.netTaxImpact).toBeCloseTo(expectedGrossTax - expectedCredit, 2);
    });

    it('should calculate complete impact for mixed dividends', () => {
      const result = calculateDividendTaxImpact(8000, 2000, 0.35);

      expect(result.actualDividends).toBe(10000);
      expect(result.grossedUpAmount).toBe(8000 * 1.38 + 2000 * 1.15);
    });

    it('should show lower effective rate for eligible vs non-eligible', () => {
      // $10,000 of each type at 30% marginal rate
      const eligibleResult = calculateDividendTaxImpact(10000, 0, 0.3);
      const nonEligibleResult = calculateDividendTaxImpact(0, 10000, 0.3);

      // Eligible dividends should have lower net tax impact per dollar
      const eligibleEffectiveRate = eligibleResult.netTaxImpact / 10000;
      const nonEligibleEffectiveRate = nonEligibleResult.netTaxImpact / 10000;

      expect(eligibleEffectiveRate).toBeLessThan(nonEligibleEffectiveRate);
    });
  });

  describe('Real-world dividend scenarios', () => {
    it('should show tax advantage of Canadian eligible dividends', () => {
      // $20,000 eligible dividends at 30% combined marginal rate
      const result = calculateDividendTaxImpact(20000, 0, 0.3);

      // Effective tax rate on actual dividends received
      const effectiveRate = result.netTaxImpact / 20000;

      // Should be significantly lower than 30% due to dividend tax credit
      expect(effectiveRate).toBeLessThan(0.3);
      // Typically around 7-15% effective rate for eligible dividends
      expect(effectiveRate).toBeGreaterThan(0);
    });

    it('should calculate dividend income for typical retiree', () => {
      // Retiree with $15,000 eligible and $3,000 non-eligible dividends
      const result = calculateDividendTaxImpact(15000, 3000, 0.25);

      expect(result.actualDividends).toBe(18000);
      expect(result.grossedUpAmount).toBeCloseTo(15000 * 1.38 + 3000 * 1.15, 2);

      // Net tax impact should be reasonable
      expect(result.netTaxImpact).toBeGreaterThan(0);
      expect(result.netTaxImpact).toBeLessThan(result.actualDividends * 0.25);
    });

    it('should show negative tax on eligible dividends at low income (approx)', () => {
      // At very low marginal rates, eligible dividend tax credit can exceed tax
      // This creates a "negative" tax scenario (credit > tax)
      const result = calculateDividendTaxImpact(10000, 0, 0.15);

      // At 15% federal rate, tax = $13,800 * 0.15 = $2,070
      // Credit = $13,800 * 0.150198 = $2,072.73
      // Net = approximately 0 or slightly negative
      expect(result.netTaxImpact).toBeLessThan(100);
    });

    it('should compare dividend vs interest income', () => {
      // $10,000 income: dividends vs interest at 40% rate
      const dividendResult = calculateDividendTaxImpact(10000, 0, 0.4);
      const interestTax = 10000 * 0.4; // $4,000

      // Dividend should result in less tax than interest
      expect(dividendResult.netTaxImpact).toBeLessThan(interestTax);

      // Tax savings percentage
      const savings = (interestTax - dividendResult.netTaxImpact) / interestTax;
      expect(savings).toBeGreaterThan(0.1); // At least 10% savings
    });
  });

  describe('Edge cases', () => {
    it('should handle very small dividend amounts', () => {
      const result = calculateDividendTaxImpact(10, 5, 0.3);
      expect(result.actualDividends).toBe(15);
      expect(result.grossedUpAmount).toBeGreaterThan(0);
    });

    it('should handle very large dividend amounts', () => {
      const result = calculateDividendTaxImpact(1000000, 500000, 0.5);
      expect(result.actualDividends).toBe(1500000);
      expect(result.netTaxImpact).toBeGreaterThan(0);
    });

    it('should handle zero marginal rate', () => {
      const result = calculateDividendTaxImpact(10000, 0, 0);
      // With zero marginal rate, net impact should be negative (just the credit)
      expect(result.netTaxImpact).toBeLessThan(0);
    });
  });
});

describe('calculateProvincialDividendCredit — TAX-CA-03', () => {
  /**
   * Provincial dividend tax credits reduce provincial tax
   * @see docs/source-of-truth/04-tax-engine.md - Provincial Dividend Credits
   */
  it('calculates ON eligible dividend credit — $10,000 eligible', () => {
    // 10000 * 1.38 (gross-up) * 0.10 (ON eligible rate) = 1380
    const credit = calculateProvincialDividendCredit(10000, 0, 'ON', 2024);
    expect(credit).toBeCloseTo(1380, 0.01);
  });

  it('calculates ON non-eligible dividend credit — $5,000 non-eligible', () => {
    // 5000 * 1.15 (gross-up) * 0.029863 (ON non-eligible rate) = 171.71
    const credit = calculateProvincialDividendCredit(0, 5000, 'ON', 2024);
    expect(credit).toBeCloseTo(171.71, 0.01);
  });

  it('calculates BC mixed dividend credit', () => {
    // eligible: 10000 * 1.38 * 0.12 = 1656
    // non-eligible: 5000 * 1.15 * 0.0196 = 112.70
    // total: 1768.70
    const credit = calculateProvincialDividendCredit(10000, 5000, 'BC', 2024);
    expect(credit).toBeCloseTo(1768.7, 1);
  });

  it('calculates QC eligible dividend credit', () => {
    // 10000 * 1.38 * 0.117 = 1614.60
    const credit = calculateProvincialDividendCredit(10000, 0, 'QC', 2024);
    expect(credit).toBeCloseTo(1614.6, 0.01);
  });

  it('returns 0 for zero dividends', () => {
    const credit = calculateProvincialDividendCredit(0, 0, 'ON', 2024);
    expect(credit).toBe(0);
  });

  it('returns > 0 for territory with rates (smoke test — YT)', () => {
    const credit = calculateProvincialDividendCredit(10000, 0, 'YT', 2024);
    expect(credit).toBeGreaterThan(0);
  });
});
