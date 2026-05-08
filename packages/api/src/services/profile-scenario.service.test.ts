/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */
/**
 * Unit tests for profile-scenario.service — focused on the merge-patch invariant
 * and the T-03 clone-path security invariant.
 *
 * Nyquist-critical test: saving one category of decisions (Tax Strategy) must NOT wipe
 * previously saved decisions from a different category (Timing).
 *
 * T-03 invariant: cloning a scenario resets result_data to null so that the next /run
 * generates a fresh overrides sidecar — stale clamped-flag metadata cannot persist
 * across a clone.
 *
 * @see .planning/phases/20-decisions-editor/20-CONTEXT.md - merge-patch requirement
 * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-22, T-03
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

// -------------------------------------------------------------------------
// DB mock — a minimal fluent-builder that captures set() and insert() arguments
// -------------------------------------------------------------------------

// Mutable state per test
const mockState = {
  profileRow: undefined as unknown,
  scenarioRow: undefined as unknown,
  capturedSet: null as Record<string, unknown> | null,
  capturedInsertValues: null as Record<string, unknown> | null,
};

function buildSelectChain(tableResult: unknown) {
  const chain: any = {
    select: (_cols: string[]) => chain,
    selectAll: () => chain,
    where: (_col: string, _op: string, _val: unknown) => chain,
    orderBy: (_col: string, _dir?: string) => chain,
    execute: async () => (Array.isArray(tableResult) ? tableResult : []),
    executeTakeFirst: async () => tableResult,
    executeTakeFirstOrThrow: async () => {
      if (!tableResult) throw new Error('No row found');
      return tableResult;
    },
  };
  return chain;
}

vi.mock('../db/connection.js', () => {
  const db = {
    selectFrom: (table: string) => {
      if (table === 'household_profiles') {
        return buildSelectChain(mockState.profileRow);
      }
      if (table === 'profile_scenarios') {
        return buildSelectChain(mockState.scenarioRow);
      }
      return buildSelectChain(undefined);
    },
    updateTable: (_table: string) => {
      const updateChain: any = {
        set: (data: Record<string, unknown>) => {
          mockState.capturedSet = data;
          return updateChain;
        },
        where: (_col: string, _op: string, _val: unknown) => updateChain,
        execute: async () => ({ numUpdatedRows: BigInt(1) }),
        executeTakeFirstOrThrow: async () => mockState.scenarioRow,
        returningAll: () => updateChain,
      };
      return updateChain;
    },
    insertInto: (_table: string) => {
      const insertChain: any = {
        values: (data: Record<string, unknown>) => {
          // Capture the insert payload so tests can assert on what was inserted.
          // Simulates PostgreSQL RETURNING * — the returned row = what was inserted.
          mockState.capturedInsertValues = data;
          return insertChain;
        },
        returningAll: () => insertChain,
        executeTakeFirstOrThrow: async () => {
          // Return the captured insert payload as if the DB row was returned.
          // Adds a synthetic id and timestamps that real PostgreSQL would generate.
          return { id: 'cloned-scenario-id', ...mockState.capturedInsertValues };
        },
        execute: async () => [],
      };
      return insertChain;
    },
    deleteFrom: (_table: string) => ({
      where: (_col: string, _op: string, _val: unknown) => ({
        execute: async () => ({ numDeletedRows: BigInt(1) }),
      }),
    }),
  };
  return { db };
});

vi.mock('../utils/logger.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// Import AFTER mock registration
import {
  updateScenarioDecisions,
  scheduleRecomputeAllScenarios,
  cloneProfileScenario,
} from './profile-scenario.service.js';
import { NotFoundError } from '../middleware/error-handler.js';

const USER_ID = 'user-abc';
const SCENARIO_ID = 'scenario-xyz';
const PROFILE_ID = 'profile-001';

beforeEach(() => {
  mockState.profileRow = undefined;
  mockState.scenarioRow = undefined;
  mockState.capturedSet = null;
  mockState.capturedInsertValues = null;
});

describe('updateScenarioDecisions', () => {
  it('merge-patches decisions preserving unpatched keys', async () => {
    // Arrange: profile found, scenario has existing Timing decisions
    mockState.profileRow = { id: PROFILE_ID };
    mockState.scenarioRow = {
      id: SCENARIO_ID,
      decisions: { cppStartAge: 62, retirementAge: 60 },
    };

    // Act: patch with Tax Strategy key only
    await updateScenarioDecisions(USER_ID, SCENARIO_ID, { drawdownOrder: ['a', 'b'] });

    // Assert: merged decisions contain BOTH original Timing keys AND new Tax Strategy key
    expect(mockState.capturedSet).not.toBeNull();
    const decisions = mockState.capturedSet?.decisions as Record<string, unknown>;
    expect(decisions.cppStartAge).toBe(62);
    expect(decisions.retirementAge).toBe(60);
    expect(decisions.drawdownOrder).toEqual(['a', 'b']);
  });

  it('sets status to stale after merge-patch', async () => {
    // Arrange
    mockState.profileRow = { id: PROFILE_ID };
    mockState.scenarioRow = { id: SCENARIO_ID, decisions: {} };

    // Act
    await updateScenarioDecisions(USER_ID, SCENARIO_ID, { retirementAge: 62 });

    // Assert
    expect(mockState.capturedSet?.status).toBe('stale');
  });

  it('throws NotFoundError when scenario does not exist', async () => {
    // Arrange: profile found, scenario not found
    mockState.profileRow = { id: PROFILE_ID };
    mockState.scenarioRow = undefined;

    // Act + Assert
    await expect(
      updateScenarioDecisions(USER_ID, 'nonexistent-id', { drawdownOrder: ['x'] })
    ).rejects.toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// T-03 mitigation: clone resets result_data so next /run regenerates sidecar
// ---------------------------------------------------------------------------

/**
 * T-03: Cloning a scenario that has cached result_data (including override sidecar with
 * stale clamped flags) must reset result_data to null. The next /run call will then
 * regenerate the overrides sidecar fresh from current balances — stale clamped metadata
 * cannot persist across a clone boundary.
 *
 * This test locks the mitigation: any future refactor that removes `result_data: null`
 * from cloneProfileScenario will immediately fail this test.
 *
 * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-22, T-03 (Tampering threat)
 * @see packages/api/src/services/profile-scenario.service.ts - cloneProfileScenario (~line 95)
 */
describe('cloneProfileScenario — T-03 mitigation', () => {
  it('cloned scenario has result_data: null so the overrides sidecar regenerates on next /run (T-03)', async () => {
    // Arrange: source scenario with Phase 1 decisions AND a cached result_data containing
    // an overrides sidecar entry with a clamped=true flag (simulating a scenario that was
    // /run once and produced clamped override metadata).
    const sourceDecisions = {
      withdrawalOverrides: [{ field: 'rrsp', year: 2031, amount: 50000, applyForward: true }],
      spendingOverrides: [{ year: 2035, amount: 80000, applyForward: false }],
      surplusDestination: 'nonreg',
    };
    const staleResultData = {
      yearlyResults: [
        {
          year: 2031,
          overrides: {
            rrspWithdrawal: {
              source: 'override',
              requestedReal: 50000,
              requestedNominal: 51250,
              actual: 30000,
              clamped: true, // stale clamped flag from previous run
            },
          },
        },
      ],
    };

    mockState.profileRow = { id: PROFILE_ID };
    mockState.scenarioRow = {
      id: SCENARIO_ID,
      profile_id: PROFILE_ID,
      name: 'Test Scenario',
      is_base: false,
      decisions: sourceDecisions,
      result_data: staleResultData,
      status: 'stale',
    };

    // Act: clone the scenario
    const cloned = await cloneProfileScenario(USER_ID, SCENARIO_ID);

    // Assert 1: result_data is null on the clone — forces fresh /run (T-03 mitigation)
    expect(cloned.result_data).toBeNull();

    // Assert 2: decisions are carried forward byte-for-byte (all Phase 1 override fields)
    const clonedDecisions = cloned.decisions as typeof sourceDecisions;
    expect(clonedDecisions.withdrawalOverrides).toEqual(sourceDecisions.withdrawalOverrides);
    expect(clonedDecisions.spendingOverrides).toEqual(sourceDecisions.spendingOverrides);
    expect(clonedDecisions.surplusDestination).toBe(sourceDecisions.surplusDestination);

    // Assert 3: stale sidecar from source is NOT carried to the clone.
    // Since result_data is null, there is no sidecar to be stale. A subsequent /run
    // would compute fresh sidecar state from current balances (not from staleResultData).
    // Verify that the clone's result_data differs from the source's stale result_data.
    expect(cloned.result_data).not.toBe(staleResultData);
    expect(cloned.result_data).not.toEqual(staleResultData);
  });

  it('clone always resets result_data regardless of source result_data content', async () => {
    // A source with non-null result_data must produce a clone with result_data = null.
    mockState.profileRow = { id: PROFILE_ID };
    mockState.scenarioRow = {
      id: SCENARIO_ID,
      profile_id: PROFILE_ID,
      name: 'Another Scenario',
      is_base: false,
      decisions: {},
      result_data: { yearlyResults: [{ year: 2030 }] }, // non-null result_data
      status: 'complete',
    };

    const cloned = await cloneProfileScenario(USER_ID, SCENARIO_ID);

    // T-03: result_data MUST be null on clone regardless of source
    expect(cloned.result_data).toBeNull();
  });
});

describe('scheduleRecomputeAllScenarios (SCEN-08 race fix)', () => {
  // With an empty scenarios list, recomputeAllScenarios finishes synchronously
  // within a microtask: it selectFrom('profile_scenarios') (empty) + getProfileById.
  // Schedule multiple times back-to-back WITHOUT awaiting the first promise to
  // prove that subsequent calls return the same chain promise and do not spawn
  // parallel recomputes.
  it('collapses overlapping schedule calls into a single chain promise', async () => {
    mockState.profileRow = { id: PROFILE_ID, step_data: {}, current_step: 1 };
    mockState.scenarioRow = []; // recomputeAllScenarios sees zero scenarios

    const p1 = scheduleRecomputeAllScenarios(PROFILE_ID);
    const p2 = scheduleRecomputeAllScenarios(PROFILE_ID);
    const p3 = scheduleRecomputeAllScenarios(PROFILE_ID);

    // All overlapping schedulers share the same in-flight promise.
    expect(p2).toBe(p1);
    expect(p3).toBe(p1);

    await p1;

    // After settle, the next schedule starts a fresh chain (different promise).
    const p4 = scheduleRecomputeAllScenarios(PROFILE_ID);
    expect(p4).not.toBe(p1);
    await p4;
  });

  it('isolates chains across different profiles', async () => {
    mockState.profileRow = { id: PROFILE_ID, step_data: {}, current_step: 1 };
    mockState.scenarioRow = [];

    const a = scheduleRecomputeAllScenarios('profile-A');
    const b = scheduleRecomputeAllScenarios('profile-B');
    expect(a).not.toBe(b);
    await Promise.all([a, b]);
  });
});
