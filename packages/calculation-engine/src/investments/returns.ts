/**
 * Investment Returns Calculations
 * @see docs/source-of-truth/06-investment-engine.md - Core Parameters
 */

/**
 * Risk profile for investment assumptions
 */
export type RiskProfile = 'conservative' | 'balanced' | 'growth' | 'aggressive';

/**
 * Investment return parameters by risk profile
 * @see docs/source-of-truth/06-investment-engine.md - Return by Risk Profile
 */
export interface RiskProfileParameters {
  expectedReturn: number;
  volatility: number;
  equityAllocation: number;
  fixedIncomeAllocation: number;
}

/**
 * Risk profile defaults
 * @see docs/source-of-truth/06-investment-engine.md - Return by Risk Profile Table
 */
export const RISK_PROFILES: Record<RiskProfile, RiskProfileParameters> = {
  conservative: {
    expectedReturn: 0.04,
    volatility: 0.05,
    equityAllocation: 0.3,
    fixedIncomeAllocation: 0.7,
  },
  balanced: {
    expectedReturn: 0.055,
    volatility: 0.1,
    equityAllocation: 0.5,
    fixedIncomeAllocation: 0.5,
  },
  growth: {
    expectedReturn: 0.07,
    volatility: 0.15,
    equityAllocation: 0.7,
    fixedIncomeAllocation: 0.3,
  },
  aggressive: {
    expectedReturn: 0.08,
    volatility: 0.2,
    equityAllocation: 0.9,
    fixedIncomeAllocation: 0.1,
  },
};

/**
 * Investment assumptions for projections
 * @see docs/source-of-truth/06-investment-engine.md - Investment Engine Data Model
 */
export interface InvestmentAssumptions {
  returnMode: 'nominal' | 'real';
  nominalReturn: number;
  realReturn: number;
  inflationRate: number;
  volatility?: number;

  /** Optional: account-specific returns */
  accountReturns?: Record<string, number>;

  /** Non-registered income allocation */
  nonRegAllocation: NonRegIncomeAllocation;
}

/**
 * Non-registered account income allocation
 * @see docs/source-of-truth/06-investment-engine.md - Non-Registered Income Allocation
 */
export interface NonRegIncomeAllocation {
  interestPct: number;
  canadianDividendPct: number;
  foreignDividendPct: number;
  capitalGainsPct: number;
}

/**
 * Default non-registered income allocation (balanced portfolio)
 */
export const DEFAULT_NON_REG_ALLOCATION: NonRegIncomeAllocation = {
  interestPct: 0.2,
  canadianDividendPct: 0.3,
  foreignDividendPct: 0.1,
  capitalGainsPct: 0.4,
};

/**
 * Convert nominal return to real return
 * @param nominalReturn The nominal (before inflation) return
 * @param inflationRate The inflation rate
 * @returns Real return (after inflation)
 */
export function nominalToRealReturn(nominalReturn: number, inflationRate: number): number {
  // Fisher equation: (1 + real) = (1 + nominal) / (1 + inflation)
  return (1 + nominalReturn) / (1 + inflationRate) - 1;
}

/**
 * Convert real return to nominal return
 * @param realReturn The real (after inflation) return
 * @param inflationRate The inflation rate
 * @returns Nominal return (before inflation)
 */
export function realToNominalReturn(realReturn: number, inflationRate: number): number {
  // Fisher equation: (1 + nominal) = (1 + real) * (1 + inflation)
  return (1 + realReturn) * (1 + inflationRate) - 1;
}

/**
 * Get investment parameters for a risk profile
 * @param profile The risk profile
 * @returns Risk profile parameters
 */
export function getRiskProfileParameters(profile: RiskProfile): RiskProfileParameters {
  return RISK_PROFILES[profile];
}

/**
 * Calculate blended return from multiple accounts
 * @param accounts Array of { balance, returnRate }
 * @returns Weighted average return rate
 */
export function calculateBlendedReturn(
  accounts: Array<{ balance: number; returnRate: number }>
): number {
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  if (totalBalance === 0) return 0;

  const weightedReturn = accounts.reduce((sum, acc) => sum + acc.balance * acc.returnRate, 0);

  return weightedReturn / totalBalance;
}

/**
 * Calculate expected return based on equity/fixed allocation
 * @param equityAllocation Percentage in equities (0-1)
 * @param equityReturn Expected return on equities
 * @param fixedReturn Expected return on fixed income
 * @returns Blended expected return
 */
export function calculateAllocationReturn(
  equityAllocation: number,
  equityReturn: number = 0.08,
  fixedReturn: number = 0.03
): number {
  const fixedAllocation = 1 - equityAllocation;
  return equityAllocation * equityReturn + fixedAllocation * fixedReturn;
}

/**
 * Create default investment assumptions
 * @param nominalReturn Optional nominal return (defaults to 5%)
 * @param inflationRate Optional inflation rate (defaults to 2.5%)
 * @returns Investment assumptions object
 */
export function createDefaultAssumptions(
  nominalReturn: number = 0.05,
  inflationRate: number = 0.025
): InvestmentAssumptions {
  return {
    returnMode: 'nominal',
    nominalReturn,
    realReturn: nominalToRealReturn(nominalReturn, inflationRate),
    inflationRate,
    volatility: 0.1, // Balanced profile default
    nonRegAllocation: DEFAULT_NON_REG_ALLOCATION,
  };
}

/**
 * Create investment assumptions from risk profile
 * @param profile Risk profile
 * @param inflationRate Inflation rate (defaults to 2.5%)
 * @returns Investment assumptions
 */
export function createAssumptionsFromProfile(
  profile: RiskProfile,
  inflationRate: number = 0.025
): InvestmentAssumptions {
  const params = getRiskProfileParameters(profile);
  return {
    returnMode: 'nominal',
    nominalReturn: params.expectedReturn,
    realReturn: nominalToRealReturn(params.expectedReturn, inflationRate),
    inflationRate,
    volatility: params.volatility,
    nonRegAllocation: DEFAULT_NON_REG_ALLOCATION,
  };
}
