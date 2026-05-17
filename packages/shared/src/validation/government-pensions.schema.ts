/**
 * Government Pensions step validation schema (v4.7).
 * @see docs/source-of-truth/05-government-benefits.md
 *
 * Discriminated union at the step-data root (D-01) — NOT `spouse:
 * z.optional(...)`. This prevents the spouse-data-leak pattern called
 * out in PITFALLS §10: a couple→single toggle drops the entire spouse
 * branch instead of leaving optional fields populated.
 *
 * Per-person sub-objects (cpp_primary / oas_primary / cpp_spouse /
 * oas_spouse) intentionally declare fields with `.optional()`
 * (D-04) — Phase 20 is scaffolding. Phases 21 (CPP) and 22 (OAS)
 * tighten constraints (e.g., `.min(60).max(70)` on plannedStartAge).
 *
 * WIZ-07 (added 2026-05-11): each per-person sub-object carries an
 * optional `value_source: BenefitValueSource` field for provenance
 * tracking. See `benefit-value-source.schema.ts` for the contract.
 */
import { z } from 'zod';
import { benefitValueSourceSchema } from './benefit-value-source.schema.js';

/**
 * Owner discriminator — matches the `OverrideOwner` pattern in
 * packages/shared/src/types/scenario.ts:34.
 */
export const governmentPensionsOwnerSchema = z.enum(['primary', 'spouse']);
export type GovernmentPensionsOwner = z.infer<typeof governmentPensionsOwnerSchema>;

/**
 * Per-person CPP/QPP input shape. Phase 20 fields are placeholders
 * for Phase 21 CPP / QPP estimator wiring. All optional in Phase 20.
 */
export const cppInputSchema = z.object({
  plannedStartAge: z.number().int().min(60).max(70).optional(),
  manualOverrideAnnual: z.number().min(0).optional(),
  /**
   * The at-65 base value behind `manualOverrideAnnual`. Required for correct
   * re-rendering when the user changes `plannedStartAge` after committing a
   * helper estimate — the wizard re-applies `adjustCPPForStartAge` to this
   * base instead of mutating `manualOverrideAnnual`. (Resolves UI-SPEC open
   * decision 1 — Phase 21 chooses the "persist base-at-65 alongside the
   * persisted at-start-age value" branch.)
   *
   * For SOC path: equals the user-entered `annualAt65`.
   * For YMPE-proxy path: equals the formula's pre-adjustment computed base.
   * For manual entry without helper: undefined (the user-entered value is
   * already treated as at-65 per the field label).
   */
  manualOverrideAnnualBaseAt65: z.number().min(0).optional(),
  hasServiceCanadaStatement: z.boolean().optional(),
  estimatedAnnualAt65: z.number().min(0).optional(),
  yearsContributed: z.number().int().min(0).max(47).optional(),
  earningsBucket: z.enum(['BELOW_AVG', 'AVG_OR_ABOVE', 'AT_MAX']).optional(),
  /**
   * Tracks the input mechanism that produced `manualOverrideAnnual`.
   * Drives the displayed sub-line copy (UI-SPEC "Sub-line for *" rows) and
   * is read by Phase 24 assembler precedence to avoid parsing
   * `value_source.note`. (Resolves UI-SPEC open decision 2.)
   */
  inputPath: z.enum(['manual', 'helper-soc', 'helper-ympe-proxy']).optional(),
  value_source: benefitValueSourceSchema.optional(),
});
export type CppInput = z.infer<typeof cppInputSchema>;

/**
 * Per-person OAS input shape. Phase 22 adds optional `inputPath` to track
 * the input mechanism that produced `manualOverrideAnnual`.
 */
export const oasInputSchema = z.object({
  plannedStartAge: z.number().int().min(65).max(70).optional(),
  manualOverrideAnnual: z.number().min(0).optional(),
  residenceYearsAfter18: z.number().int().min(0).max(60).optional(),
  /**
   * Tracks the input mechanism that produced `manualOverrideAnnual`. Unlike
   * CPP's three-value enum ('manual' | 'helper-soc' | 'helper-ympe-proxy'),
   * OAS has a single helper path (residence years + start age — no SOC vs
   * YMPE-proxy split) so the enum is two-valued. (Resolves UI-SPEC §Open
   * Decisions item 2 per D-05.)
   *
   * Drives the displayed sub-line copy (UI-SPEC "Sub-line for *" rows in
   * §Copywriting) and is read by Phase 24 assembler precedence to avoid
   * parsing `value_source.note`.
   */
  inputPath: z.enum(['manual', 'helper']).optional(),
  value_source: benefitValueSourceSchema.optional(),
});
export type OasInput = z.infer<typeof oasInputSchema>;

/**
 * Per-person GIS input shape (Phase 23 — D-06). Mirrors `oasInputSchema` shape
 * with GIS-specific fields. All optional in v4.7 (helper writes are commit-time;
 * empty objects survive PATCH round-trip).
 *
 * `spouseOasStatus` is meaningful ONLY on the couple branch (drives 3-tier
 * routing among couple-on-oas / couple-on-allowance / couple-no-oas). The web
 * component renders the radio only when `kind: 'couple'` (GIS-04). The schema
 * tolerates the field on either branch since Zod strips unknown keys at
 * discriminated-union parse time.
 *
 * `inputPath` is a two-value enum (no SOC vs YMPE-proxy split — single helper
 * path per D-02). Drives the sub-line copy (UI-SPEC §Copywriting) and Phase 24
 * assembler precedence.
 */
export const gisInputSchema = z.object({
  manualOverrideAnnual: z.number().min(0).optional(),
  incomeExcludingOAS: z.number().min(0).max(1_000_000).optional(),
  spouseOasStatus: z.enum(['on-oas', 'on-allowance', 'no-oas']).optional(),
  inputPath: z.enum(['manual', 'helper']).optional(),
  value_source: benefitValueSourceSchema.optional(),
});
export type GisInput = z.infer<typeof gisInputSchema>;

/**
 * Single-kind branch — primary-only.
 */
const governmentPensionsSingleSchema = z.object({
  kind: z.literal('single'),
  cpp_primary: cppInputSchema.optional(),
  oas_primary: oasInputSchema.optional(),
  gis_primary: gisInputSchema.optional(),
});

/**
 * Couple-kind branch — primary + spouse.
 */
const governmentPensionsCoupleSchema = z.object({
  kind: z.literal('couple'),
  cpp_primary: cppInputSchema.optional(),
  oas_primary: oasInputSchema.optional(),
  gis_primary: gisInputSchema.optional(),
  cpp_spouse: cppInputSchema.optional(),
  oas_spouse: oasInputSchema.optional(),
  gis_spouse: gisInputSchema.optional(),
});

/**
 * Discriminated union at the step-data root (D-01).
 */
export const governmentPensionsSchema = z.discriminatedUnion('kind', [
  governmentPensionsSingleSchema,
  governmentPensionsCoupleSchema,
]);
export type GovernmentPensions = z.infer<typeof governmentPensionsSchema>;
