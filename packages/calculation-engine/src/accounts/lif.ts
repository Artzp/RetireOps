/**
 * LIF (Life Income Fund) Calculations
 * @see docs/source-of-truth/02-account-types.md - LIF Section
 */
import {
  type LIFJurisdiction,
  getLIFRules,
  getLIFMaximumRate,
  getRRIFMinimumRate,
} from '@retireops/shared';

function usesGreaterOfStatutoryOrPriorYearReturn(jurisdiction: LIFJurisdiction): boolean {
  return jurisdiction === 'ON' || jurisdiction === 'BC' || jurisdiction === 'NL';
}

/**
 * LIF withdrawal limits result
 */
export interface LIFWithdrawalLimits {
  minimum: number;
  maximum: number;
  minimumRate: number;
  maximumRate: number;
}

/**
 * LIF withdrawal result
 */
export interface LIFWithdrawalResult {
  minimumRequired: number;
  maximumAllowed: number;
  actualWithdrawal: number;
  newBalance: number;
  taxableAmount: number;
  wasConstrained: boolean;
  constraintType: 'none' | 'minimum' | 'maximum';
}

/**
 * LIF projection entry
 */
export interface LIFProjectionEntry {
  age: number;
  year: number;
  startingBalance: number;
  minimumWithdrawal: number;
  maximumWithdrawal: number;
  actualWithdrawal: number;
  growth: number;
  endingBalance: number;
}

/**
 * Calculate LIF minimum withdrawal (same as RRIF minimum)
 * @param balance LIF balance at start of year
 * @param age Age at end of year
 * @returns Minimum withdrawal amount
 * @see docs/source-of-truth/02-account-types.md - LIF-001
 */
export function calculateLIFMinimumWithdrawal(balance: number, age: number): number {
  if (balance <= 0 || age < 72) return 0;
  const rate = getRRIFMinimumRate(age);
  return balance * rate;
}

/**
 * Calculate LIF minimum withdrawal using younger spouse's age
 * @param balance LIF balance at start of year
 * @param ownerAge Owner's age at end of year
 * @param spouseAge Spouse's age at end of year
 * @returns Minimum withdrawal amount
 * @see docs/source-of-truth/02-account-types.md - LIF-002
 */
export function calculateLIFMinimumWithYoungerSpouse(
  balance: number,
  ownerAge: number,
  spouseAge: number
): number {
  const ageToUse = Math.min(ownerAge, spouseAge);
  return calculateLIFMinimumWithdrawal(balance, ageToUse);
}

/**
 * Calculate LIF maximum withdrawal using CANSIM formula
 * @param balance LIF balance at start of year
 * @param age Age at start of year
 * @param jurisdiction Governing jurisdiction
 * @param referenceRate Override reference rate (optional)
 * @returns Maximum withdrawal amount
 * @see docs/source-of-truth/02-account-types.md - LIF-003
 */
export function calculateLIFMaximumWithdrawal(
  balance: number,
  age: number,
  jurisdiction: LIFJurisdiction,
  referenceRate?: number,
  previousYearReturnRate?: number
): number {
  if (balance <= 0) return 0;

  const rules = getLIFRules(jurisdiction);
  const rate = referenceRate ?? rules.referenceRate;
  const statutoryMaximumRate = getLIFMaximumRate(age, rate, rules.targetAge);
  const maxRate =
    usesGreaterOfStatutoryOrPriorYearReturn(jurisdiction) && previousYearReturnRate !== undefined
      ? Math.max(statutoryMaximumRate, previousYearReturnRate)
      : statutoryMaximumRate;

  return balance * maxRate;
}

/**
 * Get LIF withdrawal limits (both minimum and maximum)
 * @param balance LIF balance at start of year
 * @param age Age at end of year (for minimum) / start of year (for maximum)
 * @param jurisdiction Governing jurisdiction
 * @param useYoungerSpouseAge Whether to use younger spouse's age for minimum
 * @param spouseAge Spouse's age if using younger spouse option
 * @returns Withdrawal limits
 * @see docs/source-of-truth/02-account-types.md - LIF-004
 */
export function getLIFWithdrawalLimits(
  balance: number,
  age: number,
  jurisdiction: LIFJurisdiction,
  useYoungerSpouseAge: boolean = false,
  spouseAge?: number,
  previousYearReturnRate?: number
): LIFWithdrawalLimits {
  if (balance <= 0) {
    return {
      minimum: 0,
      maximum: 0,
      minimumRate: 0,
      maximumRate: 0,
    };
  }

  // Minimum uses age at end of year (RRIF rules)
  // When using younger spouse option, use the younger age for determining both
  // the rate AND whether the minimum applies (age >= 72)
  let minimum: number;
  let minimumRate: number;

  if (useYoungerSpouseAge && spouseAge !== undefined) {
    const ageForMin = Math.min(age, spouseAge);
    minimumRate = ageForMin >= 72 ? getRRIFMinimumRate(ageForMin) : 0;
    minimum = balance * minimumRate;
  } else {
    minimumRate = age >= 72 ? getRRIFMinimumRate(age) : 0;
    minimum = balance * minimumRate;
  }

  // Maximum uses age at start of year
  const rules = getLIFRules(jurisdiction);
  const statutoryMaximumRate = getLIFMaximumRate(age, rules.referenceRate, rules.targetAge);
  const maximumRate =
    usesGreaterOfStatutoryOrPriorYearReturn(jurisdiction) && previousYearReturnRate !== undefined
      ? Math.max(statutoryMaximumRate, previousYearReturnRate)
      : statutoryMaximumRate;
  const maximum = balance * maximumRate;

  return {
    minimum,
    maximum,
    minimumRate,
    maximumRate,
  };
}

/**
 * Process a LIF withdrawal with constraint checking
 * @param balance LIF balance at start of year
 * @param age Age at end of year
 * @param requestedWithdrawal Desired withdrawal amount
 * @param jurisdiction Governing jurisdiction
 * @param useYoungerSpouseAge Whether to use younger spouse's age
 * @param spouseAge Spouse's age if using younger spouse option
 * @returns Withdrawal result with constraints applied
 * @see docs/source-of-truth/02-account-types.md - LIF-005
 */
export function processLIFWithdrawal(
  balance: number,
  age: number,
  requestedWithdrawal: number,
  jurisdiction: LIFJurisdiction,
  useYoungerSpouseAge: boolean = false,
  spouseAge?: number,
  previousYearReturnRate?: number
): LIFWithdrawalResult {
  const limits = getLIFWithdrawalLimits(
    balance,
    age,
    jurisdiction,
    useYoungerSpouseAge,
    spouseAge,
    previousYearReturnRate
  );

  let actualWithdrawal = requestedWithdrawal;
  let wasConstrained = false;
  let constraintType: 'none' | 'minimum' | 'maximum' = 'none';

  // Enforce minimum (must withdraw at least this amount)
  if (actualWithdrawal < limits.minimum) {
    actualWithdrawal = limits.minimum;
    wasConstrained = true;
    constraintType = 'minimum';
  }

  // Enforce maximum (cannot withdraw more than this)
  if (actualWithdrawal > limits.maximum) {
    actualWithdrawal = limits.maximum;
    wasConstrained = true;
    constraintType = 'maximum';
  }

  // Cannot withdraw more than balance
  actualWithdrawal = Math.min(actualWithdrawal, balance);

  return {
    minimumRequired: limits.minimum,
    maximumAllowed: limits.maximum,
    actualWithdrawal,
    newBalance: balance - actualWithdrawal,
    taxableAmount: actualWithdrawal, // 100% taxable
    wasConstrained,
    constraintType,
  };
}

/**
 * Check if LIF minimum withdrawal is required (age 72+)
 * @param age Age at end of year
 * @returns True if minimum withdrawal is required
 */
export function isLIFMinimumRequired(age: number): boolean {
  return age >= 72;
}

/**
 * Project LIF balance over time with withdrawals
 * @param balance Starting LIF balance
 * @param startAge Starting age
 * @param endAge Ending age
 * @param investmentReturn Annual investment return rate
 * @param targetWithdrawal Target annual withdrawal (will be constrained to limits)
 * @param jurisdiction Governing jurisdiction
 * @param startYear Starting year
 * @returns Array of projection entries
 */
export function projectLIFBalance(
  balance: number,
  startAge: number,
  endAge: number,
  investmentReturn: number,
  targetWithdrawal: number,
  jurisdiction: LIFJurisdiction,
  startYear: number = new Date().getFullYear()
): LIFProjectionEntry[] {
  const projections: LIFProjectionEntry[] = [];
  let currentBalance = balance;
  let year = startYear;

  for (let age = startAge; age <= endAge && currentBalance > 0; age++) {
    const limits = getLIFWithdrawalLimits(currentBalance, age, jurisdiction);

    // Apply withdrawal constraints
    let actualWithdrawal = targetWithdrawal;
    if (age >= 72) {
      actualWithdrawal = Math.max(actualWithdrawal, limits.minimum);
    }
    actualWithdrawal = Math.min(actualWithdrawal, limits.maximum);
    actualWithdrawal = Math.min(actualWithdrawal, currentBalance);

    // Apply withdrawal
    const balanceAfterWithdrawal = currentBalance - actualWithdrawal;

    // Apply growth
    const growth = balanceAfterWithdrawal * investmentReturn;
    const endingBalance = Math.max(0, balanceAfterWithdrawal + growth);

    projections.push({
      age,
      year,
      startingBalance: currentBalance,
      minimumWithdrawal: limits.minimum,
      maximumWithdrawal: limits.maximum,
      actualWithdrawal,
      growth,
      endingBalance,
    });

    currentBalance = endingBalance;
    year++;

    if (currentBalance <= 0) break;
  }

  return projections;
}

/**
 * Calculate total LIF income over a projection period
 * @param projections LIF projection entries
 * @returns Total withdrawals over the period
 */
export function calculateTotalLIFIncome(projections: LIFProjectionEntry[]): number {
  return projections.reduce((sum, entry) => sum + entry.actualWithdrawal, 0);
}

/**
 * Determine optimal LIF withdrawal amount to minimize taxes while meeting spending needs
 * This is a simplified heuristic - real optimization would consider full tax situation
 * @param balance LIF balance
 * @param age Current age
 * @param jurisdiction Governing jurisdiction
 * @param spendingNeed Required spending from LIF
 * @param otherIncome Income from other sources (affects optimal withdrawal)
 * @returns Suggested withdrawal amount
 */
export function suggestOptimalLIFWithdrawal(
  balance: number,
  age: number,
  jurisdiction: LIFJurisdiction,
  spendingNeed: number,
  _otherIncome: number = 0
): number {
  const limits = getLIFWithdrawalLimits(balance, age, jurisdiction);

  // Start with spending need
  let suggested = spendingNeed;

  // Ensure we meet minimum
  suggested = Math.max(suggested, limits.minimum);

  // Cap at maximum
  suggested = Math.min(suggested, limits.maximum);

  // Cap at balance
  suggested = Math.min(suggested, balance);

  return suggested;
}

/**
 * Get the LIF maximum rate for display purposes
 * @param age Current age
 * @param jurisdiction Governing jurisdiction
 * @returns Maximum rate as percentage (e.g., 6.25 for 6.25%)
 */
export function getLIFMaximumRateForAge(age: number, jurisdiction: LIFJurisdiction): number {
  const rules = getLIFRules(jurisdiction);
  return getLIFMaximumRate(age, rules.referenceRate, rules.targetAge) * 100;
}

/**
 * Get the LIF minimum rate for display purposes (same as RRIF)
 * @param age Current age
 * @returns Minimum rate as percentage (e.g., 5.28 for 5.28%)
 */
export function getLIFMinimumRateForAge(age: number): number {
  return getRRIFMinimumRate(age) * 100;
}
