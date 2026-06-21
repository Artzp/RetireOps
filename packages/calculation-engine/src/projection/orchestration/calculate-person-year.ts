/**
 * Couple-path yearly projection orchestrator (spouse-aware).
 *
 * Extracted from yearly-calculator.ts (Phase 9 plan 09-07 LOC cleanup).
 * Mirrors calculate-year.ts but adds: LIRA→LIF conversion (Step 2b),
 * younger-spouse RRIF minimum (RYSP-01/02), LIF minimum + jurisdictional max
 * (Step 5b), spouseReceivingOAS in benefits passes, D-10 per-person
 * capital-gains accumulator, and the post-loop additional-LIF block.
 *
 * @see docs/source-of-truth/08-projection-engine.md
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 */

import type { LIFJurisdiction, PersonYearlyResult } from '@retireops/shared';

import { ageAtEndOfYear, getRRIFMinimumRate } from '@retireops/shared';
import {
  calculateTotalTax,
  type TaxCalculationInput,
  buildTaxYearParams,
} from '../../tax/index.js';
import {
  calculateRRIFMinimumWithdrawal,
  calculateRRIFMinimumWithYoungerSpouse,
  isRRIFMinimumRequired,
} from '../../accounts/rrif.js';
import { processTFSAContribution } from '../../accounts/tfsa.js';
import { mustConvertRRSPToRRIF } from '../../accounts/rrsp.js';
import { applyGrowth } from '../../accounts/index.js';
import { mustConvertLIRAToLIF, convertLIRAToLIF } from '../../accounts/lira.js';
import {
  calculateLIFMinimumWithdrawal,
  calculateLIFMinimumWithYoungerSpouse,
  getLIFWithdrawalLimits,
  isLIFMinimumRequired,
} from '../../accounts/lif.js';
import { resolveDrawdownOrder, resolveStrategyId } from '../../withdrawals/strategy.js';
import { getWithdrawalStrategy } from '../strategies/index.js';
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
import type { PersonYearInput } from './inputs.js';

/**
 * Calculate a single person's yearly projection (spouse-aware, with LIF + LIRA).
 * Behavior identical to the pre-Phase-9 monolithic implementation; verified
 * via Phase 8 characterization snapshot SHA byte-identity.
 */
export function calculatePersonYear(input: PersonYearInput): PersonYearlyResult {
  const ctx = initContext(input);
  applyPreWithdrawalSteps(ctx);
  applyWithdrawalSteps(ctx);
  applyPostWithdrawalSteps(ctx);
  return assemblePersonResult(ctx);
}

// --- Internal context + step helpers ---------------------------------------

interface PersonCtx {
  input: PersonYearInput;
  // Defaults applied after destructuring
  liraBalance: number;
  lifBalance: number;
  lifJurisdiction: LIFJurisdiction;
  spouseReceivingOAS: boolean;
  useYoungerSpouseForRRIF: boolean;
  useYoungerSpouseForLIF: boolean;
  householdSpendingCredit: number;

  // Step 1
  age: number;
  isRetired: boolean;
  indexedOASClawbackThreshold: number;

  // Balances
  currentRRSP: number;
  currentRRIF: number;
  currentLIRA: number;
  currentLIF: number;
  currentTFSA: number;
  currentNonReg: number;
  currentACB: number;

  // Conversions
  isRRIFConversionYear: boolean;
  isLIFConversionYear: boolean;

  // Step 5 / 5b
  rrifWithdrawal: number;
  rrifForcedMinimum: number;
  rrifMinimumRate: number;
  rrifOpeningBalance: number;
  lifWithdrawal: number;
  lifMaximumAllowed: number;

  // Contributions
  resolvedRrspContribution: number;

  // Benefits
  cppIncome: number;
  oasGross: number;
  oasIncome: number;
  oasClawback: number;
  gisIncome: number;

  // Spending + gap
  spendingAfterAgeBands: number;
  spendingOverrideMeta: ReturnType<typeof computeSpendingForYear>['overrideMeta'];
  incomeGap: number;

  // Step 8 withdrawals
  meltdownRRSPWithdrawal: number;
  bracketFillWithdrawal: number;
  // Bracket-fill surplus sweep, deferred to post-growth (D-18, audit B-09).
  sweepTfsaDeposit: number;
  sweepNonRegDeposit: number;
  rrspWithdrawal: number;
  additionalRRIFWithdrawal: number;
  additionalLIFWithdrawal: number;
  additionalLIFWithdrawalFromOverride: number;
  tfsaWithdrawal: number;
  nonRegWithdrawal: number;
  nonRegRealizedGain: number;
  nonRegTaxableGain: number;
  effectiveStrategyId: string;

  overridesMetadata: ReturnType<typeof runWithdrawalPipeline>['overridesMetadata'];
  tiersToSkip: ReturnType<typeof runWithdrawalPipeline>['tiersToSkip'];
  overrideAwareOrder: ReadonlyArray<string>;
  surplusFromOverrides: number;
  remainingGap: number;

  taxCalculation: ReturnType<typeof calculateTotalTax>;
}

function initContext(input: PersonYearInput): PersonCtx {
  const age = ageAtEndOfYear(input.birthdate, input.year);
  const indexingBaseYear = input.year - input.yearsFromProjectionStart;
  const taxYearParams = buildTaxYearParams(input.year, {
    inflationRate: input.inflationRate,
    baseYear: indexingBaseYear,
  });
  return {
    input,
    liraBalance: input.liraBalance ?? 0,
    lifBalance: input.lifBalance ?? 0,
    lifJurisdiction: input.lifJurisdiction ?? 'federal',
    spouseReceivingOAS: input.spouseReceivingOAS ?? false,
    useYoungerSpouseForRRIF: input.useYoungerSpouseForRRIF ?? false,
    useYoungerSpouseForLIF: input.useYoungerSpouseForLIF ?? false,
    householdSpendingCredit: input.householdSpendingCredit ?? 0,
    age,
    isRetired: age >= input.retirementAge,
    indexedOASClawbackThreshold: taxYearParams.oasClawbackThreshold,
    currentRRSP: input.rrspBalance,
    currentRRIF: input.rrifBalance,
    currentLIRA: input.liraBalance ?? 0,
    currentLIF: input.lifBalance ?? 0,
    currentTFSA: input.tfsaBalance,
    currentNonReg: input.nonRegBalance,
    currentACB: input.nonRegACB,
    isRRIFConversionYear: false,
    isLIFConversionYear: false,
    rrifWithdrawal: 0,
    rrifForcedMinimum: 0,
    rrifMinimumRate: 0,
    rrifOpeningBalance: 0,
    lifWithdrawal: 0,
    lifMaximumAllowed: 0,
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
    sweepTfsaDeposit: 0,
    sweepNonRegDeposit: 0,
    rrspWithdrawal: 0,
    additionalRRIFWithdrawal: 0,
    additionalLIFWithdrawal: 0,
    additionalLIFWithdrawalFromOverride: 0,
    tfsaWithdrawal: 0,
    nonRegWithdrawal: 0,
    nonRegRealizedGain: 0,
    nonRegTaxableGain: 0,
    effectiveStrategyId: '',
    overridesMetadata: {},
    tiersToSkip: new Set<string>(),
    overrideAwareOrder: [],
    surplusFromOverrides: 0,
    remainingGap: 0,
    taxCalculation: undefined as unknown as ReturnType<typeof calculateTotalTax>,
  };
}

function applyPreWithdrawalSteps(c: PersonCtx): void {
  applyRrspToRrifConversion(c);
  applyLiraToLifConversion(c);
  applyContributions(c);
  applyRrifMinimum(c);
  applyLifMinimum(c);
  applyBenefitsPasses12(c);
  computeIncomeGap(c);
}

function applyRrspToRrifConversion(c: PersonCtx): void {
  if (mustConvertRRSPToRRIF(c.age) && c.currentRRSP > 0) {
    c.currentRRIF += c.currentRRSP;
    c.currentRRSP = 0;
    c.isRRIFConversionYear = true;
  }
}

function applyLiraToLifConversion(c: PersonCtx): void {
  // Step 2b: mandatory LIRA→LIF conversion at age 71.
  if (mustConvertLIRAToLIF(c.age) && c.currentLIRA > 0) {
    const conversion = convertLIRAToLIF(c.currentLIRA, c.input.year, c.lifJurisdiction);
    c.currentLIF += conversion.lifBalance;
    c.currentLIRA = 0;
    c.isLIFConversionYear = true;
  }
}

function applyContributions(c: PersonCtx): void {
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

function applyRrifMinimum(c: PersonCtx): void {
  c.rrifOpeningBalance = c.currentRRIF;
  if (isRRIFMinimumRequired(c.age) && c.currentRRIF > 0 && !c.isRRIFConversionYear) {
    if (c.useYoungerSpouseForRRIF && c.input.spouseAge !== undefined) {
      c.rrifWithdrawal = calculateRRIFMinimumWithYoungerSpouse(
        c.currentRRIF,
        c.age,
        c.input.spouseAge
      );
    } else {
      c.rrifWithdrawal = calculateRRIFMinimumWithdrawal(c.currentRRIF, c.age);
    }
    c.currentRRIF -= c.rrifWithdrawal;
  }
  c.rrifForcedMinimum = c.rrifWithdrawal;
  // RYSP-01/RYSP-02: use min(ownerAge, spouseAge) when younger-spouse is elected.
  const effectiveAgeForRRIF =
    c.useYoungerSpouseForRRIF && c.input.spouseAge !== undefined
      ? Math.min(c.age, c.input.spouseAge)
      : c.age;
  c.rrifMinimumRate =
    isRRIFMinimumRequired(c.age) && c.rrifOpeningBalance > 0 && !c.isRRIFConversionYear
      ? getRRIFMinimumRate(effectiveAgeForRRIF)
      : 0;
}

function applyLifMinimum(c: PersonCtx): void {
  // Step 5b: LIF minimum + jurisdictional max.
  if (isLIFMinimumRequired(c.age) && c.currentLIF > 0) {
    if (c.useYoungerSpouseForLIF && c.input.spouseAge !== undefined) {
      c.lifWithdrawal = calculateLIFMinimumWithYoungerSpouse(
        c.currentLIF,
        c.age,
        c.input.spouseAge
      );
    } else {
      c.lifWithdrawal = calculateLIFMinimumWithdrawal(c.currentLIF, c.age);
    }
    const limits = getLIFWithdrawalLimits(
      c.currentLIF,
      c.age,
      c.lifJurisdiction,
      c.useYoungerSpouseForLIF,
      c.input.spouseAge,
      c.input.lifPriorYearReturnRate
    );
    c.lifMaximumAllowed = limits.maximum;
    c.currentLIF -= c.lifWithdrawal;
  } else if (c.currentLIF > 0) {
    // Before age 72, can still withdraw up to the maximum.
    const limits = getLIFWithdrawalLimits(
      c.currentLIF,
      c.age,
      c.lifJurisdiction,
      false,
      undefined,
      c.input.lifPriorYearReturnRate
    );
    c.lifMaximumAllowed = limits.maximum;
  }
}

function applyBenefitsPasses12(c: PersonCtx): void {
  const result = runBenefitsPasses12({
    year: c.input.year,
    owner: c.input.owner,
    age: c.age,
    yearsOfResidence: c.input.yearsOfResidence,
    maritalStatus: c.input.maritalStatus,
    expectedCPPAt65: c.input.expectedCPPAt65,
    cppStartAge: c.input.cppStartAge,
    oasStartAge: c.input.oasStartAge,
    isRetired: c.isRetired,
    employmentIncome: c.input.employmentIncome,
    yearsFromProjectionStart: c.input.yearsFromProjectionStart,
    inflationRate: c.input.inflationRate,
    oasClawbackThreshold: c.indexedOASClawbackThreshold,
    spouseReceivingOAS: c.spouseReceivingOAS,
    pensionIncome: c.input.pensionIncome,
    rrifWithdrawal: c.rrifWithdrawal,
    lifWithdrawal: c.lifWithdrawal,
    otherIncome: c.input.otherIncome,
  });
  c.cppIncome = result.cppIncome;
  c.oasGross = result.oasGross;
  c.oasIncome = result.oasIncome;
  c.oasClawback = Math.max(0, result.oasGross - result.oasIncome);
  c.gisIncome = result.gisIncome;
}

function computeIncomeGap(c: PersonCtx): void {
  const preWithdrawalIncome =
    (c.isRetired ? 0 : c.input.employmentIncome) +
    c.input.pensionIncome +
    c.cppIncome +
    c.oasIncome +
    c.gisIncome +
    c.rrifWithdrawal +
    c.lifWithdrawal +
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
  c.incomeGap = c.isRetired
    ? Math.max(0, c.spendingAfterAgeBands - preWithdrawalIncome - c.householdSpendingCredit)
    : 0;
}

function applyWithdrawalSteps(c: PersonCtx): void {
  applyMeltdown(c);
  applyBracketFillStep(c);
  runOverrideAndDrawdownPipeline(c);
  applyPostLoopAdditionalLIF(c);
  applyOASClawbackTrim(c);
  applyPass3Benefits(c);
}

function applyMeltdown(c: PersonCtx): void {
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

function applyBracketFillStep(c: PersonCtx): void {
  const balances = {
    currentRRSP: c.currentRRSP,
    currentTFSA: c.currentTFSA,
    currentNonReg: c.currentNonReg,
  };
  const fill = applyBracketFill(balances, {
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
  c.bracketFillWithdrawal = fill.bracketFillWithdrawal;
  // Defer the surplus sweep deposits to post-growth (D-18, audit B-09).
  c.sweepTfsaDeposit = fill.sweepTfsaDeposit;
  c.sweepNonRegDeposit = fill.sweepNonRegDeposit;
  c.currentRRSP = balances.currentRRSP;
  // Sweep deposits land in applyBracketFillSweep (post-growth), not here.
  c.currentTFSA = balances.currentTFSA;
  c.currentNonReg = balances.currentNonReg;
}

function runOverrideAndDrawdownPipeline(c: PersonCtx): void {
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
    currentLIF: c.currentLIF,
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
    lifMaximumAllowed: c.lifMaximumAllowed,
  });
  absorbPipelineResultPerson(c, state, result);
}

function absorbPipelineResultPerson(
  c: PersonCtx,
  state: {
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
  },
  result: ReturnType<typeof runWithdrawalPipeline>
): void {
  c.currentRRSP = state.currentRRSP;
  c.currentRRIF = state.currentRRIF;
  c.currentTFSA = state.currentTFSA;
  c.currentNonReg = state.currentNonReg;
  c.currentACB = state.currentACB;
  c.currentLIF = state.currentLIF;
  c.rrspWithdrawal = state.rrspWithdrawal;
  c.additionalRRIFWithdrawal = state.additionalRRIFWithdrawal;
  c.tfsaWithdrawal = state.tfsaWithdrawal;
  c.nonRegWithdrawal = state.nonRegWithdrawal;
  c.nonRegRealizedGain = state.nonRegRealizedGain;
  c.nonRegTaxableGain = state.nonRegTaxableGain;
  c.overridesMetadata = result.overridesMetadata;
  c.tiersToSkip = result.tiersToSkip;
  c.overrideAwareOrder = result.overrideAwareOrder;
  c.surplusFromOverrides = result.surplusFromOverrides;
  c.additionalLIFWithdrawalFromOverride = result.additionalLIFWithdrawalFromOverride;
  c.additionalLIFWithdrawal = c.additionalLIFWithdrawalFromOverride;
  c.remainingGap = result.remainingGap;
  // D-22: merge spending override metadata into sidecar when active (D-20).
  if (c.spendingOverrideMeta) {
    c.overridesMetadata.livingExpenses = c.spendingOverrideMeta;
  }
}

function applyPostLoopAdditionalLIF(c: PersonCtx): void {
  // Additional LIF withdrawal after gap-fill loop. Strategy clamps to
  // min(currentLIF, remainingCap) where remainingCap accounts for both the
  // already-taken minimum and any override-driven take.
  if (!(c.remainingGap > 0 && c.currentLIF > 0 && !c.tiersToSkip.has('lif'))) return;
  const remainingCap = Math.max(
    0,
    c.lifMaximumAllowed - c.lifWithdrawal - c.additionalLIFWithdrawalFromOverride
  );
  const lifResult = getWithdrawalStrategy('lif')(
    { requestedAmount: c.remainingGap, year: c.input.year, age: c.age },
    { balance: c.currentLIF, lifMaximumAllowed: remainingCap }
  );
  if (lifResult.actualWithdrawn > 0) {
    c.additionalLIFWithdrawal += lifResult.actualWithdrawn;
    c.currentLIF = lifResult.newBalance;
    c.remainingGap -= lifResult.actualWithdrawn;
  }
}

function applyOASClawbackTrim(c: PersonCtx): void {
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
    // Bracket-fill ran before this trim and folds into taxable rrifIncome at
    // applyTaxStep; otherIncome is a tax-input field too. Match the tax input.
    bracketFillWithdrawal: c.bracketFillWithdrawal,
    otherIncome: c.input.otherIncome,
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

function applyPass3Benefits(c: PersonCtx): void {
  const totalLIFWithdrawal = c.lifWithdrawal + c.additionalLIFWithdrawal;
  const result = recalcBenefitsPass3(
    {
      year: c.input.year,
      owner: c.input.owner,
      age: c.age,
      oasStartAge: c.input.oasStartAge,
      yearsOfResidence: c.input.yearsOfResidence,
      maritalStatus: c.input.maritalStatus,
      expectedCPPAt65: c.input.expectedCPPAt65,
      cppStartAge: c.input.cppStartAge,
      yearsFromProjectionStart: c.input.yearsFromProjectionStart,
      inflationRate: c.input.inflationRate,
      oasClawbackThreshold: c.indexedOASClawbackThreshold,
      spouseReceivingOAS: c.spouseReceivingOAS,
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
      totalLIFWithdrawal,
    },
    c.oasIncome,
    c.gisIncome
  );
  c.oasGross = result.oasGrossIncome;
  c.oasIncome = result.oasIncome;
  c.oasClawback = result.oasClawback;
  c.gisIncome = result.gisIncome;
}

function applyPostWithdrawalSteps(c: PersonCtx): void {
  applyTaxStep(c);
  applyGrowthStep(c);
  applyBracketFillSweep(c);
}

function applyBracketFillSweep(c: PersonCtx): void {
  // D-18 (audit B-09): bracket-fill surplus sweep deposits AFTER growth so the
  // swept amount earns no same-year growth — matching allocate_surplus routing.
  c.currentTFSA += c.sweepTfsaDeposit;
  c.currentNonReg += c.sweepNonRegDeposit;
}

function applyTaxStep(c: PersonCtx): void {
  const totalRRIFWithdrawal = c.rrifWithdrawal + c.additionalRRIFWithdrawal;
  const totalLIFWithdrawal = c.lifWithdrawal + c.additionalLIFWithdrawal;
  const taxInput: TaxCalculationInput = {
    year: c.input.year,
    owner: c.input.owner,
    province: c.input.province,
    age: c.age,
    employmentIncome: c.isRetired ? 0 : c.input.employmentIncome,
    pensionIncome: c.input.pensionIncome,
    rrifIncome:
      totalRRIFWithdrawal +
      totalLIFWithdrawal +
      c.rrspWithdrawal +
      c.meltdownRRSPWithdrawal +
      c.bracketFillWithdrawal,
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

function applyGrowthStep(c: PersonCtx): void {
  c.currentRRSP = applyGrowth(c.currentRRSP, c.input.investmentReturn);
  c.currentRRIF = applyGrowth(c.currentRRIF, c.input.investmentReturn);
  c.currentTFSA = applyGrowth(c.currentTFSA, c.input.investmentReturn);
  c.currentNonReg = applyGrowth(c.currentNonReg, c.input.investmentReturn);
  c.currentLIRA = applyGrowth(c.currentLIRA, c.input.investmentReturn);
  c.currentLIF = applyGrowth(c.currentLIF, c.input.investmentReturn);
}

function assemblePersonResult(c: PersonCtx): PersonYearlyResult {
  const totalRRIFWithdrawal = c.rrifWithdrawal + c.additionalRRIFWithdrawal;
  const totalLIFWithdrawal = c.lifWithdrawal + c.additionalLIFWithdrawal;
  const totalGrossIncome = computeTotalGrossIncome(c, totalRRIFWithdrawal, totalLIFWithdrawal);
  const livingExpenses = c.isRetired ? c.spendingAfterAgeBands : 0;
  const netIncome = totalGrossIncome - c.taxCalculation.totalTax;
  const netCashFlow = applyCoupleSurplusRouting(c, totalGrossIncome, livingExpenses);
  const totalNetWorth =
    c.currentRRSP + c.currentRRIF + c.currentTFSA + c.currentNonReg + c.currentLIRA + c.currentLIF;
  const totalRRIFForProvenance =
    totalRRIFWithdrawal + c.rrspWithdrawal + c.meltdownRRSPWithdrawal + c.bracketFillWithdrawal;
  const provenance = buildPersonProvenance(
    c,
    totalGrossIncome,
    totalRRIFForProvenance,
    totalLIFWithdrawal,
    livingExpenses
  );
  return buildPersonResult({
    c,
    totalGrossIncome,
    totalLIFWithdrawal,
    totalRRIFForProvenance,
    livingExpenses,
    netIncome,
    netCashFlow,
    totalNetWorth,
    provenance,
  });
}

function computeTotalGrossIncome(
  c: PersonCtx,
  totalRRIFWithdrawal: number,
  totalLIFWithdrawal: number
): number {
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
    totalLIFWithdrawal +
    c.rrspWithdrawal +
    c.meltdownRRSPWithdrawal +
    c.bracketFillWithdrawal +
    c.tfsaWithdrawal +
    c.nonRegWithdrawal +
    annualNonRegIncome +
    c.input.otherIncome
  );
}

function applyCoupleSurplusRouting(
  c: PersonCtx,
  totalGrossIncome: number,
  livingExpenses: number
): number {
  const balances = {
    currentRRSP: c.currentRRSP,
    currentRRIF: c.currentRRIF,
    currentTFSA: c.currentTFSA,
    currentNonReg: c.currentNonReg,
    currentLIF: c.currentLIF,
  };
  const netCashFlow = applySurplusRouting(balances, {
    surplusDestination: c.input.surplusDestination,
    totalIncome: totalGrossIncome,
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
      lif: c.lifBalance > 0 || c.currentLIF > 0,
    },
  });
  c.currentRRSP = balances.currentRRSP;
  c.currentRRIF = balances.currentRRIF;
  c.currentTFSA = balances.currentTFSA;
  c.currentNonReg = balances.currentNonReg;
  c.currentLIF = balances.currentLIF;
  return netCashFlow;
}

function buildPersonProvenance(
  c: PersonCtx,
  totalGrossIncome: number,
  totalRRIFForProvenance: number,
  totalLIFWithdrawal: number,
  livingExpenses: number
): ReturnType<typeof buildYearProvenance> {
  return buildYearProvenance({
    year: c.input.year,
    age: c.age,
    province: c.input.province,
    isRetired: c.isRetired,
    includeLIF: true,
    includeLIFInTotalIncome: true,
    effectiveStrategyId: c.effectiveStrategyId,
    overridesMetadata: c.overridesMetadata,
    rrspWithdrawal: c.rrspWithdrawal,
    totalRRIFForProvenance,
    tfsaWithdrawal: c.tfsaWithdrawal,
    nonRegWithdrawal: c.nonRegWithdrawal,
    totalLIFWithdrawal,
    livingExpenses,
    retirementSpending: c.input.retirementSpending,
    rrifForcedMinimum: c.rrifForcedMinimum,
    rrifOpeningBalance: c.rrifOpeningBalance,
    rrifMinimumRate: c.rrifMinimumRate,
    totalIncome: totalGrossIncome,
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

interface PersonResultArgs {
  c: PersonCtx;
  totalGrossIncome: number;
  totalLIFWithdrawal: number;
  totalRRIFForProvenance: number;
  livingExpenses: number;
  netIncome: number;
  netCashFlow: number;
  totalNetWorth: number;
  provenance: ReturnType<typeof buildYearProvenance>;
}

function buildPersonResult(args: PersonResultArgs): PersonYearlyResult {
  const { c, livingExpenses, netIncome, netCashFlow, totalNetWorth } = args;
  return {
    owner: c.input.owner,
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
    lifWithdrawal: args.totalLIFWithdrawal,
    tfsaWithdrawal: c.tfsaWithdrawal,
    nonRegWithdrawal: c.nonRegWithdrawal,
    bracketFillWithdrawal: c.bracketFillWithdrawal,
    totalGrossIncome: args.totalGrossIncome,
    livingExpenses,
    taxesPaid: c.taxCalculation.totalTax,
    netIncome,
    netCashFlow,
    rrspBalance: c.currentRRSP,
    rrifBalance: c.currentRRIF,
    liraBalance: c.currentLIRA,
    lifBalance: c.currentLIF,
    tfsaBalance: c.currentTFSA,
    nonRegBalance: c.currentNonReg,
    totalNetWorth,
    taxCalculation: c.taxCalculation,
    isRetired: c.isRetired,
    isRRIFConversionYear: c.isRRIFConversionYear,
    isLIFConversionYear: c.isLIFConversionYear,
    rrifForcedMinimum: c.rrifForcedMinimum,
    rrifMinimumRate: c.rrifMinimumRate,
    rrifConversionYear: c.isRRIFConversionYear,
    ...(hasAnyOverride(c.overridesMetadata) && { overrides: c.overridesMetadata }),
    ...(hasAnyProvenance(args.provenance) && { provenance: args.provenance }),
  };
}
