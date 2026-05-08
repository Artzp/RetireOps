# 13 - Compliance Scope Specification

## Overview

RetireOps is an educational retirement planning tool, not a financial advisory service. This document defines the legal and regulatory boundaries of the software, required disclaimers, and the explicit scope of what the tool does and does not provide. All user-facing surfaces must comply with these rules.

---

## What This Software IS

RetireOps is a **decision-support tool** that helps Canadians understand their retirement cash flow projections. Specifically, it:

- Forecasts future account balances, taxes, and government benefits using publicly available rules
- Allows users to compare scenarios (e.g., retire at 60 vs. 65)
- Visualizes projected outcomes over time
- Applies Canadian tax law and benefit formulas as documented in official CRA and Service Canada publications

---

## What This Software Is NOT

The following exclusions are hard boundaries. The software must never cross these lines, and the UI must never imply otherwise.

| Rule ID   | Exclusion                                | Description                                                                                                   |
| --------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| SCOPE-001 | Not financial advice                     | Does not provide personalized financial, investment, or tax advice regulated under provincial securities acts |
| SCOPE-002 | Not a robo-advisor                       | Does not execute trades, rebalance portfolios, or manage investments                                          |
| SCOPE-003 | Not tax filing software                  | Does not prepare, file, or submit tax returns to CRA                                                          |
| SCOPE-004 | Not insurance advice                     | Does not recommend life insurance, annuities, or disability products                                          |
| SCOPE-005 | Not estate planning                      | Does not draft wills, trusts, powers of attorney, or estate documents                                         |
| SCOPE-006 | Not real-time data                       | Uses static annual rates and rules; does not connect to live market feeds or brokerage accounts               |
| SCOPE-007 | Not a substitute for professional advice | Users should consult a qualified financial planner, accountant, or tax advisor for personalized guidance      |

---

## Required Disclaimers

### Disclaimer Text

The following disclaimer must appear verbatim wherever specified by the placement rules below:

> **Disclaimer:** RetireOps is an educational planning tool that provides projections based on publicly available Canadian tax and benefit rules. It does not constitute financial, tax, investment, or legal advice. Projections are estimates based on assumptions that may not reflect your actual outcomes. Consult a qualified financial professional before making retirement decisions.

### Placement Rules

| Rule ID     | Placement               | Requirement                                                                                          |
| ----------- | ----------------------- | ---------------------------------------------------------------------------------------------------- |
| VR-DISC-001 | Application footer      | Abbreviated disclaimer visible on every page: "For educational purposes only. Not financial advice." |
| VR-DISC-002 | Projection results page | Full disclaimer text displayed above or immediately below projection results                         |
| VR-DISC-003 | PDF report              | Full disclaimer on the first page and abbreviated disclaimer in the footer of every subsequent page  |
| VR-DISC-004 | Account registration    | Full disclaimer must be acknowledged (checkbox) during account creation before first use             |

---

## Data and Accuracy Limitations

| Assumption                                 | Reality                                               | Impact                                               |
| ------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------------- |
| Tax brackets updated annually in code      | Brackets may change mid-year via budget announcements | Projections may be slightly off for the current year |
| Flat annual return rates per account       | Actual returns vary daily and by asset class          | Long-term projections diverge from actual outcomes   |
| CPP/OAS rates from latest available tables | Rates indexed annually by CPI                         | Future benefit amounts are estimates                 |
| Inflation assumed constant (default 2%)    | Actual inflation fluctuates                           | Purchasing power projections are approximate         |
| Life expectancy is user-specified          | Actual lifespan is unknown                            | Plan may be too short or too long                    |
| Province of residence is fixed             | Users may move provinces                              | Tax calculations may not reflect future residency    |

---

## In-Scope Features

| Category        | Features                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| Projections     | Year-by-year cash flow, net worth, income, taxes, withdrawals                                              |
| Accounts        | RRSP, RRIF, TFSA, LIRA, LIF, non-registered, cash/HISA, corporate investment                               |
| Tax engine      | Federal and provincial brackets, basic personal amount, age credit, OAS clawback, pension income splitting |
| Benefits        | CPP/QPP (early/late adjustments), OAS, GIS                                                                 |
| Scenarios       | Side-by-side comparison of up to 3 retirement strategies                                                   |
| Visualization   | Charts, tables, PDF export                                                                                 |
| Couple planning | Joint projections for married/common-law partners                                                          |

---

## Out-of-Scope Features

| Category              | Exclusion                                                              | Reason                                        |
| --------------------- | ---------------------------------------------------------------------- | --------------------------------------------- |
| Investment selection  | No mutual fund, ETF, or stock recommendations                          | Would require securities registration         |
| Portfolio rebalancing | No automatic or suggested rebalancing                                  | Crosses into advisory territory               |
| Tax filing            | No T1 generation or CRA submission                                     | Separate regulatory domain                    |
| Insurance products    | No annuity, life, or disability modeling                               | Requires licensed advice                      |
| US/international      | No cross-border tax, US Social Security, or foreign pensions           | Out of Canadian scope                         |
| Real-time market data | No live price feeds or brokerage integration                           | Complexity and cost; not educational planning |
| Debt management       | No debt repayment optimization (beyond mortgage in real estate module) | Separate financial domain                     |

---

## Advisor Use Context

Financial advisors may use RetireOps as a planning tool within their practice, subject to the following:

- The tool supplements, but does not replace, the advisor's professional judgment
- Advisors remain responsible for the suitability of any recommendations made to clients
- PDF reports generated by RetireOps must include the full disclaimer (VR-DISC-003)
- The advisor's firm name and branding may appear on PDF reports alongside the RetireOps disclaimer

---

## Test Cases

### TC-SCOPE-001: Disclaimer Presence on Results Page

**Input:** User completes a projection and views the results page.

**Expected:**

- Full disclaimer text (as defined above) is visible on the projection results page
- Disclaimer appears above or immediately below the projection output
- VR-DISC-002 is satisfied

---

### TC-SCOPE-002: Registration Disclaimer Acknowledgment

**Input:** New user creates an account and proceeds to use the tool.

**Expected:**

- During registration, the full disclaimer is displayed with a checkbox
- User cannot proceed to create a plan without checking the acknowledgment box
- VR-DISC-004 is satisfied

---

### TC-SCOPE-003: PDF Report Disclaimer

**Input:** User exports a projection as a PDF report.

**Expected:**

- First page of the PDF contains the full disclaimer text
- Every subsequent page contains the abbreviated disclaimer in the footer
- VR-DISC-003 is satisfied

---

## Cross-References

- [14-visualization-ux.md](./14-visualization-ux.md) — PDF report layout and disclaimer placement
