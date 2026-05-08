/**
 * Test-only fixtures for Phase 2 cell provenance.
 *
 * @see .planning/phases/02-cell-provenance/02-CONTEXT.md - D-32..D-41
 * @see docs/source-of-truth/08-projection-engine.md
 *
 * CRITICAL: Pure data builders. No clock reads, no randomness, no I/O. (T-DET-01)
 */
import {
  buildSinglePersonFixture,
  buildCoupleFixture,
  DEFAULT_BALANCES,
  type BuildFixtureOptions,
} from './overrides.fixtures.js';
import type { ProjectionInput } from '@retireops/shared';

export type { BuildFixtureOptions };

// Coverage matrix (D-38 in-scope fields):
//   rrspWithdrawal       → buildProvenanceFixtureSingle, year 2031
//   rrifWithdrawal       → buildProvenanceFixtureSingle, year 2036+
//   tfsaWithdrawal       → buildProvenanceFixtureSingle, year 2036
//   nonRegWithdrawal     → buildProvenanceFixtureSingle, year 2036
//   lifWithdrawal        → buildProvenanceFixtureSingle, default LIF $50K
//   livingExpenses       → buildProvenanceFixtureSingle, every retirement year
//   rrifMandatoryMinimum → buildProvenanceFixtureSingle, year 2036+
//   totalIncome          → buildProvenanceFixtureSingle, every year
//   federalTax           → buildProvenanceFixtureSingle, year 2031+
//   provincialTax        → buildProvenanceFixtureSingle, year 2031+
//   totalTaxes           → buildProvenanceFixtureSingle, year 2031+
//   override case        → buildProvenanceFixtureWithOverride, year 2031 RRSP

/**
 * Single-person retiree projection that exercises every D-38 in-scope field at least once:
 *   - Year 2031: RRSP withdrawal (engine source) — drawdownOrder ['rrsp', 'tfsa', 'nonReg']
 *   - Year 2031: livingExpenses (engine source) — driven by targetRetirementSpending = 60_000
 *   - Year 2031: federalTax + provincialTax + totalTaxes (RRSP withdrawal triggers taxable income)
 *   - Year 2031: totalIncome (sum of withdrawals + benefits)
 *   - Year 2036: rrifMandatoryMinimum (age 71 — RRSP→RRIF conversion year)
 *   - Year 2036: rrifWithdrawal (engine source — strategy fills RRIF tier)
 *   - Year 2036: tfsaWithdrawal (engine source — when remaining gap routes to TFSA)
 *   - Year 2036: nonRegWithdrawal (engine source — last drawdown tier)
 * No overrides set — every provenance entry must have source='engine'.
 */
export function buildProvenanceFixtureSingle(opts?: Partial<BuildFixtureOptions>): ProjectionInput {
  return buildSinglePersonFixture({
    targetRetirementSpending: 60_000,
    drawdownOrder: ['rrsp', 'tfsa', 'nonReg'],
    projectionYears: 30,
    ...opts,
  });
}

/**
 * Couple projection variant — both spouses contribute withdrawals through their respective
 * PersonYearlyResult rows; primary RRIF conversion at 71, spouse at 73 (offset +2 years).
 * Exercises the couple-calculator code path so Plan 04 must wire emission in BOTH paths.
 */
export function buildProvenanceFixtureCouple(opts?: Partial<BuildFixtureOptions>): ProjectionInput {
  return buildCoupleFixture({
    targetRetirementSpending: 60_000,
    drawdownOrder: ['rrsp', 'tfsa', 'nonReg'],
    spouseStartAge: 63,
    projectionYears: 30,
    ...opts,
  });
}

/**
 * Single-person fixture WITH a withdrawal override for RRSP at year 2031, amount $50_000 real,
 * applyForward=false. Used to assert source='override' emission (D-40) for that one cell, with
 * inputs containing requestedReal, requestedNominal, actualNominal, anchorYear, applyForward,
 * and the docRef '...07-withdrawal-strategies.md#user-overrides'.
 */
export function buildProvenanceFixtureWithOverride(
  opts?: Partial<BuildFixtureOptions>
): ProjectionInput {
  return buildSinglePersonFixture({
    targetRetirementSpending: 60_000,
    drawdownOrder: ['rrsp', 'tfsa', 'nonReg'],
    projectionYears: 30,
    withdrawalOverrides: [{ field: 'rrsp', year: 2031, amount: 50_000, applyForward: false }],
    ...opts,
  });
}

export { DEFAULT_BALANCES };
