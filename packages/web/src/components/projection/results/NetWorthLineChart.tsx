'use client';

import type { ProjectionYearRow } from '@retireops/shared';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface NetWorthLineChartProps {
  projectionRows: ProjectionYearRow[];
  displayMode?: 'nominal' | 'real';
}

const formatYAxis = (value: number): string => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  if (value <= -1_000_000) return `-$${(Math.abs(value) / 1_000_000).toFixed(1)}M`;
  if (value <= -1_000) return `-$${(Math.abs(value) / 1_000).toFixed(0)}K`;
  return `$${String(value)}`;
};

export function NetWorthLineChart({
  projectionRows,
  displayMode = 'nominal',
}: NetWorthLineChartProps) {
  const chartData = projectionRows.map((row) => ({
    year: row.year,
    netWorth: row.householdNetWorth,
  }));
  const modeLabel = displayMode === 'real' ? "Today's Dollars" : 'Nominal CAD';
  const seriesLabel = displayMode === 'real' ? 'Net Worth (Real)' : 'Net Worth (Nominal)';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Net Worth Trajectory</CardTitle>
        <div className="text-xs text-muted-foreground" data-testid="net-worth-chart-mode">
          {modeLabel}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis dataKey="year" className="text-xs" />
              <YAxis tickFormatter={formatYAxis} className="text-xs" />
              <Tooltip
                formatter={(value: unknown) => [
                  new Intl.NumberFormat('en-CA', {
                    style: 'currency',
                    currency: 'CAD',
                    maximumFractionDigits: 0,
                  }).format(typeof value === 'number' ? value : 0),
                  seriesLabel,
                ]}
                labelFormatter={(label: unknown) => `Year: ${String(label)}`}
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '0.5rem',
                }}
              />
              <Line
                type="monotone"
                dataKey="netWorth"
                stroke="hsl(var(--ds-primary))"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
