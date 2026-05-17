import { describe, it, expect } from 'vitest';
import { estimateGIS, GIS_NEAR_THRESHOLD_RATIO } from './gis-estimator.js';
import { GIS_2026 } from '../../benefits-parameters/2026.js';

describe('estimateGIS — tier: single', () => {
  it('zero income → full GIS, MEDIUM confidence, eligible', () => {
    const r = estimateGIS({ kind: 'gis-helper', tier: 'single', incomeExcludingOAS: 0 });
    expect(r.tier).toBe('single');
    expect(r.annualGross).toBeCloseTo(GIS_2026.q2.single.maxMonthly * 12, 2); // 13_318.20
    expect(r.monthlyGross).toBeCloseTo(GIS_2026.q2.single.maxMonthly, 6);
    expect(r.eligible).toBe(true);
    expect(r.thresholdUsed).toBe(GIS_2026.q2.single.annualIncomeCutoff); // 22_512
    expect(r.maxBenefitAtZeroIncome).toBeCloseTo(GIS_2026.q2.single.maxMonthly * 12, 2);
    expect(r.confidence).toBe('MEDIUM');
    expect(r.aboveThresholdMessage).toBeUndefined();
  });

  it('income $10,000 → reduced GIS, MEDIUM confidence (10000/22512 = 0.444 < 0.80)', () => {
    const r = estimateGIS({ kind: 'gis-helper', tier: 'single', incomeExcludingOAS: 10_000 });
    const expected = GIS_2026.q2.single.maxMonthly * 12 - 10_000 * GIS_2026.reductionRateSingle;
    expect(r.annualGross).toBeCloseTo(expected, 2); // 13_318.20 - 5_000 = 8_318.20
    expect(r.eligible).toBe(true);
    expect(r.confidence).toBe('MEDIUM');
  });

  it('income $18,500 → near-threshold (18500/22512 = 0.822 ≥ 0.80) → LOW confidence', () => {
    const r = estimateGIS({ kind: 'gis-helper', tier: 'single', incomeExcludingOAS: 18_500 });
    const expected = GIS_2026.q2.single.maxMonthly * 12 - 18_500 * GIS_2026.reductionRateSingle;
    expect(r.annualGross).toBeCloseTo(expected, 2); // 13_318.20 - 9_250 = 4_068.20
    expect(r.eligible).toBe(true);
    expect(r.confidence).toBe('LOW');
  });

  it('income exactly at cutoff $22,512 → ineligible, LOW confidence, aboveThresholdMessage populated', () => {
    const r = estimateGIS({ kind: 'gis-helper', tier: 'single', incomeExcludingOAS: 22_512 });
    expect(r.annualGross).toBe(0);
    expect(r.monthlyGross).toBe(0);
    expect(r.eligible).toBe(false);
    expect(r.confidence).toBe('LOW');
    expect(r.aboveThresholdMessage).toBeDefined();
    expect(r.aboveThresholdMessage).toContain('At or above');
    expect(r.aboveThresholdMessage).toContain('single');
    expect(r.aboveThresholdMessage).toContain('22,512');
  });

  it('income $30,000 (above cutoff) → ineligible, LOW confidence', () => {
    const r = estimateGIS({ kind: 'gis-helper', tier: 'single', incomeExcludingOAS: 30_000 });
    expect(r.annualGross).toBe(0);
    expect(r.eligible).toBe(false);
    expect(r.confidence).toBe('LOW');
  });

  it('GIS_NEAR_THRESHOLD_RATIO === 0.8', () => {
    expect(GIS_NEAR_THRESHOLD_RATIO).toBe(0.8);
  });
});

describe('estimateGIS — tier: couple-on-oas (combined-income aggregation)', () => {
  it('both zero income → full tier max, MEDIUM confidence', () => {
    const r = estimateGIS({
      kind: 'gis-helper',
      tier: 'couple-on-oas',
      incomeExcludingOAS: 0,
      spouseIncomeExcludingOAS: 0,
    });
    expect(r.tier).toBe('couple-on-oas');
    expect(r.annualGross).toBeCloseTo(GIS_2026.q2.spouseOnOas.maxMonthly * 12, 2); // 8_016.96
    expect(r.eligible).toBe(true);
    expect(r.thresholdUsed).toBe(GIS_2026.q2.spouseOnOas.combinedAnnualCutoff); // 29_760
    expect(r.confidence).toBe('MEDIUM');
  });

  it('own $10k + spouse $5k → combined $15k → reduction = $15k * 0.25 = $3,750', () => {
    const r = estimateGIS({
      kind: 'gis-helper',
      tier: 'couple-on-oas',
      incomeExcludingOAS: 10_000,
      spouseIncomeExcludingOAS: 5_000,
    });
    const expected =
      GIS_2026.q2.spouseOnOas.maxMonthly * 12 - 15_000 * GIS_2026.reductionRateCoupleBothOas;
    expect(r.annualGross).toBeCloseTo(expected, 2); // 8_016.96 - 3_750 = 4_266.96
    expect(r.eligible).toBe(true);
    // 15_000 / 29_760 = 0.504 < 0.80 → MEDIUM
    expect(r.confidence).toBe('MEDIUM');
  });

  it('spouseIncomeExcludingOAS undefined → treated as 0 (combined = own income alone)', () => {
    const r = estimateGIS({
      kind: 'gis-helper',
      tier: 'couple-on-oas',
      incomeExcludingOAS: 10_000,
      // spouseIncomeExcludingOAS omitted
    });
    const expected =
      GIS_2026.q2.spouseOnOas.maxMonthly * 12 - 10_000 * GIS_2026.reductionRateCoupleBothOas;
    expect(r.annualGross).toBeCloseTo(expected, 2);
  });

  it('combined income at cutoff $29,760 → ineligible, aboveThresholdMessage populated', () => {
    const r = estimateGIS({
      kind: 'gis-helper',
      tier: 'couple-on-oas',
      incomeExcludingOAS: 15_000,
      spouseIncomeExcludingOAS: 14_760,
    });
    expect(r.annualGross).toBe(0);
    expect(r.eligible).toBe(false);
    expect(r.aboveThresholdMessage).toContain('couple');
    expect(r.aboveThresholdMessage).toContain('29,760');
  });

  it('near-threshold: combined $24,000 → 24000/29760 = 0.806 ≥ 0.80 → LOW confidence', () => {
    const r = estimateGIS({
      kind: 'gis-helper',
      tier: 'couple-on-oas',
      incomeExcludingOAS: 14_000,
      spouseIncomeExcludingOAS: 10_000,
    });
    expect(r.eligible).toBe(true);
    expect(r.confidence).toBe('LOW');
  });
});

describe('estimateGIS — tier: couple-on-allowance', () => {
  it('zero combined income → spouseOnAllowance.maxMonthly * 12 ($8,016.96)', () => {
    const r = estimateGIS({
      kind: 'gis-helper',
      tier: 'couple-on-allowance',
      incomeExcludingOAS: 0,
      spouseIncomeExcludingOAS: 0,
    });
    expect(r.tier).toBe('couple-on-allowance');
    expect(r.annualGross).toBeCloseTo(GIS_2026.q2.spouseOnAllowance.maxMonthly * 12, 2);
    expect(r.thresholdUsed).toBe(GIS_2026.q2.spouseOnAllowance.combinedAnnualCutoff); // 41_664
  });

  it('combined $20k → reduction $20k * 0.25 = $5,000', () => {
    const r = estimateGIS({
      kind: 'gis-helper',
      tier: 'couple-on-allowance',
      incomeExcludingOAS: 12_000,
      spouseIncomeExcludingOAS: 8_000,
    });
    const expected =
      GIS_2026.q2.spouseOnAllowance.maxMonthly * 12 - 20_000 * GIS_2026.reductionRateCoupleBothOas;
    expect(r.annualGross).toBeCloseTo(expected, 2); // 8_016.96 - 5_000 = 3_016.96
  });
});

describe('estimateGIS — tier: couple-no-oas', () => {
  it('zero combined income → spouseNoOas.maxMonthly * 12 ($13,318.20)', () => {
    const r = estimateGIS({
      kind: 'gis-helper',
      tier: 'couple-no-oas',
      incomeExcludingOAS: 0,
      spouseIncomeExcludingOAS: 0,
    });
    expect(r.tier).toBe('couple-no-oas');
    expect(r.annualGross).toBeCloseTo(GIS_2026.q2.spouseNoOas.maxMonthly * 12, 2); // 13_318.20
    expect(r.thresholdUsed).toBe(GIS_2026.q2.spouseNoOas.combinedAnnualCutoff); // 53_952
  });

  it('combined $30k → reduction $30k * 0.25 = $7,500', () => {
    const r = estimateGIS({
      kind: 'gis-helper',
      tier: 'couple-no-oas',
      incomeExcludingOAS: 20_000,
      spouseIncomeExcludingOAS: 10_000,
    });
    const expected =
      GIS_2026.q2.spouseNoOas.maxMonthly * 12 - 30_000 * GIS_2026.reductionRateCoupleBothOas;
    expect(r.annualGross).toBeCloseTo(expected, 2); // 13_318.20 - 7_500 = 5_818.20
  });
});

describe('estimateGIS — purity guard', () => {
  it('identical input twice → identical output (deterministic, no Date/Math.random)', () => {
    const input = {
      kind: 'gis-helper' as const,
      tier: 'single' as const,
      incomeExcludingOAS: 12_000,
    };
    const a = estimateGIS(input);
    const b = estimateGIS(input);
    expect(a).toEqual(b);
  });
});
