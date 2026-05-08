/**
 * Contribution-Room Ledger — pure per-year state transition (M005/S01).
 *
 * Given a {@link ContributionRoomLedger} and a {@link LedgerYearInput}, returns
 * a freshly constructed next-year ledger, an array of structured
 * {@link LedgerWarning} entries for any rule violations, and the aggregate
 * {@link OverContributionPenalty} incurred this year. The helper is deterministic
 * and side-effect-free: no Date.now / Math.random / I/O per the calculation-engine
 * constraint (K005 reference persistence, K001 ESM .js imports).
 *
 * Forward-references validation rules authored in S05:
 *   - VR-RRSP-PA-001: RRSP room accrual net of pension-adjustment with zero floor.
 *   - VR-TFSA-RESIDENCY-001: TFSA cumulative cap honors residency-sliced baseline.
 *   - VR-FHSA-CARRY-001: FHSA carry-forward capped at 8000 with 16000 single-year cap.
 *   - VR-ROOM-PENALTY-001: 1%/month × 12 over-contribution penalty math.
 *
 * @see docs/source-of-truth/02-account-types.md
 */
import type {
  ContributionRoomLedger,
  FHSASubLedger,
  LedgerWarning,
  LedgerYearInput,
  OverContributionPenalty,
  RRSPSubLedger,
  TFSASubLedger,
} from '@retireops/shared';
import { FHSA_LIMITS, TFSA_ANNUAL_LIMITS } from '@retireops/shared';
import { calculateRRSPContributionRoom } from '../accounts/rrsp.js';

export interface ApplyContributionRoomYearResult {
  newLedger: ContributionRoomLedger;
  warnings: LedgerWarning[];
  penalty: OverContributionPenalty;
}

const RRSP_OVER_CONTRIBUTION_BUFFER = 2000;
const MONTHLY_PENALTY_RATE = 0.01;
const MONTHS_PER_YEAR = 12;

function latestTfsaYear(): number {
  let latest = 0;
  for (const key of Object.keys(TFSA_ANNUAL_LIMITS)) {
    const y = Number(key);
    if (y > latest) latest = y;
  }
  return latest;
}

function getTfsaAnnualLimit(year: number): number {
  const direct = TFSA_ANNUAL_LIMITS[year];
  if (direct !== undefined) return direct;
  const fallback = TFSA_ANNUAL_LIMITS[latestTfsaYear()];
  return fallback ?? 0;
}

export function applyContributionRoomYear(
  ledger: ContributionRoomLedger,
  yearInput: LedgerYearInput
): ApplyContributionRoomYearResult {
  const warnings: LedgerWarning[] = [];
  const penalty: OverContributionPenalty = { rrsp: 0, tfsa: 0, fhsa: 0 };

  const newRrsp = applyRrspBranch(ledger.rrsp, yearInput, warnings, penalty);
  const newTfsa = applyTfsaBranch(ledger.tfsa, yearInput, warnings, penalty);
  const newFhsa = applyFhsaBranch(ledger.fhsa, yearInput, warnings, penalty);

  const newLedger: ContributionRoomLedger = {
    rrsp: newRrsp,
    tfsa: newTfsa,
    fhsa: newFhsa,
  };

  return { newLedger, warnings, penalty };
}

function applyRrspBranch(
  prior: RRSPSubLedger,
  input: LedgerYearInput,
  warnings: LedgerWarning[],
  penalty: OverContributionPenalty
): RRSPSubLedger {
  const currentYearAccrual = calculateRRSPContributionRoom(input.earnedIncome, 0, input.year);
  const paReduced = Math.max(0, currentYearAccrual - input.pensionAdjustment);
  const roomBefore = prior.roomAvailable + paReduced;

  const overAmount = Math.max(
    0,
    input.rrspContribution - roomBefore - RRSP_OVER_CONTRIBUTION_BUFFER
  );
  if (overAmount > 0) {
    const amount = overAmount * MONTHLY_PENALTY_RATE * MONTHS_PER_YEAR;
    penalty.rrsp = amount;
    warnings.push({
      year: input.year,
      person: input.person,
      accountType: 'rrsp',
      kind: 'over-contribution',
      message: `RRSP over-contribution of ${overAmount.toFixed(2)} exceeds the ${RRSP_OVER_CONTRIBUTION_BUFFER.toString()} buffer; 1%/month penalty applied.`,
      penaltyAmount: amount,
    });
  }

  const roomAfter = Math.max(0, roomBefore - input.rrspContribution);
  return { roomAvailable: roomAfter };
}

function applyTfsaBranch(
  prior: TFSASubLedger,
  input: LedgerYearInput,
  warnings: LedgerWarning[],
  penalty: OverContributionPenalty
): TFSASubLedger {
  const annualAccrual = getTfsaAnnualLimit(input.year);
  const roomBefore = prior.roomAvailable + annualAccrual;

  const overAmount = Math.max(0, input.tfsaContribution - roomBefore);
  if (overAmount > 0) {
    const amount = overAmount * MONTHLY_PENALTY_RATE * MONTHS_PER_YEAR;
    penalty.tfsa = amount;
    warnings.push({
      year: input.year,
      person: input.person,
      accountType: 'tfsa',
      kind: 'over-contribution',
      message: `TFSA over-contribution of ${overAmount.toFixed(2)} exceeds available room; 1%/month penalty applied.`,
      penaltyAmount: amount,
    });
  }

  const roomAfter = Math.max(0, roomBefore - input.tfsaContribution);
  return {
    roomAvailable: roomAfter,
    cumulativeCapBaseline: prior.cumulativeCapBaseline,
  };
}

function applyFhsaBranch(
  prior: FHSASubLedger,
  input: LedgerYearInput,
  warnings: LedgerWarning[],
  penalty: OverContributionPenalty
): FHSASubLedger {
  const participationRoom = Math.min(
    FHSA_LIMITS.singleYearCap,
    FHSA_LIMITS.annualLimit + prior.carryForwardAvailable
  );
  const lifetimeRemaining = Math.max(0, FHSA_LIMITS.lifetimeLimit - prior.lifetimeContributed);
  const effectiveRoom = Math.min(participationRoom, lifetimeRemaining);

  const overAmount = Math.max(0, input.fhsaContribution - effectiveRoom);
  if (overAmount > 0) {
    const amount = overAmount * MONTHLY_PENALTY_RATE * MONTHS_PER_YEAR;
    penalty.fhsa = amount;
    const exceedsLifetime =
      prior.lifetimeContributed + input.fhsaContribution > FHSA_LIMITS.lifetimeLimit;
    warnings.push({
      year: input.year,
      person: input.person,
      accountType: 'fhsa',
      kind: exceedsLifetime ? 'lifetime-cap-exceeded' : 'over-contribution',
      message: exceedsLifetime
        ? `FHSA contribution exceeds lifetime limit of ${FHSA_LIMITS.lifetimeLimit.toString()} by ${overAmount.toFixed(2)}; 1%/month penalty applied.`
        : `FHSA over-contribution of ${overAmount.toFixed(2)} exceeds single-year cap of ${FHSA_LIMITS.singleYearCap.toString()}; 1%/month penalty applied.`,
      penaltyAmount: amount,
    });
  }

  const consumed = Math.min(input.fhsaContribution, effectiveRoom);
  const annualRoomAfter = Math.max(0, FHSA_LIMITS.annualLimit - consumed);
  const roomRemaining = Math.max(0, participationRoom - consumed);
  const carryForwardNext = Math.min(FHSA_LIMITS.carryForwardLimit, roomRemaining);

  return {
    annualRoomRemaining: annualRoomAfter,
    carryForwardAvailable: carryForwardNext,
    lifetimeContributed: Math.min(FHSA_LIMITS.lifetimeLimit, prior.lifetimeContributed + consumed),
  };
}
