/**
 * Constraint Warnings — web-layer mirror of @retireops/shared/withdrawal/constraints.ts
 * type surface (Phase 29 Plan 02) + builder implementations (Phase 34 Plan 04).
 *
 * Inlined here per the Phase 27 / Phase 28 resilience pattern established by
 * `withdrawal-presets.ts`: a byte-equivalent copy of the shared public type
 * avoids the pnpm-monorepo dist-build dance and keeps the web bundle
 * independent of @retireops/shared rebuild order.
 *
 * BYTE-EQUIVALENCE INVARIANT (test-enforced):
 *   `ConstraintAccountType` MUST be the exact string-literal union
 *     'rrsp' | 'rrif' | 'tfsa' | 'nonReg' | 'lif'
 *   from packages/shared/src/withdrawal/constraints.ts. The pin test in
 *   `ConstraintWarningBanner.test.tsx` constructs sample warnings using each
 *   discriminator so any drift fails at type-check time.
 *
 *   `ConstraintWarning.severity` MUST be the locked literal 'info' (Pitfall 3
 *   from 29-CONTEXT.md — RRIF/LIF advisories never use 'error').
 *
 * If you change either union here without updating the shared source (or
 * vice versa), the test below — or shared package consumers — will fail.
 *
 * Builder implementations (Phase 34 Plan 04) are byte-equivalent to
 * packages/shared/src/withdrawal/constraints.ts lines 149–283. Update both
 * files in tandem when message text changes.
 *
 * @see packages/shared/src/withdrawal/constraints.ts (source of truth)
 * @see packages/shared/src/withdrawal/constraints.ts:149–283 (builder source)
 * @see .planning/phases/29-constraint-validators/29-CONTEXT.md (Pitfalls 2 + 3)
 * @see .planning/phases/34-v4.8-followup/34-04-PLAN.md (wiring context)
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Account-type discriminator for warnings. Mirrors the ScenarioDecisions
 * drawdownOrder token vocabulary. Kept inline to avoid a cross-subpath
 * shared-dist dependency for what is fundamentally a presentation-layer
 * string-literal set.
 */
export type ConstraintAccountType = 'rrsp' | 'rrif' | 'tfsa' | 'nonReg' | 'lif';

/**
 * Single advisory warning emitted by a shared constraint validator. The
 * optional `accountType` lets per-card UI filters select warnings relevant
 * to one account; the banner renders the full list regardless.
 *
 * `severity` is locked to `'info'` (Pitfall 3).
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
// Constants (byte-equivalent to packages/shared/src/withdrawal/constraints.ts)
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
// Builders (byte-equivalent to packages/shared/src/withdrawal/constraints.ts:149–263)
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
// Aggregator (byte-equivalent to packages/shared/src/withdrawal/constraints.ts:274–283)
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

// ---------------------------------------------------------------------------
// Web-layer adapter — Phase 34 Plan 04 (does NOT exist in shared)
// ---------------------------------------------------------------------------

/**
 * Minimal structural types for the adapter. Defined locally so `constraint-warnings.ts`
 * stays decoupled from the full `@retireops/shared` type tree and avoids the
 * dist-barrel issue (shared's withdrawal/index.js does not re-export constraints.ts).
 */
interface ProjectionYearRowLike {
  year: number;
  age: number;
  tfsaWithdrawal?: number;
  totalGrossIncome?: number;
}

interface AccountCardInfoLike {
  type: string;
  currentBalance?: number | string;
}

/**
 * Arguments for `deriveConstraintInput`.
 */
export interface DeriveConstraintInputArgs {
  projectionRows: ProjectionYearRowLike[];
  accountCards: AccountCardInfoLike[];
  drawdownTypeOrder: ReadonlyArray<string>;
}

/**
 * Convert edit-page state into a `ConstraintInput` POJO for `buildAllConstraintWarnings`.
 *
 * Returns `null` when `projectionRows` is empty — no scenario has been run yet,
 * so there is no data to derive warnings from. The banner stays null (E1 invariant).
 *
 * ACB conservatism note: `nonRegAcb` is set to `0` because the adjusted cost
 * base is not surfaced in `accountCards`. With ACB=0 any positive non-reg
 * balance trips the capital-gains advisory, which is the conservative direction
 * for an advisory tool. Full ACB derivation is deferred to a future phase.
 *
 * @see packages/shared/src/withdrawal/constraints.ts (builder source of truth)
 * @see .planning/phases/34-v4.8-followup/34-04-SUMMARY.md (ACB deferral rationale)
 */
export function deriveConstraintInput(args: DeriveConstraintInputArgs): ConstraintInput | null {
  const { projectionRows, accountCards, drawdownTypeOrder } = args;
  if (projectionRows.length === 0) return null;

  // Use the most-recent row (last entry — highest age in a forward projection)
  // for age/income/balance fields, which are end-of-projection quantities.
  const mostRecentRow = projectionRows[projectionRows.length - 1];

  const sumBalance = (type: string): number =>
    accountCards
      .filter((c) => c.type === type)
      .reduce((acc, c) => acc + (Number(c.currentBalance) || 0), 0);

  // CR-01 fix: sample the FIRST row with a TFSA withdrawal for the TFSA advisory
  // inputs. The "useTfsaEarlier" preset (the most common TFSA-first strategy)
  // draws TFSA in early years; the final row's tfsaWithdrawal is 0, so using
  // mostRecentRow would silently suppress the timing advisory. We always want
  // the earliest-year TFSA withdrawal — that is the one the user plans against.
  const firstTfsaRow = projectionRows.find((r) => (r.tfsaWithdrawal ?? 0) > 0);

  return {
    currentYear: mostRecentRow.year,
    primaryAge: mostRecentRow.age,
    rrifBalance: sumBalance('RRIF'),
    lifBalance: sumBalance('LIF'),
    // lifMaximumApprox: undefined — jurisdictional max not surfaced in accountCards; LIF builder handles missing cap gracefully.
    tfsaWithdrawal: firstTfsaRow?.tfsaWithdrawal ?? 0,
    tfsaWithdrawalYear: firstTfsaRow?.year ?? mostRecentRow.year,
    nonRegBalance: sumBalance('NonReg'),
    nonRegAcb: 0, // Conservative fallback — see ACB deferral note above.
    projectedTotalGrossIncome: mostRecentRow.totalGrossIncome ?? 0,
    hasNonRegInDrawdown: drawdownTypeOrder.includes('nonReg'),
  };
}
