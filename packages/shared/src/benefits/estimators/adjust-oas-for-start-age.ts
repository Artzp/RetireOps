// per docs/source-of-truth/05-government-benefits.md OAS deferral rules
// per docs/source-of-truth/18-pensions-2026.md#2026-oas-deferral-rate
/**
 * Apply OAS deferral start-age uplift to a base-at-65 amount.
 *
 * - At 65: no adjustment (factor 1.0).
 * - After 65: +0.6%/month uplift (max +36% at age 70).
 * - Before 65 (sub-65 clamp): returns `baseAt65` unchanged. OAS is not payable
 *   before 65 per docs/source-of-truth/05-government-benefits.md#eligibility,
 *   but the helper does NOT throw — the UI clamps `min=65` and a stray write
 *   should not crash a render path. (D-14.)
 *
 * The engine's `calculateOASDeferralFactor` (packages/calculation-engine/src/
 * benefits/oas.ts) is the source-of-truth for the projection math; this
 * duplicate exists so @retireops/shared has no source dependency on
 * @retireops/calculation-engine (Architecture Principle IV). Parity is
 * asserted in the co-located test (D-15, Phase 22-01).
 *
 * Pure function — no Date.now, no Math.random, no I/O.
 *
 * @param baseAt65 The benefit amount the user would receive at age 65 (gross).
 * @param startAge The user's planned start age (typically integer 65..70).
 * @returns The adjusted annual amount at the chosen start age (gross).
 */

/** Deferral rate per month (+0.6%) — mirrors OAS_2026.deferralRatePerMonth. */
export const OAS_DEFERRAL_RATE_PER_MONTH = 0.006;

export function adjustOASForStartAge(baseAt65: number, startAge: number): number {
  if (startAge < 65) return baseAt65;
  const monthsDeferred = (startAge - 65) * 12;
  const factor = 1 + monthsDeferred * OAS_DEFERRAL_RATE_PER_MONTH;
  return baseAt65 * factor;
}
