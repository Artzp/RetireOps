# 01 - User Profile Specification

## Overview

The User Profile is the foundation of every retirement plan. It captures personal information and assumptions that drive all calculations throughout the system.

## Data Requirements

### Primary User

| Field                    | Type    | Required | Constraints                          | Description                                                 |
| ------------------------ | ------- | -------- | ------------------------------------ | ----------------------------------------------------------- |
| `birthdate`              | Date    | Yes      | Must be valid date, user must be 18+ | Used to calculate current age and timeline age-based events |
| `province`               | Enum    | Yes      | Valid Canadian province/territory    | Determines provincial tax brackets and credits              |
| `marital_status`         | Enum    | Yes      | `single`, `married`, `common_law`    | Influences tax credits and income-splitting opportunities   |
| `life_expectancy`        | Integer | Yes      | 65-110, default: 95                  | Planning horizon for projections                            |
| `planned_retirement_age` | Integer | Yes      | Current age to 75                    | Age at which employment income stops                        |

### Spouse Profile (Required if marital_status is married or common_law)

| Field                           | Type    | Required    | Constraints         | Description                     |
| ------------------------------- | ------- | ----------- | ------------------- | ------------------------------- |
| `spouse_birthdate`              | Date    | Conditional | Must be valid date  | Spouse's date of birth          |
| `spouse_life_expectancy`        | Integer | Conditional | 65-110, default: 95 | Spouse's planning horizon       |
| `spouse_planned_retirement_age` | Integer | Conditional | Current age to 75   | Spouse's planned retirement age |

### Province Codes

```
AB - Alberta
BC - British Columbia
MB - Manitoba
NB - New Brunswick
NL - Newfoundland and Labrador
NS - Nova Scotia
NT - Northwest Territories
NU - Nunavut
ON - Ontario
PE - Prince Edward Island
QC - Quebec
SK - Saskatchewan
YT - Yukon
```

## Validation Rules

### VR-PROFILE-001: Age Calculation

```
current_age = floor((today - birthdate) / 365.25)
```

### VR-PROFILE-002: Retirement Age Constraint

```
planned_retirement_age >= current_age
planned_retirement_age <= 75
```

### VR-PROFILE-003: Life Expectancy Constraint

```
life_expectancy > planned_retirement_age
life_expectancy >= 65
```

### VR-PROFILE-004: Spouse Required Fields

```
IF marital_status IN ('married', 'common_law') THEN
  spouse_birthdate IS REQUIRED
  spouse_life_expectancy IS REQUIRED
```

## Default Values

| Field                    | Default Value | Rationale                                      |
| ------------------------ | ------------- | ---------------------------------------------- |
| `life_expectancy`        | 95            | Conservative assumption to test longevity risk |
| `spouse_life_expectancy` | 95            | Consistent with primary user                   |

## Age-Based Event Triggers

The user profile drives the following automatic events in the projection:

| Age | Event                                                  | Reference           |
| --- | ------------------------------------------------------ | ------------------- |
| 60  | CPP/QPP earliest eligibility                           | Government Benefits |
| 65  | OAS eligibility begins                                 | Government Benefits |
| 65  | Age Credit eligibility                                 | Tax Engine          |
| 65  | Pension income splitting eligibility                   | Tax Engine          |
| 71  | RRSP contribution deadline (Dec 31 of year turning 71) | Account Rules       |
| 71  | RRSP must convert to RRIF                              | Account Rules       |
| 72  | RRIF minimum withdrawals begin                         | Account Rules       |

## Test Cases

### TC-PROFILE-001: Basic Profile Creation

**Input:**

- birthdate: 1970-06-15
- province: ON
- marital_status: single
- life_expectancy: 90
- planned_retirement_age: 65

**Expected:**

- current_age: 55 (as of 2025)
- planning_horizon: 35 years (to age 90)
- Valid profile created

### TC-PROFILE-002: Married Profile Validation

**Input:**

- marital_status: married
- spouse_birthdate: null

**Expected:**

- Validation error: "Spouse birthdate is required for married status"

### TC-PROFILE-003: Invalid Retirement Age

**Input:**

- current_age: 60
- planned_retirement_age: 55

**Expected:**

- Validation error: "Retirement age cannot be earlier than current age"
