/* eslint-disable @typescript-eslint/restrict-template-expressions */
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ChevronDown, X, Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldLabelHelp } from '@/components/ui/field-help';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { DefaultBadge } from '@/components/profile/DefaultBadge';
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
import type { ProfileScenarioDetail } from '@/types/profile-scenario';
import type { ProfileData } from '@/lib/api/profile';
import {
  extractAccountCards,
  extractPropertyCards,
  getHasSpouse,
  getProfileDefault,
  cppAdjustment,
  oasAdjustment,
} from '@/lib/profile-utils';
import type { AccountCardInfo, PropertyCardInfo } from '@/lib/profile-utils';
import { findContributionOverages, type RoomViolation } from '@/lib/contribution-room';
import type { ProjectionYearRow } from '@retireops/shared';
import { formatCurrency } from '@/lib/utils';

// ─── Local state shapes ───────────────────────────────────────────────────────

interface PropertySaleRow {
  propertyId: string;
  saleYear: number;
  sellingCostsPercent: number; // display: 0–100
}

interface TimingState {
  cppStartAge: number;
  spouseCppStartAge: number;
  oasStartAge: number;
  spouseOasStartAge: number;
  retirementAge: number;
  spouseRetirementAge: number;
  dbPensionStartAge: number;
  propertySaleDecisions: PropertySaleRow[];
}

interface RrspMeltdown {
  enabled: boolean;
  annualAmount: number;
  startYear: number;
  endYear: number;
}

interface IncomeSplitting {
  enabled: boolean;
  splitPercent: number; // display: 0–50
}

interface OasClawback {
  enabled: boolean;
  incomeThreshold: number;
}

interface BracketFill {
  enabled: boolean;
  bracketTarget: 'current' | 'next';
  // Undefined = unlimited (engine fills to bracket ceiling). A literal 0 would instruct the
  // engine to withdraw nothing, so callers must use undefined, not 0, to mean "no cap".
  annualCap: number | undefined;
}

interface TaxState {
  drawdownOrder: string[];
  rrspMeltdown: RrspMeltdown;
  incomeSplitting: IncomeSplitting;
  oasClawbackAvoidance: OasClawback;
  bracketFill: BracketFill;
}

interface ContributionOverrideRow {
  accountId: string;
  annualAmount: number;
  startYear: number;
  endYear: number;
}

interface SavingsState {
  contributionOverrides: ContributionOverrideRow[];
}

interface AgeBandReductionRow {
  fromAge: number;
  reductionPercent: number; // display: 0–100
}

interface SpendingState {
  targetRetirementSpending: number;
  inflationRate: number; // display: 0–20
  ageBandReductions: AgeBandReductionRow[];
  legacyTarget: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function numVal(v: unknown, fallback: number): number {
  const n = Number(v);
  return isNaN(n) ? fallback : n;
}

function defaultTimingState(): TimingState {
  return {
    cppStartAge: 65,
    spouseCppStartAge: 65,
    oasStartAge: 65,
    spouseOasStartAge: 65,
    retirementAge: 65,
    spouseRetirementAge: 65,
    dbPensionStartAge: 65,
    propertySaleDecisions: [],
  };
}

function defaultTaxState(accounts: AccountCardInfo[]): TaxState {
  return {
    drawdownOrder: accounts.map((a) => a.id),
    rrspMeltdown: { enabled: false, annualAmount: 0, startYear: 2025, endYear: 2030 },
    incomeSplitting: { enabled: false, splitPercent: 50 },
    oasClawbackAvoidance: { enabled: false, incomeThreshold: 90000 },
    bracketFill: { enabled: false, bracketTarget: 'current', annualCap: undefined },
  };
}

function defaultSavingsState(): SavingsState {
  return { contributionOverrides: [] };
}

function defaultSpendingState(): SpendingState {
  return {
    targetRetirementSpending: 0,
    inflationRate: 2.0,
    ageBandReductions: [],
    legacyTarget: 0,
  };
}

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

    const d = scenario.decisions;

    // Timing
    const saleDecs = Array.isArray(d.propertySaleDecisions)
      ? (d.propertySaleDecisions as Record<string, unknown>[]).map((row) => ({
          propertyId: String(row.propertyId ?? ''),
          saleYear: numVal(row.saleYear, 2030),
          sellingCostsPercent: numVal(row.sellingCostsPercent, 0) * 100,
        }))
      : [];

    setTimingState({
      cppStartAge: numVal(d.cppStartAge, 65),
      spouseCppStartAge: numVal(d.spouseCppStartAge, 65),
      oasStartAge: numVal(d.oasStartAge, 65),
      spouseOasStartAge: numVal(d.spouseOasStartAge, 65),
      retirementAge: numVal(d.retirementAge, 65),
      spouseRetirementAge: numVal(d.spouseRetirementAge, 65),
      dbPensionStartAge: numVal(d.dbPensionStartAge, 65),
      propertySaleDecisions: saleDecs,
    });

    // Tax
    const rrsp = (d.rrspMeltdown as Record<string, unknown> | undefined) ?? {};
    const splitting = (d.incomeSplitting as Record<string, unknown> | undefined) ?? {};
    const oasClawback = (d.oasClawbackAvoidance as Record<string, unknown> | undefined) ?? {};
    const bf = (d.bracketFill as Record<string, unknown> | undefined) ?? {};
    const rawOrder = Array.isArray(d.drawdownOrder)
      ? (d.drawdownOrder as string[])
      : accounts.map((a) => a.id);
    const drawdownOrder = [...new Set(rawOrder)];

    setTaxState({
      drawdownOrder,
      rrspMeltdown: {
        enabled: rrsp.enabled === true,
        annualAmount: numVal(rrsp.annualAmount, 0),
        startYear: numVal(rrsp.startYear, 2025),
        endYear: numVal(rrsp.endYear, 2030),
      },
      incomeSplitting: {
        enabled: splitting.enabled === true,
        splitPercent: numVal(splitting.splitPercent, 0.5) * 100,
      },
      oasClawbackAvoidance: {
        enabled: oasClawback.enabled === true,
        incomeThreshold: numVal(oasClawback.incomeThreshold, 90000),
      },
      bracketFill: {
        enabled: bf.enabled === true,
        bracketTarget: bf.bracketTarget === 'next' ? 'next' : 'current',
        // Preserve undefined when the stored decision omits annualCap (means "unlimited").
        annualCap: typeof bf.annualCap === 'number' && bf.annualCap > 0 ? bf.annualCap : undefined,
      },
    });

    // Savings
    const contribOverrides = Array.isArray(d.contributionOverrides)
      ? (d.contributionOverrides as Record<string, unknown>[]).map((row) => ({
          accountId: String(row.accountId ?? ''),
          annualAmount: numVal(row.annualAmount, 0),
          startYear: numVal(row.startYear, 2025),
          endYear: numVal(row.endYear, 2030),
        }))
      : [];
    setSavingsState({ contributionOverrides: contribOverrides });

    // Spending
    const ageBandReds = Array.isArray(d.ageBandReductions)
      ? (d.ageBandReductions as Record<string, unknown>[]).map((row) => ({
          fromAge: numVal(row.fromAge, 75),
          reductionPercent: numVal(row.reductionPercent, 0) * 100,
        }))
      : [];
    setSpendingState({
      targetRetirementSpending: numVal(d.targetRetirementSpending, 0),
      inflationRate: numVal(d.inflationRate, 0.02) * 100,
      ageBandReductions: ageBandReds,
      legacyTarget: numVal(d.legacyTarget, 0),
    });
  }, [scenario, profile]);

  // ── Save handlers

  const handleSaveTiming = async () => {
    setSavingTiming(true);
    setTimingSaveError(false);
    try {
      await updateDecisions(id, {
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
      });
      setTimingDirty(false);
      toast({ title: 'Saved' });
    } catch {
      setTimingSaveError(true);
    } finally {
      setSavingTiming(false);
    }
  };

  const handleSaveTax = async () => {
    setSavingTax(true);
    setTaxSaveError(false);
    try {
      await updateDecisions(id, {
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
      });
      setTaxDirty(false);
      toast({ title: 'Saved' });
    } catch {
      setTaxSaveError(true);
    } finally {
      setSavingTax(false);
    }
  };

  const handleSaveSavings = async () => {
    setSavingSavings(true);
    setSavingsSaveError(false);
    try {
      await updateDecisions(id, {
        contributionOverrides: savingsState.contributionOverrides,
      });
      setSavingsDirty(false);
      toast({ title: 'Saved' });
    } catch {
      setSavingsSaveError(true);
    } finally {
      setSavingSavings(false);
    }
  };

  const handleSaveSpending = async () => {
    setSavingSpending(true);
    setSpendingSaveError(false);
    try {
      await updateDecisions(id, {
        targetRetirementSpending: spendingState.targetRetirementSpending,
        inflationRate: spendingState.inflationRate / 100,
        ageBandReductions: spendingState.ageBandReductions.map((row) => ({
          fromAge: row.fromAge,
          reductionPercent: row.reductionPercent / 100,
        })),
        legacyTarget: spendingState.legacyTarget,
      });
      setSpendingDirty(false);
      toast({ title: 'Saved' });
    } catch {
      setSpendingSaveError(true);
    } finally {
      setSavingSpending(false);
    }
  };

  // ── Drawdown reorder helpers
  const moveDrawdownUp = (index: number) => {
    setTaxState((prev) => {
      const order = [...prev.drawdownOrder];
      if (index === 0) return prev;
      [order[index - 1], order[index]] = [order[index], order[index - 1]];
      return { ...prev, drawdownOrder: order };
    });
    setTaxDirty(true);
  };

  const moveDrawdownDown = (index: number) => {
    setTaxState((prev) => {
      const order = [...prev.drawdownOrder];
      if (index === order.length - 1) return prev;
      [order[index], order[index + 1]] = [order[index + 1], order[index]];
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

  const cppAdj = cppAdjustment(timingState.cppStartAge);
  const spouseCppAdj = cppAdjustment(timingState.spouseCppStartAge);
  const oasAdj = oasAdjustment(timingState.oasStartAge);
  const spouseOasAdj = oasAdjustment(timingState.spouseOasStartAge);

  const adjustmentClass = (pct: number) => {
    if (pct < 0) return 'text-xs font-semibold text-destructive';
    if (pct > 0) return 'text-xs font-semibold text-success';
    return 'text-xs text-muted-foreground';
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
            <CardContent className="p-6 pt-0 space-y-6">
              {/* CPP Start Age */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FieldLabelHelp
                    htmlFor="cppStartAge"
                    className="text-sm font-semibold"
                    helpId="cppStartAge-help"
                    help="The age CPP begins in this scenario. If unsure, use 65 and compare ages 60 to 70."
                  >
                    CPP Start Age
                  </FieldLabelHelp>
                  <DefaultBadge
                    value={typeof defaultCppAge === 'number' ? defaultCppAge : undefined}
                  />
                </div>
                <Input
                  id="cppStartAge"
                  type="number"
                  min={60}
                  max={70}
                  step={1}
                  value={timingState.cppStartAge}
                  aria-describedby="cppStartAge-help"
                  onChange={(e) => {
                    setTimingState((prev) => ({
                      ...prev,
                      cppStartAge: numVal(e.target.value, 65),
                    }));
                    setTimingDirty(true);
                  }}
                />
                <p className={adjustmentClass(cppAdj.pct)} aria-live="polite">
                  {cppAdj.label}
                </p>
              </div>

              {hasSpouse && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <FieldLabelHelp
                      htmlFor="spouseCppStartAge"
                      className="text-sm font-semibold"
                      helpId="spouseCppStartAge-help"
                      help="The age your spouse or partner starts CPP. If unsure, use 65 and compare ages 60 to 70."
                    >
                      Spouse CPP Start Age
                    </FieldLabelHelp>
                    <DefaultBadge
                      value={typeof defaultCppAge === 'number' ? defaultCppAge : undefined}
                    />
                  </div>
                  <Input
                    id="spouseCppStartAge"
                    type="number"
                    min={60}
                    max={70}
                    step={1}
                    value={timingState.spouseCppStartAge}
                    aria-describedby="spouseCppStartAge-help"
                    onChange={(e) => {
                      setTimingState((prev) => ({
                        ...prev,
                        spouseCppStartAge: numVal(e.target.value, 65),
                      }));
                      setTimingDirty(true);
                    }}
                  />
                  <p className={adjustmentClass(spouseCppAdj.pct)} aria-live="polite">
                    {spouseCppAdj.label}
                  </p>
                </div>
              )}

              <Separator />

              {/* OAS Start Age */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FieldLabelHelp
                    htmlFor="oasStartAge"
                    className="text-sm font-semibold"
                    helpId="oasStartAge-help"
                    help="The age OAS begins in this scenario. If unsure, use 65 and compare delaying up to age 70."
                  >
                    OAS Start Age
                  </FieldLabelHelp>
                  <DefaultBadge
                    value={typeof defaultOasAge === 'number' ? defaultOasAge : undefined}
                  />
                </div>
                <Input
                  id="oasStartAge"
                  type="number"
                  min={65}
                  max={70}
                  step={1}
                  value={timingState.oasStartAge}
                  aria-describedby="oasStartAge-help"
                  onChange={(e) => {
                    setTimingState((prev) => ({
                      ...prev,
                      oasStartAge: numVal(e.target.value, 65),
                    }));
                    setTimingDirty(true);
                  }}
                />
                <p className={adjustmentClass(oasAdj.pct)} aria-live="polite">
                  {oasAdj.label}
                </p>
              </div>

              {hasSpouse && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <FieldLabelHelp
                      htmlFor="spouseOasStartAge"
                      className="text-sm font-semibold"
                      helpId="spouseOasStartAge-help"
                      help="The age your spouse or partner starts OAS. If unsure, use 65 and compare delaying up to age 70."
                    >
                      Spouse OAS Start Age
                    </FieldLabelHelp>
                    <DefaultBadge
                      value={typeof defaultOasAge === 'number' ? defaultOasAge : undefined}
                    />
                  </div>
                  <Input
                    id="spouseOasStartAge"
                    type="number"
                    min={65}
                    max={70}
                    step={1}
                    value={timingState.spouseOasStartAge}
                    aria-describedby="spouseOasStartAge-help"
                    onChange={(e) => {
                      setTimingState((prev) => ({
                        ...prev,
                        spouseOasStartAge: numVal(e.target.value, 65),
                      }));
                      setTimingDirty(true);
                    }}
                  />
                  <p className={adjustmentClass(spouseOasAdj.pct)} aria-live="polite">
                    {spouseOasAdj.label}
                  </p>
                </div>
              )}

              <Separator />

              {/* Retirement Age Override */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FieldLabelHelp
                    htmlFor="retirementAge"
                    className="text-sm font-semibold"
                    helpId="scenario-retirementAge-help"
                    help="Overrides the profile retirement age for this scenario. If unsure, keep the default and test earlier or later ages."
                  >
                    Retirement Age Override
                  </FieldLabelHelp>
                  <DefaultBadge
                    value={
                      typeof defaultRetirementAge === 'number' ? defaultRetirementAge : undefined
                    }
                  />
                </div>
                <Input
                  id="retirementAge"
                  type="number"
                  min={50}
                  max={75}
                  step={1}
                  value={timingState.retirementAge}
                  aria-describedby="scenario-retirementAge-help"
                  onChange={(e) => {
                    setTimingState((prev) => ({
                      ...prev,
                      retirementAge: numVal(e.target.value, 65),
                    }));
                    setTimingDirty(true);
                  }}
                />
              </div>

              {hasSpouse && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <FieldLabelHelp
                      htmlFor="spouseRetirementAge"
                      className="text-sm font-semibold"
                      helpId="scenario-spouseRetirementAge-help"
                      help="Overrides your spouse or partner's retirement age for this scenario. If unsure, keep the default."
                    >
                      Spouse Retirement Age Override
                    </FieldLabelHelp>
                    <DefaultBadge
                      value={
                        typeof defaultSpouseRetirementAge === 'number'
                          ? defaultSpouseRetirementAge
                          : undefined
                      }
                    />
                  </div>
                  <Input
                    id="spouseRetirementAge"
                    type="number"
                    min={50}
                    max={75}
                    step={1}
                    value={timingState.spouseRetirementAge}
                    aria-describedby="scenario-spouseRetirementAge-help"
                    onChange={(e) => {
                      setTimingState((prev) => ({
                        ...prev,
                        spouseRetirementAge: numVal(e.target.value, 65),
                      }));
                      setTimingDirty(true);
                    }}
                  />
                </div>
              )}

              {/* DB Pension Start Age */}
              {hasDbPensions && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <FieldLabelHelp
                        htmlFor="dbPensionStartAge"
                        className="text-sm font-semibold"
                        helpId="dbPensionStartAge-help"
                        help="The age modeled DB pension payments begin. If unsure, use the normal start age from your pension statement."
                      >
                        DB pension start age (applies to all DB pensions)
                      </FieldLabelHelp>
                      <DefaultBadge value={65} />
                    </div>
                    <Input
                      id="dbPensionStartAge"
                      type="number"
                      min={55}
                      max={75}
                      step={1}
                      value={timingState.dbPensionStartAge}
                      aria-describedby="dbPensionStartAge-help"
                      onChange={(e) => {
                        setTimingState((prev) => ({
                          ...prev,
                          dbPensionStartAge: numVal(e.target.value, 65),
                        }));
                        setTimingDirty(true);
                      }}
                    />
                  </div>
                </>
              )}

              {/* Property Sale Decisions */}
              {propertyCards.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-ds-on-surface">
                        Property Sale Decisions
                      </span>
                    </div>
                    <div className="space-y-2">
                      {timingState.propertySaleDecisions.map((row, i) => (
                        <div key={i} className="flex items-center gap-2 min-h-[44px] flex-wrap">
                          <Select
                            value={row.propertyId}
                            onValueChange={(val) => {
                              setTimingState((prev) => {
                                const rows = [...prev.propertySaleDecisions];
                                rows[i] = { ...rows[i], propertyId: val };
                                return { ...prev, propertySaleDecisions: rows };
                              });
                              setTimingDirty(true);
                            }}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Select property" />
                            </SelectTrigger>
                            <SelectContent>
                              {propertyCards.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex items-center gap-1">
                            <Label className="text-xs text-muted-foreground">Sale Year</Label>
                            <Input
                              type="number"
                              className="w-24"
                              value={row.saleYear}
                              onChange={(e) => {
                                setTimingState((prev) => {
                                  const rows = [...prev.propertySaleDecisions];
                                  rows[i] = {
                                    ...rows[i],
                                    saleYear: numVal(e.target.value, 2030),
                                  };
                                  return { ...prev, propertySaleDecisions: rows };
                                });
                                setTimingDirty(true);
                              }}
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <Label className="text-xs text-muted-foreground">Selling Costs %</Label>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step={0.1}
                              className="w-24"
                              value={row.sellingCostsPercent}
                              onChange={(e) => {
                                setTimingState((prev) => {
                                  const rows = [...prev.propertySaleDecisions];
                                  rows[i] = {
                                    ...rows[i],
                                    sellingCostsPercent: numVal(e.target.value, 0),
                                  };
                                  return { ...prev, propertySaleDecisions: rows };
                                });
                                setTimingDirty(true);
                              }}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Remove"
                            onClick={() => {
                              setTimingState((prev) => ({
                                ...prev,
                                propertySaleDecisions: prev.propertySaleDecisions.filter(
                                  (_, idx) => idx !== i
                                ),
                              }));
                              setTimingDirty(true);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTimingState((prev) => ({
                          ...prev,
                          propertySaleDecisions: [
                            ...prev.propertySaleDecisions,
                            {
                              propertyId: propertyCards[0]?.id ?? '',
                              saleYear: 2030,
                              sellingCostsPercent: 5,
                            },
                          ],
                        }));
                        setTimingDirty(true);
                      }}
                    >
                      + Add Property Sale
                    </Button>
                  </div>
                </>
              )}

              {/* Save Timing */}
              <div className="pt-2">
                <Button
                  className="bg-ds-primary text-ds-on-primary rounded-button"
                  disabled={savingTiming}
                  onClick={() => void handleSaveTiming()}
                >
                  {savingTiming ? 'Saving...' : 'Save Timing'}
                </Button>
                {timingSaveError && (
                  <p className="text-sm text-destructive mt-2">Failed to save. Please try again.</p>
                )}
              </div>
            </CardContent>
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
                  onMoveUp={moveDrawdownUp}
                  onMoveDown={moveDrawdownDown}
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

              {/* RRSP Meltdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-ds-on-surface">RRSP Meltdown</span>
                  <DefaultBadge value="Off" />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="rrspMeltdownEnabled"
                    checked={taxState.rrspMeltdown.enabled}
                    onCheckedChange={(checked) => {
                      setTaxState((prev) => ({
                        ...prev,
                        rrspMeltdown: { ...prev.rrspMeltdown, enabled: checked === true },
                      }));
                      setTaxDirty(true);
                    }}
                  />
                  <Label htmlFor="rrspMeltdownEnabled" className="text-sm">
                    Enable RRSP meltdown
                  </Label>
                </div>
                {taxState.rrspMeltdown.enabled && (
                  <div className="space-y-3 pl-6">
                    <div className="space-y-1">
                      <Label htmlFor="rrspAnnualAmount" className="text-sm font-semibold">
                        Annual withdrawal amount
                      </Label>
                      <Input
                        id="rrspAnnualAmount"
                        type="number"
                        min={0}
                        value={taxState.rrspMeltdown.annualAmount}
                        onChange={(e) => {
                          setTaxState((prev) => ({
                            ...prev,
                            rrspMeltdown: {
                              ...prev.rrspMeltdown,
                              annualAmount: numVal(e.target.value, 0),
                            },
                          }));
                          setTaxDirty(true);
                        }}
                      />
                    </div>
                    <div className="flex gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="rrspStartYear" className="text-sm font-semibold">
                          Start year
                        </Label>
                        <Input
                          id="rrspStartYear"
                          type="number"
                          className="w-28"
                          value={taxState.rrspMeltdown.startYear}
                          onChange={(e) => {
                            setTaxState((prev) => ({
                              ...prev,
                              rrspMeltdown: {
                                ...prev.rrspMeltdown,
                                startYear: numVal(e.target.value, 2025),
                              },
                            }));
                            setTaxDirty(true);
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="rrspEndYear" className="text-sm font-semibold">
                          End year
                        </Label>
                        <Input
                          id="rrspEndYear"
                          type="number"
                          className="w-28"
                          value={taxState.rrspMeltdown.endYear}
                          onChange={(e) => {
                            setTaxState((prev) => ({
                              ...prev,
                              rrspMeltdown: {
                                ...prev.rrspMeltdown,
                                endYear: numVal(e.target.value, 2030),
                              },
                            }));
                            setTaxDirty(true);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Income Splitting — hidden when no spouse */}
              {hasSpouse && (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-ds-on-surface">
                        Income Splitting
                      </span>
                      <DefaultBadge value="Off" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="incomeSplittingEnabled"
                        checked={taxState.incomeSplitting.enabled}
                        onCheckedChange={(checked) => {
                          setTaxState((prev) => ({
                            ...prev,
                            incomeSplitting: {
                              ...prev.incomeSplitting,
                              enabled: checked === true,
                            },
                          }));
                          setTaxDirty(true);
                        }}
                      />
                      <Label htmlFor="incomeSplittingEnabled" className="text-sm">
                        Enable income splitting
                      </Label>
                    </div>
                    {taxState.incomeSplitting.enabled && (
                      <div className="space-y-1 pl-6">
                        <Label htmlFor="splitPercent" className="text-sm font-semibold">
                          Split percentage (0–50%)
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="splitPercent"
                            type="number"
                            min={0}
                            max={50}
                            step={1}
                            className="w-24"
                            value={taxState.incomeSplitting.splitPercent}
                            onChange={(e) => {
                              setTaxState((prev) => ({
                                ...prev,
                                incomeSplitting: {
                                  ...prev.incomeSplitting,
                                  splitPercent: numVal(e.target.value, 50),
                                },
                              }));
                              setTaxDirty(true);
                            }}
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <Separator />
                </>
              )}

              {/* OAS Clawback Avoidance */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-ds-on-surface">
                    OAS Clawback Avoidance
                  </span>
                  <DefaultBadge value="Off" />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="oasClawbackEnabled"
                    checked={taxState.oasClawbackAvoidance.enabled}
                    onCheckedChange={(checked) => {
                      setTaxState((prev) => ({
                        ...prev,
                        oasClawbackAvoidance: {
                          ...prev.oasClawbackAvoidance,
                          enabled: checked === true,
                        },
                      }));
                      setTaxDirty(true);
                    }}
                  />
                  <Label htmlFor="oasClawbackEnabled" className="text-sm">
                    Enable OAS clawback avoidance
                  </Label>
                </div>
                {taxState.oasClawbackAvoidance.enabled && (
                  <div className="space-y-1 pl-6">
                    <Label htmlFor="oasNetIncomeThreshold" className="text-sm font-semibold">
                      Target net income threshold
                    </Label>
                    <Input
                      id="oasNetIncomeThreshold"
                      type="number"
                      min={0}
                      value={taxState.oasClawbackAvoidance.incomeThreshold}
                      onChange={(e) => {
                        setTaxState((prev) => ({
                          ...prev,
                          oasClawbackAvoidance: {
                            ...prev.oasClawbackAvoidance,
                            incomeThreshold: numVal(e.target.value, 90000),
                          },
                        }));
                        setTaxDirty(true);
                      }}
                    />
                  </div>
                )}
              </div>

              <Separator />

              {/* Bracket Fill (Tax Bracket Smoothing) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-ds-on-surface">
                    Tax Bracket Smoothing
                  </span>
                  <DefaultBadge value="Off" />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="bracketFillEnabled"
                    checked={taxState.bracketFill.enabled}
                    onCheckedChange={(checked) => {
                      setTaxState((prev) => ({
                        ...prev,
                        bracketFill: { ...prev.bracketFill, enabled: checked === true },
                      }));
                      setTaxDirty(true);
                    }}
                  />
                  <Label htmlFor="bracketFillEnabled" className="text-sm">
                    Proactively fill low tax brackets from RRSP
                  </Label>
                </div>
                {taxState.bracketFill.enabled && (
                  <div className="space-y-3 pl-6">
                    <div className="space-y-1">
                      <Label htmlFor="bracketFillTarget" className="text-sm font-semibold">
                        Target federal bracket
                      </Label>
                      <select
                        id="bracketFillTarget"
                        className="flex h-9 w-full rounded-md border border-ds-outline bg-ds-surface px-3 py-1 text-sm shadow-sm"
                        value={taxState.bracketFill.bracketTarget}
                        onChange={(e) => {
                          setTaxState((prev) => ({
                            ...prev,
                            bracketFill: {
                              ...prev.bracketFill,
                              bracketTarget: e.target.value as 'current' | 'next',
                            },
                          }));
                          setTaxDirty(true);
                        }}
                      >
                        <option value="current">Current bracket (fill to ceiling)</option>
                        <option value="next">Next bracket (fill one above)</option>
                      </select>
                      <p className="text-xs text-muted-foreground">
                        Withdraws from RRSP to fill unused space in the target federal tax bracket
                        during retirement years (before age 71).
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="bracketFillCap" className="text-sm font-semibold">
                        Annual cap ($)
                      </Label>
                      <Input
                        id="bracketFillCap"
                        type="number"
                        min={0}
                        placeholder="Leave empty = unlimited"
                        value={taxState.bracketFill.annualCap ?? ''}
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          const parsed = raw === '' ? undefined : Number(raw);
                          // Treat empty, NaN, and non-positive values as "no cap" (undefined) —
                          // the engine interprets a literal 0 as "withdraw nothing", which is the
                          // opposite of the user's intent.
                          const next =
                            parsed === undefined || Number.isNaN(parsed) || parsed <= 0
                              ? undefined
                              : parsed;
                          setTaxState((prev) => ({
                            ...prev,
                            bracketFill: {
                              ...prev.bracketFill,
                              annualCap: next,
                            },
                          }));
                          setTaxDirty(true);
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        Maximum annual RRSP withdrawal for bracket smoothing. Leave empty for
                        unlimited (engine fills to bracket ceiling).
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground italic">
                      Includes OAS clawback protection — the engine will not fill a bracket if the
                      15% OAS recovery tax exceeds the marginal tax savings.
                    </p>
                  </div>
                )}
              </div>

              {/* Save Tax Strategy */}
              <div className="pt-2">
                <Button
                  className="bg-ds-primary text-ds-on-primary rounded-button"
                  disabled={savingTax}
                  onClick={() => void handleSaveTax()}
                >
                  {savingTax ? 'Saving...' : 'Save Tax Strategy'}
                </Button>
                {taxSaveError && (
                  <p className="text-sm text-destructive mt-2">Failed to save. Please try again.</p>
                )}
              </div>
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
            <CardContent className="p-6 pt-0 space-y-6">
              {/* Contribution Overrides */}
              <div className="space-y-3">
                <span className="text-sm font-semibold text-ds-on-surface">
                  Contribution Overrides
                </span>
                <div className="space-y-2">
                  {savingsState.contributionOverrides.map((row, i) => (
                    <div key={i} className="flex items-center gap-2 min-h-[44px] flex-wrap">
                      <Select
                        value={row.accountId}
                        onValueChange={(val) => {
                          setSavingsState((prev) => {
                            const rows = [...prev.contributionOverrides];
                            rows[i] = { ...rows[i], accountId: val };
                            return { ...prev, contributionOverrides: rows };
                          });
                          setSavingsDirty(true);
                        }}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accountCards.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.label} ({a.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-muted-foreground">Annual Amount $</Label>
                        <Input
                          type="number"
                          min={0}
                          className="w-28"
                          value={row.annualAmount}
                          onChange={(e) => {
                            setSavingsState((prev) => {
                              const rows = [...prev.contributionOverrides];
                              rows[i] = {
                                ...rows[i],
                                annualAmount: numVal(e.target.value, 0),
                              };
                              return { ...prev, contributionOverrides: rows };
                            });
                            setSavingsDirty(true);
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-muted-foreground">Start</Label>
                        <Input
                          type="number"
                          className="w-24"
                          value={row.startYear}
                          onChange={(e) => {
                            setSavingsState((prev) => {
                              const rows = [...prev.contributionOverrides];
                              rows[i] = {
                                ...rows[i],
                                startYear: numVal(e.target.value, 2025),
                              };
                              return { ...prev, contributionOverrides: rows };
                            });
                            setSavingsDirty(true);
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-muted-foreground">End</Label>
                        <Input
                          type="number"
                          className="w-24"
                          value={row.endYear}
                          onChange={(e) => {
                            setSavingsState((prev) => {
                              const rows = [...prev.contributionOverrides];
                              rows[i] = {
                                ...rows[i],
                                endYear: numVal(e.target.value, 2030),
                              };
                              return { ...prev, contributionOverrides: rows };
                            });
                            setSavingsDirty(true);
                          }}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove"
                        onClick={() => {
                          setSavingsState((prev) => ({
                            ...prev,
                            contributionOverrides: prev.contributionOverrides.filter(
                              (_, idx) => idx !== i
                            ),
                          }));
                          setSavingsDirty(true);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSavingsState((prev) => ({
                      ...prev,
                      contributionOverrides: [
                        ...prev.contributionOverrides,
                        {
                          accountId: accountCards[0]?.id ?? '',
                          annualAmount: 0,
                          startYear: 2025,
                          endYear: 2030,
                        },
                      ],
                    }));
                    setSavingsDirty(true);
                  }}
                >
                  + Add Contribution Override
                </Button>
              </div>

              {/* M005/P4: RRSP over-contribution warning */}
              {roomViolations.length > 0 && (
                <div className="rounded-card border border-amber-500/40 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm">
                  <p className="font-semibold text-amber-800 dark:text-amber-200">
                    RRSP contribution overrides exceed available room
                  </p>
                  <ul className="mt-2 space-y-1 text-amber-900 dark:text-amber-100">
                    {roomViolations.slice(0, 6).map((v, i) => (
                      <li key={`${v.accountId}-${v.year}-${i}`}>
                        {accountMap.get(v.accountId) ?? 'Account'} · {v.year}: requested{' '}
                        {formatCurrency(v.requested)} vs. room {formatCurrency(v.available)}{' '}
                        <span className="font-medium">(over by {formatCurrency(v.overage)})</span>
                      </li>
                    ))}
                    {roomViolations.length > 6 && (
                      <li>…and {roomViolations.length - 6} more year(s).</li>
                    )}
                  </ul>
                  <p className="mt-2 text-xs text-amber-800/80 dark:text-amber-200/80">
                    Room is 18% of prior-year earned income plus carry-forward, capped at the annual
                    statutory maximum — see <code>docs/source-of-truth/02-account-types.md</code> ·
                    RRSP Contribution Room. Save and re-run the projection to refresh these numbers.
                  </p>
                </div>
              )}

              {/* Save Savings */}
              <div className="pt-2">
                <Button
                  className="bg-ds-primary text-ds-on-primary rounded-button"
                  disabled={savingSavings}
                  onClick={() => void handleSaveSavings()}
                >
                  {savingSavings ? 'Saving...' : 'Save Savings'}
                </Button>
                {savingsSaveError && (
                  <p className="text-sm text-destructive mt-2">Failed to save. Please try again.</p>
                )}
              </div>
            </CardContent>
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
            <CardContent className="p-6 pt-0 space-y-6">
              {/* Target Retirement Spending */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="targetRetirementSpending" className="text-sm font-semibold">
                    Annual retirement spending (after-tax, today&apos;s dollars)
                  </Label>
                  <DefaultBadge
                    value={typeof defaultExpenses === 'number' ? defaultExpenses : undefined}
                  />
                </div>
                <Input
                  id="targetRetirementSpending"
                  type="number"
                  min={0}
                  value={spendingState.targetRetirementSpending}
                  onChange={(e) => {
                    setSpendingState((prev) => ({
                      ...prev,
                      targetRetirementSpending: numVal(e.target.value, 0),
                    }));
                    setSpendingDirty(true);
                  }}
                />
              </div>

              <Separator />

              {/* Inflation Rate Override */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FieldLabelHelp
                    htmlFor="inflationRate"
                    className="text-sm font-semibold"
                    helpId="inflationRate-help"
                    help="Used to estimate how prices rise over time. If unsure, keep the default and test higher-inflation scenarios."
                  >
                    Inflation rate override
                  </FieldLabelHelp>
                  <DefaultBadge value={undefined} />
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id="inflationRate"
                    type="number"
                    min={0}
                    max={20}
                    step={0.1}
                    className="w-28"
                    value={spendingState.inflationRate}
                    aria-describedby="inflationRate-help"
                    onChange={(e) => {
                      setSpendingState((prev) => ({
                        ...prev,
                        inflationRate: numVal(e.target.value, 2.0),
                      }));
                      setSpendingDirty(true);
                    }}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>

              <Separator />

              {/* Age-Band Spending Reductions */}
              <div className="space-y-3">
                <span className="text-sm font-semibold text-ds-on-surface">
                  Age-based spending reductions
                </span>
                <div className="space-y-2">
                  {spendingState.ageBandReductions.map((row, i) => (
                    <div key={i} className="flex items-center gap-2 min-h-[44px] flex-wrap">
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-muted-foreground">Age threshold</Label>
                        <Input
                          type="number"
                          min={60}
                          max={100}
                          step={1}
                          className="w-24"
                          value={row.fromAge}
                          onChange={(e) => {
                            setSpendingState((prev) => {
                              const rows = [...prev.ageBandReductions];
                              rows[i] = {
                                ...rows[i],
                                fromAge: numVal(e.target.value, 75),
                              };
                              return { ...prev, ageBandReductions: rows };
                            });
                            setSpendingDirty(true);
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-muted-foreground">Reduction</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          className="w-24"
                          value={row.reductionPercent}
                          onChange={(e) => {
                            setSpendingState((prev) => {
                              const rows = [...prev.ageBandReductions];
                              rows[i] = {
                                ...rows[i],
                                reductionPercent: numVal(e.target.value, 0),
                              };
                              return { ...prev, ageBandReductions: rows };
                            });
                            setSpendingDirty(true);
                          }}
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove"
                        onClick={() => {
                          setSpendingState((prev) => ({
                            ...prev,
                            ageBandReductions: prev.ageBandReductions.filter((_, idx) => idx !== i),
                          }));
                          setSpendingDirty(true);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSpendingState((prev) => ({
                      ...prev,
                      ageBandReductions: [
                        ...prev.ageBandReductions,
                        { fromAge: 75, reductionPercent: 20 },
                      ],
                    }));
                    setSpendingDirty(true);
                  }}
                >
                  + Add Reduction
                </Button>
              </div>

              <Separator />

              {/* Legacy Target */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="legacyTarget" className="text-sm font-semibold">
                    Legacy target (estate value)
                  </Label>
                  <DefaultBadge value={undefined} />
                </div>
                <Input
                  id="legacyTarget"
                  type="number"
                  min={0}
                  value={spendingState.legacyTarget}
                  onChange={(e) => {
                    setSpendingState((prev) => ({
                      ...prev,
                      legacyTarget: numVal(e.target.value, 0),
                    }));
                    setSpendingDirty(true);
                  }}
                />
              </div>

              {/* Save Spending */}
              <div className="pt-2">
                <Button
                  className="bg-ds-primary text-ds-on-primary rounded-button"
                  disabled={savingSpending}
                  onClick={() => void handleSaveSpending()}
                >
                  {savingSpending ? 'Saving...' : 'Save Spending'}
                </Button>
                {spendingSaveError && (
                  <p className="text-sm text-destructive mt-2">Failed to save. Please try again.</p>
                )}
              </div>
            </CardContent>
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
