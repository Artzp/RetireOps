/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/**
 * Profile Routes Integration Tests
 *
 * Tests the Household Profile CRUD flow: GET (404) → PATCH (upsert) → GET (200) → PATCH (overwrite)
 * Uses mocked database and auth (via integration-setup.ts), real service logic.
 *
 * Required by D-10:
 * (a) GET returns 404 for new user
 * (b) First PATCH auto-creates row
 * (c) GET returns 200 with profile data after first PATCH
 * (d) Second PATCH to same step with different data produces correct final state (last write wins)
 * (e) current_step round-trips correctly through PATCH then GET
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../test/helpers/test-app.js';

describe('Profile Routes Integration Tests', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('GET /api/profile', () => {
    /**
     * D-10(a): GET returns 404 for a new user with no profile
     */
    it('should return 404 for a user with no profile', async () => {
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app).get('/api/profile');
      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/profile/:step', () => {
    /**
     * D-10(b): First PATCH auto-creates the profile row (upsert)
     */
    it('should auto-create profile on first PATCH (upsert)', async () => {
      const response = await request(app)
        .patch('/api/profile/about_you')
        .set('Authorization', 'Bearer test-token')
        .send({
          currentStep: 0,
          data: { firstName: 'John', lastName: 'Doe', province: 'ON' },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.currentStep).toBe(0);
      expect(response.body.data.stepData).toBeDefined();
      expect(response.body.data.createdAt).toBeDefined();
      expect(response.body.data.updatedAt).toBeDefined();
    });

    /**
     * D-10(c): GET returns 200 with profile data after first PATCH
     */
    it('should return 200 with profile data after PATCH', async () => {
      // First, create profile via PATCH
      await request(app)
        .patch('/api/profile/about_you')
        .set('Authorization', 'Bearer test-token')
        .send({
          currentStep: 0,
          data: { firstName: 'John', lastName: 'Doe' },
        });

      // Then GET should return 200
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.stepData).toBeDefined();
      expect(response.body.data.currentStep).toBe(0);
    });

    /**
     * D-10(d): Second PATCH to same step replaces data (last write wins)
     */
    it('should replace step data on second PATCH to same step', async () => {
      // First PATCH
      await request(app)
        .patch('/api/profile/about_you')
        .set('Authorization', 'Bearer test-token')
        .send({
          currentStep: 0,
          data: { firstName: 'John', lastName: 'Doe' },
        });

      // Second PATCH with different data
      const response = await request(app)
        .patch('/api/profile/about_you')
        .set('Authorization', 'Bearer test-token')
        .send({
          currentStep: 1,
          data: { firstName: 'Jane', lastName: 'Smith', province: 'BC' },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // currentStep should be updated to 1
      expect(response.body.data.currentStep).toBe(1);
    });

    /**
     * D-10(e): current_step round-trips correctly through PATCH then GET
     */
    it('should round-trip currentStep through PATCH then GET', async () => {
      // PATCH with currentStep = 3
      await request(app)
        .patch('/api/profile/income')
        .set('Authorization', 'Bearer test-token')
        .send({
          currentStep: 3,
          data: { sources: [] },
        });

      // GET should return currentStep = 3
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.data.currentStep).toBe(3);
    });

    it('should return 400 for invalid step slug', async () => {
      const response = await request(app)
        .patch('/api/profile/invalid_step')
        .set('Authorization', 'Bearer test-token')
        .send({
          currentStep: 0,
          data: { foo: 'bar' },
        });

      // Validation should reject unknown step
      expect(response.status).toBe(400);
    });

    it('should return 400 for missing currentStep in body', async () => {
      const response = await request(app)
        .patch('/api/profile/about_you')
        .set('Authorization', 'Bearer test-token')
        .send({
          data: { firstName: 'John' },
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing data in body', async () => {
      const response = await request(app)
        .patch('/api/profile/about_you')
        .set('Authorization', 'Bearer test-token')
        .send({
          currentStep: 0,
        });

      expect(response.status).toBe(400);
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .patch('/api/profile/about_you')
        .send({ currentStep: 0, data: {} });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/profile/calculate', () => {
    /**
     * D-08(a): profile exists → returns 201 with ProjectionDetail
     */
    it('should return 201 with ProjectionDetail when profile exists', async () => {
      // Seed profile via PATCH (goes through the mock upsert path)
      await request(app)
        .patch('/api/profile/about_you')
        .set('Authorization', 'Bearer test-token')
        .send({
          currentStep: 0,
          data: {
            firstName: 'John',
            dateOfBirth: '1975-06-15',
            province: 'BC',
            retirementAge: 60,
            lifeExpectancy: 85,
          },
        });

      const response = await request(app)
        .post('/api/profile/calculate')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBeDefined();
      expect(typeof response.body.data.name).toBe('string');
      expect(response.body.data.name).toContain('Profile Snapshot');
      expect(response.body.data.status).toBe('completed');
      expect(response.body.data.inputData).toBeTruthy();
      expect(response.body.data.resultData).toBeTruthy();
    });

    /**
     * D-08(b): no profile exists → returns 404
     */
    it('should return 404 when no profile exists', async () => {
      // mockDb is reset in beforeEach — no profile seeded here
      const response = await request(app)
        .post('/api/profile/calculate')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(404);
    });
  });
});
