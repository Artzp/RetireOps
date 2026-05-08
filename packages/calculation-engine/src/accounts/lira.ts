/**
 * LIRA (Locked-In Retirement Account) Calculations
 * @see docs/source-of-truth/02-account-types.md - LIRA Section
 */
import { type LIFJurisdiction, getLIFRules, MANDATORY_LIF_CONVERSION_AGE } from '@retireops/shared';

/**
 * Result of LIRA to LIF conversion
 */
export interface LIRAToLIFConversionResult {
  lifBalance: number;
  unlockedAmount: number;
  conversionYear: number;
  firstWithdrawalYear: number;
  jurisdiction: LIFJurisdiction;
}

/**
 * Result of one-time unlock calculation
 */
export interface OneTimeUnlockResult {
  unlockedAmount: number;
  remainingBalance: number;
  percentageUnlocked: number;
}

/**
 * Check if LIRA can be converted to LIF based on age and jurisdiction
 * @param age Current age
 * @param jurisdiction Governing jurisdiction
 * @returns True if conversion is allowed
 * @see docs/source-of-truth/02-account-types.md - LIRA-001
 */
export function canConvertLIRAToLIF(age: number, jurisdiction: LIFJurisdiction): boolean {
  const rules = getLIFRules(jurisdiction);
  return age >= rules.minimumConversionAge;
}

/**
 * Check if LIRA must be converted to LIF (mandatory at age 71)
 * @param age Current age
 * @returns True if conversion is mandatory
 * @see docs/source-of-truth/02-account-types.md - LIRA-002
 */
export function mustConvertLIRAToLIF(age: number): boolean {
  return age >= MANDATORY_LIF_CONVERSION_AGE;
}

/**
 * Get the minimum age for LIRA to LIF conversion by jurisdiction
 * @param jurisdiction Governing jurisdiction
 * @returns Minimum conversion age
 */
export function getMinimumConversionAge(jurisdiction: LIFJurisdiction): number {
  return getLIFRules(jurisdiction).minimumConversionAge;
}

/**
 * Convert LIRA to LIF
 * @param balance LIRA balance
 * @param year Conversion year
 * @param jurisdiction Governing jurisdiction
 * @param applyOneTimeUnlock Whether to apply one-time unlocking (if available)
 * @returns Conversion result
 * @see docs/source-of-truth/02-account-types.md - LIRA-003
 */
export function convertLIRAToLIF(
  balance: number,
  year: number,
  jurisdiction: LIFJurisdiction,
  applyOneTimeUnlock: boolean = false
): LIRAToLIFConversionResult {
  let lifBalance = balance;
  let unlockedAmount = 0;

  // Apply one-time unlock if requested and allowed
  if (applyOneTimeUnlock) {
    const unlockResult = calculateOneTimeUnlockAmount(balance, jurisdiction, false);
    unlockedAmount = unlockResult.unlockedAmount;
    lifBalance = unlockResult.remainingBalance;
  }

  return {
    lifBalance,
    unlockedAmount,
    conversionYear: year,
    firstWithdrawalYear: year + 1,
    jurisdiction,
  };
}

/**
 * Check if one-time unlocking is available
 * @param jurisdiction Governing jurisdiction
 * @param hasUsedOneTimeUnlock Whether unlock has already been used
 * @returns True if unlocking is available
 * @see docs/source-of-truth/02-account-types.md - UNLOCK-001
 */
export function canUseOneTimeUnlock(
  jurisdiction: LIFJurisdiction,
  hasUsedOneTimeUnlock: boolean
): boolean {
  if (hasUsedOneTimeUnlock) {
    return false;
  }
  return getLIFRules(jurisdiction).allowsOneTimeUnlock;
}

/**
 * Calculate the one-time unlock amount
 * @param balance Current balance
 * @param jurisdiction Governing jurisdiction
 * @param hasUsedOneTimeUnlock Whether unlock has already been used
 * @returns Unlock calculation result
 * @see docs/source-of-truth/02-account-types.md - UNLOCK-002
 */
export function calculateOneTimeUnlockAmount(
  balance: number,
  jurisdiction: LIFJurisdiction,
  hasUsedOneTimeUnlock: boolean
): OneTimeUnlockResult {
  if (!canUseOneTimeUnlock(jurisdiction, hasUsedOneTimeUnlock)) {
    return {
      unlockedAmount: 0,
      remainingBalance: balance,
      percentageUnlocked: 0,
    };
  }

  const rules = getLIFRules(jurisdiction);
  const unlockedAmount = balance * rules.oneTimeUnlockPercentage;

  return {
    unlockedAmount,
    remainingBalance: balance - unlockedAmount,
    percentageUnlocked: rules.oneTimeUnlockPercentage,
  };
}

/**
 * Check if small balance unlocking is available
 * @param balance Current balance
 * @param jurisdiction Governing jurisdiction
 * @returns True if small balance unlocking is available
 */
export function canUseSmallBalanceUnlock(balance: number, jurisdiction: LIFJurisdiction): boolean {
  const rules = getLIFRules(jurisdiction);
  if (!rules.smallBalanceThreshold) {
    return false;
  }
  return balance <= rules.smallBalanceThreshold;
}

/**
 * Get the small balance threshold for a jurisdiction
 * @param jurisdiction Governing jurisdiction
 * @returns Threshold amount or undefined if not applicable
 */
export function getSmallBalanceThreshold(jurisdiction: LIFJurisdiction): number | undefined {
  return getLIFRules(jurisdiction).smallBalanceThreshold;
}

/**
 * Check if financial hardship unlocking is available
 * @param jurisdiction Governing jurisdiction
 * @returns True if hardship unlocking is available
 */
export function allowsFinancialHardshipUnlock(jurisdiction: LIFJurisdiction): boolean {
  return getLIFRules(jurisdiction).allowsFinancialHardshipUnlock;
}

/**
 * Check if shortened life expectancy unlocking is available
 * @param jurisdiction Governing jurisdiction
 * @returns True if shortened life unlocking is available
 */
export function allowsShortenedLifeUnlock(jurisdiction: LIFJurisdiction): boolean {
  return getLIFRules(jurisdiction).allowsShortenedLifeUnlock;
}

/**
 * Calculate years until mandatory LIRA conversion
 * @param currentAge Current age
 * @returns Years until mandatory conversion (0 if already required)
 */
export function yearsUntilMandatoryConversion(currentAge: number): number {
  return Math.max(0, MANDATORY_LIF_CONVERSION_AGE - currentAge);
}

/**
 * Determine if a LIRA should be auto-converted this year
 * @param age Age at end of year
 * @param balance LIRA balance
 * @returns True if auto-conversion should occur
 */
export function shouldAutoConvertLIRA(age: number, balance: number): boolean {
  return mustConvertLIRAToLIF(age) && balance > 0;
}
