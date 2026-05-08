/**
 * Inflation Display Mode Utilities — Feature 3.4
 *
 * Provides deterministic, presentational-only conversion of ProjectionYearRow
 * arrays between nominal and real (today's dollars) display modes.
 *
 * Conversion is applied to monetary fields only. Rate fields
 * (effectiveTaxRate, rrifMinimumRate, etc.) and identity/flag fields
 * (year, age, isRetired, …) are never deflated.
 *
 * @see docs/source-of-truth/06-investment-engine.md — Real vs. Nominal Dollars
 * Formula: real = nominal / (1 + inflationRate)^yearOffset
 */

import type { ProjectionYearRow, DisplayMode } from '@retireops/shared';
import { MONETARY_FIELDS } from '@retireops/shared';
import { nominalToReal } from './inflation.js';

export type { DisplayMode } from '@retireops/shared';

/**
 * Apply a display mode to an array of projection rows.
 *
 * In `'nominal'` mode the rows are returned unchanged (shallow copies).
 * In `'real'` mode every monetary field is deflated using:
 *   `real = nominal / (1 + inflationRate)^yearOffset`
 * where `yearOffset` is the zero-based position of the row in the array.
 *
 * This function is pure and deterministic — calling it repeatedly with the
 * same inputs always produces the same outputs. The source rows are never
 * mutated.
 *
 * @param rows          - Projection year rows in chronological order
 * @param mode          - 'nominal' (future dollars) or 'real' (today's dollars)
 * @param inflationRate - Annual inflation assumption (e.g. 0.02 for 2%)
 * @returns             New array of rows with monetary fields adjusted for display
 *
 * @see docs/source-of-truth/06-investment-engine.md — Real vs. Nominal Dollars
 */
export function applyInflationDisplayMode(
  rows: ProjectionYearRow[],
  mode: DisplayMode,
  inflationRate: number
): ProjectionYearRow[] {
  if (mode === 'nominal') {
    return rows.map((row) => ({ ...row }));
  }

  return rows.map((row, yearOffset) => {
    const converted: Record<string, unknown> = { ...row };
    for (const field of MONETARY_FIELDS) {
      const value = row[field];
      if (typeof value === 'number') {
        converted[field as string] = nominalToReal(value, inflationRate, yearOffset);
      }
    }
    return converted as unknown as ProjectionYearRow;
  });
}
