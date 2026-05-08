/**
 * TFSA residency-sliced cumulative-room baseline (M005/S03).
 *
 * Computes the sum of TFSA annual limits accrued before the projection start
 * year, honoring the immigrant residency-slice rule: a holder who became a
 * Canadian resident after the TFSA program began (2009) only accrues room
 * from their residency-start year forward, not from age 18.
 *
 * Pure helper — no Date.now(), no I/O. Backs VR-TFSA-RESIDENCY-001.
 *
 * @see docs/source-of-truth/02-account-types.md - TFSA Section
 */
import { TFSA_ANNUAL_LIMITS } from '@retireops/shared';

const TFSA_PROGRAM_START_YEAR = 2009;
const TFSA_ELIGIBILITY_AGE = 18;

export interface TfsaResidencyBaselineInput {
  birthdate: Date;
  residencyStartYear?: number;
  /** Projection start year — baseline sums limits strictly before this year. */
  startYear: number;
}

/**
 * Sum of TFSA annual limits for years in [effectiveStartYear, startYear - 1],
 * where effectiveStartYear = max(birthYear + 18, residencyStartYear ?? 2009, 2009).
 * Returns 0 when the effective start falls on or after startYear.
 */
export function computeTfsaResidencyBaseline(input: TfsaResidencyBaselineInput): number {
  const { birthdate, residencyStartYear, startYear } = input;
  const birthYear = birthdate.getFullYear();
  const age18Year = birthYear + TFSA_ELIGIBILITY_AGE;
  const residencyFloor = residencyStartYear ?? TFSA_PROGRAM_START_YEAR;
  const effectiveStartYear = Math.max(age18Year, residencyFloor, TFSA_PROGRAM_START_YEAR);

  if (effectiveStartYear >= startYear) return 0;

  let total = 0;
  for (let y = effectiveStartYear; y < startYear; y += 1) {
    total += TFSA_ANNUAL_LIMITS[y] ?? 0;
  }
  return total;
}
