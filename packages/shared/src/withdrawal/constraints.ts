/**
 * Constraint Validators — v4.8 Withdrawal Experience (Phase 29)
 *
 * Five pure advisory validators that surface withdrawal-related considerations
 * the user should be aware of, without blocking save. Each builder takes a
 * POJO `ConstraintInput` (derived by the caller from `ScenarioDecisions` +
 * most-recent `ProjectionYearRow` + account snapshots) and returns either a
 * single `ConstraintWarning` or `null` when the condition does not apply.
 *
 * Categories (CON-01..CON-05):
 *   1. RRIF minimum advisory (age ≥ 71 with non-zero RRIF balance)
 *   2. LIF maximum advisory (LIF withdrawal projected at/near jurisdictional cap)
 *   3. TFSA recontribution timing (Pitfall 2 — room restored in withdrawalYear + 1)
 *   4. OAS clawback risk (projected gross income near 2026 threshold)
 *   5. Capital gains realisation (non-reg balance > ACB AND non-reg in drawdown)
 *
 * Severity convention (Pitfall 3, 29-CONTEXT.md `<decisions>`):
 *   All warnings emit `severity: 'info'`. No RRIF- or LIF-related warning may
 *   use `'error'`. These are advisory only — they never gate save.
 *
 * Architecture Principle IV: this module has ZERO imports from
 * `@retireops/calculation-engine`. Inputs are POJOs; downstream consumers
 * are responsible for deriving them from engine output.
 *
 * @see .planning/phases/29-constraint-validators/29-CONTEXT.md
 * @see .planning/phases/29-constraint-validators/29-01-PLAN.md
 * @see docs/source-of-truth/03-rrif-2026.md (RRIF minimum schedule)
 * @see docs/source-of-truth/06-tfsa-2026.md (TFSA recontribution timing)
 * @see docs/source-of-truth/18-pensions-2026.md#2026-oas-clawback-threshold
 * @see docs/source-of-truth/07-withdrawal-strategies.md (non-reg cap gains)
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Account-type discriminator for warnings. Mirrors the ScenarioDecisions
 * drawdownOrder token vocabulary (`rrsp`, `rrif`, `tfsa`, `nonReg`, `lif`).
 * Kept as a local string union to avoid cross-subpath imports.
 */
export type ConstraintAccountType = 'rrsp' | 'rrif' | 'tfsa' | 'nonReg' | 'lif';

/**
 * Single advisory warning emitted by a validator. The optional `accountType`
 * lets per-card UI filters select warnings relevant to one account; banners
 * render the full list (filter-by-presence-of-accountType is not required).
 *
 * `severity` is locked to `'info'` (Pitfall 3 — never `'error'` for RRIF/LIF).
 */
export interface ConstraintWarning {
  id: string;
  severity: 'info';
  accountType?: ConstraintAccountType;
  title: string;
  message: string;
  source?: string;
}

/**
 * POJO input consumed by every builder. Derived by the caller — typically by
 * pulling fields off the most recent `ProjectionYearRow` and the user's
 * `ScenarioDecisions` / account snapshots. Defined locally so this module
 * has no engine / projection-type dependency.
 *
 * Fields:
 *  - `currentYear` — projection's anchor year (used for TFSA timing math).
 *  - `primaryAge` — primary holder age at currentYear (gates RRIF advisory).
 *  - `rrifBalance` — non-zero implies RRIF holdings subject to CRA minimum.
 *  - `lifBalance` — non-zero LIF balance (gates LIF advisory).
 *  - `lifMaximumApprox` — optional jurisdictional max approximation. When
 *      supplied the LIF advisory checks "near cap" (≥ 90%); when omitted the
 *      mere presence of LIF balance + projected LIF withdrawal triggers the
 *      advisory.
 *  - `tfsaWithdrawal` — projected TFSA withdrawal amount (gates TFSA advisory).
 *  - `tfsaWithdrawalYear` — projection year of the withdrawal. Defaults to
 *      `currentYear` when omitted. The advisory's `roomRestoredYear` field
 *      ALWAYS equals `tfsaWithdrawalYear + 1` (Pitfall 2 — hard invariant).
 *  - `nonRegBalance` / `nonRegAcb` — capital gains advisory fires when balance
 *      exceeds ACB AND `hasNonRegInDrawdown` is true.
 *  - `projectedTotalGrossIncome` — primary's projected gross income; the OAS
 *      advisory fires when this approaches/exceeds the 2026 threshold.
 *  - `hasNonRegInDrawdown` — true when non-reg appears in drawdownOrder or
 *      a non-reg withdrawal is projected.
 */
export interface ConstraintInput {
  currentYear: number;
  primaryAge: number;
  rrifBalance: number;
  lifBalance: number;
  lifMaximumApprox?: number;
  tfsaWithdrawal: number;
  tfsaWithdrawalYear?: number;
  nonRegBalance: number;
  nonRegAcb: number;
  projectedTotalGrossIncome: number;
  hasNonRegInDrawdown: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * 2026 OAS clawback minimum (recovery-tax threshold). Same value used by the
 * Phase 27 `protectOas` preset; kept duplicated here rather than reaching
 * across subpaths to honour the Architecture Principle IV boundary.
 *
 * @see docs/source-of-truth/18-pensions-2026.md:824
 */
export const OAS_CLAWBACK_THRESHOLD_2026 = 95_323;

/**
 * RRIF mandatory-minimum gating age. CRA requires conversion by Dec 31 of the
 * year the holder turns 71, so the advisory fires at age ≥ 71 when a
 * non-zero RRIF balance is present.
 *
 * @see docs/source-of-truth/03-rrif-2026.md
 */
const RRIF_MIN_AGE = 71;

/**
 * "Near LIF cap" threshold — when `lifMaximumApprox` is supplied, the advisory
 * fires once projected LIF withdrawal reaches 90% of the supplied maximum.
 * Below this we treat the LIF holding as informational only.
 */
const LIF_NEAR_CAP_RATIO = 0.9;

/**
 * "Near OAS threshold" — fires the OAS clawback advisory once projected
 * gross income reaches 95% of the 2026 statutory minimum. Below 95% we keep
 * silent to avoid noise on plans comfortably below the recovery zone.
 */
const OAS_NEAR_THRESHOLD_RATIO = 0.95;

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/**
 * CON-01 — RRIF minimum advisory.
 *
 * Fires when `primaryAge >= 71` AND `rrifBalance > 0`. Surfaces that CRA
 * forces a minimum withdrawal each year from age 72 onward; the actual rate
 * is engine-side. Always `severity: 'info'` (Pitfall 3 — never `'error'`).
 *
 * @see docs/source-of-truth/03-rrif-2026.md
 */
export function buildRrifConstraintWarning(input: ConstraintInput): ConstraintWarning | null {
  if (input.primaryAge < RRIF_MIN_AGE) return null;
  if (input.rrifBalance <= 0) return null;
  return {
    id: 'rrif-minimum-advisory',
    severity: 'info',
    accountType: 'rrif',
    title: 'RRIF minimum applies',
    message:
      'CRA requires a minimum RRIF withdrawal each year starting the year after conversion. Your projection automatically respects this minimum.',
    source: 'docs/source-of-truth/03-rrif-2026.md',
  };
}

/**
 * CON-02 — LIF maximum advisory.
 *
 * Fires when `lifBalance > 0`. When `lifMaximumApprox` is supplied, the
 * message hardens to "near the jurisdictional cap" only if the projected
 * LIF withdrawal (`lifBalance` is used as a proxy here; callers may pass
 * the projected withdrawal as the balance for a single-year snapshot)
 * crosses `LIF_NEAR_CAP_RATIO`. Always `severity: 'info'`.
 *
 * @see docs/source-of-truth/03-rrif-2026.md (LIF max-withdrawal formula)
 */
export function buildLifConstraintWarning(input: ConstraintInput): ConstraintWarning | null {
  if (input.lifBalance <= 0) return null;

  const hasCapInfo = typeof input.lifMaximumApprox === 'number' && input.lifMaximumApprox > 0;
  if (hasCapInfo) {
    const ratio = input.lifBalance / (input.lifMaximumApprox ?? 1);
    if (ratio < LIF_NEAR_CAP_RATIO) return null;
  }

  return {
    id: 'lif-maximum-advisory',
    severity: 'info',
    accountType: 'lif',
    title: 'LIF withdrawal cap applies',
    message:
      'LIF accounts have a jurisdictional maximum withdrawal each year. Projected LIF withdrawals respect this cap automatically.',
    source: 'docs/source-of-truth/03-rrif-2026.md',
  };
}

/**
 * CON-03 — TFSA recontribution timing advisory (Pitfall 2).
 *
 * Fires when `tfsaWithdrawal > 0`. Surfaces that TFSA room from a withdrawal
 * is restored in the calendar year AFTER the withdrawal, i.e.
 *   roomRestoredYear = tfsaWithdrawalYear + 1
 *
 * This is the hard test acceptance criterion for Phase 29. The message MUST
 * embed the computed `roomRestoredYear` so the test can grep for it.
 *
 * @see docs/source-of-truth/06-tfsa-2026.md
 */
export function buildTfsaConstraintWarning(input: ConstraintInput): ConstraintWarning | null {
  if (input.tfsaWithdrawal <= 0) return null;
  const withdrawalYear = input.tfsaWithdrawalYear ?? input.currentYear;
  // Pitfall 2: room is restored on Jan 1 of the FOLLOWING calendar year.
  const roomRestoredYear = withdrawalYear + 1;
  return {
    id: 'tfsa-recontribution-timing',
    severity: 'info',
    accountType: 'tfsa',
    title: 'TFSA room restored next year',
    message: `TFSA withdrawals do not free up contribution room until the following calendar year. Room from your ${String(withdrawalYear)} withdrawal will be restored on Jan 1, ${String(roomRestoredYear)}.`,
    source: 'docs/source-of-truth/06-tfsa-2026.md',
  };
}

/**
 * CON-04 — OAS clawback risk advisory.
 *
 * Fires when `projectedTotalGrossIncome` is near or above the 2026 statutory
 * minimum (95% threshold). Surfaces that further taxable withdrawals may
 * trigger the OAS recovery tax. Always `severity: 'info'`.
 *
 * @see docs/source-of-truth/18-pensions-2026.md:824
 */
export function buildOasClawbackWarning(input: ConstraintInput): ConstraintWarning | null {
  const trigger = OAS_CLAWBACK_THRESHOLD_2026 * OAS_NEAR_THRESHOLD_RATIO;
  if (input.projectedTotalGrossIncome < trigger) return null;
  return {
    id: 'oas-clawback-risk',
    severity: 'info',
    title: 'Near OAS clawback threshold',
    message: `Projected gross income is near the 2026 OAS recovery-tax threshold (${String(OAS_CLAWBACK_THRESHOLD_2026)}). Additional taxable withdrawals may trigger OAS clawback.`,
    source: 'docs/source-of-truth/18-pensions-2026.md',
  };
}

/**
 * CON-05 — Capital gains realisation advisory.
 *
 * Fires when `nonRegBalance > nonRegAcb` (i.e. there is an embedded unrealised
 * gain) AND non-reg is in the drawdown order (so withdrawals will realise
 * some portion of that gain). Always `severity: 'info'`.
 *
 * @see docs/source-of-truth/07-withdrawal-strategies.md (non-reg gain realisation)
 */
export function buildCapitalGainsWarning(input: ConstraintInput): ConstraintWarning | null {
  if (!input.hasNonRegInDrawdown) return null;
  if (input.nonRegBalance <= input.nonRegAcb) return null;
  return {
    id: 'capital-gains-realisation',
    severity: 'info',
    accountType: 'nonReg',
    title: 'Capital gains will be realised',
    message:
      'Your non-registered balance exceeds its adjusted cost base. Withdrawing from non-registered accounts will realise a proportional capital gain each year.',
    source: 'docs/source-of-truth/07-withdrawal-strategies.md',
  };
}

// ---------------------------------------------------------------------------
// Aggregator
// ---------------------------------------------------------------------------

/**
 * Runs all five builders against a single input and returns the non-null
 * results. Order matches rough urgency (OAS → cap gains → RRIF → LIF → TFSA)
 * per 29-CONTEXT.md `<specifics>`; consumers MAY re-sort or filter.
 */
export function buildAllConstraintWarnings(input: ConstraintInput): ConstraintWarning[] {
  const candidates: Array<ConstraintWarning | null> = [
    buildOasClawbackWarning(input),
    buildCapitalGainsWarning(input),
    buildRrifConstraintWarning(input),
    buildLifConstraintWarning(input),
    buildTfsaConstraintWarning(input),
  ];
  return candidates.filter((w): w is ConstraintWarning => w !== null);
}
