/**
 * Projection Types
 * @see docs/source-of-truth/08-projection-engine.md
 */
import type { ProvinceCode } from './province.js';
import type { TaxCalculation } from './tax.js';
import type { AccountOwner, SpousalRRSPLedger } from './accounts.js';
import type { MaritalStatus } from './user.js';
import type { LIFJurisdiction } from '../constants/lif-rates.js';

// ---------------------------------------------------------------------------
// Phase 1 Override Sidecar Types (D-22, D-23)
// @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-22, D-23
// ---------------------------------------------------------------------------

/**
 * Per-field override metadata embedded on YearlyResult / PersonYearlyResult per D-22.
 * Phase 2 will extend the SAME structure with ruleId/ruleName/inputs/docRef (D-23 — not yet).
 */
export interface OverrideFieldMetadata {
  source: 'override';
  /** Real-dollar amount the user typed (D-06 invariant — stored amount survives clamping). */
  requestedReal: number;
  /** Nominal (inflated) amount the engine tried to withdraw. */
  requestedNominal: number;
  /** Actual nominal amount withdrawn (equals requestedNominal unless clamped — D-11). */
  actual: number;
  /** True when actual < requestedNominal due to balance constraint (D-11 clamp-to-balance). */
  clamped: boolean;
}

export interface OverrideMetadata {
  rrspWithdrawal?: OverrideFieldMetadata;
  rrifWithdrawal?: OverrideFieldMetadata;
  tfsaWithdrawal?: OverrideFieldMetadata;
  nonRegWithdrawal?: OverrideFieldMetadata;
  lifWithdrawal?: OverrideFieldMetadata;
  /** Spending override metadata. Never clamped (spending overrides replace the spending target). */
  livingExpenses?: Omit<OverrideFieldMetadata, 'clamped' | 'actual'>;
}

/** Projection-level warning emitted by the override pass (D-17, Assumption A5, A6). */
export interface OverrideWarning {
  code:
    | 'surplus_destination_missing'
    | 'override_below_rrif_minimum'
    | 'lif_override_exceeds_maximum';
  year?: number;
  destination?: 'rrsp' | 'rrif' | 'lif' | 'tfsa' | 'nonreg';
  /** Additional free-form context (e.g., minimum amount, requested amount) — never PII. */
  context?: Record<string, number | string>;
}

// ---------------------------------------------------------------------------
// Phase 2 Provenance Sidecar Types (D-32, D-33)
// @see .planning/phases/02-cell-provenance/02-CONTEXT.md - D-32, D-33, D-40
// ---------------------------------------------------------------------------

/**
 * Per-cell provenance metadata embedded on YearlyResult / PersonYearlyResult / ProjectionYearRow
 * per D-32 — sibling to OverrideMetadata.
 *
 * Each in-scope cell (D-33, D-38) emits one of these objects describing which rule produced
 * the value, what numeric inputs the engine used, and where in docs/source-of-truth/ the rule
 * is defined. The doc-anchor invariant (D-51) is enforced by provenance-doc-refs.test.ts —
 * every emitted `docRef` must resolve to a real heading slug.
 *
 * @see .planning/phases/02-cell-provenance/02-CONTEXT.md - D-32, D-33, D-40
 * @see docs/source-of-truth/00-design-philosophy.md - engine purity (no Date.now in emission)
 */
export interface ProvenanceCellMetadata {
  /** 'engine' = computed by an engine rule; 'override' = user-supplied per D-40. */
  source: 'engine' | 'override';
  /** Stable identifier — once shipped, changing this is a breaking change for cached blobs. */
  ruleId: string;
  /** Human-readable rule name, e.g. 'Federal tax — 2024 bracket schedule' or 'User override'. */
  ruleName: string;
  /** Discoverable input record (e.g. { totalTaxableIncome: 78400, marginalRate: 0.205, applyForward: false }). Values must serialize to JSON without custom transformers (D-34). */
  inputs: Record<string, number | string | boolean>;
  /** Path + GitHub-slug anchor (D-50): `docs/source-of-truth/<file>.md#<slug>`. Web composes the full URL via NEXT_PUBLIC_DOCS_BASE_URL (D-52). */
  docRef: string;
  /**
   * Override metadata, populated only when `source === 'override'` and the API service layer
   * has captured timestamps + originalEngineValue (PROV-02, D-46, D-47).
   * The deterministic engine never writes these fields (engine purity — D-49).
   */
  overrideMeta?: {
    /** ISO-8601 datetime, written by the API service at PATCH time. */
    createdAt: string;
    /** ISO-8601 datetime of last update. */
    updatedAt: string;
    /** Engine-calculated value the override replaced (real dollars). */
    originalEngineValue: number;
  };
}

/**
 * Cell-keyed sidecar attached to each YearlyResult / PersonYearlyResult / ProjectionYearRow.
 * Keyed by the 11 v4.2 in-scope field names (D-33, D-38). Absence of a key signals
 * out-of-scope (D-36, D-39 — UI shows the v4.3 placeholder).
 */
export type ProvenanceMetadata = {
  // Editable cells (Phase 1 already overridable)
  rrspWithdrawal?: ProvenanceCellMetadata;
  rrifWithdrawal?: ProvenanceCellMetadata;
  tfsaWithdrawal?: ProvenanceCellMetadata;
  nonRegWithdrawal?: ProvenanceCellMetadata;
  lifWithdrawal?: ProvenanceCellMetadata;
  livingExpenses?: ProvenanceCellMetadata;
  // Direct upstream dependencies
  rrifMandatoryMinimum?: ProvenanceCellMetadata;
  totalIncome?: ProvenanceCellMetadata;
  // Tax fields
  federalTax?: ProvenanceCellMetadata;
  provincialTax?: ProvenanceCellMetadata;
  totalTaxes?: ProvenanceCellMetadata;
};

// ---------------------------------------------------------------------------
// Contribution-Room Ledger Types (M005/S01)
// ---------------------------------------------------------------------------

/** Account types tracked by the contribution-room ledger. */
export type LedgerAccountType = 'rrsp' | 'tfsa' | 'fhsa';

/** Warning kind emitted when a ledger rule is violated. */
export type LedgerWarningKind = 'over-contribution' | 'lifetime-cap-exceeded';

/**
 * A single structured warning entry emitted by the contribution-room ledger
 * when a rule is violated (over-contribution, lifetime cap, etc.).
 * @see docs/source-of-truth/02-account-types.md
 */
export interface LedgerWarning {
  year: number;
  person: AccountOwner;
  accountType: LedgerAccountType;
  kind: LedgerWarningKind;
  message: string;
  /** CRA penalty tax incurred (1%/month × over-amount). Zero when kind is informational. */
  penaltyAmount: number;
}

/**
 * Aggregate over-contribution penalty for one person in one year.
 * All fields are zero when no over-contribution occurred.
 * @see docs/source-of-truth/02-account-types.md
 */
export interface OverContributionPenalty {
  rrsp: number;
  tfsa: number;
  fhsa: number;
}

/** RRSP sub-ledger state carried across projection years. */
export interface RRSPSubLedger {
  /** Current available room (prior unused room + current-year accrual − contributions). */
  roomAvailable: number;
}

/** TFSA sub-ledger state carried across projection years. */
export interface TFSASubLedger {
  /** Current available room this year. */
  roomAvailable: number;
  /**
   * Residency-sliced cumulative cap baseline computed at ledger initialization.
   * Accounts for years of Canadian residency when the holder was 18+.
   */
  cumulativeCapBaseline: number;
}

/** FHSA sub-ledger state carried across projection years. */
export interface FHSASubLedger {
  /** Annual room remaining for the current year (resets each year, before carry-forward). */
  annualRoomRemaining: number;
  /**
   * Carry-forward from the prior year (capped at FHSA_LIMITS.carryForwardLimit = 8000).
   * Added to the annual limit at the start of each year to yield singleYearCap (max 16000).
   */
  carryForwardAvailable: number;
  /** Lifetime cumulative contributed. Contributions stop once this reaches FHSA_LIMITS.lifetimeLimit (40000). */
  lifetimeContributed: number;
}

/**
 * Per-person contribution-room ledger carrying state across projection years.
 * Initialized once before the projection loop; mutated in place each year via
 * the pure `applyContributionRoomYear` helper (M005/S01).
 * @see docs/source-of-truth/02-account-types.md
 */
export interface ContributionRoomLedger {
  rrsp: RRSPSubLedger;
  tfsa: TFSASubLedger;
  fhsa: FHSASubLedger;
}

/**
 * Minimal per-year input consumed by the pure `applyContributionRoomYear` helper.
 * The projection loop extracts these from its year-of-projection context (S02 wires this).
 * @see docs/source-of-truth/02-account-types.md
 */
export interface LedgerYearInput {
  year: number;
  person: AccountOwner;
  /** Earned income from the prior year (basis for RRSP room accrual). */
  earnedIncome: number;
  /** CRA pension adjustment for the prior year (reduces RRSP room). */
  pensionAdjustment: number;
  /** RRSP contribution made in this year (charged against RRSP room). */
  rrspContribution: number;
  /** TFSA contribution made in this year (charged against TFSA room). */
  tfsaContribution: number;
  /** FHSA contribution made in this year (charged against FHSA room and lifetime cap). */
  fhsaContribution: number;
  /**
   * Year the holder first became a Canadian resident at or after age 18.
   * Drives TFSA residency slicing for immigrants. Defaults to the year they turned 18
   * when omitted (full lifetime TFSA room assumed).
   */
  residencyStartYear?: number;
}

/**
 * Projection Input - Phase 1 MVP
 * @see docs/source-of-truth/11-development-roadmap.md - Phase 1 Data Inputs
 */
export interface ProjectionInput {
  // Profile
  birthdate: Date;
  province: ProvinceCode;
  retirementAge: number;
  lifeExpectancy: number;
  maritalStatus?: MaritalStatus;

  // Income
  employmentIncome: number;
  employmentGrowthRate: number;
  pensionIncome?: number;
  bridgeBenefit?: number;
  bridgeEndAge?: number;
  /** Age at which pension income begins. Zero before this age. @see BUG-01 */
  pensionStartAge?: number;

  // Accounts
  rrspBalance: number;
  rrspAnnualContribution: number;
  /**
   * CRA pension adjustment applied uniformly to every projection year; throttles RRSP room
   * accrual via the contribution-room ledger (M005/S02). Defaults to 0 when omitted.
   * A per-year PA schedule is out of scope (D025, revisable).
   * @see docs/source-of-truth/02-account-types.md — RRSP Room
   */
  pensionAdjustment?: number;
  /**
   * Existing unused RRSP room carried into the first projection year.
   * Lets the projection start from the user's real CRA deduction limit rather than 0.
   */
  rrspUnusedRoomSeed?: number;
  /**
   * Portion of the primary's annual RRSP contribution routed into a spousal RRSP.
   * Charged to the primary's room and appended to the spouse's spousalRrspLedger;
   * never deducted from the spouse's own room. Defaults to 0 when omitted.
   * @see docs/source-of-truth/02-account-types.md — RRSP Spousal Attribution
   */
  spousalRrspContribution?: number;
  /** Primary RRIF balance — required only for scenarios where the primary has already converted (e.g. TC-RRIF-018/019). */
  rrifBalance?: number;
  /** Primary LIRA balance (optional). */
  liraBalance?: number;
  /** Primary LIF balance (optional). */
  lifBalance?: number;
  /** Primary LIF governing jurisdiction (optional). */
  lifJurisdiction?: LIFJurisdiction;
  /** Prior-year realized return rate for primary LIF (Ontario/BC/NL use this in the max-withdrawal formula). */
  lifPriorYearReturnRate?: number;
  tfsaBalance: number;
  tfsaAnnualContribution: number;
  /**
   * FHSA contribution made each projection year. Charged against FHSA annual room
   * (with up to $8k carry-forward, $16k single-year cap) and the $40k lifetime cap
   * by the contribution-room ledger. Defaults to 0 when omitted.
   * @see docs/source-of-truth/02-account-types.md — FHSA Contribution Room (VR-FHSA-CARRY-001)
   */
  fhsaAnnualContribution?: number;
  /**
   * Seed of prior-year lifetime FHSA contributions for mid-life projections where the
   * user has already contributed to FHSA before the projection start. Defaults to 0.
   * Capped at FHSA lifetime limit ($40,000).
   * @see docs/source-of-truth/02-account-types.md — FHSA Lifetime Cap
   */
  fhsaLifetimeContributedSeed?: number;
  nonRegBalance: number;
  nonRegACB?: number;
  nonRegInterestIncome?: number;
  nonRegEligibleDividends?: number;
  nonRegNonEligibleDividends?: number;
  nonRegRealizedCapitalGains?: number;

  // Retirement
  retirementSpending: number;
  /**
   * Annual debt payments surfaced by the API transformer for year-by-year
   * cash-flow views. Engine math remains separate from base retirement spending.
   */
  debtPaymentsAnnual?: number;
  /** Number of projection years the debt payment should remain active. */
  debtPaymentYears?: number;

  // Assumptions
  investmentReturn: number;
  inflationRate: number;

  // Optional - Phase 2
  expectedCPPAt65?: number;
  cppStartAge?: number;
  oasStartAge?: number;
  yearsOfResidence?: number;
  /**
   * Year the primary holder first became a Canadian resident at or after age 18.
   * Drives TFSA residency slicing for immigrants (VR-TFSA-RESIDENCY-001, M005/S03).
   * When omitted, the ledger assumes full lifetime TFSA room from age 18 onward.
   */
  residencyStartYear?: number;

  // Spouse/Couple - Phase 2
  spouse?: SpouseInput;
  coupleSettings?: CoupleSettings;

  // --- Scenario strategy wiring (Phase 25, D-01) ---
  /** TAX-01: account type priority array for withdrawal drawdown. Falls back to default order when undefined. */
  drawdownOrder?: string[];
  /**
   * Named withdrawal-strategy preset. When set AND drawdownOrder is undefined,
   * the engine sources drawdown order from WITHDRAWAL_STRATEGIES[strategyId].
   * Explicit drawdownOrder always wins.
   * @see packages/calculation-engine/src/withdrawals/strategy.ts
   */
  strategyId?: 'standard' | 'tfsaFirst' | 'oasProtection' | 'bracketFilling';
  /** TAX-02: RRSP meltdown Custom mode — fixed annual withdrawal in specified year range before RRIF conversion. */
  rrspMeltdown?: {
    enabled: boolean;
    annualAmount: number;
    startYear: number;
    endYear: number;
    /** When set, meltdown withdrawals stop once RRSP balance reaches this floor. @see ROUT-03 */
    targetAmount?: number;
  };
  /** TAX-03: couple-only fixed pension/RRIF income split between spouses. */
  incomeSplitting?: {
    enabled: boolean;
    splitPercent: number;
  };
  /**
   * Couple-only: how the engine routes spending obligations to accounts.
   *
   * - `'per-owner'` (default): each spouse funds their own spending from their
   *    own accounts. Owner-tagged overrides are authoritative.
   * - `'household'`: when both retired and one spouse's accounts cannot fully
   *    fund their spending share, the unfunded remainder is added to the other
   *    spouse's withdrawal gap and drawn from their accounts in tax-efficient
   *    order. Owner-tagged overrides still apply; their unfunded portion is
   *    pooled. Pension splitting unaffected.
   *
   * Absent → preserves additive-invariant (engine treats as 'per-owner').
   */
  householdSpendingMode?: 'per-owner' | 'household';
  /** TAX-04: when enabled, trim withdrawals to keep net income under incomeThreshold. */
  oasClawbackAvoidance?: {
    enabled: boolean;
    incomeThreshold: number;
  };
  /**
   * Bracket-fill withdrawal strategy config (BKF-01).
   * When enabled, withdraws from RRSP each retirement year to fill up to the
   * federal bracket ceiling, gated by MLT-03 OAS clawback net-benefit check.
   * Surplus over spending gap is swept to TFSA (up to room), remainder to non-reg.
   * @see .planning/phases/63-bracket-fill-engine-surplus-sweep/63-CONTEXT.md
   */
  bracketFill?: {
    enabled: boolean;
    bracketTarget?: 'current' | 'next';
    annualCap?: number;
  };
  /** SAV-01: per-account-type annual contribution override (translated from accountId UUIDs by applyScenarioDecisions). */
  contributionOverrides?: Array<{
    accountType: 'rrsp' | 'tfsa';
    annualAmount: number;
    startYear: number;
    endYear: number;
  }>;
  /** SPD-03: regular spending reduced by reductionPercent at each fromAge threshold. */
  ageBandReductions?: Array<{
    fromAge: number;
    reductionPercent: number;
  }>;
  /** SPD-04: target net worth at end of plan. ProjectionOutput.legacyTargetMet reports outcome. */
  legacyTarget?: number;

  // --- Phase 1 override fields (OVER-01, OVER-02, OVER-03, OVER-04) ---
  // @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-02, D-06, D-15
  /**
   * Per-year, per-account-type withdrawal overrides (OVER-01, OVER-03, OVER-04).
   * Amount is in real (today's) dollars (D-06); engine inflates to nominal.
   * Array capped at 200 records; must not contain duplicate (field, year) tuples (D-04).
   * Engine never mutates this array (D-12 — user intent preserved).
   */
  withdrawalOverrides?: ReadonlyArray<{
    field: 'rrsp' | 'rrif' | 'lif' | 'tfsa' | 'nonreg';
    year: number;
    amount: number;
    applyForward: boolean;
    /** Per-owner routing — defaults to primary when omitted. */
    owner?: 'primary' | 'spouse' | undefined;
  }>;
  /**
   * Per-year base-spending overrides (OVER-02).
   * Plan 04 populates these; Plan 03 threads the field through multi-year.ts.
   */
  spendingOverrides?: ReadonlyArray<{
    year: number;
    amount: number;
    applyForward: boolean;
    /** Per-owner routing — defaults to primary when omitted. */
    owner?: 'primary' | 'spouse' | undefined;
  }>;
  /**
   * Surplus destination account-type literal (D-15). No Zod default — when absent, engine
   * does not route surplus (additive invariant preserved, Assumption A1).
   * Plan 05 consumes this field for surplus routing (ENG-01).
   */
  surplusDestination?: 'rrsp' | 'rrif' | 'lif' | 'tfsa' | 'nonreg';

  /**
   * Optional override for the projection start year.
   * When set, the engine uses this value instead of `getCurrentYear()`.
   * Intended for deterministic testing (fixtures with a known start year) and for
   * scenarios where the caller explicitly controls the projection anchor year.
   * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-06 (inflation anchoring)
   */
  projectionStartYear?: number;
}

/**
 * Spouse Input - Complete spouse data for couple projections
 * @see docs/source-of-truth/01-user-profile.md - Spouse Requirements
 */
export interface SpouseInput {
  // Demographics
  birthdate: Date;
  province?: ProvinceCode; // Optional: defaults to primary's province
  retirementAge: number;
  lifeExpectancy: number;

  // Employment
  employmentIncome: number;
  employmentGrowthRate?: number; // defaults to 0 if omitted
  pensionIncome?: number;
  /** BUG-01 fix: suppress pension income in years before this age (couple spouse path) */
  pensionStartAge?: number;
  bridgeBenefit?: number;
  bridgeEndAge?: number;

  // Government Benefits
  expectedCPPAt65: number;
  cppStartAge?: number; // defaults to 65
  oasStartAge?: number; // defaults to 65
  yearsOfResidence?: number; // defaults to 40
  /**
   * Year the spouse first became a Canadian resident at or after age 18.
   * Drives TFSA residency slicing for immigrants (VR-TFSA-RESIDENCY-001, M005/S03).
   * When omitted, the ledger assumes full lifetime TFSA room from age 18 onward.
   */
  residencyStartYear?: number;

  // Registered Accounts
  rrspBalance: number;
  rrspAnnualContribution?: number;
  /**
   * CRA pension adjustment applied uniformly to every projection year for the spouse;
   * throttles RRSP room accrual via the contribution-room ledger (M005/S02). Defaults to 0.
   */
  pensionAdjustment?: number;
  /** Existing unused RRSP room carried into the spouse's first projection year. */
  rrspUnusedRoomSeed?: number;
  rrifBalance?: number;
  liraBalance?: number;
  lifBalance?: number;
  lifJurisdiction?: LIFJurisdiction;
  lifPriorYearReturnRate?: number;

  // Tax-Free
  tfsaBalance: number;
  tfsaAnnualContribution?: number;

  // FHSA
  /**
   * Spouse FHSA contribution per projection year; mirrors primary field.
   * @see docs/source-of-truth/02-account-types.md — FHSA Contribution Room
   */
  fhsaAnnualContribution?: number;
  /**
   * Spouse FHSA lifetime contributed seed; mirrors primary field.
   * @see docs/source-of-truth/02-account-types.md — FHSA Lifetime Cap
   */
  fhsaLifetimeContributedSeed?: number;

  // Non-Registered
  nonRegBalance?: number;
  nonRegACB?: number;
  nonRegAnnualContribution?: number;
  nonRegInterestIncome?: number;
  nonRegEligibleDividends?: number;
  nonRegNonEligibleDividends?: number;
  nonRegRealizedCapitalGains?: number;

  // Spousal RRSP attribution tracking
  /**
   * Per-year contribution history for spousal RRSP FIFO attribution.
   * Consumed by the attribution engine to determine which withdrawals
   * attribute back to the contributor under the 3-year rule.
   * @see docs/source-of-truth/02-account-types.md - RRSP Spousal Attribution
   */
  spousalRrspLedger?: SpousalRRSPLedger;
}

/**
 * Couple-specific projection settings
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Pension Income Splitting
 */
export interface CoupleSettings {
  /** Enable pension income splitting optimization (age 65+) */
  optimizePensionSplitting: boolean;
  /** Shared retirement spending (overrides individual if set) */
  sharedRetirementSpending?: number;
  /** Use younger spouse age for RRIF minimums where applicable */
  useYoungerSpouseForRRIF: boolean;
}

/**
 * Yearly Projection Result for a single person
 * @see docs/source-of-truth/08-projection-engine.md
 */
export interface PersonYearlyResult {
  owner: AccountOwner;
  year: number;
  age: number;

  // Income
  employmentIncome: number;
  pensionIncome: number;
  cppIncome: number;
  /** Gross OAS entitlement before recovery tax. Undefined on older cached rows. */
  oasGrossIncome?: number;
  /** Net OAS retained after recovery tax. Mirrors oasIncome when present. */
  oasNetIncome?: number;
  oasIncome: number;
  /** OAS recovery tax withheld/repaid for this projection year. */
  oasClawback?: number;
  gisIncome?: number;
  rrifWithdrawal: number;
  lifWithdrawal?: number;
  tfsaWithdrawal: number;
  nonRegWithdrawal: number;
  totalGrossIncome: number;

  // Pension splitting (after optimization)
  pensionIncomeReceived?: number; // Amount received from spouse
  pensionIncomeTransferred?: number; // Amount transferred to spouse

  /**
   * Income attributed back from Spousal RRSP withdrawal (contributor's tax return).
   * Non-zero when the annuitant spouse withdrew from a Spousal RRSP within 3 years
   * of the most recent contribution by this person.
   * @see docs/source-of-truth/02-account-types.md - RRSP Spousal Attribution
   */
  spousalRRSPAttributedIncome?: number;

  // Expenses
  livingExpenses: number;
  taxesPaid: number;
  netIncome: number;
  netCashFlow: number;

  // Account Balances (end of year)
  rrspBalance: number;
  rrifBalance: number;
  liraBalance?: number;
  lifBalance?: number;
  tfsaBalance: number;
  nonRegBalance: number;
  totalNetWorth: number;

  // Tax Details
  taxCalculation: TaxCalculation;

  /**
   * CRA RRSP contribution room available for this year — 18% of prior-year
   * earned income plus carry-forward, capped at the annual statutory maximum.
   * @see docs/source-of-truth/02-account-types.md — RRSP Contribution Room
   */
  rrspContributionRoom?: number;

  /**
   * TFSA contribution room available for this year. Undefined when the ledger is inactive.
   * @see docs/source-of-truth/02-account-types.md — TFSA Contribution Room (M005/S01)
   */
  tfsaContributionRoom?: number;

  /**
   * FHSA annual room remaining for this year (after contributions). Undefined when inactive.
   * @see docs/source-of-truth/02-account-types.md — FHSA Contribution Room (M005/S01)
   */
  fhsaContributionRoom?: number;

  /**
   * CRA over-contribution penalty for this year. Undefined when no penalty occurred.
   * @see docs/source-of-truth/02-account-types.md — Over-Contribution Penalty (M005/S01)
   */
  overContributionPenalty?: OverContributionPenalty;

  /**
   * Structured warnings emitted by the contribution-room ledger this year.
   * Undefined when the ledger is inactive or no warnings were raised.
   * @see docs/source-of-truth/02-account-types.md (M005/S01)
   */
  ledgerWarnings?: LedgerWarning[];

  // RRIF output fields (v1.8 — ROUT-01)
  /** CRA mandatory minimum withdrawal for this year. 0 before age 72 or when no RRIF exists. */
  rrifForcedMinimum: number;
  /** CRA minimum rate used (decimal, e.g. 0.0540 at age 72). 0 when no RRIF. */
  rrifMinimumRate: number;
  /** True only in the year RRSP converts to RRIF (age 71 with non-zero RRSP). */
  rrifConversionYear: boolean;

  /** Bracket-fill RRSP withdrawal for this year (BKF-06). Undefined if not applied. */
  bracketFillWithdrawal?: number;

  /**
   * Per-field override metadata. Populated only when the decision arrays contain
   * an active override for this year. Absent on years without active overrides.
   * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-22
   */
  overrides?: OverrideMetadata;
  /**
   * Per-field provenance metadata. Populated only for in-scope fields (D-38) with non-zero
   * values that year (D-41). Absence of a key = field is out of v4.2 scope.
   * @see .planning/phases/02-cell-provenance/02-CONTEXT.md - D-32, D-36
   */
  provenance?: ProvenanceMetadata;

  // Flags
  isRetired: boolean;
  isRRIFConversionYear: boolean;
  isLIFConversionYear?: boolean;
}

/**
 * Combined yearly result for a couple
 * @see docs/source-of-truth/08-projection-engine.md
 */
export interface CoupleYearlyResult {
  year: number;

  // Individual results
  primary: PersonYearlyResult;
  spouse: PersonYearlyResult;

  // Household aggregates
  householdGrossIncome: number;
  householdNetIncome: number;
  householdTaxesPaid: number;
  householdLivingExpenses: number;
  householdNetCashFlow: number;
  householdNetWorth: number;

  // Optimization metrics
  pensionSplitPercentage: number;
  pensionSplitTaxSavings: number;

  // Flags
  bothRetired: boolean;
  eitherRRIFConversion: boolean;
}

/**
 * Flat year-by-year projection row for UI consumption.
 *
 * A single unified type that handles both single-person and couple projections.
 * Spouse fields are `undefined` for single projections (D-01).
 * All optional fields use `?` syntax — not `| undefined` — for exactOptionalPropertyTypes compliance.
 *
 * Field ordering: identity → primary income → primary taxes → primary spending →
 * primary balances → spouse income → spouse taxes → spouse balances →
 * household aggregates → flags.
 *
 * Engine Gap Audit (ENG-02, D-07):
 * - selfEmploymentIncome: not a separate engine output — Phase 24+
 * - rentalIncome: not a separate engine output — Phase 24+
 * - cppContributions: not in TaxCalculation — Phase 24 (TAX-CA-02)
 * - eiPremiums: not in TaxCalculation — Phase 24 (TAX-CA-02)
 * - goalSpending: no goal spending in engine — Phase 25+
 * - debtPayments: no debt tracking in engine — future phase
 *
 * @see docs/source-of-truth/08-projection-engine.md
 * @see ENG-01
 */
export interface ProjectionYearRow {
  // Identity
  year: number;
  age: number;
  /** Undefined for single projections (D-01) */
  spouseAge?: number;

  // Primary income by source
  employmentIncome: number;
  /** Engine gap: not a separate engine output — Phase 24+ (D-05) */
  selfEmploymentIncome?: number;
  /** Engine gap: not a separate engine output — Phase 24+ (D-05) */
  rentalIncome?: number;
  pensionIncome: number;
  cppIncome: number;
  /** Gross OAS entitlement before recovery tax. Undefined on older cached rows. */
  oasGrossIncome?: number;
  /** Net OAS retained after recovery tax. Mirrors oasIncome when present. */
  oasNetIncome?: number;
  oasIncome: number;
  /** Available in engine (PersonYearlyResult.gisIncome); wired through (D-06) */
  gisIncome?: number;
  rrifWithdrawal: number;
  /** Optional: LIRA holders only */
  lifWithdrawal?: number;
  tfsaWithdrawal: number;
  nonRegWithdrawal: number;
  totalGrossIncome: number;

  // Primary taxes
  /** Maps from TaxCalculation.federalTaxNet */
  federalTax: number;
  /** Maps from TaxCalculation.provincialTaxNet */
  provincialTax: number;
  /** OAS recovery tax. `oasIncome` is already net of this amount. */
  oasClawback: number;
  /** Engine gap: not in TaxCalculation — Phase 24 (TAX-CA-02) (D-05) */
  cppContributions?: number;
  /** Engine gap: not in TaxCalculation — Phase 24 (TAX-CA-02) (D-05) */
  eiPremiums?: number;
  totalTax: number;
  /** Income tax plus OAS recovery tax, for cash-flow views that want the combined remittance. */
  totalTaxIncludingOASRecovery?: number;
  /** Maps from TaxCalculation.effectiveRate */
  effectiveTaxRate: number;

  // Primary spending
  livingExpenses: number;
  /** Engine gap: no goal spending in engine — Phase 25+ (D-05) */
  goalSpending?: number;
  /** Engine gap: no debt tracking in engine — future phase (D-05) */
  debtPayments?: number;
  netCashFlow: number;

  // Primary balances (end of year)
  rrspBalance: number;
  rrifBalance: number;
  /** Optional: LIRA holders only (D-08) */
  liraBalance?: number;
  /** Optional: LIF holders only (D-08) */
  lifBalance?: number;
  tfsaBalance: number;
  nonRegBalance: number;
  totalNetWorth: number;

  // Spouse income (D-02 — all optional, undefined for single projections)
  spouseEmploymentIncome?: number;
  spousePensionIncome?: number;
  spouseCppIncome?: number;
  /** Spouse gross OAS entitlement before recovery tax. Undefined on older cached rows. */
  spouseOasGrossIncome?: number;
  /** Spouse net OAS retained after recovery tax. Mirrors spouseOasIncome when present. */
  spouseOasNetIncome?: number;
  spouseOasIncome?: number;
  spouseGisIncome?: number;
  spouseRrifWithdrawal?: number;
  spouseLifWithdrawal?: number;
  spouseTfsaWithdrawal?: number;
  spouseNonRegWithdrawal?: number;

  // Spouse taxes (D-02 — all optional)
  spouseFederalTax?: number;
  spouseProvincialTax?: number;
  /** Spouse OAS recovery tax. `spouseOasIncome` is already net of this amount. */
  spouseOasClawback?: number;
  spouseTotalTax?: number;
  /** Spouse income tax plus OAS recovery tax. */
  spouseTotalTaxIncludingOASRecovery?: number;
  spouseEffectiveTaxRate?: number;

  // Spouse balances (end of year) (D-04 — all optional)
  spouseRrspBalance?: number;
  spouseRrifBalance?: number;
  spouseLiraBalance?: number;
  spouseLifBalance?: number;
  spouseTfsaBalance?: number;
  spouseNonRegBalance?: number;

  // Spouse spending — per-person split of livingExpenses + netCashFlow (sourced
  // from PersonYearlyResult). Engine has always emitted these; the row contract
  // now surfaces them so the year-by-year UI can show / edit them per person.
  spouseLivingExpenses?: number;
  spouseNetCashFlow?: number;

  // Spouse RRIF output fields (v1.8 — ROUT-02)
  spouseRrifForcedMinimum?: number;
  spouseRrifMinimumRate?: number;
  spouseRrifConversionYear?: boolean;

  // Pension splitting per-year surface (M005/P3 — couple-only)
  /** Primary: pension income received from spouse after splitting */
  pensionIncomeReceived?: number;
  /** Primary: pension income transferred to spouse after splitting */
  pensionIncomeTransferred?: number;
  /** Spouse: pension income received from primary after splitting */
  spousePensionIncomeReceived?: number;
  /** Spouse: pension income transferred to primary after splitting */
  spousePensionIncomeTransferred?: number;
  /** Couple-only: share transferred from higher earner to lower (0–0.5) */
  pensionSplitPercentage?: number;
  /** Couple-only: tax saved this year by splitting */
  pensionSplitTaxSavings?: number;

  // Contribution room per-year surface (M005/P4)
  /** Primary: RRSP contribution room available this year (CAD). @see docs/source-of-truth/02-account-types.md */
  rrspContributionRoom?: number;
  /** Spouse: RRSP contribution room available this year (CAD). */
  spouseRrspContributionRoom?: number;

  // Withdrawal strategy per-year surface (M005/P5)
  /** Primary: bracket-fill RRSP withdrawal this year when that strategy is active. @see BKF-06 */
  bracketFillWithdrawal?: number;
  /** Spouse: bracket-fill RRSP withdrawal this year. */
  spouseBracketFillWithdrawal?: number;

  // Over-contribution penalty per-year surface (M005/S06)
  /** Combined household over-contribution penalty this year. Undefined when no penalty occurred. */
  overContributionPenalty?: OverContributionPenalty;

  // Household aggregates (D-03 — required; mirrors primary for single projections)
  householdTotalIncome: number;
  householdTotalTax: number;
  householdNetCashFlow: number;
  householdNetWorth: number;

  // RRIF output fields (v1.8 — ROUT-01)
  rrifForcedMinimum: number;
  rrifMinimumRate: number;
  rrifConversionYear: boolean;

  // Flags
  isRetired: boolean;
  isRRIFConversionYear: boolean;

  /**
   * Per-year engine-emitted override metadata for the primary person (D-22).
   * Present only when at least one field has an active override for this year.
   * Populated from YearlyResult.overrides (single path) or
   * CoupleYearlyResult.primary.overrides (couple path).
   * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-22
   */
  overrides?: OverrideMetadata;
  /**
   * Per-year engine-emitted override metadata for the spouse — populated from
   * CoupleYearlyResult.spouse.overrides when spouse-owner overrides are active.
   * Mirrors `overrides` but keeps the two persons' override sidecars separate
   * so the UI can render override dots on the right cells.
   */
  spouseOverrides?: OverrideMetadata;
  /**
   * Per-field provenance metadata. Populated only for in-scope fields (D-38) with non-zero
   * values that year (D-41). Absence of a key = field is out of v4.2 scope.
   * @see .planning/phases/02-cell-provenance/02-CONTEXT.md - D-32, D-36
   */
  provenance?: ProvenanceMetadata;
}

/**
 * Legacy YearlyResult type - supports both single and couple projections
 * @deprecated Use PersonYearlyResult for single, CoupleYearlyResult for couples
 */
export interface YearlyResult {
  year: number;
  age: number;
  spouseAge?: number;

  // Income
  employmentIncome: number;
  pensionIncome: number;
  cppIncome: number;
  /** Gross OAS entitlement before recovery tax. Undefined on older cached rows. */
  oasGrossIncome?: number;
  /** Net OAS retained after recovery tax. Mirrors oasIncome when present. */
  oasNetIncome?: number;
  oasIncome: number;
  /** OAS recovery tax withheld/repaid for this projection year. */
  oasClawback?: number;
  gisIncome?: number;
  rrifWithdrawal: number;
  tfsaWithdrawal: number;
  nonRegWithdrawal: number;
  totalIncome: number;

  // Expenses
  livingExpenses: number;
  taxesPaid: number;
  netCashFlow: number;

  // Account Balances (end of year)
  rrspBalance: number;
  rrifBalance: number;
  tfsaBalance: number;
  nonRegBalance: number;
  totalNetWorth: number;

  // Tax Details
  taxCalculation: TaxCalculation;

  // RRIF output fields (v1.8 — ROUT-01)
  rrifForcedMinimum: number;
  rrifMinimumRate: number;
  rrifConversionYear: boolean;

  /** Bracket-fill RRSP withdrawal for this year (BKF-06). Undefined if not applied. */
  bracketFillWithdrawal?: number;

  /**
   * RRSP contribution room available this year (CAD). Surfaced from the
   * ContributionRoomLedger after M005/S02. Mirrors PersonYearlyResult.rrspContributionRoom.
   */
  rrspContributionRoom?: number;

  /**
   * TFSA cumulative contribution room available this year (CAD). Surfaced from the
   * ContributionRoomLedger. Mirrors PersonYearlyResult.tfsaContributionRoom.
   */
  tfsaContributionRoom?: number;

  /**
   * FHSA annual room remaining this year (CAD). Surfaced from the ContributionRoomLedger.
   * Mirrors PersonYearlyResult.fhsaContributionRoom.
   */
  fhsaContributionRoom?: number;

  /** CRA over-contribution penalty for this year. Undefined when no penalty occurred (M005/S02). */
  overContributionPenalty?: OverContributionPenalty;

  /** Structured warnings from the contribution-room ledger this year. Undefined when none (M005/S02). */
  ledgerWarnings?: LedgerWarning[];

  /**
   * Per-field override metadata. Populated only when the decision arrays contain
   * an active override for this year. Absent on years without active overrides.
   * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-22
   */
  overrides?: OverrideMetadata;
  /**
   * Per-field provenance metadata. Populated only for in-scope fields (D-38) with non-zero
   * values that year (D-41). Absence of a key = field is out of v4.2 scope.
   * @see .planning/phases/02-cell-provenance/02-CONTEXT.md - D-32, D-36
   */
  provenance?: ProvenanceMetadata;

  // Flags
  isRetired: boolean;
  isRRIFConversionYear: boolean;
}

/**
 * Type guard to check if a result is a couple result
 */
export function isCoupleResult(
  result: YearlyResult | PersonYearlyResult | CoupleYearlyResult
): result is CoupleYearlyResult {
  return 'primary' in result && 'spouse' in result;
}

/**
 * Type guard to check if a result is a person result
 */
export function isPersonResult(
  result: YearlyResult | PersonYearlyResult | CoupleYearlyResult
): result is PersonYearlyResult {
  return 'owner' in result && !('primary' in result);
}

/**
 * Complete Projection Output
 */
export interface ProjectionOutput {
  id: string;
  input: ProjectionInput;
  yearlyResults: YearlyResult[];
  // Phase 23: typed year-by-year rows (coexists with yearlyResults per D-09)
  projectionRows?: ProjectionYearRow[];
  /**
   * SPD-04: null when no legacyTarget set on input; true when final-year
   * totalNetWorth >= legacyTarget; false otherwise. Computed by runProjection
   * after the final year loop (per 25-CONTEXT.md D-03).
   */
  legacyTargetMet: boolean | null;
  summary: ProjectionSummary;
  /**
   * M004/S02: Terminal-return (deemed-disposition) tax events.
   * Zero-to-two elements: one per decedent at their terminal year.
   * @see docs/source-of-truth/04-tax-engine.md
   */
  terminalTaxEvents?: TerminalReturnResult[];
  /**
   * Override + surplus-routing warnings emitted during projection.
   * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-17
   * Omitted (not an empty array) when no warnings were emitted — preserves the
   * additive-invariant (Assumption A1, ROADMAP criterion #5).
   */
  warnings?: OverrideWarning[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Terminal Return (deemed-disposition) input — M004/S01.
 * @see docs/source-of-truth/04-tax-engine.md
 */
export interface TerminalReturnInput {
  year: number;
  owner: AccountOwner;
  province: ProvinceCode;
  age: number;
  ordinaryIncomeInDeathYear: number;
  pensionIncome: number;
  cppIncome: number;
  oasIncome: number;
  otherIncome: number;
  rrspBalance: number;
  rrifBalance: number;
  liraBalance: number;
  lifBalance: number;
  tfsaBalance: number;
  nonRegBalance: number;
  nonRegACB: number;
  hasSurvivingSpouse: boolean;
  inflationRate?: number;
  indexingBaseYear?: number;
}

/**
 * Terminal Return (deemed-disposition) result — M004/S01.
 */
export interface TerminalReturnResult {
  /** Calendar year of the decedent's death (M005/S02 — added for estate UI). */
  year: number;
  /** Which spouse the terminal event belongs to (M005/S02 — added for estate UI). */
  triggeringOwner: AccountOwner;
  grossEstate: number;
  deemedDispositionIncome: number;
  realizedCapitalGain: number;
  taxableCapitalGain: number;
  terminalTaxes: number;
  netEstate: number;
  wasSpouseRolloverApplied: boolean;
}

/**
 * Funded-state verdict for a completed projection.
 * @see .specify/specs/007-funded-indicator/spec.md — FR-002, FR-003, FR-004
 */
export type FundedState = 'green' | 'yellow' | 'red';

/**
 * Classification of a completed projection's funded state.
 * Derived exclusively from the already-computed yearlyResults array — no
 * additional runProjection() calls required (FR-001).
 * @see .specify/specs/007-funded-indicator/spec.md — FR-002, FR-003, FR-004, FR-005
 */
export interface FundedStatus {
  /** Categorical verdict: green / yellow / red */
  state: FundedState;
  /** Age of first full portfolio depletion; non-null only when state === 'red' */
  depletionAge: number | null;
  /** Portfolio net worth in the life-expectancy year; 0 for Red */
  balanceAtLifeExpectancy: number;
  /** Sum of gross account withdrawals across all retirement years; denominator of the 10% buffer ratio */
  totalRetirementWithdrawals: number;
}

/**
 * Remediation suggestions for a Red-state projection — three independent
 * minimum adjustments that each individually move the projection to at
 * least Yellow. Phase 48 ships with a zero-filled stub; Phase 49 replaces
 * the stub with a 20-iteration binary-search implementation per lever.
 * @see .specify/specs/007-funded-indicator/spec.md — FR-006, FR-007, FR-008
 */
export interface RemediationPlan {
  /** Minimum extra pre-retirement savings per year (CAD nominal) */
  additionalAnnualSavings: number;
  /** Minimum annual retirement spending reduction (CAD nominal) */
  annualSpendingReduction: number;
  /** Minimum additional years to delay retirement; capped at max(0, 70 − currentRetirementAge) */
  retirementDelayYears: number;
  /** True when retirementDelayYears hit the age-70 cap and result is still Red */
  delayCapReached: boolean;
}

/**
 * Projection Summary Metrics
 * @see docs/source-of-truth/09-success-metrics.md
 */
export interface ProjectionSummary {
  // Timeline
  startYear: number;
  endYear: number;
  retirementYear: number;
  yearsInRetirement: number;

  // Financial Metrics
  peakNetWorth: number;
  peakNetWorthYear: number;
  portfolioLongevityAge: number | null; // null = money lasts to life expectancy
  totalTaxesPaid: number;
  averageRetirementIncome: number;
  averageEffectiveTaxRate: number;

  // Risk Assessment
  moneyLastsToLifeExpectancy: boolean;
  lowestNetWorth: number;
  lowestNetWorthYear: number;

  /** Funded-state classification — Phase 48 (v1.11) */
  fundedStatus: FundedStatus;
  /** Remediation suggestions; non-null only when fundedStatus.state === 'red'. Phase 48 ships with zeroed stub for non-Red projections; Phase 49 fills the Red branch. */
  remediationPlan: RemediationPlan | null;

  /** Gross estate at terminal year (M004/S03). Populated when output.terminalTaxEvents is non-empty. Couple: reported at longestLivingSpouseEndYear; excludes rollover-event gross to avoid double-counting. @see docs/source-of-truth/09-success-metrics.md */
  grossEstate?: number;
  /** Terminal-return deemed-disposition tax (M004/S03). Sum of terminalTaxes across all terminal events. */
  terminalTaxes?: number;
  /** Net estate = grossEstate - terminalTaxes (M004/S03). */
  netEstate?: number;
}

/**
 * Couple-specific projection summary
 * @see docs/source-of-truth/09-success-metrics.md
 */
export interface CoupleProjectionSummary extends ProjectionSummary {
  // Per-spouse summaries
  primarySummary: ProjectionSummary;
  spouseSummary: ProjectionSummary;

  // Household metrics
  primaryRetirementYear: number;
  spouseRetirementYear: number;
  bothRetiredYear: number;

  // Optimization metrics
  totalPensionSplitTaxSavings: number;
  averagePensionSplitPercentage: number;

  // Survivor metrics (for future use)
  primaryLifeExpectancyYear: number;
  spouseLifeExpectancyYear: number;
  longestLivingSpouseEndYear: number;
}
