/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Play, AlertCircle, Download, FileText } from 'lucide-react';
import { SummaryTab } from '@/components/projection/results/SummaryTab';
import { ChartsTab } from '@/components/projection/results/ChartsTab';
import { YearByYearTab } from '@/components/projection/results/YearByYearTab';
import { MonteCarloPanel } from '@/components/projection/results/MonteCarloPanel';
import { BacktestPanel } from '@/components/projection/results/BacktestPanel';
import { OptimizationsTab } from '@/components/projection/results/OptimizationsTab';
import { EstateTab } from '@/components/projection/results/EstateTab';
import { InflationToggle } from '@/components/projection/results/InflationToggle';
import { GlossaryLink } from '@/components/glossary/GlossaryLink';
import { useToast } from '@/components/ui/use-toast';
import { getProfileScenario, runProfileScenario } from '@/lib/api/profile-scenarios';
import { useProjectionDisplayMode } from '@/hooks/useProjectionDisplayMode';
import { applyDisplayMode } from '@/lib/projection/display-mode';
import type { ProfileScenarioDetail } from '@/types/profile-scenario';
import type { MonteCarloJobResult, ProjectionYearRow } from '@retireops/shared/types';
import { readMonteCarloResult, writeMonteCarloResult } from '@/lib/monte-carlo-cache';

const DEFAULT_INFLATION_RATE = 0.025;

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function csvCell(value: unknown): string {
  if (value === undefined || value === null) return '';
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Mirrors YearByYearTab's column structure exactly so the CSV stays in sync
// with what the user sees on screen. Spouse columns appear only when any row
// carries spouseAge (couple projection); sparse columns (GIS/LIF/LIRA/pension
// split/bracket fill) appear only when at least one row reports a non-zero value.
function buildScenarioCsv(
  rows: ProjectionYearRow[],
  scenarioName: string
): { filename: string; csv: string } {
  const isCouple = rows.some((r) => r.spouseAge !== undefined);
  const hasGis = rows.some((r) => (r.gisIncome ?? 0) > 0);
  const hasLif = rows.some((r) => (r.lifWithdrawal ?? 0) > 0);
  const hasLiraBalance = rows.some((r) => (r.liraBalance ?? 0) > 0);
  const hasLifBalance = rows.some((r) => (r.lifBalance ?? 0) > 0);
  const hasPensionSplit = isCouple && rows.some((r) => (r.pensionSplitPercentage ?? 0) > 0);
  const hasBracketFill = rows.some(
    (r) => (r.bracketFillWithdrawal ?? 0) > 0 || (r.spouseBracketFillWithdrawal ?? 0) > 0
  );

  const headers: string[] = ['Year', 'Age'];
  if (isCouple) headers.push('Sp. Age');

  // Income — primary
  headers.push('Employment', 'Pension', 'CPP', 'OAS');
  if (hasGis) headers.push('GIS');
  if (hasLif) headers.push('LIF Withdrawal');
  headers.push('RRIF Withdrawal', 'TFSA Withdrawal', 'Non-Reg Withdrawal', 'Total Income');

  // Income — spouse
  if (isCouple) {
    headers.push(
      'Sp. Employment',
      'Sp. Pension',
      'Sp. CPP',
      'Sp. OAS',
      'Sp. RRIF Wdl',
      'Sp. TFSA Wdl',
      'Sp. NR Wdl'
    );
  }
  if (hasPensionSplit) {
    headers.push('Pension Received', 'Pension Transferred', 'Split %', 'Split Tax Savings');
  }
  if (hasBracketFill) {
    headers.push('Bracket-Fill Wdl');
    if (isCouple) headers.push('Sp. Bracket-Fill Wdl');
  }

  // Taxes — primary
  headers.push('Federal Tax', 'Provincial Tax', 'OAS Clawback', 'Total Tax', 'Effective Rate');
  if (isCouple) {
    headers.push('Sp. Fed Tax', 'Sp. Prov Tax', 'Sp. Total Tax', 'Sp. Effective Rate');
  }

  // Spending
  headers.push('Living Expenses', 'Net Cash Flow');
  if (isCouple) headers.push('HH Net Cash Flow');

  // Balances — primary
  headers.push('RRSP', 'RRIF');
  if (hasLiraBalance) headers.push('LIRA');
  if (hasLifBalance) headers.push('LIF');
  headers.push('TFSA', 'Non-Registered', 'Net Worth');

  // Balances — spouse
  if (isCouple) {
    headers.push('Sp. RRSP', 'Sp. RRIF', 'Sp. TFSA', 'Sp. NR');
  }
  headers.push('HH Net Worth');

  const dataRows = rows.map((r) => {
    const cells: unknown[] = [r.year, r.age];
    if (isCouple) cells.push(r.spouseAge ?? '');

    cells.push(r.employmentIncome, r.pensionIncome, r.cppIncome, r.oasIncome);
    if (hasGis) cells.push(r.gisIncome ?? 0);
    if (hasLif) cells.push(r.lifWithdrawal ?? 0);
    cells.push(r.rrifWithdrawal, r.tfsaWithdrawal, r.nonRegWithdrawal, r.totalGrossIncome);

    if (isCouple) {
      cells.push(
        r.spouseEmploymentIncome ?? 0,
        r.spousePensionIncome ?? 0,
        r.spouseCppIncome ?? 0,
        r.spouseOasIncome ?? 0,
        r.spouseRrifWithdrawal ?? 0,
        r.spouseTfsaWithdrawal ?? 0,
        r.spouseNonRegWithdrawal ?? 0
      );
    }
    if (hasPensionSplit) {
      cells.push(
        r.pensionIncomeReceived ?? 0,
        r.pensionIncomeTransferred ?? 0,
        r.pensionSplitPercentage ?? 0,
        r.pensionSplitTaxSavings ?? 0
      );
    }
    if (hasBracketFill) {
      cells.push(r.bracketFillWithdrawal ?? 0);
      if (isCouple) cells.push(r.spouseBracketFillWithdrawal ?? 0);
    }

    cells.push(r.federalTax, r.provincialTax, r.oasClawback, r.totalTax, r.effectiveTaxRate);
    if (isCouple) {
      cells.push(
        r.spouseFederalTax ?? 0,
        r.spouseProvincialTax ?? 0,
        r.spouseTotalTax ?? 0,
        r.spouseEffectiveTaxRate ?? 0
      );
    }

    cells.push(r.livingExpenses, r.netCashFlow);
    if (isCouple) cells.push(r.householdNetCashFlow);

    cells.push(r.rrspBalance, r.rrifBalance);
    if (hasLiraBalance) cells.push(r.liraBalance ?? 0);
    if (hasLifBalance) cells.push(r.lifBalance ?? 0);
    cells.push(r.tfsaBalance, r.nonRegBalance, r.totalNetWorth);

    if (isCouple) {
      cells.push(
        r.spouseRrspBalance ?? 0,
        r.spouseRrifBalance ?? 0,
        r.spouseTfsaBalance ?? 0,
        r.spouseNonRegBalance ?? 0
      );
    }
    cells.push(r.householdNetWorth);

    return cells.map(csvCell).join(',');
  });

  const csv = [headers.map(csvCell).join(','), ...dataRows].join('\n');
  const safeName = (scenarioName || 'scenario').replace(/\s+/g, '-');
  return { filename: `${safeName}-scenario.csv`, csv };
}

const VALID_TABS = new Set([
  'summary',
  'charts',
  'year-by-year',
  'optimizations',
  'estate',
  'monte-carlo',
  'backtesting',
]);

export default function ScenarioResultsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const id = String(params['id'] ?? '');
  const [scenario, setScenario] = useState<ProfileScenarioDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const { displayMode, setDisplayMode } = useProjectionDisplayMode();
  // Lifted MC result so SummaryTab can render a compact probabilistic summary
  // when the user has already run a simulation in this session.
  const [monteCarloResult, setMonteCarloResult] = useState<MonteCarloJobResult | null>(null);

  const tabParam = searchParams.get('tab');
  const activeTab = tabParam !== null && VALID_TABS.has(tabParam) ? tabParam : 'summary';
  const handleTabChange = useCallback(
    (next: string) => {
      const sp = new URLSearchParams(Array.from(searchParams.entries()));
      sp.set('tab', next);
      router.replace(`?${sp.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const fetchScenario = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setError(null);
      const data = await getProfileScenario(id);
      setScenario(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scenario results');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  const handleExport = () => {
    const rd = scenario?.result_data as { projectionRows?: ProjectionYearRow[] } | null | undefined;
    const rows = rd?.projectionRows;
    if (!rows || rows.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nothing to export',
        description: 'Re-run this scenario to generate year-by-year data.',
      });
      return;
    }

    const { filename, csv } = buildScenarioCsv(rows, scenario?.name ?? 'scenario');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: 'Export complete',
      description: 'Your scenario data has been downloaded.',
    });
  };

  const handleRun = async () => {
    setIsRunning(true);
    try {
      const updated = await runProfileScenario(id);
      setScenario(updated);
    } catch {
      toast({ variant: 'destructive', title: 'Projection failed. Please try again.' });
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    void fetchScenario();
  }, [fetchScenario]);

  // Hydrate any cached MC result for this scenario on mount / id change so the
  // Summary tab's probabilistic summary persists across tab switches and refreshes.
  useEffect(() => {
    if (!id) return;
    setMonteCarloResult(readMonteCarloResult('scenario', id));
  }, [id]);

  const handleMonteCarloResultChange = useCallback(
    (next: MonteCarloJobResult | null) => {
      setMonteCarloResult(next);
      if (id) writeMonteCarloResult('scenario', id, next);
    },
    [id]
  );

  const projectionRows: ProjectionYearRow[] =
    (scenario?.result_data as { projectionRows?: ProjectionYearRow[] } | null)?.projectionRows ??
    [];
  const inflationRate: number =
    (scenario?.result_data as { assumptions?: { inflationRate?: number } } | null)?.assumptions
      ?.inflationRate ?? DEFAULT_INFLATION_RATE;
  const displayRows = useMemo<ProjectionYearRow[]>(
    () => applyDisplayMode(projectionRows, displayMode, inflationRate),
    [projectionRows, displayMode, inflationRate]
  );

  if (isLoading) {
    return (
      <div className="bg-ds-surface rounded-card p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-ds-primary" />
      </div>
    );
  }

  if (error ?? !scenario) {
    return (
      <div className="bg-ds-surface rounded-card p-12 flex flex-col items-center justify-center gap-4">
        <AlertCircle className="h-12 w-12 text-ds-error" />
        <p className="text-muted-foreground">{error ?? 'Scenario results not found'}</p>
        <Button
          variant="outline"
          className="border-ds-outline-variant"
          onClick={() => void fetchScenario()}
        >
          Try Again
        </Button>
      </div>
    );
  }

  const hasResults = scenario.status === 'completed' && scenario.result_data !== null;

  return (
    <div className="max-w-full space-y-4 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap sm:gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="hover:bg-ds-surface-raised"
          onClick={() => router.push('/profile/scenarios')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Scenarios
        </Button>
        <div className="min-w-0 flex-1 basis-full sm:basis-auto">
          <h1 className="text-xl font-semibold font-display text-ds-on-background">
            {scenario.name}
          </h1>
          <p className="text-sm text-ds-on-surface-variant">
            {scenario.calculated_at
              ? `Last run: ${formatDate(scenario.calculated_at)}`
              : 'Never run'}
          </p>
        </div>
        {hasResults && (
          <>
            <Link href={`/reports/${id}`} className="ml-auto sm:ml-0">
              <Button
                variant="outline"
                size="sm"
                className="border-ds-outline-variant hover:bg-ds-surface-raised"
              >
                <FileText className="mr-2 h-4 w-4" />
                Open printable report
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              className="border-ds-outline-variant hover:bg-ds-surface-raised"
              onClick={handleExport}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </>
        )}
      </div>

      {/* Content */}
      {hasResults ? (
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
            <TabsList className="w-max bg-ds-surface rounded-card sm:w-auto">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="charts">Charts</TabsTrigger>
              <TabsTrigger value="year-by-year">Year-by-Year</TabsTrigger>
              <TabsTrigger value="optimizations">Optimizations</TabsTrigger>
              <TabsTrigger value="estate">Estate</TabsTrigger>
              <TabsTrigger value="monte-carlo">Monte Carlo</TabsTrigger>
              <TabsTrigger value="backtesting">Historical Backtesting</TabsTrigger>
            </TabsList>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-start gap-2 sm:justify-end">
            <InflationToggle displayMode={displayMode} onChange={setDisplayMode} />
            <GlossaryLink anchor="nominal-vs-real" term="nominal vs real" />
          </div>
          <TabsContent value="summary" className="mt-4">
            <SummaryTab
              data={scenario.result_data as any}
              displayMode={displayMode}
              onSwitchTab={handleTabChange}
              monteCarloSummary={monteCarloResult}
            />
          </TabsContent>
          <TabsContent value="charts" className="mt-4">
            <ChartsTab
              data={{ ...(scenario.result_data as any), projectionRows: displayRows }}
              displayMode={displayMode}
            />
          </TabsContent>
          <TabsContent value="year-by-year" className="mt-4">
            <YearByYearTab
              data={{ ...(scenario.result_data as any), projectionRows: displayRows }}
              nominalRows={projectionRows}
              displayMode={displayMode}
              scenarioId={id}
              initialDecisions={scenario.decisions as any}
              onScenarioUpdated={(updated) => setScenario(updated)}
            />
          </TabsContent>
          <TabsContent value="optimizations" className="mt-4">
            <OptimizationsTab scenarioId={id} />
          </TabsContent>
          <TabsContent value="estate" className="mt-4">
            <EstateTab
              summary={
                ((scenario.result_data as any)?.summary ?? {}) as {
                  grossEstate?: number;
                  terminalTaxes?: number;
                  netEstate?: number;
                }
              }
              terminalTaxEvents={
                (scenario.result_data as any)?.terminalTaxEvents as
                  | import('@retireops/shared/types').TerminalReturnResult[]
                  | undefined
              }
            />
          </TabsContent>
          <TabsContent value="monte-carlo" className="mt-4">
            <MonteCarloPanel
              ownerType="scenario"
              ownerId={id}
              initialResult={monteCarloResult}
              onResultChange={handleMonteCarloResultChange}
            />
          </TabsContent>
          <TabsContent value="backtesting" className="mt-4">
            <BacktestPanel
              scenarioId={id}
              baselineNetWorth={((scenario.result_data as any)?.yearlyResults ?? []).map(
                (r: any) => ({ year: r.year as number, value: r.totalNetWorth as number })
              )}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="bg-ds-surface rounded-card py-12 text-center">
          <p className="text-muted-foreground mb-4">
            No results available. Run this scenario to see results.
          </p>
          <Button
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
      )}
    </div>
  );
}
