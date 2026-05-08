/* eslint-disable @typescript-eslint/restrict-template-expressions */
'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { YearlyComparisonRow } from '@/types/scenario';

interface ComparisonChartProps {
  yearlyComparison: YearlyComparisonRow[];
  scenarioNames: Record<string, string>;
}

const SCENARIO_COLORS = [
  'hsl(346, 77%, 49%)',
  'hsl(142, 76%, 36%)',
  'hsl(280, 65%, 60%)',
  'hsl(38, 92%, 50%)',
  'hsl(200, 80%, 50%)',
];

const BASE_COLOR = 'hsl(221, 83%, 53%)';

export function ComparisonChart({ yearlyComparison, scenarioNames }: ComparisonChartProps) {
  // Get unique scenario IDs from the data
  const scenarioIds = new Set<string>();
  for (const row of yearlyComparison) {
    for (const s of row.scenarios) {
      scenarioIds.add(s.id);
    }
  }
  const ids = Array.from(scenarioIds);

  // Transform data for recharts - flatten scenarios into columns
  const chartData = yearlyComparison.map((row) => {
    const point: Record<string, number> = {
      age: row.age,
      base: row.base.netWorth,
    };
    for (const s of row.scenarios) {
      point[s.id] = s.netWorth;
    }
    return point;
  });

  const formatYAxis = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  const formatTooltipValue = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="age" className="text-xs" />
          <YAxis tickFormatter={formatYAxis} className="text-xs" />
          <Tooltip
            formatter={(value: unknown, name: unknown) => [
              formatTooltipValue(typeof value === 'number' ? value : 0),
              name === 'base' ? 'Base Plan' : (scenarioNames[String(name)] ?? String(name ?? '')),
            ]}
            labelFormatter={(label) => `Age ${label}`}
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.5rem',
            }}
          />
          <Legend
            formatter={(value: string) =>
              value === 'base' ? 'Base Plan' : (scenarioNames[value] ?? value)
            }
          />
          <Line type="monotone" dataKey="base" stroke={BASE_COLOR} strokeWidth={2.5} dot={false} />
          {ids.map((id, index) => (
            <Line
              key={id}
              type="monotone"
              dataKey={id}
              stroke={SCENARIO_COLORS[index % SCENARIO_COLORS.length]}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
