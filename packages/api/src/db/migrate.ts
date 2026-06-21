import { sql } from 'kysely';
import { db } from './connection.js';
import { logger } from '../utils/logger.js';

async function migrate() {
  logger.info('Starting database migrations...');

  try {
    // Enable UUID extension
    await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`.execute(db);
    await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`.execute(db);

    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255),
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE,
        email_verified BOOLEAN DEFAULT FALSE,
        email_verified_at TIMESTAMP WITH TIME ZONE
      )
    `.execute(db);
    logger.info('Created users table');

    // docker/postgres/init.sql seeds password_hash as NOT NULL, but OAuth users
    // (Google sign-in) never have a password — drop the constraint if a previous
    // init left it. Idempotent: no-op when already nullable.
    await sql`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`.execute(db);
    logger.info('Ensured password_hash is nullable on users');

    // Create oauth_providers table
    await sql`
      CREATE TABLE IF NOT EXISTS oauth_providers (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider VARCHAR(20) NOT NULL,
        provider_user_id VARCHAR(255) NOT NULL,
        access_token TEXT,
        refresh_token TEXT,
        token_expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(provider, provider_user_id)
      )
    `.execute(db);
    logger.info('Created oauth_providers table');

    // Create user_settings table
    await sql`
      CREATE TABLE IF NOT EXISTS user_settings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        province VARCHAR(2) NOT NULL DEFAULT 'ON',
        date_of_birth DATE,
        gender VARCHAR(10),
        marital_status VARCHAR(20),
        retirement_age INTEGER,
        life_expectancy INTEGER,
        theme VARCHAR(10) DEFAULT 'light',
        notifications_enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id)
      )
    `.execute(db);
    logger.info('Created user_settings table');

    // Create refresh_tokens table
    await sql`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        revoked_at TIMESTAMP WITH TIME ZONE
      )
    `.execute(db);
    logger.info('Created refresh_tokens table');

    // Create projections table
    await sql`
      CREATE TABLE IF NOT EXISTS projections (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        input_data JSONB NOT NULL,
        result_data JSONB,
        status VARCHAR(20) DEFAULT 'pending',
        calculated_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE
      )
    `.execute(db);
    logger.info('Created projections table');

    // Add all potentially missing columns to projections
    // (for databases created before these columns were added)
    await sql`
      ALTER TABLE projections
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS result_data JSONB,
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS calculated_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE
    `.execute(db);
    logger.info('Ensured all columns exist in projections');

    // Drop legacy scenarios table — replaced by profile_scenarios (v1.3).
    await sql`DROP TABLE IF EXISTS scenarios CASCADE`.execute(db);
    logger.info('Dropped legacy scenarios table (replaced by profile_scenarios)');

    // Public-beta: record when the user accepted the educational-only disclaimer
    // at signup, so we have a defensible audit trail server-side (not just localStorage).
    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS disclaimer_accepted_at TIMESTAMP WITH TIME ZONE
    `.execute(db);
    logger.info('Ensured disclaimer_accepted_at column on users');

    // Create accounts table
    await sql`
      CREATE TABLE IF NOT EXISTS accounts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
        annual_contribution DECIMAL(15, 2) NOT NULL DEFAULT 0,
        investment_return_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.05,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE
      )
    `.execute(db);
    logger.info('Created accounts table');

    // Create income_sources table
    await sql`
      CREATE TABLE IF NOT EXISTS income_sources (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(30) NOT NULL,
        name VARCHAR(100) NOT NULL,
        annual_amount DECIMAL(15, 2) NOT NULL,
        start_age INTEGER,
        end_age INTEGER,
        is_indexed BOOLEAN DEFAULT FALSE,
        indexation_rate DECIMAL(5, 4),
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE
      )
    `.execute(db);
    logger.info('Created income_sources table');

    // Create config_data table
    await sql`
      CREATE TABLE IF NOT EXISTS config_data (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        category VARCHAR(50) NOT NULL,
        year INTEGER NOT NULL,
        province VARCHAR(2),
        data JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(category, year, province)
      )
    `.execute(db);
    logger.info('Created config_data table');

    // Create monte_carlo_jobs table
    await sql`
      CREATE TABLE IF NOT EXISTS monte_carlo_jobs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        projection_id UUID NOT NULL REFERENCES projections(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending',
        iterations INTEGER NOT NULL DEFAULT 1000,
        progress INTEGER DEFAULT 0,
        result_data JSONB,
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `.execute(db);
    logger.info('Created monte_carlo_jobs table');

    // Create household_profiles table
    // @see docs/source-of-truth/01-user-profile.md - Household Profile
    await sql`
      CREATE TABLE IF NOT EXISTS household_profiles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        step_data JSONB NOT NULL DEFAULT '{}',
        current_step INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id)
      )
    `.execute(db);
    logger.info('Created household_profiles table');

    // Create profile_scenarios table
    // @see .planning/phases/17-schema-assembler-foundation/17-CONTEXT.md - D-12, D-13
    await sql`
      CREATE TABLE IF NOT EXISTS profile_scenarios (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        profile_id UUID NOT NULL REFERENCES household_profiles(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        is_base BOOLEAN NOT NULL DEFAULT FALSE,
        decisions JSONB NOT NULL DEFAULT '{}',
        result_data JSONB,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        calculated_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `.execute(db);
    logger.info('Created profile_scenarios table');

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`.execute(db);
    await sql`CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at)`.execute(db);
    await sql`CREATE INDEX IF NOT EXISTS idx_oauth_providers_user_id ON oauth_providers(user_id)`.execute(
      db
    );
    await sql`CREATE INDEX IF NOT EXISTS idx_oauth_providers_provider ON oauth_providers(provider, provider_user_id)`.execute(
      db
    );
    await sql`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)`.execute(
      db
    );
    await sql`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at)`.execute(
      db
    );
    await sql`CREATE INDEX IF NOT EXISTS idx_projections_user_id ON projections(user_id)`.execute(
      db
    );
    await sql`CREATE INDEX IF NOT EXISTS idx_projections_deleted_at ON projections(deleted_at)`.execute(
      db
    );
    await sql`CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id)`.execute(db);
    await sql`CREATE INDEX IF NOT EXISTS idx_income_sources_user_id ON income_sources(user_id)`.execute(
      db
    );
    await sql`CREATE INDEX IF NOT EXISTS idx_config_data_category_year ON config_data(category, year)`.execute(
      db
    );
    await sql`CREATE INDEX IF NOT EXISTS idx_monte_carlo_jobs_projection_id ON monte_carlo_jobs(projection_id)`.execute(
      db
    );
    await sql`CREATE INDEX IF NOT EXISTS idx_household_profiles_user_id ON household_profiles(user_id)`.execute(
      db
    );
    // Partial unique index: exactly one base scenario per profile (D-13)
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_scenarios_base
      ON profile_scenarios(profile_id) WHERE is_base = TRUE
    `.execute(db);
    await sql`
      CREATE INDEX IF NOT EXISTS idx_profile_scenarios_profile_id
      ON profile_scenarios(profile_id)
    `.execute(db);
    logger.info('Created indexes');

    // Add spouse columns to user_settings
    // @see docs/source-of-truth/01-user-profile.md - Spouse Requirements
    await sql`
      ALTER TABLE user_settings
      ADD COLUMN IF NOT EXISTS spouse_date_of_birth DATE,
      ADD COLUMN IF NOT EXISTS spouse_life_expectancy INTEGER,
      ADD COLUMN IF NOT EXISTS spouse_retirement_age INTEGER,
      ADD COLUMN IF NOT EXISTS spouse_province VARCHAR(2),
      ADD COLUMN IF NOT EXISTS spouse_expected_cpp_at_65 DECIMAL(10, 2),
      ADD COLUMN IF NOT EXISTS spouse_cpp_start_age INTEGER,
      ADD COLUMN IF NOT EXISTS spouse_oas_start_age INTEGER,
      ADD COLUMN IF NOT EXISTS spouse_years_of_residence INTEGER,
      ADD COLUMN IF NOT EXISTS spouse_employment_income DECIMAL(15, 2),
      ADD COLUMN IF NOT EXISTS spouse_employment_growth_rate DECIMAL(5, 4)
    `.execute(db);
    logger.info('Added spouse columns to user_settings');

    // Add constraints for spouse fields
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_spouse_life_expectancy'
        ) THEN
          ALTER TABLE user_settings ADD CONSTRAINT chk_spouse_life_expectancy
            CHECK (spouse_life_expectancy IS NULL OR (spouse_life_expectancy >= 65 AND spouse_life_expectancy <= 110));
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_spouse_retirement_age'
        ) THEN
          ALTER TABLE user_settings ADD CONSTRAINT chk_spouse_retirement_age
            CHECK (spouse_retirement_age IS NULL OR (spouse_retirement_age >= 18 AND spouse_retirement_age <= 75));
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_spouse_cpp_start_age'
        ) THEN
          ALTER TABLE user_settings ADD CONSTRAINT chk_spouse_cpp_start_age
            CHECK (spouse_cpp_start_age IS NULL OR (spouse_cpp_start_age >= 60 AND spouse_cpp_start_age <= 70));
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_spouse_oas_start_age'
        ) THEN
          ALTER TABLE user_settings ADD CONSTRAINT chk_spouse_oas_start_age
            CHECK (spouse_oas_start_age IS NULL OR (spouse_oas_start_age >= 65 AND spouse_oas_start_age <= 70));
        END IF;
      END
      $$;
    `.execute(db);
    logger.info('Added constraints for spouse fields');

    // Polymorphic owner for monte_carlo_jobs: support profile scenarios
    await sql`
      ALTER TABLE monte_carlo_jobs
      ADD COLUMN IF NOT EXISTS profile_scenario_id UUID REFERENCES profile_scenarios(id) ON DELETE CASCADE
    `.execute(db);
    await sql`ALTER TABLE monte_carlo_jobs ALTER COLUMN projection_id DROP NOT NULL`.execute(db);
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_mc_jobs_owner_xor'
        ) THEN
          ALTER TABLE monte_carlo_jobs ADD CONSTRAINT chk_mc_jobs_owner_xor
            CHECK ((projection_id IS NOT NULL) <> (profile_scenario_id IS NOT NULL));
        END IF;
      END
      $$;
    `.execute(db);
    await sql`
      CREATE INDEX IF NOT EXISTS idx_monte_carlo_jobs_profile_scenario_id
      ON monte_carlo_jobs(profile_scenario_id)
    `.execute(db);
    logger.info('Extended monte_carlo_jobs with polymorphic owner (profile_scenario_id)');

    // v1.14: historical backtesting cache columns on profile_scenarios
    await sql`
      ALTER TABLE profile_scenarios
      ADD COLUMN IF NOT EXISTS backtest_data JSONB,
      ADD COLUMN IF NOT EXISTS backtest_input_hash VARCHAR(64)
    `.execute(db);
    logger.info('Added backtest_data and backtest_input_hash to profile_scenarios');

    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  } finally {
    await db.destroy();
  }
}

migrate().catch((err: unknown) => {
  logger.error('Migration failed:', err);
  process.exit(1);
});
