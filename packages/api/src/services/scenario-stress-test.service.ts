/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
/**
 * Scenario Stress Test Service — Feature 3.3
 *
 * Runs all 4 stress-test scenarios against a profile scenario's
 * computed ProjectionInput and returns chart-ready results.
 *
 * No caching — stress tests are deterministic and fast (<10 ms).
 *
 * @see docs/source-of-truth/06-investment-engine.md — Stress Test Scenarios Table
 */
import { db } from '../db/connection.js';
import { NotFoundError } from '../middleware/error-handler.js';
import { assembleProfileInputData } from './profile-assembler.js';
import { applyScenarioDecisions } from './scenario-decisions.js';
import { transformToFrontendOutput, transformToProjectionInput } from './projection-transformer.js';
import { runProjection, runStressTest } from '@retireops/calculation-engine';
import type { StressTestResult, StressScenario } from '@retireops/calculation-engine';
import { ScenarioDecisionsSchema } from '@retireops/shared';
import type { ProjectionYearRow } from '@retireops/shared';
import type { ProfileData } from './profile.service.js';

const STRESS_SCENARIOS: StressScenario[] = [
  'market_crash_at_retirement',
  'lost_decade',
  'high_inflation',
  '2008_replay',
];

/** Resolve profile_id for a given user_id. */
async function resolveProfileId(userId: string): Promise<string> {
  const profile = await db
    .selectFrom('household_profiles')
    .select(['id'])
    .where('user_id', '=', userId)
    .executeTakeFirst();
  if (!profile) throw new NotFoundError('Profile');
  return (profile as any).id as string;
}

/** Load profile row as ProfileData. */
async function getProfileById(profileId: string): Promise<ProfileData> {
  const row = await db
    .selectFrom('household_profiles')
    .selectAll()
    .where('id', '=', profileId)
    .executeTakeFirst();
  if (!row) throw new NotFoundError('Profile');
  return {
    id: (row as any).id as string,
    stepData: ((row as any).step_data ?? {}) as Record<string, unknown>,
    currentStep: (row as any).current_step as number,
    createdAt: (row as any).created_at as Date,
    updatedAt: (row as any).updated_at as Date,
  };
}

export interface StressTestResponse {
  results: StressTestResult[];
}

/**
 * POST /api/profile/scenarios/:id/stress-test
 *
 * Runs all 4 stress scenarios synchronously. Portfolio parameters are derived
 * from the projection's retirement-phase rows (initialBalance =
 * totalNetWorth at retirement; annualWithdrawal = first retirement year
 * livingExpenses) so the scenarios' year-1 shocks apply at retirement, not
 * today. Returns chart-ready results with yearlyData per scenario.
 *
 * @see docs/source-of-truth/06-investment-engine.md — Stress Test Scenarios Table
 */
export async function runScenarioStressTest(
  userId: string,
  scenarioId: string
): Promise<StressTestResponse> {
  const profileId = await resolveProfileId(userId);

  const scenarioRow = await db
    .selectFrom('profile_scenarios')
    .selectAll()
    .where('id', '=', scenarioId)
    .where('profile_id', '=', profileId)
    .executeTakeFirst();
  if (!scenarioRow) throw new NotFoundError('Scenario');

  const profile = await getProfileById(profileId);
  const baseInput = assembleProfileInputData(profile);
  // decisions is stored as a JSONB column — in-memory mock may return a raw JSON string
  const rawDecisions = (scenarioRow as any).decisions as unknown;
  const decisionsObj =
    typeof rawDecisions === 'string' ? (JSON.parse(rawDecisions) as unknown) : (rawDecisions ?? {});
  const decisions = ScenarioDecisionsSchema.parse(decisionsObj);
  const inputWithDecisions = applyScenarioDecisions(baseInput, decisions);
  const calcInput = transformToProjectionInput(inputWithDecisions);

  // Stress scenarios treat year 1 as the first year of retirement (e.g.
  // `market_crash_at_retirement` = -30% in year 1). Feeding today's balances
  // and working-plus-retired horizon would misapply the shock to pre-retirement
  // accumulation. Derive the at-retirement portfolio from the projection rows:
  //   initialBalance   = last pre-retirement row's totalNetWorth
  //   annualWithdrawal = first retirement row's livingExpenses NET of guaranteed
  //                      income (pension + CPP + OAS). The deterministic projection
  //                      already offsets spending with these streams; passing gross
  //                      expenses would inflate portfolio draw in the stress scenarios.
  const calcOutput = runProjection(calcInput);
  const frontendOutput = transformToFrontendOutput(calcOutput, calcInput.lifeExpectancy);
  const rows: ProjectionYearRow[] = frontendOutput.projectionRows;
  const lastWorkingRow = [...rows].reverse().find((r) => !r.isRetired);
  const firstRetirementRow = rows.find((r) => r.isRetired);

  let initialBalance: number;
  let annualWithdrawal: number;
  if (lastWorkingRow && firstRetirementRow) {
    initialBalance = lastWorkingRow.totalNetWorth;
    annualWithdrawal = Math.max(
      0,
      firstRetirementRow.livingExpenses -
        (firstRetirementRow.pensionIncome +
          firstRetirementRow.cppIncome +
          firstRetirementRow.oasIncome)
    );
  } else {
    // Fallback: already-retired scenarios (or degenerate projections) lack a
    // working row to read from — current balances are the at-retirement balances.
    initialBalance =
      calcInput.rrspBalance +
      (calcInput.rrifBalance ?? 0) +
      calcInput.tfsaBalance +
      calcInput.nonRegBalance;
    annualWithdrawal = calcInput.retirementSpending;
  }
  const projectionYears = Math.max(1, calcInput.lifeExpectancy - calcInput.retirementAge);
  const baseExpectedReturn = calcInput.investmentReturn;

  const results: StressTestResult[] = STRESS_SCENARIOS.map((scenario) =>
    runStressTest({
      scenario,
      initialBalance,
      annualWithdrawal,
      projectionYears,
      baseExpectedReturn,
    })
  );

  return { results };
}
