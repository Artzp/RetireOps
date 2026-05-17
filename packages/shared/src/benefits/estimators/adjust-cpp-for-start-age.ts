// per docs/source-of-truth/05-government-benefits.md#cpp-adjustment-factors
/**
 * Apply CPP/QPP early/late start-age adjustment to a base-at-65 amount.
 *
 * - Before 65: 0.6%/month reduction (max 36% reduction at age 60).
 * - After 65:  0.7%/month increase  (max 42% increase at age 70).
 *
 * CPP and QPP use the same factors per
 * docs/source-of-truth/05-government-benefits.md#cpp-adjustment-factors.
 * The `plan` parameter is accepted for symmetry with the rest of the estimator
 * API but does not branch the math.
 *
 * Pure function — no Date.now, no Math.random, no I/O.
 *
 * Parity with engine.calculateCPPAdjustmentFactor is asserted in the
 * co-located test file (D-15, Phase 21-01). The engine helper remains the
 * engine's source-of-truth for the projection math; this duplicate exists so
 * @retireops/shared has no source dependency on @retireops/calculation-engine
 * (Architecture Principle IV).
 *
 * @param baseAt65 The benefit amount the user would receive if started at age 65.
 * @param startAge The user's planned start age (typically integer 60..70, but
 *   half-year ages are computed linearly).
 * @param plan The benefit plan identifier; accepted for API symmetry — both
 *   CPP and QPP share the same monthly adjustment factors.
 * @returns The adjusted annual amount at the chosen start age.
 */
export function adjustCPPForStartAge(
  baseAt65: number,
  startAge: number,
  plan: 'CPP' | 'QPP'
): number {
  // plan param accepted for API symmetry; CPP and QPP share factors per
  // docs/source-of-truth/05-government-benefits.md#cpp-adjustment-factors.
  void plan;
  const monthsDiff = (startAge - 65) * 12;
  const factor =
    monthsDiff < 0
      ? 1 + monthsDiff * 0.006 // -0.6%/mo before 65 (monthsDiff is negative ⇒ subtractive)
      : 1 + monthsDiff * 0.007; // +0.7%/mo after 65
  return baseAt65 * factor;
}
