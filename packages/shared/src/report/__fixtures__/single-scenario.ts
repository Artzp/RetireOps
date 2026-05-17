/**
 * Single-scenario fixture for buildLongReportData tests.
 *
 * Hand-authored TypeScript `const` declarations — NOT produced at import time
 * by any engine entry point. `@retireops/shared` has zero dependency on
 * `@retireops/calculation-engine`; fixtures must be statically-typed literals.
 *
 * Scenario: Ontario resident, retired at 65, RRSP + TFSA + Non-Reg accounts,
 * CPP + OAS turned on, modest portfolio. Two projection years emitted so the
 * adapter's "last-row endingBalances" branch is exercised. Year 2 carries
 * GIS, OAS clawback, and a ledger warning so every RPT-10 field is reachable
 * through `LongReportData.yearByYear` from this fixture alone.
 *
 * No type-assertion casts on TaxCalculation — every required field is
 * explicitly populated to satisfy the structural contract.
 *
 * @see ../../../../../.planning/phases/18-report-data-foundation/18-03-PLAN.md
 * @see ../../../../../.planning/phases/18-report-data-foundation/18-RESEARCH.md - RPT-10 Field Wiring Table
 */

import type {
  ProjectionOutput,
  ProjectionInput,
  ProjectionSummary,
  YearlyResult,
  ProjectionYearRow,
  TerminalReturnResult,
  LedgerWarning,
  FundedStatus,
} from '../../types/projection.js';
import type { TaxCalculation } from '../../types/tax.js';

// ---------------------------------------------------------------------------
// Building blocks — explicit so every required field on every interface is
// present without using `as` casts.
// ---------------------------------------------------------------------------

const singleTaxCalcYear1: TaxCalculation = {
  year: 2026,
  owner: 'primary',
  employmentIncome: 0,
  pensionIncome: 0,
  rrifIncome: 0,
  cppIncome: 14_500,
  oasIncome: 8_500,
  investmentIncome: 1_200,
  interestIncome: 800,
  capitalGains: 400,
  dividendIncomeEligible: 0,
  dividendIncomeNonEligible: 0,
  grossIncome: 24_200,
  deductions: 0,
  netIncome: 24_200,
  taxableIncome: 24_200,
  federalTaxGross: 3_630,
  federalCredits: 2_500,
  federalTaxNet: 1_130,
  provincialTaxGross: 1_240,
  provincialCredits: 900,
  provincialTaxNet: 340,
  totalTax: 1_470,
  marginalRateFederal: 0.15,
  marginalRateProvincial: 0.0505,
  marginalRateCombined: 0.2005,
  effectiveRate: 0.0607,
  oasClawback: 0,
  ageCredit: 1_200,
  pensionCredit: 0,
};

const singleTaxCalcYear2: TaxCalculation = {
  year: 2027,
  owner: 'primary',
  employmentIncome: 0,
  pensionIncome: 0,
  rrifIncome: 22_000,
  cppIncome: 14_790,
  oasIncome: 8_670,
  investmentIncome: 1_220,
  interestIncome: 820,
  capitalGains: 400,
  dividendIncomeEligible: 0,
  dividendIncomeNonEligible: 0,
  grossIncome: 46_680,
  deductions: 0,
  netIncome: 46_680,
  taxableIncome: 46_680,
  federalTaxGross: 7_002,
  federalCredits: 2_550,
  federalTaxNet: 4_452,
  provincialTaxGross: 2_357,
  provincialCredits: 920,
  provincialTaxNet: 1_437,
  totalTax: 5_889,
  marginalRateFederal: 0.15,
  marginalRateProvincial: 0.0915,
  marginalRateCombined: 0.2415,
  effectiveRate: 0.1262,
  oasClawback: 0,
  ageCredit: 1_240,
  pensionCredit: 2_000,
};

const ledgerWarningYear2: LedgerWarning = {
  year: 2027,
  person: 'primary',
  accountType: 'tfsa',
  kind: 'over-contribution',
  message: 'TFSA contribution exceeded available room by $500.',
  penaltyAmount: 60,
};

const singleYearlyResults: YearlyResult[] = [
  {
    year: 2026,
    age: 65,
    employmentIncome: 0,
    pensionIncome: 0,
    cppIncome: 14_500,
    oasGrossIncome: 8_500,
    oasNetIncome: 8_500,
    oasIncome: 8_500,
    oasClawback: 0,
    gisIncome: 0,
    rrifWithdrawal: 0,
    tfsaWithdrawal: 0,
    nonRegWithdrawal: 1_200,
    totalIncome: 24_200,
    livingExpenses: 40_000,
    taxesPaid: 1_470,
    netCashFlow: -17_270,
    rrspBalance: 200_000,
    rrifBalance: 0,
    tfsaBalance: 80_000,
    nonRegBalance: 50_000,
    totalNetWorth: 330_000,
    taxCalculation: singleTaxCalcYear1,
    rrifForcedMinimum: 0,
    rrifMinimumRate: 0,
    rrifConversionYear: false,
    isRetired: true,
    isRRIFConversionYear: false,
  },
  {
    year: 2027,
    age: 66,
    employmentIncome: 0,
    pensionIncome: 0,
    cppIncome: 14_790,
    oasGrossIncome: 8_670,
    oasNetIncome: 8_670,
    oasIncome: 8_670,
    oasClawback: 0,
    gisIncome: 250,
    rrifWithdrawal: 22_000,
    tfsaWithdrawal: 0,
    nonRegWithdrawal: 1_220,
    totalIncome: 46_930,
    livingExpenses: 40_800,
    taxesPaid: 5_889,
    netCashFlow: 241,
    rrspBalance: 178_000,
    rrifBalance: 0,
    tfsaBalance: 82_500,
    nonRegBalance: 49_500,
    totalNetWorth: 310_000,
    taxCalculation: singleTaxCalcYear2,
    rrifForcedMinimum: 0,
    rrifMinimumRate: 0,
    rrifConversionYear: false,
    ledgerWarnings: [ledgerWarningYear2],
    isRetired: true,
    isRRIFConversionYear: false,
  },
];

const singleProjectionRows: ProjectionYearRow[] = [
  {
    // Identity
    year: 2026,
    age: 65,
    // Primary income
    employmentIncome: 0,
    pensionIncome: 0,
    cppIncome: 14_500,
    oasGrossIncome: 8_500,
    oasNetIncome: 8_500,
    oasIncome: 8_500,
    gisIncome: 0,
    rrifWithdrawal: 0,
    tfsaWithdrawal: 0,
    nonRegWithdrawal: 1_200,
    totalGrossIncome: 24_200,
    // Primary taxes
    federalTax: 1_130,
    provincialTax: 340,
    oasClawback: 0,
    totalTax: 1_470,
    totalTaxIncludingOASRecovery: 1_470,
    effectiveTaxRate: 0.0607,
    // Primary spending
    livingExpenses: 40_000,
    netCashFlow: -17_270,
    // Primary balances
    rrspBalance: 200_000,
    rrifBalance: 0,
    tfsaBalance: 80_000,
    nonRegBalance: 50_000,
    totalNetWorth: 330_000,
    // Household aggregates (mirror primary for single projections, D-03)
    householdTotalIncome: 24_200,
    householdTotalTax: 1_470,
    householdNetCashFlow: -17_270,
    householdNetWorth: 330_000,
    // RRIF output
    rrifForcedMinimum: 0,
    rrifMinimumRate: 0,
    rrifConversionYear: false,
    // Flags
    isRetired: true,
    isRRIFConversionYear: false,
  },
  {
    year: 2027,
    age: 66,
    employmentIncome: 0,
    pensionIncome: 0,
    cppIncome: 14_790,
    oasGrossIncome: 8_670,
    oasNetIncome: 8_670,
    oasIncome: 8_670,
    gisIncome: 250,
    rrifWithdrawal: 22_000,
    tfsaWithdrawal: 0,
    nonRegWithdrawal: 1_220,
    totalGrossIncome: 46_930,
    federalTax: 4_452,
    provincialTax: 1_437,
    oasClawback: 0,
    totalTax: 5_889,
    totalTaxIncludingOASRecovery: 5_889,
    effectiveTaxRate: 0.1255,
    livingExpenses: 40_800,
    netCashFlow: 241,
    rrspBalance: 178_000,
    rrifBalance: 0,
    tfsaBalance: 82_500,
    nonRegBalance: 49_500,
    totalNetWorth: 310_000,
    householdTotalIncome: 46_930,
    householdTotalTax: 5_889,
    householdNetCashFlow: 241,
    householdNetWorth: 310_000,
    rrifForcedMinimum: 0,
    rrifMinimumRate: 0,
    rrifConversionYear: false,
    isRetired: true,
    isRRIFConversionYear: false,
  },
];

const singleFundedStatus: FundedStatus = {
  state: 'green',
  depletionAge: null,
  balanceAtLifeExpectancy: 310_000,
  totalRetirementWithdrawals: 24_420,
};

const singleSummary: ProjectionSummary = {
  startYear: 2026,
  endYear: 2027,
  retirementYear: 2026,
  yearsInRetirement: 2,
  peakNetWorth: 330_000,
  peakNetWorthYear: 2026,
  portfolioLongevityAge: null,
  totalTaxesPaid: 7_359,
  averageRetirementIncome: 35_565,
  averageEffectiveTaxRate: 0.0931,
  moneyLastsToLifeExpectancy: true,
  lowestNetWorth: 310_000,
  lowestNetWorthYear: 2027,
  fundedStatus: singleFundedStatus,
  remediationPlan: null,
  grossEstate: 310_000,
  terminalTaxes: 35_000,
  netEstate: 275_000,
};

const singleTerminalEvent: TerminalReturnResult = {
  year: 2027,
  triggeringOwner: 'primary',
  grossEstate: 310_000,
  deemedDispositionIncome: 178_000,
  realizedCapitalGain: 4_000,
  taxableCapitalGain: 2_000,
  terminalTaxes: 35_000,
  netEstate: 275_000,
  wasSpouseRolloverApplied: false,
};

const singleProjectionInput: ProjectionInput = {
  birthdate: new Date('1961-01-01T00:00:00.000Z'),
  province: 'ON',
  retirementAge: 65,
  lifeExpectancy: 90,
  maritalStatus: 'single',
  employmentIncome: 0,
  employmentGrowthRate: 0,
  rrspBalance: 200_000,
  rrspAnnualContribution: 0,
  tfsaBalance: 80_000,
  tfsaAnnualContribution: 0,
  nonRegBalance: 50_000,
  retirementSpending: 40_000,
  investmentReturn: 0.05,
  inflationRate: 0.02,
  expectedCPPAt65: 14_500,
  cppStartAge: 65,
  oasStartAge: 65,
  yearsOfResidence: 40,
  projectionStartYear: 2026,
  legacyTarget: 250_000,
};

// ---------------------------------------------------------------------------
// Top-level fixture exports
// ---------------------------------------------------------------------------

/**
 * Hand-authored ProjectionOutput for a single retiree.
 * Two-year horizon — sufficient to exercise every adapter branch.
 */
export const singleProjectionOutput: ProjectionOutput = {
  id: 'projection-single-fixture',
  input: singleProjectionInput,
  yearlyResults: singleYearlyResults,
  projectionRows: singleProjectionRows,
  legacyTargetMet: true,
  summary: singleSummary,
  terminalTaxEvents: [singleTerminalEvent],
  createdAt: new Date('2026-05-11T00:00:00.000Z'),
  updatedAt: new Date('2026-05-11T00:00:00.000Z'),
};

/**
 * Deterministic generatedAt timestamp for adapter tests.
 * Caller-supplied per RPT-03 — the adapter is pure and never derives this from `Date.now()`.
 */
export const singleGeneratedAt = new Date('2026-05-11T12:00:00.000Z');

/**
 * Display name used across single-scenario assertions.
 */
export const singleScenarioName = 'Ontario Single — Baseline Retirement';

/**
 * Display status used across single-scenario assertions.
 */
export const singleScenarioStatus = 'active';
