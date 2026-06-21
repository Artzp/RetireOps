# 18 — Canadian Government Pensions: 2026 Parameter Values

## Source Provenance

- **Research date:** 2026-05-10
- **Original compass artifact:** `compass_artifact_wf-01319666-9727-462e-8606-75e6f0c254a9_text_markdown.md` (460 lines; integrated and deleted as part of v4.5 Phase 17).
- **Primary sources cited in the original artifact:**
  - Canada.ca / Service Canada — Maximum Benefit Amounts and Related Figures (CPP 2026), published 2025-12-30 (Q1) and 2026-03-31 (Q2)
  - CRA — 2026 CPP / EI contribution rates and amounts
  - Retraite Québec — 2026 QPP parameters; Quebec Information Bulletin 2025-8 (Nov 25 2025) for the QPP base-rate cut
  - FP Canada / Institute of Financial Planning — 2026 Projection Assumption Guidelines (released April 16, 2026; effective April 30, 2026)
  - Office of the Chief Actuary — 32nd Actuarial Report on the CPP (Dec 31 2024)

## Integration Strategy

This file holds **dated 2026 parameter values only**. The formulas, rules, eligibility, drop-outs, age adjustment mechanics, and worked calculation examples for CPP/QPP/OAS/GIS live in [`05-government-benefits.md`](./05-government-benefits.md) (the rules-layer doc, which retains its 2024 example tables as historical rules-teaching context). Engine code consuming a 2026 parameter SHOULD cite this file at the relevant anchor (see `README.md` → "How to cite from engine code"). Engine code consuming a rule or formula SHOULD cite `05-government-benefits.md`.

This hybrid integration was decided 2026-05-10 (Phase 17 CONTEXT, D-01).

## How to cite from engine code

```ts
// CPP 2026 YMPE per docs/source-of-truth/18-pensions-2026.md#2026-cpp-ympe
const CPP_YMPE_2026 = 74_600;
```

(See `README.md` for the full citation convention.)

---

## 1. Canada Pension Plan (CPP) — 2026 Parameter Values

<a id="2026-cpp-ybe"></a>

### 2026 CPP Year's Basic Exemption (YBE)

| Value         | Source                           |
| ------------- | -------------------------------- |
| **$3,500.00** | Canada.ca Rate Card Q1 & Q2 2026 |

<a id="2026-cpp-ympe"></a>

### 2026 CPP Year's Maximum Pensionable Earnings (YMPE)

| Value          | Source          |
| -------------- | --------------- |
| **$74,600.00** | Canada.ca / CRA |

<a id="2026-cpp-yampe"></a>

### 2026 CPP Year's Additional Maximum Pensionable Earnings (YAMPE)

| Value          | Source          |
| -------------- | --------------- |
| **$85,000.00** | Canada.ca / CRA |

<a id="2026-cpp-employee-rate"></a>

### 2026 CPP Employee/Employer Base + 1st Additional Rate

| Value     | Source |
| --------- | ------ |
| **5.95%** | CRA    |

<a id="2026-cpp2-rate"></a>

### 2026 CPP2 Employee/Employer 2nd Additional Rate

| Value     | Source |
| --------- | ------ |
| **4.00%** | CRA    |

<a id="2026-cpp-self-employed-rate"></a>

### 2026 CPP Self-Employed Base + 1st Additional Rate

| Value      | Source |
| ---------- | ------ |
| **11.90%** | CRA    |

<a id="2026-cpp2-self-employed-rate"></a>

### 2026 CPP2 Self-Employed 2nd Additional Rate

| Value     | Source |
| --------- | ------ |
| **8.00%** | CRA    |

<a id="2026-cpp-max-employee-contribution"></a>

### 2026 CPP Maximum Employee/Employer Base + CPP1 Contribution

| Value         | Source                   |
| ------------- | ------------------------ |
| **$4,230.45** | (74,600 − 3,500) × 5.95% |

<a id="2026-cpp2-max-employee-contribution"></a>

### 2026 CPP2 Maximum Employee/Employer 2nd Additional Contribution

| Value       | Source                    |
| ----------- | ------------------------- |
| **$416.00** | (85,000 − 74,600) × 4.00% |

<a id="2026-cpp-max-self-employed-contribution"></a>

### 2026 CPP Maximum Self-Employed Base + CPP1 Contribution

| Value         | Source          |
| ------------- | --------------- |
| **$8,460.90** | Canada.ca / CRA |

<a id="2026-cpp2-max-self-employed-contribution"></a>

### 2026 CPP2 Maximum Self-Employed 2nd Additional Contribution

| Value       | Source          |
| ----------- | --------------- |
| **$832.00** | Canada.ca / CRA |

<a id="2026-cpp-total-max-employee-contribution"></a>

### 2026 CPP Total Maximum Employee Contribution (CPP + CPP2)

| Value         | Source              |
| ------------- | ------------------- |
| **$4,646.45** | $4,230.45 + $416.00 |

<a id="2026-cpp-max-retirement-pension"></a>

### 2026 CPP Maximum New Retirement Pension at Age 65 (January 2026)

| Value               | Source              |
| ------------------- | ------------------- |
| **$1,507.65/month** | Canada.ca Rate Card |

<a id="2026-cpp-prb-max"></a>

### 2026 CPP Post-Retirement Benefit (PRB) at Age 65 — Maximum

| Value            | Source    |
| ---------------- | --------- |
| **$54.69/month** | Canada.ca |

<a id="2026-cpp-disability-max"></a>

### 2026 CPP Disability Pension — Maximum

| Value                                                             | Source    |
| ----------------------------------------------------------------- | --------- |
| **$1,741.20/month** ($610.46 flat + $1,130.74 earnings component) | Canada.ca |

<a id="2026-cpp-post-retirement-disability"></a>

### 2026 CPP Post-Retirement Disability Benefit

| Value             | Source    |
| ----------------- | --------- |
| **$610.46/month** | Canada.ca |

<a id="2026-cpp-survivor-under65"></a>

### 2026 CPP Survivor's Pension — Under 65 (Maximum)

| Value                                                         | Source    |
| ------------------------------------------------------------- | --------- |
| **$803.54/month** ($238.17 flat + $565.37 earnings component) | Canada.ca |

<a id="2026-cpp-survivor-65plus"></a>

### 2026 CPP Survivor's Pension — Age 65+ (Maximum)

| Value             | Source    |
| ----------------- | --------- |
| **$904.59/month** | Canada.ca |

<a id="2026-cpp-childrens-benefit"></a>

### 2026 CPP Children's Benefit — Full-Time (Under 18 or Full-Time Student 18–25)

| Value             | Source    |
| ----------------- | --------- |
| **$307.81/month** | Canada.ca |

<a id="2026-cpp-childrens-benefit-pt"></a>

### 2026 CPP Children's Benefit — Part-Time Student (18–25)

| Value             | Source    |
| ----------------- | --------- |
| **$153.91/month** | Canada.ca |

<a id="2026-cpp-death-benefit"></a>

### 2026 CPP Death Benefit

| Value                    | Source    |
| ------------------------ | --------- |
| **$2,500.00** (lump sum) | Canada.ca |

<a id="2026-cpp-combined-survivor-retirement-cap"></a>

### 2026 CPP Combined Survivor + Retirement Cap (at Age 65)

| Value               | Source    |
| ------------------- | --------- |
| **$1,531.56/month** | Canada.ca |

<a id="2026-cpp-combined-survivor-disability-cap"></a>

### 2026 CPP Combined Survivor + Disability Cap

| Value               | Source    |
| ------------------- | --------- |
| **$1,756.14/month** | Canada.ca |

<a id="2026-cpp-indexation"></a>

### 2026 CPP Annual Indexation of Benefits in Pay (January 2026)

| Value     | Source    |
| --------- | --------- |
| **+2.0%** | Canada.ca |

### Notes on 2026 CPP Maxima

The maxima for **new** retirement pensions increase month-by-month through 2026 because the enhancement is still accruing — the values above are for benefits beginning in January 2026.

---

## 2. Quebec Pension Plan (QPP) — 2026 Parameter Values

<a id="2026-qpp-ybe"></a>

### 2026 QPP Basic Exemption (YBE)

| Value         | Source          |
| ------------- | --------------- |
| **$3,500.00** | Retraite Québec |

<a id="2026-qpp-mpe"></a>

### 2026 QPP Maximum Pensionable Earnings (MPE)

| Value          | Source          |
| -------------- | --------------- |
| **$74,600.00** | Retraite Québec |

<a id="2026-qpp-supplementary-mpe"></a>

### 2026 QPP Supplementary Maximum Pensionable Earnings (QPP YAMPE)

| Value                          | Source          |
| ------------------------------ | --------------- |
| **$85,000.00** (= 114% of MPE) | Retraite Québec |

<a id="2026-qpp-base-rate-emp"></a>

### 2026 QPP Base Contribution Rate — Employee/Employer Each

| Value                                  | Source                           |
| -------------------------------------- | -------------------------------- |
| **5.30%** (reduced from 5.40% in 2025) | Retraite Québec; Bulletin 2025-8 |

<a id="2026-qpp-first-additional-rate-emp"></a>

### 2026 QPP First Additional Rate — Employee/Employer Each

| Value     | Source          |
| --------- | --------------- |
| **1.00%** | Retraite Québec |

<a id="2026-qpp-second-additional-rate-emp"></a>

### 2026 QPP Second Additional ("Supplementary Plan") Rate — Employee/Employer Each (on $74,600–$85,000)

| Value     | Source          |
| --------- | --------------- |
| **4.00%** | Retraite Québec |

<a id="2026-qpp-base-rate-self-employed"></a>

### 2026 QPP Base + 1st Additional Rate — Self-Employed

| Value                                          | Source          |
| ---------------------------------------------- | --------------- |
| **12.6%** (10.6% base + 2.0% first additional) | Retraite Québec |

<a id="2026-qpp-second-additional-rate-self-employed"></a>

### 2026 QPP Second Additional Rate — Self-Employed

| Value     | Source          |
| --------- | --------------- |
| **8.00%** | Retraite Québec |

<a id="2026-qpp-max-employee-first-tier-contribution"></a>

### 2026 QPP Maximum Employee First-Tier Contribution (Base + 1st Additional)

| Value                                                     | Source          |
| --------------------------------------------------------- | --------------- |
| **$4,479.30** ($3,768.30 base + $711.00 first additional) | Retraite Québec |

<a id="2026-qpp-max-employee-second-additional-contribution"></a>

### 2026 QPP Maximum Employee Second Additional Contribution

| Value       | Source          |
| ----------- | --------------- |
| **$416.00** | Retraite Québec |

<a id="2026-qpp-max-self-employed-first-tier-contribution"></a>

### 2026 QPP Maximum Self-Employed First-Tier Contribution

| Value                                                       | Source          |
| ----------------------------------------------------------- | --------------- |
| **$8,958.60** ($7,536.60 base + $1,422.00 first additional) | Retraite Québec |

<a id="2026-qpp-max-self-employed-second-additional-contribution"></a>

### 2026 QPP Maximum Self-Employed Second Additional Contribution

| Value       | Source          |
| ----------- | --------------- |
| **$832.00** | Retraite Québec |

<a id="2026-qpp-max-retirement-pension"></a>

### 2026 QPP Maximum Retirement Pension at Age 65 (January 2026)

| Value                                              | Source          |
| -------------------------------------------------- | --------------- |
| **$1,507.65/month** ($1,441.25 base + enhancement) | Retraite Québec |

<a id="2026-qpp-max-pension-age60"></a>

### 2026 QPP Maximum Retirement Pension at Age 60 (64% Factor)

| Value             | Source          |
| ----------------- | --------------- |
| **$964.90/month** | Retraite Québec |

<a id="2026-qpp-max-pension-age72"></a>

### 2026 QPP Maximum Retirement Pension at Age 72 (158.8% Factor)

| Value               | Source          |
| ------------------- | --------------- |
| **$2,394.15/month** | Retraite Québec |

<a id="2026-qpp-disability-18to59"></a>

### 2026 QPP Disability Pension (Ages 18–59)

| Value               | Source          |
| ------------------- | --------------- |
| **$1,737.67/month** | Retraite Québec |

<a id="2026-qpp-disability-supplement"></a>

### 2026 QPP Additional Disability Amount (Ages 60–65, and for Retirement Recipients)

| Value             | Source          |
| ----------------- | --------------- |
| **$610.43/month** | Retraite Québec |

<a id="2026-qpp-orphan-benefit"></a>

### 2026 QPP Orphan's Pension (per Child)

| Value             | Source          |
| ----------------- | --------------- |
| **$307.81/month** | Retraite Québec |

<a id="2026-qpp-survivor-under45-no-deps"></a>

### 2026 QPP Surviving Spouse — Under 45, No Disability, No Dependent Children

| Value             | Source          |
| ----------------- | --------------- |
| **$719.50/month** | Retraite Québec |

<a id="2026-qpp-survivor-under45-with-deps"></a>

### 2026 QPP Surviving Spouse — Under 45, No Disability, With Dependents

| Value               | Source          |
| ------------------- | --------------- |
| **$1,129.95/month** | Retraite Québec |

<a id="2026-qpp-survivor-45to64"></a>

### 2026 QPP Surviving Spouse — Ages 45–64 (or Under 45 Disabled)

| Value               | Source          |
| ------------------- | --------------- |
| **$1,173.58/month** | Retraite Québec |

<a id="2026-qpp-survivor-65plus"></a>

### 2026 QPP Surviving Spouse — Age 65+

| Value             | Source          |
| ----------------- | --------------- |
| **$881.48/month** | Retraite Québec |

<a id="2026-qpp-death-benefit"></a>

### 2026 QPP Death Benefit

| Value                    | Source          |
| ------------------------ | --------------- |
| **$2,500.00** (lump sum) | Retraite Québec |

<a id="2026-qpp-indexation"></a>

### 2026 QPP Indexation of Benefits in Pay (January 1, 2026)

| Value     | Source          |
| --------- | --------------- |
| **+2.0%** | Retraite Québec |

### 2026 QPP Base-Rate Cut (One-Year Measure)

Quebec's November 2025 fiscal update temporarily reduced the QPP **base** contribution rate from 10.80% to 10.60% — a 0.20-pt cut (0.10 pt on each of employee and employer) — **for the year 2026 only**. The reduction was enacted as an amendment to s.44.1 of the QPP Act. Absent further legislation, the section's standard formula-based rule resumes for 2027. (Source: Quebec Information Bulletin 2025-8, Nov 25 2025.)

### CNESST Drop-Out (New for 2026)

Effective January 1, 2026, months in which the contributor received a reduced CNESST income-replacement indemnity for at least 24 consecutive months are excluded from the QPP retirement pension calculation. Retroactive application is planned (Retraite Québec, 2025–2026 Budget — Amendments to the QPP). This is the first new QPP drop-out provision since the child-rearing provision.

---

## 3. Old Age Security (OAS) — 2026 Parameter Values

<a id="2026-oas-q1-amount-65to74"></a>

### 2026 OAS Maximum Monthly Amount — Q1 (Jan–Mar 2026), Ages 65–74

| Value             | Source                                             |
| ----------------- | -------------------------------------------------- |
| **$742.31/month** | Canada.ca Rate Card Q1 2026 (published 2025-12-30) |

<a id="2026-oas-q1-amount-75plus"></a>

### 2026 OAS Maximum Monthly Amount — Q1 (Jan–Mar 2026), Ages 75+

| Value             | Source                                             |
| ----------------- | -------------------------------------------------- |
| **$816.54/month** | Canada.ca Rate Card Q1 2026 (published 2025-12-30) |

<a id="2026-oas-q2-amount-65to74"></a>

### 2026 OAS Maximum Monthly Amount — Q2 (Apr–Jun 2026), Ages 65–74

| Value             | Source                                             |
| ----------------- | -------------------------------------------------- |
| **$743.05/month** | Canada.ca Rate Card Q2 2026 (published 2026-03-31) |

<a id="2026-oas-q2-amount-75plus"></a>

### 2026 OAS Maximum Monthly Amount — Q2 (Apr–Jun 2026), Ages 75+

| Value             | Source                                             |
| ----------------- | -------------------------------------------------- |
| **$817.36/month** | Canada.ca Rate Card Q2 2026 (published 2026-03-31) |

<a id="2026-oas-q1-indexation"></a>

### 2026 OAS Quarterly Indexation — Q1 vs. Prior Quarter

| Value     | Source    |
| --------- | --------- |
| **+0.3%** | Canada.ca |

<a id="2026-oas-q2-indexation"></a>

### 2026 OAS Quarterly Indexation — Q2 vs. Q1

| Value     | Source    |
| --------- | --------- |
| **+0.1%** | Canada.ca |

<a id="2026-oas-clawback-threshold"></a>

### 2026 OAS Clawback (Recovery Tax) Income Threshold — 2026 Income Year

| Value       | Source                        |
| ----------- | ----------------------------- |
| **$95,323** | Canada.ca Q2 2026 publication |

<a id="2026-oas-full-clawback-65to74"></a>

### 2026 OAS Full-Clawback Income Ceiling — Ages 65–74 (Q2 publication)

| Value        | Source                        |
| ------------ | ----------------------------- |
| **$154,753** | Canada.ca Q2 2026 publication |

<a id="2026-oas-full-clawback-75plus"></a>

### 2026 OAS Full-Clawback Income Ceiling — Ages 75+ (Q2 publication)

| Value        | Source                        |
| ------------ | ----------------------------- |
| **$160,696** | Canada.ca Q2 2026 publication |

<a id="2026-oas-deferral-rate"></a>

### 2026 OAS Deferral Rate

| Value                                             | Source    |
| ------------------------------------------------- | --------- |
| **0.6%/month**, max 60 months = **36% at age 70** | Canada.ca |

<a id="2026-oas-75plus-topup"></a>

### 2026 OAS Permanent 10% Top-Up for Ages 75+

| Value                                          | Source    |
| ---------------------------------------------- | --------- |
| **+10%** (applied permanently since July 2022) | Canada.ca |

### 2025-Income Clawback (for OAS Paid Jul 2026 – Jun 2027)

| Threshold                         | Value    |
| --------------------------------- | -------- |
| Lower threshold (clawback begins) | $93,454  |
| Full clawback, ages 65–74         | $152,062 |
| Full clawback, ages 75+           | $157,923 |

### 2024-Income Clawback (for OAS Paid Jul 2025 – Jun 2026)

| Threshold                         | Value    |
| --------------------------------- | -------- |
| Lower threshold (clawback begins) | $90,997  |
| Full clawback, ages 65–74         | $148,451 |
| Full clawback, ages 75+           | $154,196 |

---

## 4. Guaranteed Income Supplement (GIS) — 2026 Parameter Values

<a id="2026-gis-q2-single-max"></a>

### 2026 GIS Maximum Monthly — Q2 (Apr–Jun 2026), Single / Widowed / Divorced

| Value               | Source                      |
| ------------------- | --------------------------- |
| **$1,109.85/month** | Canada.ca Rate Card Q2 2026 |

<a id="2026-gis-q2-single-cutoff"></a>

### 2026 GIS Annual Income Cutoff — Q2, Single / Widowed / Divorced

| Value       | Source                      |
| ----------- | --------------------------- |
| **$22,512** | Canada.ca Rate Card Q2 2026 |

<a id="2026-gis-q2-spouse-no-oas-max"></a>

### 2026 GIS Maximum Monthly — Q2, Married/CLP Spouse Does NOT Receive OAS or Allowance

| Value               | Source                      |
| ------------------- | --------------------------- |
| **$1,109.85/month** | Canada.ca Rate Card Q2 2026 |

<a id="2026-gis-q2-spouse-no-oas-cutoff"></a>

### 2026 GIS Annual Income Cutoff — Q2, Married/CLP Spouse Does NOT Receive OAS (Combined)

| Value                | Source                      |
| -------------------- | --------------------------- |
| **$53,952 combined** | Canada.ca Rate Card Q2 2026 |

<a id="2026-gis-q2-spouse-on-oas-max"></a>

### 2026 GIS Maximum Monthly — Q2, Married/CLP Spouse Receives OAS

| Value             | Source                      |
| ----------------- | --------------------------- |
| **$668.08/month** | Canada.ca Rate Card Q2 2026 |

<a id="2026-gis-q2-spouse-on-oas-cutoff"></a>

### 2026 GIS Annual Income Cutoff — Q2, Married/CLP Spouse on OAS (Combined)

| Value                | Source                      |
| -------------------- | --------------------------- |
| **$29,760 combined** | Canada.ca Rate Card Q2 2026 |

<a id="2026-gis-q2-spouse-on-allowance-max"></a>

### 2026 GIS Maximum Monthly — Q2, Married/CLP Spouse Receives Allowance

| Value             | Source                      |
| ----------------- | --------------------------- |
| **$668.08/month** | Canada.ca Rate Card Q2 2026 |

<a id="2026-gis-q2-spouse-on-allowance-cutoff"></a>

### 2026 GIS Annual Income Cutoff — Q2, Married/CLP Spouse on Allowance (Combined)

| Value                | Source                      |
| -------------------- | --------------------------- |
| **$41,664 combined** | Canada.ca Rate Card Q2 2026 |

<a id="2026-gis-q1-single-max"></a>

### 2026 GIS Maximum Monthly — Q1 (Jan–Mar 2026), Single / Widowed / Divorced

| Value               | Source                      |
| ------------------- | --------------------------- |
| **$1,108.74/month** | Canada.ca Rate Card Q1 2026 |

<a id="2026-gis-q1-single-cutoff"></a>

### 2026 GIS Annual Income Cutoff — Q1, Single / Widowed / Divorced

| Value       | Source                      |
| ----------- | --------------------------- |
| **$22,488** | Canada.ca Rate Card Q1 2026 |

<a id="2026-gis-q1-spouse-on-oas-max"></a>

### 2026 GIS Maximum Monthly — Q1, Married/CLP Spouse Receives OAS

| Value             | Source                      |
| ----------------- | --------------------------- |
| **$667.41/month** | Canada.ca Rate Card Q1 2026 |

<a id="2026-gis-q1-spouse-on-oas-cutoff"></a>

### 2026 GIS Annual Income Cutoff — Q1, Married/CLP Spouse on OAS (Combined)

| Value                | Source                      |
| -------------------- | --------------------------- |
| **$29,712 combined** | Canada.ca Rate Card Q1 2026 |

<a id="2026-gis-earnings-exemption-first"></a>

### 2026 GIS Earnings Exemption — First $5,000 (Fully Exempt)

| Value                   | Source    |
| ----------------------- | --------- |
| **$5,000** fully exempt | Canada.ca |

<a id="2026-gis-earnings-exemption-second-50pct"></a>

### 2026 GIS Earnings Exemption — Next $10,000 at 50% ($5,000–$15,000)

| Value                                     | Source    |
| ----------------------------------------- | --------- |
| **50% exempt** on the $5,000–$15,000 band | Canada.ca |

<a id="2026-gis-reduction-rate-single"></a>

### 2026 GIS Reduction Rate — Single / Widowed / Divorced

| Value                                     | Source    |
| ----------------------------------------- | --------- |
| **50%** ($1 for every $2 of other income) | Canada.ca |

<a id="2026-gis-reduction-rate-couple-both-oas"></a>

### 2026 GIS Reduction Rate — Married Couple, Both OAS Recipients

| Value                                                                                | Source    |
| ------------------------------------------------------------------------------------ | --------- |
| **25% per recipient** on combined other income (effective 50% on combined household) | Canada.ca |

<a id="2026-gis-topup-reduction-rate"></a>

### 2026 GIS Top-Up Reduction Rate

| Value                                                                   | Source    |
| ----------------------------------------------------------------------- | --------- |
| **75%** ($0.75 reduction per $1 of other income until top-up exhausted) | Canada.ca |

---

## 5. Allowance & Allowance for the Survivor — 2026 Parameter Values

<a id="2026-allowance-q2-max"></a>

### 2026 Allowance Maximum Monthly — Q2 (Apr–Jun 2026)

| Value               | Eligibility                                                                                              | Source                      |
| ------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------- |
| **$1,411.13/month** | Ages 60–64; spouse/partner receives OAS + GIS; ≥10 yrs Canadian residency; combined income below cut-off | Canada.ca Rate Card Q2 2026 |

<a id="2026-allowance-q2-cutoff"></a>

### 2026 Allowance Annual Combined Income Cutoff — Q2

| Value                | Source                      |
| -------------------- | --------------------------- |
| **$41,664 combined** | Canada.ca Rate Card Q2 2026 |

<a id="2026-allowance-for-survivor-q2-max"></a>

### 2026 Allowance for the Survivor (AfS) Maximum Monthly — Q2 (Apr–Jun 2026)

| Value               | Eligibility                                                                            | Source                      |
| ------------------- | -------------------------------------------------------------------------------------- | --------------------------- |
| **$1,682.15/month** | Ages 60–64; widowed; not remarried/common-law; ≥10 yrs residency; income below cut-off | Canada.ca Rate Card Q2 2026 |

<a id="2026-allowance-for-survivor-q2-cutoff"></a>

### 2026 Allowance for the Survivor Annual Income Cutoff — Q2

| Value       | Source                      |
| ----------- | --------------------------- |
| **$30,336** | Canada.ca Rate Card Q2 2026 |

---

## 6. FP Canada / Institute of Financial Planning 2026 Projection Assumption Guidelines

Released **April 16, 2026**; effective **April 30, 2026**.

<a id="2026-fp-canada-inflation"></a>

### 2026 FP Canada PAG — Inflation

| Value    | Source             |
| -------- | ------------------ |
| **2.1%** | FP Canada 2026 PAG |

<a id="2026-fp-canada-ympe-growth"></a>

### 2026 FP Canada PAG — YMPE / MPE Growth Rate

| Value                     | Source             |
| ------------------------- | ------------------ |
| **3.1%** (inflation + 1%) | FP Canada 2026 PAG |

<a id="2026-fp-canada-salary-increase"></a>

### 2026 FP Canada PAG — Salary Increases (Default)

| Value                     | Source             |
| ------------------------- | ------------------ |
| **3.1%** (inflation + 1%) | FP Canada 2026 PAG |

<a id="2026-fp-canada-shelter"></a>

### 2026 FP Canada PAG — Shelter Projection (New for 2026)

| Value    | Source             |
| -------- | ------------------ |
| **3.1%** | FP Canada 2026 PAG |

<a id="2026-fp-canada-short-term"></a>

### 2026 FP Canada PAG — Short-Term Investments

| Value    | Source             |
| -------- | ------------------ |
| **2.4%** | FP Canada 2026 PAG |

<a id="2026-fp-canada-fixed-income"></a>

### 2026 FP Canada PAG — Fixed Income

| Value                             | Source             |
| --------------------------------- | ------------------ |
| **3.2%** (down from 3.4% in 2025) | FP Canada 2026 PAG |

<a id="2026-fp-canada-canadian-equities"></a>

### 2026 FP Canada PAG — Canadian Equities

| Value    | Source             |
| -------- | ------------------ |
| **6.3%** | FP Canada 2026 PAG |

<a id="2026-fp-canada-us-equities"></a>

### 2026 FP Canada PAG — U.S. Equities

| Value    | Source             |
| -------- | ------------------ |
| **6.4%** | FP Canada 2026 PAG |

<a id="2026-fp-canada-intl-equities"></a>

### 2026 FP Canada PAG — International Developed Equities

| Value    | Source             |
| -------- | ------------------ |
| **6.6%** | FP Canada 2026 PAG |

<a id="2026-fp-canada-emerging-equities"></a>

### 2026 FP Canada PAG — Emerging-Market Equities

| Value    | Source             |
| -------- | ------------------ |
| **7.5%** | FP Canada 2026 PAG |

<a id="2026-fp-canada-borrowing-rate"></a>

### 2026 FP Canada PAG — Borrowing Rate

| Value    | Source             |
| -------- | ------------------ |
| **4.4%** | FP Canada 2026 PAG |

### Implementation Notes for FP Canada 2026 PAG

For projections: index the YMPE/YAMPE annually by 3.1%, OAS/GIS quarterly by the inflation assumption (2.1%/year compounded), and CPP/QPP benefits in pay by 2.1%/year. Mortality should use the CIA CPM2014 table with Improvement Scale B (generational); the 2026 update added same-sex couple longevity tables.

---

## 7. What Changed Between 2025 and 2026

- **YMPE**: $71,300 → $74,600 (+4.6%).
- **YAMPE**: $81,200 → $85,000 (+4.7%).
- **YAMPE ratio**: stabilized at 114% of YMPE (final level).
- **CPP max retirement at 65 (January)**: $1,433.00 → $1,507.65 (+5.2%, includes enhancement accrual + indexation).
- **CPP indexation for benefits in pay**: +2.0% (vs. +2.7% in Jan 2025).
- **OAS clawback minimum threshold**: $93,454 (2025 income) → $95,323 (2026 income).
- **OAS Jan max**: $727.67 (65–74) → $742.31 (Jan 2026), +2.0%.
- **GIS Jan max single**: $1,086.88 → $1,108.74 (Jan 2026), +2.0%.
- **QPP base rate**: cut from 10.80% to **10.60%** for 2026 only (Quebec Bulletin 2025-8).
- **QPP CNESST drop-out**: introduced January 1, 2026 (≥24 consecutive months of reduced indemnity).
- **CPP2 / QPP2 contribution rates**: unchanged (4% each side; full rate since 2024 launch); only the YAMPE band widens with average-wage indexation.
- **FP Canada PAG**: inflation unchanged at 2.1%; fixed-income return cut to 3.2% (from 3.4%); equity returns reduced ~0.3 pt across the board; new shelter projection added (3.1%).

---

## 8. Edge Cases & Implementation Notes

1. **CPP estimate by Service Canada (MSCA "View my benefit estimates")** assumes future earnings continue at past levels. Software should NOT use the MSCA estimate at face value when projecting an early retiree's CPP at age 65 — instead, retrieve historical earnings record and apply drop-outs explicitly.
2. **Maximum CPP requires 39 years of max contributions out of 47 from age 18–65** (i.e., 39/40 × 100% after the 8-year drop-out). For full enhanced CPP1 and CPP2, **40 years** of max contributions on each tier are required (no drop-out on enhancement components).
3. **Combined survivor + retirement cap** applies to the _calculated_ (age-65) retirement pension, not the actual pension paid. Early CPP take-up does NOT give a higher survivor's pension ceiling.
4. **OAS clawback uses prior-year income**: model the clawback applied to OAS in calendar year `Y` based on **net world income for tax year `Y−1` for the period Jan–Jun of `Y`**, and **tax year `Y−1` for July–Dec** as well (the recovery tax period runs July to June, using the prior year's tax return). Practically, software should use a one-year lag.
5. **GIS recalculation timing**: each July based on the prior calendar year's tax return. Late filers risk GIS suspension.
6. **CPP2 maximum benefit is small in early years** because accrual is 1/40 per year — a contributor with only 3 years of CPP2 contributions (2024–2026) at the YAMPE will receive only 3/40 × 33.33% × 5-year-average of (YAMPE − YMPE) ≈ less than $25/month at age 65 from CPP2. Full CPP2 effect comes in ~2065.
7. **75+ OAS top-up is permanent and applied to the deferred OAS amount at age 75**, not at the original deferral date. For a person who defers to 70 and reaches 75, the multiplier chain is base × (1 + 0.6% × 60) × 1.10 — applied to the OAS amount currently in force at age 75.
8. **QPP age-60 reduction factor varies** by pension size (0.5%–0.6%/month). Implementations should use a linear interpolation between 0.5% (for very small base pensions) and 0.6% (for the max base pension), proportional to the ratio of the contributor's calculated base pension to the maximum. CPP uses a flat 0.6%/month for everyone.
9. **YBE does not exist for CPP2/QPP2**: contributions on the second-tier band ($74,600–$85,000) start at the first dollar above $74,600; the $3,500 exemption is base-tier only.
10. **Tax treatment**: Employee CPP2 contributions, and the enhanced portion (1%) of base CPP contributions, are deductible (not just a non-refundable tax credit) — affects net-of-tax pension projections.
11. **OAS income for clawback** includes the OAS pension itself (the clawback can recursively reduce OAS, but the math converges because OAS is < 15% of upper threshold).
12. **Income for GIS** excludes OAS, GIS, Allowance, first $5,000 of employment/self-employment income, and 50% of next $10,000 of such income — but does NOT exclude RRSP/RRIF withdrawals or CPP/QPP, which are major income sources for many seniors.
13. **Indexation anchors — OAS vs. CPP (engine convention).** OAS gross is held as a **2026-dollar parameter** (`OAS_2026.q2 × 12`), so the engine indexes it forward on a **calendar clock anchored to 2026** — `(1 + inflation)^(year − max(2026, projectionStartYear))` — the same anchor the OAS clawback threshold uses in `buildTaxYearParams`. The two MUST share one clock so a person whose OAS starts after 2026 sees gross OAS and the recovery threshold grow in lockstep (audit A-08). CPP/QPP is **not** anchored to 2026: `expectedCPPAt65` is a **user-supplied** estimate of the benefit at the chosen start age, so the engine indexes CPP "in pay" from `age − cppStartAge`. Consequently, **YMPE / average-wage indexation (`#2026-fp-canada-ympe-growth`, 3.1%) is intentionally N/A in the projection engine** — it would only matter for back-solving a CPP entitlement from an earnings record, which the engine never does; it consumes the user's at-65 estimate directly and indexes benefits-in-pay by the inflation assumption (2.1%) per the FP Canada implementation note above.

---

## 9. NOT YET CONFIRMED (as of research date 2026-05-10)

> The values below are NOT YET PUBLISHED by their administering authority as of the 2026-05-10 research date. Engine code (or a future auto-fetcher) MUST treat these as projections, not authoritative figures, until the official rate card is released.

- **OAS/GIS quarterly rates for Q3 (Jul–Sep) and Q4 (Oct–Dec) 2026** — Canada.ca publishes Q3 in late June 2026 once Feb/Mar/Apr 2026 CPI prints are final. Fall back to FP Canada 2026 PAG inflation projection (2.1%/yr) until released.
- **QPP base contribution rate for 2027** — the 0.20-pt cut to 10.60% is legislated as a one-year-only measure for 2026 (Bulletin 2025-8). Absent further legislation the formula-based rule under s.44.1 QPP Act resumes for 2027. Quebec's most recent actuarial valuation places the steady-state rate at 10.47%, so the 2027 rate is unknown until Quebec publishes its next update.

---

## 10. Caveats

- **Q3 and Q4 2026 OAS/GIS amounts are not yet published as of May 10, 2026.** The Apr–Jun 2026 figures from Canada.ca dated 2026-03-31 are the most recent available. Subsequent quarterly increases will be tied to actual CPI prints — implementations should leave these values configurable and fall back to PAG-projected inflation (2.1%/yr) until official figures are released in late June 2026.
- **The QPP 0.20-pt base-rate cut for 2026 is currently legislated as a one-year measure.** The standard rule under s.44.1 of the QPP Act would otherwise have kept the rate at 10.80%; absent further legislation, 2027 will revert to the formula-based rate (Quebec's most recent actuarial valuation places the steady-state rate at 10.47%, so a return below 10.80% is plausible — verify before producing 2027 projections).
- **The 2026 OAS clawback threshold of $95,323** is the threshold applied to net world income reported on the 2026 tax return, which will affect OAS paid in the July 2027 – June 2028 recovery period. For modeling OAS clawback _actually deducted in 2026_, use the **2024-income threshold ($90,997, with full clawback at $148,451 for 65–74)** for January–June 2026 and the **2025-income threshold ($93,454, full clawback $152,062 for 65–74, $157,923 for 75+)** for July–December 2026.
- The complex formulas for CPP/QPP combined survivor + retirement benefits, and for the interaction between enhanced and base components after 2019, lack definitive worked examples on Service Canada's public site; implementation should rely on the Canada Pension Plan Act (RSC 1985, c. C-8) sections 58–59, 65, and the corresponding QPP Act sections, plus the Office of the Chief Actuary's most recent CPP report (32nd Actuarial Report, December 31, 2024) and Retraite Québec's December 31, 2024 actuarial valuation, for edge cases.
- Several third-party sources reference slightly different 2026 figures (e.g., $727.67 vs. $742.31 for January OAS) — these are confused with the **prior** January figures or with mid-quarter values. The authoritative Canada.ca Q1 2026 Rate Card values published 2025-12-30 should be used: $742.31 (65–74) and $816.54 (75+) for Jan–Mar 2026.
- The "5-year average YMPE" (MPEA) for 2026 = average of YMPEs for 2022 ($64,900), 2023 ($66,600), 2024 ($68,500), 2025 ($71,300), and 2026 ($74,600) = **$69,180**. The maximum new base CPP pension at 65 in January 2026 of approximately $1,441 is roughly consistent with 25% × $69,180 / 12 = $1,441.25; the additional $66.40 reflects the cumulative first-additional-component accrual through 2025 (7 years × 1/40 × 8.33% × ~$66,800 ≈ $80/month max, prorated for partial early years).
- All amounts in this document are denominated in Canadian dollars.
