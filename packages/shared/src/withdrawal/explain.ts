/**
 * Explainability Adapter — v4.8 Withdrawal Experience (Phase 30)
 *
 * Pure function `explainYearWithdrawals` that consumes a single projection-year
 * row (structurally typed via `ProjectionYearRowLike`) plus the scenario's
 * `withdrawalOverrides` array and returns a list of `WithdrawalReason` entries,
 * one per non-zero withdrawal cell. Each reason has a plain-English `reason`,
 * a `classification` (required / strategic / user-forced), a stable `ruleId`,
 * and an approximate `taxImpactApprox = amount * row.effectiveTaxRate`.
 *
 * Derivation order (Pitfall 4 — mandatory test table per 30-CONTEXT.md):
 *   1. If a withdrawalOverrides entry matches `(row.year, account)`
 *        → "user override"               / 'user-forced' / 'user-override'
 *   2. Else if RRIF and `rrifForcedMinimum > 0`
 *        → "mandatory minimum"           / 'required'    / 'rrif.forced-min'
 *   3. Else if `bracketFillWithdrawal > 0`
 *        → "bracket fill"                / 'strategic'   / 'bracket-fill'
 *   4. Else
 *        → "strategy-driven drawdown order" / 'strategic' / 'strategy-drawdown-order'
 *
 * Architecture Principle IV — this module has ZERO imports from
 * `@retireops/calculation-engine`. The `ProjectionYearRowLike` interface is a
 * minimal structural mirror of the fields the adapter reads from
 * `ProjectionYearRow`. Callers in `packages/web` / `packages/api` pass plain
 * objects derived from engine output (or a typed slice of `ProjectionYearRow`).
 *
 * No new Zod schema fields are introduced — `effectiveTaxRate` (already on
 * `ProjectionYearRow`) serves as the v4.8 tax-impact approximation.
 *
 * @see .planning/phases/30-explainability-adapter-override-summary/30-CONTEXT.md
 * @see .planning/phases/30-explainability-adapter-override-summary/30-01-PLAN.md
 * @see docs/source-of-truth/07-withdrawal-strategies.md
 */
import type { ScenarioDecisions } from '../types/scenario.js';

// ---------------------------------------------------------------------------
// Structural mirror — fields used by the adapter; subset of ProjectionYearRow.
// Kept here (not imported from calculation-engine) per Architecture Principle IV.
// ---------------------------------------------------------------------------

/**
 * Minimal row shape consumed by `explainYearWithdrawals`. Mirrors a subset of
 * `ProjectionYearRow` (see packages/shared/src/types/projection.ts). Callers
 * may pass a full `ProjectionYearRow` — structural typing accepts the extra
 * fields. The optional withdrawal fields (`bracketFillWithdrawal`,
 * `lifWithdrawal`) match the upstream type's optional shape.
 */
export interface ProjectionYearRowLike {
  year: number;
  age: number;
  rrifWithdrawal: number;
  rrifForcedMinimum: number;
  bracketFillWithdrawal?: number;
  tfsaWithdrawal: number;
  nonRegWithdrawal: number;
  lifWithdrawal?: number;
  effectiveTaxRate: number;
}

/**
 * Classification of why a withdrawal happened:
 *  - `'required'`   — the law forced it (currently only RRIF forced minimum)
 *  - `'strategic'`  — the engine chose it to optimise (bracket fill, drawdown order)
 *  - `'user-forced'` — the user supplied an explicit override
 */
export type WithdrawalClassification = 'required' | 'strategic' | 'user-forced';

/**
 * One withdrawal reason entry per non-zero withdrawal cell on a row. The
 * caller (popover / banner) uses `reason` for the human-readable headline,
 * `classification` for severity-style colouring, and `ruleId` for stable
 * filtering / analytics. `taxImpactApprox` is `amount * row.effectiveTaxRate`
 * (an approximation pending per-province tax modelling — Phase 31+).
 */
export interface WithdrawalReason {
  account: 'rrsp' | 'rrif' | 'tfsa' | 'nonReg' | 'lif';
  amount: number;
  reason: string;
  classification: WithdrawalClassification;
  ruleId: string;
  taxImpactApprox: number;
}

/**
 * Input to `explainYearWithdrawals`. `overrides` defaults to `[]` when omitted,
 * letting callers pass `{ row }` for projection runs without override decisions.
 */
export interface ExplainInput {
  row: ProjectionYearRowLike;
  overrides?: ScenarioDecisions['withdrawalOverrides'];
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Derive plain-English reasons for the non-zero withdrawal cells on `row`.
 *
 * Returns one `WithdrawalReason` per non-zero account withdrawal. Order:
 * RRIF first (the only account with a "required" classification), then
 * TFSA → non-reg → LIF. Cells with zero withdrawal are skipped.
 *
 * Pure function — no I/O, no `Date.now()`, no `Math.random()`. Safe to call
 * from both server and client contexts.
 */
export function explainYearWithdrawals(input: ExplainInput): WithdrawalReason[] {
  const { row, overrides = [] } = input;
  const reasons: WithdrawalReason[] = [];

  /**
   * True when an override targets `(row.year, field)`. The Zod schema defines
   * the field literals as lowercase (`'rrsp' | 'rrif' | 'lif' | 'tfsa' | 'nonreg'`);
   * `toLowerCase()` is a typed-safe no-op kept for clarity.
   */
  const overrideForYear = (field: 'rrsp' | 'rrif' | 'tfsa' | 'nonreg' | 'lif'): boolean =>
    overrides.some((o) => o.year === row.year && o.field.toLowerCase() === field);

  const taxApprox = (amount: number): number => amount * row.effectiveTaxRate;

  // 1) RRIF — forced-min vs user-override vs bracket-fill vs strategy.
  //    Order of checks matches the locked derivation order in 30-CONTEXT.md.
  if (row.rrifWithdrawal > 0) {
    let r: WithdrawalReason;
    if (overrideForYear('rrif')) {
      r = {
        account: 'rrif',
        amount: row.rrifWithdrawal,
        reason: 'user override',
        classification: 'user-forced',
        ruleId: 'user-override',
        taxImpactApprox: taxApprox(row.rrifWithdrawal),
      };
    } else if (row.rrifForcedMinimum > 0) {
      r = {
        account: 'rrif',
        amount: row.rrifWithdrawal,
        reason: 'mandatory minimum',
        classification: 'required',
        ruleId: 'rrif.forced-min',
        taxImpactApprox: taxApprox(row.rrifWithdrawal),
      };
    } else if ((row.bracketFillWithdrawal ?? 0) > 0) {
      r = {
        account: 'rrif',
        amount: row.rrifWithdrawal,
        reason: 'bracket fill',
        classification: 'strategic',
        ruleId: 'bracket-fill',
        taxImpactApprox: taxApprox(row.rrifWithdrawal),
      };
    } else {
      r = {
        account: 'rrif',
        amount: row.rrifWithdrawal,
        reason: 'strategy-driven drawdown order',
        classification: 'strategic',
        ruleId: 'strategy-drawdown-order',
        taxImpactApprox: taxApprox(row.rrifWithdrawal),
      };
    }
    reasons.push(r);
  }

  // Helper for accounts without a "required" classification (TFSA / non-reg / LIF).
  // The RRSP-bracket-fill branch is preserved for future RRSP withdrawal rows
  // (the v4.8 row contract surfaces bracket-fill via `bracketFillWithdrawal`
  // and the engine's drawdown loop may route bracket-fill through the RRSP
  // bucket — when that surfaces here, the branch fires).
  const explainSimple = (
    account: WithdrawalReason['account'],
    field: 'rrsp' | 'rrif' | 'tfsa' | 'nonreg' | 'lif',
    amount: number
  ): void => {
    if (amount <= 0) return;
    if (overrideForYear(field)) {
      reasons.push({
        account,
        amount,
        reason: 'user override',
        classification: 'user-forced',
        ruleId: 'user-override',
        taxImpactApprox: taxApprox(amount),
      });
    } else if ((row.bracketFillWithdrawal ?? 0) > 0 && account === 'rrsp') {
      reasons.push({
        account,
        amount,
        reason: 'bracket fill',
        classification: 'strategic',
        ruleId: 'bracket-fill',
        taxImpactApprox: taxApprox(amount),
      });
    } else {
      reasons.push({
        account,
        amount,
        reason: 'strategy-driven drawdown order',
        classification: 'strategic',
        ruleId: 'strategy-drawdown-order',
        taxImpactApprox: taxApprox(amount),
      });
    }
  };

  explainSimple('tfsa', 'tfsa', row.tfsaWithdrawal);
  explainSimple('nonReg', 'nonreg', row.nonRegWithdrawal);
  if (row.lifWithdrawal !== undefined && row.lifWithdrawal > 0) {
    explainSimple('lif', 'lif', row.lifWithdrawal);
  }

  return reasons;
}
