/**
 * Surplus routing + net-cash-flow computation.
 *
 * Extracted from yearly-calculator.ts (Phase 9 plan 09-07 LOC cleanup).
 * Handles ENG-01 allocate_surplus: when surplusDestination is set, deposits
 * surplus into the chosen account (D-15..D-19); otherwise computes
 * net-cash-flow with the pre-Phase-1 formula (Assumption A1).
 *
 * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-15..D-19
 * @see docs/source-of-truth/08-projection-engine.md - ENG-01 allocate_surplus
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 */

import type { OverrideWarning, WithdrawalOverrideField } from '@retireops/shared';

import {
  computeSurplus,
  resolveSurplusDestination,
  depositToDestination,
  type AccountBalances,
  type AccountTypePresence,
} from '../surplus-routing.js';

/** Mutable balances after applyGrowth — caller absorbs back. */
export interface SurplusHandlingBalances {
  currentRRSP: number;
  currentRRIF: number;
  currentTFSA: number;
  currentNonReg: number;
  /** 0 on the legacy single path (no LIF). */
  currentLIF: number;
}

/** Inputs for surplus-routing application. */
export interface SurplusHandlingInput {
  surplusDestination: WithdrawalOverrideField | undefined;
  totalIncome: number;
  totalTax: number;
  livingExpenses: number;
  surplusFromOverrides: number;
  year: number;
  warningsAccumulator: OverrideWarning[] | undefined;
  presence: AccountTypePresence;
}

/**
 * Apply surplus routing. Mutates `balances` in place when a deposit happens.
 * Returns the resulting netCashFlow (D-19: net-of-deposit when surplus
 * destination is configured; pre-Phase-1 formula otherwise).
 */
export function applySurplusRouting(
  balances: SurplusHandlingBalances,
  input: SurplusHandlingInput
): number {
  const {
    surplusDestination,
    totalIncome,
    totalTax,
    livingExpenses,
    surplusFromOverrides,
    year,
    warningsAccumulator,
    presence,
  } = input;

  if (surplusDestination === undefined) {
    // Pre-Phase-1 behavior — byte-identical to before (Assumption A1, ROADMAP criterion #5)
    return totalIncome - totalTax - livingExpenses;
  }

  const { surplus, netCashFlowAfterDeposit } = computeSurplus({
    totalIncome,
    totalTax,
    livingExpenses,
    surplusFromOverrides,
  });

  if (surplus > 0) {
    const { destination, fallbackTriggered } = resolveSurplusDestination(
      surplusDestination,
      presence
    );
    if (fallbackTriggered && warningsAccumulator) {
      warningsAccumulator.push({
        code: 'surplus_destination_missing',
        year,
        destination: surplusDestination,
      });
    }
    // D-18: deposit AFTER applyGrowth — no same-year growth on deposited amount
    const accountBalances: AccountBalances = {
      rrsp: balances.currentRRSP,
      rrif: balances.currentRRIF,
      tfsa: balances.currentTFSA,
      nonReg: balances.currentNonReg,
      lif: balances.currentLIF,
    };
    const updated = depositToDestination(surplus, destination, accountBalances);
    balances.currentRRSP = updated.rrsp;
    balances.currentRRIF = updated.rrif;
    balances.currentTFSA = updated.tfsa;
    balances.currentNonReg = updated.nonReg;
    balances.currentLIF = updated.lif;
  }
  return netCashFlowAfterDeposit; // D-19: net-of-deposit
}
