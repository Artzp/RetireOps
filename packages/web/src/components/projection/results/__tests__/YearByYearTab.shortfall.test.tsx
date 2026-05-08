/**
 * Component tests for the shortfall badge on the Year column.
 *
 * Shows a red AlertOctagon badge with `data-shortfall="true"` when a row's
 * householdNetCashFlow is below -$1 (threshold avoids floating-point noise).
 * Stays hidden when household net cash flow is non-negative or trivially below zero.
 *
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { YearByYearTab } from '../YearByYearTab';
import type { ProjectionYearRow } from '@retireops/shared';

// ---------------------------------------------------------------------------
// Mock useOverrideEditor — minimal stub; this test does not exercise the editor.
// ---------------------------------------------------------------------------
vi.mock('@/hooks/useOverrideEditor', () => ({
  useOverrideEditor: vi.fn(() => ({
    openCell: null,
    openPopover: vi.fn(),
    setOpenCell: vi.fn(),
    closePopover: vi.fn(),
    savePopover: vi.fn().mockResolvedValue(undefined),
    getActiveWithdrawalOverride: vi.fn().mockReturnValue(undefined),
    getActiveSpendingOverride: vi.fn().mockReturnValue(undefined),
    isRecomputing: false,
    decisions: {},
    removeOverride: vi.fn().mockResolvedValue(undefined),
    isRemoving: false,
  })),
  isEditableField: (f: string) => ['rrsp', 'rrif', 'lif', 'tfsa', 'nonreg', 'spending'].includes(f),
}));

// ---------------------------------------------------------------------------
// Row factory
// ---------------------------------------------------------------------------
function makeRow(year: number, overrides: Partial<ProjectionYearRow> = {}): ProjectionYearRow {
  return {
    year,
    age: 65 + (year - 2050),
    employmentIncome: 0,
    pensionIncome: 0,
    cppIncome: 0,
    oasIncome: 0,
    rrifWithdrawal: 0,
    tfsaWithdrawal: 0,
    nonRegWithdrawal: 0,
    totalGrossIncome: 0,
    federalTax: 0,
    provincialTax: 0,
    oasClawback: 0,
    totalTax: 0,
    effectiveTaxRate: 0,
    livingExpenses: 50_000,
    netCashFlow: 0,
    householdNetCashFlow: 0,
    rrspBalance: 0,
    rrifBalance: 0,
    tfsaBalance: 0,
    nonRegBalance: 0,
    totalNetWorth: 0,
    householdNetWorth: 0,
    ...overrides,
  } as ProjectionYearRow;
}

describe('YearByYearTab — shortfall badge on Year column', () => {
  it('renders ShortfallBadge for rows with householdNetCashFlow well below zero', () => {
    const rows = [
      makeRow(2050, { householdNetCashFlow: 5_000 }),
      makeRow(2059, { householdNetCashFlow: -36_465 }),
      makeRow(2074, { householdNetCashFlow: -53_927 }),
    ];

    const { container } = render(<YearByYearTab data={{ projectionRows: rows }} />);

    const badges = container.querySelectorAll('[data-shortfall="true"]');
    expect(badges).toHaveLength(2); // 2059 and 2074

    const yearCells = container.querySelectorAll('tr[data-year]');
    const row2059 = Array.from(yearCells).find((tr) => tr.getAttribute('data-year') === '2059');
    const row2050 = Array.from(yearCells).find((tr) => tr.getAttribute('data-year') === '2050');

    expect(row2059?.querySelector('[data-shortfall="true"]')).not.toBeNull();
    expect(row2050?.querySelector('[data-shortfall="true"]')).toBeNull();
  });

  it('does NOT render ShortfallBadge for rows with non-negative householdNetCashFlow', () => {
    const rows = [
      makeRow(2050, { householdNetCashFlow: 0 }),
      makeRow(2051, { householdNetCashFlow: 100 }),
      makeRow(2052, { householdNetCashFlow: 50_000 }),
    ];

    const { container } = render(<YearByYearTab data={{ projectionRows: rows }} />);

    expect(container.querySelectorAll('[data-shortfall="true"]')).toHaveLength(0);
  });

  it('does NOT render ShortfallBadge for trivial floating-point negatives (>= -1)', () => {
    // Threshold is < -1 so values like -0.0001 (rounding noise) do not trigger the badge.
    const rows = [
      makeRow(2050, { householdNetCashFlow: -0.5 }),
      makeRow(2051, { householdNetCashFlow: -0.999 }),
      makeRow(2052, { householdNetCashFlow: -1 }), // boundary — not strictly < -1
    ];

    const { container } = render(<YearByYearTab data={{ projectionRows: rows }} />);

    expect(container.querySelectorAll('[data-shortfall="true"]')).toHaveLength(0);
  });

  it('badge aria-label communicates shortfall amount and includes guidance', () => {
    const rows = [makeRow(2059, { householdNetCashFlow: -36_465 })];
    const { container } = render(<YearByYearTab data={{ projectionRows: rows }} />);

    const badge = container.querySelector('[data-shortfall="true"]');
    expect(badge).not.toBeNull();
    const aria = badge!.getAttribute('aria-label') ?? '';
    expect(aria).toMatch(/shortfall/i);
    expect(aria).toMatch(/-?\$36,465/); // formatted currency present in label
    expect(aria).toMatch(/locked overrides|depleted accounts|owner-tagged/i);
  });
});
