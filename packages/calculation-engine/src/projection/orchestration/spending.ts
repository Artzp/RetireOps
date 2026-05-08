/**
 * Spending + age-band + contribution helpers.
 *
 * Extracted from yearly-calculator.ts (Phase 9 plan 09-07 LOC cleanup).
 *
 * @see docs/source-of-truth/07-withdrawal-strategies.md - SPD-03, SAV-01
 * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-13, D-15, D-20, D-21
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 */

import {
  resolveActiveSpendingOverride,
  inflateToNominal,
  type SpendingOverrideInput,
} from '../overrides.js';

/**
 * SPD-03: Apply age-band spending reduction.
 * Sorts bands by fromAge descending; returns spending × (1 − reductionPercent)
 * for the HIGHEST matching fromAge ≤ age. Bands do not stack (D-15).
 * @see docs/source-of-truth/07-withdrawal-strategies.md - SPD-03
 */
export function applyAgeBandReduction(
  spending: number,
  age: number,
  bands: Array<{ fromAge: number; reductionPercent: number }> | undefined
): number {
  if (!bands || bands.length === 0) return spending;
  const sorted = [...bands].sort((a, b) => b.fromAge - a.fromAge);
  for (const band of sorted) {
    if (age >= band.fromAge) {
      return spending * (1 - band.reductionPercent);
    }
  }
  return spending;
}

/**
 * SAV-01: Resolve per-year contribution amount.
 * If any override matches accountType AND year ∈ [startYear, endYear], return its annualAmount;
 * otherwise return defaultAmount. First matching override wins (D-13).
 * @see docs/source-of-truth/07-withdrawal-strategies.md - SAV-01
 */
export function resolveContribution(
  accountType: 'rrsp' | 'tfsa',
  defaultAmount: number,
  year: number,
  overrides:
    | Array<{
        accountType: 'rrsp' | 'tfsa';
        annualAmount: number;
        startYear: number;
        endYear: number;
      }>
    | undefined
): number {
  if (!overrides || overrides.length === 0) return defaultAmount;
  const match = overrides.find(
    (o) => o.accountType === accountType && year >= o.startYear && year <= o.endYear
  );
  return match ? match.annualAmount : defaultAmount;
}

/**
 * Resolve living-expenses for a single projection year.
 *
 * D-20: When a spending override is active for year Y, engine uses the inflated
 *        override amount as spendingAfterAgeBands — ageBandReductions are NOT applied.
 * D-21: When NO spending override is active, ageBandReductions apply to the
 *        inflation-adjusted base spending exactly as before.
 *
 * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-20, D-21
 * @see docs/source-of-truth/08-projection-engine.md
 */
export function computeSpendingForYear(args: {
  year: number;
  yearsFromProjectionStart: number;
  age: number;
  retirementSpending: number;
  inflationRate: number;
  ageBandReductions: Array<{ fromAge: number; reductionPercent: number }> | undefined;
  spendingOverrides: ReadonlyArray<SpendingOverrideInput> | undefined;
}): {
  spendingAfterAgeBands: number;
  overrideMeta: { source: 'override'; requestedReal: number; requestedNominal: number } | undefined;
} {
  const {
    year,
    yearsFromProjectionStart,
    age,
    retirementSpending,
    inflationRate,
    ageBandReductions,
    spendingOverrides,
  } = args;

  // @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-20, D-21
  // Spending override wins ABSOLUTELY for its window (D-20): skips ageBandReductions.
  // Years OUTSIDE an active override apply ageBandReductions normally (D-21).
  const activeSpendingOverride = resolveActiveSpendingOverride(year, spendingOverrides);

  if (activeSpendingOverride) {
    const requestedNominal = inflateToNominal(
      activeSpendingOverride.amount,
      inflationRate,
      yearsFromProjectionStart
    );
    // T-02: guard non-finite result before use
    if (!Number.isFinite(requestedNominal)) {
      throw new Error(`Inflated spending override is not finite at year=${String(year)}`);
    }
    return {
      spendingAfterAgeBands: requestedNominal,
      overrideMeta: {
        source: 'override',
        requestedReal: activeSpendingOverride.amount,
        requestedNominal,
      },
    };
  }

  // D-21: no active override — apply ageBandReductions normally
  const inflationAdjustedSpending =
    retirementSpending * Math.pow(1 + inflationRate, yearsFromProjectionStart);
  return {
    spendingAfterAgeBands: applyAgeBandReduction(inflationAdjustedSpending, age, ageBandReductions),
    overrideMeta: undefined,
  };
}
