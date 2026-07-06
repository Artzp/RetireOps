/**
 * SummaryTab lifetime-aggregate tests (audit D-02).
 *
 * The projection transformer now surfaces totalPensionSplitSavings and
 * totalBracketFillWithdrawals server-side on the summary. SummaryTab must
 * prefer those fields and fall back to a client-side row reduce ONLY for
 * cached result_data that predates them.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ProjectionYearRow } from '@retireops/shared/types';
import { SummaryTab } from '../SummaryTab';

type SummaryTabData = Parameters<typeof SummaryTab>[0]['data'];

function makeRow(partial: Partial<ProjectionYearRow>): ProjectionYearRow {
  return partial as ProjectionYearRow;
}

function makeCoupleData(overrides: {
  summaryExtras?: Partial<SummaryTabData['summary']>;
  projectionRows?: ProjectionYearRow[];
}): SummaryTabData {
  return {
    summary: {
      peakNetWorth: 900_000,
      portfolioLongevity: 90,
      totalTaxesPaid: 250_000,
      averageRetirementIncome: 60_000,
      probabilityOfSuccess: 100,
      isCouple: true,
      ...overrides.summaryExtras,
    },
    yearlyResults: [{ year: 2035, age: 65, totalNetWorth: 900_000 }],
    projectionRows: overrides.projectionRows,
  };
}

describe('SummaryTab lifetime aggregates (audit D-02)', () => {
  const rows = [
    makeRow({
      year: 2035,
      pensionSplitPercentage: 0.3,
      pensionSplitTaxSavings: 1_000,
      bracketFillWithdrawal: 4_000,
      spouseBracketFillWithdrawal: 1_500,
    }),
    makeRow({
      year: 2036,
      pensionSplitPercentage: 0.25,
      pensionSplitTaxSavings: 2_000,
      bracketFillWithdrawal: 2_500,
    }),
  ];

  it('prefers the server-side summary aggregates over the client-side row sums', () => {
    render(
      <SummaryTab
        data={makeCoupleData({
          // Server values deliberately differ from the row sums (rows: 3,000 /
          // 8,000) so the assertion proves the summary fields win.
          summaryExtras: {
            totalPensionSplitSavings: 12_345,
            totalBracketFillWithdrawals: 67_890,
          },
          projectionRows: rows,
        })}
        displayMode="nominal"
      />
    );

    expect(screen.getAllByText('$12,345').length).toBeGreaterThan(0);
    expect(screen.getByText('$67,890')).toBeInTheDocument();
    expect(screen.queryByText('$3,000')).not.toBeInTheDocument();
    expect(screen.queryByText('$8,000')).not.toBeInTheDocument();
  });

  it('falls back to the client-side row sums for legacy cached result_data without the fields', () => {
    render(
      <SummaryTab
        data={makeCoupleData({
          summaryExtras: {},
          projectionRows: rows,
        })}
        displayMode="nominal"
      />
    );

    // Pension-split banner: 1,000 + 2,000 across split years.
    expect(screen.getAllByText('$3,000').length).toBeGreaterThan(0);
    // Bracket-fill line: 4,000 + 1,500 + 2,500.
    expect(screen.getByText('$8,000')).toBeInTheDocument();
  });

  it('hides the optional aggregate sections when server aggregates are zero', () => {
    render(
      <SummaryTab
        data={makeCoupleData({
          summaryExtras: {
            totalPensionSplitSavings: 0,
            totalBracketFillWithdrawals: 0,
          },
          projectionRows: rows,
        })}
        displayMode="nominal"
      />
    );

    expect(screen.queryByText('Pension Income Splitting Savings')).not.toBeInTheDocument();
    expect(screen.queryByText(/Lifetime bracket-fill withdrawals/)).not.toBeInTheDocument();
  });
});

describe('SummaryTab recommendations are computed, not blanket claims', () => {
  // The card used to show unconditional "Your CPP deferral strategy is optimized"
  // and "TFSA withdrawals are being used tax-efficiently" to EVERY user — even an
  // underfunded plan. These must never appear (claims without a computed basis).
  const OLD_CLAIMS = [
    /deferral strategy is optimized/i,
    /used tax-efficiently/i,
    /coordinated for optimal tax efficiency/i,
  ];

  it('underfunded plan: shows the computed shortfall line and none of the old blanket claims', () => {
    render(
      <SummaryTab
        data={makeCoupleData({
          summaryExtras: { probabilityOfSuccess: 35, moneyLastsToLifeExpectancy: false },
        })}
        displayMode="nominal"
      />
    );
    expect(screen.getByText(/run out before life expectancy/i)).toBeInTheDocument();
    for (const claim of OLD_CLAIMS) expect(screen.queryByText(claim)).not.toBeInTheDocument();
  });

  it('funded plan: shows the computed on-track line, still no blanket claims', () => {
    render(
      <SummaryTab
        data={makeCoupleData({
          summaryExtras: { probabilityOfSuccess: 100, moneyLastsToLifeExpectancy: true },
        })}
        displayMode="nominal"
      />
    );
    expect(screen.getByText(/stays funded through your planning horizon/i)).toBeInTheDocument();
    for (const claim of OLD_CLAIMS) expect(screen.queryByText(claim)).not.toBeInTheDocument();
  });

  it('surfaces an OAS clawback recommendation only when the projection has clawback years', () => {
    render(
      <SummaryTab
        data={makeCoupleData({
          summaryExtras: { probabilityOfSuccess: 100, moneyLastsToLifeExpectancy: true },
          projectionRows: [
            makeRow({ year: 2035, oasClawback: 1_200 }),
            makeRow({ year: 2036, oasClawback: 800 }),
          ],
        })}
        displayMode="nominal"
      />
    );
    expect(screen.getByText(/triggers OAS clawback/i)).toBeInTheDocument();
  });
});
