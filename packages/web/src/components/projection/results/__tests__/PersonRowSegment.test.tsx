/**
 * Unit tests for PersonRowSegment — Phase 12 / UI-05.
 *
 * @see ../PersonRowSegment.tsx
 * @see .planning/phases/12-yearbyyear-column-registry/12-04-PLAN.md
 */

import { describe, it, expect } from 'vitest';
import { type ReactNode } from 'react';
import { render } from '@testing-library/react';
import { PersonRowSegment } from '../PersonRowSegment';
import type { ColumnDef, SparseFlags } from '../year-by-year-columns';
import type { ProjectionYearRow } from '@retireops/shared';

const SPARSE_OFF: SparseFlags = {
  hasGis: false,
  hasLif: false,
  hasLiraBalance: false,
  hasLifBalance: false,
  hasPensionSplit: false,
  hasBracketFill: false,
  hasOverContributionPenalty: false,
};

const ALL_GROUPS = new Set<'income' | 'taxes' | 'spending' | 'balances'>([
  'income',
  'taxes',
  'spending',
  'balances',
]);

function makeRow(year: number, overrides: Partial<ProjectionYearRow> = {}): ProjectionYearRow {
  return {
    year,
    age: 65,
    employmentIncome: 1000,
    pensionIncome: 0,
    cppIncome: 0,
    oasIncome: 0,
    rrifWithdrawal: 0,
    tfsaWithdrawal: 0,
    nonRegWithdrawal: 0,
    totalGrossIncome: 1000,
    federalTax: 100,
    provincialTax: 50,
    oasClawback: 0,
    totalTax: 150,
    effectiveTaxRate: 0.15,
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

const stubRender = (col: ColumnDef): ReactNode => <span>{col.key}</span>;
const noHighlight = () => undefined;

function renderSegment(props: {
  owner: 'primary' | 'spouse' | 'household';
  group: 'income' | 'taxes' | 'spending' | 'balances';
  isCouple: boolean;
  sparseFlags?: SparseFlags;
  visibleGroups?: Set<'income' | 'taxes' | 'spending' | 'balances'>;
  cellHighlight?: (year: number, key: string) => 'true' | undefined;
  row?: ProjectionYearRow;
}) {
  const row = props.row ?? makeRow(2031);
  return render(
    <table>
      <tbody>
        <tr>
          <PersonRowSegment
            owner={props.owner}
            group={props.group}
            row={row}
            isCouple={props.isCouple}
            sparseFlags={props.sparseFlags ?? SPARSE_OFF}
            visibleGroups={props.visibleGroups ?? ALL_GROUPS}
            cellHighlight={props.cellHighlight ?? noHighlight}
            renderCell={stubRender}
          />
        </tr>
      </tbody>
    </table>
  );
}

describe('PersonRowSegment', () => {
  it('owner=primary income, sparse all-off, single → 8 td (no GIS, no LIF)', () => {
    const { container } = renderSegment({ owner: 'primary', group: 'income', isCouple: false });
    const tds = container.querySelectorAll('td[data-column-key]');
    expect(tds.length).toBe(8);
    const keys = Array.from(tds).map((td) => td.getAttribute('data-column-key'));
    expect(keys).toContain('employmentIncome');
    expect(keys).toContain('totalGrossIncome');
    expect(keys).not.toContain('gisIncome');
    expect(keys).not.toContain('lifWithdrawal');
  });

  it('owner=primary income, hasGis + hasLif → 10 td', () => {
    const { container } = renderSegment({
      owner: 'primary',
      group: 'income',
      isCouple: false,
      sparseFlags: { ...SPARSE_OFF, hasGis: true, hasLif: true },
    });
    const tds = container.querySelectorAll('td[data-column-key]');
    expect(tds.length).toBe(10);
    const keys = Array.from(tds).map((td) => td.getAttribute('data-column-key'));
    expect(keys).toContain('gisIncome');
    expect(keys).toContain('lifWithdrawal');
  });

  it('owner=spouse income, isCouple, sparse off → 7 spouse income td', () => {
    const { container } = renderSegment({ owner: 'spouse', group: 'income', isCouple: true });
    const tds = container.querySelectorAll('td[data-column-key]');
    expect(tds.length).toBe(7);
    const keys = Array.from(tds).map((td) => td.getAttribute('data-column-key'));
    expect(keys).toContain('spouseEmploymentIncome');
    expect(keys).toContain('spouseRrifWithdrawal');
    expect(keys).not.toContain('employmentIncome');
  });

  it('owner=household income, hasPensionSplit + hasBracketFill → primary + spouse + 4 split + 2 bracket-fill = 21 td', () => {
    const { container } = renderSegment({
      owner: 'household',
      group: 'income',
      isCouple: true,
      sparseFlags: { ...SPARSE_OFF, hasPensionSplit: true, hasBracketFill: true },
    });
    const tds = container.querySelectorAll('td[data-column-key]');
    // 8 primary + 7 spouse + 4 pension-split + 2 bracket-fill = 21
    expect(tds.length).toBe(21);
    const keys = Array.from(tds).map((td) => td.getAttribute('data-column-key'));
    expect(keys).toContain('pensionIncomeReceived');
    expect(keys).toContain('pensionSplitTaxSavings');
    expect(keys).toContain('bracketFillWithdrawal');
    expect(keys).toContain('spouseBracketFillWithdrawal');
  });

  it('owner=primary taxes, sparse off → 5 td (federalTax, provincialTax, oasClawback, totalTax, effectiveTaxRate)', () => {
    const { container } = renderSegment({ owner: 'primary', group: 'taxes', isCouple: false });
    const tds = container.querySelectorAll('td[data-column-key]');
    expect(tds.length).toBe(5);
  });

  it('owner=primary taxes, hasOverContributionPenalty → 6 td', () => {
    const { container } = renderSegment({
      owner: 'primary',
      group: 'taxes',
      isCouple: false,
      sparseFlags: { ...SPARSE_OFF, hasOverContributionPenalty: true },
    });
    const tds = container.querySelectorAll('td[data-column-key]');
    expect(tds.length).toBe(6);
    const keys = Array.from(tds).map((td) => td.getAttribute('data-column-key'));
    expect(keys).toContain('overContributionPenalty');
  });

  it('group not in visibleGroups → 0 td', () => {
    const { container } = renderSegment({
      owner: 'primary',
      group: 'income',
      isCouple: false,
      visibleGroups: new Set(['taxes', 'spending', 'balances']),
    });
    const tds = container.querySelectorAll('td[data-column-key]');
    expect(tds.length).toBe(0);
  });

  it('cellHighlight → adds data-cascade-highlight="true" only to matching cells', () => {
    const { container } = renderSegment({
      owner: 'primary',
      group: 'income',
      isCouple: false,
      cellHighlight: (_y, k) => (k === 'employmentIncome' ? 'true' : undefined),
    });
    const tds = container.querySelectorAll('td[data-column-key]');
    const empCell = Array.from(tds).find(
      (td) => td.getAttribute('data-column-key') === 'employmentIncome'
    );
    const totalCell = Array.from(tds).find(
      (td) => td.getAttribute('data-column-key') === 'totalGrossIncome'
    );
    expect(empCell?.getAttribute('data-cascade-highlight')).toBe('true');
    // unset attr renders as null when undefined
    expect(totalCell?.getAttribute('data-cascade-highlight')).toBeNull();
  });

  it('tdClassName for federalTax cell includes text-ds-error', () => {
    const { container } = renderSegment({ owner: 'primary', group: 'taxes', isCouple: false });
    const tds = container.querySelectorAll('td[data-column-key]');
    const fed = Array.from(tds).find((td) => td.getAttribute('data-column-key') === 'federalTax');
    expect(fed?.className).toContain('text-ds-error');
  });

  it('every emitted td carries data-year matching row.year', () => {
    const { container } = renderSegment({
      owner: 'primary',
      group: 'income',
      isCouple: false,
      row: makeRow(2042),
    });
    const tds = container.querySelectorAll('td[data-column-key]');
    expect(tds.length).toBeGreaterThan(0);
    for (const td of Array.from(tds)) {
      expect(td.getAttribute('data-year')).toBe('2042');
    }
  });
});
