/**
 * Non-Registered Account Calculation Tests
 * @see docs/source-of-truth/02-account-types.md - Non-Registered Section
 */
import { describe, it, expect } from 'vitest';
import {
  calculateAnnualTaxableIncome,
  calculateNewACB,
  processNonRegContribution,
  applyNonRegGrowth,
  processNonRegisteredWithdrawal,
  calculateAfterTaxValue,
  DEFAULT_INCOME_ALLOCATION,
} from './non-registered.js';

describe('Non-Registered Account Calculations', () => {
  describe('DEFAULT_INCOME_ALLOCATION', () => {
    it('should have allocations that sum to 100%', () => {
      const { interestPct, canadianDividendPct, capitalGainsPct } = DEFAULT_INCOME_ALLOCATION;
      expect(interestPct + canadianDividendPct + capitalGainsPct).toBe(1);
    });

    it('should have default conservative allocation', () => {
      expect(DEFAULT_INCOME_ALLOCATION.interestPct).toBe(0.3);
      expect(DEFAULT_INCOME_ALLOCATION.canadianDividendPct).toBe(0.2);
      expect(DEFAULT_INCOME_ALLOCATION.capitalGainsPct).toBe(0.5);
    });
  });

  describe('calculateAnnualTaxableIncome', () => {
    it('should allocate income by type', () => {
      // $100,000 balance, 5% return = $5,000 total return
      const income = calculateAnnualTaxableIncome(0.05, 100000);
      // Default: 30% interest, 20% dividends, 50% capital gains
      expect(income.interestIncome).toBeCloseTo(1500, 2);
      expect(income.dividendIncome).toBeCloseTo(1000, 2);
      expect(income.capitalGainsRealized).toBeCloseTo(2500, 2);
    });

    it('should handle custom allocation', () => {
      const allocation = {
        interestPct: 0.1,
        canadianDividendPct: 0.1,
        capitalGainsPct: 0.8,
      };
      const income = calculateAnnualTaxableIncome(0.05, 100000, allocation);
      expect(income.interestIncome).toBeCloseTo(500, 2);
      expect(income.dividendIncome).toBeCloseTo(500, 2);
      expect(income.capitalGainsRealized).toBeCloseTo(4000, 2);
    });

    it('should handle zero return', () => {
      const income = calculateAnnualTaxableIncome(0, 100000);
      expect(income.interestIncome).toBe(0);
      expect(income.dividendIncome).toBe(0);
      expect(income.capitalGainsRealized).toBe(0);
    });

    it('should scale with balance', () => {
      const income1 = calculateAnnualTaxableIncome(0.05, 100000);
      const income2 = calculateAnnualTaxableIncome(0.05, 200000);
      expect(income2.interestIncome).toBe(income1.interestIncome * 2);
    });
  });

  describe('calculateNewACB', () => {
    it('should add purchase to ACB', () => {
      expect(calculateNewACB(50000, 10000)).toBe(60000);
    });

    it('should handle zero current ACB', () => {
      expect(calculateNewACB(0, 25000)).toBe(25000);
    });

    it('should handle zero purchase', () => {
      expect(calculateNewACB(50000, 0)).toBe(50000);
    });
  });

  describe('processNonRegContribution', () => {
    it('should increase both balance and ACB', () => {
      const result = processNonRegContribution(100000, 80000, 20000);
      expect(result.newBalance).toBe(120000);
      expect(result.newACB).toBe(100000);
    });

    it('should handle first contribution', () => {
      const result = processNonRegContribution(0, 0, 50000);
      expect(result.newBalance).toBe(50000);
      expect(result.newACB).toBe(50000);
    });
  });

  describe('applyNonRegGrowth', () => {
    it('should increase balance by return', () => {
      const result = applyNonRegGrowth(100000, 80000, 0.05);
      expect(result.newBalance).toBe(105000);
    });

    it('should track unrealized gains', () => {
      // Starting: $100k balance, $80k ACB = $20k unrealized
      // Growth: $5k, of which $2.5k (50%) is capital gains
      const result = applyNonRegGrowth(100000, 80000, 0.05);
      // Current unrealized: $20k + $2.5k = $22.5k
      expect(result.newUnrealizedGains).toBeCloseTo(22500, 0);
    });

    it('should calculate taxable income components', () => {
      const result = applyNonRegGrowth(100000, 80000, 0.05);
      // 5% return = $5k total
      expect(result.taxableIncome.interest).toBeCloseTo(1500, 0); // 30%
      expect(result.taxableIncome.dividends).toBeCloseTo(1000, 0); // 20%
      expect(result.taxableIncome.capitalGains).toBeCloseTo(2500, 0); // 50%
    });

    it('should handle custom allocation', () => {
      const allocation = {
        interestPct: 0,
        canadianDividendPct: 0,
        capitalGainsPct: 1.0, // All capital gains
      };
      const result = applyNonRegGrowth(100000, 80000, 0.05, allocation);
      expect(result.taxableIncome.interest).toBe(0);
      expect(result.taxableIncome.dividends).toBe(0);
      expect(result.taxableIncome.capitalGains).toBe(5000);
    });
  });

  describe('processNonRegisteredWithdrawal', () => {
    it('should calculate pro-rata capital gains', () => {
      // $100k balance, $80k ACB, $20k unrealized gains
      // Withdraw $25k (25% of account)
      const result = processNonRegisteredWithdrawal(25000, 100000, 80000, 20000);
      expect(result.realizedGain).toBe(5000); // 25% of $20k
      expect(result.taxableGain).toBe(2500); // 50% inclusion
    });

    it('should update ACB after withdrawal', () => {
      const result = processNonRegisteredWithdrawal(25000, 100000, 80000, 20000);
      expect(result.newACB).toBe(60000); // $80k - ($25k * 80%)
    });

    it('should update unrealized gains', () => {
      const result = processNonRegisteredWithdrawal(25000, 100000, 80000, 20000);
      expect(result.newUnrealizedGains).toBe(15000); // $20k - $5k realized
    });

    it('should handle full withdrawal', () => {
      const result = processNonRegisteredWithdrawal(100000, 100000, 80000, 20000);
      expect(result.realizedGain).toBe(20000);
      expect(result.newACB).toBe(0);
      expect(result.newUnrealizedGains).toBe(0);
    });

    it('should handle withdrawal with no gains', () => {
      // Balance = ACB = no unrealized gains
      const result = processNonRegisteredWithdrawal(25000, 100000, 100000, 0);
      expect(result.realizedGain).toBe(0);
      expect(result.taxableGain).toBe(0);
    });
  });

  describe('calculateAfterTaxValue', () => {
    it('should return full balance when no gains', () => {
      expect(calculateAfterTaxValue(100000, 100000, 0.3)).toBe(100000);
    });

    it('should deduct tax on unrealized gains', () => {
      // $100k balance, $80k ACB = $20k unrealized
      // Taxable: $10k (50% inclusion)
      // Tax: $10k * 30% = $3k
      const value = calculateAfterTaxValue(100000, 80000, 0.3);
      expect(value).toBe(97000);
    });

    it('should handle high gains scenario', () => {
      // $200k balance, $50k ACB = $150k unrealized
      // Taxable: $75k, Tax at 40%: $30k
      const value = calculateAfterTaxValue(200000, 50000, 0.4);
      expect(value).toBe(170000);
    });

    it('should handle zero tax rate', () => {
      const value = calculateAfterTaxValue(100000, 80000, 0);
      expect(value).toBe(100000);
    });

    it('should return balance when ACB exceeds balance (loss)', () => {
      // Technically a loss, but function treats as no gain
      const value = calculateAfterTaxValue(80000, 100000, 0.3);
      expect(value).toBe(80000);
    });
  });

  describe('Real-world non-registered scenarios', () => {
    it('should calculate annual tax drag for typical portfolio', () => {
      // $500,000 portfolio, 6% return
      const income = calculateAnnualTaxableIncome(0.06, 500000);
      // Total return: $30,000
      // Interest (30%): $9,000 - fully taxable
      // Dividends (20%): $6,000 - grossed up, but credits apply
      // Capital gains (50%): $15,000 - only 50% taxable
      expect(income.interestIncome + income.dividendIncome + income.capitalGainsRealized).toBe(
        30000
      );
    });

    it('should track ACB over multiple purchases', () => {
      // Initial purchase: $50,000
      let result = processNonRegContribution(0, 0, 50000);
      expect(result.newACB).toBe(50000);

      // Second purchase: $30,000
      result = processNonRegContribution(result.newBalance, result.newACB, 30000);
      expect(result.newACB).toBe(80000);
    });

    it('should calculate tax impact of systematic withdrawals', () => {
      // $500,000 portfolio, $350k ACB, $150k unrealized
      // Annual withdrawal: $40,000 (8%)
      let balance = 500000;
      let acb = 350000;
      let unrealized = 150000;
      let totalTaxableGains = 0;

      for (let i = 0; i < 5; i++) {
        const result = processNonRegisteredWithdrawal(40000, balance, acb, unrealized);
        totalTaxableGains += result.taxableGain;
        balance -= 40000;
        acb = result.newACB;
        unrealized = result.newUnrealizedGains;
      }

      // Should have realized proportional gains over 5 years
      expect(totalTaxableGains).toBeGreaterThan(0);
      expect(balance).toBe(300000);
    });

    it('should show tax efficiency of capital gains vs interest', () => {
      // $10,000 return
      // As interest: $10,000 taxable
      // As capital gains: $5,000 taxable (50% inclusion)
      const asInterest = 10000 * 0.3; // 30% rate = $3,000 tax
      const asCapGains = 10000 * 0.5 * 0.3; // 50% inclusion * 30% rate = $1,500 tax

      expect(asCapGains).toBe(asInterest / 2); // 50% tax savings
    });

    it('should calculate after-tax value for estate planning', () => {
      // $1,000,000 portfolio, $600,000 ACB
      // At death, deemed disposition triggers capital gains
      const value = calculateAfterTaxValue(1000000, 600000, 0.26);
      // Unrealized: $400k, Taxable: $200k, Tax: $52k
      expect(value).toBe(948000);
    });

    it('should show growth with annual contributions', () => {
      // Start $100k, contribute $10k/year, 6% return for 10 years
      let balance = 100000;
      let acb = 100000;

      for (let year = 0; year < 10; year++) {
        // Growth
        const growth = applyNonRegGrowth(balance, acb, 0.06);
        balance = growth.newBalance;
        // Contribution
        const contrib = processNonRegContribution(balance, acb, 10000);
        balance = contrib.newBalance;
        acb = contrib.newACB;
      }

      // After 10 years
      expect(balance).toBeGreaterThan(300000);
      expect(acb).toBe(100000 + 10 * 10000); // $200k in contributions
    });
  });
});
