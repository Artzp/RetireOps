/**
 * Feature 4.1 GIS Acceptance Tests — Core Math + Eligibility
 *
 * Acceptance scenarios TC-GIS41-001 .. TC-GIS41-005, TC-GIS41-008 plus
 * Scope B.1 REGR-022 guard (centralized threshold constant).
 *
 * @see ~/.hermes/cron/retireops-acceptance-tests/feature-4.1-gis.md
 * @see ~/.hermes/cron/retireops-feature-descriptions/feature-4.1-gis.md
 * @see docs/source-of-truth/05-government-benefits.md — GIS Section
 */
import { describe, it, expect } from 'vitest';
import {
  isEligibleForGIS,
  calculateGISBenefit,
  calculateGISIncome,
  calculateGIS,
  getGISIncomeThreshold,
} from './gis.js';
import { BENEFIT_AMOUNTS_2024 } from '@retireops/shared';

describe('Feature 4.1 GIS — Core Math & Eligibility', () => {
  describe('TC-GIS41-001: Single threshold eligibility gate', () => {
    it('is eligible at gisIncome 21_623 (one dollar under threshold)', () => {
      expect(isEligibleForGIS(67, true, 21_623, 'single', false)).toBe(true);
    });

    it('is NOT eligible at gisIncome 21_624 (threshold boundary)', () => {
      expect(isEligibleForGIS(67, true, 21_624, 'single', false)).toBe(false);
    });
  });

  describe('TC-GIS41-002: Married/common-law both-OAS threshold eligibility gate', () => {
    it('married + both-OAS: eligible at 28_559', () => {
      expect(isEligibleForGIS(70, true, 28_559, 'married', true)).toBe(true);
    });

    it('married + both-OAS: NOT eligible at 28_560', () => {
      expect(isEligibleForGIS(70, true, 28_560, 'married', true)).toBe(false);
    });

    it('common_law + both-OAS: eligible at 28_559 (parity with married)', () => {
      expect(isEligibleForGIS(70, true, 28_559, 'common_law', true)).toBe(true);
    });

    it('common_law + both-OAS: NOT eligible at 28_560 (parity with married)', () => {
      expect(isEligibleForGIS(70, true, 28_560, 'common_law', true)).toBe(false);
    });
  });

  describe('TC-GIS41-003: Married/common-law one-OAS threshold eligibility gate', () => {
    it('married + one-OAS: eligible at 51_839', () => {
      expect(isEligibleForGIS(70, true, 51_839, 'married', false)).toBe(true);
    });

    it('married + one-OAS: NOT eligible at 51_840', () => {
      expect(isEligibleForGIS(70, true, 51_840, 'married', false)).toBe(false);
    });

    it('common_law + one-OAS: eligible at 51_839 (parity with married)', () => {
      expect(isEligibleForGIS(70, true, 51_839, 'common_law', false)).toBe(true);
    });

    it('common_law + one-OAS: NOT eligible at 51_840 (parity with married)', () => {
      expect(isEligibleForGIS(70, true, 51_840, 'common_law', false)).toBe(false);
    });
  });

  describe('TC-GIS41-004: 50% clawback amount calculation remains exact', () => {
    it('single with GIS income 15_000 produces reduction 7_500 and benefit 5_280', () => {
      expect(BENEFIT_AMOUNTS_2024.gis.maxAnnualSingle).toBe(12_780);

      const reduction = 15_000 * 0.5;
      expect(reduction).toBe(7_500);

      const benefit = calculateGISBenefit(15_000, 'single', false);
      expect(benefit).toBe(12_780 - 7_500);
      expect(benefit).toBe(5_280);
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
      expect(result.reduction).toBe(7_500);
      expect(result.benefit).toBe(5_280);
    });
  });

  describe('TC-GIS41-005: GIS income excludes OAS and first $5,000 employment income', () => {
    it('totalIncome=25_000, oas=8_500, employment=6_000 → gisIncome=11_500', () => {
      expect(calculateGISIncome(25_000, 8_500, 6_000)).toBe(11_500);
    });

    it('the $5,000 employment exemption is capped — larger employment amounts still deduct only 5_000', () => {
      expect(calculateGISIncome(25_000, 8_500, 50_000)).toBe(11_500);
    });
  });

  describe('TC-GIS41-008: common_law equals married for GIS outcomes', () => {
    it('common_law and married yield identical eligibility at all three thresholds', () => {
      const bothOASIncome = 28_000;
      const oneOASIncome = 40_000;

      expect(isEligibleForGIS(70, true, bothOASIncome, 'married', true)).toBe(
        isEligibleForGIS(70, true, bothOASIncome, 'common_law', true)
      );
      expect(isEligibleForGIS(70, true, oneOASIncome, 'married', false)).toBe(
        isEligibleForGIS(70, true, oneOASIncome, 'common_law', false)
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
   * The married/one-OAS threshold of 51_840 is currently hardcoded inline in
   * `gis.ts` (line 28) rather than sourced from `BENEFIT_AMOUNTS_2024.gis`.
   * This test encodes the required fix: the constant must be exposed on the
   * shared benefits-amounts object under a stable name so other parts of the
   * engine / API can read it rather than re-encoding the literal.
   *
   * This test is RED by design for feature 4.1 — the shared constant does
   * not exist yet. DO NOT delete the test; instead, implement the constant
   * in `packages/shared/src/constants/rates.ts` during S3 (GREEN phase).
   */
  describe('REGR-022: married/one-OAS threshold is sourced from shared constants', () => {
    it('exposes incomeThresholdMarriedOneOAS via BENEFIT_AMOUNTS_2024.gis', () => {
      const gisConstants = BENEFIT_AMOUNTS_2024.gis as Record<string, number>;
      expect(gisConstants.incomeThresholdMarriedOneOAS).toBe(51_840);
    });

    it('getGISIncomeThreshold reads from the shared constant rather than a local literal', () => {
      // If the constant is present, getGISIncomeThreshold must match it exactly.
      const gisConstants = BENEFIT_AMOUNTS_2024.gis as Record<string, number>;
      const sharedThreshold = gisConstants.incomeThresholdMarriedOneOAS;
      expect(sharedThreshold).toBeDefined();
      expect(getGISIncomeThreshold('married', false)).toBe(sharedThreshold);
      expect(getGISIncomeThreshold('common_law', false)).toBe(sharedThreshold);
    });
  });
});
