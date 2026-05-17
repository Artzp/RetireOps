/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-condition */
/**
 * Projection Data Transformers
 * Transforms between frontend input format and calculation engine format
 */
import type {
  ProjectionInput,
  ProjectionOutput,
  YearlyResult,
  ProjectionSummary,
  CoupleYearlyResult,
  CoupleProjectionSummary,
  ProjectionYearRow,
  PersonYearlyResult,
  FundedStatus,
  RemediationPlan,
  TerminalReturnResult,
  LedgerWarning,
  OverContributionPenalty,
  ProvenanceMetadata,
  ProvinceCode,
} from '@retireops/shared';
import {
  resolveActiveWithdrawalOverride,
  resolveActiveSpendingOverride,
} from '@retireops/shared/overrides';
import type { CoupleProjectionOutput } from '@retireops/calculation-engine';
import type { ScenarioDecisions } from '@retireops/shared';

// ---------------------------------------------------------------------------
// Phase 2 — D-32. Override-metadata composition helpers.
// WR-03 RESOLVED in Phase 6: now imports from @retireops/shared/overrides.
// resolveActiveWithdrawalOverride / resolveActiveSpendingOverride are the
// canonical shared implementations; the transformer no longer duplicates them.
// @see .planning/phases/02-cell-provenance/02-CONTEXT.md - D-32, D-40, D-44, D-46, D-47
// ---------------------------------------------------------------------------

/**
 * Compose overrideMeta {createdAt, updatedAt, originalEngineValue} from scenario decisions
 * onto each provenance cell whose source === 'override'.
 * D-44: UI reads row.provenance.{field}.overrideMeta to render "Overridden YYYY-MM-DD — was $X".
 * D-49: Engine never touches overrideMeta; it is written only by the API service layer (Plan 05).
 * @see .planning/phases/02-cell-provenance/02-CONTEXT.md - D-44, D-46, D-47, D-49
 */
function composeOverrideMeta(
  provenance: ProvenanceMetadata,
  year: number,
  decisions: ScenarioDecisions | undefined
): ProvenanceMetadata {
  const result: ProvenanceMetadata = { ...provenance };

  // Withdrawal fields: rrsp → rrspWithdrawal, rrif → rrifWithdrawal, etc.
  // D-40: source === 'override' signals the cell was user-overridden.
  const withdrawalFieldMap: Array<
    ['rrsp' | 'rrif' | 'tfsa' | 'nonreg' | 'lif', keyof ProvenanceMetadata]
  > = [
    ['rrsp', 'rrspWithdrawal'],
    ['rrif', 'rrifWithdrawal'],
    ['tfsa', 'tfsaWithdrawal'],
    ['nonreg', 'nonRegWithdrawal'],
    ['lif', 'lifWithdrawal'],
  ];

  for (const [field, key] of withdrawalFieldMap) {
    const prov = result[key];
    if (prov?.source === 'override') {
      const rec = resolveActiveWithdrawalOverride(field, year, decisions?.withdrawalOverrides) as
        | {
            createdAt?: string | undefined;
            updatedAt?: string | undefined;
            originalEngineValue?: number | undefined;
          }
        | undefined;
      if (rec?.createdAt && rec.updatedAt && typeof rec.originalEngineValue === 'number') {
        result[key] = {
          ...prov,
          overrideMeta: {
            createdAt: rec.createdAt,
            updatedAt: rec.updatedAt,
            originalEngineValue: rec.originalEngineValue,
          },
        };
      }
    }
  }

  // Spending override — livingExpenses
  const spendingProv = result.livingExpenses;
  if (spendingProv?.source === 'override') {
    const rec = resolveActiveSpendingOverride(year, decisions?.spendingOverrides) as
      | {
          createdAt?: string | undefined;
          updatedAt?: string | undefined;
          originalEngineValue?: number | undefined;
        }
      | undefined;
    if (rec?.createdAt && rec.updatedAt && typeof rec.originalEngineValue === 'number') {
      result.livingExpenses = {
        ...spendingProv,
        overrideMeta: {
          createdAt: rec.createdAt,
          updatedAt: rec.updatedAt,
          originalEngineValue: rec.originalEngineValue,
        },
      };
    }
  }

  return result;
}

/**
 * Merge per-person provenance from the couple path into a single household-level entry.
 * T-COUPLE-01: primary spouse's entry wins on key clashes (D-32 couple aggregation rule).
 * Tax provenance is naturally household-level and typically only on primary.
 * @see .planning/phases/02-cell-provenance/02-CONTEXT.md - D-32
 */
function mergeProvenance(
  primary: ProvenanceMetadata | undefined,
  spouse: ProvenanceMetadata | undefined
): ProvenanceMetadata | undefined {
  if (!primary && !spouse) return undefined;
  // primary wins on key clashes (spread order: spouse first, primary last)
  return { ...spouse, ...primary };
}

/**
 * Frontend input data structure (from wizard)
 */
export interface FrontendInputData {
  personalInfo: {
    dateOfBirth: string | Date;
    province: string;
    gender?: 'male' | 'female' | 'other';
    maritalStatus?: 'single' | 'married' | 'commonLaw' | 'divorced' | 'widowed';
    retirementAge: number;
    lifeExpectancy: number;
    // M005/S05: contribution-room ledger inputs (primary)
    pensionAdjustment?: number;
    spousalRrspContribution?: number;
    fhsaAnnualContribution?: number;
    fhsaLifetimeContributedSeed?: number;
    residencyStartYear?: number;
  };
  spouse?: {
    dateOfBirth?: string | Date;
    province?: string;
    retirementAge?: number;
    lifeExpectancy?: number;
    employmentIncome?: number;
    incomeEndAge?: number;
    expectedCppAt65?: number;
    cppStartAge?: number;
    oasStartAge?: number;
    yearsOfResidence?: number;
    rrspBalance?: number;
    rrspAnnualContribution?: number;
    tfsaBalance?: number;
    tfsaAnnualContribution?: number;
    nonRegBalance?: number;
    nonRegACB?: number;
    nonRegInterestIncome?: number;
    nonRegEligibleDividends?: number;
    nonRegNonEligibleDividends?: number;
    nonRegRealizedCapitalGains?: number;
    // M005/S05: contribution-room ledger inputs (spouse)
    pensionAdjustment?: number;
    fhsaAnnualContribution?: number;
    fhsaLifetimeContributedSeed?: number;
    residencyStartYear?: number;
  };
  coupleSettings?: {
    optimizePensionSplitting?: boolean;
    sharedRetirementSpending?: number;
    useYoungerSpouseForRRIF?: boolean;
  };
  accounts: Array<{
    type: 'RRSP' | 'TFSA' | 'RRIF' | 'NonRegistered' | 'FHSA' | 'LIRA' | 'LIF';
    name?: string;
    balance: number;
    annualContribution?: number;
    investmentReturnRate?: number;
    jurisdiction?: string;
    belongsTo?: 'primary' | 'spouse';
    contributorOwner?: 'primary' | 'spouse';
    contributionRoom?: number;
    adjustedCostBase?: number;
    annualInterestIncome?: number;
    annualEligibleDividends?: number;
    annualNonEligibleDividends?: number;
    annualRealizedCapitalGains?: number;
  }>;
  incomeSources: Array<{
    type: 'employment' | 'selfEmployment' | 'pension' | 'rental' | 'investment' | 'other';
    name?: string;
    annualAmount: number;
    startAge?: number;
    endAge?: number;
    isIndexed?: boolean;
    indexationRate?: number;
  }>;
  governmentBenefits: {
    cppStartAge: number;
    oasStartAge: number;
    estimatedCppAmount?: number;
    yearsContributedToCpp?: number;
    yearsOfResidence?: number;
  };
  expenses: {
    currentAnnualExpenses: number;
    retirementAnnualExpenses: number;
    debtPaymentsAnnual?: number;
    debtPaymentYears?: number;
    oneTimeExpenses?: Array<{
      description: string;
      amount: number;
      year: number;
    }>;
  };
  assumptions?: {
    inflationRate?: number;
    investmentReturnRate?: number;
  };
}

/**
 * Frontend result data structure (for display)
 */
export interface FrontendResultData {
  summary: FrontendSummary;
  yearlyResults: FrontendYearlyResult[];
  /** Phase 23: typed year-by-year rows for UI consumption (ENG-03) */
  projectionRows: ProjectionYearRow[];
  /**
   * Assumptions surfaced for the UI Summary "Assumptions Used" panel.
   * Sourced from `calcInput`; engine math unchanged.
   * `inflationRate` is also consumed by the inflation-toggle deflation pass (Feature 3.4).
   */
  assumptions?: {
    inflationRate?: number;
    investmentReturn?: number;
    province?: ProvinceCode;
    retirementAge?: number;
    lifeExpectancy?: number;
    cppStartAge?: number;
    oasStartAge?: number;
    yearsOfResidence?: number;
    expectedCPPAt65?: number;
    taxYear?: number;
    federalTaxTableYear?: number;
  };
  /** M005 Phase 2: per-decedent terminal-return events surfaced to the Estate tab. */
  terminalTaxEvents?: TerminalReturnResult[];
}

export interface FrontendSummary {
  peakNetWorth: number;
  portfolioLongevity: number;
  totalTaxesPaid: number;
  averageRetirementIncome: number;
  probabilityOfSuccess: number;
  startYear: number;
  endYear: number;
  retirementYear: number;
  yearsInRetirement: number;
  peakNetWorthYear: number;
  lowestNetWorth: number;
  portfolioLongevityAge: number | null;
  moneyLastsToLifeExpectancy: boolean;
  averageEffectiveTaxRate: number;
  /** Funded-state classification — Phase 48 (v1.11) */
  fundedStatus: FundedStatus;
  /** Remediation suggestions; non-null only when fundedStatus.state === 'red'. Phase 49 fills the Red branch. */
  remediationPlan: RemediationPlan | null;
  /** M004/M005: terminal-return estate metrics — present when a decedent reached terminal year. */
  grossEstate?: number;
  terminalTaxes?: number;
  netEstate?: number;
  /**
   * M005/S05: aggregate contribution-room ledger warnings flattened across all years
   * and both persons in a couple projection. Preserves year/person/accountType on each entry.
   * Undefined when no warnings were raised.
   */
  ledgerWarnings?: LedgerWarning[];
}

export interface FrontendYearlyResult {
  year: number;
  age: number;
  employmentIncome: number;
  pensionIncome: number;
  cppIncome: number;
  oasIncome: number;
  withdrawals: number;
  totalIncome: number;
  federalTax: number;
  provincialTax: number;
  totalTax: number;
  netIncome: number;
  rrspBalance: number;
  tfsaBalance: number;
  nonRegBalance: number;
  totalNetWorth: number;
  isRRIFConversionYear: boolean;
  /**
   * M005/S05: household TFSA contribution room (primary + spouse) — couple path only.
   * Always-set on couple projections since the engine always populates per-person room.
   */
  tfsaContributionRoom?: number;
  /**
   * M005/S05: household FHSA annual room remaining (primary + spouse) — couple path only.
   */
  fhsaContributionRoom?: number;
  /**
   * M005/S05: combined CRA over-contribution penalty (primary + spouse components summed).
   * Undefined when no penalty occurred.
   */
  overContributionPenalty?: OverContributionPenalty;
  /**
   * M005/S05: concatenated ledger warnings across primary and spouse for this year.
   * Undefined when neither person raised a warning.
   */
  ledgerWarnings?: LedgerWarning[];
}

/**
 * Transform frontend wizard input to calculation engine input
 */
export function transformToProjectionInput(frontendInput: FrontendInputData): ProjectionInput {
  // Account ownership matters on couple projections: spouse-owned cards must
  // not be collapsed into the primary person's balances/contributions.
  const primaryAccounts = frontendInput.accounts.filter((a) => a.belongsTo !== 'spouse');
  const spouseAccounts = frontendInput.accounts.filter((a) => a.belongsTo === 'spouse');
  const primaryRrspRoomSeed = primaryAccounts
    .filter((a) => a.type === 'RRSP' && a.contributionRoom !== undefined)
    .reduce((max, a) => Math.max(max, a.contributionRoom ?? 0), 0);
  const spouseRrspRoomSeed = spouseAccounts
    .filter(
      (a) =>
        a.type === 'RRSP' && a.contributionRoom !== undefined && a.contributorOwner !== 'primary'
    )
    .reduce((max, a) => Math.max(max, a.contributionRoom ?? 0), 0);
  const inferredPrimarySpousalRrspRoomSeed = spouseAccounts
    .filter(
      (a) =>
        a.type === 'RRSP' && a.contributionRoom !== undefined && a.contributorOwner === 'primary'
    )
    .reduce((max, a) => Math.max(max, a.contributionRoom ?? 0), 0);

  const rrspBalance = primaryAccounts
    .filter((a) => a.type === 'RRSP')
    .reduce((sum, a) => sum + a.balance, 0);
  const rrspAnnualContribution = primaryAccounts
    .filter((a) => a.type === 'RRSP')
    .reduce((sum, a) => sum + (a.annualContribution ?? 0), 0);
  const tfsaBalance = primaryAccounts
    .filter((a) => a.type === 'TFSA')
    .reduce((sum, a) => sum + a.balance, 0);
  const tfsaAnnualContribution = primaryAccounts
    .filter((a) => a.type === 'TFSA')
    .reduce((sum, a) => sum + (a.annualContribution ?? 0), 0);
  const fhsaAnnualContribution = primaryAccounts
    .filter((a) => a.type === 'FHSA')
    .reduce((sum, a) => sum + (a.annualContribution ?? 0), 0);
  const nonRegBalance = primaryAccounts
    .filter((a) => a.type === 'NonRegistered')
    .reduce((sum, a) => sum + a.balance, 0);
  const hasPrimaryNonRegACB = primaryAccounts.some(
    (a) => a.type === 'NonRegistered' && a.adjustedCostBase !== undefined
  );
  const nonRegACB = primaryAccounts
    .filter((a) => a.type === 'NonRegistered' && a.adjustedCostBase !== undefined)
    .reduce((sum, a) => sum + (a.adjustedCostBase ?? 0), 0);
  const nonRegInterestIncome = primaryAccounts
    .filter((a) => a.type === 'NonRegistered')
    .reduce((sum, a) => sum + (a.annualInterestIncome ?? 0), 0);
  const nonRegEligibleDividends = primaryAccounts
    .filter((a) => a.type === 'NonRegistered')
    .reduce((sum, a) => sum + (a.annualEligibleDividends ?? 0), 0);
  const nonRegNonEligibleDividends = primaryAccounts
    .filter((a) => a.type === 'NonRegistered')
    .reduce((sum, a) => sum + (a.annualNonEligibleDividends ?? 0), 0);
  const nonRegRealizedCapitalGains = primaryAccounts
    .filter((a) => a.type === 'NonRegistered')
    .reduce((sum, a) => sum + (a.annualRealizedCapitalGains ?? 0), 0);

  // Find employment income
  const employmentSource = frontendInput.incomeSources.find(
    (s) => s.type === 'employment' || s.type === 'selfEmployment'
  );
  const employmentIncome = employmentSource?.annualAmount ?? 0;

  // Find pension income sources (BUG-01 fix: was previously silently dropped)
  // @see docs/source-of-truth/03-income-sources.md - Pension Income
  const pensionSources = frontendInput.incomeSources.filter((s) => s.type === 'pension');
  const pensionIncomeTotal = pensionSources.reduce((sum, s) => sum + s.annualAmount, 0);
  const pensionStartAge =
    pensionSources.length > 0 ? Math.min(...pensionSources.map((s) => s.startAge ?? 0)) : undefined;

  // Parse birthdate
  const birthdate =
    typeof frontendInput.personalInfo.dateOfBirth === 'string'
      ? new Date(frontendInput.personalInfo.dateOfBirth)
      : frontendInput.personalInfo.dateOfBirth;

  // Get investment return rate (use account-level if provided, otherwise assumption, otherwise default)
  const accountReturnRates = frontendInput.accounts
    .filter((a) => a.investmentReturnRate !== undefined)
    .map((a) => a.investmentReturnRate!);
  const avgAccountReturn =
    accountReturnRates.length > 0
      ? accountReturnRates.reduce((sum, r) => sum + r, 0) / accountReturnRates.length / 100
      : undefined;
  const investmentReturn =
    avgAccountReturn ??
    (frontendInput.assumptions?.investmentReturnRate !== undefined
      ? frontendInput.assumptions.investmentReturnRate / 100
      : 0.05);

  const inflationRate =
    frontendInput.assumptions?.inflationRate !== undefined
      ? frontendInput.assumptions.inflationRate / 100
      : 0.025;

  const maritalStatus =
    frontendInput.personalInfo.maritalStatus === 'commonLaw'
      ? 'common_law'
      : frontendInput.personalInfo.maritalStatus;
  const debtPaymentsAnnual = frontendInput.expenses.debtPaymentsAnnual ?? 0;

  const result: ProjectionInput = {
    // Profile
    birthdate,
    province: frontendInput.personalInfo.province as ProjectionInput['province'],
    retirementAge: frontendInput.personalInfo.retirementAge,
    lifeExpectancy: frontendInput.personalInfo.lifeExpectancy,

    // Income
    employmentIncome,
    employmentGrowthRate: 0.02, // Default 2% growth
    ...(pensionIncomeTotal > 0 ? { pensionIncome: pensionIncomeTotal } : {}),

    // Accounts
    rrspBalance,
    rrspAnnualContribution,
    tfsaBalance,
    tfsaAnnualContribution,
    nonRegBalance,

    // Retirement
    retirementSpending: frontendInput.expenses.retirementAnnualExpenses,

    // Assumptions
    investmentReturn,
    inflationRate,
  };
  if (debtPaymentsAnnual > 0) {
    result.debtPaymentsAnnual = debtPaymentsAnnual;
    if (frontendInput.expenses.debtPaymentYears !== undefined) {
      result.debtPaymentYears = frontendInput.expenses.debtPaymentYears;
    }
  }

  if (hasPrimaryNonRegACB) {
    result.nonRegACB = nonRegACB;
  }
  if (nonRegInterestIncome > 0) {
    result.nonRegInterestIncome = nonRegInterestIncome;
  }
  if (nonRegEligibleDividends > 0) {
    result.nonRegEligibleDividends = nonRegEligibleDividends;
  }
  if (nonRegNonEligibleDividends > 0) {
    result.nonRegNonEligibleDividends = nonRegNonEligibleDividends;
  }
  if (nonRegRealizedCapitalGains > 0) {
    result.nonRegRealizedCapitalGains = nonRegRealizedCapitalGains;
  }

  // Add optional government benefits fields only if they have values.
  // Use !== undefined (not falsy) so an explicit user-entered CPP of 0 is honoured (D-07).
  // When the assembler omits estimatedCppAmount (mode is 'defaulted'/legacy/undefined),
  // the field is absent here, so the engine default ($12,000/year) still applies.
  if (frontendInput.governmentBenefits.estimatedCppAmount !== undefined) {
    result.expectedCPPAt65 = frontendInput.governmentBenefits.estimatedCppAmount;
  }
  if (frontendInput.governmentBenefits.cppStartAge !== undefined) {
    result.cppStartAge = frontendInput.governmentBenefits.cppStartAge;
  }
  if (frontendInput.governmentBenefits.oasStartAge !== undefined) {
    result.oasStartAge = frontendInput.governmentBenefits.oasStartAge;
  }
  if (frontendInput.governmentBenefits.yearsOfResidence !== undefined) {
    result.yearsOfResidence = frontendInput.governmentBenefits.yearsOfResidence;
  }
  if (pensionStartAge !== undefined) {
    result.pensionStartAge = pensionStartAge;
  }
  if (maritalStatus !== undefined && maritalStatus !== 'divorced' && maritalStatus !== 'widowed') {
    result.maritalStatus = maritalStatus;
  }

  // M005/S05: contribution-room ledger inputs forwarded to engine (primary).
  // exactOptionalPropertyTypes (K020): conditional assignment, never spread undefined.
  const pInfo = frontendInput.personalInfo;
  if (pInfo.pensionAdjustment !== undefined) {
    result.pensionAdjustment = pInfo.pensionAdjustment;
  }
  if (primaryRrspRoomSeed > 0 || inferredPrimarySpousalRrspRoomSeed > 0) {
    result.rrspUnusedRoomSeed = Math.max(primaryRrspRoomSeed, inferredPrimarySpousalRrspRoomSeed);
  }
  if (pInfo.spousalRrspContribution !== undefined) {
    result.spousalRrspContribution = pInfo.spousalRrspContribution;
  }
  const inferredSpousalRrspContribution = spouseAccounts
    .filter((a) => a.type === 'RRSP' && a.contributorOwner === 'primary')
    .reduce((sum, a) => sum + (a.annualContribution ?? 0), 0);
  if (inferredSpousalRrspContribution > 0) {
    result.spousalRrspContribution =
      (result.spousalRrspContribution ?? 0) + inferredSpousalRrspContribution;
    // Engine treats rrspAnnualContribution as the COMBINED personal+spousal total
    // and derives the spousal portion via min(spousalRrspContribution, rrspAnnualContribution).
    // Without this, the spousal cap silently truncates against the personal-only sum.
    // @see packages/calculation-engine/src/projection/multi-year.ts:1011-1019
    result.rrspAnnualContribution =
      (result.rrspAnnualContribution ?? 0) + inferredSpousalRrspContribution;
  }
  if (pInfo.fhsaAnnualContribution !== undefined) {
    result.fhsaAnnualContribution = pInfo.fhsaAnnualContribution;
  } else if (fhsaAnnualContribution > 0) {
    result.fhsaAnnualContribution = fhsaAnnualContribution;
  }
  if (pInfo.fhsaLifetimeContributedSeed !== undefined) {
    result.fhsaLifetimeContributedSeed = pInfo.fhsaLifetimeContributedSeed;
  }
  if (pInfo.residencyStartYear !== undefined) {
    result.residencyStartYear = pInfo.residencyStartYear;
  }

  // Forward bracketFill strategy config from ScenarioAppliedInput → ProjectionInput (BKF-01).
  // applyScenarioDecisions stores bracketFill on the ScenarioAppliedInput shape (which extends
  // FrontendInputData); without this forward the engine never receives the user's configuration.
  // @see docs/source-of-truth/07-withdrawal-strategies.md — Bracket-Fill (TAX-05 / BKF-01)
  const applied = frontendInput as FrontendInputData & {
    bracketFill?: ProjectionInput['bracketFill'];
    withdrawalOverrides?: ProjectionInput['withdrawalOverrides'];
    spendingOverrides?: ProjectionInput['spendingOverrides'];
    surplusDestination?: ProjectionInput['surplusDestination'];
    householdSpendingMode?: ProjectionInput['householdSpendingMode'];
    strategyId?: ProjectionInput['strategyId'];
    // --- Phase 26: ENG-01..03 strategy fields forwarded to close the IN-01/IN-02 gap ---
    drawdownOrder?: ProjectionInput['drawdownOrder'];
    rrspMeltdown?: ProjectionInput['rrspMeltdown'];
    oasClawbackAvoidance?: ProjectionInput['oasClawbackAvoidance'];
    // --- Phase 26: ENG-04 audit-promoted fields (all engine-consumed; were silently dropped) ---
    incomeSplitting?: ProjectionInput['incomeSplitting'];
    contributionOverrides?: ProjectionInput['contributionOverrides'];
    ageBandReductions?: ProjectionInput['ageBandReductions'];
    legacyTarget?: ProjectionInput['legacyTarget'];
  };
  if (applied.bracketFill !== undefined) {
    result.bracketFill = applied.bracketFill;
  }

  // Forward Phase 1 override fields from ScenarioAppliedInput → ProjectionInput.
  // applyScenarioDecisions stores these on the extended shape (which extends
  // FrontendInputData); without forwarding, the engine never sees them and
  // the entire override pipeline is silently dropped at the API layer.
  // @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-01, D-02, D-15
  if (applied.withdrawalOverrides !== undefined) {
    result.withdrawalOverrides = applied.withdrawalOverrides;
  }
  if (applied.spendingOverrides !== undefined) {
    result.spendingOverrides = applied.spendingOverrides;
  }
  if (applied.surplusDestination !== undefined) {
    result.surplusDestination = applied.surplusDestination;
  }
  if (applied.householdSpendingMode !== undefined) {
    result.householdSpendingMode = applied.householdSpendingMode;
  }

  // Forward strategyId from ScenarioAppliedInput → ProjectionInput.
  // applyScenarioDecisions writes `result.strategyId = decisions.strategyId` at
  // scenario-decisions.ts:116, but without this forward the field is silently
  // dropped at the API layer and the engine never sees the user's strategy
  // selection (the engine consumes `ProjectionInput.strategyId` per the
  // `cd6e133 feat(engine): add strategyId selector` change). This was the
  // root cause of Gap G-01 (COUPLE-03 TFSA-first snapshot identical to baseline).
  // @see .planning/phases/07-characterization-tests/07-VERIFICATION.md G-01
  // @see docs/source-of-truth/07-withdrawal-strategies.md
  if (applied.strategyId !== undefined) {
    result.strategyId = applied.strategyId;
  }

  // Phase 26 — ENG-01: drawdownOrder forwarded from ScenarioAppliedInput → ProjectionInput.
  // applyScenarioDecisions writes `result.drawdownOrder = [...decisions.drawdownOrder]` at
  // scenario-decisions.ts:135-137, but without this forward the engine never sees the
  // user's account-priority order. Engine consumer: resolveDrawdownOrder() at
  // packages/calculation-engine/src/projection/orchestration/calculate-person-year.ts:422.
  // @see .planning/phases/26-engine-field-forwarding/26-CONTEXT.md (Pitfall 1)
  // @see docs/source-of-truth/07-withdrawal-strategies.md
  if (applied.drawdownOrder !== undefined) {
    result.drawdownOrder = applied.drawdownOrder;
  }

  // Phase 26 — ENG-02: rrspMeltdown forwarded from ScenarioAppliedInput → ProjectionInput.
  // applyScenarioDecisions writes `result.rrspMeltdown = {...}` at scenario-decisions.ts:143-150.
  // Engine consumer: applyMeltdown() at calculate-person-year.ts:381.
  // @see docs/source-of-truth/07-withdrawal-strategies.md (RRSP meltdown — Smooth-RRSP-before-71 preset)
  if (applied.rrspMeltdown !== undefined) {
    result.rrspMeltdown = applied.rrspMeltdown;
  }

  // Phase 26 — ENG-03: oasClawbackAvoidance forwarded from ScenarioAppliedInput → ProjectionInput.
  // applyScenarioDecisions writes `result.oasClawbackAvoidance = {...}` at scenario-decisions.ts:159-164.
  // Engine consumer: applyOASClawbackTrim() at calculate-person-year.ts:523.
  // @see docs/source-of-truth/18-pensions-2026.md (OAS clawback thresholds — Protect-OAS preset)
  if (applied.oasClawbackAvoidance !== undefined) {
    result.oasClawbackAvoidance = applied.oasClawbackAvoidance;
  }

  // Phase 26 — ENG-04 audit promotion: incomeSplitting forwarded.
  // applyScenarioDecisions writes at scenario-decisions.ts:152-157.
  // Engine consumer: multi-year.ts:531; couple-calculator.ts:46,76,136.
  if (applied.incomeSplitting !== undefined) {
    result.incomeSplitting = applied.incomeSplitting;
  }

  // Phase 26 — ENG-04 audit promotion: contributionOverrides forwarded.
  // applyScenarioDecisions writes at scenario-decisions.ts:179-203 (with accountId→accountType translation).
  // Engine consumer: year-input-builder.ts:144,277,402.
  if (applied.contributionOverrides !== undefined) {
    result.contributionOverrides = applied.contributionOverrides;
  }

  // Phase 26 — ENG-04 audit promotion: ageBandReductions forwarded.
  // applyScenarioDecisions writes at scenario-decisions.ts:234-239.
  // Engine consumer: spending.ts:69-127 (applyAgeBandReduction); year-input-builder.ts:145,278,403.
  if (applied.ageBandReductions !== undefined) {
    result.ageBandReductions = applied.ageBandReductions;
  }

  // Phase 26 — ENG-04 audit promotion: legacyTarget forwarded.
  // applyScenarioDecisions writes at scenario-decisions.ts:242-244.
  // Engine consumer: multi-year.ts:243 (single), :715 (couple) — sets legacyTargetMet boolean.
  // NOTE: Use `!== undefined` (not truthiness) so `legacyTarget: 0` is forwarded explicitly.
  if (applied.legacyTarget !== undefined) {
    result.legacyTarget = applied.legacyTarget;
  }

  if (frontendInput.spouse?.dateOfBirth) {
    const spouseBirthdate =
      typeof frontendInput.spouse.dateOfBirth === 'string'
        ? new Date(frontendInput.spouse.dateOfBirth)
        : frontendInput.spouse.dateOfBirth;

    result.spouse = {
      birthdate: spouseBirthdate,
      retirementAge: frontendInput.spouse.retirementAge ?? frontendInput.personalInfo.retirementAge,
      lifeExpectancy:
        frontendInput.spouse.lifeExpectancy ?? frontendInput.personalInfo.lifeExpectancy,
      employmentIncome: frontendInput.spouse.employmentIncome ?? 0,
      employmentGrowthRate: 0.02,
      expectedCPPAt65: frontendInput.spouse.expectedCppAt65 ?? 0,
      cppStartAge: frontendInput.spouse.cppStartAge ?? 65,
      oasStartAge: frontendInput.spouse.oasStartAge ?? 65,
      yearsOfResidence: frontendInput.spouse.yearsOfResidence ?? 40,
      rrspBalance:
        frontendInput.spouse.rrspBalance ??
        spouseAccounts.filter((a) => a.type === 'RRSP').reduce((sum, a) => sum + a.balance, 0),
      rrspAnnualContribution:
        frontendInput.spouse.rrspAnnualContribution ??
        spouseAccounts
          .filter((a) => a.type === 'RRSP' && a.contributorOwner !== 'primary')
          .reduce((sum, a) => sum + (a.annualContribution ?? 0), 0),
      tfsaBalance:
        frontendInput.spouse.tfsaBalance ??
        spouseAccounts.filter((a) => a.type === 'TFSA').reduce((sum, a) => sum + a.balance, 0),
      tfsaAnnualContribution:
        frontendInput.spouse.tfsaAnnualContribution ??
        spouseAccounts
          .filter((a) => a.type === 'TFSA')
          .reduce((sum, a) => sum + (a.annualContribution ?? 0), 0),
      nonRegBalance:
        frontendInput.spouse.nonRegBalance ??
        spouseAccounts
          .filter((a) => a.type === 'NonRegistered')
          .reduce((sum, a) => sum + a.balance, 0),
      ...(frontendInput.spouse.province
        ? { province: frontendInput.spouse.province as ProjectionInput['province'] }
        : {}),
    };

    const spouseNonRegAccounts = spouseAccounts.filter((a) => a.type === 'NonRegistered');
    const spouseFhsaAnnualContribution = spouseAccounts
      .filter((a) => a.type === 'FHSA')
      .reduce((sum, a) => sum + (a.annualContribution ?? 0), 0);
    const hasSpouseNonRegACB = spouseNonRegAccounts.some((a) => a.adjustedCostBase !== undefined);
    const spouseNonRegACB = spouseNonRegAccounts
      .filter((a) => a.adjustedCostBase !== undefined)
      .reduce((sum, a) => sum + (a.adjustedCostBase ?? 0), 0);
    const spouseNonRegInterestIncome = spouseNonRegAccounts.reduce(
      (sum, a) => sum + (a.annualInterestIncome ?? 0),
      0
    );
    const spouseNonRegEligibleDividends = spouseNonRegAccounts.reduce(
      (sum, a) => sum + (a.annualEligibleDividends ?? 0),
      0
    );
    const spouseNonRegNonEligibleDividends = spouseNonRegAccounts.reduce(
      (sum, a) => sum + (a.annualNonEligibleDividends ?? 0),
      0
    );
    const spouseNonRegRealizedCapitalGains = spouseNonRegAccounts.reduce(
      (sum, a) => sum + (a.annualRealizedCapitalGains ?? 0),
      0
    );
    if (hasSpouseNonRegACB) {
      result.spouse.nonRegACB = spouseNonRegACB;
    }
    if (spouseNonRegInterestIncome > 0) {
      result.spouse.nonRegInterestIncome = spouseNonRegInterestIncome;
    }
    if (spouseNonRegEligibleDividends > 0) {
      result.spouse.nonRegEligibleDividends = spouseNonRegEligibleDividends;
    }
    if (spouseNonRegNonEligibleDividends > 0) {
      result.spouse.nonRegNonEligibleDividends = spouseNonRegNonEligibleDividends;
    }
    if (spouseNonRegRealizedCapitalGains > 0) {
      result.spouse.nonRegRealizedCapitalGains = spouseNonRegRealizedCapitalGains;
    }

    // M005/S05: contribution-room ledger inputs forwarded to engine (spouse).
    // exactOptionalPropertyTypes (K020): conditional assignment, never spread undefined.
    const sp = frontendInput.spouse;
    if (sp.pensionAdjustment !== undefined) {
      result.spouse.pensionAdjustment = sp.pensionAdjustment;
    }
    if (spouseRrspRoomSeed > 0) {
      result.spouse.rrspUnusedRoomSeed = spouseRrspRoomSeed;
    }
    if (sp.fhsaAnnualContribution !== undefined) {
      result.spouse.fhsaAnnualContribution = sp.fhsaAnnualContribution;
    } else if (spouseFhsaAnnualContribution > 0) {
      result.spouse.fhsaAnnualContribution = spouseFhsaAnnualContribution;
    }
    if (sp.fhsaLifetimeContributedSeed !== undefined) {
      result.spouse.fhsaLifetimeContributedSeed = sp.fhsaLifetimeContributedSeed;
    }
    if (sp.residencyStartYear !== undefined) {
      result.spouse.residencyStartYear = sp.residencyStartYear;
    }
    if (sp.nonRegACB !== undefined) {
      result.spouse.nonRegACB = sp.nonRegACB;
    }
    if (sp.nonRegInterestIncome !== undefined) {
      result.spouse.nonRegInterestIncome = sp.nonRegInterestIncome;
    }
    if (sp.nonRegEligibleDividends !== undefined) {
      result.spouse.nonRegEligibleDividends = sp.nonRegEligibleDividends;
    }
    if (sp.nonRegNonEligibleDividends !== undefined) {
      result.spouse.nonRegNonEligibleDividends = sp.nonRegNonEligibleDividends;
    }
    if (sp.nonRegRealizedCapitalGains !== undefined) {
      result.spouse.nonRegRealizedCapitalGains = sp.nonRegRealizedCapitalGains;
    }

    result.coupleSettings = {
      optimizePensionSplitting: frontendInput.coupleSettings?.optimizePensionSplitting ?? true,
      ...(frontendInput.coupleSettings?.sharedRetirementSpending !== undefined
        ? { sharedRetirementSpending: frontendInput.coupleSettings.sharedRetirementSpending }
        : {}),
      useYoungerSpouseForRRIF: frontendInput.coupleSettings?.useYoungerSpouseForRRIF ?? true,
    };
  }

  return result;
}

/**
 * Type guard to check if output is a couple projection
 */
function isCoupleProjectionOutput(
  output: ProjectionOutput | CoupleProjectionOutput
): output is CoupleProjectionOutput {
  const firstResult = output.yearlyResults[0];
  return firstResult !== undefined && 'primary' in firstResult && 'spouse' in firstResult;
}

/**
 * Transform calculation engine output to frontend display format
 * Handles both single and couple projections
 *
 * @param decisions — optional scenario decisions; when present, used to compose
 *   overrideMeta (timestamps + originalEngineValue) onto provenance cells whose
 *   source === 'override'. D-32, D-44, D-46, D-47.
 */
export function transformToFrontendOutput(
  output: ProjectionOutput | CoupleProjectionOutput,
  lifeExpectancy: number,
  decisions?: ScenarioDecisions
): FrontendResultData {
  const projectionRows = transformToProjectionYearRows(output, decisions);
  const terminalTaxEvents = output.terminalTaxEvents;

  if (isCoupleProjectionOutput(output)) {
    const yearlyResults = output.yearlyResults.map((year) => transformCoupleYearlyResult(year));
    // M005/S05: flatten ledger warnings across every year + both persons.
    // Preserves year/person/accountType on each entry per the engine contract.
    const aggregateWarnings: LedgerWarning[] = output.yearlyResults.flatMap((y) => [
      ...(y.primary.ledgerWarnings ?? []),
      ...(y.spouse.ledgerWarnings ?? []),
    ]);
    const summary = transformCoupleSummary(output.summary, lifeExpectancy);
    if (aggregateWarnings.length > 0) {
      summary.ledgerWarnings = aggregateWarnings;
    }
    return {
      summary,
      yearlyResults,
      projectionRows,
      ...(terminalTaxEvents ? { terminalTaxEvents } : {}),
    };
  }

  const yearlyResults = output.yearlyResults.map((year) => transformYearlyResult(year));
  const summary = transformSummary(output.summary, lifeExpectancy);
  // Mirror the couple path: flatten per-year ledger warnings into the summary
  // so SummaryTab's Projection Warnings card surfaces over-contribution alerts
  // for single projections too (closes the v4.4 deferral gap).
  const aggregateWarnings: LedgerWarning[] = output.yearlyResults.flatMap(
    (y) => y.ledgerWarnings ?? []
  );
  if (aggregateWarnings.length > 0) {
    summary.ledgerWarnings = aggregateWarnings;
  }
  return {
    summary,
    yearlyResults,
    projectionRows,
    ...(terminalTaxEvents ? { terminalTaxEvents } : {}),
  };
}

/**
 * Transform engine output to typed ProjectionYearRow array.
 * Handles both single (ProjectionOutput) and couple (CoupleProjectionOutput) projections.
 *
 * @param decisions — optional scenario decisions; forwarded to row mappers so overrideMeta
 *   can be stitched onto provenance cells (D-32, D-44, D-46, D-47).
 * @see docs/source-of-truth/08-projection-engine.md
 * @see ENG-03
 */
export function transformToProjectionYearRows(
  output: ProjectionOutput | CoupleProjectionOutput,
  decisions?: ScenarioDecisions
): ProjectionYearRow[] {
  const debtPaymentsAnnual = output.input.debtPaymentsAnnual ?? 0;
  const debtPaymentYears = output.input.debtPaymentYears;
  const startYear = output.summary.startYear;

  if (isCoupleProjectionOutput(output)) {
    return output.yearlyResults.map((year) =>
      mapCoupleYearToRow(
        year,
        decisions,
        debtPaymentForYear(debtPaymentsAnnual, debtPaymentYears, year.year, startYear)
      )
    );
  }
  return output.yearlyResults.map((year) =>
    mapSingleYearToRow(
      year,
      decisions,
      debtPaymentForYear(debtPaymentsAnnual, debtPaymentYears, year.year, startYear)
    )
  );
}

function debtPaymentForYear(
  annualDebtPayments: number,
  debtPaymentYears: number | undefined,
  year: number,
  startYear: number
): number | undefined {
  if (annualDebtPayments <= 0) return undefined;
  const yearsFromStart = Math.max(0, year - startYear);
  if (debtPaymentYears !== undefined && yearsFromStart >= debtPaymentYears) return undefined;
  return annualDebtPayments;
}

/**
 * Map a single-person YearlyResult to ProjectionYearRow.
 * YearlyResult.totalIncome is normalized to totalGrossIncome for schema compatibility.
 * Household fields mirror primary for single projections.
 *
 * @param decisions — optional; used to compose overrideMeta onto provenance cells (D-32, D-44).
 */
function mapSingleYearToRow(
  year: YearlyResult,
  decisions?: ScenarioDecisions,
  debtPayments?: number
): ProjectionYearRow {
  // YearlyResult uses totalIncome; PersonYearlyResult uses totalGrossIncome
  const totalGrossIncome =
    'totalGrossIncome' in year
      ? (year as unknown as PersonYearlyResult).totalGrossIncome
      : year.totalIncome;
  const oasClawback = year.oasClawback ?? year.taxCalculation.oasClawback;
  const oasGrossIncome = year.oasGrossIncome ?? year.oasIncome + oasClawback;
  const oasNetIncome = year.oasNetIncome ?? year.oasIncome;
  const netCashFlow = year.netCashFlow - (debtPayments ?? 0);

  const row: ProjectionYearRow = {
    // Identity
    year: year.year,
    age: year.age,
    // Primary income
    employmentIncome: year.employmentIncome,
    pensionIncome: year.pensionIncome,
    cppIncome: year.cppIncome,
    oasGrossIncome,
    oasNetIncome,
    oasIncome: year.oasIncome,
    rrifWithdrawal: year.rrifWithdrawal,
    tfsaWithdrawal: year.tfsaWithdrawal,
    nonRegWithdrawal: year.nonRegWithdrawal,
    totalGrossIncome,
    // Primary taxes (TaxCalculation field names: federalTaxNet NOT federalTax)
    federalTax: year.taxCalculation.federalTaxNet,
    provincialTax: year.taxCalculation.provincialTaxNet,
    oasClawback,
    totalTax: year.taxesPaid,
    totalTaxIncludingOASRecovery: year.taxesPaid + oasClawback,
    effectiveTaxRate: year.taxCalculation.effectiveRate,
    // Primary spending
    livingExpenses: year.livingExpenses,
    ...(debtPayments !== undefined ? { debtPayments } : {}),
    netCashFlow,
    // Primary balances (end of year)
    rrspBalance: year.rrspBalance,
    rrifBalance: year.rrifBalance,
    tfsaBalance: year.tfsaBalance,
    nonRegBalance: year.nonRegBalance,
    totalNetWorth: year.totalNetWorth,
    // Household aggregates mirror primary for single projections (D-03)
    householdTotalIncome: totalGrossIncome,
    householdTotalTax: year.taxesPaid,
    householdNetCashFlow: netCashFlow,
    householdNetWorth: year.totalNetWorth,
    // Flags
    isRetired: year.isRetired,
    isRRIFConversionYear: year.isRRIFConversionYear,
    // RRIF output fields (v1.8 — RAPI-01)
    rrifForcedMinimum: year.rrifForcedMinimum,
    rrifMinimumRate: year.rrifMinimumRate,
    rrifConversionYear: year.rrifConversionYear,
  };

  // Optional fields: only set when present on PersonYearlyResult (D-06, D-08)
  if ('gisIncome' in year) {
    const personYear = year as unknown as PersonYearlyResult;
    if (personYear.gisIncome !== undefined) {
      row.gisIncome = personYear.gisIncome;
    }
  }
  if ('lifWithdrawal' in year) {
    const personYear = year as unknown as PersonYearlyResult;
    if (personYear.lifWithdrawal !== undefined) {
      row.lifWithdrawal = personYear.lifWithdrawal;
    }
  }
  if ('liraBalance' in year) {
    const personYear = year as unknown as PersonYearlyResult;
    if (personYear.liraBalance !== undefined) {
      row.liraBalance = personYear.liraBalance;
    }
  }
  if ('lifBalance' in year) {
    const personYear = year as unknown as PersonYearlyResult;
    if (personYear.lifBalance !== undefined) {
      row.lifBalance = personYear.lifBalance;
    }
  }
  // M005/P4: contribution room surfaced for single-person flows
  if ('rrspContributionRoom' in year) {
    const personYear = year as unknown as PersonYearlyResult;
    if (personYear.rrspContributionRoom !== undefined) {
      row.rrspContributionRoom = personYear.rrspContributionRoom;
    }
  }
  // M005/P5: bracket-fill withdrawal surfaced for single-person flows
  if ('bracketFillWithdrawal' in year) {
    const personYear = year as unknown as PersonYearlyResult;
    if (personYear.bracketFillWithdrawal !== undefined) {
      row.bracketFillWithdrawal = personYear.bracketFillWithdrawal;
    }
  }
  // M005/S06: over-contribution penalty surfaced for single-person flows
  if (year.overContributionPenalty !== undefined) {
    const p = year.overContributionPenalty;
    if (p.rrsp > 0 || p.tfsa > 0 || p.fhsa > 0) {
      row.overContributionPenalty = p;
    }
  }

  // D-22: pass engine-emitted override sidecar through to the UI row
  // @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-22
  if (year.overrides !== undefined) {
    row.overrides = year.overrides;
  }

  // Phase 2 — D-32. Pass engine-emitted provenance sidecar through; compose overrideMeta
  // from scenario decisions onto cells whose source === 'override' (D-40, D-44, D-46, D-47).
  // Out-of-scope cells (CPP, OAS, balances) have no provenance key — popover uses D-39 placeholder.
  if (year.provenance !== undefined) {
    row.provenance = composeOverrideMeta(year.provenance, year.year, decisions);
  }

  return row;
}

/**
 * Map a CoupleYearlyResult to ProjectionYearRow.
 * Spouse fields populated; household aggregates from CoupleYearlyResult.
 *
 * @param decisions — optional; used to compose overrideMeta onto provenance cells (D-32, D-44).
 */
function mapCoupleYearToRow(
  year: CoupleYearlyResult,
  decisions?: ScenarioDecisions,
  debtPayments?: number
): ProjectionYearRow {
  const p = year.primary;
  const s = year.spouse;
  const primaryOasClawback = p.oasClawback ?? p.taxCalculation.oasClawback;
  const spouseOasClawback = s.oasClawback ?? s.taxCalculation.oasClawback;
  const primaryOasGrossIncome = p.oasGrossIncome ?? p.oasIncome + primaryOasClawback;
  const spouseOasGrossIncome = s.oasGrossIncome ?? s.oasIncome + spouseOasClawback;
  const primaryOasNetIncome = p.oasNetIncome ?? p.oasIncome;
  const spouseOasNetIncome = s.oasNetIncome ?? s.oasIncome;
  const primaryNetCashFlow = p.netCashFlow - (debtPayments ?? 0);
  const householdNetCashFlow = year.householdNetCashFlow - (debtPayments ?? 0);

  const row: ProjectionYearRow = {
    // Identity
    year: year.year,
    age: p.age,
    spouseAge: s.age,
    // Primary income
    employmentIncome: p.employmentIncome,
    pensionIncome: p.pensionIncome,
    cppIncome: p.cppIncome,
    oasGrossIncome: primaryOasGrossIncome,
    oasNetIncome: primaryOasNetIncome,
    oasIncome: p.oasIncome,
    rrifWithdrawal: p.rrifWithdrawal,
    tfsaWithdrawal: p.tfsaWithdrawal,
    nonRegWithdrawal: p.nonRegWithdrawal,
    totalGrossIncome: p.totalGrossIncome,
    // Primary taxes
    federalTax: p.taxCalculation.federalTaxNet,
    provincialTax: p.taxCalculation.provincialTaxNet,
    oasClawback: primaryOasClawback,
    totalTax: p.taxesPaid,
    totalTaxIncludingOASRecovery: p.taxesPaid + primaryOasClawback,
    effectiveTaxRate: p.taxCalculation.effectiveRate,
    // Primary spending
    livingExpenses: p.livingExpenses,
    ...(debtPayments !== undefined ? { debtPayments } : {}),
    netCashFlow: primaryNetCashFlow,
    // Primary balances
    rrspBalance: p.rrspBalance,
    rrifBalance: p.rrifBalance,
    tfsaBalance: p.tfsaBalance,
    nonRegBalance: p.nonRegBalance,
    totalNetWorth: p.totalNetWorth,
    // Spouse income (D-02)
    spouseEmploymentIncome: s.employmentIncome,
    spousePensionIncome: s.pensionIncome,
    spouseCppIncome: s.cppIncome,
    spouseOasGrossIncome,
    spouseOasNetIncome,
    spouseOasIncome: s.oasIncome,
    spouseRrifWithdrawal: s.rrifWithdrawal,
    spouseTfsaWithdrawal: s.tfsaWithdrawal,
    spouseNonRegWithdrawal: s.nonRegWithdrawal,
    // Spouse taxes (D-02)
    spouseFederalTax: s.taxCalculation.federalTaxNet,
    spouseProvincialTax: s.taxCalculation.provincialTaxNet,
    spouseOasClawback,
    spouseTotalTax: s.taxesPaid,
    spouseTotalTaxIncludingOASRecovery: s.taxesPaid + spouseOasClawback,
    spouseEffectiveTaxRate: s.taxCalculation.effectiveRate,
    // Spouse balances (D-04)
    spouseRrspBalance: s.rrspBalance,
    spouseRrifBalance: s.rrifBalance,
    spouseTfsaBalance: s.tfsaBalance,
    spouseNonRegBalance: s.nonRegBalance,
    // Spouse spending — per-person split sourced from PersonYearlyResult
    spouseLivingExpenses: s.livingExpenses,
    spouseNetCashFlow: s.netCashFlow,
    // Household aggregates from CoupleYearlyResult (D-03)
    householdTotalIncome: year.householdGrossIncome,
    householdTotalTax: year.householdTaxesPaid,
    householdNetCashFlow,
    householdNetWorth: year.householdNetWorth,
    // Flags
    isRetired: p.isRetired,
    isRRIFConversionYear: year.eitherRRIFConversion,
    // Primary RRIF output fields (v1.8 — RAPI-01)
    rrifForcedMinimum: p.rrifForcedMinimum,
    rrifMinimumRate: p.rrifMinimumRate,
    rrifConversionYear: p.rrifConversionYear,
  };

  // Optional primary fields (D-06, D-08)
  if (p.gisIncome !== undefined) row.gisIncome = p.gisIncome;
  if (p.lifWithdrawal !== undefined) row.lifWithdrawal = p.lifWithdrawal;
  if (p.liraBalance !== undefined) row.liraBalance = p.liraBalance;
  if (p.lifBalance !== undefined) row.lifBalance = p.lifBalance;

  // Optional spouse fields (D-02, D-04)
  if (s.gisIncome !== undefined) row.spouseGisIncome = s.gisIncome;
  if (s.lifWithdrawal !== undefined) row.spouseLifWithdrawal = s.lifWithdrawal;
  if (s.liraBalance !== undefined) row.spouseLiraBalance = s.liraBalance;
  if (s.lifBalance !== undefined) row.spouseLifBalance = s.lifBalance;

  // Spouse RRIF output fields (v1.8 — RAPI-01)
  row.spouseRrifForcedMinimum = s.rrifForcedMinimum;
  row.spouseRrifMinimumRate = s.rrifMinimumRate;
  row.spouseRrifConversionYear = s.rrifConversionYear;

  // Pension splitting per-year surface (M005/P3)
  if (p.pensionIncomeReceived !== undefined) row.pensionIncomeReceived = p.pensionIncomeReceived;
  if (p.pensionIncomeTransferred !== undefined) {
    row.pensionIncomeTransferred = p.pensionIncomeTransferred;
  }
  if (s.pensionIncomeReceived !== undefined) {
    row.spousePensionIncomeReceived = s.pensionIncomeReceived;
  }
  if (s.pensionIncomeTransferred !== undefined) {
    row.spousePensionIncomeTransferred = s.pensionIncomeTransferred;
  }
  row.pensionSplitPercentage = year.pensionSplitPercentage;
  row.pensionSplitTaxSavings = year.pensionSplitTaxSavings;

  // Contribution room per-year surface (M005/P4)
  if (p.rrspContributionRoom !== undefined) row.rrspContributionRoom = p.rrspContributionRoom;
  if (s.rrspContributionRoom !== undefined) {
    row.spouseRrspContributionRoom = s.rrspContributionRoom;
  }

  // Bracket-fill withdrawal per-year surface (M005/P5)
  if (p.bracketFillWithdrawal !== undefined) row.bracketFillWithdrawal = p.bracketFillWithdrawal;
  if (s.bracketFillWithdrawal !== undefined) {
    row.spouseBracketFillWithdrawal = s.bracketFillWithdrawal;
  }

  // M005/S06: over-contribution penalty surfaced for couple flows (combine primary + spouse)
  const pRowPenalty = p.overContributionPenalty;
  const sRowPenalty = s.overContributionPenalty;
  if (pRowPenalty !== undefined || sRowPenalty !== undefined) {
    const combined: OverContributionPenalty = {
      rrsp: roundPenaltyAmount((pRowPenalty?.rrsp ?? 0) + (sRowPenalty?.rrsp ?? 0)),
      tfsa: roundPenaltyAmount((pRowPenalty?.tfsa ?? 0) + (sRowPenalty?.tfsa ?? 0)),
      fhsa: roundPenaltyAmount((pRowPenalty?.fhsa ?? 0) + (sRowPenalty?.fhsa ?? 0)),
    };
    if (combined.rrsp > 0 || combined.tfsa > 0 || combined.fhsa > 0) {
      row.overContributionPenalty = combined;
    }
  }

  // D-22: pass each person's override sidecar to the row separately.
  // @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-22
  if (p.overrides !== undefined) {
    row.overrides = p.overrides;
  }
  if (s.overrides !== undefined) {
    row.spouseOverrides = s.overrides;
  }

  // Phase 2 — D-32. Aggregate per-person provenance into the household row.
  // T-COUPLE-01: primary's entry wins on key clashes (mergeProvenance spreads spouse first,
  // primary last). Tax provenance is household-level and typically only on primary.
  // Then compose overrideMeta from scenario decisions onto override-source cells (D-44, D-46, D-47).
  const mergedProvenance = mergeProvenance(p.provenance, s.provenance);
  if (mergedProvenance !== undefined) {
    row.provenance = composeOverrideMeta(mergedProvenance, year.year, decisions);
  }

  return row;
}

/**
 * Transform a couple yearly result - uses primary person's details with household totals
 */
function roundPenaltyAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

function transformCoupleYearlyResult(year: CoupleYearlyResult): FrontendYearlyResult {
  const primary = year.primary;
  const spouse = year.spouse;

  // Couple result views should use household totals so charts reflect shared spending.
  const withdrawals =
    primary.rrifWithdrawal +
    (primary.lifWithdrawal ?? 0) +
    primary.tfsaWithdrawal +
    primary.nonRegWithdrawal +
    spouse.rrifWithdrawal +
    (spouse.lifWithdrawal ?? 0) +
    spouse.tfsaWithdrawal +
    spouse.nonRegWithdrawal;

  // Combine RRSP and RRIF balances for display simplicity
  const rrspBalance =
    primary.rrspBalance + primary.rrifBalance + spouse.rrspBalance + spouse.rrifBalance;

  const out: FrontendYearlyResult = {
    year: year.year,
    age: primary.age,
    employmentIncome: Math.round(primary.employmentIncome + spouse.employmentIncome),
    pensionIncome: Math.round(primary.pensionIncome + spouse.pensionIncome),
    cppIncome: Math.round(primary.cppIncome + spouse.cppIncome),
    oasIncome: Math.round(primary.oasIncome + spouse.oasIncome),
    withdrawals: Math.round(withdrawals),
    totalIncome: Math.round(year.householdGrossIncome), // Use household total
    federalTax: Math.round(
      primary.taxCalculation.federalTaxNet + spouse.taxCalculation.federalTaxNet
    ),
    provincialTax: Math.round(
      primary.taxCalculation.provincialTaxNet + spouse.taxCalculation.provincialTaxNet
    ),
    totalTax: Math.round(year.householdTaxesPaid), // Use household total
    netIncome: Math.round(year.householdNetIncome), // Use household total
    rrspBalance: Math.round(rrspBalance),
    tfsaBalance: Math.round(primary.tfsaBalance + spouse.tfsaBalance),
    nonRegBalance: Math.round(primary.nonRegBalance + spouse.nonRegBalance),
    totalNetWorth: Math.round(year.householdNetWorth), // Use household total
    isRRIFConversionYear: year.eitherRRIFConversion,
  };

  // M005/S05: surface contribution-room ledger diagnostics. Couple engine path
  // always populates tfsaContributionRoom/fhsaContributionRoom per person (K014
  // always-set); penalty/warnings are conditional (K002 conditional-spread).
  if (primary.tfsaContributionRoom !== undefined || spouse.tfsaContributionRoom !== undefined) {
    out.tfsaContributionRoom = Math.round(
      (primary.tfsaContributionRoom ?? 0) + (spouse.tfsaContributionRoom ?? 0)
    );
  }
  if (primary.fhsaContributionRoom !== undefined || spouse.fhsaContributionRoom !== undefined) {
    out.fhsaContributionRoom = Math.round(
      (primary.fhsaContributionRoom ?? 0) + (spouse.fhsaContributionRoom ?? 0)
    );
  }
  const pPenalty = primary.overContributionPenalty;
  const sPenalty = spouse.overContributionPenalty;
  if (pPenalty !== undefined || sPenalty !== undefined) {
    const combined: OverContributionPenalty = {
      rrsp: roundPenaltyAmount((pPenalty?.rrsp ?? 0) + (sPenalty?.rrsp ?? 0)),
      tfsa: roundPenaltyAmount((pPenalty?.tfsa ?? 0) + (sPenalty?.tfsa ?? 0)),
      fhsa: roundPenaltyAmount((pPenalty?.fhsa ?? 0) + (sPenalty?.fhsa ?? 0)),
    };
    if (combined.rrsp > 0 || combined.tfsa > 0 || combined.fhsa > 0) {
      out.overContributionPenalty = combined;
    }
  }
  const combinedWarnings: LedgerWarning[] = [
    ...(primary.ledgerWarnings ?? []),
    ...(spouse.ledgerWarnings ?? []),
  ];
  if (combinedWarnings.length > 0) {
    out.ledgerWarnings = combinedWarnings;
  }

  return out;
}

/**
 * Transform couple projection summary
 */
function transformCoupleSummary(
  summary: CoupleProjectionSummary,
  lifeExpectancy: number
): FrontendSummary {
  // Calculate probability of success based on money lasting
  let probabilityOfSuccess: number;
  if (summary.moneyLastsToLifeExpectancy) {
    probabilityOfSuccess = 100;
  } else if (summary.portfolioLongevityAge !== null) {
    const retirementStartAge = lifeExpectancy - summary.yearsInRetirement;
    const yearsWithMoney = summary.portfolioLongevityAge - retirementStartAge;
    const totalRetirementYears = lifeExpectancy - retirementStartAge;
    probabilityOfSuccess = Math.max(0, Math.round((yearsWithMoney / totalRetirementYears) * 100));
  } else {
    probabilityOfSuccess = 100;
  }

  return {
    peakNetWorth: Math.round(summary.peakNetWorth),
    portfolioLongevity: summary.portfolioLongevityAge ?? lifeExpectancy,
    totalTaxesPaid: Math.round(summary.totalTaxesPaid),
    averageRetirementIncome: Math.round(summary.averageRetirementIncome),
    probabilityOfSuccess,
    startYear: summary.startYear,
    endYear: summary.endYear,
    retirementYear: summary.retirementYear,
    yearsInRetirement: summary.yearsInRetirement,
    peakNetWorthYear: summary.peakNetWorthYear,
    lowestNetWorth: Math.round(summary.lowestNetWorth),
    portfolioLongevityAge: summary.portfolioLongevityAge,
    moneyLastsToLifeExpectancy: summary.moneyLastsToLifeExpectancy,
    averageEffectiveTaxRate: summary.averageEffectiveTaxRate,
    fundedStatus: summary.fundedStatus,
    remediationPlan: summary.remediationPlan,
    ...(summary.grossEstate !== undefined ? { grossEstate: Math.round(summary.grossEstate) } : {}),
    ...(summary.terminalTaxes !== undefined
      ? { terminalTaxes: Math.round(summary.terminalTaxes) }
      : {}),
    ...(summary.netEstate !== undefined ? { netEstate: Math.round(summary.netEstate) } : {}),
  };
}

/**
 * Transform a single yearly result
 */
function transformYearlyResult(year: YearlyResult): FrontendYearlyResult {
  // Combine all withdrawals
  const withdrawals = year.rrifWithdrawal + year.tfsaWithdrawal + year.nonRegWithdrawal;

  // Combine RRSP and RRIF balances for display simplicity
  const rrspBalance = year.rrspBalance + year.rrifBalance;

  // Calculate net income
  const netIncome = year.totalIncome - year.taxesPaid;

  const out: FrontendYearlyResult = {
    year: year.year,
    age: year.age,
    employmentIncome: Math.round(year.employmentIncome),
    pensionIncome: Math.round(year.pensionIncome),
    cppIncome: Math.round(year.cppIncome),
    oasIncome: Math.round(year.oasIncome),
    withdrawals: Math.round(withdrawals),
    totalIncome: Math.round(year.totalIncome),
    federalTax: Math.round(year.taxCalculation.federalTaxNet),
    provincialTax: Math.round(year.taxCalculation.provincialTaxNet),
    totalTax: Math.round(year.taxesPaid),
    netIncome: Math.round(netIncome),
    rrspBalance: Math.round(rrspBalance),
    tfsaBalance: Math.round(year.tfsaBalance),
    nonRegBalance: Math.round(year.nonRegBalance),
    totalNetWorth: Math.round(year.totalNetWorth),
    isRRIFConversionYear: year.isRRIFConversionYear,
  };

  // Surface contribution-room ledger diagnostics on single projections, mirroring
  // the couple path (transformCoupleYearlyResult). Engine emits these on every
  // year; over-contribution penalties / warnings appear only in years where the
  // user exceeded their available room.
  if (year.tfsaContributionRoom !== undefined) {
    out.tfsaContributionRoom = Math.round(year.tfsaContributionRoom);
  }
  if (year.fhsaContributionRoom !== undefined) {
    out.fhsaContributionRoom = Math.round(year.fhsaContributionRoom);
  }
  if (year.overContributionPenalty !== undefined) {
    out.overContributionPenalty = {
      rrsp: roundPenaltyAmount(year.overContributionPenalty.rrsp),
      tfsa: roundPenaltyAmount(year.overContributionPenalty.tfsa),
      fhsa: roundPenaltyAmount(year.overContributionPenalty.fhsa),
    };
  }
  if (year.ledgerWarnings !== undefined && year.ledgerWarnings.length > 0) {
    out.ledgerWarnings = year.ledgerWarnings;
  }

  return out;
}

/**
 * Transform projection summary
 */
function transformSummary(summary: ProjectionSummary, lifeExpectancy: number): FrontendSummary {
  // Calculate probability of success
  // For Phase 1: 100% if money lasts, otherwise calculate based on how long it lasts
  let probabilityOfSuccess: number;
  if (summary.moneyLastsToLifeExpectancy) {
    probabilityOfSuccess = 100;
  } else if (summary.portfolioLongevityAge !== null) {
    // Calculate what percentage of retirement was funded
    const retirementStartAge = lifeExpectancy - summary.yearsInRetirement;
    const yearsWithMoney = summary.portfolioLongevityAge - retirementStartAge;
    const totalRetirementYears = lifeExpectancy - retirementStartAge;
    probabilityOfSuccess = Math.max(0, Math.round((yearsWithMoney / totalRetirementYears) * 100));
  } else {
    probabilityOfSuccess = 100;
  }

  return {
    peakNetWorth: Math.round(summary.peakNetWorth),
    portfolioLongevity: summary.portfolioLongevityAge ?? lifeExpectancy,
    totalTaxesPaid: Math.round(summary.totalTaxesPaid),
    averageRetirementIncome: Math.round(summary.averageRetirementIncome),
    probabilityOfSuccess,
    startYear: summary.startYear,
    endYear: summary.endYear,
    retirementYear: summary.retirementYear,
    yearsInRetirement: summary.yearsInRetirement,
    peakNetWorthYear: summary.peakNetWorthYear,
    lowestNetWorth: Math.round(summary.lowestNetWorth),
    portfolioLongevityAge: summary.portfolioLongevityAge,
    moneyLastsToLifeExpectancy: summary.moneyLastsToLifeExpectancy,
    averageEffectiveTaxRate: summary.averageEffectiveTaxRate,
    fundedStatus: summary.fundedStatus,
    remediationPlan: summary.remediationPlan,
    ...(summary.grossEstate !== undefined ? { grossEstate: Math.round(summary.grossEstate) } : {}),
    ...(summary.terminalTaxes !== undefined
      ? { terminalTaxes: Math.round(summary.terminalTaxes) }
      : {}),
    ...(summary.netEstate !== undefined ? { netEstate: Math.round(summary.netEstate) } : {}),
  };
}
