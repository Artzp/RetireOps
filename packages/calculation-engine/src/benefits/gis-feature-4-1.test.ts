/**
 * Feature 4.1 GIS Acceptance Tests — Core Math + Eligibility
 *
 * Acceptance scenarios TC-GIS41-001 .. TC-GIS41-005, TC-GIS41-008 plus
 * Scope B.1 REGR-022 guard (centralized threshold constant).
 *
 * Updated for the audit A-02 migration: the engine now sources GIS thresholds,
 * maxima, reduction rates, and the two-band earnings exemption from the
 * citation-anchored GIS_2026 parameters (benefits-parameters/2026.ts) instead
 * of the deprecated 2024 constants. Threshold/eligibility boundaries are pinned
 * to the 2026 Q2 cutoffs (22512 / 29760 / 53952) and the couple 25% rate.
 *
 * @see docs/source-of-truth/05-government-benefits.md — GIS Section
 * @see docs/source-of-truth/18-pensions-2026.md — GIS 2026 Q2 anchors
 */
import { describe, it, expect } from 'vitest';
import {
  isEligibleForGIS,
  calculateGISBenefit,
  calculateGISIncome,
  calculateGIS,
  getGISIncomeThreshold,
} from './gis.js';
import { GIS_2026 } from '@retireops/shared/benefits';

const SINGLE_CUTOFF = GIS_2026.q2.single.annualIncomeCutoff; // 22_512
const COUPLE_ON_OAS_CUTOFF = GIS_2026.q2.spouseOnOas.combinedAnnualCutoff; // 29_760
const COUPLE_NO_OAS_CUTOFF = GIS_2026.q2.spouseNoOas.combinedAnnualCutoff; // 53_952
const SINGLE_MAX = GIS_2026.q2.single.maxMonthly * 12; // 13_318.20

describe('Feature 4.1 GIS — Core Math & Eligibility (2026 anchored)', () => {
  describe('TC-GIS41-001: Single threshold eligibility gate', () => {
    it('is eligible one dollar under the single cutoff', () => {
      expect(isEligibleForGIS(67, true, SINGLE_CUTOFF - 1, 'single', false)).toBe(true);
    });

    it('is NOT eligible at the single cutoff boundary', () => {
      expect(isEligibleForGIS(67, true, SINGLE_CUTOFF, 'single', false)).toBe(false);
    });
  });

  describe('TC-GIS41-002: Married/common-law spouse-on-OAS threshold eligibility gate', () => {
    it('married + spouse-on-OAS: eligible one dollar under cutoff', () => {
      expect(isEligibleForGIS(70, true, COUPLE_ON_OAS_CUTOFF - 1, 'married', true)).toBe(true);
    });

    it('married + spouse-on-OAS: NOT eligible at cutoff', () => {
      expect(isEligibleForGIS(70, true, COUPLE_ON_OAS_CUTOFF, 'married', true)).toBe(false);
    });

    it('common_law + spouse-on-OAS: eligible one dollar under cutoff (parity with married)', () => {
      expect(isEligibleForGIS(70, true, COUPLE_ON_OAS_CUTOFF - 1, 'common_law', true)).toBe(true);
    });

    it('common_law + spouse-on-OAS: NOT eligible at cutoff (parity with married)', () => {
      expect(isEligibleForGIS(70, true, COUPLE_ON_OAS_CUTOFF, 'common_law', true)).toBe(false);
    });
  });

  describe('TC-GIS41-003: Married/common-law spouse-not-on-OAS threshold eligibility gate', () => {
    it('married + spouse-not-on-OAS: eligible one dollar under cutoff', () => {
      expect(isEligibleForGIS(70, true, COUPLE_NO_OAS_CUTOFF - 1, 'married', false)).toBe(true);
    });

    it('married + spouse-not-on-OAS: NOT eligible at cutoff', () => {
      expect(isEligibleForGIS(70, true, COUPLE_NO_OAS_CUTOFF, 'married', false)).toBe(false);
    });

    it('common_law + spouse-not-on-OAS: eligible one dollar under cutoff (parity with married)', () => {
      expect(isEligibleForGIS(70, true, COUPLE_NO_OAS_CUTOFF - 1, 'common_law', false)).toBe(true);
    });

    it('common_law + spouse-not-on-OAS: NOT eligible at cutoff (parity with married)', () => {
      expect(isEligibleForGIS(70, true, COUPLE_NO_OAS_CUTOFF, 'common_law', false)).toBe(false);
    });
  });

  describe('TC-GIS41-004: single reduction amount calculation remains exact at 50%', () => {
    it('single with GIS income 15_000 produces reduction 7_500 and benefit max−7_500', () => {
      expect(SINGLE_MAX).toBeCloseTo(13_318.2, 2);

      const reduction = 15_000 * 0.5;
      expect(reduction).toBe(7_500);

      const benefit = calculateGISBenefit(15_000, 'single', false);
      expect(benefit).toBeCloseTo(SINGLE_MAX - 7_500, 2);
      expect(benefit).toBeCloseTo(5_818.2, 2);
    });

    it('calculateGIS returns exact reduction and benefit for the same case', () => {
      const result = calculateGIS(
        67,
        true,
        23_560, // totalIncome = OAS 8_560 + 15_000 other
        8_560,
        0,
        'single',
        false
      );
      expect(result.isEligible).toBe(true);
      expect(result.gisIncome).toBe(15_000);
      expect(result.reduction).toBeCloseTo(7_500, 2);
      expect(result.benefit).toBeCloseTo(5_818.2, 2);
    });
  });

  describe('TC-GIS41-005: GIS income excludes OAS and the two-band earnings exemption', () => {
    it('totalIncome=25_000, oas=8_500, employment=6_000 → gisIncome=11_000', () => {
      // exemption = 5,000 + 0.5 × 1,000 = 5,500; 25,000 − 8,500 − 5,500 = 11,000
      expect(calculateGISIncome(25_000, 8_500, 6_000)).toBe(11_000);
    });

    it('the earnings exemption is capped at $10,000 — larger employment still deducts only 10_000', () => {
      // exemption capped: 5,000 + 0.5 × 10,000 = 10,000; 25,000 − 8,500 − 10,000 = 6,500
      expect(calculateGISIncome(25_000, 8_500, 50_000)).toBe(6_500);
    });
  });

  describe('TC-GIS41-008: common_law equals married for GIS outcomes', () => {
    it('common_law and married yield identical eligibility at the couple thresholds', () => {
      const onOasIncome = COUPLE_ON_OAS_CUTOFF - 2_000;
      const noOasIncome = COUPLE_NO_OAS_CUTOFF - 5_000;

      expect(isEligibleForGIS(70, true, onOasIncome, 'married', true)).toBe(
        isEligibleForGIS(70, true, onOasIncome, 'common_law', true)
      );
      expect(isEligibleForGIS(70, true, noOasIncome, 'married', false)).toBe(
        isEligibleForGIS(70, true, noOasIncome, 'common_law', false)
      );
    });

    it('common_law and married yield identical benefit amounts for the same gisIncome', () => {
      const marriedBoth = calculateGISBenefit(10_000, 'married', true);
      const commonLawBoth = calculateGISBenefit(10_000, 'common_law', true);
      expect(commonLawBoth).toBe(marriedBoth);

      const marriedOne = calculateGISBenefit(10_000, 'married', false);
      const commonLawOne = calculateGISBenefit(10_000, 'common_law', false);
      expect(commonLawOne).toBe(marriedOne);
    });

    it('calculateGIS full result is deeply equal for married vs common_law (ignoring owner metadata)', () => {
      const args = [70, true, 25_000, 17_120, 0] as const;

      const married = calculateGIS(...args, 'married', true);
      const commonLaw = calculateGIS(...args, 'common_law', true);

      expect(commonLaw).toEqual(married);
    });
  });

  /**
   * Scope B.1 / REGR-022 — GIS threshold source-of-truth centralization.
   *
   * Post-A-02, the engine sources GIS thresholds from the citation-anchored
   * GIS_2026 parameters rather than re-encoding literals or reading the
   * deprecated BENEFIT_AMOUNTS_2024 constant. This test guards that
   * getGISIncomeThreshold stays wired to GIS_2026 (the single source of truth).
   */
  describe('REGR-022: thresholds are sourced from the anchored GIS_2026 parameters', () => {
    it('getGISIncomeThreshold returns the anchored single / couple cutoffs', () => {
      expect(getGISIncomeThreshold('single')).toBe(GIS_2026.q2.single.annualIncomeCutoff);
      expect(getGISIncomeThreshold('married', false)).toBe(
        GIS_2026.q2.spouseNoOas.combinedAnnualCutoff
      );
      expect(getGISIncomeThreshold('common_law', false)).toBe(
        GIS_2026.q2.spouseNoOas.combinedAnnualCutoff
      );
    });

    it('the anchored couple-not-on-OAS cutoff is 53_952', () => {
      expect(GIS_2026.q2.spouseNoOas.combinedAnnualCutoff).toBe(53_952);
    });
  });
});
