# Testable Surfaces — RetireOps

**Phase:** 28 — Testable Surface Identification
**Created:** 2026-04-05
**Consumed by:** Phase 29 (TESTING.md Specification)
**Input sources:** docs/MODULE-MAP.md, .planning/codebase/CONCERNS.md, docs/source-of-truth/\*
**Purpose:** Complete registry of every testable behavior in the RetireOps codebase, classified by test type. Phase 29 authors one test scenario per row.

---

## Overview

### TC- Prefix Legend

| Prefix      | Domain                                    | Typical Test Type        | Section     |
| ----------- | ----------------------------------------- | ------------------------ | ----------- |
| TC-TAX      | Federal + provincial tax calculations     | unit                     | TC-TAX      |
| TC-RRIF     | RRIF minimum withdrawal + conversion      | unit                     | TC-RRIF     |
| TC-MLT      | RRSP meltdown wiring and guards           | unit                     | TC-MLT      |
| TC-CPP      | CPP benefit calculation                   | unit                     | TC-CPP      |
| TC-OAS      | OAS benefit calculation                   | unit                     | TC-OAS      |
| TC-GIS      | GIS benefit calculation                   | unit                     | TC-GIS      |
| TC-PROJ     | Projection engine + account rules         | unit                     | TC-PROJ     |
| TC-OPT      | Optimization engine helpers + analyzers   | unit                     | TC-OPT      |
| TC-CHAIN    | Profile → scenario → engine data flow     | unit / integration       | TC-CHAIN    |
| TC-ASSEMBLE | API routes + middleware + JWT             | integration              | TC-ASSEMBLE |
| TC-E2E      | React feature components + hooks          | E2E / integration        | TC-E2E      |
| TC-FUTURE   | investments/ module (not in Phase 29)     | future                   | TC-FUTURE   |
| REGR        | CONCERNS.md regression baselines          | regression               | REGR        |
| TC-HIST     | Historical backtesting dataset and engine | unit / E2E / integration | TC-HIST     |

### Test-Type Legend

- **unit** — Pure function tests: given inputs, assert expected output. No I/O, no database, no HTTP.
- **integration** — Supertest HTTP tests or service-layer tests with mocked database. Tests route × scenario combinations (success / validation-fail / auth-fail).
- **E2E** — Playwright full-stack tests. Browser drives the Next.js UI against the running API and database.
- **regression** — Baseline of current broken/wrong behavior as documented in CONCERNS.md. Purpose is to detect if behavior silently changes, not to fix it.
- **future** — Present in this document for completeness but excluded from Phase 29 authoring scope. investments/ module only.

### Column Format Specification

Standard 6-column format used by all sections except REGR:

`| ID | Surface Name | Function / Branch | Test Type | Existing Tests | Notes |`

The REGR section uses a 7-column variant with an additional "Current Broken Behavior (Baseline)" column and a "Files" column inserted after Surface Name:

`| ID | Surface Name | Current Broken Behavior (Baseline) | Files | Test Type | Existing Tests | Notes |`

### Surface Count Summary

| Section          | Count   |
| ---------------- | ------- |
| TC-TAX           | 30      |
| TC-RRIF          | 21      |
| TC-MLT           | 4       |
| TC-CPP           | 14      |
| TC-OAS           | 15      |
| TC-GIS           | 13      |
| TC-PROJ          | 43      |
| TC-OPT           | 12      |
| TC-CHAIN         | 20      |
| TC-ASSEMBLE      | 37      |
| TC-E2E           | 21      |
| TC-FUTURE        | 18      |
| TC-SHARED-SOLVER | 8       |
| TC-SOLVER        | 5       |
| REGR             | 22      |
| TC-MC            | 3       |
| TC-MC-API        | 4       |
| TC-HIST          | 10      |
| **Total**        | **305** |

---

## TC-TAX: Federal and Provincial Tax Surfaces

Source files: `packages/calculation-engine/src/tax/federal-tax.ts`, `provincial-tax.ts`, `capital-gains.ts`, `dividends.ts`, `credits.ts`, `oas-clawback.ts`, `tax/index.ts`

**Existing test files present:**

- `federal-tax.test.ts` — covers federal brackets, credits
- `provincial-tax.test.ts` — covers provincial brackets, Ontario surtax
- `capital-gains.test.ts` — covers capital gains calculation
- `dividends.test.ts` — covers dividend gross-up and credits
- `credits.test.ts` — covers supplementary tax credits
- `oas-clawback.test.ts` — covers OAS clawback
- `tax/index.test.ts` — integration test via `calculateTotalTax()`

| ID         | Surface Name                            | Function / Branch                                                                    | Test Type | Existing Tests           | Notes                                          |
| ---------- | --------------------------------------- | ------------------------------------------------------------------------------------ | --------- | ------------------------ | ---------------------------------------------- |
| TC-TAX-001 | Federal bracket tax: 2024 rates         | `calculateBracketTax` + `getFederalTaxBrackets(2024)`                                | unit      | `federal-tax.test.ts`    | 5-bracket structure; lowest rate 0.15          |
| TC-TAX-002 | Federal bracket tax: 2025 rates         | `calculateBracketTax` + `getFederalTaxBrackets(2025)`                                | unit      | `federal-tax.test.ts`    | Lowest rate changed to 0.145                   |
| TC-TAX-003 | Federal bracket tax: 2026 rates         | `calculateBracketTax` + `getFederalTaxBrackets(2026)`                                | unit      | `federal-tax.test.ts`    | Lowest rate 0.14 (projected)                   |
| TC-TAX-004 | Federal BPA credit                      | `calculateBasicPersonalAmountCredit(year)`                                           | unit      | `federal-tax.test.ts`    | BPA 2024=$15,705; 2025=$16,129                 |
| TC-TAX-005 | Federal age credit (income-tested)      | `calculateFederalAgeCredit(age, netIncome, year)`                                    | unit      | `federal-tax.test.ts`    | Age >= 65 trigger; reduction rate applies      |
| TC-TAX-006 | Federal pension income credit           | `calculateFederalPensionIncomeCredit(eligiblePensionIncome, year)`                   | unit      | `federal-tax.test.ts`    | Max $2,000 eligible pension income × 0.15      |
| TC-TAX-007 | Quebec abatement                        | `calculateFederalTax` with `isQuebec=true` → applies 16.5% abatement                 | unit      | `federal-tax.test.ts`    | Reduces federal tax by 16.5% for QC residents  |
| TC-TAX-008 | Federal marginal rate lookup            | `getFederalMarginalRate(taxableIncome, year)`                                        | unit      | `federal-tax.test.ts`    | Used in optimization calculations              |
| TC-TAX-009 | Provincial brackets: ON (surtax)        | `calculateProvincialTax` for ON + `calculateOntarioSurtax`                           | unit      | `provincial-tax.test.ts` | Two-tier surtax (20%/56%) applied post-credits |
| TC-TAX-010 | Provincial brackets: BC                 | `calculateProvincialTax` for BC                                                      | unit      | `provincial-tax.test.ts` | 7-bracket structure                            |
| TC-TAX-011 | Provincial brackets: AB                 | `calculateProvincialTax` for AB                                                      | unit      | `provincial-tax.test.ts` | Single-rate structure (10%)                    |
| TC-TAX-012 | Provincial brackets: QC                 | `calculateProvincialTax` for QC                                                      | unit      | `provincial-tax.test.ts` | Combined with federal Quebec abatement         |
| TC-TAX-013 | Provincial brackets: other provinces    | `calculateProvincialTax` for MB/SK/NS/NB/PE/NL/NT/NU/YT                              | unit      | `provincial-tax.test.ts` | Territory flat-tax variants                    |
| TC-TAX-014 | Provincial age credit (approx)          | `calculateProvincialAgeCredit` fallback `× 0.7` for provinces without specific entry | unit      | `provincial-tax.test.ts` | Approximation flag                             |
| TC-TAX-015 | Capital gains: standard 50% inclusion   | `calculateTaxableCapitalGain(gain)`                                                  | unit      | `capital-gains.test.ts`  | Standard rate; 0.5 inclusion                   |
| TC-TAX-016 | Capital gains: enhanced 66.7% threshold | `calculateTaxableCapitalGainEnhanced(gain, annualGains?)` — branch at $250K          | unit      | `capital-gains.test.ts`  | D-08: cumulative per-person threshold          |
| TC-TAX-017 | Capital gains: non-reg withdrawal ACB   | `processNonRegWithdrawal(amount, balance, acb, unrealizedGains)`                     | unit      | `capital-gains.test.ts`  | ACB proportional approx; see REGR-004          |
| TC-TAX-018 | Eligible dividend gross-up + credit     | `calculateTaxableDividendIncome` + `calculateTotalDividendTaxCredits`                | unit      | `dividends.test.ts`      | 38% gross-up; 15.0198% federal credit          |
| TC-TAX-019 | Non-eligible dividend gross-up + credit | `grossUpNonEligibleDividend` + `calculateNonEligibleDividendCredit`                  | unit      | `dividends.test.ts`      | 15% gross-up; 9.0301% federal credit           |
| TC-TAX-020 | Provincial dividend credit (ON/BC)      | `calculateProvincialDividendCredit(province, year)`                                  | unit      | `dividends.test.ts`      | Optional field; returns 0 if not in table      |
| TC-TAX-021 | OAS clawback threshold: age < 75        | `calculateOASClawback(netIncome, oasAmount, year)` below full-clawback               | unit      | `oas-clawback.test.ts`   | 15% of income above threshold                  |
| TC-TAX-022 | OAS clawback threshold: age >= 75       | `calculateOASClawback` using `fullClawbackAge75Plus` threshold                       | unit      | `oas-clawback.test.ts`   | Higher full-clawback threshold for 75+         |
| TC-TAX-023 | OAS fully clawed back                   | `isOASFullyClawedBack(netIncome, year, age)`                                         | unit      | `oas-clawback.test.ts`   | Boolean gate for projection display            |
| TC-TAX-024 | OAS max income to avoid clawback        | `maxIncomeToAvoidClawback(year)`                                                     | unit      | `oas-clawback.test.ts`   | Used in optimizer planning                     |
| TC-TAX-025 | Total tax integration                   | `calculateTotalTax(input)` — full federal + provincial + credits                     | unit      | `tax/index.test.ts`      | Integration of all tax sub-functions           |
| TC-TAX-026 | BC renters credit                       | `calculateBCRentersCredit(params)`                                                   | unit      | `credits.test.ts`        | Max $400; income-tested $63K–$83K              |
| TC-TAX-027 | Ontario seniors transit credit          | `calculateOntarioSeniorsTransitTaxCredit(params)`                                    | unit      | `credits.test.ts`        | Age 66+; max $3,000 expenses × 15%             |
| TC-TAX-028 | Medical expenses credit                 | `calculateMedicalExpensesCredit(params)`                                             | unit      | `credits.test.ts`        | Threshold min(3% netIncome, $2,759)            |
| TC-TAX-029 | Charitable donations credit             | `calculateCharitableDonationsCredit(params)`                                         | unit      | `credits.test.ts`        | First $200 at 15%; excess at 29%/33%           |
| TC-TAX-030 | Climate action incentive by province    | `calculateClimateActionIncentive(province)`                                          | unit      | `credits.test.ts`        | AB/SK/MB/ON amounts; rural 1.2×                |

**Count: 30 TC-TAX surfaces**

---

## TC-RRIF: RRIF Minimum Withdrawal and Conversion Surfaces

Source files: `packages/calculation-engine/src/accounts/rrif.ts`, `packages/shared/src/constants/rates.ts` (RRIF_MINIMUM_RATES)

**Existing test files present:**

- `rrif.test.ts` — covers RRIF minimum withdrawal and conversion

| ID          | Surface Name                           | Function / Branch                                                                           | Test Type | Existing Tests | Notes                                         |
| ----------- | -------------------------------------- | ------------------------------------------------------------------------------------------- | --------- | -------------- | --------------------------------------------- |
| TC-RRIF-001 | RRIF minimum withdrawal: age 72–94     | `calculateRRIFMinimumWithdrawal(balance, age)` — table lookup                               | unit      | `rrif.test.ts` | CRA-published table; 30 age entries 65–94     |
| TC-RRIF-002 | RRIF minimum withdrawal: age 95+       | `calculateRRIFMinimumWithdrawal` — `RRIF_MINIMUM_RATE_95_PLUS = 0.2`                        | unit      | `rrif.test.ts` | Fixed 20% for 95+                             |
| TC-RRIF-003 | RRIF minimum: below age 72             | `isRRIFMinimumRequired(age)` returns false for age < 72                                     | unit      | `rrif.test.ts` | Age 72 is the trigger (not 71)                |
| TC-RRIF-004 | RRIF minimum with younger spouse       | `calculateRRIFMinimumWithYoungerSpouse(balance, ownerAge, spouseAge)` — uses lower age      | unit      | `rrif.test.ts` | CRA election to use younger spouse's age      |
| TC-RRIF-005 | RRSP-to-RRIF conversion result         | `convertRRSPToRRIF(rrspBalance, conversionYear)` — first withdrawal year = conversionYear+1 | unit      | `rrif.test.ts` | RRSP deadline age 71; RRIF starts 72          |
| TC-RRIF-006 | RRIF withdrawal: below minimum clamped | `processRRIFWithdrawal` — requested < minimum → uses minimum                                | unit      | `rrif.test.ts` | Mandatory minimum enforcement                 |
| TC-RRIF-007 | RRIF withdrawal: above minimum allowed | `processRRIFWithdrawal` — requested > minimum → uses requested                              | unit      | `rrif.test.ts` | No maximum on RRIF withdrawals                |
| TC-RRIF-008 | RRIF 100% taxable flag                 | `processRRIFWithdrawal` returns `taxableAmount = withdrawal`                                | unit      | `rrif.test.ts` | All RRIF income is fully taxable              |
| TC-RRIF-009 | RRIF rate lookup for age               | `getRRIFMinimumRateForAge(age)` — returned as percentage                                    | unit      | `rrif.test.ts` | Delegates to `getRRIFMinimumRate` from shared |

| TC-RRIF-010 | calculatePersonYear: rrifConversionYear=true at age 71 | `calculatePersonYear` — conversion year flag when RRSP > 0 at age 71 | unit | `yearly-calculator.test.ts` | CONV-01: conversion year flag in PersonYear path |
| TC-RRIF-011 | calculatePersonYear: rrifForcedMinimum=0 at age 71 | `calculatePersonYear` — no forced minimum in conversion year | unit | `yearly-calculator.test.ts` | CONV-01: minimum withdrawals start at 72, not 71 |
| TC-RRIF-012 | calculatePersonYear: rrifForcedMinimum at age 72 | `calculatePersonYear` — `500000 × 0.0540 = 27000.00` | unit | `yearly-calculator.test.ts` | RMIN-01: opening-balance computation |
| TC-RRIF-013 | calculatePersonYear: rrifMinimumRate decimal | `calculatePersonYear` — `rrifMinimumRate = 0.0540` at age 72 (decimal, not percentage) | unit | `yearly-calculator.test.ts` | RMIN-03: no pre-storage rounding |
| TC-RRIF-014 | calculatePersonYear: rrifConversionYear=false when RRSP=0 | `calculatePersonYear` — no RRIF created, all minimum fields = 0 | unit | `yearly-calculator.test.ts` | CONV-02: no RRIF created when RRSP is $0 |
| TC-RRIF-015 | calculatePersonYear: forced minimum uses opening balance | `calculatePersonYear` — minimum is computed before Step 10 growth | unit | `yearly-calculator.test.ts` | RMIN-02: opening (not post-growth) balance |
| TC-RRIF-016 | calculatePersonYear: younger-spouse RRIF rate election | `calculatePersonYear` — `useYoungerSpouseForRRIF=true`, spouse age 65 → `rrifMinimumRate = 0.04`, `rrifForcedMinimum = 20000` | unit | `yearly-calculator.test.ts` | RYSP-01: younger-spouse election uses spouse age for rate lookup |
| TC-RRIF-017 | calculatePersonYear: owner-age RRIF rate without election | `calculatePersonYear` — `useYoungerSpouseForRRIF=false`, owner age 75 → `rrifMinimumRate = 0.0582`, `rrifForcedMinimum = 29100` | unit | `yearly-calculator.test.ts` | RYSP-02: default uses owner age for rate lookup |
| TC-RRIF-018 | runCoupleProjection: younger-spouse election reaches calculatePersonYear end-to-end | `runCoupleProjection` — `useYoungerSpouseForRRIF=true`, owner age 75, spouse age 65 → `primary.rrifMinimumRate = 0.04` in year 1 | integration | `couple-projection.test.ts` | RYSP-03: wire gap fix — flag propagates through multi-year → couple-calculator → calculatePersonYear |
| TC-RRIF-019 | runCoupleProjection: younger-spouse election lapses after spouse death | `runCoupleProjection` — spouse lifeExpectancy=65 (dies year 1); year 2 primary `rrifMinimumRate = 0.0598` (owner age 76), not 0.04 | integration | `couple-projection.test.ts` | RYSP-03: death-year lapse of younger-spouse election |
| TC-RRIF-020 | Meltdown enabled: RRIF forced minimums lower than base scenario | `runProjection` — two identical inputs, one with `rrspMeltdown.enabled`; sum `rrifForcedMinimum` ages 72–80 | integration | `projection.test.ts` | FR-007; SC-003: meltdown reduces future forced minimums |
| TC-RRIF-021 | RRIF forced minimum included in taxable income | `calculatePersonYear` — age 72, rrifBalance > 0 → `taxableIncome` includes `rrifForcedMinimum` amount | unit | `yearly-calculator.test.ts` | FR-005: RRIF withdrawals are 100% taxable |

**Count: 21 TC-RRIF surfaces**

---

## TC-MLT: RRSP Meltdown Wiring and Guards

Source files: `packages/calculation-engine/src/projection/yearly-calculator.ts`

**Existing test files present:**

- `yearly-calculator.test.ts` — covers TC-MLT-001 through TC-MLT-004

| ID         | Surface Name                              | Function / Branch                                                                                         | Test Type | Existing Tests              | Notes                                                             |
| ---------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------- | --------------------------- | ----------------------------------------------------------------- |
| TC-MLT-001 | Meltdown fires in pre-retirement years    | `calculateYear` / `calculatePersonYear` — meltdown enabled, retired, year in range → RRSP decreases       | unit      | `yearly-calculator.test.ts` | RMLT-01: voluntary withdrawals reduce future RRIF opening balance |
| TC-MLT-002 | Meltdown capped at available RRSP balance | `calculateYear` / `calculatePersonYear` — annualAmount > rrspBalance → withdrawal = balance, no overdraft | unit      | `yearly-calculator.test.ts` | RMLT-02: no negative RRSP balance                                 |
| TC-MLT-003 | Meltdown respects targetAmount floor      | `calculateYear` / `calculatePersonYear` — targetAmount set → meltdown stops when balance reaches floor    | unit      | `yearly-calculator.test.ts` | RMLT-03: target-floor stop guard                                  |
| TC-MLT-004 | Employment guard suppresses meltdown      | `calculateYear` / `calculatePersonYear` — isRetired=false → zero meltdown even with targetAmount          | unit      | `yearly-calculator.test.ts` | RMLT-04: cross-ref FIX-06/FIX-07                                  |

**Count: 4 TC-MLT surfaces**

---

## TC-CPP: CPP Benefit Calculation Surfaces

Source files: `packages/calculation-engine/src/benefits/cpp.ts`

**Existing test files present:**

- `cpp.test.ts` — covers adjustment factors, benefit calculations

| ID         | Surface Name                       | Function / Branch                                                      | Test Type | Existing Tests | Notes                                                |
| ---------- | ---------------------------------- | ---------------------------------------------------------------------- | --------- | -------------- | ---------------------------------------------------- |
| TC-CPP-001 | CPP early start penalty: age 60    | `calculateCPPAdjustmentFactor(60)` — 72 months × 0.006 = 36% reduction | unit      | `cpp.test.ts`  | Maximum early reduction                              |
| TC-CPP-002 | CPP early start penalty: age 61–64 | `calculateCPPAdjustmentFactor(age)` for ages 61–64                     | unit      | `cpp.test.ts`  | Proportional monthly reduction                       |
| TC-CPP-003 | CPP standard: age 65               | `calculateCPPAdjustmentFactor(65)` — factor = 1.0                      | unit      | `cpp.test.ts`  | Baseline; no adjustment                              |
| TC-CPP-004 | CPP late start bonus: age 66–70    | `calculateCPPAdjustmentFactor(age)` for ages 66–70                     | unit      | `cpp.test.ts`  | 0.007/month increase                                 |
| TC-CPP-005 | CPP late start bonus: age 70       | `calculateCPPAdjustmentFactor(70)` — 60 months × 0.007 = 42% increase  | unit      | `cpp.test.ts`  | Maximum late deferral                                |
| TC-CPP-006 | CPP out-of-range throws            | `calculateCPPAdjustmentFactor(age < 60 or > 70)` — throws Error        | unit      | `cpp.test.ts`  | Only throwing function in benefits/cpp.ts            |
| TC-CPP-007 | CPP benefit from expected amount   | `calculateCPPBenefit(expectedAmountAt65, startAge)`                    | unit      | `cpp.test.ts`  | Applies adjustment factor to user-entered amount     |
| TC-CPP-008 | CPP inflation indexing             | `indexCPPBenefit(baseAmount, inflationRate, years)`                    | unit      | `cpp.test.ts`  | Compound growth over years                           |
| TC-CPP-009 | CPP survivor benefit: 60% cap      | `calculateCPPSurvivorBenefit(deceasedAmount, maxCPPAmount?)`           | unit      | `cpp.test.ts`  | 60% of deceased's CPP; capped at max                 |
| TC-CPP-010 | CPP combined own + survivor        | `calculateCombinedCPP(ownBenefit, survivorBenefit, maxCPPAmount?)`     | unit      | `cpp.test.ts`  | Sum capped at BENEFIT_AMOUNTS_2024.cpp.maxAnnualAt65 |
| TC-CPP-011 | CPP break-even age calculation     | `calculateCPPBreakEvenAge(expectedAt65, earlyAge, laterAge)`           | unit      | `cpp.test.ts`  | Planning utility; not in active projection loop      |
| TC-CPP-012 | CPP estimate at 65 from percentage | `estimateCPPAt65(percentageOfMax, year?)`                              | unit      | `cpp.test.ts`  | year param ignored — always uses 2024 (REGR-013)     |
| TC-CPP-013 | CPP eligibility check              | `isEligibleForCPP(age)` — age >= 60                                    | unit      | `cpp.test.ts`  | Boolean gate                                         |
| TC-CPP-014 | CPP max deferral check             | `isMaxDeferral(startAge)` — startAge === 70                            | unit      | `cpp.test.ts`  | Planning utility                                     |

**Count: 14 TC-CPP surfaces**

---

## TC-OAS: OAS Benefit Calculation Surfaces

Source files: `packages/calculation-engine/src/benefits/oas.ts`

**Existing test files present:**

- `oas.test.ts` — covers residency factor, deferral, age-75 bonus

| ID         | Surface Name                                | Function / Branch                                                                  | Test Type | Existing Tests | Notes                                        |
| ---------- | ------------------------------------------- | ---------------------------------------------------------------------------------- | --------- | -------------- | -------------------------------------------- |
| TC-OAS-001 | OAS residency factor: full (40 years)       | `calculateOASResidencyFactor(40)` — returns 1.0                                    | unit      | `oas.test.ts`  | Full entitlement                             |
| TC-OAS-002 | OAS residency factor: partial (10–39 years) | `calculateOASResidencyFactor(years)` — prorated                                    | unit      | `oas.test.ts`  | Minimum 10 years; below 10 = 0               |
| TC-OAS-003 | OAS residency factor: below minimum         | `calculateOASResidencyFactor(< 10)` — returns 0                                    | unit      | `oas.test.ts`  | No OAS entitlement                           |
| TC-OAS-004 | OAS deferral factor: age 65 (no deferral)   | `calculateOASDeferralFactor(65)` — returns 1.0                                     | unit      | `oas.test.ts`  | Baseline                                     |
| TC-OAS-005 | OAS deferral factor: age 66–70              | `calculateOASDeferralFactor(age)` for ages 66–70                                   | unit      | `oas.test.ts`  | 0.006/month increase                         |
| TC-OAS-006 | OAS deferral factor: age 70 (max)           | `calculateOASDeferralFactor(70)` — 36% increase                                    | unit      | `oas.test.ts`  | Maximum deferral; 60 months × 0.6%           |
| TC-OAS-007 | OAS deferral throws below 65                | `calculateOASDeferralFactor(< 65)` — throws Error                                  | unit      | `oas.test.ts`  | Input guard                                  |
| TC-OAS-008 | OAS age-75 bonus                            | `calculateAge75Bonus(age)` — adds 10% when age >= 75                               | unit      | `oas.test.ts`  | OAS_RATES.age75Bonus = 0.1                   |
| TC-OAS-009 | OAS entitlement: age 65–74 vs 75+           | `calculateOASEntitlement(years, year?, age?)` — selects appropriate benefit amount | unit      | `oas.test.ts`  | Age determines which benefit table entry     |
| TC-OAS-010 | OAS full benefit calculation                | `calculateOASBenefit(yearsOfResidence, startAge, currentAge, year?)`               | unit      | `oas.test.ts`  | Combines residency × deferral × age-75 bonus |
| TC-OAS-011 | OAS inflation indexing                      | `indexOASBenefit(baseAmount, inflationRate, years)`                                | unit      | `oas.test.ts`  | Compound growth                              |
| TC-OAS-012 | OAS break-even age                          | `calculateOASBreakEvenAge(yearsOfResidence, earlyAge?, laterAge?)`                 | unit      | `oas.test.ts`  | Planning utility                             |
| TC-OAS-013 | OAS eligibility check                       | `isEligibleForOAS(age, yearsOfResidence)` — age >= 65 AND years >= 10              | unit      | `oas.test.ts`  | Boolean gate; both conditions required       |
| TC-OAS-014 | OAS receiving check                         | `isReceivingOAS(currentAge, oasStartAge)`                                          | unit      | `oas.test.ts`  | Whether OAS payments have started            |
| TC-OAS-015 | OAS year-keyed benefit lookup with fallback | `calculateOASEntitlement` — latest-year fallback for unknown years                 | unit      | `oas.test.ts`  | OAS_BENEFIT_AMOUNTS year-key lookup pattern  |

**Count: 15 TC-OAS surfaces**

---

## TC-GIS: GIS Benefit Calculation Surfaces

Source files: `packages/calculation-engine/src/benefits/gis.ts`

**Existing test files present:**

- `gis.test.ts` — covers GIS eligibility and benefit amounts

| ID         | Surface Name                                         | Function / Branch                                                                                               | Test Type | Existing Tests | Notes                                                      |
| ---------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------- | -------------- | ---------------------------------------------------------- |
| TC-GIS-001 | GIS income threshold: single                         | `getGISIncomeThreshold('single')` — returns $21,624                                                             | unit      | `gis.test.ts`  | From BENEFIT_AMOUNTS_2024                                  |
| TC-GIS-002 | GIS income threshold: married both OAS               | `getGISIncomeThreshold('married', spouseReceivingOAS=true)` — returns $28,560                                   | unit      | `gis.test.ts`  | From BENEFIT_AMOUNTS_2024                                  |
| TC-GIS-003 | GIS income threshold: married spouse not OAS         | `getGISIncomeThreshold('married', spouseReceivingOAS=false)` — returns $51,840                                  | unit      | `gis.test.ts`  | From BENEFIT_AMOUNTS_2024.gis.incomeThresholdMarriedOneOAS |
| TC-GIS-004 | GIS income calculation (employment exemption)        | `calculateGISIncome(totalIncome, oasIncome, employmentIncome)` — first $5,000 employment exempt                 | unit      | `gis.test.ts`  | Employment income exemption                                |
| TC-GIS-005 | GIS eligibility: must be receiving OAS               | `isEligibleForGIS(age, receivingOAS=false, ...)` — returns false                                                | unit      | `gis.test.ts`  | Requires OAS receipt as prerequisite                       |
| TC-GIS-006 | GIS eligibility: age >= 65 check                     | `isEligibleForGIS(age=64, ...)` — returns false                                                                 | unit      | `gis.test.ts`  | Age gate                                                   |
| TC-GIS-007 | GIS eligibility: income over threshold               | `isEligibleForGIS` when gisIncome > threshold — returns false                                                   | unit      | `gis.test.ts`  | Income gate                                                |
| TC-GIS-008 | GIS benefit amount: single                           | `calculateGISBenefit(gisIncome, 'single')`                                                                      | unit      | `gis.test.ts`  | 50% clawback rate on income above $0                       |
| TC-GIS-009 | GIS benefit amount: married both OAS                 | `calculateGISBenefit(gisIncome, 'married', spouseReceivingOAS=true)`                                            | unit      | `gis.test.ts`  | Lower max amount; different threshold                      |
| TC-GIS-010 | GIS benefit amount: married spouse not OAS           | `calculateGISBenefit(gisIncome, 'married', spouseReceivingOAS=false)`                                           | unit      | `gis.test.ts`  | Highest threshold; highest max amount                      |
| TC-GIS-011 | GIS clawback rate (50%)                              | `calculateGISBenefit` — reduction at 50 cents per dollar over threshold                                         | unit      | `gis.test.ts`  | BENEFIT_AMOUNTS_2024 clawback rate                         |
| TC-GIS-012 | GIS full calculation pipeline                        | `calculateGIS(age, receivingOAS, totalIncome, oasIncome, employmentIncome, maritalStatus, spouseReceivingOAS?)` | unit      | `gis.test.ts`  | Integration of eligibility + income calc + benefit         |
| TC-GIS-013 | GIS marital status 'common_law' treated as 'married' | `calculateGIS` with `common_law` — same thresholds as married                                                   | unit      | `gis.test.ts`  | MaritalStatus union includes common_law                    |

**Count: 13 TC-GIS surfaces**

> **Note:** See REGR-005 for a related regression — yearly-calculator.ts passes 'single' marital status to GIS for spouses, meaning the married GIS surfaces (TC-GIS-002, TC-GIS-003, TC-GIS-009, TC-GIS-010) are currently bypassed in couple projections. (REGR-022, the hardcoded $51,840 threshold, was resolved in feature 4.1 — threshold now sourced from `BENEFIT_AMOUNTS_2024.gis.incomeThresholdMarriedOneOAS`.)

---

## TC-PROJ: Projection Engine Decision Points

Source files: `packages/calculation-engine/src/projection/yearly-calculator.ts`, `multi-year.ts`, `couple-calculator.ts`, `accounts/rrsp.ts`, `accounts/tfsa.ts`, `accounts/non-registered.ts`, `accounts/lira.ts`, `accounts/lif.ts`, `withdrawals/calculator.ts`, `withdrawals/strategy.ts`

**Existing test files present:**

- `projection.test.ts` — integration-level single-person projections
- `couple-projection.test.ts` — integration-level couple projections
- `couple-calculator.test.ts` — couple-year calculation unit tests
- `edge-cases.test.ts` — projection edge cases
- `scenario.test.ts` — scenario decision application
- `spousal-edge-cases.test.ts` — spousal edge cases
- `rrsp.test.ts`, `tfsa.test.ts`, `non-registered.test.ts`, `lira.test.ts`, `lif.test.ts` — account-level unit tests
- `withdrawals.test.ts` — withdrawal strategy integration tests

**Note:** `yearly-calculator.ts` and `multi-year.ts` are NOT directly unit-tested — they are tested indirectly through projection integration tests. This is a gap noted in CONCERNS.md (also reflected in REGR-021).

| ID          | Surface Name                                                     | Function / Branch                                                                                                                                                | Test Type | Existing Tests                                                                                  | Notes                                                                                                                        |
| ----------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| TC-PROJ-001 | RRSP contribution room calculation                               | `calculateRRSPContributionRoom(earnedIncome, unusedRoom, year)` — 18% of prior income                                                                            | unit      | `rrsp.test.ts`                                                                                  | Uses RRSP_LIMITS[year]                                                                                                       |
| TC-PROJ-002 | RRSP contribution age gate (age <= 71)                           | `canContributeToRRSP(age)` and `validateRRSPContribution`                                                                                                        | unit      | `rrsp.test.ts`                                                                                  | Deadline at 71; AGE_MILESTONES                                                                                               |
| TC-PROJ-003 | RRSP withholding tax by amount tier                              | `getRRSPWithholdingTaxRate(amount, isQuebec?)` — three tiers                                                                                                     | unit      | `rrsp.test.ts`                                                                                  | Non-QC: 10%/20%/30%; QC: 5%/10%/15%                                                                                          |
| TC-PROJ-004 | RRSP tax benefit calculation                                     | `calculateRRSPTaxBenefit(contribution, marginalRate)`                                                                                                            | unit      | `rrsp.test.ts`                                                                                  | Used in optimizer decision logic                                                                                             |
| TC-PROJ-005 | TFSA annual limit by year                                        | `getTFSAAnnualLimit(year)` — $7,000 default for unknown years                                                                                                    | unit      | `tfsa.test.ts`                                                                                  | TFSA_ANNUAL_LIMITS lookup with fallback                                                                                      |
| TC-PROJ-006 | TFSA cumulative room calculation                                 | `calculateTFSAContributionRoom(previousRoom, withdrawalsLastYear, year)`                                                                                         | unit      | `tfsa.test.ts`                                                                                  | Withdrawals restore room in FOLLOWING year                                                                                   |
| TC-PROJ-007 | TFSA contribution eligibility (age >= 18)                        | `isEligibleForTFSA(age)`                                                                                                                                         | unit      | `tfsa.test.ts`                                                                                  | Age gate                                                                                                                     |
| TC-PROJ-008 | TFSA withdrawal tax-free                                         | `calculateTFSAWithdrawalTax()` — always returns 0                                                                                                                | unit      | `tfsa.test.ts`                                                                                  | Always tax-free                                                                                                              |
| TC-PROJ-009 | TFSA OAS clawback exempt                                         | `tfsaAffectsOASClawback()` — always returns false                                                                                                                | unit      | `tfsa.test.ts`                                                                                  | Used in income assembly                                                                                                      |
| TC-PROJ-010 | Non-registered annual taxable income                             | `calculateAnnualTaxableIncome(return, balance, allocation)` — interest/dividend/capital split                                                                    | unit      | `non-registered.test.ts`                                                                        | DEFAULT_INCOME_ALLOCATION: 30% interest, 20% div, 50% CG                                                                     |
| TC-PROJ-011 | Non-registered ACB growth (proportional approx)                  | `applyNonRegGrowth(balance, acb, return, allocation)` — ACB proportional to balance                                                                              | unit      | `non-registered.test.ts`                                                                        | Simplified; see REGR-004                                                                                                     |
| TC-PROJ-012 | Non-registered withdrawal capital gains                          | `processNonRegisteredWithdrawal(amount, balance, acb, unrealizedGains)`                                                                                          | unit      | `non-registered.test.ts`                                                                        | Delegates to capital-gains.ts processNonRegWithdrawal                                                                        |
| TC-PROJ-013 | LIRA mandatory conversion at 71                                  | `mustConvertLIRAToLIF(age)` — age >= 71                                                                                                                          | unit      | `lira.test.ts`                                                                                  | MANDATORY_LIF_CONVERSION_AGE                                                                                                 |
| TC-PROJ-014 | LIRA one-time unlock eligibility                                 | `canUseOneTimeUnlock(jurisdiction, hasUsedOneTimeUnlock)`                                                                                                        | unit      | `lira.test.ts`                                                                                  | Jurisdiction-specific; one-time only                                                                                         |
| TC-PROJ-015 | LIRA small balance unlock                                        | `canUseSmallBalanceUnlock(balance, jurisdiction)`                                                                                                                | unit      | `lira.test.ts`                                                                                  | Threshold varies by jurisdiction                                                                                             |
| TC-PROJ-016 | LIF minimum withdrawal (= RRIF rates)                            | `calculateLIFMinimumWithdrawal(balance, age)` — delegates to getRRIFMinimumRate                                                                                  | unit      | `lif.test.ts`                                                                                   | Same CRA table as RRIF                                                                                                       |
| TC-PROJ-017 | LIF maximum withdrawal: CANSIM formula                           | `calculateLIFMaximumWithdrawal(balance, age, jurisdiction)` — `r/(1-(1+r)^-n)`                                                                                   | unit      | `lif.test.ts`                                                                                   | Jurisdiction-specific reference rate                                                                                         |
| TC-PROJ-018 | LIF max: ON/BC/NL use previous-year return                       | `getLIFWithdrawalLimits` with `previousYearReturnRate` override                                                                                                  | unit      | `lif.test.ts`                                                                                   | `max(statutory, prevYearReturn)` for ON/BC/NL                                                                                |
| TC-PROJ-019 | LIF younger spouse election                                      | `calculateLIFMinimumWithYoungerSpouse` — uses lower of owner/spouse age                                                                                          | unit      | `lif.test.ts`                                                                                   | Same as RRIF younger-spouse election                                                                                         |
| TC-PROJ-020 | Withdrawal strategy selection                                    | `getWithdrawalStrategy(strategyName)` — 5 named strategies                                                                                                       | unit      | `withdrawals.test.ts`                                                                           | Keys: standard/tfsaFirst/taxOptimized/oasProtection/rrspMeltdown                                                             |
| TC-PROJ-021 | Withdrawal spending need calculation                             | `calculateSpendingNeed(desiredSpending, guaranteedIncome, taxes?, oneTime?)`                                                                                     | unit      | `withdrawals.test.ts`                                                                           | Net spending = gross - guaranteed income - taxes                                                                             |
| TC-PROJ-022 | Withdrawal plan from strategy                                    | `calculateWithdrawals(input)` — draws from accounts in priority order                                                                                            | unit      | `withdrawals.test.ts`                                                                           | Enforces mandatory RRIF/LIF minimums first                                                                                   |
| TC-PROJ-023 | Age band spending reduction                                      | `applyAgeBandReduction(spending, age, bands)` — highest matching band wins, no stacking                                                                          | unit      | `projection.test.ts` (indirect)                                                                 | SPD-03/D-15: bands do NOT stack                                                                                              |
| TC-PROJ-024 | Contribution override resolution                                 | `resolveContribution(accountType, default, year, overrides)` — first matching override wins                                                                      | unit      | `projection.test.ts` (indirect)                                                                 | SAV-01/D-13                                                                                                                  |
| TC-PROJ-025 | RRSP-to-RRIF conversion year (age 71)                            | Multi-year loop: converts RRSP to RRIF when age reaches 71                                                                                                       | unit      | `projection.test.ts`                                                                            | Conversion triggers at age 71 end-of-year                                                                                    |
| TC-PROJ-026 | RRIF first withdrawal year (age 72)                              | Multi-year loop: first mandatory RRIF withdrawal at age 72                                                                                                       | unit      | `edge-cases.test.ts`                                                                            | Year after RRIF conversion                                                                                                   |
| TC-PROJ-027 | CPP survivor benefit on spouse death                             | Multi-year loop: survivor receives 60% of deceased CPP; capped at max                                                                                            | unit      | `couple-projection.test.ts`                                                                     | Triggered when life expectancy reached                                                                                       |
| TC-PROJ-028 | Spouse marital status changes to single                          | Multi-year loop: after primary death, spouse `maritalStatus → 'single'`                                                                                          | unit      | `couple-projection.test.ts`                                                                     | Affects GIS calculation                                                                                                      |
| TC-PROJ-029 | Legacy target met evaluation                                     | `calculateProjectionSummary` — `legacyTargetMet: boolean                                                                                                         | null`     | unit                                                                                            | `projection.test.ts`                                                                                                         | null when no legacyTarget set |
| TC-PROJ-030 | Portfolio depletion early exit                                   | Multi-year loop: terminates when `totalNetWorth <= 0`                                                                                                            | unit      | `edge-cases.test.ts`                                                                            | Loop stops; years after depletion absent from rows                                                                           |
| TC-PROJ-031 | LIRA-to-LIF auto-conversion trigger                              | `shouldAutoConvertLIRA(age, balance)` — called yearly; converts at mandatory age                                                                                 | unit      | `lira.test.ts`                                                                                  | Triggers at age 71                                                                                                           |
| TC-PROJ-032 | Bridge benefit proration (monthly cutoff)                        | `calculateAnnualizedPensionIncome` — prorates bridge by birth month                                                                                              | unit      | `projection.test.ts`                                                                            | Uses `birthdate.getMonth() + 1`                                                                                              |
| TC-PROJ-033 | Couple pension split: optimizer                                  | `calculateCoupleYear` — `optimizePensionSplitting=true` → binary search 0–0.5                                                                                    | unit      | `couple-calculator.test.ts`                                                                     | 0.05-step binary search                                                                                                      |
| TC-PROJ-034 | Couple pension split: fixed percent                              | `calculateCoupleYear` — `incomeSplitting.enabled=true, splitPercent=X` → fixed                                                                                   | unit      | `couple-calculator.test.ts`                                                                     | Overrides optimizer; TAX-03                                                                                                  |
| TC-PROJ-035 | OAS clawback avoidance (couple level)                            | `calculateCoupleYear` — redirects withdrawals when clawback risk                                                                                                 | unit      | `couple-calculator.test.ts`                                                                     | TAX-04                                                                                                                       |
| TC-PROJ-036 | FundedStatus: Green classification                               | `computeFundedStatus` — portfolio lasts to LE with ≥ 10% buffer ratio → state='green', depletionAge=null                                                         | unit      | `funded-status.test.ts` (new in Plan 48-02)                                                     | FUND-02; Phase 48                                                                                                            |
| TC-PROJ-037 | FundedStatus: Yellow classification (< 10% buffer)               | `computeFundedStatus` — portfolio lasts to LE but balanceAtLifeExpectancy < 0.10 × totalRetirementWithdrawals → state='yellow'                                   | unit      | `funded-status.test.ts` (new in Plan 48-02)                                                     | FUND-03; Phase 48                                                                                                            |
| TC-PROJ-038 | FundedStatus: Red classification with depletion age              | `computeFundedStatus` — portfolio depletes before LE → state='red', depletionAge=age of first row with totalNetWorth <= 0                                        | unit      | `funded-status.test.ts` (new in Plan 48-02; parametrized across 3 depletion ages in Plan 48-05) | FUND-04, FUND-05; Phase 48; parametrized — 3 depletion ages (early/mid/late); describe.each with real runProjection() output |
| TC-PROJ-039 | RemediationPlan: save-more suggestion accuracy                   | `computeRemediationPlan` — binary search over additionalAnnualSavings [0, 200000]; apply result to projection → state ∈ {green, yellow}; accuracy ≤ 5%           | unit      | `funded-status.test.ts` (Phase 49 T020)                                                         | FUND-06..08; Phase 49                                                                                                        |
| TC-PROJ-040 | RemediationPlan: spend-less suggestion accuracy                  | `computeRemediationPlan` — binary search over annualSpendingReduction [0, currentSpend]; accuracy ≤ 5%                                                           | unit      | `funded-status.test.ts` (Phase 49 T020)                                                         | FUND-06..08; Phase 49                                                                                                        |
| TC-PROJ-041 | RemediationPlan: delay-retirement suggestion accuracy            | `computeRemediationPlan` — integer binary search [0, max(0, 70 − retirementAge)]; sets `delayCapReached` when cap is hit                                         | unit      | `funded-status.test.ts` (Phase 49 T020)                                                         | FUND-06..08; Phase 49                                                                                                        |
| TC-PROJ-042 | FundedStatus: zero retirement withdrawals edge case              | `computeFundedStatus` — totalRetirementWithdrawals === 0 → state='green' (treat ratio as ∞)                                                                      | unit      | `funded-status.test.ts` (new in Plan 48-02)                                                     | Edge case per spec Assumptions; Phase 48                                                                                     |
| TC-PROJ-043 | FundedStatus: couple projection uses longer-lived spouse horizon | `computeFundedStatus` — when input.spouse !== undefined, horizonAge = Math.max(input.lifeExpectancy, input.spouse.lifeExpectancy); LE-row lookup uses horizonAge | unit      | `funded-status.test.ts` (new in Plan 48-02)                                                     | FUND-12; Phase 48                                                                                                            |

**Count: 43 TC-PROJ surfaces**

---

## TC-OPT: Optimization Engine Surfaces

Source files: `packages/calculation-engine/src/projection/clone.ts`, `packages/calculation-engine/src/optimization/`

**Existing test files present:**

- `clone.test.ts` — covers TC-OPT-CLONE-001 (added Phase 43)

| ID               | Surface Name                                                                  | Function / Branch                                                                                                                                                                                             | Test Type | Existing Tests             | Notes                                                                           |
| ---------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------------------------- | ------------------------------------------------------------------------------- |
| TC-OPT-CLONE-001 | cloneProjectionInput deep clone correctness                                   | `cloneProjectionInput` — structuredClone wrapper; preserves Date instances; nested mutation isolation                                                                                                         | unit      | `clone.test.ts`            | OPT-3: prevents shared-state corruption in what-if runs; Phase 43; 7 test cases |
| TC-OPT-SPLIT-001 | Couple projection returns InsightCard with optimal split % and dollar savings | `analyzeIncomeSplitting` — couple with different incomes; returns InsightCard with module='income-splitting', estimatedDollarImpact > 0, split percentage between 1-50                                        | unit      | `income-splitting.test.ts` | SPLIT-01; Phase 44                                                              |
| TC-OPT-SPLIT-002 | Single-person projection returns null                                         | `analyzeIncomeSplitting` — no spouse; guard returns null immediately                                                                                                                                          | unit      | `income-splitting.test.ts` | SPLIT-02; Phase 44                                                              |
| TC-OPT-SPLIT-003 | Under-65 caveat; CPP excluded from splittable base                            | `analyzeIncomeSplitting` — primary under 65: explanation includes age-65 caveat; CPP/OAS income never counted in splittable base                                                                              | unit      | `income-splitting.test.ts` | SPLIT-03; Phase 44                                                              |
| TC-OPT-CPP-001   | CPP breakeven ages calculated for 60-vs-65 and 65-vs-70                       | `analyzeCPPOAS` — breakeven ages for early/late start scenarios                                                                                                                                               | unit      | `cpp-oas.test.ts`          | CPP-01; Phase 44                                                                |
| TC-OPT-CPP-002   | OAS clawback risk flag with estimated annual amount                           | `analyzeCPPOAS` — high-income retiree with clawback risk returns InsightCard                                                                                                                                  | unit      | `cpp-oas.test.ts`          | CPP-02; Phase 44                                                                |
| TC-OPT-CPP-003   | Couple returns separate InsightCards per person                               | `analyzeCPPOAS` — couple projection returns separate cards for primary and spouse                                                                                                                             | unit      | `cpp-oas.test.ts`          | CPP-03; Phase 44                                                                |
| TC-OPT-MLT-001   | RRSP meltdown schedule builds year-by-year bracket-fill amounts               | `analyzeRRSPMeltdown` — retired years before 71 with RRSP balance; returns InsightCard with schedule-derived dollar impact                                                                                    | unit      | `rrsp-meltdown.test.ts`    | MLT-01, MLT-02; Phase 45                                                        |
| TC-OPT-MLT-002   | Returns null when RRSP balance is zero                                        | `analyzeRRSPMeltdown` — `rrspBalance = 0`; guard returns null immediately                                                                                                                                     | unit      | `rrsp-meltdown.test.ts`    | CARD-03, MLT-01; Phase 45                                                       |
| TC-OPT-MLT-003   | Lifetime savings calculated from full projection comparison                   | `analyzeRRSPMeltdown` — two projections compared; `estimatedDollarImpact` > 0 for low-income early retiree                                                                                                    | unit      | `rrsp-meltdown.test.ts`    | MLT-02; Phase 45                                                                |
| TC-OPT-MLT-004   | OAS clawback gate excludes year when cost exceeds savings                     | `analyzeRRSPMeltdown` — high-income retiree near clawback threshold; year where clawback cost > bracket savings is excluded from schedule                                                                     | unit      | `rrsp-meltdown.test.ts`    | MLT-03; Phase 45                                                                |
| TC-OPT-DRAW-001  | analyzeDrawdownOrder returns InsightCard for lower-tax strategy               | `analyzeDrawdownOrder` — RRSP=200000, TFSA=100000, nonReg=50000; standard tax=80000, TFSA-first tax=70000; returns InsightCard with module='drawdown-order', estimatedDollarImpact=10000, confidence='MEDIUM' | unit      | `drawdown-order.test.ts`   | DRAW-01, DRAW-02; Phase 46                                                      |
| TC-OPT-DRAW-002  | analyzeDrawdownOrder returns null for single account type                     | `analyzeDrawdownOrder` — only TFSA has balance (rrspBalance=0, nonRegBalance=0); guard returns null immediately                                                                                               | unit      | `drawdown-order.test.ts`   | DRAW-03; Phase 46                                                               |
| TC-OPT-DRAW-003  | analyzeDrawdownOrder returns null when savings = 0                            | `analyzeDrawdownOrder` — both strategies return identical totalTaxesPaid; savings=0; null returned                                                                                                            | unit      | `drawdown-order.test.ts`   | DRAW-03; Phase 46                                                               |
| TC-OPT-ORCH-001  | runOptimizationAnalysis sorts cards by estimatedDollarImpact descending       | `runOptimizationAnalysis` — four mocked analyzers return cards with impacts [5000, 15000, 2000, 8000]; output order is [15000, 8000, 5000, 2000]                                                              | unit      | `orchestrator.test.ts`     | CARD-02; Phase 46                                                               |
| TC-OPT-ORCH-002  | runOptimizationAnalysis returns wellOptimized when all null                   | `runOptimizationAnalysis` — all analyzers return null/empty; result is { cards: [], wellOptimized: true, message: contains 'well-optimized' }                                                                 | unit      | `orchestrator.test.ts`     | CARD-04; Phase 46                                                               |
| TC-OPT-ORCH-003  | runOptimizationAnalysis filters null results from card array                  | `runOptimizationAnalysis` — two analyzers return null, one returns card; only the card present in result                                                                                                      | unit      | `orchestrator.test.ts`     | CARD-03; Phase 46                                                               |
| TC-OPT-ORCH-004  | runOptimizationAnalysis flattens InsightCard[] from analyzeCPPOAS             | `runOptimizationAnalysis` — analyzeCPPOAS returns [card1, card2], analyzeRRSPMeltdown returns card3, others null; all 3 in result                                                                             | unit      | `orchestrator.test.ts`     | CARD-03; Phase 46                                                               |
| TC-OPT-016       | Life expectancy already passed: all analyzers return empty                    | All four analyzers receive a projection where every year is in the past (life expectancy before today); each returns null/empty; orchestrator returns `{ cards: [] }`                                         | unit      | `orchestrator.test.ts`     | Edge case — life expectancy already passed; spec.md Assumptions                 |

**Count: 20 TC-OPT surfaces**

---

## TC-CHAIN: Profile-to-Scenario-to-Engine Data Flow Surfaces

Source files: `packages/api/src/services/profile-assembler.ts`, `scenario-decisions.ts`, `projection-transformer.ts`, `profile-scenario.service.ts`

**Existing test files present:**

- `profile-assembler.test.ts` — covers assembleProfileInputData
- `scenario-decisions.test.ts` — covers applyScenarioDecisions
- `projection-transformer.test.ts` — covers transformToProjectionInput and transformToFrontendOutput
- `profile-scenario.service.test.ts` — covers service-level chain

| ID           | Surface Name                                                | Function / Branch                                                                                                                                                          | Test Type                  | Existing Tests                     | Notes                                                        |
| ------------ | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ---------------------------------- | ------------------------------------------------------------ | --------------------------------------------- |
| TC-CHAIN-001 | Profile assembly: dual-shape income detection               | `assembleProfileInputData` — detects raw array vs `{ cards: [...] }` format                                                                                                | unit                       | `profile-assembler.test.ts`        | D-03 pitfall; both formats must produce same result          |
| TC-CHAIN-002 | Profile assembly: partial profile (incomplete steps)        | `assembleProfileInputData` — returns defaults for missing step data                                                                                                        | unit                       | `profile-assembler.test.ts`        | Never throws; defaults: retirementAge=65, province='ON'      |
| TC-CHAIN-003 | Profile assembly: spouse gating                             | `assembleProfileInputData` — `includeSpouse=false` → no spouse in output                                                                                                   | unit                       | `profile-assembler.test.ts`        | Spouse assembly conditional on about_you flag                |
| TC-CHAIN-004 | Profile assembly: income amount coercion                    | `assembleProfileInputData` — `parseFloat(string                                                                                                                            | number)` for income fields | unit                               | `profile-assembler.test.ts`                                  | Handles string-typed amounts from form inputs |
| TC-CHAIN-005 | Scenario decision: drawdown order override                  | `applyScenarioDecisions` — `drawdownOrder !== undefined` → replaces base                                                                                                   | unit                       | `scenario-decisions.test.ts`       | structuredClone prevents mutation                            |
| TC-CHAIN-006 | Scenario decision: RRSP meltdown override                   | `applyScenarioDecisions` — `rrspMeltdown !== undefined`                                                                                                                    | unit                       | `scenario-decisions.test.ts`       | Strategy flag overlay                                        |
| TC-CHAIN-007 | Scenario decision: income splitting override                | `applyScenarioDecisions` — `incomeSplitting !== undefined`                                                                                                                 | unit                       | `scenario-decisions.test.ts`       | TAX-03 via decisions                                         |
| TC-CHAIN-008 | Scenario decision: OAS clawback avoidance                   | `applyScenarioDecisions` — `oasClawbackAvoidance !== undefined`                                                                                                            | unit                       | `scenario-decisions.test.ts`       | TAX-04 via decisions                                         |
| TC-CHAIN-009 | Scenario decision: contribution overrides                   | `applyScenarioDecisions` — `contributionOverrides !== undefined`                                                                                                           | unit                       | `scenario-decisions.test.ts`       | SAV-01/D-13                                                  |
| TC-CHAIN-010 | Scenario decision: age band reductions                      | `applyScenarioDecisions` — `ageBandReductions !== undefined`                                                                                                               | unit                       | `scenario-decisions.test.ts`       | SPD-03/D-15                                                  |
| TC-CHAIN-011 | Scenario decision: inflation rate override                  | `applyScenarioDecisions` — `inflationRate !== undefined`                                                                                                                   | unit                       | `scenario-decisions.test.ts`       | Replaces base profile inflation                              |
| TC-CHAIN-012 | Scenario decision: legacy target                            | `applyScenarioDecisions` — `legacyTarget !== undefined`                                                                                                                    | unit                       | `scenario-decisions.test.ts`       | Sets final net worth target                                  |
| TC-CHAIN-013 | Scenario decision: spouse timing (only when spouse present) | `applyScenarioDecisions` — spouse fields guarded by `result.spouse !== undefined`                                                                                          | unit                       | `scenario-decisions.test.ts`       | Prevents spouse fields on single projections                 |
| TC-CHAIN-014 | Transformer: FrontendInputData → ProjectionInput            | `transformToProjectionInput(input)` — marital status mapping, account type normalisation                                                                                   | unit                       | `projection-transformer.test.ts`   | 'commonLaw'→'common_law', 'RRSP'→'rrsp'                      |
| TC-CHAIN-015 | Transformer: marital status mapping                         | `transformToProjectionInput` — 'divorced'→'single', 'widowed'→'single'                                                                                                     | unit                       | `projection-transformer.test.ts`   | Non-obvious lossy mapping                                    |
| TC-CHAIN-016 | Transformer: couple output → FrontendResultData             | `transformToFrontendOutput` for CoupleProjectionOutput                                                                                                                     | unit                       | `projection-transformer.test.ts`   | CONCERNS.md: `transformCoupleOutput` path limited validation |
| TC-CHAIN-017 | Transformer: probability of success label                   | `transformToFrontendOutput` — computes `yearsWithMoney/totalRetirementYears × 100` labeled as probability                                                                  | unit                       | `projection-transformer.test.ts`   | See REGR-003: mislabeled metric                              |
| TC-CHAIN-018 | Full chain: profile → assemble → decisions → engine         | `runSingleScenario` end-to-end in profile-scenario.service.ts                                                                                                              | integration                | `profile-scenario.service.test.ts` | structuredClone isolation; each scenario independent         |
| TC-CHAIN-019 | Transformer: single-person RRIF field mapping               | `mapSingleYearToRow` — maps rrifForcedMinimum, rrifMinimumRate, rrifConversionYear from YearlyResult to ProjectionYearRow                                                  | unit                       | `projection-transformer.test.ts`   | v1.8 RAPI-01; fields are required (0/false defaults)         |
| TC-CHAIN-020 | Transformer: couple RRIF field mapping                      | `mapCoupleYearToRow` — maps primary rrifForcedMinimum/rrifMinimumRate/rrifConversionYear and spouse spouseRrifForcedMinimum/spouseRrifMinimumRate/spouseRrifConversionYear | unit                       | `projection-transformer.test.ts`   | v1.8 RAPI-01; spouse fields optional on ProjectionYearRow    |

**Count: 20 TC-CHAIN surfaces**

---

## TC-ASSEMBLE: API Route and Middleware Integration Surfaces

Source files: `packages/api/src/routes/` (all route files), `packages/api/src/middleware/` (auth, validation, error-handler), `packages/api/src/auth/jwt.ts`

**Existing test files present:**

- `auth.routes.test.ts` — covers auth route unit tests
- `projections.routes.integration.test.ts` — covers projection routes
- `profile.routes.integration.test.ts` — covers profile routes
- `profile-scenarios.routes.integration.test.ts` — covers profile scenario routes
- `jwt.test.ts` — covers JWT generation, verification, blacklist

**Convention:** One surface per route × scenario (success / validation-fail / auth-fail). Surfaces below are grouped by route file for readability. Routes that return 501 (Google OAuth without config) are noted.

| ID              | Surface Name                                         | Function / Branch                                            | Test Type   | Existing Tests                                      | Notes                                        |
| --------------- | ---------------------------------------------------- | ------------------------------------------------------------ | ----------- | --------------------------------------------------- | -------------------------------------------- |
| TC-ASSEMBLE-001 | POST /auth/register — success                        | `authService.register` → 201 with token pair                 | integration | `auth.routes.test.ts`                               | Conflict on duplicate email → 409            |
| TC-ASSEMBLE-002 | POST /auth/register — validation fail                | Invalid email/password → 400 ValidationError                 | integration | `auth.routes.test.ts`                               | Password strength rules enforced             |
| TC-ASSEMBLE-003 | POST /auth/login — success                           | `authService.login` → 200 with token pair                    | integration | `auth.routes.test.ts`                               | Auth rate limiter applied                    |
| TC-ASSEMBLE-004 | POST /auth/login — wrong password                    | `AuthenticationError` → 401                                  | integration | `auth.routes.test.ts`                               | Constant-time bcrypt comparison              |
| TC-ASSEMBLE-005 | POST /auth/refresh — success                         | `verifyRefreshToken` → new token pair                        | integration | `auth.routes.test.ts`                               | Expired access token accepted via decode     |
| TC-ASSEMBLE-006 | POST /auth/refresh — invalid token                   | 401 AuthenticationError                                      | integration | `auth.routes.test.ts`                               | O(N) bcrypt iteration (REGR-009)             |
| TC-ASSEMBLE-007 | POST /auth/logout — success                          | Blacklists access token in Redis; revokes refresh token      | integration | `auth.routes.test.ts`                               | Redis TTL set to remaining token lifetime    |
| TC-ASSEMBLE-008 | PUT /auth/password — success                         | Change password with current password verified               | integration | `auth.routes.test.ts`                               | RequireAuth gate                             |
| TC-ASSEMBLE-009 | POST /auth/google/token — Google unconfigured        | Returns 501 when GOOGLE_CLIENT_ID absent                     | integration | `auth.routes.test.ts`                               | Condition in route handler                   |
| TC-ASSEMBLE-010 | JWT access token generation                          | `generateAccessToken(userId, email)` → signed HS256 JWT      | unit        | `jwt.test.ts`                                       | 15-min expiry from config                    |
| TC-ASSEMBLE-011 | JWT access token blacklist check                     | `isAccessTokenBlacklisted(token)` → Redis lookup             | unit        | `jwt.test.ts`                                       | Blacklist prefix `token:blacklist:`          |
| TC-ASSEMBLE-012 | JWT refresh token verification                       | `verifyRefreshToken(userId, token)` → iterates active tokens | unit        | `jwt.test.ts`                                       | O(N) bcrypt concern; REGR-009                |
| TC-ASSEMBLE-013 | GET /api/projections — success (paginated)           | `listProjections(userId, params)` → 200 paginated list       | integration | `projections.routes.integration.test.ts`            | RequireAuth; userId scoped                   |
| TC-ASSEMBLE-014 | POST /api/projections — success                      | `createProjection` with FrontendInputData → 201              | integration | `projections.routes.integration.test.ts`            | Validates name/description/inputData         |
| TC-ASSEMBLE-015 | POST /api/projections — validation fail              | Missing required fields → 400                                | integration | `projections.routes.integration.test.ts`            | Zod validation middleware                    |
| TC-ASSEMBLE-016 | GET /api/projections/:id — success                   | `getProjection(userId, id)` with result_data → 200           | integration | `projections.routes.integration.test.ts`            | Auth scope enforced                          |
| TC-ASSEMBLE-017 | GET /api/projections/:id — auth fail                 | Wrong user's projection → 403 AuthorizationError             | integration | `projections.routes.integration.test.ts`            | userId check in service                      |
| TC-ASSEMBLE-018 | POST /api/projections/:id/calculate — success        | Synchronous `runProjection()` → 200 with result              | integration | `projections.routes.integration.test.ts`            | Blocks event loop (REGR-011)                 |
| TC-ASSEMBLE-019 | DELETE /api/projections/:id — success                | Soft delete (`deleted_at`) → 204                             | integration | `projections.routes.integration.test.ts`            | Cache invalidation via pattern               |
| TC-ASSEMBLE-020 | GET /api/profile — success                           | `getProfile(userId)` → 200 ProfileData                       | integration | `profile.routes.integration.test.ts`                | NotFoundError if no profile yet              |
| TC-ASSEMBLE-021 | PATCH /api/profile/:step — success                   | `upsertProfileStep` with valid step slug → 200               | integration | `profile.routes.integration.test.ts`                | JSONB merge-patch; marks scenarios stale     |
| TC-ASSEMBLE-022 | PATCH /api/profile/:step — invalid slug              | Unknown step slug → 400                                      | integration | `profile.routes.integration.test.ts`                | Enum validation from VALID_STEPS             |
| TC-ASSEMBLE-023 | POST /api/profile/calculate — success                | Assemble → decisions → engine → store snapshot → 200         | integration | `profile.routes.integration.test.ts`                | Full pipeline surface                        |
| TC-ASSEMBLE-024 | GET /api/profile/scenarios — success                 | `listProfileScenarios(userId)` → 200 list                    | integration | `profile-scenarios.routes.integration.test.ts`      | Metadata only (no result_data)               |
| TC-ASSEMBLE-025 | POST /api/profile/scenarios — success                | Create non-base scenario → 201                               | integration | `profile-scenarios.routes.integration.test.ts`      | Name 1–100 chars                             |
| TC-ASSEMBLE-026 | POST /api/profile/scenarios/:id/run — success        | `runSingleScenario` → 200 with result                        | integration | `profile-scenarios.routes.integration.test.ts`      | Full chain execution                         |
| TC-ASSEMBLE-027 | POST /api/profile/scenarios/compare — success        | `compareProfileScenarios(userId, ids)` → 200                 | integration | `profile-scenarios.routes.integration.test.ts`      | Always includes Base as delta reference      |
| TC-ASSEMBLE-028 | POST /api/profile/scenarios/compare — too few        | 1 scenario ID → 400 (min 2)                                  | integration | `profile-scenarios.routes.integration.test.ts`      | Min 2, max 4                                 |
| TC-ASSEMBLE-029 | DELETE /api/profile/scenarios/:id — base guard       | Delete Base Scenario → 409 ConflictError                     | integration | `profile-scenarios.routes.integration.test.ts`      | is_base guard                                |
| TC-ASSEMBLE-030 | PUT /api/profile/scenarios/:id/decisions — success   | Merge-patch decisions JSONB → sets status to stale           | integration | `profile-scenarios.routes.integration.test.ts`      | ScenarioDecisionsSchema.partial() validation |
| TC-ASSEMBLE-031 | GET /api/reference/provinces — success               | Province list → 200 (no auth required)                       | integration | none — gap                                          | Public endpoint                              |
| TC-ASSEMBLE-032 | GET /api/reference/tax-brackets — ignores year param | Returns 2024 data regardless of year → 200                   | integration | none — gap                                          | See REGR-008                                 |
| TC-ASSEMBLE-033 | GET /health — liveness                               | `{ status: 'ok' }` → 200                                     | integration | none — gap                                          | Not rate-limited                             |
| TC-ASSEMBLE-034 | Error handler: AppError subclass                     | `errorHandler` → returns typed error shape                   | integration | `auth.routes.test.ts` (indirect)                    | code/message/statusCode structure            |
| TC-ASSEMBLE-035 | Error handler: ZodError formatting                   | `errorHandler` → `[{ path, message }]` details array         | integration | `projections.routes.integration.test.ts` (indirect) | Zod errors normalized                        |
| TC-ASSEMBLE-036 | requireAuth: missing Bearer token                    | `requireAuth` → 401 when no Authorization header             | integration | integration tests (indirect)                        | Middleware surface                           |
| TC-ASSEMBLE-037 | requireAuth: blacklisted token                       | `requireAuth` + Redis blacklist check → 401                  | unit        | `jwt.test.ts`                                       | Redis check before JWT verify                |

**Count: 37 TC-ASSEMBLE surfaces**

---

## TC-E2E: React Feature Components and Hooks

Source files: `packages/web/src/components/profile/`, `components/projection/`, `hooks/`, `lib/profile-utils.ts`

**Existing test files present:**

- `ProfileWizardShell.test.tsx` — unit tests for wizard shell (RHF, auto-save, API mocking)
- `profile-utils.test.ts` — unit tests for step data normalisation

**Convention:**

- Feature components → E2E test type (require full stack; unit-testing in isolation is low value)
- React hooks → integration test type (make API calls; stateful)
- `lib/profile-utils.ts` → unit test type (pure function)
- shadcn/ui primitives (18 files in `components/ui/`) → single aggregated entry

| ID                 | Surface Name                                                                    | Function / Branch                                                                                                                           | Test Type   | Existing Tests                                           | Notes                                                                            |
| ------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| TC-E2E-001         | shadcn/ui primitives (aggregated)                                               | All 18 files in `packages/web/src/components/ui/`                                                                                           | —           | —                                                        | Excluded per SURF-05: no individual entries; Radix primitives, not feature logic |
| TC-E2E-002         | ProfileWizardShell: step rendering                                              | Renders correct step component for each of 7 steps                                                                                          | E2E         | `ProfileWizardShell.test.tsx` (partial)                  | Mount-but-hide pattern for spouse step                                           |
| TC-E2E-003         | ProfileWizardShell: auto-save debounce                                          | Field change → debounced 800ms → PATCH /api/profile/:step                                                                                   | E2E         | `ProfileWizardShell.test.tsx` (partial)                  | useDebouncedCallback; API mock needed                                            |
| TC-E2E-004         | ProfileWizardShell: step navigation                                             | `navigateToStep()` calls bootstrapProfileStep before mounting new step                                                                      | E2E         | none — gap                                               | PATCH must succeed before nav                                                    |
| TC-E2E-005         | ProjectionWizardForm: 6-step wizard submit                                      | Multi-step → POST /api/projections → POST /api/projections/:id/calculate → redirect                                                         | E2E         | none — gap                                               | Create-then-calculate sequence                                                   |
| TC-E2E-006         | ProjectionWizardForm: edit mode pre-population                                  | Renders with `initialData` and existing values in form                                                                                      | E2E         | none — gap                                               | Edit path uses same form as create                                               |
| TC-E2E-007         | ScenarioList: CRUD actions                                                      | Run / Rename / Clone / Delete (with AlertDialog confirm) / Edit Decisions                                                                   | E2E         | none — gap                                               | Optimistic updates; base scenario protected                                      |
| TC-E2E-008         | ComparisonView: scenario comparison table                                       | Renders 6-metric table with delta vs Base Scenario                                                                                          | E2E         | none — gap                                               | Always fetches Base as delta reference                                           |
| TC-E2E-009         | YearByYearTab: table rendering                                                  | 47-column table with column group toggle pills                                                                                              | E2E         | none — gap                                               | Couple-aware; sparse column hiding                                               |
| TC-E2E-010         | SummaryTab: result display                                                      | Displays peak net worth, longevity, estimated taxes from FrontendResultData                                                                 | E2E         | none — gap                                               | FrontendResultData.summary fields                                                |
| TC-E2E-011         | ChartsTab: Recharts rendering                                                   | Line/bar charts of net worth, income, tax, balances                                                                                         | E2E         | none — gap                                               | Recharts; colour tokens                                                          |
| TC-E2E-012         | Login page: successful login flow                                               | Enter credentials → POST /api/auth/login → localStorage → redirect /dashboard                                                               | E2E         | none — gap                                               | localStorage token storage                                                       |
| TC-E2E-013         | Register page: successful registration                                          | Fill form → POST /api/auth/register → auto-login → redirect                                                                                 | E2E         | none — gap                                               | Password strength validation in UI                                               |
| TC-E2E-014         | Dashboard layout: auth guard redirect                                           | Missing token in localStorage → redirect to /login                                                                                          | E2E         | none — gap                                               | Client-side auth guard                                                           |
| TC-E2E-015         | profile-utils: step data normalisation (dual-shape)                             | `normaliseStepData(rawStepData)` — detects array vs `{ cards: [...] }`                                                                      | unit        | `profile-utils.test.ts`                                  | Existing test covers this                                                        |
| TC-E2E-016         | useProjections hook: data fetching                                              | `useProjections()` — GET /api/projections → returns { projections, loading, error }                                                         | integration | none — gap                                               | useState/useEffect; no SWR                                                       |
| TC-E2E-017         | useProjections hook: error state                                                | `useProjections()` on API failure → error field set, projections empty                                                                      | integration | none — gap                                               | Error handling path                                                              |
| TC-E2E-018         | ProjectionsViewPage — scenario selector loads and pre-selects first             | On page load, scenario dropdown populated and first scenario auto-selected                                                                  | E2E         | `e2e/projections/view-page.spec.ts`                      | Requirement: PROJ-01. Added Phase 30                                             |
| TC-E2E-019         | ProjectionsViewPage — pending state when result_data is null                    | When selected scenario has `result_data: null`, two "No results yet" placeholders shown                                                     | E2E         | `e2e/projections/view-page.spec.ts`                      | Requirement: PROJ-06. page.route mock. Added Phase 30                            |
| TC-E2E-020         | ProjectionsViewPage — empty CTA when no scenarios                               | When user has no scenarios, shows "No scenarios yet" heading with CTA to `/profile/scenarios`                                               | E2E         | `e2e/projections/view-page.spec.ts`                      | Requirement: PROJ-07. page.route mock. Added Phase 30                            |
| TC-E2E-021         | ProjectionsViewPage — scenario switch updates table content                     | Switching scenario in dropdown updates YearByYearTab with new projection rows                                                               | E2E         | `e2e/projections/view-page.spec.ts`                      | Requirement: PROJ-02. page.route mock. Added Phase 31                            |
| TC-E2E-022         | ProjectionsViewPage — sticky column header during horizontal scroll             | After vertical scroll, column header row remains pinned at top of scroll container                                                          | E2E         | `e2e/projections/view-page.spec.ts`                      | Requirement: PROJ-03. page.route mock + page.evaluate scroll. Added Phase 31     |
| TC-E2E-023         | ProjectionsViewPage — retirement year row highlighted                           | The first retirement year row has bg-ds-primary-container background and (Retire) badge                                                     | E2E         | `e2e/projections/view-page.spec.ts`                      | Requirement: PROJ-04. page.route mock. Added Phase 31                            |
| TC-E2E-024         | ProjectionsViewPage — net worth line chart renders with correct chart structure | Card title "Net Worth Trajectory" is visible and SVG element present after dynamic import                                                   | E2E         | `e2e/projections/view-page.spec.ts`                      | Requirement: PROJ-05. page.route mock. Added Phase 32                            |
| TC-E2E-025         | Funded indicator renders on Projections Results Page                            | SummaryTab.tsx renders `<FundedStatusIndicator>` above Peak Net Worth hero; Green/Yellow/Red banners visible above fold                     | E2E         | `e2e/funded-status.spec.ts` (new in Plan 48-04)          | FUND-09; Phase 48                                                                |
| TC-E2E-026         | Red indicator shows depletion age and remediation suggestions                   | FundedStatusIndicator.tsx Red branch renders "runs out at age {N}" + three suggestion lines when remediationPlan non-null                   | E2E         | `e2e/funded-status.spec.ts` (Phase 49 T024)              | FUND-05, FUND-06..08; Phase 49                                                   |
| TC-E2E-027         | Funded indicator absent when projection is pending or uncalculated              | SummaryTab.tsx guard — no banner rendered when `summary.fundedStatus === undefined`                                                         | E2E         | `packages/web/e2e/funded-status.spec.ts` (Phase 50 T027) | FUND-11; Phase 50                                                                |
| TC-E2E-028         | Funded indicator updates without page reload when projection is recalculated    | React state propagation — edit input → Calculate → banner state mutates in place; no framenavigated event                                   | E2E         | `packages/web/e2e/funded-status.spec.ts` (Phase 50 T028) | FUND-10; Phase 50                                                                |
| TC-E2E-REVERSE-001 | Reverse Calculator end-to-end journey                                           | Navigate to /reverse-calculator, mock prefill + solver API, verify nav link, pre-fill banner, Mode 1 result hero answer, infeasibility card | E2E         | `packages/web/e2e/reverse-calculator.spec.ts`            | REV-10, REV-14; Phase 54                                                         |

#### TC-E2E-018: ProjectionsViewPage — scenario selector loads and pre-selects first

- **Component:** `packages/web/src/app/(dashboard)/projections/view/page.tsx`
- **Behavior:** On page load, the scenario dropdown is populated with all saved scenarios and the first scenario is automatically selected
- **Test type:** E2E (Playwright)
- **Requirement:** PROJ-01
- **Added:** Phase 30

#### TC-E2E-019: ProjectionsViewPage — pending state when result_data is null

- **Component:** `packages/web/src/app/(dashboard)/projections/view/page.tsx`
- **Behavior:** When the selected scenario has `result_data: null`, both the table area and chart area show "No results yet" placeholder messages
- **Test type:** E2E (Playwright)
- **Requirement:** PROJ-06
- **Added:** Phase 30

#### TC-E2E-020: ProjectionsViewPage — empty CTA when no scenarios

- **Component:** `packages/web/src/app/(dashboard)/projections/view/page.tsx`
- **Behavior:** When the user has no saved scenarios, the page shows a "No scenarios yet" message with a CTA button linking to `/profile/scenarios`
- **Test type:** E2E (Playwright)
- **Requirement:** PROJ-07
- **Added:** Phase 30

#### TC-E2E-021: ProjectionsViewPage — scenario switch updates table content

- **Component:** `packages/web/src/app/(dashboard)/projections/view/page.tsx`
- **Behavior:** When user selects a different scenario from the dropdown, YearByYearTab re-renders with the newly selected scenario's projection rows. The table shows the correct year range and retirement row for the new scenario.
- **Test type:** E2E (Playwright)
- **Requirement:** PROJ-02
- **Added:** Phase 31

#### TC-E2E-022: ProjectionsViewPage — sticky column header during horizontal scroll

- **Component:** `packages/web/src/components/projection/results/YearByYearTab.tsx` (rendered inside view page)
- **Behavior:** After scrolling the table vertically by 500px, the group header row (`sticky top-0 z-20`) and column header row (`sticky top-[28px] z-10`) remain pinned at the top of the `overflow-y-auto` scroll container. Verified via `getBoundingClientRect().top >= 0` after programmatic scroll.
- **Test type:** E2E (Playwright)
- **Requirement:** PROJ-03
- **Added:** Phase 31

#### TC-E2E-023: ProjectionsViewPage — retirement year row highlighted

- **Component:** `packages/web/src/components/projection/results/YearByYearTab.tsx` (rendered inside view page)
- **Behavior:** The first row where `isRetired === true` (and the previous row has `isRetired === false` or is undefined) receives `bg-ds-primary-container` background class and displays a `(Retire)` badge in the Age cell.
- **Test type:** E2E (Playwright)
- **Requirement:** PROJ-04
- **Added:** Phase 31

#### TC-E2E-024: ProjectionsViewPage — net worth line chart renders with correct chart structure

- **Component:** `packages/web/src/components/projection/results/NetWorthLineChart.tsx`
- **Behavior:** When a completed scenario is loaded, the NetWorthLineChart renders inside a shadcn Card with title "Net Worth Trajectory". An `<svg>` element is present in the DOM confirming Recharts rendered the LineChart. The chart becomes visible after the `next/dynamic` bundle resolves (`ssr: false`).
- **Test type:** E2E (Playwright)
- **Requirement:** PROJ-05
- **Added:** Phase 32

**Count: 25 TC-E2E surfaces (1 aggregated shadcn entry + 23 individual + TC-E2E-REVERSE-001 Phase 54)**

---

## TC-FUTURE: investments/ Module (type:future)

Source files: `packages/calculation-engine/src/investments/` — all 5 logic files: `growth.ts`, `inflation.ts`, `returns.ts`, `glide-path.ts`, `monte-carlo.ts`

**These surfaces are present in TESTABLE-SURFACES.md but are NOT assigned to Phase 29 authoring.** Marked `type: future`.

| ID            | Surface Name                            | Function / Branch                                                                                    | Test Type     | Existing Tests      | Notes                                                   |
| ------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------- | ------------------- | ------------------------------------------------------- |
| TC-FUTURE-001 | Investment growth: end-of-year balance  | `calculateEndBalance(start, contributions, withdrawals, return)`                                     | unit — future | none                | End-of-year convention                                  |
| TC-FUTURE-002 | Investment growth: mid-year balance     | `calculateEndBalanceMidYear(...)`                                                                    | unit — future | none                | More accurate for periodic flows; not used in main loop |
| TC-FUTURE-003 | Non-registered growth with tax drag     | `calculateNonRegGrowth(...)` — dividend effective rate × 0.7 approx                                  | unit — future | none                | Approximation; see REGR-004                             |
| TC-FUTURE-004 | Portfolio growth: multi-account         | `calculatePortfolioGrowth(input)`                                                                    | unit — future | none                | Aggregates all account types                            |
| TC-FUTURE-005 | Inflation: nominal to real conversion   | `nominalToReal(value, inflationRate, years)`                                                         | unit — future | none                | Fisher equation                                         |
| TC-FUTURE-006 | Inflation: real to nominal conversion   | `realToNominal(value, inflationRate, years)`                                                         | unit — future | none                | Inverse Fisher equation                                 |
| TC-FUTURE-007 | Inflation: partial indexing             | `applyPartialIndexing(value, inflationRate, indexingRate)`                                           | unit — future | none                | DB pension 50% indexing default                         |
| TC-FUTURE-008 | Inflation: projected expenses           | `projectExpenses(baseExpenses, inflationRate, years, indexingRate?)`                                 | unit — future | none                | With optional partial indexing                          |
| TC-FUTURE-009 | Returns: risk profile parameters        | `getRiskProfileParameters(profile)` — 4 named profiles                                               | unit — future | none                | conservative/balanced/growth/aggressive                 |
| TC-FUTURE-010 | Returns: blended portfolio return       | `calculateBlendedReturn(accounts)`                                                                   | unit — future | none                | Weighted by account balances                            |
| TC-FUTURE-011 | Returns: allocation return              | `calculateAllocationReturn(equityAllocation, ...)`                                                   | unit — future | none                | equity/fixed blend                                      |
| TC-FUTURE-012 | Glide path: allocation by age           | `calculateGlidePathAllocation(currentAge, retirementAge, config?)`                                   | unit — future | none                | Linear reduction; NOT used in main loop                 |
| TC-FUTURE-013 | Glide path: projected allocation series | `projectGlidePath(startAge, endAge, retirementAge, config?)`                                         | unit — future | none                | Standalone utility                                      |
| TC-FUTURE-014 | Glide path: 120-minus-age rule          | `ageBasedAllocation(age)` — clamped 0.2–0.9                                                          | unit — future | none                | Simplified heuristic                                    |
| TC-FUTURE-015 | Monte Carlo simulation                  | `runMonteCarloSimulation(initialBalance, annualWithdrawal, years, params?)`                          | unit          | monte-carlo.test.ts | 1000 simulations; log-normal returns; PRNG seeded       |
| TC-FUTURE-016 | Monte Carlo with inflation              | `runMonteCarloWithInflation(...)`                                                                    | unit          | monte-carlo.test.ts | Withdrawal increases by inflationRate each year         |
| TC-FUTURE-017 | Monte Carlo stress test                 | `runStressTest(params)` — 4 named scenarios (market_crash, lost_decade, high_inflation, 2008_replay) | unit          | monte-carlo.test.ts | Fixed return sequences                                  |
| TC-FUTURE-018 | Monte Carlo PRNG reproducibility        | `SeededRandom` class (mulberry32 PRNG)                                                               | unit          | monte-carlo.test.ts | Deterministic with seed; important for regression       |

**Count: 18 TC-FUTURE surfaces (TC-FUTURE-015..018 promoted to unit type in Phase 55)**

---

## TC-MC: Monte Carlo Engine — New Surfaces (Phase 55)

Source files: `packages/calculation-engine/src/investments/monte-carlo.ts`

**Existing test files present:**

- `monte-carlo.test.ts` — created in Phase 55 Plan 03

| ID            | Surface Name                | Function / Branch                                          | Test Type | Existing Tests      | Notes                                                                                      |
| ------------- | --------------------------- | ---------------------------------------------------------- | --------- | ------------------- | ------------------------------------------------------------------------------------------ |
| TC-NEW-MC-001 | Percentile band computation | `computePercentileBands(scenarios, retirementAge)`         | unit      | monte-carlo.test.ts | 5 percentiles (p10/p25/p50/p75/p90) for each projection year; depleted trials contribute 0 |
| TC-NEW-MC-002 | Success rate calculation    | `runMonteCarloSimulation()` → `probabilityOfSuccess / 100` | unit      | monte-carlo.test.ts | 0–1 decimal; 1000 trials; directional range assertion (0.70–1.00 for well-funded case)     |
| TC-NEW-MC-003 | Worst-case trial extraction | `extractWorstCaseTrials(scenarios, count)`                 | unit      | monte-carlo.test.ts | Bottom N by finalBalance; pads with lowest-balance passing trials when failures < count    |

**Count: 3 TC-MC surfaces**

---

## TC-MC-API: Monte Carlo API + Worker Processor (Phase 56)

Source files:

- `packages/api/src/routes/projections.routes.ts`
- `packages/api/src/services/projection.service.ts`
- `packages/worker/src/processors/monte-carlo.processor.ts`

**Existing test files present:**

- `monte-carlo.processor.test.ts` — created in Phase 56 Plan 01
- `projection.service.mc.test.ts` — created in Phase 56 Plan 01
- `projections.monte-carlo.integration.test.ts` — created in Phase 56 Plan 01

| ID               | Surface Name                                           | Function / Branch                                                   | Test Type   | Existing Tests                              | Notes                                             |
| ---------------- | ------------------------------------------------------ | ------------------------------------------------------------------- | ----------- | ------------------------------------------- | ------------------------------------------------- |
| TC-MC-API-001    | POST /projections/:id/monte-carlo enqueues job         | Route handler → submitMonteCarloJob → monteCarloQueue.add() → 202   | integration | projections.monte-carlo.integration.test.ts | Returns { jobId, status: 'pending', progress: 0 } |
| TC-MC-API-002    | GET /projections/:id/monte-carlo/:jobId returns result | Route handler → getMonteCarloJobStatus → DB query                   | integration | projections.monte-carlo.integration.test.ts | result populated when status='completed'          |
| TC-MC-API-003    | DELETE /projections/:id/monte-carlo/:jobId cancels     | Route handler → cancelMonteCarloJob → DB status='cancelled'         | integration | projections.monte-carlo.integration.test.ts | BullMQ removal best-effort                        |
| TC-MC-WORKER-001 | Worker processor runs simulation and stores result     | processMonteCarloJob → runMonteCarloEngine → updateMonteCarloResult | unit        | monte-carlo.processor.test.ts               | Error path sets status='failed'                   |

**Count: 4 TC-MC-API surfaces**

---

## TC-MC-UI: Monte Carlo Panel E2E (Phase 57)

Source file: `packages/web/src/components/projection/results/MonteCarloPanel.tsx`
Test file: `packages/web/e2e/monte-carlo.spec.ts`

These surfaces cover the interactive behavior of the MonteCarloPanel component as a 5th tab on the Projection Results page. All tests use `page.route()` API mocks for hermetic E2E execution.

| ID            | Surface Name                          | Function / Branch                                                               | Test Type        | Existing Tests      | Notes                                                                                                                                              |
| ------------- | ------------------------------------- | ------------------------------------------------------------------------------- | ---------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-NEW-MC-005 | UI interactive during Monte Carlo run | `MonteCarloPanel` polling while run is in progress; other tabs remain clickable | E2E (Playwright) | monte-carlo.spec.ts | Mock POST+GET+DELETE via `page.route()`; assert tab interactivity; assert progress bar visible; assert "82% success rate" heading after completion |

**Count: 1 TC-MC-UI surface**

---

## TC-SHARED-SOLVER: Shared Package SolverInputSchema Validation

Source file: `packages/shared/src/validation/solver.schema.ts`
Test file: `packages/shared/src/validation/solver.schema.test.ts`

These surfaces cover the runtime validation behavior of `SolverInputSchema` — the Zod discriminated-union schema for `SolverInput`. Distinct from `TC-SOLVER-*` surfaces (calculation-engine solver functions in Phase 52).

| Surface ID          | Description                                                  | Input                                                         | Expected                                                                                      | Tolerance |
| ------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------- |
| TC-SHARED-SOLVER-01 | SolverInputSchema rejects Mode 1 missing targetRetirementAge | Mode=1 payload without targetRetirementAge                    | ZodError at path `targetRetirementAge`                                                        | exact     |
| TC-SHARED-SOLVER-02 | SolverInputSchema rejects Mode 1 missing retirementSpending  | Mode=1 payload without retirementSpending                     | ZodError at path `retirementSpending`                                                         | exact     |
| TC-SHARED-SOLVER-03 | SolverInputSchema rejects Mode 2 missing retirementAge       | Mode=2 payload without retirementAge                          | ZodError at path `retirementAge`                                                              | exact     |
| TC-SHARED-SOLVER-04 | SolverInputSchema rejects Mode 3 missing annualSavingsRate   | Mode=3 payload without annualSavingsRate                      | ZodError at path `annualSavingsRate`                                                          | exact     |
| TC-SHARED-SOLVER-05 | SolverInputSchema accepts valid Mode 1 payload               | Complete Mode=1 payload                                       | success=true, mode=required-savings, defaults applied (lifeExpectancy=90, inflationRate=0.02) | exact     |
| TC-SHARED-SOLVER-06 | SolverInputSchema accepts Mode 4 without balance fields      | Mode=4 payload omitting rrspBalance/tfsaBalance/nonRegBalance | success=true                                                                                  | exact     |
| TC-SHARED-SOLVER-07 | SolverInputSchema rejects Mode 2 missing rrspBalance         | Mode=2 payload without rrspBalance                            | ZodError (invalid_type or custom) at path `rrspBalance`                                       | exact     |
| TC-SHARED-SOLVER-08 | SolverInputSchema rejects unknown mode discriminant          | payload with mode='bogus-mode'                                | ZodError (invalid_union_discriminator)                                                        | exact     |

**Count: 8 TC-SHARED-SOLVER surfaces**

---

## TC-SOLVER: Calculation-Engine Solver (Phase 52)

These surfaces cover the behavior of `solveSingle()` in `packages/calculation-engine/src/projection/solver.ts` — the pure, callback-injected solver implementing four v1.12 Reverse Calculator goal-seek modes. Distinct from `TC-SHARED-SOLVER-*` surfaces (Zod schema validation in `@retireops/shared`).

| Surface ID    | Behavior                                                                                                             | Input                                                                                                                                                                                                   | Expected Output                                                                                                                                            | Tolerance                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| TC-SOLVER-001 | Mode 1 Required Annual Savings returns feasible solvedValue for a hand-verifiable scenario                           | `SolverInput` with mode=required-savings, currentAge=40, targetRetirementAge=65, retirementSpending=60000, rrspBalance=50000, tfsaBalance=20000, nonRegBalance=0, employmentIncome=80000, province='ON' | `SolverResult { feasible: true, mode: 'required-savings', solvedUnit: 'dollars-per-year', solvedValue ∈ [0, 100000] }`                                     | exact enums; solvedValue within bounded sanity band |
| TC-SOLVER-002 | Mode 2 Sustainable Spending has INVERTED direction (spending above solvedValue produces a red projection)            | `SolverInput` with mode=sustainable-spending, currentAge=60, retirementAge=65, rrspBalance=800000, tfsaBalance=100000, nonRegBalance=100000                                                             | `solvedValue > 20000`, feasible=true; running `runProjection` with `retirementSpending = solvedValue + 5000` yields `summary.fundedStatus.state === 'red'` | exact                                               |
| TC-SOLVER-003 | Mode 3 Earliest Retirement Age terminates in ≤8 runProjection callback invocations                                   | `SolverInput` with mode=earliest-retirement-age, currentAge=25, annualSavingsRate=25000, retirementSpending=50000, rrspBalance=10000, tfsaBalance=5000, nonRegBalance=0, employmentIncome=60000         | `vi.fn(runSingleProjection).mock.calls.length <= 8`                                                                                                        | exact                                               |
| TC-SOLVER-004 | Infeasibility detection — goal impossible at upper bound returns `feasible: false` (not boundary value)              | `SolverInput` with mode=required-savings, currentAge=64, targetRetirementAge=65, retirementSpending=500000, all balances 0, employmentIncome=50000                                                      | `{ feasible: false, solvedValue: 0, infeasibleReason: <non-empty string> }`; solvedValue !== 250000                                                        | exact                                               |
| TC-SOLVER-005 | Determinism — identical SolverInput produces identical solvedValue, feasible, convergenceIterations across two calls | Any valid `SolverInput` literal, called twice with the same runProjection                                                                                                                               | `result1.solvedValue === result2.solvedValue && result1.feasible === result2.feasible && result1.convergenceIterations === result2.convergenceIterations`  | exact                                               |

**Count: 5 TC-SOLVER surfaces**

---

## TC-SOLVER: API Solver Route Integration Tests (Phase 53)

These surfaces cover the HTTP behavior of `POST /api/solver` and `GET /api/solver/prefill` in `packages/api/src/routes/solver.routes.ts`. Distinct from `TC-SOLVER-001..005` (pure calculation-engine solver in Phase 52).

| Surface ID    | Behavior                                                                                          | Input                                                                                         | Expected Output                                                                                                                                                                                    | Tolerance                                                   |
| ------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| TC-SOLVER-006 | POST /api/solver returns 200 + SolverResult for valid Mode 1 input                                | HTTP POST with valid `SolverInput` (mode=required-savings, all required fields, Bearer token) | `{ success: true, data: { feasible: true, solvedValue > 0, projectionSummary defined, mode: 'required-savings' } }`                                                                                | exact status; solvedValue > 0                               |
| TC-SOLVER-007 | POST /api/solver returns 422 with field-level error for missing per-mode required field           | HTTP POST with mode=required-savings, all fields EXCEPT `retirementSpending`, Bearer token    | `{ success: false, error: { code: 'UNPROCESSABLE_ENTITY', details: [{ path includes 'retirementSpending' }] } }`                                                                                   | exact status + code; details array non-empty                |
| TC-SOLVER-008 | GET /api/solver/prefill returns 8 prefill fields from household profile (or null when no profile) | HTTP GET with Bearer token; (a) user has seeded household profile; (b) user has no profile    | (a) `{ success: true, data: { province, currentAge, rrspBalance, tfsaBalance, nonRegBalance, employmentIncome, cppStartAge, oasStartAge } }` — exactly 8 keys; (b) `{ success: true, data: null }` | exact field count; exact field names; status 200 both cases |

**Count: 3 TC-SOLVER API integration surfaces (Phase 53)**

- **File:** `packages/api/src/routes/solver.routes.integration.test.ts`
- **Command:** `pnpm --filter @retireops/api test:integration`
- **Registered:** Phase 53

---

## TC-MC-UI: Monte Carlo Panel E2E (Phase 57-58)

Source file: `packages/web/src/components/projection/results/MonteCarloPanel.tsx`
Test file: `packages/web/e2e/monte-carlo.spec.ts`, `packages/web/e2e/monte-carlo-fan.spec.ts`

These surfaces cover the interactive behavior of the MonteCarloPanel component as a 5th tab on the Projection Results page. All tests use `page.route()` API mocks for hermetic E2E execution.

| ID            | Surface Name                                     | Function / Branch                                                                                    | Test Type        | Existing Tests          | Notes                                                                                                                                              |
| ------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ---------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-NEW-MC-004 | Fan chart renders 5 bands without overlap errors | `MonteCarloFanChart` with `PercentileBandResultContract[]` data; 5 Area+Line elements present in DOM | E2E (Playwright) | monte-carlo-fan.spec.ts | Mock completed MC job result via `page.route()`; assert `svg` present; assert 5 `path` elements in chart                                           |
| TC-NEW-MC-005 | UI interactive during Monte Carlo run            | `MonteCarloPanel` polling while run is in progress; other tabs remain clickable                      | E2E (Playwright) | monte-carlo.spec.ts     | Mock POST+GET+DELETE via `page.route()`; assert tab interactivity; assert progress bar visible; assert "82% success rate" heading after completion |

**Count: 2 TC-MC-UI surfaces**

---

## REGR: Regression Baselines (CONCERNS.md)

Each regression surface documents the CURRENT broken/wrong behavior as the baseline. The purpose is to detect if behavior silently changes — not to fix it. Sources: CONCERNS.md Critical + Technical Debt + Missing Implementations + Security sections.

| ID           | Surface Name                                                     | Current Broken Behavior (Baseline)                                                                                                   | Files                                                                                    | Test Type  | Existing Tests                             | Notes                                                                                                          |
| ------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ---------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| REGR-001     | REGR-001: Monte Carlo worker requires regression coverage        | Worker receives monte-carlo job and runs the Monte Carlo engine, but async queue behavior still needs integration coverage           | `packages/worker/src/processors/monte-carlo.processor.ts`                                | regression | `monte-carlo.processor.test.ts`            | BullMQ wiring and DB status transitions should be covered in beta hardening                                    |
| REGR-002     | REGR-002: Scenario comparison worker is unsupported              | Worker receives scenario-comparison job and fails explicitly; synchronous profile-scenario comparison API is the supported path      | `packages/worker/src/worker.ts:35`                                                       | regression | none                                       | Avoids silently succeeding without doing work                                                                  |
| REGR-003     | REGR-003: Probability of success mislabeled                      | `probabilityOfSuccess = (yearsWithMoney / totalRetirementYears) × 100` — deterministic depletion ratio, NOT Monte Carlo probability  | `packages/api/src/services/projection-transformer.ts:366–383`                            | regression | `projection-transformer.test.ts` (partial) | Methodologically misleading; rename to "Portfolio Longevity Score" is the fix                                  |
| REGR-004     | REGR-004: ACB tracking proportional approximation                | Non-registered ACB updated as `nonRegACB × (newBalance / oldBalance)` on withdrawal — not lot-tracking                               | `packages/calculation-engine/src/projection/multi-year.ts:169–172`                       | regression | none                                       | `_currentACB` prefixed `_` because never used in tax step                                                      |
| REGR-005     | REGR-005: GIS marital status hardcoded single for spouses        | `yearly-calculator.ts` passes `maritalStatus: 'single'` to `calculateGovernmentBenefits` for spouses — married GIS rates not applied | `packages/calculation-engine/src/projection/yearly-calculator.ts:214`                    | regression | none                                       | Affects all couple projections; GIS amounts wrong for married low-income couples                               |
| REGR-006     | REGR-006: Migration system unversioned                           | `db:migrate` uses `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ADD COLUMN IF NOT EXISTS` — no versioning, no rollback                 | `packages/api/src/db/migrate.ts`                                                         | regression | none                                       | Schema changes idempotent but irreversible                                                                     |
| REGR-007     | REGR-007: JSONB fields typed as unknown                          | `input_data`, `result_data`, `modifications` JSONB columns typed `unknown`; written via `as never`                                   | `packages/api/src/services/projection.service.ts:24–25`, `scenario.service.ts:31–32`     | regression | none                                       | No type safety on critical data; deserialization bugs only surface at runtime                                  |
| REGR-008     | REGR-008: Reference data ignores year param                      | `reference.service.ts` always returns 2024 data regardless of requested year                                                         | `packages/api/src/services/reference.service.ts:62–68`                                   | regression | none                                       | `/reference/tax-brackets/2025` returns 2024 data silently                                                      |
| REGR-009     | REGR-009: Historical year support missing (tax + benefits)       | `getFederalTaxBrackets`, `estimateCPPAt65` ignore year param; always return 2024 constants                                           | `packages/calculation-engine/src/withdrawals/optimizer.ts:25,130`, `benefits/cpp.ts:141` | regression | none                                       | 30-year projections apply 2024 brackets indefinitely                                                           |
| REGR-010     | REGR-010: 2025 provincial tax tables incomplete                  | QC/SK/MB/NS/NB/PE/NL use 2024 tables when 2025 requested                                                                             | `packages/shared/src/constants/tax-tables.ts:318–324`                                    | regression | none                                       | 7 provinces return stale brackets for 2025+                                                                    |
| REGR-011     | REGR-011: Synchronous projection blocks event loop               | `POST /api/projections/:id/calculate` runs full `runProjection()` synchronously in HTTP handler                                      | `packages/api/src/services/projection.service.ts:191–230`                                | regression | none                                       | 40-year couple projection can take seconds; blocks Node.js event loop                                          |
| REGR-012     | REGR-012: Tokens stored in localStorage (XSS)                    | Access + refresh tokens in `localStorage` — HttpOnly cookie would be safer                                                           | `packages/web/src/app/(auth)/login/page.tsx:114–115`                                     | regression | none                                       | Security vulnerability; current behavior baseline                                                              |
| REGR-013     | REGR-013: Logout does not call server-side logout                | Dashboard layout sign-out clears localStorage, does NOT call `POST /api/auth/logout`                                                 | `packages/web/src/app/(dashboard)/layout.tsx:134–137`                                    | regression | none                                       | Access token valid up to 15min after client logout                                                             |
| REGR-014     | REGR-014: /metrics endpoint unauthenticated                      | `GET /metrics` has no requireAuth; publicly accessible                                                                               | `packages/api/src/app.ts`                                                                | regression | none                                       | Exposes internal operational metrics                                                                           |
| REGR-015     | REGR-015: Refresh token O(N) bcrypt verification                 | `verifyRefreshToken` fetches all active tokens for user; bcrypt-compares each sequentially                                           | `packages/api/src/auth/jwt.ts:121–138`                                                   | regression | `jwt.test.ts`                              | Performance degrades with multiple sessions                                                                    |
| REGR-016     | REGR-016: JWT secret defaults to weak dev value                  | `JWT_SECRET` defaults to `'development-secret-key-change-in-production-32chars'`                                                     | `packages/api/src/config/index.ts:29`                                                    | regression | none                                       | Misconfigured prod deployment uses known secret                                                                |
| REGR-017     | REGR-017: FHSA has no dedicated implementation                   | `fhsa` account type exists in enum + withdrawal strategy but no `fhsa.ts` engine module                                              | `packages/calculation-engine/src/accounts/index.ts:60`                                   | regression | none                                       | FHSA accounts treated as generic accounts                                                                      |
| REGR-018     | REGR-018: Email verification not implemented                     | `users.email_verified` column present; no verify-email endpoint; all password users `emailVerified: false` permanently               | `packages/api/src/services/auth.service.ts:89`                                           | regression | none                                       | Anyone can register with any email                                                                             |
| REGR-019     | REGR-019: next-auth beta dependency unused                       | `next-auth@^5.0.0-beta.4` in `packages/web/package.json`; never imported                                                             | `packages/web/package.json`                                                              | regression | none                                       | Dead beta dependency; bundle weight                                                                            |
| REGR-020     | REGR-020: investments/ module entirely untested                  | `monte-carlo.ts`, `growth.ts`, `inflation.ts`, `glide-path.ts`, `returns.ts` — zero test files                                       | `packages/calculation-engine/src/investments/`                                           | regression | monte-carlo.test.ts                        | Partially resolved in Phase 55 — monte-carlo.ts now tested; growth/inflation/glide-path/returns still untested |
| REGR-021     | REGR-021: Core projection engine untested directly               | `yearly-calculator.ts` and `multi-year.ts` only tested indirectly via integration-style projection tests                             | `packages/calculation-engine/src/projection/multi-year.ts`, `yearly-calculator.ts`       | regression | none                                       | Year-level edge cases may not be caught                                                                        |
| ~~REGR-022~~ | ~~REGR-022: GIS $51,840 threshold hardcoded literal~~ [RESOLVED] | Resolved in feature 4.1 — `married-spouse-not-OAS` threshold now read from `BENEFIT_AMOUNTS_2024.gis.incomeThresholdMarriedOneOAS`   | `packages/calculation-engine/src/benefits/gis.ts`                                        | regression | `gis.test.ts`                              | Resolved: sourced from shared constants; updating CRA threshold now only requires a change to `rates.ts`.      |

**Count: 21 active + 1 resolved (REGR-022) REGR surfaces**

---

## Appendix: Surface Granularity Rules

These rules were applied when enumerating surfaces above. Phase 29 authors should apply the same rules when deciding whether a new behavior warrants its own surface row.

1. **Named rule = one surface.** "CPP early-start penalty" is one surface regardless of the number of `if`-statements implementing it.
2. **Skip barrels.** Files named `index.ts` that only re-export are not surfaces. The barrel at `accounts/index.ts` is not a surface; `accounts/rrif.ts` functions are.
3. **API route surfaces = route × scenario.** `POST /auth/login` produces 3 surfaces: success, validation-fail, auth-fail. A route with only success + auth-fail (no request body) produces 2 surfaces.
4. **investments/ module = type:future.** These surfaces appear in the document but are visually marked and excluded from Phase 29 authoring scope.
5. **Regression surfaces document current broken behavior.** Do NOT write what the fix should be — write what the system currently does wrong. Phase 29 will specify what SHOULD happen.

---

## Appendix: Open Questions for Phase 29

The following unresolved questions were identified during Phase 28 research. Phase 29 must decide how to handle them before authoring scenarios:

- **Legacy /api/scenarios routes reachability:** The older `/api/scenarios/*` route file may be registered alongside the newer `/api/profile/scenarios/*` routes. If both are active, the older routes represent additional TC-ASSEMBLE surfaces not enumerated here. Phase 29 should confirm which routes are actually mounted in `app.ts` and add rows if needed.
- **projection-calculation queue population:** The `projection-calculation` BullMQ queue exists and the worker processor is implemented, but it is unclear whether the API ever populates this queue (projections appear to run synchronously inline per REGR-011). Phase 29 should confirm whether any TC-ASSEMBLE surface triggers the worker queue or whether it is dead code.
- **TC-ASSEMBLE worker processor inclusion:** `packages/worker/src/worker.ts` contains the BullMQ processor logic. It is unclear whether the worker processor surfaces (job receipt, progress events, completion) should be enumerated as TC-ASSEMBLE integration surfaces or deferred to a future phase alongside Monte Carlo work. Phase 29 should decide the boundary.

---

## TC-HIST: Historical Backtesting Surfaces (Phases 59–62)

Source files:

- `packages/shared/src/constants/historical-returns.ts` (Phase 59)
- `packages/shared/src/types/historical-backtest.ts` (Phase 59)
- `packages/calculation-engine/src/investments/historical-backtest.ts` (Phase 60)
- `packages/api/src/routes/projections.routes.ts` (Phase 61)
- `packages/web/src/components/HistoricalBacktestChart.tsx` (Phase 62)

**Existing test files present:**

- `packages/shared/src/constants/historical-returns.test.ts` — created in Phase 59 Plan 01
- `packages/shared/src/types/historical-backtest.test.ts` — created in Phase 59 Plan 01

| ID          | Surface Name                                                     | Function / Branch                                                                                                                            | Test Type   | Existing Tests               | Notes                                                                                |
| ----------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------- | ------------------------------------------------------------------------------------ |
| TC-HIST-001 | Historical return dataset: completeness and year coverage        | `BLENDED_HISTORICAL_RETURNS_DATASET` — 36 records, years 1990–2025, all `returnRate` in [-1.0, 2.0], `longRunAverage` equals arithmetic mean | unit        | `historical-returns.test.ts` | Phase 59. HIST-01. Validates dataset shape, not numeric accuracy of individual rates |
| TC-HIST-002 | Projection with variable annual return sequence injection        | `runHistoricalBacktest()` — applies per-year `returnRate` from dataset instead of fixed rate                                                 | unit        | none — Phase 60              | Phase 60. HIST-03                                                                    |
| TC-HIST-003 | Preset scenario 2000 dot-com — funded/depletion outcome          | `runHistoricalBacktest(PRESET_SCENARIOS[0], input)` → `BacktestRun.funded` and `depletionYear`                                               | unit        | none — Phase 60              | Phase 60. HIST-03. Uses retired-2000 preset                                          |
| TC-HIST-004 | Preset scenario 2008 financial crisis — funded/depletion outcome | `runHistoricalBacktest(PRESET_SCENARIOS[1], input)` → funded/depletionYear                                                                   | unit        | none — Phase 60              | Phase 60. HIST-03                                                                    |
| TC-HIST-005 | Preset scenario 2020 COVID — funded/depletion outcome            | `runHistoricalBacktest(PRESET_SCENARIOS[2], input)` → funded/depletionYear                                                                   | unit        | none — Phase 60              | Phase 60. HIST-03                                                                    |
| TC-HIST-006 | Sequence extension with long-run average for short history       | Years beyond 2025 use `BLENDED_HISTORICAL_RETURNS_DATASET.longRunAverage`; `isEstimated: true`                                               | unit        | none — Phase 60              | Phase 60. HIST-04                                                                    |
| TC-HIST-007 | Determinism: identical inputs produce identical results          | `runAllPresetBacktests(input)` called twice returns byte-for-byte identical output                                                           | unit        | none — Phase 60              | Phase 60. HIST-05. No PRNG                                                           |
| TC-HIST-008 | Year-by-year backtest record: return, balance, withdrawal        | `BacktestRun.yearRecords[i]` fields: `calendarYear`, `returnRateApplied`, `portfolioBalance`, `totalWithdrawals`, `totalTaxesPaid`           | unit        | none — Phase 60              | Phase 60. HIST-03                                                                    |
| TC-HIST-009 | Chart overlay: baseline + 3 scenario lines rendered              | `HistoricalBacktestChart` renders 4 LineChart series; depleted line terminates at $0                                                         | E2E         | none — Phase 62              | Phase 62. HIST-08                                                                    |
| TC-HIST-010 | Stale result indicator after plan input change                   | After projection input change, backtest panel shows stale banner until recomputed                                                            | integration | none — Phase 62              | Phase 62. HIST-10                                                                    |

**Count: 10 TC-HIST surfaces**
