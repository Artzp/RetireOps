/**
 * PresetSelectorCard — preset picker rendered ABOVE the WithdrawalPlanSection.
 *
 * Renders the 5 non-custom presets as clickable cards in a 2x3 grid (sm:grid-cols-2,
 * lg:grid-cols-3 on wide viewports). Each card shows:
 *  - preset name
 *  - 1-line description (WD-UI-06)
 *  - account-order summary (WD-UI-06 locally-computable static metric)
 *  - per-preset impact metrics line (Phase 31 Plan 02 — IMP-04) when
 *    `scenarioId` is provided
 *  - "Active" badge when this is the currentPresetId
 *
 * The "custom" preset is rendered as a status row at the bottom labeled
 * "Custom (your order)" — clicking it does nothing (the row has no onClick).
 * It appears active when currentPresetId === 'custom'.
 *
 * Per PRESET-05 (locked Phase 27): selecting a non-custom preset when the
 * user already customized their order should trigger a confirm dialog.
 * That gating logic lives in the parent (Plan 28-03 — page.tsx integration).
 * This component just calls onSelect(id) — the parent decides whether to show
 * the dialog before applying the preset.
 *
 * Phase 31 Plan 02 (IMP-04): when `scenarioId` is provided we fire 4 parallel
 * `previewScenarioDecisions` calls (one per non-equivalent preset — skipping
 * `taxEfficientDefault` which equals the engine baseline, and `custom` which
 * has no tuple) and render two top-line metrics (`Tax`, `Estate`) inline on
 * each card. Skipping the baseline avoids paying for an identical projection;
 * skipping `custom` is correct because it has no preset tuple. Results are
 * cached per `(scenarioId, presetId)` in a ref so re-renders don't refetch.
 * When `scenarioId` is omitted, no fetch fires — existing callers stay on the
 * pre-31-02 zero-network behavior.
 *
 * @see WD-UI-05, WD-UI-06, IMP-04
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  WEB_WITHDRAWAL_PRESETS,
  accountOrderSummary,
  type WithdrawalPresetId,
} from '@/lib/withdrawal-presets';
import { previewScenarioDecisions } from '@/lib/api/profile-scenarios-preview';
import {
  extractImpactMetrics,
  type ImpactMetrics,
  type ResultDataLike,
} from '@/lib/impact-metrics';
import type { ScenarioDecisionsPatch } from '@/types/profile-scenario';
import { formatCurrency } from '@/lib/utils';

export interface PresetSelectorCardProps {
  /** The currently-active preset id (from resolvePresetIdFromOrder in the parent). */
  currentPresetId: WithdrawalPresetId;
  /** Fires when the user picks a NON-custom preset. Parent handles confirm-dialog gating. */
  onSelect: (id: WithdrawalPresetId) => void;
  /**
   * When provided, enables per-preset impact-metric previews. Each non-baseline
   * preset fires `POST /preview-decisions` once and renders Tax + Estate inline.
   * Omit to preserve the pre-Phase-31-02 zero-network behavior (existing tests
   * + callers that don't have a scenario id in scope).
   */
  scenarioId?: string;
}

/**
 * Presets we DON'T fetch metrics for:
 *  - 'taxEfficientDefault' is byte-equivalent to the engine baseline (the
 *    projection without a preset patch), so a metrics row would duplicate the
 *    ImpactPreview card below.
 *  - 'custom' has no tuple — there's nothing to send.
 *
 * These ids are filtered out of the parallel-fetch list AND skip the inline
 * metrics line on their card.
 */
const SKIP_METRICS_FOR: ReadonlySet<WithdrawalPresetId> = new Set<WithdrawalPresetId>([
  'taxEfficientDefault',
  'custom',
]);

/**
 * Builds the minimal decisions patch for a single preset preview.
 *
 * The server merges this over the persisted decisions, so we only send the
 * fields the preset *changes*:
 *  - `drawdownOrder`: preset.drawdownOrder (engine type-token tuple — the
 *    calculation engine accepts this directly per `resolveDrawdownOrder` in
 *    packages/calculation-engine/src/withdrawals/strategy.ts).
 *  - `rrspMeltdown.enabled`: flips on iff the preset toggles meltdown.
 *  - `oasClawbackAvoidance.enabled`: flips on iff the preset toggles clawback.
 *
 * `strategyId` is intentionally NOT sent — the explicit `drawdownOrder` wins
 * over any persisted strategyId (see strategy.ts line 228).
 */
function buildPresetPatch(presetId: WithdrawalPresetId): ScenarioDecisionsPatch | null {
  const preset = WEB_WITHDRAWAL_PRESETS.find((p) => p.id === presetId);
  if (!preset?.drawdownOrder) return null;
  return {
    drawdownOrder: [...preset.drawdownOrder],
    rrspMeltdown: { enabled: preset.enablesMeltdown },
    oasClawbackAvoidance: { enabled: preset.enablesClawbackAvoidance },
  };
}

/**
 * Module-level cache keyed by `${scenarioId}::${presetId}`. Survives
 * remounts within a session so navigating between sections doesn't refetch
 * the same projection. The cache stores resolved metrics only — failed
 * fetches are not cached (so a retry on next mount is possible).
 */
const metricsCache = new Map<string, ImpactMetrics>();

function cacheKey(scenarioId: string, presetId: WithdrawalPresetId): string {
  return `${scenarioId}::${presetId}`;
}

export function PresetSelectorCard({
  currentPresetId,
  onSelect,
  scenarioId,
}: PresetSelectorCardProps): JSX.Element {
  const selectable = WEB_WITHDRAWAL_PRESETS.filter((p) => p.id !== 'custom');
  const isCustom = currentPresetId === 'custom';

  // Per-preset metrics map. `null` = pending / not-yet-fetched; absent key =
  // skipped (taxEfficientDefault / custom). Once a metrics object is stored
  // we render it inline; while pending we render '—'.
  const [metricsByPreset, setMetricsByPreset] = useState<
    Partial<Record<WithdrawalPresetId, ImpactMetrics>>
  >(() => {
    if (!scenarioId) return {};
    // Hydrate from module cache so a re-mount renders instantly.
    const seed: Partial<Record<WithdrawalPresetId, ImpactMetrics>> = {};
    for (const preset of WEB_WITHDRAWAL_PRESETS) {
      if (SKIP_METRICS_FOR.has(preset.id)) continue;
      const hit = metricsCache.get(cacheKey(scenarioId, preset.id));
      if (hit) seed[preset.id] = hit;
    }
    return seed;
  });

  // Tracks the AbortController for the active batch so unmount can cancel.
  const activeControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!scenarioId) return;

    // Compute the presets we still need to fetch (not in module cache and
    // not in the local state). This keeps the parallel batch minimal across
    // remounts.
    const targets = WEB_WITHDRAWAL_PRESETS.filter(
      (p) => !SKIP_METRICS_FOR.has(p.id) && !metricsCache.has(cacheKey(scenarioId, p.id))
    );
    if (targets.length === 0) return;

    // Abort any prior in-flight batch (e.g. scenarioId changed mid-fetch).
    activeControllerRef.current?.abort();
    const controller = new AbortController();
    activeControllerRef.current = controller;

    let cancelled = false;

    void Promise.all(
      targets.map(async (preset) => {
        const patch = buildPresetPatch(preset.id);
        if (!patch) return { id: preset.id, metrics: null as ImpactMetrics | null };
        try {
          const response = await previewScenarioDecisions(scenarioId, patch, {
            signal: controller.signal,
          });
          if (controller.signal.aborted) {
            return { id: preset.id, metrics: null as ImpactMetrics | null };
          }
          const next = extractImpactMetrics(response.result_data as ResultDataLike);
          metricsCache.set(cacheKey(scenarioId, preset.id), next);
          return { id: preset.id, metrics: next };
        } catch (err: unknown) {
          // AbortError is silently absorbed — a newer batch or unmount took over.
          if (controller.signal.aborted) {
            return { id: preset.id, metrics: null as ImpactMetrics | null };
          }
          if (err instanceof Error && err.name === 'AbortError') {
            return { id: preset.id, metrics: null as ImpactMetrics | null };
          }
          // Non-abort errors leave the preset showing '—' (no cache write —
          // the next mount will retry).
          return { id: preset.id, metrics: null as ImpactMetrics | null };
        }
      })
    ).then((results) => {
      if (cancelled || controller.signal.aborted) return;
      setMetricsByPreset((prev) => {
        const next = { ...prev };
        for (const { id, metrics } of results) {
          if (metrics) next[id] = metrics;
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [scenarioId]);

  return (
    <section
      aria-labelledby="withdrawal-preset-heading"
      className="space-y-3"
      data-section="withdrawal-preset"
    >
      <div>
        <h2 id="withdrawal-preset-heading" className="text-base font-semibold text-ds-on-surface">
          Preset Strategy
        </h2>
        <p className="text-sm text-ds-on-surface-variant">
          Pick a strategy to apply, or customize the order below for a Custom plan.
        </p>
      </div>
      <div
        role="radiogroup"
        aria-labelledby="withdrawal-preset-heading"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        data-testid="preset-selector-grid"
        onKeyDown={(e) => {
          const cards = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'));
          const idx = cards.indexOf(document.activeElement as HTMLElement);
          if (idx === -1) return;
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            cards[(idx + 1) % cards.length]?.focus();
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            cards[(idx - 1 + cards.length) % cards.length]?.focus();
          }
        }}
      >
        {selectable.map((preset) => {
          const isActive = currentPresetId === preset.id;
          const showMetricsLine = scenarioId !== undefined && !SKIP_METRICS_FOR.has(preset.id);
          const metrics = metricsByPreset[preset.id];
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              tabIndex={isActive ? 0 : -1}
              aria-checked={isActive}
              data-preset-id={preset.id}
              data-active={isActive ? 'true' : 'false'}
              className={
                'rounded-xl border bg-card text-card-foreground shadow ' +
                'text-left w-full cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-ring' +
                (isActive
                  ? ' border-primary bg-primary/5'
                  : ' border-ds-outline-variant hover:bg-ds-surface-raised')
              }
              onClick={() => onSelect(preset.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(preset.id);
                }
              }}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-ds-on-surface">{preset.name}</span>
                  {isActive && (
                    <Badge variant="default" className="text-xs">
                      Active
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-ds-on-surface-variant">{preset.description}</p>
                <p className="text-xs font-medium text-ds-on-surface">
                  Order: {accountOrderSummary(preset)}
                </p>
                {showMetricsLine && (
                  <p
                    className="text-xs text-ds-on-surface-variant"
                    data-testid={`preset-metrics-${preset.id}`}
                    aria-busy={metrics === undefined}
                    aria-live="polite"
                  >
                    {metrics ? (
                      <>
                        <span data-metric="tax">Tax: {formatCurrency(metrics.lifetimeTax)}</span>
                        <span aria-hidden="true"> • </span>
                        <span data-metric="estate">
                          Estate: {formatCurrency(metrics.endingEstate)}
                        </span>
                      </>
                    ) : (
                      <span data-metric="pending">Tax: — • Estate: —</span>
                    )}
                  </p>
                )}
              </CardContent>
            </button>
          );
        })}
      </div>
      {isCustom && (
        <div
          className="rounded-md border border-dashed border-ds-outline-variant p-3 text-xs text-ds-on-surface-variant"
          data-preset-id="custom"
          data-active="true"
          data-testid="preset-custom-indicator"
        >
          <span className="font-semibold text-ds-on-surface">Custom (your order):</span> You have a
          custom drawdown order. Pick a preset above to replace it, or keep adjusting the account
          cards below.
        </div>
      )}
    </section>
  );
}

/**
 * Test-only escape hatch — clears the module-level metrics cache so each test
 * starts with a clean slate. Not exported to production consumers.
 *
 * @internal
 */
export function __resetPresetMetricsCacheForTests(): void {
  metricsCache.clear();
}
