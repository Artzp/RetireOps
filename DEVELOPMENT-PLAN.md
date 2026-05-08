# RetireOps - Comprehensive Development Plan

## Overview

This document provides a detailed, step-by-step development plan for building the RetireOps Canadian Retirement Planning application. The plan is organized into 4 major phases with granular sub-steps.

---

# PHASE 0: Project Foundation & Infrastructure Setup

## 0.1 Repository & Project Initialization

### 0.1.1 Git Repository Setup

- 0.1.1.1 Initialize Git repository with `.gitignore` for Node.js, TypeScript, and IDE files
- 0.1.1.2 Create branch protection rules for `main` and `develop` branches
- 0.1.1.3 Set up commit message conventions (Conventional Commits format)
- 0.1.1.4 Create `CONTRIBUTING.md` with development guidelines
- 0.1.1.5 Set up Git hooks with Husky for pre-commit linting and testing

### 0.1.2 Monorepo Structure Setup

- 0.1.2.1 Initialize pnpm workspace configuration (`pnpm-workspace.yaml`)
- 0.1.2.2 Create root `package.json` with shared scripts
- 0.1.2.3 Set up directory structure:
  ```
  /packages
    /web          # Next.js frontend
    /api          # Express API gateway
    /worker       # Calculation worker
    /shared       # Shared types and utilities
    /calculation-engine  # Core calculation logic
  ```
- 0.1.2.4 Configure TypeScript project references for monorepo
- 0.1.2.5 Set up shared ESLint configuration (`eslint.config.js`)
- 0.1.2.6 Set up shared Prettier configuration (`.prettierrc`)
- 0.1.2.7 Create shared `tsconfig.base.json` with strict TypeScript settings

### 0.1.3 Development Environment Configuration

- 0.1.3.1 Create `.env.development` from `.env.example` with local values
- 0.1.3.2 Set up VS Code workspace settings (`.vscode/settings.json`)
- 0.1.3.3 Create VS Code recommended extensions list (`.vscode/extensions.json`)
- 0.1.3.4 Configure VS Code launch configurations for debugging (`.vscode/launch.json`)
- 0.1.3.5 Set up EditorConfig (`.editorconfig`) for consistent formatting
- 0.1.3.6 Create development scripts in root `package.json`:
  - `dev` - Start all services in development mode
  - `build` - Build all packages
  - `test` - Run all tests
  - `lint` - Lint all packages
  - `typecheck` - Type check all packages

---

## 0.2 Docker & Local Infrastructure

### 0.2.1 Docker Configuration Enhancement

- 0.2.1.1 Create multi-stage `Dockerfile` for Next.js web app:
  - Stage 1: Dependencies installation
  - Stage 2: Build stage
  - Stage 3: Production runtime (minimal image)
- 0.2.1.2 Create multi-stage `Dockerfile` for Express API:
  - Stage 1: Dependencies installation
  - Stage 2: TypeScript compilation
  - Stage 3: Production runtime with Node.js Alpine
- 0.2.1.3 Create `Dockerfile` for calculation worker with heavy computation optimization
- 0.2.1.4 Create `docker-compose.dev.yml` for development with:
  - Volume mounts for hot reloading
  - Debug ports exposed
  - Lower resource limits for local machines
- 0.2.1.5 Create `docker-compose.test.yml` for running integration tests
- 0.2.1.6 Create `.dockerignore` files for each package

### 0.2.2 Database Initialization Scripts

- 0.2.2.1 Create `docker/postgres/init.sql`:
  - Create database `retireops`
  - Create database user with appropriate permissions
  - Enable required extensions (uuid-ossp, pgcrypto)
- 0.2.2.2 Create `docker/postgres/seed.sql`:
  - Insert 2024 federal tax brackets
  - Insert 2024 provincial tax brackets (all 13 provinces)
  - Insert 2024 CPP/OAS rates
  - Insert 2024 RRIF minimum withdrawal rates
  - Insert sample test user data
- 0.2.2.3 Create database backup script (`docker/postgres/backup.sh`)
- 0.2.2.4 Create database restore script (`docker/postgres/restore.sh`)

### 0.2.3 NGINX Configuration

- 0.2.3.1 Create `docker/nginx/nginx.conf` with:
  - Upstream definitions for web and API
  - SSL/TLS configuration (certificates path)
  - Gzip compression settings
  - Security headers (HSTS, X-Frame-Options, etc.)
  - Rate limiting configuration
- 0.2.3.2 Create `docker/nginx/default.conf` with:
  - Location routing for `/` (web) and `/api` (API gateway)
  - WebSocket support configuration
  - Static file caching rules
  - Health check endpoints
- 0.2.3.3 Create self-signed certificates for local development

### 0.2.4 Redis Configuration

- 0.2.4.1 Create `docker/redis/redis.conf` with:
  - Memory limit (512MB for dev, 2GB for prod)
  - LRU eviction policy
  - AOF persistence settings
  - Password authentication
- 0.2.4.2 Configure Redis Sentinel for high availability (production)

---

## 0.3 CI/CD Pipeline Setup

### 0.3.1 GitHub Actions Workflows

- 0.3.1.1 Create `.github/workflows/ci.yml`:
  - Trigger on push to `main`, `develop`, and PRs
  - Matrix testing (Node 20, 22)
  - Steps:
    - Checkout code
    - Setup pnpm
    - Install dependencies
    - Run linting
    - Run type checking
    - Run unit tests with coverage
    - Upload coverage to Codecov
- 0.3.1.2 Create `.github/workflows/integration-tests.yml`:
  - Spin up Docker Compose test environment
  - Run API integration tests
  - Run E2E tests with Playwright
  - Tear down environment
- 0.3.1.3 Create `.github/workflows/deploy-staging.yml`:
  - Trigger on push to `develop`
  - Build Docker images
  - Push to container registry
  - Deploy to staging environment
- 0.3.1.4 Create `.github/workflows/deploy-production.yml`:
  - Trigger on release tags
  - Build production Docker images
  - Push to container registry
  - Deploy to production with rolling update
- 0.3.1.5 Create `.github/workflows/security-scan.yml`:
  - Run npm audit
  - Run Snyk vulnerability scan
  - Run SAST (CodeQL analysis)

### 0.3.2 GitHub Repository Configuration

- 0.3.2.1 Create issue templates:
  - Bug report template
  - Feature request template
  - Documentation improvement template
- 0.3.2.2 Create pull request template
- 0.3.2.3 Set up branch protection rules:
  - Require PR reviews (1 reviewer minimum)
  - Require status checks to pass
  - Require up-to-date branches
- 0.3.2.4 Configure Dependabot for automated dependency updates
- 0.3.2.5 Set up repository secrets for CI/CD

---

## 0.4 Monitoring & Observability Infrastructure

### 0.4.1 Prometheus Configuration

- 0.4.1.1 Create `docker/prometheus/prometheus.yml`:
  - Global scrape interval (15s)
  - Scrape configurations for:
    - API gateway metrics (`/metrics`)
    - Worker metrics (`/metrics`)
    - Node Exporter (system metrics)
    - PostgreSQL Exporter
    - Redis Exporter
  - Alert rules file reference
- 0.4.1.2 Create `docker/prometheus/alerts.yml`:
  - High CPU usage alert (>80% for 5 minutes)
  - High memory usage alert (>85%)
  - API latency alert (p95 > 2s)
  - Error rate alert (>5% of requests)
  - Database connection pool exhaustion alert
  - Redis memory usage alert
  - Worker queue depth alert

### 0.4.2 Grafana Configuration

- 0.4.2.1 Create `docker/grafana/provisioning/datasources/datasources.yml`:
  - Prometheus data source
  - Loki data source
  - PostgreSQL data source (for direct queries)
- 0.4.2.2 Create dashboard JSON files:
  - `docker/grafana/provisioning/dashboards/system-overview.json`:
    - CPU, memory, disk usage panels
    - Network I/O panels
    - Container health status
  - `docker/grafana/provisioning/dashboards/api-performance.json`:
    - Request rate (RPS)
    - Response time percentiles (p50, p95, p99)
    - Error rate by endpoint
    - Active connections
  - `docker/grafana/provisioning/dashboards/calculation-engine.json`:
    - Projection calculation times
    - Monte Carlo simulation progress
    - Worker queue depth
    - Job success/failure rates
  - `docker/grafana/provisioning/dashboards/database.json`:
    - Query performance
    - Connection pool usage
    - Table sizes
    - Slow query log
  - `docker/grafana/provisioning/dashboards/business-metrics.json`:
    - Active users
    - Projections created per day
    - Scenarios compared
    - PDF reports generated
- 0.4.2.3 Configure Grafana alerting channels (email, Slack)

### 0.4.3 Logging Configuration

- 0.4.3.1 Create `docker/loki/loki-config.yaml`:
  - Storage configuration
  - Retention period (30 days)
  - Ingestion limits
- 0.4.3.2 Create `docker/promtail/promtail-config.yaml`:
  - Docker log collection
  - Label extraction (container name, log level)
  - Pipeline stages for log parsing

---

# PHASE 1: Core MVP Development

## 1.1 Shared Package (`packages/shared`)

### 1.1.1 TypeScript Types & Interfaces

- 1.1.1.1 Create `types/user.ts`:
  - `IUserProfile` interface (id, email, name, createdAt, etc.)
  - `IUserSettings` interface (preferences, notifications)
  - `Province` enum (all 13 Canadian provinces/territories)
  - `MaritalStatus` enum (single, married, commonLaw, divorced, widowed)
- 1.1.1.2 Create `types/accounts.ts`:
  - `AccountType` enum (RRSP, TFSA, RRIF, NonRegistered, FHSA, LIRA, LIF)
  - `IAccount` interface (id, type, balance, contributions, etc.)
  - `IRRSPAccount` interface extending IAccount
  - `ITFSAAccount` interface extending IAccount
  - `INonRegisteredAccount` interface (with cost basis tracking)
  - `IAccountSummary` interface for dashboard display
- 1.1.1.3 Create `types/income.ts`:
  - `IncomeType` enum (employment, selfEmployment, pension, rental, etc.)
  - `IIncomeSource` interface (type, amount, startAge, endAge, etc.)
  - `IEmploymentIncome` interface (salary, bonus, benefits)
  - `IPensionIncome` interface (type, indexation, survivor benefit)
  - `IGovernmentBenefitIncome` interface (CPP, OAS, GIS)
- 1.1.1.4 Create `types/tax.ts`:
  - `ITaxBracket` interface (min, max, rate)
  - `IFederalTaxTable` interface
  - `IProvincialTaxTable` interface
  - `ITaxCredits` interface (basicPersonalAmount, ageCredit, etc.)
  - `ITaxCalculationResult` interface
  - `IMarginalTaxRate` interface
- 1.1.1.5 Create `types/projection.ts`:
  - `IProjectionInput` interface (all user inputs)
  - `IProjectionOutput` interface (yearly results)
  - `IYearlyResult` interface (income, taxes, withdrawals, balances)
  - `IProjectionSummary` interface (key metrics)
  - `IScenario` interface for scenario comparison
- 1.1.1.6 Create `types/api.ts`:
  - `IApiResponse<T>` generic interface
  - `IApiError` interface (code, message, details)
  - `IPaginatedResponse<T>` interface
  - HTTP status code constants

### 1.1.2 Validation Schemas (Zod)

- 1.1.2.1 Create `validation/user.schema.ts`:
  - User registration schema
  - User profile update schema
  - Password change schema
- 1.1.2.2 Create `validation/account.schema.ts`:
  - Account creation schema (per account type)
  - Account balance update schema
  - Contribution schema with limits validation
- 1.1.2.3 Create `validation/income.schema.ts`:
  - Employment income schema
  - Pension income schema
  - Government benefit schema
- 1.1.2.4 Create `validation/projection.schema.ts`:
  - Complete projection input schema
  - Scenario modification schema
  - Validation for age ranges, amounts, dates

### 1.1.3 Shared Utilities

- 1.1.3.1 Create `utils/date.ts`:
  - `calculateAge(birthDate: Date): number`
  - `getRetirementYear(birthDate: Date, retirementAge: number): number`
  - `isEligibleForOAS(age: number): boolean`
  - `isEligibleForCPP(age: number): boolean`
- 1.1.3.2 Create `utils/money.ts`:
  - `formatCurrency(amount: number, locale?: string): string`
  - `roundToTwoDecimals(amount: number): number`
  - `percentageOf(amount: number, percentage: number): number`
  - `inflationAdjust(amount: number, rate: number, years: number): number`
- 1.1.3.3 Create `utils/validation.ts`:
  - `isValidSIN(sin: string): boolean` (Canadian SIN validation)
  - `isValidPostalCode(postalCode: string): boolean`
  - `isValidProvince(province: string): boolean`
- 1.1.3.4 Create `utils/errors.ts`:
  - Custom error classes (ValidationError, AuthenticationError, etc.)
  - Error code constants
  - Error message formatting utilities

### 1.1.4 Constants

- 1.1.4.1 Create `constants/limits.ts`:
  - RRSP contribution limits by year
  - TFSA contribution limits by year
  - FHSA contribution limits
  - CPP/QPP maximum pensionable earnings
- 1.1.4.2 Create `constants/rates.ts`:
  - RRIF minimum withdrawal rates by age
  - CPP enhancement rates
  - OAS recovery thresholds
- 1.1.4.3 Create `constants/defaults.ts`:
  - Default inflation rate (2.5%)
  - Default investment returns by risk profile
  - Default life expectancy by gender

---

## 1.2 Calculation Engine (`packages/calculation-engine`)

### 1.2.1 Tax Calculation Module

- 1.2.1.1 Create `tax/federal-tax.ts`:
  - `calculateFederalTax(taxableIncome: number, year: number): number`
  - `getFederalTaxBrackets(year: number): ITaxBracket[]`
  - `calculateFederalBasicPersonalAmount(income: number, year: number): number`
  - `calculateFederalNonRefundableCredits(profile: IUserProfile): number`
- 1.2.1.2 Create `tax/provincial-tax.ts`:
  - `calculateProvincialTax(taxableIncome: number, province: Province, year: number): number`
  - `getProvincialTaxBrackets(province: Province, year: number): ITaxBracket[]`
  - `calculateProvincialBasicPersonalAmount(province: Province, year: number): number`
  - `calculateProvincialSurtax(tax: number, province: Province): number` (ON, QC)
  - Province-specific functions for each of 13 provinces
- 1.2.1.3 Create `tax/tax-credits.ts`:
  - `calculateAgeCredit(age: number, income: number, year: number): number`
  - `calculatePensionIncomeCredit(pensionIncome: number, year: number): number`
  - `calculateDividendTaxCredit(eligibleDividends: number, nonEligibleDividends: number): number`
  - `calculateMedicalExpenseCredit(expenses: number, income: number): number`
  - `calculateCharitableDonationCredit(donations: number, income: number): number`
- 1.2.1.4 Create `tax/oas-clawback.ts`:
  - `calculateOASClawback(netIncome: number, oasAmount: number, year: number): number`
  - `getOASRecoveryThreshold(year: number): number`
  - `getOASFullRecoveryThreshold(year: number): number`
  - `calculateNetOAS(grossOAS: number, netIncome: number, year: number): number`
- 1.2.1.5 Create `tax/marginal-rates.ts`:
  - `calculateMarginalTaxRate(income: number, province: Province, year: number): number`
  - `calculateEffectiveTaxRate(income: number, taxPaid: number): number`
  - `getOptimalWithdrawalAmount(currentIncome: number, targetMarginalRate: number): number`
- 1.2.1.6 Create `tax/index.ts`:
  - `calculateTotalTax(input: ITaxCalculationInput): ITaxCalculationResult`
  - Export all tax-related functions

### 1.2.2 Government Benefits Module

- 1.2.2.1 Create `benefits/cpp.ts`:
  - `calculateCPPBenefit(contributionHistory: ICPPContribution[], startAge: number): number`
  - `applyCPPEarlyReduction(amount: number, monthsEarly: number): number`
  - `applyCPPLateIncrease(amount: number, monthsLate: number): number`
  - `calculateCPPSurvivorBenefit(deceasedBenefit: number, survivorAge: number): number`
  - `calculateQPPBenefit(...)` - Quebec Pension Plan variant
  - `estimateCPPFromYMPE(yearsContributed: number, avgYMPE: number): number`
- 1.2.2.2 Create `benefits/oas.ts`:
  - `calculateOASBenefit(yearsInCanada: number, startAge: number, year: number): number`
  - `applyOASDeferralIncrease(amount: number, monthsDeferred: number): number`
  - `isEligibleForOAS(yearsInCanada: number, age: number): boolean`
  - `calculateOASResidencyFactor(yearsInCanada: number): number`
- 1.2.2.3 Create `benefits/gis.ts`:
  - `calculateGIS(income: number, maritalStatus: MaritalStatus, year: number): number`
  - `isEligibleForGIS(income: number, maritalStatus: MaritalStatus): boolean`
  - `getGISMaximum(maritalStatus: MaritalStatus, year: number): number`
- 1.2.2.4 Create `benefits/indexation.ts`:
  - `applyInflationIndexation(amount: number, inflationRate: number): number`
  - `projectBenefitToYear(currentAmount: number, currentYear: number, targetYear: number): number`
- 1.2.2.5 Create `benefits/index.ts`:
  - `calculateAllBenefits(profile: IUserProfile, year: number): IBenefitsSummary`
  - Export all benefit-related functions

### 1.2.3 Account Rules Module

- 1.2.3.1 Create `accounts/rrsp.ts`:
  - `calculateRRSPContributionRoom(earnedIncome: number, previousRoom: number, year: number): number`
  - `calculateRRSPDeductionLimit(contributionRoom: number, year: number): number`
  - `mustConvertToRRIF(age: number): boolean`
  - `calculateRRSPWithdrawalTax(amount: number, province: Province): number`
- 1.2.3.2 Create `accounts/rrif.ts`:
  - `calculateRRIFMinimumWithdrawal(balance: number, age: number): number`
  - `getRRIFMinimumRate(age: number): number`
  - `convertRRSPtoRRIF(rrspBalance: number, conversionDate: Date): IRRIFAccount`
  - `calculateRRIFWithdrawalTax(amount: number, province: Province): number`
- 1.2.3.3 Create `accounts/tfsa.ts`:
  - `calculateTFSAContributionRoom(previousRoom: number, withdrawals: number, year: number): number`
  - `getTFSAAnnualLimit(year: number): number`
  - `isValidTFSAContribution(amount: number, availableRoom: number): boolean`
- 1.2.3.4 Create `accounts/non-registered.ts`:
  - `calculateCapitalGainsTax(proceeds: number, costBasis: number, province: Province): number`
  - `calculateDividendIncome(amount: number, isEligible: boolean): number`
  - `calculateInterestIncome(amount: number): number`
  - `calculateACB(purchases: IPurchase[]): number` (Adjusted Cost Base)
- 1.2.3.5 Create `accounts/lira-lif.ts`:
  - `calculateLIFMinimumWithdrawal(balance: number, age: number): number`
  - `calculateLIFMaximumWithdrawal(balance: number, age: number, province: Province): number`
  - `isLIRAUnlockingEligible(age: number, province: Province): boolean`
- 1.2.3.6 Create `accounts/fhsa.ts`:
  - `calculateFHSAContributionRoom(previousRoom: number, year: number): number`
  - `isEligibleForFHSA(hasOwnedHome: boolean, age: number): boolean`
  - `getFHSALifetimeLimit(): number`

### 1.2.4 Investment Growth Module

- 1.2.4.1 Create `investments/growth.ts`:
  - `calculateGrowth(principal: number, rate: number, years: number): number`
  - `calculateCompoundGrowth(principal: number, rate: number, periods: number): number`
  - `projectAccountBalance(account: IAccount, years: number, returnRate: number): number[]`
- 1.2.4.2 Create `investments/returns.ts`:
  - `getDefaultReturnRate(riskProfile: RiskProfile): number`
  - `getDefaultVolatility(riskProfile: RiskProfile): number`
  - `adjustReturnForInflation(nominalReturn: number, inflationRate: number): number`
- 1.2.4.3 Create `investments/asset-allocation.ts`:
  - `getRecommendedAllocation(age: number, riskProfile: RiskProfile): IAssetAllocation`
  - `calculatePortfolioReturn(allocation: IAssetAllocation, returns: IAssetReturns): number`
  - `rebalancePortfolio(current: IAssetAllocation, target: IAssetAllocation): IRebalanceActions`

### 1.2.5 Withdrawal Strategy Module

- 1.2.5.1 Create `withdrawals/order.ts`:
  - `determineWithdrawalOrder(accounts: IAccount[], taxableIncome: number): AccountType[]`
  - `optimizeWithdrawalOrder(accounts: IAccount[], projection: IProjectionInput): IWithdrawalPlan`
  - Default order: Non-registered → TFSA → RRIF/RRSP
- 1.2.5.2 Create `withdrawals/amounts.ts`:
  - `calculateRequiredWithdrawal(expenses: number, income: number): number`
  - `calculateOptimalWithdrawal(accounts: IAccount[], targetIncome: number, marginalRate: number): IWithdrawalAmounts`
  - `splitWithdrawalBetweenAccounts(total: number, accounts: IAccount[]): IWithdrawalSplit`
- 1.2.5.3 Create `withdrawals/tax-efficiency.ts`:
  - `calculateAfterTaxWithdrawal(amount: number, accountType: AccountType, province: Province): number`
  - `findTaxEfficientWithdrawal(targetAfterTax: number, accounts: IAccount[]): IWithdrawalPlan`
  - `minimizeLifetimeTax(projection: IProjectionInput): IWithdrawalStrategy`

### 1.2.6 Projection Engine Module

- 1.2.6.1 Create `projection/yearly-calculator.ts`:
  - `calculateYear(input: IYearInput): IYearlyResult`
    - Step 1: Calculate age and eligibility
    - Step 2: Calculate income (employment, pension, benefits)
    - Step 3: Calculate required minimum withdrawals (RRIF)
    - Step 4: Calculate additional withdrawals needed
    - Step 5: Apply investment growth
    - Step 6: Calculate taxes
    - Step 7: Update account balances
- 1.2.6.2 Create `projection/multi-year.ts`:
  - `runProjection(input: IProjectionInput): IProjectionOutput`
  - `projectFromRetirementToEnd(input: IProjectionInput): IYearlyResult[]`
  - Loop from start year to end year (life expectancy)
  - Accumulate yearly results
- 1.2.6.3 Create `projection/events.ts`:
  - `processLifeEvents(year: number, profile: IUserProfile): ILifeEvent[]`
  - Handle events: retirement, RRSP→RRIF conversion, CPP start, OAS start
  - Trigger account conversions and benefit starts
- 1.2.6.4 Create `projection/inflation.ts`:
  - `applyInflation(amounts: number[], inflationRate: number): number[]`
  - `inflationAdjustExpenses(expenses: number, year: number, baseYear: number, rate: number): number`
- 1.2.6.5 Create `projection/summary.ts`:
  - `calculateProjectionSummary(results: IYearlyResult[]): IProjectionSummary`
  - Calculate: total taxes paid, peak net worth, portfolio longevity
  - Identify critical years (money runs out, major transitions)

### 1.2.7 Calculation Engine Tests

- 1.2.7.1 Create tax calculation tests:
  - Federal tax calculation for various income levels
  - Provincial tax for all 13 provinces
  - Tax credit calculations
  - OAS clawback scenarios
- 1.2.7.2 Create benefit calculation tests:
  - CPP at ages 60, 65, 70
  - OAS with residency variations
  - GIS eligibility and amounts
- 1.2.7.3 Create account rule tests:
  - RRSP contribution room calculations
  - RRIF minimum withdrawal rates
  - TFSA room calculations
- 1.2.7.4 Create projection engine tests:
  - Single year calculation verification
  - Multi-year projection accuracy
  - Edge cases (early death, no retirement savings)
- 1.2.7.5 Create validation tests against known scenarios from SOT documentation

---

## 1.3 API Gateway (`packages/api`)

### 1.3.1 Express Application Setup

- 1.3.1.1 Create `src/app.ts`:
  - Initialize Express application
  - Configure middleware order
  - Register routes
  - Configure error handling
- 1.3.1.2 Create `src/server.ts`:
  - HTTP server creation
  - Graceful shutdown handling
  - Port configuration from environment
- 1.3.1.3 Create `src/config/index.ts`:
  - Environment variable parsing
  - Configuration validation with Zod
  - Export typed configuration object

### 1.3.2 Middleware Setup

- 1.3.2.1 Create `src/middleware/helmet.ts`:
  - Configure Helmet security headers
  - Content Security Policy
  - HSTS configuration
- 1.3.2.2 Create `src/middleware/cors.ts`:
  - CORS configuration based on environment
  - Allowed origins whitelist
  - Credentials handling
- 1.3.2.3 Create `src/middleware/rate-limiter.ts`:
  - Express-rate-limit configuration
  - Redis store for distributed rate limiting
  - Different limits per endpoint type
- 1.3.2.4 Create `src/middleware/request-logger.ts`:
  - Winston logging integration
  - Request/response timing
  - Correlation ID injection
- 1.3.2.5 Create `src/middleware/error-handler.ts`:
  - Global error handler
  - Error response formatting
  - Sentry error reporting integration
- 1.3.2.6 Create `src/middleware/validation.ts`:
  - Zod schema validation middleware factory
  - Request body validation
  - Query parameter validation
  - Path parameter validation

### 1.3.3 Authentication System

- 1.3.3.1 Create `src/auth/jwt.ts`:
  - JWT token generation (access + refresh tokens)
  - Token verification
  - Token refresh logic
  - Token revocation (blacklist in Redis)
- 1.3.3.2 Create `src/auth/password.ts`:
  - Password hashing with bcrypt (12 rounds)
  - Password verification
  - Password strength validation
- 1.3.3.3 Create `src/auth/middleware.ts`:
  - `requireAuth` middleware - verify JWT
  - `optionalAuth` middleware - authenticate if token present
  - Extract user from token and attach to request
- 1.3.3.4 Create `src/routes/auth.routes.ts`:
  - `POST /auth/register` - User registration
  - `POST /auth/login` - User login
  - `POST /auth/refresh` - Token refresh
  - `POST /auth/logout` - Token revocation
  - `POST /auth/forgot-password` - Password reset request
  - `POST /auth/reset-password` - Password reset completion

### 1.3.4 User Management API

- 1.3.4.1 Create `src/routes/users.routes.ts`:
  - `GET /users/me` - Get current user profile
  - `PUT /users/me` - Update user profile
  - `PUT /users/me/password` - Change password
  - `DELETE /users/me` - Delete account (GDPR compliance)
  - `GET /users/me/data-export` - Export all user data
- 1.3.4.2 Create `src/services/user.service.ts`:
  - User CRUD operations
  - Profile validation
  - Data export generation

### 1.3.5 Projection API

- 1.3.5.1 Create `src/routes/projections.routes.ts`:
  - `POST /projections` - Create new projection
  - `GET /projections` - List user's projections (paginated)
  - `GET /projections/:id` - Get projection details
  - `PUT /projections/:id` - Update projection inputs
  - `DELETE /projections/:id` - Delete projection
  - `POST /projections/:id/recalculate` - Force recalculation
- 1.3.5.2 Create `src/services/projection.service.ts`:
  - Projection CRUD operations
  - Calculation triggering
  - Result caching
- 1.3.5.3 Create `src/routes/scenarios.routes.ts`:
  - `POST /projections/:id/scenarios` - Create scenario
  - `GET /projections/:id/scenarios` - List scenarios
  - `GET /projections/:id/scenarios/:scenarioId` - Get scenario
  - `PUT /projections/:id/scenarios/:scenarioId` - Update scenario
  - `DELETE /projections/:id/scenarios/:scenarioId` - Delete scenario
  - `POST /projections/:id/compare` - Compare scenarios

### 1.3.6 Reference Data API

- 1.3.6.1 Create `src/routes/reference.routes.ts`:
  - `GET /tax-tables/:year` - Get all tax tables for year
  - `GET /tax-tables/:year/:province` - Get provincial tax table
  - `GET /benefit-rates/:year` - Get CPP/OAS rates for year
  - `GET /account-limits/:year` - Get contribution limits
  - `GET /rrif-rates` - Get RRIF minimum withdrawal rates
- 1.3.6.2 Create `src/services/reference.service.ts`:
  - Reference data retrieval
  - Caching with Redis (24-hour TTL)
  - Yearly data updates

### 1.3.7 Health & Metrics

- 1.3.7.1 Create `src/routes/health.routes.ts`:
  - `GET /health` - Basic health check
  - `GET /health/ready` - Readiness check (DB, Redis)
  - `GET /health/live` - Liveness check
- 1.3.7.2 Create `src/metrics/prometheus.ts`:
  - Request duration histogram
  - Request count counter
  - Active connections gauge
  - Custom business metrics

### 1.3.8 Database Layer

- 1.3.8.1 Create `src/db/connection.ts`:
  - PostgreSQL connection pool setup
  - Connection health checking
  - Query timeout configuration
- 1.3.8.2 Create `src/db/migrations/`:
  - `001_create_users_table.ts`
  - `002_create_projections_table.ts`
  - `003_create_scenarios_table.ts`
  - `004_create_config_data_table.ts`
  - `005_create_monte_carlo_jobs_table.ts`
- 1.3.8.3 Create `src/db/repositories/`:
  - `user.repository.ts`
  - `projection.repository.ts`
  - `scenario.repository.ts`
  - `config-data.repository.ts`

### 1.3.9 API Tests

- 1.3.9.1 Create unit tests for services
- 1.3.9.2 Create integration tests for endpoints
- 1.3.9.3 Create authentication tests
- 1.3.9.4 Create rate limiting tests

---

## 1.4 Web Application (`packages/web`)

### 1.4.1 Next.js Project Setup

- 1.4.1.1 Initialize Next.js 14 with App Router
- 1.4.1.2 Configure `next.config.js`:
  - API rewrites to backend
  - Image optimization settings
  - Environment variable exposure
- 1.4.1.3 Set up Tailwind CSS:
  - Install and configure
  - Create custom theme in `tailwind.config.js`
  - Define color palette (financial/professional theme)
  - Configure dark mode support
- 1.4.1.4 Install and configure shadcn/ui:
  - Run initialization
  - Configure components directory
  - Set up CSS variables

### 1.4.2 Authentication UI

- 1.4.2.1 Create `app/(auth)/layout.tsx`:
  - Centered card layout for auth pages
  - Logo placement
  - Background styling
- 1.4.2.2 Create `app/(auth)/login/page.tsx`:
  - Email/password form
  - Form validation with react-hook-form + zod
  - Error message display
  - "Forgot password" link
  - "Register" link
- 1.4.2.3 Create `app/(auth)/register/page.tsx`:
  - Registration form (email, password, name)
  - Password strength indicator
  - Terms of service checkbox
  - Email verification notice
- 1.4.2.4 Create `app/(auth)/forgot-password/page.tsx`:
  - Email input form
  - Success message display
- 1.4.2.5 Create `app/(auth)/reset-password/page.tsx`:
  - New password form
  - Password confirmation
  - Token validation
- 1.4.2.6 Create `lib/auth.ts`:
  - NextAuth.js configuration
  - JWT session strategy
  - Credentials provider
- 1.4.2.7 Create `hooks/useAuth.ts`:
  - Authentication state hook
  - Login/logout functions
  - Token refresh handling

### 1.4.3 Core Layout Components

- 1.4.3.1 Create `app/(dashboard)/layout.tsx`:
  - Sidebar navigation
  - Top header with user menu
  - Main content area
  - Responsive design (mobile hamburger menu)
- 1.4.3.2 Create `components/layout/Sidebar.tsx`:
  - Navigation links:
    - Dashboard
    - Projections
    - Scenarios
    - Reports
    - Settings
  - Collapsible sections
  - Active state styling
- 1.4.3.3 Create `components/layout/Header.tsx`:
  - Logo
  - Search bar (optional)
  - Notifications dropdown
  - User avatar menu
  - Logout option
- 1.4.3.4 Create `components/layout/Footer.tsx`:
  - Copyright notice
  - Links to privacy policy, terms of service
  - Version number

### 1.4.4 Dashboard Page

- 1.4.4.1 Create `app/(dashboard)/dashboard/page.tsx`:
  - Welcome message with user name
  - Quick stats cards:
    - Total net worth
    - Projected retirement income
    - Years to retirement
    - Number of projections
  - Recent projections list
  - Quick actions (new projection, compare scenarios)
- 1.4.4.2 Create `components/dashboard/StatCard.tsx`:
  - Icon
  - Label
  - Value (formatted)
  - Trend indicator (up/down arrow)
- 1.4.4.3 Create `components/dashboard/RecentProjections.tsx`:
  - Table of recent projections
  - Name, last updated, quick status
  - Click to view details

### 1.4.5 User Profile Input Form

- 1.4.5.1 Create `app/(dashboard)/projections/new/page.tsx`:
  - Multi-step wizard layout
  - Progress indicator
  - Step navigation (back/next)
- 1.4.5.2 Create `components/projection/steps/PersonalInfoStep.tsx`:
  - Date of birth picker
  - Gender selection
  - Province dropdown (13 options)
  - Marital status
  - Retirement age input
  - Life expectancy input
- 1.4.5.3 Create `components/projection/steps/AccountsStep.tsx`:
  - Account list with add/remove
  - Per account:
    - Account type selector
    - Current balance input
    - Annual contribution input
    - Investment risk profile
  - Total balance summary
- 1.4.5.4 Create `components/projection/steps/IncomeStep.tsx`:
  - Employment income section:
    - Current salary
    - Expected raises
    - Retirement date
  - Pension income section:
    - Employer pension (if any)
    - Start age
    - Monthly amount
  - Government benefits section:
    - CPP start age
    - OAS start age
    - Years contributed to CPP
- 1.4.5.5 Create `components/projection/steps/ExpensesStep.tsx`:
  - Current annual expenses
  - Expected retirement expenses
  - One-time expenses (travel, home purchase)
  - Inflation assumption
- 1.4.5.6 Create `components/projection/steps/AssumptionsStep.tsx`:
  - Investment return rate
  - Inflation rate
  - Life expectancy
  - Tax rate assumptions
- 1.4.5.7 Create `components/projection/steps/ReviewStep.tsx`:
  - Summary of all inputs
  - Edit links for each section
  - "Create Projection" button

### 1.4.6 Projection Results Display

- 1.4.6.1 Create `app/(dashboard)/projections/[id]/page.tsx`:
  - Projection name and edit option
  - Tab navigation:
    - Summary
    - Charts
    - Year-by-Year
    - Scenarios
- 1.4.6.2 Create `components/projection/results/SummaryTab.tsx`:
  - Key metrics cards:
    - Peak net worth
    - Portfolio longevity
    - Total taxes paid
    - Average retirement income
  - Success/warning indicators
- 1.4.6.3 Create `components/projection/results/ChartsTab.tsx`:
  - Net worth over time chart (area chart)
  - Income breakdown chart (stacked bar)
  - Withdrawal sources chart (pie chart)
  - Tax paid by year chart (line chart)
- 1.4.6.4 Create `components/projection/results/YearByYearTab.tsx`:
  - Scrollable table with columns:
    - Year
    - Age
    - Employment income
    - Pension income
    - Government benefits
    - Withdrawals
    - Total income
    - Taxes
    - Net income
    - RRSP/RRIF balance
    - TFSA balance
    - Non-reg balance
    - Total net worth
  - Export to CSV button
- 1.4.6.5 Create `components/projection/results/ScenariosTab.tsx`:
  - Scenario list
  - Create new scenario button
  - Comparison view toggle

### 1.4.7 Chart Components (Recharts)

- 1.4.7.1 Create `components/charts/NetWorthChart.tsx`:
  - Area chart with gradient fill
  - Tooltip with formatted values
  - Legend
  - Responsive sizing
- 1.4.7.2 Create `components/charts/IncomeBreakdownChart.tsx`:
  - Stacked bar chart
  - Color-coded income sources
  - Interactive hover
- 1.4.7.3 Create `components/charts/WithdrawalSourcesChart.tsx`:
  - Pie/donut chart
  - Percentage labels
  - Legend with values
- 1.4.7.4 Create `components/charts/TaxChart.tsx`:
  - Line chart for federal vs provincial tax
  - Dual axis if needed
- 1.4.7.5 Create `components/charts/ChartContainer.tsx`:
  - Wrapper with loading state
  - Error state
  - Responsive container

### 1.4.8 Settings Pages

- 1.4.8.1 Create `app/(dashboard)/settings/page.tsx`:
  - Navigation tabs:
    - Profile
    - Security
    - Preferences
    - Data
- 1.4.8.2 Create `components/settings/ProfileSettings.tsx`:
  - Name edit
  - Email display (read-only or with verification)
  - Profile picture upload
- 1.4.8.3 Create `components/settings/SecuritySettings.tsx`:
  - Change password form
  - Two-factor authentication toggle (future)
  - Active sessions list
  - Logout all devices
- 1.4.8.4 Create `components/settings/PreferencesSettings.tsx`:
  - Dark/light mode toggle
  - Currency format (CAD)
  - Date format preference
  - Email notification settings
- 1.4.8.5 Create `components/settings/DataSettings.tsx`:
  - Export all data button (GDPR)
  - Delete account button with confirmation
  - Data retention information

### 1.4.9 Shared UI Components

- 1.4.9.1 Set up shadcn/ui components:
  - Button (primary, secondary, destructive, outline, ghost)
  - Input (text, number, password)
  - Select (single, multi)
  - Checkbox, Radio, Switch
  - Dialog/Modal
  - Dropdown Menu
  - Toast/Notifications
  - Card
  - Table
  - Tabs
  - Accordion
  - Progress
  - Skeleton (loading)
  - Alert
  - Badge
- 1.4.9.2 Create `components/ui/CurrencyInput.tsx`:
  - Currency formatting on blur
  - Numeric validation
  - Min/max constraints
- 1.4.9.3 Create `components/ui/PercentageInput.tsx`:
  - Percentage formatting
  - Decimal precision control
- 1.4.9.4 Create `components/ui/DatePicker.tsx`:
  - Calendar popup
  - Year/month navigation
  - Min/max date constraints
- 1.4.9.5 Create `components/ui/ProvinceSelector.tsx`:
  - Dropdown with all 13 provinces
  - Search/filter capability

### 1.4.10 State Management

- 1.4.10.1 Create `contexts/AuthContext.tsx`:
  - Authentication state
  - User object
  - Login/logout methods
- 1.4.10.2 Create `contexts/ProjectionContext.tsx`:
  - Current projection state
  - Form wizard state
  - Calculation status
- 1.4.10.3 Create `hooks/useProjection.ts`:
  - Projection CRUD operations
  - Optimistic updates
  - Error handling
- 1.4.10.4 Create `hooks/useScenarios.ts`:
  - Scenario management
  - Comparison logic

### 1.4.11 API Integration

- 1.4.11.1 Create `lib/api/client.ts`:
  - Axios instance configuration
  - Base URL from environment
  - Token injection interceptor
  - Response error handling interceptor
  - Token refresh on 401
- 1.4.11.2 Create `lib/api/auth.api.ts`:
  - `login(email, password)`: Promise<AuthResponse>
  - `register(data)`: Promise<AuthResponse>
  - `refreshToken()`: Promise<TokenResponse>
  - `logout()`: Promise<void>
- 1.4.11.3 Create `lib/api/projections.api.ts`:
  - `createProjection(data)`: Promise<Projection>
  - `getProjections()`: Promise<Projection[]>
  - `getProjection(id)`: Promise<Projection>
  - `updateProjection(id, data)`: Promise<Projection>
  - `deleteProjection(id)`: Promise<void>
- 1.4.11.4 Create `lib/api/scenarios.api.ts`:
  - `createScenario(projectionId, data)`: Promise<Scenario>
  - `getScenarios(projectionId)`: Promise<Scenario[]>
  - `compareScenarios(projectionId, scenarioIds)`: Promise<Comparison>

### 1.4.12 Frontend Tests

- 1.4.12.1 Set up Jest and React Testing Library
- 1.4.12.2 Create component tests for:
  - Form inputs
  - Chart rendering
  - Navigation
- 1.4.12.3 Create integration tests for:
  - Login flow
  - Projection creation wizard
  - Results display
- 1.4.12.4 Set up Playwright for E2E tests:
  - User registration flow
  - Complete projection creation
  - Scenario comparison

---

## 1.5 Calculation Worker (`packages/worker`)

### 1.5.1 Worker Setup

- 1.5.1.1 Create `src/worker.ts`:
  - BullMQ worker initialization
  - Concurrency configuration
  - Job processing registration
- 1.5.1.2 Create `src/queues.ts`:
  - Queue definitions:
    - `projection-calculation` queue
    - `scenario-comparison` queue
    - `pdf-generation` queue (Phase 2)
    - `monte-carlo` queue (Phase 3)
  - Queue event handlers (completed, failed)
- 1.5.1.3 Create `src/processors/projection.processor.ts`:
  - Receive projection calculation job
  - Load input data
  - Execute calculation engine
  - Store results in database
  - Update job status

### 1.5.2 Job Handlers

- 1.5.2.1 Create `src/jobs/calculate-projection.job.ts`:
  - Validate input data
  - Call projection engine
  - Handle calculation errors
  - Return structured result
- 1.5.2.2 Create `src/jobs/compare-scenarios.job.ts`:
  - Load base projection
  - Calculate each scenario
  - Generate comparison data
  - Return comparison result

### 1.5.3 Worker Monitoring

- 1.5.3.1 Create `src/health.ts`:
  - Worker health endpoint
  - Queue connection status
  - Active job count
- 1.5.3.2 Create `src/metrics.ts`:
  - Job processing time histogram
  - Job success/failure counter
  - Queue depth gauge

---

## 1.6 Integration & Testing

### 1.6.1 End-to-End Integration

- 1.6.1.1 Create integration test suite:
  - User registration to first projection
  - Projection creation with all account types
  - Multiple scenario comparison
  - Data persistence verification
- 1.6.1.2 Create performance benchmarks:
  - Single projection calculation time
  - Concurrent user handling
  - Database query performance
- 1.6.1.3 Create accuracy validation tests:
  - Compare calculations against manual spreadsheet
  - Verify tax calculations against CRA examples
  - Validate CPP/OAS amounts against Service Canada

### 1.6.2 Documentation

- 1.6.2.1 Create API documentation with Swagger/OpenAPI:
  - All endpoints documented
  - Request/response schemas
  - Authentication requirements
  - Example requests
- 1.6.2.2 Create developer documentation:
  - Local setup guide
  - Architecture overview
  - Code contribution guidelines
- 1.6.2.3 Create user documentation:
  - Getting started guide
  - Feature explanations
  - FAQ

---

# PHASE 2: Enhanced Features

## 2.1 Advanced Tax Features

### 2.1.1 Complete Provincial Tax Support

- 2.1.1.1 Add Quebec-specific calculations:
  - QPP instead of CPP
  - Quebec tax credits
  - Quebec Pension Plan survivor benefits
  - Quebec Solidarity Tax Credit
- 2.1.1.2 Add all remaining provinces:
  - Manitoba (MB)
  - New Brunswick (NB)
  - Newfoundland & Labrador (NL)
  - Nova Scotia (NS)
  - Northwest Territories (NT)
  - Nunavut (NU)
  - Prince Edward Island (PE)
  - Saskatchewan (SK)
  - Yukon (YT)
- 2.1.1.3 Add provincial surtaxes:
  - Ontario surtax calculation
  - Quebec surtax calculation
- 2.1.1.4 Add health premiums:
  - Ontario Health Premium
  - Quebec Health Services Fund

### 2.1.2 Advanced Tax Credits

- 2.1.2.1 Implement spousal tax credits
- 2.1.2.2 Implement disability tax credit
- 2.1.2.3 Implement home buyers' tax credit
- 2.1.2.4 Implement first-time home buyers' credit

### 2.1.3 OAS Clawback Optimization

- 2.1.3.1 Implement clawback projection
- 2.1.3.2 Add strategies to minimize clawback
- 2.1.3.3 Add visualization of clawback impact

---

## 2.2 Couple/Spouse Modeling

### 2.2.1 Joint Profile Support

- 2.2.1.1 Create spouse data model:
  - Second person profile
  - Linked accounts
  - Combined household view
- 2.2.1.2 Implement income splitting strategies:
  - Pension income splitting
  - Spousal RRSP contributions
  - TFSA attribution rules
- 2.2.1.3 Add survivor benefit calculations:
  - CPP survivor pension
  - OAS survivor considerations
  - RRSP/RRIF rollover to spouse

### 2.2.2 UI Updates for Couples

- 2.2.2.1 Add spouse input forms
- 2.2.2.2 Create dual-person charts
- 2.2.2.3 Add combined vs individual view toggle
- 2.2.2.4 Update year-by-year table for two people

---

## 2.3 Scenario Comparison

### 2.3.1 Enhanced Scenario Engine

- 2.3.1.1 Implement scenario modification types:
  - Different retirement ages
  - Different CPP/OAS start ages
  - Different savings rates
  - Different investment returns
- 2.3.1.2 Create delta calculation:
  - Year-by-year difference
  - Cumulative impact
  - Key metric comparison

### 2.3.2 Scenario Comparison UI

- 2.3.2.1 Create side-by-side comparison view
- 2.3.2.2 Create overlay chart view
- 2.3.2.3 Add scenario naming and descriptions
- 2.3.2.4 Create scenario cloning functionality
- 2.3.2.5 Add "what-if" sensitivity sliders

---

## 2.4 PDF Report Generation

### 2.4.1 PDF Engine Setup

- 2.4.1.1 Set up Puppeteer for PDF generation
- 2.4.1.2 Create PDF template system
- 2.4.1.3 Configure PDF styling (fonts, colors, margins)

### 2.4.2 Report Content

- 2.4.2.1 Create executive summary section:
  - Key findings
  - Retirement readiness score
  - Critical action items
- 2.4.2.2 Create detailed projections section:
  - Year-by-year tables
  - Charts and graphs
  - Assumptions documentation
- 2.4.2.3 Create appendix:
  - Tax bracket tables used
  - Calculation methodology
  - Disclaimer and legal notices

### 2.4.3 PDF API & UI

- 2.4.3.1 Create PDF generation endpoint
- 2.4.3.2 Implement async PDF generation with job queue
- 2.4.3.3 Add progress indicator in UI
- 2.4.3.4 Create PDF download and email options

---

## 2.5 Withdrawal Order Optimization

### 2.5.1 Optimization Algorithm

- 2.5.1.1 Implement greedy withdrawal optimization
- 2.5.1.2 Add tax bracket awareness
- 2.5.1.3 Implement RRIF minimum first, then optimal
- 2.5.1.4 Add OAS clawback avoidance logic

### 2.5.2 Optimization UI

- 2.5.2.1 Create withdrawal recommendation display
- 2.5.2.2 Add override capability
- 2.5.2.3 Show tax savings from optimization
- 2.5.2.4 Create withdrawal schedule calendar view

---

# PHASE 3: Advanced Optimization

## 3.1 Monte Carlo Simulation

### 3.1.1 Monte Carlo Engine

- 3.1.1.1 Implement log-normal return distribution
- 3.1.1.2 Create simulation runner (1000 iterations)
- 3.1.1.3 Implement parallel processing with worker threads
- 3.1.1.4 Add sequence of returns risk modeling
- 3.1.1.5 Create percentile calculation (5th, 25th, 50th, 75th, 95th)

### 3.1.2 Monte Carlo Job Processing

- 3.1.2.1 Create Monte Carlo job queue
- 3.1.2.2 Implement progress tracking (0-100%)
- 3.1.2.3 Add cancellation support
- 3.1.2.4 Create result caching

### 3.1.3 Monte Carlo API

- 3.1.3.1 Create `POST /monte-carlo/:projectionId` endpoint
- 3.1.3.2 Create `GET /monte-carlo/:projectionId/status` endpoint
- 3.1.3.3 Create `GET /monte-carlo/:projectionId/results` endpoint

### 3.1.4 Monte Carlo UI

- 3.1.4.1 Create probability of success gauge:
  - Large percentage display
  - Color-coded (green/yellow/red)
  - Confidence interval
- 3.1.4.2 Create fan chart:
  - Percentile bands (5th to 95th)
  - Median line highlighted
  - Interactive hover for values
- 3.1.4.3 Create histogram of outcomes:
  - Distribution of portfolio values at death
  - Success/failure zones marked
- 3.1.4.4 Create sensitivity analysis:
  - Return rate impact
  - Inflation impact
  - Longevity impact

---

## 3.2 Success Metrics

### 3.2.1 Metric Calculations

- 3.2.1.1 Calculate probability of success:
  - % of simulations where money lasts
  - Configurable success threshold
- 3.2.1.2 Calculate portfolio longevity:
  - Median age when money runs out
  - Percentile analysis
- 3.2.1.3 Calculate legacy amount:
  - Expected estate value at death
  - Distribution analysis
- 3.2.1.4 Calculate income sustainability:
  - Withdrawal rate safety
  - Income replacement ratio

### 3.2.2 Metrics Dashboard

- 3.2.2.1 Create metrics summary cards
- 3.2.2.2 Add trend indicators
- 3.2.2.3 Create benchmarking vs typical scenarios
- 3.2.2.4 Add goal tracking

---

## 3.3 Tax Optimization Recommendations

### 3.3.1 Optimization Analysis

- 3.3.1.1 Analyze marginal tax rate smoothing opportunities
- 3.3.1.2 Identify RRSP meltdown strategies
- 3.3.1.3 Calculate optimal TFSA vs RRSP allocation
- 3.3.1.4 Identify OAS optimization opportunities

### 3.3.2 Recommendation Engine

- 3.3.2.1 Generate actionable recommendations
- 3.3.2.2 Calculate dollar impact of recommendations
- 3.3.2.3 Prioritize by impact
- 3.3.2.4 Add implementation guidance

### 3.3.3 Recommendation UI

- 3.3.3.1 Create recommendation cards
- 3.3.3.2 Add "Apply to projection" action
- 3.3.3.3 Create before/after comparison
- 3.3.3.4 Add explanatory tooltips

---

## 3.4 Real Estate Integration (Future)

### 3.4.1 Property Modeling

- 3.4.1.1 Add primary residence tracking
- 3.4.1.2 Calculate principal residence exemption
- 3.4.1.3 Model property appreciation
- 3.4.1.4 Calculate selling costs

### 3.4.2 Downsizing Analysis

- 3.4.2.1 Model home sale and purchase
- 3.4.2.2 Calculate net proceeds
- 3.4.2.3 Integrate proceeds into projections

---

## 3.5 Estate Planning (Future)

### 3.5.1 Estate Value Calculation

- 3.5.1.1 Project estate value at death
- 3.5.1.2 Calculate deemed disposition taxes
- 3.5.1.3 Model RRSP/RRIF estate inclusion
- 3.5.1.4 Calculate probate fees by province

### 3.5.2 Beneficiary Planning

- 3.5.2.1 Model TFSA transfer to spouse
- 3.5.2.2 Model RRSP rollover to spouse
- 3.5.2.3 Calculate tax on beneficiary transfer

---

# PHASE 4: Production & Scale

## 4.1 Performance Optimization

### 4.1.1 Database Optimization

- 4.1.1.1 Implement database connection pooling
- 4.1.1.2 Add read replicas for queries
- 4.1.1.3 Create materialized views for reports
- 4.1.1.4 Implement query optimization
- 4.1.1.5 Add database partitioning for large tables

### 4.1.2 Caching Strategy

- 4.1.2.1 Implement multi-level caching:
  - In-memory cache (frequently accessed)
  - Redis cache (distributed)
  - CDN cache (static assets)
- 4.1.2.2 Cache tax tables with long TTL
- 4.1.2.3 Cache projection results with user-specific TTL
- 4.1.2.4 Implement cache invalidation strategy

### 4.1.3 Calculation Optimization

- 4.1.3.1 Add memoization for tax calculations
- 4.1.3.2 Implement lazy evaluation for projections
- 4.1.3.3 Pre-compute common scenarios
- 4.1.3.4 Add worker thread pool for calculations

### 4.1.4 Frontend Optimization

- 4.1.4.1 Implement code splitting
- 4.1.4.2 Add lazy loading for routes
- 4.1.4.3 Optimize bundle size
- 4.1.4.4 Implement service worker for offline support
- 4.1.4.5 Add prefetching for common navigation paths

---

## 4.2 Scalability

### 4.2.1 Kubernetes Deployment

- 4.2.1.1 Create Kubernetes manifests:
  - Deployments for web, API, worker
  - Services for internal communication
  - Ingress for external access
  - ConfigMaps and Secrets
- 4.2.1.2 Configure Horizontal Pod Autoscaler:
  - CPU-based scaling (target 70%)
  - Memory-based scaling (target 80%)
  - Custom metrics scaling
- 4.2.1.3 Set up cluster autoscaling
- 4.2.1.4 Create Helm charts for deployment

### 4.2.2 Database Scaling

- 4.2.2.1 Set up PostgreSQL streaming replication
- 4.2.2.2 Implement read/write splitting
- 4.2.2.3 Configure connection pooling (PgBouncer)
- 4.2.2.4 Set up automated backups and PITR

### 4.2.3 Redis Scaling

- 4.2.3.1 Set up Redis Sentinel for HA
- 4.2.3.2 Implement Redis Cluster for scaling
- 4.2.3.3 Configure memory management
- 4.2.3.4 Add persistence and backup

---

## 4.3 Security Hardening

### 4.3.1 Application Security

- 4.3.1.1 Implement rate limiting per user and IP
- 4.3.1.2 Add request signing for API
- 4.3.1.3 Implement CSRF protection
- 4.3.1.4 Add input sanitization
- 4.3.1.5 Implement secure headers

### 4.3.2 Data Security

- 4.3.2.1 Implement field-level encryption
- 4.3.2.2 Add data masking for logs
- 4.3.2.3 Implement audit logging
- 4.3.2.4 Create data retention policies
- 4.3.2.5 Add GDPR compliance tools

### 4.3.3 Infrastructure Security

- 4.3.3.1 Set up WAF (Web Application Firewall)
- 4.3.3.2 Configure network policies
- 4.3.3.3 Implement secrets management (Vault)
- 4.3.3.4 Add security scanning in CI/CD

---

## 4.4 Monitoring & Alerting

### 4.4.1 Enhanced Monitoring

- 4.4.1.1 Create SLO/SLI definitions:
  - Availability: 99.9%
  - Latency: p99 < 2s
  - Error rate: < 0.1%
- 4.4.1.2 Implement distributed tracing (Jaeger)
- 4.4.1.3 Add real user monitoring (RUM)
- 4.4.1.4 Create custom business dashboards

### 4.4.2 Alerting

- 4.4.2.1 Configure PagerDuty/Opsgenie integration
- 4.4.2.2 Create runbooks for common incidents
- 4.4.2.3 Implement alert routing and escalation
- 4.4.2.4 Add anomaly detection alerts

---

## 4.5 Disaster Recovery

### 4.5.1 Backup Strategy

- 4.5.1.1 Implement automated database backups:
  - Daily full backups
  - Hourly incremental backups
  - 30-day retention
- 4.5.1.2 Configure cross-region backup replication
- 4.5.1.3 Create backup verification process
- 4.5.1.4 Document restore procedures

### 4.5.2 High Availability

- 4.5.2.1 Set up multi-AZ deployment
- 4.5.2.2 Implement failover automation
- 4.5.2.3 Create health check and circuit breakers
- 4.5.2.4 Test disaster recovery procedures

---

# Appendix: Task Checklist Summary

## Phase 0 Totals

- Repository & Project: 18 tasks
- Docker & Infrastructure: 15 tasks
- CI/CD Pipeline: 10 tasks
- Monitoring & Observability: 12 tasks
- **Phase 0 Total: ~55 tasks**

## Phase 1 Totals

- Shared Package: 25 tasks
- Calculation Engine: 50 tasks
- API Gateway: 45 tasks
- Web Application: 75 tasks
- Calculation Worker: 10 tasks
- Integration & Testing: 15 tasks
- **Phase 1 Total: ~220 tasks**

## Phase 2 Totals

- Advanced Tax Features: 15 tasks
- Couple/Spouse Modeling: 12 tasks
- Scenario Comparison: 10 tasks
- PDF Report Generation: 12 tasks
- Withdrawal Optimization: 10 tasks
- **Phase 2 Total: ~60 tasks**

## Phase 3 Totals

- Monte Carlo Simulation: 20 tasks
- Success Metrics: 12 tasks
- Tax Optimization: 12 tasks
- Real Estate Integration: 5 tasks
- Estate Planning: 8 tasks
- **Phase 3 Total: ~55 tasks**

## Phase 4 Totals

- Performance Optimization: 20 tasks
- Scalability: 15 tasks
- Security Hardening: 18 tasks
- Monitoring & Alerting: 10 tasks
- Disaster Recovery: 10 tasks
- **Phase 4 Total: ~75 tasks**

---

# Grand Total: ~465 Tasks

This development plan provides a comprehensive roadmap from project initialization to production-ready deployment with enterprise-grade features. Each phase builds upon the previous, ensuring a solid foundation before adding complexity.
