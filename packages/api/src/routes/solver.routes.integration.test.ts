/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * Solver Routes Integration Tests
 *
 * Tests the POST /api/solver and GET /api/solver/prefill endpoints end-to-end.
 *
 * @see docs/TESTABLE-SURFACES.md — TC-SOLVER-006, TC-SOLVER-007, TC-SOLVER-008
 * @see TESTING.md — Solver integration test scenarios
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../test/helpers/test-app.js';
import { mockDb } from '../test/helpers/mock-db.js';

describe('Solver Routes Integration Tests', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('POST /api/solver', () => {
    /**
     * TC-SOLVER-006: Valid Mode 1 (required-savings) input returns 200 with feasible SolverResult.
     * @see docs/TESTABLE-SURFACES.md — TC-SOLVER-006
     */
    it('should return 200 with SolverResult for valid Mode 1 input', async () => {
      const response = await request(app)
        .post('/api/solver')
        .set('Authorization', 'Bearer test-token')
        .send({
          mode: 'required-savings',
          province: 'ON',
          dateOfBirth: '1979-01-01',
          currentAge: 46,
          targetRetirementAge: 65,
          retirementSpending: 60000,
          rrspBalance: 200000,
          tfsaBalance: 50000,
          nonRegBalance: 0,
          employmentIncome: 100000,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.feasible).toBe(true);
      expect(response.body.data.solvedValue).toBeGreaterThan(0);
      expect(response.body.data.projectionSummary).toBeDefined();
      expect(response.body.data.mode).toBe('required-savings');
    });

    /**
     * TC-SOLVER-007: Mode 1 payload missing retirementSpending returns 422 with field-level error.
     * @see docs/TESTABLE-SURFACES.md — TC-SOLVER-007
     */
    it('should return 422 with field-level error for missing retirementSpending', async () => {
      const response = await request(app)
        .post('/api/solver')
        .set('Authorization', 'Bearer test-token')
        .send({
          mode: 'required-savings',
          province: 'ON',
          dateOfBirth: '1979-01-01',
          currentAge: 46,
          targetRetirementAge: 65,
          // retirementSpending intentionally omitted
          rrspBalance: 200000,
          tfsaBalance: 50000,
          nonRegBalance: 0,
          employmentIncome: 100000,
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNPROCESSABLE_ENTITY');
      // Field-level error must reference retirementSpending
      const details = response.body.error.details as Array<{ path: string; message: string }>;
      expect(details.some((d: { path: string }) => d.path.includes('retirementSpending'))).toBe(
        true
      );
    });

    it('should return 422 for empty body', async () => {
      const response = await request(app)
        .post('/api/solver')
        .set('Authorization', 'Bearer test-token')
        .send({});

      expect(response.status).toBe(422);
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app).post('/api/solver').send({
        mode: 'required-savings',
        province: 'ON',
        dateOfBirth: '1979-01-01',
        currentAge: 46,
        targetRetirementAge: 65,
        retirementSpending: 60000,
        rrspBalance: 200000,
        tfsaBalance: 50000,
        nonRegBalance: 0,
        employmentIncome: 100000,
      });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/solver/prefill', () => {
    /**
     * TC-SOLVER-008: Prefill returns 8 fields from household profile (or null when no profile)
     * @see docs/TESTABLE-SURFACES.md — TC-SOLVER-008
     */
    it('should return 200 with 8 prefill fields for user with profile', async () => {
      // Seed a household profile directly into mockDb
      mockDb._householdProfiles.set('profile-1', {
        id: 'profile-1',
        user_id: 'test-user-uuid-1234-5678-abcd', // matches TEST_USER.id
        step_data: {
          about_you: { dateOfBirth: '1979-01-01', province: 'ON' },
          accounts: {
            cards: [
              { type: 'RRSP', currentBalance: 200000 },
              { type: 'TFSA', currentBalance: 50000 },
              { type: 'Non-Registered', currentBalance: 10000 },
            ],
          },
          income: {
            cards: [{ type: 'Employment Salary', annualAmount: 100000 }],
          },
          benefits: {},
        },
        current_step: 7,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const response = await request(app)
        .get('/api/solver/prefill')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      const data = response.body.data;
      expect(data).not.toBeNull();
      expect(data.province).toBe('ON');
      expect(data.currentAge).toBeGreaterThanOrEqual(46); // born 1979, test runs in 2026
      expect(data.rrspBalance).toBe(200000);
      expect(data.tfsaBalance).toBe(50000);
      expect(data.nonRegBalance).toBe(10000);
      expect(data.employmentIncome).toBe(100000);
      expect(data.cppStartAge).toBe(65);
      expect(data.oasStartAge).toBe(65);
      // Exactly 8 fields
      expect(Object.keys(data)).toHaveLength(8);
    });

    it('should return 200 with null data when user has no profile', async () => {
      // mockDb is reset after each test in integration-setup.ts (no profile seeded here)
      const response = await request(app)
        .get('/api/solver/prefill')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeNull();
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app).get('/api/solver/prefill');

      expect(response.status).toBe(401);
    });
  });
});
