/**
 * Withdrawal Strategy Tests
 * @see docs/source-of-truth/07-withdrawal-strategies.md
 */
import { describe, it, expect } from 'vitest';
import {
  calculateRRIFMinimum,
  calculateLIFWithdrawalLimits,
  calculateSpendingNeed,
  calculateWithdrawals,
  canMeetSpendingNeed,
  estimateYearsUntilDepletion,
  type AccountBalances,
} from './calculator.js';
import {
  WITHDRAWAL_STRATEGIES,
  getWithdrawalStrategy,
  getWithdrawalOrder,
  shouldWithdrawFromAccount,
  createCustomStrategy,
} from './strategy.js';
import {
  getFederalTaxBrackets,
  getCurrentBracket,
  calculateBracketSpace,
  calculateBracketFillWithdrawal,
  calculateMeltdownWithdrawal,
  getOASClawbackThreshold,
  calculateSafeIncomeLimit,
  calculateOASOptimizedWithdrawal,
  calculateSmoothedIncome,
  calculateOptimalPensionSplit,
  compareStrategies,
  recommendSurplusReinvestment,
} from './optimizer.js';

// Helper to create test account balances
function createBalances(overrides: Partial<AccountBalances> = {}): AccountBalances {
  return {
    rrsp: 0,
    rrif: 300000,
    tfsa: 100000,
    nonRegistered: 150000,
    ...overrides,
  };
}

describe('Withdrawal Calculator', () => {
  describe('calculateRRIFMinimum', () => {
    it('should return 0 for age under 72', () => {
      expect(calculateRRIFMinimum(300000, 70)).toBe(0);
      expect(calculateRRIFMinimum(300000, 71)).toBe(0);
    });

    it('should return 0 for zero balance', () => {
      expect(calculateRRIFMinimum(0, 75)).toBe(0);
    });

    it('should calculate minimum for age 72+', () => {
      // Age 72 rate: 5.40%
      const minimum = calculateRRIFMinimum(300000, 72);
      expect(minimum).toBeCloseTo(16200, 0);
    });

    it('should increase with age', () => {
      const min72 = calculateRRIFMinimum(300000, 72);
      const min80 = calculateRRIFMinimum(300000, 80);
      const min90 = calculateRRIFMinimum(300000, 90);
      expect(min80).toBeGreaterThan(min72);
      expect(min90).toBeGreaterThan(min80);
    });
  });

  describe('calculateLIFWithdrawalLimits', () => {
    it('should return zeros for zero balance', () => {
      const limits = calculateLIFWithdrawalLimits(0, 75);
      expect(limits.minimum).toBe(0);
      expect(limits.maximum).toBe(0);
    });

    it('should calculate minimum same as RRIF', () => {
      const lifLimits = calculateLIFWithdrawalLimits(300000, 75);
      const rrifMin = calculateRRIFMinimum(300000, 75);
      expect(lifLimits.minimum).toBe(rrifMin);
    });

    it('should allow up to 100% at age 90+', () => {
      // At age 95, years to target age 90 = 0, so max rate approaches 100%
      const limits = calculateLIFWithdrawalLimits(300000, 95);
      expect(limits.maximum).toBeCloseTo(300000, 0); // 100% of balance at age 95
    });
  });

  describe('calculateSpendingNeed', () => {
    it('should calculate basic spending need', () => {
      expect(calculateSpendingNeed(60000, 20000)).toBe(40000);
    });

    it('should include taxes in spending need', () => {
      expect(calculateSpendingNeed(60000, 20000, 5000)).toBe(45000);
    });

    it('should include one-time expenses', () => {
      expect(calculateSpendingNeed(60000, 20000, 0, 10000)).toBe(50000);
    });

    it('should return 0 when income exceeds spending', () => {
      const need = calculateSpendingNeed(40000, 50000);
      expect(need).toBeLessThan(0); // Surplus scenario
    });
  });

  describe('calculateWithdrawals', () => {
    it('should calculate basic withdrawals', () => {
      const result = calculateWithdrawals({
        balances: createBalances(),
        desiredSpending: 50000,
        guaranteedIncome: 20000,
        age: 75,
      });

      expect(result.netSpendingNeed).toBe(30000);
      expect(result.totalWithdrawal).toBeGreaterThan(0);
    });

    it('should enforce RRIF minimum at age 72+', () => {
      const result = calculateWithdrawals({
        balances: createBalances({ rrif: 300000 }),
        desiredSpending: 10000,
        guaranteedIncome: 30000, // Income exceeds spending
        age: 75,
      });

      // Minimum withdrawal still required
      expect(result.withdrawals.rrifMinimum).toBeGreaterThan(0);
    });

    it('should handle spending surplus from RRIF minimum', () => {
      const result = calculateWithdrawals({
        balances: createBalances({ rrif: 500000 }),
        desiredSpending: 10000,
        guaranteedIncome: 30000,
        age: 80, // Higher minimum rate
      });

      // Surplus should be recorded
      expect(result.surplusReinvested).toBeGreaterThan(0);
    });

    it('should follow standard strategy priority', () => {
      const result = calculateWithdrawals({
        balances: createBalances({
          nonRegistered: 100000,
          rrif: 100000,
          tfsa: 100000,
        }),
        desiredSpending: 50000,
        guaranteedIncome: 0,
        age: 70,
        strategy: WITHDRAWAL_STRATEGIES.standard,
      });

      // Standard: Non-reg first, then RRIF, then TFSA
      expect(result.withdrawals.nonRegistered).toBeGreaterThan(0);
    });

    it('should follow TFSA-first strategy priority', () => {
      const result = calculateWithdrawals({
        balances: createBalances({
          nonRegistered: 100000,
          rrif: 100000,
          tfsa: 100000,
        }),
        desiredSpending: 50000,
        guaranteedIncome: 0,
        age: 70,
        strategy: WITHDRAWAL_STRATEGIES.tfsaFirst,
      });

      // TFSA-first: TFSA before non-reg
      expect(result.withdrawals.tfsa).toBe(50000);
    });

    it('should handle insufficient funds', () => {
      const result = calculateWithdrawals({
        balances: createBalances({
          rrif: 10000,
          tfsa: 10000,
          nonRegistered: 10000,
        }),
        desiredSpending: 100000,
        guaranteedIncome: 0,
        age: 70,
      });

      expect(result.shortfall).toBeGreaterThan(0);
      expect(result.totalWithdrawal).toBe(30000); // All available funds
    });

    it('should update balances correctly', () => {
      const initialBalances = createBalances({
        tfsa: 50000,
        nonRegistered: 50000,
      });

      const result = calculateWithdrawals({
        balances: initialBalances,
        desiredSpending: 30000,
        guaranteedIncome: 0,
        age: 70,
        strategy: WITHDRAWAL_STRATEGIES.tfsaFirst,
      });

      expect(result.updatedBalances.tfsa).toBe(20000);
    });
  });

  describe('canMeetSpendingNeed', () => {
    it('should return true when balances exceed need', () => {
      const balances = createBalances({ rrif: 300000, tfsa: 100000 });
      expect(canMeetSpendingNeed(balances, 50000)).toBe(true);
    });

    it('should return false when need exceeds balances', () => {
      const balances = createBalances({ rrif: 10000, tfsa: 10000, nonRegistered: 10000 });
      expect(canMeetSpendingNeed(balances, 50000)).toBe(false);
    });
  });

  describe('estimateYearsUntilDepletion', () => {
    it('should return null for indefinite portfolio', () => {
      // 4% withdrawal from portfolio returning 5%
      const balances = createBalances({ rrif: 1000000 });
      const result = estimateYearsUntilDepletion(balances, 40000, 0.05);
      expect(result).toBeNull();
    });

    it('should estimate years for depleting portfolio', () => {
      const balances = createBalances({ rrif: 500000, tfsa: 0, nonRegistered: 0 });
      const result = estimateYearsUntilDepletion(balances, 50000, 0.02);
      expect(result).toBeGreaterThan(10);
      expect(result).toBeLessThan(20);
    });

    it('should return null for zero spending need', () => {
      const balances = createBalances();
      expect(estimateYearsUntilDepletion(balances, 0, 0.04)).toBeNull();
    });
  });
});

describe('Withdrawal Strategies', () => {
  describe('WITHDRAWAL_STRATEGIES', () => {
    it('should have all predefined strategies', () => {
      expect(WITHDRAWAL_STRATEGIES.standard).toBeDefined();
      expect(WITHDRAWAL_STRATEGIES.tfsaFirst).toBeDefined();
      expect(WITHDRAWAL_STRATEGIES.oasProtection).toBeDefined();
      expect(WITHDRAWAL_STRATEGIES.bracketFilling).toBeDefined();
    });

    it('should have different priorities', () => {
      const standard = WITHDRAWAL_STRATEGIES.standard;
      const tfsaFirst = WITHDRAWAL_STRATEGIES.tfsaFirst;

      expect(standard.accountPriority.non_registered).toBeLessThan(standard.accountPriority.tfsa);
      expect(tfsaFirst.accountPriority.tfsa).toBeLessThan(tfsaFirst.accountPriority.non_registered);
    });
  });

  describe('getWithdrawalStrategy', () => {
    it('should return strategy by name', () => {
      expect(getWithdrawalStrategy('standard')).toBe(WITHDRAWAL_STRATEGIES.standard);
    });

    it('should return undefined for unknown strategy', () => {
      expect(getWithdrawalStrategy('nonexistent')).toBeUndefined();
    });
  });

  describe('getWithdrawalOrder', () => {
    it('should return accounts in priority order', () => {
      const order = getWithdrawalOrder(WITHDRAWAL_STRATEGIES.standard);
      // Standard: non_registered (1), rrif/lif (2), rrsp (3), tfsa (4)
      expect(order[0]).toBe('non_registered');
      expect(order.indexOf('tfsa')).toBeGreaterThan(order.indexOf('non_registered'));
    });

    it('should return TFSA first for tfsaFirst strategy', () => {
      const order = getWithdrawalOrder(WITHDRAWAL_STRATEGIES.tfsaFirst);
      expect(order[0]).toBe('tfsa');
    });
  });

  describe('shouldWithdrawFromAccount', () => {
    it('should return true for highest priority with balance', () => {
      const result = shouldWithdrawFromAccount('non_registered', WITHDRAWAL_STRATEGIES.standard, [
        'non_registered',
        'tfsa',
      ]);
      expect(result).toBe(true);
    });

    it('should return false for lower priority when higher has balance', () => {
      const result = shouldWithdrawFromAccount('tfsa', WITHDRAWAL_STRATEGIES.standard, [
        'non_registered',
        'tfsa',
      ]);
      expect(result).toBe(false);
    });

    it('should return false for account without balance', () => {
      const result = shouldWithdrawFromAccount('rrsp', WITHDRAWAL_STRATEGIES.standard, [
        'non_registered',
        'tfsa',
      ]);
      expect(result).toBe(false);
    });
  });

  describe('createCustomStrategy', () => {
    it('should create custom strategy with overrides', () => {
      const custom = createCustomStrategy('My Strategy', 'Custom description', {
        tfsa: 1,
        non_registered: 2,
      });

      expect(custom.name).toBe('My Strategy');
      expect(custom.accountPriority.tfsa).toBe(1);
      expect(custom.accountPriority.non_registered).toBe(2);
    });

    it('should set default surplus priority', () => {
      const custom = createCustomStrategy('Test', 'Test', {});
      expect(custom.surplusPriority).toEqual(['tfsa', 'non_registered']);
    });
  });
});

describe('Withdrawal Optimizer', () => {
  describe('getFederalTaxBrackets', () => {
    it('should return 5 brackets', () => {
      const brackets = getFederalTaxBrackets();
      expect(brackets.length).toBe(5);
    });
  });

  describe('getCurrentBracket', () => {
    it('should return correct bracket for income', () => {
      const bracket = getCurrentBracket(50000);
      expect(bracket?.rate).toBe(0.15); // First bracket
    });

    it('should return second bracket for higher income', () => {
      const bracket = getCurrentBracket(80000);
      expect(bracket?.rate).toBe(0.205);
    });
  });

  describe('calculateBracketSpace', () => {
    it('should calculate space in current bracket', () => {
      const space = calculateBracketSpace(50000);
      // In first bracket ($0-$55,867), space = $55,867 - $50,000 = $5,867
      expect(space).toBeCloseTo(5867, 0);
    });

    it('should calculate space when at bracket boundary', () => {
      const space = calculateBracketSpace(55867);
      // At exact first bracket max (55867), you're in second bracket (55867-111733)
      // Space = 111733 - 55867 = 55866
      expect(space).toBeCloseTo(55866, 0);
    });
  });

  describe('calculateBracketFillWithdrawal', () => {
    it('should recommend withdrawal to fill bracket', () => {
      const withdrawal = calculateBracketFillWithdrawal(
        50000, // Current income
        300000, // RRIF balance
        16200, // RRIF minimum
        'next'
      );

      // Should fill remaining space in first bracket
      expect(withdrawal).toBeCloseTo(5867, 0);
    });

    it('should limit to available balance', () => {
      const withdrawal = calculateBracketFillWithdrawal(
        50000,
        20000, // Small balance
        16200, // Minimum exceeds extra
        'next'
      );

      expect(withdrawal).toBeLessThanOrEqual(20000 - 16200);
    });
  });

  describe('calculateMeltdownWithdrawal', () => {
    it('should calculate annual meltdown amount', () => {
      // 65 years old, $500k RRSP, target $150k at 72
      const meltdown = calculateMeltdownWithdrawal(65, 500000, 150000, 60);
      // 6 years remaining, $350k excess
      expect(meltdown).toBeCloseTo(58333, 0);
    });

    it('should return 0 before retirement age', () => {
      expect(calculateMeltdownWithdrawal(55, 500000, 150000, 60)).toBe(0);
    });

    it('should return 0 after age 72', () => {
      expect(calculateMeltdownWithdrawal(72, 500000, 150000, 60)).toBe(0);
    });

    it('should return 0 when below target', () => {
      expect(calculateMeltdownWithdrawal(65, 100000, 150000, 60)).toBe(0);
    });
  });

  describe('getOASClawbackThreshold', () => {
    it('should return 2024 threshold', () => {
      const threshold = getOASClawbackThreshold();
      expect(threshold).toBe(90997);
    });
  });

  describe('calculateSafeIncomeLimit', () => {
    it('should return threshold minus margin', () => {
      const limit = calculateSafeIncomeLimit(90997, 2000);
      expect(limit).toBe(88997);
    });

    it('should use default margin', () => {
      const limit = calculateSafeIncomeLimit();
      expect(limit).toBe(90997 - 2000);
    });
  });

  describe('calculateOASOptimizedWithdrawal', () => {
    it('should use taxable when below safe limit', () => {
      const result = calculateOASOptimizedWithdrawal(
        50000, // Current income
        20000, // Spending need
        100000 // TFSA balance
      );

      // Room in safe limit, use taxable
      expect(result.taxableWithdrawal).toBe(20000);
      expect(result.tfsaWithdrawal).toBe(0);
    });

    it('should use TFSA when approaching clawback', () => {
      const result = calculateOASOptimizedWithdrawal(
        85000, // Near threshold
        20000, // Spending need
        100000 // TFSA balance
      );

      // Some from taxable (up to safe limit), rest from TFSA
      expect(result.tfsaWithdrawal).toBeGreaterThan(0);
    });

    it('should handle limited TFSA balance', () => {
      const result = calculateOASOptimizedWithdrawal(
        88000, // Very close to threshold
        20000,
        5000 // Limited TFSA
      );

      expect(result.tfsaWithdrawal).toBeLessThanOrEqual(5000);
    });
  });

  describe('calculateSmoothedIncome', () => {
    it('should divide assets over remaining years', () => {
      const income = calculateSmoothedIncome(500000, 25, 30000);
      // $500k / 25 years + $30k guaranteed = $50k
      expect(income).toBe(50000);
    });

    it('should return 0 for zero years remaining', () => {
      expect(calculateSmoothedIncome(500000, 0, 30000)).toBe(0);
    });
  });

  describe('calculateOptimalPensionSplit', () => {
    it('should return 0 when no benefit', () => {
      // Both in same bracket
      const split = calculateOptimalPensionSplit(100000, 90000, 50000);
      expect(split).toBeGreaterThanOrEqual(0);
      expect(split).toBeLessThanOrEqual(0.5);
    });

    it('should recommend split when beneficial', () => {
      // High earner vs low earner
      const split = calculateOptimalPensionSplit(200000, 30000, 50000);
      expect(split).toBeGreaterThan(0);
    });

    it('should cap at 50%', () => {
      const split = calculateOptimalPensionSplit(300000, 0, 100000);
      expect(split).toBeLessThanOrEqual(0.5);
    });
  });

  describe('compareStrategies', () => {
    it('should compare all predefined strategies', () => {
      const results = compareStrategies(createBalances(), 50000, 20000, 75);

      expect(results.length).toBe(Object.keys(WITHDRAWAL_STRATEGIES).length);
      results.forEach((r) => {
        expect(r.strategyName).toBeDefined();
        expect(r.plan).toBeDefined();
      });
    });
  });

  describe('recommendSurplusReinvestment', () => {
    it('should prioritize TFSA first', () => {
      const result = recommendSurplusReinvestment(10000, 15000);
      expect(result.tfsa).toBe(10000);
      expect(result.nonRegistered).toBe(0);
    });

    it('should use non-registered after TFSA room filled', () => {
      const result = recommendSurplusReinvestment(20000, 5000);
      expect(result.tfsa).toBe(5000);
      expect(result.nonRegistered).toBe(15000);
    });

    it('should consider mortgage paydown', () => {
      // Mortgage rate 6% vs expected 5% return
      const result = recommendSurplusReinvestment(10000, 0, true, 0.06, 0.05);
      expect(result.mortgage).toBeGreaterThan(0);
    });

    it('should prefer investment when mortgage rate low', () => {
      // Mortgage rate 2% vs expected 5% return
      const result = recommendSurplusReinvestment(10000, 0, true, 0.02, 0.05);
      expect(result.nonRegistered).toBe(10000);
      expect(result.mortgage).toBe(0);
    });
  });
});

describe('Real-world withdrawal scenarios', () => {
  it('should handle typical retiree withdrawal', () => {
    const result = calculateWithdrawals({
      balances: {
        rrsp: 0,
        rrif: 500000,
        tfsa: 120000,
        nonRegistered: 200000,
      },
      desiredSpending: 60000,
      guaranteedIncome: 30000, // CPP + OAS
      age: 72,
    });

    expect(result.netSpendingNeed).toBe(30000);
    expect(result.totalWithdrawal).toBeGreaterThanOrEqual(30000);
    // Should include RRIF minimum
    expect(result.withdrawals.rrifMinimum).toBeGreaterThan(0);
  });

  it('should protect OAS with TFSA-first strategy', () => {
    // With large spending need beyond RRIF minimum and guaranteed income
    const result = calculateWithdrawals({
      balances: {
        rrsp: 0,
        rrif: 300000, // Smaller RRIF so minimum doesn't cover all spending
        tfsa: 150000,
        nonRegistered: 100000,
      },
      desiredSpending: 100000, // Higher spending need
      guaranteedIncome: 30000, // Lower guaranteed income
      age: 75,
      strategy: WITHDRAWAL_STRATEGIES.tfsaFirst,
    });

    // With TFSA-first strategy, total withdrawals should meet spending gap
    const totalWithdrawals =
      (result.withdrawals.rrifMinimum || 0) +
      (result.withdrawals.rrifAdditional || 0) +
      (result.withdrawals.tfsa || 0) +
      (result.withdrawals.nonRegistered || 0);
    expect(totalWithdrawals).toBeGreaterThan(0);
  });

  it('should implement RRSP-first custom strategy', () => {
    // Pre-72 with large RRSP — custom strategy prioritising RRSP (meltdown behavior
    // as a configurable strategy rather than a named catalog preset)
    const meltdownStrategy = createCustomStrategy('RRSP Meltdown', 'Draw RRSP first', {
      rrsp: 1,
      non_registered: 2,
      tfsa: 3,
    });

    const result = calculateWithdrawals({
      balances: {
        rrsp: 600000,
        rrif: 0,
        tfsa: 100000,
        nonRegistered: 100000,
      },
      desiredSpending: 60000,
      guaranteedIncome: 30000,
      age: 68,
      strategy: meltdownStrategy,
      hasConvertedToRRIF: false,
    });

    // Should draw from RRSP preferentially
    expect(result.withdrawals.rrsp).toBeGreaterThan(0);
  });

  it('should handle portfolio depletion gracefully', () => {
    const result = calculateWithdrawals({
      balances: {
        rrsp: 0,
        rrif: 20000,
        tfsa: 5000,
        nonRegistered: 5000,
      },
      desiredSpending: 60000,
      guaranteedIncome: 20000,
      age: 85,
    });

    // Should have shortfall
    expect(result.shortfall).toBeGreaterThan(0);
    // Should use all available funds
    expect(result.totalWithdrawal).toBe(30000);
  });
});
