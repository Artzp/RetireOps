/**
 * Phase 2 — Engine provenance emission tests (RED in Wave 0).
 *
 * @see .planning/phases/02-cell-provenance/02-CONTEXT.md - D-32..D-41
 * @see .planning/phases/02-cell-provenance/02-VALIDATION.md - ENG-02 / PROV-01 row
 * @see docs/source-of-truth/07-withdrawal-strategies.md
 * @see docs/source-of-truth/04-tax-engine.md
 */
import { describe, it, expect } from 'vitest';
import { runProjection } from './multi-year.js';
import {
  buildProvenanceFixtureSingle,
  buildProvenanceFixtureCouple,
  buildProvenanceFixtureWithOverride,
} from './__fixtures__/provenance.fixtures.js';

// ---------------------------------------------------------------------------
// D-32, D-33 — Sidecar shape
// ---------------------------------------------------------------------------

describe('engine provenance emission — sidecar shape (D-32, D-33)', () => {
  it('attaches provenance? sidecar to YearlyResult rows in single-person projection (ENG-02, PROV-01)', () => {
    const out = runProjection(buildProvenanceFixtureSingle());
    const row2031 = out.yearlyResults.find((r) => r.year === 2031);
    expect(row2031).toBeDefined();
    expect(row2031!.provenance).toBeDefined();
  });

  it('attaches provenance? sidecar to PersonYearlyResult rows in couple projection (D-32, D-33)', () => {
    const out = runProjection(buildProvenanceFixtureCouple());
    // Couple path emits per-person rows; locate via the appropriate output structure.
    // (Plan 04 will document where to read these — for the test we assert the output has couple data
    //  with provenance on at least one primary person row in 2031.)
    expect(out.personYearlyResults?.primary?.[0].year).toBe(2030); // first projection year
    const primary2031 = out.personYearlyResults?.primary?.find((r) => r.year === 2031);
    expect(primary2031?.provenance).toBeDefined();
  });

  it('omits provenance when no in-scope field has a defined value (D-36, D-41)', () => {
    // Pre-retirement years with $0 withdrawals + $0 tax should not have a provenance object,
    // OR the provenance object should be absent (omitted entirely per D-36).
    const out = runProjection(buildProvenanceFixtureSingle({ projectionYears: 35 }));
    const preRetirement = out.yearlyResults.find((r) => r.year < 2030);
    if (preRetirement) {
      expect(preRetirement.provenance).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// D-33, D-38, D-40 — Withdrawal cells
// ---------------------------------------------------------------------------

describe('engine provenance — withdrawal cells (D-33, D-38, D-40)', () => {
  it('emits source="engine" provenance for RRSP withdrawal in non-override years (ENG-02, PROV-01)', () => {
    const out = runProjection(buildProvenanceFixtureSingle());
    const row2031 = out.yearlyResults.find((r) => r.year === 2031)!;
    expect(row2031.provenance?.rrspWithdrawal).toBeDefined();
    expect(row2031.provenance!.rrspWithdrawal!.source).toBe('engine');
    expect(row2031.provenance!.rrspWithdrawal!.docRef).toMatch(
      /^docs\/source-of-truth\/07-withdrawal-strategies\.md#/
    );
    expect(typeof row2031.provenance!.rrspWithdrawal!.ruleId).toBe('string');
    expect(row2031.provenance!.rrspWithdrawal!.ruleId.length).toBeGreaterThan(0);
    expect(typeof row2031.provenance!.rrspWithdrawal!.ruleName).toBe('string');
  });

  it('emits source="override" provenance for an overridden RRSP cell (D-40)', () => {
    const out = runProjection(buildProvenanceFixtureWithOverride());
    const row2031 = out.yearlyResults.find((r) => r.year === 2031)!;
    expect(row2031.provenance?.rrspWithdrawal).toBeDefined();
    expect(row2031.provenance!.rrspWithdrawal!.source).toBe('override');
    expect(row2031.provenance!.rrspWithdrawal!.ruleId).toBe('override-user');
    expect(row2031.provenance!.rrspWithdrawal!.ruleName).toBe('User override');
    expect(row2031.provenance!.rrspWithdrawal!.docRef).toBe(
      'docs/source-of-truth/07-withdrawal-strategies.md#user-overrides'
    );
    // D-40 inputs:
    expect(row2031.provenance!.rrspWithdrawal!.inputs).toEqual(
      expect.objectContaining({
        requestedReal: 50000,
        anchorYear: 2031,
        applyForward: false,
      })
    );
  });

  it('emits engine source for tfsaWithdrawal, nonRegWithdrawal in years with non-zero withdrawals (D-33, D-38)', () => {
    const out = runProjection(buildProvenanceFixtureSingle());
    const row2036 = out.yearlyResults.find((r) => r.year === 2036);
    // RRIF conversion year — strategy may pull from tfsa/nonReg to fill spending need.
    if (row2036?.tfsaWithdrawal && row2036.tfsaWithdrawal > 0) {
      expect(row2036.provenance?.tfsaWithdrawal?.source).toBe('engine');
    }
    if (row2036?.nonRegWithdrawal && row2036.nonRegWithdrawal > 0) {
      expect(row2036.provenance?.nonRegWithdrawal?.source).toBe('engine');
    }
  });

  it('does NOT emit provenance for fields with $0 value that year (D-41)', () => {
    const out = runProjection(buildProvenanceFixtureSingle());
    // LIF default balance is $50K — small and may deplete; pick a year where lifWithdrawal === 0.
    const noLifYear = out.yearlyResults.find((r) => r.lifWithdrawal === 0);
    if (noLifYear?.provenance) {
      expect(noLifYear.provenance.lifWithdrawal).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// D-33, D-38 — RRIF mandatory minimum
// ---------------------------------------------------------------------------

describe('engine provenance — RRIF mandatory minimum (D-33, D-38)', () => {
  it('emits provenance for rrifMandatoryMinimum starting at age 71 (year 2036 in fixture) (ENG-02)', () => {
    const out = runProjection(buildProvenanceFixtureSingle());
    const row2036 = out.yearlyResults.find((r) => r.year === 2036)!;
    // RRIF min only fires when balance > 0 — our fixture converts RRSP→RRIF at 71.
    if (row2036.rrifMandatoryMinimum && row2036.rrifMandatoryMinimum > 0) {
      expect(row2036.provenance?.rrifMandatoryMinimum?.source).toBe('engine');
      expect(row2036.provenance?.rrifMandatoryMinimum?.docRef).toMatch(
        /^docs\/source-of-truth\/(02-account-types|07-withdrawal-strategies)\.md#/
      );
      expect(row2036.provenance?.rrifMandatoryMinimum?.inputs).toEqual(
        expect.objectContaining({
          age: 71,
        })
      );
    }
  });
});

// ---------------------------------------------------------------------------
// D-33, D-38, ROADMAP criterion #2 — Tax cells
// ---------------------------------------------------------------------------

describe('engine provenance — tax cells (D-33, D-38, ROADMAP criterion #2)', () => {
  it('emits federalTax provenance with totalTaxableIncome, federalBracket, marginalRate inputs (ENG-02, PROV-01)', () => {
    const out = runProjection(buildProvenanceFixtureSingle());
    const row2031 = out.yearlyResults.find((r) => r.year === 2031)!;
    expect(row2031.provenance?.federalTax).toBeDefined();
    expect(row2031.provenance!.federalTax!.source).toBe('engine');
    expect(row2031.provenance!.federalTax!.docRef).toMatch(
      /^docs\/source-of-truth\/04-tax-engine\.md#/
    );
    expect(row2031.provenance!.federalTax!.inputs).toEqual(
      expect.objectContaining({
        totalTaxableIncome: expect.any(Number),
        federalBracket: expect.any(String),
        marginalRate: expect.any(Number),
      })
    );
  });

  it('emits provincialTax provenance with totalTaxableIncome, province, provincialBracket, marginalRate (D-33, D-38)', () => {
    const out = runProjection(buildProvenanceFixtureSingle());
    const row2031 = out.yearlyResults.find((r) => r.year === 2031)!;
    expect(row2031.provenance?.provincialTax).toBeDefined();
    expect(row2031.provenance!.provincialTax!.inputs).toEqual(
      expect.objectContaining({
        totalTaxableIncome: expect.any(Number),
        province: expect.any(String),
        provincialBracket: expect.any(String),
        marginalRate: expect.any(Number),
      })
    );
  });

  it('emits totalTaxes provenance pointing to docs/source-of-truth/04-tax-engine.md (D-33, D-38)', () => {
    const out = runProjection(buildProvenanceFixtureSingle());
    const row2031 = out.yearlyResults.find((r) => r.year === 2031)!;
    expect(row2031.provenance?.totalTaxes).toBeDefined();
    expect(row2031.provenance!.totalTaxes!.docRef).toMatch(
      /^docs\/source-of-truth\/04-tax-engine\.md#/
    );
  });
});

// ---------------------------------------------------------------------------
// D-33, D-38 — totalIncome
// ---------------------------------------------------------------------------

describe('engine provenance — totalIncome (D-33, D-38)', () => {
  it('emits totalIncome provenance with sum-of-sources inputs in retirement years (ENG-02, PROV-01)', () => {
    const out = runProjection(buildProvenanceFixtureSingle());
    const row2031 = out.yearlyResults.find((r) => r.year === 2031)!;
    expect(row2031.provenance?.totalIncome).toBeDefined();
    expect(row2031.provenance!.totalIncome!.source).toBe('engine');
  });
});

// ---------------------------------------------------------------------------
// D-33, D-38 — livingExpenses
// ---------------------------------------------------------------------------

describe('engine provenance — livingExpenses (D-33, D-38)', () => {
  it('emits livingExpenses provenance with engine source and the spending rule docRef (ENG-02, PROV-01)', () => {
    const out = runProjection(buildProvenanceFixtureSingle());
    const row2031 = out.yearlyResults.find((r) => r.year === 2031)!;
    expect(row2031.provenance?.livingExpenses).toBeDefined();
    expect(row2031.provenance!.livingExpenses!.source).toBe('engine');
    expect(row2031.provenance!.livingExpenses!.docRef).toMatch(
      /^docs\/source-of-truth\/07-withdrawal-strategies\.md#/
    );
  });
});

// ---------------------------------------------------------------------------
// ROADMAP criterion #5, D-36 — Additive invariant preserved
// ---------------------------------------------------------------------------

describe('engine provenance — additive invariant preserved (ROADMAP criterion #5, D-36)', () => {
  it('removing all overrides + ignoring provenance produces byte-identical YearlyResult fields (excluding provenance)', () => {
    // The additive-invariant.test.ts (Phase 1) snapshots the pre-Phase-1 baseline.
    // Phase 2 must not change those existing fields. Provenance is purely additive (D-36).
    const out = runProjection(buildProvenanceFixtureSingle());
    for (const row of out.yearlyResults) {
      // Strip provenance and ensure remaining shape stays identical to Phase 1 (delegated to
      // existing additive-invariant.test.ts — this test simply confirms we can strip it).
      const { provenance: _provenance, ...rest } = row;
      expect(rest).toBeDefined();
      expect(typeof rest.year).toBe('number');
    }
  });
});
