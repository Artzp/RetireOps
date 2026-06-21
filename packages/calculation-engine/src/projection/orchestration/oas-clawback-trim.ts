/**
 * OAS clawback avoidance trim helper.
 *
 * Extracted from yearly-calculator.ts (Phase 9 plan 09-07 LOC cleanup).
 * Trims discretionary withdrawals in reverse drawdown order if taxable income
 * exceeds the configured threshold. RRIF minimum is mandatory and cannot be
 * trimmed (D-05, D-12). TFSA trimming doesn't reduce taxable income — skipped.
 *
 * @see docs/source-of-truth/07-withdrawal-strategies.md - TAX-04
 * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-11, D-12
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 */

/**
 * Mutable trim state — caller passes in the per-account accumulators and
 * the helper mutates them in place. Caller absorbs the new values back into
 * its own locals after the call.
 */
export interface OASTrimState {
  rrspWithdrawal: number;
  currentRRSP: number;
  additionalRRIFWithdrawal: number;
  currentRRIF: number;
  nonRegWithdrawal: number;
  currentNonReg: number;
  nonRegRealizedGain: number;
  nonRegTaxableGain: number;
}

/** Inputs that don't change during trim iterations. */
export interface OASTrimContext {
  isRetired: boolean;
  employmentIncome: number;
  pensionIncome: number;
  cppIncome: number;
  oasIncome: number;
  rrifWithdrawal: number; // mandatory minimum (untrimmable)
  /**
   * Bracket-fill top-up withdrawal (untrimmable here). Bracket-fill runs BEFORE
   * the trim and is folded into taxable rrifIncome in the real tax input
   * (calculate-year.ts:508 / calculate-person-year.ts:615), so it must be
   * counted as income or the trim under-estimates and declines to fire (B-01).
   */
  bracketFillWithdrawal: number;
  /** Other taxable income (line 23600 gross-income component). */
  otherIncome: number;
  meltdownRRSPWithdrawal: number;
  incomeThreshold: number;
  /** Drawdown order; trim walks this in reverse. */
  drawdownOrder: ReadonlyArray<string>;
}

/**
 * Apply OAS-clawback-avoidance trim. Mutates `state` in place; returns it for
 * convenience. RRIF mandatory minimum + TFSA are never trimmed (D-05, D-12).
 */
export function applyOASClawbackAvoidanceTrim(
  state: OASTrimState,
  context: OASTrimContext
): OASTrimState {
  // Income definition must match the actual tax-input assembly so the trim's
  // clawback test agrees with the tax engine. Per docs/source-of-truth/04-tax-engine.md
  // "Step 1: Calculate Gross Income": pension, RRIF/RRSP withdrawals (which absorb
  // bracket-fill top-ups), CPP, OAS, taxable capital gains, and other_taxable_income
  // all count; TFSA withdrawals do not. bracketFillWithdrawal and otherIncome were
  // previously omitted, so the trim under-counted income and silently failed to fire
  // when bracket-fill was active (B-01).
  const estimate = (): number =>
    (context.isRetired ? 0 : context.employmentIncome) +
    context.pensionIncome +
    context.cppIncome +
    context.oasIncome +
    context.rrifWithdrawal +
    context.bracketFillWithdrawal +
    context.otherIncome +
    state.additionalRRIFWithdrawal +
    state.rrspWithdrawal +
    context.meltdownRRSPWithdrawal +
    state.nonRegTaxableGain;
  // TFSA withdrawals are non-taxable — excluded.

  const reverseOrder = [...context.drawdownOrder].reverse();
  const MAX_ITERATIONS = 20;
  let iterations = 0;

  while (estimate() > context.incomeThreshold && iterations < MAX_ITERATIONS) {
    const excess = estimate() - context.incomeThreshold;
    const trimmed = trimOnce(state, reverseOrder, excess);
    if (trimmed === 0) break; // Nothing more to trim (D-12: accept clawback)
    iterations++;
  }
  return state;
}

/**
 * One trim pass: walk reverseOrder once, take the first non-empty tier, trim
 * by min(currentBalance, excess), return amount trimmed (0 if nothing).
 */
function trimOnce(
  state: OASTrimState,
  reverseOrder: ReadonlyArray<string>,
  excess: number
): number {
  for (const key of reverseOrder) {
    const k = key.toLowerCase();
    if (k === 'rrsp' && state.rrspWithdrawal > 0) {
      const trim = Math.min(state.rrspWithdrawal, excess);
      state.rrspWithdrawal -= trim;
      state.currentRRSP += trim;
      return trim;
    }
    if (k === 'rrif' && state.additionalRRIFWithdrawal > 0) {
      // Only the ADDITIONAL rrif (above minimum) can be trimmed (D-12).
      const trim = Math.min(state.additionalRRIFWithdrawal, excess);
      state.additionalRRIFWithdrawal -= trim;
      state.currentRRIF += trim;
      return trim;
    }
    if (
      (k === 'nonreg' || k === 'non-reg' || k === 'nonregistered') &&
      state.nonRegWithdrawal > 0
    ) {
      const trim = Math.min(state.nonRegWithdrawal, excess);
      const old = state.nonRegWithdrawal;
      state.nonRegWithdrawal -= trim;
      state.currentNonReg += trim;
      // Scale down realized gain proportionally
      if (old > 0) {
        const scale = state.nonRegWithdrawal / old;
        state.nonRegRealizedGain *= scale;
        state.nonRegTaxableGain *= scale;
      }
      return trim;
    }
    // TFSA trimming doesn't reduce taxable income — skip for TAX-04.
  }
  return 0;
}
