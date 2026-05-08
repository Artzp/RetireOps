/**
 * Feature 3.4 Inflation Toggle — Engine Acceptance Tests
 *
 * TC-INF-003: Real conversion follows source-of-truth formula exactly
 * TC-INF-004: Zero inflation yields identical nominal and real values
 * TC-INF-005: Sign safety and deterministic behavior
 * TC-INF-007: Non-monetary fields (year/age/flags) preserved; monetary fields converted consistently
 *
 * Tests exercise `applyInflationDisplayMode` — the display-layer utility that
 * applies `nominalToReal` to all monetary fields of a ProjectionYearRow array.
 *
 * @see retireops-acceptance-tests/feature-3.4-inflation-toggle.md TC-INF-003, TC-INF-004, TC-INF-005, TC-INF-007
 * @see docs/source-of-truth/06-investment-engine.md — Real vs. Nominal Dollars
 */

import { describe, it, expect } from 'vitest';
import { applyInflationDisplayMode } from './inflation-display.js';
import type { ProjectionYearRow } from '@retireops/shared';

// ---------------------------------------------------------------------------
// Row fixture helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal ProjectionYearRow with all monetary fields set to `value`
 * and non-monetary fields at safe defaults.
 */
function buildRow(year: number, age: number, value: number): ProjectionYearRow {
  return {
    year,
    age,
    isRetired: true,
    isRRIFConversionYear: false,
    rrifConversionYear: false,

    // Primary income
    employmentIncome: value,
    pensionIncome: value,
    cppIncome: value,
    oasIncome: value,
    rrifWithdrawal: value,
    tfsaWithdrawal: value,
    nonRegWithdrawal: value,
    totalGrossIncome: value,

    // Primary taxes
    federalTax: value,
    provincialTax: value,
    oasClawback: value,
    totalTax: value,
    effectiveTaxRate: 0, // rate — must NOT be converted

    // Primary spending
    livingExpenses: value,
    netCashFlow: value,

    // Primary balances
    rrspBalance: value,
    rrifBalance: value,
    tfsaBalance: value,
    nonRegBalance: value,
    totalNetWorth: value,

    // Household aggregates
    householdTotalIncome: value,
    householdTotalTax: value,
    householdNetCashFlow: value,
    householdNetWorth: value,

    // RRIF output
    rrifForcedMinimum: 0,
    rrifMinimumRate: 0,
  };
}

/**
 * Build an array of rows at successive year offsets, all carrying the same
 * nominal monetary value.
 */
function buildRows(nominalValue: number, count: number, startYear = 2026): ProjectionYearRow[] {
  return Array.from({ length: count }, (_, i) => buildRow(startYear + i, 65 + i, nominalValue));
}

/**
 * Index helper that narrows `T | undefined` to `T`, avoiding non-null assertions
 * under `noUncheckedIndexedAccess`.
 */
function at<T>(arr: readonly T[], i: number): T {
  const v = arr[i];
  if (v === undefined) throw new Error(`Expected element at index ${String(i)}`);
  return v;
}

// ---------------------------------------------------------------------------
// TC-INF-003: Real conversion follows source-of-truth formula exactly
// @see retireops-acceptance-tests/feature-3.4-inflation-toggle.md TC-INF-003
// @see docs/source-of-truth/06-investment-engine.md — Real vs. Nominal Dollars
// Formula: real = nominal / (1 + inflationRate)^years_from_start
// ---------------------------------------------------------------------------
describe('TC-INF-003: applyInflationDisplayMode — real conversion formula precision', () => {
  const NOMINAL = 100_000;
  const INFLATION = 0.02;
  const TOLERANCE = 1; // ±$1 for currency rounding

  it('TC-INF-003a: year offset 0 → real === 100000.00 (no deflation)', () => {
    const rows = buildRows(NOMINAL, 1);
    const result = applyInflationDisplayMode(rows, 'real', INFLATION);
    expect(at(result, 0).householdNetWorth).toBeCloseTo(100_000.0, 0);
  });

  it('TC-INF-003b: year offset 1 → real ≈ 98039.22 (±$1 tolerance)', () => {
    const rows = buildRows(NOMINAL, 2);
    const result = applyInflationDisplayMode(rows, 'real', INFLATION);
    expect(at(result, 1).householdNetWorth).toBeGreaterThanOrEqual(98_039.22 - TOLERANCE);
    expect(at(result, 1).householdNetWorth).toBeLessThanOrEqual(98_039.22 + TOLERANCE);
  });

  it('TC-INF-003c: year offset 10 → real ≈ 82034.83 (±$1 tolerance)', () => {
    const rows = buildRows(NOMINAL, 11);
    const result = applyInflationDisplayMode(rows, 'real', INFLATION);
    expect(at(result, 10).householdNetWorth).toBeGreaterThanOrEqual(82_034.83 - TOLERANCE);
    expect(at(result, 10).householdNetWorth).toBeLessThanOrEqual(82_034.83 + TOLERANCE);
  });

  it('TC-INF-003d: nominal mode returns householdNetWorth unchanged at every offset', () => {
    const rows = buildRows(NOMINAL, 11);
    const result = applyInflationDisplayMode(rows, 'nominal', INFLATION);
    for (const row of result) {
      expect(row.householdNetWorth).toBe(NOMINAL);
    }
  });

  it('TC-INF-003e: real conversion applies to all monetary fields (spot-check totalNetWorth)', () => {
    const rows = buildRows(NOMINAL, 2);
    const result = applyInflationDisplayMode(rows, 'real', INFLATION);
    // year offset 1: expected real = 100000 / 1.02 ≈ 98039.22
    expect(at(result, 1).totalNetWorth).toBeCloseTo(98_039.22, 0);
  });

  it('TC-INF-003f: effectiveTaxRate is NOT deflated (rate field, not monetary)', () => {
    const row: ProjectionYearRow = { ...buildRow(2026, 65, NOMINAL), effectiveTaxRate: 0.25 };
    const result = applyInflationDisplayMode([row], 'real', INFLATION);
    expect(at(result, 0).effectiveTaxRate).toBe(0.25);
  });
});

// ---------------------------------------------------------------------------
// TC-INF-004: Zero inflation yields identical nominal and real values
// @see retireops-acceptance-tests/feature-3.4-inflation-toggle.md TC-INF-004
// ---------------------------------------------------------------------------
describe('TC-INF-004: applyInflationDisplayMode — zero inflation equality', () => {
  it('TC-INF-004a: all monetary fields equal across modes when inflationRate === 0', () => {
    const rows = buildRows(500_000, 5);
    const nominal = applyInflationDisplayMode(rows, 'nominal', 0);
    const real = applyInflationDisplayMode(rows, 'real', 0);

    for (let i = 0; i < rows.length; i++) {
      expect(at(real, i).householdNetWorth).toBe(at(nominal, i).householdNetWorth);
      expect(at(real, i).totalNetWorth).toBe(at(nominal, i).totalNetWorth);
      expect(at(real, i).totalGrossIncome).toBe(at(nominal, i).totalGrossIncome);
      expect(at(real, i).livingExpenses).toBe(at(nominal, i).livingExpenses);
    }
  });
});

// ---------------------------------------------------------------------------
// TC-INF-005: Sign safety and deterministic behavior
// @see retireops-acceptance-tests/feature-3.4-inflation-toggle.md TC-INF-005
// ---------------------------------------------------------------------------
describe('TC-INF-005: applyInflationDisplayMode — determinism and sign safety', () => {
  it('TC-INF-005a: repeated calls with same inputs produce identical output', () => {
    const rows = buildRows(200_000, 10);
    const first = applyInflationDisplayMode(rows, 'real', 0.025);
    const second = applyInflationDisplayMode(rows, 'real', 0.025);

    for (let i = 0; i < rows.length; i++) {
      expect(at(second, i).householdNetWorth).toBe(at(first, i).householdNetWorth);
    }
  });

  it('TC-INF-005b: zero net-worth row remains zero in real mode (no sign flip)', () => {
    const zeroRow = buildRow(2026, 65, 0);
    const result = applyInflationDisplayMode([zeroRow], 'real', 0.02);
    expect(at(result, 0).householdNetWorth).toBe(0);
  });

  it('TC-INF-005c: no NaN or Infinity produced for any monetary field', () => {
    const rows = buildRows(50_000, 30);
    const result = applyInflationDisplayMode(rows, 'real', 0.03);

    for (const row of result) {
      expect(isNaN(row.householdNetWorth)).toBe(false);
      expect(isFinite(row.householdNetWorth)).toBe(true);
      expect(isNaN(row.totalNetWorth)).toBe(false);
      expect(isFinite(row.totalNetWorth)).toBe(true);
    }
  });

  it('TC-INF-005d: toggling nominal → real → nominal returns same values as original', () => {
    const rows = buildRows(100_000, 5);
    const nominal = applyInflationDisplayMode(rows, 'nominal', 0.02);
    const real = applyInflationDisplayMode(rows, 'real', 0.02);
    const backToNominal = applyInflationDisplayMode(rows, 'nominal', 0.02);

    for (let i = 0; i < rows.length; i++) {
      expect(at(backToNominal, i).householdNetWorth).toBe(at(nominal, i).householdNetWorth);
      // real values differ from nominal (inflation > 0, year > 0)
      if (i > 0) {
        expect(at(real, i).householdNetWorth).not.toBe(at(nominal, i).householdNetWorth);
      }
    }
  });

  it('TC-INF-005e: mode parameter is typed — only valid DisplayMode values accepted', () => {
    const rows = buildRows(100_000, 1);
    // Valid modes must not throw
    expect(() => applyInflationDisplayMode(rows, 'nominal', 0.02)).not.toThrow();
    expect(() => applyInflationDisplayMode(rows, 'real', 0.02)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// TC-INF-007: Non-currency columns remain unchanged; currency fields convert consistently
// @see retireops-acceptance-tests/feature-3.4-inflation-toggle.md TC-INF-007
// ---------------------------------------------------------------------------
describe('TC-INF-007: applyInflationDisplayMode — non-monetary fields preserved', () => {
  it('TC-INF-007a: year, age, and boolean flags are never deflated in real mode', () => {
    const rows = buildRows(100_000, 3);
    const result = applyInflationDisplayMode(rows, 'real', 0.02);

    for (let i = 0; i < rows.length; i++) {
      expect(at(result, i).year).toBe(at(rows, i).year);
      expect(at(result, i).age).toBe(at(rows, i).age);
      expect(at(result, i).isRetired).toBe(at(rows, i).isRetired);
      expect(at(result, i).isRRIFConversionYear).toBe(at(rows, i).isRRIFConversionYear);
      expect(at(result, i).rrifConversionYear).toBe(at(rows, i).rrifConversionYear);
    }
  });

  it('TC-INF-007b: all monetary fields deflate using the same year-offset basis', () => {
    const rows = buildRows(100_000, 2);
    const result = applyInflationDisplayMode(rows, 'real', 0.02);

    // Year offset 1 → every monetary field should equal 100000 / 1.02 ≈ 98039.22
    const expected = 100_000 / 1.02;
    const row1 = at(result, 1);
    const monetaryFields = [
      'totalGrossIncome',
      'totalTax',
      'livingExpenses',
      'rrspBalance',
      'rrifBalance',
      'tfsaBalance',
      'nonRegBalance',
      'totalNetWorth',
      'householdTotalIncome',
      'householdTotalTax',
      'householdNetWorth',
    ] as const;

    for (const field of monetaryFields) {
      expect(row1[field]).toBeCloseTo(expected, 0);
    }
  });

  it('TC-INF-007c: rrifMinimumRate is a rate, not a dollar amount — must NOT be deflated', () => {
    const row: ProjectionYearRow = { ...buildRow(2026, 65, 100_000), rrifMinimumRate: 0.054 };
    const result = applyInflationDisplayMode([row], 'real', 0.02);
    expect(at(result, 0).rrifMinimumRate).toBe(0.054);
  });
});

// ---------------------------------------------------------------------------
// TC-INF-MONETARY-AUDIT: previously missing top-level fields now deflate
//
// MONETARY_FIELDS originally omitted spouseLivingExpenses, spouseNetCashFlow,
// pension-splitting cash flows, contribution-room dollar amounts, and
// bracket-fill withdrawals. These fields appeared as nominal numbers next to
// deflated balance columns in the Year-by-Year tab when Real CAD mode was on,
// producing a misleading mixed-units view. After the audit they must deflate
// using the same year-offset formula.
//
// Also asserts pensionSplitPercentage stays untouched — it's a rate, not a
// dollar amount.
// ---------------------------------------------------------------------------
describe('TC-INF-MONETARY-AUDIT: newly listed monetary fields deflate; rate fields do not', () => {
  const NOMINAL = 100_000;
  const INFLATION = 0.02;
  const TOLERANCE = 1; // ±$1 currency rounding

  function buildAuditRow(yearOffset: number): ProjectionYearRow {
    const base = buildRow(2026 + yearOffset, 65 + yearOffset, NOMINAL);
    return {
      ...base,
      // Previously missing — must now deflate
      spouseLivingExpenses: NOMINAL,
      spouseNetCashFlow: NOMINAL,
      pensionIncomeReceived: NOMINAL,
      pensionIncomeTransferred: NOMINAL,
      spousePensionIncomeReceived: NOMINAL,
      spousePensionIncomeTransferred: NOMINAL,
      pensionSplitTaxSavings: NOMINAL,
      rrspContributionRoom: NOMINAL,
      spouseRrspContributionRoom: NOMINAL,
      bracketFillWithdrawal: NOMINAL,
      spouseBracketFillWithdrawal: NOMINAL,
      // Rate field — must NOT deflate
      pensionSplitPercentage: 0.5,
    };
  }

  it('TC-INF-MONETARY-AUDIT-a: spouseLivingExpenses deflates at year offset 1', () => {
    const rows = [buildAuditRow(0), buildAuditRow(1)];
    const result = applyInflationDisplayMode(rows, 'real', INFLATION);
    const expected = NOMINAL / 1.02;
    expect(at(result, 1).spouseLivingExpenses).toBeGreaterThanOrEqual(expected - TOLERANCE);
    expect(at(result, 1).spouseLivingExpenses).toBeLessThanOrEqual(expected + TOLERANCE);
  });

  it('TC-INF-MONETARY-AUDIT-b: spouseNetCashFlow deflates at year offset 1', () => {
    const rows = [buildAuditRow(0), buildAuditRow(1)];
    const result = applyInflationDisplayMode(rows, 'real', INFLATION);
    expect(at(result, 1).spouseNetCashFlow).toBeCloseTo(NOMINAL / 1.02, 0);
  });

  it('TC-INF-MONETARY-AUDIT-c: pension-splitting cash flows deflate', () => {
    const rows = [buildAuditRow(0), buildAuditRow(1)];
    const result = applyInflationDisplayMode(rows, 'real', INFLATION);
    const expected = NOMINAL / 1.02;
    const row1 = at(result, 1);
    expect(row1.pensionIncomeReceived).toBeCloseTo(expected, 0);
    expect(row1.pensionIncomeTransferred).toBeCloseTo(expected, 0);
    expect(row1.spousePensionIncomeReceived).toBeCloseTo(expected, 0);
    expect(row1.spousePensionIncomeTransferred).toBeCloseTo(expected, 0);
    expect(row1.pensionSplitTaxSavings).toBeCloseTo(expected, 0);
  });

  it('TC-INF-MONETARY-AUDIT-d: contribution-room and bracket-fill dollar fields deflate', () => {
    const rows = [buildAuditRow(0), buildAuditRow(1)];
    const result = applyInflationDisplayMode(rows, 'real', INFLATION);
    const expected = NOMINAL / 1.02;
    const row1 = at(result, 1);
    expect(row1.rrspContributionRoom).toBeCloseTo(expected, 0);
    expect(row1.spouseRrspContributionRoom).toBeCloseTo(expected, 0);
    expect(row1.bracketFillWithdrawal).toBeCloseTo(expected, 0);
    expect(row1.spouseBracketFillWithdrawal).toBeCloseTo(expected, 0);
  });

  it('TC-INF-MONETARY-AUDIT-e: pensionSplitPercentage is a rate — never deflated', () => {
    const rows = [buildAuditRow(0), buildAuditRow(1)];
    const result = applyInflationDisplayMode(rows, 'real', INFLATION);
    expect(at(result, 0).pensionSplitPercentage).toBe(0.5);
    expect(at(result, 1).pensionSplitPercentage).toBe(0.5);
  });

  it('TC-INF-MONETARY-AUDIT-f: nominal mode preserves all newly listed fields unchanged', () => {
    const rows = [buildAuditRow(0), buildAuditRow(1), buildAuditRow(5)];
    const result = applyInflationDisplayMode(rows, 'nominal', INFLATION);
    for (const row of result) {
      expect(row.spouseLivingExpenses).toBe(NOMINAL);
      expect(row.spouseNetCashFlow).toBe(NOMINAL);
      expect(row.pensionIncomeReceived).toBe(NOMINAL);
      expect(row.rrspContributionRoom).toBe(NOMINAL);
      expect(row.bracketFillWithdrawal).toBe(NOMINAL);
    }
  });
});
