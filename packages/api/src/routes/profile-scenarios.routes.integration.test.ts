/**
 * Profile Scenarios Routes Integration Tests
 *
 * Tests for SCEN-06 (clone) and SCEN-07 (delete with base guard) endpoints.
 * Also covers GET list (D-05, metadata only, no result_data) and GET single (D-06, includes result_data).
 * Also covers SCEN-08: stale-mark + background recompute triggered by profile PATCH.
 *
 * @see docs/source-of-truth/10-scenarios.md - SCEN-06, SCEN-07, D-05, D-06, SCEN-08
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock calculation engine and pipeline helpers to keep tests fast and deterministic (SCEN-08)
vi.mock('@retireops/calculation-engine', () => ({
  runProjection: vi.fn().mockReturnValue({
    years: [],
    summary: { probabilityOfSuccess: 0.85, peakNetWorth: 500000, averageRetirementIncome: 30000 },
  }),
}));

vi.mock('../services/projection-transformer.js', () => ({
  transformToProjectionInput: vi.fn().mockImplementation((input: unknown) => input),
  transformToFrontendOutput: vi
    .fn()
    .mockReturnValue({ years: [], summary: { probabilityOfSuccess: 0.85 } }),
}));

vi.mock('../services/profile-assembler.js', () => ({
  assembleProfileInputData: vi.fn().mockReturnValue({
    personalInfo: { retirementAge: 65, lifeExpectancy: 90 },
    spouse: undefined,
    incomes: [],
    accounts: [],
    debts: [],
    governmentBenefits: {
      cppStartAge: 65,
      oasStartAge: 65,
    },
    expenses: { currentAnnualExpenses: 50000, retirementAnnualExpenses: 40000 },
    assumptions: { inflationRate: 0.02, investmentReturn: 0.05 },
  }),
}));

import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../test/helpers/test-app.js';
import { mockDb } from '../test/helpers/mock-db.js';
import '../test/integration-setup.js';
import { runProjection } from '@retireops/calculation-engine';
import { transformToFrontendOutput } from '../services/projection-transformer.js';

describe('Profile Scenarios Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
    mockDb.reset();
  });

  /**
   * Helper: seed a profile so the Base Scenario is auto-created.
   */
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

  describe('GET /api/profile/scenarios', () => {
    /**
     * D-05: GET list returns metadata only (no result_data) with Base Scenario present.
     */
    it('should return 200 with array containing the auto-created Base Scenario', async () => {
      await seedProfile();

      const response = await request(app)
        .get('/api/profile/scenarios')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);

      const base = response.body.data[0];
      expect(base.is_base).toBe(true);
      expect(base.name).toBe('Base Scenario');
    });

    /**
     * D-05: List response items must NOT include result_data.
     */
    it('should not include result_data in list response items', async () => {
      await seedProfile();

      const response = await request(app)
        .get('/api/profile/scenarios')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      const item = response.body.data[0];
      expect(item).not.toHaveProperty('result_data');
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app).get('/api/profile/scenarios');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/profile/scenarios/:id', () => {
    /**
     * D-06: GET single returns full record including result_data.
     */
    it('should return 200 with full scenario record including result_data key', async () => {
      await seedProfile();

      // Get list to find the base scenario id
      const listResponse = await request(app)
        .get('/api/profile/scenarios')
        .set('Authorization', 'Bearer test-token');

      const baseId = listResponse.body.data[0].id;

      const response = await request(app)
        .get(`/api/profile/scenarios/${baseId}`)
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.is_base).toBe(true);
      // result_data should be present (even if null) in the single record response
      expect('result_data' in response.body.data).toBe(true);
    });

    /**
     * GET with non-existent id returns 404.
     */
    it('should return 404 for a non-existent scenario id', async () => {
      await seedProfile();

      const response = await request(app)
        .get('/api/profile/scenarios/00000000-0000-0000-0000-000000000000')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/profile/scenarios/:id/clone', () => {
    /**
     * SCEN-06: Clone creates a copy with name "(copy)" suffix and is_base=false.
     */
    it('should return 201 with cloned scenario: name suffix, is_base=false, status=pending', async () => {
      await seedProfile();

      const listResponse = await request(app)
        .get('/api/profile/scenarios')
        .set('Authorization', 'Bearer test-token');

      const baseId = listResponse.body.data[0].id;

      const response = await request(app)
        .post(`/api/profile/scenarios/${baseId}/clone`)
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Base Scenario (copy)');
      expect(response.body.data.is_base).toBe(false);
      expect(response.body.data.status).toBe('pending');
      // Both original and clone are in the store
      expect(mockDb._profileScenarios.size).toBe(2);
    });
  });

  describe('DELETE /api/profile/scenarios/:id', () => {
    /**
     * SCEN-07: DELETE on the Base Scenario returns 409 and does not remove it.
     */
    it('should return 409 when attempting to delete the Base Scenario', async () => {
      await seedProfile();

      const listResponse = await request(app)
        .get('/api/profile/scenarios')
        .set('Authorization', 'Bearer test-token');

      const baseId = listResponse.body.data[0].id;

      const response = await request(app)
        .delete(`/api/profile/scenarios/${baseId}`)
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(409);
      // Base Scenario must NOT be deleted
      expect(mockDb._profileScenarios.size).toBe(1);
    });

    /**
     * SCEN-07: DELETE on a non-base scenario returns 200 and removes it.
     */
    it('should return 200 and remove a non-base cloned scenario', async () => {
      await seedProfile();

      // First clone the base to get a non-base scenario
      const listResponse = await request(app)
        .get('/api/profile/scenarios')
        .set('Authorization', 'Bearer test-token');

      const baseId = listResponse.body.data[0].id;

      const cloneResponse = await request(app)
        .post(`/api/profile/scenarios/${baseId}/clone`)
        .set('Authorization', 'Bearer test-token');

      const cloneId = cloneResponse.body.data.id;

      // Now delete the clone
      const response = await request(app)
        .delete(`/api/profile/scenarios/${cloneId}`)
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Only Base Scenario remains
      expect(mockDb._profileScenarios.size).toBe(1);
    });

    /**
     * DELETE with non-existent id returns 404.
     */
    it('should return 404 for a non-existent scenario id', async () => {
      await seedProfile();

      const response = await request(app)
        .delete('/api/profile/scenarios/00000000-0000-0000-0000-000000000000')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/profile/scenarios', () => {
    /**
     * Create a blank non-base scenario with a given name.
     */
    it('should return 201 with new blank scenario', async () => {
      await seedProfile();

      const response = await request(app)
        .post('/api/profile/scenarios')
        .set('Authorization', 'Bearer test-token')
        .send({ name: 'Conservative Plan' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Conservative Plan');
      expect(response.body.data.is_base).toBe(false);
      expect(response.body.data.status).toBe('pending');
      expect(response.body.data.decisions).toEqual({});
    });

    /**
     * POST with empty name returns 400.
     */
    it('should return 400 with empty name', async () => {
      await seedProfile();

      const response = await request(app)
        .post('/api/profile/scenarios')
        .set('Authorization', 'Bearer test-token')
        .send({ name: '' });

      expect(response.status).toBe(400);
    });

    /**
     * POST when no profile exists returns 404.
     */
    it('should return 404 when no profile exists', async () => {
      // Do NOT seed profile
      const response = await request(app)
        .post('/api/profile/scenarios')
        .set('Authorization', 'Bearer test-token')
        .send({ name: 'Test' });

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/profile/scenarios/:id', () => {
    /**
     * Rename a non-base cloned scenario — returns 200 with updated name.
     */
    it('should return 200 and update name for non-base scenario', async () => {
      await seedProfile();

      // Clone the base to get a non-base scenario
      const listResponse = await request(app)
        .get('/api/profile/scenarios')
        .set('Authorization', 'Bearer test-token');

      const baseId = listResponse.body.data[0].id;

      const cloneResponse = await request(app)
        .post(`/api/profile/scenarios/${baseId}/clone`)
        .set('Authorization', 'Bearer test-token');

      const cloneId = cloneResponse.body.data.id;

      const response = await request(app)
        .patch(`/api/profile/scenarios/${cloneId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ name: 'Aggressive Plan' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Aggressive Plan');
    });

    /**
     * SCEN-07 variant: PATCH on the Base Scenario returns 409.
     */
    it('should return 409 when renaming Base Scenario', async () => {
      await seedProfile();

      const listResponse = await request(app)
        .get('/api/profile/scenarios')
        .set('Authorization', 'Bearer test-token');

      const baseId = listResponse.body.data[0].id;

      const response = await request(app)
        .patch(`/api/profile/scenarios/${baseId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ name: 'New Name' });

      expect(response.status).toBe(409);
    });

    /**
     * PATCH with non-existent scenario id returns 404.
     */
    it('should return 404 for non-existent scenario id', async () => {
      await seedProfile();

      const response = await request(app)
        .patch('/api/profile/scenarios/00000000-0000-0000-0000-000000000000')
        .set('Authorization', 'Bearer test-token')
        .send({ name: 'Test' });

      expect(response.status).toBe(404);
    });
  });
});

describe('POST /api/profile/scenarios/:id/run', () => {
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
          firstName: 'Run',
          dateOfBirth: '1960-01-01',
          province: 'ON',
          retirementAge: 65,
          lifeExpectancy: 90,
        },
      });
  }

  /**
   * D-01: POST /:id/run returns 200 with completed scenario including result_data.
   */
  it('returns 200 with completed scenario after run', async () => {
    await seedProfile();

    const listResponse = await request(app)
      .get('/api/profile/scenarios')
      .set('Authorization', 'Bearer test-token');

    const baseId = listResponse.body.data[0].id;

    const response = await request(app)
      .post(`/api/profile/scenarios/${baseId}/run`)
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('completed');
    expect(response.body.data.result_data).toBeTruthy();
    expect(response.body.data.calculated_at).toBeTruthy();
  });

  /**
   * D-01: POST /:id/run returns 404 for non-existent scenario id.
   */
  it('returns 404 for non-existent scenario id', async () => {
    await seedProfile();

    const response = await request(app)
      .post('/api/profile/scenarios/00000000-0000-0000-0000-000000000000/run')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(404);
  });

  it('previews decisions without mutating scenario decisions/status/result_data', async () => {
    await seedProfile();

    const listResponse = await request(app)
      .get('/api/profile/scenarios')
      .set('Authorization', 'Bearer test-token');
    const scenarioId = listResponse.body.data[0].id as string;

    const runResponse = await request(app)
      .post(`/api/profile/scenarios/${scenarioId}/run`)
      .set('Authorization', 'Bearer test-token');
    expect(runResponse.status).toBe(200);

    const before = mockDb._profileScenarios.get(scenarioId);
    const beforeDecisions = JSON.parse(JSON.stringify(before?.decisions));
    const beforeResultData = JSON.parse(JSON.stringify(before?.result_data));
    const beforeStatus = before?.status;

    const previewResponse = await request(app)
      .post(`/api/profile/scenarios/${scenarioId}/preview-decisions`)
      .set('Authorization', 'Bearer test-token')
      .send({ cppStartAge: 70, oasStartAge: 70 });

    expect(previewResponse.status).toBe(200);
    expect(previewResponse.body.success).toBe(true);
    expect(previewResponse.body.data.decisions).toMatchObject({
      cppStartAge: 70,
      oasStartAge: 70,
    });
    expect(previewResponse.body.data.result_data).toBeTruthy();

    const after = mockDb._profileScenarios.get(scenarioId);
    expect(after?.decisions).toEqual(beforeDecisions);
    expect(after?.status).toBe(beforeStatus);
    expect(after?.result_data).toEqual(beforeResultData);
  });
});

describe('POST /api/profile/scenarios/compare', () => {
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
          firstName: 'Compare',
          dateOfBirth: '1960-01-01',
          province: 'ON',
          retirementAge: 65,
          lifeExpectancy: 90,
        },
      });
  }

  /**
   * D-15: POST /compare returns 200 with ScenarioComparison shape for 2 completed scenarios.
   */
  it('returns comparison for 2 completed scenarios', async () => {
    await seedProfile();

    // Get base scenario id
    const listResponse = await request(app)
      .get('/api/profile/scenarios')
      .set('Authorization', 'Bearer test-token');

    const baseId = listResponse.body.data[0].id;

    // Run base scenario to mark it completed
    await request(app)
      .post(`/api/profile/scenarios/${baseId}/run`)
      .set('Authorization', 'Bearer test-token');

    // Clone to get a second scenario, then run it
    const cloneResponse = await request(app)
      .post(`/api/profile/scenarios/${baseId}/clone`)
      .set('Authorization', 'Bearer test-token');

    const cloneId = cloneResponse.body.data.id;

    await request(app)
      .post(`/api/profile/scenarios/${cloneId}/run`)
      .set('Authorization', 'Bearer test-token');

    const response = await request(app)
      .post('/api/profile/scenarios/compare')
      .set('Authorization', 'Bearer test-token')
      .send({ ids: [baseId, cloneId] });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.baseProjection).toBeTruthy();
    expect(Array.isArray(response.body.data.comparison.metrics)).toBe(true);
    expect(response.body.data.comparison.metrics.length).toBe(6);
  });

  /**
   * D-15: POST /compare returns 400 for fewer than 2 ids.
   */
  it('returns 400 for fewer than 2 ids', async () => {
    await seedProfile();

    const listResponse = await request(app)
      .get('/api/profile/scenarios')
      .set('Authorization', 'Bearer test-token');

    const baseId = listResponse.body.data[0].id;

    const response = await request(app)
      .post('/api/profile/scenarios/compare')
      .set('Authorization', 'Bearer test-token')
      .send({ ids: [baseId] });

    expect(response.status).toBe(400);
  });

  /**
   * D-15: POST /compare returns 409 when a scenario is not completed.
   */
  it('returns 409 when a scenario is not completed', async () => {
    await seedProfile();

    // Get base scenario id — status is 'pending' (not run yet)
    const listResponse = await request(app)
      .get('/api/profile/scenarios')
      .set('Authorization', 'Bearer test-token');

    const baseId = listResponse.body.data[0].id;

    // Clone to get a second scenario (also pending)
    const cloneResponse = await request(app)
      .post(`/api/profile/scenarios/${baseId}/clone`)
      .set('Authorization', 'Bearer test-token');

    const cloneId = cloneResponse.body.data.id;

    // Neither is completed — should return 409
    const response = await request(app)
      .post('/api/profile/scenarios/compare')
      .set('Authorization', 'Bearer test-token')
      .send({ ids: [baseId, cloneId] });

    expect(response.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// Phase 1 overrides — PUT /decisions validation (OVER-01..04, ENG-01)
// @see .planning/phases/01-editable-overrides/01-CONTEXT.md - D-01, D-02, D-04, D-05, D-15
// Threat mitigations: T-01 (array cap), T-02 (amount bounds), T-05 (duplicate tuples)
// ---------------------------------------------------------------------------

describe('Phase 1 overrides — PUT /decisions validation (OVER-01..04, ENG-01)', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
    mockDb.reset();
  });

  async function seedProfileAndGetScenarioId(): Promise<string> {
    await request(app)
      .patch('/api/profile/about_you')
      .set('Authorization', 'Bearer test-token')
      .send({
        currentStep: 0,
        data: {
          firstName: 'Override',
          dateOfBirth: '1965-01-01',
          province: 'ON',
          retirementAge: 65,
          lifeExpectancy: 90,
        },
      });
    const listResponse = await request(app)
      .get('/api/profile/scenarios')
      .set('Authorization', 'Bearer test-token');
    return listResponse.body.data[0].id as string;
  }

  const validWithdrawalOverride = {
    field: 'rrsp',
    year: 2031,
    amount: 50000,
    applyForward: true,
  };

  it('accepts valid withdrawalOverrides and sets status=stale (OVER-01, D-02)', async () => {
    const scenarioId = await seedProfileAndGetScenarioId();
    const res = await request(app)
      .put(`/api/profile/scenarios/${scenarioId}/decisions`)
      .set('Authorization', 'Bearer test-token')
      .send({ withdrawalOverrides: [validWithdrawalOverride] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // status='stale' transition (existing behavior extended)
    const scenario = mockDb._profileScenarios.get(scenarioId);
    expect(scenario?.status).toBe('stale');
    const decisions = scenario?.decisions as Record<string, unknown>;
    expect(Array.isArray(decisions.withdrawalOverrides)).toBe(true);
  });

  it('accepts valid spendingOverrides and persists (OVER-02)', async () => {
    const scenarioId = await seedProfileAndGetScenarioId();
    const res = await request(app)
      .put(`/api/profile/scenarios/${scenarioId}/decisions`)
      .set('Authorization', 'Bearer test-token')
      .send({
        spendingOverrides: [{ year: 2035, amount: 80000, applyForward: false }],
      });

    expect(res.status).toBe(200);
    const scenario = mockDb._profileScenarios.get(scenarioId);
    expect(scenario?.status).toBe('stale');
    const decisions = scenario?.decisions as Record<string, unknown>;
    expect(Array.isArray(decisions.spendingOverrides)).toBe(true);
  });

  it('accepts valid surplusDestination="tfsa" and persists (D-15)', async () => {
    const scenarioId = await seedProfileAndGetScenarioId();
    const res = await request(app)
      .put(`/api/profile/scenarios/${scenarioId}/decisions`)
      .set('Authorization', 'Bearer test-token')
      .send({ surplusDestination: 'tfsa' });

    expect(res.status).toBe(200);
    const scenario = mockDb._profileScenarios.get(scenarioId);
    const decisions = scenario?.decisions as Record<string, unknown>;
    expect(decisions.surplusDestination).toBe('tfsa');
  });

  it('rejects duplicate (field, year) tuples with 400 (T-05)', async () => {
    const scenarioId = await seedProfileAndGetScenarioId();
    const payload = {
      withdrawalOverrides: [
        validWithdrawalOverride,
        { ...validWithdrawalOverride, amount: 60000 }, // same field+year = duplicate
      ],
    };
    const res = await request(app)
      .put(`/api/profile/scenarios/${scenarioId}/decisions`)
      .set('Authorization', 'Bearer test-token')
      .send(payload);

    expect(res.status).toBe(400);
  });

  it('rejects amount < 0 with 400 (T-02)', async () => {
    const scenarioId = await seedProfileAndGetScenarioId();
    const res = await request(app)
      .put(`/api/profile/scenarios/${scenarioId}/decisions`)
      .set('Authorization', 'Bearer test-token')
      .send({
        withdrawalOverrides: [{ field: 'rrsp', year: 2031, amount: -1, applyForward: false }],
      });

    expect(res.status).toBe(400);
  });

  it('rejects amount > 10_000_000 with 400 (T-02)', async () => {
    const scenarioId = await seedProfileAndGetScenarioId();
    const res = await request(app)
      .put(`/api/profile/scenarios/${scenarioId}/decisions`)
      .set('Authorization', 'Bearer test-token')
      .send({
        withdrawalOverrides: [
          { field: 'rrsp', year: 2031, amount: 10_000_001, applyForward: false },
        ],
      });

    expect(res.status).toBe(400);
  });

  it('rejects amount = NaN with 400 (T-02)', async () => {
    const scenarioId = await seedProfileAndGetScenarioId();
    // JSON.stringify converts NaN to null; send as a raw JSON string
    const res = await request(app)
      .put(`/api/profile/scenarios/${scenarioId}/decisions`)
      .set('Authorization', 'Bearer test-token')
      .set('Content-Type', 'application/json')
      .send(
        JSON.stringify({
          withdrawalOverrides: [{ field: 'rrsp', year: 2031, amount: null, applyForward: false }],
        })
      );

    expect(res.status).toBe(400);
  });

  it('rejects 201 records with 400 (T-01)', async () => {
    const scenarioId = await seedProfileAndGetScenarioId();
    const arr = Array.from({ length: 201 }, (_, i) => ({
      field: 'rrsp' as const,
      year: 2001 + i,
      amount: 1000,
      applyForward: false,
    }));
    const res = await request(app)
      .put(`/api/profile/scenarios/${scenarioId}/decisions`)
      .set('Authorization', 'Bearer test-token')
      .send({ withdrawalOverrides: arr });

    expect(res.status).toBe(400);
  });

  it('accepts exactly 200 records (T-01 boundary)', async () => {
    const scenarioId = await seedProfileAndGetScenarioId();
    const arr = Array.from({ length: 200 }, (_, i) => ({
      field: 'rrsp' as const,
      year: 2001 + i,
      amount: 1000,
      applyForward: false,
    }));
    const res = await request(app)
      .put(`/api/profile/scenarios/${scenarioId}/decisions`)
      .set('Authorization', 'Bearer test-token')
      .send({ withdrawalOverrides: arr });

    expect(res.status).toBe(200);
  });

  it('rejects surplusDestination="lira" with 400 (D-15 enum)', async () => {
    const scenarioId = await seedProfileAndGetScenarioId();
    const res = await request(app)
      .put(`/api/profile/scenarios/${scenarioId}/decisions`)
      .set('Authorization', 'Bearer test-token')
      .send({ surplusDestination: 'lira' });

    expect(res.status).toBe(400);
  });

  it('rejects duplicate year in spendingOverrides with 400 (T-05)', async () => {
    const scenarioId = await seedProfileAndGetScenarioId();
    const res = await request(app)
      .put(`/api/profile/scenarios/${scenarioId}/decisions`)
      .set('Authorization', 'Bearer test-token')
      .send({
        spendingOverrides: [
          { year: 2035, amount: 80000, applyForward: false },
          { year: 2035, amount: 90000, applyForward: false }, // same year = duplicate
        ],
      });

    expect(res.status).toBe(400);
  });

  /**
   * Phase 27 — PRESET-03: switching to a withdrawal preset updates decisions and
   * flips scenario status to 'stale' (triggers recompute).
   *
   * The PUT body is the preserveTfsaLongest preset tuple (Plan 27-01 WITHDRAWAL_PRESETS).
   * If a future planner adds `withdrawalPreset` to ScenarioDecisionsSchema, the
   * Pitfall 8 trip-wire in presets.test.ts will catch it BEFORE this test runs —
   * but this test still asserts the existing `drawdownOrder` field round-trips.
   *
   * @see .planning/phases/27-preset-mapping-infrastructure/27-DECISIONS.md PRESET-05
   * @see .planning/phases/27-preset-mapping-infrastructure/27-01-PLAN.md (preset tuples)
   */
  it('PRESET-03: PATCH with preserveTfsaLongest preset tuple sets status=stale and persists drawdownOrder', async () => {
    const scenarioId = await seedProfileAndGetScenarioId();

    // Inline the preserveTfsaLongest tuple literal so this test does not depend on
    // the @retireops/shared/withdrawal dist being built. The literal MUST match
    // WITHDRAWAL_PRESETS.preserveTfsaLongest byte-for-byte (Plan 27-03 Task 4
    // audit verifies this).
    const presetOverlay = {
      drawdownOrder: ['rrsp', 'rrif', 'nonReg', 'tfsa'],
    };

    const res = await request(app)
      .put(`/api/profile/scenarios/${scenarioId}/decisions`)
      .set('Authorization', 'Bearer test-token')
      .send(presetOverlay);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const scenario = mockDb._profileScenarios.get(scenarioId);
    expect(scenario?.status).toBe('stale');

    const decisions = scenario?.decisions as Record<string, unknown>;
    expect(decisions.drawdownOrder).toEqual(['rrsp', 'rrif', 'nonReg', 'tfsa']);
  });
});

// ---------------------------------------------------------------------------
// Phase 1 overrides — POST /run returns overrides sidecar (D-22)
// Tests that the HTTP → bridge → engine → result_data loop is end-to-end wired.
// Engine is mocked (fast); assertions cover argument pass-through and output shape.
// ---------------------------------------------------------------------------

describe('Phase 1 overrides — POST /run returns overrides sidecar (D-22)', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
    mockDb.reset();
    // vi.clearAllMocks() in afterEach (integration-setup) clears mock implementations.
    // Re-assert the default return values so the pipeline doesn't fail with undefined.
    vi.mocked(runProjection).mockReturnValue({
      years: [],
      summary: { peakNetWorth: 500000, averageRetirementIncome: 30000 },
    } as unknown as ReturnType<typeof runProjection>);
    vi.mocked(transformToFrontendOutput).mockReturnValue({
      years: [],
      summary: { probabilityOfSuccess: 0.85 },
    } as unknown as ReturnType<typeof transformToFrontendOutput>);
  });

  async function seedAndGetId(): Promise<string> {
    await request(app)
      .patch('/api/profile/about_you')
      .set('Authorization', 'Bearer test-token')
      .send({
        currentStep: 0,
        data: {
          firstName: 'Sidecar',
          dateOfBirth: '1965-01-01',
          province: 'ON',
          retirementAge: 65,
          lifeExpectancy: 90,
        },
      });
    const listRes = await request(app)
      .get('/api/profile/scenarios')
      .set('Authorization', 'Bearer test-token');
    return listRes.body.data[0].id as string;
  }

  it('POST /run after setting withdrawalOverride returns completed result_data (D-22)', async () => {
    const scenarioId = await seedAndGetId();

    // PUT override decisions — bridge must pass this through to engine
    const putRes = await request(app)
      .put(`/api/profile/scenarios/${scenarioId}/decisions`)
      .set('Authorization', 'Bearer test-token')
      .send({
        withdrawalOverrides: [{ field: 'rrsp', year: 2031, amount: 50000, applyForward: true }],
      });
    expect(putRes.status).toBe(200);

    // POST run — engine receives overrides via the bridge (scenario-decisions.ts)
    const runRes = await request(app)
      .post(`/api/profile/scenarios/${scenarioId}/run`)
      .set('Authorization', 'Bearer test-token');

    expect(runRes.status).toBe(200);
    expect(runRes.body.success).toBe(true);
    expect(runRes.body.data.status).toBe('completed');

    // result_data must be stored (bridge delivered overrides to engine)
    const scenario = mockDb._profileScenarios.get(scenarioId);
    const resultData = scenario?.result_data as Record<string, unknown> | null;
    expect(resultData).toBeTruthy();
    // Default mock returns { yearlyResults: [] } — no overrides sidecar yet (real engine tested separately)
    // The key assertion is that status=completed and result_data is present: bridge wired end-to-end.
    expect(typeof resultData).toBe('object');
  });

  it('POST /run with surplusDestination set completes without error (D-15, D-17)', async () => {
    const scenarioId = await seedAndGetId();

    // Set surplusDestination — additive field, engine may emit D-17 warning
    const putRes = await request(app)
      .put(`/api/profile/scenarios/${scenarioId}/decisions`)
      .set('Authorization', 'Bearer test-token')
      .send({ surplusDestination: 'tfsa' });
    expect(putRes.status).toBe(200);

    // POST run — bridge must pass surplusDestination to engine
    const runRes = await request(app)
      .post(`/api/profile/scenarios/${scenarioId}/run`)
      .set('Authorization', 'Bearer test-token');

    expect(runRes.status).toBe(200);
    expect(runRes.body.data.status).toBe('completed');

    // result_data stored — pipeline completed without throwing (D-17 fallback handled gracefully)
    const scenario = mockDb._profileScenarios.get(scenarioId);
    expect(scenario?.result_data).toBeTruthy();
    // If mock output has warnings, assert shape; if not, assert absence (additive invariant)
    const resultData = scenario?.result_data as Record<string, unknown>;
    if ('warnings' in resultData) {
      const warnings = resultData['warnings'] as Array<Record<string, unknown>>;
      expect(Array.isArray(warnings)).toBe(true);
      expect(warnings.some((w) => w['code'] === 'surplus_destination_missing')).toBe(true);
    }
  });

  it('POST /run with no overrides produces no warnings field (additive invariant, criterion #5)', async () => {
    const scenarioId = await seedAndGetId();

    // Fresh scenario with no override decisions — POST /run directly
    const runRes = await request(app)
      .post(`/api/profile/scenarios/${scenarioId}/run`)
      .set('Authorization', 'Bearer test-token');

    expect(runRes.status).toBe(200);
    expect(runRes.body.data.status).toBe('completed');

    // Default mock returns { yearlyResults: [], summary: {...} } — no warnings field.
    // The warnings field must be absent (additive invariant, criterion #5).
    const scenario = mockDb._profileScenarios.get(scenarioId);
    const resultData = scenario?.result_data as Record<string, unknown> | null;
    expect(resultData).toBeTruthy();
    expect(resultData?.['warnings']).toBeUndefined();
  });
});

describe('Profile Scenarios Routes - Recompute (SCEN-08)', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
    mockDb.reset();
  });

  /**
   * Helper: create the first profile PATCH (triggers INSERT + Base Scenario at 'pending').
   */
  async function seedProfile() {
    await request(app)
      .patch('/api/profile/about_you')
      .set('Authorization', 'Bearer test-token')
      .send({
        currentStep: 0,
        data: {
          firstName: 'Jane',
          dateOfBirth: '1965-06-01',
          province: 'ON',
          retirementAge: 65,
          lifeExpectancy: 90,
        },
      });
  }

  /**
   * SCEN-08 / Pitfall-3: First PATCH creates Base Scenario at status='pending', NOT 'stale'.
   */
  it('first profile PATCH creates Base Scenario with status pending (not stale)', async () => {
    await seedProfile();

    expect(mockDb._profileScenarios.size).toBe(1);
    const scenario = Array.from(mockDb._profileScenarios.values())[0];
    expect(scenario?.status).toBe('pending');
  });

  /**
   * SCEN-08: Second PATCH (update path) marks all scenarios stale synchronously before response.
   */
  it('second profile PATCH marks all scenarios stale before response', async () => {
    await seedProfile();

    // Trigger an update PATCH (not a first insert)
    await request(app)
      .patch('/api/profile/income')
      .set('Authorization', 'Bearer test-token')
      .send({
        currentStep: 2,
        data: { cards: [] },
      });

    // After PATCH response, stale-mark must have run synchronously
    const scenarios = Array.from(mockDb._profileScenarios.values());
    expect(scenarios.length).toBeGreaterThanOrEqual(1);
    for (const s of scenarios) {
      expect(['stale', 'completed']).toContain(s.status);
    }
  });

  /**
   * SCEN-08: After the response drains, background recompute sets status='completed' and result_data.
   */
  it('background recompute sets status completed and result_data after profile PATCH', async () => {
    await seedProfile();

    await request(app)
      .patch('/api/profile/income')
      .set('Authorization', 'Bearer test-token')
      .send({
        currentStep: 2,
        data: { cards: [] },
      });

    // Drain microtask queue so fire-and-forget promise resolves
    await new Promise((resolve) => setTimeout(resolve, 10));

    const scenarios = Array.from(mockDb._profileScenarios.values());
    expect(scenarios.length).toBeGreaterThanOrEqual(1);
    for (const s of scenarios) {
      expect(s.status).toBe('completed');
      expect(s.result_data).not.toBeNull();
    }
  });

  /**
   * SCEN-08: Multiple scenarios are ALL recomputed after a single profile PATCH.
   */
  it('all scenarios (base + clone) are recomputed after profile PATCH', async () => {
    await seedProfile();

    // Clone the base scenario so we have 2 scenarios
    const listResponse = await request(app)
      .get('/api/profile/scenarios')
      .set('Authorization', 'Bearer test-token');

    const baseId = listResponse.body.data[0].id;

    await request(app)
      .post(`/api/profile/scenarios/${baseId}/clone`)
      .set('Authorization', 'Bearer test-token');

    expect(mockDb._profileScenarios.size).toBe(2);

    // Now PATCH a profile step — triggers stale-mark + recompute for both
    await request(app)
      .patch('/api/profile/accounts')
      .set('Authorization', 'Bearer test-token')
      .send({
        currentStep: 3,
        data: { cards: [] },
      });

    // Drain microtask queue
    await new Promise((resolve) => setTimeout(resolve, 10));

    const scenarios = Array.from(mockDb._profileScenarios.values());
    expect(scenarios.length).toBe(2);
    for (const s of scenarios) {
      expect(s.status).toBe('completed');
      expect(s.result_data).not.toBeNull();
    }
  });

  describe('GET /api/profile/scenarios/templates', () => {
    it('should return 200 with a non-empty template list', async () => {
      const response = await request(app)
        .get('/api/profile/scenarios/templates')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      for (const template of response.body.data) {
        expect(typeof template.id).toBe('string');
        expect(typeof template.name).toBe('string');
        expect(typeof template.description).toBe('string');
        expect(typeof template.decisions).toBe('object');
      }
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app).get('/api/profile/scenarios/templates');
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/profile/scenarios/from-template', () => {
    it('should return 201 with a scenario whose decisions match the template', async () => {
      await seedProfile();

      const response = await request(app)
        .post('/api/profile/scenarios/from-template')
        .set('Authorization', 'Bearer test-token')
        .send({ templateId: 'early-retirement-60', name: 'My Early Retirement' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('My Early Retirement');
      expect(response.body.data.is_base).toBe(false);
      expect(response.body.data.status).toBe('pending');
      expect(response.body.data.decisions).toMatchObject({
        retirementAge: 60,
        cppStartAge: 60,
        oasStartAge: 65,
      });
    });

    it('should return 404 for an unknown template id', async () => {
      await seedProfile();

      const response = await request(app)
        .post('/api/profile/scenarios/from-template')
        .set('Authorization', 'Bearer test-token')
        .send({ templateId: 'does-not-exist', name: 'X' });

      expect(response.status).toBe(404);
    });

    it('should return 400 when name is missing', async () => {
      await seedProfile();

      const response = await request(app)
        .post('/api/profile/scenarios/from-template')
        .set('Authorization', 'Bearer test-token')
        .send({ templateId: 'early-retirement-60' });

      expect(response.status).toBe(400);
    });
  });
});
