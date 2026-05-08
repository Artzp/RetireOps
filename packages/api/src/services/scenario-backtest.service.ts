/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
/**
 * Scenario Backtest Service — v1.14 Phase 61
 *
 * Runs all 3 historical preset backtests against a profile scenario's
 * computed ProjectionInput and caches results in `backtest_data`.
 *
 * Staleness: backtest_input_hash is a SHA-256 of the serialised
 * ProjectionInput; if it differs from the current hash the result is stale.
 *
 * @see docs/source-of-truth/06-investment-engine.md
 * @see packages/shared/src/types/historical-backtest.ts
 */
import { createHash } from 'node:crypto';
import { db } from '../db/connection.js';
import { NotFoundError } from '../middleware/error-handler.js';
import { assembleProfileInputData } from './profile-assembler.js';
import { applyScenarioDecisions } from './scenario-decisions.js';
import { transformToProjectionInput } from './projection-transformer.js';
import { runHistoricalBacktest } from '@retireops/calculation-engine';
import {
  BLENDED_HISTORICAL_RETURNS_DATASET,
  BACKTEST_PRESET_2000,
  BACKTEST_PRESET_2008,
  BACKTEST_PRESET_2020,
  ScenarioDecisionsSchema,
} from '@retireops/shared';
import type { BacktestResult, BacktestRun } from '@retireops/shared';
import type { ProfileData } from './profile.service.js';

const PRESETS = [BACKTEST_PRESET_2000, BACKTEST_PRESET_2008, BACKTEST_PRESET_2020];

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

/**
 * Compute a stable SHA-256 hash over the ProjectionInput to detect staleness.
 * Uses JSON.stringify — key insertion order is deterministic for objects
 * constructed by the same code path.
 */
function hashProjectionInput(input: unknown): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

/**
 * Decisions are stored as JSONB in Postgres (driver returns a parsed object),
 * but the in-memory mock DB and some legacy rows hold a JSON string. Normalise
 * before validating so a stringified blob doesn't surface as a 400
 * "Expected object, received string". Mirrors profile-scenario.service.ts:445-449.
 */
function parseScenarioDecisions(raw: unknown) {
  const obj = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : (raw ?? {});
  return ScenarioDecisionsSchema.parse(obj);
}

/**
 * Build the BacktestResult for a scenario WITHOUT writing to DB.
 */
async function computeBacktest(
  profileId: string,
  scenarioRow: any
): Promise<{ result: BacktestResult; inputHash: string }> {
  const profile = await getProfileById(profileId);
  const baseInput = assembleProfileInputData(profile);
  const decisions = parseScenarioDecisions(scenarioRow.decisions);
  const inputWithDecisions = applyScenarioDecisions(baseInput, decisions);
  const calcInput = transformToProjectionInput(inputWithDecisions);
  const inputHash = hashProjectionInput(calcInput);

  const runs: BacktestRun[] = PRESETS.map((preset) =>
    runHistoricalBacktest(calcInput, preset, BLENDED_HISTORICAL_RETURNS_DATASET)
  );

  const result: BacktestResult = {
    projectionId: scenarioRow.id as string,
    inputDataHash: inputHash,
    runs,
    computedAt: new Date().toISOString(),
  };

  return { result, inputHash };
}

export interface BacktestResponse {
  data: BacktestResult;
  /** true when stored results were computed against an older set of inputs */
  isStale: boolean;
}

/**
 * POST /api/profile/scenarios/:id/backtest
 *
 * Runs all 3 presets synchronously (<50 ms), stores results, and returns them.
 * Always re-runs and overwrites any previously cached result.
 */
export async function runScenarioBacktest(
  userId: string,
  scenarioId: string
): Promise<BacktestResponse> {
  const profileId = await resolveProfileId(userId);
  const scenarioRow = await db
    .selectFrom('profile_scenarios')
    .selectAll()
    .where('id', '=', scenarioId)
    .where('profile_id', '=', profileId)
    .executeTakeFirst();
  if (!scenarioRow) throw new NotFoundError('Scenario');

  const { result, inputHash } = await computeBacktest(profileId, scenarioRow);

  await db
    .updateTable('profile_scenarios')
    .set({
      backtest_data: result as never,
      backtest_input_hash: inputHash,
      updated_at: new Date(),
    })
    .where('id', '=', scenarioId)
    .execute();

  return { data: result, isStale: false };
}

/**
 * GET /api/profile/scenarios/:id/backtest
 *
 * Returns cached BacktestResult if available.
 * If the current ProjectionInput hash differs from the stored hash,
 * sets isStale=true so the UI can show a re-run prompt.
 * Returns 404 if no backtest has been run yet.
 */
export async function getScenarioBacktest(
  userId: string,
  scenarioId: string
): Promise<BacktestResponse> {
  const profileId = await resolveProfileId(userId);
  const scenarioRow = await db
    .selectFrom('profile_scenarios')
    .selectAll()
    .where('id', '=', scenarioId)
    .where('profile_id', '=', profileId)
    .executeTakeFirst();
  if (!scenarioRow) throw new NotFoundError('Scenario');

  const storedData = (scenarioRow as any).backtest_data as BacktestResult | null | undefined;
  const storedHash = (scenarioRow as any).backtest_input_hash as string | null | undefined;

  if (!storedData) throw new NotFoundError('BacktestResult');

  // Recompute current input hash to detect staleness (no engine run needed)
  const profile = await getProfileById(profileId);
  const baseInput = assembleProfileInputData(profile);
  const decisions = parseScenarioDecisions((scenarioRow as any).decisions);
  const inputWithDecisions = applyScenarioDecisions(baseInput, decisions);
  const calcInput = transformToProjectionInput(inputWithDecisions);
  const currentHash = hashProjectionInput(calcInput);

  const isStale = storedHash !== currentHash;

  return { data: storedData, isStale };
}
