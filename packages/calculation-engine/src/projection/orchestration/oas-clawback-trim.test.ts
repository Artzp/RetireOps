/**
 * Unit tests for the OAS-clawback-avoidance trim income estimate (audit B-01).
 *
 * Regression target: the estimate() closure previously omitted
 * bracketFillWithdrawal and otherIncome — both of which the real tax input
 * counts (bracket-fill folds into taxable rrifIncome; otherIncome is a
 * gross-income component). With both oasClawbackAvoidance and bracketFill
 * enabled, the trim under-counted income and declined to trim while real
 * income exceeded the threshold, silently defeating the feature.
 *
 * Note: estimate() also counts the discretionary state.rrspWithdrawal itself,
 * so each scenario is built so the FIXED untrimmable income (pension/CPP/OAS/
 * RRIF-min) plus the discretionary withdrawal sits at-or-below the threshold,
 * and the previously-omitted component (bracketFill or otherIncome) is what
 * tips real income over — exactly the B-01 trip condition.
 *
 * @see docs/audit/AUDIT-2026-06-10.internal.md - B-01
 * @see docs/source-of-truth/04-tax-engine.md - Step 1: Calculate Gross Income
 * @see docs/source-of-truth/07-withdrawal-strategies.md - TAX-04
 */

import { describe, it, expect } from 'vitest';
import {
  applyOASClawbackAvoidanceTrim,
  type OASTrimState,
  type OASTrimContext,
} from './oas-clawback-trim.js';

const THRESHOLD = 95_323; // 2026 OAS recovery-tax threshold

function makeState(overrides: Partial<OASTrimState> = {}): OASTrimState {
  return {
    rrspWithdrawal: 0,
    currentRRSP: 0,
    additionalRRIFWithdrawal: 0,
    currentRRIF: 0,
    nonRegWithdrawal: 0,
    currentNonReg: 0,
    nonRegRealizedGain: 0,
    nonRegTaxableGain: 0,
    ...overrides,
  };
}

function makeContext(overrides: Partial<OASTrimContext> = {}): OASTrimContext {
  return {
    isRetired: true,
    employmentIncome: 0,
    pensionIncome: 0,
    cppIncome: 0,
    oasIncome: 0,
    rrifWithdrawal: 0,
    bracketFillWithdrawal: 0,
    otherIncome: 0,
    meltdownRRSPWithdrawal: 0,
    incomeThreshold: THRESHOLD,
    drawdownOrder: ['nonReg', 'rrsp', 'rrif', 'tfsa'],
    ...overrides,
  };
}

/** Sum the estimate the way the trim does, for assertion clarity. */
function estimateIncome(state: OASTrimState, ctx: OASTrimContext): number {
  return (
    ctx.pensionIncome +
    ctx.cppIncome +
    ctx.oasIncome +
    ctx.rrifWithdrawal +
    ctx.bracketFillWithdrawal +
    ctx.otherIncome +
    state.additionalRRIFWithdrawal +
    state.rrspWithdrawal +
    ctx.meltdownRRSPWithdrawal +
    state.nonRegTaxableGain
  );
}

describe('applyOASClawbackAvoidanceTrim — B-01 income definition', () => {
  it('AUDIT TRIP CASE: bracket-fill tips real income over threshold → trim now fires', () => {
    // Fixed untrimmable income (pension+CPP+OAS+RRIF-min) = 85,000.
    // Discretionary RRSP = 8,000 → 93,000, still <= threshold (old: NO trim).
    // Bracket-fill = 5,000 (folded into taxable rrifIncome) → real income 98,000.
    // Excess = 98,000 - 95,323 = 2,677 → trim RRSP by 2,677 → lands at threshold.
    const state = makeState({ rrspWithdrawal: 8_000, currentRRSP: 92_000 });
    const context = makeContext({
      pensionIncome: 40_000,
      cppIncome: 18_000,
      oasIncome: 8_000,
      rrifWithdrawal: 19_000, // mandatory minimum, untrimmable
      bracketFillWithdrawal: 5_000, // previously omitted from estimate()
    });

    applyOASClawbackAvoidanceTrim(state, context);

    expect(state.rrspWithdrawal).toBe(5_323); // 8,000 - 2,677
    expect(state.currentRRSP).toBe(94_677); // trimmed amount returned to account
    expect(estimateIncome(state, context)).toBe(THRESHOLD);
    expect(estimateIncome(state, context)).toBeLessThanOrEqual(context.incomeThreshold);
  });

  it('REGRESSION GUARD: the same scenario with bracket-fill back at $0 must NOT trim', () => {
    // Reconstructs the old (buggy) income definition by zeroing bracketFill.
    // Fixed 85,000 + discretionary 8,000 = 93,000 <= threshold → no trim.
    const state = makeState({ rrspWithdrawal: 8_000, currentRRSP: 92_000 });
    const context = makeContext({
      pensionIncome: 40_000,
      cppIncome: 18_000,
      oasIncome: 8_000,
      rrifWithdrawal: 19_000,
      bracketFillWithdrawal: 0, // the omission B-01 describes, reconstructed
    });

    applyOASClawbackAvoidanceTrim(state, context);

    expect(state.rrspWithdrawal).toBe(8_000); // untouched — no trim
    expect(state.currentRRSP).toBe(92_000);
  });

  it('OTHER-INCOME VARIANT: otherIncome tips real income over threshold → trim fires', () => {
    // No bracket-fill; otherIncome (e.g. rental/foreign) is the omitted component.
    // Fixed 85,000 + discretionary 6,000 = 91,000 <= threshold (old: no trim).
    // otherIncome = 7,000 → real income 98,000; excess 2,677 → trim RRSP to 3,323.
    const state = makeState({ rrspWithdrawal: 6_000, currentRRSP: 50_000 });
    const context = makeContext({
      pensionIncome: 40_000,
      cppIncome: 18_000,
      oasIncome: 8_000,
      rrifWithdrawal: 19_000,
      otherIncome: 7_000, // previously omitted from estimate()
    });

    applyOASClawbackAvoidanceTrim(state, context);

    expect(state.rrspWithdrawal).toBe(3_323); // 6,000 - 2,677
    expect(estimateIncome(state, context)).toBe(THRESHOLD);
    expect(estimateIncome(state, context)).toBeLessThanOrEqual(context.incomeThreshold);
  });

  it('COUPLE-PATH VARIANT: per-person context (calculate-person-year) counts both new fields', () => {
    // The couple path runs this SAME trim module per person. Model one spouse
    // where bracket-fill AND otherIncome together are the over-threshold tip.
    // Fixed 73,000 + discretionary 12,000 = 85,000 <= threshold (old: no trim).
    // bracketFill 8,000 + otherIncome 5,000 = 13,000 → real income 98,000.
    // Excess 2,677 → trim RRSP 12,000 → 9,323.
    const state = makeState({ rrspWithdrawal: 12_000, currentRRSP: 80_000 });
    const context = makeContext({
      pensionIncome: 30_000,
      cppIncome: 15_000,
      oasIncome: 8_000,
      rrifWithdrawal: 20_000,
      bracketFillWithdrawal: 8_000,
      otherIncome: 5_000,
    });

    applyOASClawbackAvoidanceTrim(state, context);

    expect(state.rrspWithdrawal).toBe(9_323); // 12,000 - 2,677
    expect(estimateIncome(state, context)).toBe(THRESHOLD);
    expect(estimateIncome(state, context)).toBeLessThanOrEqual(context.incomeThreshold);
  });

  it('D-12: when fixed untrimmable income alone exceeds threshold, trims discretionary to $0 and accepts residual clawback', () => {
    // Fixed (pension+CPP+OAS+RRIF-min) + bracketFill = 98,000 > threshold even
    // with zero discretionary withdrawals → trim empties RRSP but cannot get
    // below the threshold (mandatory income). Must not loop/throw (D-12).
    const state = makeState({ rrspWithdrawal: 4_000, currentRRSP: 40_000 });
    const context = makeContext({
      pensionIncome: 48_000,
      cppIncome: 18_000,
      oasIncome: 8_000,
      rrifWithdrawal: 19_000,
      bracketFillWithdrawal: 5_000, // fixed alone = 98,000 > threshold
    });

    applyOASClawbackAvoidanceTrim(state, context);

    expect(state.rrspWithdrawal).toBe(0); // fully trimmed
    expect(state.currentRRSP).toBe(44_000);
    // Residual income still above threshold — accepted per D-12.
    expect(estimateIncome(state, context)).toBeGreaterThan(context.incomeThreshold);
  });

  it('walks reverse drawdown order: trims additional RRIF before RRSP when RRIF is last', () => {
    // Sanity check that the new income fields do not disturb the trim ordering:
    // reverse of ['rrsp','rrif'] is ['rrif','rrsp'] → additional RRIF trims first.
    // Fixed 85,000 + additionalRRIF 5,000 + rrsp 0 = 90,000 <= threshold.
    // bracketFill 8,000 → real income 98,000; excess 2,677 trimmed from RRIF.
    const state = makeState({
      rrspWithdrawal: 5_000,
      currentRRSP: 50_000,
      additionalRRIFWithdrawal: 5_000,
      currentRRIF: 50_000,
    });
    const context = makeContext({
      pensionIncome: 40_000,
      cppIncome: 18_000,
      oasIncome: 8_000,
      rrifWithdrawal: 19_000,
      bracketFillWithdrawal: 8_000,
      drawdownOrder: ['rrsp', 'rrif'],
    });
    // estimate = 85,000(fixed) + 8,000(bracketFill) + 5,000(addRRIF) + 5,000(rrsp) = 103,000.
    // excess = 103,000 - 95,323 = 7,677 → RRIF additional (5,000) trimmed fully first,
    // then RRSP trimmed by remaining 2,677 → rrsp = 2,323.
    applyOASClawbackAvoidanceTrim(state, context);

    expect(state.additionalRRIFWithdrawal).toBe(0); // last in order → trimmed first, fully
    expect(state.rrspWithdrawal).toBe(2_323); // remaining excess
    expect(estimateIncome(state, context)).toBe(THRESHOLD);
  });
});
