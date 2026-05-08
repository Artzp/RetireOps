# 07 - Withdrawal Strategy Specification

## Overview

The Withdrawal Strategy Engine determines how retirement income is sourced from various accounts. The order and timing of withdrawals significantly impacts taxes, benefit clawbacks, and portfolio longevity. This document defines the rules and strategies for decumulation.

---

## Default Withdrawal Order

The conventional withdrawal order minimizes taxes and maximizes tax-deferred growth:

### Standard Priority (Tax-Deferred Last)

| Priority | Account Type   | Rationale                                                  |
| -------- | -------------- | ---------------------------------------------------------- |
| 1        | Non-Registered | Use up taxable assets first; defer tax-sheltered growth    |
| 2        | RRSP/RRIF      | Draw registered funds next; withdrawals are taxable        |
| 3        | TFSA           | Preserve tax-free growth for last; flexible emergency fund |

### Alternative: TFSA-First Strategy

| Priority | Account Type   | Rationale                                                      |
| -------- | -------------- | -------------------------------------------------------------- |
| 1        | TFSA           | Withdrawals don't increase taxable income or trigger clawbacks |
| 2        | Non-Registered | Use after TFSA depleted                                        |
| 3        | RRSP/RRIF      | Last resort; fully taxable                                     |

**Use case:** When minimizing OAS clawback is priority

---

## Mandatory Withdrawal Rules

Regardless of strategy, certain withdrawals are mandatory:

### RRIF Minimums

```
// Must withdraw at least minimum each year starting at age 72
IF has_rrif AND age >= 72:
  minimum_withdrawal = rrif_balance × rrif_minimum_percentage(age)
  forced_rrif_withdrawal = minimum_withdrawal
```

### LIF Minimums and Maximums

```
// LIF has both floor and ceiling
IF has_lif AND age >= start_age:
  minimum_withdrawal = lif_balance × lif_minimum_percentage(age)
  maximum_withdrawal = lif_balance × lif_maximum_percentage(age)

  // Strategy withdrawal must be within bounds
  actual_lif_withdrawal = CLAMP(
    desired_withdrawal,
    minimum_withdrawal,
    maximum_withdrawal
  )
```

---

## Withdrawal Calculation Algorithm

### Step 1: Determine Annual Spending Need

```
spending_need = desired_retirement_spending
             + taxes_payable
             + one_time_expenses
             - guaranteed_income  // CPP, OAS, pensions
```

### Step 2: Apply Mandatory Withdrawals

```
// Calculate RRIF minimum (if applicable)
rrif_minimum = calculate_rrif_minimum(rrif_balance, age)
lif_minimum = calculate_lif_minimum(lif_balance, age)

// These are forced regardless of spending need
mandatory_withdrawals = rrif_minimum + lif_minimum
```

### Step 3: Calculate Remaining Need

```
remaining_need = spending_need - mandatory_withdrawals

IF remaining_need <= 0:
  // Mandatory withdrawals exceed spending need
  // Excess goes to non-registered account (or TFSA if room)
  surplus = ABS(remaining_need)
  reinvest_surplus(surplus)
  additional_withdrawals = 0
ELSE:
  // Need to withdraw more from accounts
  additional_withdrawals = remaining_need
```

### Step 4: Source Additional Withdrawals by Priority

```
FOR each account IN withdrawal_order:
  IF additional_withdrawals <= 0:
    BREAK

  available = account.balance - account.minimum_required
  withdrawal = MIN(additional_withdrawals, available)

  account.withdraw(withdrawal)
  additional_withdrawals -= withdrawal
```

### Step 5: Handle Shortfall

```
IF additional_withdrawals > 0:
  // All accounts depleted but still need income
  shortfall = additional_withdrawals
  record_shortfall(year, shortfall)
```

---

## Strategic Withdrawal Approaches

### Strategy 1: Tax Bracket Optimization

Fill lower tax brackets with RRSP/RRIF withdrawals, even if not needed for spending.

```
// Calculate optimal withdrawal to fill bracket
current_taxable_income = employment + pension + cpp + oas + mandatory_rrif
space_in_bracket = next_bracket_threshold - current_taxable_income

IF space_in_bracket > 0:
  optional_rrif_withdrawal = MIN(space_in_bracket, rrif_balance - rrif_minimum)
  // This reduces future RRIF balance and avoids higher taxes later
```

**Example:**

- Current taxable income: $50,000
- 20.5% federal bracket ends at: $55,867
- Space to fill: $5,867
- Withdraw extra $5,867 from RRIF to pay 20.5% now vs potentially 26%+ later

### Strategy 2: RRSP Meltdown

Systematically draw down RRSP/RRIF between ages 60-71 to reduce balance before mandatory minimums create large taxable income.

```
// Meltdown strategy parameters
meltdown_start_age = 60  // Or retirement age
meltdown_end_age = 71     // Before RRIF conversion
target_rrif_at_72 = desired_balance  // Lower = less forced income

annual_meltdown = (current_rrsp - target_rrif_at_72) / (meltdown_end_age - current_age)

// Withdraw this amount each year even if not needed for spending
// Reinvest surplus in TFSA or non-registered
```

### Strategy 3: OAS Clawback Avoidance

Manage taxable income to stay below OAS clawback threshold.

```
oas_threshold = 90997  // 2024

// Calculate safe income room
safe_taxable_income = oas_threshold - safety_margin
current_guaranteed_income = cpp + pension + interest

// Limit discretionary withdrawals
max_rrif_withdrawal = safe_taxable_income - current_guaranteed_income

// If spending need exceeds safe withdrawal:
IF spending_need > safe_taxable_income:
  // Use TFSA for excess (no taxable income)
  tfsa_withdrawal = spending_need - safe_taxable_income
```

### Strategy 4: Income Smoothing

Equalize taxable income across all retirement years to minimize cumulative taxes.

```
// Project future income needs and sources
total_taxable_assets = rrsp + rrif_future_value + non_reg_taxable_portion
years_remaining = life_expectancy - current_age

// Target equal annual income
target_annual_from_assets = total_taxable_assets / years_remaining + guaranteed_income

// Withdraw each year to hit target (within account rules)
```

---

## User Overrides

Users may override engine-calculated withdrawal amounts and base annual spending on a
per-year, per-account-type basis (RRSP, RRIF, LIF, TFSA, non-registered) via the editable
year-by-year table introduced in v4.2. Overrides are stored as priority inputs in
`scenarioDecisions.withdrawalOverrides[]` and `scenarioDecisions.spendingOverrides[]`
and are entered in real (today's) dollars; the engine inflates them to nominal at compute
time using the scenario's inflation rate.

### Interaction with Waterfall (Phase 1 — D-09, D-10)

When a withdrawal override is active for account type X in year Y, the engine applies the
overridden amount BEFORE the drawdown waterfall runs (D-09) and removes X's tier from the
remaining drawdown order for that year (D-10). Any spending need not satisfied by the
overridden amount is filled by the next tier in the user's drawdown order (NOT by additional
withdrawals from X).

### Apply-Forward Semantics (Phase 1 — D-07, D-08)

Overrides may be marked `applyForward: true`, in which case the override remains in effect
for every subsequent projection year until either a later override on the same field
supersedes it or a single-year override at the same `(field, year)` replaces it for that
one year only.

### Clamp-to-Balance (Phase 1 — D-11, D-12)

If the requested override exceeds the start-of-year balance for that account, the engine
withdraws the available balance and spills the shortfall into the remaining drawdown order.
The user's typed amount is preserved verbatim in `scenarioDecisions` (D-12) — clamping is
a compute-time concern, not a save-time one.

### Provenance (Phase 2 — D-40)

Every overridden cell carries `provenance.{field}.source = 'override'` with
`ruleId: 'override-user'` and `ruleName: 'User override'`. The popover surfaces the
timestamp and original engine-calculated value (PROV-02). This section is the canonical
source-of-truth anchor for that emission.

---

## Surplus Handling

When mandatory withdrawals exceed spending needs:

### Rule 1: TFSA First (If Room Available)

```
IF tfsa_contribution_room > 0:
  tfsa_deposit = MIN(surplus, tfsa_contribution_room)
  surplus -= tfsa_deposit
```

### Rule 2: Non-Registered Account

```
IF surplus > 0:
  non_reg_deposit = surplus
  // Track as new contributions with current cost base
```

### Rule 3: Pay Down Debt

```
IF has_mortgage AND surplus > 0:
  // Optional: apply surplus to mortgage
  mortgage_payment = MIN(surplus, mortgage_balance)
```

---

## Withdrawal Strategy Data Model

```typescript
interface WithdrawalStrategy {
  name: string;
  description: string;

  // Priority order (1 = first to withdraw)
  account_priority: {
    non_registered: number;
    rrsp: number;
    rrif: number;
    tfsa: number;
    lif: number;
  };

  // Strategy options
  options: {
    fill_tax_brackets: boolean;
    bracket_target?: 'current' | 'next' | number; // Specific bracket ceiling
    rrsp_meltdown: boolean;
    meltdown_target?: number; // Target RRIF balance at 72
    avoid_oas_clawback: boolean;
    income_smoothing: boolean;
  };

  // Surplus handling
  surplus_priority: ('tfsa' | 'non_reg' | 'mortgage')[];
}

interface WithdrawalPlan {
  year: number;
  age: number;

  // Spending
  desired_spending: number;
  guaranteed_income: number; // CPP, OAS, pensions
  net_spending_need: number;

  // Withdrawals by account
  withdrawals: {
    rrif_minimum: number;
    rrif_additional: number;
    lif: number;
    non_registered: number;
    tfsa: number;
  };

  // Results
  total_withdrawal: number;
  taxable_withdrawal: number;
  surplus_reinvested?: number;
  shortfall?: number;
}
```

---

## Pension Income Splitting Integration

For married couples age 65+, pension income splitting reduces household tax and can lower net withdrawal need. The optimizer runs inside `calculateCoupleYear` during the couple projection, searching split percentages to minimize combined federal + provincial tax plus OAS clawback.

For the authoritative rule, eligibility math, optimizer mechanism, and worked example, see VR-TAX-PSPLIT-001 in `04-tax-engine.md`.

---

## Withdrawal From Specific Account Types

### Non-Registered Withdrawals

```
// Calculate taxable portion
capital_gains_portion = withdrawal × (unrealized_gains / balance)
taxable_capital_gain = capital_gains_portion × 0.50

// Update cost base
proportional_acb = withdrawal × (adjusted_cost_base / balance)
new_acb = adjusted_cost_base - proportional_acb
new_unrealized_gains = unrealized_gains - capital_gains_portion
```

### TFSA Withdrawals

```
// No tax implications
withdrawal = MIN(desired_amount, tfsa_balance)

// Room restored next year
tfsa_room_restored_next_year += withdrawal
```

### RRIF Withdrawals

```
// Ensure minimum is met
minimum = balance × rrif_minimum_pct(age)
withdrawal = MAX(desired_amount, minimum)

// Withholding tax (for withdrawals above minimum)
IF withdrawal > minimum:
  excess = withdrawal - minimum
  withholding = calculate_withholding_tax(excess)
  net_withdrawal = withdrawal - withholding
  // Withholding credited against annual tax owing
```

---

## Test Cases

### TC-WD-001: Basic Withdrawal Order

**Input:**

- Spending need: $60,000
- CPP/OAS: $25,000
- Non-reg balance: $100,000
- RRIF balance: $200,000
- TFSA balance: $50,000
- Strategy: Standard (non-reg first)

**Expected:**

- Net need: $60,000 - $25,000 = $35,000
- Withdraw from non-reg: $35,000
- RRIF untouched (except minimum if applicable)
- TFSA untouched

### TC-WD-002: RRIF Minimum Exceeds Need

**Input:**

- Spending need: $40,000
- CPP/OAS/pension: $35,000
- RRIF balance: $400,000
- Age: 75
- RRIF minimum rate: 5.82%

**Expected:**

- RRIF minimum: $400,000 × 5.82% = $23,280
- Guaranteed income: $35,000
- Total income: $58,280
- Spending need: $40,000
- Surplus: $18,280
- Reinvest $18,280 (TFSA if room, else non-reg)

### TC-WD-003: OAS Clawback Avoidance

**Input:**

- OAS threshold: $90,997
- CPP: $15,000
- Pension: $40,000
- Current taxable: $55,000
- Spending need: $70,000

**Expected:**

- Safe room: $90,997 - $55,000 = $35,997
- Need from investments: $70,000 - $55,000 = $15,000
- RRIF withdrawal: $15,000 (within safe room)
- Remaining: $0
- OAS clawback: $0

### TC-WD-004: Tax Bracket Filling

**Input:**

- Current taxable: $50,000
- Next bracket starts: $55,867
- RRIF balance: $300,000
- Strategy: Fill bracket

**Expected:**

- Space to fill: $5,867
- Extra RRIF withdrawal: $5,867
- Taxed at 20.5% instead of future higher rate
- Reinvest $5,867 in TFSA/non-reg

### TC-WD-005: Account Depletion Sequence

**Input:**

- Non-reg: $20,000
- RRIF: $50,000
- TFSA: $30,000
- Annual need: $40,000
- Strategy: Standard order

**Year 1:**

- Withdraw $20,000 non-reg (depleted)
- Withdraw $20,000 RRIF
- Non-reg end: $0, RRIF end: $30,000

**Year 2:**

- Non-reg empty
- Withdraw $30,000 RRIF (depleted)
- Withdraw $10,000 TFSA
- RRIF end: $0, TFSA end: $20,000

### TC-WD-006: Spouse Income Splitting Impact

**Input:**

- Spouse A: $80,000 RRIF income, age 70
- Spouse B: $20,000 other income, age 68
- Province: Ontario

**Without splitting:**

- Spouse A tax: ~$18,000
- Spouse B tax: ~$1,200
- Combined: ~$19,200

**With 50% split:**

- Spouse A reports: $40,000
- Spouse B reports: $60,000 ($20k + $40k split)
- Spouse A tax: ~$6,500
- Spouse B tax: ~$11,000
- Combined: ~$17,500
- Savings: ~$1,700

---

## Implementation Notes

1. **Iterative calculation:** Withdrawals affect taxes, which affect net spending need. May require iteration to converge.

2. **Strategy selection:** Allow users to choose from preset strategies or customize their own withdrawal order.

3. **Override capability:** Users should be able to override calculated withdrawals for specific years/accounts.

4. **Visualization:** Show projected withdrawals by account over time to illustrate strategy impact.

5. **What-if comparison:** Enable comparing different strategies side-by-side (same inputs, different withdrawal approaches).
