# 10 - Scenarios Specification

## Overview

Scenario analysis allows users to create, modify, and compare alternative retirement plans. This feature enables exploration of different assumptions and decisions to understand their impact on retirement outcomes.

---

## Scenario Types

### 1. Base Scenario

The primary plan with all current assumptions. Serves as the reference point for comparisons.

```typescript
interface BaseScenario {
  id: 'base';
  name: 'Current Plan';
  description: 'Your retirement plan with current assumptions';
  is_base: true;
  inputs: ProjectionInput;
  results: ProjectionOutput;
}
```

### 2. Alternative Scenarios

User-created variations of the base scenario with modified assumptions.

```typescript
interface AlternativeScenario {
  id: string;
  name: string;
  description: string;
  is_base: false;
  based_on: string; // ID of parent scenario
  modifications: ScenarioModification[];
  inputs: ProjectionInput; // Computed from base + modifications
  results: ProjectionOutput;
}
```

### 3. System-Generated Scenarios

Pre-defined scenarios the system can automatically create for comparison.

| Scenario         | Description             | Modifications              |
| ---------------- | ----------------------- | -------------------------- |
| Early Retirement | Retire 5 years earlier  | retirement_age - 5         |
| Late Retirement  | Retire 5 years later    | retirement_age + 5         |
| CPP at 60        | Take CPP earliest       | cpp_start_age = 60         |
| CPP at 70        | Delay CPP maximum       | cpp_start_age = 70         |
| Higher Spending  | 20% more spending       | retirement_spending × 1.20 |
| Lower Returns    | Conservative markets    | investment_return - 2%     |
| Longer Life      | Extend planning horizon | life_expectancy + 5        |

---

## Scenario Modifications

### Modification Categories

```typescript
type ModificationCategory =
  | 'retirement_timing'
  | 'benefit_timing'
  | 'spending'
  | 'investment'
  | 'income'
  | 'one_time_event'
  | 'strategy';

interface ScenarioModification {
  category: ModificationCategory;
  field: string;
  original_value: any;
  new_value: any;
  description: string;
}
```

### Common Modifications

| Category          | Field                 | Example Change               |
| ----------------- | --------------------- | ---------------------------- |
| retirement_timing | retirement_age        | 65 → 62                      |
| retirement_timing | spouse_retirement_age | 63 → 60                      |
| benefit_timing    | cpp_start_age         | 65 → 70                      |
| benefit_timing    | oas_start_age         | 65 → 67                      |
| spending          | retirement_spending   | $60,000 → $70,000            |
| spending          | spending_growth_rate  | 2% → 3%                      |
| investment        | investment_return     | 5% → 4%                      |
| investment        | inflation_rate        | 2% → 3%                      |
| income            | add_part_time_income  | $0 → $15,000/year ages 65-70 |
| one_time_event    | add_inheritance       | $100,000 in 2030             |
| one_time_event    | add_major_expense     | $50,000 in 2028              |
| strategy          | withdrawal_order      | Standard → RRSP meltdown     |

---

## Scenario Comparison

### Comparison Metrics

When comparing scenarios, highlight differences in key metrics:

```typescript
interface ScenarioComparison {
  scenarios: string[]; // IDs of scenarios being compared

  metrics_comparison: {
    probability_of_success: {
      [scenario_id: string]: number;
    };
    depletion_age: {
      [scenario_id: string]: number | null;
    };
    ending_net_worth: {
      [scenario_id: string]: number;
    };
    lifetime_taxes: {
      [scenario_id: string]: number;
    };
    oas_clawback_total: {
      [scenario_id: string]: number;
    };
  };

  yearly_comparison: {
    year: number;
    net_worth: {
      [scenario_id: string]: number;
    };
    income: {
      [scenario_id: string]: number;
    };
    taxes: {
      [scenario_id: string]: number;
    };
  }[];

  winner_by_metric: {
    [metric: string]: string; // scenario_id
  };
}
```

### Comparison Display

```
┌──────────────────────────────────────────────────────────────────┐
│                    SCENARIO COMPARISON                           │
├──────────────────────────────────────────────────────────────────┤
│ Metric                  │ Base Plan  │ Retire at 62 │ CPP at 70  │
├─────────────────────────┼────────────┼──────────────┼────────────┤
│ Success Probability     │    87%     │     72%      │    89%     │
│ Assets Last Until       │   Age 96   │    Age 88    │   Age 98   │
│ Ending Net Worth        │  $285,000  │   $95,000    │  $340,000  │
│ Lifetime Taxes          │  $425,000  │  $380,000    │  $445,000  │
│ OAS Clawback            │   $25,000  │   $12,000    │   $28,000  │
├─────────────────────────┼────────────┼──────────────┼────────────┤
│ Assessment              │    Good    │   At Risk    │   Better   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Scenario Management

### Create Scenario

```typescript
function createScenario(
  baseScenario: Scenario,
  modifications: ScenarioModification[],
  name: string,
  description: string
): AlternativeScenario {
  // Clone base inputs
  const newInputs = deepClone(baseScenario.inputs);

  // Apply each modification
  for (const mod of modifications) {
    applyModification(newInputs, mod);
  }

  // Run projection with new inputs
  const results = runProjection(newInputs);

  return {
    id: generateId(),
    name,
    description,
    is_base: false,
    based_on: baseScenario.id,
    modifications,
    inputs: newInputs,
    results,
  };
}
```

### Update Scenario

```typescript
function updateScenario(
  scenario: AlternativeScenario,
  newModifications: ScenarioModification[]
): AlternativeScenario {
  // Get base scenario
  const base = getScenario(scenario.based_on);

  // Replace modifications
  return createScenario(base, newModifications, scenario.name, scenario.description);
}
```

### Delete Scenario

```typescript
function deleteScenario(scenarioId: string): void {
  // Cannot delete base scenario
  if (scenarioId === 'base') {
    throw new Error('Cannot delete base scenario');
  }

  // Check for dependent scenarios
  const dependents = scenarios.filter((s) => s.based_on === scenarioId);
  if (dependents.length > 0) {
    // Either cascade delete or re-parent to base
    for (const dep of dependents) {
      dep.based_on = 'base';
      recalculateScenario(dep);
    }
  }

  scenarios.delete(scenarioId);
}
```

---

## Pre-Built Scenario Templates

### Retirement Age Sensitivity

```typescript
const retirementAgeSensitivity = {
  name: 'Retirement Age Sensitivity',
  description: 'Compare outcomes for different retirement ages',
  scenarios: [
    { name: 'Retire at 60', modification: { field: 'retirement_age', value: 60 } },
    { name: 'Retire at 62', modification: { field: 'retirement_age', value: 62 } },
    { name: 'Retire at 65', modification: { field: 'retirement_age', value: 65 } },
    { name: 'Retire at 67', modification: { field: 'retirement_age', value: 67 } },
  ],
};
```

### CPP/OAS Timing Analysis

```typescript
const benefitTimingAnalysis = {
  name: 'Government Benefit Timing',
  description: 'Compare different CPP and OAS start ages',
  scenarios: [
    {
      name: 'CPP 60, OAS 65',
      modifications: [
        { field: 'cpp_start_age', value: 60 },
        { field: 'oas_start_age', value: 65 },
      ],
    },
    {
      name: 'CPP 65, OAS 65',
      modifications: [
        { field: 'cpp_start_age', value: 65 },
        { field: 'oas_start_age', value: 65 },
      ],
    },
    {
      name: 'CPP 70, OAS 70',
      modifications: [
        { field: 'cpp_start_age', value: 70 },
        { field: 'oas_start_age', value: 70 },
      ],
    },
  ],
};
```

### Market Stress Test

```typescript
const marketStressTest = {
  name: 'Market Conditions',
  description: 'Test plan resilience to different market scenarios',
  scenarios: [
    { name: 'Optimistic (7%)', modification: { field: 'investment_return', value: 0.07 } },
    { name: 'Expected (5%)', modification: { field: 'investment_return', value: 0.05 } },
    { name: 'Conservative (3%)', modification: { field: 'investment_return', value: 0.03 } },
    { name: 'Poor Markets (1%)', modification: { field: 'investment_return', value: 0.01 } },
  ],
};
```

### Longevity Risk

```typescript
const longevityScenarios = {
  name: 'Longevity Planning',
  description: 'Test plan against different life expectancies',
  scenarios: [
    { name: 'Age 85', modification: { field: 'life_expectancy', value: 85 } },
    { name: 'Age 90', modification: { field: 'life_expectancy', value: 90 } },
    { name: 'Age 95', modification: { field: 'life_expectancy', value: 95 } },
    { name: 'Age 100', modification: { field: 'life_expectancy', value: 100 } },
  ],
};
```

---

## What-If Analysis Interface

### Quick Adjustments

Allow rapid testing of single-variable changes:

```typescript
interface QuickWhatIf {
  variable: string;
  current_value: number;
  test_range: {
    min: number;
    max: number;
    step: number;
  };
  impact_metric: string; // Which metric to show impact on
}

// Example: Retirement age slider
const retirementAgeWhatIf: QuickWhatIf = {
  variable: 'retirement_age',
  current_value: 65,
  test_range: { min: 55, max: 70, step: 1 },
  impact_metric: 'probability_of_success',
};

// Returns array of {value, impact} for charting
function runQuickWhatIf(whatIf: QuickWhatIf): { value: number; impact: number }[] {
  const results = [];
  for (let v = whatIf.test_range.min; v <= whatIf.test_range.max; v += whatIf.test_range.step) {
    const scenario = createTempScenario({ [whatIf.variable]: v });
    results.push({
      value: v,
      impact: scenario.results.metrics[whatIf.impact_metric],
    });
  }
  return results;
}
```

### Multi-Variable Sensitivity

```typescript
interface SensitivityAnalysis {
  variables: string[];
  ranges: { [variable: string]: number[] };
  output_metric: string;
}

// Example: Return vs Inflation sensitivity
const returnInflationSensitivity: SensitivityAnalysis = {
  variables: ['investment_return', 'inflation_rate'],
  ranges: {
    investment_return: [0.03, 0.04, 0.05, 0.06, 0.07],
    inflation_rate: [0.01, 0.02, 0.03, 0.04],
  },
  output_metric: 'depletion_age',
};

// Returns 2D matrix of outcomes
function runSensitivityAnalysis(analysis: SensitivityAnalysis): number[][] {
  const results: number[][] = [];
  for (const return_val of analysis.ranges.investment_return) {
    const row: number[] = [];
    for (const inflation_val of analysis.ranges.inflation_rate) {
      const scenario = createTempScenario({
        investment_return: return_val,
        inflation_rate: inflation_val,
      });
      row.push(scenario.results.metrics[analysis.output_metric]);
    }
    results.push(row);
  }
  return results;
}
```

---

## Scenario Data Model

```typescript
interface ScenarioStore {
  base: BaseScenario;
  alternatives: Map<string, AlternativeScenario>;
  comparisons: Map<string, ScenarioComparison>;

  // Active/selected scenarios for display
  active_scenario_id: string;
  comparison_scenario_ids: string[];
}

interface ScenarioSummary {
  id: string;
  name: string;
  description: string;
  is_base: boolean;
  created_at: Date;
  modified_at: Date;

  // Quick reference metrics
  probability_of_success: number;
  depletion_age: number | null;
  ending_net_worth: number;

  // Change from base
  delta_success?: number;
  delta_net_worth?: number;
}
```

---

## Test Cases

### TC-SCEN-001: Create Alternative Scenario

**Input:**

- Base scenario: Retire at 65
- Modification: retirement_age = 62

**Expected:**

- New scenario created with id
- All inputs cloned from base except retirement_age
- Projection recalculated
- Results show impact of earlier retirement

### TC-SCEN-002: Compare Three Scenarios

**Input:**

- Scenario A: Base (retire 65, CPP 65)
- Scenario B: Early retirement (retire 62, CPP 65)
- Scenario C: Delayed benefits (retire 65, CPP 70)

**Expected:**

- Comparison table generated
- Each metric shown for all three
- Winner identified for each metric
- Yearly comparison data available for charts

### TC-SCEN-003: Quick What-If

**Input:**

- Variable: retirement_spending
- Current: $60,000
- Range: $40,000 to $80,000, step $5,000
- Metric: probability_of_success

**Expected:**

- 9 data points generated
- Shows probability at each spending level
- Chart-ready output

### TC-SCEN-004: Delete Scenario with Dependents

**Input:**

- Scenario A: Base
- Scenario B: Based on A
- Scenario C: Based on B
- Delete Scenario B

**Expected:**

- Scenario C re-parented to Base (A)
- Scenario C recalculated based on A
- Scenario B deleted

### TC-SCEN-005: Sensitivity Matrix

**Input:**

- Variables: investment_return (3%, 5%, 7%), inflation (1%, 2%, 3%)
- Metric: ending_net_worth

**Expected:**

- 3x3 matrix of results
- Shows net worth for each combination
- Identifies best/worst combinations

---

## Implementation Notes

1. **Performance:** Cache scenario results. Only recalculate when inputs change.

2. **Storage:** For web app, store scenarios in localStorage or backend. Limit number of scenarios (e.g., 10 max).

3. **Undo:** Consider implementing undo for scenario modifications.

4. **Export:** Allow exporting comparison results to PDF or CSV.

5. **Sharing:** Enable sharing scenarios (e.g., advisor shares with client).
