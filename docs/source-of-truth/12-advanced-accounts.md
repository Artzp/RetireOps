# 12 - Advanced Account Types Specification

## Overview

This document extends [02-account-types.md](./02-account-types.md) with two additional account types: Cash/HISA accounts and Corporate Investment Accounts (CCPC). These accounts serve distinct roles in retirement planning — cash as a liquidity buffer and corporate accounts as a tax-deferral vehicle for incorporated professionals and business owners.

---

## Cash / HISA Account

### Description

A cash or High Interest Savings Account (HISA) held outside registered accounts. Interest is fully taxable. There are no contribution limits, no withdrawal restrictions, and no government registration requirements. This is the simplest account type and serves as the default liquidity buffer.

### Rules

| Rule ID  | Rule                      | Value/Formula                                      |
| -------- | ------------------------- | -------------------------------------------------- |
| CASH-001 | Interest Rate Range       | 0.5% to 3.0% (user-configurable, default 2.0%)     |
| CASH-002 | Tax Treatment - Interest  | 100% taxable as ordinary income in the year earned |
| CASH-003 | Tax Treatment - Growth    | No capital gains (interest only)                   |
| CASH-004 | Contribution Limit        | None                                               |
| CASH-005 | Withdrawal Limit          | None (fully liquid)                                |
| CASH-006 | Withdrawal Order Priority | 0 (first — used before all other account types)    |
| CASH-007 | CDIC Insurance            | Up to $100,000 per eligible deposit category       |

### Data Model

```typescript
interface CashAccount {
  balance: number; // Current balance in CAD
  interestRate: number; // Annual interest rate (e.g., 0.02 for 2%)
  owner: 'primary' | 'spouse';
}
```

### Annual Calculation

```
// Step 1: Calculate interest earned
interest_earned = balance * interest_rate

// Step 2: Add interest to balance
balance = balance + interest_earned

// Step 3: Report interest as taxable income
taxable_income += interest_earned

// Step 4: Process contributions/withdrawals
balance = balance + contributions - withdrawals
```

### Validation Rules

```
VR-CASH-001: Interest rate must be between 0% and 10%
0 <= interest_rate <= 0.10

VR-CASH-002: Balance cannot go negative
balance >= 0 at all times

VR-CASH-003: Cash is always first in withdrawal order
withdrawal_priority(cash) < withdrawal_priority(all_other_accounts)
```

---

## Corporate Investment Account (CCPC)

### Description

A corporate investment account held within a Canadian-Controlled Private Corporation (CCPC). This is relevant for incorporated professionals (doctors, lawyers, consultants) and small business owners who retain earnings in their corporation. Corporate accounts have complex tax treatment involving corporate tax on passive income, a Refundable Dividend Tax On Hand (RDTOH) mechanism, and a Capital Dividend Account (CDA).

### Rules

| Rule ID  | Rule                                | Value/Formula                                                                           |
| -------- | ----------------------------------- | --------------------------------------------------------------------------------------- |
| CORP-001 | Corporate Tax Rate (Passive Income) | ~50.17% combined federal + provincial (varies by province)                              |
| CORP-002 | RDTOH Refund Rate                   | 38.33% of taxable dividends paid (refundable portion)                                   |
| CORP-003 | RDTOH Accumulation                  | 30.67% of passive investment income added to RDTOH balance                              |
| CORP-004 | Capital Dividend Account            | Tracks non-taxable portion of capital gains (50% of realized gains)                     |
| CORP-005 | Eligible Dividend Tax Rate          | Personal tax on eligible dividends (varies by province, ~33-39% effective)              |
| CORP-006 | Non-Eligible Dividend Tax Rate      | Personal tax on non-eligible dividends (varies by province, ~44-48% effective)          |
| CORP-007 | Capital Dividend                    | Tax-free to shareholder when paid from CDA balance                                      |
| CORP-008 | Small Business Deduction Clawback   | Passive income > $50,000 reduces SBD limit; eliminated at $150,000                      |
| CORP-009 | Integration Principle               | Total tax (corporate + personal on dividends) should approximate personal tax on salary |

### Data Model

```typescript
interface CorporateAccount {
  investmentBalance: number; // Current investment portfolio balance
  rdtohBalance: number; // Refundable Dividend Tax On Hand balance
  cdaBalance: number; // Capital Dividend Account balance
  corporateTaxRate: number; // Effective combined corporate tax rate on passive income
  owner: 'primary' | 'spouse';
  province: ProvinceCode; // Determines provincial corporate tax component
}

interface CorporateAnnualResult {
  investmentIncome: number; // Gross investment income earned
  corporateTaxPaid: number; // Corporate tax paid on investment income
  rdtohAdded: number; // Amount added to RDTOH this year
  rdtohRefund: number; // RDTOH refunded via dividend payment
  cdaAdded: number; // Amount added to CDA (from capital gains)
  dividendsPaid: number; // Total dividends paid to shareholder
  capitalDividendsPaid: number; // Tax-free dividends from CDA
  eligibleDividendsPaid: number;
  personalTaxOnDividends: number;
}
```

### Annual Calculation — Investment Income

```
// Step 1: Calculate gross investment income
interest_income = fixed_income_portion * interest_rate
dividend_income = equity_portion * dividend_yield
capital_gains = equity_portion * capital_gain_rate
total_investment_income = interest_income + dividend_income + capital_gains

// Step 2: Calculate corporate tax
corporate_tax = total_investment_income * corporate_tax_rate
net_after_corp_tax = total_investment_income - corporate_tax

// Step 3: Update RDTOH balance
rdtoh_addition = total_investment_income * 0.3067
rdtoh_balance = rdtoh_balance + rdtoh_addition

// Step 4: Update CDA balance (non-taxable portion of capital gains)
cda_addition = capital_gains * 0.50
cda_balance = cda_balance + cda_addition

// Step 5: Update investment balance
investment_balance = investment_balance + net_after_corp_tax
```

### Dividend Extraction Pathways

When the shareholder needs to extract funds from the corporation, three pathways are available:

```
// Pathway 1: Capital Dividend (tax-free)
IF cda_balance > 0:
  capital_dividend = min(amount_needed, cda_balance)
  cda_balance -= capital_dividend
  personal_tax = 0

// Pathway 2: Eligible Dividend (with RDTOH refund)
IF rdtoh_balance > 0:
  eligible_dividend = amount_needed - capital_dividend
  rdtoh_refund = min(rdtoh_balance, eligible_dividend * 0.3833)
  rdtoh_balance -= rdtoh_refund
  personal_tax = eligible_dividend * eligible_dividend_tax_rate

// Pathway 3: Non-Eligible Dividend (no RDTOH)
non_eligible_dividend = amount_needed - capital_dividend - eligible_dividend
personal_tax += non_eligible_dividend * non_eligible_dividend_tax_rate
```

### Optimal Extraction Order

```
1. Capital dividends (from CDA) — tax-free to shareholder
2. Eligible dividends (triggers RDTOH refund) — lower personal tax rate
3. Non-eligible dividends — highest personal tax rate
4. Salary — deductible to corp, taxable to individual, generates RRSP room
```

### Validation Rules

```
VR-CORP-001: RDTOH balance cannot be negative
rdtoh_balance >= 0

VR-CORP-002: CDA balance cannot be negative
cda_balance >= 0

VR-CORP-003: Capital dividends cannot exceed CDA balance
capital_dividends_paid <= cda_balance

VR-CORP-004: RDTOH refund cannot exceed RDTOH balance
rdtoh_refund <= rdtoh_balance

VR-CORP-005: Corporate tax rate must be reasonable
0.40 <= corporate_tax_rate <= 0.55
```

---

## Account Comparison (Extended)

This table extends the comparison in [02-account-types.md](./02-account-types.md).

| Feature                 | RRSP               | TFSA          | Non-Reg                  | LIRA                    | LIF         | Cash/HISA            | Corporate            |
| ----------------------- | ------------------ | ------------- | ------------------------ | ----------------------- | ----------- | -------------------- | -------------------- |
| Tax on contribution     | Deductible         | None          | None                     | N/A (locked)            | N/A         | None                 | N/A                  |
| Tax on growth           | Deferred           | None          | Annual                   | Deferred                | Deferred    | Annual (interest)    | ~50% corporate       |
| Tax on withdrawal       | 100% income        | None          | Capital gains / interest | 100% income             | 100% income | None (already taxed) | Dividend rates       |
| Contribution limit      | 18% earned income  | $7,000 (2024) | None                     | N/A                     | N/A         | None                 | None                 |
| Withdrawal restrictions | None (withholding) | None          | None                     | Locked until retirement | Min and max | None                 | Via dividends/salary |
| Mandatory conversion    | RRIF at 71         | None          | None                     | LIF at 71               | Min at 72   | None                 | None                 |
| Withdrawal priority     | 3                  | 4             | 2                        | 5                       | 5           | 0                    | 1                    |

---

## Test Cases

### TC-ADV-001: Cash Account Interest Taxation

**Input:**

- Cash/HISA balance: $50,000
- Interest rate: 2.5%
- Marginal tax rate: 40%

**Expected:**

- Interest earned: $1,250
- Tax on interest: $500
- Year-end balance (no withdrawals): $51,250
- Interest reported as ordinary income on tax return

---

### TC-ADV-002: Corporate Account RDTOH Accumulation

**Input:**

- Corporate investment balance: $500,000
- Passive investment income: $25,000 (all interest)
- Corporate tax rate: 50.17%

**Expected:**

- Corporate tax paid: $12,542.50
- RDTOH addition: $25,000 \* 0.3067 = $7,667.50
- Net retained in corporation: $12,457.50

---

### TC-ADV-003: Capital Dividend Account Tracking

**Input:**

- Realized capital gains in corporation: $40,000
- Existing CDA balance: $10,000

**Expected:**

- CDA addition: $40,000 \* 0.50 = $20,000
- New CDA balance: $30,000
- Shareholder can receive up to $30,000 as tax-free capital dividends

---

### TC-ADV-004: Dividend Extraction with RDTOH Refund

**Input:**

- RDTOH balance: $15,000
- Eligible dividends paid: $40,000
- Ontario resident, top marginal rate

**Expected:**

- RDTOH refund: min($15,000, $40,000 \* 0.3833) = min($15,000, $15,332) = $15,000
- Remaining RDTOH: $0
- Personal tax on eligible dividends: ~$15,320 (Ontario top rate ~38.3% effective)

---

### TC-ADV-005: Cash Account Withdrawal Priority

**Input:**

- Cash balance: $20,000
- RRSP balance: $100,000
- TFSA balance: $50,000
- Non-reg balance: $30,000
- Withdrawal needed: $15,000

**Expected:**

- Entire $15,000 withdrawn from cash account (priority 0)
- No other accounts touched
- Cash year-end balance: $5,000 (plus interest)

---

## Cross-References

- [02-account-types.md](./02-account-types.md) — Base account types (RRSP, TFSA, RRIF, LIRA, LIF, non-registered)
- [04-tax-engine.md](./04-tax-engine.md) — Personal tax rates on dividend income
- [07-withdrawal-strategies.md](./07-withdrawal-strategies.md) — Withdrawal order including cash and corporate accounts
