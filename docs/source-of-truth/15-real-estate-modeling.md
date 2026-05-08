# 15 - Real Estate Modeling Specification

## Overview

Real estate is a significant component of many Canadian retirement plans. This document specifies how the projection engine models principal residences, rental properties, mortgages, downsizing events, and home equity access products. Real estate integrates with the projection engine at Step 8 (net worth calculation) and with the tax engine for rental income and capital gains.

---

## Principal Residence

### Description

The primary home where the user lives. Under the Principal Residence Exemption (PRE), capital gains on the sale of a principal residence are tax-free. The residence contributes to net worth but is illiquid until sold.

### Rules

| Rule ID   | Rule                          | Value/Formula                                                         |
| --------- | ----------------------------- | --------------------------------------------------------------------- |
| RE-PR-001 | Principal Residence Exemption | 100% of capital gain is tax-free on sale                              |
| RE-PR-002 | Value Growth                  | Compounded annually at user-specified rate (default 3%)               |
| RE-PR-003 | PRE Formula                   | Exempt gain = (years designated + 1) / years owned \* total gain      |
| RE-PR-004 | One PRE Per Family            | Only one property per family unit can be designated as PR per year    |
| RE-PR-005 | Ongoing Costs                 | Property tax + insurance + maintenance (user-specified annual amount) |

### Data Model

```typescript
interface PrincipalResidence {
  currentValue: number; // Current market value
  annualAppreciationRate: number; // Expected annual growth (e.g., 0.03 for 3%)
  yearPurchased: number; // Year of acquisition
  purchasePrice: number; // Original purchase price (ACB)
  annualCosts: number; // Property tax + insurance + maintenance
  mortgage?: Mortgage; // Optional mortgage details
}
```

### Annual Calculation

```
// Step 1: Appreciate the property value
property_value = property_value * (1 + appreciation_rate)

// Step 2: Deduct ongoing costs from cash flow
annual_expenses += annual_costs

// Step 3: Process mortgage payment (if applicable)
IF mortgage exists AND mortgage.remainingBalance > 0:
  process_mortgage_payment(mortgage)
  annual_expenses += mortgage.annualPayment
```

---

## Mortgage Modeling

### Description

Mortgages are modeled using standard Canadian amortization rules: fixed or variable rate, typically 25-year amortization with 5-year renewal terms.

### Rules

| Rule ID    | Rule                   | Value/Formula                                                                       |
| ---------- | ---------------------- | ----------------------------------------------------------------------------------- |
| RE-MTG-001 | Payment Formula        | M = P \* [r(1+r)^n] / [(1+r)^n - 1] where r = annual rate / 12, n = months          |
| RE-MTG-002 | Canadian Convention    | Semi-annual compounding for fixed-rate mortgages                                    |
| RE-MTG-003 | Effective Monthly Rate | r_eff = (1 + annual_rate/2)^(1/6) - 1                                               |
| RE-MTG-004 | Renewal                | At term end, remaining balance refinanced at a new rate (user-specified or default) |
| RE-MTG-005 | Prepayment             | Optional lump-sum prepayments reduce principal directly                             |
| RE-MTG-006 | Amortization Limit     | Maximum 25 years for insured, 30 years for conventional                             |

### Data Model

```typescript
interface Mortgage {
  originalPrincipal: number; // Original loan amount
  remainingBalance: number; // Current outstanding balance
  annualRate: number; // Current annual interest rate
  amortizationYears: number; // Total amortization period
  remainingAmortization: number; // Years remaining
  termYears: number; // Current term (e.g., 5 years)
  termRemaining: number; // Years left in current term
  renewalRate?: number; // Rate at next renewal (default: current rate)
  annualPrepayment?: number; // Optional annual lump-sum prepayment
}
```

### Annual Amortization Calculation

```
// Canadian fixed-rate: semi-annual compounding
effective_monthly_rate = (1 + annual_rate / 2)^(1/6) - 1
months_remaining = remaining_amortization * 12

// Monthly payment (constant over the term)
monthly_payment = remaining_balance *
  (effective_monthly_rate * (1 + effective_monthly_rate)^months_remaining) /
  ((1 + effective_monthly_rate)^months_remaining - 1)

// Annual summary
annual_payment = monthly_payment * 12
interest_paid = 0
FOR each month in year:
  month_interest = remaining_balance * effective_monthly_rate
  month_principal = monthly_payment - month_interest
  remaining_balance -= month_principal
  interest_paid += month_interest

// Apply annual prepayment
IF annual_prepayment > 0:
  remaining_balance -= min(annual_prepayment, remaining_balance)

// Term renewal check
term_remaining -= 1
IF term_remaining == 0:
  annual_rate = renewal_rate OR annual_rate
  term_remaining = term_years
  // Recalculate monthly payment at new rate
```

---

## Downsizing Simulation

### Description

A downsizing event represents selling the current home and purchasing a smaller/cheaper property, releasing equity that can be deployed into investment accounts. This is a common retirement strategy.

### Rules

| Rule ID   | Rule                       | Value/Formula                                                               |
| --------- | -------------------------- | --------------------------------------------------------------------------- |
| RE-DS-001 | Sale Transaction Costs     | 4-6% of sale price (agent commission + legal + moving)                      |
| RE-DS-002 | Purchase Transaction Costs | 1-3% of purchase price (land transfer tax + legal + inspection)             |
| RE-DS-003 | Net Cash Released          | Sale price - sale costs - purchase price - purchase costs - mortgage payoff |
| RE-DS-004 | Cash Destination           | Released equity deposited to TFSA (up to room), then non-registered         |
| RE-DS-005 | PRE on Sale                | Principal residence exemption applies; no capital gains tax                 |
| RE-DS-006 | Timing                     | User specifies the year of the downsizing event                             |

### Data Model

```typescript
interface DownsizingEvent {
  eventYear: number; // Year the downsizing occurs
  saleTransactionCostRate: number; // e.g., 0.05 for 5%
  newPropertyValue: number; // Purchase price of new (smaller) property
  purchaseTransactionCostRate: number; // e.g., 0.02 for 2%
  newMortgage?: Mortgage; // Optional mortgage on new property
  newAnnualCosts: number; // New ongoing costs
  cashDestination: 'tfsa_first' | 'non_registered' | 'split';
}
```

### Downsizing Calculation

```
// Execute in the specified event year
sale_price = current_property_value
sale_costs = sale_price * sale_transaction_cost_rate
mortgage_payoff = mortgage.remaining_balance OR 0

net_sale_proceeds = sale_price - sale_costs - mortgage_payoff
purchase_costs = new_property_value * purchase_transaction_cost_rate
cash_released = net_sale_proceeds - new_property_value - purchase_costs

// Deploy cash to accounts
IF cash_destination == 'tfsa_first':
  tfsa_deposit = min(cash_released, tfsa_contribution_room)
  non_reg_deposit = cash_released - tfsa_deposit
ELSE IF cash_destination == 'non_registered':
  non_reg_deposit = cash_released
ELSE: // split
  tfsa_deposit = min(cash_released * 0.5, tfsa_contribution_room)
  non_reg_deposit = cash_released - tfsa_deposit

// Replace property
property_value = new_property_value
annual_costs = new_annual_costs
mortgage = new_mortgage OR none
```

---

## Rental Property

### Description

Investment properties generate rental income (taxable) and may appreciate in value. On sale, capital gains are taxable at the 50% inclusion rate (not eligible for PRE). The Adjusted Cost Base (ACB) must be tracked for accurate gain calculations.

### Rules

| Rule ID     | Rule                 | Value/Formula                                                                   |
| ----------- | -------------------- | ------------------------------------------------------------------------------- |
| RE-RENT-001 | Rental Income        | Gross rent - operating expenses = net rental income                             |
| RE-RENT-002 | Tax on Rental Income | Net rental income added to personal taxable income                              |
| RE-RENT-003 | Capital Gain on Sale | (Sale price - ACB - selling costs) \* 50% inclusion rate                        |
| RE-RENT-004 | ACB Tracking         | Purchase price + capital improvements - CCA claimed                             |
| RE-RENT-005 | CCA (Depreciation)   | Optional: Class 1 building = 4% declining balance (user may elect not to claim) |
| RE-RENT-006 | Value Appreciation   | Compounded annually at user-specified rate                                      |
| RE-RENT-007 | Vacancy Rate         | User-specified (default 5%), reduces gross rental income                        |

### Data Model

```typescript
interface RentalProperty {
  currentValue: number; // Current market value
  purchasePrice: number; // Original purchase price
  adjustedCostBase: number; // ACB (purchase + improvements - CCA)
  annualAppreciationRate: number; // Expected annual growth
  grossAnnualRent: number; // Annual gross rental income
  annualOperatingExpenses: number; // Insurance, maintenance, property tax, management
  vacancyRate: number; // e.g., 0.05 for 5%
  claimCCA: boolean; // Whether to claim capital cost allowance
  ccaRate: number; // CCA rate (default 0.04 for Class 1)
  mortgage?: Mortgage; // Optional rental property mortgage
  plannedSaleYear?: number; // Optional year to sell
}

interface RealEstatePortfolio {
  principalResidence?: PrincipalResidence;
  rentalProperties: RentalProperty[];
  downsizingEvent?: DownsizingEvent;
}
```

### Annual Rental Calculation

```
// Step 1: Calculate net rental income
effective_rent = gross_annual_rent * (1 - vacancy_rate)
net_rental_income = effective_rent - annual_operating_expenses
IF mortgage exists:
  net_rental_income -= mortgage.interest_paid  // Only interest is deductible

// Step 2: Add net rental income to taxable income
taxable_income += max(0, net_rental_income)
// Note: Rental losses can offset other income (simplified: no loss restriction)

// Step 3: Optional CCA
IF claim_cca:
  cca_amount = (adjusted_cost_base - land_value) * cca_rate
  taxable_income -= cca_amount
  adjusted_cost_base -= cca_amount  // Reduces ACB, increases future capital gain

// Step 4: Appreciate property value
current_value = current_value * (1 + appreciation_rate)

// Step 5: Sale event (if planned)
IF current_year == planned_sale_year:
  sale_proceeds = current_value * (1 - selling_cost_rate)
  capital_gain = sale_proceeds - adjusted_cost_base
  taxable_capital_gain = capital_gain * 0.50  // 50% inclusion rate
  taxable_income += taxable_capital_gain
  // Net cash added to non-registered account
```

---

## HELOC and Reverse Mortgage (Advanced)

### Description

Home equity access products allow retirees to tap into home equity without selling. These are modeled with simplified treatment — detailed product terms vary by lender and are beyond the scope of precise modeling.

### Rules

| Rule ID      | Rule                         | Value/Formula                                                                  |
| ------------ | ---------------------------- | ------------------------------------------------------------------------------ |
| RE-HELOC-001 | HELOC Limit                  | Up to 65% of home value (combined with mortgage, max 80% LTV)                  |
| RE-HELOC-002 | HELOC Interest               | Variable rate, interest-only payments, fully deductible if used for investment |
| RE-RM-001    | Reverse Mortgage Eligibility | Homeowner aged 55+, principal residence                                        |
| RE-RM-002    | Reverse Mortgage Limit       | Up to 55% of home value (varies by age and property)                           |
| RE-RM-003    | Reverse Mortgage Repayment   | No payments required until sale, move, or death                                |
| RE-RM-004    | Reverse Mortgage Interest    | Compounds (added to balance), typically prime + 2-4%                           |
| RE-RM-005    | Tax Treatment                | Reverse mortgage proceeds are not taxable income                               |

> **Note:** HELOC and reverse mortgage modeling is simplified. The projection engine tracks the balance and interest accrual but does not model detailed lender terms, qualification criteria, or rate adjustments.

---

## Integration with Projection Engine

Real estate integrates with the projection engine ([08-projection-engine.md](./08-projection-engine.md)) as follows:

| Projection Step               | Real Estate Integration                                     |
| ----------------------------- | ----------------------------------------------------------- |
| Step 3: Calculate Income      | Add net rental income to taxable income                     |
| Step 5: Calculate Tax         | Include rental income and capital gains from property sales |
| Step 6: Process Withdrawals   | Downsizing cash released reduces withdrawal needs           |
| Step 7: Process Contributions | Downsizing cash deposited to TFSA/non-reg                   |
| Step 8: Calculate Net Worth   | Include property values, subtract mortgage balances         |

### Net Worth Contribution

```
real_estate_net_worth =
  principal_residence.value
  + sum(rental_property.value for each rental_property)
  - principal_residence.mortgage.remaining_balance
  - sum(rental_property.mortgage.remaining_balance for each rental_property)
  - heloc_balance
  - reverse_mortgage_balance
```

---

## Test Cases

### TC-RE-001: Principal Residence Appreciation

**Input:**

- Current value: $600,000
- Annual appreciation: 3%
- Year: 1

**Expected:**

- Year-end value: $618,000
- No tax impact (PRE applies on future sale)

---

### TC-RE-002: Mortgage Amortization (Canadian Semi-Annual Compounding)

**Input:**

- Principal: $400,000
- Annual rate: 5.0%
- Amortization: 25 years
- Semi-annual compounding (Canadian convention)

**Expected:**

- Effective monthly rate: (1 + 0.05/2)^(1/6) - 1 = 0.004124
- Monthly payment: ~$2,326
- Year 1 interest paid: ~$19,640
- Year 1 principal paid: ~$8,272
- Year-end balance: ~$391,728

---

### TC-RE-003: Downsizing Cash Release

**Input:**

- Current home value: $800,000
- Remaining mortgage: $100,000
- Sale costs: 5%
- New property: $400,000
- Purchase costs: 2%
- TFSA room: $30,000

**Expected:**

- Net sale proceeds: $800,000 - $40,000 - $100,000 = $660,000
- Purchase total: $400,000 + $8,000 = $408,000
- Cash released: $660,000 - $408,000 = $252,000
- TFSA deposit: $30,000
- Non-registered deposit: $222,000

---

### TC-RE-004: Rental Property Income Taxation

**Input:**

- Gross annual rent: $24,000
- Operating expenses: $8,000
- Mortgage interest: $6,000
- Vacancy rate: 5%

**Expected:**

- Effective rent: $24,000 \* 0.95 = $22,800
- Net rental income: $22,800 - $8,000 - $6,000 = $8,800
- $8,800 added to personal taxable income

---

### TC-RE-005: Rental Property Sale Capital Gain

**Input:**

- Sale price: $500,000
- Selling costs: 5% ($25,000)
- Adjusted cost base: $350,000

**Expected:**

- Capital gain: $500,000 - $25,000 - $350,000 = $125,000
- Taxable capital gain (50% inclusion): $62,500
- $62,500 added to personal taxable income

---

### TC-RE-006: Reverse Mortgage Balance Accrual

**Input:**

- Initial advance: $150,000
- Annual interest rate: 6.5%
- Years held: 5

**Expected:**

- Year 1 balance: $159,750
- Year 2 balance: $170,134
- Year 3 balance: $181,192
- Year 4 balance: $192,970
- Year 5 balance: $205,512
- No payments required; balance deducted from home equity at sale

---

## Cross-References

- [03-income-sources.md](./03-income-sources.md) — Rental income as an income source
- [04-tax-engine.md](./04-tax-engine.md) — Capital gains inclusion rate, rental income taxation
- [07-withdrawal-strategies.md](./07-withdrawal-strategies.md) — Downsizing reduces withdrawal needs
- [08-projection-engine.md](./08-projection-engine.md) — Integration points in year-by-year calculation
