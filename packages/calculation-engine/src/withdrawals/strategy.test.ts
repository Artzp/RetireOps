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
