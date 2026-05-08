# 08 - Projection Engine Specification

## Overview

The Projection Engine is the core simulation that ties all components together. It runs year-by-year from the current year through the end of the planning horizon, calculating income, expenses, taxes, account balances, and cash flows for each year.

---

## Projection Timeline

### Key Parameters

| Parameter          | Description             | Typical Value                                |
| ------------------ | ----------------------- | -------------------------------------------- |
| `start_year`       | Current year            | 2025                                         |
| `end_year`         | Last year of projection | start_year + (life_expectancy - current_age) |
| `projection_years` | Number of years         | 30-45 years typically                        |

### Timeline Phases

```
PRE_RETIREMENT:  current_age to retirement_age - 1
RETIREMENT:      retirement_age to life_expectancy
POST_DEATH:      Optional estate settlement year
```

---

## Year-by-Year Calculation Sequence

For each year in the projection, execute the following steps in order:

### Step 1: Initialize Year

```
year_data = {
  year: projection_year,
  user_age: calculate_age(user.birthdate, projection_year),
  spouse_age: calculate_age(spouse.birthdate, projection_year),
  phase: determine_phase(user_age, retirement_age)
}
```

### Step 2: Process Age-Based Events

```
// RRSP to RRIF conversion (end of year turning 71)
IF user_age == 71:
  convert_rrsp_to_rrif(user.rrsp, user.rrif)

// Start government benefits
IF user_age == user.cpp_start_age:
  activate_cpp(user.cpp_benefit)

IF user_age == user.oas_start_age:
  activate_oas(user.oas_benefit)

// Trigger one-time events
FOR event IN scheduled_events:
  IF event.year == projection_year:
    process_event(event)
```

### Step 3: Calculate Income

```
// Employment income (pre-retirement)
IF phase == PRE_RETIREMENT:
  employment_income = calculate_employment_income(user, projection_year)

// Pension income
pension_income = calculate_pension_income(user, user_age)

// Government benefits
cpp_income = calculate_cpp(user.cpp_benefit, user_age, inflation_factor)
oas_income = calculate_oas(user.oas_benefit, user_age, inflation_factor)

// Investment income (non-registered only - generates taxable income)
investment_income = calculate_non_reg_income(non_reg_balance, income_allocation)

// One-time income
one_time_income = get_scheduled_income(projection_year)
```

### Step 4: Calculate Expenses

```
// Retirement spending
IF phase == RETIREMENT:
  base_spending = user.desired_retirement_spending
  inflated_spending = base_spending × (1 + inflation)^years_from_retirement

// Pre-retirement savings
IF phase == PRE_RETIREMENT:
  target_savings = calculate_savings_target(user)

// One-time expenses
one_time_expenses = get_scheduled_expenses(projection_year)

total_expenses = inflated_spending + one_time_expenses
```

### Step 5: Determine Withdrawals Needed

```
guaranteed_income = cpp_income + oas_income + pension_income + employment_income
net_need = total_expenses - guaranteed_income

// Apply withdrawal strategy
IF net_need > 0:
  withdrawals = calculate_withdrawals(
    net_need,
    accounts,
    withdrawal_strategy,
    user_age
  )
ELSE:
  // Surplus - apply to contributions
  surplus = ABS(net_need)
  contributions = allocate_surplus(surplus, accounts)
```

### Step 6: Calculate Investment Growth

```
FOR each account IN [rrsp, rrif, tfsa, non_reg, lira, lif]:
  // Apply growth to remaining balance after withdrawals
  start_balance = account.balance
  end_of_year_contribution_effect = contributions[account] × (1 + return/2)
  end_of_year_withdrawal_effect = withdrawals[account] × (1 + return/2)

  growth = (start_balance - withdrawals[account] + contributions[account]) × return
  account.end_balance = start_balance + growth + contributions[account] - withdrawals[account]
```

### Step 7: Calculate Taxes

```
// Build taxable income
taxable_income = build_taxable_income(
  employment_income,
  pension_income,
  cpp_income,
  oas_income,
  rrif_withdrawal,
  lif_withdrawal,
  investment_income,
  capital_gains
)

// Apply deductions
net_income = taxable_income - rrsp_contributions - other_deductions

// Calculate tax
tax_calculation = calculate_tax(
  net_income,
  user.province,
  user_age,
  pension_income_for_credit,
  dividend_income
)

// Calculate OAS clawback
oas_clawback = calculate_oas_clawback(net_income, oas_income)
oas_net = oas_income - oas_clawback

// Update tax
total_tax = tax_calculation.total_tax
after_tax_income = taxable_income - total_tax
```

### Step 8: Calculate Net Worth

```
total_investments = rrsp.end_balance
                  + rrif.end_balance
                  + tfsa.end_balance
                  + non_reg.end_balance
                  + lira.end_balance
                  + lif.end_balance

// Include real estate if modeled
IF include_real_estate:
  home_equity = home_value - mortgage_balance
  total_net_worth = total_investments + home_equity
ELSE:
  total_net_worth = total_investments
```

### Step 9: Record Year Results

```
projection_results[projection_year] = {
  // Demographics
  year: projection_year,
  user_age: user_age,
  spouse_age: spouse_age,
  phase: phase,

  // Income
  employment_income: employment_income,
  pension_income: pension_income,
  cpp_income: cpp_income,
  oas_gross: oas_income,
  oas_clawback: oas_clawback,
  oas_net: oas_net,
  investment_income: investment_income,
  total_income: total_income,

  // Withdrawals
  rrsp_withdrawal: withdrawals.rrsp,
  rrif_withdrawal: withdrawals.rrif,
  tfsa_withdrawal: withdrawals.tfsa,
  non_reg_withdrawal: withdrawals.non_reg,
  total_withdrawal: total_withdrawal,

  // Contributions
  rrsp_contribution: contributions.rrsp,
  tfsa_contribution: contributions.tfsa,
  total_contribution: total_contribution,

  // Expenses
  spending: inflated_spending,
  one_time_expenses: one_time_expenses,
  total_expenses: total_expenses,

  // Taxes
  taxable_income: taxable_income,
  federal_tax: tax_calculation.federal_tax,
  provincial_tax: tax_calculation.provincial_tax,
  total_tax: total_tax,
  effective_rate: total_tax / taxable_income,
  marginal_rate: tax_calculation.marginal_rate,

  // Account balances (end of year)
  rrsp_balance: rrsp.end_balance,
  rrif_balance: rrif.end_balance,
  tfsa_balance: tfsa.end_balance,
  non_reg_balance: non_reg.end_balance,
  lira_balance: lira.end_balance,
  lif_balance: lif.end_balance,
  total_investments: total_investments,
  total_net_worth: total_net_worth,

  // Cash flow
  net_cash_flow: after_tax_income - total_expenses,
  cumulative_shortfall: cumulative_shortfall
}
```

---

## Projection Data Model

```typescript
interface ProjectionInput {
  user: UserProfile;
  spouse?: UserProfile;
  accounts: AccountSet;
  income_sources: IncomeSource[];
  expenses: ExpenseItem[];
  one_time_events: ScheduledEvent[];
  assumptions: {
    inflation_rate: number;
    investment_return: number;
    tax_bracket_indexing: boolean;
  };
  withdrawal_strategy: WithdrawalStrategy;
}

interface ProjectionOutput {
  summary: ProjectionSummary;
  yearly_data: YearlyProjection[];
  success_metrics: SuccessMetrics;
  warnings: ProjectionWarning[];
}

interface YearlyProjection {
  year: number;
  user_age: number;
  spouse_age?: number;
  phase: 'pre_retirement' | 'retirement' | 'estate';

  income: {
    employment: number;
    self_employment: number;
    pension: number;
    cpp: number;
    oas_gross: number;
    oas_clawback: number;
    oas_net: number;
    gis: number;
    investment: number;
    rental: number;
    other: number;
    total_gross: number;
    total_after_tax: number;
  };

  withdrawals: {
    rrsp: number;
    rrif: number;
    rrif_minimum: number;
    tfsa: number;
    non_reg: number;
    non_reg_capital_gain: number;
    lif: number;
    total: number;
  };

  contributions: {
    rrsp: number;
    tfsa: number;
    non_reg: number;
    total: number;
  };

  taxes: {
    federal_gross: number;
    federal_credits: number;
    federal_net: number;
    provincial_gross: number;
    provincial_credits: number;
    provincial_net: number;
    total: number;
    effective_rate: number;
    marginal_rate: number;
  };

  expenses: {
    living: number;
    one_time: number;
    total: number;
  };

  balances: {
    rrsp: number;
    rrif: number;
    tfsa: number;
    non_reg: number;
    non_reg_acb: number;
    non_reg_unrealized_gain: number;
    lira: number;
    lif: number;
    total_registered: number;
    total_non_registered: number;
    total_investments: number;
    home_equity?: number;
    total_net_worth: number;
  };

  cash_flow: {
    gross_income: number;
    taxes_paid: number;
    net_income: number;
    expenses: number;
    surplus_deficit: number;
  };
}

interface ProjectionSummary {
  start_year: number;
  end_year: number;
  projection_years: number;
  retirement_year: number;

  // Key outcomes
  assets_depleted: boolean;
  depletion_age?: number;
  final_net_worth: number;
  final_estate_value: number; // After terminal taxes

  // Lifetime totals
  total_income: number;
  total_taxes_paid: number;
  total_withdrawals: number;
  total_oas_clawback: number;

  // Key statistics
  peak_net_worth: number;
  peak_net_worth_age: number;
  average_tax_rate: number;
  max_marginal_rate: number;
}
```

---

## Special Handling

### RRSP to RRIF Conversion

```
// Automatic conversion at age 71
IF user_age == 71 AND month >= 12:
  rrif.balance = rrsp.balance
  rrsp.balance = 0
  rrsp.is_active = false
  rrif.is_active = true
  rrif.first_withdrawal_year = projection_year + 1
```

### Spousal RRSP Attribution

```
// Withdrawals within 3 calendar years of contribution
// are attributed back to contributing spouse

IF spousal_rrsp_withdrawal AND years_since_last_contribution < 3:
  // Attribute withdrawal to contributing spouse's income
  contributing_spouse.taxable_income += withdrawal
  // Not owner's income
```

### Estate Calculation (Final Year)

```
// At death (life expectancy year)
IF projection_year == final_year:

  // RRSP/RRIF deemed disposition (unless spouse rollover)
  IF no_surviving_spouse:
    terminal_rrsp_tax = (rrsp_balance + rrif_balance) × terminal_tax_rate
  ELSE:
    // Rollover to spouse, no immediate tax
    terminal_rrsp_tax = 0

  // Non-registered capital gains
  terminal_capital_gains = non_reg_unrealized_gains × 0.50
  terminal_cg_tax = terminal_capital_gains × marginal_rate

  // Calculate net estate
  gross_estate = total_net_worth
  estate_taxes = terminal_rrsp_tax + terminal_cg_tax
  net_estate = gross_estate - estate_taxes
```

### Couple Projections

```
// For married/common-law couples, track both individuals

FOR each year:
  // Calculate each person's income separately
  user_income = calculate_income(user, year)
  spouse_income = calculate_income(spouse, year)

  // Apply pension splitting if beneficial
  IF eligible_for_pension_splitting(user, spouse):
    optimal_split = calculate_optimal_split(user_income, spouse_income)
    apply_pension_split(user, spouse, optimal_split)

  // Calculate taxes separately
  user_tax = calculate_tax(user_income, user.province)
  spouse_tax = calculate_tax(spouse_income, spouse.province)

  // Combine for household
  household_tax = user_tax + spouse_tax
  household_after_tax = (user_income + spouse_income) - household_tax

  // Track accounts separately (each account has owner)
  // Combine for net worth reporting
```

### Survivor Scenario

```
// If first spouse dies before plan end
IF spouse_death_year <= plan_end_year:

  FOR years AFTER spouse_death_year:
    // Deceased spouse's accounts roll to survivor
    survivor.rrsp += deceased.rrsp_rollover
    survivor.tfsa_room += deceased.tfsa_balance

    // CPP survivor benefit
    survivor.cpp += calculate_survivor_benefit(deceased.cpp)

    // Lose one OAS/GIS
    household_oas = survivor.oas_only

    // Adjust expenses (typically reduce by ~30%)
    survivor_expenses = couple_expenses × 0.70

    // Continue projection with single survivor
```

---

## Projection Warnings

The engine should generate warnings for notable situations:

```typescript
interface ProjectionWarning {
  year: number;
  severity: 'info' | 'warning' | 'critical';
  code: string;
  message: string;
}

// Example warnings
warnings = [
  {
    year: 2035,
    severity: 'warning',
    code: 'OAS_CLAWBACK',
    message: 'OAS clawback of $2,500 due to income of $95,000',
  },

  {
    year: 2040,
    severity: 'critical',
    code: 'SHORTFALL',
    message: 'Expenses exceed available funds by $15,000',
  },

  {
    year: 2032,
    severity: 'info',
    code: 'RRIF_CONVERSION',
    message: 'RRSP converted to RRIF at end of year',
  },

  {
    year: 2045,
    severity: 'warning',
    code: 'HIGH_MARGINAL_RATE',
    message: 'Marginal tax rate reaches 48% due to large RRIF withdrawal',
  },

  {
    year: 2050,
    severity: 'info',
    code: 'ASSETS_DEPLETED',
    message: 'Investment assets depleted at age 92',
  },
];
```

---

## Test Cases

### TC-PROJ-001: Simple 10-Year Projection

**Input:**

- Current age: 60
- Retirement age: 65
- Life expectancy: 90
- RRSP: $500,000
- Employment income: $100,000 (until 65)
- Retirement spending: $60,000
- Return: 5%
- Inflation: 2%

**Expected:**

- Years 1-5: Accumulation phase (working, saving)
- Year 5: RRSP should be ~$750,000+
- Years 6+: Decumulation phase
- Year 30: Should have positive balance if plan is sustainable

### TC-PROJ-002: RRSP to RRIF Conversion

**Input:**

- Current age: 70
- RRSP balance: $400,000
- Year 2: Age 71

**Expected:**

- Year 2 (age 71): RRSP converts to RRIF
- Year 3 (age 72): RRIF minimum withdrawal = $400,000 × 5.40% = $21,600

### TC-PROJ-003: OAS Clawback Trigger

**Input:**

- Age: 67
- Income before OAS: $92,000
- OAS entitlement: $8,500
- Threshold: $90,997

**Expected:**

- Excess income: $92,000 - $90,997 = $1,003
- Clawback: $1,003 × 15% = $150
- OAS received: $8,500 - $150 = $8,350

### TC-PROJ-004: Estate Calculation

**Input:**

- Final year age: 90
- RRIF balance: $200,000
- TFSA balance: $100,000
- Non-reg balance: $150,000 (ACB: $100,000)
- No spouse

**Expected:**

- RRIF terminal tax: $200,000 × ~40% = $80,000
- Non-reg capital gains: $50,000 × 50% × 40% = $10,000
- Gross estate: $450,000
- Estate taxes: $90,000
- Net estate: $360,000

### TC-PROJ-005: Couple with Pension Splitting

**Input:**

- Spouse A: RRIF income $80,000, age 70
- Spouse B: Part-time income $15,000, age 68
- Province: Ontario

**Expected:**

- Without splitting: Combined tax ~$23,000
- With 50% split: Combined tax ~$19,500
- Projection should apply splitting automatically if beneficial
