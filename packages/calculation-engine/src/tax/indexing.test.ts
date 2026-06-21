/**
 * Inflation Indexing Tests (Issue 8)
 */
import { describe, it, expect } from 'vitest';
import { FEDERAL_TAX_2026, PROVINCIAL_TAX_TABLES_2026 } from '@retireops/shared';
import {
  inflationFactor,
  indexBrackets,
  indexScalar,
  getExtrapolationFactor,
  buildTaxYearParams,
} from './indexing.js';

describe('Inflation Indexing', () => {
  it('inflationFactor compounds correctly', () => {
    expect(inflationFactor(0, 0.021)).toBe(1);
    expect(inflationFactor(30, 0.021)).toBeCloseTo(Math.pow(1.021, 30), 6);
  });

  it('indexBrackets scales thresholds but preserves rates and Infinity', () => {
    const indexed = indexBrackets(FEDERAL_TAX_2026.brackets, 1.5);
    expect(indexed[0]?.min).toBe(0);
    expect(indexed[0]?.rate).toBe(FEDERAL_TAX_2026.brackets[0]?.rate);
    // 2026 first-bracket max = 58522 (2025 57375 indexed by 2.0% per audit A-09).
    expect(indexed[0]?.max).toBe(Math.round(58522 * 1.5));
    expect(indexed[indexed.length - 1]?.max).toBe(Infinity);
  });

  it('indexScalar scales amounts', () => {
    expect(indexScalar(16129, 1)).toBe(16129);
    expect(indexScalar(16129, 1.1)).toBe(Math.round(16129 * 1.1));
  });

  it('does not mutate input brackets', () => {
    const original = FEDERAL_TAX_2026.brackets;
    const snapshot = JSON.stringify(original);
    indexBrackets(original, 1.5);
    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it('getExtrapolationFactor returns 1 for years within tabled range', () => {
    expect(getExtrapolationFactor(2026, 2026, { inflationRate: 0.021, baseYear: 2026 })).toBe(1);
    expect(getExtrapolationFactor(2025, 2026)).toBe(1);
  });

  it('30-year projection at 2.1% grows first federal bracket from ~$58,522 to ~$109K', () => {
    // Projection starts at 2026 (last tabled year). 30 years out = 2056.
    const factor = getExtrapolationFactor(2056, 2026, {
      inflationRate: 0.021,
      baseYear: 2026,
    });
    const indexed = indexBrackets(FEDERAL_TAX_2026.brackets, factor);
    // 58,522 (2026 first-bracket max) × 1.021^30 ≈ 109,167
    expect(indexed[0]?.max).toBeGreaterThan(105000);
    expect(indexed[0]?.max).toBeLessThan(110000);
  });
});

describe('buildTaxYearParams provincial extrapolation (audit A-10)', () => {
  it('2026 base: provincial brackets/BPA/credits equal the tabled 2026 values (no indexing)', () => {
    const params = buildTaxYearParams(2026, { inflationRate: 0.02, baseYear: 2026 });
    // ON carried-forward 2025/2026 first-bracket max = 52835; BPA = 12734.
    expect(params.provincialBrackets.ON?.[0]?.max).toBe(
      PROVINCIAL_TAX_TABLES_2026.ON?.brackets[0]?.max
    );
    expect(params.provincialBpa.ON).toBe(PROVINCIAL_TAX_TABLES_2026.ON?.basicPersonalAmount);
    // ON age amount (doc-19 2026) = 6342, pension max = 1796.
    expect(params.provincialCredits.ON?.ageAmount).toBe(6342);
    expect(params.provincialCredits.ON?.pensionMaxAmount).toBe(1796);
    // Quebec AREL age amount (doc-19 2026) = 3470.
    expect(params.arel.ageAmount).toBe(3470);
  });

  it('without indexing options, 2030 provincial brackets equal the 2026 base (frozen)', () => {
    const params = buildTaxYearParams(2030);
    expect(params.provincialBrackets.ON?.[0]?.max).toBe(
      PROVINCIAL_TAX_TABLES_2026.ON?.brackets[0]?.max
    );
  });

  it('2030 with 2% indexing scales Ontario brackets + BPA + age amount off the 2026 base', () => {
    const factor = Math.pow(1.02, 4); // 2030 is 4 years past the 2026 base.
    const params = buildTaxYearParams(2030, { inflationRate: 0.02, baseYear: 2026 });

    const base2026 = buildTaxYearParams(2026, { inflationRate: 0.02, baseYear: 2026 });

    // Ontario first-bracket max scales by the compounded factor (round to dollar).
    expect(params.provincialBrackets.ON?.[0]?.max).toBe(
      Math.round((base2026.provincialBrackets.ON?.[0]?.max ?? 0) * factor)
    );
    // Ontario BPA scales off the 2026 base.
    expect(params.provincialBpa.ON).toBe(Math.round((base2026.provincialBpa.ON ?? 0) * factor));
    // Ontario age amount 6342 → 6342 × 1.02^4 ≈ 6865.
    expect(params.provincialCredits.ON?.ageAmount).toBe(Math.round(6342 * factor));
    // Quebec AREL age amount 3470 → 3470 × 1.02^4.
    expect(params.arel.ageAmount).toBe(Math.round(3470 * factor));
    // Provincial tax is no longer frozen: 2030 brackets exceed the 2026 base.
    expect(params.provincialBrackets.ON?.[0]?.max ?? 0).toBeGreaterThan(
      base2026.provincialBrackets.ON?.[0]?.max ?? 0
    );
  });
});
