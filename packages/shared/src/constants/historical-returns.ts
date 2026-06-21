/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * Historical Return Dataset — v1.14
 *
 * Static blended annual return dataset for historical backtesting.
 * 60% S&P/TSX Composite + 40% S&P 500 (CAD), nominal returns, gross of fees.
 * Years 1990–2025.
 *
 * NOTE: Return values below are approximate published historical data.
 * Source: TMX Group / Morningstar. Cross-check 2000, 2008, 2020 against
 * authoritative published sources before Phase 60 validation.
 *
 * @see specs/010-historical-backtesting/data-model.md
 * @see docs/source-of-truth/06-investment-engine.md
 * @see TC-HIST-001
 */
import type { HistoricalReturnDataset, PresetScenario } from '../types/historical-backtest.js';

/**
 * Blended annual returns: 60% S&P/TSX Composite + 40% S&P 500 (CAD),
 * nominal, gross of fees, 1990–2025.
 *
 * longRunAverage equals arithmetic mean of all records[].returnRate.
 * Computed: sum(returnRates) / 36 = 3.57 / 36 ~ 0.099167
 *
 * @see HIST-01
 */
export const BLENDED_HISTORICAL_RETURNS_DATASET: HistoricalReturnDataset = {
  id: 'tsx-sp500-60-40-1990-2025',
  name: 'TSX/S&P 500 60/40 Blended (1990–2025)',
  sourceAttribution: 'S&P/TSX Composite + S&P 500 CAD, 60/40 blend, nominal returns, gross of fees',
  yearRange: { from: 1990, to: 2025 },
  // Arithmetic mean of all 36 returnRate values below.
  // Recompute if any record is updated: sum(returnRates) / 36
  longRunAverage: 0.099167,
  records: [
    // 1990s
    { year: 1990, returnRate: -0.101 }, // TSX -14.8%, S&P 500 CAD -3.1%; blended -10.1%
    { year: 1991, returnRate: 0.122 }, // TSX +12.0%, S&P 500 CAD +12.4%; blended +12.2%
    { year: 1992, returnRate: -0.01 }, // TSX -1.4%, S&P 500 CAD -0.5%; blended -1.0%
    { year: 1993, returnRate: 0.281 }, // TSX +32.6%, S&P 500 CAD +21.4%; blended +28.1%
    { year: 1994, returnRate: 0.001 }, // TSX -0.2%, S&P 500 CAD +0.6%; blended +0.1%
    { year: 1995, returnRate: 0.176 }, // TSX +14.5%, S&P 500 CAD +22.3%; blended +17.6%
    { year: 1996, returnRate: 0.313 }, // TSX +28.3%, S&P 500 CAD +35.7%; blended +31.3%
    { year: 1997, returnRate: 0.199 }, // TSX +14.9%, S&P 500 CAD +27.3%; blended +19.9%
    { year: 1998, returnRate: 0.118 }, // TSX -3.2%, S&P 500 CAD +34.2%; blended +11.8% -- CAD depreciation boosted US returns
    { year: 1999, returnRate: 0.26 }, // TSX +29.7%, S&P 500 CAD +20.5%; blended +26.0%
    // 2000s
    { year: 2000, returnRate: 0.009 }, // TSX +7.4%, S&P 500 CAD -8.9%; blended +0.9% -- Dot-com peak/bust; CAD fall cushions
    { year: 2001, returnRate: -0.122 }, // TSX -12.6%, S&P 500 CAD -11.7%; blended -12.2%
    { year: 2002, returnRate: -0.135 }, // TSX -12.4%, S&P 500 CAD -15.2%; blended -13.5%
    { year: 2003, returnRate: 0.182 }, // TSX +26.7%, S&P 500 CAD +5.5%; blended +18.2%
    { year: 2004, returnRate: 0.104 }, // TSX +14.5%, S&P 500 CAD +4.2%; blended +10.4%
    { year: 2005, returnRate: 0.199 }, // TSX +24.1%, S&P 500 CAD +13.5%; blended +19.9%
    { year: 2006, returnRate: 0.155 }, // TSX +17.3%, S&P 500 CAD +12.9%; blended +15.5%
    { year: 2007, returnRate: 0.085 }, // TSX +9.8%, S&P 500 CAD +6.5%; blended +8.5%
    { year: 2008, returnRate: -0.284 }, // TSX -33.0%, S&P 500 CAD -21.4%; blended -28.4% -- Financial crisis
    { year: 2009, returnRate: 0.303 }, // TSX +35.1%, S&P 500 CAD +23.2%; blended +30.3%
    // 2010s
    { year: 2010, returnRate: 0.15 }, // TSX +17.6%, S&P 500 CAD +11.2%; blended +15.0%
    { year: 2011, returnRate: -0.047 }, // TSX -8.7%, S&P 500 CAD +1.4%; blended -4.7%
    { year: 2012, returnRate: 0.103 }, // TSX +7.2%, S&P 500 CAD +15.0%; blended +10.3%
    { year: 2013, returnRate: 0.244 }, // TSX +13.0%, S&P 500 CAD +41.5%; blended +24.4%
    { year: 2014, returnRate: 0.159 }, // TSX +10.5%, S&P 500 CAD +23.9%; blended +15.9%
    { year: 2015, returnRate: 0.037 }, // TSX -8.3%, S&P 500 CAD +21.6%; blended +3.7%
    { year: 2016, returnRate: 0.161 }, // TSX +21.1%, S&P 500 CAD +8.6%; blended +16.1%
    { year: 2017, returnRate: 0.11 }, // TSX +9.1%, S&P 500 CAD +13.8%; blended +11.0%
    { year: 2018, returnRate: -0.073 }, // TSX -8.9%, S&P 500 CAD -5.0%; blended -7.3%
    { year: 2019, returnRate: 0.236 }, // TSX +22.9%, S&P 500 CAD +24.6%; blended +23.6%
    // 2020s
    { year: 2020, returnRate: 0.078 }, // TSX +2.2%, S&P 500 CAD +16.1%; blended +7.8% -- COVID crash + recovery
    { year: 2021, returnRate: 0.238 }, // TSX +21.7%, S&P 500 CAD +27.0%; blended +23.8%
    { year: 2022, returnRate: -0.085 }, // TSX -5.8%, S&P 500 CAD -12.6%; blended -8.5%
    { year: 2023, returnRate: 0.164 }, // TSX +11.8%, S&P 500 CAD +23.3%; blended +16.4%
    { year: 2024, returnRate: 0.2 }, // TSX +17.8%, S&P 500 CAD +23.3%; blended +20.0%
    { year: 2025, returnRate: 0.04 }, // TSX estimate; S&P 500 CAD estimate -- partial year 2025
  ],
};

/**
 * Three fixed preset scenarios for historical backtesting.
 * Each pairs a human-readable label with a start year from the dataset.
 *
 * @see HIST-02
 */
export const PRESET_SCENARIOS: PresetScenario[] = [
  {
    id: 'retired-2000',
    label: 'Retired 2000 — Dot-com Crash',
    description:
      'Portfolio entered a 3-year equity drawdown immediately after retirement as the dot-com bubble burst.',
    startYear: 2000,
  },
  {
    id: 'retired-2008',
    label: 'Retired 2008 — Financial Crisis',
    description:
      'Portfolio faced the worst single-year loss in the dataset in its first year of retirement during the 2008 global financial crisis.',
    startYear: 2008,
  },
  {
    id: 'retired-2020',
    label: 'Retired 2020 — COVID Shock',
    description:
      'Portfolio experienced a sharp short-term drawdown at retirement onset due to the COVID-19 pandemic, followed by a rapid recovery.',
    startYear: 2020,
  },
];

/**
 * Alias for BLENDED_HISTORICAL_RETURNS_DATASET matching ROADMAP.md SC-1 name contract.
 * Downstream phases 60-62 reference this name in their success criteria.
 *
 * @deprecated Use {@link BLENDED_HISTORICAL_RETURNS_DATASET} instead — it is the
 * canonical name used throughout the codebase. This alias is kept only for
 * public-API compatibility and may be removed in a future major version.
 * (Audit E-05, 2026-06-10.)
 */
export const HISTORICAL_RETURNS_1990_2025 = BLENDED_HISTORICAL_RETURNS_DATASET;

/**
 * Individual preset constant aliases matching ROADMAP.md SC-2 name contract.
 * Downstream phases reference these by name.
 */
export const BACKTEST_PRESET_2000 = PRESET_SCENARIOS[0]!;
export const BACKTEST_PRESET_2008 = PRESET_SCENARIOS[1]!;
export const BACKTEST_PRESET_2020 = PRESET_SCENARIOS[2]!;
