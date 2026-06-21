/**
 * OAS Clawback Calculation Tests
 * @see docs/source-of-truth/04-tax-engine.md - OAS Clawback
 * @see docs/source-of-truth/05-government-benefits.md - OAS Clawback
 */
import { describe, it, expect } from 'vitest';
import {
  getOASClawbackThreshold,
  getOASFullClawbackThreshold,
  calculateOASClawback,
  calculateNetOAS,
  isOASFullyClawedBack,
  incomeForTargetClawback,
  maxIncomeToAvoidClawback,
} from './oas-clawback.js';
import { OAS_CLAWBACK_THRESHOLDS } from '@retireops/shared';

describe('OAS Clawback Calculations', () => {
  const clawbackThreshold = OAS_CLAWBACK_THRESHOLDS[2024].threshold; // $90,997
  // Arbitrary OAS-max input (2024 tabled figure; the removed BENEFIT_AMOUNTS_2024)
  const maxOAS = 8560;

  describe('getOASClawbackThreshold', () => {
    it('should return the 2024 threshold', () => {
      expect(getOASClawbackThreshold(2024)).toBe(OAS_CLAWBACK_THRESHOLDS[2024].threshold);
    });

    it('should return the 2025 threshold', () => {
      expect(getOASClawbackThreshold(2025)).toBe(OAS_CLAWBACK_THRESHOLDS[2025].threshold);
    });

    it('should return the 2026 threshold', () => {
      expect(getOASClawbackThreshold(2026)).toBe(OAS_CLAWBACK_THRESHOLDS[2026].threshold);
    });
  });

  describe('A-06: out-of-range year fallback (largest knownYear <= year, clamp to earliest)', () => {
    it('clamps to the earliest tabled year (2024) for a year before the table range', () => {
      // 2023 < earliest tabled year 2024 → earliest set, NOT the latest (old bug
      // returned the 2026 set via an inverted fallback).
      expect(getOASClawbackThreshold(2023)).toBe(OAS_CLAWBACK_THRESHOLDS[2024].threshold);
      expect(getOASFullClawbackThreshold(2023, 70)).toBe(
        OAS_CLAWBACK_THRESHOLDS[2024].fullClawbackAge65To74
      );
    });

    it('uses the latest tabled year (2026) for a year past the table range', () => {
      // 2027 > latest tabled year 2026 → largest knownYear <= 2027 is 2026.
      expect(getOASClawbackThreshold(2027)).toBe(OAS_CLAWBACK_THRESHOLDS[2026].threshold);
      expect(getOASFullClawbackThreshold(2027, 80)).toBe(
        OAS_CLAWBACK_THRESHOLDS[2026].fullClawbackAge75Plus
      );
    });

    it('resolves an exact tabled key to itself', () => {
      expect(getOASClawbackThreshold(2025)).toBe(OAS_CLAWBACK_THRESHOLDS[2025].threshold);
    });
  });

  describe('getOASFullClawbackThreshold', () => {
    it('should return the age 65-74 threshold for each supported year', () => {
      expect(getOASFullClawbackThreshold(2024, 65)).toBe(
        OAS_CLAWBACK_THRESHOLDS[2024].fullClawbackAge65To74
      );
      expect(getOASFullClawbackThreshold(2025, 70)).toBe(
        OAS_CLAWBACK_THRESHOLDS[2025].fullClawbackAge65To74
      );
      expect(getOASFullClawbackThreshold(2026, 74)).toBe(
        OAS_CLAWBACK_THRESHOLDS[2026].fullClawbackAge65To74
      );
    });

    it('should return the age 75+ threshold for each supported year', () => {
      expect(getOASFullClawbackThreshold(2024, 75)).toBe(
        OAS_CLAWBACK_THRESHOLDS[2024].fullClawbackAge75Plus
      );
      expect(getOASFullClawbackThreshold(2025, 80)).toBe(
        OAS_CLAWBACK_THRESHOLDS[2025].fullClawbackAge75Plus
      );
      expect(getOASFullClawbackThreshold(2026, 82)).toBe(
        OAS_CLAWBACK_THRESHOLDS[2026].fullClawbackAge75Plus
      );
    });

    it('should switch thresholds at age 75 within the same year', () => {
      expect(getOASFullClawbackThreshold(2025, 74)).toBe(
        OAS_CLAWBACK_THRESHOLDS[2025].fullClawbackAge65To74
      );
      expect(getOASFullClawbackThreshold(2025, 75)).toBe(
        OAS_CLAWBACK_THRESHOLDS[2025].fullClawbackAge75Plus
      );
    });
  });

  describe('calculateOASClawback', () => {
    it('should return 0 for income below threshold', () => {
      expect(calculateOASClawback(50000, maxOAS, 2024)).toBe(0);
      expect(calculateOASClawback(90000, maxOAS, 2024)).toBe(0);
      expect(calculateOASClawback(clawbackThreshold, maxOAS, 2024)).toBe(0);
    });

    it('should calculate clawback for income above threshold', () => {
      // Income $100,000, threshold $90,997
      // Excess = $9,003
      // Clawback = $9,003 * 15% = $1,350.45
      const clawback = calculateOASClawback(100000, maxOAS, 2024);
      const expected = (100000 - clawbackThreshold) * 0.15;
      expect(clawback).toBeCloseTo(expected, 2);
    });

    it('should cap clawback at OAS amount', () => {
      // Very high income - clawback would exceed OAS amount
      const clawback = calculateOASClawback(200000, maxOAS, 2024);
      expect(clawback).toBe(maxOAS);
    });

    it('should handle partial clawback correctly', () => {
      // Income $110,000
      // Excess = $110,000 - $90,997 = $19,003
      // Clawback = $19,003 * 15% = $2,850.45
      const clawback = calculateOASClawback(110000, maxOAS, 2024);
      expect(clawback).toBeCloseTo(2850.45, 2);
      expect(clawback).toBeLessThan(maxOAS);
    });

    it('should handle custom OAS amount', () => {
      // Partial OAS (10 years in Canada = 10/40 of full)
      const partialOAS = maxOAS * 0.25; // $2,140
      const clawback = calculateOASClawback(100000, partialOAS, 2024);
      const expectedClawback = (100000 - clawbackThreshold) * 0.15;
      expect(clawback).toBeCloseTo(Math.min(expectedClawback, partialOAS), 2);
    });
  });

  describe('calculateNetOAS', () => {
    it('should return full OAS for income below threshold', () => {
      const netOAS = calculateNetOAS(maxOAS, 50000, 2024);
      expect(netOAS).toBe(maxOAS);
    });

    it('should return reduced OAS for income above threshold', () => {
      const netOAS = calculateNetOAS(maxOAS, 100000, 2024);
      const clawback = (100000 - clawbackThreshold) * 0.15;
      expect(netOAS).toBeCloseTo(maxOAS - clawback, 2);
    });

    it('should return 0 for fully clawed back OAS', () => {
      const netOAS = calculateNetOAS(maxOAS, 200000, 2024);
      expect(netOAS).toBe(0);
    });

    it('should never return negative', () => {
      const netOAS = calculateNetOAS(maxOAS, 500000, 2024);
      expect(netOAS).toBeGreaterThanOrEqual(0);
    });
  });

  describe('isOASFullyClawedBack', () => {
    it('should return false for income below full clawback threshold', () => {
      expect(isOASFullyClawedBack(100000, 2024, 65)).toBe(false);
      expect(isOASFullyClawedBack(140000, 2024, 70)).toBe(false);
    });

    it('should return true for income at or above full clawback (age 65-74)', () => {
      expect(isOASFullyClawedBack(148451, 2024, 65)).toBe(true);
      expect(isOASFullyClawedBack(150000, 2024, 70)).toBe(true);
    });

    it('should return true for income at or above full clawback (age 75+)', () => {
      expect(isOASFullyClawedBack(154196, 2024, 75)).toBe(true);
      expect(isOASFullyClawedBack(160000, 2024, 80)).toBe(true);
    });

    it('should use higher threshold for age 75+', () => {
      // $150,000 income: fully clawed back at 70, not at 75
      expect(isOASFullyClawedBack(150000, 2024, 70)).toBe(true);
      expect(isOASFullyClawedBack(150000, 2024, 75)).toBe(false);
    });
  });

  describe('incomeForTargetClawback', () => {
    it('should calculate income for zero clawback', () => {
      const income = incomeForTargetClawback(0, 2024);
      expect(income).toBe(clawbackThreshold);
    });

    it('should calculate income for specific clawback amount', () => {
      // To have $1,000 clawback: threshold + ($1,000 / 0.15) = $90,997 + $6,666.67
      const income = incomeForTargetClawback(1000, 2024);
      expect(income).toBeCloseTo(clawbackThreshold + 1000 / 0.15, 2);
    });

    it('should be consistent with calculateOASClawback', () => {
      const targetClawback = 2000;
      const income = incomeForTargetClawback(targetClawback, 2024);
      const actualClawback = calculateOASClawback(income, maxOAS, 2024);
      expect(actualClawback).toBeCloseTo(targetClawback, 2);
    });
  });

  describe('maxIncomeToAvoidClawback', () => {
    it('should return clawback threshold', () => {
      expect(maxIncomeToAvoidClawback(2024)).toBe(clawbackThreshold);
    });

    it('should result in zero clawback when used', () => {
      const maxIncome = maxIncomeToAvoidClawback(2024);
      expect(calculateOASClawback(maxIncome, maxOAS, 2024)).toBe(0);
    });
  });

  describe('TAX-CA-05 — explicit threshold scenarios', () => {
    /**
     * @see docs/source-of-truth/04-tax-engine.md - OAS Clawback
     * @see docs/source-of-truth/05-government-benefits.md - TC-GOV-004
     */

    it('returns 0 when net income is below threshold — TAX-CA-05', () => {
      // $80,000 < $90,997 threshold → no clawback
      expect(calculateOASClawback(80000, 8560, 2024)).toBe(0);
    });

    it('returns 15% repayment on income above threshold — TAX-CA-05', () => {
      // $100,000 - $90,997 = $9,003 excess
      // clawback = $9,003 * 0.15 = $1,350.45
      expect(calculateOASClawback(100000, 8560, 2024)).toBeCloseTo(1350.45, 0);
    });

    it('caps clawback at full OAS amount — TAX-CA-05', () => {
      // $160,000 income → 0.15 * (160000 - 90997) = 0.15 * 69003 = 10350.45
      // capped at maxOAS = $8,560
      expect(calculateOASClawback(160000, 8560, 2024)).toBe(8560);
    });

    it('uses 2025 thresholds for year 2025 — TAX-CA-05', () => {
      // 2025 threshold = $93,454
      // $100,000 - $93,454 = $6,546 excess
      // clawback = $6,546 * 0.15 = $981.90
      expect(calculateOASClawback(100000, 8881, 2025)).toBeCloseTo(981.9, 0);
    });
  });

  describe('Real-world OAS clawback scenarios', () => {
    it('should calculate clawback for $120,000 income retiree', () => {
      // Excess = $120,000 - $90,997 = $29,003
      // Clawback = $29,003 * 15% = $4,350.45
      const clawback = calculateOASClawback(120000, maxOAS, 2024);
      expect(clawback).toBeCloseTo(4350.45, 2);

      const netOAS = calculateNetOAS(maxOAS, 120000, 2024);
      expect(netOAS).toBeCloseTo(maxOAS - 4350.45, 2);
    });

    it('should show significant clawback for high-income professional', () => {
      // $180,000 income - should be nearly full clawback
      const clawback = calculateOASClawback(180000, maxOAS, 2024);
      expect(clawback).toBe(maxOAS); // Fully clawed back
    });

    it('should show planning opportunity just above threshold', () => {
      // Income $95,000 - small clawback
      const clawback = calculateOASClawback(95000, maxOAS, 2024);
      const netOAS = calculateNetOAS(maxOAS, 95000, 2024);
      // Should lose only about $600 of OAS
      expect(clawback).toBeLessThan(700);
      expect(netOAS).toBeGreaterThan(7800);
    });
  });

  /**
   * ISSUE-3 regression: verify one-pass semantics per CRA line 23500.
   * Net income includes full OAS (line 23600); clawback is 15% of excess over
   * threshold and cannot exceed OAS received. No iteration.
   */
  describe('ISSUE-3: one-pass clawback semantics', () => {
    it('caps clawback at total OAS received when 15% × excess exceeds OAS', () => {
      // 2025 threshold $93,454. Net income $150,000 (incl. $8,000 OAS).
      // Raw clawback = (150000 - 93454) * 0.15 = 8481.9 → capped at 8000.
      const clawback = calculateOASClawback(150000, 8000, 2025);
      expect(clawback).toBe(8000);
    });

    it('returns 15% × excess when below the full-clawback ceiling', () => {
      // Net income $100,000 (incl. $8,000 OAS).
      // Clawback = (100000 - 93454) * 0.15 = 981.9
      const clawback = calculateOASClawback(100000, 8000, 2025);
      expect(clawback).toBeCloseTo(981.9, 2);
    });
  });

  /**
   * ISSUE-82 regression: three-level coverage against the 2026 CRA threshold
   * ($95,323) and the age-aware full-clawback ceilings ($154,196 age 65–74;
   * $160,647 age 75+).
   *
   * CRA source: Income Tax Act s.180.2 — OAS recovery tax thresholds are
   * indexed annually under s.117.1 to CPI. The published 2026 base threshold
   * is $95,323 (Service Canada / CRA T1 line 23500).
   */
  describe('ISSUE-82: 2026 threshold scenarios and indexed threshold propagation', () => {
    const threshold2026 = OAS_CLAWBACK_THRESHOLDS[2026].threshold; // $95,323
    const fullClawback65to74_2026 = OAS_CLAWBACK_THRESHOLDS[2026].fullClawbackAge65To74; // $154,196
    const fullClawback75Plus_2026 = OAS_CLAWBACK_THRESHOLDS[2026].fullClawbackAge75Plus; // $160,647
    // Max OAS that matches the full-clawback ceiling by construction:
    // OAS = (fullClawbackThreshold − threshold) × 0.15
    const maxOAS65to74_2026 = (fullClawback65to74_2026 - threshold2026) * 0.15;
    const maxOAS75Plus_2026 = (fullClawback75Plus_2026 - threshold2026) * 0.15;

    it('returns 0 clawback at ~$80K net income (below 2026 threshold)', () => {
      expect(calculateOASClawback(80000, maxOAS65to74_2026, 2026)).toBe(0);
    });

    it('returns partial clawback at ~$130K net income (2026)', () => {
      // Excess = 130000 − 95323 = 34,677 → 15% = 5,201.55
      const clawback = calculateOASClawback(130000, maxOAS65to74_2026, 2026);
      const expected = (130000 - threshold2026) * 0.15;
      expect(clawback).toBeCloseTo(expected, 2);
      expect(clawback).toBeLessThan(maxOAS65to74_2026);
    });

    it('fully claws back OAS at $154,196 net income for age 65–74 (2026)', () => {
      expect(isOASFullyClawedBack(fullClawback65to74_2026, 2026, 70)).toBe(true);
      expect(calculateNetOAS(maxOAS65to74_2026, fullClawback65to74_2026, 2026)).toBeCloseTo(0, 2);
    });

    it('does NOT fully claw back OAS at $154,196 net income for age 75+ (higher ceiling)', () => {
      expect(isOASFullyClawedBack(fullClawback65to74_2026, 2026, 75)).toBe(false);
    });

    it('fully claws back OAS at $160,647 net income for age 75+ (2026)', () => {
      expect(isOASFullyClawedBack(fullClawback75Plus_2026, 2026, 78)).toBe(true);
      expect(calculateNetOAS(maxOAS75Plus_2026, fullClawback75Plus_2026, 2026)).toBeCloseTo(0, 2);
    });

    /**
     * Projection-year indexation — per CRA, the recovery threshold is indexed
     * annually to CPI under ITA s.117.1. For projection years beyond the last
     * tabled year, the engine scales the threshold by compounded inflation.
     * When the caller supplies an indexedThreshold, it MUST override the
     * tabled (un-indexed) value so tax-engine and benefits-engine agree.
     */
    it('applies explicit indexedThreshold when provided (far-future year)', () => {
      // Simulated year 2050, 2.1% inflation, baseYear 2026: factor ≈ 1.687
      // Indexed threshold ≈ $95,323 × 1.687 ≈ $160,800
      const indexedThreshold = 160800;
      // Net income $130,000 (nominal 2050 dollars) → BELOW indexed threshold → 0 clawback
      expect(calculateOASClawback(130000, maxOAS65to74_2026, 2050, indexedThreshold)).toBe(0);
      // Net income $180,000 → excess $19,200 → clawback $2,880 (capped below OAS)
      const clawback = calculateOASClawback(180000, maxOAS65to74_2026, 2050, indexedThreshold);
      expect(clawback).toBeCloseTo((180000 - indexedThreshold) * 0.15, 2);
    });

    it('indexedThreshold overrides tabled value even when year is in table', () => {
      // For year 2026, tabled threshold is $95,323; supplied override must win.
      const override = 120000;
      // $110,000 < $120,000 override → expect 0 (tabled would have fired clawback)
      expect(calculateOASClawback(110000, maxOAS65to74_2026, 2026, override)).toBe(0);
      // Sanity check: without the override, clawback fires at $110k
      expect(calculateOASClawback(110000, maxOAS65to74_2026, 2026)).toBeGreaterThan(0);
    });
  });
});
