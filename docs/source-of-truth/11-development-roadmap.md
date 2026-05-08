# 11 - Development Roadmap

## Overview

RetireOps development follows an incremental delivery model where each milestone ships working, tested functionality. This document tracks what was **actually built** (not what was originally planned) and lays out the remaining feature pipeline.

**Core constraint:** Every financial calculation must reference `docs/source-of-truth/*.md`. The `calculation-engine` package is side-effect free (no `Date.now()`, `Math.random()`, or I/O).

**Architecture:** Monorepo with pnpm workspaces — `shared`, `calculation-engine`, `api`, `web`, `worker`. ESM strict (`.js` import extensions required).

---

## Shipped Milestones

### v1.0 Calculator (Phases 1–3) — shipped 2026-03-29

The core retirement calculator: transformer coverage, scenario corpus, UI polish. Established the calculation-engine pattern and basic input→output pipeline.

### v1.1 Editorial Stability (Phases 4–9) — shipped 2026-04-01

Design system foundation, landing page, token remap, shared components, dashboard + auth + navigation, projections list + wizard redesign, results screens. Six phases of UI/UX consolidation.

### v1.2 Household Profile (Phases 10–16) — shipped 2026-04-02

DB migration + profile API, profile data flow, wizard shell (7 steps), card collections for accounts/income/benefits/property, integration + tech debt, profile row bootstrapping. Delivered the household data model that all subsequent features depend on.

### v1.3 Scenario Structure (Phases 17–22) — shipped 2026-04-04

Schema + assembler foundation, REST API + profile recompute, scenario list UI, decisions editor, run + comparison, tech debt + Nyquist backfill. Users can create, edit, and run distinct retirement scenarios.

### v1.4 Basic Projection Engine (Phases 23–26) — shipped 2026-04-05

Projection output schema, Canadian tax rule completeness (federal + provincial brackets, credits), scenario decision engine wiring, year-by-year table UI. The engine produces its first defensible year-over-year retirement projection.

### v1.5 Test Foundation (Phases 27–29) — shipped 2026-04-05

Codebase module map, testable surface identification, TESTING.md specification. Established testing conventions and coverage targets for all subsequent engine work.

### v1.6 Basic Projections Page (Phases 30–32) — shipped 2026-04-06

Page shell + scenario selector + states, YearByYearTab integration, NetWorthLineChart. Users can visualize their projection results.

### v1.7 Projection Engine Bug Fixes (Phases 33–35) — shipped 2026-04-06

Pension income transformer fix, couple spending correction, RRSP meltdown guard. Corrected three projection accuracy issues found during integration testing.

### v1.8 RRIF Conversion & Withdrawal Modeling (Phases 36–42) — shipped 2026-04-08

Shared type extensions, single-person year calculator, couple-person year calculator, younger-spouse wire gap, meltdown wiring + guard audit, API transformer update, DOB sync. Full RRSP→RRIF conversion with minimum withdrawal calculations and younger-spouse election.

### v1.9 Tax Optimization Engine (Phases 43–46) — shipped 2026-04-09

Shared types + engine foundation, income splitting + CPP/OAS analyzers, RRSP meltdown analyzer, drawdown analyzer + orchestrator + API wiring. The engine now generates actionable tax optimization suggestions per scenario.

### v1.10 Projections Page Re-Baseline (Phase 47) — shipped 2026-04-11

Projections page rebuilt to reflect the new engine output schema, scenario selector, and multi-tab layout.

### v1.11 Am I Funded Indicator (Phases 48–50) — shipped 2026-04-11

Funded status MVP (classification + banner), remediation engine (red-state binary search), regression + reactivity polish. Users see a clear funded/underfunded/overfunded indicator with remediation suggestions.

### v1.12 Reverse Calculator (Phases 51–54) — shipped 2026-04-12

Shared types foundation, solver engine, API route + service, web UI. Users can ask "How much do I need to save?" and get a mathematically correct answer.

### v1.13 Monte Carlo Simulation Engine (Phases 55–58) — shipped 2026-04-12

Shared types + simulation engine core, BullMQ worker + API routes, Monte Carlo UI panel, fan chart visualization. 1000-run stochastic simulations with percentile outcome bands.

### v1.14 Historical Backtesting (Phases 59–62) — partially shipped

- **Phase 59** (shipped 2026-04-12): Shared types + historical return dataset (S&P/TSX + S&P 500 in CAD, 60/40 blend, 1990–2025) and three preset scenarios (dot-com crash, 2008 financial crisis, COVID shock).
- **Phases 60–62** (not started): Backtesting engine, API endpoint + staleness hash, web UI tab + chart.

### v1.15 Tax Bracket Smoothing — Bracket Fill (Phases 63–64) — partially shipped

- **Phase 63** (shipped 2026-04-13): Bracket fill engine + surplus sweep in `calculation-engine`. Tops guaranteed income up to the federal bracket ceiling each retirement year, sweeps surplus to TFSA then non-reg. Five unit tests passing.
- **Phase 64** (not started): UI strategy configuration — bracket-fill toggle, annual cap input, bracket-target selector in scenario decisions editor.

### v1.16 Stress Testing — shipped

Scenario stress testing: users can model adverse conditions (reduced returns, increased spending, sequence-of-returns risk) alongside the baseline projection.

### v1.17 Inflation Toggle — shipped

User-configurable inflation rate override per scenario, with proper inflation-adjusted brackets and benefit amounts.

### v1.18 GIS — Feature 4.1 (shipped)

Guaranteed Income Supplement calculation for low-income retirees. GIS amount computed based on net income, marital status, and age — integrated into the projection engine and displayed on the projections page.

### 4.1.1 Scenario Test Platform — shipped 2026-04-17 (commit 5f5da14)

Automated scenario test infrastructure: engine-run fixture generation, regression test suite (49 passed, 7 todo), and post-mortem documentation for fabricated-value incident.

---

## Current Status

**PAUSED** after 4.1.1 due to OAS clawback bug investigation (GitHub issue #82). Two bugs identified:

1. Tax module indexes the OAS clawback threshold via inflation, pushing it above net income in future years.
2. Benefits module correctly computes clawback, but engine output shows gross OAS.

~$88K cumulative OAS overstatement ages 65–75 in affected scenarios. Pipeline will not proceed to Feature 4.2 until this investigation is resolved.

---

## Remaining Features

Features are organized into tiers. Each feature has a unique ID for traceability across plans, tests, and source-of-truth docs.

### Tier 4: Completing the Core

These features complete the core retirement planning experience for individual and couple households.

#### 4.2 Spousal RRSP

**Goal:** Model spousal RRSP contributions and the 3-year attribution rule.

- Spousal RRSP account type with contributor/annuitant tracking
- Attribution rule: withdrawals within 3 years of spousal contribution taxed back to contributor
- Integration with tax engine for correct T1 reporting
- UI: spousal RRSP contribution step in wizard, attribution warnings

**Source refs:** `02-account-types.md` VR-RRSP-003, RRSP data model `is_spousal` field

#### 4.3 Pension Income Splitting

**Goal:** Allow couples to split eligible pension income (up to 50%) to the lower-income spouse.

- Pension income splitting calculation in `calculation-engine`
- Eligible income sources: RRIF withdrawals, DB pension, annuity income (not CPP/OAS)
- Optimal split amount computation (minimize combined tax)
- Integration with existing couple projection path
- UI: splitting configuration in scenario decisions

**Source refs:** `04-tax-engine.md`, `07-withdrawal-strategies.md`

#### 4.4 All Provinces

**Goal:** Expand provincial tax support from ON/BC/AB to all 13 Canadian jurisdictions.

- Provincial tax brackets for all provinces and territories
- Provincial credits (basic personal amount, age credit, pension income credit)
- Quebec-specific calculations (separate return, different credit structure)
- Configuration-driven approach (JSON tax tables per province per year)
- Full test suite per province

**Source refs:** `04-tax-engine.md` PROV-TAX series

#### 4.5 Scenario Comparison

**Goal:** Side-by-side comparison of up to 3 scenarios with diff highlighting.

- Scenario comparison data structure and API endpoint
- Side-by-side year-by-year table with diff highlighting
- Key metrics comparison (total tax paid, final net worth, funded status, depletion year)
- Chart overlay of multiple scenario trajectories
- Print-friendly comparison view

#### 4.6 PDF Report Generation

**Goal:** Export projection results as a professional PDF report.

- PDF generation from projection results (server-side)
- Report sections: summary, assumptions, year-by-year table, charts, tax breakdown
- CRA-consistent formatting and terminology
- Branded layout with disclaimer footer
- Download via API endpoint

### Tier 5: Advanced Financial Modeling

These features add sophisticated tax and asset modeling for power users and financial advisors.

#### 5.1 Estate Tax & Terminal Return

**Goal:** Calculate terminal tax liability on death (deemed disposition of all assets) and estate net value.

- Deemed disposition of RRSP/RRIF at marginal rate
- Deemed disposition of non-reg (capital gains inclusion)
- TFSA tax-free transfer to beneficiary
- Terminal return calculation per province
- Estate net value display in projection summary

**Source refs:** `02-account-types.md` (account tax treatments), `04-tax-engine.md`

#### 5.2 Capital Gains Inclusion Rate Handling

**Goal:** Model the tiered capital gains inclusion rate (50% below $250K, 66.67% above $250K annually, per 2024 federal budget).

- Tiered inclusion rate calculation in `calculation-engine`
- Lifetime capital gains exemption for qualified small business shares
- Integration with non-reg account ACB tracking
- Proper handling across multiple non-reg accounts

**Source refs:** `02-account-types.md` NREG-004, `04-tax-engine.md`

#### 5.3 Dividend Tax Credit

**Goal:** Model eligible and non-eligible dividend gross-up and tax credit for non-registered accounts.

- Eligible dividend gross-up (38%) and federal credit (15.0198%)
- Non-eligible dividend gross-up (15%) and federal credit (9.0301%)
- Provincial dividend tax credits
- Integration with non-reg income allocation model
- Impact on marginal effective tax rate calculations

**Source refs:** `02-account-types.md` NREG-003, dividend table

#### 5.4 Real Estate / Home Downsizing

**Goal:** Allow users to model home equity as a retirement asset, including downsizing events.

- Primary residence input (current value, mortgage balance)
- Downsizing event (sale year, new home value, transaction costs)
- Principal residence exemption (no capital gains tax on primary residence)
- Net proceeds deposit to specified account(s)
- Year-by-year home value appreciation (configurable rate)
- Impact on estate value

#### 5.5 Corporate Investment Account (CCPC)

**Goal:** Model corporate investment accounts for incorporated professionals and business owners.

- Corporate account type with RDTOH and CDA tracking
- Corporate tax on passive income (~50.17% combined)
- RDTOH accumulation (30.67%) and refund mechanism (38.33%)
- Capital Dividend Account tracking (50% of realized gains)
- Optimal extraction pathway: capital dividends → eligible dividends → non-eligible dividends → salary
- Integration with personal tax on dividend income

**Source refs:** `12-advanced-accounts.md` CORP-001 through CORP-009, `CorporateAccount` and `CorporateAnnualResult` interfaces

### Tier 6: Intelligence & Optimization

#### 6.1 Automated Strategy Recommendations (AI)

**Goal:** Analyze the user's scenario and generate prioritized, actionable strategy recommendations.

- Recommendation engine that evaluates all available optimization strategies
- Strategies: RRSP meltdown timing, bracket fill, CPP start age optimization, OAS clawback avoidance, pension splitting, TFSA maximization, RRIF younger-spouse election
- Each recommendation includes: description, estimated dollar impact, confidence level, and source-of-truth reference
- AI-assisted natural language explanation of complex strategies
- Prioritized ranking by estimated lifetime tax savings

---

## Incomplete Work from Earlier Milestones

These items were partially shipped and need completion:

### v1.14 Historical Backtesting (Phases 60–62 remaining)

| Phase | Description                                                           | Status      |
| ----- | --------------------------------------------------------------------- | ----------- |
| 60    | Backtesting engine (`runHistoricalBacktest`, `runAllPresetBacktests`) | Not started |
| 61    | API endpoint + staleness hash (`GET /api/projections/:id/backtest`)   | Not started |
| 62    | Web UI — backtest tab + chart overlay                                 | Not started |

### v1.15 Tax Bracket Smoothing (Phase 64 remaining)

| Phase | Description                                                                          | Status      |
| ----- | ------------------------------------------------------------------------------------ | ----------- |
| 64    | UI strategy configuration (bracket-fill toggle, annual cap, bracket-target selector) | Not started |

---

## Feature Dependency Graph

```
4.2 Spousal RRSP ──────────────────────┐
4.3 Pension Income Splitting ──────────┤
4.4 All Provinces ─────────────────────┤── Tier 4 (can be parallelized)
4.5 Scenario Comparison ───────────────┤
4.6 PDF Report Generation ─────────────┘

5.1 Estate Tax & Terminal Return ──────┐
5.2 Capital Gains Inclusion Rate ──────┤── Tier 5 (depends on Tier 4 completion)
5.3 Dividend Tax Credit ───────────────┤
5.4 Real Estate / Home Downsizing ─────┤
5.5 Corporate Investment Account (CCPC)┘

6.1 Automated Strategy Recommendations ─── Tier 6 (depends on 5.x features)
```

**Suggested build order after OAS bug fix (#82) resolution:**

1. Complete v1.15 Phase 64 (bracket-fill UI) — small, unblocks testing
2. Complete v1.14 Phases 60–62 (historical backtesting) — Phase 59 data already shipped
3. 4.2 Spousal RRSP
4. 4.3 Pension Income Splitting
5. 4.4 All Provinces
6. 4.5 Scenario Comparison
7. 4.6 PDF Report Generation
8. 5.1 Estate Tax & Terminal Return
9. 5.2 Capital Gains Inclusion Rate
10. 5.3 Dividend Tax Credit
11. 5.4 Real Estate / Home Downsizing
12. 5.5 Corporate Investment Account (CCPC)
13. 6.1 Automated Strategy Recommendations (AI)

---

## Configuration Update Cadence

These operational updates are separate from the feature pipeline and occur on fixed schedules:

### Annual Tax Updates (before January 1)

1. Obtain new federal and provincial brackets from CRA
2. Create new config files (e.g., `federal-2027.json`)
3. Update CPP maximum, YMPE, OAS amounts
4. Update TFSA contribution limit if changed
5. Run full validation test suite against CRA examples
6. Deploy update

### Quarterly OAS Updates

1. Monitor Service Canada announcements
2. Update OAS amount in config
3. No code changes required (config-driven)

---

## Testing Requirements

All features must meet the testing standards established in v1.5:

| Module            | Target Coverage | Test Count Target |
| ----------------- | --------------- | ----------------- |
| Tax Engine        | 95%+            | 50+ tests         |
| Account Engine    | 95%+            | 40+ tests         |
| Benefit Engine    | 95%+            | 30+ tests         |
| Projection Engine | 90%+            | 40+ tests         |
| Withdrawal Engine | 90%+            | 30+ tests         |

Every test must reference the source-of-truth document and rule ID it validates.

---

## Risk Factors

| Risk                    | Impact                                    | Mitigation                                                                                          |
| ----------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| OAS clawback bug (#82)  | High — affects all downstream projections | Pause pipeline until root cause fixed and regression tests added                                    |
| Tax rule complexity     | High                                      | Each rule references a specific source-of-truth ID; test against CRA examples                       |
| Provincial variation    | Medium                                    | Configuration-driven approach (JSON per province); start with common cases                          |
| Annual CRA updates      | Medium                                    | Config-only changes; automated test suite catches regressions                                       |
| Monte Carlo performance | Low                                       | Already shipped with BullMQ worker; web worker offloads main thread                                 |
| Accuracy validation     | High                                      | Every calculation traceable to source doc; scenario test platform (4.1.1) enables regression gating |

---

## Cross-References

- [00-design-philosophy.md](./00-design-philosophy.md) — Core design principles
- [02-account-types.md](./02-account-types.md) — Account type rules and data models
- [04-tax-engine.md](./04-tax-engine.md) — Tax calculation specifications
- [07-withdrawal-strategies.md](./07-withdrawal-strategies.md) — Withdrawal ordering rules
- [08-projection-engine.md](./08-projection-engine.md) — Core projection loop
- [12-advanced-accounts.md](./12-advanced-accounts.md) — Cash/HISA and CCPC account types
- [13-compliance-scope.md](./13-compliance-scope.md) — Regulatory boundaries and disclaimers
