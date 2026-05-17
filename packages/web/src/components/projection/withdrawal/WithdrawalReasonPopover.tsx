/**
 * WithdrawalReasonPopover — per-cell explainability popover (Phase 30 Plan 02).
 *
 * Renders the plain-English explanation for ONE withdrawal cell on the
 * Year-by-Year table. Consumes a `reasons: WithdrawalReason[]` slice produced
 * by `explainYearWithdrawals` plus the originating `row` (for the year /
 * effectiveTaxRate context shown in the popover footer).
 *
 * Display format per 30-02-PLAN.md:
 *   Source: <account label>
 *   Reason: <reason text>
 *   Rule: <ruleId>
 *   Tax impact (~): <formatCurrency(amount * effectiveTaxRate)>
 *   Classification: <required | strategic | user-forced>
 *
 * Behaviour:
 *  - Empty `reasons` → renders `null`. Callers can pass through without a
 *    guard (the parent cell wrapper still emits the trigger). When wired into
 *    `YearByYearTab`, the trigger itself is conditionally rendered only when
 *    a withdrawal value is non-zero, so this null-render path is a defence in
 *    depth.
 *  - Accessible: the trigger is a `<button>` with an `aria-label` referencing
 *    the account + year. The popover content is announced via
 *    `aria-label="Withdrawal reason explanation"`.
 *
 * @see packages/web/src/lib/explain-adapter.ts (types / adapter)
 * @see packages/shared/src/withdrawal/explain.ts (shared source of truth)
 * @see .planning/phases/30-explainability-adapter-override-summary/30-02-PLAN.md
 */
'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatCurrency } from '@/lib/utils';
import type { ProjectionYearRowLike, WithdrawalReason } from '@/lib/explain-adapter';

/** Map internal account discriminator to the display label used in the popover. */
const ACCOUNT_LABEL: Record<WithdrawalReason['account'], string> = {
  rrsp: 'RRSP',
  rrif: 'RRIF',
  tfsa: 'TFSA',
  nonReg: 'Non-Registered',
  lif: 'LIF',
};

/** Tailwind chip colours per classification. Locked tokens (no new theme entries). */
const CLASSIFICATION_CHIP: Record<WithdrawalReason['classification'], string> = {
  required: 'bg-amber-100 text-amber-900 border-amber-300',
  strategic: 'bg-blue-100 text-blue-900 border-blue-300',
  'user-forced': 'bg-purple-100 text-purple-900 border-purple-300',
};

export interface WithdrawalReasonPopoverProps {
  /** Reasons for this cell — typically `explainYearWithdrawals(...).filter(r => r.account === <cellAccount>)`. */
  reasons: WithdrawalReason[];
  /** The row this cell belongs to — used for context (year / effectiveTaxRate). */
  row: ProjectionYearRowLike;
  /** Human-readable account label used in the trigger aria-label, e.g. "RRIF Withdrawal 2031". */
  triggerLabel: string;
  /** Render-prop children: the trigger surface (e.g. a small "?" button). */
  children: React.ReactNode;
}

export default function WithdrawalReasonPopover({
  reasons,
  row,
  triggerLabel,
  children,
}: WithdrawalReasonPopoverProps): JSX.Element | null {
  // No reasons → render nothing. (Defence in depth; trigger should already be
  // gated on a non-zero withdrawal at the call site.)
  if (reasons.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Why this ${triggerLabel}?`}
          aria-haspopup="dialog"
          data-testid="withdrawal-reason-trigger"
          className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-ds-outline-variant bg-ds-surface text-[10px] font-bold leading-none text-ds-on-surface-variant hover:bg-ds-surface-overlay hover:text-ds-on-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-primary"
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80"
        aria-label="Withdrawal reason explanation"
        data-testid="withdrawal-reason-popover"
      >
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-ds-on-background">
              Why this withdrawal? — {row.year}
            </h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Effective tax rate {(row.effectiveTaxRate * 100).toFixed(1)}% applied as tax-impact
              approximation.
            </p>
          </div>
          <ul className="space-y-3" data-testid="withdrawal-reason-list">
            {reasons.map((r, idx) => (
              <li
                key={`${r.account}-${r.ruleId}-${String(idx)}`}
                className="rounded-sm border border-ds-outline-variant bg-ds-surface p-2 text-xs"
                data-reason-account={r.account}
                data-reason-rule={r.ruleId}
                data-reason-classification={r.classification}
              >
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt className="text-ds-on-surface-variant">Source</dt>
                  <dd className="text-right font-medium text-ds-on-background">
                    {ACCOUNT_LABEL[r.account]}
                  </dd>
                  <dt className="text-ds-on-surface-variant">Reason</dt>
                  <dd className="text-right text-ds-on-background">{r.reason}</dd>
                  <dt className="text-ds-on-surface-variant">Rule</dt>
                  <dd className="text-right font-mono text-[11px] text-ds-on-surface-variant">
                    {r.ruleId}
                  </dd>
                  <dt className="text-ds-on-surface-variant">Tax impact (~)</dt>
                  <dd className="text-right tabular-nums text-ds-on-background">
                    {formatCurrency(r.taxImpactApprox)}
                  </dd>
                  <dt className="text-ds-on-surface-variant">Classification</dt>
                  <dd className="text-right">
                    <span
                      className={`inline-block rounded-sm border px-1.5 py-0.5 text-[10px] font-medium ${CLASSIFICATION_CHIP[r.classification]}`}
                    >
                      {r.classification}
                    </span>
                  </dd>
                </dl>
              </li>
            ))}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}
