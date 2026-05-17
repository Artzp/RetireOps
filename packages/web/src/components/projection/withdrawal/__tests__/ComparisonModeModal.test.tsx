/**
 * Tests for ComparisonModeModal (Phase 32 Plan 01 — CMP-01..CMP-05).
 *
 * Coverage (locked acceptance from 32-01-PLAN.md):
 *  - Modal closed → renders nothing.
 *  - Modal open → renders preset checkboxes with the current preset locked-checked
 *    and `useTfsaEarlier` checked by default.
 *  - Selecting an additional preset adds a column to the metrics table and
 *    fires a new parallel batch (latest-wins).
 *  - Mock fetch → table shows formatted currency metrics.
 *  - Stable refs (Pitfall 5): rerendering with the same props and selection
 *    does NOT trigger another fetch — the effect's structural hash matches.
 *  - Loading state: shows skeleton placeholders before the promise resolves.
 *
 * The `previewScenarioDecisions` API wrapper is mocked at the module boundary
 * so the test drives behavior from controlled promises without spinning up MSW.
 * Fake timers handle the 300ms debounce.
 *
 * @see .planning/phases/32-comparison-mode/32-01-PLAN.md (Task 1 acceptance)
 * @see packages/web/src/components/projection/withdrawal/ComparisonModeModal.tsx
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

const previewMock = vi.fn();
vi.mock('@/lib/api/profile-scenarios-preview', () => ({
  previewScenarioDecisions: (...args: unknown[]) => previewMock(...args),
}));

import { ComparisonModeModal } from '../ComparisonModeModal.js';

/**
 * Canned full preview response — the extractor reads
 * `summary.totalTaxesPaid` for Tax and the last
 * `yearlyResults[].householdNetWorth` for Estate.
 */
function presetResponse(
  tax: number,
  estate: number
): {
  decisions: Record<string, unknown>;
  result_data: Record<string, unknown>;
} {
  return {
    decisions: {},
    result_data: {
      summary: { totalTaxesPaid: tax, averageRetirementIncome: 60_000 },
      yearlyResults: [
        { age: 65, householdNetWorth: 1_000_000, oasClawback: 0, spouseOasClawback: 0 },
        { age: 95, householdNetWorth: estate, oasClawback: 0, spouseOasClawback: 0 },
      ],
    },
  };
}

/**
 * Advance fake timers past the 300ms debounce and flush microtasks queued by
 * the Promise.all batch so React state updates land before the assertion.
 */
async function tick(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    // Two micro-flushes cover the Promise.all → setState chain.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

/**
 * A snapshot that resolves to `preserveTfsaLongest` so the current-preset
 * column is a real preset (not 'custom'). The drawdownOrder matches the
 * tuple from WEB_WITHDRAWAL_PRESETS[1].
 */
const PRESERVE_TFSA_SNAPSHOT: Record<string, unknown> = {
  drawdownOrder: ['rrsp', 'rrif', 'nonReg', 'tfsa'],
  rrspMeltdown: { enabled: false, annualAmount: 0, startYear: 2025, endYear: 2030 },
  incomeSplitting: { enabled: false, splitPercent: 50 },
  oasClawbackAvoidance: { enabled: false, incomeThreshold: 90000 },
  bracketFill: { enabled: false, bracketTarget: 'current' as const, annualCap: undefined },
};

/**
 * A custom snapshot whose drawdownOrder doesn't match any preset tuple, so
 * `resolvePresetIdFromOrder` returns 'custom'. This exercises the synthetic
 * "Current (custom)" column path.
 */
const CUSTOM_SNAPSHOT: Record<string, unknown> = {
  drawdownOrder: ['rrsp', 'tfsa', 'nonReg', 'rrif'], // not a preset tuple
  rrspMeltdown: { enabled: false, annualAmount: 0, startYear: 2025, endYear: 2030 },
  incomeSplitting: { enabled: false, splitPercent: 50 },
  oasClawbackAvoidance: { enabled: false, incomeThreshold: 90000 },
  bracketFill: { enabled: false, bracketTarget: 'current' as const, annualCap: undefined },
};

describe('ComparisonModeModal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    previewMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when open=false', () => {
    previewMock.mockResolvedValue(presetResponse(0, 0));

    const { container } = render(
      <ComparisonModeModal
        open={false}
        onOpenChange={() => {}}
        scenarioId="s-1"
        baseDecisionsSnapshot={PRESERVE_TFSA_SNAPSHOT}
      />
    );

    // The modal short-circuits before mounting the Dialog at all.
    expect(container.querySelector('[data-testid="comparison-mode-modal"]')).toBeNull();
    expect(container.querySelector('[data-testid="comparison-preset-checkboxes"]')).toBeNull();
    // And it must NOT have fired any preview requests pre-open.
    expect(previewMock).not.toHaveBeenCalled();
  });

  it('renders preset checkboxes with current preset locked + useTfsaEarlier checked by default', async () => {
    previewMock.mockResolvedValue(presetResponse(100_000, 500_000));

    render(
      <ComparisonModeModal
        open={true}
        onOpenChange={() => {}}
        scenarioId="s-1"
        baseDecisionsSnapshot={PRESERVE_TFSA_SNAPSHOT}
      />
    );

    // Flush the debounce so we don't leave an in-flight timer around for the
    // assertions on checkbox state.
    await tick(310);

    // Modal mounts.
    expect(screen.getByTestId('comparison-mode-modal')).toBeInTheDocument();

    // Phase 34-02 reduced SKIP_PRESETS to {custom} only. All 5 user-selectable
    // presets — including taxEfficientDefault — render as checkboxes.
    const fieldset = screen.getByTestId('comparison-preset-checkboxes');
    for (const id of [
      'taxEfficientDefault',
      'preserveTfsaLongest',
      'useTfsaEarlier',
      'smoothRrspRrifBefore71',
      'protectOas',
    ]) {
      expect(fieldset.querySelector(`label[data-preset-id="${id}"]`)).not.toBeNull();
    }

    // 'custom' is the only preset still skipped.
    expect(fieldset.querySelector('label[data-preset-id="custom"]')).toBeNull();

    // The current preset (preserveTfsaLongest from snapshot) is checked AND disabled.
    const preserveCheckbox = document.getElementById('cmp-preset-preserveTfsaLongest');
    expect(preserveCheckbox).not.toBeNull();
    expect(preserveCheckbox?.getAttribute('data-state')).toBe('checked');
    expect(preserveCheckbox?.getAttribute('disabled')).not.toBeNull();

    // useTfsaEarlier is checked by default (deterministic alternate per plan).
    const useTfsaEarlierCheckbox = document.getElementById('cmp-preset-useTfsaEarlier');
    expect(useTfsaEarlierCheckbox?.getAttribute('data-state')).toBe('checked');
    // ...but not disabled — the user can uncheck it.
    expect(useTfsaEarlierCheckbox?.getAttribute('disabled')).toBeNull();

    // smoothRrspRrifBefore71 / protectOas are NOT checked by default.
    expect(
      document.getElementById('cmp-preset-smoothRrspRrifBefore71')?.getAttribute('data-state')
    ).toBe('unchecked');
    expect(document.getElementById('cmp-preset-protectOas')?.getAttribute('data-state')).toBe(
      'unchecked'
    );
  });

  it('fires parallel previews and renders formatted metrics in the table', async () => {
    // Distinct responses per drawdown tuple so we can assert specific cells.
    previewMock.mockImplementation((_id: string, patch: { drawdownOrder?: string[] }) => {
      const tuple = patch.drawdownOrder?.join(',') ?? '';
      if (tuple === 'rrsp,rrif,nonReg,tfsa') {
        return Promise.resolve(presetResponse(150_000, 800_000)); // preserveTfsaLongest (current)
      }
      if (tuple === 'nonReg,tfsa,rrsp,rrif') {
        return Promise.resolve(presetResponse(170_000, 750_000)); // useTfsaEarlier
      }
      return Promise.resolve(presetResponse(0, 0));
    });

    render(
      <ComparisonModeModal
        open={true}
        onOpenChange={() => {}}
        scenarioId="s-1"
        baseDecisionsSnapshot={PRESERVE_TFSA_SNAPSHOT}
      />
    );

    await tick(310);

    // 2 parallel calls (preserveTfsaLongest + useTfsaEarlier).
    expect(previewMock).toHaveBeenCalledTimes(2);

    // Each call carries the scenarioId and an AbortSignal.
    for (const args of previewMock.mock.calls) {
      const [id, , opts] = args as [string, unknown, { signal: AbortSignal }];
      expect(id).toBe('s-1');
      expect(opts.signal).toBeInstanceOf(AbortSignal);
    }

    // The metrics table has columns for both selected presets.
    const table = screen.getByTestId('comparison-metrics-table');
    expect(table.querySelector('[data-column-id="preserveTfsaLongest"]')).not.toBeNull();
    expect(table.querySelector('[data-column-id="useTfsaEarlier"]')).not.toBeNull();

    // Lifetime tax cells render formatted currency from the canned response.
    const preserveTaxCell = table.querySelector(
      'td[data-column-id="preserveTfsaLongest"][data-metric="lifetime-tax"]'
    );
    expect(preserveTaxCell?.textContent).toMatch(/150,?000/);
    const useTfsaTaxCell = table.querySelector(
      'td[data-column-id="useTfsaEarlier"][data-metric="lifetime-tax"]'
    );
    expect(useTfsaTaxCell?.textContent).toMatch(/170,?000/);

    // Ending estate cells likewise.
    const preserveEstateCell = table.querySelector(
      'td[data-column-id="preserveTfsaLongest"][data-metric="ending-estate"]'
    );
    expect(preserveEstateCell?.textContent).toMatch(/800,?000/);

    // Depletion-age cell renders "Never" when householdNetWorth stays positive.
    const preserveDepletionCell = table.querySelector(
      'td[data-column-id="preserveTfsaLongest"][data-metric="depletion-age"]'
    );
    expect(preserveDepletionCell?.textContent).toBe('Never');

    // Once metrics land, the per-cell aria-busy clears.
    expect(preserveTaxCell?.getAttribute('aria-busy')).toBe('false');
  });

  it('shows skeleton placeholders while the parallel batch is pending', () => {
    // Promise that never resolves — keeps the batch in flight forever.
    previewMock.mockReturnValue(new Promise(() => {}));

    render(
      <ComparisonModeModal
        open={true}
        onOpenChange={() => {}}
        scenarioId="s-1"
        baseDecisionsSnapshot={PRESERVE_TFSA_SNAPSHOT}
      />
    );

    // Advance the debounce so the fetch kicks off — but the promise never
    // settles, so cells stay in skeleton state.
    act(() => {
      vi.advanceTimersByTime(310);
    });

    const table = screen.getByTestId('comparison-metrics-table');
    const preserveTaxCell = table.querySelector(
      'td[data-column-id="preserveTfsaLongest"][data-metric="lifetime-tax"]'
    );
    // aria-busy=true means the cell is showing the skeleton placeholder.
    expect(preserveTaxCell?.getAttribute('aria-busy')).toBe('true');
    // And the skeleton span is rendered inside (no formatted text yet).
    expect(preserveTaxCell?.querySelector('.animate-pulse')).not.toBeNull();
    expect(preserveTaxCell?.textContent ?? '').not.toMatch(/\d/);
  });

  it('adds a new column and fires a new batch when the user selects an additional preset', async () => {
    previewMock.mockResolvedValue(presetResponse(100_000, 500_000));

    render(
      <ComparisonModeModal
        open={true}
        onOpenChange={() => {}}
        scenarioId="s-1"
        baseDecisionsSnapshot={PRESERVE_TFSA_SNAPSHOT}
      />
    );

    // First batch: 2 calls (current + useTfsaEarlier).
    await tick(310);
    expect(previewMock).toHaveBeenCalledTimes(2);

    // User checks protectOas — the checkbox uses Radix's button[role=checkbox].
    const protectOasBtn = document.getElementById('cmp-preset-protectOas');
    expect(protectOasBtn).not.toBeNull();
    act(() => {
      (protectOasBtn as HTMLButtonElement).click();
    });

    // Debounce + flush — a new batch with 3 calls fires.
    await tick(310);
    expect(previewMock).toHaveBeenCalledTimes(2 + 3);

    // The table now has 3 columns.
    const table = screen.getByTestId('comparison-metrics-table');
    expect(table.querySelector('[data-column-id="preserveTfsaLongest"]')).not.toBeNull();
    expect(table.querySelector('[data-column-id="useTfsaEarlier"]')).not.toBeNull();
    expect(table.querySelector('[data-column-id="protectOas"]')).not.toBeNull();
  });

  it('does NOT re-fetch on a rerender with identical props (Pitfall 5: stable refs)', async () => {
    previewMock.mockResolvedValue(presetResponse(100_000, 500_000));

    const { rerender } = render(
      <ComparisonModeModal
        open={true}
        onOpenChange={() => {}}
        scenarioId="s-1"
        baseDecisionsSnapshot={PRESERVE_TFSA_SNAPSHOT}
      />
    );

    await tick(310);
    const callsAfterFirstBatch = previewMock.mock.calls.length;
    expect(callsAfterFirstBatch).toBe(2);

    // Rerender with the SAME prop references — the caller uses useRef so the
    // snapshot identity doesn't change. The memoized columns dep (selectedKey)
    // is the same primitive string, so the effect should NOT re-run.
    rerender(
      <ComparisonModeModal
        open={true}
        onOpenChange={() => {}}
        scenarioId="s-1"
        baseDecisionsSnapshot={PRESERVE_TFSA_SNAPSHOT}
      />
    );
    await tick(310);

    // No new calls fired — Pitfall 5 mitigation verified.
    expect(previewMock.mock.calls.length).toBe(callsAfterFirstBatch);
  });

  it('synthesizes a "Current (custom)" column when the snapshot resolves to custom', async () => {
    previewMock.mockResolvedValue(presetResponse(180_000, 600_000));

    render(
      <ComparisonModeModal
        open={true}
        onOpenChange={() => {}}
        scenarioId="s-1"
        baseDecisionsSnapshot={CUSTOM_SNAPSHOT}
      />
    );
    await tick(310);

    // The locked "current" row uses the synthetic 'custom' id.
    const customLabel = document.querySelector('label[data-preset-id="custom"]');
    expect(customLabel).not.toBeNull();
    expect(customLabel?.textContent).toMatch(/Current \(custom\)/);

    // The current checkbox is locked-checked.
    const currentCheckbox = document.getElementById('cmp-preset-current');
    expect(currentCheckbox?.getAttribute('data-state')).toBe('checked');
    expect(currentCheckbox?.getAttribute('disabled')).not.toBeNull();

    // The metrics table renders a column for the custom current state alongside useTfsaEarlier.
    const table = screen.getByTestId('comparison-metrics-table');
    expect(table.querySelector('th[data-column-id="custom"]')).not.toBeNull();
    expect(table.querySelector('th[data-column-id="useTfsaEarlier"]')).not.toBeNull();

    // The snapshot's patch was sent for the current column — verify by inspecting
    // the call that used the custom drawdownOrder.
    const calls = previewMock.mock.calls as Array<[string, { drawdownOrder?: string[] }, unknown]>;
    const customCall = calls.find((c) => c[1].drawdownOrder?.join(',') === 'rrsp,tfsa,nonReg,rrif');
    expect(customCall).toBeDefined();
  });
});
