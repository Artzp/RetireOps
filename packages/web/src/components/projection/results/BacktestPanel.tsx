'use client';

/**
 * BacktestPanel — v1.14 Phase 61 + 62
 *
 * Displays historical backtesting results for a profile scenario.
 * - Fetches cached results on mount (GET /api/profile/scenarios/:id/backtest)
 * - Offers a "Run" button to compute fresh results
 * - Shows staleness indicator when inputs have changed since last run (TC-BT-011)
 * - Shows 3 preset result cards with funded/depleted badge (TC-BT-010)
 * - Expandable year-by-year table per preset (TC-BT-008)
 */

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { BacktestResult, BacktestRun, BacktestYearRecord } from '@retireops/shared';
import {
  runScenarioBacktest,
  getScenarioBacktest,
  getProjectionBacktest,
} from '@/lib/api/backtest';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { AlertCircle, ChevronDown, ChevronUp, Loader2, Play, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const BacktestChartDynamic = dynamic(
  () => import('./BacktestChart').then((m) => ({ default: m.BacktestChart })),
  { ssr: false, loading: () => <div className="h-80 w-full rounded-card bg-muted animate-pulse" /> }
);

interface BacktestPanelProps {
  scenarioId: string;
  /** Baseline yearly net-worth data from the main projection (for chart overlay) */
  baselineNetWorth?: Array<{ year: number; value: number }>;
}

function formatPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

// ── Year-by-year expandable table ─────────────────────────────────────────────

function YearTable({ records }: { records: BacktestYearRecord[] }) {
  return (
    <div className="overflow-x-auto mt-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-ds-on-surface-variant border-b border-ds-outline-variant">
            <th className="pb-1 pr-3 font-medium">Year</th>
            <th className="pb-1 pr-3 font-medium">Return</th>
            <th className="pb-1 pr-3 font-medium">Balance</th>
            <th className="pb-1 pr-3 font-medium">Withdrawals</th>
            <th className="pb-1 pr-3 font-medium">Taxes</th>
            <th className="pb-1 font-medium">Est.</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr
              key={r.calendarYear}
              className="border-b border-ds-outline-variant/30 hover:bg-ds-surface-raised/30"
            >
              <td className="py-0.5 pr-3 tabular-nums">{r.calendarYear}</td>
              <td
                className={`py-0.5 pr-3 tabular-nums ${r.returnRateApplied < 0 ? 'text-ds-error' : 'text-ds-success'}`}
              >
                {formatPct(r.returnRateApplied)}
              </td>
              <td className="py-0.5 pr-3 tabular-nums">{formatCurrency(r.portfolioBalance)}</td>
              <td className="py-0.5 pr-3 tabular-nums">{formatCurrency(r.totalWithdrawals)}</td>
              <td className="py-0.5 pr-3 tabular-nums">{formatCurrency(r.totalTaxesPaid)}</td>
              <td className="py-0.5 tabular-nums text-ds-on-surface-variant">
                {r.isEstimated ? 'est.' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Single preset result card ─────────────────────────────────────────────────

function PresetCard({ run }: { run: BacktestRun }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="bg-ds-surface border-ds-outline-variant">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-semibold text-ds-on-background leading-tight">
              {run.label}
            </CardTitle>
            <p className="text-xs text-ds-on-surface-variant mt-0.5 leading-snug">
              {run.description}
            </p>
          </div>
          <span
            className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              run.funded
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
            }`}
          >
            {run.funded ? 'Funded' : 'Depleted'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3">
          {run.funded ? (
            <div>
              <span className="text-ds-on-surface-variant">Final balance</span>
              <div className="font-semibold text-ds-on-background">
                {formatCurrency(run.finalBalance)}
              </div>
            </div>
          ) : (
            <div>
              <span className="text-ds-on-surface-variant">Depleted in</span>
              <div className="font-semibold text-ds-error">{run.depletionYear}</div>
            </div>
          )}
          <div>
            <span className="text-ds-on-surface-variant">Start year</span>
            <div className="font-semibold text-ds-on-background">{run.startYear}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1 text-xs text-ds-primary hover:underline focus:outline-none"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Hide year-by-year
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Show year-by-year ({run.yearRecords.length} rows)
            </>
          )}
        </button>
        {expanded && <YearTable records={run.yearRecords} />}
      </CardContent>
    </Card>
  );
}

// ── Shared results view ───────────────────────────────────────────────────────

interface BacktestResultsViewProps {
  result: BacktestResult;
  baselineNetWorth?: Array<{ year: number; value: number }>;
  /** Optional re-run handler; when omitted the footer button is hidden. */
  onRerun?: () => void;
  isRerunning?: boolean;
}

function BacktestResultsView({
  result,
  baselineNetWorth,
  onRerun,
  isRerunning,
}: BacktestResultsViewProps) {
  const chartRuns = result.runs.map((run) => ({
    label: run.label,
    scenarioId: run.scenarioId,
    funded: run.funded,
    points: run.yearRecords.map((r) => ({ year: r.calendarYear, value: r.portfolioBalance })),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide shrink-0">
          Beta
        </Badge>
        <span>
          Historical stress tests are in beta. They show how your plan would have performed across
          three reference Canadian downturns; they are not a forecast of future returns.
        </span>
      </div>
      {/* Chart overlay — TC-BT-009 */}
      <BacktestChartDynamic runs={chartRuns} baselineNetWorth={baselineNetWorth ?? []} />

      {/* Preset result cards — TC-BT-010 */}
      <div className="grid gap-4 sm:grid-cols-3">
        {result.runs.map((run) => (
          <PresetCard key={run.scenarioId} run={run} />
        ))}
      </div>

      {/* Footer: computed timestamp + optional re-run */}
      <div className="flex items-center justify-between text-xs text-ds-on-surface-variant">
        <span>
          Computed{' '}
          {new Date(result.computedAt).toLocaleDateString('en-CA', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
        {onRerun && (
          <Button
            size="sm"
            variant="outline"
            className="border-ds-outline-variant hover:bg-ds-surface-raised"
            onClick={onRerun}
            disabled={isRerunning}
          >
            {isRerunning ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-3 w-3" />
            )}
            Re-run
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Main panel (scenario) ─────────────────────────────────────────────────────

export function BacktestPanel({ scenarioId, baselineNetWorth }: BacktestPanelProps) {
  const { toast } = useToast();
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const fetchCached = useCallback(async () => {
    setIsFetching(true);
    try {
      const resp = await getScenarioBacktest(scenarioId);
      setResult(resp.data);
      setIsStale(resp.isStale);
    } catch {
      // 404 = no backtest run yet; other errors ignored — user can still run manually
      setResult(null);
    } finally {
      setIsFetching(false);
    }
  }, [scenarioId]);

  useEffect(() => {
    void fetchCached();
  }, [fetchCached]);

  const handleRun = async () => {
    setIsRunning(true);
    try {
      const resp = await runScenarioBacktest(scenarioId);
      setResult(resp.data);
      setIsStale(false);
      toast({ title: 'Backtesting complete', description: 'All 3 historical scenarios computed.' });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Backtesting failed',
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setIsRunning(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-ds-primary" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide shrink-0">
            Beta
          </Badge>
          <span>
            Historical stress tests are in beta. They show how your plan would have performed across
            three reference Canadian downturns; they are not a forecast of future returns.
          </span>
        </div>
        <div className="bg-ds-surface rounded-card py-12 text-center">
          <p className="text-muted-foreground mb-4">
            Run all 3 historical scenarios (dot-com crash, financial crisis, COVID) against your
            projection inputs to see how your portfolio would have held up.
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
                Run Historical Backtesting
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Staleness banner — TC-BT-011 */}
      {isStale && (
        <div className="flex items-center gap-2 rounded-card border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Inputs changed — re-run recommended</span>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto border-amber-400 text-amber-800 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-300"
            onClick={() => void handleRun()}
            disabled={isRunning}
          >
            {isRunning ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-3 w-3" />
            )}
            Re-run
          </Button>
        </div>
      )}

      <BacktestResultsView
        result={result}
        baselineNetWorth={baselineNetWorth}
        onRerun={() => void handleRun()}
        isRerunning={isRunning}
      />
    </div>
  );
}

// ── Projection panel ──────────────────────────────────────────────────────────

interface ProjectionBacktestPanelProps {
  projectionId: string;
  /** Baseline yearly net-worth data from the main projection (for chart overlay) */
  baselineNetWorth?: Array<{ year: number; value: number }>;
}

/**
 * ProjectionBacktestPanel — v1.14 Phase 62
 *
 * Historical backtesting for the top-level /projections/:id detail page.
 * The projection backtest API is GET-only; the server computes synchronously
 * on cache miss and caches the result in Redis for 5 minutes.
 */
export function ProjectionBacktestPanel({
  projectionId,
  baselineNetWorth,
}: ProjectionBacktestPanelProps) {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResult = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getProjectionBacktest(projectionId);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load backtest');
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  }, [projectionId]);

  useEffect(() => {
    void fetchResult();
  }, [fetchResult]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <Loader2 className="h-6 w-6 animate-spin text-ds-primary" />
        <p className="text-sm text-ds-on-surface-variant">
          Running 3 historical scenarios (dot-com, financial crisis, COVID)…
        </p>
      </div>
    );
  }

  if (error !== null || result === null) {
    return (
      <div className="bg-ds-surface rounded-card py-12 px-6 text-center space-y-4">
        <div className="flex flex-col items-center gap-2">
          <AlertCircle className="h-6 w-6 text-ds-error" />
          <p className="text-sm text-muted-foreground">{error ?? 'Backtest unavailable'}</p>
        </div>
        <Button
          variant="outline"
          className="border-ds-outline-variant hover:bg-ds-surface-raised"
          onClick={() => void fetchResult()}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <BacktestResultsView
      result={result}
      baselineNetWorth={baselineNetWorth}
      onRerun={() => void fetchResult()}
      isRerunning={isLoading}
    />
  );
}
