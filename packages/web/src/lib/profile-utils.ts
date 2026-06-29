/**
 * Profile data extraction utilities and CPP/OAS adjustment calculations.
 * @see docs/source-of-truth/05-government-benefits.md - CPP/OAS adjustment formulas
 */

import { asString } from './coerce';

export interface AccountCardInfo {
  id: string;
  label: string;
  type: string;
  /**
   * Current balance as captured on the AccountsStep form. Stored as the raw
   * form value (string from the controlled input, possibly empty). Optional
   * because some legacy fixtures and codepaths construct cards without it.
   * Consumers coerce via `Number(currentBalance) || 0` — see constraint-warnings.ts.
   */
  currentBalance?: number | string;
}

/**
 * Pulls the raw account-card array out of `stepData.accounts`, tolerating both
 * the bare-array shape and the `{ cards: [...] }` wrapper that useFieldArray
 * produces in AccountsStep. Returns [] when accounts is absent or malformed.
 *
 * Single source of truth for this shape tolerance — every consumer that reads
 * account cards from stepData should route through here so the two
 * representations can never drift apart.
 */
export function extractAccountCardArray(stepData: Record<string, unknown>): unknown[] {
  const accountsData = stepData['accounts'];
  if (!accountsData) return [];
  if (Array.isArray(accountsData)) return accountsData;
  const wrapped = (accountsData as Record<string, unknown>).cards;
  return Array.isArray(wrapped) ? wrapped : [];
}

/**
 * Extracts account cards from profile stepData, handling both raw array and
 * cards-wrapper shapes produced by useFieldArray in AccountsStep.
 */
export function extractAccountCards(stepData: Record<string, unknown>): AccountCardInfo[] {
  return (
    extractAccountCardArray(stepData)
      .map((card: unknown) => {
        const c = card as Record<string, unknown>;
        const rawBalance = c.currentBalance;
        return {
          id: asString(c._serverId ?? c.id),
          label: asString(c.label ?? c.name ?? c.type, 'Account'),
          type: asString(c.type),
          currentBalance:
            typeof rawBalance === 'number' || typeof rawBalance === 'string' ? rawBalance : 0,
        };
      })
      // Drop cards with no stable id (missing both _serverId and id). Such a card
      // can't be referenced by a contribution override, the drawdown order, or
      // account metadata, and an empty id throws Radix's "<Select.Item /> must have
      // a value prop that is not an empty string" when rendered as a dropdown option.
      .filter((card) => card.id !== '')
  );
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
  return (
    propertyCards
      .map((card: unknown) => {
        const c = card as Record<string, unknown>;
        return {
          id: asString(c._serverId ?? c.id),
          label: asString(c.address ?? c.label ?? c.name, 'Property'),
          type: asString(c.propertyType ?? c.type),
        };
      })
      // Drop cards with no stable id — see extractAccountCards: unreferenceable and
      // an empty id breaks Radix <Select.Item> when rendered as a property option.
      .filter((card) => card.id !== '')
  );
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
