/**
 * RRIF Account Calculations
 * @see docs/source-of-truth/02-account-types.md - RRIF Section
 */
import { getRRIFMinimumRate } from '@retireops/shared';

/**
 * Calculate RRIF minimum withdrawal
 * @see docs/source-of-truth/02-account-types.md - RRIF-002
 */
export function calculateRRIFMinimumWithdrawal(balance: number, age: number): number {
  const rate = getRRIFMinimumRate(age);
  return balance * rate;
}

/**
 * Calculate RRIF minimum withdrawal using younger spouse's age.
 *
 * Uses min(ownerAge, spouseAge) for the rate lookup. When the younger age is
 * below the tabled floor (e.g. spouse 60), the CRA pre-71 factor 1/(90−age)
 * applies via getRRIFMinimumRate — the election REDUCES the forced minimum, it
 * does NOT eliminate it (audit B-05; spouse 60 → 1/30 ≈ 3.333%).
 *
 * @see docs/source-of-truth/02-account-types.md - RRIF-005, RRIF-007, RRIF-008
 */
export function calculateRRIFMinimumWithYoungerSpouse(
  balance: number,
  ownerAge: number,
  spouseAge: number
): number {
  // Use younger age for lower (never zero) minimum
  const ageToUse = Math.min(ownerAge, spouseAge);
  return calculateRRIFMinimumWithdrawal(balance, ageToUse);
}

/**
 * Check if RRIF minimum withdrawal is required
 * @see docs/source-of-truth/02-account-types.md - RRIF-001
 */
export function isRRIFMinimumRequired(age: number): boolean {
  return age >= 72;
}

/**
 * Get RRIF minimum rate for display
 */
export function getRRIFMinimumRateForAge(age: number): number {
  return getRRIFMinimumRate(age) * 100; // Return as percentage
}

/**
 * Convert RRSP to RRIF
 */
export interface RRIFConversionResult {
  rrifBalance: number;
  conversionYear: number;
  firstWithdrawalYear: number;
}

export function convertRRSPToRRIF(
  rrspBalance: number,
  conversionYear: number
): RRIFConversionResult {
  return {
    rrifBalance: rrspBalance,
    conversionYear,
    firstWithdrawalYear: conversionYear + 1,
  };
}

/**
 * Calculate RRIF withdrawal with minimum check
 */
export interface RRIFWithdrawalResult {
  minimumRequired: number;
  actualWithdrawal: number;
  newBalance: number;
  taxableAmount: number;
}

export function processRRIFWithdrawal(
  balance: number,
  age: number,
  requestedWithdrawal: number,
  useYoungerSpouseAge: boolean = false,
  spouseAge?: number
): RRIFWithdrawalResult {
  // Calculate minimum
  let minimumRequired: number;

  if (useYoungerSpouseAge && spouseAge !== undefined) {
    minimumRequired = calculateRRIFMinimumWithYoungerSpouse(balance, age, spouseAge);
  } else {
    minimumRequired = calculateRRIFMinimumWithdrawal(balance, age);
  }

  // Actual withdrawal is at least the minimum
  const actualWithdrawal = Math.max(requestedWithdrawal, minimumRequired);

  // Cannot withdraw more than balance
  const finalWithdrawal = Math.min(actualWithdrawal, balance);

  return {
    minimumRequired,
    actualWithdrawal: finalWithdrawal,
    newBalance: balance - finalWithdrawal,
    taxableAmount: finalWithdrawal, // 100% taxable
  };
}

/**
 * Project RRIF balance over time with minimum withdrawals
 */
export function projectRRIFBalance(
  startingBalance: number,
  startAge: number,
  endAge: number,
  investmentReturn: number,
  additionalWithdrawal: number = 0
): { age: number; balance: number; withdrawal: number }[] {
  const projections = [];
  let balance = startingBalance;

  for (let age = startAge; age <= endAge; age++) {
    // Calculate minimum withdrawal
    const minimum = calculateRRIFMinimumWithdrawal(balance, age);
    const withdrawal = minimum + additionalWithdrawal;

    // Apply withdrawal
    const withdrawalAmount = Math.min(withdrawal, balance);
    balance -= withdrawalAmount;

    // Apply investment growth
    balance *= 1 + investmentReturn;

    projections.push({
      age,
      balance: Math.max(0, balance),
      withdrawal: withdrawalAmount,
    });

    if (balance <= 0) break;
  }

  return projections;
}
