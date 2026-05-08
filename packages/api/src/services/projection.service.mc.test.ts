/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/unbound-method */
/**
 * Monte Carlo Service Unit Tests
 *
 * @see docs/TESTABLE-SURFACES.md - TC-MC-API-001, TC-MC-API-002, TC-MC-API-003
 * @see specs/009-monte-carlo-simulation/contracts/api.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db/connection
vi.mock('../db/connection.js', () => {
  const mockDb = {
    selectFrom: vi.fn(),
    insertInto: vi.fn(),
    updateTable: vi.fn(),
  };
  return { db: mockDb };
});

// Mock redis utils to avoid real Redis
vi.mock('../utils/redis.js', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
  },
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(undefined),
  deleteCache: vi.fn().mockResolvedValue(undefined),
  deleteCachePattern: vi.fn().mockResolvedValue(undefined),
}));

// Mock queues
vi.mock('../queues.js', () => ({
  monteCarloQueue: {
    add: vi.fn().mockResolvedValue({ id: 'bullmq-job-id' }),
    getJob: vi.fn().mockResolvedValue(undefined),
  },
}));

import { db } from '../db/connection.js';
import { monteCarloQueue } from '../queues.js';
import {
  submitMonteCarloJob,
  getMonteCarloJobStatus,
  cancelMonteCarloJob,
} from './projection.service.js';

// Helper: create mock Kysely chain
function mockSelectChain(returnValue: unknown) {
  const chain = {
    selectAll: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue(returnValue),
    executeTakeFirstOrThrow: vi.fn().mockResolvedValue(returnValue),
    execute: vi.fn().mockResolvedValue([returnValue]),
  };
  return chain;
}

function mockInsertChain() {
  return {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
    executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'new-id' }),
  };
}

function mockUpdateChain() {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
  };
}

const PROJ_ID = 'aaaaaaaa-0001-4000-a000-000000000001';
const JOB_ID = 'bbbbbbbb-0001-4000-b000-000000000001';
const USER_ID = 'cccccccc-0001-4000-c000-000000000001';

const mockProjection = {
  id: PROJ_ID,
  user_id: USER_ID,
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

describe('submitMonteCarloJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(monteCarloQueue.add).mockResolvedValue({ id: 'bullmq-id' } as any);
    vi.mocked(monteCarloQueue.getJob).mockResolvedValue(undefined);
  });

  it('TC-MC-API-001: happy path — inserts DB row, enqueues job, returns pending status', async () => {
    vi.mocked(db.selectFrom).mockReturnValue(mockSelectChain(mockProjection) as any);
    vi.mocked(db.insertInto).mockReturnValue(mockInsertChain() as any);

    const result = await submitMonteCarloJob(USER_ID, PROJ_ID, {
      numSimulations: 1000,
      expectedReturn: 0.065,
      volatility: 0.11,
    });

    expect(result.status).toBe('pending');
    expect(result.progress).toBe(0);
    expect(result.jobId).toBeDefined();
    expect(typeof result.jobId).toBe('string');

    // Should have enqueued BullMQ job
    expect(monteCarloQueue.add).toHaveBeenCalledOnce();
    const [jobName, payload] = vi.mocked(monteCarloQueue.add).mock.calls[0] as any[];
    expect(jobName).toMatch(/^mc-/);
    expect(payload.projectionId).toBe(PROJ_ID);
    expect(payload.numSimulations).toBe(1000);
  });

  it('TC-MC-API-001: throws NotFoundError when projection does not exist', async () => {
    vi.mocked(db.selectFrom).mockReturnValue(mockSelectChain(undefined) as any);

    await expect(
      submitMonteCarloJob(USER_ID, PROJ_ID, {
        numSimulations: 1000,
        expectedReturn: 0.065,
        volatility: 0.11,
      })
    ).rejects.toThrow('Projection');
  });

  it('TC-MC-API-001: throws AuthorizationError when projection belongs to different user', async () => {
    vi.mocked(db.selectFrom).mockReturnValue(
      mockSelectChain({ ...mockProjection, user_id: 'different-user-id' }) as any
    );

    await expect(
      submitMonteCarloJob(USER_ID, PROJ_ID, {
        numSimulations: 1000,
        expectedReturn: 0.065,
        volatility: 0.11,
      })
    ).rejects.toThrow();
  });
});

describe('getMonteCarloJobStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-MC-API-002: returns job status with progress', async () => {
    const mockJob = {
      id: JOB_ID,
      projection_id: PROJ_ID,
      status: 'processing',
      progress: 50,
      result_data: null,
      started_at: new Date(),
      completed_at: null,
      error_message: null,
    };

    // First call for getProjection (ownership check), second for job row
    vi.mocked(db.selectFrom)
      .mockReturnValueOnce(mockSelectChain(mockProjection) as any)
      .mockReturnValueOnce(mockSelectChain(mockJob) as any);

    const result = await getMonteCarloJobStatus(USER_ID, PROJ_ID, JOB_ID);

    expect(result.jobId).toBe(JOB_ID);
    expect(result.status).toBe('processing');
    expect(result.progress).toBe(50);
    expect(result.result).toBeUndefined();
  });

  it('TC-MC-API-002: returns result when status is completed', async () => {
    const completedResult = {
      numSimulations: 1000,
      successRate: 85,
      percentileBands: [],
      worstCaseTrials: [],
      params: { expectedReturn: 0.065, volatility: 0.11, numSimulations: 1000 },
      completedAt: new Date().toISOString(),
    };

    const mockJob = {
      id: JOB_ID,
      projection_id: PROJ_ID,
      status: 'completed',
      progress: 100,
      result_data: completedResult,
      started_at: new Date(),
      completed_at: new Date(),
      error_message: null,
    };

    vi.mocked(db.selectFrom)
      .mockReturnValueOnce(mockSelectChain(mockProjection) as any)
      .mockReturnValueOnce(mockSelectChain(mockJob) as any);

    const result = await getMonteCarloJobStatus(USER_ID, PROJ_ID, JOB_ID);

    expect(result.status).toBe('completed');
    expect(result.result).toBeDefined();
    expect(result.result?.successRate).toBe(85);
  });

  it('TC-MC-API-002: throws NotFoundError when job does not exist', async () => {
    vi.mocked(db.selectFrom)
      .mockReturnValueOnce(mockSelectChain(mockProjection) as any)
      .mockReturnValueOnce(mockSelectChain(undefined) as any);

    await expect(getMonteCarloJobStatus(USER_ID, PROJ_ID, JOB_ID)).rejects.toThrow(
      'Monte Carlo job'
    );
  });
});

describe('cancelMonteCarloJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(monteCarloQueue.getJob).mockResolvedValue(undefined);
  });

  it('TC-MC-API-003: sets status=cancelled in DB', async () => {
    const mockJob = {
      id: JOB_ID,
      projection_id: PROJ_ID,
      status: 'pending',
      progress: 0,
    };

    vi.mocked(db.selectFrom)
      .mockReturnValueOnce(mockSelectChain(mockProjection) as any)
      .mockReturnValueOnce(mockSelectChain(mockJob) as any);
    vi.mocked(db.updateTable).mockReturnValue(mockUpdateChain() as any);

    await cancelMonteCarloJob(USER_ID, PROJ_ID, JOB_ID);

    expect(db.updateTable).toHaveBeenCalledWith('monte_carlo_jobs');
    const updateCall = vi.mocked(db.updateTable).mock.results[0]?.value;
    expect(updateCall.set).toHaveBeenCalledWith({ status: 'cancelled' });
  });

  it('TC-MC-API-003: best-effort BullMQ removal — does not throw when getJob fails', async () => {
    const mockJob = {
      id: JOB_ID,
      projection_id: PROJ_ID,
      status: 'pending',
      progress: 0,
    };

    vi.mocked(db.selectFrom)
      .mockReturnValueOnce(mockSelectChain(mockProjection) as any)
      .mockReturnValueOnce(mockSelectChain(mockJob) as any);
    vi.mocked(db.updateTable).mockReturnValue(mockUpdateChain() as any);
    vi.mocked(monteCarloQueue.getJob).mockRejectedValue(new Error('Redis unavailable'));

    // Should not throw even when BullMQ removal fails
    await expect(cancelMonteCarloJob(USER_ID, PROJ_ID, JOB_ID)).resolves.toBeUndefined();
  });

  it('TC-MC-API-003: throws NotFoundError when job does not exist', async () => {
    vi.mocked(db.selectFrom)
      .mockReturnValueOnce(mockSelectChain(mockProjection) as any)
      .mockReturnValueOnce(mockSelectChain(undefined) as any);

    await expect(cancelMonteCarloJob(USER_ID, PROJ_ID, JOB_ID)).rejects.toThrow('Monte Carlo job');
  });
});
