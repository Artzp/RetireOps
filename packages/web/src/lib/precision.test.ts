import { describe, it, expect } from 'vitest';
import { roundAnnual, roundMonthly } from './precision';

describe('roundAnnual ($100 band)', () => {
  it('rounds down when below the half-bin', () => {
    expect(roundAnnual(15937)).toBe(15900);
    expect(roundAnnual(15949)).toBe(15900);
  });
  it('rounds up at or above the half-bin', () => {
    expect(roundAnnual(15950)).toBe(16000);
    expect(roundAnnual(15999)).toBe(16000);
  });
  it('returns 0 for inputs below $50', () => {
    expect(roundAnnual(0)).toBe(0);
    expect(roundAnnual(49)).toBe(0);
    expect(roundAnnual(50)).toBe(100);
  });
  it('passes NaN through (caller must guard)', () => {
    expect(roundAnnual(Number.NaN)).toBeNaN();
  });
});

describe('roundMonthly ($5 band)', () => {
  it('rounds to the nearest $5', () => {
    expect(roundMonthly(1333)).toBe(1335);
    expect(roundMonthly(1332)).toBe(1330);
  });
  it('returns 0 for inputs below $2.50', () => {
    expect(roundMonthly(0)).toBe(0);
    expect(roundMonthly(2)).toBe(0);
    expect(roundMonthly(3)).toBe(5);
  });
  it('passes NaN through', () => {
    expect(roundMonthly(Number.NaN)).toBeNaN();
  });
});
