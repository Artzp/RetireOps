'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { OverrideCellPopover } from './OverrideCellPopover';
import { TimingAgeSelect } from './year-by-year-timing-inputs';
import {
  inferBenefitAt65,
  calculateCppFactor,
  calculateOasFactor,
  type TimingDraft,
} from './year-by-year-helpers';
import { CPP_START_AGES, OAS_START_AGES } from '@/lib/pension-ages';
import { useOverrideEditor } from '@/hooks/useOverrideEditor';
import type { ProjectionYearRow } from '@retireops/shared/types';
import type { ReadOnlyCellProps } from './year-by-year-render-cell';

/** Editor surface this cell needs — the full useOverrideEditor return. */
type OverrideEditor = ReturnType<typeof useOverrideEditor>;

interface InjectedDeps {
  editor: OverrideEditor;
  rows: ProjectionYearRow[];
  /** Mode-invariant nominal rows used for benefit-at-65 inference. */
  timingRows: ProjectionYearRow[];
  timingDraft: TimingDraft;
  setTimingDraft: Dispatch<SetStateAction<TimingDraft>>;
  isTimingSaving: boolean;
  scenarioId: string | undefined;
  onTimingSave: () => void;
}

/**
 * ReadOnlyCell — Phase 2 helper (D-45). Clickable inspect trigger for in-scope
 * read-only cells (taxes, total income) and out-of-scope cells (balances,
 * benefits, year/age), per UI-SPEC §Cell Trigger Classification Map. CPP/OAS
 * benefit cells open a richer popover with a "try different start age" editor.
 *
 * Extracted from YearByYearTab's lexically-scoped inner component; the injected
 * deps are bound by the host and passed in as props.
 */
export function ReadOnlyCell({
  year,
  field,
  displayValue,
  label,
  provenance,
  inScope,
  editor,
  rows,
  timingRows,
  timingDraft,
  setTimingDraft,
  isTimingSaving,
  scenarioId,
  onTimingSave,
}: ReadOnlyCellProps & InjectedDeps) {
  const isOpen = editor.openCell?.year === year && editor.openCell?.field === field;
  const benefitRow = rows.find((r) => r.year === year);
  const isBenefitField = ['cppIncome', 'oasIncome', 'spouseCppIncome', 'spouseOasIncome'].includes(
    field
  );

  // UI-SPEC §Copywriting Contract (locked):
  // in-scope:    "Inspect {label} {year} — {formattedValue}"
  // out-of-scope: "Inspect {label} {year}" (no value announced)
  const ariaLabel = inScope
    ? `Inspect ${label} ${String(year)} — ${displayValue}`
    : `Inspect ${label} ${String(year)}`;

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
            aria-label={`Inspect ${label} ${String(year)}`}
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
                onClick={onTimingSave}
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
          label={`${label} — ${String(year)}`}
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
