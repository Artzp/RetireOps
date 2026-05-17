/**
 * Long-Form Report DTOs — v4.6 Phase 18
 *
 * Shape contract for the long-form retirement planning report. Consumed by the pure
 * adapter `buildLongReportData` (./build-long-report-data.ts) and any future report
 * renderer (React, PDF, JSON export).
 *
 * CoupleProjectionOutputLike, StressTestResultLike, and ScenarioComparisonLike are
 * structural duplicates of types that live in @retireops/calculation-engine
 * (CoupleProjectionOutput, StressTestResult) or in @retireops/web (ScenarioComparison).
 * This duplication is intentional per Architecture Principle IV — @retireops/shared
 * MUST NOT import from @retireops/calculation-engine or @retireops/web. Mirrors the
 * precedent in ./monte-carlo.ts (PercentileBandResultContract / WorstCaseTrialContract).
 *
 * @see .planning/phases/18-report-data-foundation/18-CONTEXT.md - Locked decisions
 * @see .planning/phases/18-report-data-foundation/18-RESEARCH.md - Section DTO Field Wiring + Pattern 2
 * @see docs/report-functionality-phases.md - Phase 1 (this milestone)
 */

import type {
  ProjectionOutput,
  ProjectionYearRow,
  ProjectionSummary,
  CoupleProjectionSummary,
  CoupleYearlyResult,
  PersonYearlyResult,
  TerminalReturnResult,
  RemediationPlan,
  LedgerWarning,
  FundedStatus,
} from '../types/projection.js';
import type { SpouseProfile, MaritalStatus } from '../types/user.js';
import type { ProvinceCode } from '../types/province.js';
import type { OptimizationResult } from '../types/insights.js';
import type { MonteCarloJobResult } from '../types/monte-carlo.js';
import type { BacktestResult } from '../types/historical-backtest.js';

// ---------------------------------------------------------------------------
// Structural mirror interfaces (Architecture Principle IV)
// ---------------------------------------------------------------------------

/**
 * Structural mirror of CoupleProjectionOutput defined in
 * @retireops/calculation-engine/src/projection/multi-year.ts:57.
 *
 * Must stay byte-compatible with the engine type. When the engine type changes,
 * update this mirror in lockstep. See file header for the Architecture Principle IV
 * rationale.
 */
export interface CoupleProjectionOutputLike extends Omit<
  ProjectionOutput,
  'yearlyResults' | 'summary'
> {
  yearlyResults: CoupleYearlyResult[];
  summary: CoupleProjectionSummary;
  personYearlyResults?: {
    primary: PersonYearlyResult[];
    spouse: PersonYearlyResult[];
  };
}

/**
 * Structural mirror of StressTestResult defined in
 * @retireops/calculation-engine/src/investments/monte-carlo.ts:312.
 *
 * Architecture Principle IV: see file header.
 */
export interface StressTestResultLike {
  scenario: 'market_crash_at_retirement' | 'lost_decade' | 'high_inflation' | '2008_replay';
  description: string;
  finalBalance: number;
  depletionYear: number | null;
  yearlyData: Array<{
    year: number;
    returnRate: number;
    balance: number;
  }>;
}

/**
 * Structural mirror of ScenarioComparison defined in
 * @retireops/web/src/types/scenario.ts:24. The web-only home is migrating to
 * shared in v4.7+; until then this mirror is the canonical contract for the
 * adapter's optional slot.
 *
 * Architecture Principle IV: see file header.
 */
export interface ScenarioComparisonLike {
  baseProjection: { id: string; name: string; resultData: unknown };
  scenarios: Array<{
    id: string;
    name: string;
    modifications: Record<string, unknown>;
    resultData: unknown;
  }>;
  comparison: {
    metrics: Array<{
      name: string;
      label: string;
      base: number | null;
      scenarios: Array<{
        id: string;
        value: number | null;
        delta: number | null;
        percentChange: number | null;
      }>;
      bestId: string | null;
      higherIsBetter: boolean;
    }>;
    yearlyComparison: Array<{
      year: number;
      age: number;
      base: { netWorth: number; income: number; taxes: number };
      scenarios: Array<{
        id: string;
        netWorth: number;
        income: number;
        taxes: number;
      }>;
    }>;
  };
}

// ---------------------------------------------------------------------------
// Section DTOs
// ---------------------------------------------------------------------------

/**
 * Profile section — derived from the HouseholdProfile argument.
 * Snapshots demographic + retirement-timing inputs at report-generation time.
 */
export interface ReportProfileSection {
  province: ProvinceCode;
  birthdate: Date;
  maritalStatus: MaritalStatus;
  lifeExpectancy: number;
  plannedRetirementAge: number;
  spouse?: SpouseProfile;
}

/**
 * Assumptions section — derived from ProjectionInput on the scenario result.
 */
export interface ReportAssumptionsSection {
  inflationRate: number;
  investmentReturn: number;
  province: ProvinceCode;
  retirementAge: number;
  lifeExpectancy: number;
  cppStartAge?: number;
  oasStartAge?: number;
  expectedCPPAt65?: number;
  yearsOfResidence?: number;
  projectionStartYear?: number;
  /**
   * Display-only tax-year anchor. v4.6 hardcodes 2026; future phases will wire per-year.
   * @see docs/report-functionality-phases.md - Phase 2
   */
  taxYear?: number;
}

/**
 * Cash-flow section — top-level yearByYear is the primary RPT-04 surface; this section
 * holds chart-friendly summary aggregates so Phase 2 (cash-flow report) can populate them
 * without changing the contract.
 */
export interface ReportCashFlowSection {
  /** Subset of ProjectionSummary fields relevant to cash flow. Passthrough; not recomputed. */
  summary?: {
    averageRetirementIncome: number;
    totalTaxesPaid: number;
    averageEffectiveTaxRate: number;
  };
}

/**
 * Accounts section — ending balances at the final projection year (RPT-04 round-trip)
 * plus optional ledger surfaces. Contribution-room timeline is a Phase 3 / v4.7+ stub.
 */
export interface ReportAccountsSection {
  endingBalances?: {
    rrspBalance: number;
    rrifBalance: number;
    tfsaBalance: number;
    nonRegBalance: number;
    liraBalance?: number;
    lifBalance?: number;
    /** Couple-only — undefined on single projections. */
    spouseRrspBalance?: number;
    spouseRrifBalance?: number;
    spouseTfsaBalance?: number;
    spouseNonRegBalance?: number;
    spouseLiraBalance?: number;
    spouseLifBalance?: number;
  };
  /**
   * Contribution-room timeline — v4.7+ (Phase 3 of report doc). Stub field locked now so
   * later phases don't break consumers.
   */
  contributionRoomTimeline?: never;
  /** Aggregated across yearlyResults — populated only when at least one row has warnings. */
  ledgerWarnings?: LedgerWarning[];
}

/**
 * Estate section — passthrough of summary estate fields and the terminal-event array.
 */
export interface ReportEstateSection {
  terminalTaxEvents?: TerminalReturnResult[];
  grossEstate?: number;
  terminalTaxes?: number;
  netEstate?: number;
}

/**
 * Risk section — fundedStatus + remediation only. Optional analysis modules
 * (MonteCarlo / StressTest / Backtest / Optimization / ScenarioComparison) live at the
 * top level of LongReportData per RESEARCH "Section DTO Field Wiring" recommendation,
 * not nested here.
 */
export interface ReportRiskSection {
  fundedStatus: FundedStatus;
  remediationPlan?: RemediationPlan | null;
}

/**
 * Goals section — type-only stub for v4.6. Adapter populates the three legacy-target
 * fields from existing engine output; the full fundedGoals array is v4.7+ (Phase 5).
 *
 * TODO(Phase 5): replace `fundedGoals?: never` with the real goal-funding array contract.
 * @see docs/report-functionality-phases.md - Phase 5
 */
export interface ReportGoalsSection {
  retirementSpending?: number;
  legacyTarget?: number;
  legacyTargetMet?: boolean | null;
  /** Intentionally never-typed until Phase 5. Prevents accidental writes through the stub. */
  fundedGoals?: never;
}

/**
 * Recommendations section — type-only stub for v4.6. Adapter populates remediationPlan
 * and aggregated ledgerWarnings from existing engine output; the full recommendations
 * contract is v4.7+ (Phase 7).
 *
 * TODO(Phase 7): replace `recommendations?: never` with the ReportRecommendation contract.
 * @see docs/report-functionality-phases.md - Phase 7
 */
export interface ReportRecommendationsSection {
  remediationPlan?: RemediationPlan | null;
  ledgerWarnings?: LedgerWarning[];
  /** Intentionally never-typed until Phase 7. */
  recommendations?: never;
}

// ---------------------------------------------------------------------------
// Optional modules helper
// ---------------------------------------------------------------------------

/**
 * Optional analysis modules that may accompany a report. Adapter passes these
 * through verbatim — never modifies, never validates.
 */
export interface ReportOptionalModules {
  optimization?: OptimizationResult;
  monteCarlo?: MonteCarloJobResult;
  stressTest?: StressTestResultLike;
  backtest?: BacktestResult;
  scenarioComparison?: ScenarioComparisonLike;
}

// ---------------------------------------------------------------------------
// Top-level LongReportData
// ---------------------------------------------------------------------------

/**
 * Long-form retirement report data — the v4.6 RPT-01 contract.
 *
 * Top-level required fields satisfy RPT-06. Top-level yearByYear satisfies RPT-04.
 * Section fields satisfy RPT-01. Optional analysis-module slots satisfy RPT-07.
 *
 * Adapter (./build-long-report-data.ts) is the canonical producer. Adapter is pure —
 * `generatedAt` is supplied by the caller, never derived from system clock.
 *
 * @see .planning/REQUIREMENTS.md - RPT-01..RPT-11
 */
export interface LongReportData {
  // --- RPT-06 required top-level identity + timestamps ---
  scenarioName: string;
  scenarioStatus?: string;
  generatedAt: Date;

  // --- RPT-06 required core sections ---
  profileMetadata: ReportProfileSection;
  assumptions: ReportAssumptionsSection;
  /** Passthrough of result.summary — single OR couple summary. Consumers narrow with `'primarySummary' in summary`. */
  summary: ProjectionSummary | CoupleProjectionSummary;

  // --- RPT-04 + RPT-05 full year-by-year (top-level for ergonomic access) ---
  yearByYear: ProjectionYearRow[];

  // --- RPT-06 estate at top level (also accessible via estate section) ---
  terminalTaxEvents?: TerminalReturnResult[];

  // --- RPT-01 sections (cashFlow / accounts / estate / risk are optional;
  //     profileMetadata, assumptions, summary, yearByYear are required) ---
  goals?: ReportGoalsSection;
  cashFlow?: ReportCashFlowSection;
  accounts?: ReportAccountsSection;
  estate?: ReportEstateSection;
  risk?: ReportRiskSection;
  recommendations?: ReportRecommendationsSection;

  // --- RPT-07 optional analysis modules (top-level per RESEARCH recommendation) ---
  optimization?: OptimizationResult;
  monteCarlo?: MonteCarloJobResult;
  stressTest?: StressTestResultLike;
  backtest?: BacktestResult;
  scenarioComparison?: ScenarioComparisonLike;
}
