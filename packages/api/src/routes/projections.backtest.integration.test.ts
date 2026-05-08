/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
/**
 * Projection Backtest Route Integration Tests — Phase 61
 *
 * TC-HIST-009: GET /api/projections/:id/backtest returns 200 with BacktestResult shape
 * TC-HIST-010: GET /api/projections/:id/backtest returns 409 PROJECTION_NOT_READY when pending
 * TC-HIST-011: GET /api/projections/:id/backtest served from cache on second hit
 * TC-HIST-012: GET /api/projections/nonexistent/backtest returns 404
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { BacktestRun, BacktestResult } from '@retireops/shared';

// ── Stable mock runs returned by runAllPresetBacktests ───────────────────────

const MOCK_RUNS: BacktestRun[] = [
  {
    scenarioId: 'retired-2000',
    label: 'Retired 2000 — Dot-com Crash',
    description: 'Portfolio entered a 3-year equity drawdown immediately after retirement.',
    startYear: 2000,
    funded: true,
    depletionYear: null,
    finalBalance: 150000,
    yearRecords: [],
  },
  {
    scenarioId: 'retired-2008',
    label: 'Retired 2008 — Financial Crisis',
    description: 'Portfolio hit a severe single-year drawdown in year one.',
    startYear: 2008,
    funded: true,
    depletionYear: null,
    finalBalance: 120000,
    yearRecords: [],
  },
  {
    scenarioId: 'retired-2020',
    label: 'Retired 2020 — COVID Crash',
    description: 'Portfolio experienced a sharp short-term drawdown followed by rapid recovery.',
    startYear: 2020,
    funded: true,
    depletionYear: null,
    finalBalance: 200000,
    yearRecords: [],
  },
];

// ── Engine mock ──────────────────────────────────────────────────────────────
// NOTE: Hoist a shared spy via vi.hoisted so the factory below can both
// (a) install the mock at module-replacement time, and
// (b) be accessed at test time via the same identity that the route picks up.
// A plain vi.mock(...vi.fn()) factory gets the pnpm workspace's `export *`
// re-export chain to partially bypass the mock (only the test-file import
// sees the mock; the route sees the live binding to the real impl). Shared
// hoisted spy works around that.
const engineMock = vi.hoisted(() => ({
  runAllPresetBacktests: vi.fn(),
}));

vi.mock('@retireops/calculation-engine', async (importOriginal) => {
  const original = await importOriginal<typeof import('@retireops/calculation-engine')>();
  return {
    ...original,
    runAllPresetBacktests: engineMock.runAllPresetBacktests,
  };
});

vi.mock('../services/projection-transformer.js', () => ({
  transformToProjectionInput: vi.fn().mockReturnValue({
    personalInfo: { retirementAge: 65, lifeExpectancy: 90 },
    // no spouse field — required for backtest to proceed
    accounts: [],
    incomeSources: [],
    governmentBenefits: { cppStartAge: 65, oasStartAge: 65 },
    expenses: { currentAnnualExpenses: 50000, retirementAnnualExpenses: 40000 },
    assumptions: { inflationRate: 0.02, investmentReturnRate: 0.05 },
  }),
  transformToFrontendOutput: vi.fn().mockReturnValue({ years: [], summary: {} }),
}));

import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../test/helpers/test-app.js';
import { mockDb } from '../test/helpers/mock-db.js';
import { TEST_USER } from '../test/helpers/test-app.js';
import '../test/integration-setup.js';
import { getCache, setCache } from '../utils/redis.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function seedProjection(id: string, status: 'completed' | 'pending') {
  mockDb._projections.set(id, {
    id,
    user_id: TEST_USER.id,
    name: 'Test Backtest Projection',
    description: null,
    input_data: {
      personalInfo: {
        dateOfBirth: '1965-01-01',
        province: 'ON',
        retirementAge: 65,
        lifeExpectancy: 90,
      },
      accounts: [],
      incomeSources: [],
      governmentBenefits: { cppStartAge: 65, oasStartAge: 65 },
      expenses: { currentAnnualExpenses: 50000, retirementAnnualExpenses: 40000 },
    },
    result_data: status === 'completed' ? { summary: {} } : null,
    status,
    calculated_at: status === 'completed' ? new Date() : null,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Projection Backtest Route — Phase 61', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
    engineMock.runAllPresetBacktests.mockReturnValue(MOCK_RUNS);
  });

  // ── TC-HIST-009 ─────────────────────────────────────────────────────────────

  describe('TC-HIST-009: Happy path — 200 with BacktestResult shape', () => {
    it('returns 200 with runs array, 64-char inputDataHash, valid computedAt, and correct projectionId', async () => {
      const projectionId = crypto.randomUUID();
      seedProjection(projectionId, 'completed');

      const response = await request(app)
        .get(`/api/projections/${projectionId}/backtest`)
        .set('Authorization', 'Bearer test-token');

      if (response.status !== 200) {
        console.error('TC-HIST-009 failed:', response.status, JSON.stringify(response.body));
      }

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const data: BacktestResult = response.body.data;
      expect(Array.isArray(data.runs)).toBe(true);
      expect(data.runs).toHaveLength(3);
      expect(data.inputDataHash).toMatch(/^[a-f0-9]{64}$/);
      expect(new Date(data.computedAt).toISOString()).toBe(data.computedAt);
      expect(data.projectionId).toBe(projectionId);
    });
  });

  // ── TC-HIST-010 ─────────────────────────────────────────────────────────────

  describe('TC-HIST-010: Pre-calculation 409 — projection not yet completed', () => {
    it('returns 409 with PROJECTION_NOT_READY when projection status is pending', async () => {
      const projectionId = crypto.randomUUID();
      seedProjection(projectionId, 'pending');

      const response = await request(app)
        .get(`/api/projections/${projectionId}/backtest`)
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PROJECTION_NOT_READY');
    });
  });

  // ── TC-HIST-011 ─────────────────────────────────────────────────────────────

  describe('TC-HIST-011: Cache hit — backtest result cached after first request', () => {
    it('serves the second request from cache without re-computing the result', async () => {
      const projectionId = crypto.randomUUID();
      const backtestCacheKey = `backtest:${projectionId}`;
      seedProjection(projectionId, 'completed');

      // Wire up a real in-memory cache store for this test so setCache/getCache
      // behave correctly — the route stores via setCache and reads via getCache.
      const cacheStore = new Map<string, unknown>();
      vi.mocked(setCache).mockImplementation(async (key: string, value: unknown) => {
        cacheStore.set(key, value);
      });
      vi.mocked(getCache).mockImplementation(async (key: string) => {
        return (cacheStore.get(key) ?? null) as never;
      });

      const first = await request(app)
        .get(`/api/projections/${projectionId}/backtest`)
        .set('Authorization', 'Bearer test-token');

      const second = await request(app)
        .get(`/api/projections/${projectionId}/backtest`)
        .set('Authorization', 'Bearer test-token');

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);

      // setCache for the backtest key must have been called exactly once — the
      // first request populates the cache; the second must short-circuit before
      // reaching the write path. (We count the backtest key specifically because
      // getProjection also writes to `projection:<id>` on the first request.)
      const backtestSets = vi
        .mocked(setCache)
        .mock.calls.filter((call) => call[0] === backtestCacheKey);
      expect(backtestSets).toHaveLength(1);

      // Cache-served response must be byte-identical, including the computedAt
      // timestamp captured on first compute — two fresh `new Date().toISOString()`
      // calls would not match, so equality proves the second request skipped compute.
      expect(second.body.data.computedAt).toBe(first.body.data.computedAt);
      expect(second.body.data.inputDataHash).toBe(first.body.data.inputDataHash);
    });
  });

  // ── TC-HIST-012 ─────────────────────────────────────────────────────────────

  describe('TC-HIST-012: Not found — unknown projection id', () => {
    it('returns 404 for a projection id that does not exist', async () => {
      const response = await request(app)
        .get(`/api/projections/${crypto.randomUUID()}/backtest`)
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(404);
    });
  });
});
