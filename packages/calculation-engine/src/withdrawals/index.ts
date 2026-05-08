/**
 * Withdrawal Strategy Module
 * @see docs/source-of-truth/07-withdrawal-strategies.md
 */

export * from './strategy.js';
export * from './calculator.js';

// Export optimizer functions except those that conflict with tax module
export {
  type TaxBracket as WithdrawalTaxBracket,
  getCurrentBracket,
  calculateBracketSpace,
  calculateBracketFillWithdrawal,
  calculateMeltdownWithdrawal,
  calculateSafeIncomeLimit,
  calculateOASOptimizedWithdrawal,
  calculateSmoothedIncome,
  calculateOptimalPensionSplit,
  compareStrategies,
  recommendSurplusReinvestment,
} from './optimizer.js';
