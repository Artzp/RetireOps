/**
 * Unit tests for applyFifoAttribution (VR-RRSP-003)
 * @see docs/source-of-truth/02-account-types.md - RRSP Spousal Attribution
 */
import { describe, it, expect } from 'vitest';
import { applyFifoAttribution } from './multi-year.js';
import type { SpousalRRSPLedger } from '@retireops/shared';

describe('applyFifoAttribution', () => {
  it('returns 0 for empty ledger', () => {
    const ledger: SpousalRRSPLedger = [];
    expect(applyFifoAttribution(ledger, 10000, 2030)).toBe(0);
  });

  it('returns 0 when totalWithdrawal is 0', () => {
    const ledger: SpousalRRSPLedger = [
      { year: 2028, annuitant: 'spouse', contributor: 'primary', amount: 5000 },
    ];
    expect(applyFifoAttribution(ledger, 0, 2030)).toBe(0);
    expect(ledger).toHaveLength(1);
  });

  it('single in-window entry, full consumption', () => {
    const ledger: SpousalRRSPLedger = [
      { year: 2028, annuitant: 'spouse', contributor: 'primary', amount: 5000 },
    ];
    // currentYear=2030, entry.year+2=2030 → in window
    const attributed = applyFifoAttribution(ledger, 5000, 2030);
    expect(attributed).toBe(5000);
    expect(ledger).toHaveLength(0);
  });

  it('single in-window entry, partial consumption (withdrawal < entry amount)', () => {
    const ledger: SpousalRRSPLedger = [
      { year: 2028, annuitant: 'spouse', contributor: 'primary', amount: 10000 },
    ];
    const attributed = applyFifoAttribution(ledger, 3000, 2030);
    expect(attributed).toBe(3000);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].amount).toBe(7000);
  });

  it('single out-of-window entry: no attribution, entry consumed from remaining', () => {
    const ledger: SpousalRRSPLedger = [
      { year: 2027, annuitant: 'spouse', contributor: 'primary', amount: 5000 },
    ];
    // currentYear=2030, entry.year+2=2029 → out of window (2030 > 2029)
    const attributed = applyFifoAttribution(ledger, 5000, 2030);
    expect(attributed).toBe(0);
    expect(ledger).toHaveLength(0);
  });

  it('two in-window entries: first consumed fully, second partially', () => {
    const ledger: SpousalRRSPLedger = [
      { year: 2028, annuitant: 'spouse', contributor: 'primary', amount: 3000 },
      { year: 2029, annuitant: 'spouse', contributor: 'primary', amount: 8000 },
    ];
    const attributed = applyFifoAttribution(ledger, 5000, 2030);
    expect(attributed).toBe(5000);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].year).toBe(2029);
    expect(ledger[0].amount).toBe(6000);
  });

  it('two entries: first out-of-window, second in-window — only second attributes', () => {
    const ledger: SpousalRRSPLedger = [
      { year: 2027, annuitant: 'spouse', contributor: 'primary', amount: 2000 },
      { year: 2028, annuitant: 'spouse', contributor: 'primary', amount: 5000 },
    ];
    // currentYear=2030: first entry year+2=2029 → out; second entry year+2=2030 → in
    const attributed = applyFifoAttribution(ledger, 6000, 2030);
    expect(attributed).toBe(4000); // only 4000 from second entry
    expect(ledger).toHaveLength(1);
    expect(ledger[0].year).toBe(2028);
    expect(ledger[0].amount).toBe(1000);
  });

  it('boundary: currentYear = entry.year + 2 (last in-window year) → attributes', () => {
    const ledger: SpousalRRSPLedger = [
      { year: 2028, annuitant: 'spouse', contributor: 'primary', amount: 4000 },
    ];
    const attributed = applyFifoAttribution(ledger, 4000, 2030); // 2030 === 2028+2
    expect(attributed).toBe(4000);
  });

  it('boundary: currentYear = entry.year + 3 (first out-of-window year) → does not attribute', () => {
    const ledger: SpousalRRSPLedger = [
      { year: 2027, annuitant: 'spouse', contributor: 'primary', amount: 4000 },
    ];
    const attributed = applyFifoAttribution(ledger, 4000, 2030); // 2030 === 2027+3
    expect(attributed).toBe(0);
    expect(ledger).toHaveLength(0);
  });

  it('entry fully consumed is removed from ledger', () => {
    const ledger: SpousalRRSPLedger = [
      { year: 2028, annuitant: 'spouse', contributor: 'primary', amount: 1000 },
    ];
    applyFifoAttribution(ledger, 1000, 2030);
    expect(ledger).toHaveLength(0);
  });

  it('entry partially consumed retains correct remaining amount', () => {
    const ledger: SpousalRRSPLedger = [
      { year: 2028, annuitant: 'spouse', contributor: 'primary', amount: 5000 },
    ];
    applyFifoAttribution(ledger, 2000, 2030);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].amount).toBe(3000);
  });
});
