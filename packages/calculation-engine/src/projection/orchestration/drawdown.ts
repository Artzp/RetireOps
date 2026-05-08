/**
 * Drawdown dispatch helper.
 *
 * Extracted from yearly-calculator.ts (Phase 9 plan 09-07 LOC cleanup).
 * Routes a withdrawal request through the per-account-type strategy registry
 * (RRSP/RRIF/TFSA/NonReg) and rolls the strategy's return value into the
 * year's accumulators.
 *
 * The caller maintains per-year state (balances + accumulators) in a single
 * mutable object. The helper mutates the object in place and returns the
 * actual amount withdrawn so the caller can decrement remainingGap.
 *
 * @see docs/source-of-truth/07-withdrawal-strategies.md - TAX-01, D-04, D-06
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 */

import { getWithdrawalStrategy } from '../strategies/index.js';

/** Mutable per-year drawdown state. */
export interface DrawdownState {
  // Balances
  currentRRSP: number;
  currentRRIF: number;
  currentTFSA: number;
  currentNonReg: number;
  currentACB: number;
  // Withdrawal accumulators
  rrspWithdrawal: number;
  additionalRRIFWithdrawal: number;
  tfsaWithdrawal: number;
  nonRegWithdrawal: number;
  nonRegRealizedGain: number;
  nonRegTaxableGain: number;
  /**
   * D-10: per-person accumulator of realized capital gains across all non-reg
   * withdrawals (drives the $250K enhanced-inclusion threshold). The single
   * (legacy) path passes 0 — there's no second account, so the threshold
   * cannot be reached mid-year.
   */
  annualCapGainsAccumulator: number;
}

/**
 * Withdraw from a single account by drawdown key. Returns the amount actually
 * withdrawn (0 if the key is unknown or the strategy returns 0).
 *
 * Mutates `state` in place: decrements the matching balance, increments the
 * matching withdrawal accumulator, and rolls capital-gain side-effects (NonReg)
 * into the gain accumulators.
 */
export function withdrawFromAccount(
  state: DrawdownState,
  key: string,
  amount: number,
  year: number,
  age: number
): number {
  if (amount <= 0) return 0;
  const k = key.toLowerCase();

  if (k === 'nonreg' || k === 'non-reg' || k === 'nonregistered') {
    const result = getWithdrawalStrategy('nonReg')(
      { requestedAmount: amount, year, age },
      {
        balance: state.currentNonReg,
        acb: state.currentACB,
        annualCapGainsSoFar: state.annualCapGainsAccumulator,
      }
    );
    if (result.actualWithdrawn <= 0) return 0;
    state.nonRegRealizedGain += result.gainsRealized;
    state.nonRegTaxableGain += result.taxableIncome;
    state.currentACB = result.newACB ?? state.currentACB;
    state.annualCapGainsAccumulator += result.gainsRealized; // D-10
    state.nonRegWithdrawal += result.actualWithdrawn;
    state.currentNonReg = result.newBalance;
    return result.actualWithdrawn;
  }

  if (k === 'rrif') {
    const result = getWithdrawalStrategy('rrif')(
      { requestedAmount: amount, year, age },
      { balance: state.currentRRIF }
    );
    if (result.actualWithdrawn <= 0) return 0;
    state.additionalRRIFWithdrawal += result.actualWithdrawn;
    state.currentRRIF = result.newBalance;
    return result.actualWithdrawn;
  }

  if (k === 'rrsp') {
    const result = getWithdrawalStrategy('rrsp')(
      { requestedAmount: amount, year, age },
      { balance: state.currentRRSP }
    );
    if (result.actualWithdrawn <= 0) return 0;
    state.rrspWithdrawal += result.actualWithdrawn;
    state.currentRRSP = result.newBalance;
    return result.actualWithdrawn;
  }

  if (k === 'tfsa') {
    const result = getWithdrawalStrategy('tfsa')(
      { requestedAmount: amount, year, age },
      { balance: state.currentTFSA }
    );
    if (result.actualWithdrawn <= 0) return 0;
    state.tfsaWithdrawal += result.actualWithdrawn;
    state.currentTFSA = result.newBalance;
    return result.actualWithdrawn;
  }

  return 0;
}

/**
 * Run the drawdown gap-fill loop. Walks the order in sequence, withdrawing
 * from each tier until remainingGap is satisfied or no more accounts have
 * funds. Returns the final remainingGap (>= 0).
 */
export function runDrawdownLoop(
  state: DrawdownState,
  order: ReadonlyArray<string>,
  initialGap: number,
  year: number,
  age: number
): number {
  let remainingGap = Math.max(0, initialGap);
  for (const key of order) {
    if (remainingGap <= 0) break;
    remainingGap -= withdrawFromAccount(state, key, remainingGap, year, age);
  }
  return remainingGap;
}
