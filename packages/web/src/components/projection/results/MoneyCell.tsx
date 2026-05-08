'use client';

import { type ReactNode } from 'react';
import { formatCurrency } from '@/lib/utils';

/**
 * MoneyCell — Phase 12 / UI-05.
 *
 * Centralises the `formatCurrency(value ?? 0)` + `tabular-nums` pattern
 * used throughout YearByYearTab. Children render after the formatted
 * value so callers can append badges (Override dot, Clamp, Shortfall).
 *
 * @see .planning/phases/12-yearbyyear-column-registry/12-CONTEXT.md (UI-05)
 */
export interface MoneyCellProps {
  /** Monetary value; null/undefined renders as $0. */
  value: number | null | undefined;
  /** Optional extra classes appended to the base tabular-nums class. */
  className?: string;
  /** Optional trailing badges/icons rendered after the formatted value. */
  children?: ReactNode;
}

export function MoneyCell({ value, className, children }: MoneyCellProps) {
  const baseClass = 'tabular-nums';
  const finalClass = className ? `${baseClass} ${className}` : baseClass;
  return (
    <span className={finalClass}>
      {formatCurrency(value ?? 0)}
      {children}
    </span>
  );
}
