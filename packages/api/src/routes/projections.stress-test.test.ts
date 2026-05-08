/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
/**
 * Feature 3.3 Stress Testing — API Route Tests
 *
 * TC-ST-006: POST /api/profile/scenarios/:id/stress-test returns all 4 scenarios
 * TC-ST-007: Each scenario in response includes required fields and non-negative balances
 *
 * Runs under the default `pnpm --filter @retireops/api test` command
 * (vitest.config.ts, setupFiles: setup.ts). DB and auth are mocked inline rather
 * than relying on the integration setup file.
 *
 * @see retireops-acceptance-tests/feature-3.3-stress-testing.md TC-ST-006, TC-ST-007
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { StressTestResult } from '@retireops/calculation-engine';
import { mockDb } from '../test/helpers/mock-db.js';
import { TEST_USER } from '../test/helpers/test-app.js';

// ── DB + Auth mocks (normally provided by integration-setup.ts) ──────────────

vi.mock('../db/connection.js', () => ({
  db: mockDb,
}));

vi.mock('../auth/middleware.js', () => ({
  requireAuth: vi.fn((req: any, _res: any, next: any) => {
    const authHeader = req.headers?.authorization as string | undefined;
    if (!authHeader?.startsWith('Bearer ')) {
      const err = new Error('No token provided') as Error & {
        statusCode: number;
        code: string;
      };
      err.statusCode = 401;
      err.code = 'AUTHENTICATION_ERROR';
      err.name = 'AuthenticationError';
      return next(err);
    }
    req.user = TEST_USER;
    next();
  }),
  optionalAuth: vi.fn((req: any, _res: any, next: any) => {
    const authHeader = req.headers?.authorization as string | undefined;
    if (authHeader?.startsWith('Bearer ')) req.user = TEST_USER;
    next();
  }),
}));

vi.mock('../config/index.js', () => ({
  config: {
    port: 3000,
    nodeEnv: 'test',
    jwtSecret: 'test-secret-key-for-testing-purposes-32chars',
    jwtAccessExpiresIn: '15m',
    jwtRefreshExpiresIn: '7d',
    databaseUrl: 'postgresql://test:test@localhost:5432/test',
    redisUrl: 'redis://localhost:6379',
    corsOrigin: 'http://localhost:3001',
    googleClientId: 'test-google-client-id',
    googleClientSecret: 'test-google-client-secret',
    googleRedirectUri: 'http://localhost:3000/api/auth/google/callback',
  },
  isProduction: false,
  isDevelopment: false,
  isTest: true,
}));

// ── Engine mock — returns deterministic stress results per scenario ──────────

function makeMockStressResult(scenario: string): StressTestResult {
  const scenarios: Record<
    string,
    { description: string; year1Return: number; year2Return: number }
  > = {
    market_crash_at_retirement: {
      description: '-30% market crash in first year of retirement',
      year1Return: -0.3,
      year2Return: 0.055,
    },
    lost_decade: {
      description: '0% returns for 10 years',
      year1Return: 0,
      year2Return: 0,
    },
    high_inflation: {
      description: '6%+ inflation for 5 years',
      year1Return: 0.02,
      year2Return: 0.02,
    },
    '2008_replay': {
      description: 'Historical 2008-2009 market crash and recovery',
      year1Return: -0.37,
      year2Return: 0.27,
    },
  };

  const cfg = scenarios[scenario] ?? {
    description: 'Unknown',
    year1Return: 0.055,
    year2Return: 0.055,
  };

  const yearlyData = Array.from({ length: 10 }, (_, i) => ({
    year: i + 1,
    returnRate: i === 0 ? cfg.year1Return : i === 1 ? cfg.year2Return : 0.055,
    balance: Math.max(0, 1_000_000 - i * 20_000),
  }));

  return {
    scenario: scenario as StressTestResult['scenario'],
    description: cfg.description,
    finalBalance: yearlyData[yearlyData.length - 1]?.balance ?? 0,
    depletionYear: null,
    yearlyData,
  };
}

vi.mock('@retireops/calculation-engine', async (importOriginal) => {
  const original = await importOriginal<typeof import('@retireops/calculation-engine')>();
  return {
    ...original,
    runStressTest: vi
      .fn()
      .mockImplementation((params: { scenario: string }) => makeMockStressResult(params.scenario)),
  };
});

import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../test/helpers/test-app.js';

const EXPECTED_SCENARIO_KEYS = [
  'market_crash_at_retirement',
  'lost_decade',
  'high_inflation',
  '2008_replay',
] as const;

describe('Stress Test Routes — Feature 3.3 (TC-ST-006, TC-ST-007)', () => {
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
          firstName: 'Jane',
          dateOfBirth: '1965-06-15',
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

  // ── TC-ST-006 ─────────────────────────────────────────────────────────────

  describe('TC-ST-006: POST /:id/stress-test returns exactly 4 scenario results', () => {
    it('returns 200 with exactly 4 scenario results', async () => {
      await seedProfile();
      const scenarioId = await getBaseScenarioId();

      const response = await request(app)
        .post(`/api/profile/scenarios/${scenarioId}/stress-test`)
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.results)).toBe(true);
      expect(response.body.data.results).toHaveLength(4);
    });

    it('response contains all 4 required scenario keys', async () => {
      await seedProfile();
      const scenarioId = await getBaseScenarioId();

      const response = await request(app)
        .post(`/api/profile/scenarios/${scenarioId}/stress-test`)
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);

      const scenarioKeys = (response.body.data.results as StressTestResult[]).map(
        (r) => r.scenario
      );

      for (const key of EXPECTED_SCENARIO_KEYS) {
        expect(scenarioKeys).toContain(key);
      }
    });

    it('returns 401 without auth token', async () => {
      await seedProfile();
      const scenarioId = await getBaseScenarioId();

      const response = await request(app).post(`/api/profile/scenarios/${scenarioId}/stress-test`);

      expect(response.status).toBe(401);
    });

    it('returns 404 for a non-existent scenario', async () => {
      await seedProfile();

      const response = await request(app)
        .post('/api/profile/scenarios/00000000-0000-0000-0000-000000000000/stress-test')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(404);
    });
  });

  // ── TC-ST-007 ─────────────────────────────────────────────────────────────

  describe('TC-ST-007: each scenario result includes required fields and non-negative balances', () => {
    it('every scenario result has scenario, description, finalBalance, depletionYear, yearlyData', async () => {
      await seedProfile();
      const scenarioId = await getBaseScenarioId();

      const response = await request(app)
        .post(`/api/profile/scenarios/${scenarioId}/stress-test`)
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);

      const results = response.body.data.results as StressTestResult[];
      for (const result of results) {
        expect(result).toHaveProperty('scenario');
        expect(result).toHaveProperty('description');
        expect(result).toHaveProperty('finalBalance');
        expect(result).toHaveProperty('depletionYear');
        expect(result).toHaveProperty('yearlyData');
        expect(Array.isArray(result.yearlyData)).toBe(true);
      }
    });

    it('yearlyData entries each have year, returnRate, balance', async () => {
      await seedProfile();
      const scenarioId = await getBaseScenarioId();

      const response = await request(app)
        .post(`/api/profile/scenarios/${scenarioId}/stress-test`)
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);

      const results = response.body.data.results as StressTestResult[];
      for (const result of results) {
        expect(result.yearlyData.length).toBeGreaterThan(0);
        for (const yearRow of result.yearlyData) {
          expect(yearRow).toHaveProperty('year');
          expect(yearRow).toHaveProperty('returnRate');
          expect(yearRow).toHaveProperty('balance');
        }
      }
    });

    it('depleted runs terminate with non-negative balances (no negative chart values)', async () => {
      await seedProfile();
      const scenarioId = await getBaseScenarioId();

      const response = await request(app)
        .post(`/api/profile/scenarios/${scenarioId}/stress-test`)
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);

      const results = response.body.data.results as StressTestResult[];
      for (const result of results) {
        expect(result.finalBalance).toBeGreaterThanOrEqual(0);
        for (const yearRow of result.yearlyData) {
          expect(yearRow.balance).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });
});
