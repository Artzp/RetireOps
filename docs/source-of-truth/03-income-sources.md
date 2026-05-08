# 03 - Income Sources Specification

## Overview

The software must model all relevant income sources throughout the user's lifetime, including pre-retirement earnings and post-retirement pension/benefit income. Each income source has specific tax treatments and timing rules.

---

## Income Source Types

### Employment Income

Regular salary or wages from an employer.

| Field           | Type       | Required | Description                                          |
| --------------- | ---------- | -------- | ---------------------------------------------------- |
| `annual_amount` | Currency   | Yes      | Current gross annual salary                          |
| `growth_rate`   | Percentage | No       | Annual increase rate (default: 2%)                   |
| `end_age`       | Integer    | Yes      | Age when employment stops (typically retirement age) |
| `owner`         | Enum       | Yes      | `primary` or `spouse`                                |

**Tax Treatment:** 100% taxable as ordinary income

**Calculation:**

```
For each year until end_age:
  employment_income[year] = annual_amount × (1 + growth_rate)^(year - start_year)
```

---

### Self-Employment Income

Income from business or professional practice.

| Field           | Type       | Required | Description                    |
| --------------- | ---------- | -------- | ------------------------------ |
| `annual_amount` | Currency   | Yes      | Net self-employment income     |
| `growth_rate`   | Percentage | No       | Annual growth rate             |
| `end_age`       | Integer    | Yes      | Age when self-employment stops |
| `owner`         | Enum       | Yes      | `primary` or `spouse`          |

**Tax Treatment:** 100% taxable as ordinary income
**Note:** CPP contributions required on self-employment income (both employer and employee portions)

---

### Rental Property Income

Net income from investment properties.

| Field                | Type       | Required | Description                                 |
| -------------------- | ---------- | -------- | ------------------------------------------- |
| `annual_net_income`  | Currency   | Yes      | Annual rent minus expenses                  |
| `growth_rate`        | Percentage | No       | Annual rent increase assumption             |
| `end_year`           | Integer    | No       | Year property is sold (null = indefinite)   |
| `property_value`     | Currency   | No       | Current market value (for sale calculation) |
| `adjusted_cost_base` | Currency   | No       | Original cost + improvements                |
| `owner`              | Enum       | Yes      | `primary` or `spouse`                       |

**Tax Treatment:**

- Annual net rental income: 100% taxable as ordinary income
- On sale: Capital gain = property_value - adjusted_cost_base (50% inclusion rate)

---

### Defined Benefit Pension

Employer pension paying a guaranteed amount for life.

| Field                  | Type       | Required | Description                               |
| ---------------------- | ---------- | -------- | ----------------------------------------- |
| `annual_amount`        | Currency   | Yes      | Expected pension at normal retirement     |
| `start_age`            | Integer    | Yes      | Age pension begins                        |
| `indexing_rate`        | Percentage | No       | Annual inflation adjustment (default: 0%) |
| `bridge_benefit`       | Currency   | No       | Additional amount paid until age 65       |
| `survivor_benefit_pct` | Percentage | No       | Percentage continuing to spouse on death  |
| `owner`                | Enum       | Yes      | `primary` or `spouse`                     |

**Tax Treatment:** 100% taxable as ordinary income
**Pension Income Credit:** First $2,000 eligible for pension income tax credit (age 65+)

**Early Retirement Reduction:**

```
IF start_age < normal_retirement_age THEN
  reduction = (normal_retirement_age - start_age) × reduction_factor
  // Typical reduction: 3-6% per year early
```

---

### Defined Contribution Pension

Employer pension where account balance depends on contributions and investment returns.

**Modeling Approach:** Treat as a LIRA/RRSP account (see Account Types) since the benefit depends on accumulated balance, not a formula.

| Field                 | Type     | Required | Description                  |
| --------------------- | -------- | -------- | ---------------------------- |
| `current_balance`     | Currency | Yes      | Current account value        |
| `annual_contribution` | Currency | No       | Ongoing contributions        |
| `employer_match`      | Currency | No       | Employer contribution amount |
| `owner`               | Enum     | Yes      | `primary` or `spouse`        |

**Conversion:** At retirement, typically transfers to LIRA → LIF or can annuitize

---

### Government Benefits

See [05-government-benefits.md](./05-government-benefits.md) for detailed CPP/QPP, OAS, and GIS specifications.

Summary for income modeling:

| Benefit | Earliest Age | Standard Age | Latest Age | Indexed             |
| ------- | ------------ | ------------ | ---------- | ------------------- |
| CPP/QPP | 60           | 65           | 70         | Yes (CPI)           |
| OAS     | 65           | 65           | 70         | Yes (Quarterly CPI) |
| GIS     | 65           | 65           | N/A        | Yes                 |

---

### One-Time Income Events

Lump sum inflows at specific points in time.

| Field         | Type     | Required | Description           |
| ------------- | -------- | -------- | --------------------- |
| `amount`      | Currency | Yes      | Lump sum amount       |
| `year`        | Integer  | Yes      | Year received         |
| `type`        | Enum     | Yes      | See types below       |
| `description` | String   | No       | User note             |
| `owner`       | Enum     | Yes      | `primary` or `spouse` |

**Event Types and Tax Treatment:**

| Type               | Tax Treatment            | Example                 |
| ------------------ | ------------------------ | ----------------------- |
| `inheritance`      | Non-taxable              | Receiving estate assets |
| `gift`             | Non-taxable              | Cash gift from family   |
| `severance`        | 100% taxable             | Employment termination  |
| `bonus`            | 100% taxable             | One-time work bonus     |
| `property_sale`    | Capital gains on profit  | Selling cottage         |
| `business_sale`    | Complex (LCGE may apply) | Selling business        |
| `insurance_payout` | Generally non-taxable    | Life insurance proceeds |
| `lottery`          | Non-taxable              | Lottery winnings        |

**Lifetime Capital Gains Exemption (LCGE) - 2024:**

- Qualified small business shares: $1,016,836 lifetime exemption
- Qualified farm/fishing property: $1,016,836 lifetime exemption

---

## Income Data Model

```typescript
interface IncomeSource {
  id: string;
  type: IncomeType;
  owner: 'primary' | 'spouse';
  annual_amount: number;
  start_age?: number;
  end_age?: number;
  start_year?: number;
  end_year?: number;
  growth_rate?: number;
  tax_treatment: TaxTreatment;
  metadata?: Record<string, any>;
}

enum IncomeType {
  EMPLOYMENT = 'employment',
  SELF_EMPLOYMENT = 'self_employment',
  RENTAL = 'rental',
  DB_PENSION = 'db_pension',
  DC_PENSION = 'dc_pension',
  CPP = 'cpp',
  QPP = 'qpp',
  OAS = 'oas',
  GIS = 'gis',
  RRIF_WITHDRAWAL = 'rrif_withdrawal',
  LIF_WITHDRAWAL = 'lif_withdrawal',
  TFSA_WITHDRAWAL = 'tfsa_withdrawal',
  NON_REG_WITHDRAWAL = 'non_reg_withdrawal',
  ONE_TIME = 'one_time',
}

enum TaxTreatment {
  FULLY_TAXABLE = 'fully_taxable',
  TAX_FREE = 'tax_free',
  CAPITAL_GAINS = 'capital_gains',
  DIVIDEND_ELIGIBLE = 'dividend_eligible',
  DIVIDEND_NON_ELIGIBLE = 'dividend_non_eligible',
}
```

---

## Income Timeline Generation

For each year of the projection, aggregate all applicable income sources:

```
FOR each projection_year FROM current_year TO end_year:
  user_age = calculate_age(user.birthdate, projection_year)
  spouse_age = calculate_age(spouse.birthdate, projection_year)

  FOR each income_source IN user_income_sources:
    IF income_is_active(income_source, user_age, projection_year):
      amount = calculate_income_amount(income_source, projection_year)
      annual_income[projection_year][income_source.type] += amount

  // Repeat for spouse income sources
```

**Active Income Check:**

```
income_is_active(source, age, year):
  IF source.start_age AND age < source.start_age: RETURN false
  IF source.end_age AND age > source.end_age: RETURN false
  IF source.start_year AND year < source.start_year: RETURN false
  IF source.end_year AND year > source.end_year: RETURN false
  RETURN true
```

---

## Test Cases

### TC-INC-001: Employment Income Growth

**Input:**

- Current salary: $100,000
- Growth rate: 3%
- Current age: 55
- Retirement age: 65

**Expected Income:**

- Year 1: $100,000
- Year 2: $103,000
- Year 5: $112,551
- Year 10: $130,477
- Year 11+: $0 (retired)

### TC-INC-002: DB Pension with Bridge

**Input:**

- Base pension: $40,000/year
- Bridge benefit: $10,000/year until 65
- Start age: 60
- Indexing: 2%

**Expected:**

- Age 60-64: $50,000/year (base + bridge), indexed
- Age 65+: $40,000/year (base only), indexed

### TC-INC-003: Rental Property Sale

**Input:**

- Net rental income: $12,000/year
- Property value: $500,000
- Adjusted cost base: $300,000
- Sale year: 2030

**Expected:**

- Years before 2030: $12,000/year rental income (taxable)
- Year 2030:
  - Rental income: $12,000
  - Capital gain: $200,000
  - Taxable capital gain: $100,000 (50% inclusion)
- Years after 2030: $0 rental income

### TC-INC-004: One-Time Inheritance

**Input:**

- Amount: $200,000
- Year: 2028
- Type: inheritance

**Expected:**

- Year 2028 cash inflow: $200,000
- Tax on inheritance: $0
- Added to non-registered account (or user-specified destination)

### TC-INC-005: Severance Package

**Input:**

- Amount: $75,000
- Year: 2025
- Type: severance

**Expected:**

- Year 2025 income: $75,000
- Tax treatment: 100% taxable as employment income
- May trigger higher tax bracket

---

## Income Summary View

For user interface, provide aggregated views:

**By Year:**

```
Year 2030:
  Employment:      $105,000
  CPP:             $14,400
  OAS:             $8,500
  RRIF Withdrawal: $35,000
  ─────────────────────────
  Total Income:    $162,900
  Less: Taxes      ($42,000)
  ─────────────────────────
  Net Income:      $120,900
```

**By Source Over Time:**

```
Age   Employment  CPP     OAS     RRIF    Total
60    $110,000    $0      $0      $0      $110,000
65    $0          $14,400 $8,500  $35,000 $57,900
70    $0          $14,400 $8,500  $40,000 $62,900
```
