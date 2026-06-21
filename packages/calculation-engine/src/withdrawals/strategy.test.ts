/**
 * Withdrawal Strategy adapter tests
 *
 * Exercises the two new exports that bridge the catalog to the engine:
 *   - accountPriorityToDrawdownOrder — catalog priority map → engine drawdown keys
 *   - resolveDrawdownOrder — explicit order > strategyId preset > 'standard' default
 */
import { describe, it, expect } from 'vitest';
import {
  WITHDRAWAL_STRATEGIES,
  accountPriorityToDrawdownOrder,
  resolveDrawdownOrder,
  getWithdrawalStrategy,
  getWithdrawalOrder,
  shouldWithdrawFromAccount,
  createCustomStrategy,
} from './strategy.js';

describe('accountPriorityToDrawdownOrder', () => {
  it('maps standard preset to legacy default order, dropping LIF/LIRA/FHSA', () => {
    const out = accountPriorityToDrawdownOrder(WITHDRAWAL_STRATEGIES.standard.accountPriority);
    expect(out).toEqual(['nonReg', 'rrif', 'rrsp', 'tfsa']);
  });

  it('maps tfsaFirst preset with TFSA leading', () => {
    const out = accountPriorityToDrawdownOrder(WITHDRAWAL_STRATEGIES.tfsaFirst.accountPriority);
    expect(out).toEqual(['tfsa', 'nonReg', 'rrif', 'rrsp']);
  });

  it('maps bracketFilling preset to the canonical standard order', () => {
    const out = accountPriorityToDrawdownOrder(
      WITHDRAWAL_STRATEGIES.bracketFilling.accountPriority
    );
    expect(out).toEqual(['nonReg', 'rrif', 'rrsp', 'tfsa']);
  });

  it('maps non_registered → nonReg', () => {
    const out = accountPriorityToDrawdownOrder({
      non_registered: 1,
      rrsp: 2,
      rrif: 3,
      tfsa: 4,
      lira: 5,
      lif: 6,
      fhsa: 7,
    });
    expect(out[0]).toBe('nonReg');
  });

  it('drops LIF, LIRA, and FHSA — the gap-fill drawdown loop does not consume them', () => {
    const out = accountPriorityToDrawdownOrder({
      non_registered: 1,
      rrsp: 2,
      rrif: 3,
      tfsa: 4,
      lira: 5,
      lif: 6,
      fhsa: 7,
    });
    expect(out).not.toContain('lif');
    expect(out).not.toContain('lira');
    expect(out).not.toContain('fhsa');
    expect(out).toHaveLength(4);
  });

  it('resolves ties by Object.entries insertion order', () => {
    const out = accountPriorityToDrawdownOrder({
      non_registered: 2,
      rrsp: 2,
      rrif: 2,
      tfsa: 2,
      lira: 9,
      lif: 9,
      fhsa: 9,
    });
    expect(out).toEqual(['nonReg', 'rrsp', 'rrif', 'tfsa']);
  });
});

describe('resolveDrawdownOrder', () => {
  it('returns explicit drawdownOrder when provided (wins over strategyId)', () => {
    const explicit = ['tfsa', 'nonReg'];
    const out = resolveDrawdownOrder({ drawdownOrder: explicit, strategyId: 'standard' });
    expect(out).toBe(explicit);
  });

  it('ignores empty drawdownOrder array and falls through to strategyId', () => {
    const out = resolveDrawdownOrder({ drawdownOrder: [], strategyId: 'tfsaFirst' });
    expect(out).toEqual(['tfsa', 'nonReg', 'rrif', 'rrsp']);
  });

  it('returns catalog-derived order when only strategyId is supplied', () => {
    expect(resolveDrawdownOrder({ strategyId: 'tfsaFirst' })).toEqual([
      'tfsa',
      'nonReg',
      'rrif',
      'rrsp',
    ]);
    expect(resolveDrawdownOrder({ strategyId: 'oasProtection' })).toEqual([
      'tfsa',
      'nonReg',
      'rrif',
      'rrsp',
    ]);
    expect(resolveDrawdownOrder({ strategyId: 'bracketFilling' })).toEqual([
      'nonReg',
      'rrif',
      'rrsp',
      'tfsa',
    ]);
  });

  it('defaults to the standard preset when neither field is supplied — matches legacy hardcoded fallback', () => {
    expect(resolveDrawdownOrder({})).toEqual(['nonReg', 'rrif', 'rrsp', 'tfsa']);
  });
});

// Catalog/helper tests preserved from the removed withdrawals.test.ts
// (audit Batch 7 — calculator.ts/optimizer.ts deleted; strategy.ts is live).
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
