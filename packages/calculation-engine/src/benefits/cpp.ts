/**
 * CPP/QPP Benefit Calculations
 * @see docs/source-of-truth/05-government-benefits.md - CPP/QPP Section
 * @see docs/source-of-truth/18-pensions-2026.md - CPP 2026 parameter values
 */
import { CPP_ADJUSTMENT_FACTORS } from '@retireops/shared';
import { CPP_2026 } from '@retireops/shared/benefits';

const {
  EARLY_REDUCTION_PER_MONTH,
  LATE_INCREASE_PER_MONTH,
  EARLIEST_AGE,
  STANDARD_AGE,
  LATEST_AGE,
} = CPP_ADJUSTMENT_FACTORS;

/**
 * Calculate CPP adjustment factor based on start age
 * @see docs/source-of-truth/05-government-benefits.md - Early/Late Adjustment Factors
 */
export function calculateCPPAdjustmentFactor(startAge: number): number {
  if (startAge < EARLIEST_AGE || startAge > LATEST_AGE) {
    throw new Error(
      `CPP start age must be between ${String(EARLIEST_AGE)} and ${String(LATEST_AGE)}`
    );
  }

  if (startAge < STANDARD_AGE) {
    // Early start: 0.6% reduction per month
    const monthsEarly = (STANDARD_AGE - startAge) * 12;
    return 1 - monthsEarly * EARLY_REDUCTION_PER_MONTH;
  } else if (startAge > STANDARD_AGE) {
    // Late start: 0.7% increase per month
    const monthsLate = (startAge - STANDARD_AGE) * 12;
    return 1 + monthsLate * LATE_INCREASE_PER_MONTH;
  }

  return 1; // Standard age 65
}

/**
 * Calculate adjusted CPP benefit based on start age
 * @see docs/source-of-truth/05-government-benefits.md - Calculation Formula
 */
export function calculateCPPBenefit(expectedAmountAt65: number, startAge: number): number {
  const adjustmentFactor = calculateCPPAdjustmentFactor(startAge);
  return expectedAmountAt65 * adjustmentFactor;
}

/**
 * Apply inflation indexing to CPP benefit
 * @see docs/source-of-truth/05-government-benefits.md - Inflation Indexing
 */
export function indexCPPBenefit(baseAmount: number, inflationRate: number, years: number): number {
  return baseAmount * Math.pow(1 + inflationRate, years);
}

/**
 * Calculate CPP survivor benefit
 * @see docs/source-of-truth/05-government-benefits.md - CPP Survivor Benefits
 */
export function calculateCPPSurvivorBenefit(
  deceasedBenefitAmount: number,
  // per docs/source-of-truth/18-pensions-2026.md#2026-cpp-max-retirement-pension
  maxCPPAmount: number = CPP_2026.maxRetirementPensionAnnual // 1_507.65 × 12 = 18_091.80
): number {
  // Survivor receives 60% of deceased's benefit
  const survivorAmount = deceasedBenefitAmount * 0.6;
  const maxSurvivorAmount = maxCPPAmount * 0.6;

  return Math.min(survivorAmount, maxSurvivorAmount);
}

/**
 * Calculate combined CPP (own + survivor) capped at maximum
 */
export function calculateCombinedCPP(
  ownBenefit: number,
  survivorBenefit: number,
  // per docs/source-of-truth/18-pensions-2026.md#2026-cpp-max-retirement-pension
  maxCPPAmount: number = CPP_2026.maxRetirementPensionAnnual // 1_507.65 × 12 = 18_091.80
): number {
  return Math.min(ownBenefit + survivorBenefit, maxCPPAmount);
}

/**
 * Get CPP adjustment amounts table for all start ages
 * Useful for displaying options to users
 */
export function getCPPAdjustmentTable(
  expectedAmountAt65: number
): { age: number; factor: number; amount: number }[] {
  const results = [];

  for (let age = Number(EARLIEST_AGE); age <= Number(LATEST_AGE); age++) {
    const factor = calculateCPPAdjustmentFactor(age);
    results.push({
      age,
      factor,
      amount: expectedAmountAt65 * factor,
    });
  }

  return results;
}

/**
 * Calculate break-even age for CPP start age decision
 * @see docs/source-of-truth/05-government-benefits.md - Decision Support
 *
 * Returns the age at which cumulative benefits from later start exceed early start
 */
export function calculateCPPBreakEvenAge(
  expectedAmountAt65: number,
  earlyAge: number,
  laterAge: number
): number {
  const earlyBenefit = calculateCPPBenefit(expectedAmountAt65, earlyAge);
  const laterBenefit = calculateCPPBenefit(expectedAmountAt65, laterAge);

  // Years of additional payments for early start
  const yearsHeadStart = laterAge - earlyAge;

  // Cumulative head start amount
  const headStartTotal = earlyBenefit * yearsHeadStart;

  // Annual difference favoring later start
  const annualDifference = laterBenefit - earlyBenefit;

  if (annualDifference <= 0) {
    return Infinity; // Later start never catches up (shouldn't happen normally)
  }

  // Years after laterAge to catch up
  const yearsToCatchUp = headStartTotal / annualDifference;

  return laterAge + yearsToCatchUp;
}

/**
 * Check if eligible for CPP
 */
export function isEligibleForCPP(age: number): boolean {
  return age >= EARLIEST_AGE;
}

/**
 * Check if receiving maximum deferral benefit
 */
export function isMaxDeferral(startAge: number): boolean {
  return startAge >= LATEST_AGE;
}
