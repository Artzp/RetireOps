# 19 — Canadian Federal & Provincial Benefits and Tax Credits: 2026 Parameter Values

## Source Provenance

- **Research date:** 2026-05-10
- **Original compass artifact:** `compass_artifact_wf-7599f10b-3fe6-414d-b66f-2db6ed855694_text_markdown.md` (338 lines; integrated and deleted as part of v4.5 Phase 17).
- **Primary sources cited in the original artifact:**
  - Canada.ca — Federal indexation 2026; CRA — 2026 income tax credit amounts
  - CRA / Service Canada — GST/HST Credit and CGEB transition documentation
  - Employment and Social Development Canada — Canada Disability Benefit (CDB) regulations
  - Service Canada — Canada Dental Care Plan (CDCP) eligibility tiers
  - EI Commission — 2026 EI premium and benefit parameters
  - Veterans Affairs Canada — 2026 disability and income-replacement rate cards
  - Provincial budget documents 2025–26 and 2026–27 cycles: Alberta Budget 2026-27 (March 2026), Quebec November 2025 update / Quebec Budget 2025-26, NL Budget 2025, NS Budget 2025-26, Ontario Trillium / GAINS publications, BC government rate cards
  - Quebec Information Bulletin 2025-8 (Nov 25 2025) — Home-support credit rate
  - Various third-party financial planning sources (flagged where authoritative source was not yet published as of 2026-05-10)

## Integration Strategy

This file holds **dated 2026 parameter values only** for federal and provincial tax credits, benefits, and supplements. The formulas, calculation rules, and worked examples for federal/provincial income tax credits live in [`04-tax-engine.md`](./04-tax-engine.md); the formulas for OAS recovery tax, GIS calculation, and CPP/QPP live in [`05-government-benefits.md`](./05-government-benefits.md) (both rules-layer docs, which retain prior-year example values as historical rules-teaching context). Engine code consuming a 2026 parameter SHOULD cite this file at the relevant anchor (see `README.md` → "How to cite from engine code"). Engine code consuming a rule or formula SHOULD cite `04-tax-engine.md` or `05-government-benefits.md`.

This hybrid integration was decided 2026-05-10 (Phase 17 CONTEXT, D-01).

For 2026 CPP/QPP/OAS/GIS parameter values (the public-pension layer), see the sister file [`18-pensions-2026.md`](./18-pensions-2026.md).

## How to cite from engine code

```ts
// Federal 2026 Basic Personal Amount per docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-fed-bpa-max
const FED_BPA_2026_MAX = 16_452;
```

(See `README.md` for the full citation convention.)

---

## 1. Key 2026 Changes (Implementation Priorities)

1. **Federal lowest tax rate dropped to 14%** (from a prorated 14.5% in 2025) — every non-refundable credit (BPA, age amount, pension amount, DTC, caregiver amount, METC) now multiplies by 14% rather than 15%. This **reduces the dollar value** of all federal non-refundable credits by ~3.4% versus 2025, partially offsetting the 2.0% indexation.
2. **GST/HST Credit is being replaced by the Canada Groceries and Essentials Benefit (CGEB)** effective July 2026 — a 25% permanent increase to the existing credit for five years (through 2031), plus a one-time top-up payment (≈50% of 2025–26 annual entitlement) to be issued starting **June 5, 2026** to all January 2026 GST/HST credit recipients.
3. **Canada Disability Benefit (CDB)** launched June 2025 (first payments July 2025); max $200/month ($2,400/yr). Eligibility = DTC + ages 18–64 + filed tax return. Phase-out begins at AFNI $23,000 single / $32,500 couple at 20% reduction rate. Working-income exemption: first $10,000 single / $14,000 couple. Indexed annually beginning July 2026.
4. **CDCP fully open**: as of February 2026, all eligible Canadian residents (any age) with AFNI < $90,000 and no private dental insurance can apply. Income tiers: **<$70k = 100% of CDCP fees covered; $70k–$79,999 = 60% covered (40% co-pay); $80k–$89,999 = 40% covered (60% co-pay); ≥$90k = ineligible**. Renewal window for 2026–27 benefit year closes June 1, 2026.
5. **EI parameters reset for 2026**: MIE rises to **$68,900** (from $65,700), max weekly benefit **$729** (from $695), employee premium rate **1.63%** (1.30% Quebec), max annual premium **$1,123.07**. The waiting-period waiver and severance non-deduction temporary measures remain in effect for claims started between March 30, 2025 and October 10, 2026.
6. **Alberta Budget 2026-27 (announced March 2026) lowered Alberta Seniors Benefit income thresholds** by ~9%, from $56,820 to **$53,800** (couples) and from $34,770 to **$32,690** (singles), effective July 1, 2026. Maximum monthly amounts remain $493 (couple) / $328 (single) at the lowest income levels.
7. **Quebec Tax Credit for Home-Support Services for Seniors rate rises to 40%** in 2026 (from 39% in 2025) — final 1% increment in the multi-year enhancement plan.
8. **Newfoundland & Labrador Seniors' Benefit** is now indexed annually to CPI effective July 2025 (Budget 2025), max ~$1,551 for 2025–26 (up from $1,516 prior).
9. **NWT Senior Home Heating Subsidy** received a permanent rate increase for the 2025–26 heating season: Zone 1 $460/mo (max $3,680), Zone 2 $560/mo (max $4,480), Zone 3 $750/mo (max $6,000).
10. **BC Climate Action Tax Credit (BCCATC) was eliminated** with the final payment in April 2025 (BC repealed the provincial carbon tax effective April 1, 2025). RetireOps should remove BCCATC from BC retirement models for 2026 onward.

---

## 2. Federal Income Benefits

### 2.1 Allowance & Allowance for the Survivor (OAS program)

See [`18-pensions-2026.md`](./18-pensions-2026.md) for the canonical 2026 Allowance / Allowance for the Survivor parameter anchors (these benefits are part of the OAS program stack).

### 2.2 Veterans Affairs Canada (VAC) — 2026 Rates

All VAC rates are CPI-indexed each January 1. **2026 values (effective January 1, 2026)**:

<a id="2026-vac-disability-pension-class1"></a>

| Benefit                                               | 2026 monthly/lump-sum                                                                                | Tax treatment | Counts for OAS clawback? |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------- | ------------------------ |
| **Disability Pension** (legacy Pension Act, pre-2006) | Up to ~$3,357/month at Class 1 (100%) single; dependent supplements ~+$839 spouse, +$436 first child | Non-taxable   | No                       |

<a id="2026-vac-psc-lifetime-monthly-max"></a>
<a id="2026-vac-psc-lump-sum-max"></a>

| Benefit                                               | 2026 monthly/lump-sum                                                             | Tax treatment | Counts for OAS clawback? |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- | ------------- | ------------------------ |
| **Pain & Suffering Compensation (PSC)** (April 2019+) | Lifetime monthly at class %, OR lump-sum up to **$418,795.20** (2026 max at 100%) | Non-taxable   | No                       |

<a id="2026-vac-apsc-grade1"></a>
<a id="2026-vac-apsc-grade2"></a>
<a id="2026-vac-apsc-grade3"></a>

| Benefit                                             | 2026 monthly/lump-sum                                                   | Tax treatment | Counts for OAS clawback? |
| --------------------------------------------------- | ----------------------------------------------------------------------- | ------------- | ------------------------ |
| **Additional Pain & Suffering Compensation (APSC)** | Grade 1 ~$735/mo, Grade 2 ~$1,470/mo, Grade 3 ~$2,205/mo (2026 indexed) | Non-taxable   | No                       |

<a id="2026-vac-irb-replacement-pct"></a>
<a id="2026-vac-irb-min-salary"></a>

| Benefit                              | 2026 monthly/lump-sum                                                                                                                       | Tax treatment | Counts for OAS clawback? |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------ |
| **Income Replacement Benefit (IRB)** | 90% of pre-release military salary (indexed; minimum salary basis approx. $69,580/yr); reduces to 70% after age 65 for non-rehab recipients | **Taxable**   | Yes                      |

<a id="2026-vac-caregiver-recognition"></a>

| Benefit                           | 2026 monthly/lump-sum      | Tax treatment | Counts for OAS clawback? |
| --------------------------------- | -------------------------- | ------------- | ------------------------ |
| **Caregiver Recognition Benefit** | **$1,264.25/month** (2026) | Non-taxable   | No                       |

<a id="2026-vac-critical-injury"></a>

| Benefit                     | 2026 monthly/lump-sum          | Tax treatment | Counts for OAS clawback? |
| --------------------------- | ------------------------------ | ------------- | ------------------------ |
| **Critical Injury Benefit** | **$92,175.45** lump-sum (2026) | Non-taxable   | No                       |

<a id="2026-vac-wva-single-max"></a>
<a id="2026-vac-wva-couple-max"></a>

| Benefit                          | 2026 monthly/lump-sum                                                                                                                                     | Tax treatment           | Counts for OAS clawback? |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------ |
| **War Veterans Allowance (WVA)** | Income-tested; 2026 max approx. **$1,977/mo single** / **$2,995/mo couple** (CPI-indexed; mirrors OAS+GIS structure for WW2/Korea/Merchant Navy veterans) | Non-taxable             | No                       |
| **Survivor benefits**            | Generally 50–100% of veteran's entitlement, depending on program                                                                                          | Same as veteran benefit | Same as veteran benefit  |

**Key implementation note.** Only IRB and Earnings Loss are taxable and enter the OAS recovery tax base. All other VAC benefits are non-taxable and do not count for OAS clawback or GIS income tests.

### 2.3 Employment Insurance (EI) — 2026

<a id="2026-ei-mie"></a>

| Parameter                            | 2026 value  | 2025 (comparison) |
| ------------------------------------ | ----------- | ----------------- |
| **Maximum Insurable Earnings (MIE)** | **$68,900** | $65,700           |

<a id="2026-ei-employee-rate"></a>

| Parameter                                  | 2026 value | 2025 (comparison) |
| ------------------------------------------ | ---------- | ----------------- |
| **Employee premium rate (outside Quebec)** | **1.63%**  | 1.64%             |

<a id="2026-ei-employee-rate-quebec"></a>

| Parameter                                       | 2026 value | 2025 (comparison) |
| ----------------------------------------------- | ---------- | ----------------- |
| **Employee premium rate (Quebec, due to QPIP)** | **1.30%**  | 1.31%             |

<a id="2026-ei-max-annual-premium"></a>

| Parameter                                        | 2026 value    | 2025 (comparison) |
| ------------------------------------------------ | ------------- | ----------------- |
| **Max annual employee premium (outside Quebec)** | **$1,123.07** | $1,077.48         |

<a id="2026-ei-max-annual-premium-quebec"></a>

| Parameter                                | 2026 value             | 2025 (comparison)      |
| ---------------------------------------- | ---------------------- | ---------------------- |
| **Max annual employee premium (Quebec)** | **$895.70**            | $860.67                |
| Employer rate (1.4× employee)            | $2.28 / $1.82 (Quebec) | $2.30 / $1.83 (Quebec) |

<a id="2026-ei-max-weekly-benefit"></a>

| Parameter                              | 2026 value | 2025 (comparison) |
| -------------------------------------- | ---------- | ----------------- |
| **Max weekly benefit (55% of MIE/52)** | **$729**   | $695              |

<a id="2026-ei-clawback-threshold"></a>

| Parameter                              | 2026 value  | 2025 (comparison) |
| -------------------------------------- | ----------- | ----------------- |
| **EI clawback threshold (1.25 × MIE)** | **$86,125** | $82,125           |

<a id="2026-ei-clawback-rate"></a>

| Parameter            | 2026 value                                                  | 2025 (comparison) |
| -------------------- | ----------------------------------------------------------- | ----------------- |
| **EI clawback rate** | **30%** of lesser of (regular benefits paid; income excess) | unchanged         |

<a id="2026-ei-replacement-rate"></a>

| Parameter                     | 2026 value                                                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Standard replacement rate** | **55%** of average insurable weekly earnings (up to 80% family supplement for low-income families with children) |

#### Benefit Durations

- **Regular:** 14–45 weeks (based on hours and regional unemployment rate; long-tenured worker measures can extend to 65 weeks during temporary measures window)
- **Sickness: 26 weeks** (permanent change effective December 2022)
- **Compassionate Care: 26 weeks**
- **Family Caregiver — adults: 15 weeks**
- **Family Caregiver — critically ill children: 35 weeks**

#### Eligibility Hours

420–700 hours of insurable employment in the qualifying period (52 weeks prior), depending on regional unemployment rate. Special benefits: 600 hours.

#### Temporary Measures (March 30, 2025 – October 10, 2026)

Waiting period waived for new claims; severance/pay-in-lieu does not reduce EI within this window. See the "NOT YET CONFIRMED" section (§10) regarding expiry.

### 2.4 Canada Workers Benefit (CWB) — 2025 amounts driving 2026 ACWB

**Federal formula (most provinces; Alberta, Quebec, Nunavut use province-specific tables under bilateral agreements).**

<a id="2026-cwb-single-max-projected"></a>
<a id="2026-cwb-family-max-projected"></a>
<a id="2026-cwb-disability-supplement-projected"></a>
<a id="2026-cwb-phasein-rate"></a>
<a id="2026-cwb-phaseout-rate"></a>
<a id="2026-cwb-min-working-income"></a>
<a id="2026-cwb-secondary-earner-exemption"></a>
<a id="2026-cwb-disability-min-working-income"></a>

| Parameter                                           | 2025 (drives 2026 ACWB)            | 2026 projected (2% indexation) |
| --------------------------------------------------- | ---------------------------------- | ------------------------------ |
| **Single — max basic**                              | $1,633                             | ~$1,666                        |
| **Family — max basic**                              | $2,813                             | ~$2,869                        |
| **Disability supplement (per eligible individual)** | $843                               | ~$860                          |
| Single phase-in rate                                | 27% on working income above $3,000 | unchanged                      |
| Single phase-out start (AFNI)                       | $26,855                            | indexed                        |
| Single phase-out end                                | $37,742                            | indexed                        |
| Family phase-out start (adjusted family net income) | $30,639                            | indexed                        |
| Family phase-out end                                | $49,393                            | indexed                        |
| **Phase-out rate**                                  | 12%                                | unchanged                      |
| Disability supplement phase-out (single)            | $37,740 → zero at $43,360          | indexed                        |
| Disability supplement phase-out (family)            | $49,389 → zero at $59,038          | indexed                        |
| **Secondary earner exemption (family)**             | $16,714                            | indexed                        |
| **Minimum working income to qualify**               | $3,000 (basic)                     | unchanged                      |
| **Minimum working income (disability supplement)**  | $1,150                             | unchanged                      |

**Formula:**

```
Phase-in = 27% × max(0, working_income − $3,000), capped at maximum
Phase-out = 12% × max(0, AFNI − phase_out_start)
CWB = max(0, Phase-in − Phase-out)
```

**Advanced CWB (ACWB):** 50% of entitlement paid in three equal advance instalments (July 11, October 10, January 12 for the benefit year). Reconciliation at tax filing.

---

## 3. Federal Tax Credits & Refundable Benefits — 2026 Numerical Values

<a id="2026-fed-indexation"></a>

| Parameter                     | 2026 value | Notes                                                                   |
| ----------------------------- | ---------- | ----------------------------------------------------------------------- |
| **Federal indexation factor** | **2.0%**   | CRA-confirmed; all non-refundable credit amounts indexed by this factor |

<a id="2026-fed-lowest-rate"></a>

| Parameter                                   | 2026 value | Notes                                                                       |
| ------------------------------------------- | ---------- | --------------------------------------------------------------------------- |
| **Federal lowest personal income tax rate** | **14%**    | Down from 14.5% in 2025; all non-refundable credit values multiplied by 14% |

**Federal non-refundable tax credit amounts (2026):**

| Credit | 2026 amount | Tax-credit value @ 14% fed | Notes |
| ------ | ----------- | -------------------------- | ----- |

<a id="2026-fed-bpa-max"></a>
| **Basic Personal Amount (BPA) — max** | $16,452 | $2,303 | Linear phase-out between $181,440 and $258,482 |
<a id="2026-fed-bpa-min"></a>
| **Basic Personal Amount (BPA) — min** | $14,829 | $2,076 | For incomes ≥ $258,482 |
<a id="2026-fed-bpa-phaseout-start"></a>
| BPA phase-out start | $181,440 | — | Income above which BPA begins reducing |
<a id="2026-fed-bpa-phaseout-end"></a>
| BPA phase-out end | $258,482 | — | Income above which min BPA applies |
<a id="2026-fed-age-amount"></a>
| **Age Amount (65+)** | $9,208 | $1,289 max | Reduced 15% × (net income − ~$45,522); zero at ~$106,576 |
<a id="2026-fed-age-amount-phaseout-start"></a>
| Age Amount phase-out start | ~$45,522 | — | 15% reduction rate applied above this threshold |
<a id="2026-fed-age-amount-phaseout-end"></a>
| Age Amount phase-out end | ~$106,576 | — | Zero age amount above this income |
<a id="2026-fed-pension-income-amount"></a>
| **Pension Income Amount** | $2,000 | $280 | Eligible pension income only (see §3.1) |
<a id="2026-fed-dtc-base"></a>
| **Disability Amount (DTC) — base** | $10,341 | $1,448 | Plus provincial DTC (e.g., Ontario adds ~$522) |
<a id="2026-fed-dtc-child-supplement"></a>
| **DTC — supplement for child <18** | $6,032 | $844 | Reduced by attendant care/child-care expenses over $3,529 (est.) |
<a id="2026-fed-caregiver-credit-base"></a>
| **Canada Caregiver Credit — infirm spouse/eligible dependant 18+** | $2,687 base | $376 | Phase-out: dependant net income above $8,601 to zero at $20,601 |
<a id="2026-fed-caregiver-credit-line30425"></a>
| Canada Caregiver Credit — line-30425 supplement | up to $8,601 | $1,204 | Combined with base above for infirm spouse/eligible dependant 18+ |
<a id="2026-fed-caregiver-credit-infirm-child"></a>
| **Canada Caregiver Credit — infirm child <18** | $2,687 | $376 | |
<a id="2026-fed-canada-employment-amount"></a>
| **Canada Employment Amount** | $1,471 | $206 | 2026 est.; 2% indexed from $1,442 |
<a id="2026-fed-metc-threshold-pct"></a>
| METC threshold — percentage | 3% of net income | varies | Whichever is less of 3% / cap |
<a id="2026-fed-metc-threshold-cap"></a>
| **METC threshold — dollar cap** | $2,890 | varies | 14% × (eligible expenses − min(3% × net income, $2,890)) |
<a id="2026-fed-rmes-max"></a>
| **RMES — refundable max** | $1,472 (est.) | up to $1,472 cash | 25% of allowable METC; for lower-income workers |
<a id="2026-fed-rmes-working-income"></a>
| RMES — required working income | $4,425 | — | Minimum working income to qualify |
<a id="2026-fed-rmes-phaseout-start"></a>
| RMES — phase-out start (family net income) | $33,427 | — | 5% reduction above this threshold |
<a id="2026-fed-hatc-max-expense"></a>
| **Home Accessibility Tax Credit (HATC) — max expenses** | $20,000 | $2,800 max | Seniors 65+ or DTC-eligible; principal residence modifications |
<a id="2026-fed-mhrtc-max-expense"></a>
| **Multigenerational Home Renovation Tax Credit (MHRTC) — max expenses** | $50,000 | $7,000 max (refundable) | For secondary unit to house senior 65+ or DTC-eligible relative |
<a id="2026-fed-volunteer-firefighter-amount"></a>
| **Volunteer Firefighters / Search & Rescue Amount** | $6,000 | $840 | Doubled by Budget 2024 |
<a id="2026-fed-oas-recovery-threshold"></a>
| **OAS Recovery Threshold (2026 income year)** | $95,323 | — | 15% recovery tax on individual net income above threshold |
<a id="2026-pension-splitting-percent"></a>
| **Pension splitting (T1032)** | up to 50% | — | Of eligible pension income; see §3.1 |

### 3.1 Pension Income Splitting (T1032) — 2026 Rules

Joint election on Form **T1032** allows allocation of up to **50%** of "eligible pension income" from the higher-income spouse to the lower-income spouse.

**Eligible pension income — recipient under age 65 (qualifying pension income):**

- Life annuity payments from a Registered Pension Plan (RPP) — defined benefit or money-purchase
- Payments from a RRIF/LIF/LRIF/RRSP annuity **only if** received as a result of the death of a spouse

**Eligible pension income — recipient age 65 or older (at year-end):**

- All of the above, PLUS:
- RRIF and LIF/LRIF/RLIF withdrawals
- RRSP annuity payments
- Annuitized DPSP payments
- Certain Retirement Compensation Arrangement (RCA) payments
- Pooled Registered Pension Plan (PRPP) payments
- Variable benefits from a money-purchase RPP

**NOT eligible (any age):** CPP/QPP retirement benefits, OAS, GIS, Allowance, RRSP lump-sum withdrawals (non-annuitized), foreign-source pension income tax-exempt under treaty (line 25600 deduction), salary, business income, dividends, interest, capital gains.

**Quebec-specific rule:** For Quebec provincial purposes only, the transferring spouse must be **age 65 or older** even for RPP income. (Federally, RPP income is eligible regardless of age.)

**Pension Income Amount interaction:** The receiving spouse can claim the $2,000 pension income amount on the allocated income only if (a) recipient is 65+ for any type, or (b) recipient is under 65 and the income is the "qualifying pension income" subset.

**OAS clawback strategy:** Pension splitting reduces the higher-income spouse's net income on Line 23600, which directly reduces the OAS recovery tax (15% on income above $95,323 for 2026). Splitting can fully restore OAS for couples where one spouse is between $95,323 and ~$152,062 (ages 65–74) or ~$157,923 (75+).

**Late election:** CRA allows late or amended elections within 3 calendar years after the filing-due date.

### 3.2 GST/HST Credit + CGEB Transition

**2025–26 benefit year (ending June 2026):**

<a id="2026-gsthst-single-max"></a>
<a id="2026-gsthst-couple-max"></a>
<a id="2026-gsthst-per-child"></a>
<a id="2026-gsthst-phaseout-start"></a>
<a id="2026-gsthst-phaseout-rate"></a>

| Parameter                               | 2025–26 value | Notes                                                              |
| --------------------------------------- | ------------- | ------------------------------------------------------------------ |
| **Single adult maximum**                | $533/year     | Paid quarterly (Jan/Apr/Jul/Oct)                                   |
| **Couple maximum**                      | $698/year     |                                                                    |
| **Per child under 19**                  | $184/year     | Single-parent supplement equals first child amount                 |
| **Phase-out start (AFNI, 2024 income)** | ~$45,521      | 5% reduction above threshold                                       |
| **Phase-out rate**                      | 5%            | Single-supplement separately phases in at AFNI above $11,337       |
| One-time top-up date                    | June 5, 2026  | 50% of January 2026 entitlement; issued to all Jan 2026 recipients |

**CGEB (Canada Groceries and Essentials Benefit) — effective July 2026:**

<a id="2026-cgeb-launch-date"></a>
<a id="2026-cgeb-top-up-date"></a>
<a id="2026-cgeb-percent-increase"></a>

| Parameter                      | Value        | Notes                                                                      |
| ------------------------------ | ------------ | -------------------------------------------------------------------------- |
| **CGEB launch date**           | July 2026    | Replaces the GST/HST credit                                                |
| **One-time top-up date**       | June 5, 2026 | 50% of January 2026 quarterly entitlement; paid to all Jan 2026 recipients |
| **Permanent increase**         | 25%          | 25% increase to existing GST/HST credit for 5 years (through 2031)         |
| Projected single max (2026–27) | ~$666/year   | NOT YET PUBLISHED by CRA; 25% increase projection — flag as estimate       |
| Projected couple max (2026–27) | ~$873/year   | NOT YET PUBLISHED — flag as estimate                                       |
| Projected per child (2026–27)  | ~$230/year   | NOT YET PUBLISHED — flag as estimate                                       |

### 3.3 Canada Disability Benefit (CDB)

<a id="2026-cdb-max-monthly"></a>
<a id="2026-cdb-max-annual"></a>

| Parameter                   | Value       | Notes                          |
| --------------------------- | ----------- | ------------------------------ |
| **Maximum monthly benefit** | $200/month  | CPI-indexed starting July 2026 |
| **Maximum annual benefit**  | $2,400/year |                                |

<a id="2026-cdb-reduction-rate"></a>
<a id="2026-cdb-phaseout-single-start"></a>
<a id="2026-cdb-phaseout-single-end"></a>
<a id="2026-cdb-phaseout-couple-one-eligible-start"></a>
<a id="2026-cdb-phaseout-couple-one-eligible-end"></a>
<a id="2026-cdb-phaseout-couple-both-eligible-start"></a>
<a id="2026-cdb-phaseout-couple-both-eligible-end"></a>
<a id="2026-cdb-working-exemption-single"></a>
<a id="2026-cdb-working-exemption-couple"></a>
<a id="2026-cdb-retroactivity-months"></a>

| Parameter                                    | Value                       | Notes                                                               |
| -------------------------------------------- | --------------------------- | ------------------------------------------------------------------- |
| **Reduction rate**                           | 20% of AFNI above threshold | Applied on family net income above phase-out start                  |
| **Phase-out start — single**                 | $23,000                     | Zero benefit at $35,000                                             |
| **Phase-out end — single**                   | $35,000                     |                                                                     |
| **Phase-out start — couple (one eligible)**  | $32,500                     | Zero benefit at $44,500                                             |
| **Phase-out end — couple (one eligible)**    | $44,500                     |                                                                     |
| **Phase-out start — couple (both eligible)** | $32,500                     | Zero benefit at $56,500                                             |
| **Phase-out end — couple (both eligible)**   | $56,500                     |                                                                     |
| **Working income exemption — single**        | $10,000                     | First $10,000 employment/self-employment excluded from AFNI         |
| **Working income exemption — couple**        | $14,000                     |                                                                     |
| **Retroactivity**                            | Up to 24 months             | Not earlier than June 2025                                          |
| Eligibility ages                             | 18–64                       | Must be DTC-approved (T2201 on file) and have filed 2024 tax return |

**Tax treatment:** Currently classified as **social assistance** under the Income Tax Act and included in net income — this creates risk of clawback against provincial disability supports. See §10 ("NOT YET CONFIRMED") for the CDB taxability and clawback legislative status.

### 3.4 Canada Dental Care Plan (CDCP) — 2026 Tiers (all ages from Feb 2026)

<a id="2026-cdcp-tier1-cap"></a>
<a id="2026-cdcp-tier2-cap"></a>
<a id="2026-cdcp-tier3-cap"></a>
<a id="2026-cdcp-ineligible-threshold"></a>

| Adjusted family net income          | CDCP coverage | Co-pay (of CDCP fee schedule) |
| ----------------------------------- | ------------- | ----------------------------- |
| **Under $70,000** (tier 1 cap)      | 100%          | 0%                            |
| **$70,000–$79,999** (tier 2 cap)    | 60%           | 40%                           |
| **$80,000–$89,999** (tier 3 cap)    | 40%           | 60%                           |
| **≥$90,000** (ineligible threshold) | Not eligible  | —                             |

Co-pay calculated against CDCP's federal fee schedule; if dentist charges above CDCP rate, patient pays the balance on top. Must not have private dental insurance. Renewal annually; 2026–27 benefit year opens June 2, 2026.

---

## 4. Provincial & Territorial Senior Income Supplements

### 4.1 Ontario

<a id="2026-on-gains-single"></a>

| Program   | Parameter              | 2026 value                      |
| --------- | ---------------------- | ------------------------------- |
| **GAINS** | Single monthly maximum | $90/month (July 2025–June 2026) |

<a id="2026-on-gains-couple"></a>

| Program   | Parameter              | 2026 value |
| --------- | ---------------------- | ---------- |
| **GAINS** | Couple monthly maximum | $180/month |

<a id="2026-on-gains-private-income-cutoff-single"></a>

| Program   | Parameter                            | 2026 value  |
| --------- | ------------------------------------ | ----------- |
| **GAINS** | Private income cutoff — single (max) | $4,320/year |

<a id="2026-on-gains-private-income-cutoff-couple"></a>

| Program   | Parameter                            | 2026 value  |
| --------- | ------------------------------------ | ----------- |
| **GAINS** | Private income cutoff — couple (max) | $8,640/year |

<a id="2026-on-oshptg"></a>

| Program                                                    | Parameter | 2026 value                                                                            |
| ---------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------- |
| **Ontario Senior Homeowners' Property Tax Grant (OSHPTG)** | Maximum   | $500; income ≤ $35,000 single / $45,000 couple for max; reduced 3.33% above threshold |

<a id="2026-on-oeptc-senior"></a>

| Program                    | Parameter      | 2026 value               |
| -------------------------- | -------------- | ------------------------ |
| **OEPTC — senior portion** | Annual maximum | $1,461/year (2% indexed) |

<a id="2026-on-oeptc-non-senior"></a>

| Program                        | Parameter      | 2026 value  |
| ------------------------------ | -------------- | ----------- |
| **OEPTC — non-senior portion** | Annual maximum | $1,283/year |

<a id="2026-on-senior-care-at-home-max"></a>

| Program                                    | Parameter      | 2026 value                                                                                                                        |
| ------------------------------------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Ontario Senior Care at Home Tax Credit** | Maximum credit | $1,500 (25% × eligible medical expenses up to $6,000); family income ≤ $35,000 for max; reduced 5% above $35,000; zero at $65,000 |

<a id="2026-on-ostc"></a>

| Program                             | Parameter  | 2026 value  |
| ----------------------------------- | ---------- | ----------- |
| **Ontario Sales Tax Credit (OSTC)** | Per person | $371/person |

<a id="2026-on-noec-single"></a>

| Program                                   | Parameter | 2026 value |
| ----------------------------------------- | --------- | ---------- |
| **Northern Ontario Energy Credit (NOEC)** | Single    | $185       |

<a id="2026-on-noec-family"></a>

| Program                                   | Parameter | 2026 value |
| ----------------------------------------- | --------- | ---------- |
| **Northern Ontario Energy Credit (NOEC)** | Family    | $285       |

### 4.2 Quebec

<a id="2026-qc-senior-assistance-credit"></a>

| Program                          | Parameter                | 2026 value                                                                                           |
| -------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| **Senior Assistance Tax Credit** | Per individual (age 70+) | $2,000 (max $4,000/couple); family income ≤ $27,835 single / $45,270 couple for max; 5.40% phase-out |

<a id="2026-qc-solidarity-credit-single"></a>

| Program                   | Parameter            | 2026 value                                                                                                                  |
| ------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Solidarity Tax Credit** | Single annual (est.) | $1,281/year (July 2026–June 2027 indexed est.); QST basic $356/person + $169 single supplement; phase-out 6% above ~$41,150 |

<a id="2026-qc-home-support-rate"></a>

| Program                                                    | Parameter | 2026 value                |
| ---------------------------------------------------------- | --------- | ------------------------- |
| **Tax Credit for Home-Support Services for Seniors (CMD)** | Rate      | 40% (up from 39% in 2025) |

<a id="2026-qc-home-support-cap-autonomous"></a>

| Program                      | Parameter                   | 2026 value                  |
| ---------------------------- | --------------------------- | --------------------------- |
| **CMD — autonomous seniors** | Annual eligible expense cap | $19,500 (max credit $7,800) |

<a id="2026-qc-home-support-cap-non-autonomous"></a>

| Program                          | Parameter                   | 2026 value                   |
| -------------------------------- | --------------------------- | ---------------------------- |
| **CMD — non-autonomous seniors** | Annual eligible expense cap | $25,500 (max credit $10,200) |

<a id="2026-qc-home-support-threshold"></a>

| Program                    | Parameter         | 2026 value                        |
| -------------------------- | ----------------- | --------------------------------- |
| **CMD — income threshold** | Family net income | $71,010 (2025; check Budget 2026) |

<a id="2026-qc-home-support-reduction-rate-non-autonomous"></a>

| Program                                   | Parameter              | 2026 value |
| ----------------------------------------- | ---------------------- | ---------- |
| **CMD — reduction rate (non-autonomous)** | Above income threshold | 3%         |

<a id="2026-qc-independent-living-rate"></a>

| Program                                       | Parameter | 2026 value                                              |
| --------------------------------------------- | --------- | ------------------------------------------------------- |
| **Independent Living Tax Credit for Seniors** | Rate      | 20% × eligible expenses above $250; refundable; age 70+ |

<a id="2026-qc-career-extension-max"></a>

| Program                                   | Parameter | 2026 value                                                                  |
| ----------------------------------------- | --------- | --------------------------------------------------------------------------- |
| **Tax Credit for Career Extension (60+)** | Maximum   | $1,750; phase-out above net income $56,500; min eligible work income $7,500 |

<a id="2026-qc-ramq-premium-max"></a>

| Program                                                   | Parameter                     | 2026 value                                                                               |
| --------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------- |
| **RAMQ prescription drug insurance — annual premium max** | 2025–26 (through Jun 30 2026) | $766; monthly deductible $22; coinsurance 30%; monthly max $103.69; annual max $1,244.28 |

### 4.3 British Columbia

<a id="2026-bc-senior-supplement-single"></a>

| Program                    | Parameter      | 2026 value   |
| -------------------------- | -------------- | ------------ |
| **BC Senior's Supplement** | Single monthly | $99.30/month |

<a id="2026-bc-senior-supplement-couple-each"></a>

| Program                    | Parameter             | 2026 value    |
| -------------------------- | --------------------- | ------------- |
| **BC Senior's Supplement** | Each member of couple | $110.25/month |

<a id="2026-bc-safer-rent-ceiling"></a>

| Program                                     | Parameter        | 2026 value                                                                                  |
| ------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------- |
| **SAFER (Shelter Aid for Elderly Renters)** | Max rent ceiling | $1,150/month; gross monthly income ≤ $3,333.33 ($40,000/yr); rent must exceed 30% of income |

<a id="2026-bc-home-owner-grant-senior"></a>

| Program                                   | Parameter   | 2026 value                                                                                                 |
| ----------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------- |
| **Home Owner Grant — Senior Enhancement** | Total grant | $1,045 (basic $570 + senior $475); assessed home value ≤ $2,175,000 (2025; check 2026 — NOT YET CONFIRMED) |

<a id="2026-bc-property-tax-deferral-rate"></a>

| Program                                      | Parameter | 2026 value                                                   |
| -------------------------------------------- | --------- | ------------------------------------------------------------ |
| **Property Tax Deferment for Seniors (55+)** | Coverage  | 100% deferral; simple interest at prime − 2%; no income test |

### 4.4 Alberta

<a id="2026-ab-seniors-benefit-single-monthly"></a>

| Program                           | Parameter              | 2026 value                |
| --------------------------------- | ---------------------- | ------------------------- |
| **Alberta Seniors Benefit (ASB)** | Single monthly maximum | $328/month (~$3,936/year) |

<a id="2026-ab-seniors-benefit-couple-monthly"></a>

| Program                           | Parameter              | 2026 value                |
| --------------------------------- | ---------------------- | ------------------------- |
| **Alberta Seniors Benefit (ASB)** | Couple monthly maximum | $493/month (~$5,916/year) |

<a id="2026-ab-seniors-benefit-threshold-single"></a>

| Program                           | Parameter          | 2026 value                                                          |
| --------------------------------- | ------------------ | ------------------------------------------------------------------- |
| **ASB income threshold — single** | Net income ceiling | $32,690 (Budget 2026-27 effective July 1, 2026; previously $34,770) |

<a id="2026-ab-seniors-benefit-threshold-couple"></a>

| Program                           | Parameter          | 2026 value                                                          |
| --------------------------------- | ------------------ | ------------------------------------------------------------------- |
| **ASB income threshold — couple** | Net income ceiling | $53,800 (Budget 2026-27 effective July 1, 2026; previously $56,820) |

<a id="2026-ab-seniors-benefit-reduction-rate-homeowner"></a>

| Program                            | Parameter            | 2026 value |
| ---------------------------------- | -------------------- | ---------- |
| **ASB reduction rate — homeowner** | Rate above threshold | 15.60%     |

<a id="2026-ab-snas-max"></a>

| Program                                         | Parameter      | 2026 value                                 |
| ----------------------------------------------- | -------------- | ------------------------------------------ |
| **Special Needs Assistance for Seniors (SNAS)** | Annual maximum | $5,872/year; same income thresholds as ASB |

### 4.5 Saskatchewan

<a id="2026-sk-sip-single"></a>

| Program                            | Parameter              | 2026 value |
| ---------------------------------- | ---------------------- | ---------- |
| **Saskatchewan Income Plan (SIP)** | Single monthly maximum | $360/month |

<a id="2026-sk-sip-couple-each"></a>

| Program                            | Parameter             | 2026 value                                                                                |
| ---------------------------------- | --------------------- | ----------------------------------------------------------------------------------------- |
| **Saskatchewan Income Plan (SIP)** | Each spouse in couple | $325/month ($650/month combined); max rates effective July 2023, no announced 2026 change |

<a id="2026-sk-seniors-drug-plan-cap"></a>

| Program                             | Parameter      | 2026 value                                                                                 |
| ----------------------------------- | -------------- | ------------------------------------------------------------------------------------------ |
| **Seniors' Drug Plan — per Rx cap** | Co-pay maximum | $25/Rx (income ≤ $79,487 from 2024 income); $200 semi-annual deductible for GIS recipients |

### 4.6 Manitoba

<a id="2026-mb-55plus-single-quarterly"></a>

| Program     | Parameter        | 2026 value                  |
| ----------- | ---------------- | --------------------------- |
| **55 PLUS** | Single quarterly | $161.80/quarter ($647/year) |

<a id="2026-mb-55plus-couple-each-quarterly"></a>

| Program     | Parameter                       | 2026 value                                               |
| ----------- | ------------------------------- | -------------------------------------------------------- |
| **55 PLUS** | Each spouse in couple quarterly | $173.90/quarter ($695.60/year each; ~$1,392/year couple) |

<a id="2026-mb-55plus-junior-cutoff-single"></a>

| Program                               | Parameter     | 2026 value  |
| ------------------------------------- | ------------- | ----------- |
| **55 PLUS junior component — single** | Income cutoff | ≤ $9,746.40 |

<a id="2026-mb-55plus-junior-cutoff-couple"></a>

| Program                               | Parameter     | 2026 value   |
| ------------------------------------- | ------------- | ------------ |
| **55 PLUS junior component — couple** | Income cutoff | ≤ $16,255.20 |

<a id="2026-mb-school-tax-rebate-max"></a>

| Program                        | Parameter | 2026 value                    |
| ------------------------------ | --------- | ----------------------------- |
| **Seniors' School Tax Rebate** | Maximum   | up to $470 (2024; check 2026) |

### 4.7 New Brunswick

<a id="2026-nb-low-income-seniors-benefit"></a>

| Program                         | Parameter       | 2026 value                                                                        |
| ------------------------------- | --------------- | --------------------------------------------------------------------------------- |
| **Low-Income Seniors' Benefit** | Annual lump sum | $629/year (up from $616 in 2025); receipt of GIS/Allowance in prior year required |

<a id="2026-nb-property-tax-allowance-max"></a>

| Program                                | Parameter | 2026 value                                           |
| -------------------------------------- | --------- | ---------------------------------------------------- |
| **Property Tax Allowance for Seniors** | Maximum   | $400 (graduated by income; max for income ≤ $25,756) |

### 4.8 Nova Scotia

<a id="2026-ns-seniors-care-grant"></a>

| Program                | Parameter | 2026 value                                                                            |
| ---------------------- | --------- | ------------------------------------------------------------------------------------- |
| **Seniors Care Grant** | Annual    | $750/year; income ≤ ~$37,500 single / ~$45,000 couple (2025–26; check NS for 2026–27) |

<a id="2026-ns-property-tax-rebate-max"></a>

| Program                             | Parameter | 2026 value                                                                    |
| ----------------------------------- | --------- | ----------------------------------------------------------------------------- |
| **Property Tax Rebate for Seniors** | Maximum   | 50% of prior year property tax, max $800; income ≤ $42,448 (2025; check 2026) |

<a id="2026-ns-pharmacare-premium-max"></a>

| Program                         | Parameter              | 2026 value                                                                 |
| ------------------------------- | ---------------------- | -------------------------------------------------------------------------- |
| **Seniors' Pharmacare Program** | Annual premium maximum | $424 (waived if income < $22,986 single / $26,817 couple or GIS recipient) |

<a id="2026-ns-pharmacare-copay-pct"></a>

| Program                               | Parameter  | 2026 value |
| ------------------------------------- | ---------- | ---------- |
| **Seniors' Pharmacare — co-pay rate** | Percentage | 30%        |

<a id="2026-ns-pharmacare-copay-cap-annual"></a>

| Program                                     | Parameter             | 2026 value |
| ------------------------------------------- | --------------------- | ---------- |
| **Seniors' Pharmacare — annual co-pay cap** | Maximum annual co-pay | $382       |

### 4.9 Prince Edward Island

<a id="2026-pe-seniors-independence"></a>

| Program                             | Parameter      | 2026 value                                                                                                                                             |
| ----------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Seniors Independence Initiative** | Annual maximum | up to $1,800/year for in-home support services; net household income ≤ $32,753 single / $41,970 couple; assets ≤ $100,000 excl. principal home/vehicle |

### 4.10 Newfoundland & Labrador

<a id="2026-nl-seniors-benefit-max"></a>

| Program                 | Parameter      | 2026 value                                                                              |
| ----------------------- | -------------- | --------------------------------------------------------------------------------------- |
| **NL Seniors' Benefit** | Annual maximum | ~$1,551/year (2025–26, indexed to CPI from July 2025; 2026–27 amount NOT YET PUBLISHED) |

<a id="2026-nl-seniors-benefit-cutoff"></a>

| Program                 | Parameter          | 2026 value                                             |
| ----------------------- | ------------------ | ------------------------------------------------------ |
| **NL Seniors' Benefit** | Income for maximum | $30,078; phase-out 11.66% between $30,078 and ~$43,380 |

<a id="2026-nl-income-supplement-single-max"></a>

| Program                         | Parameter      | 2026 value                                                                |
| ------------------------------- | -------------- | ------------------------------------------------------------------------- |
| **NL Income Supplement (NLIS)** | Single maximum | $520/year; family net income ≤ $20,000 for max; phase-out 9% from $40,000 |

<a id="2026-nl-income-supplement-spouse"></a>

| Program                      | Parameter  | 2026 value |
| ---------------------------- | ---------- | ---------- |
| **NLIS — spouse supplement** | Additional | +$69       |

<a id="2026-nl-income-supplement-per-child"></a>

| Program                         | Parameter  | 2026 value                             |
| ------------------------------- | ---------- | -------------------------------------- |
| **NLIS — per child supplement** | Additional | +$231 per child; +$231 if DTC eligible |

### 4.11 Yukon

<a id="2026-yt-seniors-income-supplement"></a>

| Program                             | Parameter       | 2026 value                                                            |
| ----------------------------------- | --------------- | --------------------------------------------------------------------- |
| **Yukon Seniors Income Supplement** | Monthly maximum | $273.05/month (2025; 2026 indexed; must receive OAS+GIS or Allowance) |

<a id="2026-yt-pioneer-utility-grant-whitehorse"></a>

| Program                                | Parameter      | 2026 value                                                      |
| -------------------------------------- | -------------- | --------------------------------------------------------------- |
| **Pioneer Utility Grant — Whitehorse** | Annual maximum | $1,340.94/year (2025 max; 2026 amount typically announced July) |

<a id="2026-yt-pioneer-utility-grant-outside"></a>

| Program                                        | Parameter      | 2026 value                                                      |
| ---------------------------------------------- | -------------- | --------------------------------------------------------------- |
| **Pioneer Utility Grant — outside Whitehorse** | Annual maximum | $1,448.21/year (2025 max; 2026 amount typically announced July) |

### 4.12 Northwest Territories

<a id="2026-nt-scsb"></a>

| Program                                         | Parameter | 2026 value                                           |
| ----------------------------------------------- | --------- | ---------------------------------------------------- |
| **Senior Citizen Supplementary Benefit (SCSB)** | Monthly   | ~$196/month (2025–26; indexed; GIS receipt required) |

<a id="2026-nt-shhs-zone1"></a>

| Program                                         | Parameter        | 2026 value                            |
| ----------------------------------------------- | ---------------- | ------------------------------------- |
| **Senior Home Heating Subsidy (SHHS) — Zone 1** | Monthly / annual | $460/month (max $3,680/year, Sep–Apr) |

<a id="2026-nt-shhs-zone2"></a>

| Program           | Parameter        | 2026 value                   |
| ----------------- | ---------------- | ---------------------------- |
| **SHHS — Zone 2** | Monthly / annual | $560/month (max $4,480/year) |

<a id="2026-nt-shhs-zone3"></a>

| Program           | Parameter        | 2026 value                   |
| ----------------- | ---------------- | ---------------------------- |
| **SHHS — Zone 3** | Monthly / annual | $750/month (max $6,000/year) |

### 4.13 Nunavut

<a id="2026-nu-scsb"></a>

| Program                                         | Parameter | 2026 value                                 |
| ----------------------------------------------- | --------- | ------------------------------------------ |
| **Senior Citizen Supplementary Benefit (SCSB)** | Monthly   | $300/month (GIS receipt required; age 60+) |

<a id="2026-nu-senior-fuel-subsidy-100pct-cap"></a>

| Program                                | Parameter      | 2026 value |
| -------------------------------------- | -------------- | ---------- |
| **Senior Fuel Subsidy — 100% subsidy** | Income ceiling | ≤ $75,000  |

<a id="2026-nu-senior-fuel-subsidy-50pct-cap"></a>

| Program                               | Parameter      | 2026 value |
| ------------------------------------- | -------------- | ---------- |
| **Senior Fuel Subsidy — 50% subsidy** | Income ceiling | ≤ $100,000 |

---

## 5. Provincial / Territorial Age Amounts, Pension Income Amounts, and DTC Bases (2026)

Provincial DTC credit rate = lowest provincial personal tax rate. Provincial age amounts have similar phase-out mechanics but use province-specific thresholds (Ontario phase-out starts at ~$45,522 like federal; BC at ~$40,000; Alberta at ~$45,000).

| Jurisdiction            | Age Amount (65+) | Pension Income Amount | Provincial DTC Base |
| ----------------------- | ---------------- | --------------------- | ------------------- |
| **Federal (reference)** | $9,208 (see §3)  | $2,000                | $10,341             |

<a id="2026-bc-age-amount"></a>
<a id="2026-bc-pension-income-amount"></a>
<a id="2026-bc-dtc"></a>
| **British Columbia** | $5,824 | $1,000 | $9,427 |
<a id="2026-ab-age-amount"></a>
<a id="2026-ab-pension-income-amount"></a>
<a id="2026-ab-dtc"></a>
| **Alberta** | $6,151 | $1,667 | $16,238 |
<a id="2026-sk-age-amount"></a>
<a id="2026-sk-pension-income-amount"></a>
<a id="2026-sk-dtc"></a>
| **Saskatchewan** | $5,727 (federal-style indexation) | $1,000 | $10,949 |
<a id="2026-mb-age-amount"></a>
<a id="2026-mb-pension-income-amount"></a>
<a id="2026-mb-dtc"></a>
| **Manitoba** | $3,728 (not indexed since 2025) | $1,000 | $6,180 |
<a id="2026-on-age-amount"></a>
<a id="2026-on-pension-income-amount"></a>
<a id="2026-on-dtc"></a>
| **Ontario** | $6,342 | $1,796 | $10,148 |
<a id="2026-qc-age-amount"></a>
<a id="2026-qc-pension-income-amount"></a>
<a id="2026-qc-dtc"></a>
| **Quebec** | $3,470 + $1,225 age-65 living-alone supplement (Schedule B; rate 14%) | $3,470 (Quebec pension amount) | $3,449 (line 376 of TP-1) |
<a id="2026-nb-age-amount"></a>
<a id="2026-nb-pension-income-amount"></a>
<a id="2026-nb-dtc"></a>
| **New Brunswick** | $5,978 | $1,000 | $9,427 |
<a id="2026-ns-age-amount"></a>
<a id="2026-ns-pension-income-amount"></a>
<a id="2026-ns-dtc"></a>
| **Nova Scotia** | $4,141 (no indexation prior to 2025; check 2026 NS budget) | $1,173 | $7,341 |
<a id="2026-pe-age-amount"></a>
<a id="2026-pe-pension-income-amount"></a>
<a id="2026-pe-dtc"></a>
| **Prince Edward Island** | $4,679 | $1,000 | $7,412 |
<a id="2026-nl-age-amount"></a>
<a id="2026-nl-pension-income-amount"></a>
<a id="2026-nl-dtc"></a>
| **Newfoundland & Labrador** | $7,109 (1.1% indexation 2026) | $1,000 | $7,237 |
<a id="2026-yt-age-amount"></a>
<a id="2026-yt-pension-income-amount"></a>
<a id="2026-yt-dtc"></a>
| **Yukon** | Follows federal ($9,208) | Follows federal ($2,000) | Follows federal ($10,341) |
<a id="2026-nt-age-amount"></a>
<a id="2026-nt-pension-income-amount"></a>
<a id="2026-nt-dtc"></a>
| **Northwest Territories** | $7,956 (2.0% indexation 2026) | $1,000 | $13,037 |
<a id="2026-nu-age-amount"></a>
<a id="2026-nu-pension-income-amount"></a>
<a id="2026-nu-dtc"></a>
| **Nunavut** | $14,068 (highest in Canada) | $2,000 | $15,196 |

---

## 6. Provincial Property Tax & Rent Relief Programs (Highlights)

Parameters for key programs are anchored in §4 above. Cross-references noted here.

| Jurisdiction | Program                                                                          | 2026 max                                      | Income test                                                           |
| ------------ | -------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------- |
| **Ontario**  | Ontario Senior Homeowners' Property Tax Grant (OSHPTG) ([§4.1](#2026-on-oshptg)) | $500                                          | Income ≤ $35,000 single / $45,000 couple for max; reduced 3.33% above |
| **Ontario**  | OEPTC senior portion ([§4.1](#2026-on-oeptc-senior))                             | $1,461/year                                   | Phase-out at 2% above ~$31,000 single / $50,000 couple                |
| **Ontario**  | Senior Care at Home Tax Credit ([§4.1](#2026-on-senior-care-at-home-max))        | $1,500                                        | Family income ≤ $35,000 for max; reduced 5% above; zero at $65,000    |
| **Quebec**   | Grant for seniors to offset municipal tax increase                               | Variable                                      | For residents 65+ with significant property value increase            |
| **BC**       | Home Owner Grant — Senior Enhancement ([§4.3](#2026-bc-home-owner-grant-senior)) | $1,045                                        | Assessed home value ≤ $2,175,000 (2025; check 2026)                   |
| **BC**       | Property Tax Deferment for Seniors (55+)                                         | 100% deferral                                 | No income test; interest at prime − 2%                                |
| **Manitoba** | Education Property Tax Credit — senior enhancement                               | Additional senior amount on top of $525 basic | Manitoba income tax return                                            |
| **Manitoba** | Seniors' School Tax Rebate                                                       | Up to $470 (2024; check 2026)                 | Phase-out for incomes >$40,000                                        |
| **NS**       | Property Tax Rebate for Seniors ([§4.8](#2026-ns-property-tax-rebate-max))       | 50% of prior year; max $800                   | Income ≤ $42,448 (2025; check 2026)                                   |
| **NB**       | Property Tax Allowance ([§4.7](#2026-nb-property-tax-allowance-max))             | $400                                          | Combined household income ≤ $25,756 for max                           |
| **PEI**      | Property Tax Deferral for Seniors                                                | Defer property taxes                          | Seniors with limited income                                           |
| **NL**       | Home Heating Supplement                                                          | Up to $500                                    | Low-income heating costs                                              |

---

## 7. Provincial / Territorial Drug Plan Deductibles & Copayments for Seniors (2026)

| Province/Territory | Plan structure                                                            | Senior parameters                                                                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ontario**        | Ontario Drug Benefit (ODB), auto at 65                                    | $100 deductible + up to $6.11 co-pay per prescription. Seniors Co-Payment Program waives deductible and reduces co-pay to $2/Rx for single income ≤ $25,000 or couple ≤ $41,500                                     |
| **Quebec**         | Public Prescription Drug Insurance (RAMQ), mandatory at 65 unless private | Annual premium $0–$766 (2025–26) via Schedule K ([§4.2](#2026-qc-ramq-premium-max)); monthly deductible $22; coinsurance 30%; monthly max $103.69; annual max $1,244.28. Free for GIS recipients at ≥94% of max GIS |

<a id="2026-sk-seniors-drug-plan-cap-ref"></a>

| Province/Territory | Plan structure                                                        | Senior parameters                                                                                                                  |
| ------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **BC**             | Fair PharmaCare, income-based                                         | Family deductible 0–4% of net income; PharmaCare pays 70% after deductible (75% for members born ≤1939); 100% after family maximum |
| **Alberta**        | Coverage for Seniors (auto at 65)                                     | 30% co-pay; max $25/Rx; no deductible; admin by Alberta Blue Cross                                                                 |
| **Saskatchewan**   | Seniors' Drug Plan ([§4.5](#2026-sk-seniors-drug-plan-cap))           | $25 cap per Rx (income ≤ $79,487); $200 semi-annual deductible for GIS recipients                                                  |
| **Manitoba**       | Manitoba Pharmacare — universal, income-based deductible              | Annual deductible ~6.49% × adjusted family income; 100% coverage after deductible                                                  |
| **NB**             | NB Drug Plans — Plan I (seniors)                                      | Annual premium $0–$2,000 by income ($0 for GIS recipients); co-pay max $30/Rx                                                      |
| **NS**             | Seniors' Pharmacare Program ([§4.8](#2026-ns-pharmacare-premium-max)) | Annual premium up to $424; 30% co-pay; annual co-pay max $382                                                                      |
| **PEI**            | Seniors Drug Program (auto at 65)                                     | $8.25 + $7.69 professional fee per Rx                                                                                              |
| **NL**             | 65Plus Plan                                                           | Auto-issued to OAS+GIS recipients; co-pay up to $6 dispensing fee                                                                  |
| **Yukon**          | Yukon Pharmacare & Chronic Disease Program (65+, auto)                | Largely no co-pay; full coverage of formulary drugs for seniors                                                                    |
| **NWT**            | Extended Health Benefits for Seniors (60+)                            | Comprehensive drug, dental, vision coverage; no premiums                                                                           |
| **Nunavut**        | Extended Health Benefits for Seniors                                  | Full drug coverage for seniors 60+                                                                                                 |

---

## 8. OAS Recovery Tax Interaction with Provincial Benefits

- **OAS recovery tax 2026**: 15% × max(0, individual net world income − $95,323), capped at total OAS received. Full clawback at ~$152,062 (ages 65–74) / ~$157,923 (75+). The canonical 2026 OAS recovery threshold anchor is [`2026-fed-oas-recovery-threshold`](#2026-fed-oas-recovery-threshold) in this file. For OAS-program-specific parameters, see [`18-pensions-2026.md#2026-oas-clawback-threshold`](./18-pensions-2026.md#2026-oas-clawback-threshold) — both anchors point at the same value ($95,323). Engine code in an OAS-program context should cite `18-pensions-2026.md#2026-oas-clawback-threshold`; engine code in a federal-tax-credit context may cite `19-benefits-tax-credits-2026.md#2026-fed-oas-recovery-threshold`.
- **OAS is included in line-15000 income** for most provincial senior supplement calculations (BC SAFER excludes it explicitly; Ontario GAINS, NB LISB, Quebec Senior Assistance, and provincial drug plans typically use net income from the tax return which includes OAS).
- **GIS, Allowance, Allowance for Survivor are NOT in net income** for OAS recovery tax (they are non-taxable). They are also typically excluded from provincial private-income tests (Ontario GAINS, BC Senior's Supplement) but are reflected through the GIS amount linkage.

---

## 9. Ontario Trillium Benefit (OTB) — Full 2026–27 (2% Indexation Projected)

Ontario Trillium Benefit combines three credits paid monthly (on the 10th if annual benefit > $360; otherwise single lump sum in July):

- **OEPTC** — see anchor [`2026-on-oeptc-senior`](#2026-on-oeptc-senior) ($1,461 senior) and [`2026-on-oeptc-non-senior`](#2026-on-oeptc-non-senior) ($1,283 non-senior). Plus $285 for reserve/long-term care home.
- **OSTC** — see anchor [`2026-on-ostc`](#2026-on-ostc) ($371/person including each child under 19).
- **NOEC** — see anchors [`2026-on-noec-single`](#2026-on-noec-single) ($185 single) and [`2026-on-noec-family`](#2026-on-noec-family) ($285 family). Northern Ontario districts only.

Phase-out for OEPTC at 2% above ~$31,000 single / ~$50,000 couple. OSTC phase-out at 4% above ~$45,521.

---

## 10. NOT YET CONFIRMED (as of research date 2026-05-10)

> The values below are NOT YET PUBLISHED by their administering authority as of the 2026-05-10 research date. Engine code (or a future auto-fetcher) MUST treat these as projections, not authoritative figures, until the official source is released.

- **CGEB July 2026–June 2027 quarterly amounts** — CRA publishes around June 2026 with the transition. Use the 25% increase projection (single ~$666/yr, couple ~$873/yr, per child ~$230/yr) as a fallback.
- **Provincial 2026–27 benefit-year figures** that are typically announced at the start of the July–June benefit year: Ontario GAINS, NL Seniors' Benefit, Yukon Pioneer Utility Grant, NS Property Tax Rebate income thresholds, BC SAFER rent ceiling.
- **Alberta Seniors Benefit threshold change** — Budget 2026-27 PROPOSAL (announced March 2026), effective July 1, 2026. Until Royal Assent, prior thresholds (~$34,770 single / $56,820 couple) technically remain in force. Public Interest Alberta estimates 6,000–8,000 seniors will lose eligibility under the new thresholds.
- **Quebec prescription drug premium thresholds** for July 2026 onward not finalized. Current $766 max from July 2025 in effect through June 30, 2026.
- **Quebec Solidarity Tax Credit amounts** for July 2026–June 2027 — indexation publication pending.
- **CDB taxability and clawback treatment** — 2024 Fall Economic Statement promised to exempt CDB from income under the Income Tax Act for benefit-test purposes (provincial disability supports, GIS, OAS clawback). Exempting legislation NOT yet confirmed enacted as of research date. Alberta has reportedly clawed back AISH against CDB receipt; treat CDB as social assistance (taxable) for now and re-evaluate post-legislation.
- **Several provincial programs that have NOT indexed in years** — NS Seniors' Pharmacare premium thresholds, MB 55 PLUS thresholds, SK SIP maximums (frozen since July 2023 at $360/$650). Do NOT assume CPI indexation for these unless a published increase has been announced.
- **VAC 2026 rate cards** — several precise 2026 amounts (PSC max at 100%, IRB minimum salary) require confirmation against VAC's published 2026 rate cards. WVA rates in particular vary by veteran category.
- **EI temporary measures** (waiting-period waiver, severance non-deduction) expire October 10, 2026 unless extended. For 2027 retirement-planning models, revert to standard rules.
- **BCCATC eliminated** — final payment April 2025 (BC repealed provincial carbon tax effective April 1, 2025). RetireOps engine should remove BCCATC from BC retirement models for 2026 onward. (This is CONFIRMED removal, not "not yet confirmed" — included here for engine-team visibility.)

---

## 11. Caveats

1. **Research-date limitation:** As of May 10, 2026, several 2026 figures have not been finalized or published by their administering authorities. Specifically: (a) the July 2026 – June 2027 OAS/GIS/Allowance quarterly amounts (Service Canada publishes quarterly in late June); (b) the post-July 2026 CGEB quarterly amounts (CRA publishes around June 2026 with the transition); (c) several provincial 2026–27 benefit-year figures (Ontario GAINS, NL Seniors' Benefit, Yukon PUG, NS Property Tax Rebate income thresholds, BC SAFER rent ceiling) that are typically announced at the start of the July–June benefit year. Implementation should use the most recent published value with a CPI-projection (2.0%) fallback and refresh in July 2026.

2. **Alberta Seniors Benefit threshold change** is a Budget 2026-27 _proposal_ (announced March 2026) that takes effect July 1, 2026. Until the budget receives Royal Assent, the prior thresholds (~$34,770 single / $56,820 couple) technically remain in force. Public Interest Alberta estimates 6,000–8,000 seniors will lose eligibility under the new thresholds.

3. **Several provincial programs have not indexed in years** — e.g., NS Seniors' Pharmacare premium thresholds, MB 55 PLUS thresholds, SK SIP maximums (frozen since July 2023 at $360/$650). RetireOps should not assume CPI indexation for these unless a published increase has been announced.

4. **CDB taxability and clawback treatment is in flux.** The 2024 Fall Economic Statement promised to exempt CDB from "income" under the Income Tax Act for benefit-test purposes (provincial disability supports, GIS, OAS clawback). As of the research date, this exempting legislation has not been confirmed enacted. Alberta has reportedly clawed back AISH against CDB receipt; most provinces have published intent NOT to claw back, but the exact treatment varies. For retirement modeling of pre-65 DTC-holders, treat the CDB as taxable income for now and flag for re-evaluation post-legislation.

5. **VAC rates** in the table represent the January 1, 2026 indexation but several precise 2026 amounts (PSC max at 100%, IRB minimum salary) require confirmation against VAC's published 2026 rate cards. WVA rates in particular vary by veteran category (single, married with dependents, etc.) and require lookup against the WVA rate table.

6. **Pension splitting and the new lower 14% tax rate:** the value of the $2,000 Pension Income Amount drops from $290 (at 14.5% in 2025) to $280 (at 14% in 2026). RetireOps should not assume static credit values year-over-year — the rate change matters even though the dollar amount of the credit base is unchanged.

7. **Quebec's prescription drug premium thresholds and amounts** for July 2026 onward are not finalized at research date. The current $766 max (from July 2025) is in effect through June 30, 2026.

8. **EI temporary measures (waiting-period waiver, severance non-deduction)** expire October 10, 2026 unless extended. For 2027 retirement-planning models, revert to the standard rules.

9. **Third-party sources flagged.** Some third-party sources include 2026 projections that may not match the authoritative provincial/federal publications. Whenever a third-party number conflicts with an official source (canada.ca, ontario.ca, gov.bc.ca, alberta.ca, novascotia.ca, gov.nl.ca, revenuquebec.ca, ramq.gouv.qc.ca, veterans.gc.ca, etc.), defer to the official source. The figures in this document prioritize official-source numbers but include third-party 2026 estimates where official figures were not yet published.

10. **Implementation note on stacking:** Most provincial senior supplements stack on top of OAS+GIS without reducing them, but income tests can interact. Specifically: (a) Ontario Senior Care at Home Tax Credit and the federal METC can both be claimed on the same eligible expense; (b) Quebec home-support credit and Quebec medical-expense credit cannot both claim the same expense; (c) Federal HATC and MHRTC cannot be claimed for the same expense; (d) For 2026, federal HATC and federal METC cannot both claim the same expense (Budget 2024 change). RetireOps's stacking logic should enforce these mutual-exclusivity rules at expense level, not at credit level.
