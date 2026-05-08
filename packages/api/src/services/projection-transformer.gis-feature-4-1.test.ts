/**
 * Feature 4.1 GIS Acceptance Tests — API / Contract Layer
 *
 * Acceptance scenario TC-GIS41-011: Projection API preserves GIS fields in
 * the frontend-facing ProjectionYearRow contract for both single and couple
 * projections, including spouse GIS where applicable.
 *
 * @see ~/.hermes/cron/retireops-acceptance-tests/feature-4.1-gis.md
 * @see docs/source-of-truth/05-government-benefits.md — GIS Section
 */
import { describe, it, expect } from 'vitest';
import { runSingleProjection, runCoupleProjection } from '@retireops/calculation-engine';
import type { ProjectionInput, SpouseInput } from '@retireops/shared';
import { transformToProjectionYearRows } from './projection-transformer.js';

function makeLowIncomeSingleRetireeInput(): ProjectionInput {
  return {
    birthdate: new Date(1959, 0, 1),
    province: 'ON',
    retirementAge: 65,
    lifeExpectancy: 75,
    maritalStatus: 'single',
    employmentIncome: 0,
    employmentGrowthRate: 0,
    pensionIncome: 0,
    expectedCPPAt65: 6_000,
    cppStartAge: 65,
    oasStartAge: 65,
    rrspBalance: 10_000,
    rrspAnnualContribution: 0,
    tfsaBalance: 80_000,
    tfsaAnnualContribution: 0,
    nonRegBalance: 0,
    retirementSpending: 18_000,
    investmentReturn: 0.0,
    inflationRate: 0.0,
    drawdownOrder: ['tfsa', 'rrsp', 'nonReg'],
  };
}

function makeLowIncomeCoupleInput(): ProjectionInput {
  const spouse: SpouseInput = {
    birthdate: new Date(1960, 0, 1),
    retirementAge: 65,
    lifeExpectancy: 85,
    employmentIncome: 0,
    employmentGrowthRate: 0,
    expectedCPPAt65: 5_000,
    cppStartAge: 65,
    oasStartAge: 65,
    rrspBalance: 0,
    rrspAnnualContribution: 0,
    tfsaBalance: 40_000,
    tfsaAnnualContribution: 0,
    nonRegBalance: 0,
    pensionIncome: 8_000,
  };

  return {
    birthdate: new Date(1959, 0, 1),
    province: 'ON',
    retirementAge: 65,
    lifeExpectancy: 85,
    maritalStatus: 'married',
    employmentIncome: 0,
    employmentGrowthRate: 0,
    pensionIncome: 8_000,
    expectedCPPAt65: 6_000,
    cppStartAge: 65,
    oasStartAge: 65,
    rrspBalance: 0,
    rrspAnnualContribution: 0,
    tfsaBalance: 40_000,
    tfsaAnnualContribution: 0,
    nonRegBalance: 0,
    retirementSpending: 25_000,
    investmentReturn: 0.0,
    inflationRate: 0.0,
    spouse,
    coupleSettings: {
      optimizePensionSplitting: false,
      useYoungerSpouseForRRIF: false,
    },
  };
}

describe('Feature 4.1 GIS — API Contract', () => {
  describe('TC-GIS41-011: Projection API preserves GIS fields in result payload', () => {
    it('single-person projection: projectionRows[].gisIncome is populated consistently for GIS-eligible years', () => {
      const output = runSingleProjection(makeLowIncomeSingleRetireeInput());
      const rows = transformToProjectionYearRows(output);

      // At least one year in the projection must expose gisIncome > 0 for a GIS-eligible scenario.
      const rowsWithGIS = rows.filter((r) => typeof r.gisIncome === 'number' && r.gisIncome > 0);
      expect(rowsWithGIS.length).toBeGreaterThan(0);

      // When present, gisIncome on the row must match the engine yearlyResult for the same year.
      for (const row of rowsWithGIS) {
        const engineYear = output.yearlyResults.find((y) => y.year === row.year);
        expect(engineYear).toBeDefined();
        if (!engineYear) continue;
        // Use the engine's gisIncome field when present (engine legacy path may not set it).
        const engineGis =
          'gisIncome' in engineYear
            ? ((engineYear as unknown as { gisIncome?: number }).gisIncome ?? 0)
            : 0;
        expect(row.gisIncome).toBeCloseTo(engineGis, 0);
      }
    });

    it('couple projection: projectionRows[] exposes both primary gisIncome and spouseGisIncome', () => {
      const output = runCoupleProjection(makeLowIncomeCoupleInput());
      const rows = transformToProjectionYearRows(output);

      // At least one GIS-eligible year where both primary and spouse receive GIS.
      const rowsWithBothGIS = rows.filter(
        (r) =>
          typeof r.gisIncome === 'number' &&
          r.gisIncome > 0 &&
          typeof r.spouseGisIncome === 'number' &&
          r.spouseGisIncome > 0
      );
      expect(
        rowsWithBothGIS.length,
        'At least one year must have both primary and spouse GIS benefits'
      ).toBeGreaterThan(0);

      // Row values must match per-person engine values.
      for (const row of rowsWithBothGIS) {
        const engineYear = output.yearlyResults.find((y) => y.year === row.year);
        expect(engineYear).toBeDefined();
        if (!engineYear) continue;
        expect(row.gisIncome).toBeCloseTo(engineYear.primary.gisIncome ?? 0, 0);
        expect(row.spouseGisIncome).toBeCloseTo(engineYear.spouse.gisIncome ?? 0, 0);
      }
    });

    it('no schema break — rows remain serializable plain objects with expected optional GIS keys', () => {
      const output = runCoupleProjection(makeLowIncomeCoupleInput());
      const rows = transformToProjectionYearRows(output);

      for (const row of rows) {
        // JSON round-trip must succeed — guard against Date/class leaks in the contract.
        const roundTripped = JSON.parse(JSON.stringify(row)) as typeof row;
        expect(roundTripped.year).toBe(row.year);

        // Optional GIS keys are either undefined or numeric — never NaN or string.
        if (row.gisIncome !== undefined) {
          expect(typeof row.gisIncome).toBe('number');
          expect(Number.isFinite(row.gisIncome)).toBe(true);
        }
        if (row.spouseGisIncome !== undefined) {
          expect(typeof row.spouseGisIncome).toBe('number');
          expect(Number.isFinite(row.spouseGisIncome)).toBe(true);
        }
      }
    });
  });
});
