// per docs/source-of-truth/05-government-benefits.md#ympe-proxy
/**
 * CPP/QPP estimator core (D-16, Phase 21-01).
 *
 * Two input paths:
 *   - 'soc'         — user enters their at-65 annual from Service Canada Statement
 *                     of Contributions (or Retraite Québec Statement of
 *                     Participation for QC). Confidence: HIGH.
 *   - 'ympe-proxy'  — 2-question fallback: years contributed + earnings bucket.
 *                     Math: maxAnnual × bucketPct × (yearsContributed / 39),
 *                     capped at maxAnnual. Confidence: MEDIUM.
 *
 * Plan routing ('CPP' | 'QPP') is an explicit input param computed by the caller
 * from province per docs/source-of-truth/05-government-benefits.md#qpp-vs-cpp-routing
 * (D-17). The estimator does NOT read province.
 *
 * Pure function — no Date.now, no Math.random, no I/O. Pure inputs → deterministic output.
 *
 * @see docs/source-of-truth/05-government-benefits.md#ympe-proxy
 * @see docs/source-of-truth/05-government-benefits.md#cpp-adjustment-factors
 */
import { CPP_2026, QPP_2026 } from '../../benefits-parameters/2026.js';
import { adjustCPPForStartAge } from './adjust-cpp-for-start-age.js';

/**
 * Bucket-to-percentage mapping per
 * docs/source-of-truth/05-government-benefits.md#ympe-proxy.
 *
 * The 39-year denominator (applied in `estimateCPP`) reflects the maximum
 * CPP contributory period after the 8-year general drop-out (47 years from
 * age 18–65 minus 8 drop-out years).
 */
export const BUCKET_TO_PCT = {
  BELOW_AVG: 0.4,
  AVG_OR_ABOVE: 0.65,
  AT_MAX: 1.0,
} as const;

export type EarningsBucket = keyof typeof BUCKET_TO_PCT;

export type CPPEstimatorInput =
  | { kind: 'soc'; plan: 'CPP' | 'QPP'; startAge: number; annualAt65: number }
  | {
      kind: 'ympe-proxy';
      plan: 'CPP' | 'QPP';
      startAge: number;
      yearsContributed: number;
      earningsBucket: EarningsBucket;
    };

export interface CPPEstimate {
  kind: 'cpp-estimate';
  plan: 'CPP' | 'QPP';
  startAge: number;
  /** Precise monthly value. Rounding ($5 band) is a UI concern (D-19). */
  monthly: number;
  /** Precise annual value. Rounding ($100 band) is a UI concern (D-19). */
  annual: number;
  confidence: 'HIGH' | 'MEDIUM';
  inputPath: 'soc' | 'ympe-proxy';
}

/**
 * Compute the CPP/QPP estimate for the given input.
 *
 * @example
 * estimateCPP({ kind: 'soc', plan: 'CPP', startAge: 65, annualAt65: 16000 })
 * // → { kind: 'cpp-estimate', plan: 'CPP', startAge: 65, monthly: 1333.33..., annual: 16000, confidence: 'HIGH', inputPath: 'soc' }
 */
export function estimateCPP(input: CPPEstimatorInput): CPPEstimate {
  const params = input.plan === 'QPP' ? QPP_2026 : CPP_2026;
  let baseAt65: number;
  let confidence: 'HIGH' | 'MEDIUM';
  let inputPath: 'soc' | 'ympe-proxy';

  if (input.kind === 'soc') {
    baseAt65 = input.annualAt65;
    confidence = 'HIGH';
    inputPath = 'soc';
  } else {
    const pct = BUCKET_TO_PCT[input.earningsBucket];
    const computedBase = params.maxRetirementPensionAnnual * pct * (input.yearsContributed / 39);
    baseAt65 = Math.min(computedBase, params.maxRetirementPensionAnnual);
    confidence = 'MEDIUM';
    inputPath = 'ympe-proxy';
  }

  const annual = adjustCPPForStartAge(baseAt65, input.startAge, input.plan);
  const monthly = annual / 12;
  return {
    kind: 'cpp-estimate',
    plan: input.plan,
    startAge: input.startAge,
    monthly,
    annual,
    confidence,
    inputPath,
  };
}
