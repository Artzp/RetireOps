/**
 * Unit + parity tests for adjustOASForStartAge (Phase 22-01, D-14, D-15).
 *
 * Parity loop: the shared duplicate of the OAS deferral formula returns the
 * same value as engine.calculateOASDeferralFactor for every integer age 65..70.
 * If they drift, the test fails — engineering must reconcile the formulas or
 * update the parity threshold deliberately.
 *
 * Shared TEST files MAY import @retireops/calculation-engine (only shared
 * SOURCE is forbidden per Architecture Principle IV; the test runner's dist
 * bundle does not include test files).
 */
import { describe, it, expect } from 'vitest';
import { calculateOASDeferralFactor } from '../../../../calculation-engine/dist/benefits/oas.js';
import { adjustOASForStartAge, OAS_DEFERRAL_RATE_PER_MONTH } from './adjust-oas-for-start-age.js';

describe('adjustOASForStartAge', () => {
  it('returns the base amount at age 65 (no adjustment)', () => {
    expect(adjustOASForStartAge(8_500, 65)).toBe(8_500);
  });

  it('applies +0.6%/month uplift after age 65', () => {
    // age 70 = 60 months after 65; 60 * 0.006 = 0.36 ⇒ factor 1.36
    expect(adjustOASForStartAge(8_500, 70)).toBeCloseTo(11_560, 6);
  });

  it('applies +0.6%/month uplift at age 67', () => {
    // age 67 = 24 months after 65; 24 * 0.006 = 0.144 ⇒ factor 1.144
    expect(adjustOASForStartAge(8_500, 67)).toBeCloseTo(9_724, 6);
  });

  it('handles half-year start ages linearly', () => {
    // age 65.5 = 6 months after 65; 6 * 0.006 = 0.036 ⇒ factor 1.036
    expect(adjustOASForStartAge(8_500, 65.5)).toBeCloseTo(8_806, 6);
  });

  it('returns the base unchanged when startAge < 65 (sub-65 clamp; does NOT throw)', () => {
    // OAS is not payable before 65 — the UI clamps min=65, but the helper
    // accepts sub-65 inputs without throwing so a stray render-time write
    // cannot crash the wizard. Per D-14.
    expect(adjustOASForStartAge(8_500, 64)).toBe(8_500);
    expect(adjustOASForStartAge(8_500, 60)).toBe(8_500);
  });

  describe('parity with engine.calculateOASDeferralFactor', () => {
    const baseAt65 = 8_500;
    for (let age = 65; age <= 70; age += 1) {
      it(`matches engine at age ${age}`, () => {
        const sharedResult = adjustOASForStartAge(baseAt65, age);
        const engineFactor = calculateOASDeferralFactor(age);
        const engineResult = baseAt65 * engineFactor;
        expect(sharedResult).toBeCloseTo(engineResult, 6);
      });
    }
  });

  describe('OAS_DEFERRAL_RATE_PER_MONTH cross-checks OAS_2026', () => {
    it('equals OAS_2026.deferralRatePerMonth', async () => {
      const { OAS_DEFERRAL_RATE_PER_MONTH: rate } = await import('./adjust-oas-for-start-age.js');
      const { OAS_2026 } = await import('../../benefits-parameters/2026.js');
      expect(rate).toBe(OAS_2026.deferralRatePerMonth);
    });
  });
});

// Suppress unused-import warning for OAS_DEFERRAL_RATE_PER_MONTH used in the dynamic import test above
void OAS_DEFERRAL_RATE_PER_MONTH;
