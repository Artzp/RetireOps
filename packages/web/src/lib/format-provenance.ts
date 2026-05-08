/**
 * Phase 2 — Pure formatting helpers for the provenance section.
 *
 * @see .planning/phases/02-cell-provenance/02-UI-SPEC.md - Provenance Section Layout
 * @see .planning/phases/02-cell-provenance/02-UI-SPEC.md - Inputs section (locked formatting heuristic)
 */
import { formatCurrency } from '@/lib/utils';

/**
 * Converts a camelCase input key to a Title Case label.
 *   keyToLabel('totalTaxableIncome') === 'Total taxable income'
 *   keyToLabel('marginalRate')       === 'Marginal rate'
 *   keyToLabel('age')                === 'Age'
 */
export function keyToLabel(key: string): string {
  const spaced = key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Formats a provenance input value according to the locked UI-SPEC heuristic.
 *  - String values: passed through verbatim
 *  - Numbers with currency-keyed names (income, tax, amount, value, balance): formatCurrency
 *  - Numbers with rate-keyed names AND value <= 1: percentage with one decimal
 *  - All other numbers: .toLocaleString()
 *
 * @see .planning/phases/02-cell-provenance/02-UI-SPEC.md §Provenance Section Layout §Inputs section
 */
export function formatProvenanceValue(key: string, value: number | string | boolean): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (!Number.isFinite(value)) return String(value);

  const lower = key.toLowerCase();
  if (/income|tax|amount|value|balance/.test(lower)) {
    return formatCurrency(value);
  }
  if (lower.includes('rate') && value <= 1) {
    return `${(value * 100).toFixed(1)}%`;
  }
  return value.toLocaleString();
}
