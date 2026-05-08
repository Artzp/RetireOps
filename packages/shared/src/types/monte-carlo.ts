/**
 * Monte Carlo Simulation Types — v1.13
 *
 * Shared type contract for the Monte Carlo simulation engine.
 * PercentileBandResultContract and WorstCaseTrialContract are API-wire-format
 * duplicates of the calculation-engine-internal PercentileBandResult and
 * WorstCaseTrial types. This duplication is intentional per Architecture
 * Principle IV (shared cannot import from calculation-engine).
 *
 * @see specs/009-monte-carlo-simulation/data-model.md
 * @see docs/source-of-truth/06-investment-engine.md - Monte Carlo Simulation
 * @see docs/source-of-truth/09-success-metrics.md - Success Rate Definition
 */

export interface MonteCarloInput {
  projectionId: string;
  numSimulations: number;
  expectedReturn: number;
  volatility: number;
  seed?: number;
}

export type MonteCarloJobStatusValue =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface MonteCarloJobStatus {
  jobId: string;
  status: MonteCarloJobStatusValue;
  progress: number;
  result?: MonteCarloJobResult;
  error?: string;
}

export interface PercentileBandResultContract {
  year: number;
  age: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface WorstCaseTrialContract {
  trialId: number;
  depletionYear: number | null;
  finalBalance: number;
  returnSequence: Array<{
    year: number;
    returnRate: number;
    balance: number;
  }>;
}

export interface MonteCarloJobResult {
  numSimulations: number;
  successRate: number;
  percentileBands: PercentileBandResultContract[];
  worstCaseTrials: WorstCaseTrialContract[];
  params: {
    expectedReturn: number;
    volatility: number;
    numSimulations: number;
  };
  completedAt: string;
}
