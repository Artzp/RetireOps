# RetireOps Codebase Module Map

**Phase:** 27 — Codebase Module Map
**Purpose:** Complete module-by-module map of the RetireOps codebase. For each file: purpose, inputs, outputs, dependencies, hardcoded constants. Foundation for Phase 28 (Testable Surface Identification).
**Scope:** All five packages — shared, calculation-engine, api, web, worker.
**Source:** Static analysis of packages/\*/src/ as of Phase 27. Cross-referenced with .planning/phases/27-codebase-module-map/27-RESEARCH.md.

---

## Table of Contents

1. [Format Template](#format-template)
2. [Package: @retireops/shared](#package-retireopsshared)
3. [Package: @retireops/calculation-engine](#package-retireопscalculation-engine)
4. [Package: @retireops/api](#package-retireopsapi)
5. [Package: @retireops/web](#package-retireопsweb)
6. [Package: @retireops/worker](#package-retireopsworker)
7. [Cross-Package Data Flow](#cross-package-data-flow)
8. [Hardcoded Constants Summary](#hardcoded-constants-summary)
9. [Human Review Checkpoint](#human-review-checkpoint)

---

## Format Template

Every module entry uses this exact format:

### `<relative/path/to/file.ts>`

- **Purpose:** One-sentence statement of what this file does.
- **Inputs:** Function parameters, type imports, external data consumed (env, DB, HTTP).
- **Outputs:** Exported functions/types/constants with signatures; side effects (DB writes, HTTP responses, file writes).
- **Dependencies:** Internal imports (other modules in this repo) and external imports (npm packages).
- **Hardcoded constants:** Literal values embedded in code (numbers, strings, regex, thresholds). Mark none if none.
- **Notes:** Edge cases, gotchas, references to docs/source-of-truth/ sections, tech-debt flags.

---

## Package: @retireops/shared

Root: `packages/shared/src/`

Zero I/O dependencies. No database, no HTTP, no filesystem reads. Pure TypeScript types, constants, validation schemas, and utility functions consumed by all other packages.

### `packages/shared/src/index.ts`

- **Purpose:** Root barrel that re-exports all four sub-modules (types, constants, utils, validation) as the single public entry point for `@retireops/shared`.
- **Inputs:** None — re-export only.
- **Outputs:** Re-exports everything from `./types/index.js`, `./constants/index.js`, `./utils/index.js`, `./validation/index.js`.
- **Dependencies:** Internal: `types/index.js`, `constants/index.js`, `utils/index.js`, `validation/index.js`. External: none.
- **Hardcoded constants:** none.
- **Notes:** ESM barrel using `.js` extension per project convention. All downstream packages import from `@retireops/shared`, not from internal sub-paths.

---

### types/

### `packages/shared/src/types/index.ts`

- **Purpose:** Barrel that re-exports all type modules: province, user, accounts, income, tax, benefits, projection, scenario, insights, solver, monte-carlo, and historical-backtest.
- **Inputs:** None — re-export only.
- **Outputs:** Re-exports from `province.js`, `user.js`, `accounts.js`, `income.js`, `tax.js`, `benefits.js`, `projection.js`, `scenario.js`, `insights.js`, `solver.js`, `monte-carlo.js`, `historical-backtest.js`.
- **Dependencies:** Internal: all files listed above. External: none.
- **Hardcoded constants:** none.
- **Notes:** Export order matters for consumers resolving type names; no name conflicts across sub-modules.

### `packages/shared/src/types/projection.ts`

- **Purpose:** Defines all TypeScript interfaces for the projection engine's input/output contract — from `ProjectionInput` submitted by the wizard to `ProjectionYearRow` consumed by the UI.
- **Inputs:** Type imports from `province.js` (`ProvinceCode`), `tax.js` (`TaxCalculation`), `accounts.js` (`AccountOwner`), `user.js` (`MaritalStatus`), `constants/lif-rates.js` (`LIFJurisdiction`).
- **Outputs:** Exported interfaces/types: `ProjectionInput`, `SpouseInput`, `CoupleSettings`, `PersonYearlyResult`, `CoupleYearlyResult`, `ProjectionYearRow` (47 fields), `YearlyResult` (deprecated legacy), `ProjectionOutput`, `ProjectionSummary`, `CoupleProjectionSummary`, `Scenario`, `ScenarioComparison`, `ScenarioDifference`. Exported type guards: `isCoupleResult(result): result is CoupleYearlyResult`, `isPersonResult(result): result is PersonYearlyResult`.
- **Dependencies:** Internal: `province.js`, `tax.js`, `accounts.js`, `user.js`, `constants/lif-rates.js`. External: none.
- **Hardcoded constants:** none (literal constraints are in schemas, not in type definitions).
- **Notes:** `ProjectionYearRow` is the canonical flat table row for UI — 47 fields covering identity, primary income, primary taxes, primary spending, primary balances, spouse income/taxes/balances, household aggregates, and flags. `YearlyResult` is deprecated (use `PersonYearlyResult` or `CoupleYearlyResult`). `ProjectionOutput.legacyTargetMet` is `boolean | null` — null when no `legacyTarget` was set. Spouse fields use `?` (not `| undefined`) for `exactOptionalPropertyTypes` compliance. Several fields in `ProjectionYearRow` are flagged as "Engine gap" — not yet produced by engine: `selfEmploymentIncome`, `rentalIncome`, `cppContributions`, `eiPremiums`, `goalSpending`, `debtPayments`. See `@see docs/source-of-truth/08-projection-engine.md` and ENG-01/ENG-02.

### `packages/shared/src/types/tax.ts`

- **Purpose:** Defines TypeScript interfaces for all tax calculation types including brackets, tables, credits, and calculation results.
- **Inputs:** Type imports from `province.js` (`ProvinceCode`), `accounts.js` (`AccountOwner`).
- **Outputs:** Exported interfaces: `TaxBracket` (`min`, `max`, `rate`), `TaxTable` (`year`, `jurisdiction`, `brackets`, `basicPersonalAmount`, optional dividend credit rates), `TaxCredits`, `TaxCalculation` (full result with ~30 fields including income components, gross/net amounts, federal/provincial tax breakdown, marginal rates, effective rate, OAS clawback, age credit, pension credit), `DividendTaxRates`, `OASClawbackParams`, `PensionSplitResult`.
- **Dependencies:** Internal: `province.js`, `accounts.js`. External: none.
- **Hardcoded constants:** none.
- **Notes:** `TaxTable` has optional `eligibleDividendCreditRate` and `nonEligibleDividendCreditRate` for provincial tables that have dividend credits. `TaxCalculation` is the primary output of the tax engine — consumed by `PersonYearlyResult` and `ProjectionYearRow`. See `@see docs/source-of-truth/04-tax-engine.md`.

### `packages/shared/src/types/accounts.ts`

- **Purpose:** Defines TypeScript types for all Canadian account types (RRSP, RRIF, TFSA, non-registered, LIRA, LIF, FHSA) and the discriminated union `Account`.
- **Inputs:** None.
- **Outputs:** Exported types: `AccountType` (union: `'rrsp' | 'rrif' | 'tfsa' | 'non_registered' | 'lira' | 'lif' | 'fhsa'`), `AccountOwner` (`'primary' | 'spouse'`), `BaseAccount`, `RRSPAccount`, `RRIFAccount`, `TFSAAccount`, `NonRegisteredAccount`, `LIRAAccount`, `LIFAccount`, `FHSAAccount`, `Account` (discriminated union), `AccountSummary`.
- **Dependencies:** Internal: none. External: none.
- **Hardcoded constants:** none.
- **Notes:** `NonRegisteredAccount` carries `incomeAllocation` with `interestPct`, `canadianDividendPct`, `capitalGainsPct` — used to determine tax treatment of non-registered investment income. See `@see docs/source-of-truth/02-account-types.md`.

### `packages/shared/src/types/benefits.ts`

- **Purpose:** Defines TypeScript interfaces for CPP, OAS, and GIS government benefit types, plus exported constant objects for adjustment factors.
- **Inputs:** Type import from `accounts.js` (`AccountOwner`).
- **Outputs:** Exported interfaces: `CPPBenefit`, `OASBenefit`, `GISBenefit`, `GovernmentBenefitsSummary`. Exported constants: `CPP_ADJUSTMENT_FACTORS` (`EARLY_REDUCTION_PER_MONTH: 0.006`, `LATE_INCREASE_PER_MONTH: 0.007`, `EARLIEST_AGE: 60`, `STANDARD_AGE: 65`, `LATEST_AGE: 70`), `OAS_ADJUSTMENT_FACTORS` (`DEFERRAL_INCREASE_PER_MONTH: 0.006`, `EARLIEST_AGE: 65`, `LATEST_AGE: 70`, `FULL_RESIDENCY_YEARS: 40`, `MINIMUM_RESIDENCY_YEARS: 10`).
- **Dependencies:** Internal: `accounts.js`. External: none.
- **Hardcoded constants:** `EARLY_REDUCTION_PER_MONTH: 0.006`, `LATE_INCREASE_PER_MONTH: 0.007`, `DEFERRAL_INCREASE_PER_MONTH: 0.006`, `FULL_RESIDENCY_YEARS: 40`, `MINIMUM_RESIDENCY_YEARS: 10`, CPP ages `[60, 65, 70]`, OAS ages `[65, 70]`.
- **Notes:** Unusual that constants live in a types file; `CPP_ADJUSTMENT_FACTORS` and `OAS_ADJUSTMENT_FACTORS` duplicate values also found in `constants/rates.ts` (`CPP_RATES`, `OAS_RATES`). Both sets are exported by `@retireops/shared`. Callers should prefer the `constants/rates.ts` versions for new code. See `@see docs/source-of-truth/05-government-benefits.md`.

### `packages/shared/src/types/income.ts`

- **Purpose:** Defines TypeScript types for all income source categories including employment, pension, one-time events, and yearly summary shapes.
- **Inputs:** Type import from `accounts.js` (`AccountOwner`).
- **Outputs:** Exported types: `IncomeType` (union of 14 values), `TaxTreatment` (union of 5 values), `IncomeSource`, `EmploymentIncome`, `DBPensionIncome`, `OneTimeEventType` (union of 8 values), `OneTimeIncome`, `YearlyIncomeSummary`.
- **Dependencies:** Internal: `accounts.js`. External: none.
- **Hardcoded constants:** none.
- **Notes:** `IncomeType` union includes `'one_time'` for windfall events. `DBPensionIncome` has `bridgeBenefit` and `survivorBenefitPct` fields that the projection engine consumes. See `@see docs/source-of-truth/03-income-sources.md`.

### `packages/shared/src/types/province.ts`

- **Purpose:** Defines the canonical `ProvinceCode` type union and the `PROVINCES` lookup object for all 13 Canadian provinces and territories.
- **Inputs:** None.
- **Outputs:** Exported constant `PROVINCES` (13-entry `as const` object), exported type `ProvinceCode` (keyof PROVINCES — all 13 codes: `AB | BC | MB | NB | NL | NS | NT | NU | ON | PE | QC | SK | YT`), exported constant `PROVINCE_CODES` (string array), exported function `isValidProvince(code: string): code is ProvinceCode`.
- **Dependencies:** Internal: none. External: none.
- **Hardcoded constants:** Province codes: `AB`, `BC`, `MB`, `NB`, `NL`, `NS`, `NT`, `NU`, `ON`, `PE`, `QC`, `SK`, `YT`.
- **Notes:** `PROVINCE_CODES` used by `user.schema.ts` to build `z.enum(PROVINCE_CODES)`. `NT` and `NU` have flat tax treatment in `constants/tax-tables.ts`. See `@see docs/source-of-truth/01-user-profile.md`.

### `packages/shared/src/types/user.ts`

- **Purpose:** Defines user profile types, spouse profile types, household profile types, and the `AGE_MILESTONES` constant for age-based event triggers.
- **Inputs:** Type import from `province.js` (`ProvinceCode`).
- **Outputs:** Exported type `MaritalStatus` (`'single' | 'married' | 'common_law'`), exported interfaces `UserProfile`, `SpouseProfile`, `HouseholdProfile`. Exported constant `AGE_MILESTONES` with keys: `CPP_EARLIEST: 60`, `CPP_STANDARD: 65`, `CPP_LATEST: 70`, `OAS_EARLIEST: 65`, `OAS_LATEST: 70`, `AGE_CREDIT_ELIGIBLE: 65`, `PENSION_SPLITTING_ELIGIBLE: 65`, `RRSP_CONTRIBUTION_DEADLINE_AGE: 71`, `RRSP_TO_RRIF_CONVERSION_AGE: 71`, `RRIF_MINIMUM_WITHDRAWAL_START_AGE: 72`.
- **Dependencies:** Internal: `province.js`. External: none.
- **Hardcoded constants:** `AGE_MILESTONES` — ages 60, 65, 70, 71, 72 as named constants.
- **Notes:** `AGE_MILESTONES` is the canonical source for age-based trigger values; engine code should reference these rather than raw literals. See `@see docs/source-of-truth/01-user-profile.md - Age-Based Event Triggers`.

### `packages/shared/src/types/scenario.ts`

- **Purpose:** Defines the `ScenarioDecisions` Zod schema and inferred TypeScript type — the strategy override layer for profile-based scenarios (v1.3+).
- **Inputs:** External import from `zod`.
- **Outputs:** Exported Zod schema `ScenarioDecisionsSchema`, exported inferred type `ScenarioDecisions`. Schema covers 4 decision categories: Timing (`retirementAge`, `spouseRetirementAge`, `cppStartAge`, `oasStartAge`, `spouseCppStartAge`, `spouseOasStartAge`, `dbPensionStartAge`, `propertySaleDecisions`), Tax Strategy (`drawdownOrder`, `rrspMeltdown`, `incomeSplitting`, `oasClawbackAvoidance`), Savings (`contributionOverrides`), Spending (`targetRetirementSpending`, `inflationRate`, `ageBandReductions`, `legacyTarget`).
- **Dependencies:** Internal: none. External: `zod`.
- **Hardcoded constants:** Validation bounds: `retirementAge` min=50 max=75, `cppStartAge` min=60 max=70, `oasStartAge` min=65 max=70, `inflationRate` min=0 max=0.2.
- **Notes:** This is for `profile_scenarios` table (v1.3), NOT the legacy `scenarios` table. Zod schema is source of truth — TypeScript type is inferred via `z.infer`. All fields optional: `undefined` means "use profile default". See `.planning/phases/17-schema-assembler-foundation/17-CONTEXT.md - D-09, D-10`.

### `packages/shared/src/types/insights.ts`

- **Purpose:** Defines the public contract types for insight cards — plain-language tax optimization recommendations produced by v1.9 analyzers (CARD-01, CARD-05).
- **Inputs:** None — type definitions only.
- **Outputs:** Exported types: `ConfidenceLevel` (`'high' | 'medium' | 'low'`), `InsightModule` (`'rrsp-meltdown' | 'cpp-oas-timing' | 'drawdown-order' | 'income-splitting'`), `InsightCard` (interface: `id: string`, `module: InsightModule`, `title: string`, `summary: string`, `dollarImpact: number`, `confidence: ConfidenceLevel`, `details?: string`, `rank: number`).
- **Dependencies:** Internal: none. External: none.
- **Hardcoded constants:** none.
- **Notes:** Added in Phase 43 (v1.9 Tax Optimization Engine). These types are shared across calculation-engine (producers) and web/api (consumers). `dollarImpact` is lifetime tax savings in CAD. `rank` is ascending (1 = highest impact). See CARD-01, CARD-05.

### `packages/shared/src/types/solver.ts`

- **Purpose:** Defines the TypeScript interfaces for the v1.12 Reverse Calculator solver — `SolverMode`, the 4-mode `SolverInput` discriminated union, `SolverResult`, and `SolverProjectionSummary`.
- **Inputs:** Type imports from `./projection.js` (`FundedStatus`) and `./province.js` (`ProvinceCode`).
- **Outputs:** Exported types: `SolverMode`, `SolverInputBase`, `RequiredSavingsInput`, `SustainableSpendingInput`, `EarliestRetirementAgeInput`, `RequiredTotalSavingsInput`, `SolverInput` (discriminated union), `SolverResult`, `SolverProjectionSummary`.
- **Dependencies:** Internal: `projection.js`, `province.js`. External: none.
- **Hardcoded constants:** none (numeric bounds live in `validation/solver.schema.ts`, not in type definitions).
- **Notes:** `SolverProjectionSummary` is named explicitly to avoid a barrel collision with the pre-existing `ProjectionSummary` export from `projection.ts` — see ROADMAP Phase 51 Notes. Mode 4 (`RequiredTotalSavingsInput`) is the only mode where `rrspBalance`, `tfsaBalance`, and `nonRegBalance` are optional. See `@see specs/008-reverse-calculator/data-model.md` for the authoritative field inventory. Consumed by calculation-engine solver (Phase 52), API routes (Phase 53), and web UI (Phase 54).

### `packages/shared/src/types/historical-backtest.ts`

- **Purpose:** Defines all TypeScript interfaces for the historical backtesting feature — the shared type contract between `@retireops/shared`, `calculation-engine`, `api`, and `web`.
- **Inputs:** None — pure type definitions, no runtime imports.
- **Outputs:** Exported interfaces: `HistoricalReturnRecord` (`year`, `returnRate`), `HistoricalReturnDataset` (`id`, `name`, `sourceAttribution`, `yearRange`, `longRunAverage`, `records`), `PresetScenario` (`id` union of 3 literal values, `label`, `description`, `startYear`), `BacktestYearRecord` (`calendarYear`, `projectionYear`, `returnRateApplied`, `isEstimated`, `portfolioBalance`, `totalWithdrawals`, `totalTaxesPaid`), `BacktestRun` (`scenarioId`, `label`, `description`, `startYear`, `funded`, `depletionYear`, `finalBalance`, `yearRecords`), `BacktestResult` (`projectionId`, `inputDataHash`, `runs`, `computedAt`).
- **Dependencies:** Internal: none. External: none.
- **Hardcoded constants:** None (literal constraints are in constants/historical-returns.ts, not in type definitions).
- **Notes:** `depletionYear` is `number | null` — `null` when `funded === true`, a calendar year when `funded === false`. `BacktestResult.inputDataHash` is a SHA-256 of the serialized projection input (staleness detection, computed in Phase 61). `isEstimated` flags years where the historical dataset was exhausted and the long-run average was substituted. See `@see specs/010-historical-backtesting/data-model.md`.

---

### constants/

### `packages/shared/src/constants/index.ts`

- **Purpose:** Barrel that re-exports all constant modules: limits, rates, tax-tables, defaults, lif-rates, and historical-returns.
- **Inputs:** None — re-export only.
- **Outputs:** Re-exports from `limits.js`, `rates.js`, `tax-tables.js`, `defaults.js`, `lif-rates.js`, `historical-returns.js`.
- **Dependencies:** Internal: listed modules. External: none.
- **Hardcoded constants:** none.
- **Notes:** None.

### `packages/shared/src/constants/tax-tables.ts`

- **Purpose:** Contains hardcoded Canadian federal and all 13 provincial/territorial tax bracket tables for 2024, 2025, and 2026, plus the `getProvincialTaxTables(year)` lookup function.
- **Inputs:** Type import from `types/tax.js` (`TaxTable`).
- **Outputs:** Exported constants: `FEDERAL_TAX_2024`, `FEDERAL_TAX_2025`, `FEDERAL_TAX_2026`. Provincial tables for 2024 and 2025: `ONTARIO_TAX_2024`, `ONTARIO_TAX_2025`, `BC_TAX_2024`, `BC_TAX_2025`, `ALBERTA_TAX_2024`, `ALBERTA_TAX_2025`, `SASKATCHEWAN_TAX_2024`, `SASKATCHEWAN_TAX_2025`, `MANITOBA_TAX_2024`, `MANITOBA_TAX_2025`, `NEW_BRUNSWICK_TAX_2024`, `NEW_BRUNSWICK_TAX_2025`, `NOVA_SCOTIA_TAX_2024`, `NOVA_SCOTIA_TAX_2025`, `PEI_TAX_2024`, `PEI_TAX_2025`, `NEWFOUNDLAND_TAX_2024`, `NEWFOUNDLAND_TAX_2025`, `QUEBEC_TAX_2024`, `QUEBEC_TAX_2025`, `NORTHWEST_TERRITORIES_TAX_2024`, `NUNAVUT_TAX_2024`, `YUKON_TAX_2024`. Exported function `getProvincialTaxTables(year: number): Record<ProvinceCode, TaxTable>`.
- **Dependencies:** Internal: `types/tax.js`. External: none.
- **Hardcoded constants:** Federal 2024 lowest bracket rate: `0.15`; Federal 2025 lowest bracket rate: `0.145` (reduced from 2024); Federal 2026 lowest bracket rate: `0.14`. Federal 2024 basic personal amount: `15705`; 2025: `16129`. All provincial bracket thresholds and rates are hardcoded literals. Ontario 2024 `eligibleDividendCreditRate: 0.1`, `nonEligibleDividendCreditRate: 0.029863`.
- **Notes:** The lowest federal bracket rate changed from `0.15` (2024) to `0.145` (2025) — a policy change, not indexing. Territories (NT, NU, YT) only have 2024 tables. `getProvincialTaxTables` returns the 2024 tables as fallback for years beyond 2025 (latest-year fallback pattern used throughout the engine). All bracket values are CRA-published for 2024/2025; 2026 values are projections. See `@see docs/source-of-truth/04-tax-engine.md`.

### `packages/shared/src/constants/rates.ts`

- **Purpose:** Contains RRIF minimum withdrawal rates by age, CPP and OAS adjustment rates, OAS clawback thresholds, government benefit dollar amounts, dividend rates, and capital gains inclusion rates.
- **Inputs:** None.
- **Outputs:** Exported constants: `RRIF_MINIMUM_RATES` (Record<number, number>, ages 65–94 with literal rates from 4% to 18.79%), `RRIF_MINIMUM_RATE_95_PLUS = 0.2`. Exported function `getRRIFMinimumRate(age: number): number`. Exported constants: `CPP_RATES` (`earlyReductionPerMonth: 0.006`, `lateIncreasePerMonth: 0.007`, `maxMonthsEarly: 60`, `maxMonthsLate: 60`), `OAS_RATES` (`deferralIncreasePerMonth: 0.006`, `maxDeferralMonths: 60`, `age75Bonus: 0.1`, `clawbackRate: 0.15`), `OAS_CLAWBACK_THRESHOLDS` (2024/2025/2026 — threshold, fullClawbackAge65To74, fullClawbackAge75Plus), `BENEFIT_AMOUNTS_2024` (CPP/OAS/GIS maximums and income thresholds), `OAS_BENEFIT_AMOUNTS` (2024/2025/2026 — monthly and annual amounts for age 65–74 and 75+), `DIVIDEND_RATES` (`eligibleGrossUp: 0.38`, `eligibleFederalCredit: 0.150198`, `nonEligibleGrossUp: 0.15`, `nonEligibleFederalCredit: 0.090301`), `CAPITAL_GAINS_RATES` (`standardInclusionRate: 0.5`, `enhancedInclusionRate: 0.6667`, `enhancedThreshold: 250000`).
- **Dependencies:** Internal: none. External: none.
- **Hardcoded constants:** RRIF age-to-rate table (30 literal entries, 65→0.04 through 94→0.1879), `RRIF_MINIMUM_RATE_95_PLUS = 0.2`, `CPP earlyReductionPerMonth = 0.006`, `CPP lateIncreasePerMonth = 0.007`, `OAS age75Bonus = 0.1`, `OAS clawbackRate = 0.15`, OAS clawback threshold 2024: `90997`, 2025: `93454`, 2026: `95323`. Capital gains enhanced threshold: `250000`. GIS income threshold single: `21624`, married both: `28560`, married-spouse-not-OAS: `51840`. Dividend eligible gross-up: `0.38`, federal credit: `0.150198`.
- **Notes:** `getRRIFMinimumRate` returns 0 for age < 65 and uses latest-available-year lookup for 95+. All three GIS thresholds live here: `BENEFIT_AMOUNTS_2024.gis.incomeThresholdSingle = 21624`, `incomeThresholdMarriedBoth = 28560`, and `incomeThresholdMarriedOneOAS = 51840` (added in feature 4.1; `gis.ts` now consumes this key instead of inlining the literal). `OAS_BENEFIT_AMOUNTS` supports year-key lookup with latest-year fallback in the OAS engine. See `@see docs/source-of-truth/02-account-types.md` (RRIF), `@see docs/source-of-truth/05-government-benefits.md` (CPP/OAS/GIS).

### `packages/shared/src/constants/limits.ts`

- **Purpose:** Contains annual contribution limits for RRSP, TFSA cumulative and annual, FHSA, and CPP YMPE (Year's Maximum Pensionable Earnings) for 2024 and 2025.
- **Inputs:** None.
- **Outputs:** Exported constants: `RRSP_LIMITS` (2024: `{maxContribution: 31560, earnedIncomeRate: 0.18}`, 2025: `{maxContribution: 32490, earnedIncomeRate: 0.18}`), `TFSA_ANNUAL_LIMITS` (Record<number, number>, 2009–2025), `TFSA_CUMULATIVE_LIMITS` (2024: `95000`, 2025: `102000`), `FHSA_LIMITS` (`annualLimit: 8000`, `lifetimeLimit: 40000`), `CPP_YMPE` (2024: `68500`, 2025: `71300`).
- **Dependencies:** Internal: none. External: none.
- **Hardcoded constants:** RRSP 2024 max: `31560`, 2025 max: `32490`, RRSP earned income rate: `0.18`. TFSA annual values from 2009 ($5000) through 2025 ($7000). TFSA cumulative 2024: `95000`, 2025: `102000`. FHSA annual: `8000`, lifetime: `40000`. CPP YMPE 2024: `68500`, 2025: `71300` (projected).
- **Notes:** CPP YMPE 2025 is marked "(Projected)" in comment — not confirmed. TFSA defaults to `$7,000` for unknown years (handled in `accounts/tfsa.ts` engine, not here). Only 2024 and 2025 RRSP limits defined; engine uses 2025 value as fallback for future years. See `@see docs/source-of-truth/02-account-types.md`.

### `packages/shared/src/constants/lif-rates.ts`

- **Purpose:** Contains LIF (Life Income Fund) maximum withdrawal rate rules by jurisdiction (federal + 10 provinces), lookup functions, and the `LIFJurisdiction` type.
- **Inputs:** None.
- **Outputs:** Exported type `LIFJurisdiction` (union: `'federal' | 'AB' | 'BC' | 'MB' | 'NB' | 'NL' | 'NS' | 'ON' | 'PE' | 'QC' | 'SK'`), exported interface `LIFJurisdictionRules` (name, referenceRate, targetAge, minimumConversionAge, allowsOneTimeUnlock, oneTimeUnlockPercentage, smallBalanceThreshold, allowsFinancialHardshipUnlock, allowsShortenedLifeUnlock), exported constant `LIF_RULES: Record<LIFJurisdiction, LIFJurisdictionRules>`. Exported functions (file continues beyond excerpt): `getLIFMaximumRate()`, `getLIFRules()`.
- **Dependencies:** Internal: none. External: none.
- **Hardcoded constants:** Federal `referenceRate: 0.06` (CANSIM V122487 long-term bond yield assumption), `targetAge: 90`, `minimumConversionAge: 55`. Each jurisdiction has its own `referenceRate`, `targetAge`, `smallBalanceThreshold` values.
- **Notes:** NT and NU are NOT included (no LIF legislation in those territories). `LIFJurisdiction` differs from `ProvinceCode` — federal is included and NT/NU/YT are excluded. Maximum withdrawal formula uses CANSIM reference rate; values vary by province. See `@see docs/source-of-truth/02-account-types.md - LIRA/LIF Section`.

### `packages/shared/src/constants/defaults.ts`

- **Purpose:** Defines default values used as fallbacks in projection calculations — inflation rate, life expectancy, return rates by risk profile, Monte Carlo volatility, and the fallback current year.
- **Inputs:** None.
- **Outputs:** Exported constants: `DEFAULT_ASSUMPTIONS` (`inflationRate: 0.025`, `lifeExpectancy: 95`, `retirementAge: 65`), `DEFAULT_RETURNS` (`conservative: 0.04`, `moderate: 0.055`, `aggressive: 0.07`), `DEFAULT_VOLATILITY` (`conservative: 0.06`, `moderate: 0.1`, `aggressive: 0.15`), `CPP_DEFAULT_ESTIMATE` (`averagePercentOfMax: 0.55`, `maxAt65_2024: 16375`, `averageAt65_2024: 9800`), `CURRENT_YEAR = 2024`. Exported type `RiskProfile` (keyof `DEFAULT_RETURNS`).
- **Dependencies:** Internal: none. External: none.
- **Hardcoded constants:** `inflationRate: 0.025`, `lifeExpectancy: 95`, `retirementAge: 65`, `conservative return: 0.04`, `moderate return: 0.055`, `aggressive return: 0.07`, `CURRENT_YEAR = 2024`.
- **Notes:** `CURRENT_YEAR = 2024` is a static literal — it does NOT call `new Date().getFullYear()`. This means if the module is consumed without the `getCurrentYear()` utility from `utils/date.ts`, stale year fallbacks will be produced. **Open Question 1 from 27-RESEARCH.md applies here**: `CURRENT_YEAR` should be replaced with a dynamic call or at minimum updated annually. The projection engine uses `getCurrentYear()` from `utils/date.ts` as the primary loop start — `CURRENT_YEAR` is a last-resort fallback. See also `CPP_DEFAULT_ESTIMATE.averageAt65_2024` comment "16375 \* 0.55 ≈ 9000" (arithmetic in comment is rounded).

### `packages/shared/src/constants/historical-returns.ts`

- **Purpose:** Exports the static 1990–2025 blended return dataset and three named preset backtest scenarios for use by the historical backtesting engine.
- **Inputs:** Type imports from `types/historical-backtest.js` (`HistoricalReturnDataset`, `PresetScenario`). No runtime I/O.
- **Outputs:** Exported constant `BLENDED_HISTORICAL_RETURNS_DATASET: HistoricalReturnDataset` — 36 records (1990–2025), `longRunAverage` = arithmetic mean of all records. Exported constant `PRESET_SCENARIOS: PresetScenario[]` — 3 entries: `{ id: 'retired-2000', startYear: 2000 }`, `{ id: 'retired-2008', startYear: 2008 }`, `{ id: 'retired-2020', startYear: 2020 }`.
- **Dependencies:** Internal: `types/historical-backtest.js`. External: none.
- **Hardcoded constants:** 36 annual return rates (1990–2025); `longRunAverage = 0.088333` (arithmetic mean of all 36 records); preset labels "Retired 2000 — Dot-com Crash", "Retired 2008 — Financial Crisis", "Retired 2020 — COVID Shock".
- **Notes:** Returns are nominal (not inflation-adjusted), 60% S&P/TSX Composite + 40% S&P 500 (CAD), gross of fees. Source: TMX Group / Morningstar. Values should be cross-checked against authoritative sources for 2000, 2008, 2020 before Phase 60 validation. `longRunAverage` must equal arithmetic mean of `records[].returnRate` — validated by TC-HIST-001 test. See `@see specs/010-historical-backtesting/data-model.md` and `@see HIST-01`.

---

### utils/

### `packages/shared/src/utils/index.ts`

- **Purpose:** Barrel that re-exports all utility functions from `date.js` and `money.js`.
- **Inputs:** None — re-export only.
- **Outputs:** Re-exports from `date.js`, `money.js`.
- **Dependencies:** Internal: `date.js`, `money.js`. External: none.
- **Hardcoded constants:** none.
- **Notes:** None.

### `packages/shared/src/utils/date.ts`

- **Purpose:** Provides date arithmetic utilities for age calculation, eligibility checks, and year derivation used throughout the projection engine and UI.
- **Inputs:** Function parameters: `birthdate: Date`, `asOfDate?: Date`, `year: number`, `retirementAge: number`, `age: number`.
- **Outputs:** Exported functions: `calculateAge(birthdate: Date, asOfDate?: Date): number`, `ageAtEndOfYear(birthdate: Date, year: number): number`, `getRetirementYear(birthdate: Date, retirementAge: number): number`, `isEligibleForOAS(age: number): boolean` (age >= 65), `isEligibleForCPP(age: number): boolean` (age >= 60), `mustConvertToRRIF(age: number): boolean` (age >= 71), `hasRRIFMinimumWithdrawal(age: number): boolean` (age >= 72), `getCurrentYear(): number` (returns `new Date().getFullYear()`), `getYearsBetween(startDate: Date, endDate: Date): number`.
- **Dependencies:** Internal: none. External: none (uses native `Date`).
- **Hardcoded constants:** Age thresholds embedded in predicate functions: `65` (OAS eligibility), `60` (CPP eligibility), `71` (RRSP conversion), `72` (RRIF minimum withdrawal start).
- **Notes:** `calculateAge` adjusts for birthday not yet occurring in current year. `ageAtEndOfYear` uses December 31 as the reference date — consistent with how the projection engine assigns ages. Age thresholds here duplicate `AGE_MILESTONES` in `types/user.ts`; if CRA rules change, both must be updated. `getCurrentYear()` is the dynamic alternative to `CURRENT_YEAR` constant. See `@see docs/source-of-truth/01-user-profile.md - VR-PROFILE-001`.

### `packages/shared/src/utils/money.ts`

- **Purpose:** Provides numeric formatting, rounding, and financial math utility functions used by the engine and frontend.
- **Inputs:** Function parameters: `amount: number`, `locale?: string`, `currency?: string`, `inflationRate: number`, `years: number`, `nominalReturn: number`, `principal: number`, `rate: number`, `presentValue: number`, `annualContribution: number`, `value: number`, `min: number`, `max: number`.
- **Outputs:** Exported functions: `formatCurrency(amount, locale?, currency?): string` (default en-CA, CAD, 0 decimals), `formatCurrencyWithCents(amount, locale?, currency?): string` (2 decimals), `roundToTwoDecimals(amount): number`, `roundToNearestDollar(amount): number`, `percentageOf(amount, percentage): number`, `inflationAdjust(amount, inflationRate, years): number` (compound), `realReturn(nominalReturn, inflationRate): number` (Fisher equation), `compoundGrowth(principal, rate, years): number`, `futureValue(presentValue, annualContribution, rate, years): number` (FV with regular contributions), `ensureNonNegative(amount): number`, `clamp(value, min, max): number`.
- **Dependencies:** Internal: none. External: none (uses `Intl.NumberFormat`, `Math.*`).
- **Hardcoded constants:** Default locale `'en-CA'`, default currency `'CAD'`.
- **Notes:** `futureValue` handles `rate === 0` as a special case (linear growth). `realReturn` uses the Fisher equation: `(1 + nominal) / (1 + inflation) - 1`. No rounding inside `inflationAdjust` or `compoundGrowth` — callers must round if needed. `formatCurrency` uses `Intl.NumberFormat` — locale-sensitive; in a server-side context ensure the Node.js build supports `en-CA`.

---

### validation/

### `packages/shared/src/validation/index.ts`

- **Purpose:** Barrel that re-exports all Zod validation schemas from auth, user, projection, account, income, scenario, and solver schema files.
- **Inputs:** None — re-export only.
- **Outputs:** Re-exports from `auth.schema.js`, `user.schema.js`, `projection.schema.js`, `account.schema.js`, `income.schema.js`, `scenario.schema.js`, `solver.schema.js`.
- **Dependencies:** Internal: listed schema files. External: none.
- **Hardcoded constants:** none.
- **Notes:** None.

### `packages/shared/src/validation/projection.schema.ts`

- **Purpose:** Provides the Zod validation schema for `ProjectionInput` — the main wizard submission payload — plus the scenario modification schema.
- **Inputs:** External import from `zod`. Internal import of `provinceSchema` from `user.schema.js`.
- **Outputs:** Exported schemas: `projectionInputBaseSchema` (base z.object without refinements, used for `.partial()` in scenario modifications), `projectionInputSchema` (base with two refinements: retirement age >= current age, life expectancy > retirement age). Exported type aliases: `ProjectionInputData` (`z.input`), `ValidatedProjectionInput` (`z.output`), `ScenarioModification`. Also `scenarioModificationSchema`.
- **Dependencies:** Internal: `user.schema.js` (`provinceSchema`). External: `zod`.
- **Hardcoded constants:** `retirementAge` min=18 max=75, `lifeExpectancy` min=65 max=110 default=95, `employmentGrowthRate` min=-0.1 max=0.2 default=0.02, `investmentReturn` min=0 max=0.15 default=0.05, `inflationRate` default=0.025, `expectedCPPAt65` max=20000, `cppStartAge` default=65, `oasStartAge` default=65.
- **Notes:** `projectionInputBaseSchema` deliberately excludes spouse and strategy fields (those are in `types/projection.ts` `ProjectionInput` interface). The Zod schema lags behind the full `ProjectionInput` TypeScript interface — does not validate `drawdownOrder`, `rrspMeltdown`, etc. The `retirementAge >= currentAge` refinement computes age dynamically from `Date.now()`. See `@see docs/source-of-truth/11-development-roadmap.md - Phase 1 Data Inputs`.

### `packages/shared/src/validation/auth.schema.ts`

- **Purpose:** Provides Zod schemas for all authentication flows — registration, login, token refresh, password change, and OAuth.
- **Inputs:** External import from `zod`.
- **Outputs:** Exported schemas and inferred types: `emailSchema` (lowercase transform, max 255), `passwordSchema` (strength: min 8, max 128, lowercase + uppercase + digit + special char), `simplePasswordSchema` (min 8, max 128 only), `nameSchema` (min 1, max 100, trim), `registerInputSchema` / `RegisterInput`, `loginInputSchema` / `LoginInput`, `refreshTokenInputSchema` / `RefreshTokenInput`, `changePasswordInputSchema` / `ChangePasswordInput`, `setPasswordInputSchema` / `SetPasswordInput`, `oauthProviderSchema` (enum: `'google' | 'github' | 'microsoft'`) / `OAuthProvider`, `googleIdTokenInputSchema` / `GoogleIdTokenInput`, `oauthCodeInputSchema` / `OAuthCodeInput`, `authUserSchema` / `AuthUser`, `tokenPairSchema` / `TokenPair`, `authResultSchema` / `AuthResult`, `oauthAuthResultSchema` / `OAuthAuthResult`.
- **Dependencies:** Internal: none. External: `zod`.
- **Hardcoded constants:** Password: min=8, max=128 chars. Email: max=255 chars. Name: min=1, max=100 chars. Password regex patterns for character class enforcement (inline `.refine()` callbacks). `oauthProviderSchema` enum values hardcoded as `'google' | 'github' | 'microsoft'` (only Google is implemented in the API).
- **Notes:** `registerInputSchema` uses `simplePasswordSchema` (not `passwordSchema`) — strength checking is deferred to the auth service. `emailSchema` lowercases email on transform, ensuring case-insensitive uniqueness at the Zod level. `authUserSchema.emailVerified` is present in the schema but email verification is not currently implemented.

### `packages/shared/src/validation/user.schema.ts`

- **Purpose:** Provides Zod schemas for user profile, spouse profile, household profile, and projection-specific spouse/couple inputs, including province and marital status enums.
- **Inputs:** External import from `zod`. Internal import of `PROVINCE_CODES` from `types/province.js`.
- **Outputs:** Exported schemas: `provinceSchema` (z.enum from PROVINCE_CODES), `maritalStatusSchema`, `userProfileSchema` (with age ≥ 18 refinement, retirement age ≥ current age, life expectancy > retirement age), `spouseProfileSchema`, `spouseInputSchema` (extended with accounts and benefits fields), `coupleSettingsSchema`, `householdProfileSchema` (with couple-requires-spouse refinement). Exported type aliases: `UserProfileInput`, `ValidatedUserProfile`, `SpouseProfileInput`, `ValidatedSpouseProfile`, `HouseholdProfileInput`, `ValidatedHouseholdProfile`, `SpouseInputSchemaType`, `ValidatedSpouseInput`, `CoupleSettingsInput`, `ValidatedCoupleSettings`.
- **Dependencies:** Internal: `types/province.js`. External: `zod`.
- **Hardcoded constants:** User must be at least 18 years old. Life expectancy min=65, max=110, default=95. Retirement age min=18, max=75. CPP start age default=65, OAS start age default=65, years of residence default=40.
- **Notes:** `householdProfileSchema` enforces: if maritalStatus is `'married'` or `'common_law'`, spouse is required. The `spouseInputSchema` is the Zod equivalent of the `SpouseInput` interface from `types/projection.ts` — they should remain in sync. `coupleSettingsSchema` sets `optimizePensionSplitting` default=true, `useYoungerSpouseForRRIF` default=false.

### `packages/shared/src/validation/account.schema.ts`

- **Purpose:** Provides Zod schemas for validating account creation and management inputs for all seven account types plus contribution/withdrawal operations.
- **Inputs:** External import from `zod`.
- **Outputs:** Exported schemas: `accountTypeSchema` (enum all 7 types), `baseAccountSchema`, `rrspAccountSchema`, `rrifAccountSchema`, `tfsaAccountSchema`, `nonRegisteredAccountSchema`, `liraAccountSchema`, `lifAccountSchema`, `fhsaAccountSchema`, `accountSchema` (discriminated union by `type`), `lifJurisdictionSchema`, `accountContributionSchema`, `accountWithdrawalSchema`, `validateRRSPContribution` (with contribution room check and age ≤ 71), `validateTFSAContribution`. Exported types: `AccountSchemaType`, `BaseAccountSchema`, `AccountContribution`, `AccountWithdrawal`.
- **Dependencies:** Internal: none. External: `zod`.
- **Hardcoded constants:** RRSP contribution age max=71, `validateRRSPContribution` year min=2024, LIRA `lockedInUntilAge` default=55, FHSA `contributionRoom` max=40000, `yearOpened` min=2023.
- **Notes:** `validateRRSPContribution` enforces age ≤ 71 at schema level (consistent with `AGE_MILESTONES.RRSP_CONTRIBUTION_DEADLINE_AGE`). The `lifAccountSchema` has `governingJurisdiction` default `'federal'`. `fhsaAccountSchema.yearOpened` min=2023 (FHSA introduced 2023). Diverges from `types/accounts.ts` shapes in having extra UI fields like `name`, `institution`, `accountNumber`.

### `packages/shared/src/validation/income.schema.ts`

- **Purpose:** Provides Zod schemas for all income source types — employment, pension, CPP/QPP, OAS, GIS, rental, investment, and annuity — plus projection input and annual summary shapes.
- **Inputs:** External import from `zod`.
- **Outputs:** Exported schemas: `incomeSourceTypeSchema`, `incomeFrequencySchema`, `baseIncomeSourceSchema`, `employmentIncomeSchema`, `pensionIncomeSchema`, `cppIncomeSchema`, `oasIncomeSchema`, `gisIncomeSchema`, `rentalIncomeSchema`, `investmentIncomeSchema`, `annuityIncomeSchema`, `incomeSourceSchema` (z.union of all), `incomeProjectionInputSchema`, `annualIncomeSummarySchema`. Exported types: `IncomeSourceType`, `IncomeFrequency`, `BaseIncomeSourceSchema`, `EmploymentIncomeSchema`, `PensionIncomeSchema`, `CPPIncomeSchema`, `OASIncomeSchema`, `GISIncomeSchema`, `RentalIncomeSchema`, `InvestmentIncomeSchema`, `AnnuityIncomeSchema`, `IncomeSourceSchema`, `IncomeProjectionInput`, `AnnualIncomeSummary`.
- **Dependencies:** Internal: none. External: `zod`.
- **Hardcoded constants:** Employment growth rate default=0.02. CPP `estimatedAt65` max=20000, `yearsContributed` max=47. OAS `yearsOfResidence` default=40, `startAge` default=65. Pension `bridgeEndAge` max=70. Annuity `guaranteedPeriod` max=30. Sensitivity analysis `variationPercent` default=0.1 (10%).
- **Notes:** `incomeSourceTypeSchema` enum diverges slightly from `IncomeType` in `types/income.ts` (schema has `'pension'`, types has `'db_pension'` and `'dc_pension'`). The `incomeProjectionInputSchema.startYear` and `endYear` both have min=2024 — will need updating each year. See `@see docs/source-of-truth/03-income-sources.md`.

### `packages/shared/src/validation/scenario.schema.ts`

- **Purpose:** Provides Zod schemas for legacy projection-based scenario CRUD (not profile_scenarios) — create/update/compare operations and predefined scenario templates.
- **Inputs:** External import from `zod`. Internal import of `projectionInputBaseSchema` from `projection.schema.js`.
- **Outputs:** Exported schemas: `scenarioTypeSchema` (enum: `'base_case' | 'early_retirement' | 'delayed_retirement' | 'increased_savings' | 'reduced_spending' | 'market_downturn' | 'inheritance' | 'major_expense' | 'career_change' | 'custom'`), `createScenarioSchema`, `updateScenarioSchema`, `scenarioComparisonRequestSchema`, `scenarioTemplateSchema`. Exported constant `scenarioTemplates` (5 predefined templates). Exported types: `ScenarioType`, `CreateScenarioInput`, `UpdateScenarioInput`, `ScenarioComparisonRequest`, `ScenarioTemplate`, `WhatIfAnalysisInput`, `SensitivityAnalysisInput`.
- **Dependencies:** Internal: `projection.schema.js`. External: `zod`.
- **Hardcoded constants:** Scenario name max=100, description max=500 chars. Comparison max 10 scenarios. Template hardcoded values: early retirement age=60, delayed age=67, RRSP max=31560 (2024), TFSA max=7000. Market downturn return=0.03. Sensitivity `variationPercent` min=0.05, max=0.5, default=0.1.
- **Notes:** This is for the **legacy** `scenarios` table (bound to `projections` FK), NOT `profile_scenarios`. New scenario logic uses `types/scenario.ts` `ScenarioDecisionsSchema`. The hardcoded RRSP template value `31560` (2024 max) will be stale in future years. `scenarioTemplates` constant is an array of plain objects with defaultModifications — useful for seeding but not validated at runtime.

### `packages/shared/src/validation/solver.schema.ts`

- **Purpose:** Zod discriminated-union schema for `SolverInput`, keyed on the `mode` field, producing field-level error messages on invalid per-mode field combinations.
- **Inputs:** `z` from 'zod'; `provinceSchema` from `./user.schema.js`.
- **Outputs:** Exported schemas: `SolverInputSchema` (discriminated union), `RequiredSavingsInputSchema`, `SustainableSpendingInputSchema`, `EarliestRetirementAgeInputSchema`, `RequiredTotalSavingsInputSchema`.
- **Dependencies:** Internal: `./user.schema.js` (for `provinceSchema`). External: `zod`.
- **Hardcoded constants:** age bounds (18, 19, 60, 65, 70, 80, 110, 120), balance floors (0), spending range (1_000, 500_000), savings-rate ceiling (250_000), rate bounds (0.00–0.15, 0.00–0.10), defaults (lifeExpectancy=90, cppStartAge=65, oasStartAge=65, investmentReturnRate=0.05, inflationRate=0.02).
- **Notes:** Cross-field refinement (`targetRetirementAge >= currentAge + 1`) is intentionally NOT implemented here — it is scoped to Phase 53 API validation per `specs/008-reverse-calculator/tasks.md` T004. Tested by `solver.schema.test.ts`. See `@see specs/008-reverse-calculator/data-model.md` for the authoritative validation rules table.

---

### Shared Package Summary

- **Total files documented:** 24 (`index.ts` + 9 types + 5 constants + 2 utils + 7 validation)
- **Key exports used across the monorepo:**
  - `ProjectionInput` — the canonical wizard-to-engine contract; consumed by `api/services/projection-transformer.ts` and `calculation-engine/src/projection/multi-year.ts`
  - `ProjectionYearRow` — 47-field flat table row consumed by `web/src/components/projection/YearByYearTab.tsx`
  - `ScenarioDecisionsSchema` / `ScenarioDecisions` — profile scenario override layer consumed by `api/services/scenario-decisions.ts` and `calculation-engine/src/projection/`
  - `TaxCalculation` — engine output type consumed by `PersonYearlyResult` and UI display components
  - `FEDERAL_TAX_2024/2025/2026`, `getProvincialTaxTables()` — consumed by `calculation-engine/src/tax/`
  - `RRIF_MINIMUM_RATES`, `getRRIFMinimumRate()` — consumed by `calculation-engine/src/accounts/rrif.ts`
  - `AGE_MILESTONES` — consumed by engine and UI for age-triggered rule events
  - All Zod schemas (`projectionInputSchema`, `registerInputSchema`, etc.) — consumed by `api/src/middleware/validation.ts` and route handlers
  - `ProvinceCode`, `PROVINCES`, `PROVINCE_CODES` — consumed across all packages
- **External npm deps:** `zod` only (peer dep in all consuming packages)

---

## Package: @retireops/calculation-engine

Root: `packages/calculation-engine/src/`

Pure TypeScript computation core. No I/O, no database, no HTTP calls. Depends only on `@retireops/shared`. Entry point: `runProjection()` in `projection/multi-year.ts`.

---

### tax/

### `packages/calculation-engine/src/tax/index.ts`

- **Purpose:** Barrel that re-exports everything from all tax sub-modules.
- **Inputs:** None — re-export only.
- **Outputs:** Re-exports from `federal-tax.js`, `provincial-tax.js`, `capital-gains.js`, `dividends.js`, `credits.js`, `oas-clawback.js`. Also exports `calculateTotalTax()` and `TaxCalculationInput` (defined inline in this barrel).
- **Dependencies:** Internal: all tax sub-modules. External: none.
- **Hardcoded constants:** none.
- **Notes:** `calculateTotalTax()` is the primary integration point called by `yearly-calculator.ts`. See `@see docs/source-of-truth/04-tax-engine.md`.

### `packages/calculation-engine/src/tax/federal-tax.ts`

- **Purpose:** Calculates federal income tax using bracket rates, applies non-refundable credits (BPA, age credit, pension income credit), and applies Quebec abatement.
- **Inputs:** `taxableIncome: number`, `age: number`, `netIncome: number`, `eligiblePensionIncome: number`, `year: number`, `isQuebec?: boolean`. Reads `FEDERAL_TAX_2024/2025/2026`, `AGE_CREDIT_2024`, `PENSION_INCOME_CREDIT_2024` from `@retireops/shared`.
- **Outputs:** `calculateBracketTax(taxableIncome, brackets)`, `getFederalTaxBrackets(year)`, `getFederalBasicPersonalAmount(year)`, `calculateFederalTaxBeforeCredits(taxableIncome, year)`, `calculateBasicPersonalAmountCredit(year)`, `calculateFederalAgeCredit(age, netIncome, year)`, `calculateFederalPensionIncomeCredit(eligiblePensionIncome, year)`, `calculateFederalNonRefundableCredits(age, netIncome, eligiblePensionIncome, year)`, `calculateFederalTax(taxableIncome, age, netIncome, eligiblePensionIncome, year, isQuebec?)`, `getFederalMarginalRate(taxableIncome, year)`.
- **Dependencies:** Internal: none. External: `@retireops/shared` (tax tables, credit params).
- **Hardcoded constants:** BPA fallback `15705` for year < 2024. Quebec abatement `0.165` (16.5%). Age credit threshold is age `65`. `getFederalNonRefundableCreditRate` defaults to `0.15` if bracket not found.
- **Notes:** `getFederalTaxBrackets` falls back to `FEDERAL_TAX_2024` for years before 2024. Age credit uses `AGE_CREDIT_2024.federal` params — income-tested with reduction rate. See `@see docs/source-of-truth/04-tax-engine.md`.

### `packages/calculation-engine/src/tax/provincial-tax.ts`

- **Purpose:** Calculates provincial income tax using province-specific brackets, applies non-refundable provincial credits, and handles Ontario surtax.
- **Inputs:** `taxableIncome: number`, `province: ProvinceCode`, `year: number`, `age: number`, `netIncome: number`, `eligiblePensionIncome: number`. Reads `getProvincialTaxTables()`, `ONTARIO_SURTAX`, `AGE_CREDIT_2024`, `PENSION_INCOME_CREDIT_2024` from `@retireops/shared`.
- **Outputs:** `getProvincialTaxBrackets(province, year)`, `getProvincialBasicPersonalAmount(province, year)`, `getProvincialCreditRate(province)`, `calculateProvincialTaxBeforeCredits(taxableIncome, province, year)`, `calculateOntarioSurtax(provincialTax)`, `calculateProvincialBPACredit(province, year)`, `calculateProvincialAgeCredit(age, netIncome, province, year)`, `calculateProvincialPensionCredit(eligiblePensionIncome, province, year)`, `calculateProvincialNonRefundableCredits(age, netIncome, eligiblePensionIncome, province, year)`, `calculateProvincialTax(taxableIncome, age, netIncome, eligiblePensionIncome, province, year)`, `getProvincialMarginalRate(taxableIncome, province, year)`, `getCombinedMarginalRate(taxableIncome, province, year)`.
- **Dependencies:** Internal: `federal-tax.js` (getFederalMarginalRate). External: `@retireops/shared`.
- **Hardcoded constants:** `getProvincialCreditRate` uses year `2024` hardcoded for rate lookup. Ontario surtax thresholds come from `ONTARIO_SURTAX` constant. Fallback pension credit max `1000` for provinces without specific params. Approximate provincial age credit `× 0.7` factor for provinces without specific `AGE_CREDIT_2024` entry.
- **Notes:** **Pitfall:** throws `Error('Tax table not found for province: ...')` when province code is not in `getProvincialTaxTables(year)` — callers must pass a valid `ProvinceCode`. Ontario surtax applied post-credits (two tiers). See `@see docs/source-of-truth/04-tax-engine.md`.

### `packages/calculation-engine/src/tax/capital-gains.ts`

- **Purpose:** Calculates taxable capital gains using the 50% standard inclusion rate and the enhanced 66.7% rate for gains over the $250,000 per-person annual threshold. Also processes full withdrawal transactions for non-registered accounts (ACB tracking, unrealized gains).
- **Inputs:** `capitalGain: number`, `annualGains?: number`, `withdrawalAmount: number`, `accountBalance: number`, `adjustedCostBase: number`, `unrealizedGains: number`, `annualCapitalGainsToDate?: number`. Reads `CAPITAL_GAINS_RATES` from `@retireops/shared`.
- **Outputs:** `calculateTaxableCapitalGain(capitalGain)`, `calculateTaxableCapitalGainEnhanced(capitalGain, annualGains?)`, `calculateCapitalGainOnSale(proceeds, adjustedCostBase)`, `calculateRealizedGainOnWithdrawal(withdrawalAmount, accountBalance, unrealizedGains)`, `calculateNewACBAfterWithdrawal(withdrawalAmount, accountBalance, adjustedCostBase)`, `processNonRegWithdrawal(withdrawalAmount, accountBalance, adjustedCostBase, unrealizedGains, annualCapitalGainsToDate?)` → `CapitalGainsResult`. Exports interface `CapitalGainsResult`.
- **Dependencies:** Internal: none. External: `@retireops/shared` (CAPITAL_GAINS_RATES).
- **Hardcoded constants:** Standard inclusion rate `0.50` (50%) — via `CAPITAL_GAINS_RATES.standardInclusionRate`. Enhanced threshold `250000` — via `CAPITAL_GAINS_RATES.enhancedThreshold`. Enhanced inclusion rate `CAPITAL_GAINS_RATES.enhancedInclusionRate` (66.7%).
- **Notes:** `calculateTaxableCapitalGainEnhanced` uses cumulative `annualGains` parameter (D-08/D-10) for correct per-person $250K threshold tracking across multiple accounts. Default `annualGains = capitalGain` handles single-transaction case. See `@see docs/source-of-truth/04-tax-engine.md` — Enhanced rate for gains over $250,000.

### `packages/calculation-engine/src/tax/dividends.ts`

- **Purpose:** Calculates eligible and non-eligible dividend gross-up amounts plus federal and provincial dividend tax credits.
- **Inputs:** `eligibleDividends: number`, `nonEligibleDividends: number`, `province: ProvinceCode`, `year: number`, `combinedMarginalRate: number`. Reads `DIVIDEND_RATES`, `getProvincialTaxTables()` from `@retireops/shared`.
- **Outputs:** `grossUpEligibleDividend(actualDividend)`, `grossUpNonEligibleDividend(actualDividend)`, `calculateEligibleDividendCredit(grossedUpDividend)`, `calculateNonEligibleDividendCredit(grossedUpDividend)`, `calculateTaxableDividendIncome(eligibleDividends, nonEligibleDividends)`, `calculateTotalDividendTaxCredits(eligibleDividends, nonEligibleDividends)`, `calculateProvincialDividendCredit(eligibleDividends, nonEligibleDividends, province, year)`, `calculateDividendTaxImpact(eligibleDividends, nonEligibleDividends, combinedMarginalRate)` → `DividendTaxResult`. Exports interface `DividendTaxResult`.
- **Dependencies:** Internal: none. External: `@retireops/shared` (DIVIDEND_RATES, getProvincialTaxTables).
- **Hardcoded constants:** Gross-up rates and credit rates from `DIVIDEND_RATES` constant in shared. Provincial rates fetched from `getProvincialTaxTables()` — `eligibleDividendCreditRate` and `nonEligibleDividendCreditRate` fields (optional, default `0`).
- **Notes:** Provincial dividend credit returns `0` if province table not found. See `@see docs/source-of-truth/04-tax-engine.md - Dividend Tax Treatment`.

### `packages/calculation-engine/src/tax/credits.ts`

- **Purpose:** Implements additional tax credits not covered in federal/provincial modules: BC renters' credit, Ontario seniors transit credit, spouse/partner amount, disability tax credit, medical expenses, charitable donations, Canada caregiver, home accessibility, Canada employment, and Climate Action Incentive.
- **Inputs:** Per-credit param interfaces (`BCRentersCreditParams`, `OntarioSeniorsTransitCreditParams`, `SpouseAmountParams`, `DisabilityTaxCreditParams`, `MedicalExpensesParams`, `CharitableDonationsParams`, `CaregiverCreditParams`, `HomeAccessibilityParams`, `ComprehensiveTaxCreditsInput`). `province: ProvinceCode`.
- **Outputs:** `calculateBCRentersCredit()`, `calculateOntarioSeniorsTransitTaxCredit()`, `calculateSpouseAmountCredit()`, `calculateDisabilityTaxCredit()`, `calculateMedicalExpensesCredit()`, `calculateCharitableDonationsCredit()`, `calculateCaregiverCredit()`, `calculateHomeAccessibilityCredit()`, `calculateEmploymentCredit()`, `calculateClimateActionIncentive()`, `calculateComprehensiveTaxCredits()` → `ComprehensiveTaxCreditsResult`. Exports multiple param/result interfaces.
- **Dependencies:** Internal: none. External: `@retireops/shared` (ProvinceCode type only).
- **Hardcoded constants:** BC renters credit: `maxCredit: 400`, thresholds `63000/83000` (2024), `64764/84764` (2025), `66189/86189` (2026), taper `0.02`. Ontario seniors transit: age `66+`, max eligible expenses `3000`, credit rate `0.15`. Spouse amount: federal `15705`, ON `12399`, BC `12580`, AB `21003`. Disability: federal amount `9428`, supplement `5500` under 18, ON `9586`, BC `9428`, AB `16635`. Medical: threshold `min(3% × netIncome, 2759)`. Donations: first `200` at `0.15`, excess at `0.29` (or `0.33` if income > `246752`). Caregiver: base `7999`, enhanced `2499`, threshold `18783`. Home accessibility: max eligible `20000`, rate `0.15`. Employment amount: max `1433`, rate `0.15`. CAI base amounts by province (AB: `450`, SK: `376`, MB: `300`, ON: `280`, etc.), spouse `0.5×`, child `0.25×`, rural `1.2×`.
- **Notes:** `calculateComprehensiveTaxCredits` uses some hardcoded BPA fallbacks (`15705` federal, province lookup table with `12000` default). None of these credits are wired into the active `calculatePersonYear()` loop — they exist as standalone utilities. See `@see docs/source-of-truth/04-tax-engine.md - Tax Credits Detail`.

### `packages/calculation-engine/src/tax/oas-clawback.ts`

- **Purpose:** Calculates OAS recovery tax (clawback) based on net income relative to the annual threshold; provides planning utilities for clawback avoidance.
- **Inputs:** `netIncome: number`, `oasAmount: number`, `year: number`, `age: number`. Reads `OAS_CLAWBACK_THRESHOLDS`, `OAS_RATES` from `@retireops/shared`.
- **Outputs:** `getOASClawbackThreshold(year)`, `getOASFullClawbackThreshold(year, age)`, `calculateOASClawback(netIncome, oasAmount, year)`, `calculateNetOAS(grossOAS, netIncome, year)`, `isOASFullyClawedBack(netIncome, year, age)`, `incomeForTargetClawback(targetClawback, year)`, `maxIncomeToAvoidClawback(year)`.
- **Dependencies:** Internal: none. External: `@retireops/shared` (OAS_CLAWBACK_THRESHOLDS, OAS_RATES).
- **Hardcoded constants:** Clawback rate `0.15` (15%) — via `OAS_RATES.clawbackRate`. Age 75+ uses `fullClawbackAge75Plus` threshold. Year lookup uses latest-known-year fallback when `year > max known year`.
- **Notes:** Net OAS floored at `0` — clawback cannot exceed gross OAS amount. `getOASClawbackThresholdSet` searches for the latest known year ≤ requested year. See `@see docs/source-of-truth/04-tax-engine.md - OAS Clawback` and `@see docs/source-of-truth/05-government-benefits.md - TC-GOV-004`.

---

### benefits/

### `packages/calculation-engine/src/benefits/index.ts`

- **Purpose:** Barrel that re-exports everything from cpp, oas, and gis modules. Also exports `calculateGovernmentBenefits()` — the integration function called by `yearly-calculator.ts`.
- **Inputs:** None — re-export only (plus `calculateGovernmentBenefits` defined inline).
- **Outputs:** Re-exports from `cpp.js`, `oas.js`, `gis.js`. Exports `calculateGovernmentBenefits()`.
- **Dependencies:** Internal: all benefits sub-modules. External: none.
- **Hardcoded constants:** none.
- **Notes:** See `@see docs/source-of-truth/05-government-benefits.md`.

### `packages/calculation-engine/src/benefits/cpp.ts`

- **Purpose:** Calculates CPP/QPP benefit amounts including early/late start adjustments, inflation indexing, survivor benefits, and combined own+survivor CPP with cap enforcement.
- **Inputs:** `startAge: number`, `expectedAmountAt65: number`, `inflationRate: number`, `years: number`, `deceasedBenefitAmount: number`, `maxCPPAmount?: number`. Reads `CPP_ADJUSTMENT_FACTORS`, `BENEFIT_AMOUNTS_2024` from `@retireops/shared`.
- **Outputs:** `calculateCPPAdjustmentFactor(startAge)`, `calculateCPPBenefit(expectedAmountAt65, startAge)`, `indexCPPBenefit(baseAmount, inflationRate, years)`, `calculateCPPSurvivorBenefit(deceasedBenefitAmount, maxCPPAmount?)`, `calculateCombinedCPP(ownBenefit, survivorBenefit, maxCPPAmount?)`, `getCPPAdjustmentTable(expectedAmountAt65)`, `calculateCPPBreakEvenAge(expectedAmountAt65, earlyAge, laterAge)`, `estimateCPPAt65(percentageOfMax, year?)`, `isEligibleForCPP(age)`, `isMaxDeferral(startAge)`.
- **Dependencies:** Internal: none. External: `@retireops/shared` (CPP_ADJUSTMENT_FACTORS, BENEFIT_AMOUNTS_2024).
- **Hardcoded constants:** Early reduction: `0.006`/month (6 × 12 = 72 months max = 36% reduction at age 60). Late increase: `0.007`/month (5 × 12 = 60 months max = 42% increase at age 70). CPP age range `[60, 70]` — throws `Error` if `startAge < 60` or `startAge > 70`. Survivor fraction: `0.6` (60% of deceased's CPP). Max CPP defaults to `BENEFIT_AMOUNTS_2024.cpp.maxAnnualAt65`.
- **Notes:** `calculateCPPAdjustmentFactor` is the only throwing function in this file. `estimateCPPAt65` has a TODO for historical year support. See `@see docs/source-of-truth/05-government-benefits.md - CPP/QPP Section`.

### `packages/calculation-engine/src/benefits/oas.ts`

- **Purpose:** Calculates OAS benefit amounts based on residency factor, deferral factor, and age-75 bonus; provides planning utilities for deferral decision.
- **Inputs:** `yearsOfResidence: number`, `startAge: number`, `currentAge: number`, `year?: number`. Reads `OAS_ADJUSTMENT_FACTORS`, `OAS_RATES`, `OAS_BENEFIT_AMOUNTS` from `@retireops/shared`.
- **Outputs:** `calculateOASResidencyFactor(yearsOfResidence)`, `calculateOASDeferralFactor(startAge)`, `calculateAge75Bonus(currentAge)`, `calculateOASEntitlement(yearsOfResidence, year?, age?)`, `calculateOASBenefit(yearsOfResidence, startAge, currentAge, year?)`, `indexOASBenefit(baseAmount, inflationRate, years)`, `getOASDeferralTable(yearsOfResidence, year?)`, `calculateOASBreakEvenAge(yearsOfResidence, earlyAge?, laterAge?)`, `isEligibleForOAS(age, yearsOfResidence)`, `isReceivingOAS(currentAge, oasStartAge)`.
- **Dependencies:** Internal: none. External: `@retireops/shared` (OAS_ADJUSTMENT_FACTORS, OAS_RATES, OAS_BENEFIT_AMOUNTS).
- **Hardcoded constants:** Age-75 bonus: `0.10` (10%) — via `OAS_RATES.age75Bonus`. Deferral increase: `0.006`/month — via `OAS_ADJUSTMENT_FACTORS.DEFERRAL_INCREASE_PER_MONTH`. Maximum deferral: 60 months × 0.006 = `0.36` (36% increase at age 70). Full residency: `40` years — via `OAS_ADJUSTMENT_FACTORS.FULL_RESIDENCY_YEARS`. Minimum residency: `10` years. OAS benefit amounts from `OAS_BENEFIT_AMOUNTS` (year-keyed with latest-year fallback). `calculateOASDeferralFactor` throws if `startAge < 65`.
- **Notes:** `calculateOASEntitlement` selects `maxAnnualAge75Plus` vs `maxAnnualAge65To74` based on `currentAge >= 75`. Year lookup uses latest-known-year fallback. See `@see docs/source-of-truth/05-government-benefits.md - OAS Section`.

### `packages/calculation-engine/src/benefits/gis.ts`

- **Purpose:** Calculates GIS (Guaranteed Income Supplement) eligibility and benefit amount based on marital status, OAS receipt, and income relative to threshold.
- **Inputs:** `maritalStatus: MaritalStatus`, `spouseReceivingOAS?: boolean`, `age: number`, `receivingOAS: boolean`, `totalIncome: number`, `oasIncome: number`, `employmentIncome: number`. Reads `BENEFIT_AMOUNTS_2024` from `@retireops/shared`.
- **Outputs:** `getGISIncomeThreshold(maritalStatus, spouseReceivingOAS?)`, `getMaxGISAmount(maritalStatus)`, `calculateGISIncome(totalIncome, oasIncome, employmentIncome)`, `isEligibleForGIS(age, receivingOAS, gisIncome, maritalStatus, spouseReceivingOAS?)`, `calculateGISBenefit(gisIncome, maritalStatus, spouseReceivingOAS?)`, `calculateGIS(age, receivingOAS, totalIncome, oasIncome, employmentIncome, maritalStatus, spouseReceivingOAS?)` → `GISCalculationResult`. Exports interface `GISCalculationResult`.
- **Dependencies:** Internal: none. External: `@retireops/shared` (BENEFIT_AMOUNTS_2024, MaritalStatus).
- **Hardcoded constants:** GIS income thresholds: `single = BENEFIT_AMOUNTS_2024.gis.incomeThresholdSingle` (= `$21,624`), `married-both-OAS = BENEFIT_AMOUNTS_2024.gis.incomeThresholdMarriedBoth` (= `$28,560`), `married-spouse-not-OAS = BENEFIT_AMOUNTS_2024.gis.incomeThresholdMarriedOneOAS` (= `$51,840`). Clawback rate: `0.50` (50% of income). Employment exemption: first `$5,000` excluded from GIS income. Must be receiving OAS and age `65+`.
- **Notes:** All GIS thresholds are sourced from `BENEFIT_AMOUNTS_2024.gis` in `@retireops/shared` (feature 4.1 removed the prior `$51,840` literal). See `@see docs/source-of-truth/05-government-benefits.md - GIS Section`.

---

### accounts/

### `packages/calculation-engine/src/accounts/index.ts`

- **Purpose:** Barrel that re-exports everything from RRSP, RRIF, TFSA, non-registered, LIRA, and LIF modules. Also exports `applyGrowth()` helper used by `yearly-calculator.ts`.
- **Inputs:** None — re-export only.
- **Outputs:** Re-exports from all account sub-modules. Exports `applyGrowth()`.
- **Dependencies:** Internal: all account sub-modules. External: none.
- **Hardcoded constants:** none.
- **Notes:** See `@see docs/source-of-truth/02-account-types.md`.

### `packages/calculation-engine/src/accounts/rrsp.ts`

- **Purpose:** Calculates RRSP contribution room (18% of prior-year earned income + carry-forward), validates age eligibility, checks conversion deadline, and processes contributions with tax benefit.
- **Inputs:** `earnedIncome: number`, `previousUnusedRoom: number`, `year: number`, `age: number`, `contribution: number`, `availableRoom: number`, `marginalTaxRate: number`. Reads `RRSP_LIMITS`, `AGE_MILESTONES` from `@retireops/shared`.
- **Outputs:** `getRRSPAnnualLimit(year)`, `calculateRRSPContributionRoom(earnedIncome, previousUnusedRoom, year)`, `canContributeToRRSP(age)`, `mustConvertRRSPToRRIF(age)`, `getRRSPWithholdingTaxRate(withdrawalAmount, isQuebec?)`, `calculateRRSPWithholdingTax(withdrawalAmount, isQuebec?)`, `validateRRSPContribution(contribution, availableRoom, age)` → `{valid, error?}`, `calculateRRSPTaxBenefit(contribution, marginalTaxRate)`, `processRRSPContribution(currentBalance, contribution, availableRoom, marginalTaxRate)` → `RRSPContributionResult`. Exports `RRSPContributionResult`.
- **Dependencies:** Internal: none. External: `@retireops/shared` (RRSP_LIMITS, AGE_MILESTONES).
- **Hardcoded constants:** Earned income rate `0.18` (18%) — via `RRSP_LIMITS[year].earnedIncomeRate`. Contribution deadline age `71` — via `AGE_MILESTONES.RRSP_CONTRIBUTION_DEADLINE_AGE`. Conversion age `71` — via `AGE_MILESTONES.RRSP_TO_RRIF_CONVERSION_AGE`. `getRRSPAnnualLimit` defaults to `RRSP_LIMITS[2025]` for unknown years. Withholding tax (non-Quebec): `0.10` (≤$5K), `0.20` (≤$15K), `0.30` (>$15K). Withholding tax (Quebec): `0.05`, `0.10`, `0.15`.
- **Notes:** `calculateRRSPContributionRoom` takes prior-year earned income (not current year). See `@see docs/source-of-truth/02-account-types.md - RRSP-002`.

### `packages/calculation-engine/src/accounts/rrif.ts`

- **Purpose:** Calculates RRIF minimum withdrawal amounts using CRA-published rates, enforces minimum at age 72+, supports younger-spouse election, and provides RRSP-to-RRIF conversion result.
- **Inputs:** `balance: number`, `age: number`, `ownerAge: number`, `spouseAge: number`, `requestedWithdrawal: number`, `conversionYear: number`. Reads `getRRIFMinimumRate()` from `@retireops/shared`.
- **Outputs:** `calculateRRIFMinimumWithdrawal(balance, age)`, `calculateRRIFMinimumWithYoungerSpouse(balance, ownerAge, spouseAge)`, `isRRIFMinimumRequired(age)`, `getRRIFMinimumRateForAge(age)` (returns rate as percentage), `convertRRSPToRRIF(rrspBalance, conversionYear)` → `RRIFConversionResult`, `processRRIFWithdrawal(balance, age, requestedWithdrawal, useYoungerSpouseAge?, spouseAge?)` → `RRIFWithdrawalResult`, `projectRRIFBalance(...)`. Exports `RRIFConversionResult`, `RRIFWithdrawalResult`.
- **Dependencies:** Internal: none. External: `@retireops/shared` (getRRIFMinimumRate).
- **Hardcoded constants:** Minimum required age `72` — hardcoded literal in `isRRIFMinimumRequired(age)` and `processRRIFWithdrawal`. First withdrawal year = `conversionYear + 1`. RRIF withdrawal is `100%` taxable.
- **Notes:** `calculateRRIFMinimumWithYoungerSpouse` uses `Math.min(ownerAge, spouseAge)` — CRA allows using the younger spouse's age for a lower minimum. See `@see docs/source-of-truth/02-account-types.md - RRIF-002, RRIF-005`.

### `packages/calculation-engine/src/accounts/tfsa.ts`

- **Purpose:** Calculates TFSA contribution room (annual limit + previous year withdrawals + carried forward), validates contributions, and processes tax-free deposits and withdrawals with room restoration logic.
- **Inputs:** `year: number`, `previousRoom: number`, `withdrawalsLastYear: number`, `contribution: number`, `availableRoom: number`, `age: number`, `currentBalance: number`, `withdrawalAmount: number`. Reads `TFSA_ANNUAL_LIMITS`, `TFSA_CUMULATIVE_LIMITS` from `@retireops/shared`.
- **Outputs:** `getTFSAAnnualLimit(year)`, `getTFSACumulativeLimit(year)`, `calculateTFSAContributionRoom(previousRoom, withdrawalsLastYear, year)`, `isValidTFSAContribution(contribution, availableRoom)`, `isEligibleForTFSA(age)`, `calculateTFSAWithdrawalTax()` (always `0`), `tfsaAffectsOASClawback()` (always `false`), `processTFSAContribution(currentBalance, contribution, availableRoom, age)` → `TFSAContributionResult`, `processTFSAWithdrawal(currentBalance, withdrawalAmount)` → `TFSAWithdrawalResult`, `projectTFSABalance(...)`. Exports `TFSAContributionResult`, `TFSAWithdrawalResult`.
- **Dependencies:** Internal: none. External: `@retireops/shared` (TFSA_ANNUAL_LIMITS, TFSA_CUMULATIVE_LIMITS).
- **Hardcoded constants:** Annual limit fallback `7000` (default for unknown years via `TFSA_ANNUAL_LIMITS[year] ?? 7000`). Cumulative limits `95000` (2024) and `102000` (2025) as fallbacks. Eligibility age `18`. TFSA withdrawals restore room in the FOLLOWING year (`roomRestoredNextYear = actualWithdrawal`). TFSA withdrawals are `100%` tax-free (`taxableAmount: 0`).
- **Notes:** `getTFSACumulativeLimit` calculates historical cumulative by summing annual limits from 2009. See `@see docs/source-of-truth/02-account-types.md - TFSA-001 through TFSA-010`.

### `packages/calculation-engine/src/accounts/non-registered.ts`

- **Purpose:** Manages non-registered account income allocation (interest/dividends/capital gains), applies investment growth with ACB tracking, and delegates withdrawal capital gains to `capital-gains.ts`.
- **Inputs:** `investmentReturn: number`, `balance: number`, `allocation?: IncomeAllocation`, `currentACB: number`, `contribution: number`, `withdrawalAmount: number`, `accountBalance: number`, `adjustedCostBase: number`, `unrealizedGains: number`, `annualCapitalGainsToDate?: number`. Reads `processNonRegWithdrawal` from `capital-gains.js`.
- **Outputs:** `calculateAnnualTaxableIncome(investmentReturn, balance, allocation?)`, `calculateNewACB(currentACB, purchaseAmount)`, `processNonRegContribution(currentBalance, currentACB, contribution)` → `NonRegContributionResult`, `applyNonRegGrowth(balance, acb, investmentReturn, allocation?)` → `NonRegGrowthResult`, `processNonRegisteredWithdrawal(withdrawalAmount, accountBalance, adjustedCostBase, unrealizedGains, annualCapitalGainsToDate?)` → `CapitalGainsResult`, `calculateAfterTaxValue(balance, acb, marginalCapitalGainsRate)`. Exports `IncomeAllocation`, `NonRegContributionResult`, `NonRegGrowthResult`.
- **Dependencies:** Internal: `capital-gains.js` (processNonRegWithdrawal, CapitalGainsResult). External: none.
- **Hardcoded constants:** `DEFAULT_INCOME_ALLOCATION`: `interestPct: 0.3`, `canadianDividendPct: 0.2`, `capitalGainsPct: 0.5`. `calculateAfterTaxValue` uses `0.5` (50%) inclusion rate directly for simplicity. Canadian dividend effective tax: `marginalTaxRate × 0.7` approximation in `calculateNonRegGrowth`.
- **Notes:** `processNonRegisteredWithdrawal` is a thin wrapper over `processNonRegWithdrawal` from capital-gains. ACB tracking in the projection loop is simplified — proportional reduction on withdrawal. See `@see docs/source-of-truth/02-account-types.md - TC-ACCT-005`.

### `packages/calculation-engine/src/accounts/lira.ts`

- **Purpose:** Models LIRA (Locked-In Retirement Account) lifecycle: voluntary conversion to LIF, mandatory conversion at age 71, one-time unlocking, small-balance unlocking, and financial hardship provisions.
- **Inputs:** `age: number`, `jurisdiction: LIFJurisdiction`, `balance: number`, `year: number`, `applyOneTimeUnlock?: boolean`, `hasUsedOneTimeUnlock?: boolean`. Reads `getLIFRules()`, `MANDATORY_LIF_CONVERSION_AGE` from `@retireops/shared`.
- **Outputs:** `canConvertLIRAToLIF(age, jurisdiction)`, `mustConvertLIRAToLIF(age)`, `getMinimumConversionAge(jurisdiction)`, `convertLIRAToLIF(balance, year, jurisdiction, applyOneTimeUnlock?)` → `LIRAToLIFConversionResult`, `canUseOneTimeUnlock(jurisdiction, hasUsedOneTimeUnlock)`, `calculateOneTimeUnlockAmount(balance, jurisdiction, hasUsedOneTimeUnlock)` → `OneTimeUnlockResult`, `canUseSmallBalanceUnlock(balance, jurisdiction)`, `getSmallBalanceThreshold(jurisdiction)`, `allowsFinancialHardshipUnlock(jurisdiction)`, `allowsShortenedLifeUnlock(jurisdiction)`, `yearsUntilMandatoryConversion(currentAge)`, `shouldAutoConvertLIRA(age, balance)`. Exports `LIRAToLIFConversionResult`, `OneTimeUnlockResult`.
- **Dependencies:** Internal: none. External: `@retireops/shared` (LIFJurisdiction, getLIFRules, MANDATORY_LIF_CONVERSION_AGE = 71).
- **Hardcoded constants:** Mandatory conversion age `71` — via `MANDATORY_LIF_CONVERSION_AGE` (from shared). Minimum voluntary conversion age varies by jurisdiction — from `getLIFRules(jurisdiction).minimumConversionAge`. First withdrawal year = `conversionYear + 1`.
- **Notes:** `shouldAutoConvertLIRA` is called by `yearly-calculator.ts` to trigger automatic conversion. One-time unlock percentage varies by jurisdiction via `getLIFRules`. See `@see docs/source-of-truth/02-account-types.md - LIRA-001, LIRA-002, LIRA-003`.

### `packages/calculation-engine/src/accounts/lif.ts`

- **Purpose:** Calculates LIF (Life Income Fund) minimum and maximum withdrawal limits using the CANSIM formula, enforces withdrawal constraints, and provides projection utilities.
- **Inputs:** `balance: number`, `age: number`, `jurisdiction: LIFJurisdiction`, `requestedWithdrawal: number`, `useYoungerSpouseAge?: boolean`, `spouseAge?: number`, `previousYearReturnRate?: number`. Reads `getLIFRules()`, `getLIFMaximumRate()`, `getRRIFMinimumRate()` from `@retireops/shared`.
- **Outputs:** `calculateLIFMinimumWithdrawal(balance, age)`, `calculateLIFMinimumWithYoungerSpouse(balance, ownerAge, spouseAge)`, `calculateLIFMaximumWithdrawal(balance, age, jurisdiction, referenceRate?, previousYearReturnRate?)`, `getLIFWithdrawalLimits(balance, age, jurisdiction, useYoungerSpouseAge?, spouseAge?, previousYearReturnRate?)` → `LIFWithdrawalLimits`, `processLIFWithdrawal(...)` → `LIFWithdrawalResult`, `isLIFMinimumRequired(age)`, `projectLIFBalance(...)`, `calculateTotalLIFIncome(projections)`, `suggestOptimalLIFWithdrawal(...)`, `getLIFMaximumRateForAge(age, jurisdiction)`, `getLIFMinimumRateForAge(age)`. Exports `LIFWithdrawalLimits`, `LIFWithdrawalResult`, `LIFProjectionEntry`.
- **Dependencies:** Internal: none. External: `@retireops/shared` (LIFJurisdiction, getLIFRules, getLIFMaximumRate, getRRIFMinimumRate).
- **Hardcoded constants:** LIF minimum required at age `72` (same as RRIF). Maximum rate uses CANSIM formula: `r / (1 - (1+r)^-n)` where `r` is `rules.referenceRate` (federal default `0.06`) and `n = targetAge - age` (federal target age `90`). ON, BC, NL use `max(statutoryRate, previousYearReturnRate)` for maximum. LIF withdrawal is `100%` taxable.
- **Notes:** Minimum LIF withdrawal delegates to `getRRIFMinimumRate()` — same CRA table as RRIF. Maximum withdrawal uses jurisdiction-specific reference rate from `shared/constants/lif-rates.ts`. See `@see docs/source-of-truth/02-account-types.md - LIF-001 through LIF-005`.

---

### investments/

### `packages/calculation-engine/src/investments/index.ts`

- **Purpose:** Barrel that re-exports everything from growth, inflation, returns, glide-path, and monte-carlo modules.
- **Inputs:** None — re-export only.
- **Outputs:** Re-exports from `growth.js`, `inflation.js`, `returns.js`, `glide-path.js`, `monte-carlo.js`.
- **Dependencies:** Internal: all investment sub-modules. External: none.
- **Hardcoded constants:** none.
- **Notes:** See `@see docs/source-of-truth/06-investment-engine.md`.

### `packages/calculation-engine/src/investments/growth.ts`

- **Purpose:** Calculates end-of-year account balances with contributions/withdrawals, projects portfolio growth across all account types, and models non-registered account growth with tax drag.
- **Inputs:** `startBalance: number`, `contributions: number`, `withdrawals: number`, `annualReturn: number`, `allocation?: NonRegIncomeAllocation`, `marginalTaxRate?: number`, `unrealizedGains?: number`. Reads `DEFAULT_NON_REG_ALLOCATION` from `returns.js`.
- **Outputs:** `calculateEndBalance(startBalance, contributions, withdrawals, annualReturn)`, `calculateEndBalanceMidYear(startBalance, contributions, withdrawals, annualReturn)`, `projectBalances(startBalance, annualContribution, annualReturn, years)`, `futureValueWithContributions(presentValue, periodicContribution, rate, periods)`, `calculateAccountGrowth(startBalance, contributions, withdrawals, returnRate)` → `AccountGrowthResult`, `calculateNonRegGrowth(...)` → `NonRegInvestmentGrowthResult`, `calculatePortfolioGrowth(input)` → `PortfolioGrowthResult`. Exports interfaces `AccountGrowthResult`, `NonRegInvestmentGrowthResult`, `PortfolioGrowthInput`, `PortfolioGrowthResult`.
- **Dependencies:** Internal: `returns.js` (NonRegIncomeAllocation, DEFAULT_NON_REG_ALLOCATION). External: none.
- **Hardcoded constants:** `calculateNonRegGrowth`: Canadian dividend effective rate `marginalTaxRate × 0.7` (approximation). End-balance formula: `(start + contributions - withdrawals) × (1 + return)`.
- **Notes:** `calculateEndBalance` uses end-of-year convention. `calculateEndBalanceMidYear` is more accurate for periodic cash flows but not currently used in the main projection loop. See `@see docs/source-of-truth/06-investment-engine.md - Deterministic Projection Model`.

### `packages/calculation-engine/src/investments/inflation.ts`

- **Purpose:** Provides nominal/real dollar conversions, partial indexing, purchasing power calculations, and expense projection with inflation.
- **Inputs:** `nominalValue: number`, `realValue: number`, `inflationRate: number`, `years: number`, `indexingRate: number`.
- **Outputs:** `nominalToReal(nominalValue, inflationRate, years)`, `realToNominal(realValue, inflationRate, years)`, `applyInflation(value, inflationRate, years?)`, `purchasingPowerRetained(inflationRate, years)`, `cumulativeInflation(inflationRate, years)`, `applyPartialIndexing(value, inflationRate, indexingRate)`, `projectIndexedBenefit(baseAmount, inflationRate, indexingRate, years)`, `projectExpenses(baseExpenses, inflationRate, years, indexingRate?)`, `requiredNominalReturn(targetRealReturn, inflationRate)`, `impliedInflationRate(nominalReturn, realReturn)`. Exports `InflationIndexedItem`, `InflationIndexingConfig`, `DEFAULT_INFLATION_INDEXING`.
- **Dependencies:** Internal: none. External: none.
- **Hardcoded constants:** `DEFAULT_INFLATION_INDEXING`: `governmentBenefits: 1.0`, `dbPension: 0.5`, `expenses: 1.0`, `taxBrackets: 1.0`. `applyInflation` defaults `years = 1`.
- **Notes:** `impliedInflationRate` uses Fisher equation. `DEFAULT_INFLATION_INDEXING.dbPension = 0.5` (50% CPI indexing) is a conservative default assumption. See `@see docs/source-of-truth/06-investment-engine.md - Inflation Handling`.

### `packages/calculation-engine/src/investments/returns.ts`

- **Purpose:** Defines risk profile investment parameters, non-registered income allocation, and provides Fisher equation utilities for nominal/real return conversions.
- **Inputs:** `profile: RiskProfile`, `nominalReturn?: number`, `inflationRate?: number`, `equityAllocation?: number`.
- **Outputs:** `RISK_PROFILES` (constant with 4 profiles), `DEFAULT_NON_REG_ALLOCATION` (constant), `nominalToRealReturn(nominalReturn, inflationRate)`, `realToNominalReturn(realReturn, inflationRate)`, `getRiskProfileParameters(profile)`, `calculateBlendedReturn(accounts)`, `calculateAllocationReturn(equityAllocation, equityReturn?, fixedReturn?)`, `createDefaultAssumptions(nominalReturn?, inflationRate?)`, `createAssumptionsFromProfile(profile, inflationRate?)`. Exports `RiskProfile`, `RiskProfileParameters`, `NonRegIncomeAllocation`, `InvestmentAssumptions`.
- **Dependencies:** Internal: none. External: none.
- **Hardcoded constants:** `RISK_PROFILES`: conservative `{return: 0.04, vol: 0.05, eq: 0.3}`, balanced `{return: 0.055, vol: 0.1, eq: 0.5}`, growth `{return: 0.07, vol: 0.15, eq: 0.7}`, aggressive `{return: 0.08, vol: 0.2, eq: 0.9}`. `DEFAULT_NON_REG_ALLOCATION`: `interestPct: 0.2, canadianDividendPct: 0.3, foreignDividendPct: 0.1, capitalGainsPct: 0.4`. `createDefaultAssumptions` defaults: `nominalReturn: 0.05`, `inflationRate: 0.025`, `volatility: 0.1`. `calculateAllocationReturn` defaults: `equityReturn: 0.08`, `fixedReturn: 0.03`.
- **Notes:** `InvestmentAssumptions.returnMode` (`'nominal' | 'real'`) is not used in the current projection loop — the engine only uses `nominalReturn`. See `@see docs/source-of-truth/06-investment-engine.md - Core Parameters`.

### `packages/calculation-engine/src/investments/glide-path.ts`

- **Purpose:** Models asset allocation changes over time using a linear glide path from pre-retirement equity allocation down to a final late-retirement allocation.
- **Inputs:** `currentAge: number`, `retirementAge: number`, `config?: GlidePathConfig`, `equityReturn?: number`, `fixedReturn?: number`, `equityVolatility?: number`, `fixedVolatility?: number`, `correlation?: number`, `profile?: RiskProfile`. Reads `calculateAllocationReturn`, `RISK_PROFILES` from `returns.js`.
- **Outputs:** `calculateGlidePathAllocation(currentAge, retirementAge, config?)`, `calculateGlidePathReturn(currentAge, retirementAge, equityReturn?, fixedReturn?, config?)`, `calculateGlidePathVolatility(currentAge, retirementAge, equityVol?, fixedVol?, correlation?, config?)`, `projectGlidePath(startAge, endAge, retirementAge, config?)`, `createGlidePathFromProfile(profile)`, `ageBasedAllocation(age)`, `targetDateAllocation(yearsToRetirement)`. Exports `GlidePathConfig`, `DEFAULT_GLIDE_PATH`.
- **Dependencies:** Internal: `returns.js` (calculateAllocationReturn, RISK_PROFILES). External: none.
- **Hardcoded constants:** `DEFAULT_GLIDE_PATH`: `startingEquityAllocation: 0.8`, `retirementEquityAllocation: 0.6`, `finalEquityAllocation: 0.3`, `yearsBeforeRetirementToStart: 15`, `yearsAfterRetirementToEnd: 20`. `ageBasedAllocation`: uses `120 - age` rule, clamped `[0.2, 0.9]`. Default equity return `0.08`, fixed `0.03`, equity volatility `0.16`, fixed vol `0.04`, correlation `0.2`. Glide path is NOT used in the active projection loop — it is a standalone utility.
- **Notes:** The projection loop in `yearly-calculator.ts` uses a fixed `investmentReturn` from `ProjectionInput`, not the glide path model. See `@see docs/source-of-truth/06-investment-engine.md - Glide Path Model`.

### `packages/calculation-engine/src/investments/monte-carlo.ts`

- **Purpose:** Implements Monte Carlo simulation for portfolio probability-of-success analysis using log-normal returns; includes stress test scenarios.
- **Inputs:** `initialBalance: number`, `annualWithdrawal: number`, `projectionYears: number`, `params?: Partial<MonteCarloParams>`. No shared package dependencies.
- **Outputs:** `DEFAULT_MONTE_CARLO_PARAMS` (constant), `generateLogNormalReturn(expectedReturn, volatility, random)`, `runMonteCarloSimulation(initialBalance, annualWithdrawal, projectionYears, params?)` → `MonteCarloResult`, `runMonteCarloWithInflation(initialBalance, initialWithdrawal, inflationRate, projectionYears, params?)` → `MonteCarloResult`, `runStressTest(params)` → `StressTestResult`. Exports `MonteCarloParams`, `SimulationYearData`, `SimulationScenario`, `MonteCarloResult`, `StressScenario`, `StressTestParams`, `StressTestResult`.
- **Dependencies:** Internal: none. External: none (uses internal `SeededRandom` class — mulberry32 PRNG).
- **Hardcoded constants:** `DEFAULT_MONTE_CARLO_PARAMS`: `numSimulations: 1000`, `expectedReturn: 0.055`, `volatility: 0.1`. Stress test returns: `market_crash_at_retirement` → year 1 `-0.3`; `lost_decade` → years 1–10 `0.0`; `high_inflation` → years 1–5 `baseReturn - 0.035`; `2008_replay` → year 1 `-0.37`, year 2 `+0.27`.
- **Notes:** **Scaffolded but NOT wired into the active projection loop.** `runProjection()` in `multi-year.ts` does NOT call any Monte Carlo function — the BullMQ worker infrastructure exists but the simulation path is not triggered. Phase 28 should flag `runMonteCarloSimulation` as an untested surface (Research Open Question 3). See `@see docs/source-of-truth/06-investment-engine.md - Monte Carlo Simulation`.

---

### withdrawals/

### `packages/calculation-engine/src/withdrawals/index.ts`

- **Purpose:** Barrel that re-exports everything from strategy, calculator, and optimizer modules.
- **Inputs:** None — re-export only.
- **Outputs:** Re-exports from `strategy.js`, `calculator.js`, `optimizer.js`.
- **Dependencies:** Internal: all withdrawal sub-modules. External: none.
- **Hardcoded constants:** none.
- **Notes:** See `@see docs/source-of-truth/07-withdrawal-strategies.md`.

### `packages/calculation-engine/src/withdrawals/strategy.ts`

- **Purpose:** Defines named withdrawal strategies as `WITHDRAWAL_STRATEGIES` map and provides utilities for ordering accounts by withdrawal priority.
- **Inputs:** `strategyName: string`, `strategy: WithdrawalStrategy`, `accountType: AccountType`, `accountsWithBalance: AccountType[]`. Reads `AccountType` from `@retireops/shared`.
- **Outputs:** `WITHDRAWAL_STRATEGIES` (constant map with 5 named strategies), `WithdrawalStrategyName` (union type), `getWithdrawalStrategy(strategyName)`, `getWithdrawalOrder(strategy)`, `shouldWithdrawFromAccount(accountType, strategy, accountsWithBalance)`, `createCustomStrategy(name, description, accountPriority, options?)`. Exports `WithdrawalStrategy`, `WithdrawalStrategyOptions`, `WithdrawalStrategyName`.
- **Dependencies:** Internal: none. External: `@retireops/shared` (AccountType).
- **Hardcoded constants:** Strategy keys: `standard`, `tfsaFirst`, `taxOptimized`, `oasProtection`, `rrspMeltdown`. `oasProtection` meltdown target: `200000`. `rrspMeltdown` meltdown target: `150000`. `standard` account priorities: `non_registered: 1, rrif: 2, rrsp: 3, tfsa: 4, lira: 5, lif: 2, fhsa: 6`.
- **Notes:** The active projection loop (`yearly-calculator.ts`) uses `drawdownOrder` from `ProjectionInput` (user-chosen key) to select from `WITHDRAWAL_STRATEGIES`. The five strategy keys are `standard`, `tfsaFirst`, `taxOptimized`, `oasProtection`, `rrspMeltdown` — note these differ from the research file's listed keys (`standard`, `tax_efficient`, `rrsp_meltdown`, `oas_clawback_avoidance`, `spouse_equalization`). Actual source keys are `standard`, `tfsaFirst`, `taxOptimized`, `oasProtection`, `rrspMeltdown`. See `@see docs/source-of-truth/07-withdrawal-strategies.md`.

### `packages/calculation-engine/src/withdrawals/calculator.ts`

- **Purpose:** Executes withdrawal strategy calculations — determines net spending need, applies mandatory RRIF/LIF minimums, then sources additional withdrawals from accounts in priority order.
- **Inputs:** `WithdrawalCalculationInput` (`balances: AccountBalances`, `desiredSpending: number`, `guaranteedIncome: number`, `age: number`, `strategy?: WithdrawalStrategy`, `oasClawbackThreshold?: number`, `taxBracketCeiling?: number`, `hasConvertedToRRIF?: boolean`, `lifJurisdiction?: LIFJurisdiction`). Reads `getRRIFMinimumRate`, `getLIFMaximumRate`, `getLIFRules`, `LIFJurisdiction` from `@retireops/shared`.
- **Outputs:** `calculateRRIFMinimum(balance, age)`, `calculateLIFWithdrawalLimits(balance, age, jurisdiction?)`, `calculateSpendingNeed(desiredSpending, guaranteedIncome, taxesPayable?, oneTimeExpenses?)`, `calculateWithdrawals(input)` → `WithdrawalPlan`, `canMeetSpendingNeed(balances, spendingNeed)`, `estimateYearsUntilDepletion(balances, annualSpendingNeed, investmentReturn)`. Exports `AccountBalances`, `WithdrawalCalculationInput`, `AccountWithdrawal`, `WithdrawalPlan`.
- **Dependencies:** Internal: `strategy.js` (WithdrawalStrategy, getWithdrawalOrder, WITHDRAWAL_STRATEGIES). External: `@retireops/shared`.
- **Hardcoded constants:** RRIF minimum age `72` (hardcoded in `calculateRRIFMinimum`). Default `lifJurisdiction: 'federal'`. Default `hasConvertedToRRIF = age >= 72`. TFSA withdrawals are not taxable (excluded from `taxableWithdrawal`). LIF default reference rate `6%` via `getLIFRules('federal').referenceRate`.
- **Notes:** `calculateWithdrawals` respects drawdown order from strategy, enforces mandatory minimums first, then fills spending gap. OAS clawback avoidance and tax bracket filling are not implemented inline here — they are handled by `optimizer.ts` functions called at a higher level. See `@see docs/source-of-truth/07-withdrawal-strategies.md - Withdrawal Calculation Algorithm`.

### `packages/calculation-engine/src/withdrawals/optimizer.ts`

- **Purpose:** Provides higher-level optimization utilities: tax bracket filling, RRSP meltdown schedule, OAS clawback avoidance, income smoothing, pension income split optimization, and strategy comparison.
- **Inputs:** Various numeric inputs per function — see exports. Reads `FEDERAL_TAX_2024`, `OAS_CLAWBACK_THRESHOLDS` from `@retireops/shared`.
- **Outputs:** `getFederalTaxBrackets(year?)`, `getCurrentBracket(taxableIncome, year?)`, `calculateBracketSpace(currentTaxableIncome, year?)`, `calculateBracketFillWithdrawal(currentTaxableIncome, rrifBalance, rrifMinimum, targetBracket?, year?)`, `calculateMeltdownWithdrawal(currentAge, currentRRSPBalance, targetBalanceAt72, retirementAge?)`, `getOASClawbackThreshold(year?)`, `calculateSafeIncomeLimit(oasThreshold?, safetyMargin?)`, `calculateOASOptimizedWithdrawal(currentTaxableIncome, spendingNeed, tfsaBalance, year?)`, `calculateSmoothedIncome(totalTaxableAssets, yearsRemaining, guaranteedIncome)`, `calculateOptimalPensionSplit(higherIncomeSpouseTaxable, lowerIncomeSpouseTaxable, splittableIncome)` — binary search 0–0.5 in 0.05 steps, `compareStrategies(balances, desiredSpending, guaranteedIncome, age)`, `recommendSurplusReinvestment(surplus, tfsaContributionRoom, hasMortgage?, mortgageRate?, expectedReturn?)`. Exports `TaxBracket` (local redefinition).
- **Dependencies:** Internal: `strategy.js`, `calculator.js`. External: `@retireops/shared` (FEDERAL_TAX_2024, OAS_CLAWBACK_THRESHOLDS).
- **Hardcoded constants:** `calculateSafeIncomeLimit` default safety margin `2000`. `calculateMeltdownWithdrawal` default retirement age `60`. `getFederalTaxBrackets` in this file uses `FEDERAL_TAX_2024` directly (TODO comment for historical support — does NOT call `federal-tax.ts`). `getOASClawbackThreshold` uses `OAS_CLAWBACK_THRESHOLDS[2024]` directly (same TODO). `recommendSurplusReinvestment` default expected return `0.05`. Pension split step size `0.05` (5%), max `0.5` (50%).
- **Notes:** `calculateOptimalPensionSplit` uses simplified bracket-comparison heuristic, not a full tax simulation. `getFederalTaxBrackets` and `getOASClawbackThreshold` in this file shadow functions of the same name in `federal-tax.ts` and `oas-clawback.ts` but hardcode to 2024 data — potential stale-data risk for future years. See `@see docs/source-of-truth/07-withdrawal-strategies.md - Strategic Withdrawal Approaches`.

---

### projection/

### `packages/calculation-engine/src/projection/index.ts`

- **Purpose:** Barrel that re-exports everything from yearly-calculator, multi-year, couple-calculator, clone, funded-status, and solver modules.
- **Inputs:** None — re-export only.
- **Outputs:** Re-exports from `yearly-calculator.js`, `multi-year.js`, `couple-calculator.js`, `clone.js`, `funded-status.js`, `solver.js`.
- **Dependencies:** Internal: all projection sub-modules. External: none.
- **Hardcoded constants:** none.
- **Notes:** `runProjection`, `runSingleProjection`, `runCoupleProjection`, and `CoupleProjectionOutput` are the primary public exports consumed by `packages/api`. See `@see docs/source-of-truth/08-projection-engine.md`.

### `packages/calculation-engine/src/projection/multi-year.ts`

- **Purpose:** Central engine entry point. Runs year-by-year projection loops for single or couple scenarios from current year to `startYear + (lifeExpectancy - startAge)`. Handles RRSP→RRIF conversion at age 71, LIRA→LIF, bridge benefit proration, and produces `ProjectionOutput` with `projectionRows` and `legacyTargetMet`.
- **Inputs:** `ProjectionInput` (from `@retireops/shared`) — full wizard input including account balances, income, contributions, birth date, province, retirement age, life expectancy, CPP/OAS start ages, investment assumptions, strategy flags.
- **Outputs:** `runProjection(input)` → `ProjectionOutput | CoupleProjectionOutput`, `runSingleProjection(input)` → `ProjectionOutput`, `runCoupleProjection(input)` → `CoupleProjectionOutput`, `calculateProjectionSummary(results, input)` → `ProjectionSummary`. Exports `CoupleProjectionOutput` interface. Also exports `transformToProjectionYearRows` (converts `YearlyResult[]` to `ProjectionYearRow[]` for UI).
- **Dependencies:** Internal: `accounts/tfsa.js`, `accounts/rrsp.js`, `projection/yearly-calculator.js`, `projection/couple-calculator.js`, `benefits/cpp.js`. External: `@retireops/shared` (getCurrentYear, ageAtEndOfYear, all types).
- **Hardcoded constants:** Default CPP estimate: `12000` (used when `input.expectedCPPAt65 === undefined`). Default years of residence: `40` (full OAS residency assumed). RRSP→RRIF conversion triggers at age `71` (end-of-year check). Loop terminates if `totalNetWorth <= 0`. `legacyTargetMet` is `null` when no `legacyTarget` set.
- **Notes:** `isCoupleProjection(input)` checks `input.spouse !== undefined && (maritalStatus === 'married' || 'common_law')`. Couple survivor logic: after life expectancy event, spouse `maritalStatus` changes to `'single'` and receives CPP survivor benefit. `calculateAnnualizedPensionIncome` handles bridge benefit proration (monthly cutoff using `birthdate.getMonth() + 1`). RRSP carry-forward room is tracked per-year but starts at `0` (prior accumulated room not tracked). See `@see docs/source-of-truth/08-projection-engine.md`.

### `packages/calculation-engine/src/projection/yearly-calculator.ts`

- **Purpose:** Calculates a single year's full financial result for one person — income, tax, government benefits, RRIF/LIF minimums, withdrawals, account growth, and net worth. Also exports `calculatePersonYear()` for couple use.
- **Inputs:** `YearInput` / `PersonYearInput` — year, birthdate, province, all account balances, contributions, income fields, CPP/OAS start ages, spending, investment return, inflation rate, strategy flags (drawdownOrder, rrspMeltdown, oasClawbackAvoidance, contributionOverrides, ageBandReductions).
- **Outputs:** `applyAgeBandReduction(spending, age, bands)`, `resolveContribution(accountType, defaultAmount, year, overrides)`, `calculateYear(yearInput)` → `YearlyResult`, `calculatePersonYear(input)` → `PersonYearlyResult`. Both return objects include `rrifForcedMinimum: number`, `rrifMinimumRate: number`, and `rrifConversionYear: boolean` (v1.8, Phase 37). Exports `YearInput`, `PersonYearInput`.
- **Dependencies:** Internal: `tax/index.js`, `benefits/index.js`, `accounts/rrif.js`, `accounts/tfsa.js`, `accounts/rrsp.js`, `accounts/non-registered.js`, `accounts/index.js`, `accounts/lira.js`, `accounts/lif.js`. External: `@retireops/shared`.
- **Hardcoded constants:** `applyAgeBandReduction`: sorts bands descending, highest matching `fromAge` wins, bands do NOT stack (SPD-03, D-15). `resolveContribution`: first matching override wins (SAV-01, D-13).
- **Notes:** This is the most complex file in the engine — orchestrates all tax, benefits, accounts, and withdrawals for a single year. Strategy flag dispatch: `drawdownOrder` selects from `WITHDRAWAL_STRATEGIES`; `oasClawbackAvoidance` adjusts withdrawal sourcing; `ageBandReductions` reduces retirement spending. See `@see docs/source-of-truth/08-projection-engine.md`.

### `packages/calculation-engine/src/projection/couple-calculator.ts`

- **Purpose:** Calculates a combined yearly result for two people — runs primary and spouse through `calculatePersonYear()` independently, then applies pension-split optimizer or fixed `incomeSplitting` override, OAS clawback avoidance, and aggregate household totals.
- **Inputs:** `CoupleYearInput` — `year`, `maritalStatus`, `primary: PersonYearInput`, `spouse: PersonYearInput`, `sharedRetirementSpending?`, `optimizePensionSplitting: boolean`, `useYoungerSpouseForRRIF: boolean`, `incomeSplitting?: {enabled, splitPercent}`.
- **Outputs:** `calculateCoupleYear(input)` → `CoupleYearlyResult`. Exports `CoupleYearInput`.
- **Dependencies:** Internal: `yearly-calculator.js` (calculatePersonYear, PersonYearInput), `tax/index.js` (calculateTotalTax, TaxCalculationInput), `tax/oas-clawback.js` (getOASClawbackThreshold). External: `@retireops/shared`.
- **Hardcoded constants:** None — split logic determined by `incomeSplitting.splitPercent` (user-configured) or pension split optimizer. OAS clawback threshold fetched from `getOASClawbackThreshold(year)`.
- **Notes:** TAX-03: when `incomeSplitting.enabled`, fixed `splitPercent` of primary's eligible pension/RRIF income is attributed to spouse — overrides optimizer. TAX-04: OAS clawback avoidance redirected at couple level. See `@see docs/source-of-truth/07-withdrawal-strategies.md - Pension Income Splitting`.

### `packages/calculation-engine/src/projection/clone.ts`

- **Purpose:** Deep clone helper for `ProjectionInput` using `structuredClone` (Node 20+ runtime). Required by optimization analyzers to prevent shared-state mutation when running multiple `runProjection()` what-if calls.
- **Inputs:** `input: ProjectionInput` — the projection input to clone (will NOT be mutated).
- **Outputs:** `cloneProjectionInput(input: ProjectionInput): ProjectionInput` — a deep copy safe for mutation. Preserves `Date` objects (`birthdate`, `spouse.birthdate`) unlike `JSON.parse/stringify`.
- **Dependencies:** Internal: none. External: `@retireops/shared` (ProjectionInput type import only). Runtime: `structuredClone` (Node 20+ global — declared inline to satisfy `lib: ["ES2022"]` which lacks the type definition).
- **Hardcoded constants:** none.
- **Notes:** Added in Phase 43 (v1.9 Tax Optimization Engine). `structuredClone` is declared via `declare function structuredClone<T>(value: T): T` at module scope to avoid TS error "Cannot find name 'structuredClone'" when `lib` does not include `ESNext` or `DOM`. See STATE.md OPT-3 and `@see docs/source-of-truth/08-projection-engine.md`. TC-OPT-CLONE-001.

### `packages/calculation-engine/src/projection/funded-status.ts`

- **Purpose:** Pure classification of a completed projection into Green/Yellow/Red funded state, plus a stubbed `computeRemediationPlan` (Phase 48 stub returns zeros; Phase 49 fills the binary-search implementation). Reads the already-computed `yearlyResults[]` array — zero additional `runProjection()` calls (FR-001).
- **Inputs:** `computeFundedStatus(results: YearlyResult[], input: ProjectionInput)`. For couple projections, uses `Math.max(input.lifeExpectancy, input.spouse.lifeExpectancy)` as the horizon age (FUND-12).
- **Outputs:** `computeFundedStatus() → FundedStatus`; `computeRemediationPlan(input, fundedStatus, runProjectionCallback) → RemediationPlan` (stub in Phase 48 — returns `{ additionalAnnualSavings: 0, annualSpendingReduction: 0, retirementDelayYears: 0, delayCapReached: false }`).
- **Dependencies:** Internal: none (pure over results array). External: `@retireops/shared` (`YearlyResult`, `ProjectionInput`, `FundedStatus`, `RemediationPlan`).
- **Hardcoded constants:** `0.10` (Yellow/Green buffer threshold per spec Assumptions — fixed in v1.11). Binary-search bounds in Phase 49: savings [0, 200000], delay [0, max(0, 70 − retirementAge)].
- **Notes:** `runProjection` is passed as a callback (not imported) to avoid a circular module dependency with `multi-year.ts` — see `data-model.md §Exported functions`. Edge case: `totalRetirementWithdrawals === 0` returns `'green'` (TC-PROJ-042). See `@see .specify/specs/007-funded-indicator/spec.md — FR-002, FR-003, FR-004`. Added in Phase 48 (v1.11).

---

### `packages/calculation-engine/src/projection/solver.ts`

- **Purpose:** Pure, callback-injected solver for the v1.12 Reverse Calculator. Exports a single `solveSingle(input, runProjection)` function that dispatches on `SolverMode` to one of four private mode-solvers: `required-savings` (binary search over combined RRSP + TFSA annual contributions), `sustainable-spending` (INVERTED-direction binary search over retirement spending), `earliest-retirement-age` (bisection pre-narrowing + linear scan over integer age), and `required-total-savings` (proportional-split binary search over total portfolio).
- **Inputs:** `solveSingle(input: SolverInput, runProjection: (input: ProjectionInput) => ProjectionOutput) → SolverResult`.
- **Outputs:** `SolverResult` containing `solvedValue`, `feasible`, `convergenceIterations`, and a populated `SolverProjectionSummary`. Returns `feasible: false` with `solvedValue: 0` when the goal is unreachable at the upper bound of the search range.
- **Dependencies:** Internal: none (callback injection — NO import of `multi-year.ts`). External: `@retireops/shared` (type-only imports of `SolverInput`, `SolverResult`, `SolverMode`, `SolverProjectionSummary`, `ProjectionInput`, `ProjectionOutput`).
- **Hardcoded constants:** `BINARY_SEARCH_ITERATIONS = 20`, `SAVINGS_MAX = 250_000`, `SPENDING_MIN = 1_000`, `SPENDING_MAX = 500_000`, `TOTAL_SAVINGS_MAX = 10_000_000`, `AGE_MAX_PLANNING = 80`, `MODE3_LINEAR_BRACKET = 4`, `DEFAULT_LIFE_EXPECTANCY = 90`, `DEFAULT_INFLATION = 0.02`, `DEFAULT_INVESTMENT_RETURN = 0.05`, `DEFAULT_CPP_AT_65 = 12_000`.
- **Notes:** CRITICAL — Mode 2 binary search is INVERTED relative to Modes 1 and 4 (lo=mid when feasible, NOT hi=mid). Copying the v1.11 savings-lever direction produces a wrong answer with no runtime error. Mode 3 applies bisection pre-narrowing to a 4-year bracket (max 8 `runProjection()` calls total) to avoid the 55+ call worst-case of a pure linear scan. `inflationRate` is already decimal in `SolverInput` — not divided by 100. Mode 1 sets both `rrspAnnualContribution` and `tfsaAnnualContribution` to the search variable to fully utilize tax-advantaged contribution room (RRSP is capped by 18% earned income; setting only rrsp would hit the room ceiling before the scenario becomes feasible). Tested by `solver.test.ts` (TC-SOLVER-001..005). Added in Phase 52 (v1.12). Consumed by Phase 53 API service (`solver.service.ts`).

---

---

### optimization/

### `packages/calculation-engine/src/optimization/types.ts`

- **Purpose:** Engine-internal TypeScript types for the v1.9 optimization analyzer layer — defines `OptimizationInput`, `MeltdownSchedule`, and `BreakevenResult` used by all four analyzer modules.
- **Inputs:** None — type definitions only.
- **Outputs:** Exported interfaces: `OptimizationInput` (wraps `ProjectionInput` with a baseline `ProjectionOutput` for comparison), `MeltdownSchedule` (per-year voluntary RRSP withdrawal recommendation with tax bracket info), `BreakevenResult` (CPP/OAS start-age breakeven age and cumulative benefit amounts).
- **Dependencies:** Internal: none. External: `@retireops/shared` (ProjectionInput, ProjectionOutput type imports).
- **Hardcoded constants:** none.
- **Notes:** Added in Phase 43 (v1.9 Tax Optimization Engine). These are engine-internal types only — not re-exported from `@retireops/shared`. Consumed by analyzer modules in `optimization/`. See CARD-01, CARD-05.

### `packages/calculation-engine/src/optimization/index.ts`

- **Purpose:** Barrel stub for the optimization module — re-exports all types from `types.ts`. Additional analyzer re-exports will be added in subsequent phases (Phases 44–47).
- **Inputs:** None — re-export only.
- **Outputs:** Re-exports from `./types.js`.
- **Dependencies:** Internal: `./types.js`. External: none.
- **Hardcoded constants:** none.
- **Notes:** Added in Phase 43 as a stub; populated by Phases 44–47 as analyzers are implemented. See Phase 43 plan docs.

### `packages/calculation-engine/src/optimization/analyzers/income-splitting.ts`

- **Purpose:** Pension income splitting analyzer for couple projections
- **Inputs:** `OptimizationInput` (from `../types.js`)
- **Outputs:** `InsightCard | null`
- **Dependencies:** `tax/index.ts` (`calculateTotalTax`), `@retireops/shared` (`InsightCard`)
- **Added:** v1.9 Phase 44

### `packages/calculation-engine/src/optimization/analyzers/cpp-oas.ts`

- **Purpose:** CPP/OAS timing and clawback risk analyzer
- **Inputs:** `OptimizationInput` (from `../types.js`)
- **Outputs:** `InsightCard[]`
- **Dependencies:** `benefits/cpp.ts` (`calculateCPPBreakEvenAge`), `benefits/oas.ts` (`calculateOASBreakEvenAge`), `@retireops/shared` (`InsightCard`)
- **Added:** v1.9 Phase 44

### `packages/calculation-engine/src/optimization/analyzers/rrsp-meltdown.ts`

- **Purpose:** RRSP meltdown strategy analyzer — identifies low-tax-rate retirement years before age 71, calculates bracket-fill withdrawal amounts with OAS clawback net-benefit gate, runs what-if projection comparison
- **Inputs:** `OptimizationInput` (from `../types.js`)
- **Outputs:** `InsightCard | null` — null when no RRSP balance or no savings found
- **Dependencies:** `tax/federal-tax.ts` (`getFederalTaxBrackets`), `tax/oas-clawback.ts` (`getOASClawbackThreshold`), `projection/clone.ts` (`cloneProjectionInput`), `projection/multi-year.ts` (`runProjection`), `@retireops/shared` (`InsightCard`, `OAS_RATES`)
- **Added:** v1.9 Phase 45

### `packages/calculation-engine/src/optimization/analyzers/drawdown-order.ts`

- **Purpose:** Drawdown order analyzer — compares standard withdrawal order (nonReg → RRIF → RRSP → TFSA) vs TFSA-first order (TFSA → nonReg → RRIF → RRSP) via two what-if projections; recommends the lower-tax strategy. DRAW-03 guard returns null when only one account type has a balance.
- **Inputs:** `OptimizationInput` (from `../types.js`)
- **Outputs:** `InsightCard | null` — null when single account type or savings = 0
- **Dependencies:** `projection/clone.ts` (`cloneProjectionInput`), `projection/multi-year.ts` (`runProjection`), `@retireops/shared` (`InsightCard`)
- **Added:** v1.9 Phase 46

### `packages/calculation-engine/src/optimization/orchestrator.ts`

- **Purpose:** Optimization orchestrator — calls all four analyzers (income-splitting, cpp-oas, rrsp-meltdown, drawdown-order), flattens InsightCard[] from analyzeCPPOAS, filters nulls, sorts by estimatedDollarImpact descending. Returns wellOptimized: true with message when no cards generated (CARD-04).
- **Inputs:** `OptimizationInput` (from `./types.js`)
- **Outputs:** `OptimizationResult` ({ cards: InsightCard[]; wellOptimized: boolean; message?: string })
- **Dependencies:** All four analyzer modules, `@retireops/shared` (`InsightCard`)
- **Exports:** `runOptimizationAnalysis`, `OptimizationResult`
- **Added:** v1.9 Phase 46

---

### Calculation Engine Summary

- **Total files documented:** 27 (1 root index + 6 tax + 4 benefits + 7 accounts + 5 investments + 3 withdrawals + 4 projection — counting index barrels in each subdirectory, including the root `index.ts`)
- **Entry point:** `runProjection(input: ProjectionInput)` in `packages/calculation-engine/src/projection/multi-year.ts`
- **Purity:** No I/O, no DB, no HTTP. Depends only on `@retireops/shared` (types, constants, utility functions)
- **Source-of-truth references:** `02-account-types.md` (RRSP/RRIF/TFSA/LIRA/LIF/non-reg), `04-tax-engine.md` (federal/provincial/capital-gains/credits/OAS clawback), `05-government-benefits.md` (CPP/OAS/GIS), `07-withdrawal-strategies.md` (strategies/optimizer), `08-projection-engine.md` (projection loop)
- **Key divergences from plan spec:** Actual `WITHDRAWAL_STRATEGIES` keys are `standard`, `tfsaFirst`, `taxOptimized`, `oasProtection`, `rrspMeltdown` — the research file listed `tax_efficient`, `rrsp_meltdown`, `oas_clawback_avoidance`, `spouse_equalization` which do NOT match actual source. `spouse_equalization` strategy does not exist. Monte Carlo is fully scaffolded but NOT wired into `runProjection`.

---

## Package: @retireops/api

Root: `packages/api/src/`

Express REST API gateway. Handles authentication, validation, persistence (PostgreSQL via Kysely), caching (Redis), and synchronous projection execution. Depends on `@retireops/shared` and `@retireops/calculation-engine`.

---

### entry & config/

### `packages/api/src/server.ts`

- **Purpose:** Process entry point — bootstraps Express app, binds HTTP server to port, and handles graceful shutdown on SIGTERM/SIGINT.
- **Inputs:** `config.PORT`, `config.HOST` from `config/index.js`; `db` and `redis` instances for teardown.
- **Outputs:** Exports `server` (HTTP server instance). Side effects: process.exit on error.
- **Dependencies:** Internal: `app.js`, `config/index.js`, `utils/logger.js`, `db/connection.js`, `utils/redis.js`. External: none.
- **Hardcoded constants:** none — port/host from config.
- **Notes:** Graceful shutdown closes HTTP server first, then DB, then Redis. Uncaught exception handler calls `process.exit(1)`.

### `packages/api/src/app.ts`

- **Purpose:** Express application factory — `createApp()` wires all middleware, security headers, CORS, rate limiting, and route handlers into a configured Express instance.
- **Inputs:** Config values for CORS origin. Route handlers imported from `routes/`.
- **Outputs:** Exports `createApp(): Express`. Side effects: none (pure factory).
- **Dependencies:** Internal: all route files, all middleware files, `config/index.js`. External: `express`, `cors`, `helmet`, `compression`.
- **Hardcoded constants:** Body parse limit `1mb`. HSTS `maxAge: 31536000`, `includeSubDomains: true`, `preload: true`. CSP `defaultSrc: ["'self'"]`, `styleSrc: ["'self'", "'unsafe-inline'"]`. Route order: `/api/profile/scenarios` registered before `/api/profile` to prevent path conflicts.
- **Notes:** Rate limiter applied to `/api` prefix only — health and metrics routes bypass rate limiting. Route registration order matters: `profileScenariosRoutes` must be mounted before `profileRoutes`.

### `packages/api/src/index.ts`

- **Purpose:** Package barrel — re-exports public API for the `@retireops/api` package (if used as a library).
- **Inputs:** None — re-export only.
- **Outputs:** Re-exports from `server.js` or `app.js` as applicable.
- **Dependencies:** Internal: `server.js` or `app.js`. External: none.
- **Hardcoded constants:** none.
- **Notes:** Primary consumption is as a standalone process, not a library.

### `packages/api/src/config/index.ts`

- **Purpose:** Zod-validated environment configuration loader — parses `process.env` at startup and exports a single typed `config` object; exits process on invalid config.
- **Inputs:** `process.env` variables.
- **Outputs:** Exported `config: Config`, `isProduction: boolean`, `isDevelopment: boolean`, `isTest: boolean`. Exported type `Config`.
- **Dependencies:** External: `zod`.
- **Hardcoded constants:** `PORT` default `3001`. `HOST` default `'0.0.0.0'`. `DATABASE_URL` default `'postgresql://retireops:retireops@localhost:5432/retireops'`. `DATABASE_POOL_MIN` default `2`, `DATABASE_POOL_MAX` default `10`. `REDIS_URL` default `'redis://localhost:6379'`. `JWT_SECRET` min length `32`. `JWT_ACCESS_TOKEN_EXPIRES_IN` default `'15m'`. `JWT_REFRESH_TOKEN_EXPIRES_IN` default `'7d'`. `CORS_ORIGIN` default `'http://localhost:3000'`. `RATE_LIMIT_WINDOW_MS` default `900000` (15 min). `RATE_LIMIT_MAX_REQUESTS` default `100`. `BCRYPT_ROUNDS` default `12`. `LOG_LEVEL` default `'info'`. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` optional.
- **Notes:** Env var aliases supported: `DB_POOL_MIN` → `DATABASE_POOL_MIN`, `JWT_EXPIRES_IN` → `JWT_ACCESS_TOKEN_EXPIRES_IN`, `ALLOWED_ORIGINS` → `CORS_ORIGIN` (via `normalizeEnv`). Exits process on invalid config — no fallback at runtime.

---

### auth/

### `packages/api/src/auth/jwt.ts`

- **Purpose:** JWT access token generation/verification, refresh token generation/storage/revocation, and Redis-backed access token blacklisting for logout.
- **Inputs:** `userId: string`, `email: string` for token generation. `config.JWT_SECRET`, `config.JWT_ACCESS_TOKEN_EXPIRES_IN` from config.
- **Outputs:** `generateAccessToken(userId, email): string` (HS256 JWT). `generateRefreshToken(): string` (128-char hex). `generateTokenPair(userId, email): Promise<TokenPair>` (stores refresh token hash in DB). `verifyAccessToken(token): TokenPayload | null`. `decodeAccessToken(token): TokenPayload | null` (no signature check — for refresh flow). `verifyRefreshToken(userId, token): Promise<boolean>`. `revokeRefreshToken(userId, token): Promise<void>`. `revokeAllRefreshTokens(userId): Promise<void>`. `blacklistAccessToken(token): Promise<void>` (Redis `setex` with TTL = remaining token lifetime). `isAccessTokenBlacklisted(token): Promise<boolean>`. Exports `TokenPayload`, `TokenPair` interfaces.
- **Dependencies:** Internal: `config/index.js`, `utils/redis.js`, `db/connection.js`, `auth/password.js`, `utils/logger.js`. External: `jsonwebtoken`, `crypto`.
- **Hardcoded constants:** `BLACKLIST_PREFIX = 'token:blacklist:'`. Refresh token stored as bcrypt hash. JWT algorithm HS256 (implicit in `jsonwebtoken`). Default access token expiry `'15m'` (from config default).
- **Notes:** `generateRefreshToken()` returns 64 random bytes as hex = 128 chars. Refresh token verification requires iterating DB tokens and bcrypt-comparing each — O(n) per user's active tokens. `decodeAccessToken` used in `/auth/refresh` flow where access token may be expired. See `@see docs/source-of-truth/13-compliance-scope.md`.

### `packages/api/src/auth/middleware.ts`

- **Purpose:** `requireAuth` and `optionalAuth` Express middleware — extracts Bearer token from Authorization header, checks Redis blacklist, verifies JWT, attaches `req.user = {id, email}`.
- **Inputs:** `req.headers.authorization` (Bearer token).
- **Outputs:** Sets `req.user = {id: string, email: string}` on success. Calls `next(AuthenticationError)` on failure. Extends Express `Request` type globally with `user?: {id, email}`.
- **Dependencies:** Internal: `auth/jwt.js` (verifyAccessToken, isAccessTokenBlacklisted), `middleware/error-handler.js` (AuthenticationError). External: `express`.
- **Hardcoded constants:** none.
- **Notes:** `optionalAuth` does not fail on missing/invalid token — passes through without setting `req.user`. Both functions are `async` — must be registered with Express as async-compatible middleware. `req.user` type is augmented globally via `declare global namespace Express`.

### `packages/api/src/auth/password.ts`

- **Purpose:** bcrypt password hashing and comparison using configurable rounds from `config.BCRYPT_ROUNDS`.
- **Inputs:** `password: string`, `hash: string`, `config.BCRYPT_ROUNDS`.
- **Outputs:** `hashPassword(password): Promise<string>`, `verifyPassword(password, hash): Promise<boolean>`.
- **Dependencies:** Internal: `config/index.js`. External: `bcryptjs`.
- **Hardcoded constants:** `BCRYPT_ROUNDS` default `12` (from config). bcryptjs (not native bcrypt — pure JS, slower but no native deps).
- **Notes:** Used in `jwt.ts` for refresh token hash storage. `bcryptjs` is the pure-JS port — consistent behavior across platforms.

---

### db/

### `packages/api/src/db/connection.ts`

- **Purpose:** Creates and exports the Kysely PostgreSQL database instance (`db`) used by all API services.
- **Inputs:** `config.DATABASE_URL`, `config.DATABASE_POOL_MIN`, `config.DATABASE_POOL_MAX`.
- **Outputs:** Exports `db: Kysely<Database>`.
- **Dependencies:** Internal: `config/index.js`, `db/schema.js`. External: `kysely`, `pg`.
- **Hardcoded constants:** Pool min/max from config (defaults 2/10).
- **Notes:** Single shared pool — no per-request connections. `db.destroy()` called in graceful shutdown.

### `packages/api/src/db/migrate.ts`

- **Purpose:** Database migration runner — applies pending migrations in sequence from the `migrations/` directory.
- **Inputs:** Database connection, migration files.
- **Outputs:** Side effect: applies SQL migrations to PostgreSQL.
- **Dependencies:** Internal: `db/connection.js`. External: `kysely` migration utilities.
- **Hardcoded constants:** Migration directory path.
- **Notes:** Run via `pnpm --filter @retireops/api db:migrate`. Not imported at runtime.

### `packages/api/src/db/schema.ts`

- **Purpose:** Kysely TypeScript type definitions for all 12 database tables — provides type safety for all query builder calls.
- **Inputs:** Type imports from `kysely` (Generated, ColumnType).
- **Outputs:** Exported interfaces: `UsersTable`, `OAuthProvidersTable`, `UserSettingsTable`, `RefreshTokensTable`, `ProjectionsTable`, `ScenariosTable`, `AccountsTable`, `IncomeSourcesTable`, `ConfigDataTable`, `MonteCarloJobsTable`, `HouseholdProfilesTable`, `ProfileScenariosTable`. Exported `Database` interface (maps table names to interfaces).
- **Dependencies:** External: `kysely`.
- **Hardcoded constants:** none — table shape only.
- **Notes:** 12 tables total: `users`, `oauth_providers`, `user_settings`, `refresh_tokens`, `projections`, `scenarios`, `accounts`, `income_sources`, `config_data`, `monte_carlo_jobs`, `household_profiles`, `profile_scenarios`. JSONB columns typed as `unknown`. `projections.input_data` and `result_data` are both `unknown` JSONB. `profile_scenarios.decisions` is `unknown` JSONB (runtime: `ScenarioDecisions`). Soft delete via `deleted_at` on `users`, `projections`, `scenarios`, `accounts`, `income_sources`.

---

### middleware/

### `packages/api/src/middleware/error-handler.ts`

- **Purpose:** Centralized Express error handler — defines `AppError` class hierarchy, formats Zod errors, and returns typed error responses with optional stack trace.
- **Inputs:** `Error | ApiError` from previous middleware/handlers. `req.correlationId` from request logger.
- **Outputs:** JSON response: `{ success: false, error: { code, message, details?, stack? }, correlationId? }`. Exports error classes: `AppError` (base, 500), `ValidationError` (400, `VALIDATION_ERROR`), `AuthenticationError` (401, `AUTHENTICATION_ERROR`), `AuthorizationError` (403, `AUTHORIZATION_ERROR`), `NotFoundError` (404, `NOT_FOUND`), `ConflictError` (409, `CONFLICT`), `RateLimitError` (429, `RATE_LIMIT_EXCEEDED`). Exports `ApiError` interface.
- **Dependencies:** Internal: `utils/logger.js`, `config/index.js` (isProduction). External: `zod` (ZodError detection).
- **Hardcoded constants:** Default status code `500`, code `'INTERNAL_ERROR'`. Stack trace omitted when `isProduction`. Zod errors formatted as `[{ path, message }]` array.
- **Notes:** Must be registered last in Express middleware chain (`app.use(errorHandler)`). Zod errors detected by `err instanceof ZodError`. AppError subclasses detected by `'statusCode' in err && 'code' in err`.

### `packages/api/src/middleware/not-found.ts`

- **Purpose:** 404 handler for unmatched routes — returns `{ success: false, error: { code: 'NOT_FOUND', message } }`.
- **Inputs:** Unmatched Express `Request`.
- **Outputs:** 404 JSON response.
- **Dependencies:** Internal: none. External: `express`.
- **Hardcoded constants:** none.
- **Notes:** Registered after all route handlers, before `errorHandler`.

### `packages/api/src/middleware/rate-limiter.ts`

- **Purpose:** Creates Express rate limiter middleware instances — general API limiter and stricter auth limiter.
- **Inputs:** `config.RATE_LIMIT_WINDOW_MS`, `config.RATE_LIMIT_MAX_REQUESTS`.
- **Outputs:** `createRateLimiter(): RateLimitMiddleware` (general: configurable window/max, keyed by userId or IP). `createAuthRateLimiter(): RateLimitMiddleware` (auth: 15 min window, max 10 requests).
- **Dependencies:** Internal: `config/index.js`. External: `express-rate-limit`.
- **Hardcoded constants:** Auth rate limiter: `windowMs: 15 * 60 * 1000` (15 min), `max: 10`. General limiter skips health check paths (`/health`, `/health/ready`, `/health/live`).
- **Notes:** General limiter uses `req.user?.id ?? req.ip ?? 'unknown'` as key — authenticated users get per-user limits. Not Redis-backed — in-memory store; rate limit counts reset on server restart.

### `packages/api/src/middleware/request-logger.ts`

- **Purpose:** Winston HTTP request/response logger — attaches `correlationId` and `startTime` to each request, logs incoming request and completed response with duration.
- **Inputs:** `req.headers['x-correlation-id']` (optional, used if present; otherwise UUID generated).
- **Outputs:** Sets `req.correlationId: string` and `req.startTime: number`. Logs at `http` level via Winston. Sets `X-Correlation-ID` response header. Extends Express `Request` globally with `correlationId: string`, `startTime: number`.
- **Dependencies:** Internal: `utils/logger.js`. External: `uuid` (v4).
- **Hardcoded constants:** Header name `'x-correlation-id'` (case-insensitive). Response header `'X-Correlation-ID'`.
- **Notes:** `correlationId` propagated to `errorHandler` for error correlation. Winston `http` log level — only logged when `LOG_LEVEL >= http`.

### `packages/api/src/middleware/validation.ts`

- **Purpose:** Zod-based validation middleware factory — `validate(schemas)` returns Express middleware that runs `schema.parseAsync()` on body/query/params and attaches parsed values.
- **Inputs:** `ValidateOptions` with optional `body`, `query`, `params` Zod schemas.
- **Outputs:** `validate(schemas): AsyncRequestHandler`. Exports `paginationSchema` (page, limit with defaults), `idParamSchema` (UUID string). Throws `ValidationError` on Zod parse failure.
- **Dependencies:** Internal: `middleware/error-handler.js` (ValidationError). External: `zod`.
- **Hardcoded constants:** `paginationSchema`: page min=1 default=1, limit min=1 max=100 default=20. `idParamSchema`: UUID format enforced.
- **Notes:** Uses `parseAsync` — supports async Zod refinements. Parsed value replaces raw `req.body`/`req.query`/`req.params` — downstream handlers receive validated/transformed values.

---

### routes/

### `packages/api/src/routes/auth.routes.ts`

- **Purpose:** Authentication route handlers — register, login, token refresh, logout, password management, and Google OAuth flows.
- **Inputs:** Request bodies/headers per route.
- **Outputs:** Route registrations on `authRoutes` Router. HTTP responses per operation.
- **Dependencies:** Internal: `middleware/validation.js`, `middleware/rate-limiter.js`, `auth/middleware.js`, `auth/jwt.js`, `middleware/error-handler.js`, `services/auth.service.js`, `services/google-oauth.service.js`, `config/index.js`. External: `express`, `zod`.
- **Hardcoded constants:** Auth rate limiter applied to all auth routes (15 min window, max 10). Password min 8 chars (inline schema).
- **Notes:** Google OAuth routes return 501 if `GOOGLE_CLIENT_ID` not configured. `POST /auth/refresh` uses `decodeAccessToken` (not `verifyAccessToken`) — expired access tokens are accepted.
- **Routes:**
  - `POST /api/auth/register` — create account (name, email, password)
  - `POST /api/auth/login` — email/password login
  - `POST /api/auth/refresh` — exchange refresh token for new token pair
  - `POST /api/auth/logout` — blacklist access token, revoke refresh token
  - `POST /api/auth/logout-all` — revoke all refresh tokens for user
  - `PUT /api/auth/password` — change password (authenticated)
  - `POST /api/auth/password` — set password (OAuth users without password)
  - `GET /api/auth/google/url` — get Google OAuth authorization URL
  - `POST /api/auth/google/token` — sign in with Google ID token (SPA flow)
  - `POST /api/auth/google/callback` — exchange authorization code (redirect flow)
  - `DELETE /api/auth/google` — unlink Google account

### `packages/api/src/routes/users.routes.ts`

- **Purpose:** User profile and settings CRUD route handlers.
- **Inputs:** Request bodies with user profile/settings fields.
- **Outputs:** Route registrations on `userRoutes` Router.
- **Dependencies:** Internal: `middleware/validation.js`, `auth/middleware.js`, `services/user.service.js`. External: `express`.
- **Hardcoded constants:** none beyond validation schemas.
- **Notes:** All routes require `requireAuth`.
- **Routes:**
  - `GET /api/users/me` — get current user profile
  - `PUT /api/users/me` — update user profile
  - `GET /api/users/settings` — get user settings (province, DOB, spouse, etc.)
  - `PUT /api/users/settings` — update user settings

### `packages/api/src/routes/projections.routes.ts`

- **Purpose:** Projection CRUD and calculation routes — create, list, get, update, delete projections; trigger synchronous calculation.
- **Inputs:** `FrontendInputData` JSON body for create/update. UUID path params.
- **Outputs:** Route registrations on `projectionRoutes` Router. Projection records with `input_data` JSONB.
- **Dependencies:** Internal: `middleware/validation.js`, `auth/middleware.js`, `services/projection.service.js`. External: `express`, `zod`.
- **Hardcoded constants:** Name max 200, description max 1000. Retirement age min 55 max 75. Life expectancy min 70 max 110. Pagination default limit 20, max 100.
- **Notes:** All routes require `requireAuth`. `POST /projections/:id/calculate` triggers synchronous `runProjection()` call via `projection.service.ts`.
- **Routes:**
  - `GET /api/projections` — list projections (paginated)
  - `POST /api/projections` — create projection with `FrontendInputData`
  - `GET /api/projections/:id` — get projection detail with result
  - `PUT /api/projections/:id` — update projection input
  - `DELETE /api/projections/:id` — soft delete projection
  - `POST /api/projections/:id/calculate` — run synchronous projection calculation

### `packages/api/src/routes/scenarios.routes.ts`

- **Purpose:** Legacy projection-based scenario route handlers — CRUD, comparison, and template-based scenario creation bound to a parent projection FK.
- **Inputs:** Scenario modification JSON (retirementAge, cppStartAge, investmentReturnRate, etc.).
- **Outputs:** Route registrations on `scenarioRoutes` Router.
- **Dependencies:** Internal: `middleware/validation.js`, `auth/middleware.js`, `services/scenario.service.js`. External: `express`, `@retireops/shared` (scenarioTemplates).
- **Hardcoded constants:** Scenario name max 200, description max 1000. Compare max 5 scenario IDs.
- **Notes:** **Legacy v1.0-era routes** — bound to `projections` FK, NOT `household_profiles`. Unclear if still wired from UI in v1.4+ (Research Open Question 4). All routes require `requireAuth`.
- **Routes:**
  - `GET /api/scenarios` — list all scenarios for user (across all projections)
  - `GET /api/scenarios/projection/:projectionId` — list scenarios for a projection
  - `GET /api/scenarios/projection/:projectionId/templates` — list available scenario templates
  - `POST /api/scenarios/projection/:projectionId` — create scenario for projection
  - `POST /api/scenarios/projection/:projectionId/from-template` — create from template
  - `GET /api/scenarios/projection/:projectionId/:scenarioId` — get single scenario
  - `PUT /api/scenarios/projection/:projectionId/:scenarioId` — update scenario
  - `DELETE /api/scenarios/projection/:projectionId/:scenarioId` — delete scenario
  - `POST /api/scenarios/projection/:projectionId/compare` — compare multiple scenarios

### `packages/api/src/routes/profile.routes.ts`

- **Purpose:** Household profile wizard route handlers — get profile, patch individual wizard steps, and trigger a calculate (run projection from assembled profile).
- **Inputs:** Step slug path param; `{ currentStep, data }` body for patch.
- **Outputs:** Route registrations on `profileRoutes` Router.
- **Dependencies:** Internal: `middleware/validation.js`, `auth/middleware.js`, `services/profile.service.js`, `services/profile-assembler.js`, `services/projection.service.js`. External: `express`, `zod`.
- **Hardcoded constants:** `currentStep` min 0 max 6. Step slug enum from `profileService.VALID_STEPS`.
- **Notes:** `PATCH /api/profile/:step` is the primary wizard save endpoint. `POST /api/profile/calculate` assembles profile and stores a projection snapshot. All routes require `requireAuth`.
- **Routes:**
  - `GET /api/profile` — get household profile for authenticated user
  - `PATCH /api/profile/:step` — upsert single wizard step data
  - `POST /api/profile/calculate` — assemble profile → run projection → return snapshot

### `packages/api/src/routes/profile-scenarios.routes.ts`

- **Purpose:** Profile scenario CRUD, run, clone, compare, and decisions-update route handlers — the primary v1.3+ scenario management surface.
- **Inputs:** Scenario name/decisions bodies; UUID path params.
- **Outputs:** Route registrations on `profileScenariosRoutes` Router. Scenarios with `decisions` JSONB and `result_data` JSONB.
- **Dependencies:** Internal: `middleware/validation.js`, `auth/middleware.js`, `services/profile-scenario.service.js`. External: `express`, `zod`, `@retireops/shared` (ScenarioDecisionsSchema).
- **Hardcoded constants:** Scenario name min 1 max 100 chars. Compare min 2 max 4 scenario IDs. Decisions body validated against `ScenarioDecisionsSchema.partial()`.
- **Notes:** `POST /compare` registered before `GET|PATCH|POST /:id` routes to avoid Express path conflict. `PUT /:id/decisions` sets scenario to `stale` status — invalidates `result_data`. `DELETE /:id` guards the Base Scenario (returns 409). All routes require `requireAuth`.
- **Routes:**
  - `GET /api/profile/scenarios` — list all profile scenarios (metadata only)
  - `POST /api/profile/scenarios` — create new non-base scenario
  - `POST /api/profile/scenarios/compare` — compare 2–4 completed scenarios
  - `GET /api/profile/scenarios/:id` — get scenario (includes result_data)
  - `PATCH /api/profile/scenarios/:id` — rename non-base scenario
  - `POST /api/profile/scenarios/:id/clone` — clone scenario (is_base=false, name suffixed "(copy)")
  - `POST /api/profile/scenarios/:id/run` — run synchronous projection for scenario
  - `DELETE /api/profile/scenarios/:id` — delete non-base scenario
  - `PUT /api/profile/scenarios/:id/decisions` — merge-patch decisions JSONB → sets status to stale

### `packages/api/src/routes/reference.routes.ts`

- **Purpose:** Reference data routes — province list and tax bracket data for frontend dropdowns and display.
- **Inputs:** None (no request bodies; optional year query param for tax brackets).
- **Outputs:** Route registrations on `referenceRoutes` Router.
- **Dependencies:** Internal: `services/reference.service.js`. External: `express`.
- **Hardcoded constants:** none.
- **Notes:** No authentication required — public reference data.
- **Routes:**
  - `GET /api/reference/provinces` — list all province/territory codes and names
  - `GET /api/reference/tax-brackets` — federal and provincial tax bracket data

### `packages/api/src/routes/health.routes.ts`

- **Purpose:** Health check endpoint for liveness/readiness probes (Docker, load balancer).
- **Inputs:** None.
- **Outputs:** `{ status: 'ok', ... }` JSON response.
- **Dependencies:** External: `express`.
- **Hardcoded constants:** none.
- **Notes:** Not rate-limited (skipped by `createRateLimiter`).
- **Routes:**
  - `GET /health` — liveness/readiness check

### `packages/api/src/routes/metrics.routes.ts`

- **Purpose:** Prometheus metrics endpoint — exposes `prom-client` registry metrics.
- **Inputs:** None.
- **Outputs:** Prometheus text format metrics response.
- **Dependencies:** External: `express`, `prom-client`.
- **Hardcoded constants:** none.
- **Notes:** Not rate-limited. Content-type set to Prometheus format.
- **Routes:**
  - `GET /metrics` — Prometheus metrics

---

### services/

### `packages/api/src/services/auth.service.ts`

- **Purpose:** Business logic for user authentication — registration (with password strength check), login, token refresh, logout, logout-all, change password, set password, and Google OAuth linking.
- **Inputs:** `RegisterInput { email, password, name }`, `LoginInput { email, password }`, `userId: string`, `refreshToken: string`.
- **Outputs:** `register(input): Promise<AuthResult>`, `login(input): Promise<AuthResult>`, `refreshTokens(userId, refreshToken): Promise<TokenPair>`, `logout(userId, accessToken, refreshToken): Promise<void>`, `logoutAllDevices(userId, accessToken): Promise<void>`, `changePassword(userId, currentPassword, newPassword): Promise<void>`, `setPassword(userId, password): Promise<void>`. Exports `RegisterInput`, `LoginInput`, `AuthResult` interfaces.
- **Dependencies:** Internal: `db/connection.js`, `auth/password.js`, `auth/jwt.js`, `middleware/error-handler.js`. External: none.
- **Hardcoded constants:** Email stored lowercase. Password strength validated via `validatePasswordStrength` from `auth/password.js`.
- **Notes:** `register` throws `ConflictError` on duplicate email. `login` throws `AuthenticationError` on wrong password or missing password (OAuth users). `refreshTokens` verifies refresh token via bcrypt iteration over active tokens.

### `packages/api/src/services/user.service.ts`

- **Purpose:** User profile and settings read/update operations against `users` and `user_settings` tables.
- **Inputs:** `userId: string`, profile/settings update payloads.
- **Outputs:** `getUser(userId): Promise<UserProfile>`, `updateUser(userId, input): Promise<UserProfile>`, `getUserSettings(userId): Promise<UserSettings>`, `updateUserSettings(userId, input): Promise<UserSettings>`. Exports `UserProfile`, `UserSettings` interfaces.
- **Dependencies:** Internal: `db/connection.js`, `middleware/error-handler.js`. External: none.
- **Hardcoded constants:** none.
- **Notes:** Soft-delete respected (`deleted_at IS NULL`). `getUser` throws `NotFoundError` if user not found.

### `packages/api/src/services/google-oauth.service.ts`

- **Purpose:** Google OAuth token verification and account linking/creation using `google-auth-library`.
- **Inputs:** Google ID token (string), authorization code (string), `userId: string`.
- **Outputs:** `getGoogleAuthUrl(state?): string`, `signInWithGoogle(idToken): Promise<OAuthResult>`, `signInWithGoogleCode(code): Promise<OAuthResult>`, `unlinkGoogleAccount(userId): Promise<void>`. Exports `OAuthResult` interface (`isNewUser: boolean`, user, tokens).
- **Dependencies:** Internal: `db/connection.js`, `auth/jwt.js`, `config/index.js`, `middleware/error-handler.js`. External: `google-auth-library`.
- **Hardcoded constants:** Google OAuth scopes: `email profile`. OAuth provider string `'google'`.
- **Notes:** Upserts `oauth_providers` row on each login. Creates user account on first Google sign-in. `GOOGLE_CLIENT_ID` must be configured for OAuth to work — routes return 501 otherwise.

### `packages/api/src/services/projection.service.ts`

- **Purpose:** Projection CRUD — list, get, create, update, delete; and synchronous calculation via `runProjection()` with Redis caching of results.
- **Inputs:** `userId: string`, `CreateProjectionInput { name, description?, inputData }`, `UpdateProjectionInput`, pagination params.
- **Outputs:** `listProjections(userId, params): Promise<PaginatedResult<ProjectionListItem>>`, `getProjection(userId, id): Promise<ProjectionDetail>`, `createProjection(userId, input): Promise<ProjectionDetail>`, `updateProjection(userId, id, input): Promise<ProjectionDetail>`, `deleteProjection(userId, id): Promise<void>`, `calculateProjection(userId, id): Promise<ProjectionDetail>`. Exports `ProjectionListItem`, `ProjectionDetail`, `CreateProjectionInput`, `UpdateProjectionInput`, `PaginationParams`, `PaginatedResult<T>` interfaces.
- **Dependencies:** Internal: `db/connection.js`, `middleware/error-handler.js`, `utils/redis.js`, `services/projection-transformer.js`, `@retireops/calculation-engine` (runProjection). External: none.
- **Hardcoded constants:** Cache TTL default `3600` seconds (1 hour) via `setCache`. Cache key pattern `projection:{id}` invalidated by `deleteCachePattern` on update/delete.
- **Notes:** `calculateProjection` calls `runProjection()` synchronously inline — this is the dual-path: API calls it synchronously; the worker also calls it asynchronously via BullMQ. `runProjection` result is stored as `result_data` JSONB in `projections` table. Authorization enforced: `AuthorizationError` thrown if `projection.user_id !== userId`.

### `packages/api/src/services/projection-transformer.ts`

- **Purpose:** **KEY ADAPTER** — transforms between the frontend wizard input shape (`FrontendInputData`) and the calculation engine input (`ProjectionInput`), and back for output.
- **Inputs:** `FrontendInputData` (wizard shape), `ProjectionOutput` / `CoupleProjectionOutput` (engine output).
- **Outputs:** `transformToProjectionInput(input: FrontendInputData): ProjectionInput`, `transformToFrontendOutput(output, input): FrontendResultData`, `transformToProjectionYearRows(results, input): ProjectionYearRow[]` (exported for Phase 26 consumption). Exports interfaces: `FrontendInputData`, `FrontendResultData`, `FrontendSummary`, `FrontendYearlyResult`.
- **Dependencies:** Internal: none. External: `@retireops/shared` (ProjectionInput, ProjectionOutput, ProjectionYearRow, etc.), `@retireops/calculation-engine` (CoupleProjectionOutput).
- **Hardcoded constants:** `FrontendInputData.personalInfo.maritalStatus` maps `'commonLaw'` → `'common_law'`, `'divorced'` → `'single'`, `'widowed'` → `'single'` in transformer. Account type mapping: wizard `'RRSP'` → engine `'rrsp'`, etc. Default `investmentReturnRate: 0.05` when not provided.
- **Notes:** `FrontendInputData` is the wizard shape — camelCase account types, marital status values that differ from engine types. `transformToProjectionInput` bridges this gap. `transformToProjectionYearRows` is consumed by `profile-scenario.service.ts` for the `projectionRows` field. This file is the primary coupling point between frontend data model and engine contracts.

### `packages/api/src/services/profile.service.ts`

- **Purpose:** Household profile CRUD — get, create-or-upsert, step upsert with JSONB merge-patch; coordinates with scenario stale-marking on profile edit.
- **Inputs:** `userId: string`, `step: StepSlug`, `data: Record<string, unknown> | unknown[]`, `currentStep: number`.
- **Outputs:** `getProfile(userId): Promise<ProfileData>`, `getOrCreateProfile(userId): Promise<ProfileData>`, `upsertProfileStep(userId, step, data, currentStep): Promise<ProfileData>`. Exports `ProfileData { id, stepData, currentStep, createdAt, updatedAt }`, `VALID_STEPS` constant, `StepSlug` type.
- **Dependencies:** Internal: `db/connection.js`, `middleware/error-handler.js`, `services/profile-scenario.service.js` (markScenariosStale, recomputeAllScenarios). External: `kysely` (sql).
- **Hardcoded constants:** `VALID_STEPS = ['about_you', 'spouse', 'income', 'accounts', 'debts', 'benefits', 'property_goals']` (7 steps). PostgreSQL `jsonb_set` used for merge-patch via `sql` tag.
- **Notes:** `upsertProfileStep` updates `step_data` key at `stepSlug` path using `jsonb_set` — preserves other step data. On any step upsert, calls `markScenariosStale` then `recomputeAllScenarios` (fire-and-forget) to keep scenario results current. `getProfile` throws `NotFoundError` if no profile exists yet — use `getOrCreateProfile` in wizard flow.

### `packages/api/src/services/profile-assembler.ts`

- **Purpose:** Pure function — `assembleProfileInputData(profile: ProfileData): FrontendInputData` — transforms 7-step wizard `step_data` JSONB into a `FrontendInputData` object consumable by `transformToProjectionInput`.
- **Inputs:** `ProfileData` from `profile.service.ts`.
- **Outputs:** `assembleProfileInputData(profile): FrontendInputData`. No side effects — pure function.
- **Dependencies:** Internal: `services/projection-transformer.js` (FrontendInputData type), `services/profile.service.js` (ProfileData type). External: none.
- **Hardcoded constants:** Default `retirementAge: 65`, `lifeExpectancy: 90`, `province: 'ON'` for incomplete profiles. Default `cppStartAge: 65`, `oasStartAge: 65`. Handles dual-shape detection: income and account step_data may be raw arrays (legacy) or `{ cards: [...] }` (current format).
- **Notes:** All fields optional — partial profiles never throw. Handles both raw array and cards-wrapper shapes (D-03 pitfall). `includeSpouse` flag in `about_you` step gates spouse assembly. Income amounts coerced from `string | number` via `parseFloat`. See `@see .planning/phases/11-profile-data-flow/11-CONTEXT.md - D-03, D-06`.

### `packages/api/src/services/scenario-decisions.ts`

- **Purpose:** Pure function — `applyScenarioDecisions(base: FrontendInputData, decisions: ScenarioDecisions): ScenarioAppliedInput` — applies non-undefined scenario decisions on top of assembled profile data using `structuredClone`.
- **Inputs:** `FrontendInputData` (assembled from profile), `ScenarioDecisions` (from `profile_scenarios.decisions` JSONB).
- **Outputs:** `applyScenarioDecisions(base, decisions): ScenarioAppliedInput`. Exports `ScenarioAppliedInput` interface (extends `FrontendInputData` with 7 strategy fields: `drawdownOrder`, `rrspMeltdown`, `incomeSplitting`, `oasClawbackAvoidance`, `contributionOverrides`, `ageBandReductions`, `legacyTarget`, `inflationRate`).
- **Dependencies:** Internal: `services/projection-transformer.js` (FrontendInputData). External: `@retireops/shared` (ScenarioDecisions).
- **Hardcoded constants:** none — all field applications guarded by `!== undefined`.
- **Notes:** **Critical pattern:** uses `structuredClone(base)` to prevent cross-scenario mutation — each scenario gets an independent deep copy of the base input before decisions are applied (D-08 / Pitfall 6). Spouse timing decisions only applied when `result.spouse !== undefined`. All 8 scenario decision categories wired: timing, tax strategy, savings, spending.

### `packages/api/src/services/profile-scenario.service.ts`

- **Purpose:** Full CRUD for `profile_scenarios` table — list, get, create, rename, clone, delete (with Base guard); plus run projection, compare scenarios, mark stale, and recompute pipeline.
- **Inputs:** `userId: string`, scenario names/IDs, `ScenarioDecisions` partial for decisions update.
- **Outputs:** `listProfileScenarios(userId)`, `getProfileScenario(userId, id)`, `createProfileScenario(userId, name)`, `renameProfileScenario(userId, id, name)`, `cloneProfileScenario(userId, id)`, `deleteProfileScenario(userId, id)`, `updateScenarioDecisions(userId, id, decisions)`, `markScenariosStale(profileId)`, `recomputeAllScenarios(profileId)` (fire-and-forget), `runSingleScenario(userId, id)`, `compareProfileScenarios(userId, ids)`.
- **Dependencies:** Internal: `db/connection.js`, `middleware/error-handler.js`, `services/profile.service.js`, `services/profile-assembler.js`, `services/scenario-decisions.js`, `services/projection-transformer.js`, `utils/logger.js`. External: `@retireops/calculation-engine` (runProjection), `@retireops/shared` (ScenarioDecisions, ScenarioDecisionsSchema).
- **Hardcoded constants:** Clone name suffix `' (copy)'`. Base scenario guard: `deleteProfileScenario` throws `ConflictError` if `is_base = true`. `recomputeAllScenarios` swallows errors per scenario (fire-and-forget). Compare always includes Base Scenario as delta reference even if not in requested IDs.
- **Notes:** `runSingleScenario` flow: `getProfile` → `assembleProfileInputData` → `applyScenarioDecisions` → `transformToProjectionInput` → `runProjection` → `transformToFrontendOutput` → store `result_data`. `compareProfileScenarios` always fetches Base Scenario first to use as delta column. See `@see docs/source-of-truth/10-scenarios.md - SCEN-06, SCEN-07, SCEN-08`.

### `packages/api/src/services/scenario.service.ts`

- **Purpose:** **Legacy** scenario CRUD bound to `projections` FK — create, list, get, update, delete, compare, and create-from-template operations for the legacy `scenarios` table.
- **Inputs:** `userId: string`, `projectionId: string`, scenario creation/update payloads.
- **Outputs:** `listScenarios(userId, projectionId)`, `listAllScenarios(userId)`, `getScenario(userId, projectionId, scenarioId)`, `createScenario(userId, projectionId, input)`, `updateScenario(userId, projectionId, scenarioId, input)`, `deleteScenario(userId, projectionId, scenarioId)`, `compareScenarios(userId, projectionId, scenarioIds)`, `createFromTemplate(userId, projectionId, templateId)`.
- **Dependencies:** Internal: `db/connection.js`, `middleware/error-handler.js`. External: `@retireops/shared` (scenarioTemplates).
- **Hardcoded constants:** `scenarioTemplates` from `@retireops/shared` used for template-based creation.
- **Notes:** **Legacy v1.0-era** — bound to `projections` FK, NOT `household_profiles`. Unclear if actively used from UI in v1.4+ (Research Open Question 4). No projection re-run on scenario CRUD — modifications are stored as JSONB diffs only.

### `packages/api/src/services/reference.service.ts`

- **Purpose:** Returns static reference data — province list and tax bracket data from `PROVINCES` constant and `config_data` table or hardcoded fallback.
- **Inputs:** Optional `year: number` for tax bracket lookup.
- **Outputs:** `getProvinces(): ProvinceList`, `getTaxBrackets(year?): TaxBracketData`.
- **Dependencies:** Internal: `db/connection.js`. External: `@retireops/shared` (PROVINCES, getProvincialTaxTables).
- **Hardcoded constants:** Province data from `@retireops/shared` PROVINCES constant.
- **Notes:** Tax brackets returned directly from shared constants — no DB round-trip needed for current-year data.

### `packages/api/src/services/solver.service.ts`

- **Purpose:** Solver service — wraps solveSingle() with runSingleProjection callback injection, extracts 8 prefill fields from household profile step_data.
- **Inputs:** `SolverInput` (from `@retireops/shared`), `userId: string`.
- **Outputs:** `SolverResult` (from `solveSingle`), `SolverPrefillData | null` (from `getPrefillData`).
- **Dependencies:** Internal: `db/connection.js`. External: `@retireops/calculation-engine` (solveSingle, runSingleProjection), `@retireops/shared` (SolverInput, SolverResult types).
- **Registered:** Phase 53

---

### `packages/api/src/routes/solver.routes.ts`

- **Purpose:** Solver API routes — POST /api/solver (validate + solve) and GET /api/solver/prefill (profile pre-fill extraction).
- **Inputs:** HTTP requests (JSON body for POST, auth token for both).
- **Outputs:** `SolverResult` (POST 200), `SolverPrefillData | null` (GET 200), `UnprocessableEntityError` (POST 422).
- **Dependencies:** Internal: `solver.service.ts`, `middleware/error-handler.js` (UnprocessableEntityError), `auth/middleware.js` (requireAuth). External: `@retireops/shared` (SolverInputSchema).
- **Registered:** Phase 53

---

### utils/

### `packages/api/src/utils/logger.ts`

- **Purpose:** Singleton Winston logger instance for the API — JSON format to file transports; colorized console in non-production.
- **Inputs:** `config.LOG_LEVEL`, `config.NODE_ENV`.
- **Outputs:** Exports `logger: winston.Logger`.
- **Dependencies:** Internal: `config/index.js`. External: `winston`.
- **Hardcoded constants:** Log files: `'logs/error.log'` (errors only), `'logs/combined.log'` (all levels). Max file size `10485760` (10 MB). Max files `5`. Service metadata `{ service: 'retireops-api' }`. Timestamp format `'YYYY-MM-DD HH:mm:ss'`.
- **Notes:** Console transport added only when `NODE_ENV !== 'production'`. All production code must use `logger.*` — never `console.log` (ESLint warns). Numbers and unknowns in template literals must be cast via `String()`.

### `packages/api/src/utils/redis.ts`

- **Purpose:** ioredis client singleton and cache utility functions — get, set (with TTL), delete, delete by pattern.
- **Inputs:** `config.REDIS_URL`.
- **Outputs:** Exports `redis: Redis` (ioredis instance). Exports `getCache<T>(key): Promise<T | null>`, `setCache<T>(key, value, ttlSeconds?): Promise<void>` (default TTL `3600`), `deleteCache(key): Promise<void>`, `deleteCachePattern(pattern): Promise<void>` (uses `redis.keys` then `redis.del`).
- **Dependencies:** Internal: `config/index.js`, `utils/logger.js`. External: `ioredis`.
- **Hardcoded constants:** `maxRetriesPerRequest: 3`. Retry delay: `Math.min(times * 50, 2000)` ms. `lazyConnect: true`. Default cache TTL `3600` seconds. `deleteCachePattern` uses `redis.keys` — not safe for large keyspaces in production.
- **Notes:** Cache errors are swallowed (logged but not thrown) — cache failures do not break the request path. `isAccessTokenBlacklisted` logic is in `auth/jwt.ts` (uses `redis.get` directly), not here.

---

### test/

### `packages/api/src/test/setup.ts`

- **Purpose:** Vitest global test setup — sets `NODE_ENV=test`, provides test JWT secret, and mocks `utils/redis.js` and `utils/logger.js` for all unit tests.
- **Inputs:** none.
- **Outputs:** Side effects: `vi.mock` for `redis` (mockRedis with all methods mocked) and `logger` (all methods mocked). `vi.clearAllMocks()` after each test.
- **Dependencies:** External: `vitest`.
- **Hardcoded constants:** `JWT_SECRET = 'test-secret-key-for-testing-purposes-32chars'` (32 chars to satisfy Zod min). `DATABASE_URL = 'postgresql://test:test@localhost:5432/test'`. `REDIS_URL = 'redis://localhost:6379'`.
- **Notes:** Loaded via `setupFiles` in `vitest.config.ts`. Only applies to unit test config (`vitest.config.ts`), not integration config.

### `packages/api/src/test/integration-setup.ts`

- **Purpose:** Vitest integration test setup — mocks `requireAuth` middleware to inject a fixed test user without real JWT verification.
- **Inputs:** none.
- **Outputs:** `vi.mock` for `auth/middleware.js` — `requireAuth` injects `req.user = { id: 'test-user-id', email: 'test@example.com' }`.
- **Dependencies:** External: `vitest`.
- **Hardcoded constants:** Test user ID `'test-user-id'`, email `'test@example.com'`.
- **Notes:** Loaded only by `vitest.integration.config.ts` via `setupFiles`. Integration tests (`*.integration.test.ts`) must be excluded from the default `vitest.config.ts` to prevent setup conflicts.

### `packages/api/src/test/helpers/mock-db.ts`

- **Purpose:** In-memory Kysely DB mock for unit tests — returns pre-configured result objects from DB query builder chains.
- **Inputs:** Mock data configuration.
- **Outputs:** Mock Kysely `db` instance with stubbed `selectFrom`, `insertInto`, `updateTable`, `deleteFrom`.
- **Dependencies:** External: `vitest`.
- **Hardcoded constants:** none.
- **Notes:** Used by unit tests to avoid PostgreSQL dependency. Pattern: create mock, configure return values, pass to service under test.

### `packages/api/src/test/helpers/test-app.ts`

- **Purpose:** `createTestApp()` factory for integration tests — creates a configured Express app with mocked auth middleware.
- **Inputs:** none.
- **Outputs:** `createTestApp(): Express` — full Express app (from `createApp()`) but with `requireAuth` mocked.
- **Dependencies:** Internal: `app.js`. External: `vitest`, `supertest`.
- **Hardcoded constants:** none.
- **Notes:** Used with `supertest` for HTTP-level integration testing. Relies on `integration-setup.ts` having already mocked `requireAuth`.

### `packages/api/src/test/fixtures/projection-inputs.ts`

- **Purpose:** Standard `FrontendInputData` test fixture — a complete wizard input for a single person with all required fields populated.
- **Inputs:** none.
- **Outputs:** Exported fixture object(s) — `FrontendInputData` shape.
- **Dependencies:** Internal: `services/projection-transformer.js` (FrontendInputData type). External: none.
- **Hardcoded constants:** Fixture values: DOB, province, retirement age, accounts, income, expenses, government benefits.
- **Notes:** Used by unit and integration tests for projection service and transformer tests.

### `packages/api/src/test/fixtures/projection-expected.ts`

- **Purpose:** Golden-file fixture of expected `ProjectionOutput` — pre-computed expected results for the standard fixture input.
- **Inputs:** none.
- **Outputs:** Exported expected output object — `ProjectionOutput` shape.
- **Dependencies:** Internal: none. External: `@retireops/shared`.
- **Hardcoded constants:** Pre-computed numeric output values.
- **Notes:** Golden-file pattern — if engine changes affect output, this fixture must be updated. Discrepancy between fixture and actual output indicates a regression.

---

### API Package Summary

- **Total files documented:** 34 (entry/config: 4, auth: 3, db: 3, middleware: 5, routes: 9, services: 11, utils: 2, test: 5, test fixtures: 2)
- **DB tables:** 12 tables (`users`, `oauth_providers`, `user_settings`, `refresh_tokens`, `projections`, `scenarios`, `accounts`, `income_sources`, `config_data`, `monte_carlo_jobs`, `household_profiles`, `profile_scenarios`)
- **Auth:** JWT HS256 access tokens (15m expiry), 128-char hex refresh tokens stored as bcrypt hashes, Redis blacklist (`token:blacklist:` prefix)
- **Logging:** Winston to `logs/error.log` and `logs/combined.log`, max 10MB per file, 5 rotation files
- **Validation:** Zod middleware factory (`validate(schemas)`) wraps all route handlers
- **Test configs:** Two Vitest configs — `vitest.config.ts` (unit, excludes `*.integration.test.ts`) and `vitest.integration.config.ts` (integration, uses real Express app + mock auth)
- **Key design:** `projection-transformer.ts` is the boundary between frontend wizard data and engine contracts; `profile-assembler.ts` + `scenario-decisions.ts` + `profile-scenario.service.ts` form the profile→scenario→engine pipeline (v1.3+)

---

## Package: @retireops/web

Root: `packages/web/src/`

Next.js 14 App Router SPA. Depends only on `@retireops/shared` (never imports `calculation-engine` directly). Communicates exclusively with `@retireops/api` via REST. Two multi-step wizards: Profile (7 steps) and Projection (6 steps). Auto-save debounce 800ms. shadcn/ui + Tailwind only.

---

### app/ (Next.js App Router pages)

### `packages/web/src/app/layout.tsx`

- **Purpose:** Root HTML shell — applies Inter + Manrope fonts via CSS variables, mounts `Toaster`, sets language and hydration suppression.
- **Inputs:** `children: React.ReactNode`.
- **Outputs:** Root `<html>` / `<body>` tree with global CSS and font class vars.
- **Dependencies:** Internal: `lib/fonts.js`, `components/ui/toaster.js`. External: `next` (Metadata).
- **Hardcoded constants:** Font class vars `inter.variable`, `manrope.variable`.
- **Notes:** File-level `eslint-disable` for `restrict-template-expressions` and `no-unsafe-member-access` (Next.js metadata type).

### `packages/web/src/app/page.tsx`

- **Purpose:** Landing page (`/`) — marketing content, CTA links to `/register` and `/login`.
- **Inputs:** None.
- **Outputs:** Static marketing page render.
- **Dependencies:** Internal: `components/LegalLinks.js`, `components/LegalNotice.js`. External: `next/link`.
- **Hardcoded constants:** CTA text, tagline strings.
- **Notes:** Server component. Not behind auth.

### `packages/web/src/app/privacy/page.tsx`

- **Purpose:** Privacy policy static page (`/privacy`).
- **Inputs:** None.
- **Outputs:** Static HTML render.
- **Dependencies:** None.
- **Hardcoded constants:** none.
- **Notes:** Server component.

### `packages/web/src/app/terms/page.tsx`

- **Purpose:** Terms of service static page (`/terms`).
- **Inputs:** None.
- **Outputs:** Static HTML render.
- **Dependencies:** None.
- **Hardcoded constants:** none.
- **Notes:** Server component.

### `packages/web/src/app/(auth)/layout.tsx`

- **Purpose:** Auth route group layout (`/login`, `/register`) — centers card on screen, no sidebar navigation.
- **Inputs:** `children: React.ReactNode`.
- **Outputs:** Centered container layout.
- **Dependencies:** None.
- **Hardcoded constants:** none.
- **Notes:** Server component. Route group `(auth)` does not affect URL path.

### `packages/web/src/app/(auth)/login/page.tsx`

- **Purpose:** Login page (`/login`) — email/password form plus Google OAuth button; stores tokens to `localStorage` on success; redirects to `/dashboard`.
- **Inputs:** URL search params (`redirect?`).
- **Outputs:** Rendered login form; `POST /api/auth/login` on submit.
- **Dependencies:** Internal: `lib/api/client.js`. External: `react-hook-form`, `next/navigation`.
- **Hardcoded constants:** Redirect default `/dashboard`.
- **Notes:** Client component (`'use client'`). Tokens stored directly in `localStorage` (no context or cookie).

### `packages/web/src/app/(auth)/register/page.tsx`

- **Purpose:** Registration page (`/register`) — name, email, password form; `POST /api/auth/register`; auto-logs-in on success.
- **Inputs:** None.
- **Outputs:** Rendered registration form.
- **Dependencies:** Internal: `lib/api/client.js`. External: `react-hook-form`.
- **Hardcoded constants:** none.
- **Notes:** Client component.

### `packages/web/src/app/(auth)/callback/google/page.tsx`

- **Purpose:** Google OAuth redirect callback (`/callback/google`) — extracts `code` from URL, calls `POST /api/auth/google/callback`, stores tokens, redirects to `/dashboard`.
- **Inputs:** URL search param `code` from Google OAuth redirect.
- **Outputs:** Side effect: token storage + redirect.
- **Dependencies:** Internal: `lib/api/client.js`. External: `next/navigation`.
- **Hardcoded constants:** Redirect target `/dashboard`.
- **Notes:** Client component. Handles error state (invalid code) by redirecting to `/login`.

### `packages/web/src/app/(dashboard)/layout.tsx`

- **Purpose:** Dashboard route group layout — persistent sidebar navigation, top bar; wraps all `/dashboard`, `/projections`, `/profile`, `/settings` routes.
- **Inputs:** `children: React.ReactNode`.
- **Outputs:** Layout with nav sidebar + main content area.
- **Dependencies:** Internal: `lib/api/client.js` (auth check). External: `next/navigation`, `lucide-react`.
- **Hardcoded constants:** Nav link paths (`/dashboard`, `/projections`, `/profile`, etc.).
- **Notes:** Client component. Performs auth guard — redirects to `/login` if no `accessToken` in localStorage.

### `packages/web/src/app/(dashboard)/dashboard/page.tsx`

- **Purpose:** Dashboard home page (`/dashboard`) — landing view after login.
- **Inputs:** None.
- **Outputs:** Dashboard overview render.
- **Dependencies:** Internal: `lib/api/client.js`, `hooks/useProjections.js`. External: `next/link`.
- **Hardcoded constants:** none.
- **Notes:** Client component.

### `packages/web/src/app/(dashboard)/projections/page.tsx`

- **Purpose:** Projection list page (`/projections`) — lists all user projections from `GET /api/projections`; delete, view, create actions.
- **Inputs:** None.
- **Outputs:** Paginated projection list with AlertDialog delete confirm.
- **Dependencies:** Internal: `lib/api/projections.js`, `hooks/useProjections.js`, `components/ui/alert-dialog.js`. External: `next/link`.
- **Hardcoded constants:** none.
- **Notes:** Client component.

### `packages/web/src/app/(dashboard)/projections/view/page.tsx`

- **Purpose:** Projections view page — scenario selector dropdown, state machine (loading/empty/pending/loaded), AbortController race-condition guard
- **Inputs:** None (page component, fetches data on mount)
- **Outputs:** Rendered page at `/projections/view`
- **Dependencies:**
  - `@/lib/api/profile-scenarios` — `listProfileScenarios()`, `getProfileScenario()`
  - `@/components/projection/results/YearByYearTab` — table component (used as-is)
  - `@/components/ui/select` — shadcn Select dropdown
  - `@/types/profile-scenario` — `ProfileScenarioListItem`, `ProfileScenarioDetail`
  - `@retireops/shared` — `ProjectionYearRow` type
- **Hardcoded constants:** None
- **Notes:** Client component. Added Phase 30 (v1.6).

### `packages/web/src/app/(dashboard)/projections/new/page.tsx`

- **Purpose:** New projection wizard page (`/projections/new`) — renders `ProjectionWizardForm`.
- **Inputs:** None.
- **Outputs:** Renders `<ProjectionWizardForm>`.
- **Dependencies:** Internal: `components/projection/ProjectionWizardForm.js`.
- **Hardcoded constants:** none.
- **Notes:** Client component (defers to wizard form).

### `packages/web/src/app/(dashboard)/projections/[id]/page.tsx`

- **Purpose:** Projection results page (`/projections/:id`) — fetches projection detail; renders Summary, Charts, Year-by-Year, Scenarios tabs via `<Tabs>`.
- **Inputs:** URL param `id` (projection UUID).
- **Outputs:** Multi-tab results view.
- **Dependencies:** Internal: `lib/api/projections.js`, `components/projection/results/SummaryTab.js`, `ChartsTab.js`, `YearByYearTab.js`, `ScenariosTab.js`. External: `next/navigation`.
- **Hardcoded constants:** none.
- **Notes:** Client component.

### `packages/web/src/app/(dashboard)/projections/[id]/edit/page.tsx`

- **Purpose:** Edit existing projection page (`/projections/:id/edit`) — renders `ProjectionWizardForm` pre-populated with existing data.
- **Inputs:** URL param `id`.
- **Outputs:** Renders `<ProjectionWizardForm>` in edit mode.
- **Dependencies:** Internal: `lib/api/projections.js`, `components/projection/ProjectionWizardForm.js`.
- **Hardcoded constants:** none.
- **Notes:** Client component.

### `packages/web/src/app/(dashboard)/profile/scenarios/page.tsx`

- **Purpose:** Profile scenario list page (`/profile/scenarios`) — renders `ScenarioList` component.
- **Inputs:** None.
- **Outputs:** Renders `<ScenarioList>`.
- **Dependencies:** Internal: `components/projection/results/scenarios/ScenarioList.js`.
- **Hardcoded constants:** none.
- **Notes:** Client component.

### `packages/web/src/app/(dashboard)/profile/scenarios/[id]/results/page.tsx`

- **Purpose:** Single scenario results page (`/profile/scenarios/:id/results`) — fetches scenario detail, renders Summary, Charts, Year-by-Year tabs for that scenario.
- **Inputs:** URL param `id` (scenario UUID).
- **Outputs:** Scenario-specific results tabs.
- **Dependencies:** Internal: `lib/api/profile-scenarios.js`, `components/projection/results/SummaryTab.js`, `ChartsTab.js`, `YearByYearTab.js`.
- **Hardcoded constants:** none.
- **Notes:** Client component.

### `packages/web/src/app/(dashboard)/profile/scenarios/[id]/edit/page.tsx`

- **Purpose:** Edit scenario decisions page (`/profile/scenarios/:id/edit`) — form for 4-category scenario decisions (Timing, Tax Strategy, Savings, Spending).
- **Inputs:** URL param `id`.
- **Outputs:** Decisions edit form; `PUT /api/profile/scenarios/:id/decisions` on save.
- **Dependencies:** Internal: `lib/api/profile-scenarios.js`. External: `react-hook-form`, `@retireops/shared` (ScenarioDecisionsSchema).
- **Hardcoded constants:** none.
- **Notes:** Client component.

### `packages/web/src/app/(dashboard)/profile/scenarios/compare/page.tsx`

- **Purpose:** Scenario comparison page (`/profile/scenarios/compare`) — multi-scenario side-by-side comparison via `ComparisonView`.
- **Inputs:** URL search params (`ids[]` — comma-separated scenario UUIDs).
- **Outputs:** Renders `<ComparisonView>`.
- **Dependencies:** Internal: `lib/api/profile-scenarios.js`, `components/projection/results/scenarios/ComparisonView.js`.
- **Hardcoded constants:** none.
- **Notes:** Client component.

### `packages/web/src/app/(dashboard)/scenarios/page.tsx`

- **Purpose:** **Legacy** projection-based scenarios page (`/scenarios`) — routes from pre-v1.3 era, bound to `projections` FK scenarios. May be unreachable from current navigation.
- **Inputs:** None.
- **Outputs:** Legacy scenario list render.
- **Dependencies:** Internal: `lib/api/scenarios.js`.
- **Hardcoded constants:** none.
- **Notes:** **Legacy flag** — research Open Question 4. Likely unreachable from v1.4+ UI navigation.

### `packages/web/src/app/(dashboard)/reports/page.tsx`

- **Purpose:** Reports page (`/reports`) — scaffold/placeholder.
- **Inputs:** None.
- **Outputs:** Placeholder render.
- **Dependencies:** None.
- **Hardcoded constants:** none.
- **Notes:** Not yet implemented. UI stub.

### `packages/web/src/app/(dashboard)/settings/page.tsx`

- **Purpose:** User settings page (`/settings`) — allows editing province, DOB, spouse info; calls `PUT /api/users/settings`.
- **Inputs:** None.
- **Outputs:** Settings form render.
- **Dependencies:** Internal: `lib/api/client.js`. External: `react-hook-form`.
- **Hardcoded constants:** none.
- **Notes:** Client component.

### `packages/web/src/app/(profile-wizard)/profile/layout.tsx`

- **Purpose:** Profile wizard route group layout — no sidebar, full-screen wizard layout; server component.
- **Inputs:** `children: React.ReactNode`.
- **Outputs:** Full-screen layout (no nav sidebar).
- **Dependencies:** None.
- **Hardcoded constants:** none.
- **Notes:** Server component. Route group `(profile-wizard)` removes the dashboard sidebar for the wizard experience.

### `packages/web/src/app/(profile-wizard)/profile/page.tsx`

- **Purpose:** Profile wizard page (`/profile`) — mounts `ProfileWizardShell`.
- **Inputs:** URL search param `step?` (optional step index for navigation).
- **Outputs:** Renders `<ProfileWizardShell>`.
- **Dependencies:** Internal: `components/profile/ProfileWizardShell.js`.
- **Hardcoded constants:** none.
- **Notes:** Client component.

---

### components/profile/

### `packages/web/src/components/profile/ProfileWizardShell.tsx`

- **Purpose:** 7-step profile wizard shell — manages form state via RHF `useForm` with `zodResolver`-less schema (validated server-side). `watch()` subscription triggers auto-save with 800ms debounce (`useDebouncedCallback`). Navigation via `navigateToStep()` — calls `bootstrapProfileStep` (API PATCH) before mounting next step.
- **Inputs:** None (fetches profile from `GET /api/profile` on mount).
- **Outputs:** Renders current step component; orchestrates PATCH /api/profile/:step on field changes.
- **Dependencies:** Internal: `lib/api/profile.js` (getProfile, patchProfileStep, runProjectionFromProfile), step components, `components/profile/lib/profile-constants.js`, `ProfileStepperSidebar.js`, `ProfileSaveIndicator.js`. External: `react-hook-form`, `use-debounce`, `lucide-react`, `next/navigation`.
- **Hardcoded constants:** Auto-save debounce: `800ms`. Step count: 7.
- **Notes:** `useFieldArray` uses `keyName: 'rhfKey'` (not default `'id'`) to avoid collisions with server IDs. `watch()` subscription fires on every form change — debounce prevents excessive API calls. `bootstrapProfileStep` ensures profile row exists before wizard renders. File-level `eslint-disable` for multiple `no-unsafe-*` rules.

### `packages/web/src/components/profile/ProfileWizardShell.test.tsx`

- **Purpose:** Unit tests for `ProfileWizardShell` — mocks API, verifies step rendering and auto-save behaviour.
- **Inputs:** Vitest + mocked `lib/api/profile`.
- **Outputs:** Test assertions.
- **Dependencies:** External: `vitest`, `@testing-library/react`.
- **Hardcoded constants:** Test fixture profile data.
- **Notes:** Co-located with the component under test.

### `packages/web/src/components/profile/ProfileStepperSidebar.tsx`

- **Purpose:** Step progress sidebar — displays step list with current/complete/incomplete states; allows click-navigation to any step.
- **Inputs:** `currentStep: number`, `steps: StepConfig[]`, `onNavigate: (step: number) => void`.
- **Outputs:** Sidebar step list render.
- **Dependencies:** Internal: `components/profile/lib/profile-constants.js`. External: `lucide-react`.
- **Hardcoded constants:** none.
- **Notes:** Pure display component.

### `packages/web/src/components/profile/ProfileSaveIndicator.tsx`

- **Purpose:** Save status badge — shows `'saving'`, `'saved'`, or `'error'` state from `SaveState`.
- **Inputs:** `state: SaveState`.
- **Outputs:** Colored badge with icon.
- **Dependencies:** Internal: `components/ui/badge.js`. External: `lucide-react`.
- **Hardcoded constants:** none.
- **Notes:** Receives `SaveState` from parent (`ProfileWizardShell`).

### `packages/web/src/components/profile/CollapsibleCard.tsx`

- **Purpose:** Reusable collapsible card for Income/Accounts/Debts step item lists — `forwardRef<HTMLDivElement>`, expand/collapse toggle, AlertDialog for delete confirmation.
- **Inputs:** `title: string`, `isOpen: boolean`, `onToggle: () => void`, `onDelete: () => void`, `children: React.ReactNode`.
- **Outputs:** Collapsible card with delete confirm dialog.
- **Dependencies:** Internal: `components/ui/collapsible.js`, `components/ui/alert-dialog.js`. External: `lucide-react`.
- **Hardcoded constants:** none.
- **Notes:** Uses `forwardRef` for compatibility with RHF field array refs.

### `packages/web/src/components/profile/DefaultBadge.tsx`

- **Purpose:** "Default" badge — indicates Base Scenario in scenario list.
- **Inputs:** None (or optional `className`).
- **Outputs:** Small badge render.
- **Dependencies:** Internal: `components/ui/badge.js`.
- **Hardcoded constants:** Badge text `"Default"`.
- **Notes:** Purely cosmetic.

### `packages/web/src/components/profile/steps/AboutYouStep.tsx`

- **Purpose:** Profile wizard Step 1 — DOB, province, gender, marital status, retirement age (min 50), life expectancy, include-spouse toggle.
- **Inputs:** RHF form context (`about_you` field group).
- **Outputs:** Form fields render.
- **Dependencies:** Internal: `components/ui/input.js`, `select.js`, `checkbox.js`, `components/profile/lib/profile-constants.js`. External: `react-hook-form`.
- **Hardcoded constants:** Retirement age min: `50`. Life expectancy default: `95`. Province options from `@retireops/shared` `PROVINCES`.
- **Notes:** Min retirement age intentionally `50` here vs `55` in projection wizard (STEP-01 / STEP-02 in v1.2 design spec). File-level `eslint-disable`.

### `packages/web/src/components/profile/steps/SpouseStep.tsx`

- **Purpose:** Profile wizard Step 2 — spouse DOB, province, retirement age, life expectancy. Always mounted (mount-but-hide pattern per D-14) to preserve RHF registration.
- **Inputs:** RHF form context (`spouse` field group), `includeSpouse: boolean` (from `about_you` watch).
- **Outputs:** Form fields (hidden when `!includeSpouse`).
- **Dependencies:** Internal: `components/ui/input.js`, `select.js`, `components/profile/lib/profile-constants.js`. External: `react-hook-form`.
- **Hardcoded constants:** none.
- **Notes:** Mount-but-hide (not conditional unmount) ensures RHF keeps field registration. See `.planning/phases/11-profile-data-flow/11-CONTEXT.md - D-14`.

### `packages/web/src/components/profile/steps/IncomeStep.tsx`

- **Purpose:** Profile wizard Step 3 — dynamic card collection for income sources using `useFieldArray` with `keyName: 'rhfKey'`; `_serverId` pattern preserves server IDs across RHF operations.
- **Inputs:** RHF form context (`income` field group).
- **Outputs:** Card list render with add/remove actions.
- **Dependencies:** Internal: `CollapsibleCard.js`, `components/profile/lib/profile-constants.js`. External: `react-hook-form`.
- **Hardcoded constants:** Income type options list.
- **Notes:** `keyName: 'rhfKey'` required because field objects have an `id` property from the server; using default `'id'` would conflict. `_serverId` tracks the server-assigned UUID through RHF operations. File-level `eslint-disable`.

### `packages/web/src/components/profile/steps/AccountsStep.tsx`

- **Purpose:** Profile wizard Step 4 — card collection for financial accounts (RRSP, TFSA, RRIF, non-reg, etc.). RESP displayed under primary only (no belongs-to select for RESP).
- **Inputs:** RHF form context (`accounts` field group).
- **Outputs:** Card list render.
- **Dependencies:** Internal: `CollapsibleCard.js`, `components/profile/lib/profile-constants.js`. External: `react-hook-form`.
- **Hardcoded constants:** Account type options. RESP limited to primary owner.
- **Notes:** File-level `eslint-disable`.

### `packages/web/src/components/profile/steps/DebtsStep.tsx`

- **Purpose:** Profile wizard Step 5 — household-level debt card collection (no belongs-to field). Mortgage extras (amortization, payment frequency) conditionally shown when `type === 'mortgage'` via `watch`.
- **Inputs:** RHF form context (`debts` field group).
- **Outputs:** Card list render.
- **Dependencies:** Internal: `CollapsibleCard.js`, `components/profile/lib/profile-constants.js`. External: `react-hook-form`.
- **Hardcoded constants:** Debt type options. Mortgage-conditional fields list.
- **Notes:** File-level `eslint-disable`.

### `packages/web/src/components/profile/steps/BenefitsStep.tsx`

- **Purpose:** Profile wizard Step 6 — CPP/OAS start ages, expected CPP amounts at 65, DB pension entries, per-person sections (primary + spouse if included).
- **Inputs:** RHF form context (`benefits` field group), `includeSpouse: boolean`.
- **Outputs:** Per-person benefits form sections.
- **Dependencies:** Internal: `components/ui/input.js`, `select.js`, `components/profile/lib/profile-constants.js`. External: `react-hook-form`.
- **Hardcoded constants:** CPP start age min `60` max `70`. OAS start age min `65` max `70`.
- **Notes:** Renders spouse section only when `includeSpouse`. File-level `eslint-disable`.

### `packages/web/src/components/profile/steps/PropertyGoalsStep.tsx`

- **Purpose:** Profile wizard Step 7 — property entries and financial goal card collections.
- **Inputs:** RHF form context (`property_goals` field group).
- **Outputs:** Card list render.
- **Dependencies:** Internal: `CollapsibleCard.js`, `components/profile/lib/profile-constants.js`. External: `react-hook-form`.
- **Hardcoded constants:** Goal type options.
- **Notes:** File-level `eslint-disable`.

### `packages/web/src/components/profile/lib/profile-constants.ts`

- **Purpose:** Shared style constants and type definitions for profile wizard steps — `INPUT_STYLE`, `SELECT_TRIGGER_STYLE` CSS class strings, `ALL_STEPS` config array, `EMPTY_PROFILE_DEFAULTS` RHF default values, card type definitions.
- **Inputs:** None.
- **Outputs:** Exported constants: `INPUT_STYLE: string`, `SELECT_TRIGGER_STYLE: string`, `ALL_STEPS: StepConfig[]`, `EMPTY_PROFILE_DEFAULTS`. Exported types: `IncomeCard`, `AccountCard`, `DebtCard`, `PensionCard`, `PropertyCard`, `GoalCard`, `SaveState`, `StepConfig`.
- **Dependencies:** None.
- **Hardcoded constants:** Tailwind class strings for input/select styling. Step slugs: `['about_you', 'spouse', 'income', 'accounts', 'debts', 'benefits', 'property_goals']`.
- **Notes:** Centralises repeated Tailwind class strings to avoid divergence across step components.

---

### components/projection/

### `packages/web/src/components/projection/ProjectionWizardForm.tsx`

- **Purpose:** 6-step projection wizard — RHF `useForm` with `zodResolver(projectionSchema)`. Steps: Personal, Spouse, Accounts, Income, Expenses, Review. On submit: `POST /api/projections` to create, then `POST /api/projections/:id/calculate` to run; redirects to results page.
- **Inputs:** Optional `initialData` for edit mode.
- **Outputs:** Multi-step wizard render; creates/updates projection and runs calculation.
- **Dependencies:** Internal: `lib/projection-form.js` (projectionSchema, projectionSteps), `lib/api/projections.js`, all `steps/*.js`. External: `react-hook-form`, `@hookform/resolvers/zod`, `next/navigation`.
- **Hardcoded constants:** 6 steps. API call sequence: create then calculate.
- **Notes:** File-level `eslint-disable`. `errors.expenses` optional chaining (known bug fix — see MEMORY.md).

### `packages/web/src/components/projection/steps/PersonalInfoStep.tsx`

- **Purpose:** Projection wizard Step 1 — DOB, province, retirement age (min 55), life expectancy.
- **Inputs:** RHF form context (`personalInfo` field group).
- **Outputs:** Personal info form render.
- **Dependencies:** Internal: `components/ui/input.js`, `select.js`, `components/profile/lib/profile-constants.js`. External: `react-hook-form`.
- **Hardcoded constants:** Retirement age min: `55`. Life expectancy default: `95`.
- **Notes:** Min `55` intentionally differs from profile wizard's `50` (STEP-01 / STEP-02). File-level `eslint-disable`.

### `packages/web/src/components/projection/steps/SpouseInfoStep.tsx`

- **Purpose:** Projection wizard Step 2 — spouse DOB, province, retirement age, CPP/OAS start ages, account balances for spouse.
- **Inputs:** RHF form context (`spouse` field group), conditional render controlled by parent.
- **Outputs:** Spouse input form.
- **Dependencies:** Internal: `components/ui/input.js`, `select.js`. External: `react-hook-form`.
- **Hardcoded constants:** none.
- **Notes:** Conditional rendering (not mount-but-hide) — simplified compared to profile wizard. File-level `eslint-disable`.

### `packages/web/src/components/projection/steps/AccountsStep.tsx`

- **Purpose:** Projection wizard Step 3 — RRSP, TFSA, RRIF, non-registered balances and annual contributions.
- **Inputs:** RHF form context (`accounts` field group).
- **Outputs:** Account balance/contribution form.
- **Dependencies:** Internal: `components/ui/input.js`. External: `react-hook-form`.
- **Hardcoded constants:** Account type display names.
- **Notes:** Simpler than profile wizard AccountsStep (no card collection — flat fields per account type). File-level `eslint-disable`.

### `packages/web/src/components/projection/steps/IncomeStep.tsx`

- **Purpose:** Projection wizard Step 4 — employment income, CPP/OAS start ages, expected CPP amounts.
- **Inputs:** RHF form context (`income` field group).
- **Outputs:** Income input form.
- **Dependencies:** Internal: `components/ui/input.js`, `MilestoneSlider.js`. External: `react-hook-form`.
- **Hardcoded constants:** CPP start age range `[60, 70]`, OAS `[65, 70]`.
- **Notes:** File-level `eslint-disable`.

### `packages/web/src/components/projection/steps/ExpensesStep.tsx`

- **Purpose:** Projection wizard Step 5 — current annual expenses and retirement annual expenses.
- **Inputs:** RHF form context (`expenses` field group).
- **Outputs:** Expense input form.
- **Dependencies:** Internal: `components/ui/input.js`. External: `react-hook-form`.
- **Hardcoded constants:** none.
- **Notes:** Known bug fix: `(errors.expenses as Record<...>)?.currentAnnualExpenses` uses optional chaining because `errors.expenses` can be `undefined` (see MEMORY.md). File-level `eslint-disable`.

### `packages/web/src/components/projection/steps/MilestoneSlider.tsx`

- **Purpose:** Range slider for age milestones (retirement age, CPP start age, OAS start age) — renders a labelled range `<input type="range">`.
- **Inputs:** `min: number`, `max: number`, `value: number`, `onChange: (v: number) => void`, `label: string`.
- **Outputs:** Slider render.
- **Dependencies:** None.
- **Hardcoded constants:** none (min/max passed as props).
- **Notes:** Thin wrapper — no shadcn dependency.

### `packages/web/src/components/projection/steps/ReviewStep.tsx`

- **Purpose:** Projection wizard Step 6 — read-only summary of all inputs before submission.
- **Inputs:** RHF `getValues()` via form context.
- **Outputs:** Summary display.
- **Dependencies:** External: `react-hook-form`.
- **Hardcoded constants:** none.
- **Notes:** File-level `eslint-disable`.

### `packages/web/src/components/projection/results/FundedStatusIndicator.tsx`

- **Purpose:** Green/Yellow/Red funded-status banner rendered at the top of the Projections Results page's Summary tab. Consumes a `FundedStatus` object and an optional `RemediationPlan` (Phase 48 always `null`; Phase 49 populates for Red projections).
- **Inputs:** Props `{ fundedStatus: FundedStatus; remediationPlan: RemediationPlan | null }`. Types imported from `@retireops/shared`.
- **Outputs:** JSX banner with state-specific colour, title, and body. Red state also renders depletion age interpolated from `fundedStatus.depletionAge`. Remediation section renders `null` when `remediationPlan === null` (Phase 49 fills three suggestion lines).
- **Dependencies:** Internal: `lib/utils.js` (formatCurrency / toLocaleString helper if present). External: `@retireops/shared` (types only), shadcn/ui + Tailwind (existing design system — no new deps).
- **Hardcoded constants:** Banner copy per `data-model.md §New Component` state machine table. Fixed 10% buffer language in Yellow copy.
- **Notes:** File-level `eslint-disable` if needed following CLAUDE.md convention. Above-the-fold requirement (FUND-09) enforced by placement in `SummaryTab.tsx` — this component does not self-scroll. Added in Phase 48 (v1.11).

### `packages/web/src/components/projection/results/SummaryTab.tsx`

- **Purpose:** Projection result Summary tab — displays peak net worth, longevity success, estimated taxes, and key metrics from `FrontendResultData.summary`.
- **Inputs:** `result: FrontendResultData`.
- **Outputs:** Summary metrics render.
- **Dependencies:** Internal: `lib/utils.js` (formatCurrency). External: none.
- **Hardcoded constants:** none.
- **Notes:** File-level `eslint-disable`.

### `packages/web/src/components/projection/results/ChartsTab.tsx`

- **Purpose:** Projection result Charts tab — Recharts line/bar charts of net worth, income breakdown, tax, and account balances over time.
- **Inputs:** `result: FrontendResultData`.
- **Outputs:** Chart renders.
- **Dependencies:** Internal: `lib/utils.js`. External: `recharts`.
- **Hardcoded constants:** `COLORS.primary` maps to `ds-primary` (forest green), `COLORS.green` maps to `ds-primary-fixed-dim`.
- **Notes:** File-level `eslint-disable`.

### `packages/web/src/components/projection/results/YearByYearTab.tsx`

- **Purpose:** Dense HTML table displaying `ProjectionYearRow[]` — all 47 fields grouped by category (Income, Taxes, Spending, Balances). Column group toggle pills. Couple-aware (shows spouse columns when `spouseAge` present in row). Sparse column detection hides GIS and LIF columns when all values are zero.
- **Inputs:** `rows: ProjectionYearRow[]`.
- **Outputs:** Scrollable table render with toggle pills for column categories.
- **Dependencies:** Internal: `lib/utils.js`. External: `@retireops/shared` (ProjectionYearRow type).
- **Hardcoded constants:** Column group names, toggle pill labels.
- **Notes:** Couple-aware via `row.spouseAge !== undefined`. Depletion row flagged red. Retirement year flagged. File-level `eslint-disable`.

### `packages/web/src/components/projection/results/NetWorthLineChart.tsx`

**Purpose:** Recharts LineChart component showing household net worth trajectory year-by-year for a single scenario.

**Inputs:**

- `projectionRows: ProjectionYearRow[]` — from `@retireops/shared`

**Outputs:**

- Renders a shadcn Card containing a Recharts `LineChart` with `year` on x-axis, `householdNetWorth` on y-axis

**Dependencies:**

- `recharts` (LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer)
- `@/components/ui/card` (Card, CardHeader, CardTitle, CardContent)
- `@retireops/shared` (ProjectionYearRow type)

**Hardcoded Constants:**

- Y-axis format thresholds: 1,000,000 (M), 1,000 (K)
- Tooltip currency: `en-CA`, `CAD`
- Line stroke: `hsl(var(--ds-primary))`
- Container height: `h-80` (320px)

**Notes:**

- Must be imported via `next/dynamic` with `{ ssr: false }` — `ResponsiveContainer` requires browser DOM
- Named export only (no default export) — dynamic import must use `.then((m) => ({ default: m.NetWorthLineChart }))`
- Added in Phase 32

### `packages/web/src/components/projection/results/ScenariosTab.tsx`

- **Purpose:** Scenarios tab within projection results — embeds `ScenarioList` component.
- **Inputs:** None (fetches via child component).
- **Outputs:** Renders `<ScenarioList>`.
- **Dependencies:** Internal: `results/scenarios/ScenarioList.js`.
- **Hardcoded constants:** none.
- **Notes:** Thin wrapper tab.

### `packages/web/src/components/projection/results/MonteCarloPanel.tsx`

- **Purpose:** Monte Carlo simulation panel — provides controls (mean return, std deviation, trial count), job submission, recursive setTimeout polling loop, progress display, and results rendering (success rate + worst-case trials table + fan chart).
- **Inputs:** `MonteCarloProps: { projectionId: string }` — panel owns all MC job state.
- **Outputs:** Renders controls, progress bar (shadcn Progress), success rate heading, worst-case trials table, fan chart (via `MonteCarloFanChartDynamic`); calls `submitMonteCarloJob`, `getMonteCarloJobStatus`, `cancelMonteCarloJob` from `lib/api/monte-carlo.ts`.
- **Dependencies:** Internal: `lib/api/monte-carlo.js`, `components/ui/progress.js`, `components/ui/button.js`, `components/ui/card.js`, `components/ui/input.js`, `components/ui/label.js`, `components/ui/use-toast.js`, `components/ui/skeleton.js`, `MonteCarloFanChart.js` (via `next/dynamic`). External: `react`, `next/dynamic`, `@retireops/shared` (MonteCarloJobResult, MonteCarloJobStatusValue).
- **Hardcoded constants:** Default mean return 6.5%, default std dev 11%, default trial count 1000.
- **Notes:** `'use client'` directive required (hooks). File-level `eslint-disable`. Polling uses `useRef<ReturnType<typeof setTimeout> | null>` with `useEffect` cleanup to prevent memory leaks on unmount. Percentage inputs divided by 100 at submit time. Added Phase 57 (v1.13); fan chart added Phase 58 (v1.13).

### `packages/web/src/components/projection/results/MonteCarloFanChart.tsx`

- **Purpose:** Recharts fan chart showing p10/p25/p50/p75/p90 percentile wealth trajectories from a Monte Carlo simulation. Five Area bands with varying opacity create the probability cone; a prominent p50 median Line overlays all bands.
- **Inputs:** `{ data: PercentileBandResultContract[] }` from `@retireops/shared`.
- **Outputs:** Renders a shadcn Card containing a Recharts `ComposedChart` with `year` on x-axis and portfolio value on y-axis. Custom tooltip shows all 5 percentile values on hover.
- **Dependencies:** `recharts` (ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer), `@/components/ui/card`, `@retireops/shared` (PercentileBandResultContract).
- **Hardcoded constants:** Area fill: `hsl(var(--muted-foreground))` with fillOpacity 0.10/0.15/0.20/0.25. Median stroke: `hsl(var(--ds-primary))`. Container height: 320px.
- **Notes:** Must be imported via `next/dynamic` with `{ ssr: false }` — `ResponsiveContainer` requires browser DOM. Named export only — dynamic import must use `.then((m) => ({ default: m.MonteCarloFanChart }))`. Zero-floors all percentile values via `Math.max(0, value)` before rendering. Added Phase 58 (v1.13).

### `packages/web/src/components/projection/results/scenarios/ScenarioList.tsx`

- **Purpose:** Profile scenario list — displays all scenarios with Run, Rename, Clone, Delete, Edit Decisions actions in a `DropdownMenu`. Optimistic updates on rename/delete. Base Scenario pinned and protected from deletion.
- **Inputs:** None (fetches from `GET /api/profile/scenarios`).
- **Outputs:** Scenario card list render.
- **Dependencies:** Internal: `lib/api/profile-scenarios.js`, `components/ui/dropdown-menu.js`, `alert-dialog.js`, `DefaultBadge.js`. External: `next/navigation`, `lucide-react`.
- **Hardcoded constants:** none.
- **Notes:** Optimistic updates applied before API confirmation; reverted on error. File-level `eslint-disable`.

### `packages/web/src/components/projection/results/scenarios/ComparisonView.tsx`

- **Purpose:** Multi-scenario tabular comparison — 6-metric table with delta columns relative to Base Scenario. Chart view via `ComparisonChart`. Props optional for backward compatibility.
- **Inputs:** `scenarioIds?: string[]` (optional; reads from URL search params if not provided).
- **Outputs:** Comparison table + chart render.
- **Dependencies:** Internal: `lib/api/profile-scenarios.js`, `ComparisonChart.js`, `lib/utils.js`.
- **Hardcoded constants:** 6 comparison metrics list.
- **Notes:** Always fetches Base Scenario as delta reference regardless of input `scenarioIds`. File-level `eslint-disable`.

### `packages/web/src/components/projection/results/scenarios/ComparisonChart.tsx`

- **Purpose:** Recharts chart for scenario comparison — stacked bar or grouped bar chart of key metrics across selected scenarios.
- **Inputs:** `scenarios: ProfileScenarioListItem[]` with result data.
- **Outputs:** Chart render.
- **Dependencies:** External: `recharts`.
- **Hardcoded constants:** Chart color palette.
- **Notes:** File-level `eslint-disable`.

### `packages/web/src/components/projection/results/scenarios/TemplatePickerDialog.tsx`

- **Purpose:** Dialog for selecting a scenario template — shows pre-defined scenario descriptions for quick creation.
- **Inputs:** `open: boolean`, `onSelect: (templateId: string) => void`, `onClose: () => void`.
- **Outputs:** Dialog render.
- **Dependencies:** Internal: `components/ui/dialog.js`.
- **Hardcoded constants:** Template names/descriptions.
- **Notes:** Currently unused or minimally used in v1.4 UI.

---

### components/ui/ (shadcn wrappers)

### `packages/web/src/components/ui/alert-dialog.tsx`

- **Purpose:** Thin Radix UI `AlertDialog` + Tailwind wrapper. **Hardcoded constants:** none (design tokens from tailwind.config.ts). **Notes:** File-level `eslint-disable` for `no-unsafe-*`.

### `packages/web/src/components/ui/badge.tsx`

- **Purpose:** Thin Radix/shadcn badge component. **Hardcoded constants:** none. **Notes:** File-level `eslint-disable`.

### `packages/web/src/components/ui/button.tsx`

- **Purpose:** Thin shadcn button with variants (default, outline, ghost, etc.) via `class-variance-authority`. **Hardcoded constants:** none. **Notes:** File-level `eslint-disable`.

### `packages/web/src/components/ui/card.tsx`

- **Purpose:** Shadcn card container with header/content/footer slots. **Hardcoded constants:** none. **Notes:** File-level `eslint-disable`.

### `packages/web/src/components/ui/checkbox.tsx`

- **Purpose:** Radix UI Checkbox + Tailwind wrapper. **Hardcoded constants:** none. **Notes:** File-level `eslint-disable`.

### `packages/web/src/components/ui/collapsible.tsx`

- **Purpose:** Radix UI Collapsible + Tailwind wrapper. **Hardcoded constants:** none. **Notes:** File-level `eslint-disable`.

### `packages/web/src/components/ui/dialog.tsx`

- **Purpose:** Radix UI Dialog + Tailwind wrapper. **Hardcoded constants:** none. **Notes:** File-level `eslint-disable`.

### `packages/web/src/components/ui/dropdown-menu.tsx`

- **Purpose:** Radix UI DropdownMenu + Tailwind wrapper. **Hardcoded constants:** none. **Notes:** File-level `eslint-disable` including `no-redundant-type-constituents` (Radix intersection types).

### `packages/web/src/components/ui/input.tsx`

- **Purpose:** Styled `<input>` element with bottom-stroke design token styling. **Hardcoded constants:** none. **Notes:** File-level `eslint-disable`.

### `packages/web/src/components/ui/label.tsx`

- **Purpose:** Radix UI Label + Tailwind wrapper. **Hardcoded constants:** none. **Notes:** File-level `eslint-disable` including `no-redundant-type-constituents`.

### `packages/web/src/components/ui/progress.tsx`

- **Purpose:** Radix UI Progress + Tailwind wrapper. **Hardcoded constants:** none. **Notes:** File-level `eslint-disable` including `restrict-template-expressions` and `prefer-nullish-coalescing`.

### `packages/web/src/components/ui/select.tsx`

- **Purpose:** Radix UI Select + Tailwind wrapper. **Hardcoded constants:** none. **Notes:** File-level `eslint-disable` including `no-redundant-type-constituents`.

### `packages/web/src/components/ui/separator.tsx`

- **Purpose:** Radix UI Separator + Tailwind wrapper. **Hardcoded constants:** none. **Notes:** File-level `eslint-disable`.

### `packages/web/src/components/ui/tabs.tsx`

- **Purpose:** Radix UI Tabs + Tailwind wrapper. **Hardcoded constants:** none. **Notes:** File-level `eslint-disable`.

### `packages/web/src/components/ui/toast.tsx`

- **Purpose:** shadcn Toast component (Radix UI Toast primitive + Tailwind). **Hardcoded constants:** none. **Notes:** File-level `eslint-disable`.

### `packages/web/src/components/ui/toaster.tsx`

- **Purpose:** shadcn Toaster — mounts all active toasts from `useToast` hook into the DOM. **Hardcoded constants:** none. **Notes:** File-level `eslint-disable`.

### `packages/web/src/components/ui/tooltip.tsx`

- **Purpose:** Radix UI Tooltip + Tailwind wrapper. **Hardcoded constants:** none. **Notes:** File-level `eslint-disable`.

### `packages/web/src/components/ui/use-toast.ts`

- **Purpose:** shadcn `useToast` hook — manages toast queue state and exposes `toast()` and `dismiss()` functions. **Hardcoded constants:** Max visible toasts: `1` (TOAST_LIMIT). **Notes:** File-level `eslint-disable`. Used throughout the app for success/error notifications.

---

### lib/

### `packages/web/src/lib/utils.ts`

- **Purpose:** UI utility functions — `cn()` (clsx + tailwind-merge for conditional class merging) and `formatCurrency()` (wraps `Intl.NumberFormat` for CAD display).
- **Inputs:** Class name strings for `cn()`; amount number for `formatCurrency()`.
- **Outputs:** `cn(...classes): string`, `formatCurrency(amount, options?): string`.
- **Dependencies:** External: `clsx`, `tailwind-merge`.
- **Hardcoded constants:** `formatCurrency` default: `en-CA` locale, `CAD` currency, 0 decimal places.
- **Notes:** `cn()` is the standard shadcn utility for merging Tailwind classes safely.

### `packages/web/src/lib/fonts.ts`

- **Purpose:** Next.js `next/font` import for Inter and Manrope — exports font objects with CSS variable names for root layout.
- **Inputs:** None.
- **Outputs:** Exported `inter`, `manrope` font objects with `.variable` CSS var names.
- **Dependencies:** External: `next/font/google`.
- **Hardcoded constants:** Font subset `'latin'`. CSS variable names `--font-inter`, `--font-manrope`.
- **Notes:** Both fonts declared here; consumed by `app/layout.tsx`.

### `packages/web/src/lib/projection-form.ts`

- **Purpose:** Projection wizard form schema and step metadata — `projectionSchema` (Zod), `projectionSteps` array (6 steps), form field accessor helpers.
- **Inputs:** None.
- **Outputs:** Exported `projectionSchema: ZodSchema`, `projectionSteps: StepDef[]` (6 entries), step field group helpers.
- **Dependencies:** External: `zod`, `@retireops/shared` (for province enum).
- **Hardcoded constants:** Retirement age min `55`, max `75`. Life expectancy min `70`, default `95`. 6 step definitions.
- **Notes:** `projectionSchema` is the primary RHF schema for the projection wizard. `projectionSteps` drives step navigation. Retirement age min `55` here matches `PersonalInfoStep.tsx` minimum.

### `packages/web/src/lib/profile-utils.ts`

- **Purpose:** Profile step data manipulation helpers — normalise step data from API, coerce field types, detect cards-wrapper vs array format.
- **Inputs:** Raw `step_data` JSONB values from API response.
- **Outputs:** Normalised step data objects.
- **Dependencies:** None.
- **Hardcoded constants:** none.
- **Notes:** Handles dual-shape detection (legacy array vs `{ cards: [...] }` format) matching the server-side `profile-assembler.ts` logic. Tested by `profile-utils.test.ts`.

### `packages/web/src/lib/profile-utils.test.ts`

- **Purpose:** Unit tests for `profile-utils.ts` — verifies normalisation of step data shapes.
- **Inputs:** Vitest.
- **Outputs:** Test assertions.
- **Dependencies:** External: `vitest`.
- **Hardcoded constants:** Test fixture step data.
- **Notes:** Co-located with source file. Part of `pnpm --filter @retireops/web test`.

### `packages/web/src/lib/api/client.ts`

- **Purpose:** Fetch wrapper with automatic token refresh — adds `Authorization: Bearer` header from `localStorage`, detects 401, refreshes via `POST /api/auth/refresh`, retries, redirects to `/login` on refresh failure. Exports `api.get/post/put/patch/delete` convenience methods.
- **Inputs:** URL string, `RequestInit` options.
- **Outputs:** `apiClient<T>(url, options): Promise<ApiResponse<T>>`. Exports `ApiResponse<T>` interface. Exports `api` object with HTTP verb methods.
- **Dependencies:** External: none (uses native `fetch`).
- **Hardcoded constants:** `API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api'`. Login redirect path `'/login'`.
- **Notes:** File-level `eslint-disable` for `no-unsafe-*`. `isRefreshing` flag and `refreshPromise` prevent multiple simultaneous refresh requests. Tokens stored in `localStorage` — not cookies (no HttpOnly security). See MEMORY.md auth flow.

### `packages/web/src/lib/api/projections.ts`

- **Purpose:** Typed fetch wrappers for projection CRUD API endpoints — list, get, create, update, delete, calculate.
- **Inputs:** Projection input data, UUIDs.
- **Outputs:** Typed wrappers calling `api.*` methods. Returns `Promise<ProjectionDetail>`, `Promise<ProjectionListItem[]>`, etc.
- **Dependencies:** Internal: `lib/api/client.js`, `types/projection.js`. External: none.
- **Hardcoded constants:** none.
- **Notes:** File-level `eslint-disable`.

### `packages/web/src/lib/api/scenarios.ts`

- **Purpose:** Typed fetch wrappers for **legacy** projection-based scenario endpoints.
- **Inputs:** Scenario data, projection UUID.
- **Outputs:** Typed `api.*` wrappers.
- **Dependencies:** Internal: `lib/api/client.js`. External: none.
- **Hardcoded constants:** none.
- **Notes:** **Legacy** — corresponds to `scenarios.routes.ts` in API (v1.0-era).

### `packages/web/src/lib/api/profile.ts`

- **Purpose:** Typed fetch wrappers for household profile API endpoints — get profile, patch step, run projection from profile, bootstrap step.
- **Inputs:** Step slug, step data, profile ID.
- **Outputs:** Typed `api.*` wrappers. Exports `ProfileData`, `StepSlug` types matching API.
- **Dependencies:** Internal: `lib/api/client.js`. External: none.
- **Hardcoded constants:** none.
- **Notes:** File-level `eslint-disable`. `patchProfileStep` and `bootstrapProfileStep` are called by `ProfileWizardShell`.

### `packages/web/src/lib/api/profile-scenarios.ts`

- **Purpose:** Typed fetch wrappers for profile scenario API endpoints — list, get, create, run, clone, compare, delete, update decisions.
- **Inputs:** Scenario IDs, decision payloads.
- **Outputs:** Typed `api.*` wrappers.
- **Dependencies:** Internal: `lib/api/client.js`, `types/profile-scenario.js`. External: none.
- **Hardcoded constants:** none.
- **Notes:** File-level `eslint-disable`.

### `packages/web/src/lib/api/solver.ts`

- **Purpose:** API client module for the v1.12 Reverse Calculator solver endpoints — `getSolverPrefill` (GET /api/solver/prefill) and `postSolver` (POST /api/solver).
- **Inputs:** `SolverInput` discriminated union for `postSolver`; no params for `getSolverPrefill`.
- **Outputs:** `getSolverPrefill(): Promise<SolverPrefillData | null>` — silently returns null on error; `postSolver(input): Promise<SolverResult>` — throws on error (caller handles). Exports `SolverPrefillData` interface (8 fields mirroring `packages/api/src/services/solver.service.ts`).
- **Dependencies:** Internal: `lib/api/client.js`. External: `@retireops/shared` (SolverInput, SolverResult types).
- **Hardcoded constants:** none.
- **Notes:** File-level `eslint-disable` (4 lines). `getSolverPrefill` swallows errors silently (matching `profile.ts` pattern) — prefill failure is non-fatal. `postSolver` does NOT swallow errors — callers display field-level error messages. Added Phase 54 (v1.12).

### `packages/web/src/app/(dashboard)/reverse-calculator/page.tsx`

- **Purpose:** Next.js App Router page shell for the v1.12 Reverse Calculator — fetches prefill data on mount via `getSolverPrefill`, manages `result`/`isSubmitting`/`error` state, renders `SolverForm` and a result placeholder area.
- **Inputs:** None (client component, no server props).
- **Outputs:** Renders `SolverForm` with `prefillData`, `onSubmit`, `isSubmitting`, `error` props. Renders empty-state card or result area in right column.
- **Dependencies:** Internal: `components/reverse-calculator/SolverForm.js`, `lib/api/solver.js`. External: `react`, `@retireops/shared` (SolverInput, SolverResult types).
- **Hardcoded constants:** none.
- **Notes:** File-level `eslint-disable` (3 lines). `'use client'` directive. Uses `void` IIFE pattern in `useEffect` for async prefill fetch. Named export `ReverseCalculatorPage` + `export default` (Next.js App Router requirement — one exception to the no-default-exports rule). SolverResultCard import commented out pending Plan 54-02. Added Phase 54 (v1.12).

### `packages/web/src/components/reverse-calculator/SolverForm.tsx`

- **Purpose:** Four-mode solver form with profile pre-fill support. Renders mode selector cards (2×2 grid), mode-specific fields, 8 profile data fields with pre-fill banner when `prefillData` is provided, assumption fields, and Calculate/Clear actions. Validates with `zodResolver` using the per-mode Zod schema.
- **Inputs:** `SolverFormProps: { prefillData: SolverPrefillData | null; onSubmit: (input: SolverInput) => Promise<void>; isSubmitting: boolean; error: string | null }`.
- **Outputs:** Renders form; calls `props.onSubmit(solverInput)` on valid submission. Derives `dateOfBirth` from `currentAge` as `${birthYear}-07-01` (mid-year approximation, ±6 months).
- **Dependencies:** Internal: `lib/api/solver.js` (SolverPrefillData), `components/ui/card.js`, `components/ui/button.js`, `components/ui/input.js`, `components/ui/label.js`, `components/ui/select.js`, `components/ui/badge.js`, `components/ui/separator.js`, `lib/utils.js`. External: `react`, `react-hook-form`, `@hookform/resolvers/zod`, `@retireops/shared`.
- **Hardcoded constants:** Province list (13 provinces), CPP start age range [60-70], OAS start age range [65-70], default `inflationRate: 0.025`, `investmentReturnRate: 0.06`, `lifeExpectancy: 90`.
- **Notes:** File-level `eslint-disable` (3 lines). Mode change resets form via `reset(buildDefaultValues(newMode, prefillData))` — clears mode-specific fields while preserving common fields. `getSchemaForMode(mode)` selects the individual per-mode schema (NOT the discriminated union) for `zodResolver`. Added Phase 54 (v1.12). Tested by `SolverForm.test.tsx` (TC-E2E-REVERSE-001).

### `packages/web/src/components/reverse-calculator/SolverResultCard.tsx`

- **Purpose:** (PLANNED — Plan 54-02) Hero answer display card for the Reverse Calculator — shows the solved value as a prominent hero number, a funded-status badge, projection milestone rows, and an infeasibility state when `feasible === false`.
- **Inputs:** `{ result: SolverResult }`.
- **Outputs:** (Planned) Card with hero answer, funded-status badge, milestone rows, infeasibility card.
- **Dependencies:** (Planned) Internal: `components/ui/card.js`, `components/ui/badge.js`. External: `@retireops/shared`.
- **Hardcoded constants:** none yet.
- **Notes:** Not yet created — placeholder registered per MODULE-MAP.md requirement for pre-registration. Added Phase 54 (v1.12) — implementation in Plan 54-02.

---

### hooks/

### `packages/web/src/hooks/useProjections.ts`

- **Purpose:** React hook — fetches projection list from `GET /api/projections`; returns `{ projections, loading, error, refetch }`.
- **Inputs:** None.
- **Outputs:** `{ projections: ProjectionListItem[], loading: boolean, error: string | null, refetch: () => void }`.
- **Dependencies:** Internal: `lib/api/projections.js`. External: `react` (useState, useEffect).
- **Hardcoded constants:** none.
- **Notes:** Uses `useState` / `useEffect` pattern (not SWR/TanStack Query — no external data-fetching library).

---

### types/

### `packages/web/src/types/projection.ts`

- **Purpose:** Web-local TypeScript types for projection data shapes returned by the API — `ProjectionInputData`, `ProjectionResultData` (with optional `projectionRows: ProjectionYearRow[]`), `ProjectionDetail`, `ProjectionListItem`.
- **Inputs:** None.
- **Outputs:** Exported interfaces.
- **Dependencies:** External: `@retireops/shared` (ProjectionYearRow).
- **Hardcoded constants:** none.
- **Notes:** `projectionRows` is optional to maintain backward compat with older projections calculated before v1.4 added the field.

### `packages/web/src/types/scenario.ts`

- **Purpose:** Web-local types for legacy projection-based scenario data shapes.
- **Inputs:** None.
- **Outputs:** Exported interfaces.
- **Dependencies:** None.
- **Hardcoded constants:** none.
- **Notes:** **Legacy** — corresponds to legacy `scenarios` table.

### `packages/web/src/types/profile-scenario.ts`

- **Purpose:** Web-local types for profile scenario list and detail shapes — `ProfileScenarioListItem` with snake_case field names matching API JSON directly (not camelCase).
- **Inputs:** None.
- **Outputs:** Exported `ProfileScenarioListItem`, `ProfileScenarioDetail` interfaces.
- **Dependencies:** External: `@retireops/shared` (optional, for result data shape).
- **Hardcoded constants:** none.
- **Notes:** snake_case fields (`is_base`, `result_data`, `created_at`) match raw API JSON response — no camelCase transform applied.

---

### other/

### `packages/web/src/components/LegalLinks.tsx`

- **Purpose:** Footer legal links component — Privacy Policy and Terms of Service links.
- **Inputs:** None.
- **Outputs:** Link render.
- **Dependencies:** External: `next/link`.
- **Hardcoded constants:** Paths `/privacy`, `/terms`.
- **Notes:** Used in landing page footer.

### `packages/web/src/components/LegalNotice.tsx`

- **Purpose:** Regulatory disclaimer banner — short text about non-professional-advice nature of projections.
- **Inputs:** None.
- **Outputs:** Disclaimer text render.
- **Dependencies:** None.
- **Hardcoded constants:** Disclaimer text string.
- **Notes:** See `@see docs/source-of-truth/13-compliance-scope.md`.

### `packages/web/src/components/SpouseProfileForm.tsx`

- **Purpose:** Standalone spouse profile form component — may be used in settings page for adding/editing spouse demographics outside the wizard.
- **Inputs:** RHF form context or standalone `onSubmit`.
- **Outputs:** Spouse form render.
- **Dependencies:** Internal: `components/ui/input.js`, `select.js`. External: `react-hook-form`.
- **Hardcoded constants:** none.
- **Notes:** Usage unclear — may overlap with `SpouseStep.tsx` in wizard. File-level `eslint-disable`.

### `packages/web/src/test/setup.ts`

- **Purpose:** Vitest setup for web package — imports `@testing-library/jest-dom` matchers.
- **Inputs:** None.
- **Outputs:** Side effect: registers testing library matchers globally.
- **Dependencies:** External: `@testing-library/jest-dom`.
- **Hardcoded constants:** none.
- **Notes:** Loaded via `setupFiles` in web package `vitest.config.ts`.

### `packages/web/tailwind.config.ts`

- **Purpose:** Tailwind CSS configuration — defines all `ds-*` design tokens (42 tokens: primary, secondary, surface colours), chart colour palette, `class` dark mode strategy, custom `rounded-card` and `rounded-button` radius values.
- **Inputs:** None.
- **Outputs:** Tailwind config object (consumed by PostCSS).
- **Dependencies:** External: `tailwindcss`, `tailwindcss-animate`.
- **Hardcoded constants:** `ds-primary` hex, all 42 token values, chart palette colours (`#2d6a4f`, etc.), `rounded-card: '1rem'`, `rounded-button: '0.75rem'`.
- **Notes:** `class` dark mode strategy (not `media`) — requires manual `.dark` class on root. All shadcn component mappings use `ds-*` tokens (REMAP-01/02 from v1.1).

---

### Web Package Summary

- **Total files documented:** 87 (23 app pages + 5 profile components + 7 profile steps + 1 profile lib + 1 projection wizard + 7 projection steps + 4 projection results + 4 scenario components + 18 ui wrappers + 8 lib + 1 lib test + 1 hook + 3 types + 3 other + 1 test setup + 1 tailwind config)
- **Framework:** Next.js 14 App Router — all pages in `app/` using route groups `(auth)`, `(dashboard)`, `(profile-wizard)`
- **Dependency rule:** `@retireops/web` depends ONLY on `@retireops/shared` — never imports `@retireops/calculation-engine`
- **Two wizards:** Profile wizard (7 steps, `ProfileWizardShell`, auto-save 800ms debounce) and Projection wizard (6 steps, `ProjectionWizardForm`, submit-on-complete)
- **Auto-save:** Profile wizard only — 800ms debounce via `useDebouncedCallback`; projection wizard saves on final submit only
- **UI library:** shadcn/ui + Tailwind only — 18 shadcn wrapper components, all with file-level `eslint-disable` for `no-unsafe-*`
- **State management:** `useState`/`useEffect` + `react-hook-form`; no global state library (no Zustand, Redux, Context for data); auth state via `localStorage` directly
- **Key differences:** Profile wizard min retirement age `50`; projection wizard min `55` — intentional (STEP-01/STEP-02)
- **Tokens from localStorage:** Access token and refresh token stored in `localStorage` — not HttpOnly cookies; auto-refresh on 401 in `lib/api/client.ts`

---

## Package: @retireops/worker

Root: `packages/worker/src/`

BullMQ async job processor for CPU-intensive calculations. Depends on `@retireops/shared` and `@retireops/calculation-engine`. No HTTP server — consumes Redis queues.

---

### entry, config, infra/

### `packages/worker/src/index.ts`

- **Purpose:** Package barrel — re-exports `config`, `logger`, queue definitions (`projectionQueue`, `scenarioComparisonQueue`, `monteCarloQueue`), and `db` as the package's public API.
- **Inputs:** None — re-export only.
- **Outputs:** Re-exports from `config.js`, `logger.js`, `queues.js`, `db.js`.
- **Dependencies:** Internal: all listed modules. External: none.
- **Hardcoded constants:** none.
- **Notes:** The worker runs as a standalone process via `worker.ts` (not through this barrel).

### `packages/worker/src/worker.ts`

- **Purpose:** Worker process entry point — creates three BullMQ Worker instances (`projection-calculation`, `scenario-comparison`, `monte-carlo`) and registers their processor functions; handles graceful shutdown.
- **Inputs:** `config.WORKER_CONCURRENCY` for concurrency setting.
- **Outputs:** Side effects: starts BullMQ workers, registers process signal handlers. Exports nothing.
- **Dependencies:** Internal: `config.js`, `logger.js`, `queues.js` (redisConnection), `db.js`, `processors/projection.processor.js`. External: `bullmq`.
- **Hardcoded constants:** Monte Carlo worker concurrency: `Math.max(1, Math.floor(WORKER_CONCURRENCY / 2))` (lower concurrency for CPU intensity). Queue names: `'projection-calculation'`, `'scenario-comparison'`, `'monte-carlo'`.
- **Notes:** `scenario-comparison` is intentionally unsupported in the worker and throws with guidance to use the synchronous profile-scenario comparison API. `projection-calculation` uses `processProjectionJob`; `monte-carlo` uses `processMonteCarloJob`. See Research Open Question 2 — worker processes jobs but API also runs projections synchronously inline (dual-path).

### `packages/worker/src/config.ts`

- **Purpose:** Zod-validated worker environment config — mirrors API config but with fewer vars; exits process on invalid config.
- **Inputs:** `process.env`.
- **Outputs:** Exports `config: Config`, exported type `Config`.
- **Dependencies:** External: `zod`.
- **Hardcoded constants:** `NODE_ENV` default `'development'`. `REDIS_URL` default `'redis://localhost:6379'`. `DATABASE_URL` default `'postgresql://retireops:retireops@localhost:5432/retireops'`. `WORKER_CONCURRENCY` default `5`. `LOG_LEVEL` default `'info'`.
- **Notes:** Subset of API config — no JWT, no CORS, no rate limiting. Worker-specific: `WORKER_CONCURRENCY`.

### `packages/worker/src/logger.ts`

- **Purpose:** Winston logger instance for the worker — identical pattern to API logger but with `service: 'retireops-worker'` metadata.
- **Inputs:** `config.LOG_LEVEL`, `config.NODE_ENV`.
- **Outputs:** Exports `logger: winston.Logger`.
- **Dependencies:** Internal: `config.js`. External: `winston`.
- **Hardcoded constants:** Same as API logger: `logs/error.log`, `logs/combined.log`, 10MB max, 5 files.
- **Notes:** Separate logger instance from API — different service name in structured log output.

### `packages/worker/src/db.ts`

- **Purpose:** Kysely PostgreSQL connection and DB write helpers for the worker — simplified schema (only `projections`, `scenarios`, `monte_carlo_jobs` tables).
- **Inputs:** `config.DATABASE_URL`.
- **Outputs:** Exports `db: Kysely<Database>`. Exports helpers: `updateProjectionResult(projectionId, resultData, status?)`, `updateScenarioResult(scenarioId, resultData, status?)`, `updateMonteCarloProgress(jobId, progress)`, `updateMonteCarloResult(jobId, resultData, status, errorMessage?)`.
- **Dependencies:** Internal: `config.js`, `logger.js`. External: `kysely`, `pg`.
- **Hardcoded constants:** DB pool `max: 5` (fewer connections than API — worker needs less). Default `status = 'completed'` for result updates.
- **Notes:** Worker only needs write access to projection/scenario/monte-carlo result columns — simplified `Database` interface vs API's full `schema.ts`. `updateProjectionResult(id, null, 'failed')` used in `projection.processor.ts` error handler.

### `packages/worker/src/queues.ts`

- **Purpose:** BullMQ queue definitions and event handlers for all three queues — `projection-calculation`, `scenario-comparison`, `monte-carlo`.
- **Inputs:** `config.REDIS_URL`.
- **Outputs:** Exports `redisConnection: Redis` (ioredis), `projectionQueue: Queue`, `scenarioComparisonQueue: Queue`, `monteCarloQueue: Queue`.
- **Dependencies:** Internal: `config.js`, `logger.js`. External: `bullmq`, `ioredis`.
- **Hardcoded constants:** Queue names: `'projection-calculation'`, `'scenario-comparison'`, `'monte-carlo'`. `projectionQueue` defaultJobOptions: `attempts: 3`, exponential backoff `delay: 1000`, keep completed `age: 3600, count: 100`, keep failed `age: 86400`. `monteCarloQueue`: `attempts: 2` (expensive — fewer retries), backoff `delay: 5000`, keep completed `age: 7200, count: 50`. Redis `maxRetriesPerRequest: null` (required by BullMQ).
- **Notes:** `QueueEvents` listeners log completion/failure for monitoring. Queue names in `worker.ts` must match queue names here — any mismatch means workers won't pick up jobs. Note: actual queue name is `'projection-calculation'`, not just `'projection'` as stated in CLAUDE.md architecture section.

---

### processors/

### `packages/worker/src/processors/projection.processor.ts`

- **Purpose:** BullMQ processor for `projection-calculation` jobs — receives `ProjectionJobData`, calls `runProjection(inputData)`, extracts summary, stores result in DB via `updateProjectionResult()`.
- **Inputs:** `Job<ProjectionJobData, ProjectionJobResult>` where `ProjectionJobData = { projectionId, userId, inputData: ProjectionInput }`.
- **Outputs:** `processProjectionJob(job): Promise<ProjectionJobResult>`. On success: `{ success: true, projectionId, calculatedAt, summary }`. On failure: throws error after updating DB to `status='failed'`. Exports `ProjectionJobData`, `ProjectionJobResult` interfaces.
- **Dependencies:** Internal: `logger.js`, `db.js` (updateProjectionResult). External: `bullmq`, `@retireops/calculation-engine` (runProjection), `@retireops/shared` (ProjectionInput).
- **Hardcoded constants:** none.
- **Notes:** **Dual-path flag:** Worker processes `projection-calculation` jobs asynchronously, but `projection.service.ts` in the API also calls `runProjection()` synchronously inline for the `POST /api/projections/:id/calculate` endpoint. These two paths are NOT coordinated — it is unclear if the worker queue is ever populated from the current UI flows. Phase 28 should flag `processProjectionJob` as likely untested (Research Open Question 2). `ProjectionJobData.inputData` is typed as `ProjectionInput` (engine input) — NOT `FrontendInputData`. The API must transform before enqueuing.

---

### Worker Package Summary

- **Total files documented:** 7 (index, worker, config, logger, db, queues, processors/projection.processor)
- **BullMQ queues:** `'projection-calculation'` (3 attempts, 1s backoff), `'scenario-comparison'` (unsupported worker path), `'monte-carlo'` (2 attempts)
- **Shares `runProjection()` with API:** Both packages call the same pure calculation-engine function — API synchronously, worker asynchronously
- **No HTTP server:** Worker is purely a queue consumer; all HTTP traffic is handled by `@retireops/api`
- **DB access:** Write-only subset — updates `projections`, `scenarios`, `monte_carlo_jobs` result columns only
- **Open items:** `scenario-comparison` should either gain a real async processor or be removed from the worker package; `projection-calculation` queue may not be populated from current UI flows (dual-path concern)

---

## Cross-Package Data Flow

### Primary projection data flow (profile → engine → result)

```
ProfileWizardShell (web/components/profile/ProfileWizardShell.tsx)
  ↓ onChange → debounced 800ms
PATCH /api/profile/step/:stepSlug (api/routes/profile.routes.ts)
  ↓
profile.service.ts · updateProfileStep (JSONB merge-patch by step slug)
  ↓ [on navigate]
bootstrapProfileStep → profile-assembler.ts · assembleProfileInputData
  ↓ returns FrontendInputData
profile-scenario.service.ts · recomputeAllScenarios (fire-and-forget)
  ↓ for each scenario
scenario-decisions.ts · applyScenarioDecisions (structuredClone base + apply)
  ↓ returns ScenarioAppliedInput
projection-transformer.ts · transformToProjectionInput
  ↓ returns ProjectionInput (shared type)
calculation-engine/projection/multi-year.ts · runProjection
  ↓ returns ProjectionOutput
projection-transformer.ts · transformToProjectionYearRows
  ↓ returns ProjectionYearRow[]
profile_scenarios.result_data (JSONB) stored via Kysely
  ↓
GET /api/profile/scenarios/:id → ScenarioList / ComparisonView (web)
```

### Auth flow

```
POST /api/auth/login (auth.routes.ts)
  ↓
auth.service.ts · verifyPassword → signAccessToken (HS256 15m) + signRefreshToken
  ↓
refresh_tokens DB table (bcrypt-hashed refresh)
  ↓
client stores tokens in localStorage
  ↓ on API call
lib/api/client.ts · fetch with Bearer header → on 401 → auto-refresh
```

### Worker job flow (dual-path — flag)

```
API · projection.service.ts · calculateProjection calls runProjection INLINE (synchronous)
Worker · processors/projection.processor.ts · processProjectionJob calls runProjection ASYNC (BullMQ)
Both paths exist; current UI uses the synchronous API path. Worker is reserved for future Monte Carlo/async work.
```

---

## Hardcoded Constants Summary

| Domain              | Constant                             | Value                                                          | Source                                                                                                      |
| ------------------- | ------------------------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Tax — federal       | 2025 lowest bracket rate             | 0.145 (changed from 0.15 in 2024)                              | packages/shared/src/constants/tax-tables.ts                                                                 |
| Tax — federal       | 2026 lowest bracket rate             | 0.14                                                           | packages/shared/src/constants/tax-tables.ts                                                                 |
| Tax — federal       | Quebec abatement rate                | 16.5% (0.165)                                                  | packages/calculation-engine/src/tax/federal-tax.ts                                                          |
| Tax — capital gains | Enhanced inclusion threshold         | $250,000/year per person                                       | packages/shared/src/constants/rates.ts                                                                      |
| Tax — capital gains | Standard inclusion rate              | 50% (0.5)                                                      | packages/calculation-engine/src/tax/capital-gains.ts                                                        |
| Tax — capital gains | Enhanced inclusion rate              | 66.67% (0.6667)                                                | packages/shared/src/constants/rates.ts                                                                      |
| Tax — OAS clawback  | Clawback rate                        | 15% (0.15)                                                     | packages/shared/src/constants/rates.ts                                                                      |
| Tax — OAS clawback  | 2024 threshold                       | $90,997                                                        | packages/shared/src/constants/rates.ts                                                                      |
| Tax — OAS clawback  | 2025 threshold                       | $93,454                                                        | packages/shared/src/constants/rates.ts                                                                      |
| Benefits — CPP      | Early reduction per month            | 0.006 (0.6%)                                                   | packages/shared/src/constants/rates.ts                                                                      |
| Benefits — CPP      | Late increase per month              | 0.007 (0.7%)                                                   | packages/shared/src/constants/rates.ts                                                                      |
| Benefits — CPP      | Survivor benefit fraction            | 60% (0.6)                                                      | packages/calculation-engine/src/benefits/cpp.ts                                                             |
| Benefits — CPP      | Start age range                      | [60, 70] — throws outside                                      | packages/calculation-engine/src/benefits/cpp.ts                                                             |
| Benefits — CPP      | Default estimate (fallback)          | $12,000/year                                                   | packages/calculation-engine/src/projection/multi-year.ts                                                    |
| Benefits — OAS      | Age 75 bonus                         | +10% (0.10)                                                    | packages/shared/src/constants/rates.ts                                                                      |
| Benefits — OAS      | Deferral increase per month          | 0.6% (0.006)                                                   | packages/calculation-engine/src/benefits/oas.ts                                                             |
| Benefits — OAS      | Default years of residence           | 40                                                             | packages/calculation-engine/src/projection/multi-year.ts                                                    |
| Benefits — GIS      | Single income threshold              | $21,624                                                        | packages/calculation-engine/src/benefits/gis.ts (via BENEFIT_AMOUNTS_2024)                                  |
| Benefits — GIS      | Married (both OAS) threshold         | $28,560                                                        | packages/calculation-engine/src/benefits/gis.ts (via BENEFIT_AMOUNTS_2024)                                  |
| Benefits — GIS      | Married (spouse not OAS) threshold   | $51,840                                                        | packages/calculation-engine/src/benefits/gis.ts (via BENEFIT_AMOUNTS_2024.gis.incomeThresholdMarriedOneOAS) |
| Benefits — GIS      | Clawback rate                        | 50 cents per dollar (0.50)                                     | packages/calculation-engine/src/benefits/gis.ts                                                             |
| Benefits — GIS      | Employment income exempt             | first $5,000                                                   | packages/calculation-engine/src/benefits/gis.ts                                                             |
| Benefits — GIS      | Minimum residency                    | 10 years                                                       | packages/shared/src/types/benefits.ts                                                                       |
| Benefits — GIS      | Full residency                       | 40 years                                                       | packages/shared/src/types/benefits.ts                                                                       |
| Accounts — RRSP     | Contribution rate on earned income   | 18% (0.18)                                                     | packages/shared/src/constants/limits.ts                                                                     |
| Accounts — RRSP     | 2024 max contribution                | $31,560                                                        | packages/shared/src/constants/limits.ts                                                                     |
| Accounts — RRSP     | 2025 max contribution                | $32,490                                                        | packages/shared/src/constants/limits.ts                                                                     |
| Accounts — RRSP     | Conversion deadline age              | 71 (end of year)                                               | packages/calculation-engine/src/accounts/rrsp.ts                                                            |
| Accounts — RRIF     | Minimum withdrawal required from age | 72                                                             | packages/calculation-engine/src/accounts/rrif.ts                                                            |
| Accounts — RRIF     | Age 95+ minimum rate                 | 0.20 (20%)                                                     | packages/shared/src/constants/rates.ts                                                                      |
| Accounts — TFSA     | Default annual limit (unknown years) | $7,000                                                         | packages/calculation-engine/src/accounts/tfsa.ts                                                            |
| Accounts — TFSA     | 2024 cumulative limit                | $95,000                                                        | packages/shared/src/constants/limits.ts                                                                     |
| Accounts — TFSA     | 2025 cumulative limit                | $102,000                                                       | packages/shared/src/constants/limits.ts                                                                     |
| Assumptions         | Default inflation rate               | 0.025 (2.5%)                                                   | packages/shared/src/constants/defaults.ts                                                                   |
| Assumptions         | Default life expectancy              | 95                                                             | packages/shared/src/constants/defaults.ts                                                                   |
| Assumptions         | Default retirement age               | 65                                                             | packages/shared/src/constants/defaults.ts                                                                   |
| Assumptions         | Default returns                      | conservative 4%, moderate 5.5%, aggressive 7%                  | packages/shared/src/constants/defaults.ts                                                                   |
| Assumptions         | CURRENT_YEAR (potentially stale)     | 2024 — static literal, NOT dynamic                             | packages/shared/src/constants/defaults.ts                                                                   |
| Investments         | Monte Carlo simulations default      | 1000                                                           | packages/calculation-engine/src/investments/monte-carlo.ts                                                  |
| Investments         | Monte Carlo expected return          | 0.055                                                          | packages/calculation-engine/src/investments/monte-carlo.ts                                                  |
| Investments         | Monte Carlo volatility               | 0.10                                                           | packages/calculation-engine/src/investments/monte-carlo.ts                                                  |
| Investments         | Default non-reg allocation           | interest 20%, canadian div 30%, foreign div 10%, cap gains 40% | packages/calculation-engine/src/investments/returns.ts                                                      |
| Investments         | Glide path starting equity           | 80%                                                            | packages/calculation-engine/src/investments/glide-path.ts                                                   |
| API — auth          | Access token algorithm               | HS256                                                          | packages/api/src/auth/jwt.ts                                                                                |
| API — auth          | Access token expiry                  | 15 minutes                                                     | packages/api/src/auth/jwt.ts                                                                                |
| API — auth          | Refresh token length                 | 128 hex chars (64 random bytes)                                | packages/api/src/auth/jwt.ts                                                                                |
| API — auth          | Bcrypt rounds default                | 12                                                             | packages/api/src/config/index.ts                                                                            |
| API — config        | Default API port                     | 3001                                                           | packages/api/src/config/index.ts                                                                            |
| API — config        | Default cache TTL                    | 3600 seconds (1 hour)                                          | packages/api/src/services/projection.service.ts                                                             |
| API — rate limit    | Auth limiter                         | 15 min window, max 10 requests                                 | packages/api/src/middleware/rate-limiter.ts                                                                 |
| Worker              | BullMQ queue name (projection)       | 'projection-calculation'                                       | packages/worker/src/queues.ts                                                                               |
| Worker              | BullMQ queue name (comparison)       | 'scenario-comparison'                                          | packages/worker/src/queues.ts                                                                               |
| Worker              | BullMQ queue name (monte-carlo)      | 'monte-carlo'                                                  | packages/worker/src/queues.ts                                                                               |
| Worker              | Default concurrency                  | 5                                                              | packages/worker/src/config.ts                                                                               |
| Web                 | Auto-save debounce                   | 800ms                                                          | packages/web/src/components/profile/ProfileWizardShell.tsx                                                  |
| Web                 | Profile wizard min retirement age    | 50                                                             | packages/web/src/components/profile/steps/AboutYouStep.tsx                                                  |
| Web                 | Projection wizard min retirement age | 55                                                             | packages/web/src/components/projection/steps/PersonalInfoStep.tsx                                           |
| Web                 | API base URL fallback                | '/api'                                                         | packages/web/src/lib/api/client.ts                                                                          |

---

## Human Review Checkpoint

> **STOP — Phase 28 gate.**
> A human must review this entire MODULE-MAP.md for completeness and correctness before `/gsd:plan-phase 28` runs.
>
> Review checklist:
>
> - [ ] Every package has a section (shared, calculation-engine, api, web, worker)
> - [ ] Every .ts / .tsx file in `packages/*/src/` appears as an H3 entry (run: `find packages/*/src -name "*.ts" -o -name "*.tsx" -not -path "*/node_modules/*" -not -path "*/dist/*"` and cross-check count)
> - [ ] Every entry has all six Format Template fields (Purpose, Inputs, Outputs, Dependencies, Hardcoded constants, Notes)
> - [ ] Hardcoded Constants Summary table covers all literal values from code
> - [ ] Open questions from 27-RESEARCH.md are acknowledged in Notes fields (CURRENT_YEAR staleness, worker dual-path, Monte Carlo scaffold, legacy scenarios routes)
> - [ ] Cross-Package Data Flow traces the full profile → engine → result round trip
>
> Sign-off: Approved by human reviewer — 2026-04-05
