/**
 * Cascade diff helper — pure function.
 *
 * Compares two ProjectionYearRow[] snapshots cell-by-cell using the SAME
 * formatters YearByYearTab renders with. Returns a Map keyed by
 * "${year}::${columnKey}" containing only cells whose formatted display
 * string changed. Cells in rows present in only one snapshot are skipped
 * (D-60).
 *
 * @see .planning/phases/03-cascade-undo/03-CONTEXT.md - D-55, D-56, D-60, D-64
 * @see .planning/phases/03-cascade-undo/03-RESEARCH.md §Column → Formatter Map
 * @see .planning/phases/03-cascade-undo/03-UI-SPEC.md §Component Inventory §cascade-diff.ts
 */

import type { ProjectionYearRow } from '@retireops/shared';
import { formatCurrency } from './utils';

/** All diffable column keys — derived line-by-line from YearByYearTab.tsx render code. */
export const ALL_DIFFABLE_COLUMN_KEYS = [
  // Identity
  'year',
  'age',
  'spouseAge',
  // Income (currency)
  'employmentIncome',
  'pensionIncome',
  'cppIncome',
  'oasIncome',
  'gisIncome',
  'lifWithdrawal',
  'rrifWithdrawal',
  'tfsaWithdrawal',
  'nonRegWithdrawal',
  'totalGrossIncome',
  'spouseEmploymentIncome',
  'spousePensionIncome',
  'spouseCppIncome',
  'spouseOasIncome',
  'spouseRrifWithdrawal',
  'spouseTfsaWithdrawal',
  'spouseNonRegWithdrawal',
  'pensionIncomeReceived',
  'pensionIncomeTransferred',
  'pensionSplitTaxSavings',
  'bracketFillWithdrawal',
  'spouseBracketFillWithdrawal',
  // Percentages
  'pensionSplitPercentage',
  'effectiveTaxRate',
  'spouseEffectiveTaxRate',
  // Taxes (currency)
  'federalTax',
  'provincialTax',
  'oasClawback',
  'totalTax',
  'spouseFederalTax',
  'spouseProvincialTax',
  'spouseTotalTax',
  'overContributionPenalty', // composite — rrsp+tfsa+fhsa
  // Spending (currency)
  'livingExpenses',
  'netCashFlow',
  'spouseLivingExpenses',
  'spouseNetCashFlow',
  'householdNetCashFlow',
  // Balances (currency)
  'rrspBalance',
  'rrifBalance',
  'liraBalance',
  'lifBalance',
  'tfsaBalance',
  'nonRegBalance',
  'totalNetWorth',
  'spouseRrspBalance',
  'spouseRrifBalance',
  'spouseTfsaBalance',
  'spouseNonRegBalance',
  'householdNetWorth',
] as const;

type ColumnKey = (typeof ALL_DIFFABLE_COLUMN_KEYS)[number];

/**
 * Format a single cell value the same way YearByYearTab renders it.
 * Currency columns use formatCurrency; percentage columns use toFixed(1) + '%';
 * year/age use String(); spouseAge uses '—' for undefined; overContributionPenalty
 * uses sum-of-three or '—' fallback.
 */
function formatCell(row: ProjectionYearRow, columnKey: ColumnKey): string {
  switch (columnKey) {
    case 'year':
      return String(row.year);
    case 'age':
      return String(row.age);
    case 'spouseAge':
      return row.spouseAge === undefined ? '—' : String(row.spouseAge);
    case 'effectiveTaxRate':
      return `${(row.effectiveTaxRate * 100).toFixed(1)}%`;
    case 'spouseEffectiveTaxRate':
      return `${((row.spouseEffectiveTaxRate ?? 0) * 100).toFixed(1)}%`;
    case 'pensionSplitPercentage':
      return `${((row.pensionSplitPercentage ?? 0) * 100).toFixed(1)}%`;
    case 'overContributionPenalty': {
      const p = row.overContributionPenalty;
      const total = (p?.rrsp ?? 0) + (p?.tfsa ?? 0) + (p?.fhsa ?? 0);
      return total > 0 ? formatCurrency(total) : '—';
    }
    default: {
      // All remaining columns are currency — read by index, default to 0 if absent.
      const value = (row as unknown as Record<string, number | undefined>)[columnKey];
      return formatCurrency(value ?? 0);
    }
  }
}

/**
 * Diff two projection row arrays. Returns a Map keyed by `${year}::${columnKey}`
 * containing only cells whose formatted display value changed.
 *
 * Rows present in only one snapshot are skipped (D-60).
 * `displayMode` is reserved for v4.3 nominal-only ↔ real-toggle support; in v4.2
 * only nominal mode is active and the parameter does not affect the diff.
 */
export function diffProjectionRows(
  prev: ProjectionYearRow[],
  next: ProjectionYearRow[],
  _displayMode: 'real' | 'nominal'
): Map<string, true> {
  const result = new Map<string, true>();
  const prevByYear = new Map<number, ProjectionYearRow>();
  for (const row of prev) prevByYear.set(row.year, row);

  for (const nextRow of next) {
    const prevRow = prevByYear.get(nextRow.year);
    if (prevRow === undefined) continue; // D-60: row not in prev → skip
    for (const key of ALL_DIFFABLE_COLUMN_KEYS) {
      if (formatCell(prevRow, key) !== formatCell(nextRow, key)) {
        result.set(`${String(nextRow.year)}::${key}`, true);
      }
    }
  }
  return result;
}
