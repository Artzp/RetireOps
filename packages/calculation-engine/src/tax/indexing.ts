/**
 * Inflation Indexing for Tax Tables (Issue 8)
 *
 * Base constants in `@retireops/shared` are tabled through 2026. For projection
 * years beyond the last tabled year, this module scales bracket thresholds,
 * basic personal amounts, and the OAS clawback threshold by compounded
 * inflation so that long-horizon projections don't drift into higher effective
 * tax as unindexed brackets "lag" nominal income.
 *
 * The base constants are NEVER mutated — each call returns fresh copies.
 *
 * @see docs/source-of-truth/04-tax-engine.md - Indexation
 */
import { AGE_CREDIT_2024, RRSP_LIMITS, type TaxBracket } from '@retireops/shared';
import { getFederalTaxBrackets, getFederalBasicPersonalAmount } from './federal-tax.js';
import { getOASClawbackThreshold } from './oas-clawback.js';

export interface IndexingOptions {
  /** Annual inflation rate used to index brackets (e.g. 0.021 for 2.1%). */
  inflationRate: number;
  /** Base year whose tabled values are the reference point (typically projection start). */
  baseYear: number;
}

/** Compounded inflation factor over `yearsElapsed` years. Clamps negatives to 0. */
export function inflationFactor(yearsElapsed: number, rate: number): number {
  if (yearsElapsed <= 0) return 1;
  return Math.pow(1 + rate, yearsElapsed);
}

/**
 * Scale bracket thresholds by `factor`, preserving `rate` and `Infinity` caps.
 * Returns a fresh array; inputs are not mutated.
 */
export function indexBrackets(brackets: TaxBracket[], factor: number): TaxBracket[] {
  if (factor === 1) return brackets.map((b) => ({ ...b }));
  return brackets.map((b) => ({
    min: b.min === 0 ? 0 : Math.round(b.min * factor),
    max: b.max === Infinity ? Infinity : Math.round(b.max * factor),
    rate: b.rate,
  }));
}

/** Scale a scalar (BPA, threshold) by `factor`. */
export function indexScalar(value: number, factor: number): number {
  if (factor === 1) return value;
  return Math.round(value * factor);
}

/**
 * Compute the inflation factor for a target projection year relative to the
 * last year for which we have tabled values. Used so that years covered by
 * real CRA tables pass through un-indexed, and only extrapolated years scale.
 */
export function getExtrapolationFactor(
  targetYear: number,
  lastTabledYear: number,
  options?: IndexingOptions
): number {
  if (!options) return 1;
  if (targetYear <= lastTabledYear) return 1;
  const yearsBeyond = targetYear - Math.max(lastTabledYear, options.baseYear);
  return inflationFactor(yearsBeyond, options.inflationRate);
}

/**
 * Per-year resolved tax constants. Values are already indexed for inflation
 * when `buildTaxYearParams` is given an `IndexingOptions`; otherwise they
 * equal the tabled values for `year`.
 *
 * Scope (Issue 8, narrower subset): federal brackets + BPA, age amount +
 * threshold, OAS clawback threshold, RRSP dollar limit. Provincial tables
 * and credits are deliberately excluded pending a follow-up.
 */
export interface TaxYearParams {
  year: number;
  federalBrackets: TaxBracket[];
  federalBpa: number;
  federalAgeAmount: number;
  federalAgeAmountThreshold: number;
  oasClawbackThreshold: number;
  rrspDollarLimit: number;
}

const FEDERAL_LAST_TABLED_YEAR = 2026;
const OAS_LAST_TABLED_YEAR = 2026;
const RRSP_LAST_TABLED_YEAR = 2025;
const AGE_CREDIT_LAST_TABLED_YEAR = 2024;

function getRRSPDollarLimit(year: number): number {
  if (year in RRSP_LIMITS) {
    return RRSP_LIMITS[year as keyof typeof RRSP_LIMITS].maxContribution;
  }
  return RRSP_LIMITS[RRSP_LAST_TABLED_YEAR as keyof typeof RRSP_LIMITS].maxContribution;
}

/**
 * Build a TaxYearParams for the given projection year. Without `options`,
 * returns tabled values unchanged. With `options`, indexes tabled values
 * for years past the last tabled year of each constant.
 */
export function buildTaxYearParams(year: number, options?: IndexingOptions): TaxYearParams {
  const fedFactor = getExtrapolationFactor(year, FEDERAL_LAST_TABLED_YEAR, options);
  const oasFactor = getExtrapolationFactor(year, OAS_LAST_TABLED_YEAR, options);
  const rrspFactor = getExtrapolationFactor(year, RRSP_LAST_TABLED_YEAR, options);
  const ageFactor = getExtrapolationFactor(year, AGE_CREDIT_LAST_TABLED_YEAR, options);

  return {
    year,
    federalBrackets: indexBrackets(getFederalTaxBrackets(year), fedFactor),
    federalBpa: indexScalar(getFederalBasicPersonalAmount(year), fedFactor),
    federalAgeAmount: indexScalar(AGE_CREDIT_2024.federal.ageAmount, ageFactor),
    federalAgeAmountThreshold: indexScalar(AGE_CREDIT_2024.federal.incomeThreshold, ageFactor),
    oasClawbackThreshold: indexScalar(getOASClawbackThreshold(year), oasFactor),
    rrspDollarLimit: indexScalar(getRRSPDollarLimit(year), rrspFactor),
  };
}
