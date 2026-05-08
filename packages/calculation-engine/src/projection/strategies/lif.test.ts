/**
 * Unit tests for the pure LIF additional-withdrawal strategy.
 *
 * Phase 9 Wave 2 (09-06 — final): proves `withdrawFromLIF` matches the locked
 * strategy contract from 09-01 and preserves the byte-identical behavior of
 * the post-loop additional-LIF block previously living inside `withdrawFromP`
 * in `yearly-calculator.ts` (couple path; the legacy single path has no LIF).
 *
 * Distinguishing property vs RRSP/RRIF/TFSA/NonReg: LIF has a JURISDICTIONAL
 * MAXIMUM cap. The strategy clamps to `min(balance, lifMaximumAllowed)` —
 * NOT just balance. Test 3 (clamp-to-maximum) is the LIF-specific gate that
 * RRSP/RRIF/TFSA/NonReg have no analog for.
 *
 * Caller contract (orchestrator pre-subtracts already-taken amounts):
 *   The caller passes `lifMaximumAllowed` AS THE REMAINING CAP for THIS call
 *   (i.e., gross max minus already-taken-this-year). This keeps the strategy
 *   stateless w.r.t. accumulators while preserving the inline block's math.
 *   See lif.ts banner for the equivalence proof.
 *
 * @see .planning/phases/09-yearly-calculator-decomposition/09-06-PLAN.md
 * @see docs/source-of-truth/02-account-types.md - LIF-001, TC-ACCT-002
 * @see docs/source-of-truth/12-advanced-accounts.md - jurisdictional max factors
 */
import { describe, it, expect } from 'vitest';

import { withdrawFromLIF } from './lif.js';
import type { WithdrawalRequest, AccountState } from './index.js';

describe('strategies/lif — withdrawFromLIF (Phase 9 Wave 2 / 09-06 — final)', () => {
  it('happy-path within max: requested < balance AND requested < max returns exact amount', () => {
    // Test 1: behavior parity with the inline block when the request fits
    // comfortably within both the balance and the remaining jurisdictional cap.
    const request: WithdrawalRequest = { requestedAmount: 8000, year: 2026, age: 72 };
    const state: AccountState = { balance: 200000, lifMaximumAllowed: 12000 };

    const result = withdrawFromLIF(request, state);

    expect(result).toEqual({
      actualWithdrawn: 8000,
      clamped: false,
      taxableIncome: 8000, // LIF-001 / TC-ACCT-002: 100% taxable as ordinary income.
      gainsRealized: 0, // No capital-gain concept on registered withdrawals.
      newBalance: 192000,
    });
  });

  it('clamp-to-balance: requested > balance (balance is binding) returns balance with clamped=true', () => {
    // Test 2: balance is the binding constraint (LIF max is bigger than balance).
    // Mirrors the inline `availableForAdditional = Math.min(currentLIF, ...)` arm
    // where `currentLIF` is the smaller value.
    const request: WithdrawalRequest = { requestedAmount: 8000, year: 2026, age: 72 };
    const state: AccountState = { balance: 5000, lifMaximumAllowed: 12000 };

    const result = withdrawFromLIF(request, state);

    expect(result).toEqual({
      actualWithdrawn: 5000,
      clamped: true,
      taxableIncome: 5000,
      gainsRealized: 0,
      newBalance: 0,
    });
  });

  it('clamp-to-maximum (LIF-specific): requested > max (max is binding) returns max with clamped=true', () => {
    // Test 3: THE LIF-DISTINGUISHING TEST — RRSP/RRIF/TFSA/NonReg have no
    // analogous max cap. Mirrors the inline `availableForAdditional =
    // Math.min(currentLIF, lifMaximumAllowed - lifWithdrawal)` arm where
    // `lifMaximumAllowed - lifWithdrawal` is the smaller value AND the
    // remainingGap exceeds it.
    const request: WithdrawalRequest = { requestedAmount: 20000, year: 2026, age: 72 };
    const state: AccountState = { balance: 200000, lifMaximumAllowed: 12000 };

    const result = withdrawFromLIF(request, state);

    expect(result).toEqual({
      actualWithdrawn: 12000,
      clamped: true,
      taxableIncome: 12000,
      gainsRealized: 0,
      newBalance: 188000,
    });
  });

  it('clamp-to-min(balance, max): both constraints bind; balance smaller than max', () => {
    // Test 4: confirms `available = Math.min(balance, remainingMax)` reduces
    // to the balance branch when balance is smaller. Identical math to Test 2
    // but with a request large enough to expose the min() ordering.
    const request: WithdrawalRequest = { requestedAmount: 20000, year: 2026, age: 72 };
    const state: AccountState = { balance: 8000, lifMaximumAllowed: 12000 };

    const result = withdrawFromLIF(request, state);

    expect(result).toEqual({
      actualWithdrawn: 8000, // balance is the binding constraint.
      clamped: true,
      taxableIncome: 8000,
      gainsRealized: 0,
      newBalance: 0,
    });
  });

  it('zero remaining max (caller pre-subtracted full cap): returns 0 with clamped=true', () => {
    // Test 5: pins the caller's contract. When the orchestrator passes
    // `remainingCap = lifMaximumAllowed - lifWithdrawal - additionalLIFWithdrawalFromOverride`
    // and that arithmetic produces 0 (e.g., the override pass already consumed
    // the full year's cap), the strategy must return 0 — NOT the balance —
    // because the jurisdictional cap binds at 0.
    const request: WithdrawalRequest = { requestedAmount: 5000, year: 2026, age: 72 };
    const state: AccountState = { balance: 200000, lifMaximumAllowed: 0 };

    const result = withdrawFromLIF(request, state);

    expect(result).toEqual({
      actualWithdrawn: 0,
      clamped: true, // requested (5000) > available (0) — clamping did happen.
      taxableIncome: 0,
      gainsRealized: 0,
      newBalance: 200000, // untouched.
    });
  });

  it('zero balance: returns 0 / clamped=true / newBalance=0', () => {
    // Test 6: behavior parity with the inline `if (currentLIF > 0)` guard.
    // Zero balance = nothing to withdraw, regardless of max.
    const request: WithdrawalRequest = { requestedAmount: 5000, year: 2026, age: 72 };
    const state: AccountState = { balance: 0, lifMaximumAllowed: 12000 };

    const result = withdrawFromLIF(request, state);

    expect(result).toEqual({
      actualWithdrawn: 0,
      clamped: true, // requested (5000) > available (0) — clamping did happen.
      taxableIncome: 0,
      gainsRealized: 0,
      newBalance: 0,
    });
  });

  it('zero request: returns 0 / clamped=false / balance preserved', () => {
    // Test 7: behavior parity with the inline `if (remainingGap > 0)` guard.
    // Zero request must NOT count as a clamp (caller asked for nothing,
    // got nothing — same convention as the other four strategies).
    const request: WithdrawalRequest = { requestedAmount: 0, year: 2026, age: 72 };
    const state: AccountState = { balance: 200000, lifMaximumAllowed: 12000 };

    const result = withdrawFromLIF(request, state);

    expect(result).toEqual({
      actualWithdrawn: 0,
      clamped: false, // requested (0) is NOT > available (12000).
      taxableIncome: 0,
      gainsRealized: 0,
      newBalance: 200000, // untouched.
    });
  });

  it('purity: does not mutate frozen inputs', () => {
    // Test 8: engine-purity contract from 09-01 — strategies MUST NOT mutate
    // their `request` or `state` arguments. Object.freeze provides a runtime
    // tripwire: any `state.balance = ...` or `state.lifMaximumAllowed = ...`
    // would throw in strict mode.
    const request: WithdrawalRequest = Object.freeze({
      requestedAmount: 8000,
      year: 2026,
      age: 72,
    });
    const state: AccountState = Object.freeze({
      balance: 200000,
      lifMaximumAllowed: 12000,
    });

    expect(() => withdrawFromLIF(request, state)).not.toThrow();

    const result = withdrawFromLIF(request, state);
    expect(result.newBalance).toBe(192000);
    expect(result.actualWithdrawn).toBe(8000);
    // Inputs untouched.
    expect(request.requestedAmount).toBe(8000);
    expect(state.balance).toBe(200000);
    expect(state.lifMaximumAllowed).toBe(12000);
  });
});
