/**
 * Phase 29 — Constraint validator unit tests (CON-01..CON-05).
 *
 * Coverage:
 *  - 1 hard test for Pitfall 2 (TFSA `roomRestoredYear = withdrawalYear + 1`)
 *  - 5 builder pairs: triggering input + non-triggering input
 *  - 1 aggregator assertion: `buildAllConstraintWarnings` filters nulls correctly
 *  - 1 invariant: every emitted warning has `severity: 'info'` (Pitfall 3)
 *  - 1 OAS threshold sanity check
 *
 * @see .planning/phases/29-constraint-validators/29-01-PLAN.md
 * @see .planning/phases/29-constraint-validators/29-CONTEXT.md
 */
import { describe, it, expect } from 'vitest';
import {
  buildRrifConstraintWarning,
  buildLifConstraintWarning,
  buildTfsaConstraintWarning,
  buildOasClawbackWarning,
  buildCapitalGainsWarning,
  buildAllConstraintWarnings,
  OAS_CLAWBACK_THRESHOLD_2026,
  type ConstraintInput,
  type ConstraintWarning,
} from '../constraints.js';

// ---------------------------------------------------------------------------
// Base fixture — no warnings fire from this input. Each test overrides only
// the fields relevant to the validator under test.
// ---------------------------------------------------------------------------
function baseInput(overrides: Partial<ConstraintInput> = {}): ConstraintInput {
  return {
    currentYear: 2026,
    primaryAge: 60,
    rrifBalance: 0,
    lifBalance: 0,
    tfsaWithdrawal: 0,
    nonRegBalance: 0,
    nonRegAcb: 0,
    projectedTotalGrossIncome: 50_000,
    hasNonRegInDrawdown: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Pitfall 2 — TFSA recontribution timing (HARD TEST)
// ---------------------------------------------------------------------------
describe('CON-03 buildTfsaConstraintWarning (Pitfall 2)', () => {
  it('embeds roomRestoredYear = withdrawalYear + 1 in the message (HARD TEST)', () => {
    const warning = buildTfsaConstraintWarning(
      baseInput({ tfsaWithdrawal: 5_000, tfsaWithdrawalYear: 2030 })
    );
    expect(warning).not.toBeNull();
    // Hard assertion: the year-after literal MUST appear in the message.
    expect(warning?.message.includes('2031')).toBe(true);
    // And the original withdrawal year is also surfaced.
    expect(warning?.message.includes('2030')).toBe(true);
  });

  it('falls back to currentYear when tfsaWithdrawalYear is omitted', () => {
    const warning = buildTfsaConstraintWarning(
      baseInput({ currentYear: 2040, tfsaWithdrawal: 1_000 })
    );
    expect(warning?.message.includes('2041')).toBe(true);
  });

  it('returns null when tfsaWithdrawal is zero', () => {
    expect(buildTfsaConstraintWarning(baseInput({ tfsaWithdrawal: 0 }))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CON-01 — RRIF minimum advisory
// ---------------------------------------------------------------------------
describe('CON-01 buildRrifConstraintWarning', () => {
  it('fires at age 71 with non-zero RRIF balance', () => {
    const warning = buildRrifConstraintWarning(baseInput({ primaryAge: 71, rrifBalance: 100_000 }));
    expect(warning).not.toBeNull();
    expect(warning?.accountType).toBe('rrif');
    expect(warning?.severity).toBe('info'); // Pitfall 3 — never 'error'
  });

  it('does not fire below age 71', () => {
    expect(
      buildRrifConstraintWarning(baseInput({ primaryAge: 70, rrifBalance: 100_000 }))
    ).toBeNull();
  });

  it('does not fire with zero RRIF balance', () => {
    expect(buildRrifConstraintWarning(baseInput({ primaryAge: 75, rrifBalance: 0 }))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CON-02 — LIF maximum advisory
// ---------------------------------------------------------------------------
describe('CON-02 buildLifConstraintWarning', () => {
  it('fires with a non-zero LIF balance and no cap info', () => {
    const warning = buildLifConstraintWarning(baseInput({ lifBalance: 25_000 }));
    expect(warning).not.toBeNull();
    expect(warning?.accountType).toBe('lif');
    expect(warning?.severity).toBe('info'); // Pitfall 3 — never 'error'
  });

  it('stays silent when LIF balance well below the supplied approximation', () => {
    const warning = buildLifConstraintWarning(
      baseInput({ lifBalance: 1_000, lifMaximumApprox: 100_000 })
    );
    expect(warning).toBeNull();
  });

  it('fires when LIF balance crosses 90% of supplied maximum', () => {
    const warning = buildLifConstraintWarning(
      baseInput({ lifBalance: 95_000, lifMaximumApprox: 100_000 })
    );
    expect(warning).not.toBeNull();
  });

  it('does not fire with zero LIF balance', () => {
    expect(buildLifConstraintWarning(baseInput({ lifBalance: 0 }))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CON-04 — OAS clawback risk advisory
// ---------------------------------------------------------------------------
describe('CON-04 buildOasClawbackWarning', () => {
  it('fires when projected income meets the 2026 threshold', () => {
    const warning = buildOasClawbackWarning(
      baseInput({ projectedTotalGrossIncome: OAS_CLAWBACK_THRESHOLD_2026 })
    );
    expect(warning).not.toBeNull();
    expect(warning?.severity).toBe('info');
  });

  it('fires within 5% of the threshold (near-cap zone)', () => {
    const warning = buildOasClawbackWarning(
      baseInput({ projectedTotalGrossIncome: OAS_CLAWBACK_THRESHOLD_2026 * 0.96 })
    );
    expect(warning).not.toBeNull();
  });

  it('stays silent on incomes comfortably below threshold', () => {
    expect(buildOasClawbackWarning(baseInput({ projectedTotalGrossIncome: 50_000 }))).toBeNull();
  });

  it('uses the 2026 statutory threshold constant (95_323)', () => {
    expect(OAS_CLAWBACK_THRESHOLD_2026).toBe(95_323);
  });
});

// ---------------------------------------------------------------------------
// CON-05 — Capital gains realisation advisory
// ---------------------------------------------------------------------------
describe('CON-05 buildCapitalGainsWarning', () => {
  it('fires when balance > ACB AND non-reg is in drawdown', () => {
    const warning = buildCapitalGainsWarning(
      baseInput({ nonRegBalance: 200_000, nonRegAcb: 120_000, hasNonRegInDrawdown: true })
    );
    expect(warning).not.toBeNull();
    expect(warning?.accountType).toBe('nonReg');
    expect(warning?.severity).toBe('info');
  });

  it('does not fire when non-reg is not in drawdown order', () => {
    expect(
      buildCapitalGainsWarning(
        baseInput({ nonRegBalance: 200_000, nonRegAcb: 120_000, hasNonRegInDrawdown: false })
      )
    ).toBeNull();
  });

  it('does not fire when balance equals or is below ACB (no embedded gain)', () => {
    expect(
      buildCapitalGainsWarning(
        baseInput({ nonRegBalance: 120_000, nonRegAcb: 120_000, hasNonRegInDrawdown: true })
      )
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Aggregator + global severity invariant
// ---------------------------------------------------------------------------
describe('buildAllConstraintWarnings aggregator', () => {
  it('returns an empty array when no validator fires', () => {
    expect(buildAllConstraintWarnings(baseInput())).toEqual([]);
  });

  it('aggregates multiple non-null warnings and filters nulls', () => {
    const warnings = buildAllConstraintWarnings(
      baseInput({
        primaryAge: 73,
        rrifBalance: 150_000,
        tfsaWithdrawal: 4_000,
        tfsaWithdrawalYear: 2030,
        projectedTotalGrossIncome: OAS_CLAWBACK_THRESHOLD_2026 + 5_000,
        nonRegBalance: 300_000,
        nonRegAcb: 100_000,
        hasNonRegInDrawdown: true,
      })
    );
    // RRIF + TFSA + OAS + capital gains all fire (LIF balance is 0 by default).
    expect(warnings.length).toBeGreaterThanOrEqual(4);
    const ids = warnings.map((w) => w.id);
    expect(ids).toContain('rrif-minimum-advisory');
    expect(ids).toContain('tfsa-recontribution-timing');
    expect(ids).toContain('oas-clawback-risk');
    expect(ids).toContain('capital-gains-realisation');
  });

  it('every warning emitted by every builder has severity: info (Pitfall 3)', () => {
    const warnings = buildAllConstraintWarnings(
      baseInput({
        primaryAge: 80,
        rrifBalance: 50_000,
        lifBalance: 50_000,
        tfsaWithdrawal: 2_000,
        projectedTotalGrossIncome: OAS_CLAWBACK_THRESHOLD_2026,
        nonRegBalance: 200_000,
        nonRegAcb: 100_000,
        hasNonRegInDrawdown: true,
      })
    );
    expect(warnings.length).toBeGreaterThan(0);
    for (const w of warnings) {
      // Static narrowing: severity is the literal 'info' on the type, but we
      // assert at runtime to defend against any future loosening.
      const severity: ConstraintWarning['severity'] = w.severity;
      expect(severity).toBe('info');
    }
  });
});
