'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Star, ArrowUp, ArrowDown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { ComparisonChart } from './ComparisonChart';
import type { ScenarioComparison, MetricComparison } from '@/types/scenario';

interface ComparisonViewProps {
  data: ScenarioComparison;
  onBack: () => void;
}

function formatMetricValue(name: string, value: number | null): string {
  if (value === null) return '-';
  if (name === 'probabilityOfSuccess') return `${String(value)}%`;
  if (name === 'portfolioLongevity' || name === 'yearsInRetirement') return String(value);
  return formatCurrency(value);
}

function DeltaDisplay({
  delta,
  percentChange,
  higherIsBetter,
}: {
  delta: number | null;
  percentChange: number | null;
  higherIsBetter: boolean;
}) {
  if (delta === null) return <span className="text-muted-foreground">-</span>;

  const isPositive = delta > 0;
  const isBetter = higherIsBetter ? isPositive : !isPositive;
  const isNeutral = delta === 0;

  if (isNeutral) {
    return <span className="text-muted-foreground text-xs">no change</span>;
  }

  return (
    <span
      className={`inline-flex items-center text-xs ${isBetter ? 'text-ds-primary' : 'text-ds-error'}`}
    >
      {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {percentChange !== null ? `${Math.abs(percentChange).toFixed(1)}%` : ''}
    </span>
  );
}

export function ComparisonView({ data, onBack }: ComparisonViewProps) {
  const comparison = data;

  const scenarioNames: Record<string, string> = {};
  for (const s of comparison.scenarios) {
    scenarioNames[s.id] = s.name;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" className="hover:bg-ds-surface-raised" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Scenarios
        </Button>
        <h3 className="text-xl font-bold text-ds-on-background">Scenario Comparison</h3>
      </div>

      {/* Metrics Table */}
      <Card className="bg-ds-surface rounded-card border-0">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Key Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ds-outline-variant">
                  <th className="text-left py-2 pr-4 text-sm font-bold text-ds-on-background">
                    Metric
                  </th>
                  <th className="text-right py-2 px-4 text-sm font-bold text-ds-on-background bg-ds-surface-raised/60">
                    Base Plan
                  </th>
                  {comparison.scenarios.map((s) => (
                    <th
                      key={s.id}
                      className="text-right py-2 px-4 text-sm font-bold text-ds-on-background border-b border-ds-outline-variant"
                    >
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.comparison.metrics.map((metric: MetricComparison, index: number) => (
                  <tr
                    key={metric.name}
                    className={`border-b border-ds-outline-variant/50 last:border-0 hover:bg-ds-surface-raised/40 transition-colors ${index % 2 === 1 ? 'bg-ds-surface-raised/20' : ''}`}
                  >
                    <td className="py-2 pr-4 text-muted-foreground">{metric.label}</td>
                    <td className="text-right py-2 px-4 font-medium">
                      {formatMetricValue(metric.name, metric.base)}
                    </td>
                    {metric.scenarios.map((sm) => (
                      <td
                        key={sm.id}
                        className={`text-right py-2 px-4 ${metric.bestId === sm.id ? 'bg-ds-primary-container/60' : ''}`}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-medium">
                            {formatMetricValue(metric.name, sm.value)}
                          </span>
                          <DeltaDisplay
                            delta={sm.delta}
                            percentChange={sm.percentChange}
                            higherIsBetter={metric.higherIsBetter}
                          />
                          {metric.bestId === sm.id && (
                            <Star className="h-3.5 w-3.5 text-ds-tertiary fill-ds-tertiary" />
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Net Worth Chart */}
      {comparison.comparison.yearlyComparison.length > 0 && (
        <Card className="bg-ds-surface rounded-card border-0">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Net Worth Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <ComparisonChart
              yearlyComparison={comparison.comparison.yearlyComparison}
              scenarioNames={scenarioNames}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
