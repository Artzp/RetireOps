import { describe, it, expect } from 'vitest';
import type { ProjectionYearRow } from '@retireops/shared';
import { findContributionOverages } from './contribution-room';

function makeRow(year: number, partial: Partial<ProjectionYearRow>): ProjectionYearRow {
  return {
    year,
    age: 40 + (year - 2025),
    employmentIncome: 100_000,
    pensionIncome: 0,
    cppIncome: 0,
    oasIncome: 0,
    rrifWithdrawal: 0,
    tfsaWithdrawal: 0,
    nonRegWithdrawal: 0,
    totalGrossIncome: 100_000,
    federalTax: 0,
    provincialTax: 0,
    oasClawback: 0,
    totalTax: 0,
    effectiveTaxRate: 0,
    livingExpenses: 0,
    netCashFlow: 0,
    rrspBalance: 0,
    rrifBalance: 0,
    tfsaBalance: 0,
    nonRegBalance: 0,
    totalNetWorth: 0,
    householdTotalIncome: 100_000,
    householdTotalTax: 0,
    householdNetCashFlow: 0,
    householdNetWorth: 0,
    rrifForcedMinimum: 0,
    rrifMinimumRate: 0,
    rrifConversionYear: false,
    isRetired: false,
    isRRIFConversionYear: false,
    ...partial,
  };
}

describe('findContributionOverages', () => {
  it('returns empty when no overrides or rows', () => {
    expect(findContributionOverages([], [])).toEqual([]);
  });

  it('returns empty when override is under the room', () => {
    const rows = [makeRow(2025, { rrspContributionRoom: 30_000 })];
    const violations = findContributionOverages(
      [{ accountId: 'rrsp-1', annualAmount: 10_000, startYear: 2025, endYear: 2025 }],
      rows
    );
    expect(violations).toEqual([]);
  });

  it('flags an override that exceeds room in a single year', () => {
    const rows = [makeRow(2025, { rrspContributionRoom: 20_000 })];
    const violations = findContributionOverages(
      [{ accountId: 'rrsp-1', annualAmount: 25_000, startYear: 2025, endYear: 2025 }],
      rows
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      accountId: 'rrsp-1',
      owner: 'primary',
      year: 2025,
      requested: 25_000,
      available: 20_000,
      overage: 5_000,
    });
  });

  it('flags each year an override spans that exceeds room', () => {
    const rows = [
      makeRow(2025, { rrspContributionRoom: 20_000 }),
      makeRow(2026, { rrspContributionRoom: 30_000 }),
      makeRow(2027, { rrspContributionRoom: 10_000 }),
    ];
    const violations = findContributionOverages(
      [{ accountId: 'rrsp-1', annualAmount: 25_000, startYear: 2025, endYear: 2027 }],
      rows
    );
    // 2025: 25k > 20k, 2026: 25k < 30k (ok), 2027: 25k > 10k
    expect(violations.map((v) => v.year)).toEqual([2025, 2027]);
    expect(violations.find((v) => v.year === 2027)?.overage).toBe(15_000);
  });

  it('skips rows without a rrspContributionRoom field', () => {
    const rows = [makeRow(2025, {})];
    const violations = findContributionOverages(
      [{ accountId: 'rrsp-1', annualAmount: 25_000, startYear: 2025, endYear: 2025 }],
      rows
    );
    expect(violations).toEqual([]);
  });

  it('checks spouse room when owner is spouse', () => {
    const rows = [
      makeRow(2025, { rrspContributionRoom: 30_000, spouseRrspContributionRoom: 5_000 }),
    ];
    const violations = findContributionOverages(
      [
        {
          accountId: 'rrsp-sp-1',
          annualAmount: 10_000,
          startYear: 2025,
          endYear: 2025,
          owner: 'spouse',
        },
      ],
      rows
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ owner: 'spouse', overage: 5_000 });
  });

  it('ignores overrides whose years fall outside the projection window', () => {
    const rows = [makeRow(2025, { rrspContributionRoom: 20_000 })];
    const violations = findContributionOverages(
      [{ accountId: 'rrsp-1', annualAmount: 99_000, startYear: 2030, endYear: 2032 }],
      rows
    );
    expect(violations).toEqual([]);
  });
});
