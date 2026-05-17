/**
 * OverrideSummary — banner that lists active withdrawal overrides in
 * plain English above the Year-by-Year table (Phase 30 Plan 02).
 *
 * Reads `decisions.withdrawalOverrides` (Zod-inferred type from
 * `@retireops/shared/types`) and renders one row per override using the
 * locked copy patterns from 30-CONTEXT.md:
 *
 *   one-year:  "{year}: Take {amount} from {account}"
 *   range:     "{startYear}-{endYear}: Take {amount}/yr from {account}"
 *   permanent: "From {year}: Take {amount}/yr from {account}"
 *
 * "Range vs permanent" detection rule (locked):
 *   - If `applyForward === true`:
 *       * If the user has another override on the SAME (owner, field) with a
 *         strictly greater year → that next year - 1 is the implicit end of
 *         this window → render as range.
 *       * Else → render as permanent.
 *   - If `applyForward === false` → render as one-year.
 *
 * Behaviour:
 *  - Empty overrides array (or undefined) → renders `null`.
 *  - Single-owner overrides: omit owner prefix.
 *  - Mixed primary + spouse overrides: prefix each item with the owner
 *    ("Main: …", "Spouse: …") so users can tell who the override applies to.
 *
 * Accessibility: the container is a `role="region"` with
 * `aria-label="Active withdrawal overrides"` so screen readers announce it as
 * a named landmark when navigating into the results page.
 *
 * @see packages/shared/src/types/scenario.ts (WithdrawalOverride shape)
 * @see .planning/phases/30-explainability-adapter-override-summary/30-CONTEXT.md
 * @see .planning/phases/30-explainability-adapter-override-summary/30-02-PLAN.md
 */
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import type { ScenarioDecisions } from '@retireops/shared/types';

type WithdrawalOverride = NonNullable<ScenarioDecisions['withdrawalOverrides']>[number];

/** Display label per override `field` literal (canonical lowercase). */
const ACCOUNT_LABEL: Record<WithdrawalOverride['field'], string> = {
  rrsp: 'RRSP',
  rrif: 'RRIF',
  lif: 'LIF',
  tfsa: 'TFSA',
  nonreg: 'Non-Registered',
};

export interface OverrideSummaryProps {
  overrides: ScenarioDecisions['withdrawalOverrides'];
}

/**
 * Per-item descriptor produced by the formatter. Exported for unit tests
 * (assert on `kind` + `text`) without forcing the test to dig into the DOM.
 */
export interface OverrideSummaryItem {
  /** Stable key for React + tests. `${owner}:${field}:${year}` matches the Zod uniqueness key. */
  key: string;
  /** Which display branch was selected. */
  kind: 'one-year' | 'range' | 'permanent';
  /** Owner — only displayed when the list contains both primary and spouse rows. */
  owner: 'primary' | 'spouse';
  /** Pre-formatted display string per 30-CONTEXT.md copy patterns. */
  text: string;
}

/**
 * Pure formatter — exported for tests.
 *
 * Sorts overrides by `(owner, field, year)` ascending so the implicit
 * apply-forward window end-year detection has deterministic neighbours.
 */
export function summarizeOverrides(
  overrides: ScenarioDecisions['withdrawalOverrides']
): OverrideSummaryItem[] {
  if (overrides === undefined || overrides.length === 0) return [];

  // Group by (owner ?? 'primary', field), sort each group by year ascending.
  // Zod schema defaults `owner` to 'primary', but `z.input` typing keeps it
  // optional — fall back here to match the engine contract.
  const byGroup = new Map<string, WithdrawalOverride[]>();
  for (const o of overrides) {
    const owner = o.owner ?? 'primary';
    const key = `${owner}:${o.field}`;
    const list = byGroup.get(key) ?? [];
    list.push(o);
    byGroup.set(key, list);
  }
  for (const list of byGroup.values()) {
    list.sort((a, b) => a.year - b.year);
  }

  const items: OverrideSummaryItem[] = [];
  for (const [groupKey, list] of byGroup) {
    for (let i = 0; i < list.length; i++) {
      const cur = list[i];
      if (cur === undefined) continue;
      const owner = cur.owner ?? 'primary';
      const accountLabel = ACCOUNT_LABEL[cur.field];
      const amount = formatCurrency(cur.amount);

      let kind: OverrideSummaryItem['kind'];
      let text: string;

      if (!cur.applyForward) {
        kind = 'one-year';
        text = `${String(cur.year)}: Take ${amount} from ${accountLabel}`;
      } else {
        // applyForward = true. If a later sibling exists in this (owner, field)
        // group, that defines the implicit end of THIS override's window.
        const next = list[i + 1];
        if (next !== undefined && next.year > cur.year) {
          const endYear = next.year - 1;
          if (endYear === cur.year) {
            // Same calendar year as the next override — effectively a one-year
            // override despite applyForward. Render with the range copy collapsed.
            kind = 'range';
            text = `${String(cur.year)}-${String(endYear)}: Take ${amount}/yr from ${accountLabel}`;
          } else {
            kind = 'range';
            text = `${String(cur.year)}-${String(endYear)}: Take ${amount}/yr from ${accountLabel}`;
          }
        } else {
          kind = 'permanent';
          text = `From ${String(cur.year)}: Take ${amount}/yr from ${accountLabel}`;
        }
      }

      items.push({
        key: `${groupKey}:${String(cur.year)}`,
        kind,
        owner,
        text,
      });
    }
  }

  return items;
}

export default function OverrideSummary({ overrides }: OverrideSummaryProps): JSX.Element | null {
  const items = summarizeOverrides(overrides);
  if (items.length === 0) return null;

  // Whether to prefix owner labels — only when the list mixes primary + spouse.
  const hasPrimary = items.some((i) => i.owner === 'primary');
  const hasSpouse = items.some((i) => i.owner === 'spouse');
  const showOwnerPrefix = hasPrimary && hasSpouse;

  const ownerLabel = (owner: OverrideSummaryItem['owner']): string =>
    owner === 'spouse' ? 'Spouse' : 'Main';

  return (
    <div
      role="region"
      aria-label="Active withdrawal overrides"
      data-testid="override-summary"
      className="mb-4"
    >
      <Card className="border-purple-200 bg-purple-50">
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-purple-900">
            Active withdrawal overrides ({String(items.length)})
          </h3>
          <ul className="space-y-1 text-xs text-purple-900" data-testid="override-summary-list">
            {items.map((item) => (
              <li key={item.key} data-override-kind={item.kind} data-override-owner={item.owner}>
                {showOwnerPrefix ? (
                  <span className="font-semibold">{ownerLabel(item.owner)}: </span>
                ) : null}
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
