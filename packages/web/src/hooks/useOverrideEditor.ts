'use client';

/**
 * useOverrideEditor — encapsulates YearByYearTab cell-edit state, optimistic saves,
 * PATCH /decisions, and debounced POST /run with AbortController cancellation.
 *
 * @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-26, D-27, D-28, D-29, D-30
 * @see .planning/phases/01-editable-overrides/01-RESEARCH.md - Implementation §10
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { updateDecisions, runProfileScenario } from '@/lib/api/profile-scenarios';
import type { ScenarioDecisions } from '@retireops/shared';
import {
  resolveActiveWithdrawalOverride,
  resolveActiveSpendingOverride,
} from '@retireops/shared/overrides';
import type { ProfileScenarioDetail } from '@/types/profile-scenario';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Account-type field identifiers — mirrors OverrideField on OverrideCellPopover. */
export type OverrideField = 'rrsp' | 'rrif' | 'lif' | 'tfsa' | 'nonreg' | 'spending';

/** Resolved override value (amount + apply-forward flag). */
export interface OverrideValue {
  amount: number;
  applyForward: boolean;
}

/** Override owner — distinguishes which person an override applies to in a couple. */
export type OverrideOwner = 'primary' | 'spouse';

/**
 * Identifies the currently-open popover cell.
 * Phase 2: field widened to `string` to accommodate read-only and out-of-scope cells
 * in addition to the 6 editable OverrideField literals. D-26 single-popover invariant
 * is preserved — `openCell` still controls one-at-a-time across all cell types.
 * @see .planning/phases/02-cell-provenance/02-UI-SPEC.md §One Popover at a Time (D-26)
 */
export interface OpenCellKey {
  year: number;
  /** OverrideField literal for editable cells; arbitrary column name for read-only/placeholder cells. */
  field: string;
  /** Which person this cell belongs to. Defaults to 'primary' when omitted (legacy callers). */
  owner?: OverrideOwner;
}

/** The 6 editable field keys — used to narrow `openCell.field` before save logic. */
const EDITABLE_FIELDS: ReadonlyArray<string> = [
  'rrsp',
  'rrif',
  'lif',
  'tfsa',
  'nonreg',
  'spending',
] as const;

/** Type guard: narrows a string field key to OverrideField (the 6 editable keys). */
export function isEditableField(f: string): f is OverrideField {
  return EDITABLE_FIELDS.includes(f);
}

/**
 * Structured onSave payload from OverrideCellPopover.
 * primary always has amount + applyForward; secondary is present only for merged-RRIF dual-input.
 * @see UI-SPEC §Q1, §onSave payload shape locked 2026-04-24
 */
export interface SavePayload {
  primary: { amount: number; applyForward: boolean };
  secondary?: { amount: number; applyForward: boolean };
}

/** Public API returned by useOverrideEditor. */
export interface OverrideEditorApi {
  /** Currently-open cell; null means no popover is visible. */
  openCell: OpenCellKey | null;
  /**
   * Open a popover for the given cell.
   * D-26: if another cell is already open, the hook swaps to the new cell.
   * Dirty state handling is the responsibility of OverrideCellPopover's onOpenChange.
   * `owner` defaults to 'primary' when omitted — keeps legacy callers working.
   */
  openPopover: (year: number, field: OverrideField, owner?: OverrideOwner) => void;
  /**
   * Phase 2: directly set openCell to any { year, field } pair (or null).
   * Used by ReadOnlyCell and placeholder triggers that carry non-OverrideField field keys.
   * D-26: one-at-a-time invariant — calling setOpenCell replaces any previously-open cell.
   * @see .planning/phases/02-cell-provenance/02-UI-SPEC.md §One Popover at a Time (D-26)
   */
  setOpenCell: (cell: OpenCellKey | null) => void;
  /** Close the current popover without saving. */
  closePopover: () => void;
  /**
   * Commit the override(s) from the popover's onSave payload.
   * Optimistically updates local decisions, PATCHes server (non-debounced), then debounced /run.
   * D-27: every Save is durable (no debounce on PATCH); only the /run is debounced.
   */
  savePopover: (payload: SavePayload) => Promise<void>;
  /**
   * Returns the active withdrawal override for the given (year, field, owner) from local decisions.
   * Includes optimistic pending edits. `owner` defaults to 'primary' when omitted.
   */
  getActiveWithdrawalOverride: (
    year: number,
    field: Exclude<OverrideField, 'spending'>,
    owner?: OverrideOwner
  ) => OverrideValue | undefined;
  /**
   * Returns the active spending override for the given year from local decisions.
   * Includes optimistic pending edits. `owner` defaults to 'primary' when omitted.
   */
  getActiveSpendingOverride: (year: number, owner?: OverrideOwner) => OverrideValue | undefined;
  /** True while POST /run is in-flight (D-29). Clears on completion or abort. */
  isRecomputing: boolean;
  /** Current local decisions state (includes optimistic saves). */
  decisions: ScenarioDecisions;

  /**
   * PHASE 3 (D-74): remove the active override at (field, year, owner).
   * For 'spending', removes the spendingOverrides record at (year, owner).
   * For other fields, removes the withdrawalOverrides record matching (field, year, owner).
   * `owner` defaults to 'primary' when omitted — keeps legacy callers working.
   * Triggers debounced /run + cascade snapshot diff exactly like savePopover (D-69).
   * @see .planning/phases/03-cascade-undo/03-CONTEXT.md - D-66, D-69, D-70, D-74
   */
  removeOverride: (field: OverrideField, year: number, owner?: OverrideOwner) => Promise<void>;

  /**
   * PHASE 3 (D-73): true while removeOverride PATCH+/run round-trip is in-flight.
   * The OverrideCellPopover Remove button uses this to disable itself.
   * @see .planning/phases/03-cascade-undo/03-CONTEXT.md - D-73, D-74
   */
  isRemoving: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Debounce interval for POST /run after Save. @see D-27, UI-SPEC Q6 */
const DEBOUNCE_MS = 400;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOverrideEditor(args: {
  scenarioId: string;
  initialDecisions: ScenarioDecisions;
  onScenarioUpdated: (updated: ProfileScenarioDetail) => void;
  /**
   * Phase 3 (D-58, D-76): fired once at the start of persistAndRecompute,
   * BEFORE the optimistic setDecisions and PATCH dispatch. Used by
   * YearByYearTab to capture a cascade snapshot of the currently-rendered
   * projectionRows so the post-/run diff can highlight changed cells.
   * @see .planning/phases/03-cascade-undo/03-CONTEXT.md - D-58, D-76
   */
  onBeforeSave?: () => void;
}): OverrideEditorApi {
  const { scenarioId, initialDecisions, onScenarioUpdated, onBeforeSave } = args;

  const [decisions, setDecisions] = useState<ScenarioDecisions>(initialDecisions);
  const [openCell, setOpenCell] = useState<OpenCellKey | null>(null);
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false); // PHASE 3 (D-74)

  // D-28: AbortController ref — abort any in-flight /run when a new edit fires.
  const abortRef = useRef<AbortController | null>(null);

  // Ref so closures (debouncedRecompute) always see the latest decisions without stale closure.
  const decisionsRef = useRef(decisions);
  decisionsRef.current = decisions;

  // Reinitialize when the scenario changes (e.g., navigating between scenarios).
  //
  // OWNERSHIP MODEL (WR-05):
  //   - `initialDecisions` is the SEED, NOT a subscription. Read on mount and
  //     on scenario change only. The hook then OWNS local decisions state for
  //     the lifetime of the open scenario.
  //   - After the first render for a given scenarioId, the parent's
  //     initialDecisions changes are IGNORED. The optimistic-save path
  //     (`persistAndRecompute` → `setDecisions(next)`) is the authoritative
  //     write path; the parent's `onScenarioUpdated` callback receives the
  //     server's recomputed scenario but does NOT re-seed this hook's
  //     decisions.
  //   - LIMITATION: any external resync (e.g., a future SSE-driven stale-mark
  //     recompute that pushes a new server-side decisions snapshot) MUST go
  //     through a separate `syncDecisions` API — re-passing `initialDecisions`
  //     after mount is a no-op here by design.
  //
  // Dependency list intentionally omits `initialDecisions` and
  // `onScenarioUpdated` — they are read once per scenario change.
  useEffect(() => {
    setDecisions(initialDecisions);
    // Cancel any pending recompute from the previous scenario.
    abortRef.current?.abort();
    abortRef.current = null;
    setIsRecomputing(false);
    setOpenCell(null);
  }, [scenarioId]); // intentional: initialDecisions/onScenarioUpdated read once per scenario change

  // WR-02: stable ref so the debounced callback always calls the latest
  // onScenarioUpdated without being stale-closed over an old render's value.
  // Mirrors the decisionsRef pattern used above for `decisions`.
  const onScenarioUpdatedRef = useRef(onScenarioUpdated);
  onScenarioUpdatedRef.current = onScenarioUpdated;

  // D-27/D-28: Debounced recompute — cancels in-flight /run, starts a new one.
  const debouncedRecompute = useDebouncedCallback(async () => {
    // D-28: cancel any previously in-flight recompute.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsRecomputing(true);
    try {
      const updated = await runProfileScenario(scenarioId, { signal: controller.signal });
      // Only update UI if this controller is still the latest (D-28 latest-wins guard).
      if (abortRef.current === controller) {
        onScenarioUpdatedRef.current(updated);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        // Log non-abort failures; keep indicator from sticking.
        console.error('[useOverrideEditor] Recompute failed', err);
      }
    } finally {
      // D-28: only clear the recomputing flag when this controller is still the latest.
      if (abortRef.current === controller) {
        abortRef.current = null;
        setIsRecomputing(false);
      }
    }
  }, DEBOUNCE_MS);

  /** Optimistically update local decisions, PATCH server, then debounced /run. */
  const persistAndRecompute = useCallback(
    async (nextDecisions: ScenarioDecisions) => {
      // PHASE 3 (D-58, D-76): signal cascade snapshot capture BEFORE optimistic update.
      // Fired once per save/remove dispatch — never on optimistic re-renders, never on
      // failed /run retries. The next `/run` resolution triggers the diff against this
      // snapshot.
      onBeforeSave?.();
      // 1. Optimistic local update (D-29).
      setDecisions(nextDecisions);
      // 2. Durable PATCH — not debounced so user intent is never dropped (D-27).
      await updateDecisions(scenarioId, {
        withdrawalOverrides: nextDecisions.withdrawalOverrides,
        spendingOverrides: nextDecisions.spendingOverrides,
        surplusDestination: nextDecisions.surplusDestination,
      });
      // 3. Debounced recompute (D-28: aborts previous in-flight /run).
      void debouncedRecompute();
    },
    [scenarioId, debouncedRecompute, onBeforeSave]
  );

  const savePopover = useCallback(
    async (payload: SavePayload) => {
      const cell = openCell;
      if (!cell) return;
      // Phase 2: read-only and placeholder cells use non-OverrideField keys — they have
      // no save form, so savePopover should never be called for them. Guard defensively.
      if (!isEditableField(cell.field)) return;
      // WR-04: capture pre-save decisions snapshot for rollback on PATCH failure.
      const previous = decisionsRef.current;
      const editableField = cell.field;
      if (!isEditableField(editableField)) return; // redundant guard for type narrowing
      const editableCell: { year: number; field: OverrideField; owner: OverrideOwner } = {
        year: cell.year,
        field: editableField,
        owner: cell.owner ?? 'primary',
      };
      const next = applyEditToDecisions(previous, editableCell, payload);
      try {
        await persistAndRecompute(next);
        setOpenCell(null); // close only after successful save
      } catch (err) {
        setDecisions(previous); // rollback optimistic update
        throw err; // let popover surface the failure
      }
    },
    [openCell, persistAndRecompute]
  );

  /**
   * PHASE 3 (D-69, D-74): remove the active override record at (field, year).
   *
   * For field === 'spending', filters spendingOverrides[] by year only.
   * For all other fields, filters withdrawalOverrides[] by composite (field, year).
   * Idempotent: removing a non-existent record results in an unchanged array.
   *
   * Reuses persistAndRecompute (same debounce + AbortController flow as savePopover);
   * onBeforeSave fires automatically inside persistAndRecompute, so removal triggers
   * the same cascade snapshot/diff cycle as a save (D-69).
   *
   * Apply-forward removal works automatically: deleting the anchor record removes
   * the entire propagation chain (D-66), because the engine derives forward-propagation
   * from the presence of the anchor record.
   *
   * @see .planning/phases/03-cascade-undo/03-CONTEXT.md - D-66, D-69, D-70, D-74
   */
  const removeOverride = useCallback(
    async (field: OverrideField, year: number, owner: OverrideOwner = 'primary'): Promise<void> => {
      const previous = decisionsRef.current;
      let next: ScenarioDecisions;
      if (field === 'spending') {
        next = {
          ...previous,
          spendingOverrides: (previous.spendingOverrides ?? []).filter(
            (o) => !(o.year === year && (o.owner ?? 'primary') === owner)
          ),
        };
      } else {
        next = {
          ...previous,
          withdrawalOverrides: (previous.withdrawalOverrides ?? []).filter(
            (o) => !(o.field === field && o.year === year && (o.owner ?? 'primary') === owner)
          ),
        };
      }
      setIsRemoving(true);
      try {
        await persistAndRecompute(next);
      } catch (err) {
        setDecisions(previous); // rollback optimistic update on failure
        throw err;
      } finally {
        setIsRemoving(false);
      }
    },
    [persistAndRecompute]
  );

  const openPopover = useCallback(
    (year: number, field: OverrideField, owner: OverrideOwner = 'primary') => {
      // D-26: one popover at a time. Radix's onOpenChange(false) fires on the old popover
      // via OverrideCellPopover's open prop becoming false. Hook just swaps openCell.
      setOpenCell({ year, field, owner });
    },
    []
  );

  const closePopover = useCallback(() => setOpenCell(null), []);

  const getActiveWithdrawalOverride = useCallback(
    (
      year: number,
      field: Exclude<OverrideField, 'spending'>,
      owner: OverrideOwner = 'primary'
    ): OverrideValue | undefined => {
      const overrides = decisionsRef.current.withdrawalOverrides ?? [];
      const ownerScoped = overrides.filter((o) => (o.owner ?? 'primary') === owner);
      const sorted = [...ownerScoped].sort((a, b) => a.year - b.year);
      const rec = resolveActiveWithdrawalOverride(field, year, sorted);
      return rec ? { amount: rec.amount, applyForward: rec.applyForward } : undefined;
    },
    [] // stable — reads from ref
  );

  const getActiveSpendingOverride = useCallback(
    (year: number, owner: OverrideOwner = 'primary'): OverrideValue | undefined => {
      const overrides = decisionsRef.current.spendingOverrides ?? [];
      const ownerScoped = overrides.filter((o) => (o.owner ?? 'primary') === owner);
      const sorted = [...ownerScoped].sort((a, b) => a.year - b.year);
      const rec = resolveActiveSpendingOverride(year, sorted);
      return rec ? { amount: rec.amount, applyForward: rec.applyForward } : undefined;
    },
    [] // stable — reads from ref
  );

  return {
    openCell,
    openPopover,
    setOpenCell,
    closePopover,
    savePopover,
    getActiveWithdrawalOverride,
    getActiveSpendingOverride,
    isRecomputing,
    decisions,
    removeOverride, // PHASE 3 (D-74)
    isRemoving, // PHASE 3 (D-74)
  };
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Applies a Save payload to the current decisions state, returning a new decisions object.
 * Upserts by (owner, field, year) for withdrawals; by (owner, year) for spending.
 * The owner discriminator lets primary and spouse overrides coexist for the same field/year.
 */
function applyEditToDecisions(
  current: ScenarioDecisions,
  cell: { year: number; field: OverrideField; owner: OverrideOwner },
  payload: SavePayload
): ScenarioDecisions {
  const owner: OverrideOwner = cell.owner;
  if (cell.field === 'spending') {
    const existing = current.spendingOverrides ?? [];
    const filtered = existing.filter(
      (o) => !(o.year === cell.year && (o.owner ?? 'primary') === owner)
    );
    const next = [
      ...filtered,
      {
        year: cell.year,
        amount: payload.primary.amount,
        applyForward: payload.primary.applyForward,
        owner,
      },
    ];
    return { ...current, spendingOverrides: next };
  }

  // Withdrawal — possibly dual-input (merged-RRIF cell with secondary field).
  const existing = current.withdrawalOverrides ?? [];
  let next = existing.filter(
    (o) => !(o.field === cell.field && o.year === cell.year && (o.owner ?? 'primary') === owner)
  );
  next = [
    ...next,
    {
      field: cell.field,
      year: cell.year,
      amount: payload.primary.amount,
      applyForward: payload.primary.applyForward,
      owner,
    },
  ];

  if (payload.secondary) {
    // Merged-RRIF dual-input: secondary is the complement of cell.field.
    const secondaryField: 'rrsp' | 'rrif' = cell.field === 'rrif' ? 'rrsp' : 'rrif';
    next = next.filter(
      (o) =>
        !(o.field === secondaryField && o.year === cell.year && (o.owner ?? 'primary') === owner)
    );
    next = [
      ...next,
      {
        field: secondaryField,
        year: cell.year,
        amount: payload.secondary.amount,
        applyForward: payload.secondary.applyForward,
        owner,
      },
    ];
  }

  return { ...current, withdrawalOverrides: next };
}
