/**
 * Rate Constants
 * @see docs/source-of-truth/02-account-types.md
 * @see docs/source-of-truth/05-government-benefits.md
 */

/**
 * RRIF Minimum Withdrawal Rates by Age
 * @see docs/source-of-truth/02-account-types.md — RRIF-002
 * @see CRA IT-500R / Income Tax Act, Schedule 2 — prescribed RRIF minimum factors
 */
export const RRIF_MINIMUM_RATES: Record<number, number> = {
  65: 0.04,
  66: 0.0417,
  67: 0.0435,
  68: 0.0455,
  69: 0.0476,
  70: 0.05,
  71: 0.0528,
  72: 0.054,
  73: 0.0553,
  74: 0.0567,
  75: 0.0582,
  76: 0.0598,
  77: 0.0617,
  78: 0.0636,
  79: 0.0658,
  80: 0.0682,
  81: 0.0708,
  82: 0.0738,
  83: 0.0771,
  84: 0.0808,
  85: 0.0851,
  86: 0.0899,
  87: 0.0955,
  88: 0.1021,
  89: 0.1099,
  90: 0.1192,
  91: 0.1306,
  92: 0.1449,
  93: 0.1634,
  94: 0.1879,
};

/**
 * RRIF minimum rate for age 95 and older.
 * @see docs/source-of-truth/02-account-types.md — RRIF-002
 * @see CRA IT-500R / Income Tax Act, Schedule 2
 */
export const RRIF_MINIMUM_RATE_95_PLUS = 0.2;

/**
 * Look up the CRA-prescribed RRIF minimum withdrawal rate for a given age.
 *
 * For ages below the tabled floor (65) the CRA pre-71 general factor `1/(90−age)`
 * applies — it is NEVER zero (Income Tax Regulation 7308(4)). The table values
 * for ages 65–70 are exactly `1/(90−age)`, so extending the formula below 65 is
 * continuous; ages 71–94 use the separately prescribed table; 95+ is fixed 20%.
 *
 * This sub-65 path is only reachable through the younger-spouse election
 * (RRIF-005/RRIF-008): a normal RRIF holder has no mandatory minimum until the
 * year after conversion (RRIF-001, age ~72), so the owner's own age is never
 * below 65 here. The election must REDUCE the forced minimum, not eliminate it
 * (audit B-05).
 *
 * @see docs/source-of-truth/02-account-types.md — RRIF-002, RRIF-007, RRIF-008
 * @see CRA IT-500R / Income Tax Act, Income Tax Regulation 7308(4)
 */
export function getRRIFMinimumRate(age: number): number {
  if (age >= 95) return RRIF_MINIMUM_RATE_95_PLUS;
  // Ages below the tabled floor use the CRA pre-71 factor 1/(90−age), never zero
  // (RRIF-007). Floor the age at 1 to avoid a non-sensical divide for invalid input.
  if (age < 65) return 1 / (90 - Math.max(age, 1));
  return RRIF_MINIMUM_RATES[age] ?? 1 / (90 - age);
}

/**
 * CPP Adjustment Rates
 * @see docs/source-of-truth/05-government-benefits.md - Early/Late Adjustment Factors
 */
export const CPP_RATES = {
  earlyReductionPerMonth: 0.006, // 0.6% per month before 65
  lateIncreasePerMonth: 0.007, // 0.7% per month after 65
  maxMonthsEarly: 60, // 5 years early = 36% reduction
  maxMonthsLate: 60, // 5 years late = 42% increase
} as const;

/**
 * OAS Rates
 * @see docs/source-of-truth/05-government-benefits.md - OAS Section
 */
export const OAS_RATES = {
  deferralIncreasePerMonth: 0.006, // 0.6% per month after 65
  maxDeferralMonths: 60, // 5 years = 36% increase
  age75Bonus: 0.1, // 10% increase at age 75
  clawbackRate: 0.15, // 15% of income over threshold
} as const;

/**
 * @deprecated(v4.8+) See `packages/shared/src/benefits-parameters/2026.ts#OAS_2026`
 * for the citation-anchored 2026 values. This multi-year record is kept for
 * legacy engine reads; engine migration to OAS_2026 is deferred to v4.8+.
 *
 * OAS Clawback Thresholds
 * @see docs/source-of-truth/05-government-benefits.md - OAS Clawback
 * @see docs/source-of-truth/04-tax-engine.md - OAS Clawback
 */
export const OAS_CLAWBACK_THRESHOLDS = {
  2024: {
    threshold: 90997,
    fullClawbackAge65To74: 148451,
    fullClawbackAge75Plus: 154196,
  },
  2025: {
    threshold: 93454,
    fullClawbackAge65To74: 152062,
    fullClawbackAge75Plus: 157923,
  },
  2026: {
    threshold: 95323,
    fullClawbackAge65To74: 154753,
    fullClawbackAge75Plus: 160696,
  },
} as const;

// REMOVED (audit Batch 7, 2026-06-10): the deprecated `BENEFIT_AMOUNTS_2024`
// and `OAS_BENEFIT_AMOUNTS` constants were deleted once grep showed zero
// non-test consumers. The benefits engine reads the citation-anchored
// `packages/shared/src/benefits-parameters/2026.ts` (OAS_2026 / GIS_2026 /
// CPP_2026) since audit findings A-01/A-02/A-03 landed.

/**
 * Dividend Tax Rates
 * @see docs/source-of-truth/04-tax-engine.md - Dividend Tax Treatment
 */
export const DIVIDEND_RATES = {
  eligibleGrossUp: 0.38,
  eligibleFederalCredit: 0.150198,
  nonEligibleGrossUp: 0.15,
  nonEligibleFederalCredit: 0.090301,
} as const;

/**
 * Capital Gains Inclusion Rate
 * @see docs/source-of-truth/02-account-types.md - Non-Registered Section
 */
export const CAPITAL_GAINS_RATES = {
  standardInclusionRate: 0.5,
  enhancedInclusionRate: 0.6667,
  enhancedThreshold: 250000, // Annual threshold for enhanced rate
} as const;
