# 09 - Success Metrics Specification

## Overview

Success metrics provide quantitative measures to evaluate whether a retirement plan will achieve its goals. These metrics help users understand plan viability, risk levels, and areas for improvement.

---

## Primary Success Metrics

### 1. Probability of Success (Monte Carlo)

**Definition:** The percentage of simulated scenarios where the plan meets all spending needs without depleting assets before life expectancy.

```
probability_of_success = (successful_scenarios / total_scenarios) × 100%

Where:
  successful_scenario = final_balance > 0 AND no_shortfall_years
```

**Interpretation:**

| Probability | Assessment  | Action                                             |
| ----------- | ----------- | -------------------------------------------------- |
| 95%+        | Very secure | May be able to increase spending or retire earlier |
| 85-95%      | Secure      | Plan is well-funded                                |
| 75-85%      | Moderate    | Acceptable but monitor closely                     |
| 60-75%      | At risk     | Consider adjustments                               |
| <60%        | High risk   | Significant changes needed                         |

**Calculation:**

```
num_simulations = 1000
successful = 0

FOR sim IN 1..num_simulations:
  run_simulation(sim)
  IF portfolio_never_depleted AND no_shortfalls:
    successful++

probability_of_success = successful / num_simulations × 100
```

---

### 2. Portfolio Longevity (Depletion Age)

**Definition:** The age at which investment assets would be exhausted under the given assumptions.

```
// In deterministic mode
depletion_age = first_age_where(total_investments <= 0)

// If never depleted
depletion_age = "Beyond life expectancy" or null
```

**Display:**

- "Assets projected to last until age 94"
- "Assets never depleted - estate value at 95: $250,000"
- "Warning: Assets depleted at age 82 - 13 years short of plan"

---

### 3. Ending Net Worth / Estate Value

**Definition:** Projected value of all assets at end of planning horizon, net of terminal taxes.

```
VR-EST-NET-001: Summary estate aggregation from terminal-return events
`grossEstate` equals the sum of all non-rollover-decedent account balances (RRSP + RRIF + LIRA + LIF + TFSA + non-registered at FMV) aggregated across terminal-return events in the projection's final year. `terminalTaxes` equals the sum of `TerminalReturnResult.terminalTaxes` across all terminal-return events in the projection. `netEstate = grossEstate − terminalTaxes`. Real-estate equity is not modeled in M004.
```

#### VR-EST-NET-001 Estate Summary Mechanism

- `packages/calculation-engine/src/projection/multi-year.ts` —
  `aggregateEstateFromEvents` (lines 100–109) reduces the engine's emitted
  `terminalTaxEvents` into the three summary fields. `grossEstate` filters
  out events where `wasSpouseRolloverApplied === true` so the first
  decedent's pre-rollover balances are not double-counted against the
  survivor's event (the rolled-over balances are already reflected in the
  survivor's `grossEstate`). `terminalTaxes` sums every event's
  `terminalTaxes` (rollover events emit `0`). `netEstate` is the simple
  arithmetic difference.
- The single-person path (line 287) invokes the aggregator on a one-element
  event list; the couple path (line 1186) passes the full
  `terminalTaxEvents` array so both primary and surviving-spouse events are
  folded into one summary triple.
- Upstream dependencies: every event's `grossEstate` comes from
  `calculateTerminalReturn`, which sums the decedent's residual RRSP + RRIF
  - LIRA + LIF + TFSA + non-registered FMV at date of death. Registered
    balances (VR-EST-RRSP-INCLUSION-001) drive `deemedDispositionIncome`;
    non-registered FMV − ACB (VR-EST-DEEMED-001) drives
    `realizedCapitalGain`. Surviving-spouse events short-circuit to
    `terminalTaxes = 0` via VR-EST-SPOUSE-ROLLOVER-001.

#### VR-EST-NET-001 Worked Example (single fixture, terminal year)

Fixture: Ontario single, age 85 at terminal year, terminal-year balances
RRIF $457,450.00 (= $500,000.00 starting balance − $42,550.00 minimum
withdrawal at the 0.0851 age-85 factor), non-registered $300,000.00 (ACB
defaults to balance on the primary path so realized capital gain is
$0.00), TFSA $100,000.00, pension income $40,000.00. Figures below are
typed verbatim from the T01 engine capture
(`.gsd/milestones/M004/slices/S04/CAPTURE.md`, Scenario 1 summary).

| Field                                                 | Value                |
| ----------------------------------------------------- | -------------------- |
| RRIF balance at death (terminal year)                 | $457,450.00          |
| Non-registered FMV at death                           | $300,000.00          |
| TFSA balance at death                                 | $100,000.00          |
| `grossEstate` (sum of non-rollover-decedent balances) | $857,450.00          |
| `deemedDispositionIncome` (RRSP + RRIF residual)      | $457,450.00          |
| Realized capital gain (primary path, ACB = balance)   | $0.00                |
| `terminalTaxes` (sum across terminal-return events)   | $199,394.32246800003 |
| `netEstate` (`grossEstate − terminalTaxes`)           | $658,055.677532      |

Note: the slice-plan's hint of $900,000.00 grossEstate (= $500K RRIF +
$300K non-reg + $100K TFSA) is the pre-withdrawal balance sum; the engine
emits balances observed at end of the terminal year, after the
age-85 RRIF minimum withdrawal has run, so grossEstate is $857,450.00.
The VR-EST-NET-001 definition attaches to the engine's emitted
terminal-year balances — not to start-of-year balances — and the Worked
Example reflects that.

Parity: every row of this VR-EST-NET-001 Worked Example is reproduced to
the cent by
`packages/calculation-engine/src/tax/estate-single-person-worked-example.test.ts`.
Drift between `aggregateEstateFromEvents` and this table surfaces as an
expected-vs-actual cent failure on the drifting row.

**Display:**

- "Projected estate at age 85: $857,450.00 gross / $658,055.68 net (after $199,394.32 terminal taxes)"

Scope: this block covers the estate value projection and terminal-return
tax computation only. Non-tax legal instruments are out-of-scope for this
SCOPE-005 section.

---

### 4. Cumulative Shortfall

**Definition:** Total amount by which expenses exceed available funds across all projection years.

```
cumulative_shortfall = 0

FOR each year:
  IF expenses > available_income + available_withdrawals:
    annual_shortfall = expenses - (available_income + available_withdrawals)
    cumulative_shortfall += annual_shortfall

// Present value adjustment (optional)
shortfall_pv = sum(annual_shortfall[year] / (1 + discount_rate)^years)
```

**Display:**

- "Plan fully funded: No shortfalls projected"
- "Shortfall warning: $85,000 additional funding needed (present value)"

---

## Secondary Success Metrics

### 5. Safe Withdrawal Rate

**Definition:** The percentage of initial portfolio that can be withdrawn annually with high confidence of not depleting assets.

```
// Traditional 4% rule benchmark
traditional_swr = 4.0%

// Plan-specific SWR (via iterative calculation)
FOR withdrawal_rate FROM 3.0% TO 8.0% STEP 0.1%:
  run_monte_carlo(withdrawal_rate)
  IF probability_of_success >= 90%:
    safe_withdrawal_rate = withdrawal_rate

// Compare to actual withdrawal rate
actual_withdrawal_rate = first_year_withdrawal / initial_portfolio × 100
```

**Display:**

- "Safe withdrawal rate: 4.2%"
- "Your planned withdrawal rate: 5.1% (above safe level)"

---

### 6. Spending Flexibility

**Definition:** How much spending could increase or decrease while maintaining target success probability.

```
// Calculate spending at which success drops to threshold
FOR spending_increase FROM 0% TO 50% STEP 5%:
  adjusted_spending = base_spending × (1 + spending_increase)
  run_projection(adjusted_spending)
  IF probability_of_success < target_success:
    max_sustainable_increase = spending_increase - 5%
    BREAK

// Calculate spending decrease needed to reach higher confidence
FOR spending_decrease FROM 0% TO 50% STEP 5%:
  adjusted_spending = base_spending × (1 - spending_decrease)
  run_projection(adjusted_spending)
  IF probability_of_success >= higher_target:
    spending_decrease_for_confidence = spending_decrease
    BREAK
```

**Display:**

- "You could increase spending by 12% and maintain 85% success"
- "Reducing spending by 8% would increase success to 95%"

---

### 7. Lifetime Tax Burden

**Definition:** Total taxes paid across the projection period plus terminal taxes.

```
lifetime_taxes = 0

FOR each year:
  lifetime_taxes += annual_tax_paid

lifetime_taxes += terminal_estate_taxes

average_tax_rate = lifetime_taxes / lifetime_gross_income
```

**Display:**

- "Lifetime taxes: $485,000 (average rate: 22%)"
- "Terminal estate taxes: $95,000"
- "Total tax burden: $580,000"

---

### 8. OAS Efficiency

**Definition:** Measures how much OAS is retained vs. clawed back.

```
total_oas_entitled = sum(oas_gross_each_year)
total_oas_clawback = sum(oas_clawback_each_year)
total_oas_received = total_oas_entitled - total_oas_clawback

oas_efficiency = total_oas_received / total_oas_entitled × 100%
```

**Display:**

- "OAS efficiency: 85% ($145,000 received of $170,000 entitled)"
- "Total OAS clawback: $25,000 over retirement"
- "Years with clawback: 8 of 30"

---

### 9. Income Replacement Ratio

**Definition:** Retirement income as a percentage of pre-retirement income.

```
pre_retirement_income = average(employment_income_last_5_years)
retirement_income = average(retirement_income_first_5_years)

income_replacement_ratio = retirement_income / pre_retirement_income × 100%
```

**Target ranges:**

- 70-80% is often considered adequate
- Accounts for reduced expenses (no commuting, work clothes, etc.)

---

## Risk Metrics

### 10. Worst-Case Ending Balance

**Definition:** The 5th percentile outcome from Monte Carlo simulation.

```
all_final_balances = sort(monte_carlo_results.map(r => r.final_balance))
worst_case_5th = all_final_balances[num_simulations × 0.05]
```

**Display:**

- "Worst case (5th percentile): $0 (depleted at age 88)"
- "There is a 5% chance your outcome will be worse than this"

---

### 11. Best-Case Ending Balance

**Definition:** The 95th percentile outcome from Monte Carlo simulation.

```
best_case_95th = all_final_balances[num_simulations × 0.95]
```

**Display:**

- "Best case (95th percentile): $1,450,000"
- "There is a 5% chance your outcome will be better than this"

---

### 12. Sequence of Returns Risk Score

**Definition:** Measures vulnerability to poor returns in early retirement years.

```
// Run projection with worst historical sequences
worst_sequence_outcome = run_with_returns(worst_first_5_years_historical)
best_sequence_outcome = run_with_returns(best_first_5_years_historical)

sequence_impact = (best_sequence_outcome - worst_sequence_outcome) / worst_sequence_outcome

// High impact = high sequence risk
IF sequence_impact > 0.50:
  sequence_risk = "High"
ELSE IF sequence_impact > 0.25:
  sequence_risk = "Moderate"
ELSE:
  sequence_risk = "Low"
```

---

## Success Metrics Data Model

```typescript
interface SuccessMetrics {
  // Primary metrics
  probability_of_success?: number; // Monte Carlo only
  depletion_age?: number; // null if never depleted
  ending_net_worth: number;
  ending_estate_net: number;
  cumulative_shortfall: number;

  // Secondary metrics
  safe_withdrawal_rate: number;
  actual_withdrawal_rate: number;
  spending_increase_capacity: number; // % increase maintaining success
  spending_decrease_for_95pct: number; // % decrease to reach 95%

  // Tax metrics
  lifetime_taxes_paid: number;
  terminal_taxes: number;
  average_tax_rate: number;
  oas_efficiency: number;
  total_oas_clawback: number;

  // Income metrics
  income_replacement_ratio: number;

  // Risk metrics (Monte Carlo)
  worst_case_balance?: number; // 5th percentile
  median_balance?: number; // 50th percentile
  best_case_balance?: number; // 95th percentile
  sequence_risk_score?: 'low' | 'moderate' | 'high';

  // Assessment
  overall_assessment: 'excellent' | 'good' | 'fair' | 'needs_attention' | 'critical';
  recommendations: string[];
}
```

---

## Metric Calculation Functions

### Probability of Success

```typescript
function calculateProbabilityOfSuccess(simulations: MonteCarloResult[]): number {
  const successful = simulations.filter(
    (sim) => sim.final_balance > 0 && sim.shortfall_years.length === 0
  ).length;

  return (successful / simulations.length) * 100;
}
```

### Portfolio Longevity

```typescript
function calculateDepletionAge(yearlyData: YearlyProjection[]): number | null {
  for (const year of yearlyData) {
    if (year.balances.total_investments <= 0) {
      return year.user_age;
    }
  }
  return null; // Never depleted
}
```

### Terminal Estate Value

```typescript
function calculateNetEstate(
  finalYear: YearlyProjection,
  spouse_survives: boolean
): { gross: number; taxes: number; net: number } {
  const gross = finalYear.balances.total_net_worth;

  let registeredTax = 0;
  if (!spouse_survives) {
    // RRSP/RRIF fully taxed at death
    const registeredBalance =
      finalYear.balances.rrsp + finalYear.balances.rrif + finalYear.balances.lif;

    registeredTax = registeredBalance * estimateTerminalTaxRate(registeredBalance);
  }

  // Capital gains on non-registered
  const unrealizedGains = finalYear.balances.non_reg_unrealized_gain;
  const cgTax = unrealizedGains * 0.5 * estimateTerminalTaxRate(unrealizedGains * 0.5);

  const totalTax = registeredTax + cgTax;
  const net = gross - totalTax;

  return { gross, taxes: totalTax, net };
}
```

---

## Display and Reporting

### Dashboard Summary

```
┌─────────────────────────────────────────────┐
│         RETIREMENT PLAN ASSESSMENT          │
├─────────────────────────────────────────────┤
│  Probability of Success:     87%   ✓ Good   │
│  Portfolio Lasts Until:      Age 96         │
│  Estate Value (net):         $285,000       │
├─────────────────────────────────────────────┤
│  Safe Withdrawal Rate:       4.3%           │
│  Your Withdrawal Rate:       4.1%  ✓        │
│  OAS Efficiency:             92%            │
├─────────────────────────────────────────────┤
│  Lifetime Taxes:             $425,000       │
│  Income Replacement:         78%            │
└─────────────────────────────────────────────┘
```

### Recommendations Engine

Based on metrics, generate actionable recommendations:

```typescript
function generateRecommendations(metrics: SuccessMetrics): string[] {
  const recommendations: string[] = [];

  if (metrics.probability_of_success < 80) {
    recommendations.push(
      'Consider reducing annual spending by ' +
        metrics.spending_decrease_for_95pct +
        '% to improve plan security'
    );
  }

  if (metrics.oas_efficiency < 80) {
    recommendations.push(
      'Significant OAS clawback detected. Consider RRSP meltdown ' +
        'strategy to reduce future taxable income'
    );
  }

  if (metrics.actual_withdrawal_rate > metrics.safe_withdrawal_rate) {
    recommendations.push(
      'Withdrawal rate (' +
        metrics.actual_withdrawal_rate +
        '%) ' +
        'exceeds safe rate (' +
        metrics.safe_withdrawal_rate +
        '%). ' +
        'Monitor closely or reduce spending'
    );
  }

  if (metrics.sequence_risk_score === 'high') {
    recommendations.push(
      'High sequence of returns risk. Consider a more conservative ' +
        'asset allocation in early retirement years'
    );
  }

  return recommendations;
}
```

---

## Test Cases

### TC-METRIC-001: Probability of Success

**Input:**

- 1000 Monte Carlo simulations
- 850 scenarios with positive ending balance
- 150 scenarios depleted

**Expected:**

- Probability of success: 85%

### TC-METRIC-002: Depletion Age

**Input:**

- Yearly projections showing:
  - Age 85: $50,000
  - Age 86: $25,000
  - Age 87: -$5,000

**Expected:**

- Depletion age: 87
- Warning generated at age 87

### TC-METRIC-003: Estate Calculation

**Input:**

- RRIF at death: $300,000
- Non-reg at death: $200,000 (ACB: $150,000)
- No surviving spouse
- Estimated terminal rate: 45%

**Expected:**

- Gross estate: $500,000
- RRIF tax: $300,000 × 45% = $135,000
- CG tax: $50,000 × 50% × 45% = $11,250
- Total tax: $146,250
- Net estate: $353,750

### TC-METRIC-004: Safe Withdrawal Rate

**Input:**

- Initial portfolio: $1,000,000
- Target success: 90%
- Monte Carlo results show 90% success at 4.2% withdrawal

**Expected:**

- Safe withdrawal rate: 4.2%
- If planned withdrawal is $50,000 (5.0%), flag as above safe rate
