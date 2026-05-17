import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { YearByYearTab } from '../YearByYearTab';
import type { ProjectionYearRow, ScenarioDecisions } from '@retireops/shared';

vi.mock('@/hooks/useOverrideEditor', () => ({
  useOverrideEditor: vi.fn(() => ({
    openCell: null,
    openPopover: vi.fn(),
    setOpenCell: vi.fn(),
    closePopover: vi.fn(),
    savePopover: vi.fn().mockResolvedValue(undefined),
    getActiveWithdrawalOverride: vi.fn().mockReturnValue(undefined),
    getActiveSpendingOverride: vi.fn().mockReturnValue(undefined),
    isRecomputing: false,
    decisions: {},
    removeOverride: vi.fn().mockResolvedValue(undefined),
    isRemoving: false,
  })),
  isEditableField: (f: string) => ['rrsp', 'rrif', 'lif', 'tfsa', 'nonreg', 'spending'].includes(f),
}));

vi.mock('@/lib/api/profile-scenarios', () => ({
  updateDecisions: vi.fn(),
  runProfileScenario: vi.fn(),
  previewProfileScenarioDecisions: vi.fn(),
}));

import { previewProfileScenarioDecisions } from '@/lib/api/profile-scenarios';

function makeRow(year: number, overrides: Partial<ProjectionYearRow> = {}): ProjectionYearRow {
  return {
    year,
    age: 65 + (year - 2035),
    employmentIncome: 0,
    pensionIncome: 0,
    cppIncome: 0,
    oasIncome: 0,
    rrifWithdrawal: 0,
    tfsaWithdrawal: 0,
    nonRegWithdrawal: 0,
    totalGrossIncome: 0,
    federalTax: 0,
    provincialTax: 0,
    oasClawback: 0,
    totalTax: 0,
    effectiveTaxRate: 0,
    livingExpenses: 50_000,
    netCashFlow: 0,
    householdNetCashFlow: 0,
    rrspBalance: 0,
    rrifBalance: 0,
    tfsaBalance: 0,
    nonRegBalance: 0,
    totalNetWorth: 0,
    householdNetWorth: 0,
    ...overrides,
  } as ProjectionYearRow;
}

function renderEditableTab(rows: ProjectionYearRow[], decisions: ScenarioDecisions = {}) {
  return render(
    <YearByYearTab
      data={{ projectionRows: rows }}
      scenarioId="scenario-1"
      initialDecisions={decisions}
      onScenarioUpdated={vi.fn()}
    />
  );
}

/**
 * The "Government pension timing" panel is collapsed by default. Tests that
 * interact with anything inside it (presets, age selects, outcome summary,
 * compare button) must expand it first.
 */
async function expandTimingPanel(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await act(async () => {
    await user.click(screen.getByRole('button', { name: /Government pension timing/ }));
  });
}

describe('YearByYearTab government pension timing support', () => {
  it('preset buttons update primary and spouse draft select values for couple scenarios', async () => {
    const user = userEvent.setup();
    renderEditableTab([makeRow(2035, { spouseAge: 64, spouseCppIncome: 0, spouseOasIncome: 0 })], {
      cppStartAge: 60,
      oasStartAge: 65,
      lifeExpectancy: 95,
      spouseCppStartAge: 60,
      spouseOasStartAge: 65,
      spouseLifeExpectancy: 97,
    });

    await expandTimingPanel(user);

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Defer both to 70' }));
    });

    expect(screen.getByRole('combobox', { name: 'CPP age' })).toHaveTextContent('Age 70');
    expect(screen.getByRole('combobox', { name: 'OAS age' })).toHaveTextContent('Age 70');
    expect(screen.getByRole('combobox', { name: 'Life expectancy age' })).toHaveTextContent(
      'Age 95'
    );
    expect(screen.getByRole('combobox', { name: 'Spouse CPP age' })).toHaveTextContent('Age 70');
    expect(screen.getByRole('combobox', { name: 'Spouse OAS age' })).toHaveTextContent('Age 70');
    expect(screen.getByRole('combobox', { name: 'Spouse life age' })).toHaveTextContent('Age 97');
  });

  it('outcome summary calculates lifetime and depletion values from projection rows', async () => {
    const user = userEvent.setup();
    renderEditableTab([
      makeRow(2035, {
        age: 65,
        spouseAge: 64,
        cppIncome: 10_000,
        oasIncome: 7_000,
        spouseCppIncome: 5_000,
        spouseOasIncome: 3_000,
        oasClawback: 500,
        spouseOasClawback: 250,
        householdTotalTax: 3_000,
        householdNetWorth: 100_000,
      }),
      makeRow(2036, {
        age: 66,
        spouseAge: 65,
        cppIncome: 11_000,
        oasIncome: 7_500,
        spouseCppIncome: 5_500,
        spouseOasIncome: 3_500,
        oasClawback: 600,
        spouseOasClawback: 300,
        householdTotalTax: 4_000,
        householdNetWorth: 0,
      }),
    ]);

    await expandTimingPanel(user);

    const summary = screen.getByLabelText('Government pension timing outcome summary');

    expect(within(summary).getAllByText('$0').length).toBeGreaterThan(0);
    expect(within(summary).getByText('Age 66 / 2036')).toBeInTheDocument();
    expect(within(summary).getByText('$31,500')).toBeInTheDocument();
    expect(within(summary).getByText('$21,000')).toBeInTheDocument();
    expect(within(summary).getByText('$1,650')).toBeInTheDocument();
    expect(within(summary).getByText('Depletes')).toBeInTheDocument();
  });

  it('compares timing presets and renders ranked preview rows', async () => {
    const user = userEvent.setup();
    const previewMock = vi.mocked(previewProfileScenarioDecisions);
    previewMock.mockImplementation(async (_scenarioId, patch) => {
      const cppStartAge = patch.cppStartAge as number;
      const oasStartAge = patch.oasStartAge as number;
      const finalNetWorth = cppStartAge === 70 && oasStartAge === 70 ? 300_000 : 200_000;
      return {
        decisions: patch,
        result_data: {
          projectionRows: [
            makeRow(2035, {
              age: 65,
              cppIncome: cppStartAge === 60 ? 12_000 : 0,
              oasIncome: oasStartAge === 65 ? 8_000 : 0,
              householdTotalTax: 4_000,
              householdNetWorth: 500_000,
            }),
            makeRow(2036, {
              age: 66,
              cppIncome: 12_500,
              oasIncome: 8_200,
              oasClawback: 100,
              householdTotalTax: 4_200,
              householdNetWorth: finalNetWorth,
            }),
          ],
        },
      };
    });

    renderEditableTab([makeRow(2035, { householdNetWorth: 100_000 })], {
      cppStartAge: 65,
      oasStartAge: 65,
    });

    await expandTimingPanel(user);

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Compare Timing' }));
    });

    const comparison = await screen.findByRole('table', { name: 'Pension timing comparison' });
    const rows = within(comparison).getAllByRole('row');

    expect(previewMock).toHaveBeenCalledTimes(5);
    expect(within(rows[1]).getByText('Defer both to 70')).toBeInTheDocument();
    expect(within(rows[1]).getByText('1')).toBeInTheDocument();
    expect(within(comparison).getAllByText('$300,000').length).toBeGreaterThan(0);
    expect(within(comparison).getAllByRole('button', { name: 'Apply' })).toHaveLength(5);
  });
});
