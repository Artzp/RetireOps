'use client';

import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { formatBreakeven, type TimingComparisonRow } from './year-by-year-helpers';

interface TimingComparisonTableProps {
  comparisons: TimingComparisonRow[];
  isTimingSaving: boolean;
  isComparingTiming: boolean;
  onApply: (row: TimingComparisonRow) => void;
}

/**
 * Pension-timing comparison results table — ranks the compared presets and lets
 * the user Apply one. Extracted from YearByYearTab; renders nothing until a
 * comparison has been run. Purely presentational (props in, table out).
 */
export function TimingComparisonTable({
  comparisons,
  isTimingSaving,
  isComparingTiming,
  onApply,
}: TimingComparisonTableProps) {
  if (comparisons.length === 0) return null;

  return (
    <div className="overflow-x-auto border-t border-ds-outline-variant pt-3">
      <table
        className="w-full min-w-[940px] border-separate border-spacing-0 text-xs"
        aria-label="Pension timing comparison"
      >
        <thead className="text-left text-ds-on-surface-variant">
          <tr>
            <th className="px-2 py-1 font-medium">Rank</th>
            <th className="px-2 py-1 font-medium">Preset</th>
            <th className="px-2 py-1 text-right font-medium">Lifetime income</th>
            <th className="px-2 py-1 text-right font-medium">Final estate / NW</th>
            <th className="px-2 py-1 font-medium">Depletion</th>
            <th className="px-2 py-1 text-right font-medium">CPP + OAS</th>
            <th className="px-2 py-1 text-right font-medium">Clawback</th>
            <th className="px-2 py-1 text-right font-medium">Breakeven</th>
            <th className="px-2 py-1 font-medium">Funded</th>
            <th className="px-2 py-1 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {comparisons.map((row) => (
            <tr
              key={row.id}
              className={
                row.isBest
                  ? 'bg-ds-primary-container text-ds-on-primary-container'
                  : 'text-ds-on-surface'
              }
            >
              <td className="border-t border-ds-outline-variant/60 px-2 py-2 font-medium">
                {row.rank}
              </td>
              <td className="border-t border-ds-outline-variant/60 px-2 py-2">
                <span className="font-medium">{row.label}</span>
                <span className="ml-1 text-ds-on-surface-variant">
                  CPP {row.cppStartAge} / OAS {row.oasStartAge}
                </span>
              </td>
              <td className="border-t border-ds-outline-variant/60 px-2 py-2 text-right tabular-nums">
                {formatCurrency(row.lifetimeIncome)}
              </td>
              <td className="border-t border-ds-outline-variant/60 px-2 py-2 text-right tabular-nums">
                {formatCurrency(row.finalEstateOrNetWorth)}
              </td>
              <td className="border-t border-ds-outline-variant/60 px-2 py-2 tabular-nums">
                {row.depletion !== undefined
                  ? `Age ${String(row.depletion.age)} / ${String(row.depletion.year)}`
                  : 'Not projected'}
              </td>
              <td className="border-t border-ds-outline-variant/60 px-2 py-2 text-right tabular-nums">
                {formatCurrency(row.lifetimeCpp + row.lifetimeOas)}
              </td>
              <td className="border-t border-ds-outline-variant/60 px-2 py-2 text-right tabular-nums">
                {formatCurrency(row.lifetimeOasClawback)}
              </td>
              <td className="border-t border-ds-outline-variant/60 px-2 py-2 text-right tabular-nums">
                CPP {formatBreakeven(row.cppBreakevenAge)} / OAS{' '}
                {formatBreakeven(row.oasBreakevenAge)}
              </td>
              <td className="border-t border-ds-outline-variant/60 px-2 py-2">
                {row.fundedStatus}
              </td>
              <td className="border-t border-ds-outline-variant/60 px-2 py-2 text-right">
                <Button
                  type="button"
                  size="sm"
                  variant={row.isBest ? 'default' : 'outline'}
                  disabled={isTimingSaving || isComparingTiming}
                  onClick={() => onApply(row)}
                  className="h-7 rounded-sm px-2 text-xs"
                >
                  Apply
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
