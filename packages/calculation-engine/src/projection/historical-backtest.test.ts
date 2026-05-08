import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { runHistoricalBacktest, runAllPresetBacktests } from './historical-backtest.js';
import type { ProjectionInput } from '@retireops/shared';
import {
  BLENDED_HISTORICAL_RETURNS_DATASET,
  BACKTEST_PRESET_2000,
  BACKTEST_PRESET_2008,
  BACKTEST_PRESET_2020,
} from '@retireops/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));

function createTestInput(overrides: Partial<ProjectionInput> = {}): ProjectionInput {
  return {
    birthdate: new Date(1960, 0, 1),
    province: 'ON' as const,
    retirementAge: 65,
    lifeExpectancy: 95,
    employmentIncome: 0,
    employmentGrowthRate: 0,
    rrspBalance: 500000,
    rrspAnnualContribution: 0,
    tfsaBalance: 80000,
    tfsaAnnualContribution: 0,
    nonRegBalance: 100000,
    retirementSpending: 50000,
    investmentReturn: 0.07,
    inflationRate: 0.02,
    ...overrides,
  };
}

describe('Historical Backtesting Engine — Phase 60', () => {
  it('TC-BT-001: Historical return injection replaces fixed rate', () => {
    const input = createTestInput({ investmentReturn: 0.07 });
    const result = runHistoricalBacktest(
      input,
      BACKTEST_PRESET_2000,
      BLENDED_HISTORICAL_RETURNS_DATASET
    );

    const year2000 = result.yearRecords.find((r) => r.calendarYear === 2000);
    const year2008 = result.yearRecords.find((r) => r.calendarYear === 2008);
    const year2009 = result.yearRecords.find((r) => r.calendarYear === 2009);

    expect(year2000).toBeDefined();
    expect(year2008).toBeDefined();
    expect(year2009).toBeDefined();

    expect(year2000?.returnRateApplied).toBe(0.009);
    expect(year2008?.returnRateApplied).toBe(-0.284);
    expect(year2009?.returnRateApplied).toBe(0.303);

    expect(year2000?.returnRateApplied).not.toBe(0.07);
    expect(year2008?.returnRateApplied).not.toBe(0.07);
    expect(year2009?.returnRateApplied).not.toBe(0.07);
  });

  it('TC-BT-002: Sequence extension with isEstimated flag', () => {
    const input = createTestInput({
      retirementAge: 55,
      lifeExpectancy: 95,
    });

    const result = runHistoricalBacktest(
      input,
      BACKTEST_PRESET_2000,
      BLENDED_HISTORICAL_RETURNS_DATASET
    );

    const historicalYears = result.yearRecords.filter(
      (r) => r.calendarYear >= 2000 && r.calendarYear <= 2025
    );
    const estimatedYears = result.yearRecords.filter((r) => r.calendarYear >= 2026);

    for (const yr of historicalYears) {
      expect(yr.isEstimated).toBe(false);
    }

    expect(estimatedYears.length).toBeGreaterThan(0);
    for (const yr of estimatedYears) {
      expect(yr.isEstimated).toBe(true);
      expect(yr.returnRateApplied).toBe(BLENDED_HISTORICAL_RETURNS_DATASET.longRunAverage);
    }
  });

  it('TC-BT-003: Determinism check', () => {
    const input = createTestInput();
    const result1 = runHistoricalBacktest(
      input,
      BACKTEST_PRESET_2000,
      BLENDED_HISTORICAL_RETURNS_DATASET
    );
    const result2 = runHistoricalBacktest(
      input,
      BACKTEST_PRESET_2000,
      BLENDED_HISTORICAL_RETURNS_DATASET
    );

    expect(result1.funded).toBe(result2.funded);
    expect(result1.depletionYear).toBe(result2.depletionYear);
    expect(result1.finalBalance).toBe(result2.finalBalance);
    expect(result1.yearRecords.length).toBe(result2.yearRecords.length);

    for (let i = 0; i < result1.yearRecords.length; i++) {
      expect(result1.yearRecords[i]?.portfolioBalance).toBe(
        result2.yearRecords[i]?.portfolioBalance
      );
      expect(result1.yearRecords[i]?.returnRateApplied).toBe(
        result2.yearRecords[i]?.returnRateApplied
      );
      expect(result1.yearRecords[i]?.totalWithdrawals).toBe(
        result2.yearRecords[i]?.totalWithdrawals
      );
      expect(result1.yearRecords[i]?.totalTaxesPaid).toBe(result2.yearRecords[i]?.totalTaxesPaid);
    }
  });

  it('TC-BT-004: Funded scenario result', () => {
    const input = createTestInput({
      rrspBalance: 1200000,
      tfsaBalance: 400000,
      nonRegBalance: 400000,
      retirementAge: 65,
      lifeExpectancy: 95,
      retirementSpending: 60000,
    });

    const result = runHistoricalBacktest(
      input,
      BACKTEST_PRESET_2008,
      BLENDED_HISTORICAL_RETURNS_DATASET
    );

    expect(result.funded).toBe(true);
    expect(result.finalBalance).toBeGreaterThan(0);
    expect(result.depletionYear).toBeNull();
  });

  it('TC-BT-005: Depleted scenario result', () => {
    const input = createTestInput({
      rrspBalance: 150000,
      tfsaBalance: 80000,
      nonRegBalance: 70000,
      retirementAge: 60,
      lifeExpectancy: 95,
      retirementSpending: 80000,
    });

    const result = runHistoricalBacktest(
      input,
      BACKTEST_PRESET_2000,
      BLENDED_HISTORICAL_RETURNS_DATASET
    );

    expect(result.funded).toBe(false);
    expect(result.depletionYear).not.toBeNull();
    expect(result.depletionYear).toBeGreaterThan(2000);
    expect(result.finalBalance).toBe(0);
  });

  it('TC-BT-006: multi-year.ts NOT modified', () => {
    const multiYearContent = readFileSync(resolve(__dirname, './multi-year.ts'), 'utf-8');

    expect(multiYearContent).not.toContain('backtest');
    expect(multiYearContent).not.toContain('Backtest');
    expect(multiYearContent).not.toContain('HistoricalReturn');
    expect(multiYearContent).not.toContain('runHistoricalBacktest');
  });

  it('TC-HIST-005: Retired-2020 (COVID) scenario returns a BacktestRun', () => {
    const input = createTestInput();
    const result = runHistoricalBacktest(
      input,
      BACKTEST_PRESET_2020,
      BLENDED_HISTORICAL_RETURNS_DATASET
    );
    expect(result.scenarioId).toBe('retired-2020');
    expect(result.startYear).toBe(2020);
    expect(result.yearRecords.length).toBeGreaterThan(0);
    const year2020 = result.yearRecords.find((r) => r.calendarYear === 2020);
    expect(year2020?.isEstimated).toBe(false);
    if (result.funded) {
      expect(result.depletionYear).toBeNull();
      expect(result.finalBalance).toBeGreaterThan(0);
    } else {
      expect(result.depletionYear).not.toBeNull();
      expect(result.finalBalance).toBe(0);
    }
  });

  it('TC-HIST-007: runAllPresetBacktests is deterministic across two calls', () => {
    const input = createTestInput();
    const results1 = runAllPresetBacktests(input, BLENDED_HISTORICAL_RETURNS_DATASET);
    const results2 = runAllPresetBacktests(input, BLENDED_HISTORICAL_RETURNS_DATASET);
    expect(results1.length).toBe(3);
    expect(results2.length).toBe(3);
    for (let i = 0; i < 3; i++) {
      expect(results1[i]?.funded).toBe(results2[i]?.funded);
      expect(results1[i]?.finalBalance).toBe(results2[i]?.finalBalance);
      expect(results1[i]?.depletionYear).toBe(results2[i]?.depletionYear);
      expect(results1[i]?.yearRecords.length).toBe(results2[i]?.yearRecords.length);
    }
  });

  it('TC-HIST-008: BacktestYearRecord fields all populated correctly', () => {
    const input = createTestInput();
    const result = runHistoricalBacktest(
      input,
      BACKTEST_PRESET_2008,
      BLENDED_HISTORICAL_RETURNS_DATASET
    );
    expect(result.yearRecords.length).toBeGreaterThan(0);
    for (const record of result.yearRecords) {
      expect(typeof record.calendarYear).toBe('number');
      expect(typeof record.projectionYear).toBe('number');
      expect(typeof record.returnRateApplied).toBe('number');
      expect(typeof record.isEstimated).toBe('boolean');
      expect(typeof record.portfolioBalance).toBe('number');
      expect(typeof record.totalWithdrawals).toBe('number');
      expect(typeof record.totalTaxesPaid).toBe('number');
      expect(record.portfolioBalance).toBeGreaterThanOrEqual(0);
      expect(record.totalWithdrawals).toBeGreaterThanOrEqual(0);
      expect(record.totalTaxesPaid).toBeGreaterThanOrEqual(0);
      expect(record.projectionYear).toBe(record.calendarYear - result.startYear + 1);
    }
    for (let i = 1; i < result.yearRecords.length; i++) {
      expect(result.yearRecords[i]!.calendarYear).toBe(result.yearRecords[i - 1]!.calendarYear + 1);
    }
  });
});
