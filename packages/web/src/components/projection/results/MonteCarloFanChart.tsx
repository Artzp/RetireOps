'use client';

import type { PercentileBandResultContract } from '@retireops/shared';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

/**
 * MonteCarloFanChart — Recharts fan chart showing p10/p25/p50/p75/p90 percentile
 * wealth trajectories from a Monte Carlo simulation.
 *
 * Five Area bands with varying opacity create the probability cone;
 * a prominent p50 median Line overlays all bands.
 *
 * Zero-floors all percentile values via Math.max(0, value) before rendering.
 *
 * @see docs/source-of-truth/09-success-metrics.md — percentile band visualization
 * @see docs/TESTABLE-SURFACES.md — TC-NEW-MC-004
 */

const formatYAxis = (value: number): string => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  if (value <= -1_000_000) return `-$${(Math.abs(value) / 1_000_000).toFixed(1)}M`;
  if (value <= -1_000) return `-$${(Math.abs(value) / 1_000).toFixed(0)}K`;
  return `$${String(value)}`;
};

function FanChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload.length) return null;

  const getVal = (key: string): number => {
    const entry = payload.find((p) => p.dataKey === key);
    return typeof entry?.value === 'number' ? entry.value : 0;
  };

  return (
    <div
      style={{
        backgroundColor: 'hsl(var(--background))',
        border: '1px solid hsl(var(--border))',
        borderRadius: '0.5rem',
        padding: '0.5rem',
      }}
    >
      <p className="text-xs font-semibold mb-1">Year {label}</p>
      <p className="text-xs">p90: {formatYAxis(getVal('p90'))}</p>
      <p className="text-xs">p75: {formatYAxis(getVal('p75'))}</p>
      <p className="text-xs font-medium">p50 (median): {formatYAxis(getVal('p50'))}</p>
      <p className="text-xs">p25: {formatYAxis(getVal('p25'))}</p>
      <p className="text-xs">p10: {formatYAxis(getVal('p10'))}</p>
    </div>
  );
}

export function MonteCarloFanChart({ data }: { data: PercentileBandResultContract[] }) {
  // Zero-floor all percentile values before passing to chart (MC-VIZ-03)
  const chartData = data.map((row) => ({
    year: row.year,
    p10: Math.max(0, row.p10),
    p25: Math.max(0, row.p25),
    p50: Math.max(0, row.p50),
    p75: Math.max(0, row.p75),
    p90: Math.max(0, row.p90),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Percentile Wealth Trajectories</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80" data-testid="fan-chart">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis dataKey="year" className="text-xs" />
              <YAxis tickFormatter={formatYAxis} className="text-xs" width={70} />
              <Tooltip content={FanChartTooltip} />

              {/* 4 Area bands — absolute values, decreasing opacity from outermost (MC-VIZ-01) */}
              <Area
                type="monotone"
                dataKey="p90"
                fill="hsl(var(--muted-foreground))"
                fillOpacity={0.1}
                stroke="none"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="p75"
                fill="hsl(var(--muted-foreground))"
                fillOpacity={0.15}
                stroke="none"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="p25"
                fill="hsl(var(--muted-foreground))"
                fillOpacity={0.2}
                stroke="none"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="p10"
                fill="hsl(var(--muted-foreground))"
                fillOpacity={0.25}
                stroke="none"
                isAnimationActive={false}
              />

              {/* p50 median as prominent Line per MC-VIZ-01 */}
              <Line
                type="monotone"
                dataKey="p50"
                stroke="hsl(var(--ds-primary))"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
