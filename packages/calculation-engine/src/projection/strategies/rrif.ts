/**
 * Pure calculation-engine module: RRIF additional-withdrawal strategy.
 *
 * Extracts the inline RRIF block previously duplicated across `withdrawFrom`
 * (single-path `calculateYear`) and `withdrawFromP` (couple-path
 * `calculatePersonYear`) of `yearly-calculator.ts` into a single leaf-level
 * pure function. The strategy clamps to balance and returns the post-withdrawal
 * tax/balance descriptors; the caller (yearly-calculator) rolls those values
 * into the year's `additionalRRIFWithdrawal` accumulator (kept distinct from
 * the mandatory-minimum accumulator, `rrifWithdrawal`).
 *
 * SCOPE — what this strategy does NOT do:
 *   - It does NOT compute the RRIF mandatory minimum. That is age-driven
 *     (CRA Reg. 7308 minimum-factor table) and is calculated BEFORE the
 *     drawdown loop in the orchestrator's Step 5 via
 *     `calculateRRIFMinimumWithdrawal` / `calculateRRIFMinimumWithYoungerSpouse`
 *     in `accounts/rrif.ts`. The minimum stays inline in `yearly-calculator.ts`.
 *   - It does NOT perform OAS-clawback-avoidance trimming. That trim runs
 *     AFTER the drawdown loop and only touches the additional accumulator,
 *     never the strategy.
 *   - It does NOT reach into override accumulators (`overrideAccs.rrifAdditional`).
 *     The override-injection pass has its own pure path.
 *
 * Tax classification: RRIF withdrawals (minimum AND additional) are 100%
 * taxable as ordinary income (RRIF-001, TC-ACCT-002). No capital-gain concept
 * applies on registered withdrawals (gainsRealized always 0). The caller,
 * however, only adds the strategy's `taxableIncome` to the additional
 * accumulator — the minimum's taxability is bookkept separately by Step 5.
 *
 * @see .planning/phases/09-yearly-calculator-decomposition/09-01-PLAN.md (locked contract)
 * @see .planning/phases/09-yearly-calculator-decomposition/09-03-PLAN.md (this extraction)
 * @see packages/shared/src/overrides/resolve.ts (canonical pure-module mirror)
 * @see packages/calculation-engine/src/projection/strategies/rrsp.ts (sibling — same shape)
 * @see docs/source-of-truth/02-account-types.md - RRIF-001, TC-ACCT-002
 * @see docs/source-of-truth/07-withdrawal-strategies.md
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 * Inputs MUST NOT be mutated — return new objects only.
 */

import type { WithdrawalStrategy } from './index.js';

/**
 * RRIF additional-withdrawal strategy.
 *
 * Behavior matches the previously-inline block:
 *   const take = Math.min(amount, currentRRIF);
 *   if (take <= 0) return 0;
 *   additionalRRIFWithdrawal += take;
 *   currentRRIF -= take;
 *   return take;
 *
 * The defensive `Math.max(0, ...)` clamps mirror the caller's
 * `if (amount <= 0) return 0` early-return without changing observable
 * behavior for any non-negative input the caller passes today.
 *
 * @param request - { requestedAmount, year, age } — year/age unused for the
 *                  ADDITIONAL withdrawal (the age-banded minimum-factor lookup
 *                  happens upstream in Step 5 of the orchestrator, not here).
 * @param state   - { balance } — current RRIF balance available for additional
 *                  withdrawal (already net of the year's mandatory minimum).
 * @returns { actualWithdrawn, clamped, taxableIncome, gainsRealized, newBalance }
 */
export const withdrawFromRRIF: WithdrawalStrategy = (request, state) => {
  const requested = Math.max(0, request.requestedAmount);
  const balance = Math.max(0, state.balance);
  const actualWithdrawn = Math.min(requested, balance);
  const clamped = requested > balance;

  return {
    actualWithdrawn,
    clamped,
    taxableIncome: actualWithdrawn, // RRIF-001 / TC-ACCT-002: 100% taxable as income.
    gainsRealized: 0, // No capital-gain concept on registered withdrawals.
    newBalance: balance - actualWithdrawn,
  };
};
