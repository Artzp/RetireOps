/**
 * impact-metrics.ts — pure extractor for the 5 ImpactPreview metrics.
 *
 * Phase 31 Plan 01 (IMP-01): the Impact Preview card on the scenario edit page
 * needs five top-line outcomes from a `/preview-decisions` result_data payload:
 *   1. `lifetimeTax`             — `summary.totalTaxesPaid`
 *   2. `depletionAge`            — first `yearlyResults` entry where
 *                                  `householdNetWorth <= 0`; `null` if assets
 *                                  never deplete inside the projection horizon
 *   3. `endingEstate`            — last `yearlyResults` entry's `householdNetWorth`
 *   4. `oasClawback`             — Σ (`yearlyResults[].oasClawback` +
 *                                     `yearlyResults[].spouseOasClawback`)
 *   5. `afterTaxSpendingCovered` — `summary.averageRetirementIncome`
 *
 * The extractor is intentionally permissive: every field on the input is
 * optional and defaults to `0` (or `null` for `depletionAge`). The function
 * must never throw — it is called inside `useEffect` on every preview tick,
 * and the API response shape is contract-bound to `transformToFrontendOutput`
 * (see `packages/api/src/services/profile-scenario.service.ts:740`) but the
 * extractor purposefully avoids importing that type so the web bundle stays
 * decoupled from server modules.
 *
 * @see .planning/phases/31-impact-preview/31-01-PLAN.md (Task 1)
 * @see .planning/phases/31-impact-preview/31-CONTEXT.md (locked metric mapping)
 */

export interface ImpactMetrics {
  /** Sum of all lifetime taxes paid by the household (CAD). */
  lifetimeTax: number;
  /** First age at which `householdNetWorth <= 0`; `null` if assets never deplete. */
  depletionAge: number | null;
  /** `householdNetWorth` in the final projection year (CAD). */
  endingEstate: number;
  /** Sum of primary + spouse OAS clawback across the full horizon (CAD). */
  oasClawback: number;
  /** Average annual after-tax spending covered in retirement (today's dollars). */
  afterTaxSpendingCovered: number;
}

/**
 * Shape of an entry inside `result_data.yearlyResults`. Every field is optional
 * because the extractor consumes opaque JSON — strict typing lives server-side.
 */
interface YearLike {
  age?: number;
  year?: number;
  householdNetWorth?: number;
  oasClawback?: number;
  spouseOasClawback?: number;
}

/**
 * Shape of the `result_data` payload returned by `POST /preview-decisions`.
 * Only the fields the extractor reads are declared.
 */
export interface ResultDataLike {
  summary?: {
    totalTaxesPaid?: number;
    averageRetirementIncome?: number;
  };
  yearlyResults?: YearLike[];
}

/**
 * Pure metric extractor. Always returns a fully-populated `ImpactMetrics`,
 * even when fields are missing — callers can render the values directly.
 *
 * Depletion semantics: matches the locked decision in 31-CONTEXT.md — the
 * first year where `householdNetWorth <= 0` (inclusive zero, because hitting
 * exactly zero net worth means assets are spent). `null` signals "Never
 * depletes" which the UI renders as a dash or sentinel label.
 */
export function extractImpactMetrics(resultData: ResultDataLike | null | undefined): ImpactMetrics {
  const data = resultData ?? {};
  const yearly = Array.isArray(data.yearlyResults) ? data.yearlyResults : [];
  const summary = data.summary ?? {};

  const last = yearly.length > 0 ? yearly[yearly.length - 1] : undefined;
  const depletionRow = yearly.find((y) => (y.householdNetWorth ?? 0) <= 0);

  const oasClawback = yearly.reduce(
    (sum, y) => sum + (y.oasClawback ?? 0) + (y.spouseOasClawback ?? 0),
    0
  );

  return {
    lifetimeTax: summary.totalTaxesPaid ?? 0,
    depletionAge: depletionRow?.age ?? null,
    endingEstate: last?.householdNetWorth ?? 0,
    oasClawback,
    afterTaxSpendingCovered: summary.averageRetirementIncome ?? 0,
  };
}
