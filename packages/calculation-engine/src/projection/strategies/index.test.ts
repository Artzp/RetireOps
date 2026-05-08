/**
 * Compile-time + runtime checks for the WithdrawalStrategy registry skeleton.
 *
 * Phase 9 Wave 1: this file proves the public surface compiles and that
 * the registry exposes exactly the five locked account-type keys with
 * placeholder strategies that throw on invocation. Wave 2 plans
 * (09-02..09-06) replace each placeholder with the real strategy.
 *
 * @see .planning/phases/09-yearly-calculator-decomposition/09-01-PLAN.md
 * @see packages/shared/src/overrides/resolve.ts (canonical mirror)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  STRATEGY_REGISTRY,
  getWithdrawalStrategy,
  type WithdrawalStrategy,
  type WithdrawalRequest,
  type AccountState,
  type StrategyResult,
  type StrategyAccountType,
} from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(__dirname, 'index.ts');
const source = readFileSync(sourcePath, 'utf-8');

describe('strategies/index — interface + registry skeleton (Phase 9 Wave 1)', () => {
  it('exports the locked public surface (compile-time check)', () => {
    // Test 1: each of the seven exports is referenced above; if any name
    // disappears from index.ts the import statement above stops compiling.
    // Runtime sanity: the value-level exports exist.
    expect(typeof STRATEGY_REGISTRY).toBe('object');
    expect(typeof getWithdrawalStrategy).toBe('function');

    // Type-only assertions — these never run, but must typecheck. Keeping
    // them inside the test body anchors the type names so tsc cannot strip
    // the imports as unused.
    const _request: WithdrawalRequest = { requestedAmount: 0, year: 2026, age: 65 };
    const _state: AccountState = { balance: 0 };
    const _result: StrategyResult = {
      actualWithdrawn: 0,
      clamped: false,
      taxableIncome: 0,
      gainsRealized: 0,
      newBalance: 0,
    };
    const _strategy: WithdrawalStrategy = () => _result;
    const _key: StrategyAccountType = 'rrsp';
    expect(_strategy(_request, _state)).toBe(_result);
    expect(_key).toBe('rrsp');
  });

  it('registry has exactly the five locked account-type keys', () => {
    // Test 2: shape lock — Wave 2 plans depend on these five keys.
    expect(Object.keys(STRATEGY_REGISTRY).sort()).toEqual([
      'lif',
      'nonReg',
      'rrif',
      'rrsp',
      'tfsa',
    ]);
  });

  it('getWithdrawalStrategy returns a function for every account type', () => {
    // Test 3: lookup symmetry with resolveActiveWithdrawalOverride.
    const types: StrategyAccountType[] = ['rrsp', 'rrif', 'tfsa', 'nonReg', 'lif'];
    for (const type of types) {
      const strategy = getWithdrawalStrategy(type);
      expect(typeof strategy).toBe('function');
    }
  });

  it('every strategy in the registry is a real, callable implementation (Wave 2 complete)', () => {
    // Test 4: as of Wave 2 close (09-06), there are NO placeholders left.
    // Every key in the registry maps to a real, pure WithdrawalStrategy
    // function. The previous "throws on placeholder" assertion is gone —
    // it tested a property of the Wave 1 skeleton that no longer holds.
    //
    // Replacement assertion: every registry entry, invoked with a benign
    // zero-input request and an empty state, returns a well-shaped
    // StrategyResult (NOT throws). This is the strongest invariant
    // available now that all five strategies are real.
    const wiredTypes: StrategyAccountType[] = ['rrsp', 'rrif', 'tfsa', 'nonReg', 'lif']; // 09-02..09-06 — all wired.
    const request: WithdrawalRequest = { requestedAmount: 0, year: 2026, age: 65 };
    const state: AccountState = { balance: 0 };

    for (const type of wiredTypes) {
      const strategy = getWithdrawalStrategy(type);
      expect(() => strategy(request, state)).not.toThrow();
      const result = strategy(request, state);
      // Shape lock: every strategy returns the same five required fields.
      // (newACB is optional — only NonReg populates it.)
      expect(result).toMatchObject({
        actualWithdrawn: 0,
        clamped: false, // requested (0) is NOT > balance (0).
        taxableIncome: 0,
        gainsRealized: 0,
        newBalance: 0,
      });
    }
  });

  it('all five wired strategies produce zero-shaped results for zero-input (Wave 2 complete)', () => {
    // Companion to Test 4: explicit Wave 2 close marker. By the time 09-06
    // lands, every Wave 2 strategy is wired. This list is the canonical
    // wired-strategies guard the Wave 3 cleanup plan (09-07) reads.
    const wiredTypes: StrategyAccountType[] = ['rrsp', 'rrif', 'tfsa', 'nonReg', 'lif'];
    const request: WithdrawalRequest = { requestedAmount: 0, year: 2026, age: 65 };
    const state: AccountState = { balance: 0 };

    for (const type of wiredTypes) {
      const strategy = getWithdrawalStrategy(type);
      expect(() => strategy(request, state)).not.toThrow();
    }
  });

  it('source file contains zero engine-impurity tokens (Date.now / Math.random)', () => {
    // Test 5: engine purity grep gate. Mirrors packages/shared/src/overrides/resolve.ts
    // which is also pure ("CRITICAL: This module is pure. No Date.now, no Math.random, no I/O.").
    expect(source).not.toMatch(/Date\.now/);
    expect(source).not.toMatch(/Math\.random/);
  });
});
