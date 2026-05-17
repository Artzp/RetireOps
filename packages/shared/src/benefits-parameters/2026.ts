/**
 * 2026 CPP / QPP / OAS / GIS parameter values.
 *
 * Every value cites docs/source-of-truth/18-pensions-2026.md via the v4.5 anchor
 * convention: a `// per docs/source-of-truth/18-pensions-2026.md#<anchor>` comment
 * sits on the line immediately above each value. The citation-roundtrip CI test
 * (Phase 19, plan 03) verifies every anchor exists in the source doc.
 *
 * @see docs/source-of-truth/18-pensions-2026.md
 * @see .planning/phases/19-parameter-consolidation/19-CONTEXT.md (D-01 through D-04)
 */

// ---------------------------------------------------------------------------
// CPP — Canada Pension Plan (2026)
// ---------------------------------------------------------------------------
export const CPP_2026 = {
  // per docs/source-of-truth/18-pensions-2026.md#2026-cpp-ybe
  ybe: 3_500,
  // per docs/source-of-truth/18-pensions-2026.md#2026-cpp-ympe
  ympe: 74_600,
  // per docs/source-of-truth/18-pensions-2026.md#2026-cpp-yampe
  yampe: 85_000,
  // per docs/source-of-truth/18-pensions-2026.md#2026-cpp-max-retirement-pension
  maxRetirementPensionMonthly: 1_507.65,
  // per docs/source-of-truth/18-pensions-2026.md#2026-cpp-max-retirement-pension
  maxRetirementPensionAnnual: 18_091.8, // = 1_507.65 × 12
  // per docs/source-of-truth/18-pensions-2026.md#2026-cpp-employee-rate
  employeeRate: 0.0595,
  // per docs/source-of-truth/18-pensions-2026.md#2026-cpp2-rate
  cpp2Rate: 0.04,
  // per docs/source-of-truth/18-pensions-2026.md#2026-cpp-indexation
  indexation: 0.02,
} as const;

export type CPP2026Parameters = typeof CPP_2026;

// ---------------------------------------------------------------------------
// QPP — Quebec Pension Plan (2026)
// ---------------------------------------------------------------------------
export const QPP_2026 = {
  // per docs/source-of-truth/18-pensions-2026.md#2026-qpp-ybe
  ybe: 3_500,
  // per docs/source-of-truth/18-pensions-2026.md#2026-qpp-mpe
  mpe: 74_600,
  // per docs/source-of-truth/18-pensions-2026.md#2026-qpp-supplementary-mpe
  supplementaryMpe: 85_000,
  // per docs/source-of-truth/18-pensions-2026.md#2026-qpp-max-retirement-pension
  maxRetirementPensionMonthly: 1_507.65,
  // per docs/source-of-truth/18-pensions-2026.md#2026-qpp-max-retirement-pension
  maxRetirementPensionAnnual: 18_091.8, // = 1_507.65 × 12
  // per docs/source-of-truth/18-pensions-2026.md#2026-qpp-base-rate-emp
  baseRateEmployee: 0.053,
  // per docs/source-of-truth/18-pensions-2026.md#2026-qpp-indexation
  indexation: 0.02,
} as const;

export type QPP2026Parameters = typeof QPP_2026;

// ---------------------------------------------------------------------------
// OAS — Old Age Security (2026)
// Q1 and Q2 values both exposed; estimators (Phase 22) default to q2 (current).
// ---------------------------------------------------------------------------
export const OAS_2026 = {
  q1: {
    // per docs/source-of-truth/18-pensions-2026.md#2026-oas-q1-amount-65to74
    maxMonthlyAge65To74: 742.31,
    // per docs/source-of-truth/18-pensions-2026.md#2026-oas-q1-amount-75plus
    maxMonthlyAge75Plus: 816.54,
  },
  q2: {
    // per docs/source-of-truth/18-pensions-2026.md#2026-oas-q2-amount-65to74
    maxMonthlyAge65To74: 743.05,
    // per docs/source-of-truth/18-pensions-2026.md#2026-oas-q2-amount-75plus
    maxMonthlyAge75Plus: 817.36,
  },
  // per docs/source-of-truth/18-pensions-2026.md#2026-oas-clawback-threshold
  clawbackThreshold: 95_323,
  // per docs/source-of-truth/18-pensions-2026.md#2026-oas-full-clawback-65to74
  fullClawbackAge65To74: 154_753,
  // per docs/source-of-truth/18-pensions-2026.md#2026-oas-full-clawback-75plus
  fullClawbackAge75Plus: 160_696,
  // per docs/source-of-truth/18-pensions-2026.md#2026-oas-deferral-rate
  deferralRatePerMonth: 0.006,
  // per docs/source-of-truth/18-pensions-2026.md#2026-oas-75plus-topup
  age75TopUpRate: 0.1,
} as const;

export type OAS2026Parameters = typeof OAS_2026;

// ---------------------------------------------------------------------------
// GIS — Guaranteed Income Supplement (2026)
// 4-tier marital structure under q2 (Phase 23 consumes these four anchors —
// see docs/source-of-truth/18-pensions-2026.md lines 545-599).
// ---------------------------------------------------------------------------
export const GIS_2026 = {
  q2: {
    single: {
      // per docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-single-max
      maxMonthly: 1_109.85,
      // per docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-single-cutoff
      annualIncomeCutoff: 22_512,
    },
    spouseOnOas: {
      // per docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-spouse-on-oas-max
      maxMonthly: 668.08,
      // per docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-spouse-on-oas-cutoff
      combinedAnnualCutoff: 29_760,
    },
    spouseOnAllowance: {
      // per docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-spouse-on-allowance-max
      maxMonthly: 668.08,
      // per docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-spouse-on-allowance-cutoff
      combinedAnnualCutoff: 41_664,
    },
    spouseNoOas: {
      // per docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-spouse-no-oas-max
      maxMonthly: 1_109.85,
      // per docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-spouse-no-oas-cutoff
      combinedAnnualCutoff: 53_952,
    },
  },
  // per docs/source-of-truth/18-pensions-2026.md#2026-gis-earnings-exemption-first
  earningsExemptionFirst: 5_000,
  // per docs/source-of-truth/18-pensions-2026.md#2026-gis-earnings-exemption-second-50pct
  earningsExemptionSecondBand: 10_000,
  // per docs/source-of-truth/18-pensions-2026.md#2026-gis-reduction-rate-single
  reductionRateSingle: 0.5,
  // per docs/source-of-truth/18-pensions-2026.md#2026-gis-reduction-rate-couple-both-oas
  reductionRateCoupleBothOas: 0.25,
  // per docs/source-of-truth/18-pensions-2026.md#2026-gis-topup-reduction-rate
  topUpReductionRate: 0.75,
} as const;

export type GIS2026Parameters = typeof GIS_2026;
