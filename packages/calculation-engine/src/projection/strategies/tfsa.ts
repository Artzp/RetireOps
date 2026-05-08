/**
 * Pure calculation-engine module: TFSA withdrawal strategy.
 *
 * Extracts the inline TFSA block previously duplicated across `withdrawFrom`
 * (single-path `calculateYear`) and `withdrawFromP` (couple-path
 * `calculatePersonYear`) of `yearly-calculator.ts` into a single leaf-level
 * pure function. The strategy is a THIN WRAPPER over `processTFSAWithdrawal`
 * from `accounts/tfsa.ts` — the helper remains the single source of truth
 * for TFSA withdrawal mechanics; the strategy adapts the helper's
 * `{ withdrawalAmount, newBalance }` shape to the locked `StrategyResult`
 * contract from 09-01.
 *
 * SCOPE — what this strategy does NOT do:
 *   - It does NOT handle TFSA contributions. Contributions live at Step 3
 *     of the orchestrator and continue to call `processTFSAContribution`
 *     inline. A withdrawal-side strategy is the wrong abstraction for the
 *     deposit-side contribution-room bookkeeping.
 *   - It does NOT handle the bracket-fill TFSA deposit (a contribution-direction
 *     surplus sweep that lives downstream of the drawdown loop).
 *   - It does NOT handle surplus-routing TFSA deposits.
 *   - It does NOT plumb `availableTfsaContributionRoom` — that stays in the
 *     orchestrator alongside the other contribution accumulators.
 *
 * Tax classification: TFSA withdrawals are TAX-FREE. `taxableIncome` is
 * hardcoded to `0` and `gainsRealized` is hardcoded to `0` regardless of
 * amount. This is the cardinal property pinned by `tfsa.test.ts` Test 3.
 *
 * @see .planning/phases/09-yearly-calculator-decomposition/09-01-PLAN.md (locked contract)
 * @see .planning/phases/09-yearly-calculator-decomposition/09-04-PLAN.md (this extraction)
 * @see packages/shared/src/overrides/resolve.ts (canonical pure-module mirror)
 * @see packages/calculation-engine/src/projection/strategies/rrsp.ts (sibling — same contract)
 * @see packages/calculation-engine/src/projection/strategies/rrif.ts (sibling — same contract)
 * @see packages/calculation-engine/src/accounts/tfsa.ts (delegated helper)
 * @see docs/source-of-truth/02-account-types.md - TFSA-001, TC-ACCT-003
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 * Inputs MUST NOT be mutated — return new objects only. The delegated
 * `processTFSAWithdrawal` helper is itself pure (verified by reading
 * `accounts/tfsa.ts` — only `Math.min` arithmetic on its arguments).
 */

import type { WithdrawalStrategy } from './index.js';
import { processTFSAWithdrawal } from '../../accounts/tfsa.js';

/**
 * TFSA withdrawal strategy.
 *
 * Behavior matches the previously-inline block:
 *   const take = Math.min(amount, currentTFSA);
 *   if (take <= 0) return 0;
 *   const tfsaResult = processTFSAWithdrawal(currentTFSA, take);
 *   tfsaWithdrawal += tfsaResult.withdrawalAmount;
 *   currentTFSA = tfsaResult.newBalance;
 *   return tfsaResult.withdrawalAmount;
 *
 * The defensive `Math.max(0, ...)` clamps mirror the caller's
 * `if (amount <= 0) return 0` early-return without changing observable
 * behavior for any non-negative input the caller passes today.
 *
 * The wrapper delegates to `processTFSAWithdrawal(balance, take)` on the
 * main path, preserving that helper as the canonical TFSA withdrawal
 * primitive. The early-return path (`take <= 0`) does NOT call the helper
 * because the helper would itself return zero — the early return matches
 * the inline block's `if (take <= 0) return 0` short-circuit.
 *
 * @param request - { requestedAmount, year, age } — year/age unused for TFSA
 *                  (TFSA withdrawals have no age-banded or jurisdictional
 *                  rules; the age-18 contribution-eligibility check lives
 *                  on the contribution side, not the withdrawal side).
 * @param state   - { balance } — current TFSA balance available for withdrawal.
 * @returns { actualWithdrawn, clamped, taxableIncome: 0, gainsRealized: 0, newBalance }
 */
export const withdrawFromTFSA: WithdrawalStrategy = (request, state) => {
  const requested = Math.max(0, request.requestedAmount);
  const balance = Math.max(0, state.balance);
  const take = Math.min(requested, balance);

  if (take <= 0) {
    return {
      actualWithdrawn: 0,
      // "clamped" means: caller asked for something but couldn't fulfill.
      // Zero request → not clamped (caller asked for nothing, got nothing).
      // Positive request against zero balance → clamped (caller asked, got nothing).
      clamped: requested > 0 && balance === 0,
      taxableIncome: 0, // TFSA-001 / TC-ACCT-003: TFSA withdrawals are tax-free.
      gainsRealized: 0, // No capital-gain concept on TFSA withdrawals.
      newBalance: balance,
    };
  }

  const result = processTFSAWithdrawal(balance, take);

  return {
    actualWithdrawn: result.withdrawalAmount,
    clamped: requested > balance,
    taxableIncome: 0, // TFSA-001 / TC-ACCT-003: TFSA withdrawals are tax-free.
    gainsRealized: 0, // No capital-gain concept on TFSA withdrawals.
    newBalance: result.newBalance,
  };
};
