/**
 * Unit tests for the `owner` discriminator on useOverrideEditor.
 *
 * The hook now threads an `owner: 'primary' | 'spouse'` through openPopover →
 * savePopover and through removeOverride. Without it, primary and spouse cells
 * for the same (field, year) cannot coexist or be deleted independently.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOverrideEditor } from '../useOverrideEditor';
import type { ScenarioDecisions } from '@retireops/shared';

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch;
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
      result_data: { projectionRows: [] },
    }),
    status: 200,
  });
});

const SCENARIO_ID = 'test-scenario-id';
const emptyDecisions: ScenarioDecisions = { withdrawalOverrides: [], spendingOverrides: [] };

function findDecisionsBody() {
  const call = mockFetch.mock.calls.find(
    (c: unknown[]) =>
      typeof c[0] === 'string' &&
      c[0].includes('/decisions') &&
      (c[1] as RequestInit)?.method === 'PUT'
  );
  expect(call).toBeDefined();
  return JSON.parse((call![1] as RequestInit).body as string) as ScenarioDecisions;
}

describe('useOverrideEditor — owner discriminator', () => {
  it('savePopover with owner="spouse" persists the record tagged with owner="spouse"', async () => {
    const { result } = renderHook(() =>
      useOverrideEditor({
        scenarioId: SCENARIO_ID,
        initialDecisions: emptyDecisions,
        onScenarioUpdated: vi.fn(),
      })
    );

    act(() => {
      result.current.openPopover(2031, 'rrsp', 'spouse');
    });

    await act(async () => {
      await result.current.savePopover({
        primary: { amount: 15000, applyForward: false },
      });
    });

    const body = findDecisionsBody();
    const record = body.withdrawalOverrides?.find((o) => o.field === 'rrsp' && o.year === 2031);
    expect(record).toBeDefined();
    expect(record?.owner).toBe('spouse');
    expect(record?.amount).toBe(15000);
  });

  it('primary and spouse overrides for the same (field, year) coexist', async () => {
    const initialDecisions: ScenarioDecisions = {
      withdrawalOverrides: [
        {
          field: 'rrsp',
          year: 2031,
          amount: 25000,
          applyForward: false,
          owner: 'primary',
        },
      ],
      spendingOverrides: [],
    };

    const { result } = renderHook(() =>
      useOverrideEditor({
        scenarioId: SCENARIO_ID,
        initialDecisions,
        onScenarioUpdated: vi.fn(),
      })
    );

    act(() => {
      result.current.openPopover(2031, 'rrsp', 'spouse');
    });

    await act(async () => {
      await result.current.savePopover({
        primary: { amount: 15000, applyForward: false },
      });
    });

    const body = findDecisionsBody();
    const records = (body.withdrawalOverrides ?? []).filter(
      (o) => o.field === 'rrsp' && o.year === 2031
    );
    expect(records).toHaveLength(2);

    const primaryRec = records.find((r) => r.owner === 'primary');
    const spouseRec = records.find((r) => r.owner === 'spouse');
    expect(primaryRec?.amount).toBe(25000);
    expect(spouseRec?.amount).toBe(15000);
  });

  it('removeOverride with owner="spouse" leaves the primary record untouched', async () => {
    const initialDecisions: ScenarioDecisions = {
      withdrawalOverrides: [
        {
          field: 'rrsp',
          year: 2031,
          amount: 25000,
          applyForward: false,
          owner: 'primary',
        },
        {
          field: 'rrsp',
          year: 2031,
          amount: 15000,
          applyForward: false,
          owner: 'spouse',
        },
      ],
      spendingOverrides: [],
    };

    const { result } = renderHook(() =>
      useOverrideEditor({
        scenarioId: SCENARIO_ID,
        initialDecisions,
        onScenarioUpdated: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.removeOverride('rrsp', 2031, 'spouse');
    });

    const body = findDecisionsBody();
    const records = (body.withdrawalOverrides ?? []).filter(
      (o) => o.field === 'rrsp' && o.year === 2031
    );
    expect(records).toHaveLength(1);
    expect(records[0]?.owner).toBe('primary');
    expect(records[0]?.amount).toBe(25000);
  });

  it('legacy removeOverride call (no owner arg) targets primary records only', async () => {
    const initialDecisions: ScenarioDecisions = {
      withdrawalOverrides: [
        {
          field: 'rrsp',
          year: 2031,
          amount: 25000,
          applyForward: false,
          owner: 'primary',
        },
        {
          field: 'rrsp',
          year: 2031,
          amount: 15000,
          applyForward: false,
          owner: 'spouse',
        },
      ],
      spendingOverrides: [],
    };

    const { result } = renderHook(() =>
      useOverrideEditor({
        scenarioId: SCENARIO_ID,
        initialDecisions,
        onScenarioUpdated: vi.fn(),
      })
    );

    await act(async () => {
      // No owner arg — defaults to 'primary'
      await result.current.removeOverride('rrsp', 2031);
    });

    const body = findDecisionsBody();
    const records = (body.withdrawalOverrides ?? []).filter(
      (o) => o.field === 'rrsp' && o.year === 2031
    );
    expect(records).toHaveLength(1);
    expect(records[0]?.owner).toBe('spouse');
  });
});
