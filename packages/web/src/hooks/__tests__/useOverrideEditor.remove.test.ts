/**
 * RED unit tests for useOverrideEditor.removeOverride() and isRemoving state.
 *
 * These tests MUST FAIL until Plan 03-03 adds `removeOverride` and `isRemoving`
 * to OverrideEditorApi and implements the logic in useOverrideEditor.ts.
 *
 * Strategy:
 * - `removeOverride` and `isRemoving` do NOT exist on OverrideEditorApi yet.
 * - All tests that call `api.removeOverride(...)` or read `api.isRemoving` will
 *   fail with "removeOverride is not a function" / property is undefined.
 *
 * Decision refs: D-55, D-67, D-69, D-74, D-76, D-77
 * @see .planning/phases/03-cascade-undo/03-CONTEXT.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOverrideEditor } from '../useOverrideEditor';
import type { ScenarioDecisions } from '@retireops/shared';

// ---------------------------------------------------------------------------
// Mock fetch globally — same PATCH/POST pattern as Phase 1
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch;

  // Default: PATCH + POST /run both succeed
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      id: 'test-scenario-id',
      name: 'Test Scenario',
      is_base: true,
      status: 'completed',
      calculated_at: new Date().toISOString(),
      decisions: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      profile_id: 'test-profile-id',
      result_data: {
        projectionRows: [],
      },
    }),
    status: 200,
  });
});

// ---------------------------------------------------------------------------
// Shared test fixture factories
// ---------------------------------------------------------------------------

const SCENARIO_ID = 'test-scenario-id';

function makeInitialDecisions(overrides: Partial<ScenarioDecisions> = {}): ScenarioDecisions {
  return {
    withdrawalOverrides: [],
    spendingOverrides: [],
    ...overrides,
  };
}

function makeWithdrawalOverride(
  field: 'rrsp' | 'rrif' | 'lif' | 'tfsa' | 'nonreg',
  year: number,
  amount: number,
  applyForward = false
) {
  return { field, year, amount, applyForward };
}

function makeSpendingOverride(year: number, amount: number, applyForward = false) {
  return { year, amount, applyForward };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useOverrideEditor.removeOverride', () => {
  it('exists as a function on the API (RED — currently undefined)', () => {
    const onScenarioUpdated = vi.fn();
    const { result } = renderHook(() =>
      useOverrideEditor({
        scenarioId: SCENARIO_ID,
        initialDecisions: makeInitialDecisions(),
        onScenarioUpdated,
      })
    );
    // RED: removeOverride does not yet exist on OverrideEditorApi
    expect(typeof (result.current as any).removeOverride).toBe('function');
  });

  it('isRemoving exists and starts false', () => {
    const { result } = renderHook(() =>
      useOverrideEditor({
        scenarioId: SCENARIO_ID,
        initialDecisions: makeInitialDecisions(),
        onScenarioUpdated: vi.fn(),
      })
    );
    // RED: isRemoving does not yet exist on OverrideEditorApi
    expect((result.current as any).isRemoving).toBe(false);
  });

  it('removeOverride("rrsp", 2031) PATCHes with the rrsp/2031 record absent', async () => {
    const initialDecisions = makeInitialDecisions({
      withdrawalOverrides: [
        makeWithdrawalOverride('rrsp', 2031, 50000, false),
        makeWithdrawalOverride('tfsa', 2032, 1000, false),
      ],
    });
    const onScenarioUpdated = vi.fn();

    const { result } = renderHook(() =>
      useOverrideEditor({
        scenarioId: SCENARIO_ID,
        initialDecisions,
        onScenarioUpdated,
      })
    );

    await act(async () => {
      await (result.current as any).removeOverride('rrsp', 2031);
    });

    // Find the PUT call to /decisions
    const patchCall = mockFetch.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === 'string' &&
        call[0].includes('/decisions') &&
        (call[1] as RequestInit)?.method === 'PUT'
    );
    expect(patchCall).toBeDefined();

    const body = JSON.parse((patchCall![1] as RequestInit).body as string) as {
      withdrawalOverrides: Array<{ field: string; year: number }>;
    };
    // rrsp/2031 must be absent
    const rrsp2031 = body.withdrawalOverrides.find((o) => o.field === 'rrsp' && o.year === 2031);
    expect(rrsp2031).toBeUndefined();
    // tfsa/2032 must still be present
    const tfsa2032 = body.withdrawalOverrides.find((o) => o.field === 'tfsa' && o.year === 2032);
    expect(tfsa2032).toBeDefined();
  });

  it('removeOverride("spending", 2035) PATCHes with the year-2035 spending record absent', async () => {
    const initialDecisions = makeInitialDecisions({
      spendingOverrides: [makeSpendingOverride(2035, 80000, true)],
    });
    const onScenarioUpdated = vi.fn();

    const { result } = renderHook(() =>
      useOverrideEditor({
        scenarioId: SCENARIO_ID,
        initialDecisions,
        onScenarioUpdated,
      })
    );

    await act(async () => {
      await (result.current as any).removeOverride('spending', 2035);
    });

    const patchCall = mockFetch.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === 'string' &&
        call[0].includes('/decisions') &&
        (call[1] as RequestInit)?.method === 'PUT'
    );
    expect(patchCall).toBeDefined();

    const body = JSON.parse((patchCall![1] as RequestInit).body as string) as {
      spendingOverrides: Array<{ year: number }>;
    };
    expect(body.spendingOverrides).toEqual([]);
  });

  it('removeOverride leaves array unchanged if no matching record (idempotent)', async () => {
    const initialDecisions = makeInitialDecisions({
      withdrawalOverrides: [makeWithdrawalOverride('tfsa', 2032, 1000, false)],
    });
    const onScenarioUpdated = vi.fn();

    const { result } = renderHook(() =>
      useOverrideEditor({
        scenarioId: SCENARIO_ID,
        initialDecisions,
        onScenarioUpdated,
      })
    );

    await act(async () => {
      // Remove rrsp/2031 which does NOT exist
      await (result.current as any).removeOverride('rrsp', 2031);
    });

    const patchCall = mockFetch.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === 'string' &&
        call[0].includes('/decisions') &&
        (call[1] as RequestInit)?.method === 'PUT'
    );
    expect(patchCall).toBeDefined();

    const body = JSON.parse((patchCall![1] as RequestInit).body as string) as {
      withdrawalOverrides: Array<{ field: string; year: number }>;
    };
    // tfsa/2032 must still be present — no removal happened
    const tfsa2032 = body.withdrawalOverrides.find((o) => o.field === 'tfsa' && o.year === 2032);
    expect(tfsa2032).toBeDefined();
  });

  it('isRemoving toggles true during PATCH and false after', async () => {
    let resolvePatch!: (value: unknown) => void;
    const patchPromise = new Promise((resolve) => {
      resolvePatch = resolve;
    });

    mockFetch.mockImplementationOnce(() => patchPromise);

    const { result } = renderHook(() =>
      useOverrideEditor({
        scenarioId: SCENARIO_ID,
        initialDecisions: makeInitialDecisions({
          withdrawalOverrides: [makeWithdrawalOverride('rrsp', 2031, 50000)],
        }),
        onScenarioUpdated: vi.fn(),
      })
    );

    // Start removeOverride but do NOT await yet
    let removePromise: Promise<void>;
    act(() => {
      removePromise = (result.current as any).removeOverride('rrsp', 2031) as Promise<void>;
    });

    // During PATCH — isRemoving should be true
    expect((result.current as any).isRemoving).toBe(true);

    // Resolve the PATCH
    resolvePatch({
      ok: true,
      json: async () => ({}),
      status: 200,
    });

    await act(async () => {
      await removePromise!;
    });

    // After completion — isRemoving should be false
    expect((result.current as any).isRemoving).toBe(false);
  });

  it('removeOverride triggers debounced /run (D-74 reuses persistAndRecompute)', async () => {
    vi.useFakeTimers();

    const onScenarioUpdated = vi.fn();
    const { result } = renderHook(() =>
      useOverrideEditor({
        scenarioId: SCENARIO_ID,
        initialDecisions: makeInitialDecisions({
          withdrawalOverrides: [makeWithdrawalOverride('rrsp', 2031, 50000)],
        }),
        onScenarioUpdated,
      })
    );

    await act(async () => {
      await (result.current as any).removeOverride('rrsp', 2031);
    });

    // Advance past debounce threshold (400ms per D-27)
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    // POST /run should have been called
    const runCall = mockFetch.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === 'string' &&
        call[0].includes('/run') &&
        (call[1] as RequestInit)?.method === 'POST'
    );
    expect(runCall).toBeDefined();

    vi.useRealTimers();
  });

  it('removeOverride rolls back local decisions on PATCH failure', async () => {
    // Mock PATCH to fail
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const initialDecisions = makeInitialDecisions({
      withdrawalOverrides: [makeWithdrawalOverride('rrsp', 2031, 50000)],
    });

    const { result } = renderHook(() =>
      useOverrideEditor({
        scenarioId: SCENARIO_ID,
        initialDecisions,
        onScenarioUpdated: vi.fn(),
      })
    );

    await act(async () => {
      try {
        await (result.current as any).removeOverride('rrsp', 2031);
      } catch {
        // Expected to throw
      }
    });

    // decisions should be rolled back to pre-call state
    const decisions = result.current.decisions;
    const rrsp2031 = (decisions.withdrawalOverrides ?? []).find(
      (o) => o.field === 'rrsp' && o.year === 2031
    );
    expect(rrsp2031).toBeDefined();
    expect(rrsp2031!.amount).toBe(50000);
  });

  it('onBeforeSave callback (Phase 3 hook arg) fires before PATCH dispatch (D-74 + D-76)', async () => {
    const callOrder: string[] = [];
    const onBeforeSave = vi.fn(() => {
      callOrder.push('onBeforeSave');
    });

    // Track PATCH calls
    mockFetch.mockImplementation((url: string, init: RequestInit) => {
      if (typeof url === 'string' && url.includes('/decisions') && init?.method === 'PUT') {
        callOrder.push('put');
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
        status: 200,
      });
    });

    const { result } = renderHook(() =>
      useOverrideEditor({
        scenarioId: SCENARIO_ID,
        initialDecisions: makeInitialDecisions({
          withdrawalOverrides: [makeWithdrawalOverride('rrsp', 2031, 50000)],
        }),
        onScenarioUpdated: vi.fn(),
        // onBeforeSave is a Phase 3 addition to the hook's args — RED
        onBeforeSave,
      } as any)
    );

    await act(async () => {
      await (result.current as any).removeOverride('rrsp', 2031);
    });

    expect(onBeforeSave).toHaveBeenCalledOnce();
    // onBeforeSave must come BEFORE PATCH
    expect(callOrder.indexOf('onBeforeSave')).toBeLessThan(callOrder.indexOf('put'));
  });

  it('onBeforeSave callback also fires on savePopover (D-58)', async () => {
    const callOrder: string[] = [];
    const onBeforeSave = vi.fn(() => {
      callOrder.push('onBeforeSave');
    });

    mockFetch.mockImplementation((url: string, init: RequestInit) => {
      if (typeof url === 'string' && url.includes('/decisions') && init?.method === 'PUT') {
        callOrder.push('put');
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
        status: 200,
      });
    });

    const { result } = renderHook(() =>
      useOverrideEditor({
        scenarioId: SCENARIO_ID,
        initialDecisions: makeInitialDecisions(),
        onScenarioUpdated: vi.fn(),
        // onBeforeSave is a Phase 3 addition — RED
        onBeforeSave,
      } as any)
    );

    // Open a cell so savePopover has a valid cell to save
    act(() => {
      result.current.openPopover(2031, 'rrsp');
    });

    await act(async () => {
      await result.current.savePopover({
        primary: { amount: 50000, applyForward: false },
      });
    });

    expect(onBeforeSave).toHaveBeenCalledOnce();
    expect(callOrder.indexOf('onBeforeSave')).toBeLessThan(callOrder.indexOf('put'));
  });
});
