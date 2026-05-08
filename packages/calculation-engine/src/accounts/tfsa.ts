/**
 * TFSA Account Calculations
 * @see docs/source-of-truth/02-account-types.md - TFSA Section
 */
import { TFSA_ANNUAL_LIMITS, TFSA_CUMULATIVE_LIMITS } from '@retireops/shared';

/**
 * Get TFSA annual contribution limit for a given year
 * @see docs/source-of-truth/02-account-types.md - TFSA-001, TFSA-002
 */
export function getTFSAAnnualLimit(year: number): number {
  return TFSA_ANNUAL_LIMITS[year] ?? 7000; // Default to latest known
}

/**
 * Get TFSA cumulative limit for a given year
 * @see docs/source-of-truth/02-account-types.md - TFSA-003, TFSA-004
 */
export function getTFSACumulativeLimit(year: number): number {
  if (year >= 2025) return TFSA_CUMULATIVE_LIMITS[2025] ?? 102000;
  if (year >= 2024) return TFSA_CUMULATIVE_LIMITS[2024] ?? 95000;

  // Calculate historical cumulative
  let cumulative = 0;
  for (let y = 2009; y <= year; y++) {
    cumulative += TFSA_ANNUAL_LIMITS[y] ?? 0;
  }
  return cumulative;
}

/**
 * Calculate TFSA contribution room
 * @see docs/source-of-truth/02-account-types.md - TFSA-008
 */
export function calculateTFSAContributionRoom(
  previousRoom: number,
  withdrawalsLastYear: number,
  year: number
): number {
  const annualLimit = getTFSAAnnualLimit(year);

  // Room = previous unused room + new annual limit + previous year withdrawals
  return previousRoom + annualLimit + withdrawalsLastYear;
}

/**
 * Check if TFSA contribution is valid
 */
export function isValidTFSAContribution(contribution: number, availableRoom: number): boolean {
  return contribution <= availableRoom;
}

/**
 * Check if eligible for TFSA (age 18+)
 * @see docs/source-of-truth/02-account-types.md - TFSA-010
 */
export function isEligibleForTFSA(age: number): boolean {
  return age >= 18;
}

/**
 * TFSA has no tax implications on withdrawal
 * @see docs/source-of-truth/02-account-types.md - TFSA-007
 */
export function calculateTFSAWithdrawalTax(): number {
  return 0; // Always tax-free
}

/**
 * TFSA withdrawal does not affect OAS clawback
 * @see docs/source-of-truth/02-account-types.md - TFSA-009
 */
export function tfsaAffectsOASClawback(): boolean {
  return false;
}

/**
 * Process TFSA contribution
 */
export interface TFSAContributionResult {
  newBalance: number;
  newContributionRoom: number;
  valid: boolean;
  error?: string;
}

export function processTFSAContribution(
  currentBalance: number,
  contribution: number,
  availableRoom: number,
  age: number
): TFSAContributionResult {
  if (!isEligibleForTFSA(age)) {
    return {
      newBalance: currentBalance,
      newContributionRoom: availableRoom,
      valid: false,
      error: 'Must be 18 or older to contribute to TFSA',
    };
  }

  if (!isValidTFSAContribution(contribution, availableRoom)) {
    return {
      newBalance: currentBalance,
      newContributionRoom: availableRoom,
      valid: false,
      error: `Contribution of ${String(contribution)} exceeds available room of ${String(availableRoom)}`,
    };
  }

  return {
    newBalance: currentBalance + contribution,
    newContributionRoom: availableRoom - contribution,
    valid: true,
  };
}

/**
 * Process TFSA withdrawal
 */
export interface TFSAWithdrawalResult {
  withdrawalAmount: number;
  newBalance: number;
  roomRestoredNextYear: number;
  taxableAmount: number;
}

export function processTFSAWithdrawal(
  currentBalance: number,
  withdrawalAmount: number
): TFSAWithdrawalResult {
  const actualWithdrawal = Math.min(withdrawalAmount, currentBalance);

  return {
    withdrawalAmount: actualWithdrawal,
    newBalance: currentBalance - actualWithdrawal,
    roomRestoredNextYear: actualWithdrawal, // Room comes back next year
    taxableAmount: 0, // Tax-free
  };
}

/**
 * Project TFSA growth over time
 */
export function projectTFSABalance(
  startingBalance: number,
  annualContribution: number,
  investmentReturn: number,
  years: number
): { year: number; balance: number }[] {
  const projections = [];
  let balance = startingBalance;

  for (let year = 1; year <= years; year++) {
    // Add contribution at start of year
    balance += annualContribution;

    // Apply investment growth
    balance *= 1 + investmentReturn;

    projections.push({
      year,
      balance,
    });
  }

  return projections;
}
