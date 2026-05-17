import { describe, it, expect } from 'vitest';
import {
  applyPresetToTaxState,
  drawdownOrderToTypeOrder,
  engineTokenForCardType,
  presetSwitchNeedsConfirm,
  type TaxStateLike,
} from '../preset-apply.js';
import type { AccountCardInfo } from '@/lib/profile-utils';

const accountCards: AccountCardInfo[] = [
  { id: 'acc-nonreg', label: 'Brokerage', type: 'NonReg' },
  { id: 'acc-rrsp', label: 'RRSP', type: 'RRSP' },
  { id: 'acc-rrif', label: 'RRIF', type: 'RRIF' },
  { id: 'acc-tfsa', label: 'TFSA', type: 'TFSA' },
];

function baseTaxState(order: string[]): TaxStateLike {
  return {
    drawdownOrder: order,
    rrspMeltdown: { enabled: false, annualAmount: 0, startYear: 2025, endYear: 2030 },
    incomeSplitting: { enabled: false, splitPercent: 50 },
    oasClawbackAvoidance: { enabled: false, incomeThreshold: 90000 },
    bracketFill: { enabled: false, bracketTarget: 'current', annualCap: undefined },
  };
}

describe('engineTokenForCardType', () => {
  it('maps account-card types to engine tokens', () => {
    expect(engineTokenForCardType('RRSP')).toBe('rrsp');
    expect(engineTokenForCardType('RRIF')).toBe('rrif');
    expect(engineTokenForCardType('TFSA')).toBe('tfsa');
    expect(engineTokenForCardType('NonReg')).toBe('nonReg');
    expect(engineTokenForCardType('LIF')).toBe('lif');
  });
});

describe('drawdownOrderToTypeOrder', () => {
  it('translates card IDs to engine tokens and collapses adjacent duplicates', () => {
    // RRSP and RRIF are SEPARATE engine types, so they DON'T collapse — only adjacent
    // duplicates of the SAME token collapse (e.g. two TFSAs).
    const result = drawdownOrderToTypeOrder(
      ['acc-rrsp', 'acc-rrif', 'acc-nonreg', 'acc-tfsa'],
      accountCards
    );
    expect(result).toEqual(['rrsp', 'rrif', 'nonReg', 'tfsa']);
  });

  it('collapses two adjacent same-type cards', () => {
    const cards: AccountCardInfo[] = [
      { id: 'tfsa-a', label: 'TFSA A', type: 'TFSA' },
      { id: 'tfsa-b', label: 'TFSA B', type: 'TFSA' },
      { id: 'rrsp-a', label: 'RRSP', type: 'RRSP' },
    ];
    const result = drawdownOrderToTypeOrder(['tfsa-a', 'tfsa-b', 'rrsp-a'], cards);
    expect(result).toEqual(['tfsa', 'rrsp']);
  });
});

describe('applyPresetToTaxState', () => {
  it('custom is a no-op', () => {
    const prev = baseTaxState(['acc-tfsa', 'acc-rrsp', 'acc-rrif', 'acc-nonreg']);
    const next = applyPresetToTaxState(prev, 'custom', accountCards);
    expect(next).toBe(prev);
  });

  it('preserveTfsaLongest reorders card IDs to match [rrsp, rrif, nonReg, tfsa]', () => {
    const prev = baseTaxState(['acc-tfsa', 'acc-rrsp', 'acc-rrif', 'acc-nonreg']);
    const next = applyPresetToTaxState(prev, 'preserveTfsaLongest', accountCards);
    expect(next.drawdownOrder).toEqual(['acc-rrsp', 'acc-rrif', 'acc-nonreg', 'acc-tfsa']);
    expect(next.rrspMeltdown.enabled).toBe(false);
    expect(next.oasClawbackAvoidance.enabled).toBe(false);
  });

  it('smoothRrspRrifBefore71 enables rrspMeltdown with default amounts', () => {
    const prev = baseTaxState(['acc-tfsa', 'acc-rrsp', 'acc-rrif', 'acc-nonreg']);
    const next = applyPresetToTaxState(prev, 'smoothRrspRrifBefore71', accountCards);
    expect(next.drawdownOrder).toEqual(['acc-rrsp', 'acc-rrif', 'acc-nonreg', 'acc-tfsa']);
    expect(next.rrspMeltdown).toEqual({
      enabled: true,
      annualAmount: 25000,
      startYear: 2026,
      endYear: 2031,
    });
    expect(next.oasClawbackAvoidance.enabled).toBe(false);
  });

  it('protectOas enables oasClawbackAvoidance with threshold 95323', () => {
    const prev = baseTaxState(['acc-rrsp', 'acc-rrif', 'acc-tfsa', 'acc-nonreg']);
    const next = applyPresetToTaxState(prev, 'protectOas', accountCards);
    expect(next.drawdownOrder).toEqual(['acc-tfsa', 'acc-nonreg', 'acc-rrsp', 'acc-rrif']);
    expect(next.oasClawbackAvoidance).toEqual({ enabled: true, incomeThreshold: 95323 });
    expect(next.rrspMeltdown.enabled).toBe(false);
  });

  it('taxEfficientDefault applies engine default order [nonReg, rrif, rrsp, tfsa]', () => {
    const prev = baseTaxState(['acc-tfsa', 'acc-rrsp', 'acc-rrif', 'acc-nonreg']);
    const next = applyPresetToTaxState(prev, 'taxEfficientDefault', accountCards);
    expect(next.drawdownOrder).toEqual(['acc-nonreg', 'acc-rrif', 'acc-rrsp', 'acc-tfsa']);
  });

  it('appends cards of types not in the preset tuple in their existing order', () => {
    const cards: AccountCardInfo[] = [
      ...accountCards,
      { id: 'acc-lif', label: 'LIF', type: 'LIF' },
    ];
    const prev = baseTaxState(['acc-lif', 'acc-tfsa', 'acc-rrsp', 'acc-rrif', 'acc-nonreg']);
    const next = applyPresetToTaxState(prev, 'preserveTfsaLongest', cards);
    // preset is [rrsp, rrif, nonReg, tfsa] — LIF is appended at the end
    expect(next.drawdownOrder).toEqual([
      'acc-rrsp',
      'acc-rrif',
      'acc-nonreg',
      'acc-tfsa',
      'acc-lif',
    ]);
  });

  it('does not mutate the input taxState', () => {
    const prev = baseTaxState(['acc-tfsa', 'acc-rrsp', 'acc-rrif', 'acc-nonreg']);
    const before = JSON.stringify(prev);
    applyPresetToTaxState(prev, 'preserveTfsaLongest', accountCards);
    expect(JSON.stringify(prev)).toBe(before);
  });

  it('preserves incomeSplitting and bracketFill unchanged', () => {
    const prev = baseTaxState(['acc-tfsa', 'acc-rrsp', 'acc-rrif', 'acc-nonreg']);
    prev.incomeSplitting = { enabled: true, splitPercent: 30 };
    prev.bracketFill = { enabled: true, bracketTarget: 'next', annualCap: 5000 };
    const next = applyPresetToTaxState(prev, 'preserveTfsaLongest', accountCards);
    expect(next.incomeSplitting).toEqual({ enabled: true, splitPercent: 30 });
    expect(next.bracketFill).toEqual({ enabled: true, bracketTarget: 'next', annualCap: 5000 });
  });
});

describe('presetSwitchNeedsConfirm', () => {
  const prev = baseTaxState(['acc-tfsa', 'acc-nonreg', 'acc-rrsp', 'acc-rrif']);

  it('returns false when selecting custom', () => {
    expect(presetSwitchNeedsConfirm(prev, 'custom', accountCards, 'custom')).toBe(false);
    expect(presetSwitchNeedsConfirm(prev, 'custom', accountCards, 'preserveTfsaLongest')).toBe(
      false
    );
  });

  it('returns false when selecting the already-active preset', () => {
    expect(presetSwitchNeedsConfirm(prev, 'protectOas', accountCards, 'protectOas')).toBe(false);
  });

  it('returns true when switching from custom to a non-custom preset', () => {
    expect(presetSwitchNeedsConfirm(prev, 'protectOas', accountCards, 'custom')).toBe(true);
  });

  it('returns false when switching from one preset to another (no custom overwrite)', () => {
    expect(presetSwitchNeedsConfirm(prev, 'protectOas', accountCards, 'preserveTfsaLongest')).toBe(
      false
    );
  });
});
