'use client';
/**
 * BacktestChart — v1.14 Phase 62
 *
 * Recharts LineChart overlaying:
 *   - Baseline projection trajectory (grey)
 *   - 3 historical backtest runs (red = 2000, orange = 2008, blue = 2020)
 *
 * X-axis: projection year offset (1 = first retirement year) so all 4 lines
 * share a comparable time horizon regardless of calendar start year.
 *
 * Depleted trajectories terminate at $0 — records after depletion are clipped.
 *
 * @see TC-BT-009
 */

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

interface RunData {
  label: string;
  scenarioId: string;
  funded: boolean;
  /** Per-year balance data — must already be clamped to 0 after depletion */
  points: Array<{ year: number; value: number }>;
}

interface BacktestChartProps {
  runs: RunData[];
  /** Baseline projection net worth by calendar year (from result_data.yearlyResults) */
  baselineNetWorth: Array<{ year: number; value: number }>;
}

const PRESET_COLORS: Record<string, string> = {
  'retired-2000': '#ef4444', // red
  'retired-2008': '#f97316', // orange
  'retired-2020': '#3b82f6', // blue
};

const BASELINE_COLOR = '#94a3b8'; // slate-400

function formatMoney(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

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
            {entry.name}: {formatMoney(typeof entry.value === 'number' ? entry.value : 0)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function BacktestChart({ runs, baselineNetWorth }: BacktestChartProps) {
  // Build a unified data array keyed by projectionYear (1-based offset)
  // Each row: { projYear, baseline?, 'retired-2000'?, 'retired-2008'?, 'retired-2020'? }
  const maxProjectionYear = Math.max(baselineNetWorth.length, ...runs.map((r) => r.points.length));

  // Pre-compute depletion point for each non-funded run (0-based index in points)
  const depletedAtIndex = new Map<string, number>();
  for (const run of runs) {
    if (!run.funded) {
      const idx = run.points.findIndex((p) => p.value <= 0);
      if (idx >= 0) depletedAtIndex.set(run.scenarioId, idx);
    }
  }

  const rows: Array<Record<string, number>> = [];

  for (let py = 1; py <= maxProjectionYear; py++) {
    const row: Record<string, number> = { projYear: py };

    // Baseline: index py-1
    const basePoint = baselineNetWorth[py - 1];
    if (basePoint !== undefined) {
      row['baseline'] = Math.max(0, basePoint.value);
    }

    // Historical runs — clip depleted trajectories after their zero point
    for (const run of runs) {
      const point = run.points[py - 1];
      if (point !== undefined) {
        const depletionIdx = depletedAtIndex.get(run.scenarioId);
        const pointIdx = py - 1;
        if (depletionIdx !== undefined && pointIdx > depletionIdx) {
          // Omit this key — chart will not draw line past depletion
        } else if (depletionIdx !== undefined && pointIdx === depletionIdx) {
          row[run.scenarioId] = 0;
        } else {
          row[run.scenarioId] = point.value;
        }
      }
    }

    rows.push(row);
  }

  if (maxProjectionYear === 0) {
    return (
      <Card className="bg-ds-surface border-ds-outline-variant">
        <CardContent className="py-8 text-center text-sm text-ds-on-surface-variant">
          No chart data available.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-ds-surface border-ds-outline-variant">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-ds-on-background">
          Portfolio Trajectory — Historical vs. Baseline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={rows} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant, #e2e8f0)" />
            <XAxis
              dataKey="projYear"
              label={{
                value: 'Retirement year',
                position: 'insideBottom',
                offset: -2,
                fontSize: 11,
              }}
              tick={{ fontSize: 11 }}
            />
            <YAxis tickFormatter={formatMoney} tick={{ fontSize: 11 }} width={56} />
            <Tooltip content={CustomTooltip} />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
              formatter={(value) => {
                const key = String(value);
                if (key === 'baseline') return 'Baseline';
                return runs.find((r) => r.scenarioId === key)?.label ?? key;
              }}
            />

            {/* Baseline — grey */}
            <Line
              type="monotone"
              dataKey="baseline"
              name="baseline"
              stroke={BASELINE_COLOR}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />

            {/* One line per preset */}
            {runs.map((run) => (
              <Line
                key={run.scenarioId}
                type="monotone"
                dataKey={run.scenarioId}
                name={run.scenarioId}
                stroke={PRESET_COLORS[run.scenarioId] ?? '#8884d8'}
                strokeWidth={2}
                strokeDasharray={run.funded ? undefined : '4 2'}
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
