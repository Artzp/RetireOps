/**
 * buildLongReportData — pure adapter from engine output to LongReportData.
 *
 * Contract: pure function of its arguments. No time-of-call instantiation, no
 * non-deterministic randomness, no network or filesystem I/O, no env-variable
 * reads. `generatedAt` is REQUIRED in the input and passed through verbatim.
 * Calling twice with deep-equal arguments returns deep-equal output (RPT-03 +
 * CLAUDE.md engine-purity discipline).
 *
 * Single vs couple is a discriminated union (`kind: 'single' | 'couple'`) — RESEARCH
 * Pattern 1. Household totals on couple rows are read verbatim from engine output
 * (CoupleYearlyResult.householdNetWorth etc.) — never recomputed. See Pitfall 1.
 *
 * @see .planning/phases/18-report-data-foundation/18-CONTEXT.md - Adapter Input Contract
 * @see .planning/phases/18-report-data-foundation/18-RESEARCH.md - RPT-10 Field Wiring Table
 * @see .planning/REQUIREMENTS.md - RPT-03..RPT-11
 */

import type {
  ProjectionOutput,
  ProjectionInput,
  ProjectionYearRow,
  ProjectionSummary,
  CoupleProjectionSummary,
  CoupleYearlyResult,
  TerminalReturnResult,
  LedgerWarning,
  FundedStatus,
  YearlyResult,
} from '../types/projection.js';
import type { HouseholdProfile } from '../types/user.js';
import type {
  LongReportData,
  ReportProfileSection,
  ReportAssumptionsSection,
  ReportCashFlowSection,
  ReportAccountsSection,
  ReportEstateSection,
  ReportRiskSection,
  ReportGoalsSection,
  ReportRecommendationsSection,
  ReportOptionalModules,
  CoupleProjectionOutputLike,
} from './types.js';

/**
 * Build a LongReportData from a stored scenario result. Pure transformation of inputs.
 *
 * @param args.scenarioResult Discriminated union — `{ kind: 'single', result: ProjectionOutput }`
 *   or `{ kind: 'couple', result: CoupleProjectionOutputLike }`.
 * @param args.profile Household profile snapshot (RESEARCH Pattern 3 — HouseholdProfile).
 * @param args.scenarioName Display name for the scenario (RPT-06).
 * @param args.scenarioStatus Optional scenario status string (RPT-06).
 * @param args.generatedAt Report-generation timestamp. REQUIRED in the input and
 *   passed through verbatim. The adapter is pure: no time-of-call timestamp creation,
 *   no non-deterministic randomness, no I/O, no env-variable reads.
 * @param args.optional Optional analysis-modules bag (RPT-07). Omit entirely or set
 *   individual fields to undefined when absent — adapter does NOT throw on absence (RPT-11).
 */
export function buildLongReportData(args: {
  scenarioResult:
    | { kind: 'single'; result: ProjectionOutput }
    | { kind: 'couple'; result: CoupleProjectionOutputLike };
  profile: HouseholdProfile;
  scenarioName: string;
  scenarioStatus?: string;
  generatedAt: Date;
  optional?: ReportOptionalModules;
}): LongReportData {
  const { scenarioResult, profile, scenarioName, scenarioStatus, generatedAt, optional } = args;

  if (scenarioResult.kind === 'single') {
    return buildFromSingle(
      scenarioResult.result,
      profile,
      scenarioName,
      scenarioStatus,
      generatedAt,
      optional
    );
  }
  return buildFromCouple(
    scenarioResult.result,
    profile,
    scenarioName,
    scenarioStatus,
    generatedAt,
    optional
  );
}

// ---------------------------------------------------------------------------
// Branch helpers — assemble LongReportData for single vs couple inputs.
// ---------------------------------------------------------------------------

function buildFromSingle(
  result: ProjectionOutput,
  profile: HouseholdProfile,
  scenarioName: string,
  scenarioStatus: string | undefined,
  generatedAt: Date,
  optional: ReportOptionalModules | undefined
): LongReportData {
  const yearByYear: ProjectionYearRow[] = result.projectionRows ?? [];
  const ledgerWarnings = collectLedgerWarningsSingle(result.yearlyResults);

  const profileMetadata = buildProfileSection(profile);
  const assumptions = buildAssumptionsSection(result.input);
  const cashFlow = buildCashFlowSection(result.summary);
  const accounts = buildAccountsSection(yearByYear, ledgerWarnings);
  const estate = buildEstateSection(result.terminalTaxEvents, result.summary);
  const risk = buildRiskSection(result.summary);
  const goals = buildGoalsSection(result.input, result.legacyTargetMet);
  const recommendations = buildRecommendationsSection(result.summary, ledgerWarnings);

  return {
    scenarioName,
    ...(scenarioStatus !== undefined && { scenarioStatus }),
    generatedAt,
    profileMetadata,
    assumptions,
    summary: result.summary,
    yearByYear,
    ...(result.terminalTaxEvents !== undefined && { terminalTaxEvents: result.terminalTaxEvents }),
    goals,
    cashFlow,
    accounts,
    estate,
    risk,
    recommendations,
    ...(optional?.optimization !== undefined && { optimization: optional.optimization }),
    ...(optional?.monteCarlo !== undefined && { monteCarlo: optional.monteCarlo }),
    ...(optional?.stressTest !== undefined && { stressTest: optional.stressTest }),
    ...(optional?.backtest !== undefined && { backtest: optional.backtest }),
    ...(optional?.scenarioComparison !== undefined && {
      scenarioComparison: optional.scenarioComparison,
    }),
  };
}

function buildFromCouple(
  result: CoupleProjectionOutputLike,
  profile: HouseholdProfile,
  scenarioName: string,
  scenarioStatus: string | undefined,
  generatedAt: Date,
  optional: ReportOptionalModules | undefined
): LongReportData {
  const yearByYear: ProjectionYearRow[] = result.projectionRows ?? [];
  const ledgerWarnings = collectLedgerWarningsCouple(result.yearlyResults);

  const profileMetadata = buildProfileSection(profile);
  const assumptions = buildAssumptionsSection(result.input);
  const cashFlow = buildCashFlowSection(result.summary);
  const accounts = buildAccountsSection(yearByYear, ledgerWarnings);
  const estate = buildEstateSection(result.terminalTaxEvents, result.summary);
  const risk = buildRiskSection(result.summary);
  const goals = buildGoalsSection(result.input, result.legacyTargetMet);
  const recommendations = buildRecommendationsSection(result.summary, ledgerWarnings);

  return {
    scenarioName,
    ...(scenarioStatus !== undefined && { scenarioStatus }),
    generatedAt,
    profileMetadata,
    assumptions,
    summary: result.summary,
    yearByYear,
    ...(result.terminalTaxEvents !== undefined && { terminalTaxEvents: result.terminalTaxEvents }),
    goals,
    cashFlow,
    accounts,
    estate,
    risk,
    recommendations,
    ...(optional?.optimization !== undefined && { optimization: optional.optimization }),
    ...(optional?.monteCarlo !== undefined && { monteCarlo: optional.monteCarlo }),
    ...(optional?.stressTest !== undefined && { stressTest: optional.stressTest }),
    ...(optional?.backtest !== undefined && { backtest: optional.backtest }),
    ...(optional?.scenarioComparison !== undefined && {
      scenarioComparison: optional.scenarioComparison,
    }),
  };
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

/**
 * Build the ReportProfileSection from a HouseholdProfile snapshot.
 *
 * Sources:
 * - profile.primary.province | birthdate | maritalStatus | lifeExpectancy | plannedRetirementAge
 * - profile.spouse (passthrough — optional)
 */
function buildProfileSection(profile: HouseholdProfile): ReportProfileSection {
  const { primary, spouse } = profile;
  return {
    province: primary.province,
    birthdate: primary.birthdate,
    maritalStatus: primary.maritalStatus,
    lifeExpectancy: primary.lifeExpectancy,
    plannedRetirementAge: primary.plannedRetirementAge,
    ...(spouse !== undefined && { spouse }),
  };
}

/**
 * Build the ReportAssumptionsSection from ProjectionInput.
 *
 * Sources (all from result.input):
 * - inflationRate, investmentReturn (required engine inputs)
 * - province, retirementAge, lifeExpectancy (required engine inputs)
 * - cppStartAge, oasStartAge, expectedCPPAt65, yearsOfResidence (optional)
 * - projectionStartYear (optional; pinned in fixtures for determinism)
 * - taxYear: hardcoded 2026 for v4.6 (display-only; Phase 2 wires per-year)
 */
function buildAssumptionsSection(input: ProjectionInput): ReportAssumptionsSection {
  return {
    inflationRate: input.inflationRate,
    investmentReturn: input.investmentReturn,
    province: input.province,
    retirementAge: input.retirementAge,
    lifeExpectancy: input.lifeExpectancy,
    ...(input.cppStartAge !== undefined && { cppStartAge: input.cppStartAge }),
    ...(input.oasStartAge !== undefined && { oasStartAge: input.oasStartAge }),
    ...(input.expectedCPPAt65 !== undefined && { expectedCPPAt65: input.expectedCPPAt65 }),
    ...(input.yearsOfResidence !== undefined && { yearsOfResidence: input.yearsOfResidence }),
    ...(input.projectionStartYear !== undefined && {
      projectionStartYear: input.projectionStartYear,
    }),
    taxYear: 2026,
  };
}

/**
 * Build the ReportCashFlowSection — chart-friendly aggregates only.
 * yearByYear is at LongReportData top level (RPT-04); this section holds summary stats.
 *
 * Sources (from result.summary, all required ProjectionSummary fields):
 * - averageRetirementIncome
 * - totalTaxesPaid
 * - averageEffectiveTaxRate
 */
function buildCashFlowSection(
  summary: ProjectionSummary | CoupleProjectionSummary
): ReportCashFlowSection {
  return {
    summary: {
      averageRetirementIncome: summary.averageRetirementIncome,
      totalTaxesPaid: summary.totalTaxesPaid,
      averageEffectiveTaxRate: summary.averageEffectiveTaxRate,
    },
  };
}

/**
 * Build the ReportAccountsSection — ending balances at the final projection year
 * plus aggregated ledger warnings (when any).
 *
 * Sources:
 * - endingBalances: last entry of yearByYear[].
 *   Primary fields (rrspBalance, rrifBalance, tfsaBalance, nonRegBalance) are required on
 *   ProjectionYearRow. Optional primary fields (liraBalance, lifBalance) included only
 *   when defined. Spouse fields included only when defined (single projections leave them
 *   undefined per D-02/D-04).
 * - ledgerWarnings: caller-supplied aggregate from PersonYearlyResult.ledgerWarnings /
 *   YearlyResult.ledgerWarnings across all years.
 *
 * Returns `undefined`-rich shape (endingBalances/ledgerWarnings omitted) when source data
 * is missing.
 */
function buildAccountsSection(
  yearByYear: ProjectionYearRow[],
  ledgerWarnings: LedgerWarning[] | undefined
): ReportAccountsSection {
  const lastRow = yearByYear.length > 0 ? yearByYear[yearByYear.length - 1] : undefined;
  if (lastRow === undefined) {
    return ledgerWarnings !== undefined && ledgerWarnings.length > 0 ? { ledgerWarnings } : {};
  }
  const endingBalances: NonNullable<ReportAccountsSection['endingBalances']> = {
    rrspBalance: lastRow.rrspBalance,
    rrifBalance: lastRow.rrifBalance,
    tfsaBalance: lastRow.tfsaBalance,
    nonRegBalance: lastRow.nonRegBalance,
    ...(lastRow.liraBalance !== undefined && { liraBalance: lastRow.liraBalance }),
    ...(lastRow.lifBalance !== undefined && { lifBalance: lastRow.lifBalance }),
    ...(lastRow.spouseRrspBalance !== undefined && {
      spouseRrspBalance: lastRow.spouseRrspBalance,
    }),
    ...(lastRow.spouseRrifBalance !== undefined && {
      spouseRrifBalance: lastRow.spouseRrifBalance,
    }),
    ...(lastRow.spouseTfsaBalance !== undefined && {
      spouseTfsaBalance: lastRow.spouseTfsaBalance,
    }),
    ...(lastRow.spouseNonRegBalance !== undefined && {
      spouseNonRegBalance: lastRow.spouseNonRegBalance,
    }),
    ...(lastRow.spouseLiraBalance !== undefined && {
      spouseLiraBalance: lastRow.spouseLiraBalance,
    }),
    ...(lastRow.spouseLifBalance !== undefined && { spouseLifBalance: lastRow.spouseLifBalance }),
  };
  return {
    endingBalances,
    ...(ledgerWarnings !== undefined && ledgerWarnings.length > 0 && { ledgerWarnings }),
  };
}

/**
 * Build the ReportEstateSection — terminal-tax-event passthrough + summary estate fields.
 *
 * Sources:
 * - terminalTaxEvents: result.terminalTaxEvents (optional TerminalReturnResult[])
 * - grossEstate / terminalTaxes / netEstate: result.summary.grossEstate / terminalTaxes /
 *   netEstate (all optional on ProjectionSummary)
 */
function buildEstateSection(
  terminalTaxEvents: TerminalReturnResult[] | undefined,
  summary: ProjectionSummary | CoupleProjectionSummary
): ReportEstateSection {
  return {
    ...(terminalTaxEvents !== undefined && { terminalTaxEvents }),
    ...(summary.grossEstate !== undefined && { grossEstate: summary.grossEstate }),
    ...(summary.terminalTaxes !== undefined && { terminalTaxes: summary.terminalTaxes }),
    ...(summary.netEstate !== undefined && { netEstate: summary.netEstate }),
  };
}

/**
 * Build the ReportRiskSection — fundedStatus + remediationPlan only.
 * Optional analysis modules (MonteCarlo / StressTest / Backtest / Optimization /
 * ScenarioComparison) live at LongReportData top level, NOT under risk.
 *
 * Sources:
 * - fundedStatus: result.summary.fundedStatus (always present — required on ProjectionSummary)
 * - remediationPlan: result.summary.remediationPlan (nullable; non-null only when state === 'red')
 */
function buildRiskSection(summary: ProjectionSummary | CoupleProjectionSummary): ReportRiskSection {
  const fundedStatus: FundedStatus = summary.fundedStatus;
  return {
    fundedStatus,
    remediationPlan: summary.remediationPlan,
  };
}

/**
 * Build the ReportGoalsSection — v4.6 stub: populates legacy-target fields only.
 *
 * Sources:
 * - retirementSpending: result.input.retirementSpending
 * - legacyTarget: result.input.legacyTarget (optional)
 * - legacyTargetMet: result.legacyTargetMet (boolean | null on ProjectionOutput)
 *
 * @see docs/report-functionality-phases.md - Phase 5 (full goals engine)
 */
function buildGoalsSection(
  input: ProjectionInput,
  legacyTargetMet: boolean | null
): ReportGoalsSection {
  return {
    retirementSpending: input.retirementSpending,
    ...(input.legacyTarget !== undefined && { legacyTarget: input.legacyTarget }),
    legacyTargetMet,
  };
}

/**
 * Build the ReportRecommendationsSection — v4.6 stub: surfaces RemediationPlan
 * and aggregated LedgerWarnings as proto-recommendations.
 *
 * Sources:
 * - remediationPlan: result.summary.remediationPlan
 * - ledgerWarnings: aggregated from PersonYearlyResult.ledgerWarnings /
 *   YearlyResult.ledgerWarnings across years
 *
 * @see docs/report-functionality-phases.md - Phase 7 (full recommendations engine)
 */
function buildRecommendationsSection(
  summary: ProjectionSummary | CoupleProjectionSummary,
  ledgerWarnings: LedgerWarning[] | undefined
): ReportRecommendationsSection {
  return {
    remediationPlan: summary.remediationPlan,
    ...(ledgerWarnings !== undefined && ledgerWarnings.length > 0 && { ledgerWarnings }),
  };
}

// ---------------------------------------------------------------------------
// Ledger-warning collectors — aggregate across all projection years.
// Return undefined (not empty array) when no year emitted a warning, per the
// additive-invariant convention used elsewhere in the engine output surface.
// ---------------------------------------------------------------------------

/**
 * Aggregate LedgerWarnings across all single-projection years. Reads from the
 * legacy YearlyResult.ledgerWarnings field (projection.ts:956).
 */
function collectLedgerWarningsSingle(yearlyResults: YearlyResult[]): LedgerWarning[] | undefined {
  const all: LedgerWarning[] = [];
  for (const yr of yearlyResults) {
    if (yr.ledgerWarnings !== undefined && yr.ledgerWarnings.length > 0) {
      all.push(...yr.ledgerWarnings);
    }
  }
  return all.length > 0 ? all : undefined;
}

/**
 * Aggregate LedgerWarnings across all couple-projection years. Walks BOTH
 * `primary.ledgerWarnings` and `spouse.ledgerWarnings` per year so the section
 * surfaces household-level warnings without re-deriving per-person aggregates.
 */
function collectLedgerWarningsCouple(
  yearlyResults: CoupleYearlyResult[]
): LedgerWarning[] | undefined {
  const all: LedgerWarning[] = [];
  for (const yr of yearlyResults) {
    if (yr.primary.ledgerWarnings !== undefined && yr.primary.ledgerWarnings.length > 0) {
      all.push(...yr.primary.ledgerWarnings);
    }
    if (yr.spouse.ledgerWarnings !== undefined && yr.spouse.ledgerWarnings.length > 0) {
      all.push(...yr.spouse.ledgerWarnings);
    }
  }
  return all.length > 0 ? all : undefined;
}
