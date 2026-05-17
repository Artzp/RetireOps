/**
 * AccountPriorityCard — a single reorderable account card.
 *
 * Renders:
 *  - account label + tax treatment label (e.g. "TFSA Main • Tax-free (TFSA)")
 *  - current balance + first-withdrawal-year + lifetime withdrawals
 *  - up/down buttons with aria-labels (keyboard accessible — WD-UI-04)
 *  - warning-badge slot (empty in Phase 28; Phase 29 ConstraintWarningBanner
 *    will populate via the same data-warning-slot CSS contract)
 *
 * Presentational only: reorder callbacks bubble to WithdrawalPlanSection.
 *
 * @see .planning/phases/28-account-priority-cards-preset-selector-ui/28-CONTEXT.md
 */
'use client';

import { ChevronUp, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { engineTokenForCardType } from './preset-apply';
import type { AccountPriorityCardProps } from './types';

export function AccountPriorityCard({
  account,
  metadata,
  position,
  totalPositions,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  warnings,
}: AccountPriorityCardProps): JSX.Element {
  // Phase 29 Plan 02: pick the highest-priority warning (the array is already
  // ordered OAS > capgains > RRIF > LIF > TFSA by buildAllConstraintWarnings)
  // whose accountType matches this card. Cards without a match leave the
  // data-warning-slot empty (Phase 28 CSS contract: `empty:hidden`).
  const cardToken = engineTokenForCardType(account.type);
  const matchingWarning = (warnings ?? []).find((w) => w.accountType === cardToken);
  return (
    <Card
      className="bg-ds-surface border-ds-outline-variant"
      data-account-id={account.id}
      data-account-type={account.type}
      data-position={position}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-ds-on-surface">{account.label}</span>
              <Badge variant="outline" className="text-xs">
                {metadata.taxTreatmentLabel}
              </Badge>
            </div>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-ds-on-surface-variant">
              <div>
                <div className="font-medium text-ds-on-surface">
                  {formatCurrency(metadata.balance)}
                </div>
                <div>Current balance</div>
              </div>
              <div>
                <div className="font-medium text-ds-on-surface">
                  {metadata.firstWithdrawalYear !== undefined
                    ? String(metadata.firstWithdrawalYear)
                    : '—'}
                </div>
                <div>First projected withdrawal</div>
              </div>
              <div>
                <div className="font-medium text-ds-on-surface">
                  {formatCurrency(metadata.lifetimeWithdrawals)}
                </div>
                <div>Lifetime withdrawals</div>
              </div>
            </div>
            {/* Warning-badge slot — Phase 28 CSS contract; populated by Phase 29 Plan 02. */}
            <div
              data-warning-slot="account-priority"
              className="mt-2 flex flex-wrap gap-1 empty:hidden"
              aria-live="polite"
            >
              {matchingWarning ? (
                <Badge
                  variant="outline"
                  className="text-[11px] border-amber-300 bg-amber-50 text-amber-900"
                  data-warning-id={matchingWarning.id}
                  title={matchingWarning.message}
                >
                  {matchingWarning.title}
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              aria-label={`Move ${account.label} up (currently position ${String(position)} of ${String(totalPositions)})`}
              className="min-h-[44px] min-w-[44px]"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              aria-label={`Move ${account.label} down (currently position ${String(position)} of ${String(totalPositions)})`}
              className="min-h-[44px] min-w-[44px]"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
