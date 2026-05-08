/**
 * Monte Carlo Simulation BullMQ Processor
 *
 * Fetches projection params from DB, executes Monte Carlo engine,
 * emits progress updates, and writes MonteCarloJobResult to monte_carlo_jobs.
 *
 * @see specs/009-monte-carlo-simulation/contracts/api.md
 * @see docs/MODULE-MAP.md - packages/worker/src/processors/monte-carlo.processor.ts
 */
import type { Job } from 'bullmq';
import { runMonteCarloEngineWithInflation } from '@retireops/calculation-engine';
import type { MonteCarloJobResult } from '@retireops/shared';
import { logger } from '../logger.js';
import { db, updateMonteCarloProgress, updateMonteCarloResult } from '../db.js';

export interface MonteCarloJobData {
  ownerType?: 'projection' | 'scenario';
  projectionId?: string;
  profileScenarioId?: string;
  jobId: string; // DB row ID in monte_carlo_jobs
  numSimulations: number;
  expectedReturn: number;
  volatility: number;
  seed?: number;
}

type ProjectionRowLite = {
  isRetired: boolean;
  totalNetWorth: number;
  livingExpenses: number;
  pensionIncome?: number;
  cppIncome?: number;
  oasIncome?: number;
};

const DEFAULT_INFLATION_RATE = 0.025;

function guaranteedIncome(row: ProjectionRowLite): number {
  return (row.pensionIncome ?? 0) + (row.cppIncome ?? 0) + (row.oasIncome ?? 0);
}

async function loadMonteCarloInputs(
  data: MonteCarloJobData,
  jobId: string
): Promise<{
  rows: ProjectionRowLite[];
  accountsFallback: number | undefined;
  expensesFallback: number | undefined;
  retirementAge: number | undefined;
  lifeExpectancy: number | undefined;
  inflationRate: number;
  ownerLabel: string;
}> {
  const ownerType = data.ownerType ?? 'projection';

  if (ownerType === 'scenario') {
    const scenarioId = data.profileScenarioId;
    if (!scenarioId) {
      await updateMonteCarloResult(jobId, null, 'failed', 'Missing profileScenarioId');
      throw new Error('Missing profileScenarioId');
    }
    const scenario = await db
      .selectFrom('profile_scenarios')
      .selectAll()
      .where('id', '=', scenarioId)
      .executeTakeFirst();
    if (!scenario) {
      await updateMonteCarloResult(jobId, null, 'failed', 'Scenario not found');
      throw new Error('Scenario not found');
    }
    const resultData = scenario.result_data as {
      projectionRows?: ProjectionRowLite[];
      assumptions?: { inflationRate?: number };
    } | null;
    return {
      rows: resultData?.projectionRows ?? [],
      accountsFallback: undefined,
      expensesFallback: undefined,
      retirementAge: undefined,
      lifeExpectancy: undefined,
      inflationRate: resultData?.assumptions?.inflationRate ?? DEFAULT_INFLATION_RATE,
      ownerLabel: `scenario:${scenarioId}`,
    };
  }

  const projectionId = data.projectionId;
  if (!projectionId) {
    await updateMonteCarloResult(jobId, null, 'failed', 'Missing projectionId');
    throw new Error('Missing projectionId');
  }
  const projection = await db
    .selectFrom('projections')
    .selectAll()
    .where('id', '=', projectionId)
    .executeTakeFirst();
  if (!projection) {
    await updateMonteCarloResult(jobId, null, 'failed', 'Projection not found');
    throw new Error('Projection not found');
  }
  const inputData = projection.input_data as {
    personalInfo?: { retirementAge?: number; lifeExpectancy?: number };
    accounts?: Array<{ balance?: number }>;
    expenses?: { retirementAnnualExpenses?: number };
  } | null;
  const resultData = projection.result_data as {
    projectionRows?: ProjectionRowLite[];
    assumptions?: { inflationRate?: number };
  } | null;
  const accounts = inputData?.accounts ?? [];
  const accountsFallback =
    accounts.length > 0 ? accounts.reduce((sum, a) => sum + (a.balance ?? 0), 0) : undefined;
  return {
    rows: resultData?.projectionRows ?? [],
    accountsFallback,
    expensesFallback: inputData?.expenses?.retirementAnnualExpenses,
    retirementAge: inputData?.personalInfo?.retirementAge,
    lifeExpectancy: inputData?.personalInfo?.lifeExpectancy,
    inflationRate: resultData?.assumptions?.inflationRate ?? DEFAULT_INFLATION_RATE,
    ownerLabel: `projection:${projectionId}`,
  };
}

export async function processMonteCarloJob(
  job: Job<MonteCarloJobData>
): Promise<MonteCarloJobResult> {
  const { jobId, numSimulations, expectedReturn, volatility, seed } = job.data;
  const ownerLabelInit =
    job.data.ownerType === 'scenario'
      ? `scenario:${job.data.profileScenarioId ?? '?'}`
      : `projection:${job.data.projectionId ?? '?'}`;

  logger.info('Starting Monte Carlo simulation', {
    jobId: job.id,
    owner: ownerLabelInit,
    dbJobId: jobId,
    numSimulations,
  });

  try {
    const loaded = await loadMonteCarloInputs(job.data, jobId);
    const rows = loaded.rows;

    // Extract retirement-phase portfolio survival parameters.
    // initialBalance = net worth at the last working year (or start of retirement).
    // annualWithdrawal = first-retirement-year living expenses NET of guaranteed income
    // (pension + CPP + OAS). The deterministic projection already offsets spending with
    // these streams, so passing gross expenses to Monte Carlo inflates portfolio draw.
    const lastWorkingRow = [...rows].reverse().find((r) => !r.isRetired);
    const firstRetirementRow = rows.find((r) => r.isRetired);

    let initialBalance: number;
    let annualWithdrawal: number;

    if (lastWorkingRow && firstRetirementRow) {
      initialBalance = lastWorkingRow.totalNetWorth;
      annualWithdrawal = Math.max(
        0,
        firstRetirementRow.livingExpenses - guaranteedIncome(firstRetirementRow)
      );
    } else if (firstRetirementRow) {
      // Already retired at year 0 (common for profile scenarios where retirementAge<=currentAge)
      initialBalance = firstRetirementRow.totalNetWorth;
      annualWithdrawal = Math.max(
        0,
        firstRetirementRow.livingExpenses - guaranteedIncome(firstRetirementRow)
      );
    } else {
      initialBalance = loaded.accountsFallback ?? 500_000;
      annualWithdrawal = loaded.expensesFallback ?? 40_000;
    }

    const retiredYears = rows.filter((r) => r.isRetired).length;
    const projectionYears =
      loaded.lifeExpectancy !== undefined && loaded.retirementAge !== undefined
        ? Math.max(1, loaded.lifeExpectancy - loaded.retirementAge)
        : retiredYears > 0
          ? retiredYears
          : Math.max(1, 90 - 65);

    // 3. Mark job as processing in DB
    await db
      .updateTable('monte_carlo_jobs')
      .set({ status: 'processing', started_at: new Date() })
      .where('id', '=', jobId)
      .execute();

    // 4. Emit initial progress (0%)
    await job.updateProgress(0);
    await updateMonteCarloProgress(jobId, 0);

    // 5. Emit 50% progress — engine is synchronous so we emit before running
    await job.updateProgress(50);
    await updateMonteCarloProgress(jobId, 50);

    // 6. Run the Monte Carlo engine (synchronous)
    const engineParams: {
      numSimulations: number;
      expectedReturn: number;
      volatility: number;
      seed?: number;
    } = {
      numSimulations,
      expectedReturn,
      volatility,
    };
    if (seed !== undefined) {
      engineParams.seed = seed;
    }

    const engineResult = runMonteCarloEngineWithInflation(
      initialBalance,
      annualWithdrawal,
      loaded.inflationRate,
      projectionYears,
      engineParams
    );

    // 7. Emit completion progress (100%)
    await job.updateProgress(100);
    await updateMonteCarloProgress(jobId, 100);

    // 8. Build MonteCarloJobResult — convert successRate from 0–1 to 0–100 percentage
    const jobResult: MonteCarloJobResult = {
      numSimulations: engineResult.numSimulations,
      successRate: engineResult.successRate * 100,
      percentileBands: engineResult.percentileBands,
      worstCaseTrials: engineResult.worstCaseTrials,
      params: { expectedReturn, volatility, numSimulations },
      completedAt: new Date().toISOString(),
    };

    // 9. Persist result to DB
    await updateMonteCarloResult(jobId, jobResult, 'completed');

    logger.info('Monte Carlo simulation completed', {
      jobId: job.id,
      owner: ownerLabelInit,
      dbJobId: jobId,
      successRate: jobResult.successRate,
    });

    return jobResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Monte Carlo simulation failed', {
      jobId: job.id,
      owner: ownerLabelInit,
      dbJobId: jobId,
      error: errorMessage,
    });

    // Only call updateMonteCarloResult for unexpected errors (not when already called above).
    // loadMonteCarloInputs calls it before throwing — avoid double-marking failed.
    const handledErrors = new Set([
      'Projection not found',
      'Scenario not found',
      'Missing projectionId',
      'Missing profileScenarioId',
    ]);
    if (!handledErrors.has(errorMessage)) {
      await updateMonteCarloResult(jobId, null, 'failed', errorMessage);
    }

    throw error;
  }
}
