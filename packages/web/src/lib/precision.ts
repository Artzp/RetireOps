/**
 * Precision-band rounding for displayed government-benefit amounts.
 *
 * Per docs/source-of-truth/PITFALLS.md §13 and Phase 21 CONTEXT.md D-19:
 *   - Annual amounts round to nearest $100.
 *   - Monthly amounts round to nearest $5.
 *
 * Rounding is a DISPLAY concern. The estimator and form-state hold precise
 * values; only the rendered JSX should apply these helpers. Phase 21
 * (CPP/QPP) is the first consumer; Phases 22 (OAS) and 23 (GIS) will reuse
 * them without modification.
 */

/** Round to nearest $100. NaN passes through (callers guard with Number.isFinite). */
export const roundAnnual = (n: number): number => Math.round(n / 100) * 100;

/** Round to nearest $5. NaN passes through (callers guard with Number.isFinite). */
export const roundMonthly = (n: number): number => Math.round(n / 5) * 5;
