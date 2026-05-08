/**
 * Historical Backtesting Types — v1.14
 *
 * Shared type contract for the historical backtesting engine.
 * All interfaces mirror the data-model.md spec exactly.
 *
 * @see specs/010-historical-backtesting/data-model.md
 * @see docs/source-of-truth/06-investment-engine.md - Investment Growth
 * @see TC-HIST-001
 */

export interface HistoricalReturnRecord {
  year: number; // Calendar year (e.g., 1990)
  returnRate: number; // Decimal nominal blended return (e.g., 0.143 = 14.3%)
}

export interface HistoricalReturnDataset {
  id: string; // e.g., 'tsx-sp500-60-40-1990-2025'
  name: string; // e.g., 'TSX/S&P 500 60/40 Blended (1990–2025)'
  sourceAttribution: string; // e.g., 'S&P/TSX Composite + S&P 500 CAD, 60/40 blend'
  yearRange: { from: number; to: number }; // { from: 1990, to: 2025 }
  longRunAverage: number; // Arithmetic mean of all returnRates in records
  records: HistoricalReturnRecord[]; // Sorted ascending by year
}

export interface PresetScenario {
  id: 'retired-2000' | 'retired-2008' | 'retired-2020';
  label: string; // e.g., 'Retired 2000 — Dot-com Crash'
  description: string; // e.g., 'Portfolio entered a 3-year equity drawdown immediately after retirement.'
  startYear: number; // 2000 | 2008 | 2020
}

export interface BacktestYearRecord {
  calendarYear: number; // The actual calendar year (e.g., 2000)
  projectionYear: number; // Year offset from retirement start (1 = first retirement year)
  returnRateApplied: number; // Decimal return used this year (may be longRunAverage if estimated)
  isEstimated: boolean; // true when returnRateApplied comes from longRunAverage, not dataset
  portfolioBalance: number; // Total portfolio value at year-end (all accounts combined)
  totalWithdrawals: number; // Total withdrawals taken this year
  totalTaxesPaid: number; // Total taxes paid this year
}

export interface BacktestRun {
  scenarioId: PresetScenario['id'];
  label: string;
  description: string;
  startYear: number;
  funded: boolean; // true if portfolio never reached zero
  depletionYear: number | null; // Calendar year when balance first hit zero; null if funded
  finalBalance: number; // Portfolio balance at end of projection horizon (0 if depleted)
  yearRecords: BacktestYearRecord[];
}

export interface BacktestResult {
  projectionId: string;
  inputDataHash: string; // SHA-256 of deterministicSerialize(inputData) — staleness detection
  runs: BacktestRun[]; // One per preset scenario (3 entries)
  computedAt: string; // ISO 8601 timestamp
}

/**
 * Type aliases matching ROADMAP.md SC-3 name contract.
 * Downstream phases 60-62 reference these names in their success criteria.
 * The original interface names (BacktestYearRecord, PresetScenario, BacktestRun, BacktestResult)
 * remain exported and are functionally identical.
 */
export type BacktestYearReturn = BacktestYearRecord;
export type BacktestPreset = PresetScenario;
export type BacktestScenarioResult = BacktestRun;
export type HistoricalBacktestResult = BacktestResult;
