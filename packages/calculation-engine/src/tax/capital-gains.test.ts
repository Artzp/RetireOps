/**
 * Capital Gains Tax Calculation Tests
 * @see docs/source-of-truth/04-tax-engine.md - Capital Gains Tax
 * @see docs/source-of-truth/02-account-types.md - Non-Registered Section
 */
import { describe, it, expect } from 'vitest';
import {
  calculateTaxableCapitalGain,
  calculateTaxableCapitalGainEnhanced,
  calculateCapitalGainOnSale,
  calculateRealizedGainOnWithdrawal,
  calculateNewACBAfterWithdrawal,
  processNonRegWithdrawal,
} from './capital-gains.js';
import { CAPITAL_GAINS_RATES } from '@retireops/shared';

describe('Capital Gains Tax Calculations', () => {
  describe('calculateTaxableCapitalGain', () => {
    it('should return 0 for zero capital gain', () => {
      expect(calculateTaxableCapitalGain(0)).toBe(0);
    });

    it('should return 0 for negative capital gain (loss)', () => {
      expect(calculateTaxableCapitalGain(-5000)).toBe(0);
    });

    it('should apply 50% inclusion rate', () => {
      expect(calculateTaxableCapitalGain(10000)).toBe(5000);
      expect(calculateTaxableCapitalGain(100000)).toBe(50000);
    });

    it('should handle small gains', () => {
      expect(calculateTaxableCapitalGain(100)).toBe(50);
    });

    it('should handle large gains below enhanced threshold', () => {
      expect(calculateTaxableCapitalGain(200000)).toBe(100000);
    });
  });

  describe('calculateTaxableCapitalGainEnhanced', () => {
    const standardRate = CAPITAL_GAINS_RATES.standardInclusionRate; // 0.50
    const enhancedRate = CAPITAL_GAINS_RATES.enhancedInclusionRate; // 0.6667
    const threshold = CAPITAL_GAINS_RATES.enhancedThreshold; // $250,000

    it('should use standard rate for gains under threshold', () => {
      const gain = calculateTaxableCapitalGainEnhanced(100000);
      expect(gain).toBe(100000 * standardRate);
    });

    it('should use standard rate for gains exactly at threshold', () => {
      const gain = calculateTaxableCapitalGainEnhanced(threshold);
      expect(gain).toBe(threshold * standardRate);
    });

    it('should apply enhanced rate for gains over threshold', () => {
      const totalGain = 300000;
      const gain = calculateTaxableCapitalGainEnhanced(totalGain);
      const expected = threshold * standardRate + (totalGain - threshold) * enhancedRate;
      expect(gain).toBeCloseTo(expected, 2);
    });

    it('should handle gains well over threshold', () => {
      const totalGain = 500000;
      const gain = calculateTaxableCapitalGainEnhanced(totalGain);
      const expected = threshold * standardRate + (totalGain - threshold) * enhancedRate;
      expect(gain).toBeCloseTo(expected, 2);
    });

    it('should return 0 for zero or negative gains', () => {
      expect(calculateTaxableCapitalGainEnhanced(0)).toBe(0);
      expect(calculateTaxableCapitalGainEnhanced(-10000)).toBe(0);
    });
  });

  describe('calculateCapitalGainOnSale', () => {
    it('should calculate gain as proceeds minus ACB', () => {
      expect(calculateCapitalGainOnSale(50000, 30000)).toBe(20000);
    });

    it('should return 0 for proceeds equal to ACB (no gain)', () => {
      expect(calculateCapitalGainOnSale(30000, 30000)).toBe(0);
    });

    it('should return 0 for capital loss (proceeds less than ACB)', () => {
      expect(calculateCapitalGainOnSale(20000, 30000)).toBe(0);
    });

    it('should handle large gains', () => {
      expect(calculateCapitalGainOnSale(1000000, 200000)).toBe(800000);
    });
  });

  describe('calculateRealizedGainOnWithdrawal', () => {
    it('should calculate pro-rata gain on withdrawal', () => {
      // Account: $100,000 balance, $20,000 unrealized gains
      // Withdraw $25,000 (25% of account)
      // Realized gain = $25,000 * ($20,000 / $100,000) = $5,000
      const gain = calculateRealizedGainOnWithdrawal(25000, 100000, 20000);
      expect(gain).toBe(5000);
    });

    it('should return 0 if no unrealized gains', () => {
      const gain = calculateRealizedGainOnWithdrawal(25000, 100000, 0);
      expect(gain).toBe(0);
    });

    it('should return 0 if account balance is 0', () => {
      const gain = calculateRealizedGainOnWithdrawal(25000, 0, 20000);
      expect(gain).toBe(0);
    });

    it('should handle full withdrawal', () => {
      // Withdraw entire account
      const gain = calculateRealizedGainOnWithdrawal(100000, 100000, 20000);
      expect(gain).toBe(20000);
    });

    it('should handle account with all gains (ACB = 0)', () => {
      // Account is $50,000, all unrealized gain
      const gain = calculateRealizedGainOnWithdrawal(10000, 50000, 50000);
      expect(gain).toBe(10000);
    });
  });

  describe('calculateNewACBAfterWithdrawal', () => {
    it('should reduce ACB proportionally', () => {
      // Account: $100,000 balance, $80,000 ACB
      // Withdraw $25,000 (25% of account)
      // New ACB = $80,000 - ($25,000 * $80,000 / $100,000) = $80,000 - $20,000 = $60,000
      const newACB = calculateNewACBAfterWithdrawal(25000, 100000, 80000);
      expect(newACB).toBe(60000);
    });

    it('should return 0 if account balance is 0', () => {
      const newACB = calculateNewACBAfterWithdrawal(25000, 0, 80000);
      expect(newACB).toBe(0);
    });

    it('should handle full withdrawal', () => {
      const newACB = calculateNewACBAfterWithdrawal(100000, 100000, 80000);
      expect(newACB).toBe(0);
    });

    it('should handle account with no ACB', () => {
      const newACB = calculateNewACBAfterWithdrawal(25000, 100000, 0);
      expect(newACB).toBe(0);
    });
  });

  describe('processNonRegWithdrawal', () => {
    it('should process complete withdrawal correctly', () => {
      // Account: $100,000 balance, $80,000 ACB, $20,000 unrealized gains
      // Withdraw $25,000
      const result = processNonRegWithdrawal(25000, 100000, 80000, 20000);

      expect(result.withdrawalAmount).toBe(25000);
      expect(result.realizedGain).toBe(5000); // $25k * 20% gain ratio
      expect(result.taxableGain).toBe(2500); // 50% inclusion
      expect(result.newACB).toBe(60000); // $80k - $20k
      expect(result.newUnrealizedGains).toBe(15000); // $20k - $5k
    });

    it('should handle full account withdrawal', () => {
      const result = processNonRegWithdrawal(100000, 100000, 80000, 20000);

      expect(result.withdrawalAmount).toBe(100000);
      expect(result.realizedGain).toBe(20000);
      expect(result.taxableGain).toBe(10000);
      expect(result.newACB).toBe(0);
      expect(result.newUnrealizedGains).toBe(0);
    });

    it('should handle withdrawal with no gains', () => {
      const result = processNonRegWithdrawal(25000, 100000, 100000, 0);

      expect(result.realizedGain).toBe(0);
      expect(result.taxableGain).toBe(0);
      expect(result.newACB).toBe(75000);
      expect(result.newUnrealizedGains).toBe(0);
    });

    it('should handle withdrawal from pure-gain account', () => {
      // Account has only gains (inherited or long-held stock with $0 ACB)
      const result = processNonRegWithdrawal(20000, 100000, 0, 100000);

      expect(result.realizedGain).toBe(20000);
      expect(result.taxableGain).toBe(10000);
      expect(result.newACB).toBe(0);
      expect(result.newUnrealizedGains).toBe(80000);
    });
  });

  describe('processNonRegWithdrawal — enhanced rate wiring (TAX-CA-04)', () => {
    /**
     * @see docs/source-of-truth/04-tax-engine.md - TC-TAX-003
     */

    it('applies standard 50% rate for gains under $250K threshold (default annualCapitalGainsToDate)', () => {
      // balance=200000, acb=100000, unrealizedGains=100000
      // withdrawal=100000 → realizedGain = 100000 * (100000/200000) = 50000
      // totalAnnualGains = 0 + 50000 = 50000 (under threshold)
      // taxableGain = 50000 * 0.5 = 25000
      const result = processNonRegWithdrawal(100000, 200000, 100000, 100000);
      expect(result.realizedGain).toBeCloseTo(50000, 0);
      expect(result.taxableGain).toBeCloseTo(25000, 0);
    });

    it('applies enhanced 66.7% rate for gains above $250K threshold in single withdrawal', () => {
      // balance=1000000, acb=400000, unrealizedGains=600000
      // withdrawal=600000 → realizedGain = 600000 * (600000/1000000) = 360000
      // totalAnnualGains = 0 + 360000 = 360000 (above threshold)
      // taxableGain = 250000*0.5 + 110000*0.6667 = 125000 + 73337 = 198337
      const result = processNonRegWithdrawal(600000, 1000000, 400000, 600000);
      expect(result.realizedGain).toBeCloseTo(360000, 0);
      expect(result.taxableGain).toBeCloseTo(198337, 0);
    });

    it('uses annualCapitalGainsToDate for threshold calculation — at threshold stays standard', () => {
      // annualCapitalGainsToDate=200000, realizedGain=50000, totalAnnualGains=250000 (at threshold)
      // At threshold exactly → standard rate applies (threshold is exclusive)
      // taxableGain = 50000 * 0.5 = 25000
      const result = processNonRegWithdrawal(100000, 200000, 100000, 100000, 200000);
      expect(result.realizedGain).toBeCloseTo(50000, 0);
      expect(result.taxableGain).toBeCloseTo(25000, 0);
    });

    it('applies enhanced rate when annualCapitalGainsToDate pushes past threshold', () => {
      // annualCapitalGainsToDate=260000, realizedGain=50000, totalAnnualGains=310000 (above threshold)
      // Since cumulative > threshold, enhanced rate applies to current gain
      // taxableGain should be > standard 25000
      const result = processNonRegWithdrawal(100000, 200000, 100000, 100000, 260000);
      expect(result.realizedGain).toBeCloseTo(50000, 0);
      expect(result.taxableGain).toBeGreaterThan(25000);
    });

    it('backward compatible — existing 4-arg calls still work', () => {
      // No 5th argument — should default to annualCapitalGainsToDate=0
      const result = processNonRegWithdrawal(50000, 100000, 50000, 50000);
      // realizedGain = 50000 * (50000/100000) = 25000
      // taxableGain = 25000 * 0.5 = 12500 (under threshold)
      expect(result.realizedGain).toBeCloseTo(25000, 0);
      expect(result.taxableGain).toBeCloseTo(12500, 0);
    });
  });

  describe('Real-world capital gains scenarios', () => {
    it('should calculate tax impact for retiree selling stock', () => {
      // Retiree sells $50,000 worth of stock
      // Original cost: $30,000
      const gain = calculateCapitalGainOnSale(50000, 30000);
      const taxableGain = calculateTaxableCapitalGain(gain);

      expect(gain).toBe(20000);
      expect(taxableGain).toBe(10000);
      // At 30% marginal rate, tax would be $3,000
    });

    it('should show tax benefit of capital gains vs interest', () => {
      // $10,000 investment income
      // As interest: full $10,000 taxable
      // As capital gain: only $5,000 taxable
      const taxableAsGain = calculateTaxableCapitalGain(10000);
      expect(taxableAsGain).toBe(5000);
      // 50% tax advantage
    });

    it('should calculate enhanced rate for large sale', () => {
      // Selling business or property with $400,000 gain
      const taxableGain = calculateTaxableCapitalGainEnhanced(400000);

      // First $250k at 50% = $125,000
      // Remaining $150k at 66.67% = $100,005
      const expected = 250000 * 0.5 + 150000 * 0.6667;
      expect(taxableGain).toBeCloseTo(expected, 0);
    });

    it('should handle systematic withdrawal from non-reg account', () => {
      // Starting: $500,000 balance, $350,000 ACB, $150,000 unrealized gains
      // Annual withdrawal: $40,000

      let balance = 500000;
      let acb = 350000;
      let unrealizedGains = 150000;
      let totalTaxableGains = 0;

      // Simulate 5 years of withdrawals
      for (let year = 0; year < 5; year++) {
        const result = processNonRegWithdrawal(40000, balance, acb, unrealizedGains);
        totalTaxableGains += result.taxableGain;

        // Update for next year
        balance -= 40000;
        acb = result.newACB;
        unrealizedGains = result.newUnrealizedGains;
      }

      // After 5 years: withdrew $200,000, should have realized proportional gains
      expect(totalTaxableGains).toBeGreaterThan(0);
      expect(balance).toBe(300000);
    });
  });
});
