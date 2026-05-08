/**
 * Isolation tests for computeTfsaResidencyBaseline (M005/S03, VR-TFSA-RESIDENCY-001).
 */
import { describe, expect, it } from 'vitest';
import { computeTfsaResidencyBaseline } from './tfsa-residency-baseline.js';

describe('computeTfsaResidencyBaseline', () => {
  it('native Canadian born 1997 with undefined residency sums 2015–2025 for startYear 2026', () => {
    const baseline = computeTfsaResidencyBaseline({
      birthdate: new Date(Date.UTC(1997, 5, 15)),
      startYear: 2026,
    });
    // 10000+5500+5500+5500+6000+6000+6000+6000+6500+7000+7000
    expect(baseline).toBe(71000);
  });

  it('immigrant born 1980 with residencyStartYear 2021 sums 2021–2025 for startYear 2026', () => {
    const baseline = computeTfsaResidencyBaseline({
      birthdate: new Date(Date.UTC(1980, 0, 1)),
      residencyStartYear: 2021,
      startYear: 2026,
    });
    // 6000+6000+6500+7000+7000
    expect(baseline).toBe(32500);
  });

  it('pre-1991 birth clamps effective start to 2009 (TFSA program start)', () => {
    const baseline = computeTfsaResidencyBaseline({
      birthdate: new Date(Date.UTC(1985, 3, 10)),
      startYear: 2015,
    });
    // 2009–2014: 5000*4 + 5500*2
    expect(baseline).toBe(31000);
  });

  it('returns 0 when residencyStartYear is on/after startYear', () => {
    const baseline = computeTfsaResidencyBaseline({
      birthdate: new Date(Date.UTC(1980, 0, 1)),
      residencyStartYear: 2030,
      startYear: 2026,
    });
    expect(baseline).toBe(0);
  });

  it('returns 0 when birthdate is after startYear (minor child)', () => {
    const baseline = computeTfsaResidencyBaseline({
      birthdate: new Date(Date.UTC(2030, 0, 1)),
      startYear: 2026,
    });
    expect(baseline).toBe(0);
  });

  it('exact-1991 birth (turns 18 in 2009) yields full cumulative TFSA room through startYear-1', () => {
    const baseline = computeTfsaResidencyBaseline({
      birthdate: new Date(Date.UTC(1991, 0, 1)),
      startYear: 2026,
    });
    // Sum 2009–2025 — matches TFSA_CUMULATIVE_LIMITS[2025] = 102000.
    expect(baseline).toBe(102000);
  });
});
