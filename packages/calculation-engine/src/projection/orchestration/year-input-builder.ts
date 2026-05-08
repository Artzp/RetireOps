/**
 * Per-iteration YearInput / CoupleYearInput half assembly helpers.
 *
 * Extracted from multi-year.ts (Phase 10 plan 10-04 LOC cleanup, ENG-05).
 * Three named exports mirror the three large object-literal builders that
 * previously lived inline inside computeSingleProjection and
 * computeCoupleProjection's per-year loop:
 *
 *   - buildSingleYearInput      → assembles the single-path YearInput
 *   - buildCouplePrimaryYearInput → assembles the primary half of CoupleYearInput
 *   - buildCoupleSpouseYearInput  → assembles the spouse half of CoupleYearInput
 *
 * Each helper takes a typed args object containing the loop-iteration locals
 * (balances, derived per-year fields, override slices) and returns the
 * fully-shaped per-year input object the calculator consumes. Behavior is
 * preserved verbatim — these are pure object-literal assemblers.
 *
 * @see docs/source-of-truth/08-projection-engine.md
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 */

import type { ProjectionInput } from '@retireops/shared';
import { calculateAnnualizedPensionIncome } from './annualized-pension.js';
import type { YearInput, PersonYearInput } from '../yearly-calculator.js';
import type {
  OverrideWarning,
  WithdrawalOverrideInput,
  SpendingOverrideInput,
} from '../overrides.js';

// --- Single path ------------------------------------------------------------

export interface SingleYearInputArgs {
  input: ProjectionInput;
  year: number;
  age: number;
  isPreRetirement: boolean;
  yearsFromStart: number;
  rrspBalance: number;
  rrifBalance: number;
  tfsaBalance: number;
  nonRegBalance: number;
  nonRegACB: number;
  cappedRRSPContribution: number;
  availableTfsaContributionRoom: number;
  employmentIncome: number;
  primaryWithdrawalOverrides: WithdrawalOverrideInput[];
  primarySpendingOverrides: SpendingOverrideInput[];
  surplusDestination: ProjectionInput['surplusDestination'];
  overrideWarnings: OverrideWarning[];
}

export function buildSingleYearInput(args: SingleYearInputArgs): YearInput {
  const {
    input,
    year,
    age,
    yearsFromStart,
    rrspBalance,
    rrifBalance,
    tfsaBalance,
    nonRegBalance,
    nonRegACB,
    cappedRRSPContribution,
    availableTfsaContributionRoom,
    employmentIncome,
    primaryWithdrawalOverrides,
    primarySpendingOverrides,
    surplusDestination,
    overrideWarnings,
  } = args;

  return {
    year,
    birthdate: input.birthdate,
    province: input.province,

    // Account balances
    rrspBalance,
    rrifBalance,
    tfsaBalance,
    nonRegBalance,
    nonRegACB,
    ...(input.nonRegInterestIncome !== undefined && {
      nonRegInterestIncome: input.nonRegInterestIncome,
    }),
    ...(input.nonRegEligibleDividends !== undefined && {
      nonRegEligibleDividends: input.nonRegEligibleDividends,
    }),
    ...(input.nonRegNonEligibleDividends !== undefined && {
      nonRegNonEligibleDividends: input.nonRegNonEligibleDividends,
    }),
    ...(input.nonRegRealizedCapitalGains !== undefined && {
      nonRegRealizedCapitalGains: input.nonRegRealizedCapitalGains,
    }),

    // Contributions
    rrspContribution: cappedRRSPContribution,
    tfsaContribution: input.tfsaAnnualContribution,
    availableTfsaContributionRoom,

    // Income
    employmentIncome,
    // BUG-01 fix: guard pension income by pensionStartAge
    // @see docs/source-of-truth/03-income-sources.md - Pension Income
    pensionIncome:
      age >= (input.pensionStartAge ?? 0)
        ? calculateAnnualizedPensionIncome(
            input.pensionIncome,
            input.bridgeBenefit,
            input.bridgeEndAge,
            input.birthdate,
            year
          )
        : 0,
    otherIncome: 0,

    // Government benefits
    expectedCPPAt65: input.expectedCPPAt65 ?? 12000, // Default estimate
    cppStartAge: input.cppStartAge ?? 65,
    oasStartAge: input.oasStartAge ?? 65,
    yearsOfResidence: 40, // Assume full residency for now

    // Spending
    retirementSpending: input.retirementSpending,

    // Assumptions
    investmentReturn: input.investmentReturn,
    inflationRate: input.inflationRate,
    retirementAge: input.retirementAge,

    // Tracking
    yearsFromProjectionStart: yearsFromStart,

    // --- Phase 25 strategy fields (gap closure 25-04) ---
    // Forward scenario decisions from ProjectionInput into the per-year calculator.
    // Conditional spreads preserve exactOptionalPropertyTypes compliance.
    ...(input.drawdownOrder && { drawdownOrder: input.drawdownOrder }),
    ...(input.strategyId && { strategyId: input.strategyId }),
    ...(input.rrspMeltdown && { rrspMeltdown: input.rrspMeltdown }),
    ...(input.oasClawbackAvoidance && { oasClawbackAvoidance: input.oasClawbackAvoidance }),
    ...(input.bracketFill && { bracketFill: input.bracketFill }),
    ...(input.contributionOverrides && { contributionOverrides: input.contributionOverrides }),
    ...(input.ageBandReductions && { ageBandReductions: input.ageBandReductions }),

    // --- Phase 1 override threading (D-12: pass pre-sorted arrays, not originals) ---
    // Single projections receive primary-owner records only (filtered above).
    // overrideWarnings accumulator is shared across all years (Plan 05 surfaces on output).
    // surplusDestination threaded for Plan 05 consumption.
    ...(primaryWithdrawalOverrides.length > 0 && {
      withdrawalOverrides: primaryWithdrawalOverrides,
    }),
    ...(primarySpendingOverrides.length > 0 && { spendingOverrides: primarySpendingOverrides }),
    ...(surplusDestination !== undefined && { surplusDestination }),
    overrideWarningsAccumulator: overrideWarnings,
  };
}

// --- Couple path: per-spouse balances + person-level derived figures --------

export interface CouplePersonBalancesView {
  rrsp: number;
  rrif: number;
  lira: number;
  lif: number;
  lifPriorYearReturnRate?: number;
  tfsa: number;
  tfsaRestoredRoomFromPreviousYear: number;
  nonReg: number;
  nonRegACB: number;
}

export interface CouplePrimaryYearInputArgs {
  input: ProjectionInput;
  year: number;
  primaryAge: number;
  yearsFromStart: number;
  primaryDeceased: boolean;
  primaryBalances: CouplePersonBalancesView;
  primaryCappedRRSP: number;
  primaryEmploymentIncome: number;
  perPersonSpending: number;
  survivorCPPAt65ForPrimary: number | undefined;
  availableTfsaContributionRoomPrimary: number;
  primaryWithdrawalOverrides: WithdrawalOverrideInput[];
  primarySpendingOverrides: SpendingOverrideInput[];
  surplusDestination: ProjectionInput['surplusDestination'];
  overrideWarnings: OverrideWarning[];
}

export function buildCouplePrimaryYearInput(
  args: CouplePrimaryYearInputArgs
): Omit<PersonYearInput, 'owner' | 'year' | 'maritalStatus'> {
  const {
    input,
    year,
    primaryAge,
    yearsFromStart,
    primaryDeceased,
    primaryBalances,
    primaryCappedRRSP,
    primaryEmploymentIncome,
    perPersonSpending,
    survivorCPPAt65ForPrimary,
    availableTfsaContributionRoomPrimary,
    primaryWithdrawalOverrides,
    primarySpendingOverrides,
    surplusDestination,
    overrideWarnings,
  } = args;

  return {
    birthdate: input.birthdate,
    province: input.province,
    // Deceased primary has no accounts or income
    rrspBalance: primaryDeceased ? 0 : primaryBalances.rrsp,
    rrifBalance: primaryDeceased ? 0 : primaryBalances.rrif,
    liraBalance: primaryDeceased ? 0 : primaryBalances.lira,
    lifBalance: primaryDeceased ? 0 : primaryBalances.lif,
    ...(primaryBalances.lifPriorYearReturnRate !== undefined &&
      !primaryDeceased && {
        lifPriorYearReturnRate: primaryBalances.lifPriorYearReturnRate,
      }),
    tfsaBalance: primaryDeceased ? 0 : primaryBalances.tfsa,
    nonRegBalance: primaryDeceased ? 0 : primaryBalances.nonReg,
    nonRegACB: primaryDeceased ? 0 : primaryBalances.nonRegACB,
    ...(input.nonRegInterestIncome !== undefined &&
      !primaryDeceased && {
        nonRegInterestIncome: input.nonRegInterestIncome,
      }),
    ...(input.nonRegEligibleDividends !== undefined &&
      !primaryDeceased && {
        nonRegEligibleDividends: input.nonRegEligibleDividends,
      }),
    ...(input.nonRegNonEligibleDividends !== undefined &&
      !primaryDeceased && {
        nonRegNonEligibleDividends: input.nonRegNonEligibleDividends,
      }),
    ...(input.nonRegRealizedCapitalGains !== undefined &&
      !primaryDeceased && {
        nonRegRealizedCapitalGains: input.nonRegRealizedCapitalGains,
      }),
    rrspContribution: primaryCappedRRSP,
    tfsaContribution: primaryDeceased ? 0 : input.tfsaAnnualContribution,
    availableTfsaContributionRoom: primaryDeceased ? 0 : availableTfsaContributionRoomPrimary,
    employmentIncome: primaryEmploymentIncome,
    // BUG-01 fix: guard pension income by pensionStartAge in couple primary path
    pensionIncome: primaryDeceased
      ? 0
      : primaryAge >= (input.pensionStartAge ?? 0)
        ? calculateAnnualizedPensionIncome(
            input.pensionIncome,
            input.bridgeBenefit,
            input.bridgeEndAge,
            input.birthdate,
            year
          )
        : 0,
    otherIncome: 0,
    expectedCPPAt65: primaryDeceased
      ? 0
      : (survivorCPPAt65ForPrimary ?? input.expectedCPPAt65 ?? 12000),
    cppStartAge: input.cppStartAge ?? 65,
    oasStartAge: primaryDeceased ? 999 : (input.oasStartAge ?? 65), // 999 = never receives OAS when dead
    yearsOfResidence: input.yearsOfResidence ?? 40,
    retirementSpending: primaryDeceased ? 0 : perPersonSpending,
    investmentReturn: input.investmentReturn,
    inflationRate: input.inflationRate,
    retirementAge: input.retirementAge,
    yearsFromProjectionStart: yearsFromStart,
    ...(input.drawdownOrder && { drawdownOrder: input.drawdownOrder }),
    ...(input.strategyId && { strategyId: input.strategyId }),
    ...(input.rrspMeltdown && { rrspMeltdown: input.rrspMeltdown }),
    ...(input.oasClawbackAvoidance && { oasClawbackAvoidance: input.oasClawbackAvoidance }),
    ...(input.bracketFill && { bracketFill: input.bracketFill }),
    ...(input.contributionOverrides && { contributionOverrides: input.contributionOverrides }),
    ...(input.ageBandReductions && { ageBandReductions: input.ageBandReductions }),

    // --- Phase 1 override threading (D-12) ---
    // Each spouse receives their own owner-filtered overrides. The shared
    // overrideWarningsAccumulator is threaded so warnings raised inside
    // calculatePersonYear (override pass + surplus routing) accumulate
    // across years for surfacing on the couple ProjectionOutput.
    ...(primaryWithdrawalOverrides.length > 0 &&
      !primaryDeceased && {
        withdrawalOverrides: primaryWithdrawalOverrides,
      }),
    ...(primarySpendingOverrides.length > 0 &&
      !primaryDeceased && {
        spendingOverrides: primarySpendingOverrides,
      }),
    ...(surplusDestination !== undefined && !primaryDeceased && { surplusDestination }),
    overrideWarningsAccumulator: overrideWarnings,
  };
}

export interface CoupleSpouseYearInputArgs {
  input: ProjectionInput;
  spouse: NonNullable<ProjectionInput['spouse']>;
  year: number;
  spouseAge: number;
  yearsFromStart: number;
  spouseDeceased: boolean;
  spouseBalances: CouplePersonBalancesView;
  spouseCappedRRSP: number;
  spouseEmploymentIncome: number;
  perPersonSpending: number;
  survivorCPPAt65ForSpouse: number | undefined;
  availableTfsaContributionRoomSpouse: number;
  spouseWithdrawalOverrides: WithdrawalOverrideInput[];
  spouseSpendingOverrides: SpendingOverrideInput[];
  overrideWarnings: OverrideWarning[];
}

export function buildCoupleSpouseYearInput(
  args: CoupleSpouseYearInputArgs
): Omit<PersonYearInput, 'owner' | 'year' | 'maritalStatus'> {
  const {
    input,
    spouse,
    year,
    spouseAge,
    yearsFromStart,
    spouseDeceased,
    spouseBalances,
    spouseCappedRRSP,
    spouseEmploymentIncome,
    perPersonSpending,
    survivorCPPAt65ForSpouse,
    availableTfsaContributionRoomSpouse,
    spouseWithdrawalOverrides,
    spouseSpendingOverrides,
    overrideWarnings,
  } = args;

  return {
    birthdate: spouse.birthdate,
    province: spouse.province ?? input.province,
    rrspBalance: spouseDeceased ? 0 : spouseBalances.rrsp,
    rrifBalance: spouseDeceased ? 0 : spouseBalances.rrif,
    liraBalance: spouseDeceased ? 0 : spouseBalances.lira,
    lifBalance: spouseDeceased ? 0 : spouseBalances.lif,
    ...(spouse.lifJurisdiction !== undefined &&
      !spouseDeceased && {
        lifJurisdiction: spouse.lifJurisdiction,
      }),
    ...(spouseBalances.lifPriorYearReturnRate !== undefined &&
      !spouseDeceased && {
        lifPriorYearReturnRate: spouseBalances.lifPriorYearReturnRate,
      }),
    tfsaBalance: spouseDeceased ? 0 : spouseBalances.tfsa,
    nonRegBalance: spouseDeceased ? 0 : spouseBalances.nonReg,
    nonRegACB: spouseDeceased ? 0 : spouseBalances.nonRegACB,
    ...(spouse.nonRegInterestIncome !== undefined &&
      !spouseDeceased && {
        nonRegInterestIncome: spouse.nonRegInterestIncome,
      }),
    ...(spouse.nonRegEligibleDividends !== undefined &&
      !spouseDeceased && {
        nonRegEligibleDividends: spouse.nonRegEligibleDividends,
      }),
    ...(spouse.nonRegNonEligibleDividends !== undefined &&
      !spouseDeceased && {
        nonRegNonEligibleDividends: spouse.nonRegNonEligibleDividends,
      }),
    ...(spouse.nonRegRealizedCapitalGains !== undefined &&
      !spouseDeceased && {
        nonRegRealizedCapitalGains: spouse.nonRegRealizedCapitalGains,
      }),
    rrspContribution: spouseCappedRRSP,
    tfsaContribution: spouseDeceased ? 0 : (spouse.tfsaAnnualContribution ?? 0),
    availableTfsaContributionRoom: spouseDeceased ? 0 : availableTfsaContributionRoomSpouse,
    employmentIncome: spouseEmploymentIncome,
    // BUG-01 fix: guard pension income by pensionStartAge in couple spouse path
    pensionIncome: spouseDeceased
      ? 0
      : spouseAge >= (spouse.pensionStartAge ?? 0)
        ? calculateAnnualizedPensionIncome(
            spouse.pensionIncome,
            spouse.bridgeBenefit,
            spouse.bridgeEndAge,
            spouse.birthdate,
            year
          )
        : 0,
    otherIncome: 0,
    expectedCPPAt65: spouseDeceased ? 0 : (survivorCPPAt65ForSpouse ?? spouse.expectedCPPAt65),
    cppStartAge: spouse.cppStartAge ?? 65,
    oasStartAge: spouseDeceased ? 999 : (spouse.oasStartAge ?? 65),
    yearsOfResidence: spouse.yearsOfResidence ?? 40,
    retirementSpending: spouseDeceased ? 0 : perPersonSpending,
    investmentReturn: input.investmentReturn,
    inflationRate: input.inflationRate,
    retirementAge: spouse.retirementAge,
    yearsFromProjectionStart: yearsFromStart,
    ...(input.drawdownOrder && { drawdownOrder: input.drawdownOrder }),
    ...(input.strategyId && { strategyId: input.strategyId }),
    ...(input.rrspMeltdown && { rrspMeltdown: input.rrspMeltdown }),
    ...(input.oasClawbackAvoidance && { oasClawbackAvoidance: input.oasClawbackAvoidance }),
    ...(input.bracketFill && { bracketFill: input.bracketFill }),
    ...(input.contributionOverrides && { contributionOverrides: input.contributionOverrides }),
    ...(input.ageBandReductions && { ageBandReductions: input.ageBandReductions }),

    // --- Override threading (spouse side) ---
    // Spouse receives only owner='spouse' records. Pre-existing rows lack
    // an owner field and default to primary, so legacy scenarios still
    // route their overrides to the primary side only.
    ...(spouseWithdrawalOverrides.length > 0 &&
      !spouseDeceased && {
        withdrawalOverrides: spouseWithdrawalOverrides,
      }),
    ...(spouseSpendingOverrides.length > 0 &&
      !spouseDeceased && {
        spendingOverrides: spouseSpendingOverrides,
      }),
    overrideWarningsAccumulator: overrideWarnings,
  };
}
