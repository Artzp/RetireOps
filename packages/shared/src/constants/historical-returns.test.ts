/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * Unit tests for BLENDED_HISTORICAL_RETURNS_DATASET and PRESET_SCENARIOS
 * @see specs/010-historical-backtesting/data-model.md
 * @see TC-HIST-001 — Historical return dataset: completeness and year coverage
 */
import { describe, it, expect } from 'vitest';
import { BLENDED_HISTORICAL_RETURNS_DATASET, PRESET_SCENARIOS } from './historical-returns.js';

describe('BLENDED_HISTORICAL_RETURNS_DATASET', () => {
  it('has exactly 36 records covering 1990 through 2025', () => {
    expect(BLENDED_HISTORICAL_RETURNS_DATASET.records).toHaveLength(36);
    const years = BLENDED_HISTORICAL_RETURNS_DATASET.records.map((r) => r.year);
    for (let year = 1990; year <= 2025; year++) {
      expect(years).toContain(year);
    }
  });

  it('yearRange matches 1990–2025', () => {
    expect(BLENDED_HISTORICAL_RETURNS_DATASET.yearRange.from).toBe(1990);
    expect(BLENDED_HISTORICAL_RETURNS_DATASET.yearRange.to).toBe(2025);
  });

  it('all returnRates are within valid bounds [-1.0, 2.0]', () => {
    for (const record of BLENDED_HISTORICAL_RETURNS_DATASET.records) {
      expect(record.returnRate).toBeGreaterThanOrEqual(-1.0);
      expect(record.returnRate).toBeLessThanOrEqual(2.0);
    }
  });

  it('longRunAverage equals arithmetic mean of all returnRates', () => {
    const records = BLENDED_HISTORICAL_RETURNS_DATASET.records;
    const sum = records.reduce((acc, r) => acc + r.returnRate, 0);
    const mean = sum / records.length;
    expect(BLENDED_HISTORICAL_RETURNS_DATASET.longRunAverage).toBeCloseTo(mean, 6);
  });

  it('records are sorted ascending by year', () => {
    const years = BLENDED_HISTORICAL_RETURNS_DATASET.records.map((r) => r.year);
    for (let i = 1; i < years.length; i++) {
      expect(years[i]).toBeGreaterThan(years[i - 1]!);
    }
  });

  it('has correct id and sourceAttribution', () => {
    expect(BLENDED_HISTORICAL_RETURNS_DATASET.id).toBe('tsx-sp500-60-40-1990-2025');
    expect(BLENDED_HISTORICAL_RETURNS_DATASET.sourceAttribution).toBe(
      'S&P/TSX Composite + S&P 500 CAD, 60/40 blend, nominal returns, gross of fees'
    );
  });
});

describe('PRESET_SCENARIOS', () => {
  it('has exactly 3 entries', () => {
    expect(PRESET_SCENARIOS).toHaveLength(3);
  });

  it('contains retired-2000 preset with correct values', () => {
    const preset = PRESET_SCENARIOS.find((s) => s.id === 'retired-2000');
    expect(preset).toBeDefined();
    expect(preset?.label).toBe('Retired 2000 — Dot-com Crash');
    expect(preset?.startYear).toBe(2000);
  });

  it('contains retired-2008 preset with correct values', () => {
    const preset = PRESET_SCENARIOS.find((s) => s.id === 'retired-2008');
    expect(preset).toBeDefined();
    expect(preset?.label).toBe('Retired 2008 — Financial Crisis');
    expect(preset?.startYear).toBe(2008);
  });

  it('contains retired-2020 preset with correct values', () => {
    const preset = PRESET_SCENARIOS.find((s) => s.id === 'retired-2020');
    expect(preset).toBeDefined();
    expect(preset?.label).toBe('Retired 2020 — COVID Shock');
    expect(preset?.startYear).toBe(2020);
  });

  it('all presets have non-empty descriptions', () => {
    for (const preset of PRESET_SCENARIOS) {
      expect(preset.description.length).toBeGreaterThan(0);
    }
  });
});
