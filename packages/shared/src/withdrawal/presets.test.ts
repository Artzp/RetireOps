/**
 * Phase 27 — Preset catalog unit tests.
 *
 * Verifies:
 *  - All 6 preset ids exist (PRESET-01).
 *  - Each preset maps to a typed Partial<ScenarioDecisions> (PRESET-02).
 *  - taxEfficientDefault is documented-equivalent to engine 'standard' (PRESET-04 doc half).
 *  - PRESET-06 token-format invariant: drawdownOrder tuples emit BOTH 'rrsp' AND 'rrif'
 *    adjacent, rrsp at lower index.
 *  - WithdrawalPresetIdSchema validates ids (PRESET-01 z.enum symmetry).
 *  - Pitfall 8 trip-wire: ScenarioDecisionsSchema has NOT been extended with a
 *    `withdrawalPreset` field in Phase 27 (deferred per 27-CONTEXT.md).
 *
 * @see .planning/phases/27-preset-mapping-infrastructure/27-DECISIONS.md
 * @see .planning/phases/27-preset-mapping-infrastructure/27-CONTEXT.md
 */
import { describe, it, expect } from 'vitest';
import {
  WITHDRAWAL_PRESETS,
  WithdrawalPresetIdSchema,
  getWithdrawalPreset,
  type WithdrawalPresetId,
} from './presets.js';
import { ScenarioDecisionsSchema } from '../types/scenario.js';

const ALL_PRESET_IDS: readonly WithdrawalPresetId[] = [
  'taxEfficientDefault',
  'preserveTfsaLongest',
  'useTfsaEarlier',
  'smoothRrspRrifBefore71',
  'protectOas',
  'custom',
] as const;

describe('WITHDRAWAL_PRESETS catalog (PRESET-01 / PRESET-02)', () => {
  it('contains exactly the 6 expected ids (PRESET-01)', () => {
    const keys = Object.keys(WITHDRAWAL_PRESETS).sort();
    expect(keys).toEqual([...ALL_PRESET_IDS].sort());
  });

  it('getWithdrawalPreset(id) returns the catalog entry for every id (PRESET-02 round-trip)', () => {
    for (const id of ALL_PRESET_IDS) {
      const overlay = getWithdrawalPreset(id);
      expect(overlay).toBe(WITHDRAWAL_PRESETS[id]);
      expect(typeof overlay).toBe('object');
      expect(overlay).not.toBeNull();
    }
  });
});

describe('Per-preset tuple shape', () => {
  it('taxEfficientDefault sets strategyId only (PRESET-04 equivalence to engine "standard")', () => {
    const p = WITHDRAWAL_PRESETS.taxEfficientDefault;
    expect(p.strategyId).toBe('standard');
    expect(p.drawdownOrder).toBeUndefined();
    expect(p.rrspMeltdown).toBeUndefined();
    expect(p.oasClawbackAvoidance).toBeUndefined();
    // strategyId is the ONLY key — sentinel guard against accidental field additions.
    expect(Object.keys(p)).toEqual(['strategyId']);
  });

  it('preserveTfsaLongest.drawdownOrder is ["rrsp","rrif","nonReg","tfsa"]', () => {
    expect(WITHDRAWAL_PRESETS.preserveTfsaLongest.drawdownOrder).toEqual([
      'rrsp',
      'rrif',
      'nonReg',
      'tfsa',
    ]);
  });

  it('useTfsaEarlier.drawdownOrder is ["nonReg","tfsa","rrsp","rrif"]', () => {
    expect(WITHDRAWAL_PRESETS.useTfsaEarlier.drawdownOrder).toEqual([
      'nonReg',
      'tfsa',
      'rrsp',
      'rrif',
    ]);
  });

  it('smoothRrspRrifBefore71 enables rrspMeltdown with $25k/yr 2026-2031, no floor', () => {
    const p = WITHDRAWAL_PRESETS.smoothRrspRrifBefore71;
    expect(p.rrspMeltdown).toEqual({
      enabled: true,
      annualAmount: 25_000,
      startYear: 2026,
      endYear: 2031,
    });
    // targetAmount intentionally omitted (no RMLT-03 floor guard for preset default).
    expect(p.rrspMeltdown?.targetAmount).toBeUndefined();
    // drawdownOrder hint still emits BOTH rrsp/rrif adjacent.
    expect(p.drawdownOrder).toContain('rrsp');
    expect(p.drawdownOrder).toContain('rrif');
  });

  it('protectOas enables oasClawbackAvoidance at 2026 threshold $95,323', () => {
    const p = WITHDRAWAL_PRESETS.protectOas;
    expect(p.oasClawbackAvoidance).toEqual({
      enabled: true,
      incomeThreshold: 95_323,
    });
    expect(p.drawdownOrder?.[0]).toBe('tfsa'); // TFSA-first bias to keep net world income low.
  });

  it('custom is an empty {} sentinel', () => {
    expect(WITHDRAWAL_PRESETS.custom).toEqual({});
    expect(Object.keys(WITHDRAWAL_PRESETS.custom)).toHaveLength(0);
  });
});

describe('PRESET-06 token-format invariant', () => {
  // Table-driven: for every preset, if drawdownOrder contains 'rrsp', the next
  // token MUST be 'rrif'. This locks the Phase 28 "single combined card" contract
  // at the data level.
  for (const id of ALL_PRESET_IDS) {
    it(`${id}: 'rrsp' and 'rrif' are adjacent with rrsp at lower index (PRESET-06)`, () => {
      const order = WITHDRAWAL_PRESETS[id].drawdownOrder;
      if (!order) {
        // taxEfficientDefault + custom legitimately have no drawdownOrder — skip.
        expect(order).toBeUndefined();
        return;
      }
      const rrspIdx = order.indexOf('rrsp');
      const rrifIdx = order.indexOf('rrif');
      // If either token appears, BOTH must appear (no orphan rrsp without rrif).
      if (rrspIdx !== -1 || rrifIdx !== -1) {
        expect(rrspIdx).toBeGreaterThanOrEqual(0);
        expect(rrifIdx).toBeGreaterThanOrEqual(0);
        // Adjacent: rrif immediately follows rrsp.
        expect(rrifIdx).toBe(rrspIdx + 1);
      }
    });
  }
});

describe('WithdrawalPresetIdSchema validation (PRESET-01 z.enum)', () => {
  it('parses every catalog id', () => {
    for (const id of ALL_PRESET_IDS) {
      expect(WithdrawalPresetIdSchema.parse(id)).toBe(id);
    }
  });

  it('rejects unknown ids', () => {
    expect(WithdrawalPresetIdSchema.safeParse('bogus').success).toBe(false);
    expect(WithdrawalPresetIdSchema.safeParse('').success).toBe(false);
    // Camel-case is the canonical format — kebab-case must reject.
    expect(WithdrawalPresetIdSchema.safeParse('tax-efficient-default').success).toBe(false);
  });
});

describe('Pitfall 8 trip-wire — ScenarioDecisionsSchema is unchanged in Phase 27', () => {
  it('does NOT carry a withdrawalPreset field (deferred per 27-CONTEXT.md <deferred>)', () => {
    // If a future contributor adds `withdrawalPreset` to ScenarioDecisionsSchema, this
    // assertion fails — the unknown-field strip behavior would no longer apply because
    // the field would be a known one. The user must then explicitly handle the dist
    // rebuild + container restart per CLAUDE.md Pitfall 8.
    const parsed = ScenarioDecisionsSchema.parse({
      withdrawalPreset: 'taxEfficientDefault',
    } as Record<string, unknown>);
    expect(parsed).not.toHaveProperty('withdrawalPreset');
  });
});
