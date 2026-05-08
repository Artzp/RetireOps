/**
 * Yearly calculator input interfaces.
 *
 * Extracted from yearly-calculator.ts (Phase 9 plan 09-07 LOC cleanup).
 * Type-only module — no behavior.
 */

import type {
  AccountOwner,
  LIFJurisdiction,
  MaritalStatus,
  OverrideWarning,
  ProvinceCode,
  WithdrawalOverrideField,
} from '@retireops/shared';

import type { WithdrawalStrategyName } from '../../withdrawals/strategy.js';
import type { SpendingOverrideInput, WithdrawalOverrideInput } from '../overrides.js';

interface CommonScenarioFields {
  // --- Scenario strategy fields (Phase 25) ---
  drawdownOrder?: string[];
  /** Named withdrawal-strategy preset. Used when drawdownOrder is not provided. */
  strategyId?: WithdrawalStrategyName;
  rrspMeltdown?: {
    enabled: boolean;
    annualAmount: number;
    startYear: number;
    endYear: number;
    targetAmount?: number;
  };
  oasClawbackAvoidance?: { enabled: boolean; incomeThreshold: number };
  /** Bracket-fill strategy config — see ProjectionInput.bracketFill (BKF-01). */
  bracketFill?: {
    enabled: boolean;
    bracketTarget?: 'current' | 'next';
    annualCap?: number;
  };
  contributionOverrides?: Array<{
    accountType: 'rrsp' | 'tfsa';
    annualAmount: number;
    startYear: number;
    endYear: number;
  }>;
  ageBandReductions?: Array<{ fromAge: number; reductionPercent: number }>;
}

interface CommonOverrideFields {
  // --- Phase 1 override fields (OVER-01, OVER-02, OVER-03, OVER-04) ---
  /** Pre-sorted (by year ASC) withdrawal overrides passed from multi-year.ts. */
  withdrawalOverrides?: ReadonlyArray<WithdrawalOverrideInput>;
  /** Pre-sorted spending overrides. */
  spendingOverrides?: ReadonlyArray<SpendingOverrideInput>;
  /** Surplus destination (D-15). Consumed by Plan 05 surplus routing. */
  surplusDestination?: WithdrawalOverrideField;
  /** Shared accumulator for override warnings. Mutated by the override pass; Plan 05 surfaces on output. */
  overrideWarningsAccumulator?: OverrideWarning[];
}

/**
 * Input for a single year calculation (legacy)
 */
export interface YearInput extends CommonScenarioFields, CommonOverrideFields {
  year: number;
  birthdate: Date;
  province: ProvinceCode;

  // Account balances at start of year
  rrspBalance: number;
  rrifBalance: number;
  tfsaBalance: number;
  nonRegBalance: number;
  nonRegACB: number;
  nonRegInterestIncome?: number;
  nonRegEligibleDividends?: number;
  nonRegNonEligibleDividends?: number;
  nonRegRealizedCapitalGains?: number;

  // Contributions (pre-retirement)
  rrspContribution: number;
  tfsaContribution: number;
  availableTfsaContributionRoom?: number;

  // Income sources
  employmentIncome: number;
  pensionIncome: number;
  otherIncome: number;

  // Government benefits config
  expectedCPPAt65: number;
  cppStartAge: number;
  oasStartAge: number;
  yearsOfResidence: number;

  // Spending needs
  retirementSpending: number;

  // Assumptions
  investmentReturn: number;
  inflationRate: number;

  // Retirement
  retirementAge: number;

  // Tracking
  yearsFromProjectionStart: number;
}

/**
 * Input for calculating a single person's yearly projection (spouse-aware)
 * @see docs/source-of-truth/08-projection-engine.md
 */
export interface PersonYearInput extends CommonScenarioFields, CommonOverrideFields {
  owner: AccountOwner;
  year: number;
  birthdate: Date;
  province: ProvinceCode;
  maritalStatus: MaritalStatus;

  // Account balances at start of year
  rrspBalance: number;
  rrifBalance: number;
  liraBalance?: number;
  lifBalance?: number;
  lifJurisdiction?: LIFJurisdiction;
  lifPriorYearReturnRate?: number;
  useYoungerSpouseForLIF?: boolean;
  tfsaBalance: number;
  nonRegBalance: number;
  nonRegACB: number;
  nonRegInterestIncome?: number;
  nonRegEligibleDividends?: number;
  nonRegNonEligibleDividends?: number;
  nonRegRealizedCapitalGains?: number;

  // Contributions (pre-retirement)
  rrspContribution: number;
  tfsaContribution: number;
  availableTfsaContributionRoom?: number;

  // Income sources
  employmentIncome: number;
  pensionIncome: number;
  otherIncome: number;

  // Government benefits config
  expectedCPPAt65: number;
  cppStartAge: number;
  oasStartAge: number;
  yearsOfResidence: number;

  // Spouse-aware GIS calculation
  spouseReceivingOAS?: boolean;

  // Spouse-aware RRIF minimum (younger spouse option)
  spouseAge?: number;
  useYoungerSpouseForRRIF?: boolean;

  // Spending needs
  retirementSpending: number;
  /**
   * Couple-path cashflow support: after-tax household income available to cover
   * this person's spending before triggering discretionary gap-fill withdrawals.
   * Does not reduce reported livingExpenses.
   */
  householdSpendingCredit?: number;

  // Assumptions
  investmentReturn: number;
  inflationRate: number;

  // Retirement
  retirementAge: number;

  // Tracking
  yearsFromProjectionStart: number;
}
