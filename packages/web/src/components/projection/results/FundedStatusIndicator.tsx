'use client';

import Link from 'next/link';
import type { FundedStatus, RemediationPlan } from '@retireops/shared';

interface FundedStatusIndicatorProps {
  fundedStatus: FundedStatus;
  remediationPlan: RemediationPlan | null;
}

/**
 * Green / Yellow / Red funded-status banner for the Projections Results page.
 * Renders above the Peak Net Worth hero in SummaryTab.tsx (FUND-09).
 * Phase 48 renders depletion age for Red; remediation suggestions section
 * renders `null` because the Phase 48 stub always returns `remediationPlan: null`.
 * Phase 49 extends the Red branch with three remediation lines.
 *
 * @see .specify/specs/007-funded-indicator/spec.md — FR-002, FR-003, FR-004, FR-005, FR-009
 * @see .specify/specs/007-funded-indicator/data-model.md §New Component
 */
export function FundedStatusIndicator({
  fundedStatus,
  remediationPlan,
}: FundedStatusIndicatorProps) {
  const { state, depletionAge } = fundedStatus;

  // State machine per data-model.md §New Component
  const config = (() => {
    switch (state) {
      case 'green':
        return {
          containerClass: 'rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-emerald-900',
          badgeClass: 'bg-emerald-600 text-white',
          title: 'Funded',
          body: 'Your portfolio is projected to last through retirement with a comfortable surplus.',
        };
      case 'yellow':
        return {
          containerClass: 'rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900',
          badgeClass: 'bg-amber-600 text-white',
          title: 'Near-Funded',
          body: 'Your portfolio lasts through retirement, but with less than 10% buffer. Small changes can improve your position.',
        };
      case 'red':
        return {
          containerClass: 'rounded-lg border border-rose-300 bg-rose-50 p-4 text-rose-900',
          badgeClass: 'bg-rose-600 text-white',
          title: 'Underfunded',
          body:
            depletionAge !== null
              ? `Your portfolio is projected to run out at age ${String(depletionAge)}.`
              : 'Your portfolio is projected to run out before your life expectancy.',
        };
      default: {
        const _exhaustive: never = state;
        throw new Error(`Unhandled FundedState: ${String(_exhaustive)}`);
      }
    }
  })();

  return (
    <section
      aria-label="Funded status"
      data-testid="funded-status-indicator"
      data-funded-state={state}
      className={config.containerClass}
    >
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${config.badgeClass}`}
        >
          {config.title}
        </span>
        <h2 className="text-lg font-semibold">{config.title}</h2>
      </div>
      <p className="mt-2 text-sm">{config.body}</p>

      {state === 'red' && remediationPlan !== null && (
        <ul
          className="mt-3 list-disc list-inside space-y-1 text-sm"
          data-testid="funded-status-remediation"
        >
          <li data-testid="remediation-savings">
            Save an additional ${remediationPlan.additionalAnnualSavings.toLocaleString('en-CA')}
            /year before retirement
            <Link
              href="/profile?step=accounts"
              className="ml-2 font-medium underline underline-offset-2 hover:opacity-80"
            >
              Adjust contributions &rarr;
            </Link>
          </li>
          <li data-testid="remediation-spending">
            Reduce annual retirement spending by $
            {remediationPlan.annualSpendingReduction.toLocaleString('en-CA')}
            <Link
              href="/profile?step=spending"
              className="ml-2 font-medium underline underline-offset-2 hover:opacity-80"
            >
              Adjust spending &rarr;
            </Link>
          </li>
          <li data-testid="remediation-delay">
            Delay retirement by {remediationPlan.retirementDelayYears} year(s)
            {remediationPlan.delayCapReached && (
              <span className="ml-1 text-xs opacity-75">
                (maximum deferral reached — this alone may be insufficient)
              </span>
            )}
            <Link
              href="/profile?step=about_you"
              className="ml-2 font-medium underline underline-offset-2 hover:opacity-80"
            >
              Change retirement age &rarr;
            </Link>
          </li>
        </ul>
      )}
    </section>
  );
}
