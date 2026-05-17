/**
 * Shared TypeScript contracts for the Withdrawal Plan UI (Phase 28).
 *
 * Consumed by:
 *  - WithdrawalPlanSection.tsx (top-level orchestrator)
 *  - AccountPriorityCard.tsx (individual card)
 *  - PresetSelectorCard.tsx (Plan 28-02)
 *  - PresetSwitchConfirmDialog.tsx (Plan 28-03)
 *
 * @see .planning/phases/28-account-priority-cards-preset-selector-ui/28-CONTEXT.md
 */

import type { AccountCardInfo } from '@/lib/profile-utils';
import type { ConstraintWarning } from '@/lib/constraint-warnings';

/**
 * Derived per-card metadata for display on AccountPriorityCard.
 * Pure function output from deriveAccountCardMetadata in account-metadata.ts.
 */
export interface AccountCardMetadata {
  /** Current balance from profile stepData.accounts[*].currentBalance (Number-coerced). */
  balance: number;
  /** Friendly tax treatment label, e.g. "Tax-free (TFSA)". */
  taxTreatmentLabel: string;
  /** Earliest year (calendar) where a withdrawal of this card's type is projected; undefined if never. */
  firstWithdrawalYear: number | undefined;
  /** Sum of all projected withdrawals of this card's type across the projection horizon. */
  lifetimeWithdrawals: number;
}

/**
 * Props for AccountPriorityCard — a single reorderable card.
 *
 * The card is presentational: all reordering is performed by the parent
 * via the onMove callbacks. canMoveUp / canMoveDown control button disabled state.
 */
export interface AccountPriorityCardProps {
  account: AccountCardInfo;
  metadata: AccountCardMetadata;
  position: number; // 1-based for screen-reader announcements
  totalPositions: number; // total cards in the list (e.g. 4)
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  /**
   * Optional advisory warnings (Phase 29 Plan 02). When supplied, the card's
   * `data-warning-slot` div renders a single small badge for the
   * highest-priority warning whose `accountType` matches this card's type.
   * Caller passes the FULL warnings array; the card does its own filtering
   * so the banner + cards stay in sync from a single source.
   */
  warnings?: ConstraintWarning[];
}

/**
 * Props for WithdrawalPlanSection — the top-level section.
 *
 * Receives ordered drawdownOrder (account ids) + the parent's account map.
 * Reorder callbacks bubble to the parent, which mutates taxState.drawdownOrder.
 */
export interface WithdrawalPlanSectionProps {
  /** Ordered list of account ids (the drawdownOrder tuple). */
  drawdownOrder: string[];
  /** All account cards from extractAccountCards(stepData). */
  accountCards: AccountCardInfo[];
  /** Per-card metadata, keyed by account id. */
  metadataByAccountId: Record<string, AccountCardMetadata>;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  /**
   * Optional advisory warnings (Phase 29 Plan 02). Rendered above the card
   * list via `<ConstraintWarningBanner>` and forwarded to each
   * `<AccountPriorityCard>` for per-card badge filtering. When omitted or
   * empty, the banner collapses to null and no per-card badges appear.
   *
   * Plan 29-02 ships structural wiring only — page.tsx currently passes
   * `warnings={[]}` (effectively no-op). A future plan will derive the live
   * `ConstraintInput` from projection-year rows and call
   * `buildAllConstraintWarnings` to populate this array.
   */
  warnings?: ConstraintWarning[];
}
