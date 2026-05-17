'use client';

/**
 * GIS Estimate card (Phase 23-02).
 *
 * UI-SPEC contract: .planning/phases/23-gis-estimate-helper/23-UI-SPEC.md
 * CONTEXT decisions: D-01 through D-19 in 23-CONTEXT.md.
 *
 * Manual-primary information architecture:
 *   - The "Annual GIS amount" input is the default visual path.
 *   - A "I don't know — help me estimate" link CTA expands an inline
 *     Collapsible panel with a spouse-OAS RadioGroup (couple tab only,
 *     D-11 / GIS-04) and an income-excluding-OAS input.
 *   - Helper commit writes the precise GIS estimate to manualOverrideAnnual
 *     + incomeExcludingOAS + spouseOasStatus + inputPath='helper' + a
 *     BenefitValueSource with tier-routed citation (D-07).
 *   - Cross-tab reactive preview via useWatch on spouse's incomeExcludingOAS
 *     (D-16 / GIS-07). The combined-income preview re-derives whenever either
 *     spouse changes their income input.
 *
 * Above-threshold ineligibility (D-17):
 *   - When committed value is $0 with mode='estimated' and confidence='low',
 *     the amount block is replaced by a <Callout variant='info'> whose body
 *     is computed inline from the committed tier + incomes + GIS_2026 cutoffs.
 *     Threshold values derive from GIS_2026 (NOT hard-coded per PARAM-01).
 *
 * "You may be eligible" framing (GIS-05):
 *   - All positive GIS display is prefixed with "You may be eligible for:".
 *   - Never "you will receive".
 *
 * Per D-19: displayed annual rounds to nearest $100, monthly to nearest $5.
 * Persisted form values stay precise.
 *
 * Provenance guard (mirrors Phase 21 21-03 + Phase 22 / Plan 22-03):
 *   - manualInputTouchedRef prevents a helper commit's focus-restore from
 *     silently promoting mode='estimated' back to mode='user_entered'.
 *     Full regression test ships in Plan 23-03.
 *
 * Reused for both Primary and Spouse via the `person` prop — separate
 * component instances, no shared state.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Callout } from '@/components/ui/callout';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SourceCitationLink } from '@/components/citations/SourceCitationLink';
import { ConfidenceChip } from '@/components/citations/ConfidenceChip';
import { YearTag } from '@/components/citations/YearTag';
import { roundAnnual, roundMonthly } from '@/lib/precision';
import { estimateGIS, GIS_2026 } from '@retireops/shared/benefits';
import type { GisTier, GISEstimate } from '@retireops/shared/benefits';
import type { BenefitSourceMode, BenefitEstimateConfidence } from '@retireops/shared/types';

type Person = 'primary' | 'spouse';
type SpouseOasStatus = 'on-oas' | 'on-allowance' | 'no-oas';

interface GisEstimatorCardProps {
  person: Person;
  /** Display label for province — passed by parent for API symmetry with CppEstimatorCard. GIS is federal; not used for province routing in v4.7. */
  provinceLabel: string;
}

// ── Tier-routing helpers (outside component — pure, no closures) ─────────────

/** D-07: Locked tier-to-anchor map per UI-SPEC §Interaction Contract "Tier-routed citation chip". */
const GIS_CITATION_DOC = '18-pensions-2026.md';
const GIS_TIER_ANCHORS: Record<GisTier, string> = {
  single: '2026-gis-q2-single-max',
  'couple-on-oas': '2026-gis-q2-spouse-on-oas-max',
  'couple-on-allowance': '2026-gis-q2-spouse-on-allowance-max',
  'couple-no-oas': '2026-gis-q2-spouse-no-oas-max',
};

function buildGisCitation(tier: GisTier): string {
  return `docs/source-of-truth/${GIS_CITATION_DOC}#${GIS_TIER_ANCHORS[tier]}`;
}

/** D-04 / UI-SPEC §Copywriting "Tier labels". */
function tierLabel(tier: GisTier): string {
  switch (tier) {
    case 'single':
      return 'single';
    case 'couple-on-oas':
      return 'couple (spouse on OAS)';
    case 'couple-on-allowance':
      return 'couple (spouse on Allowance)';
    case 'couple-no-oas':
      return 'couple (spouse not yet on OAS)';
    default:
      return 'single';
  }
}

function spouseOasStatusToTier(status: SpouseOasStatus | undefined): GisTier | undefined {
  if (status === undefined) return undefined;
  switch (status) {
    case 'on-oas':
      return 'couple-on-oas';
    case 'on-allowance':
      return 'couple-on-allowance';
    case 'no-oas':
      return 'couple-no-oas';
  }
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * GIS Estimator card — manual-primary with inline helper fallback (Phase 23).
 *
 * @param person - 'primary' or 'spouse'; scopes all form paths to gis_primary / gis_spouse.
 * @param provinceLabel - Accepted for API symmetry with CppEstimatorCard; GIS is federal.
 */
export function GisEstimatorCard({ person, provinceLabel }: GisEstimatorCardProps): JSX.Element {
  const { register, watch, setValue, getValues } = useFormContext();

  // D-10: basePath scopes form writes per person; spousePath drives cross-tab reactivity.
  const basePath =
    person === 'primary' ? 'government_pensions.gis_primary' : 'government_pensions.gis_spouse';
  const spousePath =
    person === 'primary' ? 'government_pensions.gis_spouse' : 'government_pensions.gis_primary';

  // D-10: marital "kind" auto-filled from about_you.kind; default 'single' defensively.
  const kind = (watch('about_you.kind') as 'single' | 'couple' | undefined) ?? 'single';

  // ── Watched form values ───────────────────────────────────────────────────
  const manualOverrideAnnual = watch(`${basePath}.manualOverrideAnnual`) as number | undefined;
  const incomeExcludingOAS = watch(`${basePath}.incomeExcludingOAS`) as number | undefined;
  const spouseOasStatus = watch(`${basePath}.spouseOasStatus`) as SpouseOasStatus | undefined;
  const valueSourceMode = watch(`${basePath}.value_source.mode`) as BenefitSourceMode | undefined;
  const valueSourceConfidence = watch(`${basePath}.value_source.confidence`) as
    | BenefitEstimateConfidence
    | undefined;

  // D-16 / GIS-07: Cross-tab subscription. useWatch re-renders this component when the
  // OTHER tab's income field changes, enabling combined-income preview without a save round-trip.
  const spouseIncomeExcludingOAS = useWatch({ name: `${spousePath}.incomeExcludingOAS` }) as
    | number
    | undefined;

  // ── Tier derivation ───────────────────────────────────────────────────────
  // D-11: single → hard-coded 'single'; couple → derive from committed spouseOasStatus,
  // defaulting to 'couple-no-oas' until the user makes a radio selection.
  const tier: GisTier = useMemo(() => {
    if (kind === 'single') return 'single';
    return spouseOasStatusToTier(spouseOasStatus) ?? 'couple-no-oas';
  }, [kind, spouseOasStatus]);

  // ── Helper sub-panel state ────────────────────────────────────────────────
  const [helperOpen, setHelperOpen] = useState<boolean>(false);
  const [helperIncomeInput, setHelperIncomeInput] = useState<string>('');
  const [helperSpouseOasStatus, setHelperSpouseOasStatus] = useState<SpouseOasStatus | undefined>(
    undefined
  );

  const ctaButtonRef = useRef<HTMLButtonElement | null>(null);
  const firstHelperFieldRef = useRef<HTMLInputElement | HTMLButtonElement | null>(null);
  const manualAmountInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * Tracks whether the user has typed in the manual amount input since the
   * last commit / cancel / external write. Guards writeUserEntered from
   * overwriting helper-estimated provenance on a helper commit's focus-restore.
   *
   * Mirrors Phase 21 CppEstimatorCard (21-03) + Phase 22 OasEstimatorCard.
   * Full regression test ships in Plan 23-03 (Tests A–D).
   */
  const manualInputTouchedRef = useRef<boolean>(false);

  /**
   * D-13: "Discard estimate" — clears local helper state, collapses panel, returns
   * focus to helper CTA. No form fields are written. Mirrors Phase 22 cancelHelper.
   * Wrapped in useCallback (empty deps) so the ESC-key useEffect can list it as a
   * stable dependency without a stale-closure lint suppression.
   */
  const cancelHelper = useCallback((): void => {
    setHelperOpen(false);
    setHelperIncomeInput('');
    setHelperSpouseOasStatus(undefined);
    manualInputTouchedRef.current = false;
    setTimeout(() => ctaButtonRef.current?.focus(), 50);
  }, []); // setters and refs are stable across renders

  // ── Focus management on helper open (UI-SPEC §Interaction Contract) ───────
  useEffect(() => {
    if (!helperOpen) return undefined;
    const t = setTimeout(() => firstHelperFieldRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [helperOpen]);

  // ── ESC closes the helper panel ───────────────────────────────────────────
  useEffect(() => {
    if (!helperOpen) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') cancelHelper();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [helperOpen, cancelHelper]);

  // ── Live preview (cross-tab reactive — GIS-02 + GIS-07) ──────────────────
  // Re-derives any time own income, spouse income, tier, or helper-open state changes.
  // On the couple tab: requires a radio selection (helperSpouseOasStatus) to compute
  // a tier-specific preview. On the single tab: no radio; tier='single'.
  const helperPreview: GISEstimate | null = useMemo(() => {
    if (!helperOpen) return null;
    const ownIncome = Number(helperIncomeInput);
    if (!Number.isFinite(ownIncome) || helperIncomeInput.length === 0) return null;
    // D-11: couple tab requires a radio selection before showing preview.
    if (kind === 'couple' && helperSpouseOasStatus === undefined) return null;
    const previewTier: GisTier =
      kind === 'single'
        ? 'single'
        : (spouseOasStatusToTier(helperSpouseOasStatus) ?? 'couple-no-oas');
    return estimateGIS({
      kind: 'gis-helper',
      tier: previewTier,
      incomeExcludingOAS: Math.max(0, ownIncome),
      spouseIncomeExcludingOAS: spouseIncomeExcludingOAS,
    });
  }, [helperOpen, helperIncomeInput, kind, helperSpouseOasStatus, spouseIncomeExcludingOAS]);

  // ── Display rounding (D-19 — reuse Phase 21 precision helpers) ───────────
  const displayedAnnualPrecise: number | undefined =
    manualOverrideAnnual !== undefined && Number.isFinite(manualOverrideAnnual)
      ? manualOverrideAnnual
      : undefined;
  const displayedAnnualRounded =
    displayedAnnualPrecise !== undefined ? roundAnnual(displayedAnnualPrecise) : undefined;
  const displayedMonthlyRounded =
    displayedAnnualPrecise !== undefined ? roundMonthly(displayedAnnualPrecise / 12) : undefined;

  // ── Above-threshold detection from committed state (D-17) ─────────────────
  // A committed $0 with mode='estimated' confidence='low' signals above-threshold.
  // The Callout body is computed inline from GIS_2026 cutoffs — NOT hard-coded per PARAM-01.
  const isCommittedIneligible =
    displayedAnnualPrecise === 0 &&
    valueSourceMode === 'estimated' &&
    valueSourceConfidence === 'low';

  const calloutBody: string | null = (() => {
    if (!isCommittedIneligible) return null;
    const committedOwnIncome = incomeExcludingOAS ?? 0;
    const committedCombinedIncome =
      tier === 'single' ? committedOwnIncome : committedOwnIncome + (spouseIncomeExcludingOAS ?? 0);
    // Threshold derives from GIS_2026 parameters — never hard-coded per PARAM-01 (GIS-03).
    const committedThreshold =
      tier === 'single'
        ? GIS_2026.q2.single.annualIncomeCutoff
        : tier === 'couple-on-oas'
          ? GIS_2026.q2.spouseOnOas.combinedAnnualCutoff
          : tier === 'couple-on-allowance'
            ? GIS_2026.q2.spouseOnAllowance.combinedAnnualCutoff
            : GIS_2026.q2.spouseNoOas.combinedAnnualCutoff;
    return `At your projected combined income of $${Math.round(committedCombinedIncome).toLocaleString('en-CA')}, you're above the ${tierLabel(tier)} GIS threshold of $${committedThreshold.toLocaleString('en-CA')}. The engine re-checks eligibility annually.`;
  })();

  // ── Commit handlers ───────────────────────────────────────────────────────

  /**
   * D-13: "Use this estimate" — writes precise estimate to the form.
   * The button is enabled for both eligible AND ineligible ($0) cases.
   * Ineligible: commits $0 with confidence='low' + above-threshold note (D-09).
   */
  const commitHelper = (): void => {
    if (helperPreview === null) return;
    const ownIncome = Math.max(0, Number(helperIncomeInput));
    const confidence: BenefitEstimateConfidence =
      helperPreview.confidence === 'MEDIUM' ? 'medium' : 'low';
    const citation = buildGisCitation(helperPreview.tier);

    // D-09: note derivation for downstream LongReportData consumers.
    let note: string;
    if (helperPreview.eligible) {
      const reductionRate =
        helperPreview.tier === 'single'
          ? GIS_2026.reductionRateSingle
          : GIS_2026.reductionRateCoupleBothOas;
      const incomeForCalc =
        helperPreview.tier === 'single' ? ownIncome : ownIncome + (spouseIncomeExcludingOAS ?? 0);
      const reduction = Math.round(incomeForCalc * reductionRate);
      note =
        `Estimated ${tierLabel(helperPreview.tier)}; ` +
        `projected non-OAS income $${Math.round(incomeForCalc).toLocaleString('en-CA')}; ` +
        `reduction $${reduction.toLocaleString('en-CA')}/yr per ${(reductionRate * 100).toFixed(0)}% rate`;
    } else {
      note =
        `At or above ${tierLabel(helperPreview.tier)} GIS threshold of ` +
        `$${helperPreview.thresholdUsed.toLocaleString('en-CA')} at projected income ` +
        `$${Math.round(
          helperPreview.tier === 'single' ? ownIncome : ownIncome + (spouseIncomeExcludingOAS ?? 0)
        ).toLocaleString('en-CA')}`;
    }

    setValue(`${basePath}.manualOverrideAnnual`, helperPreview.annualGross, { shouldDirty: true });
    setValue(`${basePath}.incomeExcludingOAS`, ownIncome, { shouldDirty: true });
    if (kind === 'couple' && helperSpouseOasStatus !== undefined) {
      setValue(`${basePath}.spouseOasStatus`, helperSpouseOasStatus, { shouldDirty: true });
    }
    setValue(`${basePath}.inputPath`, 'helper', { shouldDirty: true });
    setValue(
      `${basePath}.value_source`,
      { mode: 'estimated', confidence, citation, note },
      { shouldDirty: true }
    );

    // Reset guard so subsequent blurs don't auto-promote provenance (manualInputTouchedRef guard).
    manualInputTouchedRef.current = false;
    setHelperOpen(false);
    // UI-SPEC §Interaction Contract "Focus management on close (Use this estimate)":
    // Focus moves to the manual GIS amount field after commit.
    setTimeout(() => manualAmountInputRef.current?.focus(), 50);
  };

  // ── Manual input onBlur promotion (manualInputTouchedRef guard) ───────────
  // Mirrors Phase 21 21-03 CppEstimatorCard + Phase 22 OasEstimatorCard.
  // The guard ref is declared above; the register call below uses it.
  const manualAmountReg = register(`${basePath}.manualOverrideAnnual`, {
    valueAsNumber: true,
    onChange: () => {
      manualInputTouchedRef.current = true;
    },
    onBlur: () => {
      if (!manualInputTouchedRef.current) return;
      const current = getValues(`${basePath}.manualOverrideAnnual`) as number | undefined;
      if (current === undefined || !Number.isFinite(current)) return;
      setValue(`${basePath}.inputPath`, 'manual', { shouldDirty: true });
      setValue(
        `${basePath}.value_source`,
        { mode: 'user_entered', confidence: 'high', citation: buildGisCitation(tier) },
        { shouldDirty: true }
      );
      manualInputTouchedRef.current = false;
    },
  });

  void provinceLabel; // accepted for API symmetry; GIS is federal (no province routing in v4.7)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <section
      className="rounded-md border border-ds-outline-variant bg-ds-surface p-4 space-y-3"
      aria-labelledby={`gis-card-heading-${person}`}
      data-testid={`gov-pensions-gis-${person}`}
    >
      {/* Card heading + tier-routed citation chip */}
      <header className="flex items-center justify-between gap-2">
        <h3 id={`gis-card-heading-${person}`} className="text-sm font-semibold">
          GIS — Estimate
        </h3>
        <SourceCitationLink
          doc={GIS_CITATION_DOC}
          anchor={GIS_TIER_ANCHORS[tier]}
          label="2026 GIS parameters"
        />
      </header>

      {/* Manual amount input — always visible (D-18 primary path) */}
      <div className="space-y-1">
        <Label htmlFor={`gis-manual-${person}`}>Annual GIS amount</Label>
        <Input
          id={`gis-manual-${person}`}
          ref={(el) => {
            manualAmountInputRef.current = el;
            manualAmountReg.ref(el);
          }}
          onBlur={manualAmountReg.onBlur}
          onChange={manualAmountReg.onChange}
          name={manualAmountReg.name}
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          placeholder="e.g. 0"
          aria-describedby={`gis-manual-help-${person} gis-eligibility-subline-${person}`}
        />
        <p id={`gis-manual-help-${person}`} className="text-xs text-muted-foreground">
          Enter your expected annual GIS amount, or 0 if you don't expect to receive GIS
        </p>
        {/* D-18: always-visible GIS eligibility caveat sub-line */}
        <p id={`gis-eligibility-subline-${person}`} className="text-xs text-muted-foreground">
          GIS eligibility depends on your projected after-tax spending in retirement each year —
          re-evaluated by the engine annually.
        </p>
      </div>

      {/* Eligibility amount block (D-17 / GIS-05) — when positive + eligible */}
      {displayedAnnualRounded !== undefined &&
        displayedAnnualRounded > 0 &&
        !isCommittedIneligible && (
          <div
            role="status"
            aria-live="polite"
            className="space-y-1"
            data-testid={`gis-displayed-amount-${person}`}
          >
            <p className="text-xs text-muted-foreground">You may be eligible for:</p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-xl font-semibold font-mono tabular-nums">
                {`$ ${displayedAnnualRounded.toLocaleString('en-CA')} / yr`}
              </span>
              <YearTag year={2026} />
              {valueSourceMode && valueSourceConfidence && (
                <ConfidenceChip
                  mode={valueSourceMode}
                  confidence={valueSourceConfidence}
                  amount={displayedAnnualPrecise}
                />
              )}
            </div>
            {displayedMonthlyRounded !== undefined && (
              <p className="text-sm font-mono tabular-nums text-muted-foreground">
                {`~ $ ${displayedMonthlyRounded.toLocaleString('en-CA')} / mo`}
                <YearTag year={2026} />
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Eligibility depends on your projected after-tax spending in retirement each year — the
              engine re-evaluates annually.
            </p>
          </div>
        )}

      {/* Above-threshold Callout (D-17 / D-04) — replaces amount block when committed $0 ineligible */}
      {calloutBody !== null && (
        <Callout variant="info" className="mt-2">
          {calloutBody}
        </Callout>
      )}

      {/* Helper CTA link (D-01) — always visible */}
      <Button
        ref={ctaButtonRef}
        type="button"
        variant="link"
        className="px-0 py-1 h-auto text-left"
        aria-expanded={helperOpen}
        aria-controls={`gis-helper-${person}`}
        aria-label="Open helper to estimate GIS amount"
        onClick={() => setHelperOpen((v) => !v)}
      >
        {"I don't know — help me estimate"}
      </Button>

      {/* Helper sub-panel (D-02) */}
      <Collapsible open={helperOpen} onOpenChange={setHelperOpen}>
        <CollapsibleContent>
          <div
            id={`gis-helper-${person}`}
            className="rounded-md border border-ds-outline-variant bg-background p-4 space-y-3 mt-1"
            data-testid={`gov-pensions-gis-helper-${person}`}
          >
            {/* D-10: marital context line — read-only, derived from about_you.kind */}
            <p className="text-xs text-muted-foreground">
              {kind === 'single' ? 'You are: Single' : 'You are part of a couple'}
            </p>

            {/* D-11 / GIS-04: Spouse-OAS RadioGroup — couple tab only */}
            {kind === 'couple' && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">
                  Does your spouse currently receive OAS or Allowance?
                </legend>
                <RadioGroup
                  value={helperSpouseOasStatus ?? ''}
                  onValueChange={(v) => setHelperSpouseOasStatus(v as SpouseOasStatus)}
                  className="space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem
                      value="on-oas"
                      id={`gis-spouse-oas-on-${person}`}
                      ref={(el: HTMLButtonElement | null) => {
                        if (helperOpen && kind === 'couple') firstHelperFieldRef.current = el;
                      }}
                    />
                    <Label htmlFor={`gis-spouse-oas-on-${person}`} className="text-sm font-normal">
                      Spouse is receiving OAS
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem
                      value="on-allowance"
                      id={`gis-spouse-oas-allowance-${person}`}
                    />
                    <Label
                      htmlFor={`gis-spouse-oas-allowance-${person}`}
                      className="text-sm font-normal"
                    >
                      Spouse is receiving Allowance or Allowance for Survivor
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="no-oas" id={`gis-spouse-oas-no-${person}`} />
                    <Label htmlFor={`gis-spouse-oas-no-${person}`} className="text-sm font-normal">
                      Spouse is not yet receiving OAS
                    </Label>
                  </div>
                </RadioGroup>
              </fieldset>
            )}

            {/* D-12: Income field — income excluding OAS */}
            <div className="space-y-1">
              <Label htmlFor={`gis-helper-income-${person}`}>
                Your estimated annual income excluding OAS
              </Label>
              <Input
                id={`gis-helper-income-${person}`}
                ref={(el) => {
                  if (helperOpen && kind === 'single') firstHelperFieldRef.current = el;
                }}
                type="number"
                min={0}
                max={1_000_000}
                step="any"
                inputMode="decimal"
                placeholder="e.g. 18 000"
                value={helperIncomeInput}
                onChange={(e) => setHelperIncomeInput(e.target.value)}
                aria-describedby={`gis-helper-income-help-${person}`}
              />
              <p id={`gis-helper-income-help-${person}`} className="text-xs text-muted-foreground">
                {
                  "Don't include OAS — the calculator handles that automatically. Include CPP/QPP, employment income, RRSP/RRIF withdrawals, investment income."
                }
              </p>
            </div>

            {/* D-16 / GIS-07: Cross-tab reactivity note — couple tab only */}
            {kind === 'couple' && (
              <p className="text-xs text-muted-foreground">
                Live preview updates when either spouse changes income on their own tab.
              </p>
            )}

            {/* Live preview (GIS-02 / GIS-07 combined-income reactive preview) */}
            <div role="status" aria-live="polite" className="text-sm">
              {helperPreview === null && (
                <p className="text-muted-foreground">
                  Enter your estimated income above to see your eligibility estimate.
                </p>
              )}
              {helperPreview !== null && helperPreview.eligible && (
                <p>
                  <span className="font-semibold">You may be eligible for:</span>{' '}
                  <span className="font-mono tabular-nums">
                    {`$ ${roundAnnual(helperPreview.annualGross).toLocaleString('en-CA')} / yr`}
                  </span>{' '}
                  &bull;{' '}
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {`~ $ ${roundMonthly(helperPreview.monthlyGross).toLocaleString('en-CA')} / mo`}
                  </span>
                  <YearTag year={2026} />
                </p>
              )}
              {helperPreview !== null && !helperPreview.eligible && (
                <p className="text-muted-foreground">Not eligible at this projected income</p>
              )}
            </div>

            {/* Buttons row */}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="default"
                onClick={commitHelper}
                disabled={helperPreview === null}
              >
                Use this estimate
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={cancelHelper}
                aria-label="Discard helper input and close panel"
                className="px-0"
              >
                Discard estimate
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
