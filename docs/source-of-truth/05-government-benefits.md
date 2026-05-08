# 05 - Government Benefits Specification

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

### Benefit Amounts (2024)

| Metric                | CPP       | QPP       |
| --------------------- | --------- | --------- |
| Maximum monthly at 65 | $1,364.60 | $1,364.60 |
| Maximum annual at 65  | $16,375   | $16,375   |
| Average monthly       | ~$815     | ~$815     |

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

```typescript
interface GovernmentBenefits {
  cpp: {
    expected_at_65: number; // User input from Service Canada
    start_age: number; // 60-70
    actual_annual: number; // After adjustment
    survivor_benefit?: number; // If applicable
  };

  oas: {
    years_of_residence: number; // For partial OAS
    start_age: number; // 65-70
    full_entitlement: number; // Before clawback
    clawback: number; // Recovery tax
    net_amount: number; // After clawback
  };

  gis?: {
    eligible: boolean;
    amount: number;
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

1. **User input:** Allow users to enter their expected CPP/QPP from Service Canada/Retraite Quebec statements, or estimate based on typical percentages of maximum.

2. **Start age selection:** Provide clear interface to select start ages (60-70 for CPP, 65-70 for OAS) with visual impact on benefits.

3. **Clawback integration:** OAS clawback must connect to tax engine net income calculation.

4. **Couple modeling:** Track CPP/OAS separately for each spouse; survivor benefits activate on first death.

5. **Annual updates:** Government benefit amounts change annually; store in configuration.
