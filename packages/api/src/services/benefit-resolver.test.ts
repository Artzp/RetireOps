/**
 * Unit tests for resolveBenefitAmount — INTG-03 precedence logic
 *
 * Covers all 6+ branches of the override-then-estimator-then-legacy rule defined in
 * .planning/phases/24-assembler-wiring-wizard-engine-integration/24-CONTEXT.md
 * sections D-02, D-06, D-07, D-19.
 *
 * @see docs/source-of-truth/05-government-benefits.md#benefit-intake-source-modes
 */
import { describe, it, expect } from 'vitest';
import { resolveBenefitAmount } from './benefit-resolver.js';
import type { WizardBenefitField } from './benefit-resolver.js';
import type { BenefitValueSource } from '@retireops/shared';

// ---------------------------------------------------------------------------
// Test-data helpers — inline, no separate fixture files
// ---------------------------------------------------------------------------

function userEntered(amount: number | undefined): WizardBenefitField {
  const value_source: BenefitValueSource = {
    mode: 'user_entered',
    confidence: 'high',
    citation: 'docs/source-of-truth/05-government-benefits.md#benefit-intake-source-modes',
  };
  return amount === undefined ? { value_source } : { manualOverrideAnnual: amount, value_source };
}

function estimated(amount: number): WizardBenefitField {
  return {
    manualOverrideAnnual: amount,
    value_source: {
      mode: 'estimated',
      confidence: 'medium',
      citation: 'docs/source-of-truth/05-government-benefits.md#benefit-intake-source-modes',
    },
  };
}

function defaulted(): WizardBenefitField {
  return {
    value_source: {
      mode: 'defaulted',
      confidence: 'low',
      citation: 'docs/source-of-truth/05-government-benefits.md#benefit-intake-source-modes',
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveBenefitAmount — INTG-03 precedence (D-02, D-06, D-07, D-19)', () => {
  // Branch 1: user_entered with non-zero amount
  it('returns user_entered amount when mode is user_entered with non-zero manualOverrideAnnual', () => {
    const result = resolveBenefitAmount(userEntered(18500), 9000);
    expect(result).toEqual({ amount: 18500, source: 'user_entered' });
  });

  // Branch 2: user_entered with explicit 0 (D-07 — honor explicit zero)
  it('returns 0 with source user_entered when manualOverrideAnnual is explicitly 0 (D-07)', () => {
    const result = resolveBenefitAmount(userEntered(0), 9000);
    expect(result).toEqual({ amount: 0, source: 'user_entered' });
  });

  // Branch 3: estimated with amount (Phase 21/22/23 helper-committed value)
  it('returns estimated amount when mode is estimated with manualOverrideAnnual', () => {
    const result = resolveBenefitAmount(estimated(12000), 9000);
    expect(result).toEqual({ amount: 12000, source: 'estimated' });
  });

  // Branch 4: defaulted mode — fall through to legacy
  it('returns legacyAmount with source legacy when mode is defaulted', () => {
    const result = resolveBenefitAmount(defaulted(), 9000);
    expect(result).toEqual({ amount: 9000, source: 'legacy' });
  });

  // Branch 5: value_source undefined (pre-v4.7 profile shape) — treat as defaulted per D-06
  it('returns legacyAmount with source legacy when value_source is undefined (D-06)', () => {
    const field: WizardBenefitField = { manualOverrideAnnual: 14000 };
    const result = resolveBenefitAmount(field, 9000);
    expect(result).toEqual({ amount: 9000, source: 'legacy' });
  });

  // Branch 6: wizardField itself is undefined (no government_pensions step data)
  it('returns legacyAmount with source legacy when wizardField is undefined', () => {
    const result = resolveBenefitAmount(undefined, 9000);
    expect(result).toEqual({ amount: 9000, source: 'legacy' });
  });

  // Edge case 7: user_entered mode but manualOverrideAnnual is undefined — fall through to legacy
  it('falls through to legacy when mode is user_entered but manualOverrideAnnual is undefined', () => {
    const result = resolveBenefitAmount(userEntered(undefined), 9000);
    expect(result).toEqual({ amount: 9000, source: 'legacy' });
  });

  // Edge case 8: legacyAmount is undefined AND wizard falls through — returns { amount: undefined, source: 'legacy' }
  it('returns { amount: undefined, source: legacy } when both legacyAmount and wizard field fall through', () => {
    const result = resolveBenefitAmount(defaulted(), undefined);
    expect(result).toEqual({ amount: undefined, source: 'legacy' });
  });
});
