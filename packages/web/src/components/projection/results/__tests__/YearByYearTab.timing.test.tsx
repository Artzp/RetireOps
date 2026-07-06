import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { YearByYearTab } from '../YearByYearTab';
import { extractProjectionRows, inferBenefitAt65 } from '../year-by-year-helpers';
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

import {
  previewProfileScenarioDecisions,
  runProfileScenario,
  updateDecisions,
} from '@/lib/api/profile-scenarios';
import type { ProfileScenarioDetail } from '@/types/profile-scenario';

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

  it('prefers result_data.assumptions.expectedCPPAt65 over inferring from nominal rows', async () => {
    const user = userEvent.setup();
    render(
      <YearByYearTab
        // The row would infer a high CPP base (39,800 / factor(65)=1 → clamps to
        // 25k), but assumptions carries the authoritative profile value, which
        // must win so the timing default isn't an inflation-inflated estimate.
        data={{
          projectionRows: [makeRow(2035, { age: 65, cppIncome: 39_800 })],
          assumptions: { expectedCPPAt65: 19_880 },
        }}
        scenarioId="scenario-1"
        initialDecisions={{}}
        onScenarioUpdated={vi.fn()}
      />
    );
    await expandTimingPanel(user);
    expect(screen.getByDisplayValue('19880')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('25000')).not.toBeInTheDocument();
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

  /**
   * Audit D-08 — stale-response guard. isTimingSaving/isAssetSaving are
   * independent flags, so a timing save and an asset save can be in flight
   * concurrently; without the shared request-id guard the LAST response to
   * land wins even when it was dispatched first.
   */
  it('ignores a stale timing-save response when a newer save lands after it (audit D-08)', async () => {
    const user = userEvent.setup();
    const onScenarioUpdated = vi.fn();
    vi.mocked(updateDecisions).mockResolvedValue(undefined as never);

    const staleResult = {
      result_data: { projectionRows: [makeRow(2035, { householdNetWorth: 111 })] },
    } as unknown as ProfileScenarioDetail;
    const freshResult = {
      result_data: { projectionRows: [makeRow(2035, { householdNetWorth: 222 })] },
    } as unknown as ProfileScenarioDetail;

    let resolveTimingRun!: (value: ProfileScenarioDetail) => void;
    let resolveAssetRun!: (value: ProfileScenarioDetail) => void;
    vi.mocked(runProfileScenario)
      .mockImplementationOnce(
        () =>
          new Promise<ProfileScenarioDetail>((resolve) => {
            resolveTimingRun = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise<ProfileScenarioDetail>((resolve) => {
            resolveAssetRun = resolve;
          })
      );

    render(
      <YearByYearTab
        data={{ projectionRows: [makeRow(2035, { spouseAge: 64 })] }}
        scenarioId="scenario-1"
        initialDecisions={{ cppStartAge: 65, oasStartAge: 65 }}
        onScenarioUpdated={onScenarioUpdated}
      />
    );

    // 1) Dispatch the timing save (make the draft dirty first via a preset).
    await expandTimingPanel(user);
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Defer both to 70' }));
    });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Apply Timing' }));
    });
    expect(vi.mocked(runProfileScenario)).toHaveBeenCalledTimes(1);

    // 2) While the timing run is in flight, dispatch an asset save (separate
    //    isAssetSaving flag — its button is NOT disabled by isTimingSaving).
    await act(async () => {
      await user.click(screen.getAllByRole('button', { name: /Edit .* assumptions/ })[0]!);
    });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Apply Assets' }));
    });
    expect(vi.mocked(runProfileScenario)).toHaveBeenCalledTimes(2);

    // 3) The STALE timing response lands after the newer save started — it
    //    must be dropped, not applied.
    await act(async () => {
      resolveTimingRun(staleResult);
    });
    expect(onScenarioUpdated).not.toHaveBeenCalled();

    // 4) The newer asset response lands and is the only one applied.
    await act(async () => {
      resolveAssetRun(freshResult);
    });
    expect(onScenarioUpdated).toHaveBeenCalledTimes(1);
    expect(onScenarioUpdated).toHaveBeenCalledWith(freshResult);
  });
});

/**
 * Audit D-05 — extractProjectionRows normalizes legacy cached result_data
 * shapes (yearlyResults/years fallbacks) that predate the required
 * householdTotalTax field, mirroring the transformer/engine definition:
 * householdTotalTax = householdTaxesPaid = primary taxesPaid + spouse
 * taxesPaid (OAS recovery tax tracked separately).
 */
describe('inferBenefitAt65 — clamps inferred CPP base to the schema ceiling', () => {
  // Regression: the "Compare Timing" panel sends the inferred expectedCPPAt65 to
  // POST /preview-decisions, which validates against ScenarioDecisionsSchema
  // (expectedCPPAt65 ≤ $25k). The source rows are nominal, so a CPP that starts
  // far in the future (e.g. a 41-year-old deferring to 70) backs out an inflated
  // base; an >$25k default 400s every preset preview and breaks the whole panel.
  const cppRow = (cppIncome: number, age: number) =>
    ({ cppIncome, age, year: 2055 }) as unknown as ProjectionYearRow;

  it('clamps a nominal-inflated back-out to the $25k schema ceiling', () => {
    // 40k nominal at age 70 / deferral factor 1.42 ≈ 28.2k → would 400 unclamped.
    const result = inferBenefitAt65([cppRow(40_000, 70)], 'cppIncome', 'age', 70, 0);
    expect(result).toBe(25_000);
  });

  it('leaves an in-range CPP estimate untouched', () => {
    const result = inferBenefitAt65([cppRow(12_000, 65)], 'cppIncome', 'age', 65, 0);
    expect(result).toBe(12_000);
  });
});

describe('extractProjectionRows legacy-row normalization (audit D-05)', () => {
  it('derives householdTotalTax for legacy rows missing it', () => {
    const legacyRows = [
      { year: 2030, age: 60, totalTax: 5_000, spouseTotalTax: 2_000 },
      { year: 2031, age: 61, totalTax: 4_000 }, // single-shape: no spouse field
      { year: 2032, age: 62 }, // degenerate legacy row: no tax fields at all
    ];
    const rows = extractProjectionRows({ yearlyResults: legacyRows });

    expect(rows[0]?.householdTotalTax).toBe(7_000);
    expect(rows[1]?.householdTotalTax).toBe(4_000);
    expect(rows[2]?.householdTotalTax).toBe(0);
  });

  it('returns current-shape rows untouched (same reference, no copy)', () => {
    const row = makeRow(2035, { householdTotalTax: 9_999, totalTax: 1, spouseTotalTax: 2 });
    const rows = extractProjectionRows({ projectionRows: [row] });

    expect(rows[0]).toBe(row);
    expect(rows[0]?.householdTotalTax).toBe(9_999);
  });

  it('returns an empty array when no recognized array shape exists', () => {
    expect(extractProjectionRows({})).toEqual([]);
    expect(extractProjectionRows({ projectionRows: 'not-an-array' })).toEqual([]);
  });
});
