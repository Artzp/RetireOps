/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
/**
 * Scenario Optimization Service — M005 Phase 1
 *
 * Runs the four tax-optimization analyzers against a profile scenario's
 * computed ProjectionInput.
 *
 * @see packages/calculation-engine/src/optimization/orchestrator.ts
 * @see docs/source-of-truth/ — CARD-01..CARD-05
 */
import { db } from '../db/connection.js';
import { NotFoundError } from '../middleware/error-handler.js';
import { assembleProfileInputData } from './profile-assembler.js';
import { applyScenarioDecisions } from './scenario-decisions.js';
import { transformToProjectionInput } from './projection-transformer.js';
import {
  runProjection,
  cloneProjectionInput,
  runOptimizationAnalysis,
} from '@retireops/calculation-engine';
import { ScenarioDecisionsSchema, type OptimizationResult } from '@retireops/shared';
import type { ProfileData } from './profile.service.js';
import {
  adaptCoupleOutputForOptimization,
  isCoupleProjectionOutput,
} from './optimization-output-adapter.js';

async function resolveProfileId(userId: string): Promise<string> {
  const profile = await db
    .selectFrom('household_profiles')
    .select(['id'])
    .where('user_id', '=', userId)
    .executeTakeFirst();
  if (!profile) throw new NotFoundError('Profile');
  return (profile as any).id as string;
}

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
 * GET /api/profile/scenarios/:id/analyze
 *
 * No DB caching — runs on request (orchestrator is fast). Redis cache can
 * be layered later if perf requires it.
 */
export async function analyzeScenario(
  userId: string,
  scenarioId: string
): Promise<OptimizationResult> {
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
  const decisions = ScenarioDecisionsSchema.parse(
    ((scenarioRow as any).decisions ?? {}) as unknown
  );
  const inputWithDecisions = applyScenarioDecisions(baseInput, decisions);
  const calcInput = transformToProjectionInput(inputWithDecisions);

  const rawBaselineOutput = runProjection(calcInput);
  const baselineOutput = isCoupleProjectionOutput(rawBaselineOutput)
    ? adaptCoupleOutputForOptimization(rawBaselineOutput)
    : rawBaselineOutput;
  const clonedInput = cloneProjectionInput(calcInput);

  return runOptimizationAnalysis({
    baselineOutput,
    clonedInput,
    ...(isCoupleProjectionOutput(rawBaselineOutput) && {
      coupleYearlyResults: rawBaselineOutput.yearlyResults,
    }),
  });
}
