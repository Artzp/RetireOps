/**
 * LIF (Life Income Fund) Rate Constants
 * @see docs/source-of-truth/02-account-types.md - LIRA/LIF Section
 */

/**
 * Jurisdictions that govern LIRA/LIF pension legislation
 */
export type LIFJurisdiction =
  | 'federal'
  | 'AB'
  | 'BC'
  | 'MB'
  | 'NB'
  | 'NL'
  | 'NS'
  | 'ON'
  | 'PE'
  | 'QC'
  | 'SK';

/**
 * LIF rules configuration by jurisdiction
 */
export interface LIFJurisdictionRules {
  /** Display name for the jurisdiction */
  name: string;
  /** CANSIM reference rate used for maximum calculation */
  referenceRate: number;
  /** Target age for maximum calculation (typically 90) */
  targetAge: number;
  /** Minimum age to convert LIRA to LIF */
  minimumConversionAge: number;
  /** Whether one-time unlocking is allowed */
  allowsOneTimeUnlock: boolean;
  /** One-time unlock percentage (0-1) */
  oneTimeUnlockPercentage: number;
  /** Small balance threshold for full withdrawal */
  smallBalanceThreshold?: number;
  /** Financial hardship unlocking allowed */
  allowsFinancialHardshipUnlock: boolean;
  /** Shortened life expectancy unlocking allowed */
  allowsShortenedLifeUnlock: boolean;
}

/**
 * LIF rules by jurisdiction
 * @see docs/source-of-truth/02-account-types.md - Provincial LIF Rules
 *
 * Reference: CANSIM V122487 rate used is 6% (long-term bond yield assumption)
 */
export const LIF_RULES: Record<LIFJurisdiction, LIFJurisdictionRules> = {
  federal: {
    name: 'Federal (PBSA)',
    referenceRate: 0.06,
    targetAge: 90,
    minimumConversionAge: 55,
    allowsOneTimeUnlock: false,
    oneTimeUnlockPercentage: 0,
    allowsFinancialHardshipUnlock: true,
    allowsShortenedLifeUnlock: true,
  },
  AB: {
    name: 'Alberta',
    referenceRate: 0.06,
    targetAge: 90,
    minimumConversionAge: 50,
    allowsOneTimeUnlock: true,
    oneTimeUnlockPercentage: 0.5,
    allowsFinancialHardshipUnlock: true,
    allowsShortenedLifeUnlock: true,
  },
  BC: {
    name: 'British Columbia',
    referenceRate: 0.06,
    targetAge: 90,
    minimumConversionAge: 55,
    allowsOneTimeUnlock: false,
    oneTimeUnlockPercentage: 0,
    allowsFinancialHardshipUnlock: true,
    allowsShortenedLifeUnlock: true,
  },
  MB: {
    name: 'Manitoba',
    referenceRate: 0.06,
    targetAge: 90,
    minimumConversionAge: 55,
    allowsOneTimeUnlock: false,
    oneTimeUnlockPercentage: 0,
    smallBalanceThreshold: 23480, // 2024 threshold
    allowsFinancialHardshipUnlock: true,
    allowsShortenedLifeUnlock: true,
  },
  NB: {
    name: 'New Brunswick',
    referenceRate: 0.06,
    targetAge: 90,
    minimumConversionAge: 55,
    allowsOneTimeUnlock: false,
    oneTimeUnlockPercentage: 0,
    smallBalanceThreshold: 23480,
    allowsFinancialHardshipUnlock: true,
    allowsShortenedLifeUnlock: true,
  },
  NL: {
    name: 'Newfoundland and Labrador',
    referenceRate: 0.06,
    targetAge: 90,
    minimumConversionAge: 55,
    allowsOneTimeUnlock: false,
    oneTimeUnlockPercentage: 0,
    allowsFinancialHardshipUnlock: true,
    allowsShortenedLifeUnlock: true,
  },
  NS: {
    name: 'Nova Scotia',
    referenceRate: 0.06,
    targetAge: 90,
    minimumConversionAge: 55,
    allowsOneTimeUnlock: false,
    oneTimeUnlockPercentage: 0,
    allowsFinancialHardshipUnlock: true,
    allowsShortenedLifeUnlock: true,
  },
  ON: {
    name: 'Ontario',
    referenceRate: 0.06,
    targetAge: 90,
    minimumConversionAge: 55,
    allowsOneTimeUnlock: true,
    oneTimeUnlockPercentage: 0.5,
    smallBalanceThreshold: 23480,
    allowsFinancialHardshipUnlock: true,
    allowsShortenedLifeUnlock: true,
  },
  PE: {
    name: 'Prince Edward Island',
    referenceRate: 0.06,
    targetAge: 90,
    minimumConversionAge: 55,
    allowsOneTimeUnlock: false,
    oneTimeUnlockPercentage: 0,
    allowsFinancialHardshipUnlock: true,
    allowsShortenedLifeUnlock: true,
  },
  QC: {
    name: 'Quebec',
    referenceRate: 0.06,
    targetAge: 90,
    minimumConversionAge: 55,
    allowsOneTimeUnlock: false,
    oneTimeUnlockPercentage: 0,
    allowsFinancialHardshipUnlock: true,
    allowsShortenedLifeUnlock: true,
  },
  SK: {
    name: 'Saskatchewan',
    referenceRate: 0.06,
    targetAge: 90,
    minimumConversionAge: 55,
    allowsOneTimeUnlock: true,
    oneTimeUnlockPercentage: 0.5,
    allowsFinancialHardshipUnlock: true,
    allowsShortenedLifeUnlock: true,
  },
};

/**
 * Default jurisdiction for LIRA/LIF accounts
 */
export const DEFAULT_LIF_JURISDICTION: LIFJurisdiction = 'federal';

/**
 * Mandatory LIRA to LIF conversion age (same as RRSP to RRIF)
 */
export const MANDATORY_LIF_CONVERSION_AGE = 71;

/**
 * Get LIF rules for a jurisdiction
 * @param jurisdiction The jurisdiction code
 * @returns The LIF rules for the jurisdiction
 */
export function getLIFRules(jurisdiction: LIFJurisdiction): LIFJurisdictionRules {
  return LIF_RULES[jurisdiction];
}

/**
 * Get all LIF jurisdictions
 * @returns Array of jurisdiction codes and names
 */
export function getAllLIFJurisdictions(): Array<{ code: LIFJurisdiction; name: string }> {
  return Object.entries(LIF_RULES).map(([code, rules]) => ({
    code: code as LIFJurisdiction,
    name: rules.name,
  }));
}

/**
 * Calculate the LIF maximum withdrawal rate using the CANSIM formula
 *
 * Formula: referenceRate / (1 - (1 + referenceRate)^(-yearsToTarget))
 *
 * @param age Current age
 * @param referenceRate The CANSIM reference rate (default 6%)
 * @param targetAge Target age for calculation (default 90)
 * @returns Maximum withdrawal rate as decimal (e.g., 0.0625 for 6.25%)
 */
export function getLIFMaximumRate(
  age: number,
  referenceRate: number = 0.06,
  targetAge: number = 90
): number {
  const yearsToTarget = Math.max(1, targetAge - age);

  // Formula: r / (1 - (1 + r)^(-n))
  // where r = reference rate, n = years to target age
  const denominator = 1 - Math.pow(1 + referenceRate, -yearsToTarget);

  // Avoid division by zero (when yearsToTarget approaches 0)
  if (denominator === 0) {
    return 1; // 100% at target age
  }

  const maxRate = referenceRate / denominator;

  // Cap at 100%
  return Math.min(maxRate, 1);
}

/**
 * Check if a jurisdiction code is valid
 * @param code The jurisdiction code to check
 * @returns True if valid
 */
export function isValidLIFJurisdiction(code: string): code is LIFJurisdiction {
  return code in LIF_RULES;
}
