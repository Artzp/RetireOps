'use client';

/**
 * EstateTab — M005 Phase 2
 *
 * Renders terminal-return (deemed-disposition) estate metrics for a scenario:
 * three KPI tiles (gross estate, terminal tax, net estate) plus a per-event
 * table listing each decedent's terminal-year tax event.
 *
 * Only shown when the backend includes terminalTaxEvents in result_data —
 * shorter projections that never reach a decedent's life-expectancy year
 * render a friendly empty-state explaining why.
 */

import type { TerminalReturnResult } from '@retireops/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { Scale, CheckCircle2 } from 'lucide-react';

interface EstateSummary {
  grossEstate?: number;
  terminalTaxes?: number;
  netEstate?: number;
}

interface EstateTabProps {
  summary: EstateSummary;
  terminalTaxEvents?: TerminalReturnResult[];
}

const OWNER_LABEL: Record<TerminalReturnResult['triggeringOwner'], string> = {
  primary: 'Primary',
  spouse: 'Spouse',
};

export function EstateTab({ summary, terminalTaxEvents }: EstateTabProps) {
  const hasEvents = Array.isArray(terminalTaxEvents) && terminalTaxEvents.length > 0;

  if (!hasEvents) {
    return (
      <div className="bg-ds-surface rounded-card py-12 px-6 text-center">
        <Scale className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
        <h3 className="font-semibold text-ds-on-background mb-2">No terminal-return events yet</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          This projection doesn&apos;t reach a life-expectancy year for either person, so there is
          no deemed-disposition tax to show. The estate tab appears once the projection runs to a
          decedent&apos;s terminal year.
        </p>
      </div>
    );
  }

  const gross = summary.grossEstate ?? 0;
  const tax = summary.terminalTaxes ?? 0;
  const net = summary.netEstate ?? gross - tax;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-ds-surface rounded-card border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gross Estate
            </CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-ds-on-background">{formatCurrency(gross)}</div>
            <p className="text-xs text-muted-foreground">
              Combined registered + non-registered + TFSA at terminal year
            </p>
          </CardContent>
        </Card>

        <Card className="bg-ds-surface rounded-card border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Terminal-Return Tax
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-ds-error">{formatCurrency(tax)}</div>
            <p className="text-xs text-muted-foreground">
              Deemed-disposition tax across all terminal events
            </p>
          </CardContent>
        </Card>

        <Card className="bg-ds-surface rounded-card border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Estate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-ds-on-background">{formatCurrency(net)}</div>
            <p className="text-xs text-muted-foreground">Passes to heirs after terminal tax</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-ds-surface rounded-card border-0">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-ds-on-background">
            Terminal-return events
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ds-outline-variant text-left text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="py-2 pr-4 font-medium">Year</th>
                  <th className="py-2 pr-4 font-medium">Decedent</th>
                  <th className="py-2 pr-4 font-medium text-right">Gross Estate</th>
                  <th className="py-2 pr-4 font-medium text-right">Deemed Disp. Income</th>
                  <th className="py-2 pr-4 font-medium text-right">Realized Cap. Gain</th>
                  <th className="py-2 pr-4 font-medium text-right">Taxable Cap. Gain</th>
                  <th className="py-2 pr-4 font-medium text-right">Terminal Tax</th>
                  <th className="py-2 pr-0 font-medium text-right">Net Estate</th>
                </tr>
              </thead>
              <tbody>
                {terminalTaxEvents!.map((event, idx) => (
                  <tr
                    key={`${event.triggeringOwner}-${event.year}-${idx}`}
                    className="border-b border-ds-outline-variant last:border-0"
                  >
                    <td className="py-2 pr-4 tabular-nums">{event.year}</td>
                    <td className="py-2 pr-4">
                      {OWNER_LABEL[event.triggeringOwner]}
                      {event.wasSpouseRolloverApplied && (
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-ds-primary/10 text-ds-primary">
                          Spousal rollover
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {formatCurrency(event.grossEstate)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {formatCurrency(event.deemedDispositionIncome)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {formatCurrency(event.realizedCapitalGain)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {formatCurrency(event.taxableCapitalGain)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-ds-error">
                      {formatCurrency(event.terminalTaxes)}
                    </td>
                    <td className="py-2 pr-0 text-right tabular-nums">
                      {formatCurrency(event.netEstate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Spousal rollover events defer tax to the surviving spouse&apos;s terminal year. See
            <code className="mx-1">docs/source-of-truth/04-tax-engine.md</code> for full
            deemed-disposition rules.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
