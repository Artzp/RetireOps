/**
 * Capital Gains Tax Calculations
 * @see docs/source-of-truth/04-tax-engine.md - Capital Gains Tax
 * @see docs/source-of-truth/02-account-types.md - Non-Registered Section
 */
import { CAPITAL_GAINS_RATES } from '@retireops/shared';

/**
 * Calculate taxable capital gain (standard 50% inclusion)
 * @see docs/source-of-truth/04-tax-engine.md - Inclusion Rate
 */
export function calculateTaxableCapitalGain(capitalGain: number): number {
  if (capitalGain <= 0) return 0;
  return capitalGain * CAPITAL_GAINS_RATES.standardInclusionRate;
}

/**
 * Calculate taxable capital gain with enhanced inclusion rate.
 *
 * When called with `annualGains = capitalGain` (the default, single-transaction case),
 * the $250K threshold splits the gain itself: the first $250K at 50%, the rest at 66.7%.
 *
 * When called from `processNonRegWithdrawal` with cumulative annual gains (D-08/D-10),
 * `annualGains` represents the *total* realized gains for the person this year including
 * this transaction. This correctly handles the scenario where prior withdrawals have
 * already consumed part or all of the $250K threshold.
 *
 * Split calculation logic:
 *   - priorGains = annualGains - capitalGain  (gains realized before this transaction)
 *   - standardRoom = max(0, threshold - priorGains)  (remaining standard-rate room)
 *   - standardPortion = min(capitalGain, standardRoom)  (portion at 50%)
 *   - enhancedPortion = capitalGain - standardPortion   (remainder at 66.7%)
 *
 * @see docs/source-of-truth/04-tax-engine.md - Enhanced rate for gains over $250,000
 */
export function calculateTaxableCapitalGainEnhanced(
  capitalGain: number,
  annualGains: number = capitalGain
): number {
  if (capitalGain <= 0) return 0;

  const { standardInclusionRate, enhancedInclusionRate, enhancedThreshold } = CAPITAL_GAINS_RATES;

  // If total annual gains are under or at threshold, use standard rate for full current gain
  if (annualGains <= enhancedThreshold) {
    return capitalGain * standardInclusionRate;
  }

  // Calculate how much standard-rate room remains before this transaction
  const priorGains = annualGains - capitalGain;
  const standardRoom = Math.max(0, enhancedThreshold - priorGains);

  // Split calculation: standard rate up to remaining room, enhanced rate above
  const standardPortion = Math.min(capitalGain, standardRoom);
  const enhancedPortion = capitalGain - standardPortion;

  return standardPortion * standardInclusionRate + enhancedPortion * enhancedInclusionRate;
}

/**
 * Calculate capital gain from sale
 * @see docs/source-of-truth/02-account-types.md - Non-Registered Capital Gains Calculation
 */
export function calculateCapitalGainOnSale(proceeds: number, adjustedCostBase: number): number {
  return Math.max(0, proceeds - adjustedCostBase);
}

/**
 * Calculate realized gain on partial withdrawal from non-registered account
 * @see docs/source-of-truth/02-account-types.md - TC-ACCT-005
 */
export function calculateRealizedGainOnWithdrawal(
  withdrawalAmount: number,
  accountBalance: number,
  unrealizedGains: number
): number {
  if (accountBalance <= 0) return 0;

  // Pro-rata allocation of unrealized gains
  const gainPortion = unrealizedGains / accountBalance;
  return withdrawalAmount * gainPortion;
}

/**
 * Calculate new adjusted cost base after withdrawal
 * @see docs/source-of-truth/02-account-types.md - Capital Gains Calculation
 */
export function calculateNewACBAfterWithdrawal(
  withdrawalAmount: number,
  accountBalance: number,
  adjustedCostBase: number
): number {
  if (accountBalance <= 0) return 0;

  // Pro-rata reduction of ACB
  const acbPortion = adjustedCostBase / accountBalance;
  const acbReduction = withdrawalAmount * acbPortion;

  return adjustedCostBase - acbReduction;
}

/**
 * Result of capital gains calculation on withdrawal
 */
export interface CapitalGainsResult {
  withdrawalAmount: number;
  realizedGain: number;
  taxableGain: number;
  newACB: number;
  newUnrealizedGains: number;
}

/**
 * Calculate complete capital gains result on withdrawal
 *
 * @param annualCapitalGainsToDate Cumulative realized capital gains this year across all
 *   non-reg accounts for this person (D-09). Used for the $250K enhanced rate threshold
 *   (D-10 — per-person, not per-account). Defaults to 0. The caller (projection loop) is
 *   responsible for accumulating this across withdrawals.
 * @see docs/source-of-truth/04-tax-engine.md - Enhanced rate for gains over $250,000
 */
export function processNonRegWithdrawal(
  withdrawalAmount: number,
  accountBalance: number,
  adjustedCostBase: number,
  unrealizedGains: number,
  annualCapitalGainsToDate: number = 0
): CapitalGainsResult {
  const realizedGain = calculateRealizedGainOnWithdrawal(
    withdrawalAmount,
    accountBalance,
    unrealizedGains
  );

  // D-08: Use enhanced function with cumulative annual gains for threshold check.
  // totalAnnualGains represents the total gains this person has realized this year
  // (prior withdrawals + this withdrawal). This enables per-person $250K threshold tracking.
  const totalAnnualGains = annualCapitalGainsToDate + realizedGain;
  const taxableGain = calculateTaxableCapitalGainEnhanced(realizedGain, totalAnnualGains);

  const newACB = calculateNewACBAfterWithdrawal(withdrawalAmount, accountBalance, adjustedCostBase);

  const newUnrealizedGains = unrealizedGains - realizedGain;

  return {
    withdrawalAmount,
    realizedGain,
    taxableGain,
    newACB,
    newUnrealizedGains,
  };
}
