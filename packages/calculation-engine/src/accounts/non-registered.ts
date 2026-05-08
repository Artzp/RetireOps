/**
 * Non-Registered Account Calculations
 * @see docs/source-of-truth/02-account-types.md - Non-Registered Section
 */
import { processNonRegWithdrawal } from '../tax/capital-gains.js';
import type { CapitalGainsResult } from '../tax/capital-gains.js';

/**
 * Income allocation for a non-registered account
 */
export interface IncomeAllocation {
  interestPct: number;
  canadianDividendPct: number;
  capitalGainsPct: number;
}

/**
 * Default income allocation (conservative portfolio)
 */
export const DEFAULT_INCOME_ALLOCATION: IncomeAllocation = {
  interestPct: 0.3, // 30% interest
  canadianDividendPct: 0.2, // 20% dividends
  capitalGainsPct: 0.5, // 50% capital gains
};

/**
 * Calculate annual taxable income from non-registered account
 * @see docs/source-of-truth/02-account-types.md - NREG-002, NREG-003
 */
export function calculateAnnualTaxableIncome(
  investmentReturn: number,
  balance: number,
  allocation: IncomeAllocation = DEFAULT_INCOME_ALLOCATION
): {
  interestIncome: number;
  dividendIncome: number;
  capitalGainsRealized: number;
} {
  const totalReturn = balance * investmentReturn;

  return {
    interestIncome: totalReturn * allocation.interestPct,
    dividendIncome: totalReturn * allocation.canadianDividendPct,
    capitalGainsRealized: totalReturn * allocation.capitalGainsPct,
  };
}

/**
 * Calculate adjusted cost base after purchase
 * @see docs/source-of-truth/02-account-types.md - NREG-006
 */
export function calculateNewACB(currentACB: number, purchaseAmount: number): number {
  return currentACB + purchaseAmount;
}

/**
 * Process contribution to non-registered account
 */
export interface NonRegContributionResult {
  newBalance: number;
  newACB: number;
}

export function processNonRegContribution(
  currentBalance: number,
  currentACB: number,
  contribution: number
): NonRegContributionResult {
  return {
    newBalance: currentBalance + contribution,
    newACB: currentACB + contribution,
  };
}

/**
 * Apply investment growth to non-registered account
 */
export interface NonRegGrowthResult {
  newBalance: number;
  newUnrealizedGains: number;
  taxableIncome: {
    interest: number;
    dividends: number;
    capitalGains: number;
  };
}

export function applyNonRegGrowth(
  balance: number,
  acb: number,
  investmentReturn: number,
  allocation: IncomeAllocation = DEFAULT_INCOME_ALLOCATION
): NonRegGrowthResult {
  // Calculate income components
  const income = calculateAnnualTaxableIncome(investmentReturn, balance, allocation);

  // Growth adds to balance
  const growth = balance * investmentReturn;
  const newBalance = balance + growth;

  // Unrealized gains increase with growth
  // (Only capital gains portion remains unrealized if not sold)
  const unrealizedPortion = growth * allocation.capitalGainsPct;
  const currentUnrealizedGains = balance - acb;
  const newUnrealizedGains = currentUnrealizedGains + unrealizedPortion;

  return {
    newBalance,
    newUnrealizedGains,
    taxableIncome: {
      interest: income.interestIncome,
      dividends: income.dividendIncome,
      capitalGains: income.capitalGainsRealized,
    },
  };
}

/**
 * Process withdrawal from non-registered account
 *
 * @param annualCapitalGainsToDate Cumulative realized capital gains this year across all
 *   non-reg accounts for this person (D-10 — per-person threshold tracking). Defaults to 0.
 *   Pass the running total from prior non-reg withdrawals so the enhanced $250K inclusion
 *   rate threshold is computed correctly across multiple accounts.
 * @see docs/source-of-truth/02-account-types.md - TC-ACCT-005
 */
export function processNonRegisteredWithdrawal(
  withdrawalAmount: number,
  accountBalance: number,
  adjustedCostBase: number,
  unrealizedGains: number,
  annualCapitalGainsToDate: number = 0
): CapitalGainsResult {
  return processNonRegWithdrawal(
    withdrawalAmount,
    accountBalance,
    adjustedCostBase,
    unrealizedGains,
    annualCapitalGainsToDate
  );
}

/**
 * Calculate after-tax value of non-registered account
 */
export function calculateAfterTaxValue(
  balance: number,
  acb: number,
  marginalCapitalGainsRate: number
): number {
  const unrealizedGains = balance - acb;

  if (unrealizedGains <= 0) {
    return balance;
  }

  // Tax on 50% of gains
  const taxableGains = unrealizedGains * 0.5;
  const tax = taxableGains * marginalCapitalGainsRate;

  return balance - tax;
}
