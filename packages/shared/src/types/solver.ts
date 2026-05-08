/**
 * Solver Types — v1.12 Reverse Calculator
 *
 * Defines the canonical TypeScript interfaces for the four reverse-calculator solver modes:
 * Required Savings, Sustainable Spending, Earliest Retirement Age, and Required Total Savings.
 *
 * @see specs/008-reverse-calculator/data-model.md
 * @see docs/source-of-truth/08-projection-engine.md
 */
import type { FundedStatus } from './projection.js';
import type { ProvinceCode } from './province.js';

/**
 * The four solver modes supported by the v1.12 Reverse Calculator.
 */
export type SolverMode =
  | 'required-savings'
  | 'sustainable-spending'
  | 'earliest-retirement-age'
  | 'required-total-savings';

/**
 * Common base fields shared by all four solver modes.
 * Each mode-specific interface extends this base via SolverInputBase.
 */
export interface SolverInputBase {
  /** Province of residence (two-letter code). */
  province: ProvinceCode;
  /** Date of birth in ISO 8601 format (YYYY-MM-DD). */
  dateOfBirth: string;
  /** Current age (integer, 18–120). */
  currentAge: number;
  /** Life expectancy in years (integer, 50–110). Defaults to 90. */
  lifeExpectancy?: number;
  /** Current RRSP/RRIF balance in dollars (>= 0). */
  rrspBalance: number;
  /** Current TFSA balance in dollars (>= 0). */
  tfsaBalance: number;
  /** Current non-registered account balance in dollars (>= 0). */
  nonRegBalance: number;
  /** Current annual employment income in dollars (>= 0). */
  employmentIncome: number;
  /** Age to start CPP (integer, 60–70). Defaults to 65. */
  cppStartAge?: number;
  /** Age to start OAS (integer, 65–70). Defaults to 65. */
  oasStartAge?: number;
  /** Expected investment return rate as a decimal (0.00–0.15). Defaults to 0.05. */
  investmentReturnRate?: number;
  /** Expected inflation rate as a decimal (0.00–0.10). Defaults to 0.02. */
  inflationRate?: number;
}

/**
 * Mode 1: Required Savings
 * Calculates the annual savings amount needed to retire at a target age with a given spending level.
 */
export interface RequiredSavingsInput extends SolverInputBase {
  mode: 'required-savings';
  /** Target retirement age (integer, currentAge+1..80). */
  targetRetirementAge: number;
  /** Annual spending in retirement (dollars, 1_000–500_000). */
  retirementSpending: number;
}

/**
 * Mode 2: Sustainable Spending
 * Calculates the sustainable annual spending amount in retirement given a fixed retirement age.
 */
export interface SustainableSpendingInput extends SolverInputBase {
  mode: 'sustainable-spending';
  /** Planned retirement age (integer, currentAge..80). */
  retirementAge: number;
}

/**
 * Mode 3: Earliest Retirement Age
 * Calculates the earliest feasible retirement age given current savings rate and desired spending.
 */
export interface EarliestRetirementAgeInput extends SolverInputBase {
  mode: 'earliest-retirement-age';
  /** Annual savings amount (0–250_000 dollars per year). */
  annualSavingsRate: number;
  /** Annual spending in retirement (dollars, 1_000–500_000). */
  retirementSpending: number;
}

/**
 * Mode 4: Required Total Savings
 * Calculates the total portfolio balance needed at retirement to sustain a given spending level.
 *
 * Mode 4 is the ONLY mode where rrspBalance, tfsaBalance, and nonRegBalance are optional —
 * when omitted the solver treats them as 0 and omits the `fundingGap` from the result.
 * Uses Omit + redeclared optional fields to satisfy `exactOptionalPropertyTypes`.
 */
export interface RequiredTotalSavingsInput extends Omit<
  SolverInputBase,
  'rrspBalance' | 'tfsaBalance' | 'nonRegBalance'
> {
  mode: 'required-total-savings';
  /** Target retirement age (integer, currentAge+1..80). */
  targetRetirementAge: number;
  /** Annual spending in retirement (dollars, 1_000–500_000). */
  retirementSpending: number;
  /** Current RRSP/RRIF balance in dollars (optional for Mode 4). */
  rrspBalance?: number;
  /** Current TFSA balance in dollars (optional for Mode 4). */
  tfsaBalance?: number;
  /** Current non-registered account balance in dollars (optional for Mode 4). */
  nonRegBalance?: number;
}

/**
 * Discriminated union of all four solver input modes, keyed on the `mode` field.
 */
export type SolverInput =
  | RequiredSavingsInput
  | SustainableSpendingInput
  | EarliestRetirementAgeInput
  | RequiredTotalSavingsInput;

/**
 * Projection summary returned within a SolverResult.
 *
 * NOTE: This interface is intentionally named `SolverProjectionSummary` (NOT
 * `ProjectionSummary`) to avoid a barrel name collision with the pre-existing
 * `ProjectionSummary` export from `packages/shared/src/types/projection.ts`.
 * Renaming or aliasing that existing export would break all v1.11 downstream
 * consumers. See ROADMAP Phase 51 Notes for the authoritative rationale.
 *
 * This is a standalone read-only subset — it does NOT extend `ProjectionSummary`.
 */
export interface SolverProjectionSummary {
  /** Funded-state classification for the solved scenario. */
  fundedStatus: FundedStatus;
  /** Portfolio balance at the end of the projection horizon. */
  finalPortfolioBalance: number;
  /** Estimated annual CPP benefit at chosen start age. */
  cppAnnualBenefit: number;
  /** Estimated annual OAS benefit at chosen start age. */
  oasAnnualBenefit: number;
  /** Total years from retirement age to life expectancy. */
  totalRetirementYears: number;
  /** Peak net worth achieved during the projection. */
  peakNetWorth: number;
}

/**
 * The output of a solver run for any mode.
 */
export interface SolverResult {
  /** Which solver mode produced this result. */
  mode: SolverMode;
  /** The primary solved numeric value (e.g. required savings amount, sustainable spending level, earliest retirement age, or required total savings). */
  solvedValue: number;
  /** Human-readable label for the solved value (e.g. "Annual Savings Required"). */
  solvedLabel: string;
  /** Unit of the solved value. */
  solvedUnit: 'dollars' | 'dollars-per-year' | 'age';
  /** Whether a feasible solution was found within the projection horizon. */
  feasible: boolean;
  /** Reason why the solver could not find a feasible solution (only set when feasible === false). */
  infeasibleReason?: string;
  /** Number of binary-search iterations needed to converge. */
  convergenceIterations: number;
  /** Summary of the projection at the solved value. */
  projectionSummary: SolverProjectionSummary;
  /**
   * Shortfall between required total savings and current balances.
   * Present only for Mode 4 when rrspBalance/tfsaBalance/nonRegBalance are provided.
   */
  fundingGap?: number;
}
