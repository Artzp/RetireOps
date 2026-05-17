/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Callout — lightweight inline <aside> primitive for informational and
 * warning notices. Composed entirely from Tailwind utilities — no Radix
 * dependency, no Lucide icon. Used by `OasEstimatorCard` (Phase 22) for:
 *
 *   - `variant="info"`: the OAS clawback informational warning (OAS-07).
 *     `role="note"` — non-assertive; screen readers do NOT interrupt.
 *
 *   - `variant="warning"`: the 10-year-floor eligibility message (OAS-04).
 *     `role="alert"` — assertive; communicates eligibility impact.
 *
 * Public surface and visual specs are locked by
 * `.planning/phases/22-oas-estimate-helper/22-UI-SPEC.md` §"Design System" +
 * §"Color" "Callout colors" table. Any change to the className composition
 * must update the UI-SPEC table AND the co-located test asserting the
 * Tailwind utilities.
 *
 * Contrast (verified in UI-SPEC §Color, light-theme only — dark theme not
 * exercised by the wizard):
 *   - info  (text-foreground on bg-muted)   ≈ 15.3:1 AAA
 *   - warning (text-amber-900 on bg-amber-50) ≈ 10.8:1 AAA
 *
 * Forward compat: Phase 23 (GIS) may consume this primitive for the
 * "you may be eligible" framing. Phase 24 may add a `success` variant —
 * extend the discriminator but keep the prop set minimal.
 */
export interface CalloutProps {
  variant: 'info' | 'warning';
  children: ReactNode;
  className?: string;
}

export function Callout({ variant, children, className }: CalloutProps): JSX.Element {
  const role = variant === 'warning' ? 'alert' : 'note';
  const variantClass =
    variant === 'warning'
      ? 'border-amber-300 bg-amber-50 text-amber-900'
      : 'border-ds-outline-variant bg-muted text-foreground';
  return (
    <aside
      role={role}
      className={cn('rounded-md border p-3 text-sm space-y-1', variantClass, className)}
      data-testid={`callout-${variant}`}
    >
      {children}
    </aside>
  );
}
