/**
 * Historical Backtest Routes Integration Tests — v1.14 Phase 61
 *
 * TC-BT-007: POST /api/profile/scenarios/:id/backtest returns 3 BacktestRun objects,
 *            one per preset (2000, 2008, 2020).
 * TC-BT-008: Each run contains year-by-year breakdown with calendarYear, returnRate,
 *            portfolioBalance, withdrawals, taxesPaid, isEstimated fields.
 *            Specifically checks 2008 returnRate = -0.284 and isEstimated=true for
 *            years after 2025.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { BacktestRun, BacktestYearRecord } from '@retireops/shared';

// ── Engine mock — deterministic BacktestRun per preset ───────────────────────

function makeMockRun(preset: {
  id: string;
  label: string;
  description: string;
  startYear: number;
}): BacktestRun {
  const startYear = preset.startYear;
  const years: BacktestYearRecord[] = [];

  // 30 years of fake data using roughly the 2008 crisis returns for the 2008 preset
  for (let i = 0; i < 30; i++) {
    const calendarYear = startYear + i;
    const isEstimated = calendarYear > 2025;
    // Give the 2008 preset a -0.284 return in its first year (calendarYear === 2008)
    const returnRateApplied = preset.id === 'retired-2008' && calendarYear === 2008 ? -0.284 : 0.07;
    years.push({
      calendarYear,
      projectionYear: i + 1,
      returnRateApplied,
      isEstimated,
      portfolioBalance: Math.max(0, 500000 - i * 10000),
      totalWithdrawals: 40000,
      totalTaxesPaid: 5000,
    });
  }

  return {
    scenarioId: preset.id as BacktestRun['scenarioId'],
    label: preset.label,
    description: preset.description,
    startYear,
    funded: true,
    depletionYear: null,
    finalBalance: 200000,
    yearRecords: years,
  };
}

vi.mock('@retireops/calculation-engine', async (importOriginal) => {
  const original = await importOriginal<typeof import('@retireops/calculation-engine')>();
  return {
    ...original,
    runHistoricalBacktest: vi
      .fn()
      .mockImplementation(
        (
          _input: unknown,
          preset: { id: string; label: string; description: string; startYear: number }
        ) => makeMockRun(preset)
      ),
  };
});

vi.mock('../../services/projection-transformer.js', () => ({
  transformToProjectionInput: vi.fn().mockImplementation((input: unknown) => input),
  transformToFrontendOutput: vi
    .fn()
    .mockReturnValue({ years: [], summary: { probabilityOfSuccess: 0.85 } }),
}));

vi.mock('../../services/profile-assembler.js', () => ({
  assembleProfileInputData: vi.fn().mockReturnValue({
    personalInfo: { retirementAge: 65, lifeExpectancy: 90 },
    spouse: undefined,
    incomes: [],
    accounts: [],
    debts: [],
    governmentBenefits: { cppStartAge: 65, oasStartAge: 65 },
    expenses: { currentAnnualExpenses: 50000, retirementAnnualExpenses: 40000 },
    assumptions: { inflationRate: 0.02, investmentReturn: 0.05 },
  }),
}));

vi.mock('../../services/scenario-decisions.js', () => ({
  applyScenarioDecisions: vi.fn().mockImplementation((input: unknown) => input),
}));

import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../test/helpers/test-app.js';
import { mockDb } from '../test/helpers/mock-db.js';
import '../test/integration-setup.js';

describe('Historical Backtest Routes — Phase 61', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
    mockDb.reset();
  });

  async function seedProfile() {
    await request(app)
      .patch('/api/profile/about_you')
      .set('Authorization', 'Bearer test-token')
      .send({
        currentStep: 0,
        data: {
          firstName: 'John',
          dateOfBirth: '1965-01-01',
          province: 'ON',
          retirementAge: 65,
          lifeExpectancy: 90,
        },
      });
  }

  async function getBaseScenarioId(): Promise<string> {
    const list = await request(app)
      .get('/api/profile/scenarios')
      .set('Authorization', 'Bearer test-token');
    return list.body.data[0].id as string;
  }

  // ── TC-BT-007 ───────────────────────────────────────────────────────────────

  describe('TC-BT-007: POST /:id/backtest returns 3 preset runs', () => {
    it('returns 200 with 3 BacktestRun objects, one per preset', async () => {
      await seedProfile();
      const scenarioId = await getBaseScenarioId();

      const response = await request(app)
        .post(`/api/profile/scenarios/${scenarioId}/backtest`)
        .set('Authorization', 'Bearer test-token');

      if (response.status !== 200) {
        console.error('POST backtest failed:', response.status, JSON.stringify(response.body));
      }
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const { data, isStale } = response.body.data;
      expect(isStale).toBe(false);
      expect(Array.isArray(data.runs)).toBe(true);
      expect(data.runs).toHaveLength(3);

      const scenarioIds = data.runs.map((r: BacktestRun) => r.scenarioId);
      expect(scenarioIds).toContain('retired-2000');
      expect(scenarioIds).toContain('retired-2008');
      expect(scenarioIds).toContain('retired-2020');
    });

    it('returns 401 without auth token', async () => {
      await seedProfile();
      const scenarioId = await getBaseScenarioId();

      const response = await request(app).post(`/api/profile/scenarios/${scenarioId}/backtest`);
      expect(response.status).toBe(401);
    });

    it('returns 404 for a non-existent scenario', async () => {
      await seedProfile();

      const response = await request(app)
        .post('/api/profile/scenarios/00000000-0000-0000-0000-000000000000/backtest')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(404);
    });

    // Regression: legacy / mock-driver rows can hand back decisions as a JSON
    // string. Backtest must normalise before ScenarioDecisionsSchema.parse so
    // it doesn't surface as 400 "Expected object, received string".
    it('returns 200 when decisions is stored as a JSON string', async () => {
      await seedProfile();
      const scenarioId = await getBaseScenarioId();

      const row = mockDb._profileScenarios.get(scenarioId);
      expect(row).toBeDefined();
      row!.decisions = JSON.stringify({});

      const response = await request(app)
        .post(`/api/profile/scenarios/${scenarioId}/backtest`)
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.data.runs).toHaveLength(3);
    });
  });

  // ── TC-BT-008 ───────────────────────────────────────────────────────────────

  describe('TC-BT-008: Year-by-year breakdown fields and 2008 return rate', () => {
    it('each year record has all required fields', async () => {
      await seedProfile();
      const scenarioId = await getBaseScenarioId();

      const response = await request(app)
        .post(`/api/profile/scenarios/${scenarioId}/backtest`)
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);

      const { data } = response.body.data;
      const run2008 = data.runs.find((r: BacktestRun) => r.scenarioId === 'retired-2008');
      expect(run2008).toBeDefined();
      expect(run2008.yearRecords.length).toBeGreaterThan(0);

      const firstRecord = run2008.yearRecords[0] as BacktestYearRecord;
      expect(firstRecord).toHaveProperty('calendarYear');
      expect(firstRecord).toHaveProperty('returnRateApplied');
      expect(firstRecord).toHaveProperty('portfolioBalance');
      expect(firstRecord).toHaveProperty('totalWithdrawals');
      expect(firstRecord).toHaveProperty('totalTaxesPaid');
      expect(firstRecord).toHaveProperty('isEstimated');
    });

    it('2008 preset first year has returnRateApplied = -0.284', async () => {
      await seedProfile();
      const scenarioId = await getBaseScenarioId();

      const response = await request(app)
        .post(`/api/profile/scenarios/${scenarioId}/backtest`)
        .set('Authorization', 'Bearer test-token');

      const { data } = response.body.data;
      const run2008 = data.runs.find((r: BacktestRun) => r.scenarioId === 'retired-2008');
      const year2008 = run2008.yearRecords.find((r: BacktestYearRecord) => r.calendarYear === 2008);
      expect(year2008).toBeDefined();
      expect(year2008.returnRateApplied).toBeCloseTo(-0.284, 3);
    });

    it('rows with calendarYear > 2025 have isEstimated=true', async () => {
      await seedProfile();
      const scenarioId = await getBaseScenarioId();

      const response = await request(app)
        .post(`/api/profile/scenarios/${scenarioId}/backtest`)
        .set('Authorization', 'Bearer test-token');

      const { data } = response.body.data;
      const run2008 = data.runs.find((r: BacktestRun) => r.scenarioId === 'retired-2008');

      const estimatedRows = run2008.yearRecords.filter(
        (r: BacktestYearRecord) => r.calendarYear > 2025
      );
      expect(estimatedRows.length).toBeGreaterThan(0);
      for (const row of estimatedRows) {
        expect(row.isEstimated).toBe(true);
      }
    });
  });

  // ── GET cached results ───────────────────────────────────────────────────────

  describe('GET /:id/backtest — cached results', () => {
    it('returns 404 when no backtest has been run yet', async () => {
      await seedProfile();
      const scenarioId = await getBaseScenarioId();

      const response = await request(app)
        .get(`/api/profile/scenarios/${scenarioId}/backtest`)
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(404);
    });

    it('returns 200 with cached results after POST', async () => {
      await seedProfile();
      const scenarioId = await getBaseScenarioId();

      // Run first
      await request(app)
        .post(`/api/profile/scenarios/${scenarioId}/backtest`)
        .set('Authorization', 'Bearer test-token');

      // Then GET cached
      const response = await request(app)
        .get(`/api/profile/scenarios/${scenarioId}/backtest`)
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      const { data } = response.body.data;
      expect(data.runs).toHaveLength(3);
    });
  });
});
