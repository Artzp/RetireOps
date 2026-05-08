// @see docs/source-of-truth/08-projection-engine.md - ENG-01 test fixtures
/**
 * Shared test fixtures for Phase 1 override engine tests.
 * All values are deterministic — no Date.now(), no Math.random().
 *
 * Strategy: Primary retiree starts at age 65 in projection year 2030.
 * RRIF conversion occurs at age 71 = year 2036.
 * Projection year 2030 birthdate = Jan 1, 1965 (age 65 at end of 2030).
 */
import type { ProjectionInput } from '@retireops/shared';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Known starting balances for all override tests.
 * Chosen so that each account type can be meaningfully overridden:
 * - RRSP: large enough to survive 30-year projection; allows $50K annual override.
 * - RRIF: starts at 0 (engine converts RRSP→RRIF at age 71, year 2036).
 * - TFSA: enough to fill a spending gap when RRSP is overridden away.
 * - nonReg: buffer for surplus-routing tests.
 * - LIF: moderate balance for LIF-override tests; locked-in funds.
 */
export const DEFAULT_BALANCES = {
  rrsp: 500_000,
  rrif: 0, // starts at 0; engine converts RRSP→RRIF at age 71 (year 2036)
  tfsa: 100_000,
  nonReg: 200_000,
  lif: 50_000,
  lira: 0,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BuildFixtureOptions {
  /** Age of primary at projection start (default 65 — already retired). */
  startAge?: number;
  /** Age of spouse at projection start (default 63 — couple fixture only). */
  spouseStartAge?: number;
  /** Default 0.025 (2.5%). */
  inflationRate?: number;
  /** Drawdown priority order. Default ['nonReg', 'tfsa', 'rrsp', 'rrif']. */
  drawdownOrder?: string[];
  /** Named strategy preset (optional). */
  strategyId?: 'standard' | 'tfsaFirst' | 'oasProtection' | 'bracketFilling';
  /** Real-dollar annual spending target. Default 60_000. */
  targetRetirementSpending?: number;
  /** Age-band spending reductions. */
  ageBandReductions?: Array<{ fromAge: number; reductionPercent: number }>;
  /** Override any of the default account balances. */
  balances?: Partial<typeof DEFAULT_BALANCES>;
  /** Projection length in years (default 30). */
  projectionYears?: number;
  /**
   * Withdrawal overrides — Phase 1 new field on ProjectionInput.
   * Shape mirrors the CONTEXT.md D-01/D-02 decisions.
   * These are forward-looking: the field is typed here for test authoring;
   * the engine will read it in Plan 03 implementation.
   */
  withdrawalOverrides?: Array<{
    field: 'rrsp' | 'rrif' | 'lif' | 'tfsa' | 'nonreg';
    year: number;
    amount: number;
    applyForward: boolean;
    /** Per-owner routing — defaults to primary when omitted. */
    owner?: 'primary' | 'spouse' | undefined;
  }>;
  /**
   * Spending overrides — Phase 1 new field on ProjectionInput.
   * Shape mirrors CONTEXT.md D-02.
   */
  spendingOverrides?: Array<{
    year: number;
    amount: number;
    applyForward: boolean;
    /** Per-owner routing — defaults to primary when omitted. */
    owner?: 'primary' | 'spouse' | undefined;
  }>;
  /**
   * Surplus destination — Phase 1 new field on ProjectionInput.
   * Shape mirrors CONTEXT.md D-15.
   */
  surplusDestination?: 'rrsp' | 'rrif' | 'lif' | 'tfsa' | 'nonreg';
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function stableFixtureBirthdate(year: number): Date {
  // Keep ISO serialization deterministic while avoiding local-year rollback in
  // negative-offset zones. ageAtEndOfYear currently reads local date parts.
  return new Date(Date.UTC(year, 0, 2, 12));
}

/**
 * Builds a minimal single-person ProjectionInput with known, deterministic balances.
 *
 * Defaults:
 * - Primary born Jan 1, 1965 (age 65 in projection year 2030).
 * - RRIF conversion at age 71 = year 2036 (cross-RRIF tests can target years >= 2036).
 * - Real spending target: $60,000/year.
 * - Inflation: 2.5%.
 * - Investment return: 5%.
 * - Drawdown order: nonReg → TFSA → RRSP → RRIF (avoids exhausting any one account too fast).
 *
 * @see docs/source-of-truth/08-projection-engine.md - ENG-01 test fixtures
 */
export function buildSinglePersonFixture(opts: BuildFixtureOptions = {}): ProjectionInput {
  const {
    startAge = 65,
    inflationRate = 0.025,
    drawdownOrder = ['nonReg', 'tfsa', 'rrsp', 'rrif'],
    strategyId,
    targetRetirementSpending = 60_000,
    ageBandReductions,
    balances = {},
    projectionYears = 30,
    withdrawalOverrides,
    spendingOverrides,
    surplusDestination,
  } = opts;

  // Deterministic birth year: projection starts 2030, primary is startAge at end of that year.
  const PROJECTION_START_YEAR = 2030;
  const birthYear = PROJECTION_START_YEAR - startAge;
  const birthdate = stableFixtureBirthdate(birthYear);

  const mergedBalances = { ...DEFAULT_BALANCES, ...balances };

  // Build input object — uses ProjectionInput fields.
  // Phase 1 override fields (withdrawalOverrides, spendingOverrides, surplusDestination)
  // are not yet on ProjectionInput — these will be added by Plan 02/03.
  // We cast via `unknown` so the RED tests can reference these fields at compile time
  // against the future shape, making them fail until Plan 02 adds them.
  const base: ProjectionInput = {
    // Demographics
    birthdate,
    province: 'ON',
    retirementAge: startAge,
    lifeExpectancy: startAge + projectionYears,
    maritalStatus: 'single',
    projectionStartYear: PROJECTION_START_YEAR,

    // Employment (fully retired from year 1)
    employmentIncome: 0,
    employmentGrowthRate: 0,

    // Government benefits (modest CPP; OAS at 65)
    expectedCPPAt65: 9_000,
    cppStartAge: 65,
    oasStartAge: 65,
    yearsOfResidence: 40,

    // Accounts
    rrspBalance: mergedBalances.rrsp,
    rrspAnnualContribution: 0,
    rrifBalance: mergedBalances.rrif,
    lifBalance: mergedBalances.lif,
    lifJurisdiction: 'ON',
    tfsaBalance: mergedBalances.tfsa,
    tfsaAnnualContribution: 0,
    nonRegBalance: mergedBalances.nonReg,

    // Spending
    retirementSpending: targetRetirementSpending,

    // Assumptions
    investmentReturn: 0.05,
    inflationRate,

    // Strategy
    drawdownOrder,
    ...(strategyId !== undefined ? { strategyId } : {}),

    // Spending modifiers
    ...(ageBandReductions !== undefined ? { ageBandReductions } : {}),

    // Phase 1 override fields (now native on ProjectionInput — Plan 03)
    ...(withdrawalOverrides !== undefined ? { withdrawalOverrides } : {}),
    ...(spendingOverrides !== undefined ? { spendingOverrides } : {}),
    ...(surplusDestination !== undefined ? { surplusDestination } : {}),
  };

  return base;
}

/**
 * Builds a couple ProjectionInput with a primary (age 65) and spouse (age 63 by default).
 * Spouse has identical account types with half the primary's balances.
 *
 * @see docs/source-of-truth/08-projection-engine.md - ENG-01 test fixtures
 */
export function buildCoupleFixture(opts: BuildFixtureOptions = {}): ProjectionInput {
  const {
    startAge = 65,
    spouseStartAge = 63,
    inflationRate = 0.025,
    drawdownOrder = ['nonReg', 'tfsa', 'rrsp', 'rrif'],
    strategyId,
    targetRetirementSpending = 60_000,
    ageBandReductions,
    balances = {},
    projectionYears = 30,
    withdrawalOverrides,
    spendingOverrides,
    surplusDestination,
  } = opts;

  const PROJECTION_START_YEAR = 2030;
  const primaryBirthYear = PROJECTION_START_YEAR - startAge;
  const spouseBirthYear = PROJECTION_START_YEAR - spouseStartAge;

  const mergedBalances = { ...DEFAULT_BALANCES, ...balances };

  const base: ProjectionInput = {
    // Primary demographics
    birthdate: stableFixtureBirthdate(primaryBirthYear),
    province: 'ON',
    retirementAge: startAge,
    lifeExpectancy: startAge + projectionYears,
    maritalStatus: 'married',
    projectionStartYear: PROJECTION_START_YEAR,

    // Employment (fully retired)
    employmentIncome: 0,
    employmentGrowthRate: 0,

    // Government benefits
    expectedCPPAt65: 9_000,
    cppStartAge: 65,
    oasStartAge: 65,
    yearsOfResidence: 40,

    // Primary accounts
    rrspBalance: mergedBalances.rrsp,
    rrspAnnualContribution: 0,
    rrifBalance: mergedBalances.rrif,
    lifBalance: mergedBalances.lif,
    lifJurisdiction: 'ON',
    tfsaBalance: mergedBalances.tfsa,
    tfsaAnnualContribution: 0,
    nonRegBalance: mergedBalances.nonReg,

    // Spending
    retirementSpending: targetRetirementSpending,

    // Assumptions
    investmentReturn: 0.05,
    inflationRate,

    // Strategy
    drawdownOrder,
    ...(strategyId !== undefined ? { strategyId } : {}),

    // Spending modifiers
    ...(ageBandReductions !== undefined ? { ageBandReductions } : {}),

    // Spouse
    spouse: {
      birthdate: stableFixtureBirthdate(spouseBirthYear),
      retirementAge: spouseStartAge,
      lifeExpectancy: spouseStartAge + projectionYears,
      employmentIncome: 0,
      expectedCPPAt65: 7_000,
      cppStartAge: 65,
      oasStartAge: 65,
      yearsOfResidence: 40,
      // Spouse has half the primary balances
      rrspBalance: Math.round(mergedBalances.rrsp / 2),
      tfsaBalance: Math.round(mergedBalances.tfsa / 2),
      nonRegBalance: Math.round(mergedBalances.nonReg / 2),
    },

    coupleSettings: {
      optimizePensionSplitting: false,
      useYoungerSpouseForRRIF: false,
    },

    // Phase 1 override fields (now native on ProjectionInput — Plan 03)
    ...(withdrawalOverrides !== undefined ? { withdrawalOverrides } : {}),
    ...(spendingOverrides !== undefined ? { spendingOverrides } : {}),
    ...(surplusDestination !== undefined ? { surplusDestination } : {}),
  };

  return base;
}
