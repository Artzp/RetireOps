/**
 * Integration test — verifies bracketFill decision round-trips end-to-end:
 * applyScenarioDecisions → transformToProjectionInput → runSingleProjection,
 * and the engine output contains a non-zero bracketFillWithdrawal.
 *
 * Guards against the Phase 64 regression where the transformer silently dropped
 * bracketFill before the engine ever saw it.
 *
 * @see docs/source-of-truth/07-withdrawal-strategies.md — BKF-01 / TAX-05
 */
import { describe, expect, it } from 'vitest';
import { runSingleProjection } from '@retireops/calculation-engine';
import { applyScenarioDecisions } from './scenario-decisions.js';
import { transformToProjectionInput } from './projection-transformer.js';
import type { FrontendInputData } from './projection-transformer.js';
import type { ScenarioDecisions, YearlyResult } from '@retireops/shared';

function makeRetireeFixture(): FrontendInputData {
  // Retired 68-year-old in ON with $300k RRSP, zero CPP/OAS, zero spending.
  // Mirrors the Phase 63 engine-test fixture so we know bracketFill SHOULD fire.
  return {
    personalInfo: {
      dateOfBirth: '1958-01-01',
      province: 'ON',
      retirementAge: 60,
      lifeExpectancy: 85,
    },
    accounts: [
      { type: 'RRSP', balance: 300000 },
      { type: 'TFSA', balance: 10000 },
      { type: 'NonRegistered', balance: 20000 },
    ],
    incomeSources: [],
    governmentBenefits: { cppStartAge: 65, oasStartAge: 99 },
    expenses: { currentAnnualExpenses: 0, retirementAnnualExpenses: 0 },
    assumptions: { inflationRate: 0, investmentReturnRate: 0 },
  };
}

describe('bracketFill round-trip integration', () => {
  it('forwards bracketFill decision to the engine and produces non-zero withdrawal', () => {
    const base = makeRetireeFixture();
    const decisions: ScenarioDecisions = {
      bracketFill: { enabled: true },
    };

    const applied = applyScenarioDecisions(base, decisions);
    expect(applied.bracketFill).toEqual({ enabled: true });

    const calcInput = transformToProjectionInput(applied);
    expect(calcInput.bracketFill).toEqual({ enabled: true });

    const output = runSingleProjection(calcInput);
    const fills = output.yearlyResults
      .map((y: YearlyResult) => y.bracketFillWithdrawal ?? 0)
      .filter((v) => v > 0);
    expect(fills.length).toBeGreaterThan(0);
  });

  it('omits bracketFill from ProjectionInput when decisions do not set it', () => {
    const applied = applyScenarioDecisions(makeRetireeFixture(), {});
    const calcInput = transformToProjectionInput(applied);
    expect(calcInput.bracketFill).toBeUndefined();

    const output = runSingleProjection(calcInput);
    const anyFill = output.yearlyResults.some(
      (y: YearlyResult) => (y.bracketFillWithdrawal ?? 0) > 0
    );
    expect(anyFill).toBe(false);
  });

  it('honours annualCap when forwarded through the pipeline', () => {
    const base = makeRetireeFixture();
    const decisions: ScenarioDecisions = {
      bracketFill: { enabled: true, annualCap: 5000 },
    };
    const calcInput = transformToProjectionInput(applyScenarioDecisions(base, decisions));
    expect(calcInput.bracketFill).toEqual({ enabled: true, annualCap: 5000 });

    const output = runSingleProjection(calcInput);
    for (const year of output.yearlyResults) {
      expect(year.bracketFillWithdrawal ?? 0).toBeLessThanOrEqual(5000);
    }
  });
});
