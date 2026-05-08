# 06 - Investment Engine Specification

## Overview

The Investment Engine projects how savings and investments grow over time. It applies return assumptions to account balances, handles different asset allocations, and optionally models volatility through Monte Carlo simulation.

---

## Core Parameters

### Expected Rate of Return

| Parameter        | Type       | Default | Range      | Description                                |
| ---------------- | ---------- | ------- | ---------- | ------------------------------------------ |
| `nominal_return` | Percentage | 5.0%    | 0-15%      | Expected annual return including inflation |
| `real_return`    | Percentage | 2.5%    | -2% to 12% | Expected return net of inflation           |
| `inflation_rate` | Percentage | 2.5%    | 0-10%      | General inflation assumption               |

**Relationship:**

```
real_return = nominal_return - inflation_rate
// Or equivalently:
nominal_return = real_return + inflation_rate
```

### Return by Risk Profile

| Risk Profile | Expected Return | Volatility (Std Dev) | Typical Allocation     |
| ------------ | --------------- | -------------------- | ---------------------- |
| Conservative | 4.0%            | 5%                   | 30% equity / 70% fixed |
| Balanced     | 5.5%            | 10%                  | 50% equity / 50% fixed |
| Growth       | 7.0%            | 15%                  | 70% equity / 30% fixed |
| Aggressive   | 8.0%            | 20%                  | 90% equity / 10% fixed |

---

## Deterministic Projection Model

### Single Rate of Return

The simplest model applies the same return each year to all investment accounts.

```
// For each account, for each year:
end_balance = (start_balance + contributions - withdrawals) × (1 + annual_return)

// Or with mid-year cash flows:
end_balance = start_balance × (1 + annual_return)
            + contributions × (1 + annual_return/2)
            - withdrawals × (1 + annual_return/2)
```

### Account-Specific Returns (Advanced)

Different accounts may have different returns based on asset allocation:

```typescript
interface AccountReturn {
  account_id: string;
  return_rate: number;
  rationale: string;  // e.g., "Conservative allocation in RRSP"
}

// Example: TFSA in growth assets, RRSP in balanced
tfsa_return = 7.0%   // Growth allocation
rrsp_return = 5.5%   // Balanced allocation
```

### Glide Path Model

Returns may decrease over time as investor shifts to conservative allocation:

```
// Linear glide path example
years_to_retirement = retirement_age - current_age
years_from_retirement = current_age - retirement_age  // Negative before retirement

IF years_from_retirement < 0:
  // Pre-retirement: higher returns
  equity_allocation = 80% - (years_from_retirement × -2%)  // Decrease 2%/year toward retirement
ELSE:
  // Post-retirement: lower returns
  equity_allocation = MAX(30%, 60% - (years_from_retirement × 2%))

expected_return = equity_allocation × equity_return + (1 - equity_allocation) × fixed_return
```

---

## Monte Carlo Simulation

### Purpose

Monte Carlo simulation models investment uncertainty by running thousands of scenarios with randomized returns, providing:

- Probability of success (not running out of money)
- Range of possible outcomes
- Worst-case and best-case projections

### Random Return Generation

```
// Log-normal return distribution (standard model)
annual_return = exp(μ + σ × random_normal())

Where:
  μ = ln(1 + expected_return) - σ²/2
  σ = standard_deviation of log returns
  random_normal() = standard normal random variable (mean 0, std dev 1)
```

### Simulation Parameters

| Parameter         | Default | Range                 | Description                   |
| ----------------- | ------- | --------------------- | ----------------------------- |
| `num_simulations` | 1,000   | 100-10,000            | Number of random scenarios    |
| `expected_return` | 5.5%    | User input            | Mean expected return          |
| `volatility`      | 10%     | User input or profile | Standard deviation of returns |
| `correlation`     | N/A     | Advanced              | Cross-asset correlations      |

### Simulation Algorithm

```
results = []

FOR sim_num FROM 1 TO num_simulations:
  portfolio_balance = initial_balance
  scenario_data = []

  FOR year FROM 1 TO projection_years:
    // Generate random return for this year
    random_return = generate_lognormal_return(expected_return, volatility)

    // Apply return to portfolio
    portfolio_balance = portfolio_balance × (1 + random_return)

    // Add income, subtract expenses
    portfolio_balance += annual_income[year]
    portfolio_balance -= annual_expenses[year]

    // Handle RRIF minimums, other forced withdrawals
    portfolio_balance -= mandatory_withdrawals[year]

    // Record end-of-year balance
    scenario_data.append({
      year: year,
      balance: portfolio_balance,
      return: random_return
    })

    // Check for depletion
    IF portfolio_balance <= 0:
      depletion_year = year
      BREAK

  results.append({
    scenario: sim_num,
    final_balance: portfolio_balance,
    depletion_year: depletion_year or null,
    data: scenario_data
  })
```

### Analyzing Results

```
// Probability of Success
successes = COUNT(results WHERE depletion_year IS NULL)
probability_of_success = successes / num_simulations × 100%

// Percentile Analysis
final_balances = SORT(results.final_balance)
percentile_5 = final_balances[num_simulations × 0.05]   // Bad case
percentile_50 = final_balances[num_simulations × 0.50]  // Median
percentile_95 = final_balances[num_simulations × 0.95]  // Good case

// Depletion Age Analysis
depletion_ages = results.filter(r => r.depletion_year).map(r => r.depletion_year)
median_depletion_age = MEDIAN(depletion_ages) // If applicable
```

---

## Inflation Handling

### Real vs. Nominal Dollars

The software can present results in either:

| Mode    | Description                          | Use Case                      |
| ------- | ------------------------------------ | ----------------------------- |
| Nominal | Future dollars (not adjusted)        | Shows actual expected amounts |
| Real    | Today's dollars (inflation-adjusted) | Shows purchasing power        |

```
// Convert nominal to real (present value)
real_value = nominal_value / (1 + inflation_rate)^years

// Convert real to nominal (future value)
nominal_value = real_value × (1 + inflation_rate)^years
```

### Inflation-Indexed Items

| Item         | Indexing        | Implementation                           |
| ------------ | --------------- | ---------------------------------------- |
| CPP/OAS      | CPI annually    | Multiply by (1 + inflation) each year    |
| DB pension   | Plan-specific   | User input indexing rate (0-100% of CPI) |
| Expenses     | User assumption | Default: full CPI indexing               |
| Tax brackets | CPI annually    | Brackets increase with inflation         |

---

## Tax-Aware Growth

Investment growth has different tax implications by account type:

### RRSP/RRIF/LIRA/LIF Growth

```
// Tax-deferred: no annual tax on growth
year_end_balance = year_start_balance × (1 + return) + contributions - withdrawals
// Withdrawals are fully taxed (handled in tax engine)
```

### TFSA Growth

```
// Tax-free: no annual tax, no tax on withdrawal
year_end_balance = year_start_balance × (1 + return) + contributions - withdrawals
// Withdrawals are not taxable
```

### Non-Registered Growth

```
// Annual tax on interest and dividends
annual_income = balance × income_yield

Where income_yield breakdown:
  interest_portion: Fully taxable
  dividend_portion: Grossed-up, then credit
  capital_gains_portion: Deferred until realized

// Growth component (unrealized capital gains)
unrealized_gain_increase = balance × (return - income_yield)
new_unrealized_gains = old_unrealized_gains + unrealized_gain_increase

// On withdrawal, realize proportional capital gains
realized_gain = withdrawal × (unrealized_gains / balance)
taxable_gain = realized_gain × 0.50  // 50% inclusion
```

### Non-Registered Income Allocation

```typescript
interface NonRegIncomeAllocation {
  interest_pct: number; // % of return that's interest (fully taxable)
  canadian_dividend_pct: number; // % that's Canadian dividends
  foreign_dividend_pct: number; // % that's foreign dividends (fully taxable)
  capital_gains_pct: number; // % that's capital appreciation (deferred)
}

// Example: Balanced portfolio
default_allocation = {
  interest_pct: 20,
  canadian_dividend_pct: 30,
  foreign_dividend_pct: 10,
  capital_gains_pct: 40,
};
```

---

## Sequence of Returns Risk

### The Problem

The order of returns matters during retirement. Poor returns early in retirement are more damaging than poor returns later (when the balance is smaller).

### Modeling Approaches

1. **Reverse historical sequences:** Test the plan against historical return sequences (both forward and reversed)

2. **Stress testing:** Apply worst-case scenarios (e.g., -30% in first year of retirement)

3. **Monte Carlo naturally captures this:** Random sequences inherently test different orderings

### Stress Test Scenarios

| Scenario                   | Description                       | Application                   |
| -------------------------- | --------------------------------- | ----------------------------- |
| Market crash at retirement | -30% in year 1, normal thereafter | Test worst-case timing        |
| Lost decade                | 0% returns for 10 years           | Test prolonged poor markets   |
| High inflation             | 6%+ inflation for 5 years         | Test purchasing power erosion |
| 2008 replay                | Historical 2008-2009 returns      | Real-world stress test        |

---

## Investment Engine Data Model

```typescript
interface InvestmentAssumptions {
  return_mode: 'nominal' | 'real';
  nominal_return: number;
  real_return: number;
  inflation_rate: number;
  volatility?: number; // For Monte Carlo

  // Optional: account-specific returns
  account_returns?: {
    [account_id: string]: number;
  };

  // Non-registered income allocation
  non_reg_allocation: {
    interest_pct: number;
    canadian_dividend_pct: number;
    foreign_dividend_pct: number;
    capital_gains_pct: number;
  };
}

interface ProjectionYear {
  year: number;
  age: number;

  // Starting balances
  rrsp_start: number;
  rrif_start: number;
  tfsa_start: number;
  non_reg_start: number;
  lira_start: number;
  lif_start: number;

  // Cash flows
  contributions: {
    rrsp: number;
    tfsa: number;
    non_reg: number;
  };
  withdrawals: {
    rrsp: number;
    rrif: number;
    tfsa: number;
    non_reg: number;
    lif: number;
  };

  // Investment returns
  investment_growth: {
    rrsp: number;
    rrif: number;
    tfsa: number;
    non_reg: number;
    lira: number;
    lif: number;
  };

  // Ending balances
  rrsp_end: number;
  rrif_end: number;
  tfsa_end: number;
  non_reg_end: number;
  lira_end: number;
  lif_end: number;

  // Summary
  total_investments: number;
  return_achieved: number; // For Monte Carlo tracking
}

interface MonteCarloResult {
  simulation_id: number;
  probability_of_success: number;
  final_balance_median: number;
  final_balance_5th_percentile: number;
  final_balance_95th_percentile: number;
  depletion_age_if_failed?: number;
  yearly_data: ProjectionYear[];
}
```

---

## Test Cases

### TC-INV-001: Simple Growth Projection

**Input:**

- RRSP balance: $200,000
- Annual contribution: $10,000
- Return: 5%
- Years: 10

**Expected:**

```
Year 1: ($200,000 + $10,000) × 1.05 = $220,500
Year 2: ($220,500 + $10,000) × 1.05 = $242,025
...
Year 10: ~$383,000
```

### TC-INV-002: Non-Registered Tax Drag

**Input:**

- Non-reg balance: $100,000
- Return: 6%
- Income allocation: 50% interest, 50% capital gains
- Marginal tax rate: 40%

**Expected:**

- Annual return: $6,000
- Interest portion: $3,000 (taxable)
- Capital gains portion: $3,000 (deferred)
- Annual tax: $3,000 × 40% = $1,200
- Net growth: $6,000 - $1,200 = $4,800 (4.8% effective)

### TC-INV-003: Inflation Adjustment

**Input:**

- Starting income: $50,000
- Inflation: 2.5%
- Years: 20

**Expected:**

- Nominal income year 20: $50,000 × (1.025)^20 = $81,931
- Real value (today's dollars): $50,000 (constant purchasing power)

### TC-INV-004: Monte Carlo Probability

**Input:**

- Portfolio: $1,000,000
- Annual withdrawal: $50,000 (5%)
- Expected return: 5%
- Volatility: 12%
- Projection: 30 years
- Simulations: 1,000

**Expected:**

- Probability of success: ~75-85%
- Median ending balance: ~$500,000
- 5th percentile: ~$0 (depleted)
- 95th percentile: ~$2,000,000

### TC-INV-005: Account-Specific Returns

**Input:**

- TFSA (aggressive): $50,000 at 8%
- RRSP (balanced): $200,000 at 5.5%
- Non-reg (conservative): $100,000 at 4%

**Expected Total Growth Year 1:**

- TFSA: $50,000 × 8% = $4,000
- RRSP: $200,000 × 5.5% = $11,000
- Non-reg: $100,000 × 4% = $4,000
- Total: $19,000
- Blended return: $19,000 / $350,000 = 5.43%

---

## Implementation Notes

1. **Default assumptions:** Provide sensible defaults (5% nominal, 2.5% inflation) but allow full customization.

2. **Mid-year cash flows:** Consider using mid-year convention for contributions/withdrawals for more accurate modeling.

3. **Monte Carlo performance:** 1,000 simulations is typically sufficient; 10,000 for publication-quality confidence.

4. **Random seed:** Allow setting random seed for reproducible results during testing.

5. **Negative balances:** Never allow negative account balances; cap withdrawals at available balance.

6. **Rebalancing:** For simplicity, assume automatic rebalancing to target allocation (no drift tracking in MVP).
