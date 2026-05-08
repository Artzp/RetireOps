/**
 * Pure calculation-engine module: LIF additional-withdrawal strategy.
 *
 * Extracts the post-loop additional-LIF block previously living inside
 * `withdrawFromP` (couple-path `calculatePersonYear`) of `yearly-calculator.ts`
 * into a single leaf-level pure function. Unlike the other four strategies
 * (RRSP / RRIF / TFSA / NonReg) which sit INSIDE the per-key drawdown
 * dispatch, LIF is "handled separately, not in drawdown order" — the inline
 * block runs AFTER the gap-fill loop because LIF has a JURISDICTIONAL
 * MAXIMUM cap that the loop cannot enforce mid-stride.
 *
 * The single path (`calculateYear`) declares `currentLIF: 0,
 * lifMaximumAllowed: 0` (legacy path has no LIF) — the strategy is
 * registered but never invoked from the single path. Only the couple
 * path's post-loop block (replaced in this plan) calls it.
 *
 * SCOPE — what this strategy does NOT do:
 *   - It does NOT compute the LIF MINIMUM withdrawal. That is age-banded
 *     (CRA Reg. 7308 minimum-factor table, same as RRIF) and lives in
 *     Step 5b of the orchestrator (`calculateLIFMinimumWithdrawal` /
 *     `calculateLIFMinimumWithYoungerSpouse`). Mandatory; not discretionary.
 *   - It does NOT compute the LIF MAXIMUM (the jurisdictional cap). That
 *     also lives in Step 5b of the orchestrator (`getLIFWithdrawalLimits`).
 *     The strategy RECEIVES the already-computed max via state.
 *   - It does NOT handle LIRA→LIF conversion. That is a one-time event
 *     in Step 2b of the orchestrator, not a withdrawal.
 *   - It does NOT reach into override accumulators
 *     (`overrideAccs.lifAdditional`). The override-injection pass at
 *     `applyWithdrawalOverrides` has its own pure path and consumes the
 *     gross max directly. The orchestrator pre-subtracts that override-take
 *     from the cap it passes to this strategy.
 *
 * Caller contract — the REMAINING-cap convention:
 *   The caller passes `state.lifMaximumAllowed` AS THE REMAINING CAP for
 *   THIS call (i.e., gross jurisdictional max minus already-taken-this-year:
 *   `lifMaximumAllowed - lifWithdrawal - additionalLIFWithdrawalFromOverride`).
 *   This keeps the strategy stateless w.r.t. accumulators while preserving
 *   the inline block's math byte-equivalently.
 *
 *   Equivalence proof vs the original inline block:
 *     Original (lines 1962-1968 pre-extraction):
 *       availableForAdditional = min(currentLIF, lifMaximumAllowed - lifWithdrawal)
 *       additionalLIFWithdrawal += min(remainingGap, availableForAdditional)
 *       currentLIF -= additionalLIFWithdrawal - additionalLIFWithdrawalFromOverride
 *       remainingGap -= additionalLIFWithdrawal - additionalLIFWithdrawalFromOverride
 *     Note: original did NOT subtract `additionalLIFWithdrawalFromOverride` from the
 *     cap because the override pass already deducted from `currentLIF` directly
 *     (line 492). The `- additionalLIFWithdrawalFromOverride` only appears when
 *     decrementing `currentLIF` and `remainingGap` to avoid double-deducting the
 *     override portion (`additionalLIFWithdrawal` was initialized to
 *     `additionalLIFWithdrawalFromOverride` at line 1952).
 *
 *     Refactored (this strategy + new caller):
 *       remainingCap = max(0, lifMaximumAllowed - lifWithdrawal - additionalLIFWithdrawalFromOverride)
 *       result = withdrawFromLIF({requestedAmount: remainingGap, ...}, {balance: currentLIF, lifMaximumAllowed: remainingCap})
 *       additionalLIFWithdrawal += result.actualWithdrawn  // ONLY the new take, not the override
 *       currentLIF = result.newBalance                      // strategy returns balance - take
 *       remainingGap -= result.actualWithdrawn              // ONLY the new take
 *     Note: the override portion stays in `additionalLIFWithdrawal` from its
 *     initialization to `additionalLIFWithdrawalFromOverride` BEFORE this block;
 *     `result.actualWithdrawn` is purely the NEW take this block produces. Math
 *     identical to the original.
 *
 * Tax classification (LIF-001 / TC-ACCT-002):
 *   - LIF withdrawals are 100% taxable as ordinary income, same as RRSP/RRIF.
 *     The caller rolls `result.taxableIncome` into the
 *     `totalLIFWithdrawal = lifWithdrawal + additionalLIFWithdrawal`
 *     aggregate, which flows into `taxInput.rrifIncome` (line 2097 of
 *     `yearly-calculator.ts`). The post-extraction wiring is byte-identical.
 *   - `gainsRealized = 0` — no capital-gain concept on registered withdrawals.
 *
 * Note on AccountState fields: the locked 09-01 contract reserves several
 * LIF-specific fields on AccountState (`lifJurisdiction`,
 * `useYoungerSpouseForLIF`, `spouseAge`, `lifPriorYearReturnRate`). This
 * strategy does NOT consume them — they're consumed by `getLIFWithdrawalLimits`
 * in the orchestrator's Step 5b, which produces the `lifMaximumAllowed` value
 * the strategy receives. They remain on AccountState for the contract surface
 * and any future strategy that may need them.
 *
 * @see .planning/phases/09-yearly-calculator-decomposition/09-01-PLAN.md (locked contract)
 * @see .planning/phases/09-yearly-calculator-decomposition/09-06-PLAN.md (this extraction)
 * @see packages/shared/src/overrides/resolve.ts (canonical pure-module mirror)
 * @see packages/calculation-engine/src/projection/strategies/rrsp.ts (sibling — same shape)
 * @see packages/calculation-engine/src/projection/strategies/rrif.ts (sibling — same tax classification)
 * @see packages/calculation-engine/src/accounts/lif.ts (Step 5b helpers — orchestrator-only)
 * @see docs/source-of-truth/02-account-types.md - LIF-001, TC-ACCT-002
 * @see docs/source-of-truth/12-advanced-accounts.md - jurisdictional max factors
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 * Inputs MUST NOT be mutated — return new objects only.
 */

import type { WithdrawalStrategy } from './index.js';

/**
 * LIF additional-withdrawal strategy.
 *
 * Behavior matches the previously-inline block (couple path only; legacy
 * single path has no LIF):
 *
 *   if (remainingGap > 0 && currentLIF > 0 && !tiersToSkipP.has('lif')) {
 *     const availableForAdditional = Math.min(
 *       currentLIF,
 *       lifMaximumAllowed - lifWithdrawal
 *     );
 *     if (availableForAdditional > 0) {
 *       additionalLIFWithdrawal += Math.min(remainingGap, availableForAdditional);
 *       currentLIF      -= additionalLIFWithdrawal - additionalLIFWithdrawalFromOverride;
 *       remainingGap    -= additionalLIFWithdrawal - additionalLIFWithdrawalFromOverride;
 *     }
 *   }
 *
 * The strategy's slice of that block (the inner arithmetic):
 *   const requested = Math.max(0, request.requestedAmount);   // remainingGap
 *   const balance   = Math.max(0, state.balance);             // currentLIF
 *   const remainingMax = Math.max(0, state.lifMaximumAllowed ?? 0);
 *                                                              // = lifMaximumAllowed - lifWithdrawal
 *                                                              //   - additionalLIFWithdrawalFromOverride
 *                                                              //   (caller pre-subtracts)
 *   const available = Math.min(balance, remainingMax);        // = availableForAdditional (when override=0)
 *   const actualWithdrawn = Math.min(requested, available);   // = Math.min(remainingGap, availableForAdditional)
 *
 * The caller does the `+=` / `-=` rolling against its own accumulators with
 * `result.actualWithdrawn` (the NEW take only).
 *
 * @param request - { requestedAmount, year, age } — year/age unused for the
 *                  ADDITIONAL withdrawal (the age-banded minimum-factor + max
 *                  lookup happens upstream in Step 5b of the orchestrator).
 * @param state   - { balance, lifMaximumAllowed } — current LIF balance and
 *                  the REMAINING jurisdictional cap (caller pre-subtracted
 *                  any minimum + override take from the gross max).
 * @returns { actualWithdrawn, clamped, taxableIncome, gainsRealized, newBalance }
 *
 *   - `actualWithdrawn = min(requested, balance, remainingMax)`.
 *   - `clamped = requested > available` (where available = min(balance, remainingMax)).
 *   - `taxableIncome = actualWithdrawn` — LIF-001: 100% taxable as ordinary income.
 *   - `gainsRealized = 0` — no capital-gain concept on registered withdrawals.
 *   - `newBalance = balance - actualWithdrawn`.
 */
export const withdrawFromLIF: WithdrawalStrategy = (request, state) => {
  const requested = Math.max(0, request.requestedAmount);
  const balance = Math.max(0, state.balance);
  // Effective remaining cap: caller pre-subtracts what's already been taken
  // (mandatory minimum + override-driven take). When the orchestrator's
  // arithmetic produces a negative number (e.g., the override took more
  // than the gross max), Math.max(0, ...) clamps to 0 — strategy returns
  // 0 in that pathological case.
  const remainingMax = Math.max(0, state.lifMaximumAllowed ?? 0);
  // Available for THIS call = min(balance, remainingMax).
  const available = Math.min(balance, remainingMax);
  const actualWithdrawn = Math.min(requested, available);
  // Clamped iff the caller asked for more than was available — covers
  // both the balance-binding and the max-binding (LIF-specific) cases.
  // Zero-request case: requested (0) is NOT > available, so clamped=false.
  const clamped = requested > available;

  return {
    actualWithdrawn,
    clamped,
    taxableIncome: actualWithdrawn, // LIF-001 / TC-ACCT-002: 100% taxable as ordinary income.
    gainsRealized: 0, // No capital-gain concept on registered withdrawals.
    newBalance: balance - actualWithdrawn,
  };
};
