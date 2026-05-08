/**
 * Inflation Handling
 * @see docs/source-of-truth/06-investment-engine.md - Inflation Handling
 */

/**
 * Inflation-indexed item configuration
 */
export interface InflationIndexedItem {
  baseValue: number;
  indexingRate: number; // 0 to 1 (0 = no indexing, 1 = full CPI)
}

/**
 * Convert nominal value to real (today's dollars)
 * @see docs/source-of-truth/06-investment-engine.md - Real vs. Nominal Dollars
 * @param nominalValue Future dollars
 * @param inflationRate Annual inflation rate
 * @param years Number of years from present
 * @returns Present value in today's dollars
 */
export function nominalToReal(nominalValue: number, inflationRate: number, years: number): number {
  return nominalValue / Math.pow(1 + inflationRate, years);
}

/**
 * Convert real value to nominal (future dollars)
 * @see docs/source-of-truth/06-investment-engine.md - Real vs. Nominal Dollars
 * @param realValue Today's dollars
 * @param inflationRate Annual inflation rate
 * @param years Number of years into future
 * @returns Future value in nominal dollars
 */
export function realToNominal(realValue: number, inflationRate: number, years: number): number {
  return realValue * Math.pow(1 + inflationRate, years);
}

/**
 * Apply inflation adjustment to a value
 * @param value Current value
 * @param inflationRate Annual inflation rate
 * @param years Number of years to apply
 * @returns Inflation-adjusted value
 */
export function applyInflation(value: number, inflationRate: number, years: number = 1): number {
  return value * Math.pow(1 + inflationRate, years);
}

/**
 * Calculate the purchasing power erosion
 * @param inflationRate Annual inflation rate
 * @param years Number of years
 * @returns Percentage of purchasing power retained (0-1)
 */
export function purchasingPowerRetained(inflationRate: number, years: number): number {
  return 1 / Math.pow(1 + inflationRate, years);
}

/**
 * Calculate cumulative inflation over a period
 * @param inflationRate Annual inflation rate
 * @param years Number of years
 * @returns Total cumulative inflation (e.g., 0.28 = 28% total inflation)
 */
export function cumulativeInflation(inflationRate: number, years: number): number {
  return Math.pow(1 + inflationRate, years) - 1;
}

/**
 * Apply partial indexing (e.g., pension with 50% CPI indexing)
 * @param value Current value
 * @param inflationRate Full CPI rate
 * @param indexingRate Percentage of CPI applied (0-1)
 * @returns Partially indexed value
 */
export function applyPartialIndexing(
  value: number,
  inflationRate: number,
  indexingRate: number
): number {
  const effectiveInflation = inflationRate * indexingRate;
  return value * (1 + effectiveInflation);
}

/**
 * Calculate inflation-indexed benefit over time
 * @param baseAmount Initial benefit amount
 * @param inflationRate Annual inflation rate
 * @param indexingRate How much of CPI is applied (0-1)
 * @param years Years into future
 * @returns Future benefit amount
 */
export function projectIndexedBenefit(
  baseAmount: number,
  inflationRate: number,
  indexingRate: number,
  years: number
): number {
  const effectiveInflation = inflationRate * indexingRate;
  return baseAmount * Math.pow(1 + effectiveInflation, years);
}

/**
 * Inflation-indexed items configuration
 * @see docs/source-of-truth/06-investment-engine.md - Inflation-Indexed Items Table
 */
export interface InflationIndexingConfig {
  /** CPP/OAS: fully indexed to CPI */
  governmentBenefits: number;
  /** DB pension: plan-specific, typically 0-100% of CPI */
  dbPension: number;
  /** Expenses: user assumption, default full CPI */
  expenses: number;
  /** Tax brackets: indexed annually */
  taxBrackets: number;
}

/**
 * Default inflation indexing configuration
 */
export const DEFAULT_INFLATION_INDEXING: InflationIndexingConfig = {
  governmentBenefits: 1.0, // 100% CPI indexed
  dbPension: 0.5, // 50% CPI indexed (conservative default)
  expenses: 1.0, // 100% CPI indexed
  taxBrackets: 1.0, // 100% CPI indexed
};

/**
 * Project expenses over time with inflation
 * @param baseExpenses Current annual expenses
 * @param inflationRate Annual inflation rate
 * @param years Years into future
 * @param indexingRate How much of CPI applies to expenses
 * @returns Array of yearly expense projections
 */
export function projectExpenses(
  baseExpenses: number,
  inflationRate: number,
  years: number,
  indexingRate: number = 1.0
): number[] {
  const expenses: number[] = [];
  let currentExpenses = baseExpenses;

  for (let year = 0; year < years; year++) {
    expenses.push(currentExpenses);
    currentExpenses = applyPartialIndexing(currentExpenses, inflationRate, indexingRate);
  }

  return expenses;
}

/**
 * Calculate required return to maintain purchasing power
 * @param targetRealReturn Desired real (after-inflation) return
 * @param inflationRate Expected inflation rate
 * @returns Required nominal return
 */
export function requiredNominalReturn(targetRealReturn: number, inflationRate: number): number {
  // Fisher equation
  return (1 + targetRealReturn) * (1 + inflationRate) - 1;
}

/**
 * Break-even inflation rate given nominal and real returns
 * @param nominalReturn Nominal investment return
 * @param realReturn Real investment return
 * @returns Implied inflation rate
 */
export function impliedInflationRate(nominalReturn: number, realReturn: number): number {
  return (1 + nominalReturn) / (1 + realReturn) - 1;
}
