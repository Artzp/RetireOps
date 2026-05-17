/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */

'use client';

// Decision refs: "D-26" "D-31" "D-39" "D-42" "D-45"
// Phase 2: ReadOnlyCell helper added (D-45); openCell state widened to string field (D-26/D-39).
// Phase 3: cascade highlight — D-55, D-57, D-58, D-69, D-75, D-76, D-77

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { diffProjectionRows } from '../../../lib/cascade-diff';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Loader2, Pencil } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { MoneyCell } from './MoneyCell';
import { OverrideDot, ClampBadge, ShortfallBadge } from './YearByYearBadges';
import { OverrideCellPopover } from './OverrideCellPopover';
import type { OverrideField } from './OverrideCellPopover';
import {
  selectVisibleSuperGroupColumns,
  SUPER_GROUP_ORDER,
  INCOME_SUB_GROUP_ORDER,
  tdClassNameFor,
  type ColumnDef,
  type PersonOwner,
  type SparseFlags,
  type SuperGroup,
} from './year-by-year-columns';
import { createRenderCell } from './year-by-year-render-cell';
import { useOverrideEditor } from '@/hooks/useOverrideEditor';
import {
  previewProfileScenarioDecisions,
  runProfileScenario,
  updateDecisions,
} from '@/lib/api/profile-scenarios';
import type {
  ProjectionYearRow,
  ProvenanceCellMetadata,
  ScenarioDecisions,
} from '@retireops/shared/types';
import { CPP_RATES, OAS_RATES } from '@retireops/shared/constants';
import type { ProfileScenarioDetail } from '@/types/profile-scenario';
// Phase 30 Plan 02 — explainability popover + override summary banner.
// `explainYearWithdrawals` is the inline web mirror of the shared adapter
// (packages/web/src/lib/explain-adapter.ts — byte-equivalent copy).
import { explainYearWithdrawals, type WithdrawalReason } from '@/lib/explain-adapter';
import WithdrawalReasonPopover from '@/components/projection/withdrawal/WithdrawalReasonPopover';
import OverrideSummary from '@/components/projection/withdrawal/OverrideSummary';

interface YearByYearTabProps {
  data: {
    projectionRows?: ProjectionYearRow[];
    // yearlyResults kept in shape for backward compat — not used by this component
    yearlyResults?: unknown[];
  };
  // nominalRows: raw nominal projection rows (mode-invariant). When provided,
  // cascade snapshots use these instead of display-adjusted rows. WG-01 fix.
  nominalRows?: ProjectionYearRow[];
  displayMode?: 'nominal' | 'real';
  /** Scenario ID — required to wire PATCH /decisions + POST /run. */
  scenarioId?: string;
  /** Current scenario decisions for the override editor. */
  initialDecisions?: ScenarioDecisions;
  /** Called after POST /run resolves with the fresh scenario. */
  onScenarioUpdated?: (updated: ProfileScenarioDetail) => void;
}

type ColumnGroup = 'income' | 'taxes' | 'spending' | 'balances';
type TimingDraft = {
  cppStartAge: number;
  oasStartAge: number;
  lifeExpectancy: number;
  expectedCPPAt65: number;
  yearsOfResidence: number;
  spouseCppStartAge?: number;
  spouseOasStartAge?: number;
  spouseLifeExpectancy?: number;
  spouseExpectedCPPAt65?: number;
  spouseYearsOfResidence?: number;
};
type TimingPreset = {
  id: string;
  label: string;
  cppStartAge: number;
  oasStartAge: number;
  spouseCppStartAge?: number;
  spouseOasStartAge?: number;
};
type TimingOutcomeSummary = {
  finalHouseholdNetWorth: number;
  finalEstateOrNetWorth: number;
  depletion:
    | {
        age: number;
        year: number;
      }
    | undefined;
  lifetimeCpp: number;
  lifetimeOas: number;
  lifetimeIncome: number;
  lifetimeOasClawback: number;
  totalTaxesPaid: number;
  fundedStatus: string;
};
type TimingComparisonRow = TimingPreset &
  TimingOutcomeSummary & {
    rank: number;
    isBest: boolean;
    cppBreakevenAge?: number;
    oasBreakevenAge?: number;
  };

const CPP_START_AGES = [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70] as const;
const OAS_START_AGES = [65, 66, 67, 68, 69, 70] as const;
const LIFE_EXPECTANCY_AGES = [
  65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88,
  89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110,
] as const;
const TIMING_PRESETS: ReadonlyArray<TimingPreset> = [
  { id: 'early', label: 'Take CPP at 60, OAS at 65', cppStartAge: 60, oasStartAge: 65 },
  { id: 'standard', label: 'Default: CPP/OAS at 65', cppStartAge: 65, oasStartAge: 65 },
  { id: 'deferred', label: 'Defer both to 70', cppStartAge: 70, oasStartAge: 70 },
  { id: 'delay-oas', label: 'Delay OAS only', cppStartAge: 65, oasStartAge: 70 },
  {
    id: 'spouse-earlier-primary-defers',
    label: 'Spouse starts earlier, primary defers',
    cppStartAge: 70,
    oasStartAge: 70,
    spouseCppStartAge: 60,
    spouseOasStartAge: 65,
  },
] as const;

const DEFAULT_DRAW_DOWN_ORDER = ['nonReg', 'tfsa', 'rrsp', 'rrif'] as const;
const SURPLUS_DESTINATIONS = ['nonreg', 'tfsa', 'rrsp', 'rrif'] as const;

function inferStartAge(
  rows: ProjectionYearRow[],
  incomeKey: keyof ProjectionYearRow,
  ageKey: 'age' | 'spouseAge',
  fallback: number
): number {
  const row = rows.find((r) => {
    const value = r[incomeKey];
    return typeof value === 'number' && value > 0;
  });
  const age = row?.[ageKey];
  return typeof age === 'number' ? age : fallback;
}

function inferLifeExpectancy(
  rows: ProjectionYearRow[],
  ageKey: 'age' | 'spouseAge',
  fallback: number
): number {
  const ages = rows
    .map((row) => row[ageKey])
    .filter((age): age is number => typeof age === 'number');
  return ages.length > 0 ? Math.max(...ages) : fallback;
}

function ageLabel(age: number): string {
  return `Age ${String(age)}`;
}

function formatPercentInput(value: number | undefined): string {
  return value === undefined ? '' : String((value * 100).toFixed(2).replace(/\.?0+$/, ''));
}

function parsePercentInput(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric / 100 : undefined;
}

function calculateCppFactor(startAge: number): number {
  if (startAge < 65) return 1 - (65 - startAge) * 12 * CPP_RATES.earlyReductionPerMonth;
  if (startAge > 65) return 1 + (startAge - 65) * 12 * CPP_RATES.lateIncreasePerMonth;
  return 1;
}

function calculateOasFactor(startAge: number): number {
  if (startAge <= 65) return 1;
  return 1 + Math.min(startAge - 65, 5) * 12 * OAS_RATES.deferralIncreasePerMonth;
}

function calculateBreakevenAge(
  baseAmount: number,
  earlyAge: number,
  laterAge: number,
  earlyFactor: number,
  laterFactor: number
): number | undefined {
  if (laterAge <= earlyAge || baseAmount <= 0) return undefined;
  const earlyBenefit = baseAmount * earlyFactor;
  const laterBenefit = baseAmount * laterFactor;
  const annualDifference = laterBenefit - earlyBenefit;
  if (annualDifference <= 0) return undefined;
  return laterAge + (earlyBenefit * (laterAge - earlyAge)) / annualDifference;
}

function formatBreakeven(age: number | undefined): string {
  return age === undefined || !Number.isFinite(age) ? 'n/a' : `Age ${age.toFixed(1)}`;
}

function inferBenefitAt65(
  rows: ProjectionYearRow[],
  incomeKey: keyof ProjectionYearRow,
  ageKey: 'age' | 'spouseAge',
  startAge: number,
  fallback: number
): number {
  const row = rows.find((r) => {
    const value = r[incomeKey];
    return typeof value === 'number' && value > 0;
  });
  const amount = row?.[incomeKey];
  if (typeof amount !== 'number' || amount <= 0) return fallback;
  if (incomeKey === 'cppIncome' || incomeKey === 'spouseCppIncome') {
    return Math.round(amount / calculateCppFactor(startAge));
  }
  const age = row?.[ageKey];
  const age75Factor = typeof age === 'number' && age >= 75 ? 1 + OAS_RATES.age75Bonus : 1;
  return Math.round(amount / calculateOasFactor(startAge) / age75Factor);
}

function summarizeTimingOutcomes(rows: ProjectionYearRow[]): TimingOutcomeSummary {
  const finalRow = rows.at(-1);
  const depletionRow = rows.find((row) => row.householdNetWorth <= 0);
  const finalEstate =
    typeof (finalRow as ProjectionYearRow & { netEstate?: number }).netEstate === 'number'
      ? (finalRow as ProjectionYearRow & { netEstate: number }).netEstate
      : (finalRow?.householdNetWorth ?? 0);

  return rows.reduce<TimingOutcomeSummary>(
    (summary, row) => ({
      ...summary,
      lifetimeCpp: summary.lifetimeCpp + row.cppIncome + (row.spouseCppIncome ?? 0),
      lifetimeOas: summary.lifetimeOas + row.oasIncome + (row.spouseOasIncome ?? 0),
      lifetimeIncome:
        summary.lifetimeIncome +
        (row.householdTotalIncome ??
          row.totalGrossIncome +
            (row.spouseEmploymentIncome ?? 0) +
            (row.spousePensionIncome ?? 0)),
      lifetimeOasClawback:
        summary.lifetimeOasClawback + row.oasClawback + (row.spouseOasClawback ?? 0),
      totalTaxesPaid:
        summary.totalTaxesPaid +
        (row.householdTotalTax ?? row.totalTax + (row.spouseTotalTax ?? 0)),
    }),
    {
      finalHouseholdNetWorth: finalRow?.householdNetWorth ?? 0,
      finalEstateOrNetWorth: finalEstate,
      depletion:
        depletionRow !== undefined
          ? {
              age: depletionRow.age,
              year: depletionRow.year,
            }
          : undefined,
      lifetimeCpp: 0,
      lifetimeOas: 0,
      lifetimeIncome: 0,
      lifetimeOasClawback: 0,
      totalTaxesPaid: 0,
      fundedStatus: depletionRow === undefined ? 'Funded' : 'Depletes',
    }
  );
}

function extractProjectionRows(resultData: Record<string, unknown>): ProjectionYearRow[] {
  const rows = resultData['projectionRows'] ?? resultData['yearlyResults'] ?? resultData['years'];
  return Array.isArray(rows) ? (rows as ProjectionYearRow[]) : [];
}

function compareTimingOutcomes(a: TimingOutcomeSummary, b: TimingOutcomeSummary): number {
  if (a.depletion === undefined && b.depletion !== undefined) return -1;
  if (a.depletion !== undefined && b.depletion === undefined) return 1;
  if (a.depletion !== undefined && b.depletion !== undefined) {
    const depletionDelta = b.depletion.age - a.depletion.age || b.depletion.year - a.depletion.year;
    if (depletionDelta !== 0) return depletionDelta;
  }
  return b.finalHouseholdNetWorth - a.finalHouseholdNetWorth;
}

function rankTimingComparisons(
  rows: Array<
    TimingPreset & TimingOutcomeSummary & { cppBreakevenAge?: number; oasBreakevenAge?: number }
  >
): TimingComparisonRow[] {
  const ranked = [...rows].sort(compareTimingOutcomes);
  return ranked.map((row, index) => ({ ...row, rank: index + 1, isBest: index === 0 }));
}

function timingPatchForPreset(
  preset: TimingPreset,
  isCouple: boolean,
  lifeDraft?: TimingDraft
): Record<string, number> {
  return {
    cppStartAge: preset.cppStartAge,
    oasStartAge: preset.oasStartAge,
    ...(lifeDraft !== undefined ? { lifeExpectancy: lifeDraft.lifeExpectancy } : {}),
    ...(lifeDraft !== undefined ? { expectedCPPAt65: lifeDraft.expectedCPPAt65 } : {}),
    ...(lifeDraft !== undefined ? { yearsOfResidence: lifeDraft.yearsOfResidence } : {}),
    ...(isCouple
      ? {
          spouseCppStartAge: preset.spouseCppStartAge ?? preset.cppStartAge,
          spouseOasStartAge: preset.spouseOasStartAge ?? preset.oasStartAge,
          ...(lifeDraft?.spouseLifeExpectancy !== undefined
            ? { spouseLifeExpectancy: lifeDraft.spouseLifeExpectancy }
            : {}),
          ...(lifeDraft?.spouseExpectedCPPAt65 !== undefined
            ? { spouseExpectedCPPAt65: lifeDraft.spouseExpectedCPPAt65 }
            : {}),
          ...(lifeDraft?.spouseYearsOfResidence !== undefined
            ? { spouseYearsOfResidence: lifeDraft.spouseYearsOfResidence }
            : {}),
        }
      : {}),
  };
}

function timingPatchFromDraft(draft: TimingDraft, isCouple: boolean): Record<string, number> {
  return {
    cppStartAge: draft.cppStartAge,
    oasStartAge: draft.oasStartAge,
    lifeExpectancy: draft.lifeExpectancy,
    expectedCPPAt65: draft.expectedCPPAt65,
    yearsOfResidence: draft.yearsOfResidence,
    ...(isCouple && draft.spouseCppStartAge !== undefined
      ? { spouseCppStartAge: draft.spouseCppStartAge }
      : {}),
    ...(isCouple && draft.spouseOasStartAge !== undefined
      ? { spouseOasStartAge: draft.spouseOasStartAge }
      : {}),
    ...(isCouple && draft.spouseLifeExpectancy !== undefined
      ? { spouseLifeExpectancy: draft.spouseLifeExpectancy }
      : {}),
    ...(isCouple && draft.spouseExpectedCPPAt65 !== undefined
      ? { spouseExpectedCPPAt65: draft.spouseExpectedCPPAt65 }
      : {}),
    ...(isCouple && draft.spouseYearsOfResidence !== undefined
      ? { spouseYearsOfResidence: draft.spouseYearsOfResidence }
      : {}),
  };
}

function TimingAgeSelect({
  label,
  value,
  ages,
  onChange,
}: {
  label: string;
  value: number;
  ages: ReadonlyArray<number>;
  onChange: (value: number) => void;
}) {
  return (
    <div className="min-w-28 text-xs font-medium text-ds-on-surface-variant">
      <span className="mb-1 block">{label}</span>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger
          aria-label={`${label} age`}
          className="h-9 rounded-sm border-ds-outline-variant bg-ds-surface text-xs"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ages.map((age) => (
            <SelectItem key={age} value={String(age)}>
              {ageLabel(age)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function TimingNumberInput({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <div className="min-w-32 text-xs font-medium text-ds-on-surface-variant">
      <Label htmlFor={id} className="mb-1 block text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-9 rounded-sm border-ds-outline-variant bg-ds-surface text-xs"
      />
    </div>
  );
}

export function YearByYearTab({
  data,
  nominalRows,
  displayMode = 'nominal',
  scenarioId,
  initialDecisions,
  onScenarioUpdated,
}: YearByYearTabProps) {
  const { toast } = useToast();
  const rows: ProjectionYearRow[] = data.projectionRows ?? [];
  const timingRows = nominalRows ?? rows;
  const modeLabel = displayMode === 'real' ? "Today's Dollars" : 'Nominal CAD';

  const [visibleGroups, setVisibleGroups] = useState<Set<ColumnGroup>>(
    new Set(['income', 'taxes', 'spending', 'balances'])
  );

  // Person-view toggle — Household shows everything; Main/Spouse hide the other person.
  // Mirrors the `viewMode` pattern in SummaryTab so the two tabs stay visually consistent.
  type PersonView = 'household' | 'primary' | 'spouse';
  const [viewMode, setViewMode] = useState<PersonView>('household');

  const toggleGroup = (group: ColumnGroup) => {
    setVisibleGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  // -------------------------------------------------------------------------
  // PHASE 3 — Cascade highlight state (D-75, D-76)
  // - previousRowsRef: snapshot captured at PATCH dispatch via onBeforeSave (D-55, D-76)
  // - highlightedCells: Map<string, true> keyed by `${year}::${columnKey}` (D-75)
  // - clearHighlightTimerRef: setTimeout handle so we can clear on next save (D-57)
  // -------------------------------------------------------------------------
  const previousRowsRef = useRef<ProjectionYearRow[] | null>(null);
  const [highlightedCells, setHighlightedCells] = useState<Map<string, true>>(new Map());
  const clearHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -------------------------------------------------------------------------
  // PHASE 3 — handleScenarioUpdated wrapper (D-57, D-58, D-77)
  //
  // Passed to useOverrideEditor as `onScenarioUpdated`. After /run resolves the
  // hook calls this. We extract fresh rows from updated.result_data.projectionRows,
  // diff against the snapshot, populate the highlight Map, start the 5s timer
  // (clearing any prior timer first), null the snapshot ref, then invoke the
  // parent's onScenarioUpdated?.(updated).
  //
  // If no snapshot was captured (no prior onBeforeSave), we skip the diff and
  // pass through directly (D-58: save-only trigger).
  // -------------------------------------------------------------------------
  const handleScenarioUpdated = useCallback(
    (updated: ProfileScenarioDetail) => {
      if (previousRowsRef.current !== null) {
        const freshRows =
          (updated.result_data as { projectionRows?: ProjectionYearRow[] })?.projectionRows ?? [];
        const changed = diffProjectionRows(previousRowsRef.current, freshRows, displayMode);
        // Clear any pending timer from a prior save (D-57: cleared by next save dispatch)
        if (clearHighlightTimerRef.current !== null) {
          clearTimeout(clearHighlightTimerRef.current);
        }
        setHighlightedCells(changed);
        clearHighlightTimerRef.current = setTimeout(() => {
          setHighlightedCells(new Map());
          clearHighlightTimerRef.current = null;
        }, 5000);
        previousRowsRef.current = null; // snapshot consumed (D-58)
      }
      // Invoke parent callback last (D-77)
      onScenarioUpdated?.(updated);
    },
    [displayMode] // onScenarioUpdated omitted — latest value always called directly; ref in hook handles debounce staleness
  );

  // -------------------------------------------------------------------------
  // PHASE 3 — Cleanup: clear timer on unmount to prevent setState after unmount
  // -------------------------------------------------------------------------
  useEffect(
    () => () => {
      if (clearHighlightTimerRef.current !== null) {
        clearTimeout(clearHighlightTimerRef.current);
      }
    },
    []
  );

  // -------------------------------------------------------------------------
  // PHASE 3 — Helper: returns 'true' | undefined for the data-cascade-highlight
  // attribute (D-60: composite key `${year}::${columnKey}`)
  // -------------------------------------------------------------------------
  const cellHighlight = (year: number, columnKey: string): 'true' | undefined =>
    highlightedCells.has(`${String(year)}::${columnKey}`) ? 'true' : undefined;

  // ---------------------------------------------------------------------------
  // Override editor hook — wires PATCH /decisions + debounced POST /run (D-27..D-29)
  // Only active when scenarioId + initialDecisions are provided.
  // ---------------------------------------------------------------------------
  const emptyDecisions: ScenarioDecisions = {};

  // Stabilise onBeforeSave with a ref so useOverrideEditor's persistAndRecompute
  // useCallback dep array sees a stable reference — prevents unnecessary recreation
  // of savePopover and removeOverride on every parent render.
  const onBeforeSaveRef = useRef<(() => void) | undefined>(undefined);
  onBeforeSaveRef.current = () => {
    // WG-01 (Phase 5): snapshot nominal rows so diff is mode-invariant.
    // Falls back to displayRows when caller hasn't wired nominalRows yet (backward compat).
    previousRowsRef.current = nominalRows ?? rows;
  };
  const stableOnBeforeSave = useCallback(() => onBeforeSaveRef.current?.(), []);

  const editor = useOverrideEditor({
    scenarioId: scenarioId ?? '',
    initialDecisions: initialDecisions ?? emptyDecisions,
    // PHASE 3 (D-55, D-76): capture cascade snapshot at PATCH dispatch
    onBeforeSave: stableOnBeforeSave,
    onScenarioUpdated: handleScenarioUpdated,
  });

  const isEditable = Boolean(scenarioId && initialDecisions);

  // Couple detection — if any row has a defined spouseAge it is a couple projection
  const isCouple = rows.some((r) => r.spouseAge !== undefined);

  // -------------------------------------------------------------------------
  // PHASE 30 Plan 02 — Explainability reasons map.
  //
  // Compute one WithdrawalReason[] per row via the inline `explainYearWithdrawals`
  // adapter, then flatten to a Map keyed `${year}::${account}` so each
  // EditableCell can look up its slice in O(1). Recomputes only when the
  // projection rows or the editor's withdrawalOverrides change.
  // -------------------------------------------------------------------------
  const reasonsByCell = useMemo<Map<string, WithdrawalReason[]>>(() => {
    const map = new Map<string, WithdrawalReason[]>();
    const overrides = editor.decisions.withdrawalOverrides;
    for (const row of rows) {
      const reasons = explainYearWithdrawals({ row, overrides });
      for (const r of reasons) {
        map.set(`${String(row.year)}::${r.account}`, [r]);
      }
    }
    return map;
  }, [rows, editor.decisions.withdrawalOverrides]);

  /**
   * Map an EditableCell `field` token to the `WithdrawalReason['account']`
   * discriminator used by the adapter. Returns undefined for `'spending'`
   * (no withdrawal-reason surface) and for `'rrsp'` (today's row contract
   * does not surface a standalone RRSP withdrawal cell — RRSP merges into
   * the RRIF cell via `isMergedRrifCell`, and the adapter's RRSP branch is
   * reserved for future row-shape extensions).
   */
  const fieldToAccount = (field: string): WithdrawalReason['account'] | undefined => {
    switch (field) {
      case 'rrif':
        return 'rrif';
      case 'tfsa':
        return 'tfsa';
      case 'nonreg':
        return 'nonReg';
      case 'lif':
        return 'lif';
      default:
        return undefined;
    }
  };

  const timingDefaults = useMemo<TimingDraft>(
    () => ({
      cppStartAge:
        initialDecisions?.cppStartAge ?? inferStartAge(timingRows, 'cppIncome', 'age', 65),
      oasStartAge:
        initialDecisions?.oasStartAge ?? inferStartAge(timingRows, 'oasIncome', 'age', 65),
      lifeExpectancy:
        initialDecisions?.lifeExpectancy ?? inferLifeExpectancy(timingRows, 'age', 90),
      expectedCPPAt65:
        initialDecisions?.expectedCPPAt65 ??
        inferBenefitAt65(timingRows, 'cppIncome', 'age', initialDecisions?.cppStartAge ?? 65, 0),
      yearsOfResidence: initialDecisions?.yearsOfResidence ?? 40,
      ...(isCouple
        ? {
            spouseCppStartAge:
              initialDecisions?.spouseCppStartAge ??
              inferStartAge(timingRows, 'spouseCppIncome', 'spouseAge', 65),
            spouseOasStartAge:
              initialDecisions?.spouseOasStartAge ??
              inferStartAge(timingRows, 'spouseOasIncome', 'spouseAge', 65),
            spouseLifeExpectancy:
              initialDecisions?.spouseLifeExpectancy ??
              inferLifeExpectancy(timingRows, 'spouseAge', 90),
            spouseExpectedCPPAt65:
              initialDecisions?.spouseExpectedCPPAt65 ??
              inferBenefitAt65(
                timingRows,
                'spouseCppIncome',
                'spouseAge',
                initialDecisions?.spouseCppStartAge ?? 65,
                0
              ),
            spouseYearsOfResidence: initialDecisions?.spouseYearsOfResidence ?? 40,
          }
        : {}),
    }),
    [
      initialDecisions?.cppStartAge,
      initialDecisions?.oasStartAge,
      initialDecisions?.lifeExpectancy,
      initialDecisions?.expectedCPPAt65,
      initialDecisions?.yearsOfResidence,
      initialDecisions?.spouseCppStartAge,
      initialDecisions?.spouseOasStartAge,
      initialDecisions?.spouseLifeExpectancy,
      initialDecisions?.spouseExpectedCPPAt65,
      initialDecisions?.spouseYearsOfResidence,
      isCouple,
      timingRows,
    ]
  );
  const [timingDraft, setTimingDraft] = useState<TimingDraft>(timingDefaults);
  const [isTimingSaving, setIsTimingSaving] = useState(false);
  const [isComparingTiming, setIsComparingTiming] = useState(false);
  const [isTimingPanelOpen, setIsTimingPanelOpen] = useState(false);
  const [timingComparisons, setTimingComparisons] = useState<TimingComparisonRow[]>([]);
  const [isAssetEditorOpen, setIsAssetEditorOpen] = useState(false);
  const [isAssetSaving, setIsAssetSaving] = useState(false);

  const selectedYear = rows[0]?.year ?? new Date().getFullYear();
  const contributionOverrides = initialDecisions?.contributionOverrides ?? [];
  const rrspContributionOverride = contributionOverrides.find(
    (row) => row.accountType === 'rrsp' || row.accountId?.toLowerCase().includes('rrsp')
  );
  const tfsaContributionOverride = contributionOverrides.find(
    (row) => row.accountType === 'tfsa' || row.accountId?.toLowerCase().includes('tfsa')
  );
  const [assetDraft, setAssetDraft] = useState({
    investmentReturnPct: formatPercentInput(initialDecisions?.investmentReturn),
    rrspContribution: rrspContributionOverride?.annualAmount?.toString() ?? '',
    tfsaContribution: tfsaContributionOverride?.annualAmount?.toString() ?? '',
    drawdownOrder: (initialDecisions?.drawdownOrder ?? [...DEFAULT_DRAW_DOWN_ORDER]).join(','),
    surplusDestination: initialDecisions?.surplusDestination ?? 'nonreg',
    applyFromYear: selectedYear,
  });

  useEffect(() => {
    setTimingDraft(timingDefaults);
  }, [timingDefaults]);

  useEffect(() => {
    setAssetDraft({
      investmentReturnPct: formatPercentInput(initialDecisions?.investmentReturn),
      rrspContribution: rrspContributionOverride?.annualAmount?.toString() ?? '',
      tfsaContribution: tfsaContributionOverride?.annualAmount?.toString() ?? '',
      drawdownOrder: (initialDecisions?.drawdownOrder ?? [...DEFAULT_DRAW_DOWN_ORDER]).join(','),
      surplusDestination: initialDecisions?.surplusDestination ?? 'nonreg',
      applyFromYear: selectedYear,
    });
  }, [
    initialDecisions?.investmentReturn,
    initialDecisions?.drawdownOrder,
    initialDecisions?.surplusDestination,
    rrspContributionOverride?.annualAmount,
    tfsaContributionOverride?.annualAmount,
    selectedYear,
  ]);

  const timingOutcomeSummary = useMemo(() => summarizeTimingOutcomes(rows), [rows]);

  const applyTimingPreset = useCallback(
    (preset: TimingPreset) => {
      setTimingDraft((prev) => ({
        ...prev,
        cppStartAge: preset.cppStartAge,
        oasStartAge: preset.oasStartAge,
        ...(isCouple
          ? {
              spouseCppStartAge: preset.spouseCppStartAge ?? preset.cppStartAge,
              spouseOasStartAge: preset.spouseOasStartAge ?? preset.oasStartAge,
            }
          : {}),
      }));
    },
    [isCouple]
  );

  const isTimingDirty =
    timingDraft.cppStartAge !== timingDefaults.cppStartAge ||
    timingDraft.oasStartAge !== timingDefaults.oasStartAge ||
    timingDraft.lifeExpectancy !== timingDefaults.lifeExpectancy ||
    timingDraft.expectedCPPAt65 !== timingDefaults.expectedCPPAt65 ||
    timingDraft.yearsOfResidence !== timingDefaults.yearsOfResidence ||
    timingDraft.spouseCppStartAge !== timingDefaults.spouseCppStartAge ||
    timingDraft.spouseOasStartAge !== timingDefaults.spouseOasStartAge ||
    timingDraft.spouseLifeExpectancy !== timingDefaults.spouseLifeExpectancy ||
    timingDraft.spouseExpectedCPPAt65 !== timingDefaults.spouseExpectedCPPAt65 ||
    timingDraft.spouseYearsOfResidence !== timingDefaults.spouseYearsOfResidence;

  const handleTimingSave = useCallback(async () => {
    if (!scenarioId) return;
    setIsTimingSaving(true);
    previousRowsRef.current = timingRows;
    try {
      await updateDecisions(scenarioId, timingPatchFromDraft(timingDraft, isCouple));
      const updated = await runProfileScenario(scenarioId);
      handleScenarioUpdated(updated);
      toast({
        title: 'Pension timing updated',
        description: 'The scenario has been recomputed with the new timing assumptions.',
      });
    } catch {
      previousRowsRef.current = null;
      toast({
        variant: 'destructive',
        title: 'Could not update pension timing',
        description: 'Please try again.',
      });
    } finally {
      setIsTimingSaving(false);
    }
  }, [handleScenarioUpdated, isCouple, scenarioId, timingDraft, timingRows, toast]);

  const handleAssetSave = useCallback(async () => {
    if (!scenarioId) return;
    setIsAssetSaving(true);
    previousRowsRef.current = timingRows;
    const startYear = Number(assetDraft.applyFromYear) || selectedYear;
    const contributionPatch = [
      ...(assetDraft.rrspContribution.trim() !== ''
        ? [
            {
              accountType: 'rrsp',
              annualAmount: Number(assetDraft.rrspContribution),
              startYear,
              endYear: 2200,
            },
          ]
        : []),
      ...(assetDraft.tfsaContribution.trim() !== ''
        ? [
            {
              accountType: 'tfsa',
              annualAmount: Number(assetDraft.tfsaContribution),
              startYear,
              endYear: 2200,
            },
          ]
        : []),
    ];
    const drawdownOrder = assetDraft.drawdownOrder
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const investmentReturn = parsePercentInput(assetDraft.investmentReturnPct);

    try {
      await updateDecisions(scenarioId, {
        ...(investmentReturn !== undefined ? { investmentReturn } : {}),
        contributionOverrides: contributionPatch,
        drawdownOrder,
        surplusDestination: assetDraft.surplusDestination,
      });
      const updated = await runProfileScenario(scenarioId);
      handleScenarioUpdated(updated);
      setIsAssetEditorOpen(false);
      toast({
        title: 'Asset assumptions updated',
        description: 'The scenario has been recomputed with the revised asset settings.',
      });
    } catch {
      previousRowsRef.current = null;
      toast({
        variant: 'destructive',
        title: 'Could not update asset assumptions',
        description: 'Please check the values and try again.',
      });
    } finally {
      setIsAssetSaving(false);
    }
  }, [assetDraft, handleScenarioUpdated, scenarioId, selectedYear, timingRows, toast]);

  const handleCompareTiming = useCallback(async () => {
    if (!scenarioId) return;
    setIsComparingTiming(true);
    try {
      const comparisons = await Promise.all(
        TIMING_PRESETS.map(async (preset) => {
          const preview = await previewProfileScenarioDecisions(
            scenarioId,
            timingPatchForPreset(preset, isCouple, timingDraft)
          );
          return {
            ...preset,
            cppBreakevenAge: calculateBreakevenAge(
              timingDraft.expectedCPPAt65,
              65,
              preset.cppStartAge,
              calculateCppFactor(65),
              calculateCppFactor(preset.cppStartAge)
            ),
            oasBreakevenAge: calculateBreakevenAge(
              1,
              65,
              preset.oasStartAge,
              calculateOasFactor(65),
              calculateOasFactor(preset.oasStartAge)
            ),
            ...summarizeTimingOutcomes(extractProjectionRows(preview.result_data)),
          };
        })
      );
      setTimingComparisons(rankTimingComparisons(comparisons));
    } catch {
      toast({
        variant: 'destructive',
        title: 'Could not compare pension timing',
        description: 'Please try again.',
      });
    } finally {
      setIsComparingTiming(false);
    }
  }, [isCouple, scenarioId, timingDraft, toast]);

  const handleApplyComparison = useCallback(
    async (preset: TimingPreset) => {
      if (!scenarioId) return;
      setIsTimingSaving(true);
      previousRowsRef.current = timingRows;
      try {
        await updateDecisions(scenarioId, timingPatchForPreset(preset, isCouple, timingDraft));
        const updated = await runProfileScenario(scenarioId);
        handleScenarioUpdated(updated);
        setTimingDraft((prev) => ({
          ...prev,
          ...timingPatchForPreset(preset, isCouple, timingDraft),
        }));
        toast({
          title: 'Pension timing applied',
          description: `${preset.label} timing has been saved to this scenario.`,
        });
      } catch {
        previousRowsRef.current = null;
        toast({
          variant: 'destructive',
          title: 'Could not apply pension timing',
          description: 'Please try again.',
        });
      } finally {
        setIsTimingSaving(false);
      }
    },
    [handleScenarioUpdated, isCouple, scenarioId, timingDraft, timingRows, toast]
  );

  // viewMode is only meaningful for couples — single projections always show primary.
  const effectiveViewMode: PersonView = isCouple ? viewMode : 'primary';
  // showSpouse gates the inline Sp. Age <td>; the super-group body iteration handles
  // primary / spouse / household column visibility via effectiveOwner filtering.
  const showSpouse =
    isCouple && (effectiveViewMode === 'household' || effectiveViewMode === 'spouse');

  // Sparse column detection — Plan 12-02 / UI-05.
  // One pass over rows yields all seven flags (was 7 inline some-checks).
  // The destructure below keeps every downstream identifier name unchanged.
  const sparseFlags = useMemo(() => {
    let hasGis = false;
    let hasLif = false;
    let hasLiraBalance = false;
    let hasLifBalance = false;
    let hasPensionSplitRaw = false;
    let hasBracketFill = false;
    let hasOverContributionPenalty = false;
    for (const r of rows) {
      if ((r.gisIncome ?? 0) > 0) hasGis = true;
      if ((r.lifWithdrawal ?? 0) > 0) hasLif = true;
      if ((r.liraBalance ?? 0) > 0) hasLiraBalance = true;
      if ((r.lifBalance ?? 0) > 0) hasLifBalance = true;
      if ((r.pensionSplitPercentage ?? 0) > 0) hasPensionSplitRaw = true;
      if ((r.bracketFillWithdrawal ?? 0) > 0 || (r.spouseBracketFillWithdrawal ?? 0) > 0) {
        hasBracketFill = true;
      }
      const p = r.overContributionPenalty;
      if (p !== undefined && p.rrsp + p.tfsa + p.fhsa > 0) hasOverContributionPenalty = true;
    }
    return {
      hasGis,
      hasLif,
      hasLiraBalance,
      hasLifBalance,
      hasPensionSplit: isCouple && hasPensionSplitRaw,
      hasBracketFill,
      hasOverContributionPenalty,
    };
  }, [rows, isCouple]);

  // Phase 14: sparseFlags is consumed directly by selectVisibleSuperGroupColumns;
  // the per-flag destructured locals (hasGis, hasLif, ...) used by the legacy
  // header/body are no longer referenced.

  // -------------------------------------------------------------------------
  // Registry args — Phase 14.
  // Driven by selectVisibleSuperGroupColumns so header rows and body rendering
  // share a single column-visibility predicate (no duplicated column lists).
  // -------------------------------------------------------------------------
  const effectiveOwner: PersonOwner = effectiveViewMode;
  const sparseFlagsForRegistry: SparseFlags = sparseFlags;
  const registryArgs = {
    visibleGroups,
    effectiveOwner,
    isCouple,
    sparseFlags: sparseFlagsForRegistry,
  } as const;

  // ---------------------------------------------------------------------------
  // EditableCell — renders cell content with optional interactive trigger + popover
  // At lg+: wraps in a role="button" with aria-label; below lg: plain text (D-31)
  // Phase 2: gains optional `provenance` prop forwarded to OverrideCellPopover (D-43).
  // ---------------------------------------------------------------------------
  function EditableCell({
    year,
    field,
    label,
    value,
    activeOverride,
    clampInfo,
    secondaryField,
    provenance,
    owner = 'primary',
  }: {
    year: number;
    field: OverrideField;
    label: string;
    value: number;
    activeOverride?: { amount: number; applyForward: boolean } | undefined;
    clampInfo?: { requestedReal: number; clampedTo: number } | undefined;
    secondaryField?: import('./OverrideCellPopover').SecondaryField | undefined;
    /** Phase 2: provenance metadata passed down to OverrideCellPopover (D-43). */
    provenance?: ProvenanceCellMetadata | undefined;
    /** Owner discriminator for couple projections — defaults to primary. */
    owner?: 'primary' | 'spouse';
  }) {
    const isOpen =
      editor.openCell?.year === year &&
      editor.openCell?.field === field &&
      (editor.openCell?.owner ?? 'primary') === owner;

    // Indicators
    const hasActiveOverride = activeOverride !== undefined;
    const isClamped = clampInfo !== undefined;

    // Phase 30 Plan 02 — explainability reasons for THIS cell (non-spending,
    // non-zero withdrawal fields only). Falls back to an empty list which the
    // WithdrawalReasonPopover renders as null.
    const account = fieldToAccount(field);
    const cellReasons: WithdrawalReason[] =
      account !== undefined && value > 0
        ? (reasonsByCell.get(`${String(year)}::${account}`) ?? [])
        : [];
    const reasonRow = rows.find((r) => r.year === year);

    // D5 fix: split cellContent into cellValue (edit trigger contents) and
    // reasonTrigger (sibling), so the popover <button> is never nested inside
    // the role="button" editable trigger — invalid nested-interactive HTML.
    const cellValue = (
      <span className="inline-flex items-center justify-end gap-0.5">
        <MoneyCell value={value} />
        {hasActiveOverride && !isClamped && <OverrideDot />}
        {isClamped && (
          <ClampBadge requestedReal={clampInfo.requestedReal} clampedTo={clampInfo.clampedTo} />
        )}
        {hasActiveOverride && isClamped && <OverrideDot />}
      </span>
    );

    const reasonTrigger =
      cellReasons.length > 0 && reasonRow !== undefined ? (
        <WithdrawalReasonPopover
          reasons={cellReasons}
          row={reasonRow}
          triggerLabel={`${label} ${year}`}
        >
          ?
        </WithdrawalReasonPopover>
      ) : null;

    if (!isEditable) {
      // No override editor props — render read-only.
      return (
        <span className="inline-flex items-center justify-end gap-0.5">
          {cellValue}
          {reasonTrigger}
        </span>
      );
    }

    const editAriaLabel = `Edit ${label} ${year} - current value ${formatCurrency(value)}`;

    return (
      <span className="inline-flex items-center justify-end gap-0.5 w-full">
        {/* Mobile (<lg): plain text only, no interaction (D-31). Reason trigger
            is desktop-only to avoid duplicate DOM elements that break .first()
            focus in Playwright (hidden elements cannot receive focus). */}
        <span className="lg:hidden inline-flex items-center gap-0.5">{cellValue}</span>

        {/* Desktop (lg+): editable trigger + sibling reason trigger */}
        <span className="hidden lg:inline-flex items-center justify-end gap-0.5 w-full">
          {/* Popover — Radix anchors to the trigger via PopoverTrigger asChild */}
          <OverrideCellPopover
            year={year}
            field={field}
            label={`${label} — ${year}`}
            currentDisplayValue={value}
            activeOverride={activeOverride}
            clampInfo={clampInfo}
            open={isOpen}
            onOpenChange={(open) => {
              if (!open) editor.closePopover();
              else editor.openPopover(year, field, owner);
            }}
            onSave={async (payload) => {
              await editor.savePopover({
                primary: {
                  amount: payload.primary.amount,
                  applyForward: payload.primary.applyForward,
                },
                secondary: payload.secondary
                  ? {
                      amount: payload.secondary.amount,
                      applyForward: payload.secondary.applyForward,
                    }
                  : undefined,
              });
            }}
            onCancel={() => editor.closePopover()}
            secondaryField={secondaryField}
            provenance={provenance}
            mode="editable"
            // PHASE 3 (D-69, D-73): wire Remove button to hook's removeOverride()
            onRemoveOverride={
              activeOverride !== undefined
                ? async () => editor.removeOverride(field, year, owner)
                : undefined
            }
            isRemoving={editor.isRemoving}
          >
            <div
              role="button"
              tabIndex={0}
              aria-label={editAriaLabel}
              aria-haspopup="dialog"
              aria-expanded={isOpen}
              className="min-h-7 cursor-pointer inline-flex items-center justify-end rounded-sm px-1 hover:bg-ds-primary/10 focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ds-primary focus-visible:ring-offset-1"
              onClick={() => editor.openPopover(year, field, owner)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  editor.openPopover(year, field, owner);
                }
              }}
            >
              {cellValue}
            </div>
          </OverrideCellPopover>
          {reasonTrigger}
        </span>
      </span>
    );
  }

  // ---------------------------------------------------------------------------
  // ReadOnlyCell — Phase 2 helper (D-45).
  //
  // Renders a clickable inspect trigger for in-scope read-only cells (federalTax,
  // provincialTax, totalTax, totalGrossIncome) and out-of-scope cells (balances,
  // benefits, year/age, etc.) per UI-SPEC §Cell Trigger Classification Map.
  //
  // - inScope=true  → mode='readonly'  — provenance section shown, no edit form (D-42)
  // - inScope=false → mode='placeholder' — locked v4.3 placeholder copy (D-39)
  // - Below lg: plain text only — no button, no popover (D-31 mobile read-only convention)
  // - One popover at a time: uses editor.setOpenCell to widen openCell to string field (D-26)
  //
  // @see .planning/phases/02-cell-provenance/02-UI-SPEC.md §ReadOnlyCell §Cell Trigger Classification Map
  // @see .planning/phases/02-cell-provenance/02-CONTEXT.md - D-39, D-42, D-45
  // ---------------------------------------------------------------------------
  function ReadOnlyCell({
    year,
    field,
    displayValue,
    label,
    provenance,
    inScope,
  }: {
    year: number;
    /** Arbitrary column name used as popover identity key (not an OverrideField). */
    field: string;
    /** Pre-formatted display string, e.g. formatCurrency output. */
    displayValue: string;
    /** Human-readable column label, e.g. "Federal Tax". */
    label: string;
    /** Provenance metadata from row.provenance. Present only for in-scope fields. */
    provenance?: ProvenanceCellMetadata | undefined;
    /**
     * true  → in-scope read-only cell (taxes, totalIncome) — mode='readonly'
     * false → out-of-scope cell (balances, benefits, year/age) — mode='placeholder'
     */
    inScope: boolean;
  }) {
    const isOpen = editor.openCell?.year === year && editor.openCell?.field === field;
    const benefitRow = rows.find((r) => r.year === year);
    const isBenefitField = [
      'cppIncome',
      'oasIncome',
      'spouseCppIncome',
      'spouseOasIncome',
    ].includes(field);

    // UI-SPEC §Copywriting Contract (locked):
    // in-scope:    "Inspect {label} {year} — {formattedValue}"
    // out-of-scope: "Inspect {label} {year}" (no value announced)
    const ariaLabel = inScope
      ? `Inspect ${label} ${year} — ${displayValue}`
      : `Inspect ${label} ${year}`;

    // UI-SPEC §Color: bg-accent/20 for in-scope (inspectable), bg-accent/10 for out-of-scope (lighter)
    const hoverBg = inScope ? 'hover:bg-accent/20' : 'hover:bg-accent/10';
    // UI-SPEC §Out-of-Scope Cell Trigger: cursor-default for placeholder cells
    const cursorClass = inScope ? 'cursor-pointer' : 'cursor-default';

    if (isBenefitField && benefitRow !== undefined) {
      const isSpouseBenefit = field.startsWith('spouse');
      const isCpp = field.toLowerCase().includes('cpp');
      const startAge = isCpp
        ? isSpouseBenefit
          ? (timingDraft.spouseCppStartAge ?? 65)
          : timingDraft.cppStartAge
        : isSpouseBenefit
          ? (timingDraft.spouseOasStartAge ?? 65)
          : timingDraft.oasStartAge;
      const estimateAt65 = isCpp
        ? isSpouseBenefit
          ? (timingDraft.spouseExpectedCPPAt65 ?? 0)
          : timingDraft.expectedCPPAt65
        : inferBenefitAt65(
            timingRows,
            isSpouseBenefit ? 'spouseOasIncome' : 'oasIncome',
            isSpouseBenefit ? 'spouseAge' : 'age',
            startAge,
            0
          );
      const residencyYears = isSpouseBenefit
        ? (timingDraft.spouseYearsOfResidence ?? 40)
        : timingDraft.yearsOfResidence;
      const factor = isCpp ? calculateCppFactor(startAge) : calculateOasFactor(startAge);
      const oasClawback = isSpouseBenefit
        ? (benefitRow.spouseOasClawback ?? 0)
        : benefitRow.oasClawback;
      const age = isSpouseBenefit ? benefitRow.spouseAge : benefitRow.age;
      const currentValue =
        typeof benefitRow[field as keyof ProjectionYearRow] === 'number'
          ? (benefitRow[field as keyof ProjectionYearRow] as number)
          : 0;
      const startAgeLabel = isCpp
        ? isSpouseBenefit
          ? 'Spouse CPP'
          : 'CPP'
        : isSpouseBenefit
          ? 'Spouse OAS'
          : 'OAS';

      return (
        <Popover
          open={isOpen}
          onOpenChange={(open) => {
            if (open) editor.setOpenCell({ year, field });
            else editor.setOpenCell(null);
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Inspect ${label} ${year}`}
              aria-haspopup="dialog"
              aria-expanded={isOpen}
              className="hidden w-full cursor-pointer justify-end rounded-sm hover:bg-accent/20 focus-visible:ring-2 focus-visible:ring-ds-primary/50 focus-visible:ring-offset-1 lg:inline-flex"
            >
              {displayValue}
            </button>
          </PopoverTrigger>
          <span className="lg:hidden">{displayValue}</span>
          <PopoverContent className="w-80" aria-label={`${label} explanation`}>
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-ds-on-background">
                  {label} - {year}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {age !== undefined && age < startAge
                    ? `${startAgeLabel} has not started yet.`
                    : `${startAgeLabel} is paid using the scenario start age and benefit assumptions.`}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <dt className="text-ds-on-surface-variant">Amount</dt>
                <dd className="text-right tabular-nums">{formatCurrency(currentValue)}</dd>
                <dt className="text-ds-on-surface-variant">Start age</dt>
                <dd className="text-right tabular-nums">{startAge}</dd>
                <dt className="text-ds-on-surface-variant">
                  {isCpp ? 'Estimate at 65' : 'OAS at 65'}
                </dt>
                <dd className="text-right tabular-nums">{formatCurrency(estimateAt65)}</dd>
                <dt className="text-ds-on-surface-variant">Adjustment factor</dt>
                <dd className="text-right tabular-nums">{(factor * 100).toFixed(1)}%</dd>
                {!isCpp && (
                  <>
                    <dt className="text-ds-on-surface-variant">Residency factor</dt>
                    <dd className="text-right tabular-nums">
                      {Math.min(residencyYears / 40, 1).toLocaleString('en-CA', {
                        style: 'percent',
                        maximumFractionDigits: 0,
                      })}
                    </dd>
                    <dt className="text-ds-on-surface-variant">Clawback</dt>
                    <dd className="text-right tabular-nums">
                      {oasClawback > 0 ? formatCurrency(oasClawback) : 'No reduction'}
                    </dd>
                  </>
                )}
              </dl>
              <div className="flex items-end gap-2 border-t border-ds-outline-variant pt-3">
                <TimingAgeSelect
                  label="Try different start age"
                  value={startAge}
                  ages={isCpp ? CPP_START_AGES : OAS_START_AGES}
                  onChange={(value) => {
                    setTimingDraft((prev) => ({
                      ...prev,
                      ...(isCpp
                        ? isSpouseBenefit
                          ? { spouseCppStartAge: value }
                          : { cppStartAge: value }
                        : isSpouseBenefit
                          ? { spouseOasStartAge: value }
                          : { oasStartAge: value }),
                    }));
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={isTimingSaving || !scenarioId}
                  onClick={() => void handleTimingSave()}
                  className="h-9 rounded-sm px-3 text-xs"
                >
                  Apply
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      );
    }

    return (
      <>
        {/* lg+: clickable inspect trigger (D-45) */}
        <button
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          className={`hidden lg:inline-flex justify-end w-full ${hoverBg} ${cursorClass} focus-visible:ring-2 focus-visible:ring-ds-primary/50 focus-visible:ring-offset-1 focus-visible:rounded-sm`}
          onClick={() => editor.setOpenCell({ year, field })}
        >
          {displayValue}
        </button>

        {/* Below lg: plain text only — no interaction (D-31 mobile read-only convention) */}
        <span className="lg:hidden">{displayValue}</span>

        {/* Popover — renders only when this is the open cell (D-26 one-at-a-time invariant) */}
        {isOpen && (
          <OverrideCellPopover
            open={isOpen}
            onOpenChange={(o) => {
              if (!o) editor.setOpenCell(null);
            }}
            year={year}
            field={field}
            label={`${label} — ${year}`}
            currentDisplayValue={0}
            onSave={async () => {
              /* read-only/placeholder — no save path */
            }}
            onCancel={() => editor.setOpenCell(null)}
            provenance={provenance}
            mode={inScope ? 'readonly' : 'placeholder'}
          />
        )}
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // renderCell — Plan 12-04 / UI-05; factored out in Plan 12-05.
  //
  // The dispatcher, lookup tables, and per-variant logic live in
  // `./year-by-year-render-cell.tsx`. We inject the lexically-scoped EditableCell
  // and ReadOnlyCell here so they retain closure access to `editor` + `isEditable`.
  // ---------------------------------------------------------------------------
  const renderCell = createRenderCell({ editor, EditableCell, ReadOnlyCell });

  return (
    // MEMORY.md: all <Tooltip> must be inside a <TooltipProvider>
    <TooltipProvider>
      {/* D-31: mobile read-only banner — visible below lg, hidden at lg+ */}
      <div className="block lg:hidden rounded-md border border-ds-outline-variant bg-ds-surface-raised px-4 py-3 text-sm text-ds-on-surface-variant mb-4">
        Open on a desktop browser to edit withdrawals and spending.
      </div>

      <Card className="bg-ds-surface rounded-card border border-ds-outline-variant/70 shadow-sm">
        <CardHeader className="relative gap-4 px-5 py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Year-by-Year Projection</CardTitle>
              <div className="text-xs text-muted-foreground mt-1" data-testid="year-by-year-mode">
                Currency basis: {modeLabel}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 xl:justify-end">
              <div className="inline-flex rounded-md border border-ds-outline-variant bg-ds-surface-raised p-0.5">
                {(['income', 'taxes', 'spending', 'balances'] as ColumnGroup[]).map((group) => (
                  <Button
                    key={group}
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleGroup(group)}
                    className={
                      visibleGroups.has(group)
                        ? 'h-7 rounded-sm bg-ds-primary px-3 text-xs text-ds-on-primary shadow-none hover:bg-ds-primary/90'
                        : 'h-7 rounded-sm px-3 text-xs text-ds-on-surface-variant shadow-none hover:bg-ds-surface-overlay'
                    }
                  >
                    {group.charAt(0).toUpperCase() + group.slice(1)}
                  </Button>
                ))}
              </div>
              {isCouple && (
                <div
                  className="inline-flex rounded-md border border-ds-outline-variant bg-ds-surface-raised p-0.5"
                  role="radiogroup"
                  aria-label="Person view"
                  data-testid="year-by-year-person-view"
                >
                  {(
                    [
                      { id: 'household', label: 'Household' },
                      { id: 'primary', label: 'Main' },
                      { id: 'spouse', label: 'Spouse' },
                    ] as Array<{ id: PersonView; label: string }>
                  ).map(({ id, label }) => (
                    <Button
                      key={id}
                      size="sm"
                      role="radio"
                      aria-checked={viewMode === id}
                      variant="ghost"
                      onClick={() => setViewMode(id)}
                      className={
                        viewMode === id
                          ? 'h-7 rounded-sm bg-ds-primary px-3 text-xs text-ds-on-primary shadow-none hover:bg-ds-primary/90'
                          : 'h-7 rounded-sm px-3 text-xs text-ds-on-surface-variant shadow-none hover:bg-ds-surface-overlay'
                      }
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {rows.length > 0 && (
            <div className="mt-1 text-xs text-muted-foreground">
              Column terms:{' '}
              {(() => {
                const terms: Array<{ slug: string; label: string; show: boolean }> = [
                  { slug: 'rrsp', label: 'RRSP', show: true },
                  { slug: 'rrif', label: 'RRIF', show: true },
                  { slug: 'tfsa', label: 'TFSA', show: true },
                  { slug: 'lira', label: 'LIRA', show: sparseFlags.hasLiraBalance },
                  {
                    slug: 'lif',
                    label: 'LIF',
                    show: sparseFlags.hasLif || sparseFlags.hasLifBalance,
                  },
                  { slug: 'gis', label: 'GIS', show: sparseFlags.hasGis },
                  { slug: 'oas', label: 'OAS', show: true },
                  { slug: 'cpp', label: 'CPP', show: true },
                  { slug: 'nominal-vs-real', label: 'nominal vs real', show: true },
                ].filter((t) => t.show);
                return terms.map((t, idx) => (
                  <span key={t.slug}>
                    {idx > 0 && ', '}
                    <a
                      href={`/glossary#${t.slug}`}
                      className="underline-offset-2 hover:text-ds-primary hover:underline"
                    >
                      {t.label}
                    </a>
                  </span>
                ));
              })()}
            </div>
          )}
          {/* D-29: recomputing indicator — aria-live so screen readers announce it */}
          {editor.isRecomputing && (
            <div className="absolute right-4 top-4 flex items-center gap-1" aria-live="polite">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Recomputing…</span>
            </div>
          )}
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {rows.length === 0 ? (
            <div className="py-12 text-center">
              <p className="font-medium text-ds-on-background">No projection data available</p>
              <p className="text-sm text-muted-foreground mt-2">
                Run a projection to see your year-by-year results.
              </p>
            </div>
          ) : (
            <>
              {isEditable && (
                <Collapsible
                  open={isTimingPanelOpen}
                  onOpenChange={setIsTimingPanelOpen}
                  className="mb-4 rounded-md border border-ds-outline-variant bg-ds-surface-raised/50"
                >
                  <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-3 text-left">
                    <div className="min-w-0">
                      <h4 className="text-sm font-medium text-ds-on-background">
                        Government pension timing
                      </h4>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        CPP @ {timingDraft.cppStartAge} · OAS @ {timingDraft.oasStartAge} · Life{' '}
                        {timingDraft.lifeExpectancy}
                        {isCouple && timingDraft.spouseCppStartAge !== undefined && (
                          <> · Spouse CPP @ {timingDraft.spouseCppStartAge}</>
                        )}
                      </p>
                    </div>
                    <ChevronDown
                      aria-hidden="true"
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform${
                        isTimingPanelOpen ? ' rotate-180' : ''
                      }`}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="flex flex-col gap-3 px-3 pb-3 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Explore CPP, OAS, and planning life expectancy, then recompute this
                        scenario.
                      </p>
                      <div
                        className="mt-3 flex flex-wrap gap-2"
                        aria-label="Government pension timing presets"
                      >
                        {TIMING_PRESETS.map((preset) => (
                          <Button
                            key={preset.id}
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => applyTimingPreset(preset)}
                            className="h-8 rounded-sm border-ds-outline-variant bg-ds-surface px-2.5 text-xs text-ds-on-surface hover:bg-ds-surface-overlay"
                          >
                            {preset.label}
                          </Button>
                        ))}
                        <Button
                          type="button"
                          size="sm"
                          disabled={isComparingTiming || isTimingSaving}
                          onClick={() => void handleCompareTiming()}
                          className="h-8 rounded-sm bg-ds-primary px-2.5 text-xs text-ds-on-primary hover:bg-ds-primary/90"
                        >
                          {isComparingTiming ? (
                            <>
                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                              Comparing
                            </>
                          ) : (
                            'Compare Timing'
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3">
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:flex 2xl:items-end">
                        <TimingAgeSelect
                          label="CPP"
                          value={timingDraft.cppStartAge}
                          ages={CPP_START_AGES}
                          onChange={(value) =>
                            setTimingDraft((prev) => ({ ...prev, cppStartAge: value }))
                          }
                        />
                        <TimingAgeSelect
                          label="OAS"
                          value={timingDraft.oasStartAge}
                          ages={OAS_START_AGES}
                          onChange={(value) =>
                            setTimingDraft((prev) => ({ ...prev, oasStartAge: value }))
                          }
                        />
                        <TimingAgeSelect
                          label="Life expectancy"
                          value={timingDraft.lifeExpectancy}
                          ages={LIFE_EXPECTANCY_AGES}
                          onChange={(value) =>
                            setTimingDraft((prev) => ({ ...prev, lifeExpectancy: value }))
                          }
                        />
                        <TimingNumberInput
                          label="CPP at 65"
                          value={timingDraft.expectedCPPAt65}
                          max={25000}
                          onChange={(value) =>
                            setTimingDraft((prev) => ({ ...prev, expectedCPPAt65: value }))
                          }
                        />
                        <TimingNumberInput
                          label="OAS residence"
                          value={timingDraft.yearsOfResidence}
                          max={70}
                          onChange={(value) =>
                            setTimingDraft((prev) => ({ ...prev, yearsOfResidence: value }))
                          }
                        />
                        {isCouple && timingDraft.spouseCppStartAge !== undefined && (
                          <TimingAgeSelect
                            label="Spouse CPP"
                            value={timingDraft.spouseCppStartAge}
                            ages={CPP_START_AGES}
                            onChange={(value) =>
                              setTimingDraft((prev) => ({ ...prev, spouseCppStartAge: value }))
                            }
                          />
                        )}
                        {isCouple && timingDraft.spouseOasStartAge !== undefined && (
                          <TimingAgeSelect
                            label="Spouse OAS"
                            value={timingDraft.spouseOasStartAge}
                            ages={OAS_START_AGES}
                            onChange={(value) =>
                              setTimingDraft((prev) => ({ ...prev, spouseOasStartAge: value }))
                            }
                          />
                        )}
                        {isCouple && timingDraft.spouseLifeExpectancy !== undefined && (
                          <TimingAgeSelect
                            label="Spouse life"
                            value={timingDraft.spouseLifeExpectancy}
                            ages={LIFE_EXPECTANCY_AGES}
                            onChange={(value) =>
                              setTimingDraft((prev) => ({ ...prev, spouseLifeExpectancy: value }))
                            }
                          />
                        )}
                        {isCouple && timingDraft.spouseExpectedCPPAt65 !== undefined && (
                          <TimingNumberInput
                            label="Spouse CPP at 65"
                            value={timingDraft.spouseExpectedCPPAt65}
                            max={25000}
                            onChange={(value) =>
                              setTimingDraft((prev) => ({
                                ...prev,
                                spouseExpectedCPPAt65: value,
                              }))
                            }
                          />
                        )}
                        {isCouple && timingDraft.spouseYearsOfResidence !== undefined && (
                          <TimingNumberInput
                            label="Spouse OAS residence"
                            value={timingDraft.spouseYearsOfResidence}
                            max={70}
                            onChange={(value) =>
                              setTimingDraft((prev) => ({
                                ...prev,
                                spouseYearsOfResidence: value,
                              }))
                            }
                          />
                        )}
                        <Button
                          type="button"
                          size="sm"
                          disabled={!isTimingDirty || isTimingSaving}
                          onClick={() => void handleTimingSave()}
                          className="h-9 rounded-sm bg-ds-primary px-3 text-xs text-ds-on-primary hover:bg-ds-primary/90"
                        >
                          {isTimingSaving ? (
                            <>
                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                              Recomputing
                            </>
                          ) : (
                            'Apply Timing'
                          )}
                        </Button>
                      </div>
                      <dl
                        className="grid gap-x-4 gap-y-2 border-t border-ds-outline-variant pt-3 text-xs sm:grid-cols-2 lg:grid-cols-6"
                        aria-label="Government pension timing outcome summary"
                      >
                        <div>
                          <dt className="text-ds-on-surface-variant">Final estate / NW</dt>
                          <dd className="mt-0.5 font-medium tabular-nums text-ds-on-background">
                            {formatCurrency(timingOutcomeSummary.finalEstateOrNetWorth)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-ds-on-surface-variant">Depletion</dt>
                          <dd className="mt-0.5 font-medium tabular-nums text-ds-on-background">
                            {timingOutcomeSummary.depletion !== undefined
                              ? `Age ${String(timingOutcomeSummary.depletion.age)} / ${String(
                                  timingOutcomeSummary.depletion.year
                                )}`
                              : 'Not projected'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-ds-on-surface-variant">Lifetime income</dt>
                          <dd className="mt-0.5 font-medium tabular-nums text-ds-on-background">
                            {formatCurrency(timingOutcomeSummary.lifetimeIncome)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-ds-on-surface-variant">Lifetime CPP</dt>
                          <dd className="mt-0.5 font-medium tabular-nums text-ds-on-background">
                            {formatCurrency(timingOutcomeSummary.lifetimeCpp)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-ds-on-surface-variant">Lifetime OAS</dt>
                          <dd className="mt-0.5 font-medium tabular-nums text-ds-on-background">
                            {formatCurrency(timingOutcomeSummary.lifetimeOas)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-ds-on-surface-variant">OAS clawback</dt>
                          <dd className="mt-0.5 font-medium tabular-nums text-ds-on-background">
                            {formatCurrency(timingOutcomeSummary.lifetimeOasClawback)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-ds-on-surface-variant">Funded status</dt>
                          <dd className="mt-0.5 font-medium tabular-nums text-ds-on-background">
                            {timingOutcomeSummary.fundedStatus}
                          </dd>
                        </div>
                      </dl>
                      {timingComparisons.length > 0 && (
                        <div className="overflow-x-auto border-t border-ds-outline-variant pt-3">
                          <table
                            className="w-full min-w-[940px] border-separate border-spacing-0 text-xs"
                            aria-label="Pension timing comparison"
                          >
                            <thead className="text-left text-ds-on-surface-variant">
                              <tr>
                                <th className="px-2 py-1 font-medium">Rank</th>
                                <th className="px-2 py-1 font-medium">Preset</th>
                                <th className="px-2 py-1 text-right font-medium">
                                  Lifetime income
                                </th>
                                <th className="px-2 py-1 text-right font-medium">
                                  Final estate / NW
                                </th>
                                <th className="px-2 py-1 font-medium">Depletion</th>
                                <th className="px-2 py-1 text-right font-medium">CPP + OAS</th>
                                <th className="px-2 py-1 text-right font-medium">Clawback</th>
                                <th className="px-2 py-1 text-right font-medium">Breakeven</th>
                                <th className="px-2 py-1 font-medium">Funded</th>
                                <th className="px-2 py-1 text-right font-medium">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {timingComparisons.map((row) => (
                                <tr
                                  key={row.id}
                                  className={
                                    row.isBest
                                      ? 'bg-ds-primary-container text-ds-on-primary-container'
                                      : 'text-ds-on-surface'
                                  }
                                >
                                  <td className="border-t border-ds-outline-variant/60 px-2 py-2 font-medium">
                                    {row.rank}
                                  </td>
                                  <td className="border-t border-ds-outline-variant/60 px-2 py-2">
                                    <span className="font-medium">{row.label}</span>
                                    <span className="ml-1 text-ds-on-surface-variant">
                                      CPP {row.cppStartAge} / OAS {row.oasStartAge}
                                    </span>
                                  </td>
                                  <td className="border-t border-ds-outline-variant/60 px-2 py-2 text-right tabular-nums">
                                    {formatCurrency(row.lifetimeIncome)}
                                  </td>
                                  <td className="border-t border-ds-outline-variant/60 px-2 py-2 text-right tabular-nums">
                                    {formatCurrency(row.finalEstateOrNetWorth)}
                                  </td>
                                  <td className="border-t border-ds-outline-variant/60 px-2 py-2 tabular-nums">
                                    {row.depletion !== undefined
                                      ? `Age ${String(row.depletion.age)} / ${String(
                                          row.depletion.year
                                        )}`
                                      : 'Not projected'}
                                  </td>
                                  <td className="border-t border-ds-outline-variant/60 px-2 py-2 text-right tabular-nums">
                                    {formatCurrency(row.lifetimeCpp + row.lifetimeOas)}
                                  </td>
                                  <td className="border-t border-ds-outline-variant/60 px-2 py-2 text-right tabular-nums">
                                    {formatCurrency(row.lifetimeOasClawback)}
                                  </td>
                                  <td className="border-t border-ds-outline-variant/60 px-2 py-2 text-right tabular-nums">
                                    CPP {formatBreakeven(row.cppBreakevenAge)} / OAS{' '}
                                    {formatBreakeven(row.oasBreakevenAge)}
                                  </td>
                                  <td className="border-t border-ds-outline-variant/60 px-2 py-2">
                                    {row.fundedStatus}
                                  </td>
                                  <td className="border-t border-ds-outline-variant/60 px-2 py-2 text-right">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant={row.isBest ? 'default' : 'outline'}
                                      disabled={isTimingSaving || isComparingTiming}
                                      onClick={() => void handleApplyComparison(row)}
                                      className="h-7 rounded-sm px-2 text-xs"
                                    >
                                      Apply
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
              {isEditable && (
                <Dialog open={isAssetEditorOpen} onOpenChange={setIsAssetEditorOpen}>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="text-base">Financial assets editor</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 text-sm md:grid-cols-2">
                      <div>
                        <Label htmlFor="asset-return">Expected return rate (%)</Label>
                        <Input
                          id="asset-return"
                          type="number"
                          min={0}
                          max={20}
                          step={0.1}
                          value={assetDraft.investmentReturnPct}
                          onChange={(event) =>
                            setAssetDraft((prev) => ({
                              ...prev,
                              investmentReturnPct: event.target.value,
                            }))
                          }
                          className="mt-1 h-9 rounded-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="asset-apply-year">Apply from year</Label>
                        <Input
                          id="asset-apply-year"
                          type="number"
                          min={rows[0]?.year ?? 1900}
                          max={2200}
                          value={assetDraft.applyFromYear}
                          onChange={(event) =>
                            setAssetDraft((prev) => ({
                              ...prev,
                              applyFromYear: Number(event.target.value),
                            }))
                          }
                          className="mt-1 h-9 rounded-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="asset-rrsp">RRSP contribution override ($)</Label>
                        <Input
                          id="asset-rrsp"
                          type="number"
                          min={0}
                          value={assetDraft.rrspContribution}
                          onChange={(event) =>
                            setAssetDraft((prev) => ({
                              ...prev,
                              rrspContribution: event.target.value,
                            }))
                          }
                          className="mt-1 h-9 rounded-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="asset-tfsa">TFSA contribution override ($)</Label>
                        <Input
                          id="asset-tfsa"
                          type="number"
                          min={0}
                          value={assetDraft.tfsaContribution}
                          onChange={(event) =>
                            setAssetDraft((prev) => ({
                              ...prev,
                              tfsaContribution: event.target.value,
                            }))
                          }
                          className="mt-1 h-9 rounded-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="asset-nonreg">Non-registered contribution override</Label>
                        <Input
                          id="asset-nonreg"
                          disabled
                          value="Not yet supported"
                          className="mt-1 h-9 rounded-sm"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          The current engine accepts RRSP and TFSA contribution overrides only.
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="asset-surplus">Surplus destination</Label>
                        <Select
                          value={assetDraft.surplusDestination}
                          onValueChange={(value) =>
                            setAssetDraft((prev) => ({
                              ...prev,
                              surplusDestination: value as typeof assetDraft.surplusDestination,
                            }))
                          }
                        >
                          <SelectTrigger id="asset-surplus" className="mt-1 h-9 rounded-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SURPLUS_DESTINATIONS.map((destination) => (
                              <SelectItem key={destination} value={destination}>
                                {destination}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="asset-drawdown">Withdrawal order</Label>
                        <Input
                          id="asset-drawdown"
                          value={assetDraft.drawdownOrder}
                          onChange={(event) =>
                            setAssetDraft((prev) => ({
                              ...prev,
                              drawdownOrder: event.target.value,
                            }))
                          }
                          className="mt-1 h-9 rounded-sm font-mono text-xs"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Comma-separated account keys, for example nonReg, tfsa, rrsp, rrif.
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 border-t border-ds-outline-variant pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 rounded-sm px-3 text-xs"
                        onClick={() => setIsAssetEditorOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        disabled={isAssetSaving}
                        className="h-8 rounded-sm px-3 text-xs"
                        onClick={() => void handleAssetSave()}
                      >
                        {isAssetSaving ? (
                          <>
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            Saving
                          </>
                        ) : (
                          'Apply Assets'
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              {/* Phase 30 Plan 02 — active withdrawal overrides banner.
                  Returns null when there are no overrides, so this slot is a no-op
                  for projection runs without an override decision yet. */}
              <OverrideSummary overrides={editor.decisions.withdrawalOverrides} />
              <div className="rounded-md border border-ds-outline-variant bg-ds-surface shadow-inner">
                <div className="overflow-x-auto">
                  <div className="max-h-[68vh] overflow-y-auto">
                    <table className="year-by-year-grid w-full border-separate border-spacing-0 text-xs">
                      <thead>
                        {/* Phase 14 — Row 1: super-group labels (HDR-01).
                        sticky top-0 z-20; bg-ds-surface-raised text-xs font-bold uppercase tracking-wide
                        text-ds-on-surface-variant; no border-bottom (Rows 1+2 visually fuse). */}
                        <tr className="sticky top-0 z-20 bg-ds-surface-raised text-[11px] font-bold uppercase text-ds-on-surface-variant">
                          {SUPER_GROUP_ORDER.map((sg: SuperGroup) => {
                            const cols = selectVisibleSuperGroupColumns(sg, registryArgs);
                            if (cols.length === 0) return null;

                            // The Age super-group contains the sticky-Year identity column.
                            // Render super-group label as the Age <th> with the sticky-left + z-30 chrome
                            // collapsed onto the FIRST cell of the row so horizontal scroll keeps the Year visible.
                            if (sg === 'Age') {
                              return (
                                <th
                                  key={sg}
                                  scope="colgroup"
                                  colSpan={cols.length}
                                  className="sticky left-0 z-30 border-b border-r border-ds-outline-variant bg-ds-surface-raised px-2 py-2 text-left"
                                >
                                  {sg}
                                </th>
                              );
                            }

                            return (
                              <th
                                key={sg}
                                scope="colgroup"
                                colSpan={cols.length}
                                className="border-b border-l border-ds-outline-variant px-2 py-2 text-center"
                              >
                                <span className="inline-flex items-center justify-center gap-1.5">
                                  {sg}
                                  {isEditable && (sg === 'Capital Assets' || sg === 'Balance') && (
                                    <button
                                      type="button"
                                      aria-label={`Edit ${sg} assumptions`}
                                      className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-ds-on-surface-variant hover:bg-ds-surface-overlay hover:text-ds-on-background focus-visible:ring-2 focus-visible:ring-ds-primary/50"
                                      onClick={() => setIsAssetEditorOpen(true)}
                                    >
                                      <Pencil className="h-3 w-3" aria-hidden="true" />
                                    </button>
                                  )}
                                </span>
                              </th>
                            );
                          })}
                        </tr>

                        {/* Phase 14 — Row 2: sub-group labels under Income; empty placeholder per flat super-group (HDR-01).
                        sticky top-[28px] z-[15]; bg-ds-surface-raised text-[11px] font-medium text-ds-on-surface-variant;
                        no border-bottom. */}
                        <tr className="sticky top-[29px] z-[15] bg-ds-surface-raised text-[11px] font-medium text-ds-on-surface-variant">
                          {SUPER_GROUP_ORDER.map((sg: SuperGroup) => {
                            const cols = selectVisibleSuperGroupColumns(sg, registryArgs);
                            if (cols.length === 0) return null;

                            if (sg === 'Income') {
                              // Three labeled sub-group cells in INCOME_SUB_GROUP_ORDER, omit empties.
                              return INCOME_SUB_GROUP_ORDER.map((subg) => {
                                const subCols = cols.filter((c) => c.subGroup === subg);
                                if (subCols.length === 0) return null;
                                return (
                                  <th
                                    key={`income-${subg}`}
                                    scope="colgroup"
                                    colSpan={subCols.length}
                                    className="border-b border-l border-ds-outline-variant/80 px-2 py-2 text-center"
                                  >
                                    {subg}
                                  </th>
                                );
                              });
                            }

                            // Flat super-group — single empty placeholder spanning the super-group's column count.
                            // Age placeholder also carries sticky-left + z-[25] so the Year column stays visible.
                            if (sg === 'Age') {
                              return (
                                <th
                                  key={`placeholder-${sg}`}
                                  colSpan={cols.length}
                                  aria-hidden="true"
                                  className="sticky left-0 z-[25] border-b border-r border-ds-outline-variant bg-ds-surface-raised px-2 py-1"
                                />
                              );
                            }

                            return (
                              <th
                                key={`placeholder-${sg}`}
                                colSpan={cols.length}
                                aria-hidden="true"
                                className="border-b border-l border-ds-outline-variant/80 px-2 py-1"
                              />
                            );
                          })}
                        </tr>

                        {/* Phase 14 — Row 3: column header row (HDR-01); MIGRATED from top-[28px] to top-[52px].
                        sticky top-[52px] z-10; bg-ds-surface border-b border-ds-outline-variant. */}
                        <tr className="sticky top-[57px] z-10 bg-ds-surface text-[12px]">
                          {SUPER_GROUP_ORDER.flatMap((sg: SuperGroup) => {
                            const cols = selectVisibleSuperGroupColumns(sg, registryArgs);
                            if (cols.length === 0) return [];

                            return cols.map((col) => {
                              // Identity columns retain their existing per-key chrome (sticky Year, narrow Age widths).
                              if (col.key === 'year') {
                                return (
                                  <th
                                    key={col.key}
                                    scope="col"
                                    className="sticky left-0 z-20 w-16 min-w-16 border-b border-r border-ds-outline-variant bg-ds-surface px-2 py-3 text-left font-bold text-ds-on-background"
                                    title={col.title}
                                  >
                                    {col.label}
                                  </th>
                                );
                              }
                              if (col.key === 'age') {
                                return (
                                  <th
                                    key={col.key}
                                    scope="col"
                                    className="w-12 min-w-12 border-b border-ds-outline-variant px-2 py-3 text-left font-bold text-ds-on-background"
                                    title={col.title}
                                  >
                                    {col.label}
                                  </th>
                                );
                              }
                              if (col.key === 'spouseAge') {
                                return (
                                  <th
                                    key={col.key}
                                    scope="col"
                                    className="w-20 min-w-20 border-b border-ds-outline-variant px-2 py-3 text-left font-bold leading-tight text-ds-on-background"
                                    title={col.title}
                                  >
                                    {col.label}
                                  </th>
                                );
                              }
                              // All non-identity columns — right-aligned bold label, preserve title.
                              return (
                                <th
                                  key={col.key}
                                  scope="col"
                                  className="min-w-24 max-w-32 border-b border-ds-outline-variant px-2 py-3 text-right align-bottom font-bold leading-tight text-ds-on-background"
                                  title={col.title}
                                >
                                  {col.label}
                                </th>
                              );
                            });
                          })}
                        </tr>
                      </thead>

                      <tbody>
                        {rows.map((row, index) => {
                          const prevRow = rows[index - 1];
                          const isFirstRetiredRow = row.isRetired && !(prevRow?.isRetired ?? false);
                          const isDepletion = row.householdNetWorth <= 0;

                          const rowClass = isDepletion
                            ? 'bg-ds-error-container hover:bg-ds-surface-raised transition-colors'
                            : isFirstRetiredRow
                              ? 'bg-ds-primary-container hover:bg-ds-surface-raised transition-colors'
                              : index % 2 === 1
                                ? 'bg-ds-surface-raised/60 hover:bg-ds-surface-raised transition-colors'
                                : 'hover:bg-ds-surface-raised transition-colors';

                          // Plan 12-04 / Phase 14: per-row override metadata + RRIF merged-cell
                          // logic lives in renderCell (closes over `editor` lexically). Body cells
                          // are now driven by SUPER_GROUP_ORDER + selectVisibleSuperGroupColumns so
                          // that column slots line up with Row 3 of the sticky header.

                          return (
                            <tr key={row.year} data-year={row.year} className={rowClass}>
                              {/* Identity cells — out-of-scope placeholder triggers (D-39) */}
                              <td
                                className="sticky left-0 z-10 border-b border-r border-ds-outline-variant/60 bg-inherit px-2 py-2 tabular-nums"
                                data-cascade-highlight={cellHighlight(row.year, 'year')}
                              >
                                <ReadOnlyCell
                                  year={row.year}
                                  field="year"
                                  displayValue={String(row.year)}
                                  label="Year"
                                  inScope={false}
                                />
                                {row.isRRIFConversionYear && (
                                  <span className="ml-1 text-xs rounded-full px-1.5 py-0.5 bg-ds-primary-container text-ds-on-primary-container">
                                    RRIF
                                  </span>
                                )}
                                {row.householdNetCashFlow < -1 && (
                                  <ShortfallBadge shortfall={row.householdNetCashFlow} />
                                )}
                              </td>
                              <td
                                className="border-b border-ds-outline-variant/50 px-2 py-2 tabular-nums"
                                data-cascade-highlight={cellHighlight(row.year, 'age')}
                              >
                                <ReadOnlyCell
                                  year={row.year}
                                  field="age"
                                  displayValue={String(row.age)}
                                  label="Age"
                                  inScope={false}
                                />
                                {isFirstRetiredRow && (
                                  <span className="ml-1 text-xs text-ds-primary font-bold">
                                    (Retire)
                                  </span>
                                )}
                              </td>
                              {showSpouse && (
                                <td
                                  className="border-b border-ds-outline-variant/50 px-2 py-2 tabular-nums"
                                  data-cascade-highlight={cellHighlight(row.year, 'spouseAge')}
                                >
                                  <ReadOnlyCell
                                    year={row.year}
                                    field="spouseAge"
                                    displayValue={
                                      row.spouseAge !== undefined && row.spouseAge !== null
                                        ? String(row.spouseAge)
                                        : '—'
                                    }
                                    label="Sp. Age"
                                    inScope={false}
                                  />
                                </td>
                              )}

                              {/* Income / Tax / Capital Assets / Balance cells —
                              Phase 14 / CR-01 fix: body iteration now mirrors Row 3 of the
                              header by walking SUPER_GROUP_ORDER + selectVisibleSuperGroupColumns
                              instead of the legacy ['income','taxes','spending','balances'] groups.
                              This keeps body cells aligned with header column slots across the
                              spending/balances → Capital Assets/Balance super-group boundary.
                              Identity columns (Year/Age/Sp. Age) continue to render inline above. */}
                              {SUPER_GROUP_ORDER.flatMap((sg: SuperGroup) => {
                                if (sg === 'Age') return [];
                                const cols = selectVisibleSuperGroupColumns(sg, registryArgs);
                                return cols.map((col: ColumnDef) => {
                                  // Derive the renderCell owner from showFor:
                                  //   showFor === ['household']           → household-only column
                                  //   showFor includes 'spouse' but not 'primary' → spouse column
                                  //   otherwise (includes 'primary')      → primary column
                                  const owner: PersonOwner =
                                    col.showFor.length === 1 && col.showFor[0] === 'household'
                                      ? 'household'
                                      : col.showFor.includes('spouse') &&
                                          !col.showFor.includes('primary')
                                        ? 'spouse'
                                        : 'primary';
                                  return (
                                    <td
                                      key={col.key}
                                      data-column-key={col.key}
                                      data-year={row.year}
                                      data-cascade-highlight={cellHighlight(row.year, col.key)}
                                      className={tdClassNameFor(col)}
                                    >
                                      {renderCell(col, row, owner)}
                                    </td>
                                  );
                                });
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Legend */}
          <div className="mt-4 rounded-md border border-ds-outline-variant bg-ds-surface-raised/60 p-3">
            <h4 className="mb-2 text-sm font-medium text-ds-on-background">Column Descriptions</h4>
            <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
              <div>
                <strong>Income group:</strong> Employment, pension, government benefits (CPP, OAS),
                and account withdrawals
              </div>
              <div>
                <strong>Taxes group:</strong> Federal and provincial income tax; OAS clawback;
                effective tax rate
              </div>
              <div>
                <strong>Spending group:</strong> Annual living expenses and net cash flow after all
                costs and taxes
              </div>
              <div>
                <strong>Balances group:</strong> Account balances at year end; household net worth
              </div>
              <div>
                <strong>Retirement row (green):</strong> First year of retirement
              </div>
              <div>
                <strong>Depletion row (red):</strong> Household net worth has reached zero or below
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
