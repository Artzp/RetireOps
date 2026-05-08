/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/**
 * Monte Carlo Simulation for Investment Projections
 * @see docs/source-of-truth/06-investment-engine.md - Monte Carlo Simulation
 */

/**
 * Monte Carlo simulation parameters
 * @see docs/source-of-truth/06-investment-engine.md - Simulation Parameters
 */
export interface MonteCarloParams {
  numSimulations: number;
  expectedReturn: number;
  volatility: number;
  seed?: number;
}

/**
 * Default Monte Carlo parameters
 */
export const DEFAULT_MONTE_CARLO_PARAMS: MonteCarloParams = {
  numSimulations: 1000,
  expectedReturn: 0.065,
  volatility: 0.11,
};

/**
 * Single year result in a simulation
 */
export interface SimulationYearData {
  year: number;
  balance: number;
  returnRate: number;
}

/**
 * Single simulation scenario result
 */
export interface SimulationScenario {
  scenarioId: number;
  finalBalance: number;
  depletionYear: number | null;
  yearlyData: SimulationYearData[];
}

/**
 * Monte Carlo simulation result
 * @see docs/source-of-truth/06-investment-engine.md - MonteCarloResult interface
 */
export interface MonteCarloResult {
  numSimulations: number;
  probabilityOfSuccess: number;
  finalBalanceMedian: number;
  finalBalance5thPercentile: number;
  finalBalance95thPercentile: number;
  finalBalanceMean: number;
  finalBalanceStdDev: number;
  depletionAgeMedian: number | null;
  scenarios: SimulationScenario[];
}

/**
 * Simple random number generator with optional seed
 * Uses mulberry32 algorithm for deterministic results when seeded
 */
class SeededRandom {
  private state: number;

  constructor(seed?: number) {
    this.state = seed ?? Math.floor(Math.random() * 2147483647);
  }

  /** Generate uniform random number [0, 1) */
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) % 4294967296;
    return this.state / 4294967296;
  }

  /** Generate standard normal random number using Box-Muller transform */
  nextGaussian(): number {
    const u1 = this.next();
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}

/**
 * Generate log-normal return
 * @see docs/source-of-truth/06-investment-engine.md - Random Return Generation
 * @param expectedReturn Mean expected return
 * @param volatility Standard deviation of returns
 * @param random Random number generator
 * @returns Random return for the year
 */
export function generateLogNormalReturn(
  expectedReturn: number,
  volatility: number,
  random: SeededRandom
): number {
  // Convert to log-normal parameters
  // μ = ln(1 + expected_return) - σ²/2
  const sigma = volatility;
  const mu = Math.log(1 + expectedReturn) - (sigma * sigma) / 2;

  // Generate log-normal return
  // annual_return = exp(μ + σ × random_normal()) - 1
  const z = random.nextGaussian();
  return Math.exp(mu + sigma * z) - 1;
}

/**
 * Run Monte Carlo simulation for retirement portfolio
 * @see docs/source-of-truth/06-investment-engine.md - Simulation Algorithm
 */
export function runMonteCarloSimulation(
  initialBalance: number,
  annualWithdrawal: number,
  projectionYears: number,
  params: Partial<MonteCarloParams> = {}
): MonteCarloResult {
  const {
    numSimulations = DEFAULT_MONTE_CARLO_PARAMS.numSimulations,
    expectedReturn = DEFAULT_MONTE_CARLO_PARAMS.expectedReturn,
    volatility = DEFAULT_MONTE_CARLO_PARAMS.volatility,
    seed,
  } = params;

  const random = new SeededRandom(seed);
  const scenarios: SimulationScenario[] = [];
  const finalBalances: number[] = [];
  const depletionYears: number[] = [];

  for (let sim = 0; sim < numSimulations; sim++) {
    let balance = initialBalance;
    let depletionYear: number | null = null;
    const yearlyData: SimulationYearData[] = [];

    for (let year = 1; year <= projectionYears; year++) {
      // Generate random return for this year
      const randomReturn = generateLogNormalReturn(expectedReturn, volatility, random);

      // Apply return to portfolio
      balance = balance * (1 + randomReturn);

      // Subtract annual withdrawal
      balance -= annualWithdrawal;

      // Record data
      yearlyData.push({
        year,
        balance: Math.max(0, balance),
        returnRate: randomReturn,
      });

      // Check for depletion - first occurrence only.
      // Depletion requires annualWithdrawal > 0: a zero-withdrawal portfolio
      // cannot deplete regardless of balance (the owner is not drawing funds).
      if (balance <= 0 && annualWithdrawal > 0 && depletionYear === null) {
        depletionYear = year;
        balance = 0;
        break;
      }
    }

    scenarios.push({
      scenarioId: sim + 1,
      finalBalance: Math.max(0, balance),
      depletionYear,
      yearlyData,
    });

    finalBalances.push(Math.max(0, balance));
    if (depletionYear !== null) {
      depletionYears.push(depletionYear);
    }
  }

  // Analyze results
  // @see docs/source-of-truth/06-investment-engine.md - Analyzing Results
  const sortedBalances = [...finalBalances].sort((a, b) => a - b);
  const successes = scenarios.filter((s) => s.depletionYear === null).length;

  return {
    numSimulations,
    probabilityOfSuccess: (successes / numSimulations) * 100,
    finalBalanceMedian: getPercentile(sortedBalances, 0.5),
    finalBalance5thPercentile: getPercentile(sortedBalances, 0.05),
    finalBalance95thPercentile: getPercentile(sortedBalances, 0.95),
    finalBalanceMean: calculateMean(finalBalances),
    finalBalanceStdDev: calculateStdDev(finalBalances),
    depletionAgeMedian:
      depletionYears.length > 0
        ? getPercentile(
            depletionYears.sort((a, b) => a - b),
            0.5
          )
        : null,
    scenarios,
  };
}

/**
 * Run Monte Carlo with varying withdrawals (inflation-adjusted)
 */
export function runMonteCarloWithInflation(
  initialBalance: number,
  initialWithdrawal: number,
  inflationRate: number,
  projectionYears: number,
  params: Partial<MonteCarloParams> = {}
): MonteCarloResult {
  const {
    numSimulations = DEFAULT_MONTE_CARLO_PARAMS.numSimulations,
    expectedReturn = DEFAULT_MONTE_CARLO_PARAMS.expectedReturn,
    volatility = DEFAULT_MONTE_CARLO_PARAMS.volatility,
    seed,
  } = params;

  const random = new SeededRandom(seed);
  const scenarios: SimulationScenario[] = [];
  const finalBalances: number[] = [];
  const depletionYears: number[] = [];

  for (let sim = 0; sim < numSimulations; sim++) {
    let balance = initialBalance;
    let withdrawal = initialWithdrawal;
    let depletionYear: number | null = null;
    const yearlyData: SimulationYearData[] = [];

    for (let year = 1; year <= projectionYears; year++) {
      // Generate random return for this year
      const randomReturn = generateLogNormalReturn(expectedReturn, volatility, random);

      // Apply return to portfolio
      balance = balance * (1 + randomReturn);

      // Subtract inflation-adjusted withdrawal
      balance -= withdrawal;

      // Record data
      yearlyData.push({
        year,
        balance: Math.max(0, balance),
        returnRate: randomReturn,
      });

      // Check for depletion - first occurrence only
      if (balance <= 0 && depletionYear === null) {
        depletionYear = year;
        balance = 0;
        break;
      }

      // Increase withdrawal for inflation
      withdrawal *= 1 + inflationRate;
    }

    scenarios.push({
      scenarioId: sim + 1,
      finalBalance: Math.max(0, balance),
      depletionYear,
      yearlyData,
    });

    finalBalances.push(Math.max(0, balance));
    if (depletionYear !== null) {
      depletionYears.push(depletionYear);
    }
  }

  const sortedBalances = [...finalBalances].sort((a, b) => a - b);
  const successes = scenarios.filter((s) => s.depletionYear === null).length;

  return {
    numSimulations,
    probabilityOfSuccess: (successes / numSimulations) * 100,
    finalBalanceMedian: getPercentile(sortedBalances, 0.5),
    finalBalance5thPercentile: getPercentile(sortedBalances, 0.05),
    finalBalance95thPercentile: getPercentile(sortedBalances, 0.95),
    finalBalanceMean: calculateMean(finalBalances),
    finalBalanceStdDev: calculateStdDev(finalBalances),
    depletionAgeMedian:
      depletionYears.length > 0
        ? getPercentile(
            depletionYears.sort((a, b) => a - b),
            0.5
          )
        : null,
    scenarios,
  };
}

/**
 * Stress test scenarios
 * @see docs/source-of-truth/06-investment-engine.md - Stress Test Scenarios
 */
export type StressScenario =
  | 'market_crash_at_retirement'
  | 'lost_decade'
  | 'high_inflation'
  | '2008_replay';

export interface StressTestParams {
  scenario: StressScenario;
  initialBalance: number;
  annualWithdrawal: number;
  projectionYears: number;
  baseExpectedReturn?: number;
  baseInflationRate?: number;
}

export interface StressTestResult {
  scenario: StressScenario;
  description: string;
  finalBalance: number;
  depletionYear: number | null;
  yearlyData: SimulationYearData[];
}

/**
 * Run stress test scenario
 * @see docs/source-of-truth/06-investment-engine.md - Stress Test Scenarios Table
 */
export function runStressTest(params: StressTestParams): StressTestResult {
  const {
    scenario,
    initialBalance,
    annualWithdrawal,
    projectionYears,
    baseExpectedReturn = 0.055,
    baseInflationRate: _baseInflationRate = 0.025,
  } = params;

  let balance = initialBalance;
  let depletionYear: number | null = null;
  const yearlyData: SimulationYearData[] = [];

  const getReturnForYear = (year: number): number => {
    switch (scenario) {
      case 'market_crash_at_retirement':
        // -30% in year 1, normal thereafter
        return year === 1 ? -0.3 : baseExpectedReturn;

      case 'lost_decade':
        // 0% returns for 10 years
        return year <= 10 ? 0 : baseExpectedReturn;

      case 'high_inflation':
        // Normal returns but 6% inflation for 5 years (reduces real returns)
        if (year <= 5) {
          return baseExpectedReturn - 0.035; // Net of higher inflation
        }
        return baseExpectedReturn;

      case '2008_replay':
        // Historical 2008-2009 returns then normal
        if (year === 1) return -0.37; // 2008
        if (year === 2) return 0.27; // 2009 recovery
        return baseExpectedReturn;

      default:
        return baseExpectedReturn;
    }
  };

  for (let year = 1; year <= projectionYears; year++) {
    const returnRate = getReturnForYear(year);

    balance = balance * (1 + returnRate);
    balance -= annualWithdrawal;

    yearlyData.push({
      year,
      balance: Math.max(0, balance),
      returnRate,
    });

    if (balance <= 0 && depletionYear === null) {
      depletionYear = year;
      balance = 0;
      break;
    }
  }

  const descriptions: Record<StressScenario, string> = {
    market_crash_at_retirement: '-30% market crash in first year of retirement',
    lost_decade: '0% returns for 10 years',
    high_inflation: '6%+ inflation for 5 years',
    '2008_replay': 'Historical 2008-2009 market crash and recovery',
  };

  return {
    scenario,
    description: descriptions[scenario],
    finalBalance: Math.max(0, balance),
    depletionYear,
    yearlyData,
  };
}

/**
 * Year-by-year portfolio balance at 5 percentile levels.
 * Used for fan chart visualization in Phase 58.
 * @see specs/009-monte-carlo-simulation/data-model.md - PercentileBandResult
 */
export interface PercentileBandResult {
  year: number;
  age: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

/**
 * A failed (or lowest-balance passing) trial for worst-case display.
 * depletionYear is null for passing trials used as padding.
 * @see specs/009-monte-carlo-simulation/data-model.md - WorstCaseTrial
 */
export interface WorstCaseTrial {
  trialId: number;
  depletionYear: number | null;
  finalBalance: number;
  returnSequence: Array<{
    year: number;
    returnRate: number;
    balance: number;
  }>;
}

/**
 * Compute year-by-year percentile bands across all simulation scenarios.
 * Trials that depleted before a given year contribute 0 at that year index.
 * @see docs/source-of-truth/06-investment-engine.md - Monte Carlo Simulation
 * @see specs/009-monte-carlo-simulation/data-model.md - computePercentileBands
 */
export function computePercentileBands(
  scenarios: SimulationScenario[],
  retirementAge: number
): PercentileBandResult[] {
  if (scenarios.length === 0) return [];
  const maxYears = Math.max(...scenarios.map((s) => s.yearlyData.length));
  const results: PercentileBandResult[] = [];

  for (let yearIdx = 0; yearIdx < maxYears; yearIdx++) {
    const balancesAtYear = scenarios.map((s) => s.yearlyData[yearIdx]?.balance ?? 0);
    const sorted = [...balancesAtYear].sort((a, b) => a - b);
    results.push({
      year: yearIdx + 1,
      age: retirementAge + yearIdx,
      p10: getPercentile(sorted, 0.1),
      p25: getPercentile(sorted, 0.25),
      p50: getPercentile(sorted, 0.5),
      p75: getPercentile(sorted, 0.75),
      p90: getPercentile(sorted, 0.9),
    });
  }
  return results;
}

/**
 * Extract the worst-case trial sequences for display.
 * Returns up to `count` failed trials (lowest finalBalance), padded with
 * lowest-balance passing trials if fewer than `count` trials failed.
 * @see specs/009-monte-carlo-simulation/data-model.md - extractWorstCaseTrials
 */
export function extractWorstCaseTrials(
  scenarios: SimulationScenario[],
  count: number = 10
): WorstCaseTrial[] {
  const failed = scenarios
    .filter((s) => s.depletionYear !== null)
    .sort((a, b) => a.finalBalance - b.finalBalance);

  const passing = scenarios
    .filter((s) => s.depletionYear === null)
    .sort((a, b) => a.finalBalance - b.finalBalance);

  const combined = [...failed, ...passing].slice(0, count);

  return combined.map((s) => ({
    trialId: s.scenarioId,
    depletionYear: s.depletionYear,
    finalBalance: s.finalBalance,
    returnSequence: s.yearlyData.map((y) => ({
      year: y.year,
      returnRate: y.returnRate,
      balance: y.balance,
    })),
  }));
}

/**
 * Result type for the Monte Carlo engine orchestrator.
 * successRate is 0–1 (decimal), not 0–100 (percentage).
 * percentileBands length equals projectionYears.
 * worstCaseTrials contains up to 10 entries (failed first, then lowest-balance passing).
 */
export interface MonteCarloEngineResult {
  numSimulations: number;
  successRate: number;
  percentileBands: PercentileBandResult[];
  worstCaseTrials: WorstCaseTrial[];
}

/**
 * Orchestrator entry point for Phase 56 (BullMQ worker processor).
 *
 * Accepts pre-extracted projection parameters (initialBalance, annualWithdrawal,
 * projectionYears) derived from a single deterministic ProjectionOutput. Does NOT
 * call runProjection() per trial — returns vary only in annual investment returns.
 *
 * Conversion note: runMonteCarloSimulation() returns probabilityOfSuccess 0–100.
 * This function exposes successRate as 0–1 decimal for MonteCarloJobResult compatibility.
 *
 * Extraction contract for Phase 56 consumer:
 *   - Single person: initialBalance = total portfolio end of last working year,
 *     annualWithdrawal = totalWithdrawal from first retirement year,
 *     projectionYears = lifeExpectancy - retirementAge
 *   - Couple: projectionYears = longerLivedSpouseLifeExpectancy - retirementAge
 *
 * @see specs/009-monte-carlo-simulation/data-model.md - runMonteCarloEngine
 * @see docs/source-of-truth/06-investment-engine.md - Monte Carlo Simulation
 * @see docs/source-of-truth/09-success-metrics.md - Success Rate
 */
export function runMonteCarloEngine(
  initialBalance: number,
  annualWithdrawal: number,
  projectionYears: number,
  params: Partial<MonteCarloParams> = {}
): MonteCarloEngineResult {
  const mcResult = runMonteCarloSimulation(
    initialBalance,
    annualWithdrawal,
    projectionYears,
    params
  );

  // Default retirementAge = 65 — Phase 56 worker should pass actual retirementAge via params extension
  const retirementAge = 65;
  const percentileBands = computePercentileBands(mcResult.scenarios, retirementAge);
  const worstCaseTrials = extractWorstCaseTrials(mcResult.scenarios, 10);

  return {
    numSimulations: mcResult.numSimulations,
    successRate: mcResult.probabilityOfSuccess / 100,
    percentileBands,
    worstCaseTrials,
  };
}

/**
 * Inflation-escalating twin of `runMonteCarloEngine`.
 *
 * Delegates to `runMonteCarloWithInflation` so the per-year withdrawal grows at
 * `inflationRate`, matching the deterministic projection's inflation-escalating
 * spending. Percentile bands and worst-case trials are computed identically to
 * the flat-nominal engine for UI parity.
 *
 * @see runMonteCarloEngine
 * @see docs/source-of-truth/06-investment-engine.md - Monte Carlo Simulation
 */
export function runMonteCarloEngineWithInflation(
  initialBalance: number,
  initialWithdrawal: number,
  inflationRate: number,
  projectionYears: number,
  params: Partial<MonteCarloParams> = {}
): MonteCarloEngineResult {
  const mcResult = runMonteCarloWithInflation(
    initialBalance,
    initialWithdrawal,
    inflationRate,
    projectionYears,
    params
  );

  const retirementAge = 65;
  const percentileBands = computePercentileBands(mcResult.scenarios, retirementAge);
  const worstCaseTrials = extractWorstCaseTrials(mcResult.scenarios, 10);

  return {
    numSimulations: mcResult.numSimulations,
    successRate: mcResult.probabilityOfSuccess / 100,
    percentileBands,
    worstCaseTrials,
  };
}

// Helper functions

function getPercentile(sortedArray: number[], percentile: number): number {
  if (sortedArray.length === 0) return 0;
  const index = Math.floor(sortedArray.length * percentile);
  return sortedArray[Math.min(index, sortedArray.length - 1)] ?? 0;
}

function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calculateStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = calculateMean(values);
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1);
  return Math.sqrt(variance);
}
