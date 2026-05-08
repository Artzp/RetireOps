/**
 * Per-year contribution-room ledger advance + diagnostic-merge step.
 *
 * Extracted from multi-year.ts (Phase 10 plan 10-02 ENG-05 helper extraction).
 * Wraps the per-iteration `applyContributionRoomYear` invocation and applies
 * the conditional surfacing of:
 *   - rrspContributionRoom (always set)
 *   - tfsaContributionRoom / fhsaContributionRoom (always set)
 *   - overContributionPenalty.{rrsp,tfsa,fhsa} (only when any > 0)
 *   - ledgerWarnings (only when non-empty)
 *
 * Single and couple paths surface the full ledger output identically; the
 * shape differs only because each path operates on a different result row
 * type (YearlyResult vs PersonYearlyResult).
 *
 * Returns the new ledger, the next-year row with diagnostics merged, plus the
 * raw step output so the caller can chain (e.g. couple-path emits per-person
 * spousal-RRSP penalty checks).
 *
 * @see docs/source-of-truth/02-account-types.md - RRSP-002, VR-TFSA-RESIDENCY-001
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 */

import type {
  AccountOwner,
  ContributionRoomLedger,
  YearlyResult,
  PersonYearlyResult,
} from '@retireops/shared';

import { applyContributionRoomYear } from '../contribution-room-ledger.js';

export interface ContributionLedgerStepInput {
  year: number;
  person: AccountOwner;
  earnedIncome: number;
  pensionAdjustment: number;
  rrspContribution: number;
  tfsaContribution: number;
  fhsaContribution: number;
  residencyStartYear?: number;
  /**
   * The ALREADY-COMPUTED rrsp room available pre-step. The helper does not
   * recompute this — it threads the value onto the result row exactly as the
   * pre-extraction code did.
   */
  rrspRoomAvailableForRow: number;
}

export interface SingleLedgerStepOutput {
  newLedger: ContributionRoomLedger;
  /** Result row WITH full ledger diagnostics merged (RRSP + TFSA + FHSA rooms, penalty, warnings). */
  result: YearlyResult;
}

export interface PersonLedgerStepOutput {
  newLedger: ContributionRoomLedger;
  /** Result row WITH diagnostics merged (full per-person semantics). */
  result: PersonYearlyResult;
}

/**
 * Single-path variant: surfaces the full ledger output (RRSP + TFSA + FHSA
 * contribution rooms, multi-account penalty, warnings) onto YearlyResult.
 *
 * Mirrors updateContributionLedgersPerson — the two paths now diverge only
 * in their result-row type (YearlyResult vs PersonYearlyResult), not in
 * which diagnostics they surface. Closes the v4.4 gap where single users
 * silently lost TFSA/FHSA over-contribution warnings and penalties.
 *
 * Returns the new ledger and the result row with diagnostics merged. Caller
 * pushes `result` and reassigns its ledger reference.
 */
export function updateContributionLedgersSingle(
  ledger: ContributionRoomLedger,
  step: ContributionLedgerStepInput,
  row: YearlyResult
): SingleLedgerStepOutput {
  const { newLedger, warnings, penalty } = applyContributionRoomYear(ledger, {
    year: step.year,
    person: step.person,
    earnedIncome: step.earnedIncome,
    pensionAdjustment: step.pensionAdjustment,
    rrspContribution: step.rrspContribution,
    tfsaContribution: step.tfsaContribution,
    fhsaContribution: step.fhsaContribution,
    ...(step.residencyStartYear !== undefined && { residencyStartYear: step.residencyStartYear }),
  });

  const result: YearlyResult = {
    ...row,
    rrspContributionRoom: step.rrspRoomAvailableForRow,
    tfsaContributionRoom: newLedger.tfsa.roomAvailable,
    fhsaContributionRoom: newLedger.fhsa.annualRoomRemaining,
  };
  const hasPenalty = penalty.rrsp > 0 || penalty.tfsa > 0 || penalty.fhsa > 0;
  if (hasPenalty) {
    result.overContributionPenalty = { rrsp: penalty.rrsp, tfsa: penalty.tfsa, fhsa: penalty.fhsa };
  }
  if (warnings.length > 0) {
    result.ledgerWarnings = warnings;
  }

  return { newLedger, result };
}

/**
 * Couple-path per-person variant: surfaces full ledger output
 * (rrsp + tfsa + fhsa contribution rooms + multi-account penalty + warnings)
 * onto the PersonYearlyResult row, mirroring the pre-extraction
 * computeCoupleProjection year-loop block.
 */
export function updateContributionLedgersPerson(
  ledger: ContributionRoomLedger,
  step: ContributionLedgerStepInput,
  row: PersonYearlyResult
): PersonLedgerStepOutput {
  const { newLedger, warnings, penalty } = applyContributionRoomYear(ledger, {
    year: step.year,
    person: step.person,
    earnedIncome: step.earnedIncome,
    pensionAdjustment: step.pensionAdjustment,
    rrspContribution: step.rrspContribution,
    tfsaContribution: step.tfsaContribution,
    fhsaContribution: step.fhsaContribution,
    ...(step.residencyStartYear !== undefined && { residencyStartYear: step.residencyStartYear }),
  });

  const result: PersonYearlyResult = {
    ...row,
    rrspContributionRoom: step.rrspRoomAvailableForRow,
    tfsaContributionRoom: newLedger.tfsa.roomAvailable,
    fhsaContributionRoom: newLedger.fhsa.annualRoomRemaining,
  };
  const hasPenalty = penalty.rrsp > 0 || penalty.tfsa > 0 || penalty.fhsa > 0;
  if (hasPenalty) {
    result.overContributionPenalty = { rrsp: penalty.rrsp, tfsa: penalty.tfsa, fhsa: penalty.fhsa };
  }
  if (warnings.length > 0) {
    result.ledgerWarnings = warnings;
  }

  return { newLedger, result };
}

// CONVENIENCE re-export: the public ROADMAP ENG-05 name. The two variants
// share identical contribution-room logic; the re-export keeps the named
// `updateContributionLedgers` symbol that the ROADMAP cites as the helper
// to be extracted, while the underlying implementations remain split by row
// type for type-safety.
export const updateContributionLedgers = {
  single: updateContributionLedgersSingle,
  person: updateContributionLedgersPerson,
} as const;
