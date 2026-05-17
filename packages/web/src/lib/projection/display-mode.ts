/**
 * Projection display-mode transform — Feature 3.4
 *
 * Web-side inflation deflation for "Real CAD (today's dollars)" display
 * without depending on the calculation-engine package.
 *
 * The formula matches the engine exactly:
 *   real = nominal / (1 + inflationRate)^yearOffset
 *
 * DisplayMode and MONETARY_FIELDS are imported from @retireops/shared/constants
 * (single source of truth) to avoid drift risk with the engine copy.
 *
 * @see docs/source-of-truth/06-investment-engine.md — Real vs. Nominal Dollars
 */

import type { ProjectionYearRow } from '@retireops/shared/types';
import { MONETARY_FIELDS } from '@retireops/shared/constants';

export type { DisplayMode } from '@retireops/shared/constants';

/**
 * Apply a display mode to an array of projection rows.
 * Returns shallow copies in nominal mode; deflates monetary fields in real mode.
 * Pure and deterministic — never mutates inputs.
 */
export function applyDisplayMode(
  rows: ProjectionYearRow[],
  mode: 'nominal' | 'real',
  inflationRate: number
): ProjectionYearRow[] {
  if (mode === 'nominal') {
    return rows.map((row) => ({ ...row }));
  }

  return rows.map((row, yearOffset) => {
    const factor = Math.pow(1 + inflationRate, yearOffset);
    const converted: Record<string, unknown> = { ...row };
    for (const field of MONETARY_FIELDS) {
      const value = row[field];
      if (typeof value === 'number') {
        converted[field as string] = value / factor;
      }
    }
    return converted as unknown as ProjectionYearRow;
  });
}
