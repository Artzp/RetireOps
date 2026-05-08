/**
 * Compile-level type tests for historical-backtest.ts interfaces
 * @see specs/010-historical-backtesting/data-model.md
 * @see TC-HIST-001
 */
import { describe, it, expect } from 'vitest';
import type {
  HistoricalReturnRecord,
  HistoricalReturnDataset,
  PresetScenario,
  BacktestYearRecord,
  BacktestRun,
  BacktestResult,
  BacktestYearReturn,
  BacktestPreset,
  BacktestScenarioResult,
  HistoricalBacktestResult,
} from './historical-backtest.js';

describe('historical-backtest types', () => {
  it('HistoricalReturnRecord satisfies interface shape', () => {
    const record: HistoricalReturnRecord = { year: 1990, returnRate: 0.143 };
    expect(record.year).toBe(1990);
    expect(record.returnRate).toBe(0.143);
  });

  it('HistoricalReturnDataset satisfies interface shape', () => {
    const dataset: HistoricalReturnDataset = {
      id: 'test',
      name: 'Test',
      sourceAttribution: 'Test source',
      yearRange: { from: 1990, to: 2025 },
      longRunAverage: 0.08,
      records: [{ year: 1990, returnRate: 0.08 }],
    };
    expect(dataset.records).toHaveLength(1);
  });

  it('PresetScenario satisfies interface shape', () => {
    const scenario: PresetScenario = {
      id: 'retired-2000',
      label: 'Retired 2000 — Dot-com Crash',
      description: 'Test description',
      startYear: 2000,
    };
    expect(scenario.id).toBe('retired-2000');
  });

  it('BacktestYearRecord satisfies interface shape', () => {
    const record: BacktestYearRecord = {
      calendarYear: 2000,
      projectionYear: 1,
      returnRateApplied: -0.12,
      isEstimated: false,
      portfolioBalance: 980000,
      totalWithdrawals: 50000,
      totalTaxesPaid: 8000,
    };
    expect(record.isEstimated).toBe(false);
  });

  it('BacktestRun funded case satisfies interface shape', () => {
    const run: BacktestRun = {
      scenarioId: 'retired-2008',
      label: 'Retired 2008 — Financial Crisis',
      description: 'Test',
      startYear: 2008,
      funded: true,
      depletionYear: null,
      finalBalance: 500000,
      yearRecords: [],
    };
    expect(run.depletionYear).toBeNull();
  });

  it('BacktestRun depleted case satisfies interface shape', () => {
    const run: BacktestRun = {
      scenarioId: 'retired-2020',
      label: 'Retired 2020 — COVID Shock',
      description: 'Test',
      startYear: 2020,
      funded: false,
      depletionYear: 2042,
      finalBalance: 0,
      yearRecords: [],
    };
    expect(run.funded).toBe(false);
  });

  it('BacktestResult satisfies interface shape', () => {
    const result: BacktestResult = {
      projectionId: 'proj-123',
      inputDataHash: 'abc123',
      runs: [],
      computedAt: '2026-04-12T00:00:00.000Z',
    };
    expect(result.runs).toHaveLength(0);
  });

  it('roadmap type aliases are assignable to their base interfaces', () => {
    // BacktestYearReturn = BacktestYearRecord
    const yearReturn: BacktestYearReturn = {
      calendarYear: 2000,
      projectionYear: 1,
      returnRateApplied: -0.12,
      isEstimated: false,
      portfolioBalance: 980000,
      totalWithdrawals: 50000,
      totalTaxesPaid: 8000,
    };
    expect(yearReturn.calendarYear).toBe(2000);

    // BacktestPreset = PresetScenario
    const preset: BacktestPreset = {
      id: 'retired-2000',
      label: 'Retired 2000 - Dot-com Crash',
      description: 'Test',
      startYear: 2000,
    };
    expect(preset.id).toBe('retired-2000');

    // BacktestScenarioResult = BacktestRun
    const scenarioResult: BacktestScenarioResult = {
      scenarioId: 'retired-2008',
      label: 'Test',
      description: 'Test',
      startYear: 2008,
      funded: true,
      depletionYear: null,
      finalBalance: 500000,
      yearRecords: [],
    };
    expect(scenarioResult.funded).toBe(true);

    // HistoricalBacktestResult = BacktestResult
    const result: HistoricalBacktestResult = {
      projectionId: 'proj-456',
      inputDataHash: 'def789',
      runs: [],
      computedAt: '2026-04-12T00:00:00.000Z',
    };
    expect(result.runs).toHaveLength(0);
  });
});
