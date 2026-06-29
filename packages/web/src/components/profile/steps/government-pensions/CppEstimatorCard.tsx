/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/restrict-template-expressions */
'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { SourceCitationLink } from '@/components/citations/SourceCitationLink';
import { pensionCitation, PENSION_CITATION_DOC } from './pension-citation';
import { ConfidenceChip } from '@/components/citations/ConfidenceChip';
import { YearTag } from '@/components/citations/YearTag';
import { roundAnnual, roundMonthly } from '@/lib/precision';
import {
  adjustCPPForStartAge,
  BUCKET_TO_PCT,
  CPP_2026,
  QPP_2026,
} from '@retireops/shared/benefits';
import type { BenefitSourceMode, BenefitEstimateConfidence } from '@retireops/shared/types';

type Plan = 'CPP' | 'QPP';
type Person = 'primary' | 'spouse';
type EarningsBucketKey = keyof typeof BUCKET_TO_PCT;

interface CppEstimatorCardProps {
  person: Person;
  plan: Plan;
  /** Display label for province (e.g. "Ontario", "Quebec") — passed by parent to keep this component pure-via-props. */
  provinceLabel: string;
}

const HELPER_RADIO_VALUES = {
  soc: 'soc',
  ympeProxy: 'ympe-proxy',
} as const;

type HelperRadioValue = (typeof HELPER_RADIO_VALUES)[keyof typeof HELPER_RADIO_VALUES];

/** Display labels for YMPE-proxy buckets (UI-SPEC §Copywriting). */
const BUCKET_OPTION_LABEL: Record<EarningsBucketKey, string> = {
  BELOW_AVG: 'Below average earner (around 40% of YMPE)',
  AVG_OR_ABOVE: 'Average or above (around 65% of YMPE)',
  AT_MAX: 'Maximum contributor (100% of YMPE)',
};

/** Short labels for the post-commit sub-line ("Estimated from N years × ..."). */
const BUCKET_SHORT_LABEL: Record<EarningsBucketKey, string> = {
  BELOW_AVG: 'Below average',
  AVG_OR_ABOVE: 'Average or above',
  AT_MAX: 'Maximum contributor',
};

const PLAN_CITATION_ANCHOR: Record<Plan, string> = {
  CPP: '2026-cpp-max-retirement-pension',
  QPP: '2026-qpp-max-retirement-pension',
};

const STATEMENT_LABEL: Record<Plan, string> = {
  CPP: 'Service Canada Statement of Contributions',
  QPP: 'Retraite Québec Statement of Participation',
};

/**
 * Short statement label used in UI sub-line text. Matches UI-SPEC §Copywriting
 * verbatim — "Service Canada statement" (lowercase, short form), not the full
 * proper noun. The full STATEMENT_LABEL is kept for the helper-input field
 * label and the SOC radio label (where formal-name accuracy matters more
 * than verbatim copywriting alignment). Per IN-01 in 21-REVIEW.md.
 */
const SHORT_STATEMENT_LABEL: Record<Plan, string> = {
  CPP: 'Service Canada statement',
  QPP: 'Retraite Québec statement',
};

function buildCitation(plan: Plan): string {
  return pensionCitation(PLAN_CITATION_ANCHOR[plan]);
}

/**
 * CPP/QPP Estimate card (Phase 21).
 *
 * UI-SPEC contract: .planning/phases/21-cpp-qpp-estimator/21-UI-SPEC.md
 * CONTEXT decisions: D-01 through D-19 in 21-CONTEXT.md.
 *
 * Manual-primary information architecture:
 *   - The "Annual amount at age 65" input is the default visual path.
 *   - A "I don't know my amount — help me estimate" link CTA expands an
 *     inline Collapsible panel with a RadioGroup (SOC vs YMPE-proxy).
 *   - Helper commit writes the at-start-age value to manualOverrideAnnual,
 *     the at-65 base to manualOverrideAnnualBaseAt65, an inputPath enum,
 *     and a BenefitValueSource.
 *   - Changing plannedStartAge after a commit re-derives the displayed
 *     amount from the persisted at-65 base (no helper re-open required).
 *
 * Per CPP-10 / D-19, the displayed annual rounds to nearest $100 and the
 * monthly to nearest $5. The persisted form values stay precise; rounding
 * is presentation-only.
 *
 * Provenance contract (Gap-1 fix, 21-03):
 *   - Manual-input onBlur promotes inputPath='manual' + value_source.mode='user_entered',
 *     guarded by manualInputTouchedRef so a helper commit's focus-restore +
 *     subsequent click cannot silently overwrite helper-soc / helper-ympe-proxy
 *     provenance. See 21-HUMAN-UAT.md gap 1.
 *
 * Reused for both Primary and Spouse via the `person` prop — separate
 * component instances, no shared state.
 */
export function CppEstimatorCard({
  person,
  plan,
  provinceLabel,
}: CppEstimatorCardProps): JSX.Element {
  const { register, watch, setValue, getValues } = useFormContext();
  const basePath =
    person === 'primary' ? 'government_pensions.cpp_primary' : 'government_pensions.cpp_spouse';

  const planLabel = plan; // "CPP" or "QPP"
  const planAnchor = PLAN_CITATION_ANCHOR[plan];
  const statementLabel = STATEMENT_LABEL[plan];
  const shortStatementLabel = SHORT_STATEMENT_LABEL[plan];

  // ── Watched form values ─────────────────────────────────────────────
  const startAgeRaw = watch(`${basePath}.plannedStartAge`);
  const startAge =
    typeof startAgeRaw === 'number' && Number.isFinite(startAgeRaw) ? startAgeRaw : 65;
  // `manualOverrideAnnual` is not watched directly — it's derived in a
  // useEffect from `manualOverrideAnnualBaseAt65 × adjustCPPForStartAge`.
  // Watching it would create a feedback loop with the sync effect.
  const manualOverrideAnnualBaseAt65 = watch(`${basePath}.manualOverrideAnnualBaseAt65`) as
    | number
    | undefined;
  const inputPath = watch(`${basePath}.inputPath`) as
    | 'manual'
    | 'helper-soc'
    | 'helper-ympe-proxy'
    | undefined;
  const valueSourceMode = watch(`${basePath}.value_source.mode`) as BenefitSourceMode | undefined;
  const valueSourceConfidence = watch(`${basePath}.value_source.confidence`) as
    | BenefitEstimateConfidence
    | undefined;
  const yearsContributed = watch(`${basePath}.yearsContributed`) as number | undefined;
  const earningsBucket = watch(`${basePath}.earningsBucket`) as EarningsBucketKey | undefined;

  // ── Helper sub-panel state ──────────────────────────────────────────
  const [helperOpen, setHelperOpen] = useState<boolean>(false);
  const [helperPath, setHelperPath] = useState<HelperRadioValue>(HELPER_RADIO_VALUES.soc);
  const [socAnnualInput, setSocAnnualInput] = useState<string>('');
  const [yearsInput, setYearsInput] = useState<string>('');
  const [bucketInput, setBucketInput] = useState<EarningsBucketKey | ''>('');

  const ctaButtonRef = useRef<HTMLButtonElement | null>(null);
  const firstRadioRef = useRef<HTMLButtonElement | null>(null);
  /**
   * Tracks whether the user has typed in the manual amount input since the
   * last commit / cancel / external write. Guards `writeUserEntered` from
   * unconditionally promoting `inputPath` and `value_source.mode` on any blur.
   *
   * Without this guard, a helper commit (which restores focus to the manual
   * input via setTimeout) followed by ANY click outside the input — including
   * clicking the start-age input to change `plannedStartAge` — fires onBlur,
   * which silently overwrites helper-soc/helper-ympe-proxy provenance to
   * manual/user_entered. Reproduced in 21-HUMAN-UAT.md Test 3 (gap 1).
   *
   * Reset to false in:
   *   - commitHelper (after all setValue writes)
   *   - cancelHelper (after local state cleared)
   *   - writeUserEntered (after a real-touch-driven promotion completes)
   * Set to true in:
   *   - the manual amount input's onChange handler (real DOM keystroke / paste /
   *     native step-up/down)
   */
  const manualInputTouchedRef = useRef<boolean>(false);

  // ── Focus management on helper open (UI-SPEC §Interaction Contract) ─
  useEffect(() => {
    if (helperOpen) {
      const t = setTimeout(() => firstRadioRef.current?.focus(), 50);
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

  // ── Derived display values ──────────────────────────────────────────
  // The manual amount input is bound to `manualOverrideAnnualBaseAt65` (the
  // user's at-65 entry, matching the field label "Annual amount at age 65").
  // The displayed amount and the persisted `manualOverrideAnnual` are both
  // derived by applying `adjustCPPForStartAge` to that base.
  const baseForAdjust: number | undefined = manualOverrideAnnualBaseAt65;

  const displayedAnnualPrecise: number | undefined =
    baseForAdjust !== undefined && Number.isFinite(baseForAdjust)
      ? adjustCPPForStartAge(baseForAdjust, startAge, plan)
      : undefined;

  const displayedAnnualRounded: number | undefined =
    displayedAnnualPrecise !== undefined ? roundAnnual(displayedAnnualPrecise) : undefined;
  const displayedMonthlyRounded: number | undefined =
    displayedAnnualPrecise !== undefined ? roundMonthly(displayedAnnualPrecise / 12) : undefined;

  // ── Keep `manualOverrideAnnual` (at-start-age) in sync with the
  //    persisted at-65 base × adjustment factor. Re-runs on any change to
  //    `manualOverrideAnnualBaseAt65` or `startAge`. This unifies the
  //    semantic across manual and helper paths (WR-01): the persisted
  //    `manualOverrideAnnual` is always the at-start-age value, matching
  //    the schema JSDoc and the Phase 21 round-trip smoke fixture.
  useEffect(() => {
    if (
      manualOverrideAnnualBaseAt65 === undefined ||
      !Number.isFinite(manualOverrideAnnualBaseAt65)
    ) {
      return;
    }
    const adjusted = adjustCPPForStartAge(manualOverrideAnnualBaseAt65, startAge, plan);
    const current = getValues(`${basePath}.manualOverrideAnnual`) as number | undefined;
    // Avoid no-op writes that would dirty the form unnecessarily.
    if (current === adjusted) return;
    setValue(`${basePath}.manualOverrideAnnual`, adjusted, { shouldDirty: true });
  }, [manualOverrideAnnualBaseAt65, startAge, plan, basePath, getValues, setValue]);

  // ── Live preview in helper panel (reactive on every input change) ───
  const helperPreview: { annual: number; monthly: number } | null = (() => {
    if (helperPath === HELPER_RADIO_VALUES.soc) {
      const annualAt65 = Number(socAnnualInput);
      if (!Number.isFinite(annualAt65) || annualAt65 <= 0) return null;
      const annual = adjustCPPForStartAge(annualAt65, startAge, plan);
      return { annual, monthly: annual / 12 };
    }
    const years = Number(yearsInput);
    // WR-02: reject years === 0 too. Number('') is 0, so a user who selects
    // an earnings bucket without entering a year count would otherwise see
    // "$ 0 / yr" and be able to commit a $0 "Estimated" benefit.
    if (!Number.isFinite(years) || years <= 0 || years > 47) return null;
    if (!bucketInput) return null;
    const params = plan === 'QPP' ? QPP_2026 : CPP_2026;
    const pct = BUCKET_TO_PCT[bucketInput];
    const baseAt65 = Math.min(
      params.maxRetirementPensionAnnual * pct * (years / 39),
      params.maxRetirementPensionAnnual
    );
    const annual = adjustCPPForStartAge(baseAt65, startAge, plan);
    return { annual, monthly: annual / 12 };
  })();

  // ── Commit handlers ─────────────────────────────────────────────────
  /**
   * Manual-input onBlur: promote to user_entered. The input is bound to
   * `manualOverrideAnnualBaseAt65` (the user's at-65 entry), so the value
   * itself is already persisted via RHF `register`. The reactive useEffect
   * above keeps `manualOverrideAnnual` (at-start-age) in sync. This handler
   * only flips `inputPath` + `value_source` to record that the latest write
   * came from manual entry.
   */
  const writeUserEntered = (): void => {
    // Gap-1 guard (21-03): only promote provenance if the user actually typed
    // in this input since the last commit/cancel/external write. Without this
    // guard, a helper commit's setTimeout-driven focus restore + any
    // subsequent click outside the input silently flips inputPath to 'manual'
    // and wipes the helper-soc/helper-ympe-proxy provenance.
    // See 21-HUMAN-UAT.md gap 1 (major).
    if (!manualInputTouchedRef.current) return;

    const current = getValues(`${basePath}.manualOverrideAnnualBaseAt65`) as number | undefined;
    if (current === undefined || !Number.isFinite(current)) return;
    setValue(`${basePath}.inputPath`, 'manual', { shouldDirty: true });
    setValue(
      `${basePath}.value_source`,
      {
        mode: 'user_entered',
        confidence: 'high',
        citation: buildCitation(plan),
      },
      { shouldDirty: true }
    );

    // Consume the touch flag so a second blur without a fresh keystroke
    // no-ops (matches the "blur with no new keystroke does nothing" contract).
    manualInputTouchedRef.current = false;
  };

  /** Helper "Use this estimate": writes all four fields + value_source. */
  const commitHelper = (): void => {
    if (helperPath === HELPER_RADIO_VALUES.soc) {
      const annualAt65 = Number(socAnnualInput);
      if (!Number.isFinite(annualAt65) || annualAt65 <= 0) return;
      const adjusted = adjustCPPForStartAge(annualAt65, startAge, plan);
      setValue(`${basePath}.manualOverrideAnnualBaseAt65`, annualAt65, {
        shouldDirty: true,
      });
      setValue(`${basePath}.manualOverrideAnnual`, adjusted, { shouldDirty: true });
      setValue(`${basePath}.inputPath`, 'helper-soc', { shouldDirty: true });
      setValue(
        `${basePath}.value_source`,
        {
          mode: 'estimated',
          confidence: 'medium',
          citation: buildCitation(plan),
          // IN-02: match the verbatim D-08 contract for the persisted note
          // (downstream Phase 24 report consumers read this string). The
          // displayed sub-line uses a slightly different wording — UX copy
          // and persisted-data copy intentionally decouple here.
          note: `${shortStatementLabel} amount; adjustment applied for start-age ${startAge}`,
        },
        { shouldDirty: true }
      );
    } else {
      const years = Number(yearsInput);
      // WR-02: mirror the live-preview guard — reject years === 0 to avoid
      // a $0 "Estimated" commit when bucket is selected but years field empty.
      if (!Number.isFinite(years) || years <= 0 || years > 47 || !bucketInput) return;
      const params = plan === 'QPP' ? QPP_2026 : CPP_2026;
      const pct = BUCKET_TO_PCT[bucketInput];
      const baseAt65 = Math.min(
        params.maxRetirementPensionAnnual * pct * (years / 39),
        params.maxRetirementPensionAnnual
      );
      const adjusted = adjustCPPForStartAge(baseAt65, startAge, plan);
      setValue(`${basePath}.manualOverrideAnnualBaseAt65`, baseAt65, {
        shouldDirty: true,
      });
      setValue(`${basePath}.manualOverrideAnnual`, adjusted, { shouldDirty: true });
      setValue(`${basePath}.yearsContributed`, years, { shouldDirty: true });
      setValue(`${basePath}.earningsBucket`, bucketInput, { shouldDirty: true });
      setValue(`${basePath}.inputPath`, 'helper-ympe-proxy', { shouldDirty: true });
      setValue(
        `${basePath}.value_source`,
        {
          mode: 'estimated',
          confidence: 'medium',
          citation: buildCitation(plan),
          note: `Estimated from ${years} years contributed × ${BUCKET_SHORT_LABEL[bucketInput]}`,
        },
        { shouldDirty: true }
      );
    }
    setHelperOpen(false);
    // Focus back to the manual amount input (per UI-SPEC §Interaction).
    setTimeout(() => {
      const el = document.getElementById(`${basePath}.manualOverrideAnnual`);
      if (el instanceof HTMLInputElement) el.focus();
    }, 50);
    // Gap-1 (21-03): after a helper commit, the user has NOT typed in the
    // manual input. Clear the touch flag so the focus-restore-then-blur-on-
    // next-click pattern cannot promote provenance.
    manualInputTouchedRef.current = false;
  };

  /** Helper "Cancel": clear local state, return focus to the CTA. */
  const cancelHelper = (): void => {
    setSocAnnualInput('');
    setYearsInput('');
    setBucketInput('');
    setHelperOpen(false);
    setTimeout(() => ctaButtonRef.current?.focus(), 50);
    // Gap-1 (21-03): cancel does not constitute user-edit of the manual input.
    manualInputTouchedRef.current = false;
  };

  // ── Sub-line text (UI-SPEC §Copywriting "Sub-line for *" rows) ──────
  const subLine: string | null = (() => {
    if (displayedAnnualRounded === undefined) return null;
    if (inputPath === 'manual') {
      return `From your statement, adjusted for start age ${startAge}`;
    }
    if (inputPath === 'helper-soc') {
      // IN-01: use short form ("Service Canada statement") to match UI-SPEC
      // §Copywriting verbatim. The helper-input label and the SOC radio
      // label retain the full proper noun.
      return `From ${shortStatementLabel} amount, adjusted for start age ${startAge}`;
    }
    if (inputPath === 'helper-ympe-proxy') {
      const years = yearsContributed ?? 0;
      const bucketKey: EarningsBucketKey = earningsBucket ?? 'BELOW_AVG';
      return `Estimated from ${years} years contributed × ${BUCKET_SHORT_LABEL[bucketKey]}`;
    }
    return null;
  })();

  // ── Render ──────────────────────────────────────────────────────────
  // The manual-amount input is registered against the at-65 base field
  // (`manualOverrideAnnualBaseAt65`) so the input value the user sees stays
  // stable when `plannedStartAge` changes — the at-start-age value
  // (`manualOverrideAnnual`) is derived from the base by the reactive
  // useEffect above. Decision per WR-01: unify the semantic so the
  // persisted `manualOverrideAnnual` is always the at-start-age value, in
  // line with the schema JSDoc and the helper paths.
  //
  // The HTML id stays `${basePath}.manualOverrideAnnual` for stability
  // (Label htmlFor, aria-describedby, and the post-commit focus call all
  // depend on it). The id is decorative — RHF binding is independent.
  const manualAmountReg = register(`${basePath}.manualOverrideAnnualBaseAt65`, {
    valueAsNumber: true,
    onBlur: writeUserEntered,
    onChange: () => {
      // Gap-1 (21-03): a real DOM change in this input (keystroke, paste,
      // native step-up/down) marks the touch flag so the next blur is
      // allowed to promote provenance to 'manual'/'user_entered'. Cleared
      // by commitHelper, cancelHelper, and writeUserEntered after a
      // successful promotion. RHF chains this AFTER its internal onChange.
      manualInputTouchedRef.current = true;
    },
  });

  return (
    <section
      className="rounded-lg border border-ds-outline-variant p-4 space-y-3"
      data-testid={`gov-pensions-cpp-${person}`}
    >
      {/* Heading + citation chip + province sub-line */}
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{`${planLabel} — Estimate`}</h3>
          <SourceCitationLink
            doc={PENSION_CITATION_DOC}
            anchor={planAnchor}
            label={`2026 ${planLabel}`}
          />
        </div>
        <p className="text-xs text-muted-foreground">{`Based on your province (${provinceLabel})`}</p>
      </header>

      {/* Manual amount + Start age */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${basePath}.manualOverrideAnnual`}>Annual amount at age 65</Label>
          <Input
            id={`${basePath}.manualOverrideAnnual`}
            type="number"
            min={0}
            step="any"
            placeholder="e.g. 16 375"
            aria-describedby={`${basePath}.manualOverrideAnnual.help`}
            {...manualAmountReg}
          />
          <p id={`${basePath}.manualOverrideAnnual.help`} className="text-xs text-muted-foreground">
            {`Enter the amount from your ${statementLabel}.`}
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${basePath}.plannedStartAge`}>Planned start age</Label>
          <Input
            id={`${basePath}.plannedStartAge`}
            type="number"
            min={60}
            max={70}
            placeholder="65"
            {...register(`${basePath}.plannedStartAge`, { valueAsNumber: true })}
          />
          <p className="text-xs text-muted-foreground">
            Between 60 and 70. At 65 you get the full amount; earlier reduces, later increases.{' '}
            <SourceCitationLink
              doc="05-government-benefits.md"
              anchor="cpp-adjustment-factors"
              label="adjustment rules"
            />
          </p>
        </div>
      </div>

      {/* Displayed amount block — rounded for display, precise persisted */}
      {displayedAnnualRounded !== undefined && (
        <div className="flex items-baseline gap-3 flex-wrap" aria-live="polite">
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

      {/* Sub-line for current source mode */}
      {subLine !== null && <p className="text-xs text-muted-foreground">{subLine}</p>}

      {/* Helper CTA link */}
      <Button
        ref={ctaButtonRef}
        type="button"
        variant="link"
        className="px-0 py-1 h-auto"
        aria-expanded={helperOpen}
        aria-controls={`cpp-helper-${person}`}
        aria-label={`Open helper to estimate ${planLabel} amount`}
        onClick={() => setHelperOpen((v) => !v)}
      >
        {`I don't know my amount — help me estimate`}
      </Button>

      {/* Helper sub-panel */}
      <Collapsible open={helperOpen} onOpenChange={setHelperOpen}>
        <CollapsibleContent>
          <fieldset
            id={`cpp-helper-${person}`}
            className="rounded-md border border-ds-outline-variant p-4 space-y-3 mt-1"
            data-testid={`gov-pensions-cpp-helper-${person}`}
          >
            <legend className="text-sm font-medium px-1">
              {`Choose how you'd like to estimate:`}
            </legend>
            <RadioGroup
              value={helperPath}
              onValueChange={(v: string) => setHelperPath(v as HelperRadioValue)}
              className="space-y-2"
            >
              <div className="flex items-start gap-2">
                <RadioGroupItem
                  ref={firstRadioRef}
                  value={HELPER_RADIO_VALUES.soc}
                  id={`helper-soc-${person}`}
                  className="mt-0.5"
                />
                <Label htmlFor={`helper-soc-${person}`} className="font-normal cursor-pointer">
                  {`I have my ${statementLabel}`}
                  <span className="ml-2 text-xs text-muted-foreground">Best accuracy.</span>
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem
                  value={HELPER_RADIO_VALUES.ympeProxy}
                  id={`helper-ympe-${person}`}
                  className="mt-0.5"
                />
                <Label htmlFor={`helper-ympe-${person}`} className="font-normal cursor-pointer">
                  Estimate from my work history
                  <span className="ml-2 text-xs text-muted-foreground">
                    Rough estimate based on years contributed and earnings level.
                  </span>
                </Label>
              </div>
            </RadioGroup>

            {/* SOC sub-form */}
            {helperPath === HELPER_RADIO_VALUES.soc && (
              <div className="space-y-1">
                <Label htmlFor={`helper-soc-input-${person}`}>
                  Annual amount at age 65 (from your statement)
                </Label>
                <Input
                  id={`helper-soc-input-${person}`}
                  type="number"
                  min={0}
                  step="any"
                  placeholder="e.g. 16 375"
                  value={socAnnualInput}
                  onChange={(e) => setSocAnnualInput(e.target.value)}
                />
              </div>
            )}

            {/* YMPE-proxy sub-form */}
            {helperPath === HELPER_RADIO_VALUES.ympeProxy && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor={`helper-years-${person}`}>
                    {`How many years have you contributed to ${planLabel}?`}
                  </Label>
                  <Input
                    id={`helper-years-${person}`}
                    type="number"
                    min={0}
                    max={47}
                    placeholder="e.g. 35"
                    value={yearsInput}
                    onChange={(e) => setYearsInput(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>How would you describe your average lifetime earnings?</Label>
                  <RadioGroup
                    value={bucketInput || ''}
                    onValueChange={(v: string) => setBucketInput(v as EarningsBucketKey)}
                    className="space-y-2"
                  >
                    {(['BELOW_AVG', 'AVG_OR_ABOVE', 'AT_MAX'] as EarningsBucketKey[]).map((key) => (
                      <div key={key} className="flex items-center gap-2">
                        <RadioGroupItem value={key} id={`helper-bucket-${key}-${person}`} />
                        <Label
                          htmlFor={`helper-bucket-${key}-${person}`}
                          className="font-normal cursor-pointer"
                        >
                          {BUCKET_OPTION_LABEL[key]}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </div>
            )}

            {/* Live preview */}
            <div
              role="status"
              aria-live="polite"
              className="text-sm font-mono tabular-nums"
              data-testid={`helper-preview-${person}`}
            >
              {helperPreview
                ? `Estimate: $ ${roundAnnual(helperPreview.annual).toLocaleString('en-CA')} / yr  •  ~ $ ${roundMonthly(helperPreview.monthly).toLocaleString('en-CA')} / mo`
                : 'Fill in the fields above to see your estimate.'}
              {helperPreview && <YearTag year={2026} />}
            </div>

            {/* CTAs */}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="default"
                onClick={commitHelper}
                disabled={!helperPreview}
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
                Cancel
              </Button>
            </div>
          </fieldset>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
