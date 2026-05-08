/* eslint-disable @typescript-eslint/unbound-method */
/**
 * Monte Carlo Processor Unit Tests
 *
 * @see docs/TESTABLE-SURFACES.md - TC-MC-WORKER-001
 * @see specs/009-monte-carlo-simulation/contracts/api.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';

// Mock db module before importing processor
function makeMockProjectionRow() {
  return {
    id: 'proj-id-1234',
    input_data: {
      personalInfo: { retirementAge: 65, lifeExpectancy: 90 },
      accounts: [{ balance: 500000 }, { balance: 100000 }],
      expenses: { retirementAnnualExpenses: 45000 },
    },
    result_data: {
      assumptions: { inflationRate: 0.025 },
      projectionRows: [
        { isRetired: false, totalNetWorth: 800000, livingExpenses: 50000 },
        { isRetired: false, totalNetWorth: 1200000, livingExpenses: 50000 },
        {
          isRetired: true,
          totalNetWorth: 1150000,
          livingExpenses: 60000,
          pensionIncome: 20000,
          cppIncome: 0,
          oasIncome: 8000,
        },
        {
          isRetired: true,
          totalNetWorth: 1100000,
          livingExpenses: 60000,
          pensionIncome: 20000,
          cppIncome: 0,
          oasIncome: 8000,
        },
      ],
    },
  };
}

vi.mock('../db.js', () => ({
  db: {
    selectFrom: vi.fn().mockReturnValue({
      selectAll: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(makeMockProjectionRow()),
    }),
    updateTable: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(undefined),
    }),
  },
  updateMonteCarloProgress: vi.fn().mockResolvedValue(undefined),
  updateMonteCarloResult: vi.fn().mockResolvedValue(undefined),
}));

// Mock calculation engine
vi.mock('@retireops/calculation-engine', () => ({
  runMonteCarloEngineWithInflation: vi.fn().mockReturnValue({
    numSimulations: 1000,
    successRate: 0.85,
    percentileBands: [
      { year: 1, age: 66, p10: 100000, p25: 200000, p50: 350000, p75: 500000, p90: 650000 },
    ],
    worstCaseTrials: [{ trialId: 1, depletionYear: null, finalBalance: 50000, returnSequence: [] }],
  }),
}));

import { processMonteCarloJob, type MonteCarloJobData } from './monte-carlo.processor.js';
import { updateMonteCarloProgress, updateMonteCarloResult, db } from '../db.js';
import { runMonteCarloEngineWithInflation } from '@retireops/calculation-engine';

describe('processMonteCarloJob', () => {
  const mockJobData: MonteCarloJobData = {
    projectionId: 'proj-id-1234',
    jobId: 'db-job-id-5678',
    numSimulations: 1000,
    expectedReturn: 0.065,
    volatility: 0.11,
  };

  const makeJob = (data: MonteCarloJobData) =>
    ({
      id: 'bullmq-job-id',
      data,
      updateProgress: vi.fn().mockResolvedValue(undefined),
    }) as unknown as Job<MonteCarloJobData>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup default mocks after clearAllMocks
    vi.mocked(updateMonteCarloProgress).mockResolvedValue(undefined);
    vi.mocked(updateMonteCarloResult).mockResolvedValue(undefined);
    vi.mocked(runMonteCarloEngineWithInflation).mockReturnValue({
      numSimulations: 1000,
      successRate: 0.85,
      percentileBands: [
        { year: 1, age: 66, p10: 100000, p25: 200000, p50: 350000, p75: 500000, p90: 650000 },
      ],
      worstCaseTrials: [
        { trialId: 1, depletionYear: null, finalBalance: 50000, returnSequence: [] },
      ],
    });

    // Re-setup db mock
    const mockExecuteTakeFirst = vi.fn().mockResolvedValue(makeMockProjectionRow());
    const mockWhere = vi.fn().mockReturnThis();
    vi.mocked(db.selectFrom).mockReturnValue({
      selectAll: vi.fn().mockReturnThis(),
      where: mockWhere,
      executeTakeFirst: mockExecuteTakeFirst,
    } as any);
    vi.mocked(db.updateTable).mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(undefined),
    } as any);
  });

  describe('TC-MC-WORKER-001: Happy path', () => {
    it('should call updateMonteCarloResult with status=completed and a MonteCarloJobResult shape', async () => {
      const job = makeJob(mockJobData);
      const result = await processMonteCarloJob(job);

      expect(result).toMatchObject({
        numSimulations: 1000,
        successRate: 85, // 0.85 * 100
        params: {
          expectedReturn: 0.065,
          volatility: 0.11,
          numSimulations: 1000,
        },
        completedAt: expect.any(String),
      });

      expect(updateMonteCarloResult).toHaveBeenCalledWith(
        'db-job-id-5678',
        expect.objectContaining({
          numSimulations: 1000,
          successRate: 85,
        }),
        'completed'
      );
    });

    it('should call runMonteCarloEngineWithInflation with net-of-guaranteed-income withdrawal', async () => {
      const job = makeJob(mockJobData);
      await processMonteCarloJob(job);

      // livingExpenses 60000 - (pension 20000 + cpp 0 + oas 8000) = 32000
      expect(runMonteCarloEngineWithInflation).toHaveBeenCalledWith(
        1200000, // totalNetWorth of last pre-retirement row
        32000, // net withdrawal after guaranteed income
        0.025, // inflation rate from result_data.assumptions
        25, // lifeExpectancy(90) - retirementAge(65)
        {
          numSimulations: 1000,
          expectedReturn: 0.065,
          volatility: 0.11,
        }
      );
    });

    it('should call job.updateProgress at least twice (0 and 100)', async () => {
      const job = makeJob(mockJobData);
      await processMonteCarloJob(job);

      expect(job.updateProgress).toHaveBeenCalledTimes(3); // 0, 50, 100
      const calls = vi.mocked(job.updateProgress).mock.calls;
      const firstCall = calls[0];
      const lastCall = calls[2];
      expect(firstCall?.[0]).toBe(0);
      expect(lastCall?.[0]).toBe(100);
    });

    it('should call updateMonteCarloProgress at DB level during processing', async () => {
      const job = makeJob(mockJobData);
      await processMonteCarloJob(job);

      expect(updateMonteCarloProgress).toHaveBeenCalledTimes(3); // 0, 50, 100
    });
  });

  describe('TC-MC-WORKER-001: Error path', () => {
    it('should call updateMonteCarloResult with status=failed when engine throws', async () => {
      vi.mocked(runMonteCarloEngineWithInflation).mockImplementation(() => {
        throw new Error('Simulation failed: out of memory');
      });

      const job = makeJob(mockJobData);

      await expect(processMonteCarloJob(job)).rejects.toThrow('Simulation failed: out of memory');

      expect(updateMonteCarloResult).toHaveBeenCalledWith(
        'db-job-id-5678',
        null,
        'failed',
        'Simulation failed: out of memory'
      );
    });

    it('should call updateMonteCarloResult with failed when projection is not found', async () => {
      vi.mocked(db.selectFrom).mockReturnValue({
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue(undefined),
      } as any);

      const job = makeJob(mockJobData);

      await expect(processMonteCarloJob(job)).rejects.toThrow();

      expect(updateMonteCarloResult).toHaveBeenCalledWith(
        'db-job-id-5678',
        null,
        'failed',
        'Projection not found'
      );
    });
  });

  describe('TC-MC-WORKER-002: Fallback to input_data when result_data has no projectionRows', () => {
    it('should use account balances and retirementAnnualExpenses as fallback', async () => {
      vi.mocked(db.selectFrom).mockReturnValue({
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue({
          id: 'proj-id-1234',
          input_data: {
            personalInfo: { retirementAge: 60, lifeExpectancy: 85 },
            accounts: [{ balance: 300000 }, { balance: 200000 }],
            expenses: { retirementAnnualExpenses: 35000 },
          },
          result_data: null,
        }),
      } as any);

      const job = makeJob(mockJobData);
      await processMonteCarloJob(job);

      expect(runMonteCarloEngineWithInflation).toHaveBeenCalledWith(
        500000, // sum of accounts: 300000 + 200000
        35000, // retirementAnnualExpenses (no projectionRows → gross fallback used)
        0.025, // default inflation rate
        25, // lifeExpectancy(85) - retirementAge(60)
        expect.objectContaining({ numSimulations: 1000 })
      );
    });
  });

  describe('TC-MC-WORKER-007: Net withdrawal excludes guaranteed income', () => {
    it('reproduces the reference scenario (pension + OAS + CPP) net draw', async () => {
      // Reference household: pension $42,660, OAS $18,003, CPP $0, living $140k,
      // $1.85M portfolio. The deterministic projection shows the portfolio growing,
      // so MC should be given the net portfolio draw (~$79,337), not gross spending.
      vi.mocked(db.selectFrom).mockReturnValue({
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue({
          id: 'proj-ref-1',
          input_data: {
            personalInfo: { retirementAge: 65, lifeExpectancy: 90 },
            accounts: [{ balance: 1_850_000 }],
            expenses: { retirementAnnualExpenses: 140_000 },
          },
          result_data: {
            assumptions: { inflationRate: 0.025 },
            projectionRows: [
              { isRetired: false, totalNetWorth: 1_850_000, livingExpenses: 140_000 },
              {
                isRetired: true,
                totalNetWorth: 1_850_000,
                livingExpenses: 140_000,
                pensionIncome: 42_660,
                cppIncome: 0,
                oasIncome: 18_003,
              },
            ],
          },
        }),
      } as any);

      const job = makeJob(mockJobData);
      await processMonteCarloJob(job);

      expect(runMonteCarloEngineWithInflation).toHaveBeenCalledWith(
        1_850_000,
        140_000 - (42_660 + 0 + 18_003), // 79_337
        0.025,
        25,
        expect.objectContaining({ numSimulations: 1000 })
      );
    });
  });

  describe('TC-MC-WORKER-008: Default inflation when assumptions missing', () => {
    it('defaults to 0.025 when result_data.assumptions is absent', async () => {
      vi.mocked(db.selectFrom).mockReturnValue({
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue({
          id: 'proj-default-infl',
          input_data: {
            personalInfo: { retirementAge: 65, lifeExpectancy: 90 },
            accounts: [{ balance: 1_000_000 }],
            expenses: { retirementAnnualExpenses: 50_000 },
          },
          result_data: {
            projectionRows: [
              { isRetired: false, totalNetWorth: 1_000_000, livingExpenses: 50_000 },
              { isRetired: true, totalNetWorth: 1_000_000, livingExpenses: 50_000 },
            ],
          },
        }),
      } as any);

      const job = makeJob(mockJobData);
      await processMonteCarloJob(job);

      expect(runMonteCarloEngineWithInflation).toHaveBeenCalledWith(
        1_000_000,
        50_000,
        0.025,
        25,
        expect.objectContaining({ numSimulations: 1000 })
      );
    });
  });

  describe('TC-MC-WORKER-009: Net withdrawal clamps at zero', () => {
    it('clamps to 0 when guaranteed income exceeds living expenses', async () => {
      vi.mocked(db.selectFrom).mockReturnValue({
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue({
          id: 'proj-clamp',
          input_data: {
            personalInfo: { retirementAge: 65, lifeExpectancy: 90 },
            accounts: [{ balance: 500_000 }],
            expenses: { retirementAnnualExpenses: 30_000 },
          },
          result_data: {
            assumptions: { inflationRate: 0.02 },
            projectionRows: [
              { isRetired: false, totalNetWorth: 500_000, livingExpenses: 30_000 },
              {
                isRetired: true,
                totalNetWorth: 500_000,
                livingExpenses: 30_000,
                pensionIncome: 25_000,
                cppIncome: 12_000,
                oasIncome: 8_000,
              },
            ],
          },
        }),
      } as any);

      const job = makeJob(mockJobData);
      await processMonteCarloJob(job);

      expect(runMonteCarloEngineWithInflation).toHaveBeenCalledWith(
        500_000,
        0, // livingExpenses 30k − guaranteed 45k → clamped
        0.02,
        25,
        expect.objectContaining({ numSimulations: 1000 })
      );
    });
  });

  describe('MonteCarloJobData interface', () => {
    it('should have the expected shape', () => {
      const data: MonteCarloJobData = {
        projectionId: 'proj-uuid',
        jobId: 'job-uuid',
        numSimulations: 1000,
        expectedReturn: 0.07,
        volatility: 0.12,
      };
      expect(data.projectionId).toBe('proj-uuid');
      expect(data.jobId).toBe('job-uuid');
      expect(data.seed).toBeUndefined();
    });

    it('should support optional seed field', () => {
      const data: MonteCarloJobData = {
        projectionId: 'proj-uuid',
        jobId: 'job-uuid',
        numSimulations: 1000,
        expectedReturn: 0.07,
        volatility: 0.12,
        seed: 42,
      };
      expect(data.seed).toBe(42);
    });
  });
});
