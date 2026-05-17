/**
 * Tests for PresetSelectorCard (Phase 28 base + Phase 31 Plan 02 — IMP-04).
 *
 * Coverage:
 *  - Renders the 5 non-custom presets in a radiogroup with the "Active" badge
 *    on the current preset (Phase 28 behavior — backward-compat baseline).
 *  - When `scenarioId` is OMITTED, no fetch fires (pre-31-02 zero-network
 *    behavior — the existing parent callers without an id in scope keep
 *    working).
 *  - When `scenarioId` is PROVIDED, fires 4 parallel `previewScenarioDecisions`
 *    calls on mount (one per non-equivalent preset: `preserveTfsaLongest`,
 *    `useTfsaEarlier`, `smoothRrspRrifBefore71`, `protectOas` — but NOT
 *    `taxEfficientDefault` which equals the engine baseline, and NOT `custom`
 *    which has no tuple).
 *  - Renders the inline metrics line ("Tax: $X • Estate: $Y") on each
 *    metrics-eligible card after the parallel fetch resolves.
 *  - Renders the loading placeholder (`Tax: — • Estate: —`) while pending.
 *  - The 'custom' status row only appears when currentPresetId === 'custom'.
 *
 * The `previewScenarioDecisions` API wrapper is mocked at the module boundary
 * so the test drives behavior from controlled promises without spinning up MSW.
 *
 * @see .planning/phases/31-impact-preview/31-02-PLAN.md (Task 1 acceptance)
 * @see packages/web/src/components/projection/withdrawal/PresetSelectorCard.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const previewMock = vi.fn();
vi.mock('@/lib/api/profile-scenarios-preview', () => ({
  previewScenarioDecisions: (...args: unknown[]) => previewMock(...args),
}));

import { PresetSelectorCard, __resetPresetMetricsCacheForTests } from '../PresetSelectorCard.js';

/**
 * A canned full preview response — the extractor reads
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
 * Flush microtasks queued by the Promise.all batch so React state updates
 * land before the assertion.
 */
async function flushPromises(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('PresetSelectorCard', () => {
  beforeEach(() => {
    previewMock.mockReset();
    __resetPresetMetricsCacheForTests();
  });

  describe('baseline (Phase 28 backward-compat)', () => {
    it('renders the 5 non-custom presets in a radiogroup', () => {
      render(<PresetSelectorCard currentPresetId="taxEfficientDefault" onSelect={() => {}} />);

      const grid = screen.getByTestId('preset-selector-grid');
      expect(grid).toBeInTheDocument();

      // 5 non-custom presets render as radio cards.
      for (const id of [
        'taxEfficientDefault',
        'preserveTfsaLongest',
        'useTfsaEarlier',
        'smoothRrspRrifBefore71',
        'protectOas',
      ]) {
        expect(grid.querySelector(`[data-preset-id="${id}"]`)).not.toBeNull();
      }
      // The custom status row is hidden when currentPresetId is not 'custom'.
      expect(screen.queryByTestId('preset-custom-indicator')).toBeNull();
    });

    it('marks only the current preset as Active', () => {
      render(<PresetSelectorCard currentPresetId="protectOas" onSelect={() => {}} />);

      const active = screen
        .getByTestId('preset-selector-grid')
        .querySelector('[data-active="true"]');
      expect(active?.getAttribute('data-preset-id')).toBe('protectOas');
    });

    it('renders the "Custom (your order)" indicator when currentPresetId === "custom"', () => {
      render(<PresetSelectorCard currentPresetId="custom" onSelect={() => {}} />);
      expect(screen.getByTestId('preset-custom-indicator')).toBeInTheDocument();
    });

    it('fires onSelect when a preset card is clicked', async () => {
      const onSelect = vi.fn();
      render(<PresetSelectorCard currentPresetId="taxEfficientDefault" onSelect={onSelect} />);

      await userEvent.click(
        screen
          .getByTestId('preset-selector-grid')
          .querySelector('[data-preset-id="preserveTfsaLongest"]') as Element
      );
      expect(onSelect).toHaveBeenCalledWith('preserveTfsaLongest');
    });
  });

  describe('without scenarioId (zero-network behavior)', () => {
    it('does NOT call previewScenarioDecisions when scenarioId is omitted', async () => {
      previewMock.mockResolvedValue(presetResponse(100, 200));

      render(<PresetSelectorCard currentPresetId="taxEfficientDefault" onSelect={() => {}} />);
      await flushPromises();

      expect(previewMock).not.toHaveBeenCalled();
      // No metrics line on any card.
      expect(screen.queryByTestId('preset-metrics-preserveTfsaLongest')).toBeNull();
    });
  });

  describe('with scenarioId (Phase 31 Plan 02 — IMP-04)', () => {
    it('fires 4 parallel previews on mount — one per non-baseline preset', async () => {
      previewMock.mockResolvedValue(presetResponse(100_000, 500_000));

      render(
        <PresetSelectorCard
          currentPresetId="taxEfficientDefault"
          onSelect={() => {}}
          scenarioId="scenario-1"
        />
      );
      await flushPromises();

      // 4 parallel calls — taxEfficientDefault (baseline) and custom are skipped.
      expect(previewMock).toHaveBeenCalledTimes(4);
      const calledIds = previewMock.mock.calls.map((args) => {
        const patch = (args as [string, { drawdownOrder?: string[] }, unknown])[1];
        return patch.drawdownOrder?.join(',');
      });
      // Each non-baseline preset's tuple was sent exactly once.
      expect(calledIds).toEqual(
        expect.arrayContaining([
          'rrsp,rrif,nonReg,tfsa', // preserveTfsaLongest
          'nonReg,tfsa,rrsp,rrif', // useTfsaEarlier
          'rrsp,rrif,nonReg,tfsa', // smoothRrspRrifBefore71 — same tuple, different flags
          'tfsa,nonReg,rrsp,rrif', // protectOas
        ])
      );
      // Each call carries the scenarioId and an AbortSignal.
      for (const args of previewMock.mock.calls) {
        const [id, , opts] = args as [string, unknown, { signal: AbortSignal }];
        expect(id).toBe('scenario-1');
        expect(opts.signal).toBeInstanceOf(AbortSignal);
      }
    });

    it('renders the inline metrics line ("Tax: ... • Estate: ...") after fetch resolves', async () => {
      // Distinct values per preset so we can assert specifc strings.
      previewMock.mockImplementation((_id: string, patch: { drawdownOrder?: string[] }) => {
        const tuple = patch.drawdownOrder?.join(',') ?? '';
        if (tuple === 'rrsp,rrif,nonReg,tfsa') {
          // preserveTfsaLongest OR smoothRrspRrifBefore71 — same tuple,
          // differentiated by flags but the test only needs one anchor.
          return Promise.resolve(presetResponse(150_000, 800_000));
        }
        if (tuple === 'nonReg,tfsa,rrsp,rrif') {
          return Promise.resolve(presetResponse(170_000, 750_000));
        }
        if (tuple === 'tfsa,nonReg,rrsp,rrif') {
          return Promise.resolve(presetResponse(140_000, 820_000));
        }
        return Promise.resolve(presetResponse(0, 0));
      });

      render(
        <PresetSelectorCard
          currentPresetId="taxEfficientDefault"
          onSelect={() => {}}
          scenarioId="scenario-2"
        />
      );
      await flushPromises();

      // Each non-baseline preset shows the metrics line with formatted currency.
      const preserveLine = screen.getByTestId('preset-metrics-preserveTfsaLongest');
      expect(preserveLine.textContent).toMatch(/Tax:.*150,?000/);
      expect(preserveLine.textContent).toMatch(/Estate:.*800,?000/);

      const tfsaEarlierLine = screen.getByTestId('preset-metrics-useTfsaEarlier');
      expect(tfsaEarlierLine.textContent).toMatch(/Tax:.*170,?000/);
      expect(tfsaEarlierLine.textContent).toMatch(/Estate:.*750,?000/);

      const protectOasLine = screen.getByTestId('preset-metrics-protectOas');
      expect(protectOasLine.textContent).toMatch(/Tax:.*140,?000/);
      expect(protectOasLine.textContent).toMatch(/Estate:.*820,?000/);

      // The baseline preset (taxEfficientDefault) gets no metrics line —
      // it's intentionally skipped because it equals the engine baseline.
      expect(screen.queryByTestId('preset-metrics-taxEfficientDefault')).toBeNull();

      // aria-busy clears once metrics land.
      expect(preserveLine.getAttribute('aria-busy')).toBe('false');
    });

    it('renders the loading placeholder while previews are pending', () => {
      // Promise that never resolves — keeps the component in "loading" forever.
      previewMock.mockReturnValue(new Promise(() => {}));

      render(
        <PresetSelectorCard
          currentPresetId="taxEfficientDefault"
          onSelect={() => {}}
          scenarioId="scenario-3"
        />
      );

      const line = screen.getByTestId('preset-metrics-preserveTfsaLongest');
      // Placeholder text uses em-dash sentinels.
      expect(line.textContent).toMatch(/Tax:\s*—/);
      expect(line.textContent).toMatch(/Estate:\s*—/);
      // aria-busy=true while pending.
      expect(line.getAttribute('aria-busy')).toBe('true');
    });
  });
});
