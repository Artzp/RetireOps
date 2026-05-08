'use client';

import { AlertTriangle, AlertOctagon } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { formatCurrency } from '@/lib/utils';

/**
 * YearByYearBadges — Phase 12 / Plan 12-05.
 *
 * Three small visual primitives extracted from YearByYearTab.tsx so the host
 * stays under the 800 LOC budget. All a11y attributes preserved verbatim per
 * UI-06 (data-shortfall, aria-label fragments, lucide icon sizing).
 *
 * @see .planning/phases/12-yearbyyear-column-registry/12-05-PLAN.md
 * @see .planning/phases/02-cell-provenance/02-UI-SPEC.md (Override Indicator + Clamp Warning)
 */

/** Green dot: cell has an active override (D-22, UI-SPEC §Override Indicator). */
export function OverrideDot() {
  return (
    <span
      aria-hidden="true"
      className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-ds-primary align-middle"
    />
  );
}

/**
 * Amber triangle badge: the last /run clamped the override to available balance.
 * D-13, UI-SPEC §Clamp Warning Display Surface 1.
 * Exact tooltip copy locked by UI-SPEC Copywriting Contract.
 */
export function ClampBadge({
  requestedReal,
  clampedTo,
}: {
  requestedReal: number;
  clampedTo: number;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="ml-1 inline-flex align-middle"
          aria-label={`Clamped: requested ${formatCurrency(requestedReal)} — actual withdrawal ${formatCurrency(clampedTo)} (balance exhausted)`}
          data-clamp="true"
        >
          <AlertTriangle className="h-3 w-3 text-amber-700" />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {`Clamped: requested ${formatCurrency(requestedReal)} — actual withdrawal ${formatCurrency(clampedTo)} (balance exhausted)`}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Red octagon badge: household net cash flow is negative for this year — a structural
 * spending shortfall the engine could not cover from available withdrawals.
 *
 * Common causes: locked withdrawal/spending overrides, depleted accounts, owner-tagged
 * routing without spousal pooling. Distinct from {@link ClampBadge} (which signals an
 * individual override clamp, not a household-wide funding gap).
 */
export function ShortfallBadge({ shortfall }: { shortfall: number }) {
  const label = `Spending shortfall: household net cash flow this year is ${formatCurrency(shortfall)}. Living expenses exceeded available withdrawals — common causes are locked overrides, depleted accounts, or owner-tagged routing without pooling.`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="ml-1 inline-flex align-middle" aria-label={label} data-shortfall="true">
          <AlertOctagon className="h-3 w-3 text-red-700" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
