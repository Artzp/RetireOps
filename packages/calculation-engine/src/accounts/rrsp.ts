/**
 * RRSP Account Calculations
 * @see docs/source-of-truth/02-account-types.md - RRSP Section
 */
import { RRSP_LIMITS, AGE_MILESTONES } from '@retireops/shared';

/**
 * Get RRSP contribution limit for a given year
 * @see docs/source-of-truth/02-account-types.md - RRSP-002, RRSP-003
 */
export function getRRSPAnnualLimit(year: number): number {
  if (year in RRSP_LIMITS) {
    return RRSP_LIMITS[year as keyof typeof RRSP_LIMITS].maxContribution;
  }
  // Default to latest known
  return RRSP_LIMITS[2025].maxContribution;
}

/**
 * Calculate RRSP contribution room based on earned income
 * @see docs/source-of-truth/02-account-types.md - RRSP-002
 */
export function calculateRRSPContributionRoom(
  earnedIncome: number,
  previousUnusedRoom: number,
  year: number
): number {
  const annualLimit = getRRSPAnnualLimit(year);
  const limits =
    year in RRSP_LIMITS ? RRSP_LIMITS[year as keyof typeof RRSP_LIMITS] : RRSP_LIMITS[2025];

  // 18% of previous year's earned income, up to annual max
  const currentYearRoom = Math.min(earnedIncome * limits.earnedIncomeRate, annualLimit);

  // Add unused room from previous years
  return currentYearRoom + previousUnusedRoom;
}

/**
 * Check if RRSP contribution is allowed based on age
 * @see docs/source-of-truth/02-account-types.md - RRSP-001, VR-RRSP-001
 */
export function canContributeToRRSP(age: number): boolean {
  return age <= AGE_MILESTONES.RRSP_CONTRIBUTION_DEADLINE_AGE;
}

/**
 * Check if RRSP must convert to RRIF
 * @see docs/source-of-truth/02-account-types.md - RRSP-007
 */
export function mustConvertRRSPToRRIF(age: number): boolean {
  return age >= AGE_MILESTONES.RRSP_TO_RRIF_CONVERSION_AGE;
}

/**
 * Get RRSP withholding tax rate
 * @see docs/source-of-truth/02-account-types.md - RRSP-008, RRSP-009, RRSP-010
 */
export function getRRSPWithholdingTaxRate(
  withdrawalAmount: number,
  isQuebec: boolean = false
): number {
  if (isQuebec) {
    // Quebec has lower federal withholding (provincial added separately)
    if (withdrawalAmount <= 5000) return 0.05;
    if (withdrawalAmount <= 15000) return 0.1;
    return 0.15;
  }

  // Rest of Canada
  if (withdrawalAmount <= 5000) return 0.1;
  if (withdrawalAmount <= 15000) return 0.2;
  return 0.3;
}

/**
 * Calculate RRSP withdrawal tax withheld
 */
export function calculateRRSPWithholdingTax(
  withdrawalAmount: number,
  isQuebec: boolean = false
): number {
  const rate = getRRSPWithholdingTaxRate(withdrawalAmount, isQuebec);
  return withdrawalAmount * rate;
}

/**
 * Validate RRSP contribution
 * @see docs/source-of-truth/02-account-types.md - VR-RRSP-002
 */
export function validateRRSPContribution(
  contribution: number,
  availableRoom: number,
  age: number
): { valid: boolean; error?: string } {
  if (!canContributeToRRSP(age)) {
    return {
      valid: false,
      error: 'RRSP contributions not permitted after age 71',
    };
  }

  if (contribution > availableRoom) {
    return {
      valid: false,
      error: `Contribution of ${String(contribution)} exceeds available room of ${String(availableRoom)}`,
    };
  }

  return { valid: true };
}

/**
 * Calculate tax benefit from RRSP contribution
 */
export function calculateRRSPTaxBenefit(contribution: number, marginalTaxRate: number): number {
  return contribution * marginalTaxRate;
}

/**
 * Process RRSP contribution
 */
export interface RRSPContributionResult {
  newBalance: number;
  newContributionRoom: number;
  taxBenefit: number;
}

export function processRRSPContribution(
  currentBalance: number,
  contribution: number,
  availableRoom: number,
  marginalTaxRate: number
): RRSPContributionResult {
  const newBalance = currentBalance + contribution;
  const newContributionRoom = availableRoom - contribution;
  const taxBenefit = calculateRRSPTaxBenefit(contribution, marginalTaxRate);

  return {
    newBalance,
    newContributionRoom,
    taxBenefit,
  };
}
