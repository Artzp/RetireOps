/**
 * Pure helpers for Phase 1 surplus routing (ENG-01).
 *
 * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-15, D-16, D-17, D-18, D-19
 * @see docs/source-of-truth/08-projection-engine.md - ENG-01 allocate_surplus
 * @see docs/source-of-truth/06-investment-engine.md - end-of-year deposit timing (D-18)
 *
 * CRITICAL: This module is pure. No Date.now, no Math.random, no I/O.
 * All temporal reasoning derives from year - projectionStartYear passed in by the caller.
 */
import type { WithdrawalOverrideField } from '@retireops/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Account balances snapshot passed into surplus-routing helpers.
 * Represents the post-growth end-of-year balances (D-18: deposit occurs AFTER applyGrowth).
 */
export interface AccountBalances {
  rrsp: number;
  rrif: number;
  tfsa: number;
  nonReg: number;
  lif: number;
}

/**
 * Identifies which account types the profile actually has (non-zero starting balance
 * OR declared account with potentially zero balance). Used for D-17 fallback detection.
 */
export interface AccountTypePresence {
  rrsp: boolean;
  rrif: boolean;
  tfsa: boolean;
  nonReg: boolean;
  lif: boolean;
}

export interface ComputeSurplusInputs {
  /** All cash in for the year (employment + pension + government benefits + all withdrawals). */
  totalIncome: number;
  totalTax: number;
  /** spendingAfterAgeBands — override-aware per Plan 04. */
  livingExpenses: number;
  /**
   * Surplus from override overshoot: if override amount > incomeGap, the excess
   * was withdrawn already (and taxed if applicable) and is waiting to be deposited.
   * Set by yearly-calculator in Plan 03. Unused in the pure surplus calculation
   * but reserved for future routing refinements.
   */
  surplusFromOverrides: number;
}

export interface ComputeSurplusResult {
  /** Positive residual available for routing. Zero if no surplus exists. */
  surplus: number;
  /**
   * netCashFlow post-deposit (D-19).
   * Equals min(totalIncome - totalTax - livingExpenses, 0) when surplus > 0 (≈0 in surplus years).
   */
  netCashFlowAfterDeposit: number;
}

// ---------------------------------------------------------------------------
// computeSurplus
// ---------------------------------------------------------------------------

/**
 * Computes the surplus available to route to `surplusDestination`.
 *
 * surplus = max(0, totalIncome - totalTax - livingExpenses)
 *
 * This captures BOTH trigger paths (D-16):
 *  (a) Forced RRIF mandatory minimum exceeds spending need — reflected in totalIncome via rrifWithdrawal.
 *  (b) User override produced more cash than spending need — reflected in totalIncome via rrspWithdrawal/etc.
 *
 * T-02: non-finite inputs throw immediately; surplus is bounded at 0 from below via Math.max.
 *
 * @see docs/source-of-truth/08-projection-engine.md - allocate_surplus (ENG-01)
 * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-16, D-19
 */
export function computeSurplus(inputs: ComputeSurplusInputs): ComputeSurplusResult {
  const { totalIncome, totalTax, livingExpenses } = inputs;
  // T-02: finite guard — reject NaN / Infinity immediately
  if (
    !Number.isFinite(totalIncome) ||
    !Number.isFinite(totalTax) ||
    !Number.isFinite(livingExpenses)
  ) {
    throw new Error(
      'computeSurplus: non-finite input (totalIncome, totalTax, or livingExpenses is NaN/Infinity)'
    );
  }
  const raw = totalIncome - totalTax - livingExpenses;
  // T-02: Math.max(0, ...) ensures surplus is never negative
  const surplus = Math.max(0, raw);
  // D-19: netCashFlow is now net-of-deposit (≈0 in surplus-triggering years).
  // When surplus > 0, netCashFlowAfterDeposit = raw - surplus = raw - raw = 0.
  // When raw < 0 (deficit), surplus = 0 so netCashFlowAfterDeposit = raw (unchanged).
  const netCashFlowAfterDeposit = raw - surplus; // equivalent to min(raw, 0)
  return { surplus, netCashFlowAfterDeposit };
}

// ---------------------------------------------------------------------------
// resolveSurplusDestination
// ---------------------------------------------------------------------------

/**
 * Resolves the destination account, falling back to non-reg when the requested
 * destination's account type is not present in the profile (D-17).
 *
 * "Present" means the profile has an account of this type (balance may be zero but
 * the account was declared). If not present, engine falls back to an implicit
 * non-reg deposit at $0 starting balance and the caller emits a warning.
 *
 * @returns { destination, fallbackTriggered }. fallbackTriggered=true means the
 *   caller MUST push an OverrideWarning with code 'surplus_destination_missing'.
 *
 * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-17
 */
export function resolveSurplusDestination(
  requested: WithdrawalOverrideField,
  presence: AccountTypePresence
): { destination: WithdrawalOverrideField; fallbackTriggered: boolean } {
  const presentMap: Record<WithdrawalOverrideField, boolean> = {
    rrsp: presence.rrsp,
    rrif: presence.rrif,
    tfsa: presence.tfsa,
    nonreg: presence.nonReg,
    lif: presence.lif,
  };
  if (presentMap[requested]) {
    return { destination: requested, fallbackTriggered: false };
  }
  // D-17: implicit non-reg deposit at $0 starting balance; caller emits warning
  return { destination: 'nonreg', fallbackTriggered: true };
}

// ---------------------------------------------------------------------------
// depositToDestination
// ---------------------------------------------------------------------------

/**
 * Returns a NEW balances object with the surplus deposited to the given destination.
 * Does NOT mutate the input balances object.
 *
 * D-18: This function MUST be called AFTER applyGrowth in the caller — no same-year
 * growth on the deposited amount. Growth begins the following year.
 *
 * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-18
 * @see docs/source-of-truth/06-investment-engine.md - end-of-year deposit timing
 */
export function depositToDestination(
  amount: number,
  destination: WithdrawalOverrideField,
  balances: AccountBalances
): AccountBalances {
  // T-02: reject negative or non-finite amounts
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('depositToDestination: invalid amount — must be a non-negative finite number');
  }
  const result: AccountBalances = { ...balances };
  switch (destination) {
    case 'rrsp':
      result.rrsp = balances.rrsp + amount;
      break;
    case 'rrif':
      result.rrif = balances.rrif + amount;
      break;
    case 'tfsa':
      result.tfsa = balances.tfsa + amount;
      break;
    case 'nonreg':
      result.nonReg = balances.nonReg + amount;
      break;
    case 'lif':
      result.lif = balances.lif + amount;
      break;
  }
  return result;
}
