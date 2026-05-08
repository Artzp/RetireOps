/**
 * Unit tests for the pure TFSA withdrawal strategy.
 *
 * Phase 9 Wave 2 (09-04): proves `withdrawFromTFSA` matches the locked
 * strategy contract from 09-01 and preserves the byte-identical behavior
 * of the inline TFSA block previously living inside `withdrawFrom` and
 * `withdrawFromP` in `yearly-calculator.ts`.
 *
 * SCOPE NOTE: This strategy handles ONLY TFSA WITHDRAWALS. TFSA contributions
 * (Step 3 of the orchestrator), bracket-fill TFSA deposits, and surplus-routing
 * TFSA deposits remain inline in `yearly-calculator.ts` — they are deposit-side
 * concerns, not strategy concerns.
 *
 * CARDINAL PROPERTY: TFSA withdrawals are TAX-FREE. Every result MUST have
 * `taxableIncome === 0` AND `gainsRealized === 0`, regardless of amount.
 * Test 3 pins this property across a wide range of inputs.
 *
 * @see .planning/phases/09-yearly-calculator-decomposition/09-04-PLAN.md
 * @see docs/source-of-truth/02-account-types.md - TFSA-001, TC-ACCT-003
 */
import { describe, it, expect } from 'vitest';

import { withdrawFromTFSA } from './tfsa.js';
import type { WithdrawalRequest, AccountState } from './index.js';
import { processTFSAWithdrawal } from '../../accounts/tfsa.js';

describe('strategies/tfsa — withdrawFromTFSA (Phase 9 Wave 2 / 09-04)', () => {
  it('happy-path: requested < balance returns exact amount with taxableIncome=0', () => {
    // Test 1: behavior parity with `const take = Math.min(amount, currentTFSA)`
    // when amount fits inside the current balance. TFSA withdrawals are tax-free.
    const request: WithdrawalRequest = { requestedAmount: 5000, year: 2026, age: 65 };
    const state: AccountState = { balance: 50000 };

    const result = withdrawFromTFSA(request, state);

    expect(result).toEqual({
      actualWithdrawn: 5000,
      clamped: false,
      taxableIncome: 0, // TFSA-001 / TC-ACCT-003: TFSA withdrawals are tax-free
      gainsRealized: 0, // No capital-gain concept on TFSA withdrawals
      newBalance: 45000,
    });
  });

  it('clamp-to-balance: requested > balance returns balance with clamped=true and taxableIncome=0', () => {
    // Test 2: behavior parity with `const take = Math.min(amount, currentTFSA)`
    // when amount exceeds the current balance — clamped to balance, account drained.
    // The cardinal tax-free property MUST hold even when clamped.
    const request: WithdrawalRequest = { requestedAmount: 80000, year: 2026, age: 65 };
    const state: AccountState = { balance: 10000 };

    const result = withdrawFromTFSA(request, state);

    expect(result).toEqual({
      actualWithdrawn: 10000,
      clamped: true,
      taxableIncome: 0, // STILL zero — clamping does not produce taxable income
      gainsRealized: 0,
      newBalance: 0,
    });
  });

  it('tax-free assertion: taxableIncome and gainsRealized are ALWAYS 0 across arbitrary amounts', () => {
    // Test 3: CARDINAL PROPERTY — TFSA withdrawals never contribute to taxable income.
    // This is the property the plan explicitly pins (TFSA-001 / TC-ACCT-003).
    // Even unrealistically large requests against a deep balance must return zero tax.
    const balance = 10_000_000;
    for (const requestedAmount of [1, 100, 10_000, 1_000_000]) {
      const request: WithdrawalRequest = { requestedAmount, year: 2026, age: 65 };
      const state: AccountState = { balance };

      const result = withdrawFromTFSA(request, state);

      expect(result.taxableIncome).toBe(0);
      expect(result.gainsRealized).toBe(0);
    }
  });

  it('zero balance: returns 0 / clamped=true / taxableIncome=0', () => {
    // Test 4: behavior parity with the early `if (take <= 0) return 0` guard
    // in the inline block — zero balance means nothing to withdraw.
    const request: WithdrawalRequest = { requestedAmount: 5000, year: 2026, age: 65 };
    const state: AccountState = { balance: 0 };

    const result = withdrawFromTFSA(request, state);

    expect(result).toEqual({
      actualWithdrawn: 0,
      clamped: true, // requested (5000) > balance (0) — clamping did happen
      taxableIncome: 0,
      gainsRealized: 0,
      newBalance: 0,
    });
  });

  it('zero request: returns 0 / clamped=false / balance preserved / taxableIncome=0', () => {
    // Test 5: behavior parity with the inline `if (amount <= 0) return 0` guard
    // and the post-clamp `if (take <= 0) return 0` guard. Zero request must
    // NOT count as a clamp (caller asked for nothing, got nothing).
    const request: WithdrawalRequest = { requestedAmount: 0, year: 2026, age: 65 };
    const state: AccountState = { balance: 5000 };

    const result = withdrawFromTFSA(request, state);

    expect(result).toEqual({
      actualWithdrawn: 0,
      clamped: false, // requested (0) is NOT > balance (5000)
      taxableIncome: 0,
      gainsRealized: 0,
      newBalance: 5000, // untouched
    });
  });

  it('delegation parity: wrapper output matches processTFSAWithdrawal exactly', () => {
    // Test 6: the strategy MUST delegate to processTFSAWithdrawal — no drift.
    // For request=1000, balance=5000 the wrapper's (actualWithdrawn, newBalance)
    // must equal processTFSAWithdrawal(5000, 1000).{withdrawalAmount, newBalance}.
    // This proves the wrapper does not introduce arithmetic drift relative to
    // the underlying account-helper, which remains the single source of truth
    // for TFSA withdrawal mechanics.
    const balance = 5000;
    const requestedAmount = 1000;
    const helperResult = processTFSAWithdrawal(balance, requestedAmount);

    const request: WithdrawalRequest = { requestedAmount, year: 2026, age: 65 };
    const state: AccountState = { balance };
    const wrapperResult = withdrawFromTFSA(request, state);

    expect(wrapperResult.actualWithdrawn).toBe(helperResult.withdrawalAmount);
    expect(wrapperResult.newBalance).toBe(helperResult.newBalance);
    // And the cardinal property:
    expect(wrapperResult.taxableIncome).toBe(0);
  });

  it('purity: does not mutate frozen inputs', () => {
    // Test 7: engine-purity contract from 09-01 — strategies MUST NOT mutate
    // their `request` or `state` arguments. Object.freeze provides a runtime
    // tripwire: any `state.balance = ...` or similar would throw in strict mode.
    const request: WithdrawalRequest = Object.freeze({
      requestedAmount: 5000,
      year: 2026,
      age: 65,
    });
    const state: AccountState = Object.freeze({ balance: 50000 });

    expect(() => withdrawFromTFSA(request, state)).not.toThrow();

    const result = withdrawFromTFSA(request, state);
    expect(result.newBalance).toBe(45000);
    // Inputs untouched.
    expect(request.requestedAmount).toBe(5000);
    expect(state.balance).toBe(50000);
  });
});
