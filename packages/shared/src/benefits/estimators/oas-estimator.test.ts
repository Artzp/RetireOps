/**
 * Unit tests for estimateOAS (Phase 22-01, D-11 + D-16).
 *
 * Pure GROSS estimator — no clawback, no double-clawback (Pitfall §6).
 * Engine remains single source of truth for OAS recovery-tax math (asserted
 * in Plan 22-04 integration test).
 */
import { describe, it, expect } from 'vitest';
import {
  estimateOAS,
  OAS_FULL_PENSION_YEARS,
  OAS_MIN_QUALIFYING_YEARS,
  OAS_FLOOR_MESSAGE,
} from './oas-estimator.js';
import { OAS_2026 } from '../../benefits-parameters/2026.js';

const MAX_AT_65 = OAS_2026.q2.maxMonthlyAge65To74 * 12; // 743.05 * 12 = 8916.60

describe('estimateOAS — full pension (years >= 40)', () => {
  it('returns full OAS at age 65 with 40 years', () => {
    const result = estimateOAS({
      kind: 'oas-helper',
      startAge: 65,
      residenceYearsAfter18: 40,
    });
    expect(result.kind).toBe('oas-estimate');
    expect(result.startAge).toBe(65);
    expect(result.annualGross).toBeCloseTo(MAX_AT_65, 6);
    expect(result.monthlyGross).toBeCloseTo(MAX_AT_65 / 12, 6);
    expect(result.partialFactor).toBe(1);
    expect(result.residenceYears).toBe(40);
    expect(result.confidence).toBe('MEDIUM');
    expect(result.floorMessage).toBeUndefined();
  });

  it('caps at full pension when years > 40 (no overflow)', () => {
    const result = estimateOAS({
      kind: 'oas-helper',
      startAge: 65,
      residenceYearsAfter18: 50,
    });
    expect(result.partialFactor).toBe(1);
    expect(result.annualGross).toBeCloseTo(MAX_AT_65, 6);
    expect(result.confidence).toBe('MEDIUM');
  });
});

describe('estimateOAS — partial pension (10 <= years < 40)', () => {
  it('30 years → 75% partial factor, LOW confidence', () => {
    const result = estimateOAS({
      kind: 'oas-helper',
      startAge: 65,
      residenceYearsAfter18: 30,
    });
    expect(result.partialFactor).toBe(0.75);
    expect(result.annualGross).toBeCloseTo(MAX_AT_65 * 0.75, 6);
    expect(result.confidence).toBe('LOW');
    expect(result.floorMessage).toBeUndefined();
  });

  it('10 years (boundary) → 25% partial factor, LOW confidence, no floor message', () => {
    const result = estimateOAS({
      kind: 'oas-helper',
      startAge: 65,
      residenceYearsAfter18: 10,
    });
    expect(result.partialFactor).toBe(0.25);
    expect(result.annualGross).toBeCloseTo(MAX_AT_65 * 0.25, 6);
    expect(result.confidence).toBe('LOW');
    expect(result.floorMessage).toBeUndefined();
  });

  it('32 years + deferred to age 67 → 80% partial × 1.144 deferral factor', () => {
    const result = estimateOAS({
      kind: 'oas-helper',
      startAge: 67,
      residenceYearsAfter18: 32,
    });
    expect(result.partialFactor).toBe(0.8);
    expect(result.annualGross).toBeCloseTo(MAX_AT_65 * 0.8 * (1 + 24 * 0.006), 6);
    expect(result.confidence).toBe('LOW');
  });
});

describe('estimateOAS — floor case (years < 10)', () => {
  it('9 years → annualGross=0, partialFactor=0, floorMessage populated', () => {
    const result = estimateOAS({
      kind: 'oas-helper',
      startAge: 65,
      residenceYearsAfter18: 9,
    });
    expect(result.annualGross).toBe(0);
    expect(result.monthlyGross).toBe(0);
    expect(result.partialFactor).toBe(0);
    expect(result.confidence).toBe('LOW');
    expect(result.floorMessage).toBe(
      'You need at least 10 years of residence after 18 to qualify for OAS while living in Canada.'
    );
  });

  it('0 years → annualGross=0, floorMessage populated', () => {
    const result = estimateOAS({
      kind: 'oas-helper',
      startAge: 65,
      residenceYearsAfter18: 0,
    });
    expect(result.annualGross).toBe(0);
    expect(result.floorMessage).toBe(OAS_FLOOR_MESSAGE);
  });
});

describe('estimateOAS — deferral integration', () => {
  it('full pension + age 70 → 36% uplift', () => {
    const result = estimateOAS({
      kind: 'oas-helper',
      startAge: 70,
      residenceYearsAfter18: 40,
    });
    expect(result.annualGross).toBeCloseTo(MAX_AT_65 * 1.36, 6);
    expect(result.confidence).toBe('MEDIUM');
  });

  it('floor case ignores deferral (annualGross stays 0)', () => {
    const result = estimateOAS({
      kind: 'oas-helper',
      startAge: 70,
      residenceYearsAfter18: 5,
    });
    expect(result.annualGross).toBe(0);
  });
});

describe('estimateOAS — purity + exported constants', () => {
  it('is pure — same input yields same output', () => {
    const input = {
      kind: 'oas-helper' as const,
      startAge: 66,
      residenceYearsAfter18: 35,
    };
    expect(estimateOAS(input)).toEqual(estimateOAS(input));
  });

  it('exports OAS_FULL_PENSION_YEARS = 40', () => {
    expect(OAS_FULL_PENSION_YEARS).toBe(40);
  });

  it('exports OAS_MIN_QUALIFYING_YEARS = 10', () => {
    expect(OAS_MIN_QUALIFYING_YEARS).toBe(10);
  });

  it('OAS_FLOOR_MESSAGE matches UI-SPEC §Copywriting verbatim', () => {
    expect(OAS_FLOOR_MESSAGE).toBe(
      'You need at least 10 years of residence after 18 to qualify for OAS while living in Canada.'
    );
  });
});
