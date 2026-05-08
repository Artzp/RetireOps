/**
 * Unit tests for the pure RRIF additional-withdrawal strategy.
 *
 * Phase 9 Wave 2 (09-03): proves `withdrawFromRRIF` matches the locked
 * strategy contract from 09-01 and preserves the byte-identical behavior
 * of the inline RRIF additional-withdrawal block previously living inside
 * `withdrawFrom` and `withdrawFromP` in `yearly-calculator.ts`.
 *
 * SCOPE NOTE: This strategy handles ONLY discretionary RRIF withdrawals
 * ABOVE the mandatory minimum. The RRIF mandatory minimum is age-driven
 * and stays in the orchestrator's Step 5 (calculated by
 * `calculateRRIFMinimumWithdrawal` from `accounts/rrif.ts`). It is NOT
 * a strategy concern.
 *
 * @see .planning/phases/09-yearly-calculator-decomposition/09-03-PLAN.md
 * @see docs/source-of-truth/02-account-types.md - RRIF-001, TC-ACCT-002
 */
import { describe, it, expect } from 'vitest';

import { withdrawFromRRIF } from './rrif.js';
import type { WithdrawalRequest, AccountState } from './index.js';

describe('strategies/rrif — withdrawFromRRIF (Phase 9 Wave 2 / 09-03)', () => {
  it('happy-path: requested < balance returns exact amount with clamped=false', () => {
    // Test 1: behavior parity with `const take = Math.min(amount, currentRRIF)`
    // when amount fits inside the current balance (post-minimum balance).
    const request: WithdrawalRequest = { requestedAmount: 8000, year: 2026, age: 72 };
    const state: AccountState = { balance: 200000 };

    const result = withdrawFromRRIF(request, state);

    expect(result).toEqual({
      actualWithdrawn: 8000,
      clamped: false,
      taxableIncome: 8000, // RRIF-001 / TC-ACCT-002: 100% taxable as income
      gainsRealized: 0, // No capital-gain concept on registered withdrawals
      newBalance: 192000,
    });
  });

  it('clamp-to-balance: requested > balance returns balance with clamped=true', () => {
    // Test 2: behavior parity with `const take = Math.min(amount, currentRRIF)`
    // when amount exceeds the current balance — clamped to balance, account drained.
    const request: WithdrawalRequest = { requestedAmount: 50000, year: 2026, age: 72 };
    const state: AccountState = { balance: 10000 };

    const result = withdrawFromRRIF(request, state);

    expect(result).toEqual({
      actualWithdrawn: 10000,
      clamped: true,
      taxableIncome: 10000,
      gainsRealized: 0,
      newBalance: 0,
    });
  });

  it('zero balance: returns 0 / clamped=true / newBalance=0', () => {
    // Test 3: behavior parity with the early `if (take <= 0) return 0` guard
    // in the inline block — zero balance means nothing to withdraw.
    const request: WithdrawalRequest = { requestedAmount: 5000, year: 2026, age: 72 };
    const state: AccountState = { balance: 0 };

    const result = withdrawFromRRIF(request, state);

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
    const request: WithdrawalRequest = { requestedAmount: 0, year: 2026, age: 72 };
    const state: AccountState = { balance: 5000 };

    const result = withdrawFromRRIF(request, state);

    expect(result).toEqual({
      actualWithdrawn: 0,
      clamped: false, // requested (0) is NOT > balance (5000)
      taxableIncome: 0,
      gainsRealized: 0,
      newBalance: 5000, // untouched
    });
  });

  it('purity: does not mutate frozen inputs', () => {
    // Test 5: engine-purity contract from 09-01 — strategies MUST NOT mutate
    // their `request` or `state` arguments. Object.freeze provides a runtime
    // tripwire: any `state.balance = ...` or similar would throw in strict mode.
    const request: WithdrawalRequest = Object.freeze({
      requestedAmount: 8000,
      year: 2026,
      age: 72,
    });
    const state: AccountState = Object.freeze({ balance: 200000 });

    expect(() => withdrawFromRRIF(request, state)).not.toThrow();

    const result = withdrawFromRRIF(request, state);
    expect(result.newBalance).toBe(192000);
    // Inputs untouched.
    expect(request.requestedAmount).toBe(8000);
    expect(state.balance).toBe(200000);
  });
});
