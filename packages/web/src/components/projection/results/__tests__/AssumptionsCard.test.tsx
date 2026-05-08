/**
 * Unit tests for AssumptionsCard — Summary tab "Assumptions Used" panel.
 *
 * @see ../AssumptionsCard.tsx
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssumptionsCard, type AssumptionsCardData } from '../AssumptionsCard';

// Use unique integers across fields so getByText calls are unambiguous.
const FULL: AssumptionsCardData = {
  inflationRate: 0.025,
  investmentReturn: 0.06,
  province: 'ON',
  retirementAge: 65,
  lifeExpectancy: 92,
  cppStartAge: 70,
  oasStartAge: 67,
  yearsOfResidence: 38,
  expectedCPPAt65: 14400,
  taxYear: 2026,
  federalTaxTableYear: 2024,
  monteCarlo: {
    expectedReturn: 0.065,
    volatility: 0.11,
    numSimulations: 1000,
  },
};

describe('AssumptionsCard', () => {
  it('renders the title and explanatory sentence', () => {
    render(<AssumptionsCard assumptions={FULL} displayMode="nominal" />);
    expect(screen.getByText('Assumptions Used')).toBeDefined();
    expect(
      screen.getByText(
        'These assumptions drive the projection. Changing them can materially change the result.'
      )
    ).toBeDefined();
  });

  it('renders all rows with correctly formatted values when assumptions are fully populated', () => {
    render(<AssumptionsCard assumptions={FULL} displayMode="nominal" />);

    // Province (raw string)
    expect(screen.getByText('Province')).toBeDefined();
    expect(screen.getByText('ON')).toBeDefined();

    // Ages
    expect(screen.getByText('Retirement age')).toBeDefined();
    expect(screen.getByText('Age 65')).toBeDefined();
    expect(screen.getByText('Life expectancy')).toBeDefined();
    expect(screen.getByText('Age 92')).toBeDefined();
    expect(screen.getByText('CPP start age')).toBeDefined();
    expect(screen.getByText('Age 70')).toBeDefined();
    expect(screen.getByText('OAS start age')).toBeDefined();
    expect(screen.getByText('Age 67')).toBeDefined();

    // Percentages (decimal × 100, one decimal place)
    expect(screen.getByText('Inflation rate')).toBeDefined();
    expect(screen.getByText('2.5%')).toBeDefined();
    expect(screen.getByText('Investment return')).toBeDefined();
    expect(screen.getByText('6.0%')).toBeDefined();

    // Years of residence
    expect(screen.getByText('Years of Canadian residence')).toBeDefined();
    expect(screen.getByText('38')).toBeDefined();

    // Currency for expected CPP
    expect(screen.getByText('Expected CPP at 65')).toBeDefined();
    expect(screen.getByText('$14,400')).toBeDefined();

    // Tax year
    expect(screen.getByText('Tax year')).toBeDefined();
    expect(screen.getByText('2026')).toBeDefined();

    // Monte Carlo subsection
    expect(screen.getByText('Monte Carlo assumptions')).toBeDefined();
    expect(screen.getByText('Expected return')).toBeDefined();
    expect(screen.getByText('6.5%')).toBeDefined();
    expect(screen.getByText('Volatility')).toBeDefined();
    expect(screen.getByText('11.0%')).toBeDefined();
    expect(screen.getByText('Number of simulations')).toBeDefined();
    expect(screen.getByText('1,000')).toBeDefined();

    // Footer uses the explicitly provided federalTaxTableYear (2024 in this fixture)
    expect(
      screen.getByText(
        /Tax tables: Federal 2024; provincial tables use the latest available published values\./
      )
    ).toBeDefined();
  });

  it('shows "Today\'s dollars" prominently when displayMode is real', () => {
    render(<AssumptionsCard assumptions={FULL} displayMode="real" />);
    expect(screen.getByText('Display mode')).toBeDefined();
    expect(screen.getByText("Today's dollars")).toBeDefined();
  });

  it('shows future dollars and nominal CAD prominently when displayMode is nominal', () => {
    render(<AssumptionsCard assumptions={FULL} displayMode="nominal" />);
    expect(screen.getByText('Display mode')).toBeDefined();
    expect(screen.getByText('Future dollars / nominal CAD')).toBeDefined();
  });

  it('does not crash when assumptions is undefined and omits unavailable tax metadata', () => {
    render(<AssumptionsCard assumptions={undefined} displayMode="nominal" />);
    expect(screen.getByText('Assumptions Used')).toBeDefined();
    expect(screen.queryByText(/Tax tables:/)).toBeNull();
    expect(screen.queryByText('Monte Carlo assumptions')).toBeNull();
  });

  it('omits rows for missing fields without crashing', () => {
    const partial: AssumptionsCardData = { inflationRate: 0.02 };
    render(<AssumptionsCard assumptions={partial} displayMode="nominal" />);
    // Inflation row IS rendered
    expect(screen.getByText('Inflation rate')).toBeDefined();
    expect(screen.getByText('2.0%')).toBeDefined();
    // Other labels are NOT rendered
    expect(screen.queryByText('Province')).toBeNull();
    expect(screen.queryByText('Retirement age')).toBeNull();
    expect(screen.queryByText('Investment return')).toBeNull();
    expect(screen.queryByText('Expected CPP at 65')).toBeNull();
  });

  it('uses provided federalTaxTableYear in the tax-tables footer', () => {
    const partial: AssumptionsCardData = { federalTaxTableYear: 2025 };
    render(<AssumptionsCard assumptions={partial} displayMode="nominal" />);
    expect(
      screen.getByText(
        /Tax tables: Federal 2025; provincial tables use the latest available published values\./
      )
    ).toBeDefined();
  });

  it('uses explicit tax table version wording when provided', () => {
    render(
      <AssumptionsCard
        assumptions={{ taxTableVersion: 'Tax tables: 2026 published federal and provincial set.' }}
        displayMode="nominal"
      />
    );
    expect(
      screen.getByText('Tax tables: 2026 published federal and provincial set.')
    ).toBeDefined();
  });

  it('formats older percentage-point assumption values as percentages', () => {
    render(
      <AssumptionsCard
        assumptions={{ inflationRate: 2.5, investmentReturnRate: 6 }}
        displayMode="nominal"
      />
    );
    expect(screen.getByText('2.5%')).toBeDefined();
    expect(screen.getByText('6.0%')).toBeDefined();
  });
});
