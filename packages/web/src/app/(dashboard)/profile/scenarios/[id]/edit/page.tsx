'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ChevronDown, Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { WithdrawalPlanSection } from '@/components/projection/withdrawal/WithdrawalPlanSection';
import { PresetSelectorCard } from '@/components/projection/withdrawal/PresetSelectorCard';
import { PresetSwitchConfirmDialog } from '@/components/projection/withdrawal/PresetSwitchConfirmDialog';
import { ImpactPreview } from '@/components/projection/withdrawal/ImpactPreview';
import { ComparisonModeModal } from '@/components/projection/withdrawal/ComparisonModeModal';
import { deriveAccountCardMetadata } from '@/components/projection/withdrawal/account-metadata';
import {
  applyPresetToTaxState,
  drawdownOrderToTypeOrder,
  presetSwitchNeedsConfirm,
} from '@/components/projection/withdrawal/preset-apply';
import {
  WEB_WITHDRAWAL_PRESETS,
  resolvePresetIdFromOrder,
  type WithdrawalPresetId,
} from '@/lib/withdrawal-presets';
import { buildAllConstraintWarnings, deriveConstraintInput } from '@/lib/constraint-warnings';
import {
  getProfileScenario,
  updateDecisions,
  runProfileScenario,
} from '@/lib/api/profile-scenarios';
import { getProfile } from '@/lib/api/profile';
import type { ProfileScenarioDetail, ScenarioDecisionsPatch } from '@/types/profile-scenario';
import type { ProfileData } from '@/lib/api/profile';
import {
  extractAccountCards,
  extractPropertyCards,
  getHasSpouse,
  getProfileDefault,
} from '@/lib/profile-utils';
import type { AccountCardInfo, PropertyCardInfo } from '@/lib/profile-utils';
import { findContributionOverages, type RoomViolation } from '@/lib/contribution-room';
import type { ProjectionYearRow } from '@retireops/shared';

import type { TimingState, TaxState, SavingsState, SpendingState } from './editor-types';
import { SpendingSection } from './SpendingSection';
import { SavingsSection } from './SavingsSection';
import { TimingSection } from './TimingSection';
import { TaxStrategyControls } from './TaxStrategyControls';

import {
  defaultTimingState,
  defaultTaxState,
  defaultSavingsState,
  defaultSpendingState,
  buildFormStates,
} from './editor-helpers';

// ─── Section header component ─────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  isDirty: boolean;
  isOpen: boolean;
  onToggle: () => void;
}

function SectionHeader({ title, isDirty, isOpen, onToggle }: SectionHeaderProps) {
  return (
    <CollapsibleTrigger asChild>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between w-full p-4 text-left"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-ds-on-surface">{title}</span>
          {isDirty && (
            <span className="w-2 h-2 rounded-full bg-primary inline-block" aria-hidden="true" />
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-ds-on-surface-variant transition-transform${isOpen ? ' rotate-180' : ''}`}
        />
      </button>
    </CollapsibleTrigger>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DecisionsEditorPage() {
  const params = useParams();
  const id = String(params['id'] ?? '');
  const { toast } = useToast();
  const router = useRouter();

  // ── Run state
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = async () => {
    setIsRunning(true);
    try {
      await runProfileScenario(id);
      router.push(`/profile/scenarios/${id}/results`);
    } catch {
      toast({ variant: 'destructive', title: 'Projection failed. Please try again.' });
      setIsRunning(false);
    }
  };

  // ── Data load state
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<ProfileScenarioDetail | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);

  // ── Derived profile data
  const [stepData, setStepData] = useState<Record<string, unknown>>({});
  const [accountCards, setAccountCards] = useState<AccountCardInfo[]>([]);
  const [propertyCards, setPropertyCards] = useState<PropertyCardInfo[]>([]);
  const [hasSpouse, setHasSpouse] = useState(false);
  const [hasDbPensions, setHasDbPensions] = useState(false);

  // ── Section open states
  const [timingOpen, setTimingOpen] = useState(true);
  const [taxOpen, setTaxOpen] = useState(true);
  const [savingsOpen, setSavingsOpen] = useState(true);
  const [spendingOpen, setSpendingOpen] = useState(true);

  // ── Section form states
  const [timingState, setTimingState] = useState<TimingState>(defaultTimingState());
  const [taxState, setTaxState] = useState<TaxState>(defaultTaxState([]));
  const [savingsState, setSavingsState] = useState<SavingsState>(defaultSavingsState());
  const [spendingState, setSpendingState] = useState<SpendingState>(defaultSpendingState());

  // ── Preset selector state (Phase 28 — WD-UI-05)
  const [pendingPresetId, setPendingPresetId] = useState<WithdrawalPresetId | null>(null);

  // ── Comparison-mode modal (Phase 32 — CMP-01..CMP-05)
  // baseSnapshotRef is captured (deep-cloned) when the user clicks "Compare
  // Strategies" so the modal renders against a frozen view of taxState. Live
  // edits beneath the modal cannot churn the comparison (Pitfall 5).
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const baseSnapshotRef = useRef<Record<string, unknown> | null>(null);

  // ── Dirty flags
  const [timingDirty, setTimingDirty] = useState(false);
  const [taxDirty, setTaxDirty] = useState(false);
  const [savingsDirty, setSavingsDirty] = useState(false);
  const [spendingDirty, setSpendingDirty] = useState(false);

  // ── Save states
  const [savingTiming, setSavingTiming] = useState(false);
  const [savingTax, setSavingTax] = useState(false);
  const [savingSavings, setSavingSavings] = useState(false);
  const [savingSpending, setSavingSpending] = useState(false);
  const [timingSaveError, setTimingSaveError] = useState(false);
  const [taxSaveError, setTaxSaveError] = useState(false);
  const [savingsSaveError, setSavingsSaveError] = useState(false);
  const [spendingSaveError, setSpendingSaveError] = useState(false);

  // Phase 34-04 — derive live constraint warnings. Placed here (before early returns)
  // to satisfy Rules of Hooks. Uses state directly; returns [] when no projection rows
  // exist (scenario not yet run) so the banner stays null (E1 invariant preserved).
  const warnings = useMemo(() => {
    const rows =
      (scenario?.result_data?.['projectionRows'] as
        | Array<{ year: number; age: number; tfsaWithdrawal?: number; totalGrossIncome?: number }>
        | undefined) ?? [];
    const typeOrder = drawdownOrderToTypeOrder(taxState.drawdownOrder, accountCards);
    const input = deriveConstraintInput({
      projectionRows: rows,
      accountCards,
      drawdownTypeOrder: typeOrder,
    });
    return input === null ? [] : buildAllConstraintWarnings(input);
    // deps: scenario (result_data source), taxState.drawdownOrder (drawdown order
    // for nonReg detection), accountCards (id→type map for drawdownOrderToTypeOrder).
    // Full taxState not needed — only drawdownOrder feeds deriveConstraintInput.
  }, [scenario, taxState.drawdownOrder, accountCards]);

  // ── Load data
  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setLoadError(null);
      const [scenarioData, profileData] = await Promise.all([getProfileScenario(id), getProfile()]);
      setScenario(scenarioData);
      setProfile(profileData);
    } catch {
      setLoadError('Failed to load scenario. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ── Initialize form states when data is loaded
  useEffect(() => {
    if (!scenario || !profile) return;

    const sd = profile.stepData ?? {};
    setStepData(sd);

    const accounts = extractAccountCards(sd);
    const properties = extractPropertyCards(sd);
    const spouse = getHasSpouse(sd);
    setAccountCards(accounts);
    setPropertyCards(properties);
    setHasSpouse(spouse);

    // Check for DB pensions
    const benefitsData = sd['benefits'] as Record<string, unknown> | undefined;
    const dbPensionsArr = benefitsData?.dbPensions as unknown[] | undefined;
    setHasDbPensions(Array.isArray(dbPensionsArr) && dbPensionsArr.length > 0);

    const { timing, tax, savings, spending } = buildFormStates(scenario.decisions, accounts);
    setTimingState(timing);
    setTaxState(tax);
    setSavingsState(savings);
    setSpendingState(spending);
  }, [scenario, profile]);

  // ── Save handlers
  // Shared skeleton: flag saving → PUT patch → clear dirty + toast, surface error,
  // always clear saving. Each section differs only in its setters and the patch it
  // builds, so the boilerplate lives here once and the per-section calls follow.
  const makeSaveHandler =
    (
      setSaving: (v: boolean) => void,
      setError: (v: boolean) => void,
      setDirty: (v: boolean) => void,
      buildPatch: () => ScenarioDecisionsPatch
    ) =>
    async () => {
      setSaving(true);
      setError(false);
      try {
        await updateDecisions(id, buildPatch());
        setDirty(false);
        toast({ title: 'Saved' });
      } catch {
        setError(true);
      } finally {
        setSaving(false);
      }
    };

  const handleSaveTiming = makeSaveHandler(
    setSavingTiming,
    setTimingSaveError,
    setTimingDirty,
    () => ({
      cppStartAge: timingState.cppStartAge,
      spouseCppStartAge: timingState.spouseCppStartAge,
      oasStartAge: timingState.oasStartAge,
      spouseOasStartAge: timingState.spouseOasStartAge,
      retirementAge: timingState.retirementAge,
      spouseRetirementAge: timingState.spouseRetirementAge,
      dbPensionStartAge: timingState.dbPensionStartAge,
      propertySaleDecisions: timingState.propertySaleDecisions.map((row) => ({
        propertyId: row.propertyId,
        saleYear: row.saleYear,
        sellingCostsPercent: row.sellingCostsPercent / 100,
      })),
    })
  );

  const handleSaveTax = makeSaveHandler(setSavingTax, setTaxSaveError, setTaxDirty, () => ({
    drawdownOrder: taxState.drawdownOrder,
    rrspMeltdown: {
      enabled: taxState.rrspMeltdown.enabled,
      annualAmount: taxState.rrspMeltdown.annualAmount,
      startYear: taxState.rrspMeltdown.startYear,
      endYear: taxState.rrspMeltdown.endYear,
    },
    incomeSplitting: {
      enabled: taxState.incomeSplitting.enabled,
      splitPercent: taxState.incomeSplitting.splitPercent / 100,
    },
    oasClawbackAvoidance: {
      enabled: taxState.oasClawbackAvoidance.enabled,
      incomeThreshold: taxState.oasClawbackAvoidance.incomeThreshold,
    },
    bracketFill: {
      enabled: taxState.bracketFill.enabled,
      ...(taxState.bracketFill.bracketTarget !== 'current' && {
        bracketTarget: taxState.bracketFill.bracketTarget,
      }),
      ...(taxState.bracketFill.annualCap !== undefined && {
        annualCap: taxState.bracketFill.annualCap,
      }),
    },
  }));

  const handleSaveSavings = makeSaveHandler(
    setSavingSavings,
    setSavingsSaveError,
    setSavingsDirty,
    () => ({
      contributionOverrides: savingsState.contributionOverrides,
    })
  );

  const handleSaveSpending = makeSaveHandler(
    setSavingSpending,
    setSpendingSaveError,
    setSpendingDirty,
    () => ({
      targetRetirementSpending: spendingState.targetRetirementSpending,
      inflationRate: spendingState.inflationRate / 100,
      ageBandReductions: spendingState.ageBandReductions.map((row) => ({
        fromAge: row.fromAge,
        reductionPercent: row.reductionPercent / 100,
      })),
      legacyTarget: spendingState.legacyTarget,
    })
  );

  // ── Drawdown reorder helper — swap an entry with its neighbour in the given
  // direction; the out-of-range guard makes "up from first" / "down from last" no-ops.
  const moveDrawdown = (index: number, direction: 'up' | 'down') => {
    setTaxState((prev) => {
      const order = [...prev.drawdownOrder];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= order.length) return prev;
      [order[index], order[target]] = [order[target], order[index]];
      return { ...prev, drawdownOrder: order };
    });
    setTaxDirty(true);
  };

  // ── Loading / error states
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-8">
          <div className="h-6 w-32 bg-ds-surface-raised animate-pulse rounded-card" />
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-ds-surface-raised animate-pulse rounded-card h-24" />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <div className="bg-ds-error-container text-ds-on-error-container rounded-card p-6">
          <p className="text-sm">{loadError}</p>
          <Button variant="outline" className="mt-4" onClick={() => void loadData()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const accountMap = new Map(accountCards.map((a) => [a.id, a.label]));
  const typeMap = new Map(accountCards.map((a) => [a.id, a.type]));

  // M005/P4: contribution-room warnings for RRSP overrides.
  // Uses the most-recent projection's per-year rrspContributionRoom. Banner
  // refreshes on save + re-run; overrides for non-RRSP accounts are ignored.
  const projectionRows =
    (scenario?.result_data?.['projectionRows'] as ProjectionYearRow[] | undefined) ?? [];
  const rrspOverrides = savingsState.contributionOverrides
    .filter((o) => typeMap.get(o.accountId) === 'RRSP')
    .map((o) => ({
      accountId: o.accountId,
      annualAmount: o.annualAmount,
      startYear: o.startYear,
      endYear: o.endYear,
    }));
  const roomViolations: RoomViolation[] = findContributionOverages(rrspOverrides, projectionRows);

  // ── Phase 28: derive per-card metadata + the currently-active preset id.
  const accountMetadata = deriveAccountCardMetadata(accountCards, stepData, projectionRows);
  const drawdownTypeOrder = drawdownOrderToTypeOrder(taxState.drawdownOrder, accountCards);
  const scenarioStrategyId = (scenario?.decisions as { strategyId?: string } | undefined)
    ?.strategyId;
  const currentPresetId: WithdrawalPresetId = resolvePresetIdFromOrder({
    drawdownTypeOrder,
    strategyId: scenarioStrategyId,
    meltdownEnabled: taxState.rrspMeltdown.enabled,
    clawbackEnabled: taxState.oasClawbackAvoidance.enabled,
  });

  const pendingPresetName =
    pendingPresetId !== null
      ? (WEB_WITHDRAWAL_PRESETS.find((p) => p.id === pendingPresetId)?.name ?? '')
      : '';

  const handlePresetSelect = (id: WithdrawalPresetId) => {
    if (id === currentPresetId) return; // no-op on already-active
    if (id === 'custom') return; // 'custom' is a status indicator, not selectable
    if (presetSwitchNeedsConfirm(taxState, id, accountCards, currentPresetId)) {
      setPendingPresetId(id);
      return;
    }
    // No confirm needed — apply immediately.
    setTaxState((prev) => applyPresetToTaxState(prev, id, accountCards));
    setTaxDirty(true);
  };

  const handlePresetConfirm = () => {
    if (pendingPresetId === null) return;
    const id = pendingPresetId;
    setTaxState((prev) => applyPresetToTaxState(prev, id, accountCards));
    setTaxDirty(true);
    setPendingPresetId(null);
  };

  // Profile defaults
  const defaultCppAge = getProfileDefault(stepData, 'benefits.cppStartAge');
  const defaultOasAge = getProfileDefault(stepData, 'benefits.oasStartAge');
  const defaultRetirementAge = getProfileDefault(stepData, 'about_you.retirementAge');
  const defaultSpouseRetirementAge = getProfileDefault(stepData, 'spouse.retirementAge');
  const defaultExpenses =
    getProfileDefault(stepData, 'property_goals.retirementAnnualExpenses') ??
    getProfileDefault(stepData, 'about_you.retirementAnnualExpenses');

  return (
    <div className="space-y-8 pb-16">
      {/* Page header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <Link
            href="/profile/scenarios"
            className="text-sm text-ds-on-surface-variant hover:underline flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Scenarios
          </Link>
          <h1 className="text-xl font-semibold font-display text-ds-on-background mt-2">
            Edit Scenario
          </h1>
          <p className="text-sm text-ds-on-surface-variant">
            Configure strategy overrides for this scenario. Profile values are shown as defaults.
          </p>
        </div>
        <Button
          size="sm"
          className="bg-ds-primary text-ds-on-primary rounded-button"
          onClick={() => void handleRun()}
          disabled={isRunning}
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Run Projection
            </>
          )}
        </Button>
      </div>

      {/* ─────────────────────────────────────────────────────── TIMING ── */}
      <Card className="bg-ds-surface rounded-card border-ds-outline-variant">
        <Collapsible open={timingOpen} onOpenChange={setTimingOpen}>
          <SectionHeader
            title="Timing"
            isDirty={timingDirty}
            isOpen={timingOpen}
            onToggle={() => setTimingOpen((v) => !v)}
          />
          <CollapsibleContent>
            <TimingSection
              state={timingState}
              setState={setTimingState}
              setDirty={setTimingDirty}
              saving={savingTiming}
              saveError={timingSaveError}
              onSave={() => void handleSaveTiming()}
              hasSpouse={hasSpouse}
              hasDbPensions={hasDbPensions}
              propertyCards={propertyCards}
              defaultCppAge={typeof defaultCppAge === 'number' ? defaultCppAge : undefined}
              defaultOasAge={typeof defaultOasAge === 'number' ? defaultOasAge : undefined}
              defaultRetirementAge={
                typeof defaultRetirementAge === 'number' ? defaultRetirementAge : undefined
              }
              defaultSpouseRetirementAge={
                typeof defaultSpouseRetirementAge === 'number'
                  ? defaultSpouseRetirementAge
                  : undefined
              }
            />
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* ────────────────────────────────────────────── TAX STRATEGY ── */}
      <Card className="bg-ds-surface rounded-card border-ds-outline-variant">
        <Collapsible open={taxOpen} onOpenChange={setTaxOpen}>
          <SectionHeader
            title="Tax Strategy"
            isDirty={taxDirty}
            isOpen={taxOpen}
            onToggle={() => setTaxOpen((v) => !v)}
          />
          <CollapsibleContent>
            <CardContent className="p-6 pt-0 space-y-6">
              {/* Withdrawal Plan — preset selector + reorderable account cards (Phase 28) */}
              <div className="space-y-6" data-section="withdrawal-plan-container">
                <PresetSelectorCard
                  currentPresetId={currentPresetId}
                  onSelect={handlePresetSelect}
                  scenarioId={id}
                />
                <WithdrawalPlanSection
                  drawdownOrder={taxState.drawdownOrder}
                  accountCards={accountCards}
                  metadataByAccountId={accountMetadata}
                  onMoveUp={(index) => moveDrawdown(index, 'up')}
                  onMoveDown={(index) => moveDrawdown(index, 'down')}
                  warnings={warnings}
                />
                {/* Phase 31-01 — live what-if outcomes for the working taxState.
                    Wired below WithdrawalPlanSection per 31-CONTEXT.md scope. */}
                <ImpactPreview
                  scenarioId={id}
                  currentPatch={{
                    drawdownOrder: taxState.drawdownOrder,
                    rrspMeltdown: {
                      enabled: taxState.rrspMeltdown.enabled,
                      annualAmount: taxState.rrspMeltdown.annualAmount,
                      startYear: taxState.rrspMeltdown.startYear,
                      endYear: taxState.rrspMeltdown.endYear,
                    },
                    incomeSplitting: {
                      enabled: taxState.incomeSplitting.enabled,
                      splitPercent: taxState.incomeSplitting.splitPercent / 100,
                    },
                    oasClawbackAvoidance: {
                      enabled: taxState.oasClawbackAvoidance.enabled,
                      incomeThreshold: taxState.oasClawbackAvoidance.incomeThreshold,
                    },
                    bracketFill: {
                      enabled: taxState.bracketFill.enabled,
                      ...(taxState.bracketFill.bracketTarget !== 'current' && {
                        bracketTarget: taxState.bracketFill.bracketTarget,
                      }),
                      ...(taxState.bracketFill.annualCap !== undefined && {
                        annualCap: taxState.bracketFill.annualCap,
                      }),
                    },
                  }}
                />
                {/* Phase 32 — comparison-mode entry point. Snapshots taxState
                    via useRef BEFORE opening so the modal is decoupled from
                    live edits (Pitfall 5). Modal is rendered out-of-flow at
                    the page root to avoid being nested inside the collapsible
                    section's overflow-clipped area. */}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid="open-comparison-modal"
                    onClick={() => {
                      // C1 fix (Phase 34.1-02 branch a.i): enrich the snapshot
                      // with the type-token drawdownOrder + scenario strategyId
                      // so ComparisonModeModal.resolveSnapshotPresetId resolves
                      // to the same currentPresetId as the page (line 600-609).
                      // taxState carries account IDs, not engine type tokens,
                      // and does NOT carry strategyId.
                      const typeTokenOrder = drawdownOrderToTypeOrder(
                        taxState.drawdownOrder,
                        accountCards
                      );
                      baseSnapshotRef.current = {
                        ...(JSON.parse(JSON.stringify(taxState)) as Record<string, unknown>),
                        drawdownOrder: typeTokenOrder,
                        strategyId: scenarioStrategyId,
                      };
                      setComparisonOpen(true);
                    }}
                  >
                    Compare Strategies
                  </Button>
                </div>
              </div>

              <Separator />

              <TaxStrategyControls
                state={taxState}
                setState={setTaxState}
                setDirty={setTaxDirty}
                hasSpouse={hasSpouse}
                saving={savingTax}
                saveError={taxSaveError}
                onSave={() => void handleSaveTax()}
              />
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* ──────────────────────────────────────────────────── SAVINGS ── */}
      <Card className="bg-ds-surface rounded-card border-ds-outline-variant">
        <Collapsible open={savingsOpen} onOpenChange={setSavingsOpen}>
          <SectionHeader
            title="Savings"
            isDirty={savingsDirty}
            isOpen={savingsOpen}
            onToggle={() => setSavingsOpen((v) => !v)}
          />
          <CollapsibleContent>
            <SavingsSection
              state={savingsState}
              setState={setSavingsState}
              setDirty={setSavingsDirty}
              saving={savingSavings}
              saveError={savingsSaveError}
              onSave={() => void handleSaveSavings()}
              accountCards={accountCards}
              roomViolations={roomViolations}
              accountMap={accountMap}
            />
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* ─────────────────────────────────────────────────── SPENDING ── */}
      <Card className="bg-ds-surface rounded-card border-ds-outline-variant">
        <Collapsible open={spendingOpen} onOpenChange={setSpendingOpen}>
          <SectionHeader
            title="Spending"
            isDirty={spendingDirty}
            isOpen={spendingOpen}
            onToggle={() => setSpendingOpen((v) => !v)}
          />
          <CollapsibleContent>
            <SpendingSection
              state={spendingState}
              setState={setSpendingState}
              setDirty={setSpendingDirty}
              saving={savingSpending}
              saveError={spendingSaveError}
              onSave={() => void handleSaveSpending()}
              defaultExpenses={typeof defaultExpenses === 'number' ? defaultExpenses : undefined}
            />
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <PresetSwitchConfirmDialog
        open={pendingPresetId !== null}
        presetName={pendingPresetName}
        onOpenChange={(open) => {
          if (!open) setPendingPresetId(null);
        }}
        onConfirm={handlePresetConfirm}
      />

      {/* Phase 32 — comparison-mode modal. baseDecisionsSnapshot reads from
          the ref (set on button click). The ref is stable across rerenders so
          the modal's effect doesn't churn on live edits beneath it. Falls
          back to the live taxState only when the modal has never been opened
          — in that case the modal is closed and the prop is never read. */}
      <ComparisonModeModal
        open={comparisonOpen}
        onOpenChange={setComparisonOpen}
        scenarioId={id}
        baseDecisionsSnapshot={
          baseSnapshotRef.current ?? (taxState as unknown as Record<string, unknown>)
        }
      />
    </div>
  );
}
