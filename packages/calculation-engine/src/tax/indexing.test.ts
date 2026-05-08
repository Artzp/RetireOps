/**
 * Inflation Indexing Tests (Issue 8)
 */
import { describe, it, expect } from 'vitest';
import { FEDERAL_TAX_2026 } from '@retireops/shared';
import { inflationFactor, indexBrackets, indexScalar, getExtrapolationFactor } from './indexing.js';

describe('Inflation Indexing', () => {
  it('inflationFactor compounds correctly', () => {
    expect(inflationFactor(0, 0.021)).toBe(1);
    expect(inflationFactor(30, 0.021)).toBeCloseTo(Math.pow(1.021, 30), 6);
  });

  it('indexBrackets scales thresholds but preserves rates and Infinity', () => {
    const indexed = indexBrackets(FEDERAL_TAX_2026.brackets, 1.5);
    expect(indexed[0]?.min).toBe(0);
    expect(indexed[0]?.rate).toBe(FEDERAL_TAX_2026.brackets[0]?.rate);
    expect(indexed[0]?.max).toBe(Math.round(57375 * 1.5));
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

  it('30-year projection at 2.1% grows first federal bracket from ~$57,375 to ~$106K', () => {
    // Projection starts at 2026 (last tabled year). 30 years out = 2056.
    const factor = getExtrapolationFactor(2056, 2026, {
      inflationRate: 0.021,
      baseYear: 2026,
    });
    const indexed = indexBrackets(FEDERAL_TAX_2026.brackets, factor);
    // 57,375 × 1.021^30 ≈ 107,016
    expect(indexed[0]?.max).toBeGreaterThan(105000);
    expect(indexed[0]?.max).toBeLessThan(110000);
  });
});
