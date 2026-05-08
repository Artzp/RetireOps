/**
 * Expected Outputs for Projection Tests
 *
 * Pre-calculated expected values for verification.
 * These values are approximations for sanity checks, not exact matches.
 *
 * Note: When calculation logic changes intentionally, these values
 * should be updated to match the new expected behavior.
 */

/**
 * Expected outputs for singlePersonBasic fixture
 *
 * 55 year old, $100k income, retiring at 65, living to 90
 * RRSP: $300k + $15k/yr, TFSA: $80k + $7k/yr, Non-reg: $100k
 */
export const singlePersonBasicExpected = {
  // Projection should cover 35 years (55 to 90)
  yearsInProjection: 35,

  // Pre-retirement years (55-64)
  preRetirementYears: 10,

  // Retirement years (65-90)
  retirementYears: 25,

  // First year (age 55) should have employment income
  firstYear: {
    age: 55,
    hasEmploymentIncome: true,
    employmentIncomeApprox: 100000,
    isRetired: false,
  },

  // Age 65 year should have CPP/OAS starting
  age65Year: {
    age: 65,
    hasCppIncome: true,
    hasOasIncome: true,
    isRetired: true,
  },

  // Summary expectations (approximate ranges)
  summary: {
    // Peak net worth should be substantial (growth + contributions)
    peakNetWorthMin: 800000,
    peakNetWorthMax: 2000000,

    // Should last to life expectancy for this well-funded scenario
    portfolioShouldLast: true,
    probabilityOfSuccess: 100,
  },
};

/**
 * Expected outputs for earlyRetirementInput fixture
 *
 * Early CPP at 60 should have reduced benefits
 * OAS doesn't start until 65
 */
export const earlyRetirementExpected = {
  // At age 60, should have CPP but no OAS
  age60Year: {
    hasCppIncome: true,
    hasOasIncome: false,
    isRetired: true,
  },

  // At age 65, both CPP and OAS
  age65Year: {
    hasCppIncome: true,
    hasOasIncome: true,
  },

  // Early CPP is reduced (0.6% per month before 65)
  // 60 months early = 36% reduction
  // But we use estimated CPP amount from input
};

/**
 * Expected outputs for underfundedInput fixture
 *
 * Low savings, high expenses should result in portfolio depletion
 */
export const underfundedExpected = {
  // Should NOT last to life expectancy (95)
  summary: {
    portfolioShouldLast: false,
    probabilityOfSuccessLessThan: 100,
    // Portfolio should deplete before age 95
    portfolioLongevityLessThan: 95,
  },
};

/**
 * Expected outputs for age70Input fixture
 *
 * Tests RRSP to RRIF conversion
 * @see docs/source-of-truth/02-account-types.md - RRIF-001, RRIF-002
 */
export const age70Expected = {
  // At age 71, RRSP should convert to RRIF
  age71Year: {
    // After conversion, RRSP balance should be 0
    rrspBalanceShouldBeZero: true,
  },

  // At age 72+, should have RRIF minimum withdrawals
  age72Year: {
    hasMinimumWithdrawal: true,
    // RRIF minimum at 72 is 5.40%
    minimumRatePercent: 5.4,
  },
};

/**
 * Expected tax relationships for provincial comparison
 *
 * With same $100k income:
 * - Alberta should have lowest provincial tax (10% flat to $148k)
 * - Quebec should have highest provincial tax
 * - Ontario in between
 */
export const provincialTaxExpected = {
  // Same income in different provinces
  sameIncomeComparison: {
    // Alberta should be lower than Ontario
    albertaLowerThanOntario: true,
    // Alberta should be lower than Quebec
    albertaLowerThanQuebec: true,
    // Ontario should be lower than Quebec
    ontarioLowerThanQuebec: true,
  },

  // Approximate first-year total tax (federal + provincial) for $100k income
  // These are rough estimates, actual values depend on credits
  approximateFirstYearTax: {
    ontario: { min: 20000, max: 30000 },
    alberta: { min: 18000, max: 28000 },
    quebec: { min: 25000, max: 35000 },
  },
};

/**
 * Federal tax bracket verification points
 * @see docs/source-of-truth/04-tax-engine.md - Federal Tax Brackets
 *
 * 2024 Federal brackets:
 * - 15% on first $55,867
 * - 20.5% on $55,867 to $111,733
 * - 26% on $111,733 to $173,205
 * - 29% on $173,205 to $246,752
 * - 33% on over $246,752
 */
export const federalTaxExpected = {
  // $100k income should be in second bracket
  income100k: {
    bracketRate: 0.205, // Marginal rate
    // Tax = $55,867 * 0.15 + ($100k - $55,867) * 0.205 = ~$17,430
    // Minus basic personal amount credit (~$2,356)
    // Approximate net federal tax: ~$15,000
    approximateFederalTax: { min: 14000, max: 16000 },
  },

  // $150k income reaches third bracket
  income150k: {
    bracketRate: 0.26, // Marginal rate
    approximateFederalTax: { min: 25000, max: 30000 },
  },
};

/**
 * Helper function to check if value is within range
 */
export function isWithinRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Helper function to check if value is approximately equal (within percentage)
 */
export function isApproximatelyEqual(
  actual: number,
  expected: number,
  tolerancePercent: number = 5
): boolean {
  const tolerance = expected * (tolerancePercent / 100);
  return Math.abs(actual - expected) <= tolerance;
}
