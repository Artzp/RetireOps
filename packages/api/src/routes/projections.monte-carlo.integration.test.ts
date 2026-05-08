/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/unbound-method */
/**
 * Monte Carlo API Integration Tests
 *
 * Uses integration-setup.ts (mocked auth, mockDb, mocked Redis).
 * Queues are mocked locally since they're not in the integration setup.
 *
 * @see docs/TESTABLE-SURFACES.md - TC-MC-API-001, TC-MC-API-002, TC-MC-API-003
 * @see specs/009-monte-carlo-simulation/contracts/api.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

// Mock the queues module — not in integration-setup.ts
vi.mock('../queues.js', () => ({
  monteCarloQueue: {
    add: vi.fn().mockResolvedValue({ id: 'bullmq-job-id' }),
    getJob: vi.fn().mockResolvedValue(null),
  },
}));

import { createTestApp, TEST_USER } from '../test/helpers/test-app.js';
import { mockDb } from '../test/helpers/mock-db.js';
import { monteCarloQueue } from '../queues.js';

const PROJ_ID = 'aaaaaaaa-0001-4000-a000-000000000001';
const JOB_ID = 'bbbbbbbb-0001-4000-b000-000000000002';

function mockSelectChain(returnValue: unknown) {
  const chain: any = {
    selectAll: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue(returnValue),
    executeTakeFirstOrThrow: vi.fn().mockResolvedValue(returnValue),
    execute: vi.fn().mockResolvedValue(returnValue ? [returnValue] : []),
  };
  return chain;
}

const mockProjection = {
  id: PROJ_ID,
  user_id: TEST_USER.id,
  name: 'Test Projection',
  description: null,
  input_data: { personalInfo: { retirementAge: 65, lifeExpectancy: 90 } },
  result_data: null,
  status: 'completed',
  calculated_at: new Date(),
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
};

const mockMCJob = {
  id: JOB_ID,
  projection_id: PROJ_ID,
  status: 'processing',
  progress: 50,
  result_data: null,
  started_at: new Date(),
  completed_at: null,
  error_message: null,
};

describe('Monte Carlo API Integration Tests', () => {
  let app: Express;

  beforeEach(() => {
    vi.mocked(monteCarloQueue.add).mockResolvedValue({ id: 'bullmq-job-id' } as any);
    vi.mocked(monteCarloQueue.getJob).mockResolvedValue(undefined);
    app = createTestApp();
  });

  describe('POST /api/projections/:id/monte-carlo', () => {
    it('TC-MC-API-001: returns 202 with jobId, status=pending, progress=0', async () => {
      // Setup: projection exists and belongs to TEST_USER
      vi.spyOn(mockDb as any, 'selectFrom').mockReturnValue(mockSelectChain(mockProjection));
      vi.spyOn(mockDb as any, 'insertInto').mockReturnValue({
        values: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(undefined),
        returning: vi.fn().mockReturnThis(),
        executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: JOB_ID }),
      });

      const response = await request(app)
        .post(`/api/projections/${PROJ_ID}/monte-carlo`)
        .set('Authorization', 'Bearer test-token')
        .send({
          numSimulations: 1000,
          expectedReturn: 0.065,
          volatility: 0.11,
        });

      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('pending');
      expect(response.body.data.progress).toBe(0);
      expect(typeof response.body.data.jobId).toBe('string');
    });

    it('TC-MC-API-001: returns 401 without auth token', async () => {
      const response = await request(app).post(`/api/projections/${PROJ_ID}/monte-carlo`).send({
        numSimulations: 1000,
        expectedReturn: 0.065,
        volatility: 0.11,
      });

      expect(response.status).toBe(401);
    });

    it('TC-MC-API-001: returns 400 when numSimulations is below minimum (999)', async () => {
      const response = await request(app)
        .post(`/api/projections/${PROJ_ID}/monte-carlo`)
        .set('Authorization', 'Bearer test-token')
        .send({
          numSimulations: 999,
          expectedReturn: 0.065,
          volatility: 0.11,
        });

      expect(response.status).toBe(400);
    });

    it('TC-MC-API-001: returns 400 when numSimulations exceeds maximum (10001)', async () => {
      const response = await request(app)
        .post(`/api/projections/${PROJ_ID}/monte-carlo`)
        .set('Authorization', 'Bearer test-token')
        .send({
          numSimulations: 10001,
          expectedReturn: 0.065,
          volatility: 0.11,
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/projections/:id/monte-carlo/:jobId', () => {
    it('TC-MC-API-002: returns 200 with status and progress', async () => {
      vi.spyOn(mockDb as any, 'selectFrom')
        .mockReturnValueOnce(mockSelectChain(mockProjection))
        .mockReturnValueOnce(mockSelectChain(mockMCJob));

      const response = await request(app)
        .get(`/api/projections/${PROJ_ID}/monte-carlo/${JOB_ID}`)
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBe(JOB_ID);
      expect(response.body.data.status).toBe('processing');
      expect(response.body.data.progress).toBe(50);
    });

    it('TC-MC-API-002: returns 401 without auth', async () => {
      const response = await request(app).get(`/api/projections/${PROJ_ID}/monte-carlo/${JOB_ID}`);

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/projections/:id/monte-carlo/:jobId', () => {
    it('TC-MC-API-003: returns 204 on successful cancel', async () => {
      const pendingJob = { ...mockMCJob, status: 'pending', progress: 0 };

      vi.spyOn(mockDb as any, 'selectFrom')
        .mockReturnValueOnce(mockSelectChain(mockProjection))
        .mockReturnValueOnce(mockSelectChain(pendingJob));
      vi.spyOn(mockDb as any, 'updateTable').mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(undefined),
      });

      const response = await request(app)
        .delete(`/api/projections/${PROJ_ID}/monte-carlo/${JOB_ID}`)
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(204);
    });

    it('TC-MC-API-003: returns 401 without auth', async () => {
      const response = await request(app).delete(
        `/api/projections/${PROJ_ID}/monte-carlo/${JOB_ID}`
      );

      expect(response.status).toBe(401);
    });
  });

  describe('GET after cancel', () => {
    it('TC-MC-API-003: returns status=cancelled after cancellation', async () => {
      const cancelledJob = {
        id: JOB_ID,
        projection_id: PROJ_ID,
        status: 'cancelled',
        progress: 0,
        result_data: null,
        started_at: null,
        completed_at: null,
        error_message: null,
      };

      vi.spyOn(mockDb as any, 'selectFrom')
        .mockReturnValueOnce(mockSelectChain(mockProjection))
        .mockReturnValueOnce(mockSelectChain(cancelledJob));

      const response = await request(app)
        .get(`/api/projections/${PROJ_ID}/monte-carlo/${JOB_ID}`)
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('cancelled');
    });
  });
});
