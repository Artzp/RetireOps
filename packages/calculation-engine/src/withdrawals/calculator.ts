/**
 * Withdrawal Calculator
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Withdrawal Calculation Algorithm
 */

import {
  getRRIFMinimumRate,
  type LIFJurisdiction,
  getLIFMaximumRate,
  getLIFRules,
} from '@retireops/shared';
import type { WithdrawalStrategy } from './strategy.js';
import { getWithdrawalOrder, WITHDRAWAL_STRATEGIES } from './strategy.js';

/**
 * Account balances for withdrawal calculation
 */
export interface AccountBalances {
  rrsp: number;
  rrif: number;
  tfsa: number;
  nonRegistered: number;
  lira?: number;
  lif?: number;
}

/**
 * Withdrawal calculation input
 */
export interface WithdrawalCalculationInput {
  /** Account balances at start of year */
  balances: AccountBalances;
  /** Desired spending amount for the year */
  desiredSpending: number;
  /** Guaranteed income (CPP, OAS, pensions) */
  guaranteedIncome: number;
  /** Age at end of year */
  age: number;
  /** Withdrawal strategy to use */
  strategy?: WithdrawalStrategy;
  /** OAS clawback threshold (if avoiding clawback) */
  oasClawbackThreshold?: number;
  /** Current tax bracket ceiling (for tax optimization) */
  taxBracketCeiling?: number;
  /** Whether RRSP has been converted to RRIF */
  hasConvertedToRRIF?: boolean;
  /** LIF governing jurisdiction for withdrawal limits */
  lifJurisdiction?: LIFJurisdiction;
}

/**
 * Withdrawal result for a single account
 */
export interface AccountWithdrawal {
  accountType: string;
  mandatory: number;
  additional: number;
  total: number;
}

/**
 * Withdrawal calculation result
 * @see docs/source-of-truth/07-withdrawal-strategies.md - WithdrawalPlan interface
 */
export interface WithdrawalPlan {
  year?: number;
  age: number;

  /** Spending */
  desiredSpending: number;
  guaranteedIncome: number;
  netSpendingNeed: number;

  /** Withdrawals by account */
  withdrawals: {
    rrifMinimum: number;
    rrifAdditional: number;
    lifMinimum?: number;
    lifAdditional?: number;
    rrsp: number;
    nonRegistered: number;
    tfsa: number;
  };

  /** Results */
  totalWithdrawal: number;
  taxableWithdrawal: number;
  surplusReinvested: number;
  shortfall: number;

  /** Updated balances after withdrawal */
  updatedBalances: AccountBalances;
}

/**
 * Calculate RRIF minimum withdrawal
 * @see docs/source-of-truth/07-withdrawal-strategies.md - RRIF Minimums
 */
export function calculateRRIFMinimum(balance: number, age: number): number {
  if (age < 72 || balance <= 0) return 0;
  const rate = getRRIFMinimumRate(age);
  return balance * rate;
}

/**
 * Calculate LIF minimum and maximum withdrawals using CANSIM formula
 * @see docs/source-of-truth/07-withdrawal-strategies.md - LIF Minimums and Maximums
 * @see docs/source-of-truth/02-account-types.md - LIF-003
 */
export function calculateLIFWithdrawalLimits(
  balance: number,
  age: number,
  jurisdiction: LIFJurisdiction = 'federal'
): { minimum: number; maximum: number; minimumRate: number; maximumRate: number } {
  if (balance <= 0) return { minimum: 0, maximum: 0, minimumRate: 0, maximumRate: 0 };

  // LIF minimum is same as RRIF minimum (age 72+)
  const minimumRate = age >= 72 ? getRRIFMinimumRate(age) : 0;
  const minimum = balance * minimumRate;

  // LIF maximum uses CANSIM formula: r / (1 - (1+r)^-n)
  // where r = reference rate (6%), n = years to target age 90
  const rules = getLIFRules(jurisdiction);
  const maximumRate = getLIFMaximumRate(age, rules.referenceRate, rules.targetAge);
  const maximum = balance * maximumRate;

  return { minimum, maximum, minimumRate, maximumRate };
}

/**
 * Calculate annual spending need after guaranteed income
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Step 1: Determine Annual Spending Need
 */
export function calculateSpendingNeed(
  desiredSpending: number,
  guaranteedIncome: number,
  taxesPayable: number = 0,
  oneTimeExpenses: number = 0
): number {
  return desiredSpending + taxesPayable + oneTimeExpenses - guaranteedIncome;
}

/**
 * Execute withdrawal strategy
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Withdrawal Calculation Algorithm
 */
export function calculateWithdrawals(input: WithdrawalCalculationInput): WithdrawalPlan {
  const {
    balances,
    desiredSpending,
    guaranteedIncome,
    age,
    strategy,
    oasClawbackThreshold: _oasClawbackThreshold,
    taxBracketCeiling: _taxBracketCeiling,
    hasConvertedToRRIF = age >= 72,
    lifJurisdiction = 'federal',
  } = input;

  // Create mutable copies of balances
  const currentBalances: AccountBalances = { ...balances };
  const withdrawals = {
    rrifMinimum: 0,
    rrifAdditional: 0,
    lifMinimum: 0,
    lifAdditional: 0,
    rrsp: 0,
    nonRegistered: 0,
    tfsa: 0,
  };

  // Step 1: Calculate net spending need
  const netSpendingNeed = Math.max(0, desiredSpending - guaranteedIncome);

  // Step 2: Calculate mandatory withdrawals
  // @see docs/source-of-truth/07-withdrawal-strategies.md - Step 2: Apply Mandatory Withdrawals
  if (hasConvertedToRRIF && currentBalances.rrif > 0) {
    withdrawals.rrifMinimum = calculateRRIFMinimum(currentBalances.rrif, age);
  }

  if (currentBalances.lif && currentBalances.lif > 0) {
    const lifLimits = calculateLIFWithdrawalLimits(currentBalances.lif, age, lifJurisdiction);
    withdrawals.lifMinimum = lifLimits.minimum;
  }

  const mandatoryWithdrawals = withdrawals.rrifMinimum + (withdrawals.lifMinimum || 0);

  // Step 3: Calculate remaining need
  // @see docs/source-of-truth/07-withdrawal-strategies.md - Step 3: Calculate Remaining Need
  let remainingNeed = netSpendingNeed - mandatoryWithdrawals;
  let surplus = 0;

  if (remainingNeed < 0) {
    // Mandatory withdrawals exceed spending need
    surplus = Math.abs(remainingNeed);
    remainingNeed = 0;
  }

  // Step 4: Source additional withdrawals by priority
  // @see docs/source-of-truth/07-withdrawal-strategies.md - Step 4: Source Additional Withdrawals
  const activeStrategy = strategy ?? WITHDRAWAL_STRATEGIES.standard;
  const withdrawalOrder = getWithdrawalOrder(activeStrategy);

  for (const accountType of withdrawalOrder) {
    if (remainingNeed <= 0) break;

    let available = 0;
    let withdrawal = 0;

    switch (accountType) {
      case 'non_registered':
        available = currentBalances.nonRegistered;
        withdrawal = Math.min(remainingNeed, available);
        withdrawals.nonRegistered = withdrawal;
        currentBalances.nonRegistered -= withdrawal;
        break;

      case 'tfsa':
        available = currentBalances.tfsa;
        withdrawal = Math.min(remainingNeed, available);
        withdrawals.tfsa = withdrawal;
        currentBalances.tfsa -= withdrawal;
        break;

      case 'rrsp':
        // Can't withdraw from RRSP after conversion to RRIF
        if (!hasConvertedToRRIF) {
          available = currentBalances.rrsp;
          withdrawal = Math.min(remainingNeed, available);
          withdrawals.rrsp = withdrawal;
          currentBalances.rrsp -= withdrawal;
        }
        break;

      case 'rrif':
        // Additional RRIF withdrawal beyond minimum
        available = currentBalances.rrif - withdrawals.rrifMinimum;
        if (available > 0) {
          withdrawal = Math.min(remainingNeed, available);
          withdrawals.rrifAdditional = withdrawal;
          currentBalances.rrif -= withdrawal;
        }
        break;

      case 'lif':
        // Additional LIF withdrawal within maximum limit
        if (currentBalances.lif && currentBalances.lif > 0) {
          const lifLimits = calculateLIFWithdrawalLimits(balances.lif ?? 0, age, lifJurisdiction);
          const lifAvailable = Math.min(
            currentBalances.lif - (withdrawals.lifMinimum || 0),
            lifLimits.maximum - (withdrawals.lifMinimum || 0)
          );
          if (lifAvailable > 0) {
            withdrawal = Math.min(remainingNeed, lifAvailable);
            withdrawals.lifAdditional = withdrawal;
            currentBalances.lif -= withdrawal;
          }
        }
        break;
    }

    remainingNeed -= withdrawal;
  }

  // Update RRIF balance for minimum withdrawal
  if (withdrawals.rrifMinimum > 0) {
    currentBalances.rrif -= withdrawals.rrifMinimum;
  }
  if (withdrawals.lifMinimum && withdrawals.lifMinimum > 0 && currentBalances.lif) {
    currentBalances.lif -= withdrawals.lifMinimum;
  }

  // Calculate totals
  const totalWithdrawal =
    withdrawals.rrifMinimum +
    withdrawals.rrifAdditional +
    (withdrawals.lifMinimum || 0) +
    (withdrawals.lifAdditional || 0) +
    withdrawals.rrsp +
    withdrawals.nonRegistered +
    withdrawals.tfsa;

  // Taxable withdrawal = everything except TFSA
  const taxableWithdrawal =
    withdrawals.rrifMinimum +
    withdrawals.rrifAdditional +
    (withdrawals.lifMinimum || 0) +
    (withdrawals.lifAdditional || 0) +
    withdrawals.rrsp;
  // Note: non-registered capital gains handled separately

  return {
    age,
    desiredSpending,
    guaranteedIncome,
    netSpendingNeed,
    withdrawals,
    totalWithdrawal,
    taxableWithdrawal,
    surplusReinvested: surplus,
    shortfall: remainingNeed,
    updatedBalances: currentBalances,
  };
}

/**
 * Check if spending need can be met
 * @param balances Current account balances
 * @param spendingNeed Net spending need
 * @returns Whether balances can cover spending
 */
export function canMeetSpendingNeed(balances: AccountBalances, spendingNeed: number): boolean {
  const totalAvailable =
    balances.rrsp +
    balances.rrif +
    balances.tfsa +
    balances.nonRegistered +
    (balances.lira ?? 0) +
    (balances.lif ?? 0);

  return totalAvailable >= spendingNeed;
}

/**
 * Calculate years until depletion
 * @param balances Current account balances
 * @param annualSpendingNeed Annual net spending need
 * @param investmentReturn Expected annual return
 * @returns Estimated years until depletion (null if indefinite)
 */
export function estimateYearsUntilDepletion(
  balances: AccountBalances,
  annualSpendingNeed: number,
  investmentReturn: number
): number | null {
  if (annualSpendingNeed <= 0) return null;

  let totalBalance =
    balances.rrsp +
    balances.rrif +
    balances.tfsa +
    balances.nonRegistered +
    (balances.lira ?? 0) +
    (balances.lif ?? 0);

  // If return exceeds withdrawal rate, portfolio lasts indefinitely
  if (annualSpendingNeed / totalBalance < investmentReturn) {
    return null;
  }

  let years = 0;
  const maxYears = 100;

  while (totalBalance > 0 && years < maxYears) {
    totalBalance = totalBalance * (1 + investmentReturn) - annualSpendingNeed;
    years++;
  }

  return years < maxYears ? years : null;
}
