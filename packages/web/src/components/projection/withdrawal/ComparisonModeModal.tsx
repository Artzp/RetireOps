/**
 * ComparisonModeModal — side-by-side preset comparison shown from the
 * scenario edit page.
 *
 * Phase 32 Plan 01 (CMP-01..CMP-05): when the user clicks "Compare Strategies"
 * the parent opens this modal. It lets the user pick 2+ presets and fires one
 * `POST /preview-decisions` per selected preset in parallel (Promise.all,
 * latest-wins via AbortController). The five Phase 31 metrics are then
 * rendered in a side-by-side table.
 *
 * KEY DESIGN POINTS
 *
 *  - **Stable base snapshot (Pitfall 5):** `baseDecisionsSnapshot` is captured
 *    by the caller via `useRef` at modal-open time and passed in as a prop.
 *    This modal does NOT subscribe to live `taxState`, so live edits in the
 *    edit page beneath the modal cannot churn the comparison.
 *
 *  - **Memoized per-preset patches (Pitfall 5):** each selected preset's
 *    `ScenarioDecisionsPatch` is derived inside `useMemo` keyed by the
 *    `selectedKey` string. Rerenders with the same selection produce the
 *    same patch object identity, so the effect's structural hash matches
 *    and we do NOT refetch.
 *
 *  - **300ms debounce:** matches the Phase 31 ImpactPreview machinery so
 *    rapidly toggling checkboxes only fires one batch when the user settles.
 *
 *  - **Skip set:** only `custom` is not user-selectable in the comparison
 *    table (it has no preset tuple to send). All 5 named presets including
 *    `taxEfficientDefault` are selectable. See SKIP_PRESETS comment for
 *    the Phase 34-02 audit that removed the prior taxEfficientDefault filter.
 *
 *  - **Current preset auto-selected + locked:** the preset resolved from the
 *    snapshot is checked on mount and cannot be unchecked — the user always
 *    sees their "current" plan in the comparison.
 *
 *  - **'custom' current state:** when the snapshot doesn't match any preset
 *    tuple (resolves to 'custom'), we synthesize a "Current (custom)" column
 *    whose patch IS the snapshot — so the user can still compare their
 *    custom plan against the 5 named presets.
 *
 * @see .planning/phases/32-comparison-mode/32-CONTEXT.md (locked decisions)
 * @see .planning/phases/32-comparison-mode/32-01-PLAN.md (Task 1)
 * @see packages/web/src/components/projection/withdrawal/ImpactPreview.tsx (Phase 31 debounce pattern)
 * @see packages/web/src/components/projection/withdrawal/PresetSelectorCard.tsx (Phase 31 parallel fetch pattern)
 */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  WEB_WITHDRAWAL_PRESETS,
  resolvePresetIdFromOrder,
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

export interface ComparisonModeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenarioId: string;
  /**
   * Snapshot of the scenario's decisions taken at modal-open time. Caller
   * MUST capture this via `useRef` to keep referential stability across
   * the live taxState edits beneath the modal (Pitfall 5).
   *
   * Typed permissively (`Record<string, unknown>`) because the page's local
   * `TaxState` differs from the persisted `ScenarioDecisions` and we only
   * need the four fields the engine reads: `drawdownOrder`, `rrspMeltdown`,
   * `oasClawbackAvoidance`, `bracketFill`, `incomeSplitting`. The server
   * merges these over persisted decisions before running the projection.
   */
  baseDecisionsSnapshot: Record<string, unknown>;
}

/**
 * Presets we do NOT offer as comparison columns:
 *  - 'custom' has no preset tuple to send — it's a status indicator only.
 *
 * Note: 'taxEfficientDefault' was previously filtered here under the
 * assumption that it was byte-equivalent to the engine baseline (mirroring
 * Phase 31 PresetSelectorCard's SKIP_METRICS_FOR). That rationale applied
 * to the card's impact-delta display (showing a delta against the baseline
 * itself is meaningless) but does NOT apply to the compare modal, where
 * users choose which presets to view side-by-side. The brief §7 explicitly
 * lists "Tax-efficient default" as a comparable strategy. Since its
 * drawdownOrder is non-null, buildPresetPatch returns a valid patch and
 * the column renders correctly. Removed in 34-02 audit (branch c).
 *
 * If the snapshot resolves to 'custom' (user's drawdownOrder doesn't match
 * any preset), we add a synthetic "current" column that sends the snapshot
 * as the patch — see `resolveBaseColumn` below.
 */
const SKIP_PRESETS: ReadonlySet<WithdrawalPresetId> = new Set<WithdrawalPresetId>(['custom']);

const DEBOUNCE_MS = 300;

/**
 * Stable id used to key the synthetic "current (custom)" column. We borrow
 * the 'custom' preset id since it's never offered as a comparable preset —
 * the SKIP_PRESETS filter keeps it out of the checkbox list, so this id can
 * never collide with a user-selectable preset.
 */
const CURRENT_CUSTOM_ID = 'custom' as const satisfies WithdrawalPresetId;

/**
 * Builds the minimal `ScenarioDecisionsPatch` for a single preset.
 * Matches Phase 31 PresetSelectorCard.buildPresetPatch exactly so server-side
 * behavior is identical across the two surfaces.
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
 * Builds the patch for the "current" column when the snapshot doesn't match
 * any preset (i.e. resolves to 'custom'). The snapshot already has the
 * engine-shaped fields we need (the caller passes `taxState`-derived JSON).
 */
function buildSnapshotPatch(snapshot: Record<string, unknown>): ScenarioDecisionsPatch {
  // Forward only the engine-relevant fields so the server merges a focused
  // patch rather than the full local TaxState shape (which includes
  // display-only scaling like splitPercent as 0–50 instead of 0–1).
  const patch: ScenarioDecisionsPatch = {};
  if (Array.isArray(snapshot['drawdownOrder'])) {
    patch['drawdownOrder'] = [...(snapshot['drawdownOrder'] as unknown[])];
  }
  if (snapshot['rrspMeltdown'] && typeof snapshot['rrspMeltdown'] === 'object') {
    patch['rrspMeltdown'] = snapshot['rrspMeltdown'];
  }
  if (snapshot['oasClawbackAvoidance'] && typeof snapshot['oasClawbackAvoidance'] === 'object') {
    patch['oasClawbackAvoidance'] = snapshot['oasClawbackAvoidance'];
  }
  if (snapshot['bracketFill'] && typeof snapshot['bracketFill'] === 'object') {
    patch['bracketFill'] = snapshot['bracketFill'];
  }
  return patch;
}

/**
 * Resolves the snapshot to a preset id using the same priority order as the
 * page header. When the snapshot's drawdownOrder isn't a recognized tuple,
 * this returns 'custom'.
 *
 * The snapshot's drawdownOrder is engine type-tokens (the page stores it that
 * way after Phase 28-03) — we collapse adjacent duplicates the same way
 * `drawdownOrderToTypeOrder` would, defensively, in case the caller forwards
 * an unfiltered array.
 */
function resolveSnapshotPresetId(snapshot: Record<string, unknown>): WithdrawalPresetId {
  const rawOrder = Array.isArray(snapshot['drawdownOrder']) ? snapshot['drawdownOrder'] : [];
  const order: string[] = [];
  for (const token of rawOrder) {
    const t = String(token);
    if (order[order.length - 1] !== t) order.push(t);
  }
  const meltdown =
    (snapshot['rrspMeltdown'] as { enabled?: unknown } | undefined)?.enabled === true;
  const clawback =
    (snapshot['oasClawbackAvoidance'] as { enabled?: unknown } | undefined)?.enabled === true;
  const strategyId = (snapshot['strategyId'] as string | undefined) ?? undefined;
  return resolvePresetIdFromOrder({
    drawdownTypeOrder: order,
    strategyId,
    meltdownEnabled: meltdown,
    clawbackEnabled: clawback,
  });
}

interface ColumnSpec {
  /** Stable id used in the Map key and React key. */
  id: WithdrawalPresetId;
  /** Display label in the table header. */
  label: string;
  /** The patch sent to /preview-decisions. */
  patch: ScenarioDecisionsPatch;
  /** True when this column is the user's current plan — checkbox is locked. */
  isCurrent: boolean;
}

export function ComparisonModeModal({
  open,
  onOpenChange,
  scenarioId,
  baseDecisionsSnapshot,
}: ComparisonModeModalProps): JSX.Element | null {
  // Resolve the snapshot once per modal-open cycle. Memoized so the same
  // snapshot reference yields the same resolution result without re-running
  // the tuple comparison on every render.
  const currentPresetId = useMemo(
    () => resolveSnapshotPresetId(baseDecisionsSnapshot),
    [baseDecisionsSnapshot]
  );

  // When the snapshot resolves to 'custom', we add a synthetic current column
  // whose patch IS the snapshot. Otherwise the current column is just the
  // resolved preset id (which will be skipped from the OPTIONAL list and
  // pinned to the checked set).
  const hasCustomCurrent = currentPresetId === 'custom';

  // The user-selectable preset list — everything except the SKIP set. When
  // the current preset is NOT in the skip set (i.e. it's a real preset),
  // it appears here and is locked-checked.
  const selectablePresets = useMemo(
    () => WEB_WITHDRAWAL_PRESETS.filter((p) => !SKIP_PRESETS.has(p.id)),
    []
  );

  // Initial selection: current preset + 'useTfsaEarlier' (the locked default
  // alternate). If the current preset IS 'useTfsaEarlier' we just include
  // it once. If current is 'custom' the synthetic column id goes in.
  const [selected, setSelected] = useState<Set<WithdrawalPresetId>>(() => {
    const set = new Set<WithdrawalPresetId>();
    if (hasCustomCurrent) {
      set.add(CURRENT_CUSTOM_ID);
    } else {
      set.add(currentPresetId);
    }
    set.add('useTfsaEarlier');
    return set;
  });

  // When the modal closes and reopens with a new snapshot, reset selection
  // so the initial defaults are recalculated. We use `open` as the trigger
  // and the snapshot reference as a secondary trigger — the parent uses
  // useRef so the reference only changes when the user explicitly snapshots
  // again.
  useEffect(() => {
    if (!open) return;
    const next = new Set<WithdrawalPresetId>();
    if (hasCustomCurrent) {
      next.add(CURRENT_CUSTOM_ID);
    } else {
      next.add(currentPresetId);
    }
    next.add('useTfsaEarlier');
    setSelected(next);
  }, [open, baseDecisionsSnapshot, currentPresetId, hasCustomCurrent]);

  // Sort the selected ids deterministically so the column order is stable
  // across rerenders — important for the structural hash that drives the
  // effect, and for the table column header order being predictable in tests.
  const orderedSelectedIds = useMemo(() => {
    const ids = Array.from(selected);
    return ids.sort((a, b) => a.localeCompare(b));
  }, [selected]);

  // Memoize each column's patch keyed on the sorted-selection string. The
  // dep is a primitive so rerenders with identical selection produce the
  // same column array identity. This is the core Pitfall 5 mitigation.
  const selectedKey = orderedSelectedIds.join('|');
  const columns: ColumnSpec[] = useMemo(() => {
    const out: ColumnSpec[] = [];
    for (const id of orderedSelectedIds) {
      if (id === CURRENT_CUSTOM_ID && hasCustomCurrent) {
        out.push({
          id: CURRENT_CUSTOM_ID,
          label: 'Current (custom)',
          patch: buildSnapshotPatch(baseDecisionsSnapshot),
          isCurrent: true,
        });
        continue;
      }
      const preset = WEB_WITHDRAWAL_PRESETS.find((p) => p.id === id);
      if (!preset) continue;
      const patch = buildPresetPatch(id);
      if (!patch) continue;
      out.push({
        id,
        label: preset.name,
        patch,
        isCurrent: !hasCustomCurrent && id === currentPresetId,
      });
    }
    return out;
    // orderedSelectedIds intentionally omitted: selectedKey is the stable primitive
    // derived from it; having both in deps would defeat the memoization (array
    // identity changes on every orderedSelectedIds useMemo re-run).
  }, [selectedKey, hasCustomCurrent, currentPresetId, baseDecisionsSnapshot]);

  // Metrics keyed by column id. `undefined` = pending / not yet fetched
  // (renders as skeleton), an object = resolved (renders values).
  const [metrics, setMetrics] = useState<Partial<Record<WithdrawalPresetId, ImpactMetrics>>>({});

  // Track the active batch controller so a new selection can abort the prior
  // batch (latest-wins). Unmount aborts too via the cleanup effect.
  const activeControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    if (columns.length === 0) return;

    // Debounce: when the user toggles checkboxes rapidly, only fire one batch
    // once they settle for `DEBOUNCE_MS`.
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;

      // Abort the prior batch — latest-wins.
      activeControllerRef.current?.abort();
      const controller = new AbortController();
      activeControllerRef.current = controller;

      // Reset pending columns to skeleton state so the UI shows the refresh.
      setMetrics((prev) => {
        const next: Partial<Record<WithdrawalPresetId, ImpactMetrics>> = {};
        for (const col of columns) {
          // Keep cached metrics for already-resolved columns to avoid a
          // flash-of-loading on no-op rerenders; only ungated columns are
          // omitted so they re-render as skeletons.
          const existing = prev[col.id];
          if (existing) next[col.id] = existing;
        }
        return next;
      });

      void Promise.all(
        columns.map(async (col) => {
          try {
            const response = await previewScenarioDecisions(scenarioId, col.patch, {
              signal: controller.signal,
            });
            if (controller.signal.aborted) return null;
            const next = extractImpactMetrics(response.result_data as ResultDataLike);
            return { id: col.id, metrics: next };
          } catch (err: unknown) {
            if (controller.signal.aborted) return null;
            if (err instanceof Error && err.name === 'AbortError') return null;
            // On non-abort error, return null so the column stays in skeleton
            // state. A retry would require a UI affordance we deferred per
            // 32-CONTEXT.md "loading/error per row is discretionary".
            return null;
          }
        })
      ).then((results) => {
        if (cancelled || controller.signal.aborted) return;
        setMetrics((prev) => {
          const next = { ...prev };
          for (const r of results) {
            if (r) next[r.id] = r.metrics;
          }
          return next;
        });
      });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, selectedKey, scenarioId, columns]);

  // Abort on unmount so a torn-down tree doesn't try to set state.
  useEffect(() => {
    return () => {
      activeControllerRef.current?.abort();
    };
  }, []);

  if (!open) return null;

  const toggle = (id: WithdrawalPresetId, isCurrent: boolean): void => {
    if (isCurrent) return; // current preset is locked-checked
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl"
        data-testid="comparison-mode-modal"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>Compare Withdrawal Strategies</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preset checkboxes ───────────────────────────────────────────── */}
          <fieldset
            className="space-y-2"
            data-testid="comparison-preset-checkboxes"
            aria-label="Choose strategies to compare"
          >
            <legend className="text-sm font-semibold text-ds-on-surface">Strategies</legend>
            {hasCustomCurrent && (
              <label
                htmlFor="cmp-preset-current"
                className="flex items-center gap-2 text-sm"
                data-preset-id={CURRENT_CUSTOM_ID}
              >
                <Checkbox
                  id="cmp-preset-current"
                  checked
                  disabled
                  aria-label="Current (custom) — locked"
                />
                <span>Current (custom)</span>
                <span className="text-xs text-ds-on-surface-variant">(your plan)</span>
              </label>
            )}
            {selectablePresets.map((preset) => {
              const isCurrent = !hasCustomCurrent && preset.id === currentPresetId;
              const checked = selected.has(preset.id);
              return (
                <label
                  key={preset.id}
                  htmlFor={`cmp-preset-${preset.id}`}
                  className="flex items-center gap-2 text-sm"
                  data-preset-id={preset.id}
                >
                  <Checkbox
                    id={`cmp-preset-${preset.id}`}
                    checked={checked}
                    disabled={isCurrent}
                    onCheckedChange={() => toggle(preset.id, isCurrent)}
                    aria-label={preset.name}
                  />
                  <span>{preset.name}</span>
                  {isCurrent && (
                    <span className="text-xs text-ds-on-surface-variant">(your plan)</span>
                  )}
                </label>
              );
            })}
          </fieldset>

          {/* Metrics table ────────────────────────────────────────────────── */}
          <div className="overflow-x-auto" data-testid="comparison-metrics-table">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ds-outline-variant">
                  <th className="py-2 pr-4 text-left font-semibold text-ds-on-surface">Metric</th>
                  {columns.map((col) => (
                    <th
                      key={col.id}
                      className="py-2 px-3 text-right font-semibold text-ds-on-surface"
                      data-column-id={col.id}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <MetricRow
                  label="Lifetime tax"
                  columns={columns}
                  metrics={metrics}
                  format={(m) => formatCurrency(m.lifetimeTax)}
                  metricKey="lifetime-tax"
                />
                <MetricRow
                  label="Depletion age"
                  columns={columns}
                  metrics={metrics}
                  format={(m) =>
                    m.depletionAge === null ? 'Never' : `Age ${String(m.depletionAge)}`
                  }
                  metricKey="depletion-age"
                />
                <MetricRow
                  label="Ending estate"
                  columns={columns}
                  metrics={metrics}
                  format={(m) => formatCurrency(m.endingEstate)}
                  metricKey="ending-estate"
                />
                <MetricRow
                  label="OAS clawback (total)"
                  columns={columns}
                  metrics={metrics}
                  format={(m) => formatCurrency(m.oasClawback)}
                  metricKey="oas-clawback"
                />
                <MetricRow
                  label="Avg after-tax income"
                  columns={columns}
                  metrics={metrics}
                  format={(m) => formatCurrency(m.afterTaxSpendingCovered)}
                  metricKey="after-tax-spending"
                />
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface MetricRowProps {
  label: string;
  columns: ReadonlyArray<ColumnSpec>;
  metrics: Partial<Record<WithdrawalPresetId, ImpactMetrics>>;
  format: (m: ImpactMetrics) => string;
  metricKey: string;
}

function MetricRow({ label, columns, metrics, format, metricKey }: MetricRowProps): JSX.Element {
  return (
    <tr className="border-b border-ds-outline-variant/40">
      <td className="py-2 pr-4 text-ds-on-surface-variant">{label}</td>
      {columns.map((col) => {
        const m = metrics[col.id];
        return (
          <td
            key={col.id}
            className="py-2 px-3 text-right font-medium text-ds-on-surface"
            data-column-id={col.id}
            data-metric={metricKey}
            aria-busy={m === undefined}
          >
            {m ? (
              format(m)
            ) : (
              <span className="inline-block h-4 w-16 animate-pulse rounded bg-ds-surface-raised align-middle" />
            )}
          </td>
        );
      })}
    </tr>
  );
}
