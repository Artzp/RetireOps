import { db } from '../db/connection.js';
import { NotFoundError } from '../middleware/error-handler.js';
import { syncDobToProfile } from './dob-sync.js';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: Date;
  settings: UserSettings | null;
}

export interface UserSettings {
  province: string;
  dateOfBirth: Date | null;
  gender: string | null;
  maritalStatus: string | null;
  retirementAge: number | null;
  lifeExpectancy: number | null;
  theme: string;
  notificationsEnabled: boolean;
}

export interface UpdateProfileInput {
  name?: string;
}

export interface UpdateSettingsInput {
  province?: string;
  dateOfBirth?: Date | null;
  gender?: string | null;
  maritalStatus?: string | null;
  retirementAge?: number | null;
  lifeExpectancy?: number | null;
  theme?: string;
  notificationsEnabled?: boolean;
}

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const user = await db
    .selectFrom('users')
    .leftJoin('user_settings', 'users.id', 'user_settings.user_id')
    .select([
      'users.id',
      'users.email',
      'users.name',
      'users.email_verified',
      'users.created_at',
      'user_settings.province',
      'user_settings.date_of_birth',
      'user_settings.gender',
      'user_settings.marital_status',
      'user_settings.retirement_age',
      'user_settings.life_expectancy',
      'user_settings.theme',
      'user_settings.notifications_enabled',
    ])
    .where('users.id', '=', userId)
    .where('users.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!user) {
    throw new NotFoundError('User');
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.email_verified,
    createdAt: user.created_at,
    settings: user.province
      ? {
          province: user.province,
          dateOfBirth: user.date_of_birth,
          gender: user.gender,
          maritalStatus: user.marital_status,
          retirementAge: user.retirement_age,
          lifeExpectancy: user.life_expectancy,
          theme: user.theme ?? 'light',
          notificationsEnabled: user.notifications_enabled ?? true,
        }
      : null,
  };
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput
): Promise<UserProfile> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date(),
  };

  if (input.name !== undefined) {
    updateData.name = input.name;
  }

  await db
    .updateTable('users')
    .set(updateData)
    .where('id', '=', userId)
    .where('deleted_at', 'is', null)
    .execute();

  return getUserProfile(userId);
}

export async function updateSettings(
  userId: string,
  input: UpdateSettingsInput
): Promise<UserProfile> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date(),
  };

  if (input.province !== undefined) {
    updateData.province = input.province;
  }
  if (input.dateOfBirth !== undefined) {
    updateData.date_of_birth = input.dateOfBirth;
  }
  if (input.gender !== undefined) {
    updateData.gender = input.gender;
  }
  if (input.maritalStatus !== undefined) {
    updateData.marital_status = input.maritalStatus;
  }
  if (input.retirementAge !== undefined) {
    updateData.retirement_age = input.retirementAge;
  }
  if (input.lifeExpectancy !== undefined) {
    updateData.life_expectancy = input.lifeExpectancy;
  }
  if (input.theme !== undefined) {
    updateData.theme = input.theme;
  }
  if (input.notificationsEnabled !== undefined) {
    updateData.notifications_enabled = input.notificationsEnabled;
  }

  await db.updateTable('user_settings').set(updateData).where('user_id', '=', userId).execute();

  // Sync DOB to household_profiles (fire-and-forget, DOB-SYNC-03)
  if (input.dateOfBirth !== undefined) {
    void syncDobToProfile(userId, 'owner', input.dateOfBirth ?? null).catch(() => {});
  }

  return getUserProfile(userId);
}

export async function deleteAccount(userId: string): Promise<void> {
  // Soft delete - mark as deleted
  await db
    .updateTable('users')
    .set({
      deleted_at: new Date(),
      updated_at: new Date(),
    })
    .where('id', '=', userId)
    .execute();
}

/**
 * Spouse settings interface
 * @see docs/source-of-truth/01-user-profile.md - Spouse Requirements
 */
export interface SpouseSettings {
  dateOfBirth: Date | null;
  lifeExpectancy: number | null;
  retirementAge: number | null;
  province: string | null;
  expectedCppAt65: number | null;
  cppStartAge: number | null;
  oasStartAge: number | null;
  yearsOfResidence: number | null;
  employmentIncome: number | null;
  employmentGrowthRate: number | null;
}

export interface UpdateSpouseSettingsInput {
  dateOfBirth?: Date | null;
  lifeExpectancy?: number | null;
  retirementAge?: number | null;
  province?: string | null;
  expectedCppAt65?: number | null;
  cppStartAge?: number | null;
  oasStartAge?: number | null;
  yearsOfResidence?: number | null;
  employmentIncome?: number | null;
  employmentGrowthRate?: number | null;
}

/**
 * Get spouse settings for a user
 */
export async function getSpouseSettings(userId: string): Promise<SpouseSettings | null> {
  const settings = await db
    .selectFrom('user_settings')
    .select([
      'spouse_date_of_birth',
      'spouse_life_expectancy',
      'spouse_retirement_age',
      'spouse_province',
      'spouse_expected_cpp_at_65',
      'spouse_cpp_start_age',
      'spouse_oas_start_age',
      'spouse_years_of_residence',
      'spouse_employment_income',
      'spouse_employment_growth_rate',
    ])
    .where('user_id', '=', userId)
    .executeTakeFirst();

  if (!settings?.spouse_date_of_birth) {
    return null;
  }

  return {
    dateOfBirth: settings.spouse_date_of_birth,
    lifeExpectancy: settings.spouse_life_expectancy,
    retirementAge: settings.spouse_retirement_age,
    province: settings.spouse_province,
    expectedCppAt65: settings.spouse_expected_cpp_at_65
      ? Number(settings.spouse_expected_cpp_at_65)
      : null,
    cppStartAge: settings.spouse_cpp_start_age,
    oasStartAge: settings.spouse_oas_start_age,
    yearsOfResidence: settings.spouse_years_of_residence,
    employmentIncome: settings.spouse_employment_income
      ? Number(settings.spouse_employment_income)
      : null,
    employmentGrowthRate: settings.spouse_employment_growth_rate
      ? Number(settings.spouse_employment_growth_rate)
      : null,
  };
}

/**
 * Update spouse settings for a user
 */
export async function updateSpouseSettings(
  userId: string,
  input: UpdateSpouseSettingsInput
): Promise<SpouseSettings | null> {
  const updateData: Record<string, unknown> = { updated_at: new Date() };

  if (input.dateOfBirth !== undefined) updateData.spouse_date_of_birth = input.dateOfBirth;
  if (input.lifeExpectancy !== undefined) updateData.spouse_life_expectancy = input.lifeExpectancy;
  if (input.retirementAge !== undefined) updateData.spouse_retirement_age = input.retirementAge;
  if (input.province !== undefined) updateData.spouse_province = input.province;
  if (input.expectedCppAt65 !== undefined)
    updateData.spouse_expected_cpp_at_65 = input.expectedCppAt65;
  if (input.cppStartAge !== undefined) updateData.spouse_cpp_start_age = input.cppStartAge;
  if (input.oasStartAge !== undefined) updateData.spouse_oas_start_age = input.oasStartAge;
  if (input.yearsOfResidence !== undefined)
    updateData.spouse_years_of_residence = input.yearsOfResidence;
  if (input.employmentIncome !== undefined)
    updateData.spouse_employment_income = input.employmentIncome;
  if (input.employmentGrowthRate !== undefined)
    updateData.spouse_employment_growth_rate = input.employmentGrowthRate;

  await db.updateTable('user_settings').set(updateData).where('user_id', '=', userId).execute();

  // Sync spouse DOB to household_profiles (fire-and-forget, DOB-SYNC-04)
  if (input.dateOfBirth !== undefined) {
    void syncDobToProfile(userId, 'spouse', input.dateOfBirth ?? null).catch(() => {});
  }

  return getSpouseSettings(userId);
}

/**
 * Delete spouse settings for a user
 */
export async function deleteSpouseSettings(userId: string): Promise<void> {
  await db
    .updateTable('user_settings')
    .set({
      spouse_date_of_birth: null,
      spouse_life_expectancy: null,
      spouse_retirement_age: null,
      spouse_province: null,
      spouse_expected_cpp_at_65: null,
      spouse_cpp_start_age: null,
      spouse_oas_start_age: null,
      spouse_years_of_residence: null,
      spouse_employment_income: null,
      spouse_employment_growth_rate: null,
      updated_at: new Date(),
    })
    .where('user_id', '=', userId)
    .execute();
}

export interface DataExport {
  user: Omit<UserProfile, 'settings'>;
  settings: UserSettings | null;
  spouseSettings: SpouseSettings | null;
  projections: unknown[];
  accounts: unknown[];
  incomeSources: unknown[];
  exportedAt: Date;
}

export async function exportUserData(userId: string): Promise<DataExport> {
  const profile = await getUserProfile(userId);

  // Get all projections
  const projections = await db
    .selectFrom('projections')
    .selectAll()
    .where('user_id', '=', userId)
    .where('deleted_at', 'is', null)
    .execute();

  // Get all accounts
  const accounts = await db
    .selectFrom('accounts')
    .selectAll()
    .where('user_id', '=', userId)
    .where('deleted_at', 'is', null)
    .execute();

  // Get all income sources
  const incomeSources = await db
    .selectFrom('income_sources')
    .selectAll()
    .where('user_id', '=', userId)
    .where('deleted_at', 'is', null)
    .execute();

  // Get spouse settings
  const spouseSettings = await getSpouseSettings(userId);

  return {
    user: {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      emailVerified: profile.emailVerified,
      createdAt: profile.createdAt,
    },
    settings: profile.settings,
    spouseSettings,
    projections,
    accounts,
    incomeSources,
    exportedAt: new Date(),
  };
}
