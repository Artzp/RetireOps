/**
 * ImpactPreview — the live "what-if" outcome card for the scenario edit page.
 *
 * Phase 31 Plan 01 (IMP-03): rendered below `<WithdrawalPlanSection>` on
 * `/profile/scenarios/[id]/edit`. Whenever the user mutates the working
 * `taxState` (drawdown order, RRSP meltdown flag, OAS clawback toggle,
 * bracket-fill settings, …), this component:
 *
 *  1. Debounces (300ms) the resulting `ScenarioDecisionsPatch` to avoid
 *     hammering the projection engine on every keystroke.
 *  2. Aborts any in-flight `POST /preview-decisions` request — latest-wins.
 *  3. Sends the patch through `previewScenarioDecisions()` (Plan 31-01 Task 1
 *     wrapper) and extracts the five headline metrics via
 *     `extractImpactMetrics()`.
 *  4. Renders a five-tile metric grid plus loading skeleton and an inline
 *     retry button on error.
 *
 * Key design notes:
 *  - The effect depends on `JSON.stringify(currentPatch)` rather than the
 *    object identity. Parent components re-build the patch on every render
 *    (it's a plain object literal sourced from `taxState`), so referential
 *    inequality alone would cause an infinite preview loop. The structural
 *    hash is cheap (decisions patches are small) and exact.
 *  - We never throw on extractor input — see `extractImpactMetrics` for the
 *    null-safe contract.
 *  - No new dependencies: debounce is plain `setTimeout` + cleanup, fetch
 *    cancellation is `AbortController`.
 *
 * @see .planning/phases/31-impact-preview/31-01-PLAN.md (Task 2)
 * @see .planning/phases/31-impact-preview/31-CONTEXT.md (locked metrics)
 * @see packages/web/src/lib/impact-metrics.ts
 * @see packages/web/src/lib/api/profile-scenarios-preview.ts
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { previewScenarioDecisions } from '@/lib/api/profile-scenarios-preview';
import {
  extractImpactMetrics,
  type ImpactMetrics,
  type ResultDataLike,
} from '@/lib/impact-metrics';
import type { ScenarioDecisionsPatch } from '@/types/profile-scenario';
import { formatCurrency } from '@/lib/utils';

export interface ImpactPreviewProps {
  scenarioId: string;
  currentPatch: ScenarioDecisionsPatch;
  /** Override for tests; defaults to 300ms (the locked Phase 31 value). */
  debounceMs?: number;
}

type Status = 'idle' | 'loading' | 'ready' | 'error';

const DEFAULT_DEBOUNCE_MS = 300;

/**
 * Format the depletion age cell. `null` (assets never deplete) renders as
 * "Never" rather than a raw em-dash — clearer in an outcomes-focused tile.
 */
function formatDepletionAge(age: number | null): string {
  if (age === null) return 'Never';
  return `Age ${String(age)}`;
}

export function ImpactPreview({
  scenarioId,
  currentPatch,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: ImpactPreviewProps): JSX.Element {
  const [metrics, setMetrics] = useState<ImpactMetrics | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  // `retryNonce` lets the user kick the effect on demand from the error tile
  // without changing the patch identity.
  const [retryNonce, setRetryNonce] = useState(0);

  // Track the active in-flight controller so an updated patch can abort the
  // prior request and the cleanup function can do the same on unmount.
  const activeControllerRef = useRef<AbortController | null>(null);

  // Use a structural key so referential differences from rebuilt object
  // literals don't cause an infinite re-fetch loop. Decisions patches are
  // small JSON, so the stringify cost is negligible.
  const patchKey = JSON.stringify(currentPatch);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;

      // Abort any prior request — latest-wins on rapid edits.
      activeControllerRef.current?.abort();
      const controller = new AbortController();
      activeControllerRef.current = controller;

      setStatus('loading');
      previewScenarioDecisions(scenarioId, currentPatch, { signal: controller.signal })
        .then((response) => {
          if (cancelled || controller.signal.aborted) return;
          const next = extractImpactMetrics(response.result_data as ResultDataLike);
          setMetrics(next);
          setStatus('ready');
        })
        .catch((err: unknown) => {
          // AbortError is the expected outcome of a superseded request;
          // ignore it and let the newer effect drive the UI state.
          if (controller.signal.aborted) return;
          if (cancelled) return;
          if (err instanceof Error && err.name === 'AbortError') return;
          setStatus('error');
        });
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [scenarioId, patchKey, retryNonce, debounceMs]);

  // Abort the active request on unmount to avoid setting state on a torn-down tree.
  useEffect(() => {
    return () => {
      activeControllerRef.current?.abort();
    };
  }, []);

  const handleRetry = (): void => {
    setRetryNonce((n) => n + 1);
  };

  return (
    <Card
      data-testid="impact-preview"
      data-status={status}
      // Busy until the first metrics land — covers the pre-debounce "idle"
      // window AND the in-flight "loading" window.
      aria-busy={metrics === null && status !== 'error'}
      className="bg-ds-surface rounded-card border-ds-outline-variant"
    >
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ds-on-surface">Impact preview</h2>
          {status === 'loading' && metrics !== null && (
            <span
              className="text-xs text-ds-on-surface-variant"
              data-testid="impact-preview-refresh-indicator"
              aria-live="polite"
            >
              Updating…
            </span>
          )}
        </div>

        {status === 'error' && metrics === null && <ImpactPreviewError onRetry={handleRetry} />}

        {status !== 'error' && metrics === null && <ImpactPreviewSkeleton />}

        {metrics !== null && (
          <>
            <div
              role="list"
              aria-label="Projected outcomes"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
              data-testid="impact-preview-metrics"
            >
              <MetricTile
                role="lifetime-tax"
                label="Lifetime tax"
                value={formatCurrency(metrics.lifetimeTax)}
              />
              <MetricTile
                role="depletion-age"
                label="Depletion age"
                value={formatDepletionAge(metrics.depletionAge)}
              />
              <MetricTile
                role="ending-estate"
                label="Ending estate"
                value={formatCurrency(metrics.endingEstate)}
              />
              <MetricTile
                role="oas-clawback"
                label="OAS clawback (total)"
                value={formatCurrency(metrics.oasClawback)}
              />
              <MetricTile
                role="after-tax-spending"
                label="Avg after-tax income"
                value={formatCurrency(metrics.afterTaxSpendingCovered)}
              />
            </div>
            {status === 'error' && (
              <div className="text-xs text-destructive flex items-center gap-2">
                <span>Couldn’t refresh the preview.</span>
                <Button variant="link" size="sm" className="h-auto p-0" onClick={handleRetry}>
                  Retry
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Five-cell skeleton matching the metric grid so the layout doesn't shift
 * when the first preview lands.
 */
function ImpactPreviewSkeleton(): JSX.Element {
  return (
    <div
      data-testid="impact-preview-skeleton"
      role="status"
      aria-label="Loading impact preview"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="bg-ds-surface-raised animate-pulse rounded-card h-20"
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

interface MetricTileProps {
  role: string;
  label: string;
  value: string;
}

function MetricTile({ role, label, value }: MetricTileProps): JSX.Element {
  return (
    <div
      role="listitem"
      data-metric={role}
      className="rounded-card border border-ds-outline-variant p-3 bg-ds-surface-raised"
    >
      <div className="text-xs text-ds-on-surface-variant">{label}</div>
      <div
        className="text-base font-semibold text-ds-on-surface mt-1"
        data-testid={`metric-${role}`}
      >
        {value}
      </div>
    </div>
  );
}

function ImpactPreviewError({ onRetry }: { onRetry: () => void }): JSX.Element {
  return (
    <div
      role="alert"
      data-testid="impact-preview-error"
      className="rounded-card border border-destructive/40 bg-destructive/10 p-4 text-sm flex items-center justify-between gap-3"
    >
      <p className="text-destructive">Couldn’t load the impact preview.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
