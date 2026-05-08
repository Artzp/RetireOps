/**
 * Default Values for Projections
 * @see docs/source-of-truth/11-development-roadmap.md
 */

/**
 * Default Assumption Values
 */
export const DEFAULT_ASSUMPTIONS = {
  inflationRate: 0.025, // 2.5%
  lifeExpectancy: 95,
  retirementAge: 65,
} as const;

/**
 * Default Investment Returns by Risk Profile
 */
export const DEFAULT_RETURNS = {
  conservative: 0.04, // 4% nominal
  moderate: 0.055, // 5.5% nominal
  aggressive: 0.07, // 7% nominal
} as const;

/**
 * Default Volatility (Standard Deviation) by Risk Profile
 * Used for Monte Carlo simulations
 */
export const DEFAULT_VOLATILITY = {
  conservative: 0.06, // 6%
  moderate: 0.1, // 10%
  aggressive: 0.15, // 15%
} as const;

/**
 * Risk Profile Type
 */
export type RiskProfile = keyof typeof DEFAULT_RETURNS;

/**
 * CPP Default Estimate
 * For users who don't have their Service Canada statement
 */
export const CPP_DEFAULT_ESTIMATE = {
  averagePercentOfMax: 0.55, // 55% of max is typical
  maxAt65_2024: 16375,
  averageAt65_2024: 9800, // 16375 * 0.55 ≈ 9000
} as const;

/**
 * Current Year for Calculations
 */
export const CURRENT_YEAR = 2024;
