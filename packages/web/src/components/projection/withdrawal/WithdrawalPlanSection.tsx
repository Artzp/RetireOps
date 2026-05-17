/**
 * WithdrawalPlanSection — top-level container for the Withdrawal Plan UI (Phase 28).
 *
 * Renders the ordered list of AccountPriorityCard components plus an aria-live
 * announcement region that names the last-reordered account's new position.
 *
 * Plan 28-03 will:
 *  - mount this section above the Tax Strategy card on the scenario edit page
 *  - mount the Plan 28-02 PresetSelectorCard above THIS section
 *  - keep taxState.drawdownOrder in the parent (page.tsx) — this component
 *    receives drawdownOrder + onMoveUp/onMoveDown via props
 *
 * @see .planning/phases/28-account-priority-cards-preset-selector-ui/28-CONTEXT.md
 * @see WD-UI-01, WD-UI-04, WD-UI-07
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import { AccountPriorityCard } from './AccountPriorityCard';
import { ConstraintWarningBanner } from './ConstraintWarningBanner';
import type { WithdrawalPlanSectionProps } from './types';

export function WithdrawalPlanSection({
  drawdownOrder,
  accountCards,
  metadataByAccountId,
  onMoveUp,
  onMoveDown,
  warnings,
}: WithdrawalPlanSectionProps): JSX.Element {
  const warningsList = warnings ?? [];
  const accountMap = new Map(accountCards.map((a) => [a.id, a]));
  const [announcement, setAnnouncement] = useState('');
  const prevOrderRef = useRef<string[]>(drawdownOrder);

  // After every reorder, find what moved and announce its new position.
  useEffect(() => {
    const prev = prevOrderRef.current;
    if (prev.length !== drawdownOrder.length) {
      prevOrderRef.current = drawdownOrder;
      return;
    }
    let movedId: string | undefined;
    for (let i = 0; i < drawdownOrder.length; i++) {
      if (prev[i] !== drawdownOrder[i]) {
        movedId = drawdownOrder[i];
        break;
      }
    }
    if (movedId !== undefined) {
      const newIndex = drawdownOrder.indexOf(movedId);
      const moved = accountMap.get(movedId);
      if (moved) {
        setAnnouncement(
          `Moved ${moved.label} to position ${String(newIndex + 1)} of ${String(drawdownOrder.length)}.`
        );
      }
    }
    prevOrderRef.current = drawdownOrder;
  }, [drawdownOrder, accountMap]);

  if (drawdownOrder.length === 0) {
    return (
      <section aria-labelledby="withdrawal-plan-heading" className="space-y-3">
        <h2 id="withdrawal-plan-heading" className="text-base font-semibold text-ds-on-surface">
          Withdrawal Plan
        </h2>
        <p className="text-sm text-muted-foreground">No accounts configured in your profile.</p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="withdrawal-plan-heading"
      className="space-y-3"
      data-section="withdrawal-plan"
    >
      <h2 id="withdrawal-plan-heading" className="text-base font-semibold text-ds-on-surface">
        Withdrawal Plan
      </h2>
      <p className="text-sm text-ds-on-surface-variant">
        Set the order accounts are drawn down. Use the up and down buttons to reorder.
      </p>
      <ConstraintWarningBanner warnings={warningsList} />
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="withdrawal-reorder-announcement"
      >
        {announcement}
      </div>
      <ol className="space-y-2" data-testid="withdrawal-priority-list">
        {drawdownOrder.map((accountId, i) => {
          const account = accountMap.get(accountId);
          if (!account) return null;
          const metadata = metadataByAccountId[accountId];
          if (!metadata) return null;
          return (
            <li key={accountId}>
              <AccountPriorityCard
                account={account}
                metadata={metadata}
                position={i + 1}
                totalPositions={drawdownOrder.length}
                canMoveUp={i > 0}
                canMoveDown={i < drawdownOrder.length - 1}
                onMoveUp={() => onMoveUp(i)}
                onMoveDown={() => onMoveDown(i)}
                warnings={warningsList}
              />
            </li>
          );
        })}
      </ol>
    </section>
  );
}
