/**
 * Unit tests for the pure RRSP withdrawal strategy.
 *
 * Phase 9 Wave 2 (09-02): proves `withdrawFromRRSP` matches the locked
 * strategy contract from 09-01 and preserves the byte-identical behavior
 * of the inline RRSP block previously living inside `withdrawFrom` and
 * `withdrawFromP` in `yearly-calculator.ts`.
 *
 * @see .planning/phases/09-yearly-calculator-decomposition/09-02-PLAN.md
 * @see docs/source-of-truth/02-account-types.md - RRSP-001, TC-ACCT-002
 */
import { describe, it, expect } from 'vitest';

import { withdrawFromRRSP } from './rrsp.js';
import type { WithdrawalRequest, AccountState } from './index.js';

describe('strategies/rrsp — withdrawFromRRSP (Phase 9 Wave 2 / 09-02)', () => {
  it('happy-path: requested < balance returns exact amount with clamped=false', () => {
    // Test 1: behavior parity with `const take = Math.min(amount, currentRRSP)`
    // when amount fits inside the current balance.
    const request: WithdrawalRequest = { requestedAmount: 5000, year: 2026, age: 65 };
    const state: AccountState = { balance: 100000 };

    const result = withdrawFromRRSP(request, state);

    expect(result).toEqual({
      actualWithdrawn: 5000,
      clamped: false,
      taxableIncome: 5000, // RRSP-001 / TC-ACCT-002: 100% taxable as income
      gainsRealized: 0, // No capital-gain concept on registered withdrawals
      newBalance: 95000,
    });
  });

  it('clamp-to-balance: requested > balance returns balance with clamped=true', () => {
    // Test 2: behavior parity with `const take = Math.min(amount, currentRRSP)`
    // when amount exceeds the current balance — clamped to balance, account drained.
    const request: WithdrawalRequest = { requestedAmount: 5000, year: 2026, age: 65 };
    const state: AccountState = { balance: 1000 };

    const result = withdrawFromRRSP(request, state);

    expect(result).toEqual({
      actualWithdrawn: 1000,
      clamped: true,
      taxableIncome: 1000,
      gainsRealized: 0,
      newBalance: 0,
    });
  });

  it('zero balance: returns 0 / clamped=true / newBalance=0', () => {
    // Test 3: behavior parity with the early `if (take <= 0) return 0` guard
    // in the inline block — zero balance means nothing to withdraw.
    const request: WithdrawalRequest = { requestedAmount: 5000, year: 2026, age: 65 };
    const state: AccountState = { balance: 0 };

    const result = withdrawFromRRSP(request, state);

    expect(result).toEqual({
      actualWithdrawn: 0,
      clamped: true, // requested (5000) > balance (0) — clamping did happen
      taxableIncome: 0,
      gainsRealized: 0,
      newBalance: 0,
    });
  });

  it('zero request: returns 0 / clamped=false / balance preserved', () => {
    // Test 4: behavior parity with the inline `if (amount <= 0) return 0` guard
    // and the post-clamp `if (take <= 0) return 0` guard. Zero request must
    // NOT count as a clamp (caller asked for nothing, got nothing).
    const request: WithdrawalRequest = { requestedAmount: 0, year: 2026, age: 65 };
    const state: AccountState = { balance: 1000 };

    const result = withdrawFromRRSP(request, state);

    expect(result).toEqual({
      actualWithdrawn: 0,
      clamped: false, // requested (0) is NOT > balance (1000)
      taxableIncome: 0,
      gainsRealized: 0,
      newBalance: 1000, // untouched
    });
  });

  it('purity: does not mutate frozen inputs', () => {
    // Test 5: engine-purity contract from 09-01 — strategies MUST NOT mutate
    // their `request` or `state` arguments. Object.freeze provides a runtime
    // tripwire: any `state.balance = ...` or similar would throw in strict mode.
    const request: WithdrawalRequest = Object.freeze({
      requestedAmount: 5000,
      year: 2026,
      age: 65,
    });
    const state: AccountState = Object.freeze({ balance: 100000 });

    expect(() => withdrawFromRRSP(request, state)).not.toThrow();

    const result = withdrawFromRRSP(request, state);
    expect(result.newBalance).toBe(95000);
    // Inputs untouched.
    expect(request.requestedAmount).toBe(5000);
    expect(state.balance).toBe(100000);
  });
});
