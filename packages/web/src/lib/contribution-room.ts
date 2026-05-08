/**
 * Contribution-room warning helper — M005 Phase 4
 *
 * Compares user-entered RRSP contribution overrides (from the scenario
 * decisions editor) against the latest projection's per-year room values
 * to surface over-contribution warnings.
 *
 * @see docs/source-of-truth/02-account-types.md — RRSP Contribution Room
 */
import type { ProjectionYearRow } from '@retireops/shared';

export interface ContributionOverride {
  accountId: string;
  annualAmount: number;
  startYear: number;
  endYear: number;
  /** Optional owner tag — defaults to 'primary' when absent. */
  owner?: 'primary' | 'spouse';
}

export interface RoomViolation {
  accountId: string;
  owner: 'primary' | 'spouse';
  year: number;
  requested: number;
  available: number;
  overage: number;
}

/**
 * Find every (override, year) pair whose annualAmount exceeds the
 * corresponding RRSP contribution room on the matching projection row.
 *
 * Years outside the projection range are skipped silently — the warning
 * cannot be authoritative without a row to compare against.
 */
export function findContributionOverages(
  overrides: ContributionOverride[],
  rows: ProjectionYearRow[]
): RoomViolation[] {
  if (rows.length === 0) return [];
  const violations: RoomViolation[] = [];

  const rowByYear = new Map<number, ProjectionYearRow>();
  for (const row of rows) rowByYear.set(row.year, row);

  for (const override of overrides) {
    const owner: 'primary' | 'spouse' = override.owner ?? 'primary';
    for (let year = override.startYear; year <= override.endYear; year++) {
      const row = rowByYear.get(year);
      if (!row) continue;
      const available =
        owner === 'spouse' ? row.spouseRrspContributionRoom : row.rrspContributionRoom;
      if (available === undefined) continue;
      if (override.annualAmount > available) {
        violations.push({
          accountId: override.accountId,
          owner,
          year,
          requested: override.annualAmount,
          available,
          overage: override.annualAmount - available,
        });
      }
    }
  }

  return violations;
}
