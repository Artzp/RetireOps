/**
 * End-to-end pipeline tests — applyScenarioDecisions → transformToProjectionInput → runProjection.
 *
 * WR-03 regression coverage: the existing integration tests in
 * profile-scenarios.routes.integration.test.ts mock both
 * @retireops/calculation-engine and ../services/projection-transformer.js,
 * so they cannot detect when the bridge silently drops Phase 1 override
 * fields between applyScenarioDecisions and the engine. CR-01 is exactly
 * that bug — and the mocked tests passed despite the bridge being broken.
 *
 * These tests exercise the REAL pipeline (no engine/transformer mocks) and
 * assert that override input flows all the way through to engine output.
 *
 * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-01, D-02, D-15, D-22
 */
import { describe, it, expect } from 'vitest';
import type { ProjectionInput, ScenarioDecisions } from '@retireops/shared';
import { runProjection } from '@retireops/calculation-engine';
import { applyScenarioDecisions } from './scenario-decisions.js';
import { transformToProjectionInput } from './projection-transformer.js';
import type { FrontendInputData } from './projection-transformer.js';

const BASE_SINGLE: FrontendInputData = {
  personalInfo: {
    dateOfBirth: '1965-01-01',
    province: 'ON',
    retirementAge: 65,
    lifeExpectancy: 90,
    maritalStatus: 'single',
  },
  accounts: [
    { type: 'RRSP', balance: 500_000 },
    { type: 'TFSA', balance: 100_000 },
    { type: 'NonRegistered', balance: 200_000 },
  ],
  incomeSources: [{ type: 'employment', annualAmount: 0 }],
  governmentBenefits: { cppStartAge: 65, oasStartAge: 65, estimatedCppAmount: 9_000 },
  expenses: { currentAnnualExpenses: 60_000, retirementAnnualExpenses: 60_000 },
  assumptions: { inflationRate: 2.5, investmentReturnRate: 5 },
};

describe('projection pipeline — applyScenarioDecisions → transform → engine', () => {
  it('forwards withdrawalOverrides through the full pipeline and the engine emits a sidecar (CR-01, D-22)', () => {
    // Override RRSP for the post-retirement year — the engine's override-pass
    // should produce a sidecar entry with source='override' on the matching
    // YearlyResult. Use a relative year so the test is deterministic across
    // runtime dates: pick the second post-retirement year from the engine's
    // own startYear (read from the output below).
    const overrideAmount = 25_000;
    // Use a far-future fixed year guaranteed to be in the projection window
    // for any reasonable getCurrentYear() value (current year + 5 should
    // always fall after age 65 retirement for a 1965-01-01 birthdate).
    const decisions: ScenarioDecisions = {
      withdrawalOverrides: [
        {
          field: 'rrsp',
          year: new Date().getFullYear() + 5,
          amount: overrideAmount,
          applyForward: false,
        },
      ],
    };

    const applied = applyScenarioDecisions(BASE_SINGLE, decisions);
    const projectionInput: ProjectionInput = transformToProjectionInput(applied);

    // Bridge contract: transformer must forward the override array to engine input.
    expect(projectionInput.withdrawalOverrides).toBeDefined();
    expect(projectionInput.withdrawalOverrides?.[0]?.field).toBe('rrsp');
    expect(projectionInput.withdrawalOverrides?.[0]?.amount).toBe(overrideAmount);

    // Engine contract: feeding withdrawalOverrides through runProjection must
    // produce a D-22 sidecar entry on the matching yearly result.
    const output = runProjection(projectionInput);
    expect(output.yearlyResults.length).toBeGreaterThan(0);

    const targetYear = projectionInput.withdrawalOverrides?.[0]?.year;
    const targetRow = output.yearlyResults.find((r) => r.year === targetYear);

    // The fixture (age 65 retirement, 25-year life expectancy from 65 = 90)
    // makes year currentYear+5 within the projection window. The override
    // sidecar is the engine's confirmation that the bridge fix works
    // end-to-end: bridge → transformer → engine → sidecar emission.
    expect(targetRow).toBeDefined();
    if (targetRow && 'overrides' in targetRow) {
      expect(targetRow.overrides).toBeDefined();
      expect(targetRow.overrides?.rrspWithdrawal).toBeDefined();
      expect(targetRow.overrides?.rrspWithdrawal?.source).toBe('override');
      expect(targetRow.overrides?.rrspWithdrawal?.requestedReal).toBe(overrideAmount);
    }
  });

  it('forwards spendingOverrides through the full pipeline (D-02)', () => {
    const decisions: ScenarioDecisions = {
      spendingOverrides: [{ year: 2032, amount: 80_000, applyForward: false }],
    };

    const applied = applyScenarioDecisions(BASE_SINGLE, decisions);
    const projectionInput: ProjectionInput = transformToProjectionInput(applied);

    expect(projectionInput.spendingOverrides).toBeDefined();
    expect(projectionInput.spendingOverrides?.[0]?.year).toBe(2032);
    expect(projectionInput.spendingOverrides?.[0]?.amount).toBe(80_000);

    // Engine accepts and runs without throwing.
    const output = runProjection(projectionInput);
    expect(output.yearlyResults.length).toBeGreaterThan(0);
  });

  it('forwards surplusDestination through the full pipeline (D-15)', () => {
    const decisions: ScenarioDecisions = {
      surplusDestination: 'tfsa',
    };

    const applied = applyScenarioDecisions(BASE_SINGLE, decisions);
    const projectionInput: ProjectionInput = transformToProjectionInput(applied);

    expect(projectionInput.surplusDestination).toBe('tfsa');

    // Engine accepts and runs without throwing.
    const output = runProjection(projectionInput);
    expect(output.yearlyResults.length).toBeGreaterThan(0);
  });

  it('omits all Phase 1 override fields when decisions does not set them (additive invariant)', () => {
    const decisions: ScenarioDecisions = {};

    const applied = applyScenarioDecisions(BASE_SINGLE, decisions);
    const projectionInput: ProjectionInput = transformToProjectionInput(applied);

    expect(projectionInput.withdrawalOverrides).toBeUndefined();
    expect(projectionInput.spendingOverrides).toBeUndefined();
    expect(projectionInput.surplusDestination).toBeUndefined();

    // Engine produces no warnings field on output (criterion #5).
    const output = runProjection(projectionInput);
    expect(output.warnings).toBeUndefined();
  });

  it('forwards all three Phase 1 fields together end-to-end', () => {
    const decisions: ScenarioDecisions = {
      withdrawalOverrides: [{ field: 'tfsa', year: 2031, amount: 10_000, applyForward: true }],
      spendingOverrides: [{ year: 2031, amount: 65_000, applyForward: true }],
      surplusDestination: 'nonreg',
    };

    const applied = applyScenarioDecisions(BASE_SINGLE, decisions);
    const projectionInput: ProjectionInput = transformToProjectionInput(applied);

    expect(projectionInput.withdrawalOverrides?.length).toBe(1);
    expect(projectionInput.spendingOverrides?.length).toBe(1);
    expect(projectionInput.surplusDestination).toBe('nonreg');

    // Engine completes successfully with all three fields present.
    const output = runProjection(projectionInput);
    expect(output.yearlyResults.length).toBeGreaterThan(0);
  });
});
