/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/**
 * Reverse Calculator Solver — v1.12 Phase 52
 *
 * Pure, callback-injected solver implementing four goal-seek modes:
 *   Mode 1 (required-savings)        — binary search over rrspAnnualContribution
 *   Mode 2 (sustainable-spending)    — binary search over retirementSpending (INVERTED direction)
 *   Mode 3 (earliest-retirement-age) — bisection pre-narrowing + linear scan over integer age
 *   Mode 4 (required-total-savings)  — binary search over total portfolio (proportional split)
 *
 * CRITICAL: This module MUST NOT import from multi-year.ts or any sibling runtime
 * module. runProjection is always injected as a parameter. This mirrors the proven
 * pattern from funded-status.ts:computeRemediationPlan and avoids the circular
 * ESM import that affected v1.11.
 *
 * CRITICAL: Mode 2 is INVERTED relative to Modes 1 and 4. Higher spending →
 * infeasibility, so when feasible set lo=mid (NOT hi=mid). Copying the Mode 1
 * direction produces a wrong answer with no runtime error.
 *
 * @see docs/source-of-truth/08-projection-engine.md
 * @see .planning/phases/52-solver-engine/52-RESEARCH.md
 * @see packages/calculation-engine/src/projection/funded-status.ts (reference pattern)
 */
import type {
  SolverInput,
  SolverResult,
  SolverMode,
  SolverProjectionSummary,
  ProjectionInput,
  ProjectionOutput,
} from '@retireops/shared';

const BINARY_SEARCH_ITERATIONS = 20;
const SAVINGS_MIN = 0;
const SAVINGS_MAX = 250_000;
const SPENDING_MIN = 1_000;
const SPENDING_MAX = 500_000;
const TOTAL_SAVINGS_MIN = 0;
const TOTAL_SAVINGS_MAX = 10_000_000;
const AGE_MIN_PLANNING = 18;
const AGE_MAX_PLANNING = 80;
const MODE3_LINEAR_BRACKET = 4;
const DEFAULT_LIFE_EXPECTANCY = 90;
const DEFAULT_INFLATION = 0.02;
const DEFAULT_INVESTMENT_RETURN = 0.05;
const DEFAULT_CPP_AT_65 = 12_000;
const DEFAULT_YEARS_OF_RESIDENCE = 40;

type RunProjection = (input: ProjectionInput) => ProjectionOutput;

export function solveSingle(input: SolverInput, runProjection: RunProjection): SolverResult {
  switch (input.mode) {
    case 'required-savings':
      return solveRequiredSavings(input, runProjection);
    case 'sustainable-spending':
      return solveSustainableSpending(input, runProjection);
    case 'earliest-retirement-age':
      return solveEarliestRetirementAge(input, runProjection);
    case 'required-total-savings':
      return solveRequiredTotalSavings(input, runProjection);
  }
}

// ── Mode 1 ────────────────────────────────────────────────────────────
function solveRequiredSavings(
  input: Extract<SolverInput, { mode: 'required-savings' }>,
  runProjection: RunProjection
): SolverResult {
  const base = buildProjectionInputFromSolverInput(input);
  base.retirementAge = input.targetRetirementAge;
  base.retirementSpending = input.retirementSpending;

  let calls = 0;
  // Apply savings to both rrspAnnualContribution and tfsaAnnualContribution.
  // The engine caps each to its own contribution room (RRSP = 18% of earned income,
  // TFSA = ~$7k/yr). Setting both ensures the full tax-advantaged capacity is utilized
  // before the search ceiling is hit. solvedValue represents total annual savings intent.
  const runAt = (savings: number): ProjectionOutput => {
    calls += 1;
    return runProjection({
      ...base,
      rrspAnnualContribution: savings,
      tfsaAnnualContribution: savings,
    });
  };

  // Upper bound pre-check
  const upperOutput = runAt(SAVINGS_MAX);
  if (!isFeasible(upperOutput)) {
    return infeasibleResult(
      'required-savings',
      'Annual savings required exceeds the $250,000 search ceiling',
      calls,
      upperOutput,
      base,
      'Annual Savings Required',
      'dollars-per-year'
    );
  }

  // Lower bound short-circuit (already feasible with zero extra savings)
  const lowerOutput = runAt(SAVINGS_MIN);
  if (isFeasible(lowerOutput)) {
    return feasibleResult(
      'required-savings',
      SAVINGS_MIN,
      calls,
      lowerOutput,
      { ...base, rrspAnnualContribution: SAVINGS_MIN, tfsaAnnualContribution: SAVINGS_MIN },
      'Annual Savings Required',
      'dollars-per-year'
    );
  }

  let lo = SAVINGS_MIN;
  let hi = SAVINGS_MAX;
  for (let i = 0; i < BINARY_SEARCH_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    const output = runAt(mid);
    if (isFeasible(output)) hi = mid;
    else lo = mid;
  }
  const finalOutput = runAt(hi);
  return feasibleResult(
    'required-savings',
    hi,
    calls,
    finalOutput,
    { ...base, rrspAnnualContribution: hi, tfsaAnnualContribution: hi },
    'Annual Savings Required',
    'dollars-per-year'
  );
}

// ── Mode 2 (INVERTED DIRECTION) ───────────────────────────────────────
function solveSustainableSpending(
  input: Extract<SolverInput, { mode: 'sustainable-spending' }>,
  runProjection: RunProjection
): SolverResult {
  const base = buildProjectionInputFromSolverInput(input);
  base.retirementAge = input.retirementAge;

  let calls = 0;
  const runAt = (spending: number): ProjectionOutput => {
    calls += 1;
    return runProjection({ ...base, retirementSpending: spending });
  };

  // Lower bound pre-check: if even the minimum spending is infeasible, abort.
  const lowerOutput = runAt(SPENDING_MIN);
  if (!isFeasible(lowerOutput)) {
    return infeasibleResult(
      'sustainable-spending',
      'Portfolio depletes even at minimum sustainable spending',
      calls,
      lowerOutput,
      { ...base, retirementSpending: SPENDING_MIN },
      'Sustainable Annual Spending',
      'dollars-per-year'
    );
  }

  // Upper bound short-circuit: if max spending is feasible, return it.
  const upperOutput = runAt(SPENDING_MAX);
  if (isFeasible(upperOutput)) {
    return feasibleResult(
      'sustainable-spending',
      SPENDING_MAX,
      calls,
      upperOutput,
      { ...base, retirementSpending: SPENDING_MAX },
      'Sustainable Annual Spending',
      'dollars-per-year'
    );
  }

  let lo = SPENDING_MIN;
  let hi = SPENDING_MAX;
  for (let i = 0; i < BINARY_SEARCH_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    const output = runAt(mid);
    // INVERTED: feasible → try MORE spending (lo moves up)
    if (isFeasible(output)) lo = mid;
    else hi = mid;
  }
  // lo is now the maximum sustainable spending.
  const finalOutput = runAt(lo);
  return feasibleResult(
    'sustainable-spending',
    lo,
    calls,
    finalOutput,
    { ...base, retirementSpending: lo },
    'Sustainable Annual Spending',
    'dollars-per-year'
  );
}

// ── Mode 3 (bisection pre-narrowing + linear scan) ────────────────────
function solveEarliestRetirementAge(
  input: Extract<SolverInput, { mode: 'earliest-retirement-age' }>,
  runProjection: RunProjection
): SolverResult {
  const base = buildProjectionInputFromSolverInput(input);
  base.retirementSpending = input.retirementSpending;
  base.rrspAnnualContribution = input.annualSavingsRate;

  let calls = 0;
  const isFeasibleAtAge = (age: number): { feasible: boolean; output: ProjectionOutput } => {
    calls += 1;
    const output = runProjection({ ...base, retirementAge: age });
    return { feasible: isFeasible(output), output };
  };

  const lowerAge = Math.max(input.currentAge, AGE_MIN_PLANNING);
  const upperAge = AGE_MAX_PLANNING;

  // Lower bound pre-check: can we retire now?
  const lowerCheck = isFeasibleAtAge(lowerAge);
  if (lowerCheck.feasible) {
    return feasibleResult(
      'earliest-retirement-age',
      lowerAge,
      calls,
      lowerCheck.output,
      { ...base, retirementAge: lowerAge },
      'Earliest Retirement Age',
      'age'
    );
  }

  // Upper bound pre-check: infeasible at 80 → impossible.
  const upperCheck = isFeasibleAtAge(upperAge);
  if (!upperCheck.feasible) {
    return infeasibleResult(
      'earliest-retirement-age',
      'Portfolio cannot sustain this spending even if retirement is delayed to age 80',
      calls,
      upperCheck.output,
      { ...base, retirementAge: upperAge },
      'Earliest Retirement Age',
      'age'
    );
  }

  // Phase A: bisection pre-narrowing to a 4-year bracket
  let lo = lowerAge;
  let hi = upperAge;
  while (hi - lo > MODE3_LINEAR_BRACKET) {
    const mid = Math.floor((lo + hi) / 2);
    const { feasible } = isFeasibleAtAge(mid);
    if (feasible) hi = mid;
    else lo = mid;
  }

  // Phase B: linear scan within the bracket to find the minimum feasible age
  for (let age = lo; age <= hi; age++) {
    const { feasible, output } = isFeasibleAtAge(age);
    if (feasible) {
      return feasibleResult(
        'earliest-retirement-age',
        age,
        calls,
        output,
        { ...base, retirementAge: age },
        'Earliest Retirement Age',
        'age'
      );
    }
  }
  // Fallback — upperAge was feasible in pre-check but none in bracket were; return upperAge.
  return feasibleResult(
    'earliest-retirement-age',
    hi,
    calls,
    upperCheck.output,
    { ...base, retirementAge: hi },
    'Earliest Retirement Age',
    'age'
  );
}

// ── Mode 4 ────────────────────────────────────────────────────────────
function solveRequiredTotalSavings(
  input: Extract<SolverInput, { mode: 'required-total-savings' }>,
  runProjection: RunProjection
): SolverResult {
  const base = buildProjectionInputFromSolverInput(input);
  base.retirementAge = input.targetRetirementAge;
  base.retirementSpending = input.retirementSpending;

  const rrsp0 = input.rrspBalance ?? 0;
  const tfsa0 = input.tfsaBalance ?? 0;
  const nonReg0 = input.nonRegBalance ?? 0;
  const current = rrsp0 + tfsa0 + nonReg0;
  // Ratio fallback: equal split when all balances are 0.
  const rrspRatio = current > 0 ? rrsp0 / current : 1 / 3;
  const tfsaRatio = current > 0 ? tfsa0 / current : 1 / 3;
  const nonRegRatio = current > 0 ? nonReg0 / current : 1 / 3;

  let calls = 0;
  const runAt = (total: number): ProjectionOutput => {
    calls += 1;
    return runProjection({
      ...base,
      rrspBalance: total * rrspRatio,
      tfsaBalance: total * tfsaRatio,
      nonRegBalance: total * nonRegRatio,
    });
  };

  const upperOutput = runAt(TOTAL_SAVINGS_MAX);
  if (!isFeasible(upperOutput)) {
    return infeasibleResult(
      'required-total-savings',
      'Required total savings exceeds the $10,000,000 search ceiling',
      calls,
      upperOutput,
      base,
      'Required Total Savings',
      'dollars'
    );
  }

  let lo = TOTAL_SAVINGS_MIN;
  let hi = TOTAL_SAVINGS_MAX;
  for (let i = 0; i < BINARY_SEARCH_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    const output = runAt(mid);
    if (isFeasible(output)) hi = mid;
    else lo = mid;
  }
  const finalOutput = runAt(hi);
  const finalInput = {
    ...base,
    rrspBalance: hi * rrspRatio,
    tfsaBalance: hi * tfsaRatio,
    nonRegBalance: hi * nonRegRatio,
  };
  const result = feasibleResult(
    'required-total-savings',
    hi,
    calls,
    finalOutput,
    finalInput,
    'Required Total Savings',
    'dollars'
  );
  // Funding gap — only when caller provided balances (current > 0 indicates intent).
  if (current > 0) {
    result.fundingGap = Math.max(0, hi - current);
  }
  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────
function isFeasible(output: ProjectionOutput): boolean {
  return output.summary.fundedStatus.state !== 'red';
}

function feasibleResult(
  mode: SolverMode,
  solvedValue: number,
  convergenceIterations: number,
  output: ProjectionOutput,
  finalInput: ProjectionInput,
  solvedLabel: string,
  solvedUnit: SolverResult['solvedUnit']
): SolverResult {
  return {
    mode,
    solvedValue,
    solvedLabel,
    solvedUnit,
    feasible: true,
    convergenceIterations,
    projectionSummary: buildSolverProjectionSummary(output, finalInput),
  };
}

function infeasibleResult(
  mode: SolverMode,
  reason: string,
  convergenceIterations: number,
  output: ProjectionOutput,
  finalInput: ProjectionInput,
  solvedLabel: string,
  solvedUnit: SolverResult['solvedUnit']
): SolverResult {
  return {
    mode,
    solvedValue: 0,
    solvedLabel,
    solvedUnit,
    feasible: false,
    infeasibleReason: reason,
    convergenceIterations,
    projectionSummary: buildSolverProjectionSummary(output, finalInput),
  };
}

function buildSolverProjectionSummary(
  output: ProjectionOutput,
  _input: ProjectionInput
): SolverProjectionSummary {
  const last = output.yearlyResults.at(-1);
  const cppRow = output.yearlyResults.find((r) => r.cppIncome > 0);
  const oasRow = output.yearlyResults.find((r) => r.oasIncome > 0);
  return {
    fundedStatus: output.summary.fundedStatus,
    finalPortfolioBalance: last?.totalNetWorth ?? 0,
    cppAnnualBenefit: cppRow?.cppIncome ?? 0,
    oasAnnualBenefit: oasRow?.oasIncome ?? 0,
    totalRetirementYears: output.summary.yearsInRetirement,
    peakNetWorth: output.summary.peakNetWorth,
  };
}

function buildProjectionInputFromSolverInput(input: SolverInput): ProjectionInput {
  const lifeExpectancy = input.lifeExpectancy ?? DEFAULT_LIFE_EXPECTANCY;
  const rrspBalance =
    'rrspBalance' in input && input.rrspBalance !== undefined ? input.rrspBalance : 0;
  const tfsaBalance =
    'tfsaBalance' in input && input.tfsaBalance !== undefined ? input.tfsaBalance : 0;
  const nonRegBalance =
    'nonRegBalance' in input && input.nonRegBalance !== undefined ? input.nonRegBalance : 0;
  return {
    birthdate: new Date(input.dateOfBirth),
    province: input.province,
    retirementAge: 65, // placeholder — each mode overrides
    lifeExpectancy,
    employmentIncome: input.employmentIncome,
    employmentGrowthRate: 0,
    rrspBalance,
    rrspAnnualContribution: 0,
    tfsaBalance,
    tfsaAnnualContribution: 0,
    nonRegBalance,
    retirementSpending: 0, // placeholder — each mode overrides where relevant
    investmentReturn: input.investmentReturnRate ?? DEFAULT_INVESTMENT_RETURN,
    inflationRate: input.inflationRate ?? DEFAULT_INFLATION, // ALREADY DECIMAL — do not divide
    expectedCPPAt65: DEFAULT_CPP_AT_65,
    cppStartAge: input.cppStartAge ?? 65,
    oasStartAge: input.oasStartAge ?? 65,
    yearsOfResidence: DEFAULT_YEARS_OF_RESIDENCE,
  };
}
