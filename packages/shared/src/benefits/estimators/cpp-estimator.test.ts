/**
 * Unit tests for estimateCPP (Phase 21-01, D-16).
 *
 * Covers both input paths (SOC + YMPE-proxy), QPP plan routing, the YMPE-cap
 * edge case, and confirms monthly is exactly annual/12 (precise math; UI
 * handles $100/yr + $5/mo display rounding per D-19).
 */
import { describe, it, expect } from 'vitest';
import { estimateCPP, BUCKET_TO_PCT } from './cpp-estimator.js';
import { CPP_2026, QPP_2026 } from '../../benefits-parameters/2026.js';

describe('estimateCPP — SOC path', () => {
  it('returns the at-65 amount when startAge=65', () => {
    const result = estimateCPP({
      kind: 'soc',
      plan: 'CPP',
      startAge: 65,
      annualAt65: 16_000,
    });
    expect(result).toEqual({
      kind: 'cpp-estimate',
      plan: 'CPP',
      startAge: 65,
      monthly: 16_000 / 12,
      annual: 16_000,
      confidence: 'HIGH',
      inputPath: 'soc',
    });
  });

  it('applies start-age adjustment at age 70', () => {
    const result = estimateCPP({
      kind: 'soc',
      plan: 'CPP',
      startAge: 70,
      annualAt65: 10_000,
    });
    expect(result.annual).toBeCloseTo(14_200, 4); // 10000 * 1.42
    expect(result.confidence).toBe('HIGH');
    expect(result.inputPath).toBe('soc');
  });

  it('applies start-age adjustment at age 60', () => {
    const result = estimateCPP({
      kind: 'soc',
      plan: 'CPP',
      startAge: 60,
      annualAt65: 10_000,
    });
    expect(result.annual).toBeCloseTo(6_400, 4); // 10000 * 0.64
  });

  it('passes through plan label for QPP', () => {
    const result = estimateCPP({
      kind: 'soc',
      plan: 'QPP',
      startAge: 65,
      annualAt65: 16_000,
    });
    expect(result.plan).toBe('QPP');
  });

  it('monthly is exactly annual / 12 (precise; UI handles rounding)', () => {
    const result = estimateCPP({
      kind: 'soc',
      plan: 'CPP',
      startAge: 67,
      annualAt65: 15_000,
    });
    expect(result.monthly).toBe(result.annual / 12);
  });
});

describe('estimateCPP — YMPE-proxy path', () => {
  it('BELOW_AVG, 39 years, age 65 → maxAnnual × 0.40', () => {
    const result = estimateCPP({
      kind: 'ympe-proxy',
      plan: 'CPP',
      startAge: 65,
      yearsContributed: 39,
      earningsBucket: 'BELOW_AVG',
    });
    expect(result.annual).toBeCloseTo(CPP_2026.maxRetirementPensionAnnual * 0.4, 4);
    expect(result.confidence).toBe('MEDIUM');
    expect(result.inputPath).toBe('ympe-proxy');
  });

  it('AVG_OR_ABOVE, 39 years, age 65 → maxAnnual × 0.65', () => {
    const result = estimateCPP({
      kind: 'ympe-proxy',
      plan: 'CPP',
      startAge: 65,
      yearsContributed: 39,
      earningsBucket: 'AVG_OR_ABOVE',
    });
    expect(result.annual).toBeCloseTo(CPP_2026.maxRetirementPensionAnnual * 0.65, 4);
  });

  it('AT_MAX, 39 years, age 65 → maxAnnual × 1.00', () => {
    const result = estimateCPP({
      kind: 'ympe-proxy',
      plan: 'CPP',
      startAge: 65,
      yearsContributed: 39,
      earningsBucket: 'AT_MAX',
    });
    expect(result.annual).toBeCloseTo(CPP_2026.maxRetirementPensionAnnual, 4);
  });

  it('AT_MAX, 47 years, age 65 — caps at maxAnnual (no overflow above 100%)', () => {
    const result = estimateCPP({
      kind: 'ympe-proxy',
      plan: 'CPP',
      startAge: 65,
      yearsContributed: 47,
      earningsBucket: 'AT_MAX',
    });
    expect(result.annual).toBeCloseTo(CPP_2026.maxRetirementPensionAnnual, 4);
  });

  it('BELOW_AVG, 20 years, age 65 — partial years scale linearly', () => {
    const result = estimateCPP({
      kind: 'ympe-proxy',
      plan: 'CPP',
      startAge: 65,
      yearsContributed: 20,
      earningsBucket: 'BELOW_AVG',
    });
    expect(result.annual).toBeCloseTo(CPP_2026.maxRetirementPensionAnnual * 0.4 * (20 / 39), 4);
  });

  it('AVG_OR_ABOVE, 35 years, age 60 — start-age adjustment applied after YMPE-proxy base', () => {
    const result = estimateCPP({
      kind: 'ympe-proxy',
      plan: 'CPP',
      startAge: 60,
      yearsContributed: 35,
      earningsBucket: 'AVG_OR_ABOVE',
    });
    const baseAt65 = CPP_2026.maxRetirementPensionAnnual * 0.65 * (35 / 39);
    const expected = baseAt65 * 0.64; // age 60: factor 0.64
    expect(result.annual).toBeCloseTo(expected, 4);
  });

  it('QPP plan reads QPP_2026 max (coincides with CPP in 2026 but the lookup is plan-routed)', () => {
    const result = estimateCPP({
      kind: 'ympe-proxy',
      plan: 'QPP',
      startAge: 65,
      yearsContributed: 39,
      earningsBucket: 'AT_MAX',
    });
    expect(result.annual).toBeCloseTo(QPP_2026.maxRetirementPensionAnnual, 4);
    expect(result.plan).toBe('QPP');
  });
});

describe('BUCKET_TO_PCT', () => {
  it('matches the YMPE-proxy table in source-of-truth/05', () => {
    expect(BUCKET_TO_PCT).toEqual({ BELOW_AVG: 0.4, AVG_OR_ABOVE: 0.65, AT_MAX: 1.0 });
  });
});
