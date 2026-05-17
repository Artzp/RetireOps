// per docs/source-of-truth/05-government-benefits.md GIS Eligibility + Calculation (lines 221-256)
// per docs/source-of-truth/18-pensions-2026.md GIS Q2 anchors (lines 545-672)
/**
 * GIS estimator core (D-14, Phase 23-01).
 *
 * 4-tier GIS estimator covering single + 3 couple variants. Per the Estimate
 * Helper scope (v4.7), this is the wizard's snapshot estimate; the engine
 * remains the source of truth for annual re-evaluation (combined income each
 * year, full earnings-exemption + employment-exemption handling, indexation).
 *
 * The simplified v4.7 helper math:
 *   - Uses raw `incomeExcludingOAS` against the reduction rate.
 *   - Does NOT apply the $5,000 earnings exemption (deferred per 23-CONTEXT §Deferred Ideas).
 *     The engine handles the exemption in the year-by-year projection.
 *   - Single tier: reductionRateSingle (0.5, i.e. 50¢ per $1).
 *   - All 3 couple tiers: reductionRateCoupleBothOas (0.25, i.e. 25% per recipient on
 *     combined other income, effective 50% on combined household). Per source-of-truth
 *     `18-pensions-2026.md#2026-gis-reduction-rate-couple-both-oas` (lines 665-671);
 *     no per-tier couple-rate anchors are defined in the source-of-truth.
 *
 * Pure function — no Date.now, no Math.random, no I/O. Pure inputs → deterministic output.
 *
 * @see docs/source-of-truth/05-government-benefits.md (GIS rules)
 * @see docs/source-of-truth/18-pensions-2026.md (2026 GIS Q2 anchors)
 * @see .planning/phases/23-gis-estimate-helper/23-CONTEXT.md (D-14, D-15)
 */
import { GIS_2026 } from '../../benefits-parameters/2026.js';

/** 4-tier marital classification per `docs/source-of-truth/18-pensions-2026.md` lines 545-607. */
export type GisTier = 'single' | 'couple-on-oas' | 'couple-on-allowance' | 'couple-no-oas';

/** Confidence threshold ratio: LOW when `incomeForCalc / cutoff >= 0.8` OR ineligible. */
export const GIS_NEAR_THRESHOLD_RATIO = 0.8;

export interface GISEstimatorInput {
  kind: 'gis-helper';
  tier: GisTier;
  /** Own non-OAS income (CPP, employment, RRSP/RRIF, investment, etc.). Caller passes >= 0. */
  incomeExcludingOAS: number;
  /** Required for all couple-* tiers; ignored for 'single'. Treated as 0 when undefined. */
  spouseIncomeExcludingOAS?: number;
}

export interface GISEstimate {
  kind: 'gis-estimate';
  tier: GisTier;
  /** Precise; 0 when above threshold. UI rounds to nearest $100 (Pitfall §13 / D-19). */
  annualGross: number;
  /** Precise; = annualGross / 12. UI rounds to nearest $5. */
  monthlyGross: number;
  /** false when annualGross === 0 (above threshold). */
  eligible: boolean;
  /** annualIncomeCutoff (single) OR combinedAnnualCutoff (couple). */
  thresholdUsed: number;
  /** Tier's max annual at zero income. */
  maxBenefitAtZeroIncome: number;
  /** MEDIUM when clearly below threshold; LOW near threshold OR ineligible. */
  confidence: 'MEDIUM' | 'LOW';
  /** Populated when annualGross === 0 (describes which threshold was exceeded). */
  aboveThresholdMessage?: string;
}

interface TierParams {
  maxMonthly: number;
  cutoff: number;
  rate: number;
  combined: boolean;
  tierLabel: string;
}

function getTierParams(tier: GisTier): TierParams {
  const q2 = GIS_2026.q2;
  switch (tier) {
    case 'single':
      return {
        // per docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-single-max
        // per docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-single-cutoff
        // per docs/source-of-truth/18-pensions-2026.md#2026-gis-reduction-rate-single
        maxMonthly: q2.single.maxMonthly,
        cutoff: q2.single.annualIncomeCutoff,
        rate: GIS_2026.reductionRateSingle,
        combined: false,
        tierLabel: 'single',
      };
    case 'couple-on-oas':
      return {
        // per docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-spouse-on-oas-max
        // per docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-spouse-on-oas-cutoff
        // per docs/source-of-truth/18-pensions-2026.md#2026-gis-reduction-rate-couple-both-oas
        maxMonthly: q2.spouseOnOas.maxMonthly,
        cutoff: q2.spouseOnOas.combinedAnnualCutoff,
        rate: GIS_2026.reductionRateCoupleBothOas,
        combined: true,
        tierLabel: 'couple (spouse on OAS)',
      };
    case 'couple-on-allowance':
      return {
        // per docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-spouse-on-allowance-max
        // per docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-spouse-on-allowance-cutoff
        // per docs/source-of-truth/18-pensions-2026.md#2026-gis-reduction-rate-couple-both-oas
        maxMonthly: q2.spouseOnAllowance.maxMonthly,
        cutoff: q2.spouseOnAllowance.combinedAnnualCutoff,
        rate: GIS_2026.reductionRateCoupleBothOas,
        combined: true,
        tierLabel: 'couple (spouse on Allowance)',
      };
    case 'couple-no-oas':
      return {
        // per docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-spouse-no-oas-max
        // per docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-spouse-no-oas-cutoff
        // per docs/source-of-truth/18-pensions-2026.md#2026-gis-reduction-rate-couple-both-oas
        maxMonthly: q2.spouseNoOas.maxMonthly,
        cutoff: q2.spouseNoOas.combinedAnnualCutoff,
        rate: GIS_2026.reductionRateCoupleBothOas,
        combined: true,
        tierLabel: 'couple (spouse not yet on OAS)',
      };
  }
}

/**
 * Compute the GIS estimate for the given tier + income input(s).
 *
 * @example
 * estimateGIS({ kind: 'gis-helper', tier: 'single', incomeExcludingOAS: 0 })
 * // → { annualGross: 13318.20, eligible: true, confidence: 'MEDIUM', ... }
 *
 * @example
 * estimateGIS({ kind: 'gis-helper', tier: 'couple-on-oas',
 *               incomeExcludingOAS: 10_000, spouseIncomeExcludingOAS: 5_000 })
 * // → { annualGross: 4266.96, eligible: true, confidence: 'MEDIUM', ... }
 *
 * @example
 * estimateGIS({ kind: 'gis-helper', tier: 'single', incomeExcludingOAS: 30_000 })
 * // → { annualGross: 0, eligible: false, confidence: 'LOW',
 * //     aboveThresholdMessage: 'At or above single GIS threshold of $22,512 at projected income $30,000' }
 */
export function estimateGIS(input: GISEstimatorInput): GISEstimate {
  const { tier, incomeExcludingOAS } = input;
  const params = getTierParams(tier);
  const maxAnnual = params.maxMonthly * 12;

  const incomeForCalc = params.combined
    ? Math.max(0, incomeExcludingOAS) + Math.max(0, input.spouseIncomeExcludingOAS ?? 0)
    : Math.max(0, incomeExcludingOAS);

  const reduction = incomeForCalc * params.rate;
  const annualGrossRaw = Math.max(0, maxAnnual - reduction);
  const eligible = annualGrossRaw > 0 && incomeForCalc < params.cutoff;
  const annualGross = eligible ? annualGrossRaw : 0;
  const monthlyGross = eligible ? annualGross / 12 : 0;
  const ratio = params.cutoff > 0 ? incomeForCalc / params.cutoff : 1;
  const confidence: 'MEDIUM' | 'LOW' =
    !eligible || ratio >= GIS_NEAR_THRESHOLD_RATIO ? 'LOW' : 'MEDIUM';

  const result: GISEstimate = {
    kind: 'gis-estimate',
    tier,
    annualGross,
    monthlyGross,
    eligible,
    thresholdUsed: params.cutoff,
    maxBenefitAtZeroIncome: maxAnnual,
    confidence,
  };

  if (!eligible) {
    const cutoffStr = params.cutoff.toLocaleString('en-CA');
    const incomeStr = Math.round(incomeForCalc).toLocaleString('en-CA');
    result.aboveThresholdMessage = `At or above ${params.tierLabel} GIS threshold of $${cutoffStr} at projected income $${incomeStr}`;
  }
  return result;
}
