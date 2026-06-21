/**
 * Investment Growth Calculations
 * @see docs/source-of-truth/06-investment-engine.md - Deterministic Projection Model
 */

import type { NonRegIncomeAllocation } from './returns.js';

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
 * Portfolio growth projection for all account types
 *
 * NOTE (audit 2026-06-10, B-08): the legacy `calculateNonRegGrowth` helper was
 * removed — it had no consumers and over-realized capital gains by ignoring
 * same-year contributions in the realization proportion. The live non-reg
 * tax treatment is `tax/capital-gains.ts` (which clamps the proportion).
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
  // (actual non-reg tax treatment lives in tax/capital-gains.ts on the live path)
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
