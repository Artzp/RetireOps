/**
 * Contribution Limits
 * @see docs/source-of-truth/02-account-types.md
 */

/**
 * RRSP Contribution Limits
 * @see docs/source-of-truth/02-account-types.md - RRSP Section
 */
export const RRSP_LIMITS = {
  2024: {
    maxContribution: 31560,
    earnedIncomeRate: 0.18,
  },
  2025: {
    maxContribution: 32490,
    earnedIncomeRate: 0.18,
  },
} as const;

/**
 * TFSA Contribution Limits
 * @see docs/source-of-truth/02-account-types.md - TFSA Section
 */
export const TFSA_ANNUAL_LIMITS: Record<number, number> = {
  2009: 5000,
  2010: 5000,
  2011: 5000,
  2012: 5000,
  2013: 5500,
  2014: 5500,
  2015: 10000,
  2016: 5500,
  2017: 5500,
  2018: 5500,
  2019: 6000,
  2020: 6000,
  2021: 6000,
  2022: 6000,
  2023: 6500,
  2024: 7000,
  2025: 7000,
  2026: 7000,
  2027: 7000,
  2028: 7000,
  2029: 7000,
  2030: 7000,
  2031: 7000,
  2032: 7000,
  2033: 7000,
  2034: 7000,
  2035: 7000,
  2036: 7000,
  2037: 7000,
  2038: 7000,
  2039: 7000,
  2040: 7000,
  2041: 7000,
  2042: 7000,
  2043: 7000,
  2044: 7000,
  2045: 7000,
};

export const TFSA_CUMULATIVE_LIMITS: Record<number, number> = {
  2024: 95000,
  2025: 102000,
};

/**
 * FHSA Contribution Limits
 * @see docs/source-of-truth/02-account-types.md - FHSA Section
 */
export const FHSA_LIMITS = {
  annualLimit: 8000,
  lifetimeLimit: 40000,
  /** Max unused annual room that carries forward into the following year (M005/S01). */
  carryForwardLimit: 8000,
  /** Absolute per-year contribution ceiling (annual + one year of carry-forward). */
  singleYearCap: 16000,
} as const;

/**
 * CPP/QPP Maximum Pensionable Earnings
 */
export const CPP_YMPE = {
  2024: 68500,
  2025: 71300, // Projected
} as const;
