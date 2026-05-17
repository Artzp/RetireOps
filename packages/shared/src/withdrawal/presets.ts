/**
 * Withdrawal Presets — v4.8 Withdrawal Experience
 *
 * Six named preset tuples that map a user-facing preset choice to a deterministic
 * `Partial<ScenarioDecisions>` overlay. Phase 28 UI applies a preset by merging
 * its tuple into the current scenario decisions; Phase 26 forwarding then carries
 * the resulting `drawdownOrder` / `rrspMeltdown` / `oasClawbackAvoidance` /
 * `strategyId` fields into the engine via `transformToProjectionInput`.
 *
 * @see .planning/phases/27-preset-mapping-infrastructure/27-CONTEXT.md
 * @see .planning/phases/27-preset-mapping-infrastructure/27-DECISIONS.md (PRESET-05 + PRESET-06)
 * @see docs/withdrawal-experience-design-brief.md §3 (preset list)
 * @see docs/source-of-truth/07-withdrawal-strategies.md
 * @see docs/source-of-truth/18-pensions-2026.md#2026-oas-clawback-threshold ($95,323)
 *
 * Architecture Principle IV: this file does NOT import from
 * `@retireops/calculation-engine`. Preset tuples are static literals;
 * downstream consumers (api transformer) reach the engine through their
 * own import paths.
 *
 * PRESET-06 (locked 2026-05-13): drawdownOrder tuples emit BOTH `'rrsp'` and
 * `'rrif'` as separate adjacent tokens (rrsp before rrif), mirroring the
 * engine's `accountPriorityToDrawdownOrder` output at
 * `packages/calculation-engine/src/withdrawals/strategy.ts:201-216`. A single
 * UI card labeled "RRSP / RRIF" represents both account types together.
 */
import { z } from 'zod';
import type { ScenarioDecisions } from '../types/scenario.js';

// ---------------------------------------------------------------------------
// Preset identifier — z.enum is the runtime symmetry partner of WithdrawalPresetId.
// Phase 28 may use this enum to validate a stored preset id; Phase 27 does not
// persist preset identity (deferred per 27-CONTEXT.md `<deferred>` section).
// ---------------------------------------------------------------------------

export const WithdrawalPresetIdSchema = z.enum([
  'taxEfficientDefault',
  'preserveTfsaLongest',
  'useTfsaEarlier',
  'smoothRrspRrifBefore71',
  'protectOas',
  'custom',
]);

export type WithdrawalPresetId = z.infer<typeof WithdrawalPresetIdSchema>;

// ---------------------------------------------------------------------------
// 2026 OAS clawback minimum threshold (from docs/source-of-truth/18-pensions-2026.md:824).
// Hard-coded here because the @retireops/shared/benefits-parameters table is not yet
// re-exported under the withdrawal subpath and we want zero cross-subpath deps
// from withdrawal/. Phase 31+ may revisit once IMP-04 finalizes preset metrics.
// ---------------------------------------------------------------------------

const OAS_CLAWBACK_THRESHOLD_2026 = 95_323;

// ---------------------------------------------------------------------------
// Preset catalog — six tuples keyed by WithdrawalPresetId.
// Each value is `Partial<ScenarioDecisions>` and MUST type-check against the
// inferred ScenarioDecisions type from packages/shared/src/types/scenario.ts.
// ---------------------------------------------------------------------------

/**
 * 1. taxEfficientDefault — baseline. Documented equivalent to engine's `'standard'`
 *    strategy. Sets `strategyId` (NOT `drawdownOrder`) so engine's `resolveStrategyId`
 *    provenance reads cleanly as 'standard'. Per 27-CONTEXT.md decision: setting
 *    `strategyId: 'standard'` is clearer than emitting the matching tuple.
 *    Engine standard order: ['nonReg','rrif','rrsp','tfsa'] (per strategy.ts:32-44 +
 *    accountPriorityToDrawdownOrder lif drop).
 *    @see docs/source-of-truth/07-withdrawal-strategies.md §1
 */
const taxEfficientDefault: Partial<ScenarioDecisions> = {
  strategyId: 'standard',
};

/**
 * 2. preserveTfsaLongest — TFSA drawn last; RRSP/RRIF first.
 *    Materially different from standard order (standard puts nonReg first).
 *    PRESET-06: BOTH 'rrsp' AND 'rrif' tokens, adjacent, rrsp first.
 *    @see docs/withdrawal-experience-design-brief.md §3 (preset list)
 */
const preserveTfsaLongest: Partial<ScenarioDecisions> = {
  drawdownOrder: ['rrsp', 'rrif', 'nonReg', 'tfsa'],
};

/**
 * 3. useTfsaEarlier — TFSA in middle; non-reg first then TFSA then rrsp/rrif.
 *    Bias toward keeping registered balances growing tax-sheltered while spending
 *    the relatively-flexible non-reg + TFSA buckets first.
 *    PRESET-06: BOTH 'rrsp' AND 'rrif' tokens, adjacent, rrsp first.
 */
const useTfsaEarlier: Partial<ScenarioDecisions> = {
  drawdownOrder: ['nonReg', 'tfsa', 'rrsp', 'rrif'],
};

/**
 * 4. smoothRrspRrifBefore71 — early RRSP drawdown to avoid post-71 RRIF minimum
 *    spikes. Enables `rrspMeltdown` over a default window (age-band assumption:
 *    user enters retirement at 65, conversion at 71 → meltdown spans those 6
 *    years; default annualAmount $25,000 sourced from brief §6's "smooth taxes"
 *    framing). Phase 28 UI may surface these as adjustable fields.
 *    drawdownOrder: standard registered-first ordering with BOTH rrsp/rrif tokens
 *    (engine still respects rrspMeltdown.annualAmount on top of the gap-fill loop).
 *    Window 2026-2031 is a sentinel default; Phase 28 may rewrite based on user's
 *    actual retirement age. targetAmount intentionally omitted (no RMLT-03 floor).
 *    @see docs/source-of-truth/07-withdrawal-strategies.md §3 (RRSP meltdown)
 *    @see packages/shared/src/types/scenario.ts:69-77 (rrspMeltdown schema)
 */
const smoothRrspRrifBefore71: Partial<ScenarioDecisions> = {
  drawdownOrder: ['rrsp', 'rrif', 'nonReg', 'tfsa'],
  rrspMeltdown: {
    enabled: true,
    annualAmount: 25_000,
    startYear: 2026,
    endYear: 2031,
  },
};

/**
 * 5. protectOas — bias withdrawals to keep taxable income below the OAS clawback
 *    threshold. Enables `oasClawbackAvoidance` with the 2026 minimum threshold
 *    ($95,323 per docs/source-of-truth/18-pensions-2026.md:824). drawdownOrder
 *    favors TFSA early (tax-free income) to keep net world income low.
 *    PRESET-06: BOTH 'rrsp' AND 'rrif' tokens, adjacent, rrsp first.
 *    @see docs/source-of-truth/07-withdrawal-strategies.md §4 (OAS Clawback Avoidance)
 *    @see packages/shared/src/types/scenario.ts:84-89 (oasClawbackAvoidance schema)
 */
const protectOas: Partial<ScenarioDecisions> = {
  drawdownOrder: ['tfsa', 'nonReg', 'rrsp', 'rrif'],
  oasClawbackAvoidance: {
    enabled: true,
    incomeThreshold: OAS_CLAWBACK_THRESHOLD_2026,
  },
};

/**
 * 6. custom — sentinel: empty Partial<ScenarioDecisions>. The UI's "preserve
 *    current order" affordance. Selecting this preset must NOT trigger the
 *    PRESET-05 confirm dialog (see 27-DECISIONS.md). It represents "no preset
 *    applied — user's existing drawdownOrder is authoritative."
 */
const custom: Partial<ScenarioDecisions> = {};

// ---------------------------------------------------------------------------
// Public catalog.
// `as const satisfies Record<WithdrawalPresetId, Partial<ScenarioDecisions>>`
// gives us literal-narrow types at the call site AND structural validation
// that every WithdrawalPresetId variant has an entry.
// ---------------------------------------------------------------------------

export const WITHDRAWAL_PRESETS = {
  taxEfficientDefault,
  preserveTfsaLongest,
  useTfsaEarlier,
  smoothRrspRrifBefore71,
  protectOas,
  custom,
} as const satisfies Record<WithdrawalPresetId, Partial<ScenarioDecisions>>;

/**
 * Returns the preset overlay for a given id, or undefined for unknown ids.
 * Phase 28 UI: `const overlay = getWithdrawalPreset(selectedId);`
 */
export function getWithdrawalPreset(id: WithdrawalPresetId): Partial<ScenarioDecisions> {
  return WITHDRAWAL_PRESETS[id];
}
