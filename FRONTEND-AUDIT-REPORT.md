# RetireOps — Frontend-to-Backend Audit

**Generated:** 2026-04-20
**Scope:** `packages/web/src/**` against `packages/calculation-engine/src/**` and `packages/api/src/**`
**Method:** Three parallel Explore passes + targeted verification greps. Every claim in the Feature Matrix and Engine-Fields-Not-Consumed sections was verified by path-and-line lookup.

---

## 1. Executive Summary

RetireOps has a mature calculation engine that substantially overruns the UI that surfaces it. Ten feature areas are wired end-to-end; eleven engine capabilities are either entirely invisible to users or only hinted at in summary text. Three legacy items are not actively broken but will mislead future work: an orphaned `YearlyResult` interface whose shape no longer matches reality, two parallel projection-input paths (legacy flat form vs profile-based scenarios), and two live-but-redundant list routes (`/scenarios` vs `/profile/scenarios`).

- **10** feature areas wired
- **11** engine capabilities missing or mentioned-only
- **16** row-level engine output fields with zero web references
- **1** backend API endpoint (`GET /api/projections/:id/analyze`) fully implemented but never called from the web
- **3** legacy items (orphan interface, parallel input paths, duplicated list routes)

The highest-impact gap is the Optimizations surface: four analyzers (RRSP meltdown, CPP/OAS timing, income splitting, drawdown order) run on the server and return structured `InsightCard[]`, but no component fetches them. The second is estate/terminal-return output — for couples the deemed-disposition tax at death can be material and is never shown.

---

## 2. Feature Matrix

| #   | Feature                                                                     | Engine Module                                                                          | API Endpoint                                                                                                     | UI Status                  | Component                                                                                 | Gap                                                                              |
| --- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | Summary KPIs + funded status + remediation                                  | `projection/yearly-calculator.ts`, summary aggregation                                 | `GET /api/profile-scenarios/:id/result` (and legacy `GET /api/projections/:id`)                                  | **WIRED**                  | `packages/web/src/components/projection/results/SummaryTab.tsx`                           | —                                                                                |
| 2   | Year-by-year table                                                          | `projection/yearly-calculator.ts` (row builder)                                        | same                                                                                                             | **WIRED**                  | `components/projection/results/YearByYearTab.tsx`                                         | `bracketFillWithdrawal` and pension-split per-year columns not rendered          |
| 3   | Charts (net worth area, income bars, allocation donut, tax line)            | projection rows                                                                        | same                                                                                                             | **WIRED**                  | `components/projection/results/ChartsTab.tsx`                                             | Uses inline shape, not `YearlyResult`                                            |
| 4   | Net worth single-line                                                       | projection rows                                                                        | same                                                                                                             | **WIRED**                  | `components/projection/results/NetWorthLineChart.tsx`                                     | —                                                                                |
| 5   | Nominal/real display toggle                                                 | `assumptions.inflationRate`                                                            | — (client transform)                                                                                             | **WIRED**                  | `components/projection/results/InflationToggle.tsx` + `hooks/useProjectionDisplayMode.ts` | —                                                                                |
| 6   | Monte Carlo                                                                 | `monte-carlo/*`                                                                        | `POST /api/monte-carlo` + status polling                                                                         | **WIRED**                  | `components/projection/results/MonteCarloPanel.tsx`, `MonteCarloFanChart.tsx`             | —                                                                                |
| 7   | Historical backtest                                                         | `backtest/*`                                                                           | `GET /api/projections/:id/backtest` (legacy only — see note), `POST /api/profile-scenarios/:id/backtest`         | **WIRED** (scenario-level) | `BacktestPanel.tsx` + `BacktestChart.tsx`                                                 | Projection-level backtest endpoint exists but unused                             |
| 8   | Stress testing (4 presets)                                                  | `backtest/stress/*`                                                                    | `POST /api/profile-scenarios/:id/stress`                                                                         | **WIRED**                  | `components/projection/results/StressTestPanel.tsx`                                       | —                                                                                |
| 9   | Scenario decisions editor                                                   | `scenarios/decisions-*`                                                                | `PATCH /api/profile-scenarios/:id/decisions`                                                                     | **WIRED**                  | `app/(dashboard)/profile/scenarios/[id]/edit/page.tsx`                                    | —                                                                                |
| 10  | Scenario list + compare                                                     | scenario service                                                                       | `GET /api/profile-scenarios`                                                                                     | **WIRED**                  | `components/projection/results/ScenariosTab.tsx` + `ComparisonView`                       | —                                                                                |
| 11  | GIS (Guaranteed Income Supplement)                                          | `benefits/gis.ts`                                                                      | via scenario result                                                                                              | **WIRED (primary only)**   | YearByYearTab conditional column                                                          | Couple `spouseGisIncome` computed, never shown                                   |
| 12  | **Optimization analyzers** (RRSP meltdown, CPP/OAS, income split, drawdown) | `optimization/analyzers/*.ts`, `optimization/orchestrator.ts`                          | `GET /api/projections/:id/analyze` (`packages/api/src/routes/projections.routes.ts:220`)                         | **MISSING**                | —                                                                                         | Endpoint returns `OptimizationResult { cards, wellOptimized }`; zero web callers |
| 13  | **Terminal return (deemed disposition / estate)**                           | `tax/terminal-return.ts` (invoked from `projection/multi-year.ts:140,245,272,287,296`) | serialized to `ProjectionOutput.terminalTaxEvents`, `ProjectionSummary.terminalTaxes/grossEstate/netEstate`      | **MISSING**                | —                                                                                         | Zero web refs to any estate field                                                |
| 14  | **Withdrawal optimizer** (bracket-fill, OAS protection)                     | `withdrawals/optimizer.ts`                                                             | row-level `bracketFillWithdrawal`                                                                                | **MISSING**                | —                                                                                         | Field present in output, never rendered                                          |
| 15  | **Contribution room** (RRSP/TFSA/FHSA)                                      | `projection/yearly-calculator.ts`                                                      | row-level `rrspContributionRoom`                                                                                 | **MISSING**                | —                                                                                         | No room-tracking UI or over-contribution warning                                 |
| 16  | **Pension splitting per-year**                                              | `projection/pension-splitting-eligibility.ts`                                          | `pensionIncomeReceived`, `pensionIncomeTransferred`, `pensionSplitPercentage`, per-year `pensionSplitTaxSavings` | **MENTIONED-ONLY**         | Input toggle in edit page; SummaryTab shows `totalPensionSplitTaxSavings` only            | No per-year split decision surface                                               |
| 17  | **Spousal RRSP attribution**                                                | `projection/yearly-calculator.ts`                                                      | `spousalRRSPAttributedIncome`                                                                                    | **MISSING**                | —                                                                                         | Couples flag never shown                                                         |
| 18  | **Dividends (gross-up + DTC)**                                              | `tax/dividends.ts`                                                                     | embedded in tax calc                                                                                             | **MISSING**                | —                                                                                         | No eligible/non-eligible breakdown exposed to UI                                 |
| 19  | **Capital gains tiered inclusion (50%/66.67%)**                             | `tax/capital-gains.ts`                                                                 | embedded in `TaxCalculation.taxableCapitalGain`                                                                  | **MISSING**                | —                                                                                         | No realized-vs-taxable split visible                                             |
| 20  | **Non-refundable credits** (age, pension-income, medical, disability)       | `tax/credits.ts`                                                                       | aggregated into `totalTax` only                                                                                  | **NOT SURFACED**           | —                                                                                         | Engine doesn't emit a per-credit breakdown; both engine and UI gap               |
| 21  | **Couple RRIF conversion flag**                                             | projection engine                                                                      | `eitherRRIFConversion`                                                                                           | **MISSING**                | —                                                                                         | Couple-joint RRIF year never shown                                               |

**Verification greps (ran against `packages/web/src/**`):\*\*

- `terminalTaxes|grossEstate|netEstate|spousalRRSPAttributedIncome|pensionIncomeReceived|pensionIncomeTransferred|rrspContributionRoom|bracketFillWithdrawal|pensionSplitPercentage` → **0 matches**
- `spouseRrifForcedMinimum|spouseRrifMinimumRate|spouseRrifConversionYear|spouseGisIncome|spouseLifWithdrawal|eitherRRIFConversion` → **0 matches**
- `/analyze` → **0 matches**
- `import.*\bYearlyResult\b` → **0 matches**

---

## 3. Missing UI Features

Each entry below lists what the engine produces, why a user would want to see it, and a sketch of the component that could surface it.

### 3.1 Optimizations tab (HIGHEST LEVERAGE)

- **Engine**: `packages/calculation-engine/src/optimization/orchestrator.ts` composes four analyzers under `packages/calculation-engine/src/optimization/analyzers/` (RRSP meltdown, CPP/OAS timing, income splitting, drawdown order) and returns `OptimizationResult { cards: InsightCard[], wellOptimized: boolean }`.
- **API**: `GET /api/projections/:id/analyze` (`packages/api/src/routes/projections.routes.ts:220–282`).
- **User value**: Concrete, ranked suggestions — each card already carries title, rationale, projected dollar impact. This is the feature most likely to move a user from "I see numbers" to "I know what to do."
- **Sketch**: a new `OptimizationsTab.tsx` in `components/projection/results/`; wire alongside the existing tabs in `app/(dashboard)/profile/scenarios/[id]/results/page.tsx`. Card list, sortable by impact, with an empty state for `wellOptimized === true`.

### 3.2 Estate / terminal return panel

- **Engine**: `packages/calculation-engine/src/tax/terminal-return.ts` computes deemed-disposition tax on death. Emitted as `ProjectionOutput.terminalTaxEvents` (array of events per death year) and `ProjectionSummary.{terminalTaxes, grossEstate, netEstate}`.
- **User value**: For couples, the first death's deemed-disposition impact on the survivor is significant and often surprising. Single filers benefit from seeing the estate shrinkage at life expectancy.
- **Sketch**: `EstateTab.tsx` — headline KPIs (`grossEstate`, `terminalTaxes`, `netEstate`), a per-event table (`year`, `triggeringPerson`, `assetType`, `taxableAmount`, `taxPaid`), and an optional waterfall chart.

### 3.3 Per-year pension-splitting decisions

- **Engine**: `packages/calculation-engine/src/projection/pension-splitting-eligibility.ts` emits `pensionIncomeReceived`, `pensionIncomeTransferred`, `pensionSplitPercentage`, `pensionSplitTaxSavings` per row.
- **Current UI**: only the lifetime aggregate `totalPensionSplitTaxSavings` shows in `SummaryTab.tsx`; the per-year decision is invisible.
- **Sketch**: a "Pension Splitting" collapsible section in YearByYearTab (four extra couple-only columns) plus a small "% split over time" line chart.

### 3.4 Contribution-room warning banner

- **Engine**: `PersonYearlyResult.rrspContributionRoom` (and TFSA limit helpers) flows from `projection/yearly-calculator.ts`.
- **User value**: Users entering contributions in the decisions editor can accidentally exceed room.
- **Sketch**: inline warning in `app/(dashboard)/profile/scenarios/[id]/edit/page.tsx` under the Savings block — compare `contributionOverrides[*].annualAmount` against current-year room.

### 3.5 Bracket-fill withdrawal breakdown

- **Engine**: `packages/calculation-engine/src/withdrawals/optimizer.ts` produces `bracketFillWithdrawal` on each row when the strategy is active.
- **Sketch**: Add a column in YearByYearTab (conditional on `bracketFillWithdrawal > 0`) and a callout strip in SummaryTab summarizing lifetime bracket-fill dollars.

### 3.6 Dividends and capital-gains detail

- **Engine**: `tax/dividends.ts` and `tax/capital-gains.ts` are called from `tax/index.ts#calculateTotalTax` and `yearly-calculator.ts`, but only the aggregate tax is emitted.
- **Gap is partly engine-side**: the engine would need to expose the pieces (eligible/non-eligible dividend dollars, realized vs taxable capital gain) before a UI can render them. If/when exposed, add a "Tax detail" collapsible under YearByYearTab.

### 3.7 Non-refundable credits breakdown

- **Engine**: `tax/credits.ts` computes age amount, pension income, medical, disability credits — summed into `totalTax` only. A per-credit breakdown would need to be emitted first.
- **User value**: Users want to see age-amount and pension-income credit take effect at 65; currently the jump is invisible.

### 3.8 Spousal RRSP attribution flag

- **Engine**: `spousalRRSPAttributedIncome` captures the 3-year attribution rule for couple withdrawals.
- **Sketch**: a small icon/tooltip on the relevant row in YearByYearTab; no new tab needed.

### 3.9 Couple RRIF conversion year

- **Engine**: `eitherRRIFConversion` joint flag.
- **Sketch**: SummaryTab timeline already shows `rrifConversionYear` for the primary; extend to show spouse and joint transitions.

### 3.10 Couple-spouse row fields

- `spouseGisIncome`, `spouseLifWithdrawal`, `spouseRrifForcedMinimum`, `spouseRrifMinimumRate`, `spouseRrifConversionYear` are all emitted but never read. Extend YearByYearTab's sparse-column detection to the spouse columns.

---

## 4. Legacy Code Inventory

| File / Location                                                                                                                                                                                                                | Issue                                                                                                                                                                                                                                                                    | Recommendation                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/web/src/types/projection.ts:106–123` — `YearlyResult` interface                                                                                                                                                      | Orphaned: zero `import` references. Its field set (no `totalNetWorth`, no RRIF flags, no couple fields) is narrower than the inline shapes used by consumers (`SummaryTab.tsx:64`, `ChartsTab.tsx:26`, `BacktestChart.tsx:40`). Future readers will use it and be wrong. | **Delete** the interface or **replace** it with the canonical `ProjectionYearRow` from `@retireops/shared`. Also update `ProjectionResultData.yearlyResults` at `packages/web/src/types/projection.ts:89` to use the canonical type so consumer inlines go away. |
| `packages/web/src/lib/projection-form.ts` (355 lines) + `packages/web/src/app/(dashboard)/projections/new/page.tsx` + `.../[id]/edit/page.tsx` vs `packages/web/src/lib/api/profile-scenarios.ts` + `.../profile/scenarios/**` | Two parallel input paths are live simultaneously. Dashboard nav points to `/projections/view` (hybrid) and to `/profile/scenarios` (modern). `/projections/new` uses the legacy flat schema; `/profile/scenarios` uses the nested profile schema.                        | **Decide which path is canonical**, then delete the other. Evidence suggests `/profile/scenarios` wins — it already owns the richest decision editor.                                                                                                            |
| `packages/web/src/app/(dashboard)/projections/{view,[id],[id]/edit,new}/page.tsx`                                                                                                                                              | Legacy routes still live; `/projections/view` actually loads profile scenarios (hybrid). `/scenarios/page.tsx` coexists with `/profile/scenarios/page.tsx`.                                                                                                              | Alongside the decision above, collapse `/projections/*` and `/scenarios` into redirects to the corresponding `/profile/scenarios/*` routes, then remove the legacy files.                                                                                        |
| `packages/web/src/lib/api/{projections,scenarios}.ts`                                                                                                                                                                          | Legacy API clients are still in use from legacy routes.                                                                                                                                                                                                                  | Removed together with the routes above.                                                                                                                                                                                                                          |
| 25+ `@typescript-eslint/no-unsafe-*` eslint-disable blocks across web                                                                                                                                                          | Concentrated in `lib/api/client.ts`, `lib/projection-form.ts`, scenario page components. Downstream of loose API response typing.                                                                                                                                        | **Defer** — tackle by generating typed clients from the Fastify schemas (api already uses zod), which lets the disables drop without manual annotations. Not blocking.                                                                                           |
| TODO/FIXME/HACK markers                                                                                                                                                                                                        | **None found** in `packages/web/src`.                                                                                                                                                                                                                                    | Nothing to action here.                                                                                                                                                                                                                                          |

---

## 5. Engine Fields Not Consumed by the Web Layer

Verified zero references in `packages/web/src/**`. Grouped by category.

**Estate / terminal return**

- `ProjectionSummary.terminalTaxes`
- `ProjectionSummary.grossEstate`
- `ProjectionSummary.netEstate`
- `ProjectionOutput.terminalTaxEvents` (each event's fields)

**Couple pension-splitting (per-year)**

- `PersonYearlyResult.pensionIncomeReceived`
- `PersonYearlyResult.pensionIncomeTransferred`
- `CoupleYearlyResult.pensionSplitPercentage`
- Per-year `CoupleYearlyResult.pensionSplitTaxSavings` (the household _total_ is shown, but per-year is not)

**Couple RRIF / spouse mirror fields**

- `ProjectionYearRow.spouseRrifForcedMinimum`
- `ProjectionYearRow.spouseRrifMinimumRate`
- `ProjectionYearRow.spouseRrifConversionYear`
- `ProjectionYearRow.spouseGisIncome`
- `ProjectionYearRow.spouseLifWithdrawal`
- `CoupleYearlyResult.eitherRRIFConversion`

**Contribution room**

- `PersonYearlyResult.rrspContributionRoom`
- (TFSA annual-limit helpers are never called from web either, though not a row field.)

**Withdrawal strategy**

- `PersonYearlyResult.bracketFillWithdrawal`

**Spousal attribution**

- `PersonYearlyResult.spousalRRSPAttributedIncome`

---

## 6. Priority Recommendations

Ranked by user impact. Every item is actionable without a corresponding backend change unless called out.

| #   | Recommendation                                                                                                                                                                                  | Effort                                         | Backend change needed?                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------- |
| 1   | **Build `OptimizationsTab`** that calls `GET /api/projections/:id/analyze` and renders the `InsightCard[]` list, sorted by dollar impact, with a "well optimized" empty state.                  | Medium (one new tab + fetch hook)              | No — endpoint already complete                                  |
| 2   | **Build `EstateTab`** showing `grossEstate`, `terminalTaxes`, `netEstate` plus per-event table from `terminalTaxEvents`. Highest value for couples.                                             | Medium                                         | No                                                              |
| 3   | **Add pension-splitting per-year surface** in YearByYearTab (columns) plus a small "split % over time" chart. Input toggle already collected.                                                   | Small                                          | No                                                              |
| 4   | **Add contribution-room warning** in the decisions editor Savings block, driven by `rrspContributionRoom`.                                                                                      | Small                                          | No                                                              |
| 5   | **Expose `bracketFillWithdrawal`** as a YearByYearTab column (conditional, sparse) and a SummaryTab lifetime callout.                                                                           | Small                                          | No                                                              |
| 6   | **Delete or replace `YearlyResult` interface** in `packages/web/src/types/projection.ts`; migrate `ProjectionResultData.yearlyResults` to the shared `ProjectionYearRow`. Eliminates a footgun. | Small                                          | No                                                              |
| 7   | **Consolidate projection entry paths** — decide `/projections/*` vs `/profile/scenarios/*`, redirect/delete the losing path and its API client.                                                 | Medium (multiple route deletions + smoke test) | No                                                              |
| 8   | **Surface couple-spouse row fields** (spouseGisIncome, spouseLifWithdrawal, spouseRrif\*). Extend the sparse-column detector.                                                                   | Small                                          | No                                                              |
| 9   | **Emit credit, dividend, and capital-gains breakdowns** from the engine so a Tax Detail panel can render them. Worth pairing with a new "Tax detail" section.                                   | Medium–Large (engine change first)             | **Yes** — engine needs to stop collapsing to a single aggregate |
| 10  | **Type the API client end-to-end** (generate from Fastify/zod schemas), drop the 25+ eslint-disables.                                                                                           | Medium                                         | No                                                              |

---

## Appendix A — Verification commands (re-runnable)

```bash
# 15 fields that should have zero UI references
rg -n 'terminalTaxes|grossEstate|netEstate|spousalRRSPAttributedIncome|pensionIncomeReceived|pensionIncomeTransferred|rrspContributionRoom|bracketFillWithdrawal|pensionSplitPercentage' packages/web/src
rg -n 'spouseRrifForcedMinimum|spouseRrifMinimumRate|spouseRrifConversionYear|spouseGisIncome|spouseLifWithdrawal|eitherRRIFConversion' packages/web/src

# Optimizations endpoint — UI should not call it (yet)
rg -n '/analyze' packages/web/src

# Orphan interface — should have no importers
rg -n 'import.*\bYearlyResult\b' packages/web/src

# Confirm engine/api wiring still exists
rg -n 'terminalTaxEvents' packages/calculation-engine/src packages/api/src
rg -n '/analyze' packages/api/src/routes
```

All four "expect zero" checks returned zero at audit time (2026-04-20).
