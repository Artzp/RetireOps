/**
 * Unit + parity tests for adjustCPPForStartAge (Phase 21-01, D-15).
 *
 * The parity loop asserts that the shared duplicate of the CPP adjustment
 * formula returns the same value as engine.calculateCPPAdjustmentFactor for
 * every integer age 60..70. If they drift, the test fails — engineering must
 * either reconcile the formulas or update the parity threshold deliberately.
 *
 * Shared TEST files MAY import @retireops/calculation-engine. Only shared
 * SOURCE files are forbidden (Architecture Principle IV). The test runner's
 * dist bundle does not include test files, so production runtime is unaffected.
 */
import { describe, it, expect } from 'vitest';
// Shared TEST files MAY import calculation-engine (Architecture Principle IV
// only forbids shared SOURCE imports). Using a relative path because
// @retireops/shared does not declare @retireops/calculation-engine as a
// dependency — and shouldn't, since that would risk a downstream developer
// accidentally importing it from shared source. The relative path resolves
// at test-runner time against the engine's compiled dist (which is built
// before shared per the standard `pnpm build` order).
import { calculateCPPAdjustmentFactor } from '../../../../calculation-engine/dist/benefits/cpp.js';
import { adjustCPPForStartAge } from './adjust-cpp-for-start-age.js';

describe('adjustCPPForStartAge', () => {
  it('returns the base amount at age 65 (no adjustment)', () => {
    expect(adjustCPPForStartAge(10_000, 65, 'CPP')).toBe(10_000);
    expect(adjustCPPForStartAge(10_000, 65, 'QPP')).toBe(10_000);
  });

  it('applies -0.6%/month reduction before age 65', () => {
    // age 60 = 60 months before 65; 60 * 0.006 = 0.36 ⇒ factor 0.64
    expect(adjustCPPForStartAge(10_000, 60, 'CPP')).toBeCloseTo(6_400, 4);
  });

  it('applies +0.7%/month increase after age 65', () => {
    // age 70 = 60 months after 65; 60 * 0.007 = 0.42 ⇒ factor 1.42
    expect(adjustCPPForStartAge(10_000, 70, 'CPP')).toBeCloseTo(14_200, 4);
  });

  it('handles half-year start ages linearly', () => {
    // age 62.5 = 30 months before 65; 30 * 0.006 = 0.18 ⇒ factor 0.82
    expect(adjustCPPForStartAge(10_000, 62.5, 'CPP')).toBeCloseTo(8_200, 4);
  });

  it('CPP and QPP use the same adjustment factors per source-of-truth/05', () => {
    for (let age = 60; age <= 70; age += 1) {
      expect(adjustCPPForStartAge(10_000, age, 'CPP')).toBeCloseTo(
        adjustCPPForStartAge(10_000, age, 'QPP'),
        6
      );
    }
  });

  describe('parity with engine.calculateCPPAdjustmentFactor', () => {
    const baseAt65 = 16_000;
    for (let age = 60; age <= 70; age += 1) {
      it(`matches engine at age ${age}`, () => {
        const sharedResult = adjustCPPForStartAge(baseAt65, age, 'CPP');
        const engineFactor = calculateCPPAdjustmentFactor(age);
        const engineResult = baseAt65 * engineFactor;
        expect(sharedResult).toBeCloseTo(engineResult, 6);
      });
    }
  });
});
