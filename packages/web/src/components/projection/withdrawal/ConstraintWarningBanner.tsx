/**
 * ConstraintWarningBanner — surfaces shared constraint advisories above the
 * Withdrawal Plan card list (Phase 29 Plan 02).
 *
 * Consumes an array of `ConstraintWarning` objects (produced by the shared
 * `buildAllConstraintWarnings` aggregator in
 * `@retireops/shared/withdrawal/constraints.ts`). Renders a single
 * informational region with one item per warning.
 *
 * Behaviour:
 *  - Empty array → renders `null` (no DOM, no slot).
 *  - Non-empty   → renders a shadcn Card listing each warning with its title,
 *                  message, and an optional source link.
 *
 * Accessibility:
 *  - The container is `role="region"` with `aria-label="Constraint warnings"`
 *    so screen readers announce it as a named landmark when the user navigates
 *    into the Withdrawal Plan area.
 *  - All warnings are severity `'info'` (Pitfall 3 — never `'error'` for
 *    RRIF/LIF advisories), so the visual treatment is informational, not
 *    destructive.
 *
 * Phase 29 ships STRUCTURAL wiring only — `WithdrawalPlanSection` accepts a
 * `warnings` prop and passes it through, but the live `ConstraintInput`
 * derivation from projection-year rows is deferred to a follow-up plan.
 * Callers currently pass `warnings={[]}`, which collapses to null render.
 *
 * @see .planning/phases/29-constraint-validators/29-02-PLAN.md
 * @see packages/shared/src/withdrawal/constraints.ts
 * @see CON-06, CON-07
 */
'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { ConstraintWarning } from '@/lib/constraint-warnings';

export interface ConstraintWarningBannerProps {
  warnings: ConstraintWarning[];
}

export function ConstraintWarningBanner({
  warnings,
}: ConstraintWarningBannerProps): JSX.Element | null {
  if (warnings.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Constraint warnings"
      data-testid="constraint-warning-banner"
      className="space-y-2"
    >
      <Card className="border-amber-300 bg-amber-50">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-amber-900">
            Things to be aware of ({String(warnings.length)})
          </h3>
          <ul className="space-y-2" data-testid="constraint-warning-list">
            {warnings.map((w) => (
              <li
                key={w.id}
                className="text-xs text-amber-900"
                data-warning-id={w.id}
                data-warning-account-type={w.accountType ?? ''}
              >
                <div className="font-medium">{w.title}</div>
                <div className="mt-0.5 text-amber-900/90">{w.message}</div>
                {w.source !== undefined && w.source.length > 0 ? (
                  <div className="mt-0.5 text-[11px] text-amber-900/70">{w.source}</div>
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
