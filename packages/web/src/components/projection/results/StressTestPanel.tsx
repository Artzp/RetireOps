'use client';

/**
 * StressTestPanel — Feature 3.3
 *
 * Displays stress-test results for a profile scenario.
 * - Auto-fetches on mount (no user input required — TC-ST-008)
 * - Shows all 4 scenario cards with funded/depleted badge (TC-ST-009)
 * - Shows comparative chart with baseline + stress lines (TC-ST-009)
 *
 * @see retireops-acceptance-tests/feature-3.3-stress-testing.md TC-ST-008..010
 * @see docs/source-of-truth/06-investment-engine.md — Stress Test Scenarios Table
 */

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { runProfileScenarioStressTest } from '@/lib/api/stress-test';
import type { StressScenarioResult } from '@/lib/api/stress-test';
import { Loader2 } from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function scenarioLabel(key: StressScenarioResult['scenario']): string {
  switch (key) {
    case 'market_crash_at_retirement':
      return 'Market Crash at Retirement';
    case 'lost_decade':
      return 'Lost Decade';
    case 'high_inflation':
      return 'High Inflation';
    case '2008_replay':
      return '2008 Replay';
  }
}

const SCENARIO_COLORS: Record<string, string> = {
  market_crash_at_retirement: '#ef4444', // red
  lost_decade: '#f97316', // orange
  high_inflation: '#eab308', // yellow
  '2008_replay': '#8b5cf6', // purple
};

const BASELINE_COLOR = '#94a3b8'; // slate-400

// ── Scenario card ─────────────────────────────────────────────────────────────

function ScenarioCard({ result }: { result: StressScenarioResult }) {
  const funded = result.depletionYear === null;

  return (
    <Card className="bg-ds-surface border-ds-outline-variant">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-semibold text-ds-on-background leading-tight">
              {scenarioLabel(result.scenario)}
            </CardTitle>
            <p className="text-xs text-ds-on-surface-variant mt-0.5 leading-snug">
              {result.description}
            </p>
          </div>
          <span
            className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              funded
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
            }`}
          >
            {funded ? 'Funded' : 'Depleted'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-xs">
          {funded ? (
            <div>
              <span className="text-ds-on-surface-variant">Final balance</span>
              <div className="font-semibold text-ds-on-background">
                {formatCurrency(result.finalBalance)}
              </div>
            </div>
          ) : (
            <div>
              <span className="text-ds-on-surface-variant">Depleted in year</span>
              <div className="font-semibold text-ds-error">{result.depletionYear}</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Chart ─────────────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload.length) return null;
  return (
    <div className="rounded-card bg-ds-surface border border-ds-outline-variant p-2 text-xs shadow-md">
      <p className="font-medium mb-1 text-ds-on-surface-variant">Year {label as string}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-ds-on-background">
            {entry.name}: {formatCurrency(typeof entry.value === 'number' ? entry.value : 0)}
          </span>
        </div>
      ))}
    </div>
  );
}

interface StressChartProps {
  results: StressScenarioResult[];
  baselineNetWorth: Array<{ year: number; value: number }>;
}

function StressChart({ results, baselineNetWorth }: StressChartProps) {
  const maxYear = Math.max(baselineNetWorth.length, ...results.map((r) => r.yearlyData.length));

  if (maxYear === 0) {
    return (
      <Card className="bg-ds-surface border-ds-outline-variant">
        <CardContent className="py-8 text-center text-sm text-ds-on-surface-variant">
          No chart data available.
        </CardContent>
      </Card>
    );
  }

  const rows: Array<Record<string, number>> = [];
  for (let y = 1; y <= maxYear; y++) {
    const row: Record<string, number> = { year: y };
    const basePoint = baselineNetWorth[y - 1];
    if (basePoint !== undefined) {
      row['baseline'] = Math.max(0, basePoint.value);
    }
    for (const r of results) {
      const pt = r.yearlyData[y - 1];
      if (pt !== undefined) {
        row[r.scenario] = pt.balance;
      }
    }
    rows.push(row);
  }

  return (
    <Card className="bg-ds-surface border-ds-outline-variant" data-testid="stress-test-chart">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-ds-on-background">
          Portfolio Trajectory — Stress Scenarios vs. Baseline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={rows} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant, #e2e8f0)" />
            <XAxis
              dataKey="year"
              label={{
                value: 'Retirement year',
                position: 'insideBottom',
                offset: -2,
                fontSize: 11,
              }}
              tick={{ fontSize: 11 }}
            />
            <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11 }} width={56} />
            <Tooltip content={CustomTooltip} />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
              formatter={(value: string) => {
                if (value === 'baseline') return 'Baseline';
                const match = results.find((r) => r.scenario === value);
                return match ? scenarioLabel(match.scenario) : value;
              }}
            />
            <Line
              type="monotone"
              dataKey="baseline"
              name="baseline"
              stroke={BASELINE_COLOR}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
            {results.map((r) => (
              <Line
                key={r.scenario}
                type="monotone"
                dataKey={r.scenario}
                name={r.scenario}
                stroke={SCENARIO_COLORS[r.scenario] ?? '#8884d8'}
                strokeWidth={2}
                strokeDasharray={r.depletionYear !== null ? '4 2' : undefined}
                dot={false}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <p className="mt-1 text-xs text-ds-on-surface-variant">
          Dashed lines = depleted scenario. All values in nominal CAD.
        </p>
      </CardContent>
    </Card>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface StressTestPanelProps {
  scenarioId: string;
  /** Baseline yearly net-worth from the main projection (for chart overlay) */
  baselineNetWorth?: Array<{ year: number; value: number }>;
}

export function StressTestPanel({ scenarioId, baselineNetWorth = [] }: StressTestPanelProps) {
  const [results, setResults] = useState<StressScenarioResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await runProfileScenarioStressTest(scenarioId);
      setResults(resp.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stress test results.');
    } finally {
      setIsLoading(false);
    }
  }, [scenarioId]);

  useEffect(() => {
    void fetchResults();
  }, [fetchResults]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-ds-primary" />
      </div>
    );
  }

  if (error !== null || results === null) {
    return (
      <div className="bg-ds-surface rounded-card py-8 text-center text-sm text-ds-on-surface-variant">
        {error ?? 'Unable to load stress test results.'}
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="stress-test-results">
      <StressChart results={results} baselineNetWorth={baselineNetWorth} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {results.map((r) => (
          <ScenarioCard key={r.scenario} result={r} />
        ))}
      </div>
    </div>
  );
}
