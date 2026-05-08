# Blueprint Gap Analysis

Compares the current RetireOps implementation against the [TARGET-BLUEPRINT.md](./TARGET-BLUEPRINT.md).

**Legend**: ✅ Implemented · 🟡 Partial · ❌ Not started

---

## 1. Architecture & Infrastructure

| Requirement                                       | Status | Notes                                                       |
| ------------------------------------------------- | ------ | ----------------------------------------------------------- |
| Year-by-year cash flow simulation loop            | ✅     | `projection/yearly-calculator.ts`, `multi-year.ts`          |
| Strictly typed JSON schema for plan state         | ✅     | `@retireops/shared` Zod schemas                             |
| Scenario planning (duplicate & compare plans)     | 🟡     | `ScenariosTab.tsx` exists; backend scenario storage partial |
| Privacy-preserving client-side execution (WASM)   | ❌     | Calculation runs server-side in Node.js (worker + api)      |
| Rules as Code / OpenFisca integration             | ❌     | Tax rules are hardcoded TypeScript; no DSL engine           |
| Automated SCA / dependency vulnerability scanning | ❌     | No SCA tool configured (Dependabot PRs only)                |
| SBOM generation                                   | ❌     | Not implemented                                             |
| Formal governance model documented                | ❌     | No CONTRIBUTING.md governance policy                        |

---

## 2. Macroeconomic & User Parameters

| Requirement                                       | Status | Notes                                                      |
| ------------------------------------------------- | ------ | ---------------------------------------------------------- |
| Date of birth / retirement age inputs             | ✅     | `PersonalInfoStep.tsx`, `UserProfile` schema               |
| Province of residence (drives provincial tax)     | ✅     | `provinceOfResidence` in shared types                      |
| Life expectancy / planning horizon (to age 90-95) | ✅     | `planningHorizonAge` in projection config                  |
| Baseline inflation rate input                     | ✅     | `investments/inflation.ts`                                 |
| Stochastic inflation (randomized year-by-year)    | ❌     | Inflation is a fixed scalar; not stochastic in Monte Carlo |
| Asset class expected return (μ) per class         | 🟡     | Single portfolio μ/σ; not per-asset-class                  |
| Correlation matrix across asset classes           | ❌     | Monte Carlo uses single-asset GBM; no correlation matrix   |
| Inflation volatility (σ for inflation)            | ❌     | Not modeled                                                |

---

## 3. Income, Liabilities & Expense Profiles

| Requirement                                             | Status | Notes                                                                                    |
| ------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| Employment income modeling                              | ✅     | `IncomeStep.tsx`, income types in shared                                                 |
| Defined benefit (DB) pension income                     | 🟡     | `pensionIncome` field exists in schema; `bridgeBenefit` + `bridgeEndAge` in shared types |
| Bridge benefit termination at age 65                    | 🟡     | Schema fields present (`bridgeEndAge`); projection enforcement needs verification        |
| Mortgage / liability amortization modeling              | ❌     | No liability/debt schedule modeling                                                      |
| Phased spending — "go-go / slow-go / no-go" smile curve | ❌     | `ExpensesStep` has single current + retirement expense; no multi-phase input             |
| Rental income modeling                                  | 🟡     | Income schema has type field; no rental property schedule                                |

---

## 4. Asset Inventory

| Requirement                               | Status | Notes                                                                               |
| ----------------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| RRSP accounts                             | ✅     | `accounts/rrsp.ts`, `AccountsStep.tsx`                                              |
| TFSA accounts                             | ✅     | `accounts/tfsa.ts`                                                                  |
| RRIF accounts                             | ✅     | `accounts/rrif.ts`                                                                  |
| LIRA accounts                             | ✅     | `accounts/lira.ts`                                                                  |
| LIF accounts                              | ✅     | `accounts/lif.ts`                                                                   |
| Non-registered accounts with ACB tracking | ✅     | `accounts/non-registered.ts`, ACB in schema                                         |
| Real estate / principal residence flag    | 🟡     | Defined in `docs/source-of-truth/15-real-estate-modeling.md`; no implementation yet |
| Multiple accounts per type                | 🟡     | Schema allows array; UI flow needs verification                                     |

---

## 5. Canadian Tax Engine

| Requirement                                            | Status | Notes                                                              |
| ------------------------------------------------------ | ------ | ------------------------------------------------------------------ |
| Federal progressive tax brackets (2026)                | ✅     | `tax/federal-tax.ts`                                               |
| Provincial tax brackets (all provinces)                | ✅     | `tax/provincial-tax.ts`                                            |
| Capital gains inclusion rate / ACB calculation         | ✅     | `tax/capital-gains.ts`                                             |
| Eligible dividend gross-up + federal DTC               | ✅     | `tax/dividends.ts`                                                 |
| Non-eligible dividend gross-up + DTC                   | ✅     | `tax/dividends.ts`                                                 |
| Age Amount Tax Credit (65+)                            | ✅     | `tax/credits.ts`                                                   |
| Pension Income Amount Credit                           | ✅     | `tax/credits.ts`                                                   |
| Provincial seniors' credits (OEPTC, BC Renter's, etc.) | 🟡     | Credits module exists; coverage per province needs audit           |
| Pension income splitting (couples, up to 50%)          | 🟡     | `withdrawals/optimizer.ts` — `calculatePensionSplitting()` present |
| 2025 blended 14.5% lowest-bracket rate                 | ❌     | Not confirmed; needs audit of federal-tax.ts                       |
| Marginal Effective Tax Rate (METR) output              | 🟡     | Tax calculated per year; METR curve not surfaced in UI             |

---

## 6. OAS Recovery Tax (Clawback)

| Requirement                                    | Status | Notes                                                       |
| ---------------------------------------------- | ------ | ----------------------------------------------------------- |
| 15% surtax above net income threshold          | ✅     | `tax/oas-clawback.ts`                                       |
| 2026 threshold ($95,323) and age 75+ threshold | ✅     | Thresholds in clawback module                               |
| Annual threshold escalation in projections     | 🟡     | Static thresholds; inflation-indexed escalation needs audit |
| Withdrawal sequencing to avoid clawback breach | ✅     | `withdrawals/strategy.ts` — `avoidOASClawback` flag         |

---

## 7. CPP / QPP

| Requirement                                              | Status | Notes                                                         |
| -------------------------------------------------------- | ------ | ------------------------------------------------------------- |
| CPP base benefit calculation                             | ✅     | `benefits/cpp.ts`                                             |
| Early commencement reduction (0.6%/month, max -36%)      | ✅     | `benefits/cpp.ts`                                             |
| Deferred commencement increase (0.7%/month, max +42%)    | ✅     | `benefits/cpp.ts`                                             |
| CPP dropout provisions (child-rearing, low-income years) | ❌     | Not modeled                                                   |
| QPP (Quebec) variant                                     | ❌     | CPP only; QPP differences not implemented                     |
| YMPE contribution history / personalized CPP estimate    | 🟡     | User inputs estimated CPP amount; no YMPE history calculation |
| CPP2 enhanced contribution tier                          | ❌     | Not modeled                                                   |
| Monte Carlo breakeven analysis for CPP delay             | ❌     | Scenarios compared manually; no automated breakeven calc      |

---

## 8. OAS

| Requirement                                            | Status | Notes                               |
| ------------------------------------------------------ | ------ | ----------------------------------- |
| OAS base benefit (age 65)                              | ✅     | `benefits/oas.ts`                   |
| OAS deferral increase (0.6%/month to age 70, max +36%) | ✅     | `benefits/oas.ts`                   |
| OAS 10% top-up at age 75                               | 🟡     | Needs audit of oas.ts               |
| Residence-based partial OAS (40 years = full)          | 🟡     | Partial OAS calculation needs audit |

---

## 9. GIS (Guaranteed Income Supplement)

| Requirement                                       | Status | Notes                                                               |
| ------------------------------------------------- | ------ | ------------------------------------------------------------------- |
| GIS benefit calculation (single, couple variants) | ✅     | `benefits/gis.ts`                                                   |
| 50-cents-per-dollar clawback on non-OAS income    | ✅     | `benefits/gis.ts`                                                   |
| 2026 thresholds ($22,488 single, $29,712 couple)  | ✅     | GIS module has cutoffs                                              |
| TFSA-first pivot when GIS eligibility detected    | 🟡     | `avoidOASClawback` in strategy; GIS-specific TFSA pivot needs audit |
| GIS Allowance / Allowance for Survivor            | ❌     | Not modeled                                                         |

---

## 10. RRIF

| Requirement                                                | Status | Notes                                                             |
| ---------------------------------------------------------- | ------ | ----------------------------------------------------------------- |
| RRSP → RRIF conversion enforcement at age 71               | ✅     | `accounts/rrif.ts`                                                |
| Statutory minimum payout table (ages 71-95+)               | ✅     | `accounts/rrif.ts`                                                |
| Formula-based minimum for voluntary early conversion (<71) | ✅     | `1 / (90 - age)` formula                                          |
| Younger spouse age election for lower minimum              | 🟡     | `SpouseInfoStep.tsx` exists; spouse-age RRIF election needs audit |
| Full withdrawal taxed as ordinary income                   | ✅     | Applied in yearly-calculator                                      |

---

## 11. LIF

| Requirement                                           | Status | Notes                                 |
| ----------------------------------------------------- | ------ | ------------------------------------- |
| LIRA → LIF conversion                                 | ✅     | `accounts/lif.ts`, `accounts/lira.ts` |
| LIF minimum (same as RRIF schedule)                   | ✅     | `accounts/lif.ts`                     |
| LIF maximum (Ontario jurisdiction)                    | ✅     | `accounts/lif.ts`                     |
| Multi-province LIF max tables (BC, AB, Federal, etc.) | 🟡     | Needs audit; Ontario confirmed        |
| "Greater of % or prior year return" maximum rule      | 🟡     | Needs audit of lif.ts                 |

---

## 12. TFSA

| Requirement                                     | Status | Notes                                   |
| ----------------------------------------------- | ------ | --------------------------------------- |
| TFSA contribution room tracking                 | ✅     | `accounts/tfsa.ts`                      |
| Tax-free withdrawals (excluded from net income) | ✅     | Applied in projection                   |
| TFSA re-contribution room after withdrawal      | 🟡     | Needs audit                             |
| Annual room accumulation ($7,000/year indexed)  | ✅     | Contribution limits in shared constants |

---

## 13. Principal Residence Exemption & Downsizing

| Requirement                                              | Status | Notes                                     |
| -------------------------------------------------------- | ------ | ----------------------------------------- |
| PRE flag on real estate assets                           | ❌     | Real estate not yet implemented in engine |
| Downsizing event (future sale date + proceeds injection) | ❌     | Not implemented                           |
| Transaction friction deduction (commissions, LTT)        | ❌     | Not implemented                           |
| Prorated PRE for rental/mixed-use periods                | ❌     | Not implemented                           |

---

## 14. Withdrawal Sequencing

| Requirement                                          | Status | Notes                                                        |
| ---------------------------------------------------- | ------ | ------------------------------------------------------------ |
| Default hierarchy (minimums → non-reg → TFSA → RRSP) | ✅     | `withdrawals/strategy.ts` account priority                   |
| RRSP meltdown / bracket-topping algorithm            | ✅     | `withdrawals/optimizer.ts` + `rrspMeltdown` flag in strategy |
| TFSA surplus deposit after meltdown excess           | 🟡     | `surplusPriority` array in strategy; needs projection audit  |
| Constant Dollar withdrawal methodology               | 🟡     | Implied by fixed expense input; not an explicit mode         |
| Constant Percentage withdrawal methodology           | ❌     | Not implemented as a selectable mode                         |
| Variable withdrawals with floor/ceiling              | ❌     | Not implemented                                              |
| Bucket Strategy (time-horizon segmentation)          | ❌     | Not implemented                                              |

---

## 15. Monte Carlo & Probability of Success

| Requirement                                         | Status | Notes                                                     |
| --------------------------------------------------- | ------ | --------------------------------------------------------- |
| Monte Carlo simulation engine (1,000–10,000 trials) | ✅     | `investments/monte-carlo.ts` (default 1,000)              |
| Geometric Brownian Motion (GBM) returns             | ✅     | GBM drift formula applied                                 |
| Probability of Success score                        | ✅     | `probabilityOfSuccess` in `MonteCarloResult`              |
| Percentile fan chart (5th / 50th / 95th)            | ✅     | `finalBalance5thPercentile`, `finalBalance95thPercentile` |
| Stochastic inflation in Monte Carlo paths           | ❌     | Inflation fixed; only returns randomized                  |
| Per-asset-class volatility + correlation matrix     | ❌     | Single-portfolio σ; no multi-asset correlation            |
| Actionable suggestions when success % is low        | ❌     | Score displayed; no automated recommendation engine       |
| Depletion age tracking                              | ✅     | `depletionAgeMedian` in result                            |

---

## 16. UI / Results

| Requirement                                         | Status | Notes                                                               |
| --------------------------------------------------- | ------ | ------------------------------------------------------------------- |
| Projection wizard (multi-step input)                | ✅     | `steps/` — PersonalInfo, Spouse, Accounts, Income, Expenses, Review |
| Summary results tab                                 | ✅     | `results/SummaryTab.tsx`                                            |
| Year-by-year table                                  | ✅     | `results/YearByYearTab.tsx`                                         |
| Charts (fan chart, income breakdown)                | ✅     | `results/ChartsTab.tsx`                                             |
| Scenario comparison tab                             | 🟡     | `results/ScenariosTab.tsx` — UI exists; deep comparison WIP         |
| Probability of success badge                        | ✅     | Displayed in summary                                                |
| Actionable plan suggestions / recommendations panel | ❌     | Not implemented                                                     |
| PDF report export                                   | ❌     | Spec in `14-visualization-ux.md`; not implemented                   |
| METR curve visualization                            | ❌     | Not implemented                                                     |

---

## Summary Scorecard

| Area                  | ✅ Done | 🟡 Partial | ❌ Missing |
| --------------------- | ------- | ---------- | ---------- |
| Architecture          | 2       | 1          | 5          |
| User Parameters       | 4       | 1          | 3          |
| Income / Liabilities  | 2       | 3          | 1          |
| Asset Inventory       | 5       | 2          | 1          |
| Tax Engine            | 8       | 3          | 1          |
| OAS Clawback          | 3       | 1          | 0          |
| CPP / QPP             | 3       | 2          | 3          |
| OAS                   | 2       | 2          | 0          |
| GIS                   | 3       | 1          | 1          |
| RRIF                  | 4       | 1          | 0          |
| LIF                   | 3       | 2          | 0          |
| TFSA                  | 3       | 1          | 0          |
| PRE / Downsizing      | 0       | 0          | 4          |
| Withdrawal Sequencing | 2       | 2          | 3          |
| Monte Carlo           | 4       | 0          | 3          |
| UI / Results          | 6       | 2          | 3          |
| **TOTAL**             | **54**  | **24**     | **28**     |

**Overall completion: ~51% implemented, ~22% partial, ~27% not started**

---

## Top Priority Gaps (High Impact)

1. **Stochastic inflation** — inflation volatility is a core differentiator called out in the blueprint; currently fixed scalar
2. **Phased spending (smile curve)** — go-go / slow-go / no-go phases; currently single retirement expense figure
3. **PRE / Downsizing** — real estate is a massive portion of Canadian net worth; zero implementation
4. **CPP dropout provisions + QPP** — affects accuracy for early retirees and Quebec residents
5. **Actionable recommendations engine** — low success % should trigger specific suggestions
6. **Multi-asset correlation matrix** — makes Monte Carlo significantly more realistic
7. **Alternative withdrawal methodologies** — constant %, variable with floor/ceiling, bucket strategy
8. **PDF report export** — expected deliverable per `14-visualization-ux.md`
