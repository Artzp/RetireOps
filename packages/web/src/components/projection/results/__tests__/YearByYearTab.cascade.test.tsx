/**
 * RED component tests for YearByYearTab cascade behavior.
 *
 * These tests MUST FAIL until Plan 03-04 adds:
 * - previousRowsRef (useRef<ProjectionYearRow[] | null>) to YearByYearTab
 * - highlightedCells Map<string, true> state
 * - data-cascade-highlight="true" attribute on changed <td> cells
 * - 5-second clear timer using fake-timer-compatible setTimeout
 *
 * The `data-cascade-highlight` attribute does NOT exist on any <td> yet.
 * All tests that assert it will fail RED.
 *
 * Decision refs: D-55, D-57, D-58, D-59, D-60, D-61, D-75, D-76, D-77
 * @see .planning/phases/03-cascade-undo/03-CONTEXT.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { YearByYearTab } from '../YearByYearTab';
import type { ProjectionYearRow, ScenarioDecisions } from '@retireops/shared';
import type { ProfileScenarioDetail } from '@/types/profile-scenario';

// ---------------------------------------------------------------------------
// Mock useOverrideEditor — capture the onBeforeSave + onScenarioUpdated callbacks
// that YearByYearTab passes into the hook. Expose test-only trigger helpers.
// ---------------------------------------------------------------------------

let _capturedOnBeforeSave: (() => void) | undefined;
let _capturedOnScenarioUpdated: ((updated: ProfileScenarioDetail) => void) | undefined;

vi.mock('@/hooks/useOverrideEditor', () => {
  return {
    useOverrideEditor: vi.fn(
      (args: {
        onBeforeSave?: () => void;
        onScenarioUpdated?: (updated: ProfileScenarioDetail) => void;
      }) => {
        // Capture the callbacks that YearByYearTab registers
        _capturedOnBeforeSave = args.onBeforeSave;
        _capturedOnScenarioUpdated = args.onScenarioUpdated;
        return {
          openCell: null,
          openPopover: vi.fn(),
          setOpenCell: vi.fn(),
          closePopover: vi.fn(),
          savePopover: vi.fn().mockResolvedValue(undefined),
          getActiveWithdrawalOverride: vi.fn().mockReturnValue(undefined),
          getActiveSpendingOverride: vi.fn().mockReturnValue(undefined),
          isRecomputing: false,
          decisions: {},
          // Phase 3 additions (not yet present — RED)
          removeOverride: vi.fn().mockResolvedValue(undefined),
          isRemoving: false,
        };
      }
    ),
    isEditableField: (f: string) =>
      ['rrsp', 'rrif', 'lif', 'tfsa', 'nonreg', 'spending'].includes(f),
  };
});

// ---------------------------------------------------------------------------
// Row factory
// ---------------------------------------------------------------------------

function makeRow(year: number, overrides: Partial<ProjectionYearRow> = {}): ProjectionYearRow {
  return {
    year,
    age: 65 + (year - 2031),
    employmentIncome: 0,
    pensionIncome: 0,
    cppIncome: 0,
    oasIncome: 0,
    rrifWithdrawal: 0,
    tfsaWithdrawal: 0,
    nonRegWithdrawal: 0,
    totalGrossIncome: 0,
    federalTax: 0,
    provincialTax: 0,
    oasClawback: 0,
    totalTax: 0,
    effectiveTaxRate: 0,
    livingExpenses: 50000,
    netCashFlow: 0,
    householdNetCashFlow: 0,
    rrspBalance: 0,
    rrifBalance: 0,
    tfsaBalance: 0,
    nonRegBalance: 0,
    totalNetWorth: 0,
    householdNetWorth: 0,
    ...overrides,
  } as ProjectionYearRow;
}

/** Build a minimal ProfileScenarioDetail with the given projectionRows. */
function makeScenarioDetail(rows: ProjectionYearRow[]): ProfileScenarioDetail {
  return {
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
      projectionRows: rows,
    },
  };
}

// ---------------------------------------------------------------------------
// Shared props
// ---------------------------------------------------------------------------

const INITIAL_DECISIONS: ScenarioDecisions = {};
const SCENARIO_ID = 'test-scenario-id';

function renderTab(rows: ProjectionYearRow[]) {
  const onScenarioUpdated = vi.fn();
  return render(
    <YearByYearTab
      data={{ projectionRows: rows }}
      scenarioId={SCENARIO_ID}
      initialDecisions={INITIAL_DECISIONS}
      onScenarioUpdated={onScenarioUpdated}
    />
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('YearByYearTab cascade', () => {
  beforeEach(() => {
    _capturedOnBeforeSave = undefined;
    _capturedOnScenarioUpdated = undefined;
    vi.useRealTimers();
  });

  it('no <td> has data-cascade-highlight initially', () => {
    const rows = [makeRow(2031), makeRow(2032)];
    const { container } = renderTab(rows);
    const highlighted = container.querySelectorAll('td[data-cascade-highlight]');
    expect(highlighted.length).toBe(0);
  });

  it('onScenarioUpdated invocation populates data-cascade-highlight on changed cells', async () => {
    vi.useFakeTimers();
    const initialRows = [makeRow(2031, { rrifWithdrawal: 10000 })];
    const { container } = renderTab(initialRows);

    // Capture snapshot before the save
    act(() => {
      _capturedOnBeforeSave?.();
    });

    // Updated rows have rrifWithdrawal changed (from $10,000 to $20,000 → different formatted value)
    const updatedRows = [makeRow(2031, { rrifWithdrawal: 20000 })];
    const updatedDetail = makeScenarioDetail(updatedRows);

    await act(async () => {
      _capturedOnScenarioUpdated?.(updatedDetail);
    });

    // The year-2031 rrifWithdrawal cell should now have data-cascade-highlight="true"
    // RED: YearByYearTab does not yet emit this attribute
    const highlightedCells = container.querySelectorAll('td[data-cascade-highlight="true"]');
    expect(highlightedCells.length).toBeGreaterThanOrEqual(1);

    vi.useRealTimers();
  });

  it('unchanged cells do NOT have data-cascade-highlight', async () => {
    vi.useFakeTimers();
    const initialRows = [makeRow(2031, { rrifWithdrawal: 10000, tfsaWithdrawal: 5000 })];
    const { container } = renderTab(initialRows);

    act(() => {
      _capturedOnBeforeSave?.();
    });

    // Only rrifWithdrawal changed; tfsaWithdrawal stays the same
    const updatedRows = [makeRow(2031, { rrifWithdrawal: 20000, tfsaWithdrawal: 5000 })];
    await act(async () => {
      _capturedOnScenarioUpdated?.(makeScenarioDetail(updatedRows));
    });

    // Get all highlighted cells
    const highlightedCells = Array.from(
      container.querySelectorAll('td[data-cascade-highlight="true"]')
    );
    // The tfsaWithdrawal cell for year 2031 should NOT be highlighted
    // (We check no cell contains the unchanged value in a highlighted td)
    const tfsaHighlighted = highlightedCells.some(
      (td) => td.getAttribute('data-column-key') === 'tfsaWithdrawal'
    );
    expect(tfsaHighlighted).toBe(false);

    vi.useRealTimers();
  });

  it('fake-timer advance of 5000ms clears the highlight (D-57)', async () => {
    vi.useFakeTimers();
    const initialRows = [makeRow(2031, { rrifWithdrawal: 10000 })];
    const { container } = renderTab(initialRows);

    act(() => {
      _capturedOnBeforeSave?.();
    });

    const updatedRows = [makeRow(2031, { rrifWithdrawal: 20000 })];
    await act(async () => {
      _capturedOnScenarioUpdated?.(makeScenarioDetail(updatedRows));
    });

    // Advance 5 seconds — highlight should clear
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    const highlighted = container.querySelectorAll('td[data-cascade-highlight="true"]');
    expect(highlighted.length).toBe(0);

    vi.useRealTimers();
  });

  it('new save dispatch clears prior timer (D-57)', async () => {
    vi.useFakeTimers();
    const initialRows = [makeRow(2031, { rrifWithdrawal: 10000 })];
    const { container } = renderTab(initialRows);

    // First save — cascade A
    act(() => {
      _capturedOnBeforeSave?.();
    });
    const updatedRowsA = [makeRow(2031, { rrifWithdrawal: 20000 })];
    await act(async () => {
      _capturedOnScenarioUpdated?.(makeScenarioDetail(updatedRowsA));
    });

    // Advance 2 seconds (within 5s window)
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Second save — capture new snapshot + new cascade B
    act(() => {
      _capturedOnBeforeSave?.();
    });
    const updatedRowsB = [makeRow(2031, { rrifWithdrawal: 30000 })];
    await act(async () => {
      _capturedOnScenarioUpdated?.(makeScenarioDetail(updatedRowsB));
    });

    // Advance another 3s (total 5s from first save = timer A would have expired,
    // but timer B is still active at 3s so highlights from B remain)
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // At this point the second cascade's cells should still be highlighted (< 5s for timer B)
    // Cascade A cells (if different from B) should NOT still be highlighted because B replaced them
    const highlighted = container.querySelectorAll('td[data-cascade-highlight="true"]');
    // B cascade should be active; A cascade should be superseded
    expect(highlighted.length).toBeGreaterThanOrEqual(1);

    vi.useRealTimers();
  });

  it('row in only one snapshot is not highlighted (D-60)', async () => {
    vi.useFakeTimers();
    // Initial rows have years 2030 and 2031
    const initialRows = [
      makeRow(2030, { rrifWithdrawal: 5000 }),
      makeRow(2031, { rrifWithdrawal: 10000 }),
    ];
    const { container } = renderTab(initialRows);

    act(() => {
      _capturedOnBeforeSave?.();
    });

    // Updated rows have only year 2031 (year 2030 absent — e.g., post-death scenario change)
    const updatedRows = [makeRow(2031, { rrifWithdrawal: 20000 })];
    await act(async () => {
      _capturedOnScenarioUpdated?.(makeScenarioDetail(updatedRows));
    });

    // No cell for year 2030 should be highlighted (it's only in prev, not in both)
    const allHighlighted = Array.from(
      container.querySelectorAll('td[data-cascade-highlight="true"]')
    );
    const year2030Highlighted = allHighlighted.some(
      (td) => td.getAttribute('data-year') === '2030'
    );
    expect(year2030Highlighted).toBe(false);

    vi.useRealTimers();
  });

  it('previousRowsRef cleared after diff (D-58/D-77) — second cold onScenarioUpdated does not highlight', async () => {
    vi.useFakeTimers();
    const initialRows = [makeRow(2031, { rrifWithdrawal: 10000 })];
    const { container } = renderTab(initialRows);

    // First cycle: capture snapshot + apply diff
    act(() => {
      _capturedOnBeforeSave?.();
    });
    const updatedRowsFirst = [makeRow(2031, { rrifWithdrawal: 20000 })];
    await act(async () => {
      _capturedOnScenarioUpdated?.(makeScenarioDetail(updatedRowsFirst));
    });

    // Clear the first highlight timer to not interfere
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Second onScenarioUpdated WITHOUT a prior onBeforeSave (snapshot consumed, not re-captured)
    const updatedRowsSecond = [makeRow(2031, { rrifWithdrawal: 30000 })];
    await act(async () => {
      _capturedOnScenarioUpdated?.(makeScenarioDetail(updatedRowsSecond));
    });

    // No highlight — no snapshot was captured for this second update
    const highlighted = container.querySelectorAll('td[data-cascade-highlight="true"]');
    expect(highlighted.length).toBe(0);

    vi.useRealTimers();
  });

  it('failed /run (no onScenarioUpdated fired) keeps snapshot (D-59)', async () => {
    vi.useFakeTimers();
    const initialRows = [makeRow(2031, { rrifWithdrawal: 10000 })];
    const { container } = renderTab(initialRows);

    // First onBeforeSave — snapshot captured of initialRows (rrifWithdrawal: 10000)
    act(() => {
      _capturedOnBeforeSave?.();
    });
    // Simulate /run failure — onScenarioUpdated NOT called

    // Second save — capture a new snapshot (now the rendered rows still show 10000)
    act(() => {
      _capturedOnBeforeSave?.();
    });

    // Second onScenarioUpdated fires with rrifWithdrawal: 25000
    const updatedRowsSecond = [makeRow(2031, { rrifWithdrawal: 25000 })];
    await act(async () => {
      _capturedOnScenarioUpdated?.(makeScenarioDetail(updatedRowsSecond));
    });

    // Should detect diff between snapshot (10000) and new rows (25000) — highlight present
    // This confirms D-59: failed run did not discard the snapshot; next save uses a fresh one
    const highlighted = container.querySelectorAll('td[data-cascade-highlight="true"]');
    expect(highlighted.length).toBeGreaterThanOrEqual(1);

    vi.useRealTimers();
  });

  it('onScenarioUpdated WITHOUT a prior onBeforeSave does nothing', async () => {
    const initialRows = [makeRow(2031, { rrifWithdrawal: 10000 })];
    const { container } = renderTab(initialRows);

    // Fire onScenarioUpdated cold — no snapshot captured
    const updatedRows = [makeRow(2031, { rrifWithdrawal: 20000 })];
    await act(async () => {
      _capturedOnScenarioUpdated?.(makeScenarioDetail(updatedRows));
    });

    // No highlights — no snapshot was captured
    const highlighted = container.querySelectorAll('td[data-cascade-highlight="true"]');
    expect(highlighted.length).toBe(0);
  });
});
