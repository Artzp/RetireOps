'use client';

import { type ReactNode } from 'react';
import type { ProjectionYearRow } from '@retireops/shared';
import {
  type ColumnDef,
  type PersonOwner,
  type SparseFlags,
  selectVisibleColumns,
  tdClassNameFor,
} from './year-by-year-columns';

export interface PersonRowSegmentProps {
  owner: PersonOwner;
  group: 'income' | 'taxes' | 'spending' | 'balances';
  row: ProjectionYearRow;
  isCouple: boolean;
  sparseFlags: SparseFlags;
  visibleGroups: Set<'income' | 'taxes' | 'spending' | 'balances'>;
  /** Highlight lookup — returns 'true' or undefined for the data-cascade-highlight attribute. */
  cellHighlight: (year: number, columnKey: string) => 'true' | undefined;
  /** Render-prop: caller (YearByYearTab) supplies the cell renderer with closure access to the
   *  override editor handle, badge components, and per-row metadata. PersonRowSegment is the
   *  layout shell only — the caller owns per-cell richness (provenance, owner-tagged overrides,
   *  clamp, secondary-field, RRIF merged-cell, OC-penalty short-circuit). */
  renderCell: (col: ColumnDef, row: ProjectionYearRow, owner: PersonOwner) => ReactNode;
}

/**
 * PersonRowSegment — Phase 12 / UI-05.
 *
 * Owner-scoped row segment for the YearByYearTab body. Looks up the registry slice for
 * `(group, owner)`, iterates it, and emits one
 * `<td data-column-key data-year data-cascade-highlight class={tdClassNameFor(col)}>`
 * per visible column. The caller-supplied `renderCell` produces the cell content
 * (EditableCell / ReadOnlyCell / merged RRIF cell / etc).
 *
 * The IDENTITY group (Year, Age, Sp. Age) stays inline in YearByYearTab.tsx — the Year
 * cell carries the ShortfallBadge + RRIF conversion badge + isFirstRetiredRow badge that
 * close over per-row state, and extracting them would re-introduce render-prop noise that
 * doesn't help readability.
 *
 * @see .planning/phases/12-yearbyyear-column-registry/12-04-PLAN.md
 */
export function PersonRowSegment({
  owner,
  group,
  row,
  isCouple,
  sparseFlags,
  visibleGroups,
  cellHighlight,
  renderCell,
}: PersonRowSegmentProps) {
  const columns = selectVisibleColumns(group, {
    visibleGroups,
    effectiveOwner: owner,
    isCouple,
    sparseFlags,
  });
  return (
    <>
      {columns.map((col) => (
        <td
          key={col.key}
          data-column-key={col.key}
          data-year={row.year}
          data-cascade-highlight={cellHighlight(row.year, col.key)}
          className={tdClassNameFor(col)}
        >
          {renderCell(col, row, owner)}
        </td>
      ))}
    </>
  );
}
