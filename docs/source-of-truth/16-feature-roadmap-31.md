# RetireOps 31-Feature Master Roadmap

Generated: 2026-04-20
Status: Authoritative feature list for GSD pipeline execution.

## Feature Status

| Milestone | Feature ID | Name                       | Status                                    |
| --------- | ---------- | -------------------------- | ----------------------------------------- |
| M01       | 1.5        | Basic Projections Page     | ✅ Shipped (v1.6)                         |
| M02       | 2.1        | RRIF Conversion            | ✅ Shipped (v1.8)                         |
| M03       | 2.2        | Tax Optimization Engine    | ✅ Shipped (v1.9)                         |
| M04       | 2.3        | Am I Funded                | ✅ Shipped (v1.11)                        |
| M05       | 2.4        | Reverse Calculator         | ✅ Shipped (v1.12)                        |
| M06       | 3.1        | Monte Carlo                | ✅ Shipped (v1.13)                        |
| M07       | 3.2        | Historical Backtesting     | 🔄 Partial (v1.14 phases 60-62 remaining) |
| M08       | 3.3        | Stress Testing             | ✅ Shipped (v1.16)                        |
| M09       | 3.4        | Inflation Toggle           | ✅ Shipped (v1.17)                        |
| M10       | 4.1        | GIS                        | ✅ Shipped (v1.18)                        |
| M11       | 4.2        | Spousal RRSP Attribution   | ✅ Shipped (GSD M001)                     |
| M12       | 4.3        | Contribution Room Tracking | ⬜ New                                    |
| M13       | 4.4        | Pension Adjustment         | ⬜ New                                    |
| M14       | 4.5        | Age-Based Tax Credits      | ⬜ New                                    |
| M15       | 5.1        | Sankey Diagram             | ⬜ New                                    |
| M16       | 5.2        | Advanced Charts            | ⬜ New                                    |
| M17       | 5.3        | Scenario Comparison        | ⬜ Spec exists (old 4.5)                  |
| M18       | 5.4        | PDF Report Export          | ⬜ Spec exists (old 4.6)                  |
| M19       | 6.1        | Deemed Disposition         | 🔄 Active (GSD M004)                      |
| M20       | 6.2        | Probate Fees               | ⬜ New                                    |
| M21       | 6.3        | Surviving Spouse           | ⬜ New                                    |
| M22       | 6.4        | Net Estate Value           | ⬜ New                                    |
| M23       | 7.1        | Life Phases                | ⬜ New                                    |
| M24       | 7.2        | Milestone System           | ⬜ New                                    |
| M25       | 7.3        | Insurance Needs            | ⬜ New                                    |
| M26       | 8.1        | Privacy Storage            | ⬜ New                                    |
| M27       | 8.2        | Onboarding                 | ⬜ New                                    |
| M28       | 8.3        | Data Import                | ⬜ New                                    |
| M29       | 8.4        | Mobile Optimization        | ⬜ New                                    |
| M30       | 8.5        | i18n                       | ⬜ New                                    |
| M31       | 8.6        | Accessibility              | ⬜ New                                    |

## Execution Order

GSD milestones execute strictly in M01 → M31 order. Shipped features get a verification pass. New features get full implementation.

## Tier Structure

**Tier 1 (M01-M05): Core Projections** — Basic retirement planning pipeline
**Tier 2 (M06-M09): Stochastic & Stress** — Monte Carlo, backtesting, stress, inflation
**Tier 3 (M10-M14): Government & Tax** — GIS, attribution, contribution room, pension adj, credits
**Tier 4 (M15-M18): Visualization & Export** — Sankey, charts, scenario comparison, PDF
**Tier 5 (M19-M22): Estate Planning** — Deemed disposition, probate, surviving spouse, net estate
**Tier 6 (M23-M25): Life Planning** — Life phases, milestones, insurance
**Tier 7 (M26-M31): Platform** — Privacy, onboarding, import, mobile, i18n, accessibility
