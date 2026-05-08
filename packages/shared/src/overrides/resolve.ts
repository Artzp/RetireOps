/**
 * Pure shared module: apply-forward override resolution.
 *
 * @see .planning/phases/06-apply-forward-consolidation/06-CONTEXT.md - D-103
 * @see packages/calculation-engine/src/projection/overrides.ts (canonical engine source — copied here verbatim for cross-package reuse)
 *
 * CRITICAL: This module is pure. No Date.now, no Math.random, no I/O.
 * All temporal reasoning derives from `targetYear` passed in by the caller.
 * Inputs MUST be pre-sorted ascending by year (engine contract).
 */

import type { WithdrawalOverrideField } from '../types/scenario.js';

export interface WithdrawalOverrideRecord {
  field: WithdrawalOverrideField;
  year: number;
  amount: number;
  applyForward: boolean;
}

export interface SpendingOverrideRecord {
  year: number;
  amount: number;
  applyForward: boolean;
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
  sortedOverrides: ReadonlyArray<WithdrawalOverrideRecord> | undefined
): WithdrawalOverrideRecord | undefined {
  if (!sortedOverrides || sortedOverrides.length === 0) return undefined;

  // T-02: defensive finite-amount check on every override scanned
  let trailingApplyForward: WithdrawalOverrideRecord | undefined;

  for (const o of sortedOverrides) {
    if (o.field !== field) continue;
    if (o.year > targetYear) break; // sorted ASC — no more relevant records

    // T-02: reject NaN / Infinity defensively at the resolver entry
    if (!Number.isFinite(o.amount)) {
      throw new Error(`Override amount is not finite for field=${o.field}, year=${String(o.year)}`);
    }

    // D-07: record at targetYear (anchor or single-year) wins immediately
    if (o.year === targetYear) return o;

    // o.year < targetYear
    if (o.applyForward) {
      // D-07: apply-forward record is a running anchor; store as candidate
      trailingApplyForward = o;
    }
    // A2: if !applyForward (single-year in the past) — does NOT terminate prior chain
    //     so we simply skip updating trailingApplyForward
  }
  return trailingApplyForward; // undefined when no active override
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
  sortedOverrides: ReadonlyArray<SpendingOverrideRecord> | undefined
): SpendingOverrideRecord | undefined {
  if (!sortedOverrides || sortedOverrides.length === 0) return undefined;

  let trailingApplyForward: SpendingOverrideRecord | undefined;

  for (const o of sortedOverrides) {
    if (o.year > targetYear) break;

    // T-02: reject NaN / Infinity defensively
    if (!Number.isFinite(o.amount)) {
      throw new Error(`Spending override amount is not finite for year=${String(o.year)}`);
    }

    if (o.year === targetYear) return o; // D-07 analog for spending
    if (o.applyForward) trailingApplyForward = o; // A2 analog
  }
  return trailingApplyForward;
}
