'use client';

import { formatCurrency } from '@/lib/utils';
import { MoneyCell } from './MoneyCell';
import { OverrideDot, ClampBadge } from './YearByYearBadges';
import { OverrideCellPopover } from './OverrideCellPopover';
import WithdrawalReasonPopover from '@/components/projection/withdrawal/WithdrawalReasonPopover';
import { useOverrideEditor } from '@/hooks/useOverrideEditor';
import type { WithdrawalReason } from '@/lib/explain-adapter';
import type { ProjectionYearRow } from '@retireops/shared/types';
import type { EditableCellProps } from './year-by-year-render-cell';

/** Editor surface this cell needs — the full useOverrideEditor return. */
type OverrideEditor = ReturnType<typeof useOverrideEditor>;

/** Map an EditableCell `field` token to the WithdrawalReason['account'] used for
 * the per-cell explainability lookup. Pure — hoisted out of the component. */
function fieldToAccount(field: string): WithdrawalReason['account'] | undefined {
  switch (field) {
    case 'rrif':
      return 'rrif';
    case 'tfsa':
      return 'tfsa';
    case 'nonreg':
      return 'nonReg';
    case 'lif':
      return 'lif';
    default:
      return undefined;
  }
}

interface InjectedDeps {
  editor: OverrideEditor;
  isEditable: boolean;
  reasonsByCell: Map<string, WithdrawalReason[]>;
  rows: ProjectionYearRow[];
}

/**
 * EditableCell — renders cell content with optional interactive trigger + popover.
 * At lg+: wraps in a role="button" with aria-label; below lg: plain text (D-31).
 * Phase 2: optional `provenance` forwarded to OverrideCellPopover (D-43).
 *
 * Extracted from YearByYearTab's lexically-scoped inner component; the four
 * injected deps (editor/isEditable/reasonsByCell/rows) are bound by the host via
 * a memoized wrapper and passed in as props.
 */
export function EditableCell({
  year,
  field,
  label,
  value,
  activeOverride,
  clampInfo,
  secondaryField,
  provenance,
  owner = 'primary',
  editor,
  isEditable,
  reasonsByCell,
  rows,
}: EditableCellProps & InjectedDeps) {
  const isOpen =
    editor.openCell?.year === year &&
    editor.openCell?.field === field &&
    (editor.openCell?.owner ?? 'primary') === owner;

  // Indicators
  const hasActiveOverride = activeOverride !== undefined;
  const isClamped = clampInfo !== undefined;

  // Phase 30 Plan 02 — explainability reasons for THIS cell (non-spending,
  // non-zero withdrawal fields only). Falls back to an empty list which the
  // WithdrawalReasonPopover renders as null.
  const account = fieldToAccount(field);
  const cellReasons: WithdrawalReason[] =
    account !== undefined && value > 0
      ? (reasonsByCell.get(`${String(year)}::${account}`) ?? [])
      : [];
  const reasonRow = rows.find((r) => r.year === year);

  // D5 fix: split cellContent into cellValue (edit trigger contents) and
  // reasonTrigger (sibling), so the popover <button> is never nested inside
  // the role="button" editable trigger — invalid nested-interactive HTML.
  const cellValue = (
    <span className="inline-flex items-center justify-end gap-0.5">
      <MoneyCell value={value} />
      {hasActiveOverride && !isClamped && <OverrideDot />}
      {isClamped && (
        <ClampBadge requestedReal={clampInfo.requestedReal} clampedTo={clampInfo.clampedTo} />
      )}
      {hasActiveOverride && isClamped && <OverrideDot />}
    </span>
  );

  const reasonTrigger =
    cellReasons.length > 0 && reasonRow !== undefined ? (
      <WithdrawalReasonPopover
        reasons={cellReasons}
        row={reasonRow}
        triggerLabel={`${label} ${String(year)}`}
      >
        ?
      </WithdrawalReasonPopover>
    ) : null;

  if (!isEditable) {
    // No override editor props — render read-only.
    return (
      <span className="inline-flex items-center justify-end gap-0.5">
        {cellValue}
        {reasonTrigger}
      </span>
    );
  }

  const editAriaLabel = `Edit ${label} ${String(year)} - current value ${formatCurrency(value)}`;

  return (
    <span className="inline-flex items-center justify-end gap-0.5 w-full">
      {/* Mobile (<lg): plain text only, no interaction (D-31). Reason trigger
          is desktop-only to avoid duplicate DOM elements that break .first()
          focus in Playwright (hidden elements cannot receive focus). */}
      <span className="lg:hidden inline-flex items-center gap-0.5">{cellValue}</span>

      {/* Desktop (lg+): editable trigger + sibling reason trigger */}
      <span className="hidden lg:inline-flex items-center justify-end gap-0.5 w-full">
        {/* Popover — Radix anchors to the trigger via PopoverTrigger asChild */}
        <OverrideCellPopover
          year={year}
          field={field}
          label={`${label} — ${String(year)}`}
          currentDisplayValue={value}
          activeOverride={activeOverride}
          clampInfo={clampInfo}
          open={isOpen}
          onOpenChange={(open) => {
            if (!open) editor.closePopover();
            else editor.openPopover(year, field, owner);
          }}
          onSave={async (payload) => {
            await editor.savePopover({
              primary: {
                amount: payload.primary.amount,
                applyForward: payload.primary.applyForward,
              },
              secondary: payload.secondary
                ? {
                    amount: payload.secondary.amount,
                    applyForward: payload.secondary.applyForward,
                  }
                : undefined,
            });
          }}
          onCancel={() => editor.closePopover()}
          secondaryField={secondaryField}
          provenance={provenance}
          mode="editable"
          // PHASE 3 (D-69, D-73): wire Remove button to hook's removeOverride()
          onRemoveOverride={
            activeOverride !== undefined
              ? async () => editor.removeOverride(field, year, owner)
              : undefined
          }
          isRemoving={editor.isRemoving}
        >
          <div
            role="button"
            tabIndex={0}
            aria-label={editAriaLabel}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            className="min-h-7 cursor-pointer inline-flex items-center justify-end rounded-sm px-1 hover:bg-ds-primary/10 focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ds-primary focus-visible:ring-offset-1"
            onClick={() => editor.openPopover(year, field, owner)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                editor.openPopover(year, field, owner);
              }
            }}
          >
            {cellValue}
          </div>
        </OverrideCellPopover>
        {reasonTrigger}
      </span>
    </span>
  );
}
