/**
 * Pure helpers for Phase 1 editable overrides.
 *
 * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-01..D-14
 * @see docs/source-of-truth/07-withdrawal-strategies.md - OVER-01
 * @see docs/source-of-truth/08-projection-engine.md - ENG-01
 *
 * CRITICAL: This module is pure. No Date.now, no Math.random, no I/O.
 * All temporal reasoning derives from `year - projectionStartYear` passed in by the caller.
 */

import type { OverrideMetadata, OverrideFieldMetadata, OverrideWarning } from '@retireops/shared';
import type { WithdrawalOverrideField } from '@retireops/shared';
import {
  resolveActiveWithdrawalOverride as sharedResolveActiveWithdrawalOverride,
  resolveActiveSpendingOverride as sharedResolveActiveSpendingOverride,
  type WithdrawalOverrideRecord,
  type SpendingOverrideRecord,
} from '@retireops/shared';

// Re-export the types from shared so overrides.ts consumers can import from one place.
export type { OverrideMetadata, OverrideFieldMetadata, OverrideWarning };

// ------------------------------------------------------------------------
// Input types (mirrors scenario.ts shape; kept here for engine-layer use)
// D-02: withdrawal overrides carry { field, year, amount, applyForward }
// ------------------------------------------------------------------------

export interface WithdrawalOverrideInput {
  field: WithdrawalOverrideField;
  year: number;
  amount: number;
  applyForward: boolean;
  /**
   * Which person the override applies to in a couple projection. Undefined on
   * legacy records and on single projections — both are treated as 'primary'
   * by upstream filters before this array reaches the resolver.
   */
  owner?: 'primary' | 'spouse' | undefined;
}

export interface SpendingOverrideInput {
  year: number;
  amount: number;
  applyForward: boolean;
  /** See WithdrawalOverrideInput.owner. */
  owner?: 'primary' | 'spouse' | undefined;
}

// ------------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------------

/**
 * Normalizes the API-level field literal ('nonreg') to the engine drawdown-order key ('nonReg').
 * LIRA is intentionally NOT in the WithdrawalOverrideField enum (LIRA is contribution-locked).
 *
 * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-01 (account-type keying)
 * @see packages/calculation-engine/src/withdrawals/strategy.ts (canonical drawdown keys)
 */
export function normalizeFieldToDrawdownKey(field: WithdrawalOverrideField): string {
  switch (field) {
    case 'nonreg':
      return 'nonReg';
    case 'rrsp':
      return 'rrsp';
    case 'rrif':
      return 'rrif';
    case 'tfsa':
      return 'tfsa';
    case 'lif':
      return 'lif'; // outside main drawdown loop but included for symmetry (D-09)
    default:
      return field; // TypeScript exhaustiveness fallback — never reached at runtime
  }
}

/**
 * Resolves the active withdrawal override for a given field + year per D-07, D-08, Assumption A2.
 *
 * Rules (D-07, D-08, A2):
 *  1. If a record with the same (field, year) exists, it wins (anchor or single-year at targetYear).
 *  2. Otherwise, the latest applyForward=true record with year < targetYear applies (trailing chain).
 *  3. A single-year (applyForward=false) record at year Y' < targetYear does NOT apply to
 *     targetYear, and does NOT terminate a prior apply-forward chain; the prior chain
 *     resumes at Y'+1 (Assumption A2 — "single-year does not terminate apply-forward").
 *
 * @param field     The account-type field being resolved (D-01).
 * @param targetYear The projection year to resolve.
 * @param sortedOverrides MUST be pre-sorted ascending by year (call sortWithdrawalOverrides first).
 *
 * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-07, D-08, A2
 * @see docs/source-of-truth/07-withdrawal-strategies.md - OVER-03
 */
export function resolveActiveWithdrawalOverride(
  field: WithdrawalOverrideField,
  targetYear: number,
  sortedOverrides: ReadonlyArray<WithdrawalOverrideInput> | undefined
): WithdrawalOverrideInput | undefined {
  return sharedResolveActiveWithdrawalOverride(
    field,
    targetYear,
    sortedOverrides as ReadonlyArray<WithdrawalOverrideRecord> | undefined
  ) as WithdrawalOverrideInput | undefined;
}

/**
 * Resolves the active spending override for a given year per D-20, D-21.
 * Same algorithm as resolveActiveWithdrawalOverride but without a field discriminator.
 *
 * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-20, D-21
 * @see docs/source-of-truth/07-withdrawal-strategies.md - OVER-02
 */
export function resolveActiveSpendingOverride(
  targetYear: number,
  sortedOverrides: ReadonlyArray<SpendingOverrideInput> | undefined
): SpendingOverrideInput | undefined {
  return sharedResolveActiveSpendingOverride(
    targetYear,
    sortedOverrides as ReadonlyArray<SpendingOverrideRecord> | undefined
  ) as SpendingOverrideInput | undefined;
}

/**
 * Deterministically sorts override arrays by year. Returns a NEW array — input
 * is never mutated (D-12 user-intent invariant).
 *
 * Defensively asserts the T-01 cap (200 records). The Zod schema at
 * scenario.ts is the load-bearing check; this engine-boundary assertion
 * exists to surface "Zod was bypassed" failures (e.g. a direct DB insert,
 * a migration that hand-patches `decisions` JSONB) loudly instead of
 * silently corrupting the projection by using only the first 200 records.
 *
 * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-12, T-01
 */
export function sortWithdrawalOverrides(
  overrides: ReadonlyArray<WithdrawalOverrideInput> | undefined
): WithdrawalOverrideInput[] {
  if (!overrides || overrides.length === 0) return [];
  if (overrides.length > 200) {
    throw new Error(
      `Withdrawal overrides exceed cap (got ${String(overrides.length)}, max 200) — ` +
        `Zod schema should have rejected this; engine boundary check failed.`
    );
  }
  return [...overrides].sort((a, b) => a.year - b.year);
}

export function sortSpendingOverrides(
  overrides: ReadonlyArray<SpendingOverrideInput> | undefined
): SpendingOverrideInput[] {
  if (!overrides || overrides.length === 0) return [];
  if (overrides.length > 200) {
    throw new Error(
      `Spending overrides exceed cap (got ${String(overrides.length)}, max 200) — ` +
        `Zod schema should have rejected this; engine boundary check failed.`
    );
  }
  return [...overrides].sort((a, b) => a.year - b.year);
}

/**
 * Inflates a real (today's) dollar amount to nominal for the given projection year.
 * D-06: override amounts are stored in real dollars; engine inflates before applying.
 *
 * @see docs/source-of-truth/08-projection-engine.md - inflation semantics
 * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-06
 */
export function inflateToNominal(
  realAmount: number,
  inflationRate: number,
  yearsFromProjectionStart: number
): number {
  // T-02: guard NaN / Infinity before multiplication
  if (!Number.isFinite(realAmount) || !Number.isFinite(inflationRate)) {
    throw new Error('Override inflate: amount or rate is not finite');
  }
  return realAmount * Math.pow(1 + inflationRate, yearsFromProjectionStart);
}

/**
 * Returns true if the OverrideMetadata object has at least one populated field.
 * Used to decide whether to emit the sidecar on a result row (D-22).
 *
 * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-22
 */
export function hasAnyOverride(meta: OverrideMetadata): boolean {
  return (
    meta.rrspWithdrawal !== undefined ||
    meta.rrifWithdrawal !== undefined ||
    meta.tfsaWithdrawal !== undefined ||
    meta.nonRegWithdrawal !== undefined ||
    meta.lifWithdrawal !== undefined ||
    meta.livingExpenses !== undefined
  );
}
