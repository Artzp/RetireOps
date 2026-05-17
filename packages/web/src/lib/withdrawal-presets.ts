/**
 * Withdrawal Presets — web-layer mirror of @retireops/shared/withdrawal/presets.ts.
 *
 * Inlined here per Phase 27 WR-01 resilience pattern: a byte-equivalent copy of
 * the shared catalog avoids the pnpm-monorepo dist-build dance and keeps the
 * web bundle independent of @retireops/shared rebuild order.
 *
 * BYTE-EQUIVALENCE INVARIANT (test-enforced):
 *   For every preset id, the drawdownOrder tuple (if any) and the
 *   rrspMeltdown / oasClawbackAvoidance flags MUST match the values in
 *   packages/shared/src/withdrawal/presets.ts exactly. The pin test in
 *   __tests__/withdrawal-presets.test.ts asserts this by importing the
 *   shared catalog and deep-comparing.
 *
 * If you change a tuple here without updating the shared source (or vice
 * versa), the pin test will fail with a diff.
 *
 * @see packages/shared/src/withdrawal/presets.ts (source of truth)
 * @see .planning/phases/27-preset-mapping-infrastructure/27-DECISIONS.md (PRESET-05 + PRESET-06)
 */

export type WithdrawalPresetId =
  | 'taxEfficientDefault'
  | 'preserveTfsaLongest'
  | 'useTfsaEarlier'
  | 'smoothRrspRrifBefore71'
  | 'protectOas'
  | 'custom';

/**
 * Per-preset display metadata. The drawdownOrder field, when present, is the
 * EXACT tuple from the shared catalog (engine-type order, includes both
 * 'rrsp' and 'rrif' tokens per PRESET-06).
 */
export interface WebWithdrawalPreset {
  id: WithdrawalPresetId;
  name: string;
  description: string;
  /** Engine-type-order tuple. undefined for taxEfficientDefault (uses strategyId) and custom. */
  drawdownOrder: ReadonlyArray<string> | undefined;
  /** True when this preset toggles rrspMeltdown.enabled. */
  enablesMeltdown: boolean;
  /** True when this preset toggles oasClawbackAvoidance.enabled. */
  enablesClawbackAvoidance: boolean;
}

/**
 * Ordered preset list. 'custom' is last and acts as a status indicator —
 * the PresetSelectorCard does NOT render it as a clickable card; it is
 * surfaced as "Custom (your order)" only when no other preset matches.
 */
export const WEB_WITHDRAWAL_PRESETS: ReadonlyArray<WebWithdrawalPreset> = [
  {
    id: 'taxEfficientDefault',
    name: 'Tax-efficient default',
    description: 'Engine default: Non-Reg, then RRSP/RRIF, then TFSA last.',
    drawdownOrder: ['nonReg', 'rrif', 'rrsp', 'tfsa'],
    enablesMeltdown: false,
    enablesClawbackAvoidance: false,
  },
  {
    id: 'preserveTfsaLongest',
    name: 'Preserve TFSA longest',
    description: 'Draw down registered first; let the TFSA compound tax-free.',
    drawdownOrder: ['rrsp', 'rrif', 'nonReg', 'tfsa'],
    enablesMeltdown: false,
    enablesClawbackAvoidance: false,
  },
  {
    id: 'useTfsaEarlier',
    name: 'Use TFSA earlier',
    description: 'Spend Non-Reg and TFSA first to keep registered balances growing.',
    drawdownOrder: ['nonReg', 'tfsa', 'rrsp', 'rrif'],
    enablesMeltdown: false,
    enablesClawbackAvoidance: false,
  },
  {
    id: 'smoothRrspRrifBefore71',
    name: 'Smooth RRSP/RRIF before 71',
    description: 'Melt RRSPs into income before the post-71 minimum withdrawal spike.',
    drawdownOrder: ['rrsp', 'rrif', 'nonReg', 'tfsa'],
    enablesMeltdown: true,
    enablesClawbackAvoidance: false,
  },
  {
    id: 'protectOas',
    name: 'Protect OAS',
    description: 'Keep taxable income below the 2026 OAS clawback threshold ($95,323).',
    drawdownOrder: ['tfsa', 'nonReg', 'rrsp', 'rrif'],
    enablesMeltdown: false,
    enablesClawbackAvoidance: true,
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Your custom drawdown order.',
    drawdownOrder: undefined,
    enablesMeltdown: false,
    enablesClawbackAvoidance: false,
  },
];

/**
 * Input shape for resolvePresetIdFromOrder.
 *
 * drawdownTypeOrder: the user's drawdownOrder mapped to engine TYPE tokens
 *   ('rrsp','rrif','tfsa','nonReg','lif'), with adjacent duplicates of the
 *   same type COLLAPSED. (page.tsx stores drawdownOrder as account-card IDs;
 *   Plan 28-03 will translate to types before calling this resolver.)
 *
 * strategyId: the scenario's strategyId field, if any.
 */
export interface ResolvePresetInput {
  drawdownTypeOrder: ReadonlyArray<string>;
  strategyId?: string;
  meltdownEnabled: boolean;
  clawbackEnabled: boolean;
}

/**
 * Returns the WithdrawalPresetId that matches the input, or 'custom' if none match.
 *
 * Resolution priority (most-specific first):
 *  1. taxEfficientDefault — strategyId === 'standard' AND no special flags
 *  2. smoothRrspRrifBefore71 — tuple match AND meltdownEnabled
 *  3. protectOas — tuple match AND clawbackEnabled
 *  4. preserveTfsaLongest / useTfsaEarlier — tuple match AND NO special flags
 *  5. 'custom'
 *
 * Two arrays are tuple-equal iff same length and element-wise ===.
 */
export function resolvePresetIdFromOrder(input: ResolvePresetInput): WithdrawalPresetId {
  const { drawdownTypeOrder, strategyId, meltdownEnabled, clawbackEnabled } = input;

  // 1. taxEfficientDefault (strategy-id discriminator wins when no special flags)
  if (strategyId === 'standard' && !meltdownEnabled && !clawbackEnabled) {
    const td = WEB_WITHDRAWAL_PRESETS[0];
    if (td && tuplesEqual(drawdownTypeOrder, td.drawdownOrder ?? [])) {
      return 'taxEfficientDefault';
    }
    // Allow taxEfficientDefault to match even when drawdownOrder is empty (engine fallback)
    if (drawdownTypeOrder.length === 0) return 'taxEfficientDefault';
  }

  // 2. smoothRrspRrifBefore71 (tuple + meltdown)
  if (meltdownEnabled && !clawbackEnabled) {
    const p = WEB_WITHDRAWAL_PRESETS[3];
    if (p && tuplesEqual(drawdownTypeOrder, p.drawdownOrder ?? [])) {
      return 'smoothRrspRrifBefore71';
    }
  }

  // 3. protectOas (tuple + clawback)
  if (clawbackEnabled && !meltdownEnabled) {
    const p = WEB_WITHDRAWAL_PRESETS[4];
    if (p && tuplesEqual(drawdownTypeOrder, p.drawdownOrder ?? [])) {
      return 'protectOas';
    }
  }

  // 4. preserveTfsaLongest / useTfsaEarlier (tuple match, NO special flags)
  if (!meltdownEnabled && !clawbackEnabled) {
    const ptl = WEB_WITHDRAWAL_PRESETS[1];
    if (ptl && tuplesEqual(drawdownTypeOrder, ptl.drawdownOrder ?? [])) {
      return 'preserveTfsaLongest';
    }
    const ute = WEB_WITHDRAWAL_PRESETS[2];
    if (ute && tuplesEqual(drawdownTypeOrder, ute.drawdownOrder ?? [])) {
      return 'useTfsaEarlier';
    }
  }

  return 'custom';
}

function tuplesEqual(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Friendly type-token labels for the account-order summary display.
 */
const TYPE_LABEL: Record<string, string> = {
  rrsp: 'RRSP',
  rrif: 'RRIF',
  tfsa: 'TFSA',
  nonReg: 'Non-Reg',
  lif: 'LIF',
  lira: 'LIRA',
};

/**
 * Returns a short "TFSA → RRSP/RRIF → Non-Reg" preview of the preset's drawdownOrder.
 * RRSP and RRIF are collapsed to a single "RRSP/RRIF" entry (PRESET-06 single card).
 * Returns '—' for presets without a drawdownOrder (taxEfficientDefault has one;
 * only 'custom' returns the dash here).
 */
export function accountOrderSummary(preset: WebWithdrawalPreset): string {
  if (!preset.drawdownOrder) return '—';
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const token of preset.drawdownOrder) {
    const collapsed =
      token === 'rrsp' || token === 'rrif' ? 'RRSP/RRIF' : (TYPE_LABEL[token] ?? token);
    if (!seen.has(collapsed)) {
      seen.add(collapsed);
      labels.push(collapsed);
    }
  }
  return labels.join(' → ');
}
