/**
 * GIS (Guaranteed Income Supplement) Calculations
 * @see docs/source-of-truth/05-government-benefits.md - GIS Section (rules layer)
 * @see docs/source-of-truth/18-pensions-2026.md - GIS 2026 Q2 parameter values
 *
 * Migrated to the citation-anchored 2026 parameters (audit A-02). The engine now
 * consumes the full 4-tier marital structure, the 25%-per-recipient reduction for
 * couples (single stays 50%), and the two-band earnings exemption (first $5,000
 * fully exempt + 50% of the next $10,000), replacing the deprecated 2024 values
 * in rates.ts.
 */
import { GIS_2026 } from '@retireops/shared/benefits';
import type { MaritalStatus } from '@retireops/shared';

/**
 * Resolve the GIS marital/spouse tier per the four anchored Q2 categories.
 *
 * - single (also widowed/divorced)
 * - couple, spouse receives OAS
 * - couple, spouse receives the Allowance
 * - couple, spouse receives neither OAS nor Allowance ("spouse not yet on OAS")
 *
 * @see docs/source-of-truth/18-pensions-2026.md GIS Q2 anchors (lines 545-607)
 */
interface GISTierParams {
  /** Maximum monthly GIS at zero income for this tier. */
  maxMonthly: number;
  /** Annual income cutoff (individual for single, combined for couples). */
  cutoff: number;
  /** Reduction rate applied to income above the exemptions. */
  reductionRate: number;
}

function resolveGISTier(
  maritalStatus: MaritalStatus,
  spouseReceivingOAS: boolean,
  spouseReceivingAllowance: boolean
): GISTierParams {
  const { q2 } = GIS_2026;

  if (maritalStatus === 'single') {
    return {
      // per docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-single-max
      maxMonthly: q2.single.maxMonthly,
      // per docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-single-cutoff
      cutoff: q2.single.annualIncomeCutoff,
      // per docs/source-of-truth/18-pensions-2026.md#2026-gis-reduction-rate-single
      reductionRate: GIS_2026.reductionRateSingle,
    };
  }

  // Married / common-law: couple reduction rate is 25% per recipient on combined
  // other income (effective 50% on the combined household) for all couple tiers.
  // per docs/source-of-truth/18-pensions-2026.md#2026-gis-reduction-rate-couple-both-oas
  if (spouseReceivingOAS) {
    return {
      // per docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-spouse-on-oas-max
      maxMonthly: q2.spouseOnOas.maxMonthly,
      // per docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-spouse-on-oas-cutoff
      cutoff: q2.spouseOnOas.combinedAnnualCutoff,
      reductionRate: GIS_2026.reductionRateCoupleBothOas,
    };
  }

  if (spouseReceivingAllowance) {
    return {
      // per docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-spouse-on-allowance-max
      maxMonthly: q2.spouseOnAllowance.maxMonthly,
      // per docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-spouse-on-allowance-cutoff
      cutoff: q2.spouseOnAllowance.combinedAnnualCutoff,
      reductionRate: GIS_2026.reductionRateCoupleBothOas,
    };
  }

  // Spouse receives neither OAS nor Allowance — highest combined cutoff and the
  // full single-recipient maximum.
  return {
    // per docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-spouse-no-oas-max
    maxMonthly: q2.spouseNoOas.maxMonthly,
    // per docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-spouse-no-oas-cutoff
    cutoff: q2.spouseNoOas.combinedAnnualCutoff,
    reductionRate: GIS_2026.reductionRateCoupleBothOas,
  };
}

/**
 * Get GIS income threshold (annual income cutoff) based on marital status.
 * @see docs/source-of-truth/18-pensions-2026.md - GIS Q2 income cutoffs
 */
export function getGISIncomeThreshold(
  maritalStatus: MaritalStatus,
  spouseReceivingOAS: boolean = false,
  spouseReceivingAllowance: boolean = false
): number {
  return resolveGISTier(maritalStatus, spouseReceivingOAS, spouseReceivingAllowance).cutoff;
}

/**
 * Get maximum annual GIS amount (at zero income) based on marital status.
 * @see docs/source-of-truth/18-pensions-2026.md - GIS Q2 maximum monthly amounts
 */
export function getMaxGISAmount(
  maritalStatus: MaritalStatus,
  spouseReceivingOAS: boolean = false,
  spouseReceivingAllowance: boolean = false
): number {
  return (
    resolveGISTier(maritalStatus, spouseReceivingOAS, spouseReceivingAllowance).maxMonthly * 12
  );
}

/**
 * Apply the two-band GIS earnings exemption to employment / self-employment
 * income: the first $5,000 is fully exempt and 50% of the next $10,000
 * ($5,000–$15,000 band) is exempt; income above $15,000 is fully counted.
 *
 * Returns the portion of employment income that is EXEMPT (excluded from GIS
 * income).
 *
 * @see docs/source-of-truth/18-pensions-2026.md#2026-gis-earnings-exemption-first
 * @see docs/source-of-truth/18-pensions-2026.md#2026-gis-earnings-exemption-second-50pct
 */
export function calculateGISEarningsExemption(employmentIncome: number): number {
  if (employmentIncome <= 0) return 0;

  // per docs/source-of-truth/18-pensions-2026.md#2026-gis-earnings-exemption-first
  const firstBand = GIS_2026.earningsExemptionFirst; // 5_000 fully exempt
  // per docs/source-of-truth/18-pensions-2026.md#2026-gis-earnings-exemption-second-50pct
  const secondBandWidth = GIS_2026.earningsExemptionSecondBand; // next 10_000 at 50%

  const fullyExempt = Math.min(employmentIncome, firstBand);
  const inSecondBand = Math.max(
    0,
    Math.min(employmentIncome, firstBand + secondBandWidth) - firstBand
  );
  const halfExempt = inSecondBand * 0.5;

  return fullyExempt + halfExempt;
}

/**
 * Calculate GIS income for eligibility.
 * @see docs/source-of-truth/05-government-benefits.md - GIS Calculation
 * @see docs/source-of-truth/18-pensions-2026.md §8 item 12 - GIS income exclusions
 *
 * GIS income excludes:
 * - OAS payments
 * - First $5,000 of employment income (fully exempt) + 50% of the next $10,000
 */
export function calculateGISIncome(
  totalIncome: number,
  oasIncome: number,
  employmentIncome: number
): number {
  const employmentExemption = calculateGISEarningsExemption(employmentIncome);
  return totalIncome - oasIncome - employmentExemption;
}

/**
 * Check if eligible for GIS
 * @see docs/source-of-truth/05-government-benefits.md - Eligibility
 */
export function isEligibleForGIS(
  age: number,
  receivingOAS: boolean,
  gisIncome: number,
  maritalStatus: MaritalStatus,
  spouseReceivingOAS: boolean = false,
  spouseReceivingAllowance: boolean = false
): boolean {
  if (age < 65) return false;
  if (!receivingOAS) return false;

  const threshold = getGISIncomeThreshold(
    maritalStatus,
    spouseReceivingOAS,
    spouseReceivingAllowance
  );
  return gisIncome < threshold;
}

/**
 * Calculate GIS benefit amount.
 * @see docs/source-of-truth/18-pensions-2026.md - GIS reduction rates
 *
 * GIS reduces by the tier's reduction rate per dollar of GIS income above the
 * exemptions: 50% for a single recipient, 25% per recipient for a couple (each
 * spouse computed independently against the combined other income).
 */
export function calculateGISBenefit(
  gisIncome: number,
  maritalStatus: MaritalStatus,
  spouseReceivingOAS: boolean = false,
  spouseReceivingAllowance: boolean = false
): number {
  const tier = resolveGISTier(maritalStatus, spouseReceivingOAS, spouseReceivingAllowance);

  if (gisIncome >= tier.cutoff) {
    return 0;
  }

  const maxGIS = tier.maxMonthly * 12;
  const reduction = Math.max(0, gisIncome) * tier.reductionRate;

  return Math.max(0, maxGIS - reduction);
}

/**
 * Complete GIS calculation result
 */
export interface GISCalculationResult {
  isEligible: boolean;
  gisIncome: number;
  maxAmount: number;
  reduction: number;
  benefit: number;
}

/**
 * Calculate complete GIS eligibility and amount.
 *
 * @param spouseReceivingOAS - true when the spouse already receives OAS (selects
 *   the spouse-on-OAS tier).
 * @param spouseReceivingAllowance - true when the spouse receives the Allowance
 *   (selects the spouse-on-Allowance tier). Ignored when spouseReceivingOAS is
 *   true (OAS takes precedence).
 */
export function calculateGIS(
  age: number,
  receivingOAS: boolean,
  totalIncome: number,
  oasIncome: number,
  employmentIncome: number,
  maritalStatus: MaritalStatus,
  spouseReceivingOAS: boolean = false,
  spouseReceivingAllowance: boolean = false
): GISCalculationResult {
  const gisIncome = calculateGISIncome(totalIncome, oasIncome, employmentIncome);
  const isEligible = isEligibleForGIS(
    age,
    receivingOAS,
    gisIncome,
    maritalStatus,
    spouseReceivingOAS,
    spouseReceivingAllowance
  );

  if (!isEligible) {
    return {
      isEligible: false,
      gisIncome,
      maxAmount: 0,
      reduction: 0,
      benefit: 0,
    };
  }

  const tier = resolveGISTier(maritalStatus, spouseReceivingOAS, spouseReceivingAllowance);
  const maxAmount = tier.maxMonthly * 12;
  const reduction = Math.max(0, gisIncome) * tier.reductionRate;
  const benefit = Math.max(0, maxAmount - reduction);

  return {
    isEligible: true,
    gisIncome,
    maxAmount,
    reduction,
    benefit,
  };
}
