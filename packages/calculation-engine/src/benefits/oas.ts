/**
 * OAS Benefit Calculations
 * @see docs/source-of-truth/05-government-benefits.md - OAS Section
 * @see docs/source-of-truth/18-pensions-2026.md - OAS 2026 parameter values
 */
import { OAS_ADJUSTMENT_FACTORS, OAS_RATES } from '@retireops/shared';
import { OAS_2026 } from '@retireops/shared/benefits';

const {
  DEFERRAL_INCREASE_PER_MONTH,
  EARLIEST_AGE,
  LATEST_AGE,
  FULL_RESIDENCY_YEARS,
  MINIMUM_RESIDENCY_YEARS,
} = OAS_ADJUSTMENT_FACTORS;

/**
 * Year-indexed OAS maximum annual amounts (full residency, age 65–74 and 75+).
 *
 * 2026 values are derived from the citation-anchored Q2 (current) monthly
 * amounts in `benefits-parameters/2026.ts` — the same source consumed by the
 * profile-wizard OAS estimator — so the engine and wizard agree on gross OAS.
 * Annual = monthly × 12.
 *
 * The year-indexed map structure is preserved so future annual parameter files
 * (2027+) slot in alongside 2026 without changing the lookup logic; for years
 * before the earliest known entry the engine falls back to the nearest table
 * (mainline projections are always >= 2026).
 */
const OAS_MAX_ANNUAL_AMOUNTS = {
  2026: {
    // per docs/source-of-truth/18-pensions-2026.md#2026-oas-q2-amount-65to74
    maxAnnualAge65To74: OAS_2026.q2.maxMonthlyAge65To74 * 12, // 743.05 × 12 = 8916.60
    // per docs/source-of-truth/18-pensions-2026.md#2026-oas-q2-amount-75plus
    maxAnnualAge75Plus: OAS_2026.q2.maxMonthlyAge75Plus * 12, // 817.36 × 12 = 9808.32
  },
} as const;

function getOASBenefitAmountsForYear(year: number) {
  const knownYears = Object.keys(OAS_MAX_ANNUAL_AMOUNTS)
    .map(Number)
    .sort((a, b) => a - b);
  const latestKnownYear = knownYears[knownYears.length - 1];
  if (latestKnownYear === undefined) {
    throw new Error('OAS benefit amounts are not configured');
  }
  let fallbackYear = latestKnownYear;

  for (let index = knownYears.length - 1; index >= 0; index--) {
    const knownYear = knownYears[index];
    if (knownYear !== undefined && knownYear <= year) {
      fallbackYear = knownYear;
      break;
    }
  }

  if (Object.hasOwn(OAS_MAX_ANNUAL_AMOUNTS, year)) {
    return OAS_MAX_ANNUAL_AMOUNTS[year as keyof typeof OAS_MAX_ANNUAL_AMOUNTS];
  }

  return OAS_MAX_ANNUAL_AMOUNTS[fallbackYear as keyof typeof OAS_MAX_ANNUAL_AMOUNTS];
}

/**
 * Calculate OAS residency factor
 * @see docs/source-of-truth/05-government-benefits.md - Eligibility
 */
export function calculateOASResidencyFactor(yearsOfResidence: number): number {
  if (yearsOfResidence < MINIMUM_RESIDENCY_YEARS) {
    return 0; // Not eligible
  }

  if (yearsOfResidence >= FULL_RESIDENCY_YEARS) {
    return 1; // Full benefit
  }

  // Partial benefit: pro-rated
  return yearsOfResidence / FULL_RESIDENCY_YEARS;
}

/**
 * Calculate OAS deferral increase factor
 * @see docs/source-of-truth/05-government-benefits.md - Deferral Adjustment
 */
export function calculateOASDeferralFactor(startAge: number): number {
  if (startAge < EARLIEST_AGE) {
    throw new Error(`OAS cannot start before age ${String(EARLIEST_AGE)}`);
  }

  if (startAge <= EARLIEST_AGE) {
    return 1; // No deferral
  }

  // Cap at max deferral age
  const effectiveAge = Math.min(startAge, LATEST_AGE);
  const monthsDeferred = (effectiveAge - EARLIEST_AGE) * 12;

  return 1 + monthsDeferred * DEFERRAL_INCREASE_PER_MONTH;
}

/**
 * Calculate age 75+ bonus factor
 * @see docs/source-of-truth/05-government-benefits.md - Age 75+ bonus
 */
export function calculateAge75Bonus(currentAge: number): number {
  return currentAge >= 75 ? 1 + OAS_RATES.age75Bonus : 1;
}

/**
 * Calculate full OAS entitlement based on residency
 */
export function calculateOASEntitlement(
  yearsOfResidence: number,
  year: number = 2024,
  age: number = 65
): number {
  const residencyFactor = calculateOASResidencyFactor(yearsOfResidence);

  if (residencyFactor === 0) {
    return 0; // Not eligible
  }

  const benefitAmounts = getOASBenefitAmountsForYear(year);

  // Get base amount based on age
  const baseAmount =
    age >= 75 ? benefitAmounts.maxAnnualAge75Plus : benefitAmounts.maxAnnualAge65To74;

  return baseAmount * residencyFactor;
}

/**
 * Calculate adjusted OAS benefit
 * @see docs/source-of-truth/05-government-benefits.md - Calculation Formula
 */
export function calculateOASBenefit(
  yearsOfResidence: number,
  startAge: number,
  currentAge: number,
  year: number = 2024
): number {
  // Get base entitlement
  const baseEntitlement = calculateOASEntitlement(yearsOfResidence, year, currentAge);

  if (baseEntitlement === 0) {
    return 0;
  }

  // Apply deferral factor
  const deferralFactor = calculateOASDeferralFactor(startAge);

  return baseEntitlement * deferralFactor;
}

/**
 * Apply inflation indexing to OAS benefit
 * @see docs/source-of-truth/05-government-benefits.md - OAS Indexing
 */
export function indexOASBenefit(baseAmount: number, inflationRate: number, years: number): number {
  return baseAmount * Math.pow(1 + inflationRate, years);
}

/**
 * Get OAS deferral amounts table for all start ages
 */
export function getOASDeferralTable(
  yearsOfResidence: number,
  year: number = 2024
): { age: number; factor: number; amount: number }[] {
  const results = [];

  for (let age = Number(EARLIEST_AGE); age <= Number(LATEST_AGE); age++) {
    const factor = calculateOASDeferralFactor(age);
    const baseEntitlement = calculateOASEntitlement(yearsOfResidence, year, age);
    results.push({
      age,
      factor,
      amount: baseEntitlement * factor,
    });
  }

  return results;
}

/**
 * Calculate break-even age for OAS deferral decision
 * @see docs/source-of-truth/05-government-benefits.md - Decision Support
 */
export function calculateOASBreakEvenAge(
  yearsOfResidence: number,
  earlyAge: number = 65,
  laterAge: number = 70
): number {
  const earlyBenefit = calculateOASBenefit(yearsOfResidence, earlyAge, earlyAge);
  const laterBenefit = calculateOASBenefit(yearsOfResidence, laterAge, laterAge);

  const yearsHeadStart = laterAge - earlyAge;
  const headStartTotal = earlyBenefit * yearsHeadStart;
  const annualDifference = laterBenefit - earlyBenefit;

  if (annualDifference <= 0) {
    return Infinity;
  }

  const yearsToCatchUp = headStartTotal / annualDifference;

  return laterAge + yearsToCatchUp;
}

/**
 * Check if eligible for OAS
 */
export function isEligibleForOAS(age: number, yearsOfResidence: number): boolean {
  return age >= EARLIEST_AGE && yearsOfResidence >= MINIMUM_RESIDENCY_YEARS;
}

/**
 * Check if currently receiving OAS (has started)
 */
export function isReceivingOAS(currentAge: number, oasStartAge: number): boolean {
  return currentAge >= oasStartAge;
}
