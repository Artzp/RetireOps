import type { ProjectionResultData } from './projection';

export interface MetricComparison {
  name: string;
  label: string;
  base: number | null;
  scenarios: Array<{
    id: string;
    value: number | null;
    delta: number | null;
    percentChange: number | null;
  }>;
  bestId: string | null;
  higherIsBetter: boolean;
}

export interface YearlyComparisonRow {
  year: number;
  age: number;
  base: { netWorth: number; income: number; taxes: number };
  scenarios: Array<{ id: string; netWorth: number; income: number; taxes: number }>;
}

export interface ScenarioComparison {
  baseProjection: {
    id: string;
    name: string;
    resultData: ProjectionResultData;
  };
  scenarios: Array<{
    id: string;
    name: string;
    modifications: Record<string, unknown>;
    resultData: ProjectionResultData;
  }>;
  comparison: {
    metrics: MetricComparison[];
    yearlyComparison: YearlyComparisonRow[];
  };
}
