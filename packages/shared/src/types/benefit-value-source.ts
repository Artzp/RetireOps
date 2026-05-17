/**
 * BenefitValueSource — provenance discriminator for every government
 * benefit dollar amount in the wizard (CPP / QPP / OAS / GIS).
 *
 * Canonical contract: docs/source-of-truth/05-government-benefits.md lines 302-312
 *
 * Phase 20 (this file) ships the TYPE only — Phases 21–24 consume it:
 * - Phase 21 (CPP/QPP): wizard writes { mode: 'user_entered', confidence: 'high', ... }
 *   when user enters from SOC; { mode: 'estimated', confidence: 'medium', ... } when
 *   user takes the YMPE-proxy fallback.
 * - Phase 22 (OAS): same pattern.
 * - Phase 23 (GIS): same pattern with confidence: 'medium' | 'low' depending on
 *   income margin.
 * - Phase 24 (assembler): reads `mode` to pick precedence
 *   (user_entered > estimated > defaulted > legacy benefits.cpp_primary.estimatedAnnual
 *   fallback).
 *
 * Confidence guidance (per source-of-truth):
 * - 'high'    — user_entered (from official statement)
 * - 'medium'  — estimated (HIGH-input fallback like SOC amount, or full-OAS-residence
 *               path)
 * - 'low'     — defaulted (placeholder when inputs were incomplete), or estimated
 *               near eligibility-threshold edge cases
 *
 * @see docs/source-of-truth/05-government-benefits.md#benefit-intake-source-modes
 */

export type BenefitSourceMode = 'user_entered' | 'estimated' | 'defaulted';

export type BenefitEstimateConfidence = 'high' | 'medium' | 'low';

export interface BenefitValueSource {
  mode: BenefitSourceMode;
  confidence: BenefitEstimateConfidence;
  /**
   * Source-of-truth anchor — e.g.
   * `docs/source-of-truth/18-pensions-2026.md#2026-oas-q2-amount-65to74`
   * for an OAS estimate, or
   * `docs/source-of-truth/05-government-benefits.md#benefit-intake-source-modes`
   * for a defaulted placeholder.
   */
  citation: string;
  /** Optional human-readable note (e.g. "Assumed full 40-year residence"). */
  note?: string;
}
