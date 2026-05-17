/**
 * Couple-scenario fixture for buildLongReportData tests.
 *
 * Hand-authored TypeScript `const` declarations — NOT produced at import time
 * by any engine entry point. `@retireops/shared` has zero dependency on
 * `@retireops/calculation-engine`; fixtures must be statically-typed literals.
 *
 * Scenario: Ontario couple, both retired, spousal-RRSP scenario active,
 * pension splitting on, both with CPP+OAS, primary has higher RRIF income
 * triggering OAS clawback (RPT-10 field reachability).
 *
 * No type-assertion casts on TaxCalculation — every required field is
 * explicitly populated to satisfy the structural contract.
 *
 * @see ../../../../../.planning/phases/18-report-data-foundation/18-03-PLAN.md
 * @see ../../../../../.planning/phases/18-report-data-foundation/18-RESEARCH.md - RPT-10 Field Wiring Table
 */

import type {
  ProjectionInput,
  CoupleProjectionSummary,
  ProjectionSummary,
  CoupleYearlyResult,
  PersonYearlyResult,
  ProjectionYearRow,
  TerminalReturnResult,
  LedgerWarning,
  FundedStatus,
} from '../../types/projection.js';
import type { TaxCalculation } from '../../types/tax.js';
import type { CoupleProjectionOutputLike } from '../types.js';

// ---------------------------------------------------------------------------
// Tax calculations — explicit field-by-field to satisfy TaxCalculation.
// ---------------------------------------------------------------------------

const primaryTaxYear1: TaxCalculation = {
  year: 2026,
  owner: 'primary',
  employmentIncome: 0,
  pensionIncome: 6_000,
  rrifIncome: 28_000,
  cppIncome: 15_200,
  oasIncome: 7_900,
  investmentIncome: 1_500,
  interestIncome: 1_100,
  capitalGains: 400,
  dividendIncomeEligible: 0,
  dividendIncomeNonEligible: 0,
  grossIncome: 58_600,
  deductions: 0,
  netIncome: 58_600,
  taxableIncome: 58_600,
  federalTaxGross: 8_790,
  federalCredits: 2_600,
  federalTaxNet: 6_190,
  provincialTaxGross: 3_098,
  provincialCredits: 950,
  provincialTaxNet: 2_148,
  totalTax: 8_338,
  marginalRateFederal: 0.205,
  marginalRateProvincial: 0.0915,
  marginalRateCombined: 0.2965,
  effectiveRate: 0.1423,
  oasClawback: 600,
  ageCredit: 1_240,
  pensionCredit: 2_000,
};

const spouseTaxYear1: TaxCalculation = {
  year: 2026,
  owner: 'spouse',
  employmentIncome: 0,
  pensionIncome: 0,
  rrifIncome: 12_000,
  cppIncome: 11_800,
  oasIncome: 8_400,
  investmentIncome: 800,
  interestIncome: 600,
  capitalGains: 200,
  dividendIncomeEligible: 0,
  dividendIncomeNonEligible: 0,
  grossIncome: 33_000,
  deductions: 0,
  netIncome: 33_000,
  taxableIncome: 33_000,
  federalTaxGross: 4_950,
  federalCredits: 2_500,
  federalTaxNet: 2_450,
  provincialTaxGross: 1_667,
  provincialCredits: 920,
  provincialTaxNet: 747,
  totalTax: 3_197,
  marginalRateFederal: 0.15,
  marginalRateProvincial: 0.0505,
  marginalRateCombined: 0.2005,
  effectiveRate: 0.0969,
  oasClawback: 0,
  ageCredit: 1_220,
  pensionCredit: 0,
};

const primaryTaxYear2: TaxCalculation = {
  year: 2027,
  owner: 'primary',
  employmentIncome: 0,
  pensionIncome: 6_120,
  rrifIncome: 28_500,
  cppIncome: 15_500,
  oasIncome: 7_950,
  investmentIncome: 1_530,
  interestIncome: 1_120,
  capitalGains: 410,
  dividendIncomeEligible: 0,
  dividendIncomeNonEligible: 0,
  grossIncome: 59_600,
  deductions: 0,
  netIncome: 59_600,
  taxableIncome: 59_600,
  federalTaxGross: 8_940,
  federalCredits: 2_650,
  federalTaxNet: 6_290,
  provincialTaxGross: 3_150,
  provincialCredits: 960,
  provincialTaxNet: 2_190,
  totalTax: 8_480,
  marginalRateFederal: 0.205,
  marginalRateProvincial: 0.0915,
  marginalRateCombined: 0.2965,
  effectiveRate: 0.1422,
  oasClawback: 700,
  ageCredit: 1_260,
  pensionCredit: 2_000,
};

const spouseTaxYear2: TaxCalculation = {
  year: 2027,
  owner: 'spouse',
  employmentIncome: 0,
  pensionIncome: 0,
  rrifIncome: 12_240,
  cppIncome: 12_000,
  oasIncome: 8_450,
  investmentIncome: 820,
  interestIncome: 620,
  capitalGains: 200,
  dividendIncomeEligible: 0,
  dividendIncomeNonEligible: 0,
  grossIncome: 33_510,
  deductions: 0,
  netIncome: 33_510,
  taxableIncome: 33_510,
  federalTaxGross: 5_026,
  federalCredits: 2_550,
  federalTaxNet: 2_476,
  provincialTaxGross: 1_692,
  provincialCredits: 930,
  provincialTaxNet: 762,
  totalTax: 3_238,
  marginalRateFederal: 0.15,
  marginalRateProvincial: 0.0505,
  marginalRateCombined: 0.2005,
  effectiveRate: 0.0966,
  oasClawback: 0,
  ageCredit: 1_240,
  pensionCredit: 0,
};

// ---------------------------------------------------------------------------
// Ledger warnings — exercise the couple-side aggregator.
// ---------------------------------------------------------------------------

const ledgerWarningPrimaryYear2: LedgerWarning = {
  year: 2027,
  person: 'primary',
  accountType: 'tfsa',
  kind: 'over-contribution',
  message: 'Primary TFSA contribution exceeded available room by $300.',
  penaltyAmount: 36,
};

const ledgerWarningSpouseYear2: LedgerWarning = {
  year: 2027,
  person: 'spouse',
  accountType: 'rrsp',
  kind: 'over-contribution',
  message: 'Spouse RRSP over-contribution detected.',
  penaltyAmount: 24,
};

// ---------------------------------------------------------------------------
// PersonYearlyResult building blocks.
// ---------------------------------------------------------------------------

const primaryYear1: PersonYearlyResult = {
  owner: 'primary',
  year: 2026,
  age: 65,
  employmentIncome: 0,
  pensionIncome: 6_000,
  cppIncome: 15_200,
  oasGrossIncome: 8_500,
  oasNetIncome: 7_900,
  oasIncome: 7_900,
  oasClawback: 600,
  gisIncome: 0,
  rrifWithdrawal: 28_000,
  tfsaWithdrawal: 0,
  nonRegWithdrawal: 1_500,
  totalGrossIncome: 58_600,
  livingExpenses: 30_000,
  taxesPaid: 8_338,
  netIncome: 50_262,
  netCashFlow: 20_262,
  rrspBalance: 0,
  rrifBalance: 250_000,
  tfsaBalance: 90_000,
  nonRegBalance: 60_000,
  totalNetWorth: 400_000,
  taxCalculation: primaryTaxYear1,
  rrifForcedMinimum: 14_500,
  rrifMinimumRate: 0.058,
  rrifConversionYear: false,
  isRetired: true,
  isRRIFConversionYear: false,
};

const spouseYear1: PersonYearlyResult = {
  owner: 'spouse',
  year: 2026,
  age: 63,
  employmentIncome: 0,
  pensionIncome: 0,
  cppIncome: 11_800,
  oasGrossIncome: 8_400,
  oasNetIncome: 8_400,
  oasIncome: 8_400,
  oasClawback: 0,
  gisIncome: 350,
  rrifWithdrawal: 12_000,
  tfsaWithdrawal: 500,
  nonRegWithdrawal: 800,
  totalGrossIncome: 33_350,
  livingExpenses: 28_000,
  taxesPaid: 3_197,
  netIncome: 30_153,
  netCashFlow: 2_153,
  rrspBalance: 80_000,
  rrifBalance: 100_000,
  tfsaBalance: 40_000,
  nonRegBalance: 25_000,
  totalNetWorth: 245_000,
  taxCalculation: spouseTaxYear1,
  rrifForcedMinimum: 5_400,
  rrifMinimumRate: 0.054,
  rrifConversionYear: false,
  isRetired: true,
  isRRIFConversionYear: false,
};

const primaryYear2: PersonYearlyResult = {
  owner: 'primary',
  year: 2027,
  age: 66,
  employmentIncome: 0,
  pensionIncome: 6_120,
  cppIncome: 15_500,
  oasGrossIncome: 8_650,
  oasNetIncome: 7_950,
  oasIncome: 7_950,
  oasClawback: 700,
  gisIncome: 0,
  rrifWithdrawal: 28_500,
  tfsaWithdrawal: 0,
  nonRegWithdrawal: 1_530,
  totalGrossIncome: 59_600,
  livingExpenses: 30_600,
  taxesPaid: 8_480,
  netIncome: 51_120,
  netCashFlow: 20_520,
  rrspBalance: 0,
  rrifBalance: 235_000,
  tfsaBalance: 92_500,
  nonRegBalance: 58_500,
  totalNetWorth: 386_000,
  taxCalculation: primaryTaxYear2,
  rrifForcedMinimum: 14_805,
  rrifMinimumRate: 0.058,
  rrifConversionYear: false,
  ledgerWarnings: [ledgerWarningPrimaryYear2],
  isRetired: true,
  isRRIFConversionYear: false,
};

const spouseYear2: PersonYearlyResult = {
  owner: 'spouse',
  year: 2027,
  age: 64,
  employmentIncome: 0,
  pensionIncome: 0,
  cppIncome: 12_000,
  oasGrossIncome: 8_450,
  oasNetIncome: 8_450,
  oasIncome: 8_450,
  oasClawback: 0,
  gisIncome: 360,
  rrifWithdrawal: 12_240,
  tfsaWithdrawal: 500,
  nonRegWithdrawal: 820,
  totalGrossIncome: 33_870,
  livingExpenses: 28_560,
  taxesPaid: 3_238,
  netIncome: 30_632,
  netCashFlow: 2_072,
  rrspBalance: 78_500,
  rrifBalance: 92_000,
  tfsaBalance: 40_800,
  nonRegBalance: 24_500,
  totalNetWorth: 235_800,
  taxCalculation: spouseTaxYear2,
  rrifForcedMinimum: 4_968,
  rrifMinimumRate: 0.054,
  rrifConversionYear: false,
  ledgerWarnings: [ledgerWarningSpouseYear2],
  isRetired: true,
  isRRIFConversionYear: false,
};

// ---------------------------------------------------------------------------
// CoupleYearlyResult — household aggregates read VERBATIM from engine
// per Pitfall 1 ("never re-sum household totals"); these are the values
// the engine emitted.
// ---------------------------------------------------------------------------

const coupleYearlyResults: CoupleYearlyResult[] = [
  {
    year: 2026,
    primary: primaryYear1,
    spouse: spouseYear1,
    householdGrossIncome: 91_950,
    householdNetIncome: 80_415,
    householdTaxesPaid: 11_535,
    householdLivingExpenses: 58_000,
    householdNetCashFlow: 22_415,
    householdNetWorth: 645_000,
    pensionSplitPercentage: 0.5,
    pensionSplitTaxSavings: 420,
    bothRetired: true,
    eitherRRIFConversion: false,
  },
  {
    year: 2027,
    primary: primaryYear2,
    spouse: spouseYear2,
    householdGrossIncome: 93_470,
    householdNetIncome: 81_752,
    householdTaxesPaid: 11_718,
    householdLivingExpenses: 59_160,
    householdNetCashFlow: 22_592,
    householdNetWorth: 621_800,
    pensionSplitPercentage: 0.5,
    pensionSplitTaxSavings: 435,
    bothRetired: true,
    eitherRRIFConversion: false,
  },
];

// ---------------------------------------------------------------------------
// ProjectionYearRow — top-level yearByYear; spouse fields populated.
// ---------------------------------------------------------------------------

const coupleProjectionRows: ProjectionYearRow[] = [
  {
    // Identity
    year: 2026,
    age: 65,
    spouseAge: 63,
    // Primary income
    employmentIncome: 0,
    pensionIncome: 6_000,
    cppIncome: 15_200,
    oasGrossIncome: 8_500,
    oasNetIncome: 7_900,
    oasIncome: 7_900,
    gisIncome: 0,
    rrifWithdrawal: 28_000,
    tfsaWithdrawal: 0,
    nonRegWithdrawal: 1_500,
    totalGrossIncome: 58_600,
    // Primary taxes
    federalTax: 6_190,
    provincialTax: 2_148,
    oasClawback: 600,
    totalTax: 8_338,
    totalTaxIncludingOASRecovery: 8_938,
    effectiveTaxRate: 0.1423,
    // Primary spending
    livingExpenses: 30_000,
    netCashFlow: 20_262,
    // Primary balances
    rrspBalance: 0,
    rrifBalance: 250_000,
    tfsaBalance: 90_000,
    nonRegBalance: 60_000,
    totalNetWorth: 400_000,
    // Spouse income
    spouseEmploymentIncome: 0,
    spousePensionIncome: 0,
    spouseCppIncome: 11_800,
    spouseOasGrossIncome: 8_400,
    spouseOasNetIncome: 8_400,
    spouseOasIncome: 8_400,
    spouseGisIncome: 350,
    spouseRrifWithdrawal: 12_000,
    spouseTfsaWithdrawal: 500,
    spouseNonRegWithdrawal: 800,
    // Spouse taxes
    spouseFederalTax: 2_450,
    spouseProvincialTax: 747,
    spouseOasClawback: 0,
    spouseTotalTax: 3_197,
    spouseTotalTaxIncludingOASRecovery: 3_197,
    spouseEffectiveTaxRate: 0.0969,
    // Spouse balances
    spouseRrspBalance: 80_000,
    spouseRrifBalance: 100_000,
    spouseTfsaBalance: 40_000,
    spouseNonRegBalance: 25_000,
    // Spouse spending
    spouseLivingExpenses: 28_000,
    spouseNetCashFlow: 2_153,
    // Spouse RRIF
    spouseRrifForcedMinimum: 5_400,
    spouseRrifMinimumRate: 0.054,
    spouseRrifConversionYear: false,
    // Pension splitting
    pensionSplitPercentage: 0.5,
    pensionSplitTaxSavings: 420,
    // Household aggregates (verbatim from engine)
    householdTotalIncome: 91_950,
    householdTotalTax: 11_535,
    householdNetCashFlow: 22_415,
    householdNetWorth: 645_000,
    // Primary RRIF
    rrifForcedMinimum: 14_500,
    rrifMinimumRate: 0.058,
    rrifConversionYear: false,
    // Flags
    isRetired: true,
    isRRIFConversionYear: false,
  },
  {
    year: 2027,
    age: 66,
    spouseAge: 64,
    employmentIncome: 0,
    pensionIncome: 6_120,
    cppIncome: 15_500,
    oasGrossIncome: 8_650,
    oasNetIncome: 7_950,
    oasIncome: 7_950,
    gisIncome: 0,
    rrifWithdrawal: 28_500,
    tfsaWithdrawal: 0,
    nonRegWithdrawal: 1_530,
    totalGrossIncome: 59_600,
    federalTax: 6_290,
    provincialTax: 2_190,
    oasClawback: 700,
    totalTax: 8_480,
    totalTaxIncludingOASRecovery: 9_180,
    effectiveTaxRate: 0.1422,
    livingExpenses: 30_600,
    netCashFlow: 20_520,
    rrspBalance: 0,
    rrifBalance: 235_000,
    tfsaBalance: 92_500,
    nonRegBalance: 58_500,
    totalNetWorth: 386_000,
    spouseEmploymentIncome: 0,
    spousePensionIncome: 0,
    spouseCppIncome: 12_000,
    spouseOasGrossIncome: 8_450,
    spouseOasNetIncome: 8_450,
    spouseOasIncome: 8_450,
    spouseGisIncome: 360,
    spouseRrifWithdrawal: 12_240,
    spouseTfsaWithdrawal: 500,
    spouseNonRegWithdrawal: 820,
    spouseFederalTax: 2_476,
    spouseProvincialTax: 762,
    spouseOasClawback: 0,
    spouseTotalTax: 3_238,
    spouseTotalTaxIncludingOASRecovery: 3_238,
    spouseEffectiveTaxRate: 0.0966,
    spouseRrspBalance: 78_500,
    spouseRrifBalance: 92_000,
    spouseTfsaBalance: 40_800,
    spouseNonRegBalance: 24_500,
    spouseLivingExpenses: 28_560,
    spouseNetCashFlow: 2_072,
    spouseRrifForcedMinimum: 4_968,
    spouseRrifMinimumRate: 0.054,
    spouseRrifConversionYear: false,
    pensionSplitPercentage: 0.5,
    pensionSplitTaxSavings: 435,
    householdTotalIncome: 93_470,
    householdTotalTax: 11_718,
    householdNetCashFlow: 22_592,
    householdNetWorth: 621_800,
    rrifForcedMinimum: 14_805,
    rrifMinimumRate: 0.058,
    rrifConversionYear: false,
    isRetired: true,
    isRRIFConversionYear: false,
  },
];

// ---------------------------------------------------------------------------
// Couple summary — extends ProjectionSummary with primary/spouse breakouts.
// ---------------------------------------------------------------------------

const coupleFundedStatus: FundedStatus = {
  state: 'green',
  depletionAge: null,
  balanceAtLifeExpectancy: 621_800,
  totalRetirementWithdrawals: 85_390,
};

const coupleSummaryPrimary: ProjectionSummary = {
  startYear: 2026,
  endYear: 2027,
  retirementYear: 2026,
  yearsInRetirement: 2,
  peakNetWorth: 400_000,
  peakNetWorthYear: 2026,
  portfolioLongevityAge: null,
  totalTaxesPaid: 16_818,
  averageRetirementIncome: 59_100,
  averageEffectiveTaxRate: 0.1423,
  moneyLastsToLifeExpectancy: true,
  lowestNetWorth: 386_000,
  lowestNetWorthYear: 2027,
  fundedStatus: coupleFundedStatus,
  remediationPlan: null,
};

const coupleSummarySpouse: ProjectionSummary = {
  startYear: 2026,
  endYear: 2027,
  retirementYear: 2026,
  yearsInRetirement: 2,
  peakNetWorth: 245_000,
  peakNetWorthYear: 2026,
  portfolioLongevityAge: null,
  totalTaxesPaid: 6_435,
  averageRetirementIncome: 33_610,
  averageEffectiveTaxRate: 0.0968,
  moneyLastsToLifeExpectancy: true,
  lowestNetWorth: 235_800,
  lowestNetWorthYear: 2027,
  fundedStatus: coupleFundedStatus,
  remediationPlan: null,
};

const coupleSummary: CoupleProjectionSummary = {
  // ProjectionSummary base fields (household-rolled-up)
  startYear: 2026,
  endYear: 2027,
  retirementYear: 2026,
  yearsInRetirement: 2,
  peakNetWorth: 645_000,
  peakNetWorthYear: 2026,
  portfolioLongevityAge: null,
  totalTaxesPaid: 23_253,
  averageRetirementIncome: 92_710,
  averageEffectiveTaxRate: 0.1254,
  moneyLastsToLifeExpectancy: true,
  lowestNetWorth: 621_800,
  lowestNetWorthYear: 2027,
  fundedStatus: coupleFundedStatus,
  remediationPlan: null,
  grossEstate: 621_800,
  terminalTaxes: 75_000,
  netEstate: 546_800,
  // Couple-only fields
  primarySummary: coupleSummaryPrimary,
  spouseSummary: coupleSummarySpouse,
  primaryRetirementYear: 2026,
  spouseRetirementYear: 2026,
  bothRetiredYear: 2026,
  totalPensionSplitTaxSavings: 855,
  averagePensionSplitPercentage: 0.5,
  primaryLifeExpectancyYear: 2051,
  spouseLifeExpectancyYear: 2055,
  longestLivingSpouseEndYear: 2055,
};

const coupleTerminalEventPrimary: TerminalReturnResult = {
  year: 2051,
  triggeringOwner: 'primary',
  grossEstate: 386_000,
  deemedDispositionIncome: 235_000,
  realizedCapitalGain: 3_500,
  taxableCapitalGain: 1_750,
  terminalTaxes: 0,
  netEstate: 386_000,
  wasSpouseRolloverApplied: true,
};

const coupleTerminalEventSpouse: TerminalReturnResult = {
  year: 2055,
  triggeringOwner: 'spouse',
  grossEstate: 621_800,
  deemedDispositionIncome: 327_000,
  realizedCapitalGain: 4_500,
  taxableCapitalGain: 2_250,
  terminalTaxes: 75_000,
  netEstate: 546_800,
  wasSpouseRolloverApplied: false,
};

const coupleProjectionInput: ProjectionInput = {
  birthdate: new Date('1961-01-01T00:00:00.000Z'),
  province: 'ON',
  retirementAge: 65,
  lifeExpectancy: 90,
  maritalStatus: 'married',
  employmentIncome: 0,
  employmentGrowthRate: 0,
  rrspBalance: 0,
  rrspAnnualContribution: 0,
  rrifBalance: 250_000,
  tfsaBalance: 90_000,
  tfsaAnnualContribution: 0,
  nonRegBalance: 60_000,
  retirementSpending: 58_000,
  investmentReturn: 0.05,
  inflationRate: 0.02,
  expectedCPPAt65: 15_200,
  cppStartAge: 65,
  oasStartAge: 65,
  yearsOfResidence: 40,
  projectionStartYear: 2026,
  legacyTarget: 500_000,
  spouse: {
    birthdate: new Date('1963-06-15T00:00:00.000Z'),
    retirementAge: 65,
    lifeExpectancy: 92,
    employmentIncome: 0,
    expectedCPPAt65: 11_800,
    cppStartAge: 65,
    oasStartAge: 65,
    yearsOfResidence: 40,
    rrspBalance: 80_000,
    rrifBalance: 100_000,
    tfsaBalance: 40_000,
    nonRegBalance: 25_000,
  },
  coupleSettings: {
    optimizePensionSplitting: true,
    useYoungerSpouseForRRIF: false,
  },
};

// ---------------------------------------------------------------------------
// Top-level fixture exports
// ---------------------------------------------------------------------------

/**
 * Hand-authored CoupleProjectionOutputLike — the v4.6 Architecture-Principle-IV
 * mirror type from ../types.js. Two-year horizon, both spouses retired.
 */
export const coupleProjectionOutput: CoupleProjectionOutputLike = {
  id: 'projection-couple-fixture',
  input: coupleProjectionInput,
  yearlyResults: coupleYearlyResults,
  projectionRows: coupleProjectionRows,
  legacyTargetMet: true,
  summary: coupleSummary,
  terminalTaxEvents: [coupleTerminalEventPrimary, coupleTerminalEventSpouse],
  createdAt: new Date('2026-05-11T00:00:00.000Z'),
  updatedAt: new Date('2026-05-11T00:00:00.000Z'),
};

/**
 * Deterministic generatedAt timestamp for adapter tests.
 * Caller-supplied per RPT-03 — adapter never derives this from `Date.now()`.
 */
export const coupleGeneratedAt = new Date('2026-05-11T12:00:00.000Z');

/**
 * Display name used across couple-scenario assertions.
 */
export const coupleScenarioName = 'Ontario Couple — Joint Retirement with Pension Splitting';

/**
 * Display status used across couple-scenario assertions.
 */
export const coupleScenarioStatus = 'active';
