/**
 * Single-path yearly projection orchestrator (legacy / non-couple).
 *
 * Extracted from yearly-calculator.ts (Phase 9 plan 09-07 LOC cleanup).
 * The orchestrator threads per-year state through a sequence of pure helpers:
 * Step 1-3 (preamble + contributions) → Step 5 RRIF min → benefits passes 1+2 →
 * Step 6-7 (gap calc) → meltdown → bracket-fill → Step 8 (override + drawdown) →
 * TAX-04 OAS clawback trim → pass 3 OAS/GIS → tax → growth → surplus → return.
 *
 * @see docs/source-of-truth/08-projection-engine.md
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 */

import type { YearlyResult } from '@retireops/shared';

import { ageAtEndOfYear, getRRIFMinimumRate } from '@retireops/shared';
import {
  calculateTotalTax,
  type TaxCalculationInput,
  buildTaxYearParams,
} from '../../tax/index.js';
import { calculateRRIFMinimumWithdrawal, isRRIFMinimumRequired } from '../../accounts/rrif.js';
import { processTFSAContribution } from '../../accounts/tfsa.js';
import { mustConvertRRSPToRRIF } from '../../accounts/rrsp.js';
import { applyGrowth } from '../../accounts/index.js';
import { resolveDrawdownOrder, resolveStrategyId } from '../../withdrawals/strategy.js';
import { hasAnyOverride } from '../overrides.js';
import { hasAnyProvenance } from '../provenance.js';
import { runWithdrawalPipeline } from './withdrawal-pipeline.js';
import { resolveContribution, computeSpendingForYear } from './spending.js';
import { applyOASClawbackAvoidanceTrim } from './oas-clawback-trim.js';
import { applyBracketFill } from './bracket-fill.js';
import { recalcBenefitsPass3 } from './benefits-pass-three.js';
import { runBenefitsPasses12 } from './benefits-passes.js';
import { buildYearProvenance } from './provenance-builder.js';
import { applySurplusRouting } from './surplus-handling.js';
import type { YearInput } from './inputs.js';

/**
 * Calculate a single year's projection (legacy single-person path, no LIF).
 * Behavior identical to the pre-Phase-9 monolithic implementation; verified
 * via Phase 8 characterization snapshot SHA byte-identity.
 */
export function calculateYear(input: YearInput): YearlyResult {
  const ctx = initContext(input);
  applyPreWithdrawalSteps(ctx);
  applyWithdrawalSteps(ctx);
  applyPostWithdrawalSteps(ctx);
  return assembleYearResult(ctx);
}

// --- Internal context + step helpers (each < 60 LOC) -----------------------

interface YearCtx {
  input: YearInput;

  // Step 1
  age: number;
  isRetired: boolean;
  indexedOASClawbackThreshold: number;

  // Balances + ACB (mutate as we go)
  currentRRSP: number;
  currentRRIF: number;
  currentTFSA: number;
  currentNonReg: number;
  currentACB: number;

  // RRSP→RRIF conversion + RRIF minimum
  isRRIFConversionYear: boolean;
  rrifWithdrawal: number;
  rrifForcedMinimum: number;
  rrifMinimumRate: number;
  rrifOpeningBalance: number;

  // Contributions
  resolvedRrspContribution: number;

  // Benefits passes 1 + 2 (provisional)
  cppIncome: number;
  oasGross: number;
  oasIncome: number;
  oasClawback: number;
  gisIncome: number;

  // Spending + gap
  spendingAfterAgeBands: number;
  spendingOverrideMeta: ReturnType<typeof computeSpendingForYear>['overrideMeta'];
  incomeGap: number;

  // Withdrawals (Step 8)
  meltdownRRSPWithdrawal: number;
  bracketFillWithdrawal: number;
  rrspWithdrawal: number;
  additionalRRIFWithdrawal: number;
  tfsaWithdrawal: number;
  nonRegWithdrawal: number;
  nonRegRealizedGain: number;
  nonRegTaxableGain: number;
  effectiveStrategyId: string;

  // Override pass results
  overridesMetadata: ReturnType<typeof runWithdrawalPipeline>['overridesMetadata'];
  overrideAwareOrder: ReadonlyArray<string>;
  surplusFromOverrides: number;

  // Tax
  taxCalculation: ReturnType<typeof calculateTotalTax>;
}

function initContext(input: YearInput): YearCtx {
  const age = ageAtEndOfYear(input.birthdate, input.year);
  const indexingBaseYear = input.year - input.yearsFromProjectionStart;
  const taxYearParams = buildTaxYearParams(input.year, {
    inflationRate: input.inflationRate,
    baseYear: indexingBaseYear,
  });
  return {
    input,
    age,
    isRetired: age >= input.retirementAge,
    indexedOASClawbackThreshold: taxYearParams.oasClawbackThreshold,
    currentRRSP: input.rrspBalance,
    currentRRIF: input.rrifBalance,
    currentTFSA: input.tfsaBalance,
    currentNonReg: input.nonRegBalance,
    currentACB: input.nonRegACB,
    isRRIFConversionYear: false,
    rrifWithdrawal: 0,
    rrifForcedMinimum: 0,
    rrifMinimumRate: 0,
    rrifOpeningBalance: 0,
    resolvedRrspContribution: 0,
    cppIncome: 0,
    oasGross: 0,
    oasIncome: 0,
    oasClawback: 0,
    gisIncome: 0,
    spendingAfterAgeBands: 0,
    spendingOverrideMeta: undefined,
    incomeGap: 0,
    meltdownRRSPWithdrawal: 0,
    bracketFillWithdrawal: 0,
    rrspWithdrawal: 0,
    additionalRRIFWithdrawal: 0,
    tfsaWithdrawal: 0,
    nonRegWithdrawal: 0,
    nonRegRealizedGain: 0,
    nonRegTaxableGain: 0,
    effectiveStrategyId: '',
    overridesMetadata: {},
    overrideAwareOrder: [],
    surplusFromOverrides: 0,
    taxCalculation: undefined as unknown as ReturnType<typeof calculateTotalTax>,
  };
}

function applyPreWithdrawalSteps(c: YearCtx): void {
  applyRrspToRrifConversion(c);
  applyContributions(c);
  applyRrifMinimum(c);
  applyBenefitsPasses12(c);
  computeIncomeGap(c);
}

function applyRrspToRrifConversion(c: YearCtx): void {
  // Step 2: Handle RRSP to RRIF conversion (CRA Reg. 7308 — must convert by age 71).
  if (mustConvertRRSPToRRIF(c.age) && c.currentRRSP > 0) {
    c.currentRRIF += c.currentRRSP;
    c.currentRRSP = 0;
    c.isRRIFConversionYear = true;
  }
}

function applyContributions(c: YearCtx): void {
  // Step 3: Apply contributions (pre-retirement). SAV-01 honors contributionOverrides.
  c.resolvedRrspContribution = resolveContribution(
    'rrsp',
    c.input.rrspContribution,
    c.input.year,
    c.input.contributionOverrides
  );
  const resolvedTfsa = resolveContribution(
    'tfsa',
    c.input.tfsaContribution,
    c.input.year,
    c.input.contributionOverrides
  );

  if (!c.isRetired) c.currentRRSP += c.resolvedRrspContribution;

  const room = c.input.availableTfsaContributionRoom;
  const tfsaToApply =
    room !== undefined ? Math.min(resolvedTfsa, room) : c.isRetired ? 0 : resolvedTfsa;
  if (tfsaToApply > 0) {
    const result = processTFSAContribution(c.currentTFSA, tfsaToApply, room ?? tfsaToApply, c.age);
    c.currentTFSA = result.newBalance;
  }
}

function applyRrifMinimum(c: YearCtx): void {
  // Step 5: RMIN-02 capture opening balance BEFORE withdrawal. ISSUE-4: no minimum
  // in conversion year (CRA Reg. 7308 — FMV at Jan 1 is the basis).
  c.rrifOpeningBalance = c.currentRRIF;
  if (isRRIFMinimumRequired(c.age) && c.currentRRIF > 0 && !c.isRRIFConversionYear) {
    c.rrifWithdrawal = calculateRRIFMinimumWithdrawal(c.currentRRIF, c.age);
    c.currentRRIF -= c.rrifWithdrawal;
  }
  c.rrifForcedMinimum = c.rrifWithdrawal;
  c.rrifMinimumRate =
    isRRIFMinimumRequired(c.age) && c.rrifOpeningBalance > 0 && !c.isRRIFConversionYear
      ? getRRIFMinimumRate(c.age)
      : 0;
}

function applyBenefitsPasses12(c: YearCtx): void {
  // Steps 4 + 4b: government benefits passes 1 (CPP/OAS amounts) + 2 (preliminary
  // OAS clawback / GIS with mandatory minimums in netIncome).
  const result = runBenefitsPasses12({
    year: c.input.year,
    owner: 'primary',
    age: c.age,
    yearsOfResidence: c.input.yearsOfResidence,
    maritalStatus: 'single',
    expectedCPPAt65: c.input.expectedCPPAt65,
    cppStartAge: c.input.cppStartAge,
    oasStartAge: c.input.oasStartAge,
    isRetired: c.isRetired,
    employmentIncome: c.input.employmentIncome,
    yearsFromProjectionStart: c.input.yearsFromProjectionStart,
    inflationRate: c.input.inflationRate,
    oasClawbackThreshold: c.indexedOASClawbackThreshold,
    pensionIncome: c.input.pensionIncome,
    rrifWithdrawal: c.rrifWithdrawal,
    lifWithdrawal: 0, // legacy path has no LIF
    otherIncome: c.input.otherIncome,
  });
  c.cppIncome = result.cppIncome;
  c.oasGross = result.oasGross;
  c.oasIncome = result.oasIncome;
  c.oasClawback = Math.max(0, result.oasGross - result.oasIncome);
  c.gisIncome = result.gisIncome;
}

function computeIncomeGap(c: YearCtx): void {
  // Step 6 + 7: pre-withdrawal income, spending (D-20/D-21), incomeGap.
  const preWithdrawalIncome =
    (c.isRetired ? 0 : c.input.employmentIncome) +
    c.input.pensionIncome +
    c.cppIncome +
    c.oasIncome +
    c.gisIncome +
    c.rrifWithdrawal +
    c.input.otherIncome;
  const spending = computeSpendingForYear({
    year: c.input.year,
    yearsFromProjectionStart: c.input.yearsFromProjectionStart,
    age: c.age,
    retirementSpending: c.input.retirementSpending,
    inflationRate: c.input.inflationRate,
    ageBandReductions: c.input.ageBandReductions,
    spendingOverrides: c.input.spendingOverrides,
  });
  c.spendingAfterAgeBands = spending.spendingAfterAgeBands;
  c.spendingOverrideMeta = spending.overrideMeta;
  c.incomeGap = c.isRetired ? Math.max(0, c.spendingAfterAgeBands - preWithdrawalIncome) : 0;
}

function applyWithdrawalSteps(c: YearCtx): void {
  applyMeltdown(c);
  applyBracketFillStep(c);
  runOverrideAndDrawdownPipeline(c);
  applyOASClawbackTrim(c);
  applyPass3Benefits(c);
}

function applyMeltdown(c: YearCtx): void {
  // TAX-02 / RMLT-03: RRSP meltdown (Custom mode). FIX-06: only when retired.
  const m = c.input.rrspMeltdown;
  if (
    c.isRetired &&
    m?.enabled &&
    c.input.year >= m.startYear &&
    c.input.year <= m.endYear &&
    c.currentRRSP > 0
  ) {
    const maxMeltdown =
      m.targetAmount !== undefined ? Math.max(0, c.currentRRSP - m.targetAmount) : c.currentRRSP;
    c.meltdownRRSPWithdrawal = Math.min(m.annualAmount, maxMeltdown);
    c.currentRRSP -= c.meltdownRRSPWithdrawal;
  }
}

function applyBracketFillStep(c: YearCtx): void {
  // TAX-05 / BKF-02..07 + SWEEP-01..03.
  const balances = {
    currentRRSP: c.currentRRSP,
    currentTFSA: c.currentTFSA,
    currentNonReg: c.currentNonReg,
  };
  c.bracketFillWithdrawal = applyBracketFill(balances, {
    isRetired: c.isRetired,
    config: c.input.bracketFill,
    year: c.input.year,
    pensionIncome: c.input.pensionIncome,
    cppIncome: c.cppIncome,
    oasIncome: c.oasIncome,
    rrifWithdrawal: c.rrifWithdrawal,
    meltdownRRSPWithdrawal: c.meltdownRRSPWithdrawal,
    otherIncome: c.input.otherIncome,
    incomeGap: c.incomeGap,
    availableTfsaContributionRoom: c.input.availableTfsaContributionRoom,
  });
  c.currentRRSP = balances.currentRRSP;
  c.currentTFSA = balances.currentTFSA;
  c.currentNonReg = balances.currentNonReg;
}

function runOverrideAndDrawdownPipeline(c: YearCtx): void {
  // Step 8: TAX-01 drawdown order resolution + override pass + gap-fill loop.
  const effectiveOrder = resolveDrawdownOrder({
    drawdownOrder: c.input.drawdownOrder,
    strategyId: c.input.strategyId,
  });
  c.effectiveStrategyId = resolveStrategyId({
    drawdownOrder: c.input.drawdownOrder,
    strategyId: c.input.strategyId,
  });
  const state = {
    currentRRSP: c.currentRRSP,
    currentRRIF: c.currentRRIF,
    currentTFSA: c.currentTFSA,
    currentNonReg: c.currentNonReg,
    currentACB: c.currentACB,
    currentLIF: 0, // legacy path has no LIF
    rrspWithdrawal: 0,
    additionalRRIFWithdrawal: 0,
    tfsaWithdrawal: 0,
    nonRegWithdrawal: 0,
    nonRegRealizedGain: 0,
    nonRegTaxableGain: 0,
    annualCapGainsAccumulator: 0,
  };
  const result = runWithdrawalPipeline(state, {
    year: c.input.year,
    age: c.age,
    yearsFromProjectionStart: c.input.yearsFromProjectionStart,
    inflationRate: c.input.inflationRate,
    incomeGap: c.incomeGap,
    withdrawalOverrides: c.input.withdrawalOverrides,
    overrideWarningsAccumulator: c.input.overrideWarningsAccumulator,
    effectiveOrder,
    rrifMandatoryMinimum: c.rrifForcedMinimum,
    lifMaximumAllowed: 0,
  });
  absorbPipelineResult(c, state, result);
}

function absorbPipelineResult(
  c: YearCtx,
  state: PipelineState,
  result: ReturnType<typeof runWithdrawalPipeline>
): void {
  c.currentRRSP = state.currentRRSP;
  c.currentRRIF = state.currentRRIF;
  c.currentTFSA = state.currentTFSA;
  c.currentNonReg = state.currentNonReg;
  c.currentACB = state.currentACB;
  c.rrspWithdrawal = state.rrspWithdrawal;
  c.additionalRRIFWithdrawal = state.additionalRRIFWithdrawal;
  c.tfsaWithdrawal = state.tfsaWithdrawal;
  c.nonRegWithdrawal = state.nonRegWithdrawal;
  c.nonRegRealizedGain = state.nonRegRealizedGain;
  c.nonRegTaxableGain = state.nonRegTaxableGain;
  c.overridesMetadata = result.overridesMetadata;
  c.overrideAwareOrder = result.overrideAwareOrder;
  c.surplusFromOverrides = result.surplusFromOverrides;
  // D-22: merge spending override metadata into sidecar when active (D-20).
  if (c.spendingOverrideMeta) {
    c.overridesMetadata.livingExpenses = c.spendingOverrideMeta;
  }
}

type PipelineState = {
  currentRRSP: number;
  currentRRIF: number;
  currentTFSA: number;
  currentNonReg: number;
  currentACB: number;
  currentLIF: number;
  rrspWithdrawal: number;
  additionalRRIFWithdrawal: number;
  tfsaWithdrawal: number;
  nonRegWithdrawal: number;
  nonRegRealizedGain: number;
  nonRegTaxableGain: number;
  annualCapGainsAccumulator: number;
};

function applyOASClawbackTrim(c: YearCtx): void {
  // TAX-04: trim discretionary withdrawals if taxable income exceeds threshold.
  const cfg = c.input.oasClawbackAvoidance;
  if (!cfg?.enabled) return;
  const trim = {
    rrspWithdrawal: c.rrspWithdrawal,
    currentRRSP: c.currentRRSP,
    additionalRRIFWithdrawal: c.additionalRRIFWithdrawal,
    currentRRIF: c.currentRRIF,
    nonRegWithdrawal: c.nonRegWithdrawal,
    currentNonReg: c.currentNonReg,
    nonRegRealizedGain: c.nonRegRealizedGain,
    nonRegTaxableGain: c.nonRegTaxableGain,
  };
  applyOASClawbackAvoidanceTrim(trim, {
    isRetired: c.isRetired,
    employmentIncome: c.input.employmentIncome,
    pensionIncome: c.input.pensionIncome,
    cppIncome: c.cppIncome,
    oasIncome: c.oasIncome,
    rrifWithdrawal: c.rrifWithdrawal,
    meltdownRRSPWithdrawal: c.meltdownRRSPWithdrawal,
    incomeThreshold: cfg.incomeThreshold,
    drawdownOrder: c.overrideAwareOrder,
  });
  c.rrspWithdrawal = trim.rrspWithdrawal;
  c.currentRRSP = trim.currentRRSP;
  c.additionalRRIFWithdrawal = trim.additionalRRIFWithdrawal;
  c.currentRRIF = trim.currentRRIF;
  c.nonRegWithdrawal = trim.nonRegWithdrawal;
  c.currentNonReg = trim.currentNonReg;
  c.nonRegRealizedGain = trim.nonRegRealizedGain;
  c.nonRegTaxableGain = trim.nonRegTaxableGain;
}

function applyPass3Benefits(c: YearCtx): void {
  // Step 4c / ISSUE-82: re-run OAS clawback + GIS with full net income.
  const result = recalcBenefitsPass3(
    {
      year: c.input.year,
      owner: 'primary',
      age: c.age,
      oasStartAge: c.input.oasStartAge,
      yearsOfResidence: c.input.yearsOfResidence,
      maritalStatus: 'single',
      expectedCPPAt65: c.input.expectedCPPAt65,
      cppStartAge: c.input.cppStartAge,
      yearsFromProjectionStart: c.input.yearsFromProjectionStart,
      inflationRate: c.input.inflationRate,
      oasClawbackThreshold: c.indexedOASClawbackThreshold,
      isRetired: c.isRetired,
      employmentIncome: c.input.employmentIncome,
      pensionIncome: c.input.pensionIncome,
      cppIncome: c.cppIncome,
      oasGross: c.oasGross,
      rrifWithdrawal: c.rrifWithdrawal,
      additionalRRIFWithdrawal: c.additionalRRIFWithdrawal,
      rrspWithdrawal: c.rrspWithdrawal,
      meltdownRRSPWithdrawal: c.meltdownRRSPWithdrawal,
      bracketFillWithdrawal: c.bracketFillWithdrawal,
      nonRegTaxableGain: c.nonRegTaxableGain,
      otherIncome: c.input.otherIncome,
      totalLIFWithdrawal: 0,
    },
    c.oasIncome,
    c.gisIncome
  );
  c.oasGross = result.oasGrossIncome;
  c.oasIncome = result.oasIncome;
  c.oasClawback = result.oasClawback;
  c.gisIncome = result.gisIncome;
}

function applyPostWithdrawalSteps(c: YearCtx): void {
  applyTaxStep(c);
  applyGrowthStep(c);
}

function applyTaxStep(c: YearCtx): void {
  // Step 9: tax calculation (NREG-002, TC-ACCT-005). 50% inclusion applied internally.
  const totalRRIFWithdrawal = c.rrifWithdrawal + c.additionalRRIFWithdrawal;
  const taxInput: TaxCalculationInput = {
    year: c.input.year,
    owner: 'primary',
    province: c.input.province,
    age: c.age,
    employmentIncome: c.isRetired ? 0 : c.input.employmentIncome,
    pensionIncome: c.input.pensionIncome,
    rrifIncome:
      totalRRIFWithdrawal + c.rrspWithdrawal + c.meltdownRRSPWithdrawal + c.bracketFillWithdrawal,
    cppIncome: c.cppIncome,
    oasIncome: c.oasIncome,
    otherIncome: c.input.otherIncome,
    interestIncome: c.input.nonRegInterestIncome ?? 0,
    eligibleDividends: c.input.nonRegEligibleDividends ?? 0,
    nonEligibleDividends: c.input.nonRegNonEligibleDividends ?? 0,
    capitalGains: c.nonRegRealizedGain + (c.input.nonRegRealizedCapitalGains ?? 0),
    rrspContribution: c.isRetired ? 0 : c.resolvedRrspContribution,
    otherDeductions: 0,
    inflationRate: c.input.inflationRate,
    indexingBaseYear: c.input.year - c.input.yearsFromProjectionStart,
  };
  c.taxCalculation = calculateTotalTax(taxInput);
}

function applyGrowthStep(c: YearCtx): void {
  // Step 10: apply investment growth to remaining balances.
  c.currentRRSP = applyGrowth(c.currentRRSP, c.input.investmentReturn);
  c.currentRRIF = applyGrowth(c.currentRRIF, c.input.investmentReturn);
  c.currentTFSA = applyGrowth(c.currentTFSA, c.input.investmentReturn);
  c.currentNonReg = applyGrowth(c.currentNonReg, c.input.investmentReturn);
}

function assembleYearResult(c: YearCtx): YearlyResult {
  // Step 11 + return assembly: total income, surplus routing, provenance, return shape.
  const totalRRIFWithdrawal = c.rrifWithdrawal + c.additionalRRIFWithdrawal;
  const totalIncome = computeTotalIncomeLegacy(c, totalRRIFWithdrawal);
  const livingExpenses = c.isRetired ? c.spendingAfterAgeBands : 0;
  const netCashFlow = applyLegacySurplusRouting(c, totalIncome, livingExpenses);
  const totalNetWorth = c.currentRRSP + c.currentRRIF + c.currentTFSA + c.currentNonReg;
  const totalRRIFForProvenance =
    totalRRIFWithdrawal + c.rrspWithdrawal + c.meltdownRRSPWithdrawal + c.bracketFillWithdrawal;
  const provenance = buildLegacyProvenance(c, totalIncome, totalRRIFForProvenance, livingExpenses);
  return buildLegacyResult({
    c,
    totalIncome,
    livingExpenses,
    netCashFlow,
    totalNetWorth,
    totalRRIFForProvenance,
    provenance,
  });
}

function computeTotalIncomeLegacy(c: YearCtx, totalRRIFWithdrawal: number): number {
  const annualNonRegIncome =
    (c.input.nonRegInterestIncome ?? 0) +
    (c.input.nonRegEligibleDividends ?? 0) +
    (c.input.nonRegNonEligibleDividends ?? 0) +
    (c.input.nonRegRealizedCapitalGains ?? 0);

  return (
    (c.isRetired ? 0 : c.input.employmentIncome) +
    c.input.pensionIncome +
    c.cppIncome +
    c.oasIncome +
    c.gisIncome +
    totalRRIFWithdrawal +
    c.rrspWithdrawal +
    c.meltdownRRSPWithdrawal +
    c.bracketFillWithdrawal +
    c.tfsaWithdrawal +
    c.nonRegWithdrawal +
    annualNonRegIncome +
    c.input.otherIncome
  );
}

function applyLegacySurplusRouting(
  c: YearCtx,
  totalIncome: number,
  livingExpenses: number
): number {
  // ENG-01 surplus routing. Legacy path has no LIF (presence.lif = false).
  const balances = {
    currentRRSP: c.currentRRSP,
    currentRRIF: c.currentRRIF,
    currentTFSA: c.currentTFSA,
    currentNonReg: c.currentNonReg,
    currentLIF: 0,
  };
  const netCashFlow = applySurplusRouting(balances, {
    surplusDestination: c.input.surplusDestination,
    totalIncome,
    totalTax: c.taxCalculation.totalTax,
    livingExpenses,
    surplusFromOverrides: c.surplusFromOverrides,
    year: c.input.year,
    warningsAccumulator: c.input.overrideWarningsAccumulator,
    presence: {
      rrsp: c.input.rrspBalance > 0 || c.currentRRSP > 0,
      rrif: c.input.rrifBalance > 0 || c.currentRRIF > 0,
      tfsa: c.input.tfsaBalance > 0 || c.currentTFSA > 0,
      nonReg: c.input.nonRegBalance > 0 || c.currentNonReg > 0,
      lif: false,
    },
  });
  c.currentRRSP = balances.currentRRSP;
  c.currentRRIF = balances.currentRRIF;
  c.currentTFSA = balances.currentTFSA;
  c.currentNonReg = balances.currentNonReg;
  return netCashFlow;
}

function buildLegacyProvenance(
  c: YearCtx,
  totalIncome: number,
  totalRRIFForProvenance: number,
  livingExpenses: number
): ReturnType<typeof buildYearProvenance> {
  return buildYearProvenance({
    year: c.input.year,
    age: c.age,
    province: c.input.province,
    isRetired: c.isRetired,
    includeLIF: false,
    includeLIFInTotalIncome: false,
    effectiveStrategyId: c.effectiveStrategyId,
    overridesMetadata: c.overridesMetadata,
    rrspWithdrawal: c.rrspWithdrawal,
    totalRRIFForProvenance,
    tfsaWithdrawal: c.tfsaWithdrawal,
    nonRegWithdrawal: c.nonRegWithdrawal,
    totalLIFWithdrawal: 0,
    livingExpenses,
    retirementSpending: c.input.retirementSpending,
    rrifForcedMinimum: c.rrifForcedMinimum,
    rrifOpeningBalance: c.rrifOpeningBalance,
    rrifMinimumRate: c.rrifMinimumRate,
    totalIncome,
    employmentIncome: c.input.employmentIncome,
    pensionIncome: c.input.pensionIncome,
    cppIncome: c.cppIncome,
    oasIncome: c.oasIncome,
    gisIncome: c.gisIncome,
    taxableIncome: c.taxCalculation.taxableIncome,
    federalTaxNet: c.taxCalculation.federalTaxNet,
    provincialTaxNet: c.taxCalculation.provincialTaxNet,
    totalTax: c.taxCalculation.totalTax,
  });
}

interface ResultArgs {
  c: YearCtx;
  totalIncome: number;
  livingExpenses: number;
  netCashFlow: number;
  totalNetWorth: number;
  totalRRIFForProvenance: number;
  provenance: ReturnType<typeof buildYearProvenance>;
}

function buildLegacyResult(args: ResultArgs): YearlyResult {
  const { c, totalIncome, livingExpenses, netCashFlow, totalNetWorth } = args;
  return {
    year: c.input.year,
    age: c.age,
    employmentIncome: c.isRetired ? 0 : c.input.employmentIncome,
    pensionIncome: c.input.pensionIncome,
    cppIncome: c.cppIncome,
    oasGrossIncome: c.oasGross,
    oasNetIncome: c.oasIncome,
    oasIncome: c.oasIncome,
    oasClawback: c.oasClawback,
    gisIncome: c.gisIncome,
    rrifWithdrawal: args.totalRRIFForProvenance,
    tfsaWithdrawal: c.tfsaWithdrawal,
    nonRegWithdrawal: c.nonRegWithdrawal,
    bracketFillWithdrawal: c.bracketFillWithdrawal,
    totalIncome,
    livingExpenses,
    taxesPaid: c.taxCalculation.totalTax,
    netCashFlow,
    rrspBalance: c.currentRRSP,
    rrifBalance: c.currentRRIF,
    tfsaBalance: c.currentTFSA,
    nonRegBalance: c.currentNonReg,
    totalNetWorth,
    taxCalculation: c.taxCalculation,
    isRetired: c.isRetired,
    isRRIFConversionYear: c.isRRIFConversionYear,
    rrifForcedMinimum: c.rrifForcedMinimum,
    rrifMinimumRate: c.rrifMinimumRate,
    rrifConversionYear: c.isRRIFConversionYear,
    ...(hasAnyOverride(c.overridesMetadata) && { overrides: c.overridesMetadata }),
    ...(hasAnyProvenance(args.provenance) && { provenance: args.provenance }),
  };
}
