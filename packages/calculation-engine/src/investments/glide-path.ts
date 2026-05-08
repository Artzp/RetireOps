/**
 * Glide Path Model for Asset Allocation
 * @see docs/source-of-truth/06-investment-engine.md - Glide Path Model
 */

import { calculateAllocationReturn, type RiskProfile, RISK_PROFILES } from './returns.js';

/**
 * Glide path configuration
 */
export interface GlidePathConfig {
  /** Starting equity allocation (pre-retirement) */
  startingEquityAllocation: number;
  /** Target equity allocation at retirement */
  retirementEquityAllocation: number;
  /** Final equity allocation (late retirement) */
  finalEquityAllocation: number;
  /** Years before retirement to start glide */
  yearsBeforeRetirementToStart: number;
  /** Years after retirement to continue glide */
  yearsAfterRetirementToEnd: number;
}

/**
 * Default glide path configuration
 * @see docs/source-of-truth/06-investment-engine.md - Glide Path Model
 */
export const DEFAULT_GLIDE_PATH: GlidePathConfig = {
  startingEquityAllocation: 0.8, // 80% equity pre-retirement
  retirementEquityAllocation: 0.6, // 60% at retirement
  finalEquityAllocation: 0.3, // 30% in late retirement
  yearsBeforeRetirementToStart: 15, // Start glide 15 years before retirement
  yearsAfterRetirementToEnd: 20, // Continue for 20 years after retirement
};

/**
 * Calculate equity allocation based on glide path
 * @see docs/source-of-truth/06-investment-engine.md - Linear glide path example
 * @param currentAge Current age
 * @param retirementAge Target retirement age
 * @param config Glide path configuration
 * @returns Equity allocation percentage (0-1)
 */
export function calculateGlidePathAllocation(
  currentAge: number,
  retirementAge: number,
  config: GlidePathConfig = DEFAULT_GLIDE_PATH
): number {
  const yearsToRetirement = retirementAge - currentAge;
  const yearsFromRetirement = -yearsToRetirement; // Negative before retirement

  if (yearsFromRetirement < 0) {
    // Pre-retirement: higher equity allocation, decreasing toward retirement
    const glideStart = config.yearsBeforeRetirementToStart;

    if (yearsToRetirement >= glideStart) {
      // Haven't started glide yet
      return config.startingEquityAllocation;
    }

    // Linear interpolation from starting to retirement allocation
    const progress = 1 - yearsToRetirement / glideStart;
    const allocation =
      config.startingEquityAllocation -
      (config.startingEquityAllocation - config.retirementEquityAllocation) * progress;

    return Math.max(config.retirementEquityAllocation, allocation);
  } else {
    // Post-retirement: continue decreasing toward final allocation
    const glideEnd = config.yearsAfterRetirementToEnd;

    if (yearsFromRetirement >= glideEnd) {
      // Glide completed
      return config.finalEquityAllocation;
    }

    // Linear interpolation from retirement to final allocation
    const progress = yearsFromRetirement / glideEnd;
    const allocation =
      config.retirementEquityAllocation -
      (config.retirementEquityAllocation - config.finalEquityAllocation) * progress;

    return Math.max(config.finalEquityAllocation, allocation);
  }
}

/**
 * Calculate expected return based on glide path allocation
 * @param currentAge Current age
 * @param retirementAge Target retirement age
 * @param equityReturn Expected equity return
 * @param fixedReturn Expected fixed income return
 * @param config Glide path configuration
 * @returns Expected return for the year
 */
export function calculateGlidePathReturn(
  currentAge: number,
  retirementAge: number,
  equityReturn: number = 0.08,
  fixedReturn: number = 0.03,
  config: GlidePathConfig = DEFAULT_GLIDE_PATH
): number {
  const equityAllocation = calculateGlidePathAllocation(currentAge, retirementAge, config);
  return calculateAllocationReturn(equityAllocation, equityReturn, fixedReturn);
}

/**
 * Calculate volatility based on glide path allocation
 * @param currentAge Current age
 * @param retirementAge Target retirement age
 * @param equityVolatility Volatility of equity component
 * @param fixedVolatility Volatility of fixed income component
 * @param correlation Correlation between equity and fixed (-1 to 1)
 * @param config Glide path configuration
 * @returns Expected portfolio volatility
 */
export function calculateGlidePathVolatility(
  currentAge: number,
  retirementAge: number,
  equityVolatility: number = 0.16,
  fixedVolatility: number = 0.04,
  correlation: number = 0.2,
  config: GlidePathConfig = DEFAULT_GLIDE_PATH
): number {
  const equityAllocation = calculateGlidePathAllocation(currentAge, retirementAge, config);
  const fixedAllocation = 1 - equityAllocation;

  // Portfolio volatility with correlation
  // σp = sqrt(w1²σ1² + w2²σ2² + 2*w1*w2*σ1*σ2*ρ)
  const variance =
    Math.pow(equityAllocation, 2) * Math.pow(equityVolatility, 2) +
    Math.pow(fixedAllocation, 2) * Math.pow(fixedVolatility, 2) +
    2 * equityAllocation * fixedAllocation * equityVolatility * fixedVolatility * correlation;

  return Math.sqrt(variance);
}

/**
 * Project glide path allocations over time
 * @param startAge Starting age
 * @param endAge Ending age
 * @param retirementAge Target retirement age
 * @param config Glide path configuration
 * @returns Array of { age, equityAllocation, expectedReturn }
 */
export function projectGlidePath(
  startAge: number,
  endAge: number,
  retirementAge: number,
  config: GlidePathConfig = DEFAULT_GLIDE_PATH
): Array<{
  age: number;
  equityAllocation: number;
  expectedReturn: number;
  expectedVolatility: number;
}> {
  const projections: Array<{
    age: number;
    equityAllocation: number;
    expectedReturn: number;
    expectedVolatility: number;
  }> = [];

  for (let age = startAge; age <= endAge; age++) {
    const equityAllocation = calculateGlidePathAllocation(age, retirementAge, config);
    projections.push({
      age,
      equityAllocation,
      expectedReturn: calculateGlidePathReturn(age, retirementAge, 0.08, 0.03, config),
      expectedVolatility: calculateGlidePathVolatility(age, retirementAge, 0.16, 0.04, 0.2, config),
    });
  }

  return projections;
}

/**
 * Create glide path from risk profile
 * @param profile Starting risk profile
 * @returns Glide path configuration
 */
export function createGlidePathFromProfile(profile: RiskProfile): GlidePathConfig {
  const profileParams = RISK_PROFILES[profile];

  return {
    startingEquityAllocation: profileParams.equityAllocation,
    retirementEquityAllocation: Math.max(0.4, profileParams.equityAllocation - 0.2),
    finalEquityAllocation: Math.max(0.25, profileParams.equityAllocation - 0.4),
    yearsBeforeRetirementToStart: 15,
    yearsAfterRetirementToEnd: 20,
  };
}

/**
 * Age-based target allocation rules (common rule of thumb)
 */
export function ageBasedAllocation(age: number): number {
  // Traditional rule: equity % = 100 - age
  // Modern variant: equity % = 120 - age (more aggressive)
  return Math.max(0.2, Math.min(0.9, (120 - age) / 100));
}

/**
 * Target-date fund style allocation
 * @param yearsToRetirement Years until retirement
 * @returns Equity allocation percentage
 */
export function targetDateAllocation(yearsToRetirement: number): number {
  if (yearsToRetirement >= 40) return 0.9;
  if (yearsToRetirement >= 30) return 0.85;
  if (yearsToRetirement >= 20) return 0.75;
  if (yearsToRetirement >= 10) return 0.65;
  if (yearsToRetirement >= 5) return 0.55;
  if (yearsToRetirement >= 0) return 0.45;
  // Post-retirement
  if (yearsToRetirement >= -10) return 0.4;
  if (yearsToRetirement >= -20) return 0.35;
  return 0.3;
}
