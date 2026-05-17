/**
 * Benefit Resolver — applies override-then-estimator-then-legacy precedence
 * to CPP/OAS/GIS amounts read from the v4.7 Government Pensions wizard step.
 *
 * Pure function — no I/O, no Date.now, no Math.random. Architecture Principle
 * IV preserved (engine signatures untouched; helper is consumer-side glue
 * in packages/api/).
 *
 * Precedence rule (INTG-03, per 24-CONTEXT.md D-02):
 *   1. value_source.mode === 'user_entered' && manualOverrideAnnual !== undefined
 *        → use the user-entered amount (honors explicit 0 per D-07)
 *   2. value_source.mode === 'estimated' && manualOverrideAnnual !== undefined
 *        → use the helper-committed amount (Phase 21/22/23 commit semantics:
 *          helper writes the committed value into manualOverrideAnnual, not a
 *          separate field — the value_source.mode discriminator is what
 *          distinguishes the path)
 *   3. Otherwise (defaulted / undefined / missing wizard field)
 *        → fall through to legacyAmount (preserves pre-v4.7 byte-identity
 *          per INTG-04)
 *
 * @see docs/source-of-truth/05-government-benefits.md#benefit-intake-source-modes
 * @see .planning/phases/24-assembler-wiring-wizard-engine-integration/24-CONTEXT.md - D-02, D-06, D-07
 */
import type { BenefitValueSource } from '@retireops/shared';

/**
 * Subset of the per-person wizard input shape (cppInputSchema / oasInputSchema /
 * gisInputSchema) that the resolver actually reads. Kept minimal to avoid
 * coupling to the full Zod-inferred type — the resolver only cares about
 * `manualOverrideAnnual` and `value_source`.
 */
export interface WizardBenefitField {
  manualOverrideAnnual?: number;
  value_source?: BenefitValueSource;
}

/**
 * Resolution outcome — pairs the chosen amount with the source label so
 * downstream callers (assembler logging, future telemetry) can attribute
 * which precedence tier produced the value.
 */
export interface ResolvedBenefit {
  amount: number | undefined;
  source: 'user_entered' | 'estimated' | 'defaulted' | 'legacy';
}

/**
 * Override-then-estimator-then-legacy precedence resolver.
 *
 * Pure: no I/O, no Date.now, no random. Safe to call from any layer.
 */
export function resolveBenefitAmount(
  wizardField: WizardBenefitField | undefined,
  legacyAmount: number | undefined
): ResolvedBenefit {
  const mode = wizardField?.value_source?.mode;
  const wizardAmount = wizardField?.manualOverrideAnnual;
  if (mode === 'user_entered' && wizardAmount !== undefined) {
    return { amount: wizardAmount, source: 'user_entered' };
  }
  if (mode === 'estimated' && wizardAmount !== undefined) {
    return { amount: wizardAmount, source: 'estimated' };
  }
  return { amount: legacyAmount, source: 'legacy' };
}
