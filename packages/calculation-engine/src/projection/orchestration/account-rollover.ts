/**
 * End-of-year account roll: pro-rata nonRegACB reduction + balance carry to next year.
 *
 * Extracted from multi-year.ts (Phase 10 plan 10-02 ENG-05 helper extraction).
 * Mirrors the in-line logic at the tail of computeSingleProjection's year-loop
 * (single variant) and the per-person tail of computeCoupleProjection's
 * year-loop (couple variant). Both variants apply the CRA pro-rata rule from
 * docs/source-of-truth/02-account-types.md (ACB reduces by the withdrawal
 * fraction of the START-of-year non-registered balance, never by growth).
 *
 * @see docs/source-of-truth/02-account-types.md - ACB pro-rata reduction
 * @see docs/source-of-truth/04-tax-engine.md - capital gains inclusion
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 */

// Single-path balances snapshot. Mirrors the named locals in computeSingleProjection.
export interface SingleBalancesSnapshot {
  rrspBalance: number;
  rrifBalance: number;
  tfsaBalance: number;
  nonRegBalance: number;
  nonRegACB: number;
  tfsaRestoredRoomFromPreviousYear: number;
}

// Per-result fields the helper consumes (subset of YearlyResult; loose-typed to
// avoid pulling in the full result interface — keep the helper testable in
// isolation).
export interface AccountGrowthResultView {
  rrspBalance: number;
  rrifBalance: number;
  tfsaBalance: number;
  nonRegBalance: number;
  nonRegWithdrawal: number;
  tfsaWithdrawal: number;
}

/**
 * Single-person variant: returns the NEXT-year balances given current-year
 * START-of-year nonRegBalance (used for pro-rata fraction), current-year
 * nonRegACB, and the calculator's result.
 */
export function applyAccountGrowth(
  startOfYearNonRegBalance: number,
  startOfYearNonRegACB: number,
  result: AccountGrowthResultView
): SingleBalancesSnapshot {
  let nonRegACB = startOfYearNonRegACB;
  if (result.nonRegWithdrawal > 0 && startOfYearNonRegBalance > 0) {
    const withdrawalFraction = Math.min(1, result.nonRegWithdrawal / startOfYearNonRegBalance);
    nonRegACB = Math.max(0, startOfYearNonRegACB * (1 - withdrawalFraction));
  }
  return {
    rrspBalance: result.rrspBalance,
    rrifBalance: result.rrifBalance,
    tfsaBalance: result.tfsaBalance,
    nonRegBalance: result.nonRegBalance,
    nonRegACB,
    tfsaRestoredRoomFromPreviousYear: result.tfsaWithdrawal,
  };
}

// Couple-path per-person snapshot. Mirrors the existing PersonBalances type
// in multi-year.ts. Re-exported here so multi-year.ts can import a single
// canonical name; the legacy `interface PersonBalances` in multi-year.ts can
// be either deleted (if no other consumer exists) or aliased to this type.
export interface PersonBalancesSnapshot {
  rrsp: number;
  rrif: number;
  lira: number;
  lif: number;
  lifPriorYearReturnRate?: number;
  tfsa: number;
  tfsaRestoredRoomFromPreviousYear: number;
  nonReg: number;
  nonRegACB: number;
}

// Per-person result view (subset of PersonYearlyResult fields needed for the roll).
// Optional fields are typed `T | undefined` (not `?: T`) so call sites can pass
// values from a source whose declared type is `T | undefined` under
// `exactOptionalPropertyTypes: true` without a coercion.
export interface PersonAccountGrowthResultView {
  rrspBalance: number;
  rrifBalance: number;
  liraBalance: number | undefined;
  lifBalance: number | undefined;
  isLIFConversionYear: boolean | undefined;
  tfsaBalance: number;
  tfsaWithdrawal: number;
  nonRegBalance: number;
  nonRegWithdrawal: number;
}

/**
 * Couple-person variant: produces next-year PersonBalancesSnapshot from
 * the current-year start-of-year per-person balances + per-person result row.
 * Carries `lifPriorYearReturnRate` only when the spouse held a LIF balance
 * coming in OR converted this year (mirroring the existing branch).
 */
export function applyPersonAccountGrowth(
  startOfYearBalances: PersonBalancesSnapshot,
  result: PersonAccountGrowthResultView,
  investmentReturn: number
): PersonBalancesSnapshot {
  let nonRegACB = startOfYearBalances.nonRegACB;
  if (result.nonRegWithdrawal > 0 && startOfYearBalances.nonReg > 0) {
    const fraction = Math.min(1, result.nonRegWithdrawal / startOfYearBalances.nonReg);
    nonRegACB = Math.max(0, startOfYearBalances.nonRegACB * (1 - fraction));
  }
  const next: PersonBalancesSnapshot = {
    rrsp: result.rrspBalance,
    rrif: result.rrifBalance,
    lira: result.liraBalance ?? 0,
    lif: result.lifBalance ?? 0,
    tfsa: result.tfsaBalance,
    tfsaRestoredRoomFromPreviousYear: result.tfsaWithdrawal,
    nonReg: result.nonRegBalance,
    nonRegACB,
  };
  if (startOfYearBalances.lif > 0 || result.isLIFConversionYear === true) {
    next.lifPriorYearReturnRate = investmentReturn;
  }
  return next;
}
