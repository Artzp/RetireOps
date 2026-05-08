/**
 * Withdrawal Optimization Strategies
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Strategic Withdrawal Approaches
 */

import { FEDERAL_TAX_2024 } from '@retireops/shared';
import { OAS_CLAWBACK_THRESHOLDS } from '@retireops/shared';
import type { AccountBalances, WithdrawalPlan } from './calculator.js';
import { calculateWithdrawals } from './calculator.js';
import { WITHDRAWAL_STRATEGIES } from './strategy.js';

/**
 * Tax bracket information
 */
export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

/**
 * Get federal tax brackets for a year
 */
export function getFederalTaxBrackets(_year: number = 2024): TaxBracket[] {
  // TODO: Add historical year support when data is available
  return FEDERAL_TAX_2024.brackets;
}

/**
 * Find the current tax bracket for given income
 * @param taxableIncome Current taxable income
 * @param year Tax year
 * @returns Current bracket info
 */
export function getCurrentBracket(
  taxableIncome: number,
  year: number = 2024
): TaxBracket | undefined {
  const brackets = getFederalTaxBrackets(year);
  return brackets.find((b) => taxableIncome >= b.min && taxableIncome < b.max);
}

/**
 * Calculate space available in current tax bracket
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Strategy 1: Tax Bracket Optimization
 * @param currentTaxableIncome Current year taxable income
 * @param year Tax year
 * @returns Amount that can be withdrawn before moving to higher bracket
 */
export function calculateBracketSpace(currentTaxableIncome: number, year: number = 2024): number {
  const bracket = getCurrentBracket(currentTaxableIncome, year);
  if (!bracket) return 0;
  return Math.max(0, bracket.max - currentTaxableIncome);
}

/**
 * Calculate optimal RRSP/RRIF withdrawal to fill tax bracket
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Tax Bracket Filling Example
 * @param currentTaxableIncome Current taxable income (CPP, OAS, pension, etc.)
 * @param rrifBalance Current RRIF balance
 * @param rrifMinimum RRIF minimum withdrawal
 * @param targetBracket 'current' to stay in bracket, 'next' to fill current bracket
 * @param year Tax year
 * @returns Recommended additional RRIF withdrawal
 */
export function calculateBracketFillWithdrawal(
  currentTaxableIncome: number,
  rrifBalance: number,
  rrifMinimum: number,
  targetBracket: 'current' | 'next' = 'next',
  year: number = 2024
): number {
  const brackets = getFederalTaxBrackets(year);
  const currentBracketIndex = brackets.findIndex(
    (b) => currentTaxableIncome >= b.min && currentTaxableIncome < b.max
  );

  if (currentBracketIndex === -1) return 0;

  const currentBracket = brackets[currentBracketIndex];
  if (!currentBracket) return 0;

  let targetCeiling: number;
  if (targetBracket === 'current') {
    // Stay within current bracket
    targetCeiling = currentBracket.max;
  } else {
    // Fill current bracket (stop at next bracket threshold)
    targetCeiling = currentBracket.max;
  }

  const spaceInBracket = targetCeiling - currentTaxableIncome;
  const availableForWithdrawal = Math.max(0, rrifBalance - rrifMinimum);

  return Math.min(spaceInBracket, availableForWithdrawal);
}

/**
 * RRSP Meltdown calculation
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Strategy 2: RRSP Meltdown
 * @param currentAge Current age
 * @param currentRRSPBalance Current RRSP/RRIF balance
 * @param targetBalanceAt72 Desired RRIF balance at age 72
 * @param retirementAge Age at retirement (start of meltdown)
 * @returns Annual meltdown withdrawal amount
 */
export function calculateMeltdownWithdrawal(
  currentAge: number,
  currentRRSPBalance: number,
  targetBalanceAt72: number,
  retirementAge: number = 60
): number {
  // Meltdown only applies between retirement and age 71
  if (currentAge < retirementAge || currentAge >= 72) return 0;

  const yearsRemaining = 71 - currentAge;
  if (yearsRemaining <= 0) return 0;

  const excessBalance = currentRRSPBalance - targetBalanceAt72;
  if (excessBalance <= 0) return 0;

  // Spread excess over remaining years
  return excessBalance / yearsRemaining;
}

/**
 * OAS clawback threshold for a year
 */
export function getOASClawbackThreshold(_year: number = 2024): number {
  // TODO: Add historical year support when data is available
  const thresholds = OAS_CLAWBACK_THRESHOLDS[2024];
  return thresholds.threshold;
}

/**
 * Calculate safe taxable income to avoid OAS clawback
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Strategy 3: OAS Clawback Avoidance
 * @param oasThreshold OAS clawback threshold
 * @param safetyMargin Buffer below threshold
 * @returns Safe taxable income limit
 */
export function calculateSafeIncomeLimit(
  oasThreshold: number = getOASClawbackThreshold(),
  safetyMargin: number = 2000
): number {
  return oasThreshold - safetyMargin;
}

/**
 * Calculate OAS-optimized withdrawal
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Strategy 3: OAS Clawback Avoidance
 * @param currentTaxableIncome Income from CPP, pension, interest, etc.
 * @param spendingNeed Total spending requirement
 * @param tfsaBalance Available TFSA balance
 * @param year Tax year
 * @returns Recommended withdrawal split
 */
export function calculateOASOptimizedWithdrawal(
  currentTaxableIncome: number,
  spendingNeed: number,
  tfsaBalance: number,
  year: number = 2024
): { taxableWithdrawal: number; tfsaWithdrawal: number } {
  const safeLimit = calculateSafeIncomeLimit(getOASClawbackThreshold(year));
  const safeRoom = Math.max(0, safeLimit - currentTaxableIncome);

  if (spendingNeed <= safeRoom) {
    // Can cover all spending with taxable withdrawals
    return {
      taxableWithdrawal: spendingNeed,
      tfsaWithdrawal: 0,
    };
  }

  // Use TFSA for spending above safe limit
  const excessNeeded = spendingNeed - safeRoom;
  const tfsaWithdrawal = Math.min(excessNeeded, tfsaBalance);

  return {
    taxableWithdrawal: safeRoom,
    tfsaWithdrawal,
  };
}

/**
 * Income smoothing calculation
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Strategy 4: Income Smoothing
 * @param totalTaxableAssets Total RRSP + RRIF + taxable portion of non-reg
 * @param yearsRemaining Years to life expectancy
 * @param guaranteedIncome Annual guaranteed income (CPP, OAS, pension)
 * @returns Target annual income from assets
 */
export function calculateSmoothedIncome(
  totalTaxableAssets: number,
  yearsRemaining: number,
  guaranteedIncome: number
): number {
  if (yearsRemaining <= 0) return 0;

  // Simple approach: divide assets evenly
  // More sophisticated would consider time value of money
  const annualFromAssets = totalTaxableAssets / yearsRemaining;
  return annualFromAssets + guaranteedIncome;
}

/**
 * Calculate optimal pension income split between spouses
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Pension Income Splitting Integration
 * @param higherIncomeSpouseTaxable Higher-income spouse's taxable income
 * @param lowerIncomeSpouseTaxable Lower-income spouse's taxable income
 * @param splittableIncome Amount eligible for splitting (RRIF, LIF, annuities)
 * @returns Optimal split percentage (0-0.5)
 */
export function calculateOptimalPensionSplit(
  higherIncomeSpouseTaxable: number,
  lowerIncomeSpouseTaxable: number,
  splittableIncome: number
): number {
  const brackets = getFederalTaxBrackets();

  // Find marginal rates for each spouse
  const getRate = (income: number): number => {
    const bracket = brackets.find((b) => income >= b.min && income < b.max);
    return bracket?.rate ?? 0.33;
  };

  const higherRate = getRate(higherIncomeSpouseTaxable);
  const lowerRate = getRate(lowerIncomeSpouseTaxable);

  // If lower spouse has lower marginal rate, splitting is beneficial
  if (lowerRate >= higherRate) {
    return 0; // No benefit to splitting
  }

  // Binary search for optimal split
  let bestSplit = 0;
  let bestTax = Infinity;

  for (let split = 0; split <= 0.5; split += 0.05) {
    const splitAmount = splittableIncome * split;
    const newHigherIncome = higherIncomeSpouseTaxable - splitAmount;
    const newLowerIncome = lowerIncomeSpouseTaxable + splitAmount;

    // Calculate combined tax (simplified)
    const higherTax = newHigherIncome * getRate(newHigherIncome);
    const lowerTax = newLowerIncome * getRate(newLowerIncome);
    const totalTax = higherTax + lowerTax;

    if (totalTax < bestTax) {
      bestTax = totalTax;
      bestSplit = split;
    }
  }

  return bestSplit;
}

/**
 * Compare withdrawal strategies
 * @param balances Current account balances
 * @param desiredSpending Annual spending need
 * @param guaranteedIncome Guaranteed annual income
 * @param age Current age
 * @returns Comparison of different strategies
 */
export function compareStrategies(
  balances: AccountBalances,
  desiredSpending: number,
  guaranteedIncome: number,
  age: number
): Array<{ strategyName: string; plan: WithdrawalPlan }> {
  const results: Array<{ strategyName: string; plan: WithdrawalPlan }> = [];

  for (const [name, strategy] of Object.entries(WITHDRAWAL_STRATEGIES)) {
    const plan = calculateWithdrawals({
      balances,
      desiredSpending,
      guaranteedIncome,
      age,
      strategy,
    });

    results.push({
      strategyName: name,
      plan,
    });
  }

  return results;
}

/**
 * Surplus reinvestment recommendation
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Surplus Handling
 * @param surplus Amount to reinvest
 * @param tfsaContributionRoom Available TFSA room
 * @param hasMortgage Whether mortgage exists
 * @param mortgageRate Mortgage interest rate
 * @param expectedReturn Expected investment return
 * @returns Reinvestment recommendation
 */
export function recommendSurplusReinvestment(
  surplus: number,
  tfsaContributionRoom: number,
  hasMortgage: boolean = false,
  mortgageRate: number = 0,
  expectedReturn: number = 0.05
): { tfsa: number; nonRegistered: number; mortgage: number } {
  let remaining = surplus;
  const result = { tfsa: 0, nonRegistered: 0, mortgage: 0 };

  // Rule 1: TFSA first (if room available)
  if (tfsaContributionRoom > 0 && remaining > 0) {
    result.tfsa = Math.min(remaining, tfsaContributionRoom);
    remaining -= result.tfsa;
  }

  // Rule 2: Consider mortgage if rate > expected return (after tax)
  if (hasMortgage && mortgageRate > expectedReturn * 0.6 && remaining > 0) {
    // Mortgage paydown guaranteed return vs uncertain investment
    result.mortgage = remaining;
    remaining = 0;
  }

  // Rule 3: Non-registered account for remainder
  if (remaining > 0) {
    result.nonRegistered = remaining;
  }

  return result;
}
