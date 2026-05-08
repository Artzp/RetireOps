/**
 * Combined withdrawal pipeline: override-injection pass + drawdown gap-fill loop.
 *
 * Extracted from yearly-calculator.ts (Phase 9 plan 09-07 LOC cleanup).
 * Wraps applyWithdrawalOverrides + runDrawdownLoop in a single API so the
 * orchestrator's Step 8 reduces from ~50 LOC of variable plumbing to a single
 * call.
 *
 * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-09, D-10, D-11, D-12
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 */

import type { OverrideMetadata, OverrideWarning, WithdrawalOverrideField } from '@retireops/shared';

import { normalizeFieldToDrawdownKey, type WithdrawalOverrideInput } from '../overrides.js';
import { applyWithdrawalOverrides } from './withdrawal-overrides.js';
import { runDrawdownLoop, type DrawdownState } from './drawdown.js';

/** Mutable balance + accumulator state passed in / mutated / returned. */
export interface WithdrawalPipelineState {
  // Balances
  currentRRSP: number;
  currentRRIF: number;
  currentTFSA: number;
  currentNonReg: number;
  currentACB: number;
  /** 0 in legacy single path. */
  currentLIF: number;
  // Withdrawal accumulators
  rrspWithdrawal: number;
  additionalRRIFWithdrawal: number;
  tfsaWithdrawal: number;
  nonRegWithdrawal: number;
  nonRegRealizedGain: number;
  nonRegTaxableGain: number;
  /** D-10 per-person accumulator (couple path only; single path passes 0). */
  annualCapGainsAccumulator: number;
}

export interface WithdrawalPipelineInput {
  year: number;
  age: number;
  yearsFromProjectionStart: number;
  inflationRate: number;
  incomeGap: number;
  withdrawalOverrides: ReadonlyArray<WithdrawalOverrideInput> | undefined;
  overrideWarningsAccumulator: OverrideWarning[] | undefined;
  effectiveOrder: ReadonlyArray<string>;
  /** RRIF mandatory minimum already deducted upstream (RMIN-01). */
  rrifMandatoryMinimum: number;
  /** LIF max for the year (couple path only). */
  lifMaximumAllowed: number;
}

export interface WithdrawalPipelineResult {
  overridesMetadata: OverrideMetadata;
  tiersToSkip: Set<string>;
  overrideTotalTowardsSpending: number;
  surplusFromOverrides: number;
  overrideAwareOrder: string[];
  /** Couple-path: amount of LIF withdrawal taken via the override pass. */
  additionalLIFWithdrawalFromOverride: number;
  /** Final remaining gap (>= 0) after the drawdown loop completes. */
  remainingGap: number;
}

/**
 * Run the override-injection pass + drawdown gap-fill loop. Mutates `state`
 * in place: balances are debited, withdrawal accumulators are credited, and
 * (for couple path) annualCapGainsAccumulator is incremented.
 *
 * Returns metadata + bookkeeping the caller needs for downstream steps
 * (provenance, LIF post-loop block, OAS clawback trim, etc.).
 */
export function runWithdrawalPipeline(
  state: WithdrawalPipelineState,
  input: WithdrawalPipelineInput
): WithdrawalPipelineResult {
  // Phase 1 override-injection pass.
  const overrideAccts = {
    currentRRSP: state.currentRRSP,
    currentRRIF: state.currentRRIF,
    currentTFSA: state.currentTFSA,
    currentNonReg: state.currentNonReg,
    currentNonRegACB: state.currentACB,
    currentLIF: state.currentLIF,
    lifMaximumAllowed: input.lifMaximumAllowed,
    rrifMandatoryMinimum: input.rrifMandatoryMinimum,
  };
  const overrideAccs = {
    rrspWithdrawal: 0,
    rrifAdditional: 0,
    tfsaWithdrawal: 0,
    nonRegWithdrawal: 0,
    nonRegRealizedGain: 0,
    nonRegTaxableGain: 0,
    lifAdditional: 0,
  };
  const overrideResult = applyWithdrawalOverrides(
    input.year,
    input.yearsFromProjectionStart,
    input.inflationRate,
    input.incomeGap,
    input.withdrawalOverrides,
    overrideAccts,
    overrideAccs,
    input.overrideWarningsAccumulator
  );

  // Absorb override-pass mutations back into state.
  state.currentRRSP = overrideAccts.currentRRSP;
  state.currentRRIF = overrideAccts.currentRRIF;
  state.currentTFSA = overrideAccts.currentTFSA;
  state.currentNonReg = overrideAccts.currentNonReg;
  state.currentACB = overrideAccts.currentNonRegACB;
  state.currentLIF = overrideAccts.currentLIF;
  state.rrspWithdrawal += overrideAccs.rrspWithdrawal;
  state.additionalRRIFWithdrawal += overrideAccs.rrifAdditional;
  state.tfsaWithdrawal += overrideAccs.tfsaWithdrawal;
  state.nonRegWithdrawal += overrideAccs.nonRegWithdrawal;
  state.nonRegRealizedGain += overrideAccs.nonRegRealizedGain;
  state.nonRegTaxableGain += overrideAccs.nonRegTaxableGain;

  // D-10: tiers handled by overrides are skipped from the drawdown order.
  const overrideAwareOrder = input.effectiveOrder.filter((k) => {
    const normalized = normalizeFieldToDrawdownKey(k as WithdrawalOverrideField);
    return !overrideResult.tiersToSkip.has(k) && !overrideResult.tiersToSkip.has(normalized);
  });

  // Drawdown gap-fill loop using the strategy registry.
  const drawdownState: DrawdownState = {
    currentRRSP: state.currentRRSP,
    currentRRIF: state.currentRRIF,
    currentTFSA: state.currentTFSA,
    currentNonReg: state.currentNonReg,
    currentACB: state.currentACB,
    rrspWithdrawal: state.rrspWithdrawal,
    additionalRRIFWithdrawal: state.additionalRRIFWithdrawal,
    tfsaWithdrawal: state.tfsaWithdrawal,
    nonRegWithdrawal: state.nonRegWithdrawal,
    nonRegRealizedGain: state.nonRegRealizedGain,
    nonRegTaxableGain: state.nonRegTaxableGain,
    annualCapGainsAccumulator: state.annualCapGainsAccumulator,
  };
  const remainingGap = runDrawdownLoop(
    drawdownState,
    overrideAwareOrder,
    input.incomeGap - overrideResult.overrideTotalTowardsSpending,
    input.year,
    input.age
  );

  // Absorb drawdown-loop mutations back into state.
  state.currentRRSP = drawdownState.currentRRSP;
  state.currentRRIF = drawdownState.currentRRIF;
  state.currentTFSA = drawdownState.currentTFSA;
  state.currentNonReg = drawdownState.currentNonReg;
  state.currentACB = drawdownState.currentACB;
  state.rrspWithdrawal = drawdownState.rrspWithdrawal;
  state.additionalRRIFWithdrawal = drawdownState.additionalRRIFWithdrawal;
  state.tfsaWithdrawal = drawdownState.tfsaWithdrawal;
  state.nonRegWithdrawal = drawdownState.nonRegWithdrawal;
  state.nonRegRealizedGain = drawdownState.nonRegRealizedGain;
  state.nonRegTaxableGain = drawdownState.nonRegTaxableGain;
  state.annualCapGainsAccumulator = drawdownState.annualCapGainsAccumulator;

  return {
    overridesMetadata: overrideResult.overridesMetadata,
    tiersToSkip: overrideResult.tiersToSkip,
    overrideTotalTowardsSpending: overrideResult.overrideTotalTowardsSpending,
    surplusFromOverrides: overrideResult.surplusFromOverrides,
    overrideAwareOrder,
    additionalLIFWithdrawalFromOverride: overrideAccs.lifAdditional,
    remainingGap,
  };
}
