/**
 * Unit tests for ScenarioReport — the printable scenario report.
 *
 * @see ../ScenarioReport.tsx
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ScenarioReport, type ScenarioReportData } from '../ScenarioReport';

const FIXED_DATE = new Date('2026-05-05T12:00:00.000Z');
const SCENARIO_NAME = 'Tax-Efficient Retirement';

const FULL_DATA: ScenarioReportData = {
  summary: {
    peakNetWorth: 1_250_000,
    peakNetWorthYear: 2055,
    portfolioLongevity: 30,
    portfolioLongevityAge: null,
    moneyLastsToLifeExpectancy: true,
    totalTaxesPaid: 320_000,
    averageRetirementIncome: 75_000,
    averageEffectiveTaxRate: 0.18,
    startYear: 2026,
    endYear: 2080,
    retirementYear: 2040,
    yearsInRetirement: 30,
    lowestNetWorth: 800_000,
    fundedStatus: {
      state: 'green',
      depletionAge: null,
      balanceAtLifeExpectancy: 250_000,
      totalRetirementWithdrawals: 1_500_000,
    },
    remediationPlan: null,
    ledgerWarnings: [],
  },
  assumptions: {
    inflationRate: 0.025,
    investmentReturn: 0.06,
    province: 'ON',
    retirementAge: 65,
    lifeExpectancy: 92,
    cppStartAge: 70,
    oasStartAge: 65,
    yearsOfResidence: 40,
    expectedCPPAt65: 14400,
    taxYear: 2026,
    federalTaxTableYear: 2026,
  },
  projectionRows: [
    {
      year: 2026,
      age: 50,
      totalGrossIncome: 100_000,
      totalTax: 22_000,
      livingExpenses: 60_000,
      totalNetWorth: 500_000,
    },
    {
      year: 2027,
      age: 51,
      totalGrossIncome: 105_000,
      totalTax: 23_500,
      livingExpenses: 62_000,
      totalNetWorth: 540_000,
    },
  ],
};

describe('ScenarioReport', () => {
  it('renders the title, scenario name, and generated date', () => {
    render(
      <ScenarioReport
        scenarioName={SCENARIO_NAME}
        generatedAt={FIXED_DATE}
        resultData={FULL_DATA}
      />
    );
    expect(screen.getByText('Scenario Report')).toBeDefined();
    expect(screen.getByText(SCENARIO_NAME)).toBeDefined();
    // en-CA "long" month formatting; date appears in header AND footer
    expect(screen.getAllByText(/Generated May 5, 2026/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders the disclaimer text at the top and footer', () => {
    render(
      <ScenarioReport
        scenarioName={SCENARIO_NAME}
        generatedAt={FIXED_DATE}
        resultData={FULL_DATA}
      />
    );
    const disclaimers = screen.getAllByText(/educational planning only/);
    expect(disclaimers.length).toBeGreaterThanOrEqual(2);
  });

  it('maps funded-status state to a plain-English label (green)', () => {
    render(
      <ScenarioReport
        scenarioName={SCENARIO_NAME}
        generatedAt={FIXED_DATE}
        resultData={FULL_DATA}
      />
    );
    expect(screen.getAllByText(/On track/).length).toBeGreaterThan(0);
  });

  it('maps yellow funded-status to "Marginal"', () => {
    const yellow: ScenarioReportData = {
      ...FULL_DATA,
      summary: {
        ...FULL_DATA.summary,
        fundedStatus: { ...FULL_DATA.summary!.fundedStatus!, state: 'yellow' },
      },
    };
    render(
      <ScenarioReport scenarioName={SCENARIO_NAME} generatedAt={FIXED_DATE} resultData={yellow} />
    );
    expect(screen.getAllByText(/Marginal/).length).toBeGreaterThan(0);
  });

  it('maps red funded-status to "Underfunded" and renders remediation suggestions', () => {
    const red: ScenarioReportData = {
      ...FULL_DATA,
      summary: {
        ...FULL_DATA.summary,
        moneyLastsToLifeExpectancy: false,
        portfolioLongevityAge: 84,
        fundedStatus: {
          state: 'red',
          depletionAge: 84,
          balanceAtLifeExpectancy: 0,
          totalRetirementWithdrawals: 1_000_000,
        },
        remediationPlan: {
          additionalAnnualSavings: 12_000,
          annualSpendingReduction: 8_000,
          retirementDelayYears: 2,
          delayCapReached: false,
        },
      },
    };
    render(
      <ScenarioReport scenarioName={SCENARIO_NAME} generatedAt={FIXED_DATE} resultData={red} />
    );
    expect(screen.getAllByText(/Underfunded/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Increase pre-retirement savings by/)).toBeDefined();
    expect(screen.getByText(/Reduce annual retirement spending/)).toBeDefined();
    expect(screen.getByText(/Delay retirement by 2 years/)).toBeDefined();
  });

  it('renders one row per projectionRow in the year-by-year table', () => {
    const { container } = render(
      <ScenarioReport
        scenarioName={SCENARIO_NAME}
        generatedAt={FIXED_DATE}
        resultData={FULL_DATA}
      />
    );
    const tbody = container.querySelector('tbody');
    expect(tbody).not.toBeNull();
    const rows = within(tbody as HTMLElement).getAllByRole('row');
    expect(rows.length).toBe(2);
    // Scope text queries to tbody so we don't match Tax-year 2026 elsewhere on the page
    expect(within(tbody as HTMLElement).getByText('2026')).toBeDefined();
    expect(within(tbody as HTMLElement).getByText('2027')).toBeDefined();
  });

  it('hides the warnings section when no warnings are present', () => {
    render(
      <ScenarioReport
        scenarioName={SCENARIO_NAME}
        generatedAt={FIXED_DATE}
        resultData={FULL_DATA}
      />
    );
    expect(screen.queryByText('Warnings and limitations')).toBeNull();
  });

  it('renders the warnings section when ledgerWarnings are present', () => {
    const withWarnings: ScenarioReportData = {
      ...FULL_DATA,
      summary: {
        ...FULL_DATA.summary,
        ledgerWarnings: [
          {
            year: 2030,
            person: 'primary',
            accountType: 'rrsp',
            kind: 'over-contribution',
            message: 'RRSP over-contribution detected',
            penaltyAmount: 50,
          },
        ],
      },
    };
    render(
      <ScenarioReport
        scenarioName={SCENARIO_NAME}
        generatedAt={FIXED_DATE}
        resultData={withWarnings}
      />
    );
    expect(screen.getByText('Warnings and limitations')).toBeDefined();
    // The warning line maps internal codes to plain English: "You", "RRSP", "over-contribution penalty"
    expect(
      screen.getByText(
        /2030 — You RRSP: RRSP over-contribution detected \(over-contribution penalty\)/
      )
    ).toBeDefined();
    expect(screen.getByText(/Estimated CRA penalty: \$50\/month/)).toBeDefined();
  });

  it('does not crash when resultData is null and still renders title and disclaimer', () => {
    render(
      <ScenarioReport scenarioName={SCENARIO_NAME} generatedAt={FIXED_DATE} resultData={null} />
    );
    expect(screen.getByText('Scenario Report')).toBeDefined();
    expect(screen.getAllByText(/educational planning only/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/No projection results are available yet\./)).toBeDefined();
  });

  it('omits internal field-name codes from the rendered text (field-name hygiene)', () => {
    const withWarnings: ScenarioReportData = {
      ...FULL_DATA,
      summary: {
        ...FULL_DATA.summary,
        ledgerWarnings: [
          {
            year: 2030,
            person: 'spouse',
            accountType: 'tfsa',
            kind: 'over-contribution',
            message: 'TFSA over-contribution detected',
            penaltyAmount: 0,
          },
        ],
      },
    };
    const { container } = render(
      <ScenarioReport
        scenarioName={SCENARIO_NAME}
        generatedAt={FIXED_DATE}
        resultData={withWarnings}
      />
    );
    const text = container.textContent ?? '';
    // Lowercase internal IDs should not leak verbatim
    expect(text).not.toMatch(/\baccountType\b/);
    expect(text).not.toMatch(/\bfundedStatus\b/);
    expect(text).not.toMatch(/\binflationRate\b/);
    // The funded-state code 'green' must not appear standalone (as in the JSON state field).
    // Tax assumption text uses "tax tables: Federal 2026" — no 'green' substring.
    expect(text).not.toMatch(/state: ['"]?green/);
    // Plain-English replacements DID render
    expect(text).toContain('TFSA');
    expect(text).toContain('Spouse');
  });
});
