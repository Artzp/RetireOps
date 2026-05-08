/**
 * Per-iteration RRSP-room + employment-income derivations for the couple path.
 *
 * Extracted from multi-year.ts (Phase 10 plan 10-04 LOC cleanup, ENG-05).
 * Computes the per-spouse employment income (with growth, zeroed when deceased
 * or post-retirement), the prior-year earned income, and the M005/S02
 * RRSP-room ledger carry + PA-adjusted current-year accrual. Also handles the
 * spousal-RRSP routing math (combined-cap at primary room, personal-first
 * allocation).
 *
 * @see docs/source-of-truth/02-account-types.md - RRSP-002
 * @see docs/source-of-truth/03-income-sources.md - employment income
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 */

import type { ContributionRoomLedger, ProjectionInput } from '@retireops/shared';
import { calculateRRSPContributionRoom } from '../../accounts/rrsp.js';

export interface CouplePerYearDerivationsArgs {
  input: ProjectionInput;
  spouse: NonNullable<ProjectionInput['spouse']>;
  yearsFromStart: number;
  year: number;
  primaryDeceased: boolean;
  spouseDeceased: boolean;
  primaryIsPreRetirement: boolean;
  spouseIsPreRetirement: boolean;
  primaryLedger: ContributionRoomLedger;
  spouseLedger: ContributionRoomLedger;
}

export interface CouplePerYearDerivations {
  primaryEmploymentIncome: number;
  spouseEmploymentIncome: number;
  primaryPriorYearEarned: number;
  spousePriorYearEarned: number;
  pensionAdjustmentPrimary: number;
  pensionAdjustmentSpouse: number;
  primaryAvailableRRSPRoom: number;
  spouseAvailableRRSPRoom: number;
  requestedPrimaryTotal: number;
  requestedSpousePersonalRRSP: number;
  cappedSpousalPart: number;
  primaryCappedRRSP: number;
  spouseCappedRRSP: number;
}

export function computeCouplePerYearDerivations(
  args: CouplePerYearDerivationsArgs
): CouplePerYearDerivations {
  const {
    input,
    spouse,
    yearsFromStart,
    year,
    primaryDeceased,
    spouseDeceased,
    primaryIsPreRetirement,
    spouseIsPreRetirement,
    primaryLedger,
    spouseLedger,
  } = args;

  // Calculate employment incomes with growth
  const primaryEmploymentIncome =
    !primaryDeceased && primaryIsPreRetirement
      ? input.employmentIncome * Math.pow(1 + input.employmentGrowthRate, yearsFromStart)
      : 0;
  const spouseEmploymentIncome =
    !spouseDeceased && spouseIsPreRetirement
      ? spouse.employmentIncome * Math.pow(1 + (spouse.employmentGrowthRate ?? 0), yearsFromStart)
      : 0;

  // Cap RRSP contributions at CRA room (18% of prior-year earned income up to annual max)
  const primaryPriorYearEarned =
    yearsFromStart === 0
      ? input.employmentIncome
      : input.employmentIncome * Math.pow(1 + input.employmentGrowthRate, yearsFromStart - 1);

  // M005/S02: RRSP room via contribution-room ledger + PA-adjusted current-year accrual.
  const pensionAdjustmentPrimary = input.pensionAdjustment ?? 0;
  const primaryCurrentYearAccrual = calculateRRSPContributionRoom(primaryPriorYearEarned, 0, year);
  const primaryPaAdjustedAccrual = Math.max(
    0,
    primaryCurrentYearAccrual - pensionAdjustmentPrimary
  );
  const primaryAvailableRRSPRoom = primaryLedger.rrsp.roomAvailable + primaryPaAdjustedAccrual;

  // Spousal routing: primary's rrspAnnualContribution is a combined total.
  // The portion routed to spouse's RRSP (spousalPart) is charged to the
  // primary's room — spouse's own room is never touched by this deposit.
  const primaryContributingEligible = !primaryDeceased && primaryIsPreRetirement;
  const requestedPrimaryTotal = primaryContributingEligible ? input.rrspAnnualContribution : 0;
  const requestedSpousalPart = primaryContributingEligible
    ? Math.min(input.spousalRrspContribution ?? 0, requestedPrimaryTotal)
    : 0;
  const requestedPrimaryPersonalPart = requestedPrimaryTotal - requestedSpousalPart;

  // Cap combined total at primary's available room; allocate to personal first,
  // so the spousal portion only shrinks once personal is fully funded from room.
  const cappedPrimaryTotal = Math.min(requestedPrimaryTotal, primaryAvailableRRSPRoom);
  const cappedPrimaryPersonal = Math.min(requestedPrimaryPersonalPart, cappedPrimaryTotal);
  const cappedSpousalPart = Math.max(0, cappedPrimaryTotal - cappedPrimaryPersonal);

  const spousePriorYearEarned =
    yearsFromStart === 0
      ? spouse.employmentIncome
      : spouse.employmentIncome *
        Math.pow(1 + (spouse.employmentGrowthRate ?? 0), yearsFromStart - 1);

  const pensionAdjustmentSpouse = spouse.pensionAdjustment ?? 0;
  const spouseCurrentYearAccrual = calculateRRSPContributionRoom(spousePriorYearEarned, 0, year);
  const spousePaAdjustedAccrual = Math.max(0, spouseCurrentYearAccrual - pensionAdjustmentSpouse);
  const spouseAvailableRRSPRoom = spouseLedger.rrsp.roomAvailable + spousePaAdjustedAccrual;

  const requestedSpousePersonalRRSP =
    !spouseDeceased && spouseIsPreRetirement ? (spouse.rrspAnnualContribution ?? 0) : 0;
  const cappedSpousePersonal = Math.min(requestedSpousePersonalRRSP, spouseAvailableRRSPRoom);

  // Routing into calculateCoupleYear: primary's RRSP balance grows only by the
  // personal part; the spousal-part cash lands in spouse's RRSP balance.
  const primaryCappedRRSP = cappedPrimaryPersonal;
  const spouseCappedRRSP = cappedSpousePersonal + cappedSpousalPart;

  return {
    primaryEmploymentIncome,
    spouseEmploymentIncome,
    primaryPriorYearEarned,
    spousePriorYearEarned,
    pensionAdjustmentPrimary,
    pensionAdjustmentSpouse,
    primaryAvailableRRSPRoom,
    spouseAvailableRRSPRoom,
    requestedPrimaryTotal,
    requestedSpousePersonalRRSP,
    cappedSpousalPart,
    primaryCappedRRSP,
    spouseCappedRRSP,
  };
}
