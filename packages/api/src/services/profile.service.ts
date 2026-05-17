import { sql } from 'kysely';
import { db } from '../db/connection.js';
import { NotFoundError } from '../middleware/error-handler.js';
import { syncDobToSettings } from './dob-sync.js';
import { markScenariosStale, scheduleRecomputeAllScenarios } from './profile-scenario.service.js';

export const VALID_STEPS = [
  'about_you',
  'spouse',
  'income',
  'spending',
  'accounts',
  'debts',
  'benefits',
  'government_pensions',
  'property_goals',
] as const;
export type StepSlug = (typeof VALID_STEPS)[number];

export interface ProfileData {
  id: string;
  stepData: Record<string, unknown>;
  currentStep: number;
  createdAt: Date;
  updatedAt: Date;
}

function toProfileData(row: {
  id: string;
  step_data: unknown;
  current_step: number;
  created_at: Date;
  updated_at: Date;
}): ProfileData {
  return {
    id: row.id,
    stepData: (row.step_data ?? {}) as Record<string, unknown>,
    currentStep: row.current_step,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get the household profile for a user.
 * @see docs/source-of-truth/01-user-profile.md - Household Profile
 */
export async function getProfile(userId: string): Promise<ProfileData> {
  const row = await db
    .selectFrom('household_profiles')
    .selectAll()
    .where('user_id', '=', userId)
    .executeTakeFirst();

  if (!row) {
    throw new NotFoundError('Profile');
  }

  return toProfileData(
    row as {
      id: string;
      step_data: unknown;
      current_step: number;
      created_at: Date;
      updated_at: Date;
    }
  );
}

/**
 * Upsert a single wizard step in the household profile.
 * Creates the profile row if it does not exist (INSERT ON CONFLICT).
 * Replaces the entire step key in step_data JSONB (last write wins).
 * @see docs/source-of-truth/01-user-profile.md - Household Profile
 */
export async function upsertProfileStep(
  userId: string,
  step: StepSlug,
  stepPayload: unknown,
  currentStep: number
): Promise<ProfileData> {
  const result = await sql<{
    id: string;
    step_data: unknown;
    current_step: number;
    created_at: Date;
    updated_at: Date;
  }>`
    INSERT INTO household_profiles (user_id, step_data, current_step)
    VALUES (${userId}, jsonb_build_object(${sql.lit(step)}, ${JSON.stringify(stepPayload)}::jsonb), ${currentStep})
    ON CONFLICT (user_id) DO UPDATE SET
      step_data = jsonb_set(household_profiles.step_data, ${sql.lit(`{${step}}`)}, ${JSON.stringify(stepPayload)}::jsonb),
      current_step = ${currentStep},
      updated_at = NOW()
    RETURNING id, step_data, current_step, created_at, updated_at
  `.execute(db);

  const row = result.rows[0];
  if (!row) {
    throw new Error('Upsert failed to return a row');
  }

  // Sync DOB to user_settings (fire-and-forget, DOB-SYNC-01/02)
  if (step === 'about_you') {
    const payload = stepPayload as Record<string, unknown> | null;
    const dobValue = payload?.dateOfBirth as string | null | undefined;
    if (dobValue !== undefined) {
      void syncDobToSettings(userId, 'owner', dobValue ?? null).catch(() => {});
    }
  } else if (step === 'spouse') {
    const payload = stepPayload as Record<string, unknown> | null;
    const dobValue = payload?.dateOfBirth as string | null | undefined;
    if (dobValue !== undefined) {
      void syncDobToSettings(userId, 'spouse', dobValue ?? null).catch(() => {});
    }
  }

  // Auto-create Base Scenario on first profile creation (D-15, D-16)
  // Detection: on INSERT, PostgreSQL NOW() sets both created_at and updated_at in the same
  // statement, so they are equal. On UPDATE (conflict path), updated_at is set to NOW()
  // while created_at retains its original value.
  const isFirstInsert = row.created_at.getTime() === row.updated_at.getTime();

  if (isFirstInsert) {
    await db
      .insertInto('profile_scenarios')
      .values({
        profile_id: row.id,
        name: 'Base Scenario',
        is_base: true,
        decisions: JSON.stringify({}),
        status: 'pending',
      })
      .execute();
  } else {
    // D-04: Mark all linked scenarios stale BEFORE response
    await markScenariosStale(row.id);

    // D-02: Fire-and-forget recompute — does NOT block response.
    // Serialized per profile via scheduleRecomputeAllScenarios so concurrent
    // PATCHes cannot race and overwrite each other's results (SCEN-08 race fix).
    void scheduleRecomputeAllScenarios(row.id).catch((_err: unknown) => {
      // Errors logged inside recomputeAllScenarios per-scenario;
      // this catch handles unexpected top-level failures
    });
  }

  return toProfileData(row);
}
