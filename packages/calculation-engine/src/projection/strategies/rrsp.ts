/**
 * Pure calculation-engine module: RRSP withdrawal strategy.
 *
 * Extracts the inline RRSP block previously duplicated across `withdrawFrom`
 * (single-path `calculateYear`) and `withdrawFromP` (couple-path
 * `calculatePersonYear`) of `yearly-calculator.ts` into a single leaf-level
 * pure function. The strategy clamps to balance and returns the post-withdrawal
 * tax/balance descriptors; the caller (yearly-calculator) rolls those values
 * into the year's accumulators.
 *
 * Tax classification: RRSP withdrawals are 100% taxable as ordinary income
 * (RRSP-001, TC-ACCT-002). No capital-gain concept applies on registered
 * withdrawals (gainsRealized always 0).
 *
 * @see .planning/phases/09-yearly-calculator-decomposition/09-01-PLAN.md (locked contract)
 * @see .planning/phases/09-yearly-calculator-decomposition/09-02-PLAN.md (this extraction)
 * @see packages/shared/src/overrides/resolve.ts (canonical pure-module mirror)
 * @see docs/source-of-truth/02-account-types.md - RRSP-001, TC-ACCT-002
 * @see docs/source-of-truth/07-withdrawal-strategies.md
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 * Inputs MUST NOT be mutated — return new objects only.
 */

import type { WithdrawalStrategy } from './index.js';

/**
 * RRSP withdrawal strategy.
 *
 * Behavior matches the previously-inline block:
 *   const take = Math.min(amount, currentRRSP);
 *   if (take <= 0) return 0;
 *   rrspWithdrawal += take;
 *   currentRRSP -= take;
 *   return take;
 *
 * The defensive `Math.max(0, ...)` clamps mirror the caller's
 * `if (amount <= 0) return 0` early-return without changing observable
 * behavior for any non-negative input the caller passes today.
 *
 * @param request - { requestedAmount, year, age } — year/age unused for RRSP
 *                  (RRSPs have no age-banded or jurisdictional withdrawal rules).
 * @param state   - { balance } — current RRSP balance available for withdrawal.
 * @returns { actualWithdrawn, clamped, taxableIncome, gainsRealized, newBalance }
 */
export const withdrawFromRRSP: WithdrawalStrategy = (request, state) => {
  const requested = Math.max(0, request.requestedAmount);
  const balance = Math.max(0, state.balance);
  const actualWithdrawn = Math.min(requested, balance);
  const clamped = requested > balance;

  return {
    actualWithdrawn,
    clamped,
    taxableIncome: actualWithdrawn, // RRSP-001 / TC-ACCT-002: 100% taxable as income.
    gainsRealized: 0, // No capital-gain concept on registered withdrawals.
    newBalance: balance - actualWithdrawn,
  };
};
