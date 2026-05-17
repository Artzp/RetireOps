/**
 * Shape + spot-check value assertions for 2026 parameter module (Phase 19, PARAM-01).
 *
 * Guards two failure modes that the citation-roundtrip test in 19-03 does NOT catch:
 *   1. Export removal — e.g., someone deletes `export const CPP_2026 = ...` and
 *      downstream TypeScript compile-time errors take a wave to surface.
 *   2. Silent value zeroing — e.g., someone edits `ympe: 74_600` to `ympe: 0` while
 *      leaving the citation comment intact. Citation-roundtrip would not catch this.
 *
 * Spot-checks are load-bearing values from RESEARCH.md §1 — the minimum set of
 * values that downstream estimators in Phases 21-23 will consume. They are
 * verified against the source-of-truth doc directly.
 *
 * @see .planning/phases/19-parameter-consolidation/19-VALIDATION.md (Wave 0 Requirements)
 * @see .planning/phases/19-parameter-consolidation/19-RESEARCH.md §1 (verified inventory)
 */
import { describe, it, expect } from 'vitest';
import { CPP_2026, QPP_2026, OAS_2026, GIS_2026 } from './2026.js';

describe('2026 parameter module (PARAM-01 shape + spot-check)', () => {
  describe('existence', () => {
    it('CPP_2026 is defined and is a non-null object', () => {
      expect(CPP_2026).toBeDefined();
      expect(typeof CPP_2026).toBe('object');
      expect(CPP_2026).not.toBeNull();
    });

    it('QPP_2026 is defined and is a non-null object', () => {
      expect(QPP_2026).toBeDefined();
      expect(typeof QPP_2026).toBe('object');
      expect(QPP_2026).not.toBeNull();
    });

    it('OAS_2026 is defined and is a non-null object', () => {
      expect(OAS_2026).toBeDefined();
      expect(typeof OAS_2026).toBe('object');
      expect(OAS_2026).not.toBeNull();
    });

    it('GIS_2026 is defined and is a non-null object', () => {
      expect(GIS_2026).toBeDefined();
      expect(typeof GIS_2026).toBe('object');
      expect(GIS_2026).not.toBeNull();
    });
  });

  describe('load-bearing value spot-checks (from RESEARCH §1)', () => {
    it('CPP_2026.ympe === 74_600', () => {
      expect(CPP_2026.ympe).toBe(74_600);
    });

    it('CPP_2026.maxRetirementPensionMonthly === 1507.65', () => {
      expect(CPP_2026.maxRetirementPensionMonthly).toBe(1507.65);
    });

    it('CPP_2026.maxRetirementPensionAnnual is derived from monthly × 12 (Phase 21)', () => {
      expect(CPP_2026.maxRetirementPensionAnnual).toBeCloseTo(
        CPP_2026.maxRetirementPensionMonthly * 12,
        4
      );
      expect(CPP_2026.maxRetirementPensionAnnual).toBe(18_091.8);
    });

    it('QPP_2026.maxRetirementPensionAnnual is derived from monthly × 12 (Phase 21)', () => {
      expect(QPP_2026.maxRetirementPensionAnnual).toBeCloseTo(
        QPP_2026.maxRetirementPensionMonthly * 12,
        4
      );
      expect(QPP_2026.maxRetirementPensionAnnual).toBe(18_091.8);
    });

    it('OAS_2026.q2.maxMonthlyAge65To74 === 743.05 (Q2 is the current 2026 quarter)', () => {
      expect(OAS_2026.q2.maxMonthlyAge65To74).toBe(743.05);
    });

    it('GIS_2026.q2.single.maxMonthly === 1109.85', () => {
      expect(GIS_2026.q2.single.maxMonthly).toBe(1109.85);
    });
  });

  describe('GIS 4-tier structure (Phase 23 dependency surface)', () => {
    it('GIS_2026.q2 has all four marital tiers as own keys', () => {
      // Phase 23 estimator selects between these four tiers based on marital status.
      // Removing any of them would break GIS-01 / GIS-03 silently in this test;
      // downstream TypeScript compile error would catch it later, but we want a
      // fast, named-test failure here for clearer diagnostics.
      expect(GIS_2026.q2).toHaveProperty('single');
      expect(GIS_2026.q2).toHaveProperty('spouseOnOas');
      expect(GIS_2026.q2).toHaveProperty('spouseOnAllowance');
      expect(GIS_2026.q2).toHaveProperty('spouseNoOas');
    });
  });
});
