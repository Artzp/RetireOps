/**
 * Tests for the pure `extractImpactMetrics` extractor (Phase 31 Plan 01).
 *
 * Covers the five metric mappings locked in 31-CONTEXT.md plus defensive
 * behavior for missing or malformed `result_data` shapes — the extractor is
 * called on every preview tick from a `useEffect`, so it must never throw and
 * must return a fully-populated `ImpactMetrics` even for empty payloads.
 *
 * @see .planning/phases/31-impact-preview/31-01-PLAN.md (Task 1 acceptance)
 * @see packages/web/src/lib/impact-metrics.ts
 */
import { describe, it, expect } from 'vitest';
import { extractImpactMetrics, type ResultDataLike } from '../impact-metrics.js';

describe('extractImpactMetrics', () => {
  it('returns safe defaults for an empty result_data payload', () => {
    const m = extractImpactMetrics({});
    expect(m).toEqual({
      lifetimeTax: 0,
      depletionAge: null,
      endingEstate: 0,
      oasClawback: 0,
      afterTaxSpendingCovered: 0,
    });
  });

  it('returns safe defaults for null / undefined input (never throws)', () => {
    expect(extractImpactMetrics(null)).toEqual({
      lifetimeTax: 0,
      depletionAge: null,
      endingEstate: 0,
      oasClawback: 0,
      afterTaxSpendingCovered: 0,
    });
    expect(extractImpactMetrics(undefined)).toEqual({
      lifetimeTax: 0,
      depletionAge: null,
      endingEstate: 0,
      oasClawback: 0,
      afterTaxSpendingCovered: 0,
    });
  });

  it('maps a fully-populated result_data to the five metric values', () => {
    const result: ResultDataLike = {
      summary: {
        totalTaxesPaid: 287_500,
        averageRetirementIncome: 82_000,
      },
      yearlyResults: [
        { age: 65, householdNetWorth: 1_200_000, oasClawback: 0, spouseOasClawback: 0 },
        { age: 70, householdNetWorth: 950_000, oasClawback: 1_500, spouseOasClawback: 800 },
        { age: 80, householdNetWorth: 400_000, oasClawback: 2_000, spouseOasClawback: 1_000 },
        { age: 95, householdNetWorth: 50_000, oasClawback: 0, spouseOasClawback: 0 },
      ],
    };
    const m = extractImpactMetrics(result);
    expect(m.lifetimeTax).toBe(287_500);
    expect(m.depletionAge).toBeNull(); // never <= 0 in this run
    expect(m.endingEstate).toBe(50_000);
    // 1_500 + 800 + 2_000 + 1_000 = 5_300
    expect(m.oasClawback).toBe(5_300);
    expect(m.afterTaxSpendingCovered).toBe(82_000);
  });

  it('detects depletionAge at the first year where householdNetWorth <= 0', () => {
    const result: ResultDataLike = {
      yearlyResults: [
        { age: 65, householdNetWorth: 500_000 },
        { age: 80, householdNetWorth: 100_000 },
        // First non-positive year — depletionAge should pick THIS row,
        // not a later row that is also non-positive.
        { age: 87, householdNetWorth: 0 },
        { age: 88, householdNetWorth: -10_000 },
      ],
    };
    const m = extractImpactMetrics(result);
    expect(m.depletionAge).toBe(87);
    // endingEstate is the LAST year (which is the deeper-negative row)
    expect(m.endingEstate).toBe(-10_000);
  });

  it('sums OAS clawback across primary + spouse across every year', () => {
    const result: ResultDataLike = {
      yearlyResults: [
        { age: 65, householdNetWorth: 100, oasClawback: 100, spouseOasClawback: 0 },
        { age: 66, householdNetWorth: 100, oasClawback: 200, spouseOasClawback: 50 },
        // Missing fields default to 0 — must not throw on partial rows.
        { age: 67, householdNetWorth: 100 },
        { age: 68, householdNetWorth: 100, oasClawback: 300 }, // no spouse field
      ],
    };
    const m = extractImpactMetrics(result);
    // 100 + 0 + 200 + 50 + 0 + 0 + 300 + 0 = 650
    expect(m.oasClawback).toBe(650);
  });

  it('handles single-year yearlyResults arrays correctly', () => {
    const result: ResultDataLike = {
      summary: { totalTaxesPaid: 1_000, averageRetirementIncome: 50_000 },
      yearlyResults: [{ age: 65, householdNetWorth: 250_000 }],
    };
    const m = extractImpactMetrics(result);
    expect(m.endingEstate).toBe(250_000);
    expect(m.depletionAge).toBeNull();
    expect(m.oasClawback).toBe(0);
  });

  it('treats a missing yearlyResults array as an empty horizon', () => {
    const result: ResultDataLike = {
      summary: { totalTaxesPaid: 9_999, averageRetirementIncome: 1_234 },
    };
    const m = extractImpactMetrics(result);
    expect(m.lifetimeTax).toBe(9_999);
    expect(m.afterTaxSpendingCovered).toBe(1_234);
    expect(m.endingEstate).toBe(0);
    expect(m.depletionAge).toBeNull();
    expect(m.oasClawback).toBe(0);
  });
});
