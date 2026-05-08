/**
 * Pure calculation-engine module: per-account-type withdrawal strategy contract + registry.
 *
 * Mirrors the v4.2 Phase 6 registry pattern at packages/shared/src/overrides/resolve.ts.
 * Each strategy is a pure leaf-level function — no orchestration, no cross-account logic.
 * The caller (yearly-calculator) rolls each strategy's return value into the year's
 * accumulators (taxable income, gains realized, balances).
 *
 * @see .planning/phases/09-yearly-calculator-decomposition/09-CONTEXT.md
 * @see packages/shared/src/overrides/resolve.ts (canonical mirror)
 * @see docs/source-of-truth/07-withdrawal-strategies.md
 * @see docs/source-of-truth/02-account-types.md
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 * All temporal reasoning derives from the `year` and `age` fields passed in by the caller.
 * Strategies MUST NOT mutate their inputs — return new objects only.
 */

import type { LIFJurisdiction } from '@retireops/shared';

import { withdrawFromLIF } from './lif.js';
import { withdrawFromNonReg } from './non-reg.js';
import { withdrawFromRRIF } from './rrif.js';
import { withdrawFromRRSP } from './rrsp.js';
import { withdrawFromTFSA } from './tfsa.js';

/** What the caller is asking for. */
export interface WithdrawalRequest {
  /** Amount the caller wants to withdraw (gross, pre-clamp). */
  requestedAmount: number;
  /** Calendar year of the withdrawal — for jurisdictional/age-banded rules. */
  year: number;
  /** Owner age at end of year — required by RRIF minimum factors and LIF limits. */
  age: number;
}

/** Per-account-type state at the moment of withdrawal. */
export interface AccountState {
  /** Current balance available for withdrawal. */
  balance: number;
  /** Adjusted Cost Base — non-reg only; ignored by other strategies. */
  acb?: number;
  /** Cumulative realized gain in the year so far — non-reg only (D-10 enhanced inclusion). */
  annualCapGainsSoFar?: number;
  /** LIF jurisdiction — lif only. */
  lifJurisdiction?: LIFJurisdiction;
  /** LIF max already computed by the caller (limits depend on prior-year return + jurisdiction). */
  lifMaximumAllowed?: number;
  /** Younger-spouse election for LIF age — lif only. */
  useYoungerSpouseForLIF?: boolean;
  /** Spouse age — lif/rrif only when younger-spouse election is on. */
  spouseAge?: number;
  /** Prior-year return rate — lif only (drives max). */
  lifPriorYearReturnRate?: number;
}

/** What the strategy returns to the caller. */
export interface StrategyResult {
  /** Amount actually withdrawn after clamping to balance + jurisdictional limits. */
  actualWithdrawn: number;
  /** True iff requested > balance (or > maximum, for LIF). */
  clamped: boolean;
  /**
   * Amount that flows into the year's taxable-income aggregator.
   * RRSP/RRIF/LIF = full withdrawal; TFSA = 0; NonReg = realized gain RAW
   * (the tax engine applies the inclusion rate downstream).
   */
  taxableIncome: number;
  /** Realized capital gain (RAW, pre-50%-inclusion). NonReg only; 0 for all others. */
  gainsRealized: number;
  /** New balance after withdrawal. */
  newBalance: number;
  /** Updated ACB after withdrawal — NonReg only; undefined for all others. */
  newACB?: number;
}

/**
 * Pure strategy function shape.
 * Mirrors resolveActiveWithdrawalOverride: input → output, no side effects.
 */
export type WithdrawalStrategy = (
  request: WithdrawalRequest,
  state: AccountState
) => StrategyResult;

/** Account-type discriminator. */
export type StrategyAccountType = 'rrsp' | 'rrif' | 'tfsa' | 'nonReg' | 'lif';

/**
 * Registry: account-type → strategy fn.
 *
 * Single object literal. No dynamic dispatch, no class hierarchy.
 * As of Wave 2 (09-06), all five strategies are wired to real, pure
 * implementations. The placeholder factory has been removed — Wave 3
 * (09-07) ships with zero placeholders.
 */
export const STRATEGY_REGISTRY: Record<StrategyAccountType, WithdrawalStrategy> = {
  rrsp: withdrawFromRRSP, // Wave 2 (09-02): wired.
  rrif: withdrawFromRRIF, // Wave 2 (09-03): wired.
  tfsa: withdrawFromTFSA, // Wave 2 (09-04): wired.
  nonReg: withdrawFromNonReg, // Wave 2 (09-05): wired.
  lif: withdrawFromLIF, // Wave 2 (09-06): wired — Wave 2 complete.
};

/** Lookup helper — symmetrical to resolveActiveWithdrawalOverride. */
export function getWithdrawalStrategy(type: StrategyAccountType): WithdrawalStrategy {
  return STRATEGY_REGISTRY[type];
}
