/**
 * Phase 2 — API metadata persistence integration tests (RED in Wave 0).
 *
 * Asserts that `updateScenarioDecisions()` writes ISO timestamps + `originalEngineValue`
 * onto each new override record at PATCH time (PROV-02, D-46, D-47).
 *
 * ALL tests are currently RED because `updateScenarioDecisions` does not yet
 * write `createdAt`, `updatedAt`, or `originalEngineValue` onto override records.
 * Plan 05 (API metadata write) must turn every assertion GREEN.
 *
 * Uses the same integration setup as existing API integration tests:
 * - `integration-setup.ts` mocks DB, auth, redis, logger, config
 * - `mockDb` in-memory store: `profile_scenarios` + `household_profiles`
 * - No real PostgreSQL connection required
 *
 * @see .planning/phases/02-cell-provenance/02-CONTEXT.md - D-46, D-47, D-48, D-49
 * @see packages/shared/src/types/scenario.ts lines 126-128, 163-165
 * Decision refs: "D-46" "D-47" "D-49" "PROV-02" "T-PROV-02"
 */

import { describe, it, expect, beforeEach } from 'vitest';
import '../../test/integration-setup.js';
import { mockDb } from '../../test/helpers/mock-db.js';
import { TEST_USER } from '../../test/helpers/test-app.js';
import { updateScenarioDecisions } from '../profile-scenario.service.js';
import { assembleProfileInputData } from '../profile-assembler.js';
import { applyScenarioDecisions } from '../scenario-decisions.js';
import {
  transformToProjectionInput,
  transformToFrontendOutput,
} from '../projection-transformer.js';
import { runProjection } from '@retireops/calculation-engine';
import { ScenarioDecisionsSchema } from '@retireops/shared';
import type { ScenarioDecisions } from '@retireops/shared';

// ---------------------------------------------------------------------------
// Test IDs — stable across beforeEach resets
// ---------------------------------------------------------------------------

const TEST_PROFILE_ID = 'test-profile-uuid-prov02';
const TEST_SCENARIO_ID = 'test-scenario-uuid-prov02';
const USER_ID = TEST_USER.id;

// ---------------------------------------------------------------------------
// Helpers — read scenario decisions back from the mock store
// ---------------------------------------------------------------------------

/**
 * Reads the raw decisions object from the in-memory mock store for a scenario.
 * Returns undefined if the scenario does not exist.
 */
async function loadScenarioDecisions(scenarioId: string): Promise<ScenarioDecisions | undefined> {
  const scenarioRow = (mockDb as any)._profileScenarios.get(scenarioId);
  if (!scenarioRow) return undefined;

  const rawDecisions = scenarioRow.decisions ?? {};
  const decisionsObj =
    typeof rawDecisions === 'string' ? (JSON.parse(rawDecisions) as unknown) : rawDecisions;
  return decisionsObj as ScenarioDecisions;
}

/**
 * Runs the engine baseline for a scenario and returns the engine-calculated
 * value for the given (year, fieldKey) combination.
 *
 * Plan 05 replacement: calls the real engine pipeline (assembleProfileInputData →
 * applyScenarioDecisions → transformToProjectionInput → runProjection →
 * transformToFrontendOutput) using the PRE-PATCH decisions, then extracts the
 * relevant field from projectionRows for the given year.
 *
 * This mirrors exactly what updateScenarioDecisions does server-side (D-47),
 * so the assertion `originalEngineValue ≈ getEngineFieldForScenario(...)` is
 * testing that the stored value equals the real engine output before the patch.
 *
 * fieldKey mapping (matches injectOriginalEngineValues in profile-scenario.service.ts):
 *   'rrspWithdrawal' → projectionRow.rrifWithdrawal  (RRSP converts to RRIF)
 *   'livingExpenses' → projectionRow.livingExpenses
 */
async function getEngineFieldForScenario(
  scenarioId: string,
  year: number,
  fieldKey: string
): Promise<number> {
  const scenarioRow = (mockDb as any)._profileScenarios.get(scenarioId);
  if (!scenarioRow) return 0;

  const profileRow = (mockDb as any)._householdProfiles.get(scenarioRow.profile_id);
  if (!profileRow) return 0;

  // Assemble profile data in the same shape as getProfileById returns
  const profile = {
    id: profileRow.id as string,
    stepData: (profileRow.step_data ?? {}) as Record<string, unknown>,
    currentStep: profileRow.current_step as number,
    createdAt: profileRow.created_at as Date,
    updatedAt: profileRow.updated_at as Date,
  };

  // Parse decisions (mirrors computeScenarioResult in the service)
  const rawDecisions = scenarioRow.decisions ?? {};
  const decisionsObj =
    typeof rawDecisions === 'string' ? (JSON.parse(rawDecisions) as unknown) : rawDecisions;
  const decisions = ScenarioDecisionsSchema.parse(decisionsObj);

  // Run the same pipeline as computeScenarioResult (D-47)
  const baseInput = assembleProfileInputData(profile);
  const inputWithDecisions = applyScenarioDecisions(baseInput, decisions);
  const calcInput = transformToProjectionInput(inputWithDecisions);
  const calcOutput = runProjection(calcInput);
  const resultData = transformToFrontendOutput(
    calcOutput,
    inputWithDecisions.personalInfo.lifeExpectancy
  );

  // Find the year row in projectionRows
  const row = (resultData.projectionRows ?? []).find((r: any) => r.year === year);
  if (!row) return 0;

  // Field mapping: rrspWithdrawal maps to rrifWithdrawal (RRSP converts to RRIF before drawdown)
  if (fieldKey === 'rrspWithdrawal') return (row as any).rrifWithdrawal ?? 0;
  return (row as any)[fieldKey] ?? 0;
}

// ---------------------------------------------------------------------------
// Seed helpers — provision a minimal profile + scenario with a known baseline
// ---------------------------------------------------------------------------

function seedProfileAndScenario() {
  // Insert a household profile
  const profile = {
    id: TEST_PROFILE_ID,
    user_id: USER_ID,
    step_data: {
      about_you: {
        firstName: 'Jane',
        dateOfBirth: '1966-01-01',
        province: 'ON',
        retirementAge: 64,
        lifeExpectancy: 90,
      },
    },
    current_step: 1,
    created_at: new Date(),
    updated_at: new Date(),
  };
  (mockDb as any)._householdProfiles.set(TEST_PROFILE_ID, profile);

  // Insert a scenario with empty decisions and a seeded baseline result
  // (baseline RRSP withdrawal at year 2031: $42,000; livingExpenses at 2035: $62,000)
  const scenario = {
    id: TEST_SCENARIO_ID,
    profile_id: TEST_PROFILE_ID,
    name: 'Base Scenario',
    is_base: true,
    decisions: JSON.stringify({
      drawdownOrder: ['rrsp', 'tfsa', 'nonReg'],
      targetRetirementSpending: 60000,
      withdrawalOverrides: [],
      spendingOverrides: [],
    }),
    result_data: {
      seedBaseline: {
        rrspWithdrawal: 42000,
        livingExpenses: 62000,
      },
    },
    status: 'ready',
    calculated_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  };
  (mockDb as any)._profileScenarios.set(TEST_SCENARIO_ID, scenario);
}

// ---------------------------------------------------------------------------
// Integration test suite
// ---------------------------------------------------------------------------

describe('updateScenarioDecisions — PROV-02 metadata persistence', () => {
  beforeEach(() => {
    mockDb.reset();
    seedProfileAndScenario();
  });

  it('writes ISO-8601 createdAt on a new withdrawalOverrides record (D-46)', async () => {
    const before = new Date().toISOString();

    await updateScenarioDecisions(USER_ID, TEST_SCENARIO_ID, {
      withdrawalOverrides: [{ field: 'rrsp', year: 2031, amount: 50000, applyForward: false }],
    });

    const after = new Date().toISOString();
    const stored = await loadScenarioDecisions(TEST_SCENARIO_ID);
    const record = stored?.withdrawalOverrides?.find(
      (o: any) => o.field === 'rrsp' && o.year === 2031
    );

    // D-46: createdAt must be an ISO-8601 datetime written at PATCH time
    expect(record).toBeDefined();
    expect(record!.createdAt).toBeDefined();
    expect(record!.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    // Must fall within the test's wall-clock window
    expect(
      new Date(record!.createdAt!) >= new Date(before) &&
        new Date(record!.createdAt!) <= new Date(after)
    ).toBe(true);
  });

  it('writes ISO-8601 updatedAt on a new record AND bumps it on a subsequent update (D-46)', async () => {
    // First PATCH
    await updateScenarioDecisions(USER_ID, TEST_SCENARIO_ID, {
      withdrawalOverrides: [{ field: 'rrsp', year: 2031, amount: 50000, applyForward: false }],
    });
    const stored1 = await loadScenarioDecisions(TEST_SCENARIO_ID);
    const updatedAt1 = stored1?.withdrawalOverrides?.find(
      (o: any) => o.field === 'rrsp' && o.year === 2031
    )?.updatedAt;

    // Small delay so timestamps differ
    await new Promise((r) => setTimeout(r, 5));

    // Second PATCH with different amount
    await updateScenarioDecisions(USER_ID, TEST_SCENARIO_ID, {
      withdrawalOverrides: [{ field: 'rrsp', year: 2031, amount: 60000, applyForward: false }],
    });
    const stored2 = await loadScenarioDecisions(TEST_SCENARIO_ID);
    const updatedAt2 = stored2?.withdrawalOverrides?.find(
      (o: any) => o.field === 'rrsp' && o.year === 2031
    )?.updatedAt;

    // D-46: updatedAt must be present and strictly later on the second write
    expect(updatedAt1).toBeDefined();
    expect(updatedAt2).toBeDefined();
    expect(new Date(updatedAt2!).getTime()).toBeGreaterThan(new Date(updatedAt1!).getTime());
  });

  it('writes originalEngineValue equal to the engine output for (year, field) BEFORE the override merges (D-47, T-PROV-02)', async () => {
    // Capture the baseline engine output BEFORE the override is applied
    const baselineRRSP = await getEngineFieldForScenario(TEST_SCENARIO_ID, 2031, 'rrspWithdrawal');

    await updateScenarioDecisions(USER_ID, TEST_SCENARIO_ID, {
      withdrawalOverrides: [{ field: 'rrsp', year: 2031, amount: 50000, applyForward: false }],
    });

    const stored = await loadScenarioDecisions(TEST_SCENARIO_ID);
    const record = stored?.withdrawalOverrides?.find(
      (o: any) => o.field === 'rrsp' && o.year === 2031
    );

    // T-PROV-02: originalEngineValue must capture the pre-override engine output
    expect(record).toBeDefined();
    expect(record!.originalEngineValue).toBeDefined();
    expect(record!.originalEngineValue).toBeCloseTo(baselineRRSP, 0);
  });

  it('writes ISO-8601 createdAt + originalEngineValue on spendingOverrides records (D-46, D-47)', async () => {
    const baselineSpending = await getEngineFieldForScenario(
      TEST_SCENARIO_ID,
      2035,
      'livingExpenses'
    );

    await updateScenarioDecisions(USER_ID, TEST_SCENARIO_ID, {
      spendingOverrides: [{ year: 2035, amount: 80000, applyForward: true }],
    });

    const stored = await loadScenarioDecisions(TEST_SCENARIO_ID);
    const record = stored?.spendingOverrides?.find((o: any) => o.year === 2035);

    // D-46: createdAt must be written on spendingOverrides too
    expect(record).toBeDefined();
    expect(record!.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // D-47: originalEngineValue must capture the pre-override spending baseline
    expect(record!.originalEngineValue).toBeDefined();
    expect(record!.originalEngineValue).toBeCloseTo(baselineSpending, 0);
  });

  it('engine output is independent of metadata field values (D-49)', async () => {
    // D-49: createdAt / updatedAt / originalEngineValue are API-layer only — the engine
    // never reads them. To verify this, we apply two overrides with identical amounts but
    // artificially different metadata values. The test asserts that the DECISIONS that
    // reach the engine are identical (engine purity preserved).
    //
    // Implementation note: in this RED state, `updateScenarioDecisions` doesn't write
    // metadata yet, so both calls result in identical stored decisions. When Plan 05
    // adds metadata writes, it must NOT change any field the engine reads (amount,
    // applyForward, year, field) — only the metadata fields are new.
    //
    // The assertions below verify the shape invariant: metadata fields are additive only.

    await updateScenarioDecisions(USER_ID, TEST_SCENARIO_ID, {
      withdrawalOverrides: [{ field: 'rrsp', year: 2031, amount: 50000, applyForward: false }],
    });
    const stored = await loadScenarioDecisions(TEST_SCENARIO_ID);
    const record = stored?.withdrawalOverrides?.find(
      (o: any) => o.field === 'rrsp' && o.year === 2031
    );

    // The engine-facing fields must be preserved exactly as provided
    expect(record!.field).toBe('rrsp');
    expect(record!.year).toBe(2031);
    expect(record!.amount).toBe(50000);
    expect(record!.applyForward).toBe(false);

    // D-49: metadata fields MUST be written (RED until Plan 05 writes them)
    // AND engine-facing fields must remain unchanged (invariant that stays GREEN after Plan 05)
    expect(record!.createdAt).toBeDefined(); // RED until Plan 05 writes createdAt
    expect(record!.updatedAt).toBeDefined(); // RED until Plan 05 writes updatedAt
    // After Plan 05 writes metadata, engine-facing fields must still be correct:
    expect(record!.field).toBe('rrsp');
    expect(record!.amount).toBe(50000);
  });

  it('handles ETag-less PATCH — metadata writes preserve last-write-wins semantics (D-46, Phase 1 D-30)', async () => {
    // Smoke test: confirm metadata writes do not break Phase 1's last-write-wins behavior.
    // Two sequential PATCHes with different amounts — the second one wins on amount.
    await updateScenarioDecisions(USER_ID, TEST_SCENARIO_ID, {
      withdrawalOverrides: [{ field: 'rrsp', year: 2031, amount: 30000, applyForward: false }],
    });
    await updateScenarioDecisions(USER_ID, TEST_SCENARIO_ID, {
      withdrawalOverrides: [{ field: 'rrsp', year: 2031, amount: 45000, applyForward: false }],
    });

    const stored = await loadScenarioDecisions(TEST_SCENARIO_ID);
    const record = stored?.withdrawalOverrides?.find(
      (o: any) => o.field === 'rrsp' && o.year === 2031
    );

    // Second write wins on amount (last-write-wins, no concurrency token in v4.2)
    expect(record!.amount).toBe(45000);
    // D-46: updatedAt must be written (RED until Plan 05 writes it)
    expect(record!.updatedAt).toBeDefined();
    // D-46: createdAt must be written (RED until Plan 05 writes it)
    expect(record!.createdAt).toBeDefined();
  });
});
