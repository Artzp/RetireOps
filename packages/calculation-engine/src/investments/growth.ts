/**
 * Investment Growth Calculations
 * @see docs/source-of-truth/06-investment-engine.md - Deterministic Projection Model
 */

import type { NonRegIncomeAllocation } from './returns.js';
import { DEFAULT_NON_REG_ALLOCATION } from './returns.js';

/**
 * Calculate end-of-year balance with contributions and withdrawals
 * Uses end-of-year convention for cash flows
 * @see docs/source-of-truth/06-investment-engine.md - Single Rate of Return
 */
export function calculateEndBalance(
  startBalance: number,
  contributions: number,
  withdrawals: number,
  annualReturn: number
): number {
  // end_balance = (start_balance + contributions - withdrawals) × (1 + annual_return)
  const netCashFlow = contributions - withdrawals;
  return (startBalance + netCashFlow) * (1 + annualReturn);
}

/**
 * Calculate end-of-year balance with mid-year cash flow convention
 * More accurate for modeling periodic contributions/withdrawals
 * @see docs/source-of-truth/06-investment-engine.md - Single Rate of Return
 */
export function calculateEndBalanceMidYear(
  startBalance: number,
  contributions: number,
  withdrawals: number,
  annualReturn: number
): number {
  // end_balance = start_balance × (1 + annual_return)
  //             + contributions × (1 + annual_return/2)
  //             - withdrawals × (1 + annual_return/2)
  const midYearGrowth = 1 + annualReturn / 2;
  return (
    startBalance * (1 + annualReturn) + contributions * midYearGrowth - withdrawals * midYearGrowth
  );
}

/**
 * Project balance over multiple years
 * @param startBalance Initial balance
 * @param annualContribution Yearly contribution (can be 0)
 * @param annualReturn Expected annual return
 * @param years Number of years to project
 * @returns Array of yearly balances
 */
export function projectBalances(
  startBalance: number,
  annualContribution: number,
  annualReturn: number,
  years: number
): number[] {
  const balances: number[] = [];
  let currentBalance = startBalance;

  for (let year = 1; year <= years; year++) {
    currentBalance = calculateEndBalance(currentBalance, annualContribution, 0, annualReturn);
    balances.push(currentBalance);
  }

  return balances;
}

/**
 * Calculate future value with regular contributions
 * @see docs/source-of-truth/06-investment-engine.md - TC-INV-001
 */
export function futureValueWithContributions(
  presentValue: number,
  periodicContribution: number,
  rate: number,
  periods: number
): number {
  if (rate === 0) {
    return presentValue + periodicContribution * periods;
  }

  // FV of lump sum: PV × (1 + r)^n
  const fvLumpSum = presentValue * Math.pow(1 + rate, periods);

  // FV of annuity (end of period): PMT × ((1 + r)^n - 1) / r
  const fvAnnuity = periodicContribution * ((Math.pow(1 + rate, periods) - 1) / rate);

  return fvLumpSum + fvAnnuity;
}

/**
 * Investment growth result for a single account
 */
export interface AccountGrowthResult {
  startBalance: number;
  contributions: number;
  withdrawals: number;
  growthAmount: number;
  endBalance: number;
  returnAchieved: number;
}

/**
 * Calculate growth for a single account
 */
export function calculateAccountGrowth(
  startBalance: number,
  contributions: number,
  withdrawals: number,
  returnRate: number
): AccountGrowthResult {
  const balanceAfterFlows = startBalance + contributions - withdrawals;
  const growthAmount = balanceAfterFlows * returnRate;
  const endBalance = Math.max(0, balanceAfterFlows + growthAmount);

  return {
    startBalance,
    contributions,
    withdrawals,
    growthAmount,
    endBalance,
    returnAchieved: returnRate,
  };
}

/**
 * Non-registered account growth with tax drag
 * @see docs/source-of-truth/06-investment-engine.md - Non-Registered Growth
 */
export interface NonRegInvestmentGrowthResult extends AccountGrowthResult {
  /** Annual taxable income from interest */
  interestIncome: number;
  /** Annual taxable income from dividends (pre-gross-up) */
  dividendIncome: number;
  /** Unrealized capital gains increase */
  unrealizedGainIncrease: number;
  /** New unrealized gains total */
  newUnrealizedGains: number;
  /** Tax drag on effective return */
  taxDrag: number;
  /** Effective after-tax return */
  effectiveReturn: number;
}

/**
 * Calculate non-registered account growth with tax implications
 * @see docs/source-of-truth/06-investment-engine.md - Tax-Aware Growth
 */
export function calculateNonRegGrowth(
  startBalance: number,
  contributions: number,
  withdrawals: number,
  returnRate: number,
  allocation: NonRegIncomeAllocation = DEFAULT_NON_REG_ALLOCATION,
  marginalTaxRate: number,
  unrealizedGains: number = 0,
  _costBase: number = 0
): NonRegInvestmentGrowthResult {
  const balanceAfterFlows = startBalance + contributions - withdrawals;
  const totalReturn = balanceAfterFlows * returnRate;

  // Allocate return to income types
  const interestIncome = totalReturn * allocation.interestPct;
  const canadianDividendIncome = totalReturn * allocation.canadianDividendPct;
  const foreignDividendIncome = totalReturn * allocation.foreignDividendPct;
  const capitalGainsPortion = totalReturn * allocation.capitalGainsPct;

  const dividendIncome = canadianDividendIncome + foreignDividendIncome;

  // Calculate annual tax on interest and dividends
  // Interest: fully taxable
  const interestTax = interestIncome * marginalTaxRate;

  // Foreign dividends: fully taxable
  const foreignDividendTax = foreignDividendIncome * marginalTaxRate;

  // Canadian dividends: grossed up with dividend tax credit
  // Simplified: assume effective rate is ~70% of marginal for eligible dividends
  const canadianDividendTax = canadianDividendIncome * marginalTaxRate * 0.7;

  // Capital gains: deferred (not taxed until realized)
  const newUnrealizedGains = unrealizedGains + capitalGainsPortion;

  // Adjust for withdrawal capital gains (if withdrawal occurred)
  let realizedGain = 0;
  if (withdrawals > 0 && startBalance > 0 && unrealizedGains > 0) {
    // Proportional realization of gains
    const proportion = withdrawals / startBalance;
    realizedGain = unrealizedGains * proportion;
  }

  const totalAnnualTax = interestTax + foreignDividendTax + canadianDividendTax;

  // Calculate effective return after tax drag
  const taxDrag = totalAnnualTax / (balanceAfterFlows || 1);
  const effectiveReturn = returnRate - taxDrag;

  const endBalance = Math.max(0, balanceAfterFlows + totalReturn - totalAnnualTax);

  return {
    startBalance,
    contributions,
    withdrawals,
    growthAmount: totalReturn,
    endBalance,
    returnAchieved: returnRate,
    interestIncome,
    dividendIncome,
    unrealizedGainIncrease: capitalGainsPortion,
    newUnrealizedGains: newUnrealizedGains - realizedGain,
    taxDrag,
    effectiveReturn,
  };
}

/**
 * Portfolio growth projection for all account types
 */
export interface PortfolioGrowthInput {
  rrspBalance: number;
  rrifBalance: number;
  tfsaBalance: number;
  nonRegBalance: number;
  liraBalance?: number;
  lifBalance?: number;

  returnRate: number;
  nonRegAllocation?: NonRegIncomeAllocation;
  marginalTaxRate?: number;
  nonRegUnrealizedGains?: number;
}

export interface PortfolioGrowthResult {
  rrspGrowth: number;
  rrifGrowth: number;
  tfsaGrowth: number;
  nonRegGrowth: number;
  liraGrowth: number;
  lifGrowth: number;
  totalGrowth: number;

  rrspEnd: number;
  rrifEnd: number;
  tfsaEnd: number;
  nonRegEnd: number;
  liraEnd: number;
  lifEnd: number;
  totalEnd: number;
}

/**
 * Calculate growth for entire portfolio
 */
export function calculatePortfolioGrowth(input: PortfolioGrowthInput): PortfolioGrowthResult {
  const {
    rrspBalance,
    rrifBalance,
    tfsaBalance,
    nonRegBalance,
    liraBalance = 0,
    lifBalance = 0,
    returnRate,
  } = input;

  // Tax-deferred and tax-free accounts: simple growth
  const rrspGrowth = rrspBalance * returnRate;
  const rrifGrowth = rrifBalance * returnRate;
  const tfsaGrowth = tfsaBalance * returnRate;
  const liraGrowth = liraBalance * returnRate;
  const lifGrowth = lifBalance * returnRate;

  // Non-registered: may have tax drag but for simplicity use same rate
  // (actual tax drag handled in calculateNonRegGrowth)
  const nonRegGrowth = nonRegBalance * returnRate;

  const totalGrowth = rrspGrowth + rrifGrowth + tfsaGrowth + nonRegGrowth + liraGrowth + lifGrowth;

  return {
    rrspGrowth,
    rrifGrowth,
    tfsaGrowth,
    nonRegGrowth,
    liraGrowth,
    lifGrowth,
    totalGrowth,

    rrspEnd: rrspBalance + rrspGrowth,
    rrifEnd: rrifBalance + rrifGrowth,
    tfsaEnd: tfsaBalance + tfsaGrowth,
    nonRegEnd: nonRegBalance + nonRegGrowth,
    liraEnd: liraBalance + liraGrowth,
    lifEnd: lifBalance + lifGrowth,
    totalEnd:
      rrspBalance +
      rrifBalance +
      tfsaBalance +
      nonRegBalance +
      liraBalance +
      lifBalance +
      totalGrowth,
  };
}
