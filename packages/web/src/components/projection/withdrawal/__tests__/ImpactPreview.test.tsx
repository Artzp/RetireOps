/**
 * Tests for ImpactPreview (Phase 31 Plan 01 Task 2).
 *
 * Covers the four locked behaviors from the plan:
 *   1. Renders the skeleton initially while the debounced first preview is pending.
 *   2. Renders the five metric tiles after the mock fetch resolves.
 *   3. Re-fetches when the `currentPatch` prop changes (debounced).
 *   4. Renders the error tile when the API rejects.
 *
 * The `previewScenarioDecisions` API wrapper is mocked at the module boundary
 * so we can drive the test from controlled promises without spinning up MSW.
 *
 * @see .planning/phases/31-impact-preview/31-01-PLAN.md (Task 2 acceptance)
 * @see packages/web/src/components/projection/withdrawal/ImpactPreview.tsx
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

const previewMock = vi.fn();
vi.mock('@/lib/api/profile-scenarios-preview', () => ({
  previewScenarioDecisions: (...args: unknown[]) => previewMock(...args),
}));

import { ImpactPreview } from '../ImpactPreview.js';

// A small helper to fast-forward debounce + flush settled promises in one breath.
async function tick(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    // Flush any microtasks scheduled by the fetch.then chain.
    await Promise.resolve();
    await Promise.resolve();
  });
}

const fullResult = {
  decisions: {},
  result_data: {
    summary: {
      totalTaxesPaid: 250_000,
      averageRetirementIncome: 75_000,
    },
    yearlyResults: [
      { age: 65, householdNetWorth: 1_000_000, oasClawback: 0, spouseOasClawback: 0 },
      { age: 95, householdNetWorth: 100_000, oasClawback: 2_000, spouseOasClawback: 500 },
    ],
  },
};

describe('ImpactPreview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    previewMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the skeleton while the first debounced preview is pending', () => {
    // Promise that never resolves — keeps the component in "loading" forever.
    previewMock.mockReturnValue(new Promise(() => {}));

    render(<ImpactPreview scenarioId="abc" currentPatch={{ drawdownOrder: ['rrsp'] }} />);

    expect(screen.getByTestId('impact-preview-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('impact-preview-metrics')).toBeNull();
    // Card is busy until the first preview lands.
    expect(screen.getByTestId('impact-preview').getAttribute('aria-busy')).toBe('true');
  });

  it('renders the five metric tiles after the API resolves', async () => {
    previewMock.mockResolvedValue(fullResult);

    render(<ImpactPreview scenarioId="abc" currentPatch={{ drawdownOrder: ['rrsp'] }} />);

    // Debounce window (300ms) + microtask flush.
    await tick(310);

    expect(screen.getByTestId('impact-preview-metrics')).toBeInTheDocument();
    expect(screen.queryByTestId('impact-preview-skeleton')).toBeNull();

    // All five tiles render with their formatted values.
    expect(screen.getByTestId('metric-lifetime-tax').textContent).toMatch(/250,?000/);
    expect(screen.getByTestId('metric-depletion-age').textContent).toBe('Never');
    expect(screen.getByTestId('metric-ending-estate').textContent).toMatch(/100,?000/);
    expect(screen.getByTestId('metric-oas-clawback').textContent).toMatch(/2,?500/);
    expect(screen.getByTestId('metric-after-tax-spending').textContent).toMatch(/75,?000/);

    // Once metrics land, aria-busy should clear.
    expect(screen.getByTestId('impact-preview').getAttribute('aria-busy')).toBe('false');
    // Endpoint was called exactly once with the patch.
    expect(previewMock).toHaveBeenCalledTimes(1);
    expect(previewMock).toHaveBeenCalledWith(
      'abc',
      { drawdownOrder: ['rrsp'] },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('re-fetches when currentPatch changes (debounced)', async () => {
    previewMock.mockResolvedValue(fullResult);

    const { rerender } = render(
      <ImpactPreview scenarioId="abc" currentPatch={{ drawdownOrder: ['rrsp'] }} />
    );
    await tick(310);
    expect(previewMock).toHaveBeenCalledTimes(1);

    // Change the patch — the structural hash differs, so the effect re-runs.
    rerender(<ImpactPreview scenarioId="abc" currentPatch={{ drawdownOrder: ['tfsa'] }} />);
    await tick(310);

    expect(previewMock).toHaveBeenCalledTimes(2);
    const secondCall = previewMock.mock.calls[1] as [string, unknown, unknown];
    expect(secondCall[0]).toBe('abc');
    expect(secondCall[1]).toEqual({ drawdownOrder: ['tfsa'] });
  });

  it('does NOT re-fetch when an object-identity change has the same structural patch', async () => {
    previewMock.mockResolvedValue(fullResult);

    const { rerender } = render(
      <ImpactPreview scenarioId="abc" currentPatch={{ drawdownOrder: ['rrsp'] }} />
    );
    await tick(310);
    expect(previewMock).toHaveBeenCalledTimes(1);

    // New object, same JSON — the effect MUST NOT re-fire (Pitfall: parent
    // rebuilds the patch literal on every render).
    rerender(<ImpactPreview scenarioId="abc" currentPatch={{ drawdownOrder: ['rrsp'] }} />);
    await tick(310);

    expect(previewMock).toHaveBeenCalledTimes(1);
  });

  it('renders the error state on a rejected promise', async () => {
    previewMock.mockRejectedValue(new Error('boom'));

    render(<ImpactPreview scenarioId="abc" currentPatch={{ drawdownOrder: ['rrsp'] }} />);
    await tick(310);

    expect(screen.getByTestId('impact-preview-error')).toBeInTheDocument();
    expect(screen.queryByTestId('impact-preview-metrics')).toBeNull();
    expect(screen.getByTestId('impact-preview').getAttribute('data-status')).toBe('error');
  });
});
