// per docs/source-of-truth/05-government-benefits.md OAS partial-pension + deferral rules
// per docs/source-of-truth/18-pensions-2026.md#2026-oas-q2-amount-65to74
/**
 * OAS estimator core (D-16, Phase 22-01).
 *
 * Single-path helper (unlike CPP which routes SOC vs YMPE-proxy): given
 * `residenceYearsAfter18` and `startAge`, returns the GROSS annual amount
 * with the partial-pension factor (years/40 when 10 ≤ years < 40), full
 * pension when years ≥ 40, or the 10-year-floor case (years < 10, returns 0
 * plus a `floorMessage`).
 *
 * Output is GROSS only per OAS-01 / Pitfall §6 — the engine remains the
 * single source of truth for OAS recovery-tax (clawback) math. The wizard
 * displays this GROSS estimate; the engine subtracts the recovery tax in
 * the year-by-year projection. The integration test (Plan 22-04) verifies
 * `engine_OAS = wizard_gross_OAS − engine_clawback` for a $120k scenario.
 *
 * Pure function — no Date.now, no Math.random, no I/O. Pure inputs → deterministic output.
 *
 * @see docs/source-of-truth/05-government-benefits.md (OAS partial-pension + deferral rules)
 * @see docs/source-of-truth/18-pensions-2026.md#2026-oas-q2-amount-65to74 (max gross at 65)
 */
import { OAS_2026 } from '../../benefits-parameters/2026.js';
import { adjustOASForStartAge } from './adjust-oas-for-start-age.js';

/** 40 years of residence after 18 = full OAS pension. */
export const OAS_FULL_PENSION_YEARS = 40;

/** 10 years minimum residence after 18 to qualify for OAS while living in Canada. */
export const OAS_MIN_QUALIFYING_YEARS = 10;

/**
 * 10-year-floor message rendered in the wizard Callout when years < 10.
 * Verbatim copy from `.planning/phases/22-oas-estimate-helper/22-UI-SPEC.md`
 * §Copywriting "10-year minimum floor". Re-exporting the constant from the
 * estimator keeps the source-of-truth single — UI components import it from
 * here rather than re-typing the string.
 */
export const OAS_FLOOR_MESSAGE =
  'You need at least 10 years of residence after 18 to qualify for OAS while living in Canada.';

export interface OASEstimatorInput {
  kind: 'oas-helper';
  /** 65..70 (caller already clamped via UI; estimator clamps sub-65 inside adjustOASForStartAge). */
  startAge: number;
  /** 0..60 (caller already clamped via D-10 useEffect `Math.min(userInput, currentAge - 18)`). */
  residenceYearsAfter18: number;
}

export interface OASEstimate {
  kind: 'oas-estimate';
  startAge: number;
  /** Precise annual GROSS value. Rounding ($100 band) is a UI concern (D-19). */
  annualGross: number;
  /** Precise monthly GROSS value. Rounding ($5 band) is a UI concern (D-19). */
  monthlyGross: number;
  /** 1.0 when years ≥ 40; years/40 when 10 ≤ years < 40; 0 when years < 10. */
  partialFactor: number;
  /** Echoed back for the UI sub-line copy. */
  residenceYears: number;
  /** MEDIUM when full pension (years ≥ 40); LOW for partial or floor cases. */
  confidence: 'MEDIUM' | 'LOW';
  /** Populated only when years < 10 (floor case). */
  floorMessage?: string;
}

/**
 * Compute the OAS GROSS estimate for the given input.
 *
 * @example
 * estimateOAS({ kind: 'oas-helper', startAge: 65, residenceYearsAfter18: 40 })
 * // → { annualGross: 8916.60, monthlyGross: 743.05, partialFactor: 1, confidence: 'MEDIUM', ... }
 *
 * @example
 * estimateOAS({ kind: 'oas-helper', startAge: 70, residenceYearsAfter18: 30 })
 * // → annualGross ≈ 8916.60 × 0.75 × 1.36 (partial + deferred); confidence: 'LOW'
 *
 * @example
 * estimateOAS({ kind: 'oas-helper', startAge: 65, residenceYearsAfter18: 5 })
 * // → annualGross: 0, partialFactor: 0, confidence: 'LOW', floorMessage: OAS_FLOOR_MESSAGE
 */
export function estimateOAS(input: OASEstimatorInput): OASEstimate {
  const { startAge, residenceYearsAfter18: years } = input;
  // per docs/source-of-truth/18-pensions-2026.md#2026-oas-q2-amount-65to74
  const maxAnnualAt65 = OAS_2026.q2.maxMonthlyAge65To74 * 12;

  if (years < OAS_MIN_QUALIFYING_YEARS) {
    return {
      kind: 'oas-estimate',
      startAge,
      annualGross: 0,
      monthlyGross: 0,
      partialFactor: 0,
      residenceYears: years,
      confidence: 'LOW',
      floorMessage: OAS_FLOOR_MESSAGE,
    };
  }

  const partialFactor = years >= OAS_FULL_PENSION_YEARS ? 1 : years / OAS_FULL_PENSION_YEARS;
  const baseAt65 = maxAnnualAt65 * partialFactor;
  const annualGross = adjustOASForStartAge(baseAt65, startAge);
  const monthlyGross = annualGross / 12;
  const confidence: 'MEDIUM' | 'LOW' = years >= OAS_FULL_PENSION_YEARS ? 'MEDIUM' : 'LOW';

  return {
    kind: 'oas-estimate',
    startAge,
    annualGross,
    monthlyGross,
    partialFactor,
    residenceYears: years,
    confidence,
  };
}
