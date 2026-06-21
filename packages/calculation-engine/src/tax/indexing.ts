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
import {
  RRSP_LIMITS,
  type TaxBracket,
  type ProvinceCode,
  getProvincialTaxTables,
  getAgeCreditTable,
  getPensionIncomeCreditTable,
  getARELTable,
} from '@retireops/shared';
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
 * Calendar years to compound OAS gross indexation, anchored to the OAS
 * parameter base year (2026) — the SAME anchor the OAS clawback threshold uses
 * inside `buildTaxYearParams` (audit A-08). Returns `max(0, year − max(2026,
 * baseYear))` so OAS gross and the clawback threshold compound on a single
 * calendar clock regardless of when the person starts receiving OAS.
 *
 * `baseYear` is the projection start year (`year − yearsFromProjectionStart`),
 * matching the `IndexingOptions.baseYear` threaded into `buildTaxYearParams`.
 *
 * @see docs/source-of-truth/18-pensions-2026.md - OAS indexation
 * @see docs/audit/AUDIT-2026-06-10.internal.md A-08
 */
export function getOASIndexationYears(year: number, baseYear: number): number {
  return Math.max(0, year - Math.max(OAS_LAST_TABLED_YEAR, baseYear));
}

/**
 * Per-province indexed credit dollar amounts. Only the dollar amounts are
 * indexed for extrapolation; the (doc-gapped) phase-out thresholds, reduction
 * rates, and credit rates are passed through unchanged from the tabled set.
 */
export interface ProvincialCreditParams {
  /** Provincial age amount (65+), indexed. */
  ageAmount: number;
  /** Provincial age-amount phase-out income threshold, indexed. */
  ageAmountThreshold: number;
  /** Provincial age-amount reduction rate (not indexed). */
  ageReductionRate: number;
  /** Provincial age-credit rate = lowest provincial bracket rate (not indexed). */
  ageCreditRate: number;
  /** Provincial pension-income credit max amount, indexed. */
  pensionMaxAmount: number;
  /** Provincial pension-credit rate = lowest provincial bracket rate (not indexed). */
  pensionCreditRate: number;
}

/** Quebec AREL indexed dollar amounts (age + retirement-income combined credit). */
export interface ARELParams {
  ageAmount: number;
  retirementIncomeAmount: number;
  livingAloneAmount: number;
  threshold: number;
  reductionRate: number;
  creditRate: number;
}

/**
 * Per-year resolved tax constants. Values are already indexed for inflation
 * when `buildTaxYearParams` is given an `IndexingOptions`; otherwise they
 * equal the tabled values for `year`.
 *
 * Scope: federal brackets + BPA, age amount + threshold, OAS clawback
 * threshold, RRSP dollar limit, AND (audit A-10) provincial brackets + BPA +
 * age/pension credits. Provincial tables/credits are extrapolated off the 2026
 * carried-forward base so long-horizon projections no longer freeze provincial
 * tax at 2025 thresholds in perpetuity.
 *
 * @see docs/audit/AUDIT-2026-06-10.internal.md A-10
 */
export interface TaxYearParams {
  year: number;
  federalBrackets: TaxBracket[];
  federalBpa: number;
  federalAgeAmount: number;
  federalAgeAmountThreshold: number;
  oasClawbackThreshold: number;
  rrspDollarLimit: number;
  /** Indexed provincial bracket tables, keyed by province code. */
  provincialBrackets: Record<string, TaxBracket[]>;
  /** Indexed provincial basic personal amounts, keyed by province code. */
  provincialBpa: Record<string, number>;
  /** Indexed provincial age/pension credit params, keyed by province code. */
  provincialCredits: Record<string, ProvincialCreditParams>;
  /** Indexed Quebec AREL params. */
  arel: ARELParams;
}

const FEDERAL_LAST_TABLED_YEAR = 2026;
const OAS_LAST_TABLED_YEAR = 2026;
const RRSP_LAST_TABLED_YEAR = 2025;
/**
 * Age/pension/AREL credit and provincial bracket sets are now tabled through
 * 2026 (doc-19 credit amounts; carried-forward provincial brackets). 2026 is
 * the extrapolation base for both.
 */
const PROVINCIAL_LAST_TABLED_YEAR = 2026;
const CREDIT_LAST_TABLED_YEAR = 2026;

function getRRSPDollarLimit(year: number): number {
  if (year in RRSP_LIMITS) {
    return RRSP_LIMITS[year as keyof typeof RRSP_LIMITS].maxContribution;
  }
  return RRSP_LIMITS[RRSP_LAST_TABLED_YEAR as keyof typeof RRSP_LIMITS].maxContribution;
}

/**
 * Build the indexed provincial bracket/BPA/credit maps for a projection year.
 * `provFactor` indexes provincial brackets + BPA; `creditFactor` indexes the
 * provincial age/pension credit dollar amounts (both tabled through 2026).
 */
function buildProvincialParams(
  year: number,
  provFactor: number,
  creditFactor: number
): {
  provincialBrackets: Record<string, TaxBracket[]>;
  provincialBpa: Record<string, number>;
  provincialCredits: Record<string, ProvincialCreditParams>;
  arel: ARELParams;
} {
  const tables = getProvincialTaxTables(year);
  const ageTable = getAgeCreditTable(year);
  const pensionTable = getPensionIncomeCreditTable(year);

  const provincialBrackets: Record<string, TaxBracket[]> = {};
  const provincialBpa: Record<string, number> = {};
  const provincialCredits: Record<string, ProvincialCreditParams> = {};

  for (const province of Object.keys(tables)) {
    const table = tables[province as ProvinceCode];
    if (!table) continue;
    provincialBrackets[province] = indexBrackets(table.brackets, provFactor);
    provincialBpa[province] = indexScalar(table.basicPersonalAmount, provFactor);

    // Lowest provincial bracket rate = provincial non-refundable credit rate.
    const lowestRate = table.brackets[0]?.rate ?? 0;
    const ageParams = province in ageTable ? ageTable[province] : undefined;
    const pensionParams = province in pensionTable ? pensionTable[province] : undefined;

    provincialCredits[province] = {
      ageAmount: ageParams ? indexScalar(ageParams.ageAmount, creditFactor) : 0,
      ageAmountThreshold: ageParams ? indexScalar(ageParams.incomeThreshold, creditFactor) : 0,
      ageReductionRate: ageParams ? ageParams.reductionRate : 0.15,
      ageCreditRate: ageParams ? ageParams.creditRate : lowestRate,
      pensionMaxAmount: pensionParams ? indexScalar(pensionParams.maxAmount, creditFactor) : 1000,
      pensionCreditRate: pensionParams ? pensionParams.creditRate : lowestRate,
    };
  }

  const arelTable = getARELTable(year).QC;
  const arel: ARELParams = {
    ageAmount: indexScalar(arelTable.ageAmount, creditFactor),
    retirementIncomeAmount: indexScalar(arelTable.retirementIncomeAmount, creditFactor),
    livingAloneAmount: indexScalar(arelTable.livingAloneAmount, creditFactor),
    threshold: indexScalar(arelTable.threshold, creditFactor),
    reductionRate: arelTable.reductionRate,
    creditRate: arelTable.creditRate,
  };

  return { provincialBrackets, provincialBpa, provincialCredits, arel };
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
  const provFactor = getExtrapolationFactor(year, PROVINCIAL_LAST_TABLED_YEAR, options);
  const creditFactor = getExtrapolationFactor(year, CREDIT_LAST_TABLED_YEAR, options);

  // Federal age amount/threshold are now year-aware (doc-19 2026 values via the
  // credit table); indexed off the 2026 base like the provincial credits.
  const fedAge = getAgeCreditTable(year).federal ?? {
    ageAmount: 0,
    incomeThreshold: 0,
    reductionRate: 0.15,
    creditRate: 0.15,
  };

  const provincial = buildProvincialParams(year, provFactor, creditFactor);

  return {
    year,
    federalBrackets: indexBrackets(getFederalTaxBrackets(year), fedFactor),
    federalBpa: indexScalar(getFederalBasicPersonalAmount(year), fedFactor),
    federalAgeAmount: indexScalar(fedAge.ageAmount, creditFactor),
    federalAgeAmountThreshold: indexScalar(fedAge.incomeThreshold, creditFactor),
    oasClawbackThreshold: indexScalar(getOASClawbackThreshold(year), oasFactor),
    rrspDollarLimit: indexScalar(getRRSPDollarLimit(year), rrspFactor),
    ...provincial,
  };
}
