/**
 * Tests for cppInputSchema Phase 21 extension (Plan 21-01 Task 3).
 *
 * Phase 21 adds two optional fields to cppInputSchema:
 *   - `manualOverrideAnnualBaseAt65: z.number().min(0).optional()` —
 *     persists the at-65 base so the UI can re-derive display when start
 *     age changes (resolves UI-SPEC open decision 1).
 *   - `inputPath: z.enum(['manual', 'helper-soc', 'helper-ympe-proxy']).optional()` —
 *     tracks helper origin for downstream Phase 24 assembler precedence
 *     (resolves UI-SPEC open decision 2).
 *
 * Existing Phase 20 fields remain optional and unchanged.
 */
import { describe, it, expect } from 'vitest';
import {
  cppInputSchema,
  oasInputSchema,
  gisInputSchema,
  governmentPensionsSchema,
} from './government-pensions.schema.js';

describe('cppInputSchema — Phase 21 fields', () => {
  it('accepts manualOverrideAnnualBaseAt65 as a non-negative number', () => {
    expect(() => cppInputSchema.parse({ manualOverrideAnnualBaseAt65: 18_000 })).not.toThrow();
    expect(() => cppInputSchema.parse({ manualOverrideAnnualBaseAt65: 0 })).not.toThrow();
    expect(() => cppInputSchema.parse({ manualOverrideAnnualBaseAt65: -1 })).toThrow();
  });

  it('accepts inputPath enum values', () => {
    for (const v of ['manual', 'helper-soc', 'helper-ympe-proxy'] as const) {
      expect(() => cppInputSchema.parse({ inputPath: v })).not.toThrow();
    }
    expect(() => cppInputSchema.parse({ inputPath: 'invalid' })).toThrow();
  });

  it('treats both new fields as optional (empty object parses)', () => {
    expect(() => cppInputSchema.parse({})).not.toThrow();
  });

  it('preserves both new fields on a full Phase 21 write', () => {
    const parsed = cppInputSchema.parse({
      plannedStartAge: 67,
      manualOverrideAnnual: 11_580.55, // at-67 value
      manualOverrideAnnualBaseAt65: 10_000, // at-65 base (helper-derived)
      inputPath: 'helper-ympe-proxy',
      yearsContributed: 35,
      earningsBucket: 'AVG_OR_ABOVE',
      value_source: {
        mode: 'estimated',
        confidence: 'medium',
        citation: 'docs/source-of-truth/18-pensions-2026.md#2026-cpp-max-retirement-pension',
        note: 'Estimated from 35 years × Average or above',
      },
    });
    expect(parsed.manualOverrideAnnualBaseAt65).toBe(10_000);
    expect(parsed.inputPath).toBe('helper-ympe-proxy');
  });

  it('full discriminated-union round-trip still works with new fields', () => {
    const parsed = governmentPensionsSchema.parse({
      kind: 'single',
      cpp_primary: {
        plannedStartAge: 65,
        inputPath: 'manual',
      },
    });
    expect(parsed.kind).toBe('single');
    if (parsed.kind === 'single') {
      expect(parsed.cpp_primary?.inputPath).toBe('manual');
    }
  });
});

describe('oasInputSchema — Phase 22 fields', () => {
  it("accepts inputPath: 'manual'", () => {
    expect(() => oasInputSchema.parse({ inputPath: 'manual' })).not.toThrow();
  });

  it("accepts inputPath: 'helper'", () => {
    expect(() => oasInputSchema.parse({ inputPath: 'helper' })).not.toThrow();
  });

  it('rejects CPP enum values (helper-soc / helper-ympe-proxy)', () => {
    expect(() => oasInputSchema.parse({ inputPath: 'helper-soc' })).toThrow();
    expect(() => oasInputSchema.parse({ inputPath: 'helper-ympe-proxy' })).toThrow();
  });

  it('rejects arbitrary strings', () => {
    expect(() => oasInputSchema.parse({ inputPath: 'invalid' })).toThrow();
  });

  it('treats inputPath as optional (empty object still parses)', () => {
    expect(() => oasInputSchema.parse({})).not.toThrow();
  });

  it('preserves all five fields on a full Phase 22 helper-mode write', () => {
    const parsed = oasInputSchema.parse({
      plannedStartAge: 67,
      manualOverrideAnnual: 8500,
      residenceYearsAfter18: 35,
      inputPath: 'helper',
      value_source: {
        mode: 'estimated',
        confidence: 'low',
        citation: 'docs/source-of-truth/18-pensions-2026.md#2026-oas-q2-amount-65to74',
        note: 'Estimated from 35/40 qualifying years; 88% partial pension',
      },
    });
    expect(parsed.inputPath).toBe('helper');
    expect(parsed.plannedStartAge).toBe(67);
    expect(parsed.residenceYearsAfter18).toBe(35);
    expect(parsed.manualOverrideAnnual).toBe(8500);
    expect(parsed.value_source?.mode).toBe('estimated');
  });

  it('full discriminated-union round-trip still works with the OAS inputPath field', () => {
    const parsed = governmentPensionsSchema.parse({
      kind: 'single',
      oas_primary: { inputPath: 'manual' },
    });
    expect(parsed.kind).toBe('single');
    if (parsed.kind === 'single') {
      expect(parsed.oas_primary?.inputPath).toBe('manual');
    }
  });
});

describe('gisInputSchema (Phase 23 — D-06)', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(() => gisInputSchema.parse({})).not.toThrow();
  });

  it('accepts manualOverrideAnnual >= 0', () => {
    expect(gisInputSchema.parse({ manualOverrideAnnual: 5_000 }).manualOverrideAnnual).toBe(5_000);
  });

  it('rejects manualOverrideAnnual < 0', () => {
    expect(() => gisInputSchema.parse({ manualOverrideAnnual: -100 })).toThrow();
  });

  it('accepts incomeExcludingOAS in [0, 1_000_000]', () => {
    expect(() => gisInputSchema.parse({ incomeExcludingOAS: 0 })).not.toThrow();
    expect(() => gisInputSchema.parse({ incomeExcludingOAS: 50_000 })).not.toThrow();
    expect(() => gisInputSchema.parse({ incomeExcludingOAS: 1_000_000 })).not.toThrow();
  });

  it('rejects incomeExcludingOAS < 0 or > 1_000_000', () => {
    expect(() => gisInputSchema.parse({ incomeExcludingOAS: -1 })).toThrow();
    expect(() => gisInputSchema.parse({ incomeExcludingOAS: 1_500_000 })).toThrow();
  });

  it('accepts all three spouseOasStatus values', () => {
    expect(() => gisInputSchema.parse({ spouseOasStatus: 'on-oas' })).not.toThrow();
    expect(() => gisInputSchema.parse({ spouseOasStatus: 'on-allowance' })).not.toThrow();
    expect(() => gisInputSchema.parse({ spouseOasStatus: 'no-oas' })).not.toThrow();
  });

  it('rejects unknown spouseOasStatus values', () => {
    expect(() => gisInputSchema.parse({ spouseOasStatus: 'unknown' })).toThrow();
  });

  it('accepts inputPath enum values manual | helper', () => {
    expect(() => gisInputSchema.parse({ inputPath: 'manual' })).not.toThrow();
    expect(() => gisInputSchema.parse({ inputPath: 'helper' })).not.toThrow();
  });

  it('rejects CPP-specific inputPath values like helper-soc (GIS has only manual | helper)', () => {
    expect(() => gisInputSchema.parse({ inputPath: 'helper-soc' })).toThrow();
  });

  it('accepts a full value_source object', () => {
    expect(() =>
      gisInputSchema.parse({
        value_source: {
          mode: 'estimated',
          confidence: 'medium',
          citation: 'docs/source-of-truth/18-pensions-2026.md#2026-gis-q2-single-max',
          note: 'Estimated single tier; projected non-OAS income $12,000',
        },
      })
    ).not.toThrow();
  });
});

describe('governmentPensionsSchema with GIS (Phase 23)', () => {
  it('accepts a single branch with gis_primary populated', () => {
    const parsed = governmentPensionsSchema.parse({
      kind: 'single',
      gis_primary: { manualOverrideAnnual: 5_000, inputPath: 'manual' },
    });
    expect(parsed.kind).toBe('single');
    expect(
      (parsed as { gis_primary?: { manualOverrideAnnual?: number } }).gis_primary
        ?.manualOverrideAnnual
    ).toBe(5_000);
  });

  it('accepts a couple branch with both gis_primary and gis_spouse', () => {
    const parsed = governmentPensionsSchema.parse({
      kind: 'couple',
      gis_primary: { incomeExcludingOAS: 15_000, spouseOasStatus: 'on-oas' },
      gis_spouse: { incomeExcludingOAS: 8_000 },
    });
    expect(parsed.kind).toBe('couple');
  });

  it('strips gis_spouse on single branch (discriminated-union safety per D-01)', () => {
    const parsed = governmentPensionsSchema.parse({
      kind: 'single',
      gis_primary: { manualOverrideAnnual: 3_000 },
      gis_spouse: { manualOverrideAnnual: 2_000 }, // not in single schema
    });
    // Zod strips unknown keys by default — gis_spouse should not appear on single branch.
    expect((parsed as Record<string, unknown>).gis_spouse).toBeUndefined();
  });
});
