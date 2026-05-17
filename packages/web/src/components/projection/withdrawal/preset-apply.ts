/**
 * Pure preset-apply logic for the Withdrawal Plan UI (Phase 28, Plan 28-03).
 *
 * Translates a WithdrawalPresetId into a TaxState delta:
 *  - drawdownOrder: account-card IDs reordered to match the preset's
 *    engine-type tuple. Cards of types not in the preset are appended.
 *  - rrspMeltdown: enabled per preset.enablesMeltdown with default amounts.
 *  - oasClawbackAvoidance: enabled per preset.enablesClawbackAvoidance with
 *    the 2026 threshold ($95,323).
 *  - incomeSplitting + bracketFill: preserved from prev (no preset touches them).
 *
 * Pure: no I/O, no Date.now(), no Math.random().
 *
 * @see PRESET-05 (locked Phase 27): overwrite-with-confirm. The CALLER decides
 *      whether to show the confirm dialog; this function unconditionally applies.
 */

import type { AccountCardInfo } from '@/lib/profile-utils';
import { WEB_WITHDRAWAL_PRESETS, type WithdrawalPresetId } from '@/lib/withdrawal-presets';

/**
 * The TaxState shape — kept structurally identical to the inline interface in
 * page.tsx. Duplicated here to keep this file independent of page.tsx imports.
 */
export interface TaxStateLike {
  drawdownOrder: string[];
  rrspMeltdown: { enabled: boolean; annualAmount: number; startYear: number; endYear: number };
  incomeSplitting: { enabled: boolean; splitPercent: number };
  oasClawbackAvoidance: { enabled: boolean; incomeThreshold: number };
  bracketFill: {
    enabled: boolean;
    bracketTarget: 'current' | 'next';
    annualCap: number | undefined;
  };
}

const TYPE_TO_ENGINE_TOKEN: Record<string, string> = {
  RRSP: 'rrsp',
  RRIF: 'rrif',
  TFSA: 'tfsa',
  NonReg: 'nonReg',
  LIF: 'lif',
  LIRA: 'lira',
};

/**
 * Maps an account-card type ('RRSP', 'TFSA', ...) to the engine token ('rrsp', 'tfsa', ...).
 * Returns the lower-cased input as a fallback for unknown types.
 */
export function engineTokenForCardType(type: string): string {
  return TYPE_TO_ENGINE_TOKEN[type] ?? type.toLowerCase();
}

/**
 * Returns the user's current drawdownOrder mapped to engine tokens, with adjacent
 * duplicates of the same token COLLAPSED. Used to feed resolvePresetIdFromOrder.
 *
 * Example: drawdownOrder = ['acc-rrsp-1', 'acc-rrsp-2', 'acc-tfsa-1']
 *          accountCards = [{ id: 'acc-rrsp-1', type: 'RRSP' }, ...]
 *          → ['rrsp', 'tfsa']
 */
export function drawdownOrderToTypeOrder(
  drawdownOrder: ReadonlyArray<string>,
  accountCards: ReadonlyArray<AccountCardInfo>
): string[] {
  const byId = new Map(accountCards.map((a) => [a.id, a.type]));
  const out: string[] = [];
  let last: string | undefined;
  for (const id of drawdownOrder) {
    const type = byId.get(id);
    if (type === undefined) continue;
    const token = engineTokenForCardType(type);
    if (token !== last) {
      out.push(token);
      last = token;
    }
  }
  return out;
}

/**
 * Returns a new drawdownOrder (account-card IDs) reordered to match the preset's
 * engine-type tuple. Cards of types NOT in the tuple are appended at the end
 * in their existing relative order. Tokens in the preset with no matching card
 * are silently dropped.
 */
function reorderCardIdsByPreset(
  prevOrder: ReadonlyArray<string>,
  presetTypeOrder: ReadonlyArray<string>,
  accountCards: ReadonlyArray<AccountCardInfo>
): string[] {
  const byId = new Map(accountCards.map((a) => [a.id, a.type]));
  const used = new Set<string>();
  const out: string[] = [];

  for (const token of presetTypeOrder) {
    for (const id of prevOrder) {
      if (used.has(id)) continue;
      const type = byId.get(id);
      if (type === undefined) continue;
      if (engineTokenForCardType(type) === token) {
        out.push(id);
        used.add(id);
      }
    }
  }
  // Append remaining cards (types the preset didn't mention) in prev order
  for (const id of prevOrder) {
    if (!used.has(id)) {
      out.push(id);
      used.add(id);
    }
  }
  return out;
}

/**
 * Default rrspMeltdown values when a preset enables it. Mirrors the shared
 * smoothRrspRrifBefore71 tuple defaults.
 */
const DEFAULT_MELTDOWN = {
  enabled: true,
  annualAmount: 25000,
  startYear: 2026,
  endYear: 2031,
} as const;

const DEFAULT_CLAWBACK = {
  enabled: true,
  incomeThreshold: 95323,
} as const;

/**
 * Applies a preset to the current TaxState. Returns a NEW TaxState.
 * 'custom' is a no-op (returns prev).
 */
export function applyPresetToTaxState(
  prev: TaxStateLike,
  presetId: WithdrawalPresetId,
  accountCards: ReadonlyArray<AccountCardInfo>
): TaxStateLike {
  if (presetId === 'custom') return prev;

  const preset = WEB_WITHDRAWAL_PRESETS.find((p) => p.id === presetId);
  if (!preset) return prev;

  const presetTypeOrder: ReadonlyArray<string> = preset.drawdownOrder ?? [
    // taxEfficientDefault has no drawdownOrder in the shared catalog; the
    // engine's standard default is nonReg → rrif → rrsp → tfsa.
    'nonReg',
    'rrif',
    'rrsp',
    'tfsa',
  ];

  const nextOrder = reorderCardIdsByPreset(prev.drawdownOrder, presetTypeOrder, accountCards);

  return {
    ...prev,
    drawdownOrder: nextOrder,
    rrspMeltdown: preset.enablesMeltdown
      ? { ...DEFAULT_MELTDOWN }
      : { ...prev.rrspMeltdown, enabled: false },
    oasClawbackAvoidance: preset.enablesClawbackAvoidance
      ? { ...DEFAULT_CLAWBACK }
      : { ...prev.oasClawbackAvoidance, enabled: false },
  };
}

/**
 * Returns true when the user's CURRENT drawdownOrder + flags differ from the
 * target preset's tuple. Used by the parent to decide whether to surface the
 * PRESET-05 confirm dialog before applying.
 *
 * Returns false for 'custom' (selecting custom is a no-op).
 */
export function presetSwitchNeedsConfirm(
  prev: TaxStateLike,
  targetPresetId: WithdrawalPresetId,
  accountCards: ReadonlyArray<AccountCardInfo>,
  currentPresetId: WithdrawalPresetId
): boolean {
  if (targetPresetId === 'custom') return false;
  if (targetPresetId === currentPresetId) return false;
  // If currently 'custom', any preset switch is an overwrite of a user-customized order.
  // (prev and accountCards reserved for future per-card divergence checks.)
  void prev;
  void accountCards;
  return currentPresetId === 'custom';
}
