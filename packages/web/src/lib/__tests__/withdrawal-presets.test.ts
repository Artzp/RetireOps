import { describe, it, expect } from 'vitest';
import {
  WEB_WITHDRAWAL_PRESETS,
  resolvePresetIdFromOrder,
  accountOrderSummary,
} from '../withdrawal-presets.js';
import { WITHDRAWAL_PRESETS as SHARED_PRESETS } from '@retireops/shared/withdrawal';

describe('WEB_WITHDRAWAL_PRESETS — byte-equivalence with shared catalog (Phase 27 pin)', () => {
  it('has exactly 6 entries matching shared catalog ids', () => {
    expect(WEB_WITHDRAWAL_PRESETS.map((p) => p.id)).toEqual([
      'taxEfficientDefault',
      'preserveTfsaLongest',
      'useTfsaEarlier',
      'smoothRrspRrifBefore71',
      'protectOas',
      'custom',
    ]);
    expect(Object.keys(SHARED_PRESETS).sort()).toEqual(
      [...WEB_WITHDRAWAL_PRESETS.map((p) => p.id)].sort()
    );
  });

  it('preserveTfsaLongest drawdownOrder matches shared', () => {
    expect(WEB_WITHDRAWAL_PRESETS[1]?.drawdownOrder).toEqual(
      SHARED_PRESETS.preserveTfsaLongest.drawdownOrder
    );
  });

  it('useTfsaEarlier drawdownOrder matches shared', () => {
    expect(WEB_WITHDRAWAL_PRESETS[2]?.drawdownOrder).toEqual(
      SHARED_PRESETS.useTfsaEarlier.drawdownOrder
    );
  });

  it('smoothRrspRrifBefore71 drawdownOrder + meltdown flag match shared', () => {
    expect(WEB_WITHDRAWAL_PRESETS[3]?.drawdownOrder).toEqual(
      SHARED_PRESETS.smoothRrspRrifBefore71.drawdownOrder
    );
    expect(WEB_WITHDRAWAL_PRESETS[3]?.enablesMeltdown).toBe(true);
    expect(SHARED_PRESETS.smoothRrspRrifBefore71.rrspMeltdown?.enabled).toBe(true);
  });

  it('protectOas drawdownOrder + clawback flag match shared (incomeThreshold = 95323)', () => {
    expect(WEB_WITHDRAWAL_PRESETS[4]?.drawdownOrder).toEqual(
      SHARED_PRESETS.protectOas.drawdownOrder
    );
    expect(WEB_WITHDRAWAL_PRESETS[4]?.enablesClawbackAvoidance).toBe(true);
    expect(SHARED_PRESETS.protectOas.oasClawbackAvoidance?.incomeThreshold).toBe(95323);
  });

  it('taxEfficientDefault is strategyId-driven (no drawdownOrder in shared catalog)', () => {
    expect(SHARED_PRESETS.taxEfficientDefault.strategyId).toBe('standard');
    expect(SHARED_PRESETS.taxEfficientDefault.drawdownOrder).toBeUndefined();
  });

  it('custom is the empty-Partial sentinel in shared', () => {
    expect(SHARED_PRESETS.custom).toEqual({});
  });
});

describe('resolvePresetIdFromOrder', () => {
  it('returns taxEfficientDefault when strategyId === "standard" and no flags', () => {
    expect(
      resolvePresetIdFromOrder({
        drawdownTypeOrder: ['nonReg', 'rrif', 'rrsp', 'tfsa'],
        strategyId: 'standard',
        meltdownEnabled: false,
        clawbackEnabled: false,
      })
    ).toBe('taxEfficientDefault');
  });

  it('returns taxEfficientDefault when strategyId === "standard" and drawdownOrder is empty', () => {
    expect(
      resolvePresetIdFromOrder({
        drawdownTypeOrder: [],
        strategyId: 'standard',
        meltdownEnabled: false,
        clawbackEnabled: false,
      })
    ).toBe('taxEfficientDefault');
  });

  it('returns preserveTfsaLongest for its tuple with no flags', () => {
    expect(
      resolvePresetIdFromOrder({
        drawdownTypeOrder: ['rrsp', 'rrif', 'nonReg', 'tfsa'],
        meltdownEnabled: false,
        clawbackEnabled: false,
      })
    ).toBe('preserveTfsaLongest');
  });

  it('returns smoothRrspRrifBefore71 when meltdown enabled on same tuple as preserveTfsaLongest', () => {
    expect(
      resolvePresetIdFromOrder({
        drawdownTypeOrder: ['rrsp', 'rrif', 'nonReg', 'tfsa'],
        meltdownEnabled: true,
        clawbackEnabled: false,
      })
    ).toBe('smoothRrspRrifBefore71');
  });

  it('returns useTfsaEarlier for its tuple with no flags', () => {
    expect(
      resolvePresetIdFromOrder({
        drawdownTypeOrder: ['nonReg', 'tfsa', 'rrsp', 'rrif'],
        meltdownEnabled: false,
        clawbackEnabled: false,
      })
    ).toBe('useTfsaEarlier');
  });

  it('returns protectOas when clawback enabled on its tuple', () => {
    expect(
      resolvePresetIdFromOrder({
        drawdownTypeOrder: ['tfsa', 'nonReg', 'rrsp', 'rrif'],
        meltdownEnabled: false,
        clawbackEnabled: true,
      })
    ).toBe('protectOas');
  });

  it('returns custom for a hand-customized order', () => {
    expect(
      resolvePresetIdFromOrder({
        drawdownTypeOrder: ['lif', 'tfsa', 'rrsp', 'rrif', 'nonReg'],
        meltdownEnabled: false,
        clawbackEnabled: false,
      })
    ).toBe('custom');
  });

  it('returns custom when meltdown is enabled but order does not match smoothRrspRrifBefore71 tuple', () => {
    expect(
      resolvePresetIdFromOrder({
        drawdownTypeOrder: ['tfsa', 'nonReg', 'rrsp', 'rrif'],
        meltdownEnabled: true,
        clawbackEnabled: false,
      })
    ).toBe('custom');
  });
});

describe('accountOrderSummary', () => {
  it('collapses rrsp+rrif into a single RRSP/RRIF entry', () => {
    const p = WEB_WITHDRAWAL_PRESETS.find((x) => x.id === 'preserveTfsaLongest');
    expect(p).toBeDefined();
    expect(accountOrderSummary(p!)).toBe('RRSP/RRIF → Non-Reg → TFSA');
  });

  it('renders useTfsaEarlier as Non-Reg → TFSA → RRSP/RRIF', () => {
    const p = WEB_WITHDRAWAL_PRESETS.find((x) => x.id === 'useTfsaEarlier');
    expect(accountOrderSummary(p!)).toBe('Non-Reg → TFSA → RRSP/RRIF');
  });

  it('returns — for custom (no drawdownOrder)', () => {
    const p = WEB_WITHDRAWAL_PRESETS.find((x) => x.id === 'custom');
    expect(accountOrderSummary(p!)).toBe('—');
  });
});
