/**
 * Terminal Return — Deemed-disposition estate tax isolation tests
 * @see docs/source-of-truth/04-tax-engine.md
 * @see .gsd/milestones/M004/slices/S01/S01-PLAN.md
 *
 * K012 parity-first workflow: cent-exact assertions pinned from captured engine output.
 */
import { describe, it, expect } from 'vitest';
import { calculateTerminalReturn, type TerminalReturnInput } from './terminal-return.js';

const baseSpike: TerminalReturnInput = {
  year: 2024,
  owner: 'primary',
  province: 'ON',
  age: 72,
  ordinaryIncomeInDeathYear: 0,
  pensionIncome: 0,
  cppIncome: 0,
  oasIncome: 0,
  otherIncome: 0,
  rrspBalance: 800_000,
  rrifBalance: 0,
  liraBalance: 0,
  lifBalance: 0,
  tfsaBalance: 50_000,
  nonRegBalance: 200_000,
  nonRegACB: 150_000,
  hasSurvivingSpouse: false,
};

describe('calculateTerminalReturn', () => {
  it('ON spike-income — no spouse: deemed disposition fires on RRSP, capital gain on non-reg', () => {
    const result = calculateTerminalReturn({ ...baseSpike, province: 'ON' });
    expect(result.deemedDispositionIncome).toBe(800_000);
    expect(result.realizedCapitalGain).toBe(50_000);
    expect(result.taxableCapitalGain).toBe(25_000);
    expect(result.terminalTaxes).toBeGreaterThan(0);
    expect(result.wasSpouseRolloverApplied).toBe(false);
    expect(result.grossEstate).toBe(1_050_000);
    // CAPTURE: K012 pinned from one-shot harness run
    expect(result.terminalTaxes).toBeCloseTo(390921.074976, 2);
  });

  it('QC spike-income — no spouse: Quebec tax stack fires on large deemed-disposition income', () => {
    const result = calculateTerminalReturn({ ...baseSpike, province: 'QC' });
    expect(result.deemedDispositionIncome).toBe(800_000);
    expect(result.terminalTaxes).toBeGreaterThan(0);
    // CAPTURE: K012 pinned from one-shot harness run
    expect(result.terminalTaxes).toBeCloseTo(398109.1517, 2);
  });

  it('AB spike-income — no spouse: Alberta flat-rate provincial context', () => {
    const result = calculateTerminalReturn({ ...baseSpike, province: 'AB' });
    expect(result.deemedDispositionIncome).toBe(800_000);
    expect(result.terminalTaxes).toBeGreaterThan(0);
    // CAPTURE: K012 pinned from one-shot harness run
    expect(result.terminalTaxes).toBeCloseTo(350184.37, 2);
  });

  it('Spouse rollover invariant: hasSurvivingSpouse=true zeroes terminal tax, netEstate=grossEstate', () => {
    const result = calculateTerminalReturn({ ...baseSpike, hasSurvivingSpouse: true });
    expect(result.terminalTaxes).toBe(0);
    expect(result.wasSpouseRolloverApplied).toBe(true);
    expect(result.netEstate).toBe(result.grossEstate);
    expect(result.grossEstate).toBe(1_050_000);
    expect(result.deemedDispositionIncome).toBe(0);
    expect(result.realizedCapitalGain).toBe(0);
  });

  it('TFSA parity: terminal tax is invariant to TFSA balance; gross estate scales linearly', () => {
    const withoutTFSA = calculateTerminalReturn({ ...baseSpike, tfsaBalance: 0 });
    const withTFSA = calculateTerminalReturn({ ...baseSpike, tfsaBalance: 200_000 });
    expect(withoutTFSA.terminalTaxes).toBe(withTFSA.terminalTaxes);
    expect(withTFSA.grossEstate).toBe(withoutTFSA.grossEstate + 200_000);
  });

  it('Capital-loss clamp: non-reg FMV below ACB produces zero realized gain, zero taxable gain', () => {
    const result = calculateTerminalReturn({
      ...baseSpike,
      nonRegBalance: 100_000,
      nonRegACB: 150_000,
    });
    expect(result.realizedCapitalGain).toBe(0);
    expect(result.taxableCapitalGain).toBe(0);
  });

  it('LIRA/LIF full inclusion: locked-in balances match RRSP for deemed-disposition income', () => {
    const callA = calculateTerminalReturn({
      ...baseSpike,
      rrspBalance: 500_000,
      liraBalance: 0,
      lifBalance: 0,
      tfsaBalance: 0,
      nonRegBalance: 0,
      nonRegACB: 0,
    });
    const callB = calculateTerminalReturn({
      ...baseSpike,
      rrspBalance: 0,
      liraBalance: 250_000,
      lifBalance: 250_000,
      tfsaBalance: 0,
      nonRegBalance: 0,
      nonRegACB: 0,
    });
    expect(callA.deemedDispositionIncome).toBe(500_000);
    expect(callB.deemedDispositionIncome).toBe(500_000);
    expect(callA.terminalTaxes).toBe(callB.terminalTaxes);
  });

  it('netEstate identity: no-spouse result satisfies netEstate === grossEstate - terminalTaxes', () => {
    const result = calculateTerminalReturn(baseSpike);
    expect(result.netEstate).toBe(result.grossEstate - result.terminalTaxes);
  });
});
