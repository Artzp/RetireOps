# TESTING — RetireOps Test Specification

**Phase:** 29 — TESTING.md Specification
**Created:** 2026-04-05
**Input:** docs/TESTABLE-SURFACES.md (228 surfaces across 10 sections; TC-FUTURE excluded)
**Purpose:** One test scenario per testable surface with explicit inputs, expected outputs, source-of-truth citations, tolerance annotations, and structural/snapshot labels. Consumed by Phase 30+ when actual test files are authored.

---

## SOT Citation Legend

| Shorthand | File                                             |
| --------- | ------------------------------------------------ |
| SOT-00    | docs/source-of-truth/00-design-philosophy.md     |
| SOT-01    | docs/source-of-truth/01-user-profile.md          |
| SOT-02    | docs/source-of-truth/02-account-types.md         |
| SOT-03    | docs/source-of-truth/03-income-sources.md        |
| SOT-04    | docs/source-of-truth/04-tax-engine.md            |
| SOT-05    | docs/source-of-truth/05-government-benefits.md   |
| SOT-06    | docs/source-of-truth/06-investment-engine.md     |
| SOT-07    | docs/source-of-truth/07-withdrawal-strategies.md |
| SOT-08    | docs/source-of-truth/08-projection-engine.md     |
| SOT-09    | docs/source-of-truth/09-success-metrics.md       |
| SOT-10    | docs/source-of-truth/10-scenarios.md             |
| SOT-11    | docs/source-of-truth/11-development-roadmap.md   |
| SOT-12    | docs/source-of-truth/12-advanced-accounts.md     |
| SOT-13    | docs/source-of-truth/13-compliance-scope.md      |
| SOT-14    | docs/source-of-truth/14-visualization-ux.md      |
| SOT-15    | docs/source-of-truth/15-real-estate-modeling.md  |

Citations use the form `SOT-04 §3.2` meaning `docs/source-of-truth/04-tax-engine.md` section 3.2. Values flagged `[NEEDS CONFIRMATION]` are either marked 'projected' or 'approximate' in the cited SOT document, or lack a verifiable source in SOT.

---

## Conventions

### Scenario IDs

Base ID is the TESTABLE-SURFACES.md surface ID (e.g., TC-TAX-001). Additional scenarios within the same surface use a letter suffix (TC-TAX-001b, TC-TAX-001c). Boundary-ascending order is preferred within a surface.

### Inputs column

Named parameters on one line: `income=80000, year=2024, province='ON'`. Age-based events carry both `age=72` and `projectionYear=2031` coordinates.

### Expected Output column

Numeric values include an inline tolerance annotation: `$14,049.00 [exact]` or `~$8,500 [±$1]` or `~$12,500 [±0.5%]`. HTTP status codes and response shapes in TC-ASSEMBLE are exact by definition and require no annotation unless a numeric body field needs precision.

### Citation column

SOT-NN §X.Y shorthand, or `[NEEDS CONFIRMATION]` for values the SOT marks projected/approximate.

### Structural vs Snapshot labels

Inline marker at the end of Scenario Name: `[structural]` tests stable logic (e.g., "bracket tax = sum of per-bracket products"); `[snapshot]` tests annually-changing CRA constant values (e.g., "2024 federal bracket thresholds"). Every scenario row MUST carry exactly one label.

### Hardcoded-literal handling

When an expected value comes from a hardcoded literal rather than a shared constant, use the value as expected output and add a Notes cell reference to the REGR surface. No [NEEDS CONFIRMATION] flag.

### REGR scenarios

Document CURRENT broken behavior as the expected output (change-detection baseline, not correctness assertion).

---

## Section Index

- TC-TAX — Federal + provincial tax (30 surfaces)
- TC-RRIF — RRIF minimum withdrawal + conversion (9 surfaces)
- TC-CPP — CPP benefits (14 surfaces)
- TC-OAS — OAS benefits (15 surfaces)
- TC-GIS — GIS benefits (13 surfaces)
- TC-PROJ — Projection engine + account rules (35 surfaces)
- TC-CHAIN — Profile → scenario → engine data flow (18 surfaces)
- TC-ASSEMBLE — API routes + middleware + JWT (37 surfaces)
- TC-E2E Component Specs — React feature components via react-testing-library (feature component surfaces from 17 TC-E2E)
- TC-E2E-PLAYWRIGHT — Full-stack user journey specs (≥10 Playwright journeys)
- REGR — Regression baselines from CONCERNS.md (22 surfaces)

TC-FUTURE (investments/ module) from TESTABLE-SURFACES.md is EXCLUDED from this document per Phase 29 scope.

---

## TC-TAX: Federal and Provincial Tax Scenarios

Scenarios cover all 30 TC-TAX surfaces from docs/TESTABLE-SURFACES.md. Source files: federal-tax.ts, provincial-tax.ts, capital-gains.ts, dividends.ts, credits.ts, oas-clawback.ts. Primary SOT: SOT-04 (tax engine).

| ID          | Scenario Name                                                                            | Inputs                                                         | Expected Output                                                                                     | Citation                                          | Notes                                                                                         |
| ----------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| TC-TAX-001  | Federal bracket tax: 2024 — $50,000 in bracket 1 [snapshot]                              | taxableIncome=50000, year=2024                                 | $7,500.00 [exact] (50000 × 0.15)                                                                    | SOT-04 §federal-brackets-2024                     | Lowest bracket only; no bracket crossover                                                     |
| TC-TAX-001b | Federal bracket tax: 2024 — $80,000 spans brackets 1+2 [snapshot]                        | taxableIncome=80000, year=2024                                 | $13,327.32 [exact] ($55,867 × 0.15 + $24,133 × 0.205)                                               | SOT-04 §federal-brackets-2024                     | Spans bracket boundary at $55,867                                                             |
| TC-TAX-001c | Federal bracket tax: 2024 — top-bracket 0.33 marginal [snapshot]                         | taxableIncome=300000, year=2024                                | $74,716.97 [exact] (sum across all 5 brackets)                                                      | SOT-04 §federal-brackets-2024                     | All 5 brackets; 5th bracket rate 0.33 on income above $246,752                                |
| TC-TAX-002  | Federal bracket tax: 2025 lowest-rate 0.145 [snapshot]                                   | taxableIncome=50000, year=2025                                 | ~$7,250.00 [NEEDS CONFIRMATION] (50000 × 0.145)                                                     | SOT-04 §federal-brackets-2024                     | 2025 lowest rate 0.145 marked projected in SOT-04                                             |
| TC-TAX-003  | Federal bracket tax: 2026 lowest-rate 0.14 [snapshot]                                    | taxableIncome=50000, year=2026                                 | ~$7,000.00 [NEEDS CONFIRMATION] (50000 × 0.14)                                                      | SOT-04 §federal-brackets-2024                     | 2026 rates marked projected in SOT-04                                                         |
| TC-TAX-004  | Federal BPA credit: 2024 [snapshot]                                                      | year=2024                                                      | $2,355.75 [exact] ($15,705 × 0.15)                                                                  | SOT-04 §federal-brackets-2024 (BPA section)       | BPA 2024 = $15,705 confirmed in SOT-04                                                        |
| TC-TAX-004b | Federal BPA credit: 2025 [snapshot]                                                      | year=2025                                                      | $2,419.35 [NEEDS CONFIRMATION] ($16,129 × 0.15)                                                     | SOT-04 §federal-brackets-2024 (BPA section)       | BPA 2025 = $16,129 marked projected in SOT-04                                                 |
| TC-TAX-005  | Federal age credit: age=64 — no credit [structural]                                      | age=64, netIncome=40000, year=2024                             | $0.00 [exact]                                                                                       | SOT-04 §age-credit                                | Age < 65 — credit does not apply                                                              |
| TC-TAX-005b | Federal age credit: age=65 — full credit (income below threshold) [structural]           | age=65, netIncome=40000, year=2024                             | $1,318.50 [exact] ($8,790 × 0.15; no reduction as income < $44,325)                                 | SOT-04 §age-credit                                | Age amount $8,790, threshold $44,325                                                          |
| TC-TAX-005c | Federal age credit: age=65 — fully phased out (high income) [structural]                 | age=65, netIncome=103,625, year=2024                           | $0.00 [exact] (reduction ($103,625 - $44,325) × 0.15 = $8,895 exceeds $8,790)                       | SOT-04 §age-credit                                | Phase-out complete; credit = 0                                                                |
| TC-TAX-006  | Federal pension income credit: eligible income below $2,000 cap [structural]             | eligiblePensionIncome=1200, year=2024                          | $180.00 [exact] ($1,200 × 0.15)                                                                     | SOT-04 §pension-income-credit                     | Below $2,000 cap; full amount eligible                                                        |
| TC-TAX-006b | Federal pension income credit: eligible income above $2,000 cap [structural]             | eligiblePensionIncome=2500, year=2024                          | $300.00 [exact] (min(2500, 2000) × 0.15)                                                            | SOT-04 §pension-income-credit                     | Cap at $2,000; max credit $300                                                                |
| TC-TAX-007  | Quebec federal abatement: 16.5% reduction applied [structural]                           | grossFederalTax=10000, isQuebec=true                           | $8,350.00 [exact] ($10,000 × (1 - 0.165))                                                           | SOT-04 §quebec-abatement                          | Federal abatement reduces QC resident federal tax by 16.5%                                    |
| TC-TAX-008  | Federal marginal rate: bracket 1 ($40,000) [structural]                                  | taxableIncome=40000, year=2024                                 | 0.15 [exact]                                                                                        | SOT-04 §federal-brackets-2024                     | Below $55,867 threshold                                                                       |
| TC-TAX-008b | Federal marginal rate: bracket 2 ($80,000) [structural]                                  | taxableIncome=80000, year=2024                                 | 0.205 [exact]                                                                                       | SOT-04 §federal-brackets-2024                     | Between $55,867 and $111,733                                                                  |
| TC-TAX-008c | Federal marginal rate: bracket 5 ($300,000) [structural]                                 | taxableIncome=300000, year=2024                                | 0.33 [exact]                                                                                        | SOT-04 §federal-brackets-2024                     | Above $246,752                                                                                |
| TC-TAX-009  | Ontario provincial tax + surtax: below 20% surtax threshold [snapshot]                   | taxableIncome=50000, province='ON', year=2024                  | ON bracket tax; no surtax applied [exact]                                                           | SOT-04 §provincial-brackets-on                    | Surtax applies only when ON provincial tax > $5,554                                           |
| TC-TAX-009b | Ontario provincial tax + surtax: between 20% and 56% thresholds [snapshot]               | taxableIncome=110000, province='ON', year=2024                 | ON bracket tax + 20% surtax on provincial tax above $5,554 [exact]                                  | SOT-04 §provincial-brackets-on                    | Two-tier surtax: 20% on tax > $5,554; additional 36% on tax > $7,108                          |
| TC-TAX-009c | Ontario provincial tax + surtax: above 56% threshold (both surtaxes apply) [snapshot]    | taxableIncome=180000, province='ON', year=2024                 | ON bracket tax + 20% on tax>$5,554 + 36% on tax>$7,108 [exact]                                      | SOT-04 §provincial-brackets-on                    | Both surtax tiers triggered                                                                   |
| TC-TAX-010  | BC provincial tax: bracket 1 ($30,000) — 5.06% [snapshot]                                | taxableIncome=30000, province='BC', year=2024                  | $1,518.00 [exact] (30000 × 0.0506)                                                                  | SOT-04 §provincial-brackets-bc                    | BC bracket 1: $0–$47,937 @ 5.06%                                                              |
| TC-TAX-010b | BC provincial tax: bracket 2 ($70,000) — spans 1+2 [snapshot]                            | taxableIncome=70000, province='BC', year=2024                  | $4,236.30 [exact] ($47,937 × 0.0506 + $22,063 × 0.077)                                              | SOT-04 §provincial-brackets-bc                    | BC bracket 2: $47,937–$95,875 @ 7.70%                                                         |
| TC-TAX-010c | BC provincial tax: bracket 3 ($100,000) [snapshot]                                       | taxableIncome=100000, province='BC', year=2024                 | $5,688.78 [exact] ($47,937×0.0506 + $47,938×0.077 + $4,125×0.105)                                   | SOT-04 §provincial-brackets-bc                    | BC bracket 3: $95,875–$110,076 @ 10.50%                                                       |
| TC-TAX-010d | BC provincial tax: bracket 4 ($120,000) [snapshot]                                       | taxableIncome=120000, province='BC', year=2024                 | $8,133.46 [exact] (brackets 1–4)                                                                    | SOT-04 §provincial-brackets-bc                    | BC bracket 4: $110,076–$133,664 @ 12.29%                                                      |
| TC-TAX-010e | BC provincial tax: bracket 5 ($150,000) [snapshot]                                       | taxableIncome=150000, province='BC', year=2024                 | $12,234.56 [NEEDS CONFIRMATION] (brackets 1–5)                                                      | SOT-04 §provincial-brackets-bc                    | BC bracket 5: $133,664–$181,232 @ 14.70%                                                      |
| TC-TAX-010f | BC provincial tax: bracket 6 ($200,000) [snapshot]                                       | taxableIncome=200000, province='BC', year=2024                 | ~$22,000 [NEEDS CONFIRMATION] (brackets 1–6)                                                        | SOT-04 §provincial-brackets-bc                    | BC bracket 6: Over $181,232 @ 20.50%                                                          |
| TC-TAX-010g | BC provincial tax: 7-bracket structure confirmed via boundary walk [structural]          | taxableIncome=47937, province='BC', year=2024                  | $2,425.41 [exact] (47937 × 0.0506)                                                                  | SOT-04 §provincial-brackets-bc                    | Boundary value at top of bracket 1                                                            |
| TC-TAX-011  | Provincial tax: AB 10% flat on $60,000 [structural]                                      | taxableIncome=60000, province='AB', year=2024                  | $6,000.00 [exact] (60000 × 0.10)                                                                    | SOT-04 §provincial-brackets-ab                    | AB bracket 1: $0–$148,269 @ 10%; effectively flat for most incomes                            |
| TC-TAX-012  | QC provincial tax combined with federal abatement [snapshot]                             | taxableIncome=80000, province='QC', year=2024                  | QC provincial: ~$14,020 [NEEDS CONFIRMATION]; federal after 16.5% abatement applied                 | SOT-04 §provincial-brackets-qc, §quebec-abatement | QC brackets 2024 used for provincial; federal reduced by 16.5%                                |
| TC-TAX-013  | Provincial tax: MB — $40,000 at 10.80% [snapshot]                                        | taxableIncome=40000, province='MB', year=2024                  | $4,320.00 [exact] (40000 × 0.108)                                                                   | SOT-04 §provincial-brackets-mb                    | MB bracket 1: $0–$47,000 @ 10.80%                                                             |
| TC-TAX-013b | Provincial tax: SK — $40,000 at 10.50% [snapshot]                                        | taxableIncome=40000, province='SK', year=2024                  | $4,200.00 [exact] (40000 × 0.105)                                                                   | SOT-04 §provincial-brackets-sk                    | SK bracket 1: $0–$52,057 @ 10.50%                                                             |
| TC-TAX-013c | Provincial tax: NS — $40,000 spans brackets 1+2 [snapshot]                               | taxableIncome=40000, province='NS', year=2024                  | $4,206.26 [exact] ($29,590 × 0.0879 + $10,410 × 0.1495)                                             | SOT-04 §provincial-brackets-ns                    | NS bracket 2 threshold at $29,590                                                             |
| TC-TAX-013d | Provincial tax: NB — $40,000 at 9.40% [snapshot]                                         | taxableIncome=40000, province='NB', year=2024                  | $3,760.00 [exact] (40000 × 0.094)                                                                   | SOT-04 §provincial-brackets-nb                    | NB bracket 1: $0–$49,958 @ 9.40%                                                              |
| TC-TAX-013e | Provincial tax: PE — $40,000 spans brackets 1+2 [snapshot]                               | taxableIncome=40000, province='PE', year=2024                  | $4,506.65 [exact] ($32,656 × 0.0965 + $7,344 × 0.1363)                                              | SOT-04 §provincial-brackets-pe                    | PEI bracket 2 threshold at $32,656                                                            |
| TC-TAX-013f | Provincial tax: NL — $40,000 at 8.70% [snapshot]                                         | taxableIncome=40000, province='NL', year=2024                  | $3,478.00 [NEEDS CONFIRMATION] (approx; NL bracket boundary at $43,198)                             | SOT-04 §provincial-brackets-nl                    | NL bracket 1: $0–$43,198 @ 8.70%; $40,000 is in bracket 1                                     |
| TC-TAX-013g | Provincial tax: NT — $40,000 lowest rate ~5.90% [snapshot]                               | taxableIncome=40000, province='NT', year=2024                  | ~$2,360 [NEEDS CONFIRMATION]                                                                        | SOT-04 §provincial-brackets-territories           | Territories section; approximate per SOT-04                                                   |
| TC-TAX-013h | Provincial tax: NU — $40,000 lowest rate ~4.00% [snapshot]                               | taxableIncome=40000, province='NU', year=2024                  | ~$1,600 [NEEDS CONFIRMATION]                                                                        | SOT-04 §provincial-brackets-territories           | Territories section; approximate per SOT-04                                                   |
| TC-TAX-013i | Provincial tax: YT — $40,000 similar to federal lowest rate ~6.40% [snapshot]            | taxableIncome=40000, province='YT', year=2024                  | ~$2,560 [NEEDS CONFIRMATION]                                                                        | SOT-04 §provincial-brackets-territories           | Territories section; approximate per SOT-04                                                   |
| TC-TAX-014  | Provincial age credit fallback: × 0.7 approximation [structural]                         | province='MB', age=68, federalAgeCredit=1318.50, year=2024     | ~$922.95 [exact] ($1,318.50 × 0.70 approximation)                                                   | SOT-04 §age-credit                                | Approximation used for provinces without explicit age credit entry; approximation flag        |
| TC-TAX-015  | Capital gains: standard 50% inclusion [structural]                                       | gain=10000                                                     | $5,000.00 [exact] (10000 × 0.50)                                                                    | SOT-04 §capital-gains                             | Standard inclusion rate; below $250K threshold                                                |
| TC-TAX-016  | Capital gains: enhanced 66.7% — gain below $250K threshold [structural]                  | gain=200000, annualGains=200000                                | $100,000.00 [exact] (200000 × 0.50; below $250K threshold)                                          | SOT-04 §capital-gains-enhanced                    | D-08: cumulative per-person threshold; standard 50% applies below $250K                       |
| TC-TAX-016b | Capital gains: enhanced 66.7% — gain above $250K threshold [structural]                  | gain=500000, annualGains=500000                                | $291,675.00 [exact] ($250,000 × 0.50 + $250,000 × 0.6667)                                           | SOT-04 §capital-gains-enhanced                    | 50% on first $250K + 66.67% on remainder above $250K                                          |
| TC-TAX-017  | Capital gains: non-reg withdrawal ACB proportional approximation [structural]            | amount=10000, balance=100000, acb=80000, unrealizedGains=20000 | realizedGain=$2,000.00 [exact] (10000 × (20000/100000))                                             | SOT-04 §capital-gains                             | ACB proportional approx; see REGR-004 for concern about this approximation                    |
| TC-TAX-018  | Eligible dividend: 38% gross-up + 15.0198% federal credit [snapshot]                     | dividend=1000, year=2024                                       | grossedUp=$1,380.00 [exact]; federalCredit=$207.27 [exact] (1380 × 0.150198)                        | SOT-04 §dividend-tax-treatment                    | Annual constants: gross-up 38%, federal credit rate 15.0198%                                  |
| TC-TAX-019  | Non-eligible dividend: 15% gross-up + 9.0301% federal credit [snapshot]                  | dividend=1000, year=2024                                       | grossedUp=$1,150.00 [exact]; federalCredit=$103.85 [exact] (1150 × 0.090301)                        | SOT-04 §dividend-tax-treatment                    | Annual constants: gross-up 15%, federal credit rate 9.0301%                                   |
| TC-TAX-020  | Provincial dividend credit: ON — eligible dividend [snapshot]                            | province='ON', dividendType='eligible', year=2024              | provincialCredit returned [NEEDS CONFIRMATION]                                                      | SOT-04 §dividend-tax-treatment                    | ON provincial eligible dividend credit rate not explicit in SOT-04                            |
| TC-TAX-020b | Provincial dividend credit: BC — eligible dividend [snapshot]                            | province='BC', dividendType='eligible', year=2024              | provincialCredit returned [NEEDS CONFIRMATION]                                                      | SOT-04 §dividend-tax-treatment                    | BC provincial eligible dividend credit rate not explicit in SOT-04                            |
| TC-TAX-020c | Provincial dividend credit: unlisted province — returns 0 [structural]                   | province='NT', dividendType='eligible', year=2024              | $0.00 [exact]                                                                                       | SOT-04 §dividend-tax-treatment                    | Province not in lookup table; function returns 0                                              |
| TC-TAX-021  | OAS clawback: age < 75 — income above threshold [snapshot]                               | netIncome=100000, oasAmount=8560, year=2024, age=70            | clawback=$1,350.45 [exact] ((100000 - 90997) × 0.15)                                                | SOT-04 §oas-clawback                              | 2024 threshold $90,997; recovery rate 15%                                                     |
| TC-TAX-022  | OAS clawback: age >= 75 — uses fullClawbackAge75Plus threshold [snapshot]                | netIncome=140000, year=2024, age=76                            | clawback=(140000 - fullClawbackAge75Plus_2024) × 0.15 [NEEDS CONFIRMATION]                          | SOT-04 §oas-clawback                              | Higher full-clawback threshold for age 75+; exact threshold value not confirmed in SOT-04     |
| TC-TAX-023  | OAS fully clawed back: income below full-clawback threshold — returns false [structural] | netIncome=100000, year=2024, age=70                            | false [exact]                                                                                       | SOT-04 §oas-clawback                              | Income above recovery threshold but below full clawback ~$148,000                             |
| TC-TAX-023b | OAS fully clawed back: income above full-clawback threshold — returns true [structural]  | netIncome=160000, year=2024, age=70                            | true [exact]                                                                                        | SOT-04 §oas-clawback                              | Full clawback ~$148,000 per SOT-04; income above → fully clawed back                          |
| TC-TAX-024  | OAS max income to avoid clawback: year=2024 [snapshot]                                   | year=2024                                                      | $90,997 [exact]                                                                                     | SOT-04 §oas-clawback                              | Recovery tax threshold for 2024; used in optimizer planning                                   |
| TC-TAX-025  | Total tax integration: $80,000 ON taxpayer — federal + provincial + credits [structural] | taxableIncome=80000, province='ON', year=2024, age=45          | federalTaxNet≈$10,971 [exact] (from SOT-04 TC-TAX-001 worked example); total varies with provincial | SOT-04 §tax-calculation-algorithm, §test-cases    | Integration of all sub-functions: federal brackets → BPA credit → provincial brackets → total |
| TC-TAX-026  | BC renters credit: income below phase-out — max $400 [snapshot]                          | province='BC', netIncome=50000, year=2024                      | $400.00 [NEEDS CONFIRMATION]                                                                        | SOT-04 §bc-renters-credit                         | Max $400; income-tested; exact phase-out thresholds ($63K–$83K) not confirmed in SOT-04       |
| TC-TAX-026b | BC renters credit: income in phase-out range — partial credit [snapshot]                 | province='BC', netIncome=70000, year=2024                      | ~$200 [NEEDS CONFIRMATION]                                                                          | SOT-04 §bc-renters-credit                         | Phase-out range; partial credit; exact calculation not confirmed in SOT-04                    |
| TC-TAX-026c | BC renters credit: income above phase-out — zero [snapshot]                              | province='BC', netIncome=90000, year=2024                      | $0.00 [NEEDS CONFIRMATION]                                                                          | SOT-04 §bc-renters-credit                         | Above upper phase-out threshold; returns $0                                                   |
| TC-TAX-027  | ON seniors transit credit: expenses below cap [snapshot]                                 | age=67, transitExpenses=2000, province='ON', year=2024         | $300.00 [exact] (2000 × 0.15)                                                                       | SOT-04 §credits                                   | Age 66+; cap $3,000 expenses × 15% = max $450                                                 |
| TC-TAX-027b | ON seniors transit credit: expenses above $3,000 cap [snapshot]                          | age=67, transitExpenses=4000, province='ON', year=2024         | $450.00 [exact] (min(4000, 3000) × 0.15)                                                            | SOT-04 §credits                                   | Capped at $3,000 eligible expenses                                                            |
| TC-TAX-028  | Medical expenses credit: standard calculation [structural]                               | expenses=5000, netIncome=60000, year=2024                      | $480.00 [exact] (threshold=min(60000×0.03, 2759)=1800; credit=(5000-1800)×0.15)                     | SOT-04 §tax-credits                               | Threshold = min(3% netIncome, $2,759) per SOT-04                                              |
| TC-TAX-029  | Charitable donations credit: two-rate split [structural]                                 | donations=500, netIncome=60000, year=2024                      | $117.00 [exact] (first $200 × 0.15 = $30; next $300 × 0.29 = $87)                                   | SOT-04 §tax-credits                               | First $200 at 15%; excess at 29% (33% if income > $246,752 + donations > $200)                |
| TC-TAX-030  | Climate action incentive: Alberta [snapshot]                                             | province='AB', year=2024                                       | [NEEDS CONFIRMATION]                                                                                | SOT-04 §climate-action-incentive                  | AB amount; exact 2024 value not confirmed in SOT-04; rural 1.2× multiplier applies            |
| TC-TAX-030b | Climate action incentive: Saskatchewan [snapshot]                                        | province='SK', year=2024                                       | [NEEDS CONFIRMATION]                                                                                | SOT-04 §climate-action-incentive                  | SK amount; exact 2024 value not confirmed in SOT-04                                           |
| TC-TAX-030c | Climate action incentive: Manitoba [snapshot]                                            | province='MB', year=2024                                       | [NEEDS CONFIRMATION]                                                                                | SOT-04 §climate-action-incentive                  | MB amount; exact 2024 value not confirmed in SOT-04                                           |
| TC-TAX-030d | Climate action incentive: Ontario [snapshot]                                             | province='ON', year=2024                                       | [NEEDS CONFIRMATION]                                                                                | SOT-04 §climate-action-incentive                  | ON amount; exact 2024 value not confirmed in SOT-04                                           |
| TC-TAX-030e | Climate action incentive: rural 1.2× multiplier applied [structural]                     | province='AB', year=2024, rural=true                           | baseAmount × 1.2 [NEEDS CONFIRMATION]                                                               | SOT-04 §climate-action-incentive                  | Rural supplement multiplier 1.2× applied to base amount                                       |

**Count: 30 TC-TAX surfaces covered (≥68 scenario rows).**

---

## TC-RRIF: RRIF Minimum Withdrawal and Conversion Scenarios

Source files: packages/calculation-engine/src/accounts/rrif.ts, packages/shared/src/constants/rates.ts. Primary SOT: SOT-02 (account types).

| ID           | Scenario Name                                           | Inputs                                                         | Expected Output                                                   | Citation                        | Notes                                                                                                                   |
| ------------ | ------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| TC-RRIF-001  | RRIF minimum withdrawal: CRA table age 72 [snapshot]    | balance=500000, age=72, projectionYear=2031                    | $27,000.00 [exact] (500000 × 0.0540)                              | SOT-02 §rrif-minimum-rates      | 2024 CRA table rate at age 72 = 5.40%; label [snapshot]                                                                 |
| TC-RRIF-001b | RRIF minimum withdrawal: CRA table age 80 [snapshot]    | balance=500000, age=80, projectionYear=2039                    | $34,100.00 [exact] (500000 × 0.0682)                              | SOT-02 §rrif-minimum-rates      | Rate at age 80 = 6.82%                                                                                                  |
| TC-RRIF-001c | RRIF minimum withdrawal: CRA table age 90 [snapshot]    | balance=500000, age=90, projectionYear=2049                    | $59,600.00 [exact] (500000 × 0.1192)                              | SOT-02 §rrif-minimum-rates      | Rate at age 90 = 11.92%                                                                                                 |
| TC-RRIF-001d | RRIF minimum withdrawal: CRA table age 94 [snapshot]    | balance=500000, age=94, projectionYear=2053                    | $93,950.00 [exact] (500000 × 0.1879)                              | SOT-02 §rrif-minimum-rates      | Rate at age 94 = 18.79%; last entry before 95+ fixed rate                                                               |
| TC-RRIF-002  | RRIF minimum withdrawal: age 95+ fixed 20% [structural] | balance=200000, age=96, projectionYear=2055                    | $40,000.00 [exact] (200000 × 0.20)                                | SOT-02 §rrif-minimum-rates      | Fixed 20% floor for age 95+; structural rule not tied to annual CRA table                                               |
| TC-RRIF-003  | RRIF minimum required: age 71 — false [structural]      | age=71, projectionYear=2030                                    | false [exact]                                                     | SOT-02 §rrif-minimum-rates      | Below trigger age; no minimum required yet                                                                              |
| TC-RRIF-003b | RRIF minimum required: age 72 — true [structural]       | age=72, projectionYear=2031                                    | true [exact]                                                      | SOT-02 §rrif-minimum-rates      | Age 72 is trigger, not 71 — RRSP converts at 71, first withdrawal at 72                                                 |
| TC-RRIF-004  | RRIF minimum with younger spouse election [structural]  | balance=500000, ownerAge=75, spouseAge=70, projectionYear=2035 | $29,100.00 [exact] (500000 × 0.0582; age 70 rate used)            | SOT-02 §rrif-younger-spouse     | Uses spouse age 70 rate (5.82%) instead of owner age 75 rate (5.82% — same coincidence); uses lower-age rate in general |
| TC-RRIF-005  | RRSP-to-RRIF conversion [structural]                    | rrspBalance=400000, conversionYear=2031, ownerAge=71           | {rrifBalance: 400000, firstWithdrawalYear: 2032} [exact]          | SOT-02 §rrsp-to-rrif-conversion | RRSP deadline age 71; first mandatory withdrawal in year following conversion                                           |
| TC-RRIF-006  | RRIF withdrawal: below minimum clamped [structural]     | balance=300000, age=75, requested=5000, minRate=0.0582         | withdrawal=$17,460.00 [exact] (300000 × 0.0582; minimum enforced) | SOT-02 §rrif-minimum-rates      | Requested $5,000 below minimum $17,460; minimum enforced                                                                |
| TC-RRIF-007  | RRIF withdrawal: above minimum allowed [structural]     | balance=300000, age=75, requested=50000, minRate=0.0582        | withdrawal=$50,000.00 [exact]                                     | SOT-02 §rrif-minimum-rates      | Requested $50,000 above minimum $17,460; no upper cap on RRIF withdrawals                                               |
| TC-RRIF-008  | RRIF 100% taxable flag [structural]                     | withdrawal=20000                                               | taxableAmount=$20,000.00 [exact]                                  | SOT-02 §rrif-taxation           | All RRIF income is fully taxable as ordinary income; no sheltered portion                                               |
| TC-RRIF-009  | RRIF rate lookup for age returned as decimal [snapshot] | age=72                                                         | 0.0540 [exact]                                                    | SOT-02 §rrif-minimum-rates      | Delegates to getRRIFMinimumRate from shared constants; returned as decimal fraction                                     |

**Count: 9 TC-RRIF surfaces covered.**

---

## TC-CPP: CPP Benefit Calculation Scenarios

Source files: packages/calculation-engine/src/benefits/cpp.ts. Primary SOT: SOT-05 (government benefits).

| ID          | Scenario Name                                                      | Inputs                                               | Expected Output                                                           | Citation                    | Notes                                                                            |
| ----------- | ------------------------------------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------- |
| TC-CPP-001  | CPP early start penalty: age 60 — max reduction [structural]       | startAge=60, currentAge=60, projectionYear=2026      | factor=0.568 [exact] (1 - 72 × 0.006 = 0.568; 36% reduction)              | SOT-05 §cpp-early-start     | 72 months early × 0.6%/month = 36% reduction; example: $12,000 × 0.568 = $7,680  |
| TC-CPP-002  | CPP early start penalty: age 61 [structural]                       | startAge=61, currentAge=61, projectionYear=2027      | factor=0.640 [exact] (1 - 60 × 0.006)                                     | SOT-05 §cpp-early-start     | 60 months early; 28.8% total reduction                                           |
| TC-CPP-002b | CPP early start penalty: age 62 [structural]                       | startAge=62, currentAge=62, projectionYear=2028      | factor=0.712 [exact] (1 - 48 × 0.006)                                     | SOT-05 §cpp-early-start     | 48 months early; 21.6% total reduction                                           |
| TC-CPP-002c | CPP early start penalty: age 63 [structural]                       | startAge=63, currentAge=63, projectionYear=2029      | factor=0.784 [exact] (1 - 36 × 0.006)                                     | SOT-05 §cpp-early-start     | 36 months early; 14.4% total reduction                                           |
| TC-CPP-002d | CPP early start penalty: age 64 [structural]                       | startAge=64, currentAge=64, projectionYear=2030      | factor=0.856 [exact] (1 - 24 × 0.006)                                     | SOT-05 §cpp-early-start     | 24 months early; 7.2% total reduction                                            |
| TC-CPP-003  | CPP standard: age 65 baseline [structural]                         | startAge=65, currentAge=65, projectionYear=2031      | factor=1.0 [exact]                                                        | SOT-05 §cpp-early-start     | No adjustment at standard age 65                                                 |
| TC-CPP-004  | CPP late start bonus: age 66 [structural]                          | startAge=66, currentAge=66, projectionYear=2032      | factor=1.084 [exact] (1 + 12 × 0.007)                                     | SOT-05 §cpp-early-start     | 12 months late × 0.7%/month = 8.4% increase                                      |
| TC-CPP-004b | CPP late start bonus: age 67 [structural]                          | startAge=67, currentAge=67, projectionYear=2033      | factor=1.168 [exact] (1 + 24 × 0.007)                                     | SOT-05 §cpp-early-start     | 24 months late; 16.8% increase                                                   |
| TC-CPP-004c | CPP late start bonus: age 68 [structural]                          | startAge=68, currentAge=68, projectionYear=2034      | factor=1.252 [exact] (1 + 36 × 0.007)                                     | SOT-05 §cpp-early-start     | 36 months late; 25.2% increase                                                   |
| TC-CPP-004d | CPP late start bonus: age 69 [structural]                          | startAge=69, currentAge=69, projectionYear=2035      | factor=1.336 [exact] (1 + 48 × 0.007)                                     | SOT-05 §cpp-early-start     | 48 months late; 33.6% increase                                                   |
| TC-CPP-005  | CPP late start bonus: age 70 — max deferral [structural]           | startAge=70, currentAge=70, projectionYear=2036      | factor=1.42 [exact] (1 + 60 × 0.007)                                      | SOT-05 §cpp-early-start     | 60 months late × 0.7%/month = 42% increase; example: $12,000 × 1.42 = $17,040    |
| TC-CPP-006  | CPP out-of-range: age 59 — throws [structural]                     | startAge=59                                          | throws Error [exact]                                                      | SOT-05 §cpp-early-start     | Only values 60–70 are valid; < 60 throws                                         |
| TC-CPP-006b | CPP out-of-range: age 71 — throws [structural]                     | startAge=71                                          | throws Error [exact]                                                      | SOT-05 §cpp-early-start     | > 70 throws; no deferral beyond 70                                               |
| TC-CPP-007  | CPP benefit from expected amount at 65 — early [structural]        | expectedAt65=15000, startAge=60, projectionYear=2026 | $8,520.00 [exact] (15000 × 0.568)                                         | SOT-05 §cpp-early-start     | Applies adjustment factor to user-entered expected amount                        |
| TC-CPP-008  | CPP inflation indexing: 5 years at 2.5% [structural]               | baseAmount=15000, inflationRate=0.025, years=5       | $16,970.98 [±$0.50] (15000 × 1.025^5)                                     | SOT-05 §cpp-inflation       | Compound CPI indexing; annual in January                                         |
| TC-CPP-009  | CPP survivor benefit: 60% cap under maximum [structural]           | deceasedAmount=12000, maxCPPAmount=16375             | $7,200.00 [exact] (12000 × 0.60 = 7200; under cap of 16375 × 0.60 = 9825) | SOT-05 §cpp-survivor        | 60% of deceased's benefit; not capped here                                       |
| TC-CPP-009b | CPP survivor benefit: capped at max [structural]                   | deceasedAmount=30000, maxCPPAmount=16375             | $9,825.00 [exact] (min(30000 × 0.60, 16375 × 0.60) = 9825)                | SOT-05 §cpp-survivor        | Benefit would be $18,000 but capped at 60% of max                                |
| TC-CPP-010  | CPP combined own + survivor: capped at max [structural]            | own=10000, survivor=8000, maxCPP=16375               | $16,375.00 [exact] (own + survivor = 18000; capped at maxAnnualAt65)      | SOT-05 §cpp-survivor        | sum $18,000 exceeds cap $16,375; max from BENEFIT_AMOUNTS_2024.cpp.maxAnnualAt65 |
| TC-CPP-011  | CPP break-even age calculation [structural]                        | expectedAt65=15000, earlyAge=60, laterAge=65         | breakEvenAge ≈ 74 [NEEDS CONFIRMATION]                                    | SOT-05 §cpp-early-start     | Planning utility; exact crossover from SOT-05 worked example not provided        |
| TC-CPP-012  | CPP estimate at 65 from percentage — year param ignored [snapshot] | percentage=0.75, year=2030                           | $12,281.25 [exact] (16375 × 0.75)                                         | SOT-05 §cpp-benefit-amounts | year param ignored — always uses 2024 max $16,375; see REGR-013                  |
| TC-CPP-013  | CPP eligibility: age 59 — false [structural]                       | age=59, projectionYear=2025                          | false [exact]                                                             | SOT-05 §cpp-eligibility     | Age < 60; not eligible                                                           |
| TC-CPP-013b | CPP eligibility: age 60 — true [structural]                        | age=60, projectionYear=2026                          | true [exact]                                                              | SOT-05 §cpp-eligibility     | Age = 60; minimum eligible age                                                   |
| TC-CPP-014  | CPP max deferral: startAge 69 — false [structural]                 | startAge=69                                          | false [exact]                                                             | SOT-05 §cpp-eligibility     | Not at max deferral age                                                          |
| TC-CPP-014b | CPP max deferral: startAge 70 — true [structural]                  | startAge=70                                          | true [exact]                                                              | SOT-05 §cpp-eligibility     | Age 70 = maximum deferral age                                                    |

**Count: 14 TC-CPP surfaces covered.**

---

## TC-OAS: OAS Benefit Calculation Scenarios

Source files: packages/calculation-engine/src/benefits/oas.ts. Primary SOT: SOT-05 (government benefits).

| ID          | Scenario Name                                                                    | Inputs                                                                          | Expected Output                                                                             | Citation                    | Notes                                                                                        |
| ----------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------- |
| TC-OAS-001  | OAS residency factor: full 40 years [structural]                                 | yearsOfResidence=40                                                             | 1.0 [exact]                                                                                 | SOT-05 §oas-residency       | Full entitlement; 40 years = 100%                                                            |
| TC-OAS-002  | OAS residency factor: partial 10 years [structural]                              | yearsOfResidence=10                                                             | 0.25 [exact] (10/40)                                                                        | SOT-05 §oas-residency       | Minimum residency; prorated                                                                  |
| TC-OAS-002b | OAS residency factor: partial 20 years [structural]                              | yearsOfResidence=20                                                             | 0.5 [exact] (20/40)                                                                         | SOT-05 §oas-residency       | Half entitlement                                                                             |
| TC-OAS-002c | OAS residency factor: partial 39 years [structural]                              | yearsOfResidence=39                                                             | 0.975 [exact] (39/40)                                                                       | SOT-05 §oas-residency       | One year short of full                                                                       |
| TC-OAS-003  | OAS residency factor: below 10 years — zero [structural]                         | yearsOfResidence=9                                                              | 0 [exact]                                                                                   | SOT-05 §oas-residency       | Minimum 10 years required; below → $0                                                        |
| TC-OAS-004  | OAS deferral factor: age 65 — no deferral [structural]                           | startAge=65, projectionYear=2031                                                | 1.0 [exact]                                                                                 | SOT-05 §oas-deferral        | Baseline; no deferral adjustment                                                             |
| TC-OAS-005  | OAS deferral factor: age 66 [structural]                                         | startAge=66, projectionYear=2032                                                | 1.072 [exact] (1 + 12 × 0.006)                                                              | SOT-05 §oas-deferral        | 12 months × 0.6%/month = 7.2% increase                                                       |
| TC-OAS-005b | OAS deferral factor: age 67 [structural]                                         | startAge=67, projectionYear=2033                                                | 1.144 [exact] (1 + 24 × 0.006)                                                              | SOT-05 §oas-deferral        | 24 months; 14.4% increase                                                                    |
| TC-OAS-005c | OAS deferral factor: age 68 [structural]                                         | startAge=68, projectionYear=2034                                                | 1.216 [exact] (1 + 36 × 0.006)                                                              | SOT-05 §oas-deferral        | 36 months; 21.6% increase                                                                    |
| TC-OAS-005d | OAS deferral factor: age 69 [structural]                                         | startAge=69, projectionYear=2035                                                | 1.288 [exact] (1 + 48 × 0.006)                                                              | SOT-05 §oas-deferral        | 48 months; 28.8% increase                                                                    |
| TC-OAS-006  | OAS deferral factor: age 70 — max deferral [structural]                          | startAge=70, projectionYear=2036                                                | 1.36 [exact] (1 + 60 × 0.006)                                                               | SOT-05 §oas-deferral        | 60 months × 0.6%/month = 36% increase                                                        |
| TC-OAS-007  | OAS deferral factor: throws below age 65 [structural]                            | startAge=64, projectionYear=2030                                                | throws Error [exact]                                                                        | SOT-05 §oas-deferral        | Input guard; OAS cannot start before 65                                                      |
| TC-OAS-008  | OAS age-75 bonus: age 74 — no bonus [structural]                                 | age=74, projectionYear=2039                                                     | bonusFactor=1.0 [exact]                                                                     | SOT-05 §oas-age-75-bonus    | Age < 75; no bonus applied                                                                   |
| TC-OAS-008b | OAS age-75 bonus: age 75 — 10% bonus [structural]                                | age=75, projectionYear=2040                                                     | bonusFactor=1.10 [exact]                                                                    | SOT-05 §oas-age-75-bonus    | OAS_RATES.age75Bonus = 0.1; introduced July 2022                                             |
| TC-OAS-009  | OAS entitlement: age 65-74 — uses 65-74 table entry [snapshot]                   | yearsOfResidence=40, age=70, year=2024, projectionYear=2024                     | $8,560.00 [exact] (maxAnnualAge65To74 from OAS_BENEFIT_AMOUNTS[2024])                       | SOT-05 §oas-benefit-amounts | Selects age 65-74 benefit amount                                                             |
| TC-OAS-009b | OAS entitlement: age 75+ — uses 75+ table entry [snapshot]                       | yearsOfResidence=40, age=75, year=2024, projectionYear=2024                     | $9,420.00 [exact] (maxAnnualAge75Plus from OAS_BENEFIT_AMOUNTS[2024])                       | SOT-05 §oas-benefit-amounts | Selects age 75+ benefit amount (includes 10% bonus)                                          |
| TC-OAS-010  | OAS full benefit: residency=40, startAge=70, currentAge=75, year=2024 [snapshot] | yearsOfResidence=40, startAge=70, currentAge=75, year=2024, projectionYear=2031 | $10,377.60 [NEEDS CONFIRMATION] (8560 × 1.36 × 1.10 = ~12,805; but base may differ by year) | SOT-05 §oas-benefit-amounts | Full pipeline: residency factor × deferral × age-75 bonus; exact depends on year base amount |
| TC-OAS-011  | OAS inflation indexing: 5 years at 2.5% [structural]                             | baseAmount=8560, inflationRate=0.025, years=5                                   | $9,702.60 [±$0.50] (8560 × 1.025^5)                                                         | SOT-05 §oas-indexing        | Quarterly CPI; annual approximation for projection                                           |
| TC-OAS-012  | OAS break-even age: deferring from 65 to 70 [structural]                         | yearsOfResidence=40, earlyAge=65, laterAge=70                                   | breakEvenAge ≈ 83–84 [NEEDS CONFIRMATION]                                                   | SOT-05 §oas-deferral        | Planning utility; exact crossover not in SOT-05                                              |
| TC-OAS-013  | OAS eligibility: age=64, years=40 — false (age) [structural]                     | age=64, yearsOfResidence=40, projectionYear=2030                                | false [exact]                                                                               | SOT-05 §oas-eligibility     | Age < 65; ineligible                                                                         |
| TC-OAS-013b | OAS eligibility: age=65, years=9 — false (residency) [structural]                | age=65, yearsOfResidence=9, projectionYear=2031                                 | false [exact]                                                                               | SOT-05 §oas-eligibility     | Years < 10; ineligible                                                                       |
| TC-OAS-013c | OAS eligibility: age=65, years=10 — true [structural]                            | age=65, yearsOfResidence=10, projectionYear=2031                                | true [exact]                                                                                | SOT-05 §oas-eligibility     | Minimum age and minimum residency both met                                                   |
| TC-OAS-013d | OAS eligibility: age=64, years=9 — false (both) [structural]                     | age=64, yearsOfResidence=9, projectionYear=2030                                 | false [exact]                                                                               | SOT-05 §oas-eligibility     | Both conditions fail                                                                         |
| TC-OAS-014  | OAS receiving check: currentAge < startAge — false [structural]                  | currentAge=64, oasStartAge=65, projectionYear=2030                              | false [exact]                                                                               | SOT-05 §oas-eligibility     | Payments not yet started                                                                     |
| TC-OAS-014b | OAS receiving check: currentAge >= startAge — true [structural]                  | currentAge=66, oasStartAge=65, projectionYear=2032                              | true [exact]                                                                                | SOT-05 §oas-eligibility     | Payments have started                                                                        |
| TC-OAS-015  | OAS year-keyed lookup: unknown year fallback [structural]                        | year=2099                                                                       | falls back to latest-known year entry [exact]                                               | SOT-05 §oas-benefit-amounts | OAS_BENEFIT_AMOUNTS year-key lookup; 2099 not in map → uses latest available key             |

**Count: 15 TC-OAS surfaces covered.**

---

## TC-GIS: GIS Benefit Calculation Scenarios

Source files: packages/calculation-engine/src/benefits/gis.ts. Primary SOT: SOT-05 (government benefits).

| ID         | Scenario Name                                                          | Inputs                                                                                                                        | Expected Output                                                                                                        | Citation                | Notes                                                                                                                                                            |
| ---------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-GIS-001 | GIS income threshold: single [snapshot]                                | maritalStatus='single'                                                                                                        | $21,624 [exact]                                                                                                        | SOT-05 §gis-thresholds  | From BENEFIT_AMOUNTS_2024.gis.incomeThresholdSingle                                                                                                              |
| TC-GIS-002 | GIS income threshold: married both OAS [snapshot]                      | maritalStatus='married', spouseReceivingOAS=true                                                                              | $28,560 [exact]                                                                                                        | SOT-05 §gis-thresholds  | From BENEFIT_AMOUNTS_2024.gis.incomeThresholdMarriedBoth                                                                                                         |
| TC-GIS-003 | GIS income threshold: married spouse NOT OAS [snapshot]                | maritalStatus='married', spouseReceivingOAS=false                                                                             | $51,840 [exact]                                                                                                        | SOT-05 §gis-thresholds  | From BENEFIT_AMOUNTS_2024.gis.incomeThresholdMarriedOneOAS                                                                                                       |
| TC-GIS-004 | GIS income calculation: employment exemption first $5,000 [structural] | totalIncome=25000, oasIncome=8500, employmentIncome=6000                                                                      | gisIncome=$11,500 [exact] (25000 - 8500 - min(6000, 5000) = 11500)                                                     | SOT-05 §gis-calculation | First $5,000 of employment income exempt; $1,000 excess included                                                                                                 |
| TC-GIS-005 | GIS eligibility: not receiving OAS — false [structural]                | age=67, receivingOAS=false, projectionYear=2032                                                                               | false [exact]                                                                                                          | SOT-05 §gis-eligibility | OAS receipt is prerequisite for GIS                                                                                                                              |
| TC-GIS-006 | GIS eligibility: age < 65 — false [structural]                         | age=64, receivingOAS=true, projectionYear=2028                                                                                | false [exact]                                                                                                          | SOT-05 §gis-eligibility | Age gate; must be 65+                                                                                                                                            |
| TC-GIS-007 | GIS eligibility: income over threshold — false [structural]            | age=67, receivingOAS=true, gisIncome=25000, maritalStatus='single', projectionYear=2032                                       | false [exact] (gisIncome $25,000 > single threshold $21,624)                                                           | SOT-05 §gis-eligibility | Income exceeds single threshold                                                                                                                                  |
| TC-GIS-008 | GIS benefit amount: single, $10,000 GIS income [snapshot]              | gisIncome=10000, maritalStatus='single', year=2024                                                                            | $7,780.00 [exact] (12780 - 10000 × 0.50 = 7780)                                                                        | SOT-05 §gis-thresholds  | max single annual $12,780 from BENEFIT_AMOUNTS_2024; 50% clawback                                                                                                |
| TC-GIS-009 | GIS benefit amount: married both OAS, $10,000 GIS income [snapshot]    | gisIncome=10000, maritalStatus='married', spouseReceivingOAS=true, year=2024                                                  | $2,692.00 [exact] (7692 - 10000 × 0.50 = 2692; maxAnnualMarried = 641 × 12 = 7692)                                     | SOT-05 §gis-thresholds  | Lower max amount per person; 50% clawback                                                                                                                        |
| TC-GIS-010 | GIS benefit amount: married spouse NOT OAS [snapshot]                  | gisIncome=10000, maritalStatus='married', spouseReceivingOAS=false, year=2024                                                 | benefit > TC-GIS-008 level [NEEDS CONFIRMATION]                                                                        | SOT-05 §gis-thresholds  | Highest threshold $51,840; highest max amount; See REGR-005 — yearly-calculator.ts passes 'single' for spouses so this surface is bypassed in couple projections |
| TC-GIS-011 | GIS 50% clawback rate: two income levels [structural]                  | gisIncome1=5000, gisIncome2=10000, maritalStatus='single', year=2024                                                          | reduction1=$2,500; reduction2=$5,000 [exact] (linear 50% rate)                                                         | SOT-05 §gis-calculation | 50 cents per dollar over threshold; linear reduction                                                                                                             |
| TC-GIS-012 | GIS full pipeline integration [structural]                             | age=67, receivingOAS=true, totalIncome=20000, oasIncome=8500, employmentIncome=0, maritalStatus='single', projectionYear=2032 | gisAmount > 0 [exact] (gisIncome = 20000 - 8500 = 11500; below $21,624 threshold; benefit = 12780 - 11500×0.50 = 7030) | SOT-05 §gis-calculation | Integration of eligibility + income calc + benefit; gisAmount=$7,030.00 [exact]                                                                                  |
| TC-GIS-013 | GIS marital status 'common_law' treated as 'married' [structural]      | maritalStatus1='married', maritalStatus2='common_law', spouseReceivingOAS=true, gisIncome=10000, year=2024                    | identical thresholds and benefit amounts for both [exact]                                                              | SOT-05 §gis-thresholds  | MaritalStatus union includes common_law; treated identically to married                                                                                          |

**Count: 13 TC-GIS surfaces covered.**

> **Cross-reference:** See REGR-005 (GIS married-status bypass in yearly-calculator) in the REGR section.

---

## TC-PROJ: Projection Engine Decision Point Scenarios

Source files: packages/calculation-engine/src/projection/yearly-calculator.ts, multi-year.ts, couple-calculator.ts, accounts/_.ts, withdrawals/_.ts. Primary SOTs: SOT-02 (accounts), SOT-07 (withdrawals), SOT-08 (projection engine).

> **Note:** yearly-calculator.ts and multi-year.ts have no direct unit tests (see REGR-021). Surfaces TC-PROJ-023 through TC-PROJ-035 currently assert behavior through projection integration tests — spec rows below specify direct unit-test intent for Phase 30+.

| ID           | Scenario Name                                                                | Inputs                                                                                                                                          | Expected Output                                                                                 | Citation                                  | Notes                                                                                                           |
| ------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| TC-PROJ-001  | RRSP contribution room 18% of prior year earned income [snapshot]            | earnedIncome=80000, unusedRoom=5000, year=2024                                                                                                  | min(80000 × 0.18, 31560) + 5000 = $19,400.00 [exact]                                            | SOT-02 §rrsp-contribution-room            | RRSP_LIMITS[2024].maxContribution = $31,560; room = 14400 + 5000                                                |
| TC-PROJ-002  | RRSP contribution age gate [structural]                                      | age=70                                                                                                                                          | canContribute=true [exact]                                                                      | SOT-02 §rrsp-age-71-deadline              | AGE_MILESTONES; deadline at 71                                                                                  |
| TC-PROJ-002b | RRSP contribution age gate: age 71 [structural]                              | age=71                                                                                                                                          | canContribute=true [exact]                                                                      | SOT-02 §rrsp-age-71-deadline              | Last year to contribute                                                                                         |
| TC-PROJ-002c | RRSP contribution age gate: age 72 [structural]                              | age=72                                                                                                                                          | canContribute=false [exact]                                                                     | SOT-02 §rrsp-age-71-deadline              | Must have converted to RRIF by end of age 71                                                                    |
| TC-PROJ-003  | RRSP withholding tax: non-QC $3,000 [snapshot]                               | amount=3000, isQuebec=false                                                                                                                     | 10% [exact]                                                                                     | SOT-02 §rrsp-withholding                  | Tier 1: ≤$5,000                                                                                                 |
| TC-PROJ-003b | RRSP withholding tax: non-QC $10,000 [snapshot]                              | amount=10000, isQuebec=false                                                                                                                    | 20% [exact]                                                                                     | SOT-02 §rrsp-withholding                  | Tier 2: $5,001–$15,000                                                                                          |
| TC-PROJ-003c | RRSP withholding tax: non-QC $20,000 [snapshot]                              | amount=20000, isQuebec=false                                                                                                                    | 30% [exact]                                                                                     | SOT-02 §rrsp-withholding                  | Tier 3: >$15,000                                                                                                |
| TC-PROJ-003d | RRSP withholding tax: QC $3,000 [snapshot]                                   | amount=3000, isQuebec=true                                                                                                                      | 5% [exact]                                                                                      | SOT-02 §rrsp-withholding                  | QC Tier 1: ≤$5,000                                                                                              |
| TC-PROJ-003e | RRSP withholding tax: QC $10,000 [snapshot]                                  | amount=10000, isQuebec=true                                                                                                                     | 10% [exact]                                                                                     | SOT-02 §rrsp-withholding                  | QC Tier 2: $5,001–$15,000                                                                                       |
| TC-PROJ-003f | RRSP withholding tax: QC $20,000 [snapshot]                                  | amount=20000, isQuebec=true                                                                                                                     | 15% [exact]                                                                                     | SOT-02 §rrsp-withholding                  | QC Tier 3: >$15,000                                                                                             |
| TC-PROJ-004  | RRSP tax benefit calculation [structural]                                    | contribution=10000, marginalRate=0.35                                                                                                           | $3,500.00 [exact]                                                                               | SOT-02 §rrsp-contribution-room            | taxBenefit = contribution × marginalRate                                                                        |
| TC-PROJ-005  | TFSA annual limit: year=2024 [snapshot]                                      | year=2024                                                                                                                                       | $7,000.00 [exact]                                                                               | SOT-02 §tfsa-annual-limits                | TFSA_ANNUAL_LIMITS lookup                                                                                       |
| TC-PROJ-005b | TFSA annual limit: year=2025 [snapshot]                                      | year=2025                                                                                                                                       | $7,000.00 [exact]                                                                               | SOT-02 §tfsa-annual-limits                | TFSA_ANNUAL_LIMITS lookup                                                                                       |
| TC-PROJ-005c | TFSA annual limit: unknown future year fallback [snapshot]                   | year=2099                                                                                                                                       | $7,000.00 [exact]                                                                               | SOT-02 §tfsa-annual-limits                | Falls back to last known value; [NEEDS CONFIRMATION] for any year SOT-02 marks projected                        |
| TC-PROJ-006  | TFSA cumulative room with withdrawal restoration [structural]                | previousRoom=20000, withdrawalsLastYear=5000, year=2024                                                                                         | $32,000.00 [exact] (20000 + 5000 + 7000)                                                        | SOT-02 §tfsa-contribution-room            | Withdrawals restore room in FOLLOWING year per CRA rule                                                         |
| TC-PROJ-007  | TFSA contribution eligibility: age 17 [structural]                           | age=17                                                                                                                                          | false [exact]                                                                                   | SOT-02 §tfsa-eligibility                  | Age gate; must be 18+                                                                                           |
| TC-PROJ-007b | TFSA contribution eligibility: age 18 [structural]                           | age=18                                                                                                                                          | true [exact]                                                                                    | SOT-02 §tfsa-eligibility                  | Age 18 is the qualifying age                                                                                    |
| TC-PROJ-008  | TFSA withdrawal tax-free [structural]                                        | (any withdrawal amount)                                                                                                                         | 0 [exact]                                                                                       | SOT-02 §tfsa-withdrawals                  | TFSA withdrawals are always tax-free                                                                            |
| TC-PROJ-009  | TFSA excluded from OAS clawback [structural]                                 | (any TFSA income)                                                                                                                               | false [exact]                                                                                   | SOT-02 §tfsa-oas-clawback                 | TFSA income never triggers OAS recovery tax                                                                     |
| TC-PROJ-010  | Non-reg annual taxable income split [structural]                             | return=0.06, balance=100000, allocation={interest:0.30, dividend:0.20, capitalGain:0.50}                                                        | interest=$1,800; dividend=$1,200; capitalGain=$3,000 [exact]                                    | SOT-02 §non-registered-default-allocation | DEFAULT_INCOME_ALLOCATION: 30% interest, 20% div, 50% CG                                                        |
| TC-PROJ-011  | Non-reg ACB growth (proportional approx) [structural]                        | balance=100000, acb=80000, return=0.06, allocation={interest:0.30, dividend:0.20, capitalGain:0.50}                                             | newBalance=$106,000; newAcb=$84,800.00 [exact] (80000 × 106000/100000)                          | SOT-02 §non-registered-acb                | Simplified proportional approximation; see REGR-004                                                             |
| TC-PROJ-012  | Non-reg withdrawal capital gains realization [structural]                    | withdrawalAmount=20000, balance=100000, acb=80000, unrealizedGains=20000                                                                        | capitalGainRealized=$4,000 [exact] (20% of withdrawal × unrealized ratio)                       | SOT-02 §non-registered-withdrawals        | Same pattern as TC-TAX-017; delegates to processNonRegWithdrawal                                                |
| TC-PROJ-013  | LIRA mandatory conversion at age 70: false [structural]                      | age=70, projectionYear=2030                                                                                                                     | shouldConvert=false [exact]                                                                     | SOT-02 §lira-mandatory-conversion         | MANDATORY_LIF_CONVERSION_AGE = 71                                                                               |
| TC-PROJ-013b | LIRA mandatory conversion at age 71: true [structural]                       | age=71, projectionYear=2031                                                                                                                     | shouldConvert=true [exact]                                                                      | SOT-02 §lira-mandatory-conversion         | Triggers at age 71 end-of-year                                                                                  |
| TC-PROJ-014  | LIRA one-time unlock: federal jurisdiction — allowed [structural]            | jurisdiction='federal', hasUsedOneTimeUnlock=false                                                                                              | canUnlock=true [exact]                                                                          | SOT-02 §lira-one-time-unlock              | Federal jurisdiction permits one-time unlock                                                                    |
| TC-PROJ-014b | LIRA one-time unlock: already used — false [structural]                      | jurisdiction='federal', hasUsedOneTimeUnlock=true                                                                                               | canUnlock=false [exact]                                                                         | SOT-02 §lira-one-time-unlock              | One-time only per person                                                                                        |
| TC-PROJ-014c | LIRA one-time unlock: QC not allowed [structural]                            | jurisdiction='QC', hasUsedOneTimeUnlock=false                                                                                                   | canUnlock=false [exact]                                                                         | SOT-02 §lira-one-time-unlock              | Quebec does not permit one-time unlock                                                                          |
| TC-PROJ-015  | LIRA small balance unlock: federal [snapshot]                                | balance=10000, jurisdiction='federal'                                                                                                           | canUnlock=true [NEEDS CONFIRMATION]                                                             | SOT-02 §lira-small-balance                | Threshold varies by jurisdiction; [NEEDS CONFIRMATION] if SOT-02 does not enumerate all jurisdiction thresholds |
| TC-PROJ-016  | LIF minimum withdrawal = RRIF rates [snapshot]                               | balance=300000, age=72                                                                                                                          | same as TC-RRIF-001 worked value (5.40% → $16,200.00) [exact]                                   | SOT-02 §lif-minimum                       | Delegates to getRRIFMinimumRate; same CRA table                                                                 |
| TC-PROJ-017  | LIF max CANSIM formula [structural]                                          | balance=300000, age=72, jurisdiction='federal'                                                                                                  | balance × r/(1-(1+r)^-n) with SOT-02 reference rate [NEEDS CONFIRMATION] for annual CANSIM rate | SOT-02 §lif-max-cansim                    | Formula: r/(1-(1+r)^-n) where n = 90 - age; r = CANSIM reference rate                                           |
| TC-PROJ-018  | LIF max: ON/BC/NL use previous-year return override [structural]             | balance=300000, age=72, jurisdiction='ON', previousYearReturnRate=0.08                                                                          | max(statutoryMax, balance × 0.08) [exact]                                                       | SOT-02 §lif-on-bc-nl-override             | ON/BC/NL use max(statutory, prevYearReturn × balance)                                                           |
| TC-PROJ-018b | LIF max: federal no previous-year override [structural]                      | balance=300000, age=72, jurisdiction='federal', previousYearReturnRate=0.08                                                                     | statutoryMax [exact]                                                                            | SOT-02 §lif-on-bc-nl-override             | Federal jurisdiction ignores previousYearReturnRate                                                             |
| TC-PROJ-019  | LIF younger spouse election [structural]                                     | ownerAge=72, spouseAge=68                                                                                                                       | minimum uses spouseAge=68 rate (lower age → lower rate) [exact]                                 | SOT-02 §lif-younger-spouse                | Mirrors TC-RRIF-004; uses lower of owner/spouse age                                                             |
| TC-PROJ-020  | Withdrawal strategy selection: standard [structural]                         | strategyName='standard'                                                                                                                         | returns strategy object with ordering function [exact]                                          | SOT-07 §withdrawal-strategies             | Keys from MODULE-MAP.md Phase 27 audit                                                                          |
| TC-PROJ-020b | Withdrawal strategy selection: tfsaFirst [structural]                        | strategyName='tfsaFirst'                                                                                                                        | returns strategy object with ordering function [exact]                                          | SOT-07 §withdrawal-strategies             | TFSA drawn first to preserve tax-deferred growth                                                                |
| TC-PROJ-020c | Withdrawal strategy selection: taxOptimized [structural]                     | strategyName='taxOptimized'                                                                                                                     | returns strategy object with ordering function [exact]                                          | SOT-07 §withdrawal-strategies             | Minimizes combined tax across account types                                                                     |
| TC-PROJ-020d | Withdrawal strategy selection: oasProtection [structural]                    | strategyName='oasProtection'                                                                                                                    | returns strategy object with ordering function [exact]                                          | SOT-07 §withdrawal-strategies             | Avoids OAS clawback threshold                                                                                   |
| TC-PROJ-020e | Withdrawal strategy selection: rrspMeltdown [structural]                     | strategyName='rrspMeltdown'                                                                                                                     | returns strategy object with ordering function [exact]                                          | SOT-07 §withdrawal-strategies             | Aggressively depletes RRSP before RRIF conversion                                                               |
| TC-PROJ-021  | Withdrawal spending need calculation [structural]                            | desiredSpending=60000, guaranteedIncome=20000, taxes=5000, oneTime=0                                                                            | $35,000.00 [exact] (60000 - 20000 - 5000)                                                       | SOT-07 §spending-need                     | Net spending = gross - guaranteed income - taxes - oneTime                                                      |
| TC-PROJ-022  | Withdrawal plan enforces RRIF/LIF minimums first [structural]                | age=75, rrifBalance=300000, tfsaBalance=50000, spendingNeed=10000                                                                               | rrifMinimum withdrawn (exceeds $10,000 need); TFSA untouched [exact]                            | SOT-07 §mandatory-minimums                | Mandatory minimums must be taken regardless of spending need                                                    |
| TC-PROJ-023  | Age band spending reduction: highest band wins, no stacking [structural]     | spending=60000, age=80, bands=[{startAge:70,reduction:0.10},{startAge:75,reduction:0.20},{startAge:80,reduction:0.30}]                          | $42,000.00 [exact] (60000 × (1 - 0.30))                                                         | SOT-08 §age-band-spending                 | SPD-03/D-15 — bands do NOT stack; highest matching band wins                                                    |
| TC-PROJ-023b | Age band spending reduction: intermediate age [structural]                   | spending=60000, age=78, bands=[{startAge:70,reduction:0.10},{startAge:75,reduction:0.20},{startAge:80,reduction:0.30}]                          | $48,000.00 [exact] (60000 × (1 - 0.20))                                                         | SOT-08 §age-band-spending                 | Age 78 matches 0.20 band (age 75); 0.30 band (age 80) not yet reached                                           |
| TC-PROJ-024  | Contribution override resolution: first match wins [structural]              | accountType='rrsp', default=5000, year=2028, overrides=[{year:2028,accountType:'rrsp',amount:8000},{year:2028,accountType:'rrsp',amount:10000}] | $8,000.00 [exact] (first override match)                                                        | SOT-08 §contribution-overrides            | SAV-01/D-13; first match in array wins; subsequent overrides ignored                                            |
| TC-PROJ-025  | RRSP-to-RRIF conversion year at age 71 [structural]                          | birthYear=1960, projectionYear=2031, ageAtYearEnd=71                                                                                            | RRSP balance transferred to RRIF; conversionYear=2031; firstWithdrawalYear=2032 [exact]         | SOT-08 §rrsp-rrif-conversion-trigger      | Conversion triggers at age 71 end-of-year                                                                       |
| TC-PROJ-026  | RRIF first mandatory withdrawal at age 72 [structural]                       | birthYear=1960, projectionYear=2032, ageAtYearEnd=72                                                                                            | mandatory minimum withdrawn; year-1 balance used for calculation [exact]                        | SOT-08 §rrif-first-withdrawal             | Year after RRIF conversion; year-start balance at post-conversion amount                                        |
| TC-PROJ-027  | CPP survivor benefit on spouse death [structural]                            | projectionYear=2045, ownCPP=15000, deceasedCPP=12000, maxCPP=16800                                                                              | survivorCPP=min(15000 + 12000 × 0.60, 16800) = $16,800.00 [exact] (capped at max)               | SOT-05 §cpp-survivor                      | Survivor receives 60% of deceased CPP added to own CPP; capped at max                                           |
| TC-PROJ-028  | Spouse marital status transitions to single after partner death [structural] | projectionYear=2046 (year after death in 2045)                                                                                                  | survivingSpouse.maritalStatus='single' [exact]; GIS recalculated at single threshold            | SOT-08 §death-event                       | Downstream effect on TC-GIS-001 threshold; GIS uses single threshold from year of death onward                  |
| TC-PROJ-029  | Legacy target met: no target set [structural]                                | legacyTarget=undefined                                                                                                                          | legacyTargetMet=null [exact]                                                                    | SOT-09 §legacy-target                     | null when no legacyTarget configured                                                                            |
| TC-PROJ-029b | Legacy target met: target achieved [structural]                              | legacyTarget=500000, finalNetWorth=600000                                                                                                       | legacyTargetMet=true [exact]                                                                    | SOT-09 §legacy-target                     | finalNetWorth > legacyTarget                                                                                    |
| TC-PROJ-029c | Legacy target met: target missed [structural]                                | legacyTarget=500000, finalNetWorth=400000                                                                                                       | legacyTargetMet=false [exact]                                                                   | SOT-09 §legacy-target                     | finalNetWorth < legacyTarget                                                                                    |
| TC-PROJ-030  | Portfolio depletion early exit [structural]                                  | 30-year projection where totalNetWorth crosses zero at year 18                                                                                  | rows.length=18 [exact]; no year 19+ rows in output                                              | SOT-08 §depletion-exit                    | Multi-year loop terminates when totalNetWorth <= 0                                                              |
| TC-PROJ-031  | LIRA-to-LIF auto-conversion trigger [structural]                             | age=71, liraBalance=200000, projectionYear=2031                                                                                                 | shouldAutoConvertLIRA=true; LIRA balance transferred to LIF [exact]                             | SOT-02 §lira-mandatory-conversion         | Same age 71 trigger as TC-PROJ-013b; called yearly in multi-year loop                                           |
| TC-PROJ-032  | Bridge benefit proration by birth month [structural]                         | annualBridge=12000, birthdate=1960-06-15, projectionYear=2025                                                                                   | $6,000.00 [exact] (12000 × 6/12 — retires partway through year)                                 | SOT-03 §bridge-benefit-proration          | Uses birthdate.getMonth() + 1; months remaining in retirement year                                              |
| TC-PROJ-033  | Couple pension split: optimizer binary search [structural]                   | couple with splittable pension income, optimizePensionSplitting=true                                                                            | splitPercent in [0, 0.5] with 0.05 step that minimizes combined tax [exact]                     | SOT-04 §pension-splitting                 | 0.05-step binary search across [0, 0.50]; returns optimal split                                                 |
| TC-PROJ-034  | Couple pension split: fixed percent override [structural]                    | incomeSplitting={enabled:true, splitPercent:0.35}                                                                                               | exactly 35% of eligible pension transferred [exact]                                             | SOT-04 §pension-splitting                 | TAX-03 decision type; overrides optimizer when splitPercent explicitly set                                      |
| TC-PROJ-035  | OAS clawback avoidance at couple level [structural]                          | couple nearing OAS clawback threshold, oasClawbackAvoidance=true                                                                                | withdrawals redirected to avoid threshold breach where possible [exact]                         | SOT-04 §oas-clawback                      | TAX-04 decision type; applies income-splitting and account-ordering to stay below clawback                      |

**Count: 35 TC-PROJ surfaces covered.**

---

## TC-CHAIN: Profile -> Scenario -> Engine Data Flow Scenarios

Source files: `packages/api/src/lib/profile-assembler.ts`, `packages/api/src/lib/scenario-decisions.ts`, `packages/api/src/lib/projection-transformer.ts`, `packages/api/src/services/profile-scenario.service.ts`

Primary SOT: SOT-10 (`docs/source-of-truth/10-scenarios.md`)

**SPEC-03 coverage:** Scenarios TC-CHAIN-005 through TC-CHAIN-012 cover all 8 scenario decision types from `applyScenarioDecisions()`: drawdown order, RRSP meltdown, income splitting, OAS clawback avoidance, contribution overrides, age-band reductions, inflation rate, legacy target.

| ID           | Scenario Name                                                                | Inputs                                                                                                                                                          | Expected Output                                                                                                               | Citation                                | Notes                                                                                                              |
| ------------ | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| TC-CHAIN-001 | Profile assembly: dual-shape income detection [structural]                   | Row a: `profileData.income=[{type:'employment', amount:80000}]` (raw array). Row b: `profileData.income={cards:[{type:'employment', amount:80000}]}` (wrapped). | Both rows: `assembledInputData.income.employment = 80000` [exact]                                                             | SOT-10 §profile-assembly                | D-03 pitfall; both input shapes must produce identical assembled income.                                           |
| TC-CHAIN-002 | Profile assembly: partial profile returns defaults [structural]              | `profileData={about_you:{firstName:'Alice'}}` (all other steps absent)                                                                                          | `retirementAge=65` [exact]; `province='ON'` [exact]; no crash or exception                                                    | SOT-10 §profile-assembly                | assembleProfileInputData never throws on incomplete profile; defaults fill all missing fields.                     |
| TC-CHAIN-003 | Profile assembly: spouse gating [structural]                                 | Row a: `about_you.includeSpouse=true`. Row b: `about_you.includeSpouse=false`.                                                                                  | Row a: spouse object present in assembled output. Row b: spouse field undefined. [exact]                                      | SOT-10 §profile-assembly                | Spouse assembly conditional on `includeSpouse` flag in about_you step.                                             |
| TC-CHAIN-004 | Profile assembly: income amount string coercion [structural]                 | `profileData.income=[{type:'employment', amount:'80000.50'}]` (string-typed amount from form input)                                                             | `assembledInputData.income.employment = 80000.50` [exact] (numeric)                                                           | SOT-10 §profile-assembly                | Handles string-typed amounts; `parseFloat(string \| number)` coercion applied.                                     |
| TC-CHAIN-005 | Scenario decision: drawdown order override (decision type 1) [structural]    | `base={drawdownOrder:'standard'}`, `decisions={drawdownOrder:'tfsaFirst'}`                                                                                      | `result.drawdownOrder='tfsaFirst'` [exact]; base object untouched (structuredClone)                                           | SOT-10 §drawdown-order-decision         | Decision type 1: drawdown order. structuredClone prevents base mutation.                                           |
| TC-CHAIN-006 | Scenario decision: RRSP meltdown override (decision type 2) [structural]     | `decisions={rrspMeltdown:{enabled:true, startAge:60, endAge:65, targetAmount:30000}}`                                                                           | `result.rrspMeltdown={enabled:true, startAge:60, endAge:65, targetAmount:30000}` [exact]                                      | SOT-10 §rrsp-meltdown-decision          | Decision type 2: rrspMeltdown. Strategy flag overlay.                                                              |
| TC-CHAIN-007 | Scenario decision: income splitting override (decision type 3) [structural]  | `decisions={incomeSplitting:{enabled:true, splitPercent:0.50}}`                                                                                                 | `result.incomeSplitting={enabled:true, splitPercent:0.50}` [exact]                                                            | SOT-10 §income-splitting-decision       | Decision type 3: incomeSplitting. TAX-03 via decisions.                                                            |
| TC-CHAIN-008 | Scenario decision: OAS clawback avoidance (decision type 4) [structural]     | `decisions={oasClawbackAvoidance:true}`                                                                                                                         | `result.oasClawbackAvoidance=true` [exact]                                                                                    | SOT-10 §oas-clawback-decision           | Decision type 4: oasClawbackAvoidance. TAX-04 via decisions. Flag propagated from decisions to result.             |
| TC-CHAIN-009 | Scenario decision: contribution overrides (decision type 5) [structural]     | `decisions={contributionOverrides:[{year:2028, accountType:'rrsp', amount:10000}]}`                                                                             | `result.contributionOverrides=[{year:2028, accountType:'rrsp', amount:10000}]` [exact]                                        | SOT-10 §contribution-overrides-decision | Decision type 5: contributionOverrides. SAV-01/D-13.                                                               |
| TC-CHAIN-010 | Scenario decision: age band reductions (decision type 6) [structural]        | `decisions={ageBandReductions:[{startAge:75, reduction:0.20}]}`                                                                                                 | `result.ageBandReductions=[{startAge:75, reduction:0.20}]` [exact]                                                            | SOT-10 §age-band-decision               | Decision type 6: ageBandReductions. SPD-03/D-15. Bands array attached to result.                                   |
| TC-CHAIN-011 | Scenario decision: inflation rate override (decision type 7) [structural]    | `base.inflation.rate=0.025`, `decisions={inflationRate:0.03}`                                                                                                   | `result.inflation.rate=0.03` [exact]                                                                                          | SOT-10 §inflation-rate-decision         | Decision type 7: inflationRate. Replaces base profile inflation when decision present.                             |
| TC-CHAIN-012 | Scenario decision: legacy target override (decision type 8) [structural]     | `decisions={legacyTarget:500000}`                                                                                                                               | `result.legacyTarget=500000` [exact]                                                                                          | SOT-10 §legacy-target-decision          | Decision type 8: legacyTarget. Sets final net worth target.                                                        |
| TC-CHAIN-013 | Scenario decision: spouse fields guarded when no spouse [structural]         | `result.spouse=undefined`, `decisions.spouse` set with values                                                                                                   | Spouse fields ignored; no crash or exception [exact]                                                                          | SOT-10 §spouse-guard                    | Prevents spouse fields being applied to single projections. Spouse block guarded by `result.spouse !== undefined`. |
| TC-CHAIN-014 | Transformer: FrontendInputData to ProjectionInput normalization [structural] | `{maritalStatus:'commonLaw', accounts:[{type:'RRSP'}]}`                                                                                                         | `{maritalStatus:'common_law', accounts:[{type:'rrsp'}]}` [exact]                                                              | SOT-10 §transformer                     | transformToProjectionInput: 'commonLaw'→'common_law'; 'RRSP'→'rrsp'.                                               |
| TC-CHAIN-015 | Transformer: marital status lossy mapping [structural]                       | Row a: divorced→single. Row b: widowed→single. Row c: single→single. Row d: married→married.                                                                    | All four mapped as described [exact]                                                                                          | SOT-10 §transformer                     | Non-obvious lossy mapping: divorced and widowed both collapse to 'single'.                                         |
| TC-CHAIN-016 | Transformer: couple output to FrontendResultData [structural]                | `CoupleProjectionOutput` with per-person result arrays                                                                                                          | `FrontendResultData` with top-level summary + per-person breakdowns [exact]                                                   | SOT-10 §transformer                     | CONCERNS.md: `transformCoupleOutput` path has limited validation.                                                  |
| TC-CHAIN-017 | Transformer: probability of success label [structural]                       | `{yearsWithMoney:25, totalRetirementYears:30}`                                                                                                                  | `probabilityOfSuccess='83.33%'` [exact] (25/30 × 100)                                                                         | SOT-09 §probability                     | See REGR-003 — NOT Monte Carlo; deterministic depletion ratio mislabeled as probability.                           |
| TC-CHAIN-018 | Full chain integration via runSingleScenario [integration]                   | Full `ProfileData` object + `ScenarioDecisions` object                                                                                                          | `FrontendResultData` with all decisions applied [exact]; structuredClone isolation verified (base input unmodified after run) | SOT-10 §full-chain                      | Full pipeline: assemble → decisions → transformToProjectionInput → runProjection → transformToFrontendOutput.      |

**Count: 18 TC-CHAIN surfaces covered. SPEC-03 satisfied (8 decision types: TC-CHAIN-005..012).**

---

## TC-ASSEMBLE: API Route + Middleware + JWT Integration Scenarios

Source files: `packages/api/src/routes/*.ts`, `packages/api/src/middleware/*.ts`, `packages/api/src/auth/jwt.ts`

Test type: integration (supertest with mocked DB/Redis), except JWT unit tests which are pure unit.

HTTP status codes and response shapes are exact by definition; no tolerance annotation needed unless a numeric body field requires precision.

| ID              | Scenario Name                                                     | Request                                                                       | Expected Response                                                                  | Notes                                                                                            |
| --------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| TC-ASSEMBLE-001 | POST /auth/register — success [structural]                        | `POST /auth/register` body: `{email, password}` (valid)                       | `201 {tokens:{accessToken,refreshToken}, user:{id,email}}`                         | Duplicate email → 409 CONFLICT_ERROR.                                                            |
| TC-ASSEMBLE-002 | POST /auth/register — validation fail [structural]                | `POST /auth/register` body: invalid email or weak password                    | `400 {error:{code:'VALIDATION_ERROR', details:[...]}}`                             | Password strength rules enforced by Zod schema.                                                  |
| TC-ASSEMBLE-003 | POST /auth/login — success [structural]                           | `POST /auth/login` body: `{email, password}` (correct)                        | `200 {tokens:{accessToken,refreshToken}, user:{id,email}}`                         | Auth rate limiter applied on this route.                                                         |
| TC-ASSEMBLE-004 | POST /auth/login — wrong password [structural]                    | `POST /auth/login` body: `{email, password}` (wrong password)                 | `401 {error:{code:'AUTHENTICATION_ERROR'}}`                                        | Constant-time bcrypt comparison.                                                                 |
| TC-ASSEMBLE-005 | POST /auth/refresh — success [structural]                         | `POST /auth/refresh` body: `{refreshToken}` (valid)                           | `200 {tokens:{accessToken,refreshToken}}` (new pair)                               | Expired access token accepted via decode; old refresh revoked.                                   |
| TC-ASSEMBLE-006 | POST /auth/refresh — invalid token [structural]                   | `POST /auth/refresh` body: `{refreshToken}` (invalid/expired)                 | `401 {error:{code:'AUTHENTICATION_ERROR'}}`                                        | REGR-015: O(N) bcrypt iteration over all active refresh tokens.                                  |
| TC-ASSEMBLE-007 | POST /auth/logout — success [structural]                          | `POST /auth/logout` with valid Bearer token                                   | `204` (no body)                                                                    | Blacklists access token in Redis (TTL = remaining lifetime); revokes refresh token in DB.        |
| TC-ASSEMBLE-008 | PUT /auth/password — success [structural]                         | `PUT /auth/password` Bearer + body: `{currentPassword, newPassword}`          | `200 {message:'Password updated'}`                                                 | RequireAuth gate; current password verified before update.                                       |
| TC-ASSEMBLE-009 | POST /auth/google/token — Google unconfigured [structural]        | `POST /auth/google/token` body: `{idToken}`                                   | `501 {error:{code:'NOT_IMPLEMENTED'}}`                                             | Returns 501 when `GOOGLE_CLIENT_ID` env var absent; condition in route handler.                  |
| TC-ASSEMBLE-010 | JWT access token generation (unit) [structural]                   | `generateAccessToken(userId, email)` called directly                          | Signed HS256 JWT with `exp = now + 900s` (15 min) [exact]                          | 15-min expiry from config; `algorithm: 'HS256'`.                                                 |
| TC-ASSEMBLE-011 | JWT access token blacklist check (unit) [structural]              | `isAccessTokenBlacklisted(token)` called; Redis key `token:blacklist:<token>` | Returns `true` if key exists, `false` otherwise [exact]                            | Redis prefix `token:blacklist:`.                                                                 |
| TC-ASSEMBLE-012 | JWT refresh token verification (unit) [structural]                | `verifyRefreshToken(userId, token)` with valid token                          | Iterates active tokens for userId; bcrypt compare succeeds [exact]                 | O(N) bcrypt concern; see REGR-015 (same pattern as refresh route).                               |
| TC-ASSEMBLE-013 | GET /api/projections — paginated success [structural]             | `GET /api/projections?page=1&limit=10` with Bearer                            | `200 {items:[...], pagination:{page,limit,total,totalPages}}`                      | RequireAuth; results scoped to authenticated userId.                                             |
| TC-ASSEMBLE-014 | POST /api/projections — success [structural]                      | `POST /api/projections` Bearer + body: `{name, inputData}`                    | `201 {projection:{id,name,status:'pending',...}}`                                  | Validates name (required), inputData (FrontendInputData schema).                                 |
| TC-ASSEMBLE-015 | POST /api/projections — validation fail [structural]              | `POST /api/projections` Bearer + body: missing `name` field                   | `400 {error:{code:'VALIDATION_ERROR'}}`                                            | Zod validation middleware catches missing required fields.                                       |
| TC-ASSEMBLE-016 | GET /api/projections/:id — success [structural]                   | `GET /api/projections/:id` Bearer (owner)                                     | `200 {projection:{id,name,inputData,resultData,...}}`                              | result_data included when calculation complete.                                                  |
| TC-ASSEMBLE-017 | GET /api/projections/:id — wrong user [structural]                | `GET /api/projections/:id` Bearer (different user)                            | `403 {error:{code:'AUTHORIZATION_ERROR'}}`                                         | userId ownership check in projection service.                                                    |
| TC-ASSEMBLE-018 | POST /api/projections/:id/calculate — success [structural]        | `POST /api/projections/:id/calculate` Bearer                                  | `200 {projection:{...resultData}}`                                                 | Synchronous inline `runProjection()` call. REGR-011: blocks event loop on large inputs.          |
| TC-ASSEMBLE-019 | DELETE /api/projections/:id — success [structural]                | `DELETE /api/projections/:id` Bearer (owner)                                  | `204` (no body)                                                                    | Soft delete via `deleted_at`; cache invalidation via Redis pattern.                              |
| TC-ASSEMBLE-020 | GET /api/profile — success [structural]                           | `GET /api/profile` Bearer                                                     | `200 {profile:{...ProfileData}}` or `404 {error:{code:'NOT_FOUND'}}` if no profile | NotFoundError when user has no profile record yet.                                               |
| TC-ASSEMBLE-021 | PATCH /api/profile/:step — success [structural]                   | `PATCH /api/profile/about_you` Bearer + body: valid step data                 | `200 {profile:{...}}`                                                              | JSONB merge-patch; marks all user scenarios as stale.                                            |
| TC-ASSEMBLE-022 | PATCH /api/profile/:step — invalid slug [structural]              | `PATCH /api/profile/unknown_step` Bearer + body                               | `400 {error:{code:'VALIDATION_ERROR'}}`                                            | Enum validation against VALID_STEPS list.                                                        |
| TC-ASSEMBLE-023 | POST /api/profile/calculate — success [structural]                | `POST /api/profile/calculate` Bearer                                          | `200 {result:{...FrontendResultData}}`                                             | Full pipeline: assemble → decisions → engine → store snapshot.                                   |
| TC-ASSEMBLE-024 | GET /api/profile/scenarios — success [structural]                 | `GET /api/profile/scenarios` Bearer                                           | `200 {scenarios:[{id,name,status,decisions},...]}`                                 | Metadata only; result_data excluded from list.                                                   |
| TC-ASSEMBLE-025 | POST /api/profile/scenarios — success [structural]                | `POST /api/profile/scenarios` Bearer + body: `{name}`                         | `201 {scenario:{id,name,isBase:false,status:'stale'}}`                             | name 1–100 chars; is_base=false for user-created scenarios.                                      |
| TC-ASSEMBLE-026 | POST /api/profile/scenarios/:id/run — success [structural]        | `POST /api/profile/scenarios/:id/run` Bearer                                  | `200 {result:{...FrontendResultData}}`                                             | Runs full chain via `runSingleScenario`; stores result.                                          |
| TC-ASSEMBLE-027 | POST /api/profile/scenarios/compare — success [structural]        | `POST /api/profile/scenarios/compare` Bearer + body: `{ids:[id1,id2]}`        | `200 {comparisons:[{scenarioId,result},...]}`                                      | 2–4 IDs; Base Scenario always included as delta reference.                                       |
| TC-ASSEMBLE-028 | POST /api/profile/scenarios/compare — too few IDs [structural]    | `POST /api/profile/scenarios/compare` Bearer + body: `{ids:[id1]}`            | `400 {error:{code:'VALIDATION_ERROR'}}`                                            | Minimum 2 scenario IDs required; maximum 4.                                                      |
| TC-ASSEMBLE-029 | DELETE /api/profile/scenarios/:id — base guard [structural]       | `DELETE /api/profile/scenarios/:id` (id = Base Scenario) Bearer               | `409 {error:{code:'CONFLICT_ERROR'}}`                                              | is_base guard prevents deleting the Base Scenario.                                               |
| TC-ASSEMBLE-030 | PUT /api/profile/scenarios/:id/decisions — success [structural]   | `PUT /api/profile/scenarios/:id/decisions` Bearer + body: partial decisions   | `200 {scenario:{...decisions, status:'stale'}}`                                    | Merge-patch JSONB decisions; ScenarioDecisionsSchema.partial() validation; sets status to stale. |
| TC-ASSEMBLE-031 | GET /api/reference/provinces — success (public) [structural]      | `GET /api/reference/provinces` (no auth)                                      | `200 {provinces:[{code,name},...]}`                                                | Public endpoint; no RequireAuth middleware.                                                      |
| TC-ASSEMBLE-032 | GET /api/reference/tax-brackets — ignores year param [structural] | `GET /api/reference/tax-brackets?year=2025`                                   | `200` with 2024 bracket data (year param ignored)                                  | REGR-008: tax-brackets endpoint always returns 2024 data regardless of year query param.         |
| TC-ASSEMBLE-033 | GET /health — liveness [structural]                               | `GET /health` (no auth)                                                       | `200 {status:'ok', timestamp}`                                                     | Not rate-limited; liveness probe endpoint.                                                       |
| TC-ASSEMBLE-034 | errorHandler: AppError subclass [structural]                      | Any route throws `NotFoundError`                                              | `404 {success:false, error:{code:'NOT_FOUND', message:'...'}}`                     | Stack trace omitted in production; correlationId included when present.                          |
| TC-ASSEMBLE-035 | errorHandler: ZodError formatting [structural]                    | Any route throws `ZodError`                                                   | `400 {success:false, error:{code:'VALIDATION_ERROR', details:[{path,message}]}}`   | Zod errors normalized to details array by errorHandler middleware.                               |
| TC-ASSEMBLE-036 | requireAuth: missing Bearer token [structural]                    | Any protected route with no `Authorization` header                            | `401 {error:{code:'AUTHENTICATION_ERROR'}}`                                        | Middleware surface; checked before route handler executes.                                       |
| TC-ASSEMBLE-037 | requireAuth: blacklisted token (unit) [structural]                | `requireAuth` middleware with valid-signature but blacklisted JWT             | `401 {error:{code:'AUTHENTICATION_ERROR'}}`                                        | Redis blacklist check occurs before JWT signature verify.                                        |

**Count: 37 TC-ASSEMBLE surfaces covered.**

---

## TC-E2E Component Specs (React Testing Library)

Component specs are written as 'what to assert' in plain English. Phase 30+ will translate these into @testing-library/react render tests. TC-E2E-001 (shadcn/ui primitives aggregated entry) is EXCLUDED from individual spec authoring per SURF-05 — primitives are tested only through their feature-component consumers.

### Component: ProfileWizardShell

Covers TC-E2E-002, TC-E2E-003, TC-E2E-004.

- Renders the correct step component for each of 7 steps (about_you, income, expenses, savings, benefits, property, spouse). [structural]
- Mount-but-hide pattern for spouse step when includeSpouse=false (spouse component mounts but is display:none). [structural]
- Field change triggers useDebouncedCallback(800ms) → exactly ONE PATCH /api/profile/:step after debounce window; NO PATCH during rapid typing. [structural] (TC-E2E-003)
- navigateToStep() calls bootstrapProfileStep before mounting the new step; PATCH must resolve before render. [structural] (TC-E2E-004)
- Form state managed by react-hook-form with zodResolver; invalid fields show inline errors.

### Component: ProjectionWizardForm

Covers TC-E2E-005, TC-E2E-006.

- 6-step wizard submit sequence: POST /api/projections → POST /api/projections/:id/calculate → redirect to /projections/:id. [structural]
- Edit mode: initialData prop pre-populates all form fields with existing values. [structural]
- Success toast does NOT block the submit button (uses .click({force:true}) in tests per MEMORY.md).

### Component: ScenarioList

Covers TC-E2E-007.

- Renders list of scenarios with Base scenario first.
- Run action triggers POST /api/profile/scenarios/:id/run; optimistic status update.
- Rename action triggers PATCH; error reverts optimistic update.
- Clone action creates a new scenario with a modified name.
- Delete action opens AlertDialog confirm; Base scenario delete is disabled (409 from API).
- Edit Decisions navigates to decisions editor.

### Component: DecisionsEditor

Referenced in SPEC-07.

- Renders form controls for all 8 scenario decision types (drawdownOrder, rrspMeltdown, incomeSplitting, oasClawbackAvoidance, contributionOverrides, ageBandReductions, inflationRate, legacyTarget).
- Save triggers PUT /api/profile/scenarios/:id/decisions with merge-patch shape; scenario status transitions to stale.
- Cancel discards unsaved changes without API call.

### Component: ComparisonView

Covers TC-E2E-008.

- Always fetches Base scenario as delta reference regardless of selected scenarios.
- Renders 6-metric table (peak net worth, longevity, estimated taxes, final net worth, years with money, probability of success) with delta vs Base.
- Deltas formatted as +/-$N or +/-N%.

### Component: YearByYearTab

Covers TC-E2E-009.

- Renders 47-column table with column group toggle pills (Income, Tax, Benefits, Withdrawals, Balances, Net Worth).
- Couple-aware: per-person columns when CoupleProjectionOutput.
- Sparse column hiding: columns with all-zero values across all rows hidden by default.

### Component: SummaryTab

Covers TC-E2E-010.

- Displays peak net worth, longevity, estimated taxes from FrontendResultData.summary.

### Component: ChartsTab

Covers TC-E2E-011.

- Renders Recharts line/bar for net worth, income, tax, balances using design-token colors.

### Component: LoginPage

Covers TC-E2E-012.

- Submit triggers POST /api/auth/login; on success stores tokens in localStorage and redirects to /dashboard. Notes: "Current impl uses localStorage — see REGR-012."

### Component: RegisterPage

Covers TC-E2E-013.

- Password strength meter matches API validation rules; submit → POST /api/auth/register → auto-login → redirect.

### Component: DashboardLayout auth guard

Covers TC-E2E-014.

- Missing localStorage token → redirect to /login (client-side guard).

### Component: useProjections hook

Covers TC-E2E-016, TC-E2E-017.

- GET /api/projections on mount → returns {projections, loading, error}. [structural]
- API failure → error field set, projections empty array. [structural]

### Module: profile-utils normaliseStepData

Covers TC-E2E-015 (unit test).

- Detects raw array vs {cards:[...]} shape; both produce identical normalised output. [structural]

**TC-E2E-001 (shadcn/ui aggregated)** — EXCLUDED from individual specs per SURF-05 scope decision. 18 primitives in `packages/web/src/components/ui/` tested only through feature-component consumers.

**Count: 17 TC-E2E surfaces mapped (1 aggregated excluded, 16 individual specified across 13 component subsections).**

---

## TC-E2E-PLAYWRIGHT: User Journey Specs

Full-stack journeys run against the docker-compose dev stack. Steps are written in plain English (no Playwright locator code). Phase 30+ will translate these into @playwright/test specs in `packages/web/e2e/`. MEMORY.md documents known locator gotchas (getByRole substring matching, Radix Select nth() selection, force-click for overlapping toasts).

### Journey 1: Profile wizard completion (SPEC-06 requirement 1)

**Preconditions:** User is logged in; no profile row exists yet.

**Steps:**

1. Navigate to /profile.
2. Fill About You step with firstName, lastName, birthdate=1960-06-15, province='ON', retirementAge=65, includeSpouse=false.
3. Click Next.
4. Fill Income step with employment card amount=80000, type='employment'.
5. Continue through Expenses, Savings (RRSP + TFSA cards), Benefits (expected CPP, OAS years), Property steps.
6. On final step, click Save.

**Expected:** Each step triggers PATCH /api/profile/:step with merge-patch shape; after save, GET /api/profile returns a complete profile.

**API surfaces exercised:** TC-ASSEMBLE-020, TC-ASSEMBLE-021.

### Journey 2: Run projection from scenario (SPEC-06 requirement 2)

**Preconditions:** User has completed profile; Base scenario exists.

**Steps:**

1. Navigate to /scenarios.
2. Click Run on Base scenario.
3. Wait for loading indicator to clear.

**Expected:** POST /api/profile/scenarios/:id/run returns 200; result_data rendered in results view.

**API surfaces exercised:** TC-ASSEMBLE-026.

### Journey 3: Scenario comparison (SPEC-06 requirement 3)

**Preconditions:** User has Base + 2 additional scenarios all with result_data.

**Steps:**

1. Navigate to /scenarios/compare.
2. Select Base + Scenario A + Scenario B.
3. Click Compare.

**Expected:** POST /api/profile/scenarios/compare returns 200 with 3 scenarios (Base always included as delta reference). Comparison table shows 6 metrics with delta columns.

**API surfaces exercised:** TC-ASSEMBLE-027.

### Journey 4: Year-by-year table viewing (SPEC-06 requirement 4)

**Preconditions:** User has at least one scenario with result_data.

**Steps:**

1. Navigate to scenario results view.
2. Click Year-by-Year tab.
3. Toggle column group pills (Income, Tax, Benefits, Withdrawals, Balances, Net Worth).

**Expected:** 47-column table renders; toggling pills shows/hides column groups.

**API surfaces exercised:** Frontend rendering only (data from localStorage or prior fetch).

### Journey 5: Scenario CRUD (SPEC-06 requirement 5)

**Preconditions:** User logged in with existing profile.

**Steps:**

1. Navigate to /scenarios.
2. Click New Scenario, enter name.
3. Verify scenario appears in list.
4. Click Rename, change name.
5. Click Clone on the renamed scenario.
6. Click Delete on the clone, confirm in AlertDialog.
7. Attempt to delete Base scenario — verify delete button disabled or API returns 409.

**Expected:** POST /api/profile/scenarios 201, PATCH 200, POST clone 201, DELETE 204, DELETE base → 409.

**API surfaces exercised:** TC-ASSEMBLE-025, TC-ASSEMBLE-029.

### Journey 6: Decisions editor (SPEC-06 requirement 6)

**Preconditions:** User has a non-base scenario.

**Steps:**

1. Navigate to scenario.
2. Click Edit Decisions.
3. Set drawdownOrder='tfsaFirst', enable incomeSplitting with splitPercent=0.5, set inflationRate=0.03.
4. Click Save.
5. Navigate back and verify scenario status shows 'stale'.

**Expected:** PUT /api/profile/scenarios/:id/decisions 200; scenario transitions to stale state.

**API surfaces exercised:** TC-ASSEMBLE-030.

### Journey 7: Login + auth guard redirect

**Preconditions:** Logged-out user.

**Steps:**

1. Visit /dashboard → verify redirect to /login.
2. Submit valid credentials.
3. Verify tokens stored in localStorage (REGR-012 baseline).
4. Verify redirect to /dashboard.

**Expected:** POST /api/auth/login 200.

**API surfaces exercised:** TC-ASSEMBLE-003.

Notes: "REGR-012 baseline — tokens in localStorage."

### Journey 8: Registration + auto-login

**Preconditions:** Email not registered.

**Steps:**

1. Visit /register.
2. Fill form with strong password.
3. Submit.

**Expected:** POST /api/auth/register 201; auto-login; redirect to profile wizard.

**API surfaces exercised:** TC-ASSEMBLE-001.

### Journey 9: Sign-out flow (REGR-013 baseline)

**Steps:**

1. Logged-in user clicks sign-out in dashboard layout.

**Expected (current broken behavior):** localStorage tokens cleared; NO POST /api/auth/logout call made. Access token remains valid server-side for up to 15 minutes.

Notes: "REGR-013 baseline — client does not call server-side logout."

### Journey 10: Full end-to-end happy path

**Steps:**

1. Register new user.
2. Complete 7-step profile wizard.
3. Run Base scenario.
4. Create Scenario A with drawdownOrder='rrspMeltdown'.
5. Run Scenario A.
6. Compare Base vs A.
7. View Year-by-Year for Scenario A.
8. Sign out.

**Expected:** All API calls succeed; full pipeline exercised end-to-end.

### Journey 11: Scenario switch updates table (PROJ-02)

**Preconditions:** page.route() mocks — two scenarios with distinct projection data:

- Scenario A ("Early Retirement"): 5 projection rows, retirement at row 2 (year 2028), `isRetired: true` from row 2 onward.
- Scenario B ("Late Retirement"): 3 projection rows, no retirement row (`isRetired: false` for all).

**Steps:**

1. Mock `**/api/profile/scenarios` to return [Scenario A, Scenario B].
2. Mock `**/api/profile/scenarios/scenario-a-id` to return Scenario A detail with `result_data: { projectionRows: [...5 rows...] }`.
3. Mock `**/api/profile/scenarios/scenario-b-id` to return Scenario B detail with `result_data: { projectionRows: [...3 rows...] }`.
4. Navigate to /projections/view.
5. Wait for table to appear with 5 data rows (Scenario A auto-selected).
6. Open the scenario dropdown and select "Late Retirement".
7. Wait for table to update.

**Expected:**

- After step 5: table has 5 `<tr>` elements in `<tbody>`, first data row shows year 2026.
- After step 7: table has 3 `<tr>` elements in `<tbody>`, no row has `bg-ds-primary-container` class.

**API surfaces exercised:** TC-E2E-021.

### Journey 12: Sticky column header during scroll (PROJ-03)

**Preconditions:** page.route() mock — one scenario with 30+ projection rows to enable vertical scroll within `max-h-[600px]` container.

**Steps:**

1. Mock `**/api/profile/scenarios` to return one scenario.
2. Mock detail endpoint to return `result_data: { projectionRows: [...30 rows...] }`.
3. Navigate to /projections/view.
4. Wait for table to appear.
5. Use `page.evaluate()` to scroll the `overflow-y-auto` container by 500px: `document.querySelector('[class*="overflow-y-auto"]').scrollTop = 500`.
6. Use `page.evaluate()` to read `document.querySelector('thead tr:first-child').getBoundingClientRect().top`.

**Expected:**

- The returned `top` value is >= 0 (sticky header is pinned at or above the container top, not scrolled away with a negative value).
- Note: if this value is negative, the sticky header is broken — an ancestor has `overflow` that defeats `position: sticky`.

**API surfaces exercised:** TC-E2E-022.

### Journey 13: Retirement year row highlighted (PROJ-04)

**Preconditions:** page.route() mock — one scenario with 10 projection rows where rows 0-4 have `isRetired: false` and rows 5-9 have `isRetired: true`. Row 5 year = 2031. Primary person age at row 5 = 65.

**Steps:**

1. Mock `**/api/profile/scenarios` to return one scenario.
2. Mock detail endpoint with the fixture described above.
3. Navigate to /projections/view.
4. Wait for table to appear.
5. Locate the `<tr>` containing text "2031" in the Year cell.

**Expected:**

- The row containing year 2031 has a class matching `bg-ds-primary-container`.
- The row contains text "(Retire)" somewhere in its cells (Age cell badge).
- Rows before 2031 (e.g., the row with year 2030) do NOT have `bg-ds-primary-container` class.

**API surfaces exercised:** TC-E2E-023.

### Journey 14: Net Worth Chart Rendering (PROJ-05)

**Preconditions:** page.route() mock — one completed scenario with `result_data.projectionRows` containing 10 rows (built by `buildMockProjectionRows(10, 5)`, retirement at index 5).

**Steps:**

1. Mock `**/api/profile/scenarios` to return one completed scenario with id `scen-chart-1`.
2. Mock detail endpoint `**/api/profile/scenarios/scen-chart-1` with the fixture described above.
3. Navigate to /projections/view.
4. Wait for Card title "Net Worth Trajectory" to be visible (timeout: 15000 — allows `next/dynamic` bundle to resolve).
5. Assert that at least one `<svg>` element is visible in the DOM.

**Expected:**

- The Card with title "Net Worth Trajectory" is visible within 15 seconds (dynamic import resolved, Recharts component mounted).
- At least one `<svg>` element is visible within 10 seconds (Recharts LineChart rendered the chart).

**Notes:**

- Uses `buildMockProjectionRows(10, 5)` helper — generates 10 rows with `householdNetWorth: 500000 - index * 10000`.
- Dynamic import with `ssr: false` means SVG appears asynchronously — timeout accounts for bundle resolution.
- The 15s timeout on the Card title assertion covers worst-case cold-start bundle loading in CI.

**API surfaces exercised:** TC-E2E-024.

---

### Journey 15: Reverse Calculator End-to-End (TC-E2E-REVERSE-001)

**Journey name:** Reverse Calculator end-to-end
**Requirements:** REV-10, REV-14
**Phase:** 54 (v1.12)
**File:** `packages/web/e2e/reverse-calculator.spec.ts`

**Preconditions:** Authenticated user. `page.route()` mocks:

- `**/api/solver/prefill` — returns `{ success: true, data: { province: 'ON', currentAge: 45, rrspBalance: 200000, tfsaBalance: 50000, nonRegBalance: 30000, employmentIncome: 80000, cppStartAge: 65, oasStartAge: 65 } }`
- `**/api/solver` (POST) — feasible variant: returns `{ success: true, data: { mode: 'required-savings', solvedValue: 15000, solvedLabel: 'Annual Savings Required', solvedUnit: 'dollars-per-year', feasible: true, convergenceIterations: 12, projectionSummary: { fundedStatus: 'green', finalPortfolioBalance: 250000, cppAnnualBenefit: 9000, oasAnnualBenefit: 7500, totalRetirementYears: 25, peakNetWorth: 800000 } } }`

**Steps (feasible variant):**

1. Navigate to `/reverse-calculator`.
2. Assert that "Reverse Calculator" link in the sidebar is highlighted active (has `bg-primary` or `text-primary-foreground` class).
3. Assert that the page heading "Reverse Calculator" is visible.
4. Assert that the pre-fill banner "Values loaded from your active profile" is visible.
5. Assert the badge "Pre-filled from profile" is visible.
6. Assert that the 4 mode cards are visible: "Required Annual Savings", "Sustainable Spending", "Earliest Retirement Age", "Required Total Savings".
7. Assert that "Required Annual Savings" is the selected mode (default).
8. Fill "Target Retirement Age" input with `65`.
9. Fill "Retirement Spending" input with `50000`.
10. Click "Calculate" button.
11. Assert hero answer displays (Plan 54-02 SolverResultCard — TBD).

**Infeasibility variant:**

Repeat steps 1–9, but mock `POST **/api/solver` to return `{ success: true, data: { mode: 'required-savings', solvedValue: 0, solvedLabel: 'Annual Savings Required', solvedUnit: 'dollars-per-year', feasible: false, infeasibleReason: 'Retirement is not feasible within the allowed savings range', convergenceIterations: 20, projectionSummary: { fundedStatus: 'red', finalPortfolioBalance: -50000, cppAnnualBenefit: 9000, oasAnnualBenefit: 7500, totalRetirementYears: 25, peakNetWorth: 200000 } } }`.

10. Click "Calculate" button.
11. Assert "Goal unreachable" infeasibility message is displayed (Plan 54-02 SolverResultCard — TBD).

**Expected:**

- Sidebar nav link "Reverse Calculator" is active when on `/reverse-calculator`.
- Pre-fill banner visible with "Pre-filled from profile" badge when prefill data available.
- All 4 mode selector cards visible on initial render.
- Form submits to POST /api/solver with correctly shaped payload on Calculate click.
- Hero answer and infeasibility card rendered by SolverResultCard (Plan 54-02).

**API surfaces exercised:** TC-E2E-REVERSE-001, REV-10, REV-14.

**Count: 16 Playwright journeys specified.**

---

### Journey 16: Monte Carlo Fan Chart Rendering (TC-NEW-MC-004)

**Journey name:** Monte Carlo fan chart renders 5 bands without errors
**Requirements:** MC-VIZ-01, MC-VIZ-02, MC-VIZ-03
**Phase:** 58 (v1.13)
**File:** `packages/web/e2e/monte-carlo-fan.spec.ts`

#### TC-NEW-MC-004 — Fan chart renders 5 bands without overlap errors

**Surface:** `MonteCarloFanChart` component
**File:** `packages/web/e2e/monte-carlo-fan.spec.ts`
**Type:** E2E (Playwright)
**SOT:** `docs/source-of-truth/09-success-metrics.md` — percentile band visualization

**Inputs:**

- Mocked completed MC job result via `page.route()` for `GET /api/projections/*/monte-carlo/*`
- percentileBands: array of 10 years with p10=50000, p25=100000, p50=150000, p75=200000, p90=250000 (all safe — no depletion)

**Steps:**

1. Navigate to `/projections/{id}` page with mocked projection data
2. Click the "Monte Carlo" tab
3. Click "Run Simulation" (mocked POST returns jobId immediately)
4. Poll response (mocked GET) returns status=completed with percentileBands
5. Assert: `svg` element visible in fan chart section
6. Assert: chart container has `data-testid="fan-chart"`
7. Assert: no NaN values in SVG path `d` attributes (zero-floor working)

**Expected output:**

- `svg` present in DOM (Recharts rendered)
- No "NaN" values in chart path d attributes (zero-floor working)

**Tolerance:** Visual only — pixel-perfect layout not asserted; presence of SVG and absence of errors is sufficient.

---

## REGR: Regression Baselines (Current Broken Behavior)

Each row documents the CURRENT broken/wrong behavior as the expected output. Purpose is change-detection baseline — NOT correctness assertion. Source: .planning/codebase/CONCERNS.md. A REGR test that starts failing means the codebase behavior silently changed — review and update either the code or the baseline.

| ID           | Scenario Name                                                | Inputs / Trigger                                                      | Current Broken Behavior (Expected Baseline)                                                                            | File                                                                                                                          | Notes                                                                                  |
| ------------ | ------------------------------------------------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| REGR-001     | Monte Carlo worker stub [structural]                         | Enqueue monte-carlo job to BullMQ `monte-carlo` queue                 | Worker returns `{success:true}` after ~100ms setTimeout; no simulation math performed                                  | `packages/worker/src/worker.ts:58`                                                                                            | Dead simulation — jobs silently no-op.                                                 |
| REGR-002     | Scenario comparison worker stub [structural]                 | Enqueue scenario-comparison job to BullMQ `scenario-comparison` queue | Logs TODO, returns `{success:true}` immediately; no comparison math                                                    | `packages/worker/src/worker.ts:35`                                                                                            | Stub processor; API handles comparisons synchronously instead.                         |
| REGR-003     | Probability of success mislabeled [structural]               | Projection with yearsWithMoney=25, totalRetirementYears=30            | `probabilityOfSuccess=83.33` (ratio × 100, NOT Monte Carlo percentage)                                                 | `packages/api/src/services/projection-transformer.ts:366-383`                                                                 | Rename to Portfolio Longevity Score is the fix — baseline asserts current wrong name.  |
| REGR-004     | ACB proportional approximation [structural]                  | Non-reg withdrawal of 10000 from balance 100000 with acb=80000        | `newAcb = 72000` (proportional: 80000 × (90000/100000)); not lot-tracked                                               | `packages/calculation-engine/src/projection/multi-year.ts:169-172`                                                            | `_currentACB` prefixed `_` — never read in tax step.                                   |
| REGR-005     | GIS marital status hardcoded single for spouses [structural] | Couple projection with low-income spouse                              | `calculateGovernmentBenefits` called with `maritalStatus='single'` for spouse, NOT 'married'                           | `packages/calculation-engine/src/projection/yearly-calculator.ts:214`                                                         | Married GIS rates TC-GIS-002/003/009/010 bypassed in couple projections. See REGR-022. |
| REGR-006     | Migration system unversioned [structural]                    | Run db:migrate twice on same database                                 | Idempotent `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... IF NOT EXISTS`; no migrations table, no rollback capability | `packages/api/src/db/migrate.ts`                                                                                              | No versioning; schema changes require manual intervention.                             |
| REGR-007     | JSONB typed unknown [structural]                             | Read input_data from projections table via projection service         | TypeScript type is `unknown`; written via `as never` cast                                                              | `packages/api/src/services/projection.service.ts:24-25`, `packages/api/src/services/scenario.service.ts:31-32`                | Unsafe JSONB deserialization; no runtime schema validation on read.                    |
| REGR-008     | Reference endpoint ignores year param [structural]           | `GET /api/reference/tax-brackets?year=2025`                           | `200` with 2024 tax brackets data regardless of year param                                                             | `packages/api/src/services/reference.service.ts:62-68`                                                                        | Year query parameter silently ignored; always returns 2024 constants.                  |
| REGR-009     | Historical year support missing [structural]                 | `getFederalTaxBrackets(2030)` and `estimateCPPAt65(0.75, 2030)`       | Both return 2024 constants regardless of year parameter                                                                | `packages/calculation-engine/src/projection/optimizer.ts:25,130`, `packages/calculation-engine/src/benefits/cpp.ts:141`       | No year interpolation; future projections use current-year constants.                  |
| REGR-010     | 2025 provincial tax tables incomplete [snapshot]             | `getProvincialTaxBrackets('QC', 2025)`                                | Returns 2024 QC brackets (7 provinces affected: QC, SK, MB, NS, NB, PE, NL)                                            | `packages/shared/src/constants/tax-tables.ts:318-324`                                                                         | 2025 data not yet added for 7 provinces; falls through to 2024 data.                   |
| REGR-011     | Sync projection blocks event loop [structural]               | `POST /api/projections/:id/calculate` with 40-year couple projection  | Handler runs `runProjection()` synchronously in-process; request latency equals full compute time (seconds)            | `packages/api/src/services/projection.service.ts:191-230`                                                                     | No async offloading; long projections block the Node.js event loop.                    |
| REGR-012     | Tokens in localStorage (XSS exposure) [structural]           | Successful login via `POST /api/auth/login`                           | Access + refresh tokens written to localStorage (not HttpOnly cookie)                                                  | `packages/web/src/app/(auth)/login/page.tsx:114-115`                                                                          | Security baseline — fix is HttpOnly cookie migration.                                  |
| REGR-013     | Logout does not call server [structural]                     | Dashboard sign-out button click                                       | localStorage cleared; NO `POST /api/auth/logout` call made; access token remains valid server-side for up to 15 min    | `packages/web/src/app/(dashboard)/layout.tsx:134-137`                                                                         | Token not blacklisted; server cannot invalidate active sessions.                       |
| REGR-014     | /metrics endpoint unauthenticated [structural]               | `GET /metrics` with no Bearer token                                   | `200` with full Prometheus metrics text                                                                                | `packages/api/src/app.ts`                                                                                                     | No auth on metrics; exposes internal counters publicly.                                |
| REGR-015     | Refresh token O(N) bcrypt scan [structural]                  | `verifyRefreshToken` for user with 10 active sessions                 | Fetches all 10 hashed tokens; bcrypt-compares each sequentially until match                                            | `packages/api/src/auth/jwt.ts:121-138`                                                                                        | Linear scan; performance degrades with session count.                                  |
| REGR-016     | JWT secret weak default [structural]                         | Server start with no `JWT_SECRET` env var set                         | Uses literal `'development-secret-key-change-in-production-32chars'` as signing secret                                 | `packages/api/src/config/index.ts:29`                                                                                         | Predictable default secret; tokens forgeable if env not set in production.             |
| REGR-017     | FHSA no dedicated implementation [structural]                | Create projection with FHSA account type                              | Account enum accepts `'fhsa'` but no dedicated withdrawal/contribution logic — treated as generic account              | `packages/calculation-engine/src/accounts/index.ts:60`                                                                        | FHSA tax rules not implemented; silently ignored.                                      |
| REGR-018     | Email verification not implemented [structural]              | Register new user via `POST /api/auth/register`                       | `users.email_verified = false` permanently; no verify-email endpoint exists                                            | `packages/api/src/services/auth.service.ts:89`                                                                                | Users can authenticate with unverified email addresses.                                |
| REGR-019     | next-auth unused dependency [structural]                     | `grep` for next-auth imports in `packages/web/src`                    | Zero import matches found                                                                                              | `packages/web/package.json`                                                                                                   | Dead beta dependency; adds install size with no benefit.                               |
| REGR-020     | investments/ module untested [structural]                    | `find packages/calculation-engine/src/investments -name '*.test.ts'`  | Zero test files found                                                                                                  | `packages/calculation-engine/src/investments/`                                                                                | Investment growth logic has no unit test coverage.                                     |
| REGR-021     | Core engine untested directly [structural]                   | Find unit tests for `yearly-calculator.ts` or `multi-year.ts`         | No direct unit tests; covered only via projection integration tests                                                    | `packages/calculation-engine/src/projection/multi-year.ts`, `packages/calculation-engine/src/projection/yearly-calculator.ts` | Internal engine functions not independently testable without integration harness.      |
| ~~REGR-022~~ | ~~GIS $51,840 hardcoded literal~~ [RESOLVED]                 | `getGISIncomeThreshold('married', false)`                             | Returns `BENEFIT_AMOUNTS_2024.gis.incomeThresholdMarriedOneOAS` (= `51840`)                                            | `packages/calculation-engine/src/benefits/gis.ts`                                                                             | Resolved: threshold now sourced from shared constants (feature 4.1).                   |

**Count: 21 active + 1 resolved (REGR-022) REGR surfaces.**

---

## TC-FUTURE Monte Carlo Scenario Specs (Phase 55)

The following scenario specs cover TC-FUTURE-015..018 (promoted to unit type) and TC-NEW-MC-001..003 (new surfaces). All tests live in `packages/calculation-engine/src/investments/monte-carlo.test.ts` (created in Phase 55 Plan 03).

| ID             | Scenario Name                             | Inputs                                                                                                                                 | Expected Output                                                                                                                                        | SOT Citation                                                                      | Notes                                                                |
| -------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| TC-FUTURE-015  | Monte Carlo simulation — basic run        | `runMonteCarloSimulation(500_000, 40_000, 30, { numSimulations: 1000, expectedReturn: 0.065, volatility: 0.11, seed: 42 })`            | `result.probabilityOfSuccess` is a number between 0 and 100; `result.scenarios.length === 1000`; `result.numSimulations === 1000`                      | SOT: docs/source-of-truth/06-investment-engine.md §Monte Carlo Simulation         | Directional assertion only (not exact); seed ensures reproducibility |
| TC-FUTURE-016  | Monte Carlo with inflation                | `runMonteCarloWithInflation(500_000, 40_000, 0.025, 30, { numSimulations: 100, seed: 1 })`                                             | `result.probabilityOfSuccess` is a number; each scenario has `yearlyData` with increasing withdrawal reflected (year N withdrawal > year 1 withdrawal) | SOT: docs/source-of-truth/06-investment-engine.md §Inflation-Adjusted Withdrawals | Inflation causes withdrawal escalation each year                     |
| TC-FUTURE-017  | Monte Carlo stress test — market crash    | `runStressTest({ scenario: 'market_crash_at_retirement', initialBalance: 1_000_000, annualWithdrawal: 50_000, projectionYears: 30 })`  | `result.yearlyData[0].returnRate === -0.3`                                                                                                             | SOT: docs/source-of-truth/06-investment-engine.md §Stress Test Scenarios Table    | Fixed return sequences per named scenario                            |
| TC-FUTURE-017b | Monte Carlo stress test — 2008 replay     | `runStressTest({ scenario: '2008_replay', initialBalance: 1_000_000, annualWithdrawal: 50_000, projectionYears: 30 })`                 | `result.yearlyData[0].returnRate === -0.37`                                                                                                            | SOT: docs/source-of-truth/06-investment-engine.md §Stress Test Scenarios Table    | Year 1 return matches 2008 crash magnitude                           |
| TC-FUTURE-018  | Monte Carlo PRNG reproducibility          | Two calls: `runMonteCarloSimulation(500_000, 40_000, 30, { numSimulations: 1000, expectedReturn: 0.065, volatility: 0.11, seed: 42 })` | Both calls produce identical `probabilityOfSuccess` value                                                                                              | SOT: specs/009-monte-carlo-simulation/tasks.md T005, SC-004                       | Determinism required for reproducible test gates                     |
| TC-NEW-MC-001  | Percentile band computation               | `computePercentileBands(scenarios_1000_trials, 65)` where scenarios has `projectionYears` years of data                                | Returns array of length === `projectionYears`; each element satisfies `p10 <= p25 <= p50 <= p75 <= p90` (monotone ordering); `p10 >= 0`                | SOT: specs/009-monte-carlo-simulation/data-model.md §computePercentileBands       | Depleted trials contribute 0 to percentile calculation               |
| TC-NEW-MC-002  | Success rate — well-funded case           | `runMonteCarloSimulation(1_000_000, 20_000, 30, { numSimulations: 1000, expectedReturn: 0.065, volatility: 0.11, seed: 42 })`          | `probabilityOfSuccess / 100` is between 0.70 and 1.00                                                                                                  | SOT: docs/source-of-truth/09-success-metrics.md §Success Rate Definition          | Generous balance-to-withdrawal ratio; expect high success            |
| TC-NEW-MC-002b | Success rate — guaranteed depletion       | `runMonteCarloSimulation(10_000, 500_000, 30, { numSimulations: 100, seed: 99 })`                                                      | `probabilityOfSuccess / 100 === 0.0` (100% depletion)                                                                                                  | SOT: docs/source-of-truth/09-success-metrics.md §Success Rate Definition          | Withdrawal far exceeds balance; all trials deplete                   |
| TC-NEW-MC-003  | Worst-case trial extraction — all succeed | `extractWorstCaseTrials(allPassingScenarios, 3)` where all trials have `depletionYear === null`                                        | Returns array of length 3; all entries have `depletionYear === null`; sorted ascending by `finalBalance` (lowest first)                                | SOT: specs/009-monte-carlo-simulation/data-model.md §extractWorstCaseTrials       | Pads with lowest-balance passing trials when failures < count        |
| TC-NEW-MC-003b | Worst-case trial extraction — mixed       | `extractWorstCaseTrials(mixedScenarios, 3)` where exactly 2 trials failed                                                              | Returns array of length 3: 2 failed trials + 1 passing trial with lowest `finalBalance`                                                                | SOT: specs/009-monte-carlo-simulation/data-model.md §extractWorstCaseTrials       | Failed trials take priority; passing trials fill remaining slots     |

**Count: 10 Monte Carlo scenario specs (7 surfaces + 3 sub-cases)**

---

## TC-MC-UI: Monte Carlo Panel E2E Scenario Specs (Phase 57)

The following scenario spec covers TC-NEW-MC-005. The test lives in `packages/web/e2e/monte-carlo.spec.ts` (created in Phase 57 Plan 01).

| ID            | Behavior                                                              | Inputs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Expected Output                                                                                                                                                                                                                                         | SOT                                                                                 |
| ------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| TC-NEW-MC-005 | Panel controls disable during run; other page tabs remain interactive | Mock `POST **/projections/*/monte-carlo` → 202 `{ success: true, data: { jobId: 'test-job-id', status: 'pending', progress: 0 } }`; Mock `GET **/projections/*/monte-carlo/test-job-id` → first call returns `{ status: 'processing', progress: 40 }`, second+ call returns `{ status: 'completed', progress: 100, result: { successRate: 82, numSimulations: 1000, worstCaseTrials: [3 entries], percentileBands: [], params: {...}, completedAt: '...' } }`; Mock `DELETE **/projections/*/monte-carlo/**` → 204 no body | Progress bar (`role="progressbar"`) visible after clicking "Run Simulation"; "Summary" tab clickable and activates while simulation is running (not disabled); after completion "82% success rate" heading visible; worst-case trials table has ≥3 rows | CONTEXT.md success criterion SC-2 (tab interactivity) + SC-3 (success rate display) |

**Command:** `pnpm --filter @retireops/web exec playwright test e2e/monte-carlo.spec.ts`

**Count: 1 TC-MC-UI scenario spec**

---

## Document Complete

**Total surface coverage:**

- TC-TAX: 30
- TC-RRIF: 9
- TC-CPP: 14
- TC-OAS: 15
- TC-GIS: 13
- TC-PROJ: 35
- TC-CHAIN: 18
- TC-ASSEMBLE: 37
- TC-E2E (component + Playwright): 17 + 10 journeys
- REGR: 22
- **Total in-scope: 220 surfaces + 10 Playwright journeys = 230 scenarios** (Phase 55 adds TC-FUTURE-015..018 promoted + TC-NEW-MC-001..003 = 7 new surfaces + 10 scenario specs)
- **Excluded (TC-FUTURE investments/ pre-Phase-55): 14 surfaces** (TC-FUTURE-001..014, not yet authored)

**Requirements satisfied:** SPEC-01 (every in-scope surface has a scenario), SPEC-02 (SOT citations or [NEEDS CONFIRMATION] on every numeric), SPEC-03 (8 decision types in TC-CHAIN-005..012), SPEC-04 (tolerance + age/projectionYear coordinates), SPEC-05 (structural/snapshot labels), SPEC-06 (10 Playwright journeys covering 6 required types), SPEC-07 (5 feature components specified with RTL conventions).
