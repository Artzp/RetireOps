/**
 * Profile data extraction utilities and CPP/OAS adjustment calculations.
 * @see docs/source-of-truth/05-government-benefits.md - CPP/OAS adjustment formulas
 */

export interface AccountCardInfo {
  id: string;
  label: string;
  type: string;
}

/**
 * Extracts account cards from profile stepData, handling both raw array and
 * cards-wrapper shapes produced by useFieldArray in AccountsStep.
 */
export function extractAccountCards(stepData: Record<string, unknown>): AccountCardInfo[] {
  const accountsData = stepData['accounts'];
  if (!accountsData) return [];
  const cards: unknown[] = Array.isArray(accountsData)
    ? accountsData
    : Array.isArray((accountsData as Record<string, unknown>).cards)
      ? ((accountsData as Record<string, unknown>).cards as unknown[])
      : [];
  return cards.map((card: unknown) => {
    const c = card as Record<string, unknown>;
    return {
      id: String(c._serverId ?? c.id ?? ''),
      label: String(c.label ?? c.name ?? c.type ?? 'Account'),
      type: String(c.type ?? ''),
    };
  });
}

export interface PropertyCardInfo {
  id: string;
  label: string;
  type: string;
}

/**
 * Extracts property cards from profile stepData.
 */
export function extractPropertyCards(stepData: Record<string, unknown>): PropertyCardInfo[] {
  const propData = stepData['property_goals'];
  if (!propData) return [];
  const raw = propData as Record<string, unknown>;
  const propertyCards: unknown[] = Array.isArray(raw.properties)
    ? (raw.properties as unknown[])
    : Array.isArray(raw)
      ? (raw as unknown[])
      : [];
  return propertyCards.map((card: unknown) => {
    const c = card as Record<string, unknown>;
    return {
      id: String(c._serverId ?? c.id ?? ''),
      label: String(c.address ?? c.label ?? c.name ?? 'Property'),
      type: String(c.propertyType ?? c.type ?? ''),
    };
  });
}

/**
 * Returns true if the profile has a spouse included.
 */
export function getHasSpouse(stepData: Record<string, unknown>): boolean {
  const aboutYou = stepData['about_you'] as Record<string, unknown> | undefined;
  return aboutYou?.includeSpouse === true;
}

/**
 * Generic getter for nested profile default values using dot-notation path.
 */
export function getProfileDefault(stepData: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = stepData;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * CPP start age adjustment percentage.
 * @see docs/source-of-truth/05-government-benefits.md
 *
 * - Before 65: -0.6% per month early (age range 60–64)
 * - Age 65: 0% (standard)
 * - After 65: +0.7% per month deferred (age range 66–70)
 */
export function cppAdjustment(age: number): { pct: number; months: number; label: string } {
  if (age === 65) return { pct: 0, months: 0, label: 'Standard benefit (no adjustment)' };
  const months = (age - 65) * 12;
  if (age < 65) {
    const pct = months * 0.6; // months is negative, so pct is negative
    return {
      pct,
      months: Math.abs(months),
      label: `${pct.toFixed(1)}% (${String(Math.abs(months))} months early)`,
    };
  }
  const pct = months * 0.7;
  return { pct, months, label: `+${pct.toFixed(1)}% (${String(months)} months deferred)` };
}

/**
 * OAS deferral adjustment percentage.
 * @see docs/source-of-truth/05-government-benefits.md
 *
 * - Age 65: 0% (no deferral)
 * - After 65: +0.6% per month deferred (max +36% at age 70)
 */
export function oasAdjustment(age: number): { pct: number; months: number; label: string } {
  if (age === 65) return { pct: 0, months: 0, label: 'No deferral bonus' };
  const months = (age - 65) * 12;
  const pct = months * 0.6;
  return { pct, months, label: `+${pct.toFixed(1)}% (${String(months)} months deferred)` };
}

/**
 * Formats a dollar amount in CAD for display.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formats a decimal fraction as a percentage string (e.g. 0.065 → "6.5%").
 */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
