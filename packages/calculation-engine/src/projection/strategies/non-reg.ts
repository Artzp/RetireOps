/**
 * Pure calculation-engine module: Non-Registered withdrawal strategy.
 *
 * Extracts the inline Non-Reg block previously duplicated across `withdrawFrom`
 * (single-path `calculateYear`) and `withdrawFromP` (couple-path
 * `calculatePersonYear`) of `yearly-calculator.ts` into a single leaf-level
 * pure function. The strategy is a THIN WRAPPER over `processNonRegisteredWithdrawal`
 * from `accounts/non-registered.ts` (which itself delegates to
 * `processNonRegWithdrawal` in `tax/capital-gains.ts`) — the helper remains
 * the single source of truth for the CRA pro-rata realized-gain math, the
 * D-10 per-person enhanced-inclusion threshold, and the post-withdrawal
 * ACB recomputation.
 *
 * SCOPE — what this strategy does NOT do:
 *   - It does NOT handle Non-Reg contributions or growth. Contributions
 *     (`processNonRegContribution`) and growth/income realization
 *     (`applyNonRegGrowth`, `calculateAnnualTaxableIncome`) live elsewhere
 *     in the orchestrator. A withdrawal-side strategy is the wrong
 *     abstraction for the deposit / growth-side concerns.
 *   - It does NOT mutate the caller's `annualCapGainsAccumulator` (D-10).
 *     The caller (couple path) is responsible for incrementing its own
 *     accumulator with `result.gainsRealized` AFTER the call — same
 *     discipline as the inline block being replaced.
 *
 * Tax classification (ENG-04 carry-forward from CORR-02 / Phase 8 LIMS-01b):
 *   - `gainsRealized` = RAW realized gain (pre-50%-inclusion). The caller
 *     rolls this into `taxInput.capitalGains`; the tax engine applies the
 *     federal inclusion rate downstream. This wiring is what Plan 08-02
 *     closed for LIMS-01b — the strategy MUST NOT regress it.
 *   - `taxableIncome` = post-inclusion taxable gain (50% standard, 66.7%
 *     above the $250K D-10 threshold per `calculateTaxableCapitalGainEnhanced`).
 *     Used by GIS / OAS-clawback income computations that already expect
 *     the inclusion-adjusted figure.
 *   - `newACB` populated — only strategy where this matters; mirrors
 *     `result.newACB` from the helper (CRA pro-rata reduction of cost base).
 *
 * D-10 enhanced-inclusion threshold:
 *   - `state.annualCapGainsSoFar` (default 0) is forwarded to
 *     `processNonRegisteredWithdrawal` as the 5th argument. With 0 the
 *     math reduces to standard 50% inclusion (single-path behavior). With
 *     a non-zero accumulator the helper computes the
 *     standard / enhanced split per `calculateTaxableCapitalGainEnhanced`
 *     (couple-path behavior across multi-account scenarios).
 *
 * @see .planning/phases/09-yearly-calculator-decomposition/09-01-PLAN.md (locked contract)
 * @see .planning/phases/09-yearly-calculator-decomposition/09-05-PLAN.md (this extraction)
 * @see .planning/phases/08-correctness-gaps/08-VERIFICATION.md - LIMS-01b / CORR-02
 * @see packages/shared/src/overrides/resolve.ts (canonical pure-module mirror)
 * @see packages/calculation-engine/src/projection/strategies/rrsp.ts (sibling — same contract)
 * @see packages/calculation-engine/src/projection/strategies/rrif.ts (sibling — same contract)
 * @see packages/calculation-engine/src/projection/strategies/tfsa.ts (sibling — wrapper-pattern precedent)
 * @see packages/calculation-engine/src/accounts/non-registered.ts (delegated helper)
 * @see packages/calculation-engine/src/tax/capital-gains.ts (pro-rata + inclusion math)
 * @see docs/source-of-truth/02-account-types.md - TC-ACCT-005
 * @see docs/source-of-truth/04-tax-engine.md - capital-gains inclusion (50% standard / 66.7% enhanced)
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 * Inputs MUST NOT be mutated — return new objects only. The delegated
 * `processNonRegisteredWithdrawal` helper is itself pure (verified by
 * reading `accounts/non-registered.ts` and `tax/capital-gains.ts` —
 * arithmetic-only, no globals, no I/O).
 */

import type { WithdrawalStrategy } from './index.js';
import { processNonRegisteredWithdrawal } from '../../accounts/non-registered.js';

/**
 * Non-Registered withdrawal strategy.
 *
 * Behavior matches the previously-inline blocks (verbatim arithmetic):
 *
 *   single path (calculateYear):
 *     const take = Math.min(amount, currentNonReg);
 *     if (take <= 0) return 0;
 *     const unrealizedGainsLegacy = Math.max(0, currentNonReg - currentACBLegacy);
 *     const cgResultLegacy = processNonRegisteredWithdrawal(
 *       take, currentNonReg, currentACBLegacy, unrealizedGainsLegacy
 *     ); // 4-arg call — annualCapGainsToDate defaults to 0
 *     nonRegRealizedGainLegacy   += cgResultLegacy.realizedGain;
 *     nonRegTaxableCapGainLegacy += cgResultLegacy.taxableGain;
 *     currentACBLegacy            = cgResultLegacy.newACB;
 *     nonRegWithdrawal           += take;
 *     currentNonReg              -= take;
 *
 *   couple path (calculatePersonYear):
 *     const take = Math.min(amount, currentNonReg);
 *     if (take <= 0) return 0;
 *     const unrealizedGains = Math.max(0, currentNonReg - currentACB);
 *     const cgResult = processNonRegisteredWithdrawal(
 *       take, currentNonReg, currentACB, unrealizedGains,
 *       annualCapGainsAccumulator  // 5-arg call — D-10 threshold tracking
 *     );
 *     nonRegRealizedGain        += cgResult.realizedGain;
 *     nonRegTaxableCapitalGain  += cgResult.taxableGain;
 *     currentACB                 = cgResult.newACB;
 *     annualCapGainsAccumulator += cgResult.realizedGain; // ← CALLER updates after the call
 *     nonRegWithdrawal          += take;
 *     currentNonReg             -= take;
 *
 * Both paths converge on the same strategy body. The 4-arg vs 5-arg
 * difference reduces to `state.annualCapGainsSoFar` defaulting to 0 — the
 * helper's 5th-argument default also being 0 makes the two call shapes
 * byte-equivalent at the helper level.
 *
 * The defensive `Math.max(0, ...)` clamps mirror the caller's
 * `if (amount <= 0) return 0` early-return without changing observable
 * behavior for any non-negative input the caller passes today.
 *
 * @param request - { requestedAmount, year, age } — year/age unused for Non-Reg
 *                  (Non-Reg withdrawals have no age-banded or jurisdictional
 *                  rules; the contract is locked at 09-01 and cannot vary
 *                  per-strategy).
 * @param state   - { balance, acb, annualCapGainsSoFar } — current Non-Reg
 *                  balance, ACB, and the per-person cumulative realized-gain
 *                  accumulator (D-10). `acb` and `annualCapGainsSoFar` default
 *                  to 0 when omitted.
 * @returns { actualWithdrawn, clamped, taxableIncome, gainsRealized, newBalance, newACB }
 *
 *   - `actualWithdrawn = take` (mirrors inline `nonRegWithdrawal += take`).
 *   - `gainsRealized = result.realizedGain` (RAW; caller rolls into capitalGains).
 *   - `taxableIncome = result.taxableGain` (post-50%/66.7% inclusion).
 *   - `newBalance = balance - take` (mirrors inline `currentNonReg -= take`).
 *   - `newACB = result.newACB` (CRA pro-rata reduction).
 */
export const withdrawFromNonReg: WithdrawalStrategy = (request, state) => {
  const requested = Math.max(0, request.requestedAmount);
  const balance = Math.max(0, state.balance);
  const acb = Math.max(0, state.acb ?? 0);
  const annualCapGainsSoFar = Math.max(0, state.annualCapGainsSoFar ?? 0);
  const take = Math.min(requested, balance);

  if (take <= 0) {
    return {
      actualWithdrawn: 0,
      // "clamped" means: caller asked for something but couldn't fulfill.
      // Zero request → not clamped (caller asked for nothing, got nothing).
      // Positive request against zero balance → clamped (caller asked, got nothing).
      clamped: requested > 0 && balance === 0,
      taxableIncome: 0,
      gainsRealized: 0,
      newBalance: balance,
      newACB: acb,
    };
  }

  const unrealizedGains = Math.max(0, balance - acb);
  const result = processNonRegisteredWithdrawal(
    take,
    balance,
    acb,
    unrealizedGains,
    annualCapGainsSoFar // Always pass 5 args; default 0 mirrors single-path 4-arg call.
  );

  return {
    // Mirror inline behavior: caller's `nonRegWithdrawal += take` (NOT result.withdrawalAmount).
    actualWithdrawn: take,
    clamped: requested > balance,
    // `taxableGain` is post-inclusion (50% standard or split 50%/66.7% via D-10).
    taxableIncome: result.taxableGain,
    // `realizedGain` is RAW — caller rolls into `taxInput.capitalGains`.
    gainsRealized: result.realizedGain,
    // Mirror inline behavior: caller's `currentNonReg -= take`.
    newBalance: balance - take,
    newACB: result.newACB,
  };
};
