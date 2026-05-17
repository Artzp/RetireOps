# 05 - Government Benefits Specification

> **📍 Current 2026 parameter values:** This document is the **rules layer** — it covers eligibility, calculation formulas, age-adjustment mechanics, and worked examples (using 2024 figures for historical context). For **current 2026 parameter values** that the calculation engine consumes (CPP YMPE, OAS quarterly amounts, GIS thresholds, clawback amounts, etc.), see [`18-pensions-2026.md`](./18-pensions-2026.md). Engine-code citations for 2026 values SHOULD link to the dated-parameter file, not to this file.
>
> This split was decided 2026-05-10 (v4.5 Phase 17, Hybrid C integration strategy).

## Overview

Canadian government retirement benefits form a significant income source for most retirees. The software must accurately model CPP/QPP, OAS, and GIS with their eligibility rules, timing options, and adjustment factors.

---

## Canada Pension Plan (CPP) / Quebec Pension Plan (QPP)

### Eligibility

| Requirement              | Description                                                      |
| ------------------------ | ---------------------------------------------------------------- |
| Minimum age              | 60 years                                                         |
| Maximum start age        | 70 years (can defer but no additional benefit increase after 70) |
| Contribution requirement | At least one valid contribution                                  |
| Standard start age       | 65 years                                                         |

> **Current parameters:** The table below shows 2024 example values (preserved for rules-teaching context). For 2026 CPP/QPP parameter values, see [`18-pensions-2026.md`](./18-pensions-2026.md) — specifically anchors [`#2026-cpp-max-retirement-pension`](./18-pensions-2026.md#2026-cpp-max-retirement-pension), [`#2026-cpp-ympe`](./18-pensions-2026.md#2026-cpp-ympe), [`#2026-cpp-yampe`](./18-pensions-2026.md#2026-cpp-yampe), and [`#2026-qpp-max-retirement-pension`](./18-pensions-2026.md#2026-qpp-max-retirement-pension).

### Benefit Amounts (2024)

| Metric                | CPP       | QPP       |
| --------------------- | --------- | --------- |
| Maximum monthly at 65 | $1,364.60 | $1,364.60 |
| Maximum annual at 65  | $16,375   | $16,375   |
| Average monthly       | ~$815     | ~$815     |

<a id="cpp-adjustment-factors"></a>

### Early/Late Adjustment Factors

| Start Age | Monthly Adjustment | Annual Adjustment | Total Adjustment |
| --------- | ------------------ | ----------------- | ---------------- |
| 60        | -0.60%             | -7.2%             | -36.0%           |
| 61        | -0.60%             | -7.2%             | -28.8%           |
| 62        | -0.60%             | -7.2%             | -21.6%           |
| 63        | -0.60%             | -7.2%             | -14.4%           |
| 64        | -0.60%             | -7.2%             | -7.2%            |
| 65        | 0%                 | 0%                | 0% (standard)    |
| 66        | +0.70%             | +8.4%             | +8.4%            |
| 67        | +0.70%             | +8.4%             | +16.8%           |
| 68        | +0.70%             | +8.4%             | +25.2%           |
| 69        | +0.70%             | +8.4%             | +33.6%           |
| 70        | +0.70%             | +8.4%             | +42.0%           |

### Calculation Formula

```
// User provides expected CPP at age 65 (from Service Canada statement)
cpp_at_65 = user_input.expected_cpp_at_65

// Adjust for chosen start age
IF start_age < 65:
  months_early = (65 - start_age) × 12
  adjustment = months_early × -0.006  // -0.6% per month
ELSE IF start_age > 65:
  months_late = (start_age - 65) × 12
  adjustment = months_late × 0.007   // +0.7% per month
ELSE:
  adjustment = 0

cpp_annual = cpp_at_65 × (1 + adjustment)

// Example: CPP at 65 = $12,000
// Taking at 60: $12,000 × (1 - 0.36) = $7,680/year
// Taking at 70: $12,000 × (1 + 0.42) = $17,040/year
```

### Inflation Indexing

CPP benefits are indexed to the Consumer Price Index (CPI) annually in January.

```
cpp_year_n = cpp_year_1 × (1 + inflation_rate)^(n-1)
```

### CPP Post-Retirement Benefit (PRB)

If continuing to work while receiving CPP (under age 70), additional contributions create PRBs.

```
// Simplified: assume PRB accrual if working while receiving CPP
IF receiving_cpp AND has_employment_income AND age < 70:
  annual_prb_accrual = employment_income × 0.01  // Approximately
  // PRBs are added to CPP in following January
```

### Child-Rearing Dropout Provision

Periods of low/no earnings while raising children under 7 can be excluded from CPP calculation, improving the benefit.

```
// For user input purposes, ask:
// "Were there years you had low earnings due to raising children under 7?"
// IF yes: user's CPP estimate should already account for this
// OR provide adjustment factor (advanced feature)
```

### CPP Survivor Benefits

```
// If spouse dies, survivor may receive:
survivor_benefit = MIN(
  deceased_cpp × 0.60,  // 60% of deceased's benefit
  cpp_maximum × 0.60
)

// Combined with own CPP, capped at maximum
combined_cpp = MIN(
  own_cpp + survivor_benefit,
  cpp_maximum
)
```

---

## Old Age Security (OAS)

### Eligibility

| Requirement      | Description                               |
| ---------------- | ----------------------------------------- |
| Minimum age      | 65 years                                  |
| Maximum deferral | 70 years                                  |
| Residency        | Canadian citizen or legal resident        |
| Full benefit     | 40 years residence in Canada after age 18 |
| Partial benefit  | 10+ years residence (prorated)            |

> **Current parameters:** The table below shows 2024 example values (preserved for rules-teaching context). For 2026 OAS quarterly amounts, see [`18-pensions-2026.md`](./18-pensions-2026.md) — specifically anchors [`#2026-oas-q1-amount-65to74`](./18-pensions-2026.md#2026-oas-q1-amount-65to74), [`#2026-oas-q2-amount-65to74`](./18-pensions-2026.md#2026-oas-q2-amount-65to74), and the 75+ counterparts.

### Benefit Amounts (2024)

| Category                | Monthly | Annual  |
| ----------------------- | ------- | ------- |
| Maximum OAS (age 65-74) | ~$713   | ~$8,560 |
| Maximum OAS (age 75+)   | ~$785   | ~$9,420 |

**Note:** OAS increased by 10% at age 75 (since July 2022)

### Deferral Adjustment

| Start Age | Monthly Increase | Total Increase |
| --------- | ---------------- | -------------- |
| 65        | 0%               | 0%             |
| 66        | +0.60%           | +7.2%          |
| 67        | +0.60%           | +14.4%         |
| 68        | +0.60%           | +21.6%         |
| 69        | +0.60%           | +28.8%         |
| 70        | +0.60%           | +36.0%         |

### Calculation Formula

```
// Full OAS calculation
IF years_of_residence >= 40:
  oas_entitlement = full_oas_amount
ELSE IF years_of_residence >= 10:
  oas_entitlement = full_oas_amount × (years_of_residence / 40)
ELSE:
  oas_entitlement = 0  // Not eligible

// Deferral adjustment
IF start_age > 65:
  months_deferred = (start_age - 65) × 12
  deferral_increase = months_deferred × 0.006  // +0.6% per month
  oas_annual = oas_entitlement × (1 + deferral_increase)
ELSE:
  oas_annual = oas_entitlement

// Age 75+ bonus
IF current_age >= 75:
  oas_annual = oas_annual × 1.10
```

> **Current parameters:** The table below shows 2024 example values (preserved for rules-teaching context). For the 2026 OAS recovery-tax thresholds (clawback floor $95,323; full-clawback ceilings $154,753 for 65–74 / $160,696 for 75+ per Q2 2026), see [`18-pensions-2026.md#2026-oas-clawback-threshold`](./18-pensions-2026.md#2026-oas-clawback-threshold).

### OAS Clawback (Recovery Tax)

| Parameter               | 2024 Value            |
| ----------------------- | --------------------- |
| Clawback threshold      | $90,997               |
| Full clawback threshold | ~$148,000 (age 65-74) |
| Full clawback threshold | ~$154,000 (age 75+)   |
| Recovery rate           | 15%                   |

```
// Clawback calculation
IF net_income > clawback_threshold:
  clawback_amount = (net_income - clawback_threshold) × 0.15
  oas_received = MAX(0, oas_annual - clawback_amount)
ELSE:
  oas_received = oas_annual

// Net income includes:
// - All taxable income
// - Dividend gross-up amounts
// - Taxable capital gains (50% of gains)

// Net income EXCLUDES:
// - TFSA withdrawals
// - Non-taxable income (inheritance, lottery, etc.)
```

### OAS Indexing

OAS is indexed quarterly to CPI (January, April, July, October).

```
// For projection purposes, use annual inflation assumption
oas_year_n = oas_year_1 × (1 + inflation_rate)^(n-1)
```

---

## Guaranteed Income Supplement (GIS)

### Eligibility

| Requirement  | Description                      |
| ------------ | -------------------------------- |
| Age          | 65+                              |
| Prerequisite | Must be receiving OAS            |
| Income test  | Very low income (see thresholds) |
| Residency    | Residing in Canada               |

> **Current parameters:** The table below shows 2024 example values (preserved for rules-teaching context). For 2026 GIS quarterly amounts and income cut-offs, see [`18-pensions-2026.md`](./18-pensions-2026.md) — specifically anchors [`#2026-gis-q2-single-max`](./18-pensions-2026.md#2026-gis-q2-single-max), [`#2026-gis-q2-spouse-on-oas-max`](./18-pensions-2026.md#2026-gis-q2-spouse-on-oas-max), and the earnings-exemption anchors [`#2026-gis-earnings-exemption-first`](./18-pensions-2026.md#2026-gis-earnings-exemption-first) / [`#2026-gis-earnings-exemption-second-50pct`](./18-pensions-2026.md#2026-gis-earnings-exemption-second-50pct).

### Income Thresholds (2024)

| Marital Status     | Maximum Annual Income | Maximum GIS Monthly |
| ------------------ | --------------------- | ------------------- |
| Single             | ~$21,624              | ~$1,065             |
| Married (both OAS) | ~$28,560 combined     | ~$641 each          |
| Married (one OAS)  | ~$51,840 combined     | ~$1,065             |

### GIS Calculation

```
// GIS reduces by 50 cents for every dollar of income (after exemptions)
// Income for GIS excludes: OAS, first $5,000 of employment income

gis_income = total_income - oas_income - employment_exemption

IF marital_status == 'single':
  IF gis_income >= income_threshold:
    gis_amount = 0
  ELSE:
    gis_amount = max_gis - (gis_income × 0.50)
    gis_amount = MAX(0, gis_amount)
```

### GIS Considerations for Planning

- GIS is generally for very low-income seniors
- Most retirement planning assumes income above GIS eligibility
- Include for completeness and edge cases (e.g., running out of savings)
- GIS is NOT taxable income

---

## QPP-Specific Rules (Quebec)

Quebec Pension Plan operates similarly to CPP with minor differences:

| Feature             | QPP Difference                            |
| ------------------- | ----------------------------------------- |
| Administration      | Retraite Québec (not Service Canada)      |
| Survivor benefits   | Slightly different calculation            |
| Disability benefits | Some variations                           |
| Combined benefits   | CPP and QPP contributions may be combined |

For most projection purposes, treat QPP identically to CPP.

---

## Government Benefits Data Model

<a id="benefit-intake-source-modes"></a>

### Benefit Intake Source Modes

The profile wizard must support both manual entry and estimate-assisted entry. Many users know their government-benefit amounts from My Service Canada Account, Service Canada letters, or Retraite Quebec statements; those user-entered values should remain the highest-confidence input. Users who do not know the amounts may use a planning estimate based on basic eligibility inputs and the current dated parameter file.

| Source mode    | Meaning                                                                  | Confidence guidance |
| -------------- | ------------------------------------------------------------------------ | ------------------- |
| `user_entered` | User typed a benefit amount from an official statement or their records  | High                |
| `estimated`    | RetireOps estimated the value from wizard inputs and source parameters   | Medium or Low       |
| `defaulted`    | RetireOps used a conservative placeholder because inputs were incomplete | Low                 |

Estimate-assisted entry is a convenience path, not an entitlement determination. Wizard copy must say that actual CPP/QPP, OAS, or GIS amounts may differ based on contribution history, residency record, income, application status, and government processing.

Minimum wizard variables for estimate-assisted entry:

| Benefit | Minimum inputs                                                                                     | Source refs                                                                                                            |
| ------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| CPP/QPP | Province/Quebec routing, current age, CPP/QPP start age, expected amount at 65 or fallback percent | Rules in this file; 2026 maximums/YMPE/YAMPE in [`18-pensions-2026.md`](./18-pensions-2026.md)                         |
| OAS     | Current age, OAS start age, years resident in Canada after age 18                                  | OAS residency/deferral rules in this file; quarterly 2026 amounts in [`18-pensions-2026.md`](./18-pensions-2026.md)    |
| GIS     | Marital status, spouse OAS/Allowance status, estimated income excluding OAS                        | GIS eligibility/income rules in this file; 2026 maximums and cutoffs in [`18-pensions-2026.md`](./18-pensions-2026.md) |

<a id="ympe-proxy"></a>

### YMPE-Proxy Estimator (CPP/QPP Fallback)

When a user does not have their Service Canada Statement of Contributions (or Retraite Québec Statement of Participation), the wizard offers a 2-question fallback that produces a `MEDIUM`-confidence estimate. The two questions map to a coarse fraction of the 2026 CPP/QPP maximum retirement pension at age 65.

**Inputs**

| Question                                       | Field              | Domain                                    |
| ---------------------------------------------- | ------------------ | ----------------------------------------- |
| Years contributed to CPP/QPP (age 18 to today) | `yearsContributed` | integer 0..47                             |
| Lifetime earnings level vs. YMPE               | `earningsBucket`   | `BELOW_AVG` \| `AVG_OR_ABOVE` \| `AT_MAX` |

**Bucket-to-percentage mapping**

| Bucket         | Description                         | Percentage of max |
| -------------- | ----------------------------------- | ----------------- |
| `BELOW_AVG`    | Below-average earner (~40% of YMPE) | 0.40              |
| `AVG_OR_ABOVE` | Average or above (~65% of YMPE)     | 0.65              |
| `AT_MAX`       | Maximum contributor (100% of YMPE)  | 1.00              |

**Formula**

```
percentageOfMax = BUCKET_TO_PCT[earningsBucket]
baseAt65        = maxRetirementPensionAnnual × percentageOfMax × (yearsContributed / 39)
baseAt65        = min(baseAt65, maxRetirementPensionAnnual)      // cap at 100%
finalAmount     = adjustCPPForStartAge(baseAt65, startAge, plan) // apply start-age factor
```

The denominator `39` reflects the maximum CPP contributory period after the 8-year general drop-out (47 years from age 18–65 minus 8 drop-out years). For 2026 CPP/QPP maximums, see [`18-pensions-2026.md#2026-cpp-max-retirement-pension`](./18-pensions-2026.md#2026-cpp-max-retirement-pension) / [`#2026-qpp-max-retirement-pension`](./18-pensions-2026.md#2026-qpp-max-retirement-pension).

**Confidence:** `MEDIUM`. The SOC-amount path (user enters their statement amount) is `HIGH` confidence.

**Pure-function contract:** The estimator must not call `Date.now`, `Math.random`, or perform I/O. All inputs are passed explicitly; the `plan: 'CPP' | 'QPP'` discriminator is computed by the caller from `about_you.province`.

<a id="qpp-vs-cpp-routing"></a>

### QPP vs. CPP Routing

Province routing for the estimator and UI labeling:

| Province                   | Plan label | Parameter source                                                  |
| -------------------------- | ---------- | ----------------------------------------------------------------- |
| `QC` (Quebec)              | QPP        | `QPP_2026` from `packages/shared/src/benefits-parameters/2026.ts` |
| All other Canadian regions | CPP        | `CPP_2026` from same module                                       |

The 2026 CPP and QPP maximum retirement pensions coincide ($1,507.65/month), but the parameter lookup is plan-routed because:

1. Future years may diverge (Quebec's November 2025 fiscal update legislated a 2026-only QPP base-rate cut — see [`18-pensions-2026.md`](./18-pensions-2026.md) §"What Changed Between 2025 and 2026").
2. Citation provenance must reflect the correct plan anchor so the report layer renders the right citation chip.

Cross-province contributors (mixed CPP+QPP careers) are out of scope for v4.7 — the wizard labels by current province only; a v4.8+ feature may add a cross-plan checkbox.

```typescript
type BenefitSourceMode = 'user_entered' | 'estimated' | 'defaulted';
type BenefitEstimateConfidence = 'high' | 'medium' | 'low';

interface BenefitValueSource {
  mode: BenefitSourceMode;
  confidence: BenefitEstimateConfidence;
  citation: string; // Source-of-truth anchor, for example docs/source-of-truth/18-pensions-2026.md#2026-oas-q2-amount-65to74
  note?: string;
}
```

```typescript
interface GovernmentBenefits {
  cpp: {
    expected_at_65: number; // User input from Service Canada
    start_age: number; // 60-70
    actual_annual: number; // After adjustment
    survivor_benefit?: number; // If applicable
    value_source?: BenefitValueSource;
  };

  oas: {
    years_of_residence: number; // For partial OAS
    start_age: number; // 65-70
    full_entitlement: number; // Before clawback
    clawback: number; // Recovery tax
    net_amount: number; // After clawback
    value_source?: BenefitValueSource;
  };

  gis?: {
    eligible: boolean;
    amount: number;
    value_source?: BenefitValueSource;
  };

  owner: 'primary' | 'spouse';
}

interface BenefitProjection {
  year: number;
  age: number;
  cpp_gross: number;
  cpp_indexed: number;
  oas_gross: number;
  oas_clawback: number;
  oas_net: number;
  gis: number;
  total_government_income: number;
}
```

---

## Decision Support: When to Start Benefits

### CPP Start Age Analysis

```
// Break-even analysis for CPP start age
// Compare cumulative benefits over time

breakeven_60_vs_65 = (cpp_65 × years_from_65) vs (cpp_60 × years_from_60)
// Typical breakeven: age 74-76 (if taking at 60 vs 65)

breakeven_65_vs_70 = (cpp_70 × years_from_70) vs (cpp_65 × years_from_65)
// Typical breakeven: age 81-83 (if taking at 65 vs 70)

// Factors favoring early (age 60):
// - Poor health / lower life expectancy
// - Need immediate income
// - High current marginal tax rate

// Factors favoring late (age 70):
// - Good health / longevity
// - Other income sources available
// - Desire for inflation-protected income later
```

### OAS Start Age Analysis

```
// Similar break-even analysis
// OAS deferral breakeven: approximately age 80-81

// Additional consideration: OAS clawback
// If current income causes clawback, deferring may:
// 1. Reduce years of clawback
// 2. Provide higher benefit when income drops
```

---

## Test Cases

### TC-GOV-001: CPP Early Start

**Input:**

- Expected CPP at 65: $14,000/year
- Start age: 60

**Expected:**

- Months early: 60
- Adjustment: -36%
- CPP annual: $14,000 × 0.64 = $8,960

### TC-GOV-002: CPP Late Start

**Input:**

- Expected CPP at 65: $14,000/year
- Start age: 70

**Expected:**

- Months late: 60
- Adjustment: +42%
- CPP annual: $14,000 × 1.42 = $19,880

### TC-GOV-003: OAS with Partial Residency

**Input:**

- Years of residence: 25
- Start age: 65
- Full OAS: $8,560

**Expected:**

- Entitlement: $8,560 × (25/40) = $5,350

### TC-GOV-004: OAS Clawback

**Input:**

- Net income: $120,000
- Full OAS: $8,560
- Threshold: $90,997

**Expected:**

- Excess income: $29,003
- Clawback: $29,003 × 15% = $4,350
- OAS received: $8,560 - $4,350 = $4,210

### TC-GOV-005: OAS Deferred with Clawback

**Input:**

- Start age: 68
- Full OAS at 65: $8,560
- Net income: $95,000

**Expected:**

- Deferral increase: 36 months × 0.6% = 21.6%
- OAS amount: $8,560 × 1.216 = $10,409
- Excess income: $95,000 - $90,997 = $4,003
- Clawback: $4,003 × 15% = $600
- OAS received: $10,409 - $600 = $9,809

### TC-GOV-006: GIS Eligibility Check

**Input:**

- Single senior
- OAS: $8,560
- RRIF income: $15,000
- No other income

**Expected:**

- GIS income: $15,000 (excludes OAS)
- Below threshold ($21,624): Eligible
- GIS reduction: $15,000 × 50% = $7,500
- GIS amount: ~$12,780 - $7,500 = ~$5,280

### TC-GOV-007: Inflation Indexing

**Input:**

- CPP year 1: $12,000
- Inflation rate: 2.5%
- Years: 10

**Expected:**

- CPP year 10: $12,000 × (1.025)^9 = $14,968

---

## Implementation Notes

1. **User input:** Allow users to enter their expected CPP/QPP from Service Canada/Retraite Quebec statements. If the user does not know the amount, provide an estimate-helper path using the minimum variables in "Benefit Intake Source Modes"; store the resulting source mode, confidence, and citation.

2. **Start age selection:** Provide clear interface to select start ages (60-70 for CPP, 65-70 for OAS) with visual impact on benefits.

3. **Clawback integration:** OAS clawback must connect to tax engine net income calculation.

4. **Couple modeling:** Track CPP/OAS separately for each spouse; survivor benefits activate on first death.

5. **Annual updates:** Government benefit amounts change annually; store in configuration.
