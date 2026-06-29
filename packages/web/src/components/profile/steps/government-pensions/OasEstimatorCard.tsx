/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/restrict-template-expressions */
'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Callout } from '@/components/ui/callout';
import { SourceCitationLink } from '@/components/citations/SourceCitationLink';
import { pensionCitation, PENSION_CITATION_DOC } from './pension-citation';
import { ConfidenceChip } from '@/components/citations/ConfidenceChip';
import { YearTag } from '@/components/citations/YearTag';
import { roundAnnual, roundMonthly } from '@/lib/precision';
import {
  estimateOAS,
  OAS_FLOOR_MESSAGE,
  OAS_FULL_PENSION_YEARS,
  OAS_MIN_QUALIFYING_YEARS,
  OAS_2026,
} from '@retireops/shared/benefits';
import type { BenefitSourceMode, BenefitEstimateConfidence } from '@retireops/shared/types';

type Person = 'primary' | 'spouse';

interface OasEstimatorCardProps {
  person: Person;
  /** Display label for province ("Ontario", "Quebec", ...) — passed by parent. Unused in OAS today but kept for symmetry with CppEstimatorCard and possible future routing. */
  provinceLabel: string;
}

// Source-of-truth anchors. OAS is a single federal program (no provincial routing), so a single
// constant suffices — distinct from CPP's CPP/QPP anchor map.
const OAS_AMOUNT_ANCHOR = '2026-oas-q2-amount-65to74';
const OAS_DEFERRAL_ANCHOR = '2026-oas-deferral-rate';
const OAS_CLAWBACK_ANCHOR = '2026-oas-clawback-threshold';

function buildOasCitation(): string {
  return pensionCitation(OAS_AMOUNT_ANCHOR);
}

/**
 * Compute the user's current age from `about_you.dateOfBirth` (ISO string).
 * Returns `undefined` if the date is missing or malformed.
 *
 * Per CLAUDE.md: shared estimators MUST NOT call `Date.now()` — that is a side
 * effect. The clamp logic in this card uses `new Date()` AT THE WEB LAYER only
 * (allowed in browser-side React components). The shared estimator
 * `estimateOAS` itself has no Date dependency.
 */
function computeCurrentAge(dateOfBirth: string | undefined): number | undefined {
  if (!dateOfBirth?.trim()) return undefined;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

/**
 * Sum all wizard income entries (employment + self-employment + any other
 * income types) as the heuristic for the OAS clawback threshold check
 * (OAS-07 / D-18). Per CONTEXT.md: lighter-weight heuristic — the engine
 * remains the source of truth for the actual recovery-tax math (Pitfall §6).
 *
 * Returns 0 when `income` is undefined or empty.
 */
interface IncomeEntry {
  annualAmount?: number | string | null;
}
function sumWizardIncome(income: IncomeEntry[] | undefined): number {
  if (!income || !Array.isArray(income)) return 0;
  let total = 0;
  for (const entry of income) {
    const v = Number(entry.annualAmount);
    if (Number.isFinite(v) && v > 0) total += v;
  }
  return total;
}

/**
 * OAS Estimate card (Phase 22).
 *
 * UI-SPEC contract: .planning/phases/22-oas-estimate-helper/22-UI-SPEC.md
 * CONTEXT decisions: D-01 through D-19 in 22-CONTEXT.md.
 *
 * Manual-primary information architecture (mirrors Phase 21 CppEstimatorCard):
 *   - The "Annual OAS amount" input is the default visual path.
 *   - A "I don't know my amount — help me estimate" link CTA expands an
 *     inline Collapsible panel with a SINGLE residence-years input — no
 *     radio selector (single helper path per D-02).
 *   - Helper commit writes the at-start-age GROSS value to manualOverrideAnnual,
 *     inputPath='helper', and a BenefitValueSource.
 *   - Changing plannedStartAge after a commit re-derives the displayed amount
 *     from the persisted residenceYearsAfter18 (no helper re-open required).
 *
 * Per OAS-01 / Pitfall §6: the displayed amount is GROSS only. The clawback
 * warning Callout (OAS-07) renders informationally when projected income
 * exceeds OAS_2026.clawbackThreshold; the GROSS amount is NEVER reduced in
 * the wizard. Engine retains sole ownership of the recovery-tax subtraction.
 *
 * Per CPP-10 / D-19: the displayed annual rounds to nearest $100 and the
 * monthly to nearest $5. The persisted form values stay precise.
 *
 * Provenance contract (mirror of Phase 21 21-03 helper-provenance guard —
 * full guard regression test lives in Plan 22-03):
 *   - Manual-input onBlur promotes inputPath='manual' + value_source.mode='user_entered',
 *     guarded by manualInputTouchedRef so a helper commit's focus-restore +
 *     subsequent click cannot silently overwrite helper-estimated provenance.
 *
 * Reused for both Primary and Spouse via the `person` prop — separate
 * component instances, no shared state.
 */
export function OasEstimatorCard({ person, provinceLabel }: OasEstimatorCardProps): JSX.Element {
  const { register, watch, setValue, getValues } = useFormContext();
  const basePath =
    person === 'primary' ? 'government_pensions.oas_primary' : 'government_pensions.oas_spouse';

  // ── Watched form values ─────────────────────────────────────────────
  const startAgeRaw = watch(`${basePath}.plannedStartAge`);
  const startAge =
    typeof startAgeRaw === 'number' && Number.isFinite(startAgeRaw) ? startAgeRaw : 65;
  const residenceYears = watch(`${basePath}.residenceYearsAfter18`) as number | undefined;
  const inputPath = watch(`${basePath}.inputPath`) as 'manual' | 'helper' | undefined;
  const valueSourceMode = watch(`${basePath}.value_source.mode`) as BenefitSourceMode | undefined;
  const valueSourceConfidence = watch(`${basePath}.value_source.confidence`) as
    | BenefitEstimateConfidence
    | undefined;
  const manualOverrideAnnual = watch(`${basePath}.manualOverrideAnnual`) as number | undefined;

  // ── Current age (D-10 cap derivation) ───────────────────────────────
  const dateOfBirth = watch('about_you.dateOfBirth') as string | undefined;
  const currentAge = computeCurrentAge(dateOfBirth);
  const residenceCap = currentAge !== undefined ? Math.max(0, currentAge - 18) : 60;

  // ── Income aggregation for clawback warning (D-18) ──────────────────
  const incomeArray = watch('income') as IncomeEntry[] | undefined;
  const projectedIncome = sumWizardIncome(incomeArray);
  const isAboveClawbackThreshold = projectedIncome > OAS_2026.clawbackThreshold;

  // ── Helper sub-panel state ──────────────────────────────────────────
  const [helperOpen, setHelperOpen] = useState<boolean>(false);
  const [helperYearsInput, setHelperYearsInput] = useState<string>('');

  const ctaButtonRef = useRef<HTMLButtonElement | null>(null);
  const helperYearsInputRef = useRef<HTMLInputElement | null>(null);
  /**
   * Tracks whether the user has typed in the manual amount input since the
   * last commit / cancel / external write. Guards `writeUserEntered` from
   * unconditionally promoting `inputPath` and `value_source.mode` on any blur.
   *
   * Mirrors Phase 21 21-03 `CppEstimatorCard.manualInputTouchedRef`. The
   * regression test for OAS lives in Plan 22-03 (helper-provenance preservation
   * across plannedStartAge change).
   */
  const manualInputTouchedRef = useRef<boolean>(false);

  // ── Residence-years input cap (D-10 / OAS-02) ───────────────────────
  // Clamp `residenceYearsAfter18` to Math.min(userInput, currentAge - 18) on
  // every change. The helper text below the field sets the expectation
  // verbatim per UI-SPEC §Copywriting "Residence-years helper text" row.
  useEffect(() => {
    if (helperOpen) return; // defer clamp until helper is closed (WR-02)
    if (residenceYears === undefined) return;
    if (!Number.isFinite(residenceYears)) return;
    const clamped = Math.min(Math.max(0, residenceYears), residenceCap);
    if (clamped !== residenceYears) {
      setValue(`${basePath}.residenceYearsAfter18`, clamped, { shouldDirty: true });
    }
  }, [helperOpen, residenceYears, residenceCap, basePath, setValue]);

  // Same clamp for the helper sub-panel's local input (separate from form state
  // because the helper preview should not write to the persisted field until
  // the user clicks "Use this estimate").
  const helperYearsParsed = Number(helperYearsInput);
  const helperYearsClamped =
    Number.isFinite(helperYearsParsed) && helperYearsInput.length > 0
      ? Math.min(Math.max(0, helperYearsParsed), residenceCap)
      : undefined;

  // ── Focus management on helper open (UI-SPEC §Interaction Contract) ─
  useEffect(() => {
    if (helperOpen) {
      const t = setTimeout(() => helperYearsInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [helperOpen]);

  // ── ESC closes the helper panel ─────────────────────────────────────
  useEffect(() => {
    if (!helperOpen) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setHelperOpen(false);
        ctaButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [helperOpen]);

  // ── Helper live preview (reactive on every input change) ────────────
  const helperPreview: ReturnType<typeof estimateOAS> | null =
    helperYearsClamped !== undefined
      ? estimateOAS({
          kind: 'oas-helper',
          startAge,
          residenceYearsAfter18: helperYearsClamped,
        })
      : null;

  // ── Reactive useEffect: when plannedStartAge changes after a helper
  //    commit, re-derive manualOverrideAnnual from residenceYearsAfter18.
  //    The persisted value_source.mode stays 'estimated' (provenance is
  //    preserved by the manualInputTouchedRef guard — see writeUserEntered).
  useEffect(() => {
    if (inputPath !== 'helper') return;
    if (residenceYears === undefined || !Number.isFinite(residenceYears)) return;
    const re = estimateOAS({
      kind: 'oas-helper',
      startAge,
      residenceYearsAfter18: residenceYears,
    });
    const current = getValues(`${basePath}.manualOverrideAnnual`) as number | undefined;
    if (current === re.annualGross) return; // avoid no-op writes
    setValue(`${basePath}.manualOverrideAnnual`, re.annualGross, { shouldDirty: true });
  }, [inputPath, residenceYears, startAge, basePath, getValues, setValue]);

  // ── Displayed amount (rounded for display, persisted precise) ───────
  const displayedAnnualPrecise: number | undefined =
    manualOverrideAnnual !== undefined && Number.isFinite(manualOverrideAnnual)
      ? manualOverrideAnnual
      : undefined;

  const displayedAnnualRounded =
    displayedAnnualPrecise !== undefined ? roundAnnual(displayedAnnualPrecise) : undefined;
  const displayedMonthlyRounded =
    displayedAnnualPrecise !== undefined ? roundMonthly(displayedAnnualPrecise / 12) : undefined;

  // ── Partial-pension factor display (OAS-03 / D-17) ──────────────────
  const showPartialFactor =
    residenceYears !== undefined &&
    residenceYears >= OAS_MIN_QUALIFYING_YEARS &&
    residenceYears < OAS_FULL_PENSION_YEARS;
  const partialFactorPct =
    residenceYears !== undefined ? Math.round((residenceYears / OAS_FULL_PENSION_YEARS) * 100) : 0;

  // ── Commit handlers ─────────────────────────────────────────────────
  /**
   * Manual-input onBlur: promote to user_entered. Guarded by manualInputTouchedRef
   * (mirror of Phase 21 21-03). The full regression test for this guard is in
   * Plan 22-03; this implementation establishes the guard so Plan 22-03's
   * test passes against an unmodified card source.
   */
  const writeUserEntered = (): void => {
    if (!manualInputTouchedRef.current) return;
    const current = getValues(`${basePath}.manualOverrideAnnual`) as number | undefined;
    if (current === undefined || !Number.isFinite(current)) return;
    setValue(`${basePath}.inputPath`, 'manual', { shouldDirty: true });
    setValue(
      `${basePath}.value_source`,
      {
        mode: 'user_entered',
        confidence: 'high',
        citation: buildOasCitation(),
      },
      { shouldDirty: true }
    );
    manualInputTouchedRef.current = false;
  };

  /**
   * Helper "Use this estimate": writes manualOverrideAnnual + residenceYearsAfter18 +
   * inputPath='helper' + value_source per D-13. Disabled when helperPreview is null
   * or when years < OAS_MIN_QUALIFYING_YEARS (floor case — D-12 / UI-SPEC §Interaction
   * Contract "Floor-case gating").
   */
  const commitHelper = (): void => {
    if (helperPreview === null) return;
    if (helperPreview.residenceYears < OAS_MIN_QUALIFYING_YEARS) return; // floor-gated
    const years = helperPreview.residenceYears;
    const confidence: BenefitEstimateConfidence =
      helperPreview.confidence === 'MEDIUM' ? 'medium' : 'low';

    // D-08 verbatim note derivation:
    // Full-pension note always shows OAS_FULL_PENSION_YEARS (40) regardless of raw input
    // (e.g. user enters 50 → factor is same as 40 → note says "40+" not "50+"). WR-03.
    const note =
      years >= OAS_FULL_PENSION_YEARS
        ? `Estimated full OAS from ${OAS_FULL_PENSION_YEARS}+ years of residence; start-age ${startAge}`
        : `Estimated from ${years}/40 qualifying years (partial-pension factor ${Math.round(
            helperPreview.partialFactor * 100
          )}%); start-age ${startAge}`;

    setValue(`${basePath}.manualOverrideAnnual`, helperPreview.annualGross, {
      shouldDirty: true,
    });
    setValue(`${basePath}.residenceYearsAfter18`, years, { shouldDirty: true });
    setValue(`${basePath}.inputPath`, 'helper', { shouldDirty: true });
    setValue(
      `${basePath}.value_source`,
      {
        mode: 'estimated',
        confidence,
        citation: buildOasCitation(),
        note,
      },
      { shouldDirty: true }
    );
    setHelperOpen(false);
    setTimeout(() => {
      const el = document.getElementById(`${basePath}.manualOverrideAnnual`);
      if (el instanceof HTMLInputElement) el.focus();
    }, 50);
    manualInputTouchedRef.current = false;
  };

  /** Helper "Discard estimate" link — clears local state, returns focus to CTA. */
  const cancelHelper = (): void => {
    setHelperYearsInput('');
    setHelperOpen(false);
    setTimeout(() => ctaButtonRef.current?.focus(), 50);
    manualInputTouchedRef.current = false;
  };

  // ── Sub-line text (UI-SPEC §Copywriting "Sub-line for *" rows) ──────
  const subLine: string | null = (() => {
    if (displayedAnnualRounded === undefined) return null;
    if (inputPath === 'manual') {
      return `From your statement, adjusted for start age ${startAge}`;
    }
    if (inputPath === 'helper') {
      const years = residenceYears ?? 0;
      if (years >= OAS_FULL_PENSION_YEARS) {
        return `Estimated full pension from ${years}+ years of residence`;
      }
      if (years >= OAS_MIN_QUALIFYING_YEARS) {
        const pct = Math.round((years / OAS_FULL_PENSION_YEARS) * 100);
        return `Estimated from ${years}/40 qualifying years; ${pct}% partial pension`;
      }
      return null; // floor case — replaced by Callout below the displayed amount
    }
    return null;
  })();

  const manualAmountReg = register(`${basePath}.manualOverrideAnnual`, {
    valueAsNumber: true,
    onBlur: writeUserEntered,
    onChange: () => {
      manualInputTouchedRef.current = true;
    },
  });

  void provinceLabel; // accepted for symmetry with CppEstimatorCard; OAS is federal so no province routing today

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <section
      className="rounded-lg border border-ds-outline-variant p-4 space-y-3"
      data-testid={`gov-pensions-oas-${person}`}
    >
      {/* Heading + citation chip */}
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">OAS — Estimate</h3>
          <SourceCitationLink
            doc={PENSION_CITATION_DOC}
            anchor={OAS_AMOUNT_ANCHOR}
            label="2026 OAS"
          />
        </div>
      </header>

      {/* Manual amount + Start age */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${basePath}.manualOverrideAnnual`}>Annual OAS amount</Label>
          <Input
            id={`${basePath}.manualOverrideAnnual`}
            type="number"
            min={0}
            step="any"
            placeholder="e.g. 8 470"
            aria-describedby={`${basePath}.manualOverrideAnnual.help`}
            {...manualAmountReg}
          />
          <p id={`${basePath}.manualOverrideAnnual.help`} className="text-xs text-muted-foreground">
            Enter the amount from your Service Canada statement.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${basePath}.plannedStartAge`}>Planned start age</Label>
          <Input
            id={`${basePath}.plannedStartAge`}
            type="number"
            min={65}
            max={70}
            placeholder="65"
            {...register(`${basePath}.plannedStartAge`, { valueAsNumber: true })}
          />
          <p className="text-xs text-muted-foreground">
            Between 65 and 70. Deferring past 65 increases your OAS by 0.6% per month.{' '}
            <SourceCitationLink
              doc={PENSION_CITATION_DOC}
              anchor={OAS_DEFERRAL_ANCHOR}
              label="deferral rate"
            />
          </p>
        </div>
      </div>

      {/* Displayed amount block — rounded for display, precise persisted */}
      {displayedAnnualRounded !== undefined && (
        <div
          className="flex items-baseline gap-3 flex-wrap"
          aria-live="polite"
          data-testid={`oas-displayed-amount-${person}`}
        >
          <span className="text-xl font-semibold font-mono tabular-nums">
            {`$ ${displayedAnnualRounded.toLocaleString('en-CA')}`}
          </span>
          <YearTag year={2026} />
          <span className="text-sm font-mono tabular-nums text-muted-foreground">
            {`~ $ ${(displayedMonthlyRounded ?? 0).toLocaleString('en-CA')} / month`}
          </span>
          <YearTag year={2026} />
          {valueSourceMode && valueSourceConfidence && (
            <ConfidenceChip
              mode={valueSourceMode}
              confidence={valueSourceConfidence}
              amount={displayedAnnualRounded}
            />
          )}
        </div>
      )}

      {/* Partial-pension factor (OAS-03 / D-17) — inline below the amount */}
      {showPartialFactor && (
        <p className="text-xs text-muted-foreground" data-testid={`oas-partial-factor-${person}`}>
          {`${residenceYears ?? 0}/40 = ${partialFactorPct}%`}
        </p>
      )}

      {/* Sub-line for current source mode */}
      {subLine !== null && <p className="text-xs text-muted-foreground">{subLine}</p>}

      {/* Clawback warning Callout (OAS-07 / D-18) — informational ONLY */}
      {isAboveClawbackThreshold && (
        <Callout variant="info" className="mt-2">
          <span>
            {`Your projected income may exceed the 2026 OAS recovery-tax threshold of $${OAS_2026.clawbackThreshold.toLocaleString(
              'en-CA'
            )}. The wizard shows GROSS OAS; the engine subtracts the recovery tax in your year-by-year projection. `}
            <SourceCitationLink
              doc={PENSION_CITATION_DOC}
              anchor={OAS_CLAWBACK_ANCHOR}
              label="threshold source"
            />
          </span>
        </Callout>
      )}

      {/* Helper CTA link */}
      <Button
        ref={ctaButtonRef}
        type="button"
        variant="link"
        className="px-0 py-1 h-auto"
        aria-expanded={helperOpen}
        aria-controls={`oas-helper-${person}`}
        aria-label="Open helper to estimate OAS amount"
        onClick={() => setHelperOpen((v) => !v)}
      >
        {`I don't know my amount — help me estimate`}
      </Button>

      {/* Helper sub-panel */}
      <Collapsible open={helperOpen} onOpenChange={setHelperOpen}>
        <CollapsibleContent>
          <fieldset
            id={`oas-helper-${person}`}
            className="rounded-md border border-ds-outline-variant p-4 space-y-3 mt-1"
            data-testid={`gov-pensions-oas-helper-${person}`}
          >
            <legend className="text-sm font-medium px-1 sr-only">
              {`Estimate OAS amount for ${person === 'primary' ? 'primary' : 'spouse'}`}
            </legend>

            <div className="space-y-1">
              <Label htmlFor={`oas-helper-years-${person}`}>
                How many years have you lived in Canada after your 18th birthday?
              </Label>
              <Input
                ref={helperYearsInputRef}
                id={`oas-helper-years-${person}`}
                type="number"
                min={0}
                max={60}
                placeholder="e.g. 35"
                value={helperYearsInput}
                onChange={(e) => setHelperYearsInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Count only years you lived in Canada after your 18th birthday.
              </p>
            </div>

            <p className="text-xs text-muted-foreground">{`Using start age ${startAge} from above`}</p>

            {/* Live preview / floor message */}
            {helperPreview === null ? (
              <div
                role="status"
                aria-live="polite"
                className="text-sm text-muted-foreground"
                data-testid={`oas-helper-preview-${person}`}
              >
                Enter your years of residence above to see your estimate.
              </div>
            ) : helperPreview.residenceYears < OAS_MIN_QUALIFYING_YEARS ? (
              <Callout variant="warning">
                <span>{OAS_FLOOR_MESSAGE}</span>
              </Callout>
            ) : (
              <div
                role="status"
                aria-live="polite"
                className="text-sm font-mono tabular-nums"
                data-testid={`oas-helper-preview-${person}`}
              >
                {`Estimate: $ ${roundAnnual(helperPreview.annualGross).toLocaleString(
                  'en-CA'
                )} / yr  •  ~ $ ${roundMonthly(helperPreview.monthlyGross).toLocaleString(
                  'en-CA'
                )} / mo`}
                <YearTag year={2026} />
              </div>
            )}

            {/* CTAs */}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="default"
                onClick={commitHelper}
                disabled={
                  helperPreview === null || helperPreview.residenceYears < OAS_MIN_QUALIFYING_YEARS
                }
              >
                Use this estimate
              </Button>
              <Button
                type="button"
                variant="link"
                aria-label="Discard helper input and close panel"
                onClick={cancelHelper}
                className="px-0"
              >
                Discard estimate
              </Button>
            </div>
          </fieldset>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
