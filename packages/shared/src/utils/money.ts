/**
 * Money Utilities
 */

/**
 * Format currency for display
 */
export function formatCurrency(
  amount: number,
  locale: string = 'en-CA',
  currency: string = 'CAD'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format currency with cents
 */
export function formatCurrencyWithCents(
  amount: number,
  locale: string = 'en-CA',
  currency: string = 'CAD'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Round to two decimal places (for monetary calculations)
 */
export function roundToTwoDecimals(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Round to nearest dollar
 */
export function roundToNearestDollar(amount: number): number {
  return Math.round(amount);
}

/**
 * Calculate percentage of an amount
 */
export function percentageOf(amount: number, percentage: number): number {
  return amount * percentage;
}

/**
 * Adjust amount for inflation over years
 */
export function inflationAdjust(amount: number, inflationRate: number, years: number): number {
  return amount * Math.pow(1 + inflationRate, years);
}

/**
 * Calculate real (inflation-adjusted) return from nominal return
 */
export function realReturn(nominalReturn: number, inflationRate: number): number {
  return (1 + nominalReturn) / (1 + inflationRate) - 1;
}

/**
 * Calculate compound growth
 */
export function compoundGrowth(principal: number, rate: number, years: number): number {
  return principal * Math.pow(1 + rate, years);
}

/**
 * Calculate future value with regular contributions
 * FV = PV(1+r)^n + PMT * (((1+r)^n - 1) / r)
 */
export function futureValue(
  presentValue: number,
  annualContribution: number,
  rate: number,
  years: number
): number {
  if (rate === 0) {
    return presentValue + annualContribution * years;
  }

  const compoundFactor = Math.pow(1 + rate, years);
  const growthPV = presentValue * compoundFactor;
  const growthContributions = annualContribution * ((compoundFactor - 1) / rate);

  return growthPV + growthContributions;
}

/**
 * Ensure a number is not negative
 */
export function ensureNonNegative(amount: number): number {
  return Math.max(0, amount);
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
