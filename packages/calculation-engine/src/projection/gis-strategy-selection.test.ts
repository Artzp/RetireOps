/**
 * Strategy-Selection Integration Tests
 *
 * Covers the new strategyId selector on ProjectionInput. Reproduces the
 * TC-SCEN-019 fixture: single filer, RRSP $40k / TFSA $90k / Non-Reg $5k,
 * $30k/yr spending from 65, LE 90.
 *
 * Two properties asserted:
 *   1. Regression gate — omitting strategyId and drawdownOrder must produce
 *      byte-identical output to strategyId: 'standard' (adapter-derived
 *      default-through-'standard' behavior replicates the legacy hardcoded
 *      fallback).
 *   2. User-visible value — strategyId: 'tfsaFirst' must produce strictly
 *      greater cumulative GIS income than strategyId: 'standard', because
 *      drawing TFSA first keeps GIS-counting income low in early retirement
 *      years.
 *
 * @see docs/source-of-truth/07-withdrawal-strategies.md
 * @see docs/source-of-truth/05-government-benefits.md — GIS Calculation
 */
import { describe, it, expect } from 'vitest';
import { runSingleProjection } from './multi-year.js';
import type { ProjectionInput } from '@retireops/shared';

function makeTcScen019Input(
  overrides: Partial<Pick<ProjectionInput, 'strategyId' | 'drawdownOrder'>> = {}
): ProjectionInput {
  return {
    birthdate: new Date(1960, 0, 1), // retiring at 65 in 2025
    province: 'ON',
    retirementAge: 65,
    lifeExpectancy: 90,
    maritalStatus: 'single',
    employmentIncome: 0,
    employmentGrowthRate: 0,
    expectedCPPAt65: 9_000,
    cppStartAge: 65,
    oasStartAge: 65,
    yearsOfResidence: 40,
    rrspBalance: 40_000,
    rrspAnnualContribution: 0,
    tfsaBalance: 90_000,
    tfsaAnnualContribution: 0,
    nonRegBalance: 5_000,
    retirementSpending: 30_000,
    investmentReturn: 0.0,
    inflationRate: 0.0,
    ...overrides,
  };
}

function cumulativeGis(input: ProjectionInput): number {
  const output = runSingleProjection(input);
  return output.yearlyResults.reduce((sum, y) => sum + (y.gisIncome ?? 0), 0);
}

describe('TC-SCEN-019 strategyId selection', () => {
  it('omitting strategyId matches strategyId: standard (regression gate)', () => {
    const omitted = runSingleProjection(makeTcScen019Input());
    const explicit = runSingleProjection(makeTcScen019Input({ strategyId: 'standard' }));

    // Compare the full yearly-result arrays. Dates on the top-level output
    // (id/createdAt/updatedAt) use non-deterministic generators, so strip them
    // before comparing.
    expect(omitted.yearlyResults).toEqual(explicit.yearlyResults);
    expect(omitted.summary).toEqual(explicit.summary);
  });

  it('strategyId: tfsaFirst yields strictly more cumulative GIS than standard', () => {
    const standardGis = cumulativeGis(makeTcScen019Input({ strategyId: 'standard' }));
    const tfsaFirstGis = cumulativeGis(makeTcScen019Input({ strategyId: 'tfsaFirst' }));

    expect(tfsaFirstGis).toBeGreaterThan(standardGis);
  });

  it('explicit drawdownOrder wins over strategyId', () => {
    // Explicit array that matches 'tfsaFirst' order; strategyId: 'standard' must be ignored.
    const explicitTfsaFirst = runSingleProjection(
      makeTcScen019Input({
        strategyId: 'standard',
        drawdownOrder: ['tfsa', 'nonReg', 'rrif', 'rrsp'],
      })
    );
    const tfsaFirstPreset = runSingleProjection(makeTcScen019Input({ strategyId: 'tfsaFirst' }));

    expect(explicitTfsaFirst.yearlyResults).toEqual(tfsaFirstPreset.yearlyResults);
  });
});
