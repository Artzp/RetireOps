import type { Generated, ColumnType } from 'kysely';

// User table
export interface UsersTable {
  id: Generated<string>;
  email: string;
  password_hash: string | null; // Nullable for OAuth-only users
  name: string;
  created_at: Generated<Date>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
  deleted_at: Date | null;
  email_verified: Generated<boolean>;
  email_verified_at: Date | null;
  // Stamped at signup when the user accepts the educational-only disclaimer.
  // Provides a defensible audit trail that the user saw the not-financial-advice notice.
  disclaimer_accepted_at: Date | null;
}

// OAuth providers table
export interface OAuthProvidersTable {
  id: Generated<string>;
  user_id: string;
  provider: string; // 'google', 'github', etc.
  provider_user_id: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: Date | null;
  created_at: Generated<Date>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
}

// User settings table
export interface UserSettingsTable {
  id: Generated<string>;
  user_id: string;
  province: string;
  date_of_birth: Date | null;
  gender: string | null;
  marital_status: string | null;
  retirement_age: number | null;
  life_expectancy: number | null;
  theme: Generated<string>;
  notifications_enabled: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: ColumnType<Date, Date | undefined, Date>;

  // Spouse demographics
  spouse_date_of_birth: Date | null;
  spouse_life_expectancy: number | null;
  spouse_retirement_age: number | null;
  spouse_province: string | null;

  // Spouse government benefits
  spouse_expected_cpp_at_65: number | null;
  spouse_cpp_start_age: number | null;
  spouse_oas_start_age: number | null;
  spouse_years_of_residence: number | null;

  // Spouse employment
  spouse_employment_income: number | null;
  spouse_employment_growth_rate: number | null;
}

// Refresh tokens table
export interface RefreshTokensTable {
  id: Generated<string>;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Generated<Date>;
  revoked_at: Date | null;
}

// Projections table
export interface ProjectionsTable {
  id: Generated<string>;
  user_id: string;
  name: string;
  description: string | null;
  input_data: unknown; // JSONB
  result_data: unknown; // JSONB, nullable
  status: Generated<string>;
  calculated_at: Date | null;
  created_at: Generated<Date>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
  deleted_at: Date | null;
}

// Accounts table (user's financial accounts)
export interface AccountsTable {
  id: Generated<string>;
  user_id: string;
  type: string; // RRSP, TFSA, RRIF, NonRegistered, etc.
  name: string;
  balance: number;
  annual_contribution: number;
  investment_return_rate: number;
  metadata: unknown; // JSONB for type-specific data, nullable
  created_at: Generated<Date>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
  deleted_at: Date | null;
}

// Income sources table
export interface IncomeSourcesTable {
  id: Generated<string>;
  user_id: string;
  type: string; // employment, pension, rental, etc.
  name: string;
  annual_amount: number;
  start_age: number | null;
  end_age: number | null;
  is_indexed: Generated<boolean>;
  indexation_rate: number | null;
  metadata: unknown; // JSONB for type-specific data, nullable
  created_at: Generated<Date>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
  deleted_at: Date | null;
}

// Config data table (tax brackets, rates, etc.)
export interface ConfigDataTable {
  id: Generated<string>;
  category: string; // federal_tax, provincial_tax, cpp_rates, etc.
  year: number;
  province: string | null;
  data: unknown; // JSONB
  created_at: Generated<Date>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
}

// Monte Carlo jobs table
export interface MonteCarloJobsTable {
  id: Generated<string>;
  projection_id: string | null;
  profile_scenario_id: string | null;
  status: Generated<string>;
  iterations: number;
  progress: Generated<number>;
  result_data: unknown; // JSONB, nullable
  started_at: Date | null;
  completed_at: Date | null;
  error_message: string | null;
  created_at: Generated<Date>;
}

// Household profiles table
export interface HouseholdProfilesTable {
  id: Generated<string>;
  user_id: string;
  step_data: unknown; // JSONB - keyed by step slug
  current_step: Generated<number>;
  created_at: Generated<Date>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
}

// Profile scenarios table (v1.3 — scenario decisions layer)
export interface ProfileScenariosTable {
  id: Generated<string>;
  profile_id: string;
  name: string;
  is_base: boolean;
  decisions: unknown; // JSONB — ScenarioDecisions at runtime
  result_data: unknown; // JSONB, nullable — populated when scenario is run
  status: Generated<string>;
  calculated_at: Date | null;
  created_at: Generated<Date>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
  // v1.14 historical backtesting columns
  backtest_data: unknown; // JSONB — BacktestResult, nullable
  backtest_input_hash: string | null; // SHA-256 of deterministicSerialize(projectionInput) for staleness detection
}

// Complete database schema
export interface Database {
  users: UsersTable;
  oauth_providers: OAuthProvidersTable;
  user_settings: UserSettingsTable;
  refresh_tokens: RefreshTokensTable;
  projections: ProjectionsTable;
  accounts: AccountsTable;
  income_sources: IncomeSourcesTable;
  config_data: ConfigDataTable;
  monte_carlo_jobs: MonteCarloJobsTable;
  household_profiles: HouseholdProfilesTable;
  profile_scenarios: ProfileScenariosTable;
}
