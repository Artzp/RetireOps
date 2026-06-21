/**
 * Bidirectional DOB synchronization between user_settings and household_profiles.
 *
 * When DOB is saved via the profile wizard, it propagates to user_settings.
 * When DOB is saved via the settings page, it propagates to household_profiles step_data.
 *
 * @see docs/source-of-truth/01-user-profile.md - Household Profile
 */
import { sql } from 'kysely';
import { db } from '../db/connection.js';
import { logger } from '../utils/logger.js';

/**
 * Sync a DOB value from household_profiles step_data into user_settings.
 * Called after upsertProfileStep for 'about_you' (owner) or 'spouse' steps.
 *
 * @param userId - The user ID
 * @param role - 'owner' for primary DOB, 'spouse' for spouse DOB
 * @param dob - ISO date string (e.g. "1975-06-15") or null to clear
 */
export async function syncDobToSettings(
  userId: string,
  role: 'owner' | 'spouse',
  dob: string | null
): Promise<void> {
  const dateValue = dob ? new Date(dob) : null;
  const column = role === 'owner' ? 'date_of_birth' : 'spouse_date_of_birth';

  try {
    await db
      .updateTable('user_settings')
      .set({
        [column]: dateValue,
        updated_at: new Date(),
      })
      .where('user_id', '=', userId)
      .execute();
  } catch (err: unknown) {
    // If no user_settings row exists, the update affects 0 rows — not an error.
    // If a real DB error occurs, swallow it — sync is best-effort (audit C-11:
    // but leave a trace so silent failures are diagnosable).
    logger.debug('syncDobToSettings failed (best-effort, swallowed)', { userId, role, err });
  }
}

/**
 * Sync a DOB value from user_settings into household_profiles step_data JSONB.
 * Called after updateSettings (owner) or updateSpouseSettings (spouse).
 *
 * @param userId - The user ID
 * @param role - 'owner' syncs to step_data.about_you.dateOfBirth, 'spouse' to step_data.spouse.dateOfBirth
 * @param dob - Date object or null to clear
 */
export async function syncDobToProfile(
  userId: string,
  role: 'owner' | 'spouse',
  dob: Date | null
): Promise<void> {
  const isoDate = dob ? dob.toISOString().split('T')[0] : null;
  const jsonValue = isoDate ? `"${isoDate}"` : 'null';
  const stepKey = role === 'owner' ? 'about_you' : 'spouse';
  const jsonPath = `{${stepKey},dateOfBirth}`;

  try {
    await sql`
      UPDATE household_profiles
      SET step_data = jsonb_set(step_data, ${jsonPath}, ${jsonValue}::jsonb),
          updated_at = NOW()
      WHERE user_id = ${userId}
        AND step_data ? ${sql.lit(stepKey)}
    `.execute(db);
  } catch (err: unknown) {
    // If no household_profiles row exists or the step key is absent, silently
    // return — best-effort (audit C-11: traced at debug level).
    logger.debug('syncDobToProfile failed (best-effort, swallowed)', { userId, role, err });
  }
}
