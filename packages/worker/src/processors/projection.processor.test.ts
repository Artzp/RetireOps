/**
 * Projection Processor Unit Tests — retry idempotency guard (audit C-08).
 *
 * A BullMQ retry (failed attempt OR stalled delivery after a crash between the
 * DB write and the queue ack) must not recalculate and overwrite a projection
 * result whose calculated_at postdates the job's enqueue timestamp.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';

vi.mock('../db.js', () => ({
  getProjectionCalculatedAt: vi.fn(),
  updateProjectionResult: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@retireops/calculation-engine', () => ({
  runProjection: vi.fn().mockReturnValue({
    yearlyResults: [],
    summary: {
      peakNetWorth: 1000000,
      totalTaxesPaid: 250000,
      averageRetirementIncome: 60000,
      portfolioLongevityAge: 92,
    },
  }),
}));

import {
  processProjectionJob,
  shouldSkipRecalculation,
  type ProjectionJobData,
  type ProjectionJobResult,
} from './projection.processor.js';
import { getProjectionCalculatedAt, updateProjectionResult } from '../db.js';
import { runProjection } from '@retireops/calculation-engine';

const ENQUEUED_AT = new Date('2026-06-10T12:00:00Z').getTime();

function makeJob(overrides: Partial<Job<ProjectionJobData, ProjectionJobResult>> = {}) {
  return {
    id: 'job-1',
    timestamp: ENQUEUED_AT,
    attemptsMade: 0,
    stalledCounter: 0,
    data: {
      projectionId: 'proj-1',
      userId: 'user-1',
      inputData: { lifeExpectancy: 90 } as ProjectionJobData['inputData'],
    },
    ...overrides,
  } as Job<ProjectionJobData, ProjectionJobResult>;
}

describe('shouldSkipRecalculation (audit C-08 guard logic)', () => {
  const newerResult = new Date(ENQUEUED_AT + 60_000);
  const olderResult = new Date(ENQUEUED_AT - 60_000);

  it('never skips a first delivery, even when a newer result exists', () => {
    expect(
      shouldSkipRecalculation({
        attemptsMade: 0,
        stalledCounter: 0,
        enqueuedAtMs: ENQUEUED_AT,
        calculatedAt: newerResult,
      })
    ).toBe(false);
  });

  it('skips a failed-attempt retry when the stored result postdates enqueue', () => {
    expect(
      shouldSkipRecalculation({
        attemptsMade: 1,
        stalledCounter: 0,
        enqueuedAtMs: ENQUEUED_AT,
        calculatedAt: newerResult,
      })
    ).toBe(true);
  });

  it('skips a stalled re-delivery (crash between DB write and ack) when the stored result postdates enqueue', () => {
    // BullMQ increments stalledCounter (not attemptsMade) when a stalled job
    // is moved back to wait — the exact C-08 crash scenario.
    expect(
      shouldSkipRecalculation({
        attemptsMade: 0,
        stalledCounter: 1,
        enqueuedAtMs: ENQUEUED_AT,
        calculatedAt: newerResult,
      })
    ).toBe(true);
  });

  it('recalculates on retry when the stored result predates enqueue (stale row)', () => {
    expect(
      shouldSkipRecalculation({
        attemptsMade: 2,
        stalledCounter: 0,
        enqueuedAtMs: ENQUEUED_AT,
        calculatedAt: olderResult,
      })
    ).toBe(false);
  });

  it('recalculates on retry when the projection has never been calculated', () => {
    expect(
      shouldSkipRecalculation({
        attemptsMade: 1,
        stalledCounter: 1,
        enqueuedAtMs: ENQUEUED_AT,
        calculatedAt: null,
      })
    ).toBe(false);
  });

  it('recalculates when calculated_at equals the enqueue timestamp (strict postdate)', () => {
    expect(
      shouldSkipRecalculation({
        attemptsMade: 1,
        stalledCounter: 0,
        enqueuedAtMs: ENQUEUED_AT,
        calculatedAt: new Date(ENQUEUED_AT),
      })
    ).toBe(false);
  });
});

describe('processProjectionJob retry idempotency (audit C-08)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips recalculation and DB write on retry when the stored result is newer', async () => {
    const newer = new Date(ENQUEUED_AT + 5_000);
    vi.mocked(getProjectionCalculatedAt).mockResolvedValue(newer);

    const result = await processProjectionJob(makeJob({ attemptsMade: 1 }));

    expect(result.success).toBe(true);
    expect(result.projectionId).toBe('proj-1');
    expect(result.calculatedAt).toEqual(newer);
    expect(runProjection).not.toHaveBeenCalled();
    expect(updateProjectionResult).not.toHaveBeenCalled();
  });

  it('skips recalculation on a stalled re-delivery when the stored result is newer', async () => {
    const newer = new Date(ENQUEUED_AT + 5_000);
    vi.mocked(getProjectionCalculatedAt).mockResolvedValue(newer);

    const result = await processProjectionJob(makeJob({ stalledCounter: 1 }));

    expect(result.success).toBe(true);
    expect(runProjection).not.toHaveBeenCalled();
    expect(updateProjectionResult).not.toHaveBeenCalled();
  });

  it('recalculates on retry when the stored result predates enqueue', async () => {
    vi.mocked(getProjectionCalculatedAt).mockResolvedValue(new Date(ENQUEUED_AT - 5_000));

    const result = await processProjectionJob(makeJob({ attemptsMade: 1 }));

    expect(result.success).toBe(true);
    expect(runProjection).toHaveBeenCalledTimes(1);
    expect(updateProjectionResult).toHaveBeenCalledTimes(1);
  });

  it('does not query calculated_at on a first delivery', async () => {
    const result = await processProjectionJob(makeJob());

    expect(result.success).toBe(true);
    expect(getProjectionCalculatedAt).not.toHaveBeenCalled();
    expect(runProjection).toHaveBeenCalledTimes(1);
    expect(updateProjectionResult).toHaveBeenCalledTimes(1);
  });
});
