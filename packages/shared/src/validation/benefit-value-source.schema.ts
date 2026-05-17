/**
 * BenefitValueSource Zod schema — runtime validator for the
 * provenance discriminator type declared in
 * `packages/shared/src/types/benefit-value-source.ts`.
 *
 * Canonical contract: docs/source-of-truth/05-government-benefits.md lines 302-312
 *
 * @see docs/source-of-truth/05-government-benefits.md#benefit-intake-source-modes
 */
import { z } from 'zod';

/**
 * `'user_entered' | 'estimated' | 'defaulted'` — mirrors `BenefitSourceMode`.
 */
export const benefitSourceModeSchema = z.enum(['user_entered', 'estimated', 'defaulted']);
export type BenefitSourceModeSchema = z.infer<typeof benefitSourceModeSchema>;

/**
 * `'high' | 'medium' | 'low'` — mirrors `BenefitEstimateConfidence`.
 */
export const benefitEstimateConfidenceSchema = z.enum(['high', 'medium', 'low']);
export type BenefitEstimateConfidenceSchema = z.infer<typeof benefitEstimateConfidenceSchema>;

/**
 * Zod runtime validator for `BenefitValueSource`. Mirrors the TS
 * interface in `packages/shared/src/types/benefit-value-source.ts`.
 *
 * `citation: z.string().min(1)` — empty-string citation is rejected. This is a
 * watchdog so Phase 21+ writers cannot accidentally persist `''` as citation.
 */
export const benefitValueSourceSchema = z.object({
  mode: benefitSourceModeSchema,
  confidence: benefitEstimateConfidenceSchema,
  citation: z.string().min(1),
  note: z.string().optional(),
});
export type BenefitValueSourceSchema = z.infer<typeof benefitValueSourceSchema>;
