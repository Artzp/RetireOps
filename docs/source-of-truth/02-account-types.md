# 02 - Account Types Specification

## Overview

Canadian retirement planning centers on multiple account types, each with unique tax treatments, contribution limits, and withdrawal rules. This document defines the rules for each account type.

---

## RRSP - Registered Retirement Savings Plan

### Description

Tax-deferred retirement account where contributions reduce taxable income, investments grow tax-free, and withdrawals are fully taxed as ordinary income.

### Rules

| Rule ID  | Rule                         | Value/Formula                                     |
| -------- | ---------------------------- | ------------------------------------------------- |
| RRSP-001 | Contribution Deadline        | December 31 of the year turning 71                |
| RRSP-002 | Contribution Limit (2024)    | 18% of previous year earned income, max $31,560   |
| RRSP-003 | Contribution Limit (2025)    | 18% of previous year earned income, max $32,490   |
| RRSP-004 | Tax Treatment - Contribution | Deductible from taxable income                    |
| RRSP-005 | Tax Treatment - Growth       | Tax-deferred (no annual tax)                      |
| RRSP-006 | Tax Treatment - Withdrawal   | 100% taxable as ordinary income                   |
| RRSP-007 | Mandatory Conversion         | Must convert to RRIF by Dec 31 of year turning 71 |
| RRSP-008 | Withholding Tax (<=5000)     | 10% (5% in Quebec)                                |
| RRSP-009 | Withholding Tax (5001-15000) | 20% (10% in Quebec)                               |
| RRSP-010 | Withholding Tax (>15000)     | 30% (15% in Quebec)                               |

### Data Model

```
RRSPAccount {
  balance: Currency
  contribution_room: Currency
  annual_contribution: Currency
  owner: 'primary' | 'spouse'
  is_spousal: Boolean  // Contributions made by spouse
}
```

### Validation Rules

```
VR-RRSP-001: Cannot contribute after age 71
IF owner.age > 71 THEN annual_contribution = 0

VR-RRSP-002: Contribution cannot exceed room
annual_contribution <= contribution_room

VR-RRSP-003: Spousal RRSP attribution rule
IF is_spousal AND withdrawal within 3 years of contribution THEN
  withdrawal taxed to contributing spouse
```

#### VR-RRSP-003 Mechanism

Attribution is implemented via a ledger-driven FIFO algorithm in
`packages/calculation-engine/src/projection/multi-year.ts` (`applyFifoAttribution`).

- Each spousal contribution is recorded as a ledger entry `{ year, amount }`.
- On withdrawal, entries are consumed oldest-first (FIFO).
- An entry is **in-window** when `currentYear <= entry.year + 2` (i.e. within the
  same or next two calendar years after contribution).
- In-window amounts are attributed to the contributor; out-of-window amounts are
  attributed to the annuitant.
- Partial consumption mutates `entry.amount` in place; fully-consumed entries are
  removed from the ledger.

#### VR-RRSP-003 Worked Example

| Event              | Year | Ledger after                                                                                                                                                                                           |
| ------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Contribute $10,000 | 2024 | `[{year:2024, amount:10000}]`                                                                                                                                                                          |
| Contribute $5,000  | 2026 | `[{year:2024, amount:10000}, {year:2026, amount:5000}]`                                                                                                                                                |
| Withdraw $12,000   | 2026 | FIFO consumes $10,000 from 2024 entry (in-window: 2026 ≤ 2024+2 ✓) + $2,000 from 2026 entry (in-window: 2026 ≤ 2026+2 ✓) → **$12,000 attributed to contributor**; ledger: `[{year:2026, amount:3000}]` |

### T1 Reporting

The `spousalRRSPAttributedIncome` field on `PersonYearlyResult`
(`packages/shared/src/types/projection.ts`) maps to T1 returns as follows:

| Party                                 | T1 Line             | Treatment                                                                                                                 |
| ------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Annuitant** (account holder)        | 12900 (RRSP income) | Reports the full withdrawal as RRSP income, then deducts the attributed portion via T1 adjustment (CRA T4RSP slip Box 24) |
| **Contributor** (contributing spouse) | 12900 (RRSP income) | Adds `spousalRRSPAttributedIncome` to their RRSP income for the year                                                      |

> **CRA reference:** T4RSP Box 24 — "Amounts deemed received" identifies the
> portion of a spousal RRSP withdrawal that reverts to the contributor under
> the attribution rules (ITA s. 146(8.3)).

---

## RRIF - Registered Retirement Income Fund

### Description

Decumulation account that an RRSP converts to at age 71. Mandatory minimum withdrawals begin the year after conversion.

### Rules

| Rule ID  | Rule                       | Value/Formula                                                                               |
| -------- | -------------------------- | ------------------------------------------------------------------------------------------- |
| RRIF-001 | Minimum Withdrawal Start   | Year after conversion (typically age 72)                                                    |
| RRIF-002 | Minimum Withdrawal Formula | balance × minimum_percentage(age)                                                           |
| RRIF-003 | Maximum Withdrawal         | None (unlimited)                                                                            |
| RRIF-004 | Tax Treatment - Withdrawal | 100% taxable as ordinary income                                                             |
| RRIF-005 | Younger Spouse Election    | Can use younger spouse's age for minimum calculation                                        |
| RRIF-006 | Tax Treatment - Growth     | Tax-deferred                                                                                |
| RRIF-007 | Pre-71 Minimum Factor      | For ages below 71, factor = 1 ÷ (90 − age); never zero                                      |
| RRIF-008 | Younger Spouse Under 71    | Election rate uses RRIF-007 when younger age < 71; the minimum is reduced, never eliminated |

### Minimum Withdrawal Percentages

| Age | Percentage | Age | Percentage |
| --- | ---------- | --- | ---------- |
| 65  | 4.00%      | 80  | 6.82%      |
| 66  | 4.17%      | 81  | 7.08%      |
| 67  | 4.35%      | 82  | 7.38%      |
| 68  | 4.55%      | 83  | 7.71%      |
| 69  | 4.76%      | 84  | 8.08%      |
| 70  | 5.00%      | 85  | 8.51%      |
| 71  | 5.28%      | 86  | 8.99%      |
| 72  | 5.40%      | 87  | 9.55%      |
| 73  | 5.53%      | 88  | 10.21%     |
| 74  | 5.67%      | 89  | 10.99%     |
| 75  | 5.82%      | 90  | 11.92%     |
| 76  | 5.98%      | 91  | 13.06%     |
| 77  | 6.17%      | 92  | 14.49%     |
| 78  | 6.36%      | 93  | 16.34%     |
| 79  | 6.58%      | 94  | 18.79%     |
| 95+ | 20.00%     |

#### Pre-71 Minimum Factor (RRIF-007)

For ages below 71 the CRA-prescribed minimum factor is the general formula:

```
minimum_factor(age) = 1 / (90 − age)
```

This is the standard pre-71 factor under Income Tax Regulation 7308(4). The
percentages tabled above for ages 65–70 are exactly this formula
(e.g. age 65 → 1/25 = 4.00%, age 70 → 1/20 = 5.00%); ages 71–94 use the
separately prescribed table values, and 95+ is fixed at 20.00%. The factor is
**never zero** for any age — a young age produces a small minimum, not no
minimum.

This formula only becomes reachable for ages below 65 through the
younger-spouse election (RRIF-005 / RRIF-008): a normal RRIF holder has no
mandatory minimum until the year after conversion (RRIF-001, age ~72), so the
owner's own age is never below 65 when a minimum is computed.

#### Younger Spouse Under 71 (RRIF-008)

When the younger-spouse election (RRIF-005) is in effect and the younger
spouse's age is below 71, the minimum factor for the lookup is
`1 / (90 − younger_age)` per RRIF-007 — the election **reduces** the forced
minimum, it does **not** eliminate it. The owner's own RRIF-001 start gate
(age ≥ 72) still determines whether a minimum applies at all; only the rate
lookup uses the younger age.

### Data Model

```
RRIFAccount {
  balance: Currency
  owner: 'primary' | 'spouse'
  use_younger_spouse_age: Boolean
  converted_from_rrsp_year: Integer
}
```

### Calculation Examples

```
Example: RRIF balance $500,000 at age 72
Minimum withdrawal = $500,000 × 5.40% = $27,000

Example: Using younger spouse age (spouse is 65, owner is 72)
Minimum withdrawal = $500,000 × 4.00% = $20,000

Example: Using younger spouse age below 65 (spouse is 60, owner is 72) — RRIF-007/RRIF-008
Minimum factor = 1 / (90 − 60) = 1/30 ≈ 3.333%
Minimum withdrawal = $500,000 × 3.333% ≈ $16,667
```

---

## TFSA - Tax-Free Savings Account

### Description

Tax-free investment account where contributions are not deductible but all growth and withdrawals are completely tax-free.

### Rules

| Rule ID  | Rule                             | Value/Formula                              |
| -------- | -------------------------------- | ------------------------------------------ |
| TFSA-001 | Annual Contribution Limit (2024) | $7,000                                     |
| TFSA-002 | Annual Contribution Limit (2025) | $7,000                                     |
| TFSA-003 | Cumulative Limit (2009-2024)     | $95,000                                    |
| TFSA-004 | Cumulative Limit (2009-2025)     | $102,000                                   |
| TFSA-005 | Tax Treatment - Contribution     | Not deductible                             |
| TFSA-006 | Tax Treatment - Growth           | Tax-free                                   |
| TFSA-007 | Tax Treatment - Withdrawal       | Tax-free, not reported as income           |
| TFSA-008 | Withdrawal Room Restoration      | Withdrawn amount added to next year's room |
| TFSA-009 | Impact on Benefits               | Does NOT affect OAS clawback or GIS        |
| TFSA-010 | Age Requirement                  | Must be 18+ to contribute                  |

### Historical Contribution Limits

| Year      | Limit   | Cumulative |
| --------- | ------- | ---------- |
| 2009-2012 | $5,000  | $20,000    |
| 2013-2014 | $5,500  | $31,000    |
| 2015      | $10,000 | $41,000    |
| 2016-2018 | $5,500  | $57,500    |
| 2019-2022 | $6,000  | $81,500    |
| 2023      | $6,500  | $88,000    |
| 2024      | $7,000  | $95,000    |
| 2025      | $7,000  | $102,000   |

### Data Model

```
TFSAAccount {
  balance: Currency
  contribution_room: Currency
  annual_contribution: Currency
  owner: 'primary' | 'spouse'
}
```

---

## Non-Registered Account

### Description

Taxable investment account with no contribution limits. Investment income is taxed annually, and capital gains are taxed upon realization.

### Rules

| Rule ID  | Rule                     | Value/Formula                                                          |
| -------- | ------------------------ | ---------------------------------------------------------------------- |
| NREG-001 | Contribution Limit       | None                                                                   |
| NREG-002 | Tax - Interest Income    | 100% taxable as ordinary income                                        |
| NREG-003 | Tax - Canadian Dividends | Grossed up, then dividend tax credit applied                           |
| NREG-004 | Tax - Capital Gains      | 50% inclusion rate (66.67% for gains > $250k annually, effective 2024) |
| NREG-005 | Capital Gains Timing     | Taxed when realized (sold)                                             |
| NREG-006 | Cost Base Tracking       | ACB (Adjusted Cost Base) must be tracked                               |

### Dividend Gross-Up and Credit (2024)

| Dividend Type | Gross-Up | Federal Credit | Effective Rate           |
| ------------- | -------- | -------------- | ------------------------ |
| Eligible      | 38%      | 15.0198%       | ~25% lower than interest |
| Non-Eligible  | 15%      | 9.0301%        | ~15% lower than interest |

### Data Model

```
NonRegisteredAccount {
  balance: Currency
  adjusted_cost_base: Currency
  unrealized_gains: Currency
  annual_contribution: Currency
  income_allocation: {
    interest_pct: Percentage
    canadian_dividend_pct: Percentage
    capital_gains_pct: Percentage
  }
  owner: 'primary' | 'spouse'
}
```

### Capital Gains Calculation

```
On withdrawal/sale:
  realized_gain = withdrawal_amount × (unrealized_gains / balance)
  taxable_gain = realized_gain × 0.50  // 50% inclusion

  // Update ACB proportionally
  acb_reduction = withdrawal_amount × (adjusted_cost_base / balance)
  new_acb = adjusted_cost_base - acb_reduction
```

### Validation Rules (Terminal Year — Estate Value Projection)

```
VR-EST-DEEMED-001: Deemed disposition at death for non-registered holdings
Non-registered investments held at death are deemed disposed of at fair market value on the date of death. The difference between FMV and adjusted cost base (ACB) is realized as a capital gain, taxable at the tiered inclusion rate (50% on the first $250,000 of annual gain, 66.67% on the excess), and reported on the deceased's terminal T1 return. Capital losses at death are not modeled in M004 (gain clamped to zero when balance < ACB).
```

#### VR-EST-DEEMED-001 Deemed Disposition Mechanism

- `packages/calculation-engine/src/tax/terminal-return.ts` —
  `calculateTerminalReturn` drives the terminal-year tax computation for a
  deceased individual. It sums deemed-disposition income (residual RRSP +
  RRIF balances, fully included on the terminal T1) with realized capital
  gain on non-registered holdings (`balance − ACB`, clamped at zero when
  balance < ACB — capital losses at death are out of scope for M004) and
  passes the resulting gain into the tiered inclusion calculator.
- `packages/calculation-engine/src/tax/capital-gains.ts` —
  `calculateTaxableCapitalGainEnhanced` applies the two-tier inclusion rate:
  50% on the first $250,000 of annual realized gain and 66.67% on the
  excess. The terminal-return module invokes this helper with the
  terminal-year realized gain so large deemed-disposition gains that cross
  the $250,000 breakpoint are taxed at the correct blended rate.
- Non-registered ACB is expressed on the spouse fixture
  (`ProjectionInput.spouse.nonRegACB`) and defaults to `nonRegBalance` on
  the primary path. The Worked Example below therefore pins the cent-exact
  capital-gain demo on the couple-fixture spouse terminal year, where ACB
  is explicit.

#### VR-EST-DEEMED-001 Worked Example (couple fixture, spouse terminal year)

Fixture: couple, ON, spouse dies at age 90 after primary dies at 80 with
spouse rollover applied; spouse terminal-year non-registered holdings are
FMV $150,000.00 against ACB $60,000.00 (no other non-reg trades during the
projection). Residual RRIF at spouse death is $252,472.9050880938. Figures
below are typed verbatim from the T01 engine capture
(`.gsd/milestones/M004/slices/S04/CAPTURE.md`, Scenario 2 spouse event).

| Field                                        | Value                |
| -------------------------------------------- | -------------------- |
| Non-registered FMV at death (spouse)         | $150,000.00          |
| Adjusted cost base (spouse)                  | $60,000.00           |
| Realized capital gain (FMV − ACB)            | $90,000.00           |
| Taxable capital gain (50% inclusion tier)    | $45,000.00           |
| Residual RRIF at death (deemed disposition)  | $252,472.9050880938  |
| `deemedDispositionIncome` (terminal-T1 line) | $252,472.9050880938  |
| Gross estate at spouse terminal year         | $602,472.9050880938  |
| Terminal taxes at spouse terminal year       | $101,715.06347003629 |
| Net estate after terminal taxes              | $500,757.8416180576  |
| Spouse rollover applied on primary death     | true                 |
| Spouse rollover applied on spouse death      | false                |

Parity: every row of this VR-EST-DEEMED-001 Worked Example is reproduced to
the cent by
`packages/calculation-engine/src/tax/estate-couple-spouse-rollover-worked-example.test.ts`.
Drift between the engine's terminal-return aggregation and this table
fails that test with expected-vs-actual cents on the drifting row.

#### VR-EST-DEEMED-001 T1 Reporting

Realized capital gain at death is reported on **Schedule 3 — Capital Gains
(or Losses)** of the deceased's terminal T1 return. The taxable portion
(50% inclusion on the first $250,000 of annual gain, 66.67% on the excess)
flows into line 12700 (taxable capital gains) on the terminal T1. Residual
RRSP and RRIF balances are reported as fully taxable income on the terminal
T1 via their respective income lines (line 12900 RRSP / line 11500 RRIF
income from the final T4RSP/T4RIF slips), separately from Schedule 3.

Scope: this block covers the estate value projection and terminal-return
tax computation only. Non-tax legal instruments are out-of-scope for this
SCOPE-005 section.

---

```
VR-EST-RRSP-INCLUSION-001: Full income inclusion of registered balances on terminal T1
RRSP, RRIF, LIRA, and LIF balances held at the date of death are fully included as ordinary income on the deceased's terminal T1 return, taxed at marginal federal + provincial rates for the deceased's jurisdiction (VR-TAX-PROV-*-001). Spouse rollover (VR-EST-SPOUSE-ROLLOVER-001) defers this inclusion when a surviving spouse exists.
```

#### VR-EST-RRSP-INCLUSION-001 Registered Inclusion Mechanism

- `packages/calculation-engine/src/tax/terminal-return.ts` —
  `calculateTerminalReturn` composes `deemedDispositionIncome` as the sum of
  the four registered residuals at death:
  `rrspBalance + rrifBalance + liraBalance + lifBalance`. That aggregate is
  routed into the terminal-T1 ordinary-income computation via `rrifIncome`
  (the engine's pass-through slot into the marginal-rate tax calculator),
  so every dollar of registered residual is taxed at the deceased's full
  federal + provincial marginal rates — no rollover, no inclusion haircut,
  no capital-gains treatment.
- LIRA and LIF are treated identically to RRSP and RRIF respectively for
  terminal-T1 purposes: LIRA residual is reported on line 12900 (RRSP
  income) via a deemed conversion, and LIF residual is reported on line
  11500 (pension/RRIF income) via the final T4RIF slip.
- Spouse rollover (VR-EST-SPOUSE-ROLLOVER-001) short-circuits this
  mechanism for the first-to-die spouse: when `wasSpouseRolloverApplied`
  is true, the registered residuals transfer to the surviving spouse at
  cost, `deemedDispositionIncome` is recorded as `0`, and the full
  inclusion is deferred to the survivor's terminal year.

#### VR-EST-RRSP-INCLUSION-001 Worked Example (single fixture, terminal year)

Fixture: single, ON, age 85 terminal year; RRSP $0.00 + RRIF $500,000.00
(start of year) + LIRA $0.00 + LIF $0.00; pensionIncome $40,000.00;
no spouse → no rollover. Terminal-year RRIF minimum withdrawal of
$42,550.00 (rate 0.0851) is paid out first, leaving residual RRIF
$457,450.00 which the engine then deems fully disposed at death.
Figures below are typed verbatim from the T01 engine capture
(`.gsd/milestones/M004/slices/S04/CAPTURE.md`, Scenario 1).

| Field                                              | Value                |
| -------------------------------------------------- | -------------------- |
| RRSP balance at death                              | $0.00                |
| RRIF balance at death (post min-withdrawal)        | $457,450.00          |
| LIRA balance at death                              | $0.00                |
| LIF balance at death                               | $0.00                |
| Registered inclusion (RRSP + RRIF + LIRA + LIF)    | $457,450.00          |
| `deemedDispositionIncome` (terminal-T1 line)       | $457,450.00          |
| In-year pension income (pre-death)                 | $40,000.00           |
| In-year RRIF minimum withdrawal                    | $42,550.00           |
| In-year ordinary taxable income                    | $82,550.00           |
| In-year taxes paid (federal + ON, with credits)    | $14,872.318874999999 |
| Realized capital gain at death                     | $0.00                |
| Gross estate at terminal year                      | $857,450.00          |
| Terminal taxes (inclusive of registered inclusion) | $199,394.32246800003 |
| Net estate after terminal taxes                    | $658,055.677532      |
| Spouse rollover applied                            | false                |

Parity: every row of this VR-EST-RRSP-INCLUSION-001 Worked Example is
reproduced to the cent by
`packages/calculation-engine/src/tax/estate-single-person-worked-example.test.ts`.
Drift between the engine's terminal-return aggregation and this table
fails that test with expected-vs-actual cents on the drifting row.

#### VR-EST-RRSP-INCLUSION-001 T1 Reporting

Registered residuals are reported on the deceased's terminal T1 return as
fully taxable ordinary income, sourced from the final slips issued by the
plan administrators:

- **Line 12900 (RRSP income)** — residual RRSP balance from the final
  T4RSP slip. LIRA residual flows to the same line via its deemed
  conversion to RRSP-equivalent on plan wind-up at death.
- **Line 11500 (pension and RRIF income)** — residual RRIF balance from
  the final T4RIF slip. LIF residual flows to the same line via its
  deemed conversion to RRIF-equivalent on plan wind-up at death.

These inclusions are taxed at the deceased's full marginal federal +
provincial rates (VR-TAX-PROV-\*-001), with no special inclusion rate or
averaging. They are reported separately from Schedule 3 capital-gain
items (VR-EST-DEEMED-001, line 12700).

Scope: this block covers the estate value projection and terminal-return
tax computation only. Pension-income splitting on the terminal return
and charitable-donation credit planning against registered inclusion are
out-of-scope for this SCOPE-005 section.

---

```
VR-EST-SPOUSE-ROLLOVER-001: Tax-deferred rollover of registered and non-registered holdings to surviving spouse
When the deceased has a surviving spouse, RRSP/RRIF/LIRA/LIF balances and non-registered capital property transfer to the surviving spouse at the deceased's ACB with no deemed-disposition tax triggered in the deceased's terminal return. The surviving spouse inherits the tax liability on their own eventual death or withdrawal.
```

#### VR-EST-SPOUSE-ROLLOVER-001 Spouse Rollover Mechanism

- `packages/calculation-engine/src/tax/terminal-return.ts` —
  `calculateTerminalReturn` takes an early-return branch at lines 28–38
  when `input.hasSurvivingSpouse` is true. That branch returns a
  `TerminalReturnResult` with `deemedDispositionIncome = 0`,
  `realizedCapitalGain = 0`, `taxableCapitalGain = 0`,
  `terminalTaxes = 0`, `netEstate = grossEstate`, and
  `wasSpouseRolloverApplied = true`. The gross-estate aggregate is still
  computed (sum of RRSP + RRIF + LIRA + LIF + TFSA + non-reg) so the
  rolled-over value is observable, but no tax is assessed on the
  first-to-die spouse.
- Because the rollover transfers assets at the deceased's ACB rather
  than FMV, neither VR-EST-DEEMED-001 (deemed disposition of
  non-registered property) nor VR-EST-RRSP-INCLUSION-001 (full registered
  inclusion on terminal T1) fires for the first-to-die spouse. Both
  rules resume on the surviving spouse's own terminal year when no
  further rollover is available.
- The survivor inherits the rolled-over accounts into their own
  projection at the deceased's cost base. Subsequent growth, minimum
  withdrawals, and eventual terminal taxation are computed on the
  survivor's own VR-EST-DEEMED-001 / VR-EST-RRSP-INCLUSION-001 events.

#### VR-EST-SPOUSE-ROLLOVER-001 Worked Example (couple fixture, primary terminal year)

Fixture: couple, ON; primary dies at age 80 with RRSP $0.00 + RRIF
$400,000.00 + non-reg $200,000.00 (ACB $200,000.00, so no accrued gain);
surviving spouse alive → rollover applies. Spouse enters survivor
projection holding own RRIF $300,000.00 + non-reg $150,000.00
(ACB $60,000.00, inherited at the deceased's ACB for the rolled
non-reg $200,000.00 portion). Figures below are typed verbatim from
the T01 engine capture (`.gsd/milestones/M004/slices/S04/CAPTURE.md`,
Scenario 2, primary terminal event).

| Field                                         | Value       |
| --------------------------------------------- | ----------- |
| Primary RRIF balance at death                 | $400,000.00 |
| Primary non-reg balance at death              | $200,000.00 |
| Primary non-reg ACB at death                  | $200,000.00 |
| Gross estate (primary terminal event)         | $572,720.00 |
| `deemedDispositionIncome` (primary)           | $0.00       |
| `realizedCapitalGain` (primary)               | $0.00       |
| `taxableCapitalGain` (primary)                | $0.00       |
| `terminalTaxes` (primary)                     | $0.00       |
| `netEstate` (primary, = gross estate)         | $572,720.00 |
| `wasSpouseRolloverApplied` (primary)          | true        |
| Surviving spouse RRIF (pre-rollover, own)     | $300,000.00 |
| Surviving spouse non-reg (pre-rollover, own)  | $150,000.00 |
| Surviving spouse non-reg ACB (own)            | $60,000.00  |
| Registered assets inherited at deceased's ACB | $400,000.00 |
| Non-reg assets inherited at deceased's ACB    | $200,000.00 |

Parity: every row of this VR-EST-SPOUSE-ROLLOVER-001 Worked Example is
reproduced to the cent by
`packages/calculation-engine/src/tax/estate-couple-spouse-rollover-worked-example.test.ts`.
Drift between the engine's early-return rollover branch and this table
fails that test with expected-vs-actual cents on the drifting row.

#### VR-EST-SPOUSE-ROLLOVER-001 Cross-References

- VR-EST-DEEMED-001 — the deemed-disposition rule that would have fired
  on the primary's non-registered capital property absent the rollover.
  Suppressed on the first-to-die spouse; resumes on the survivor's own
  terminal year.
- VR-EST-RRSP-INCLUSION-001 — the full registered-inclusion rule that
  would have fired on the primary's RRSP/RRIF/LIRA/LIF residuals absent
  the rollover. Suppressed on the first-to-die spouse; resumes on the
  survivor's own terminal year.

Scope: this block covers the tax-deferred transfer at the first-to-die
spouse's terminal event and the ACB-inheritance handoff into the
survivor projection. Spousal-trust elections, delayed-rollover
filings, and the CRA's 36-month rollover window for qualifying
dispositions are out-of-scope for this SCOPE-005 section.

---

## LIRA - Locked-In Retirement Account

### Description

Locked RRSP holding pension funds transferred from an employer pension plan. Cannot make contributions or withdrawals until converted to LIF.

### Rules

| Rule ID  | Rule                   | Value/Formula                              |
| -------- | ---------------------- | ------------------------------------------ |
| LIRA-001 | Source                 | Transfers from employer pension plans only |
| LIRA-002 | Contributions          | Not permitted (except transfers)           |
| LIRA-003 | Withdrawals            | Not permitted until conversion to LIF      |
| LIRA-004 | Earliest Conversion    | Age 55 (varies by province)                |
| LIRA-005 | Latest Conversion      | December 31 of year turning 71             |
| LIRA-006 | Tax Treatment - Growth | Tax-deferred                               |

### Data Model

```
LIRAAccount {
  balance: Currency
  owner: 'primary' | 'spouse'
  source_province: ProvinceCode  // Governs rules
}
```

---

## LIF - Life Income Fund

### Description

Decumulation account for locked-in pension funds. Has both minimum AND maximum withdrawal limits.

### Rules

| Rule ID | Rule               | Value/Formula                         |
| ------- | ------------------ | ------------------------------------- |
| LIF-001 | Minimum Withdrawal | Same as RRIF minimum percentages      |
| LIF-002 | Maximum Withdrawal | Province-specific formula (see below) |
| LIF-003 | Tax Treatment      | 100% taxable as ordinary income       |
| LIF-004 | Source             | Conversion from LIRA                  |

### Maximum Withdrawal (Federal - PBSA)

```
max_withdrawal = balance × reference_rate / (1 - (1 + reference_rate)^(-years_to_90))

Where:
  reference_rate = CANSIM rate (approximately 6% benchmark)
  years_to_90 = 90 - current_age
```

### Data Model

```
LIFAccount {
  balance: Currency
  owner: 'primary' | 'spouse'
  governing_jurisdiction: ProvinceCode
  converted_from_lira_year: Integer
}
```

---

## FHSA - First Home Savings Account

### Description

Hybrid account combining RRSP (deductible contributions) and TFSA (tax-free withdrawal for home purchase) features.

### Rules

| Rule ID  | Rule                               | Value/Formula                           |
| -------- | ---------------------------------- | --------------------------------------- |
| FHSA-001 | Annual Contribution Limit          | $8,000                                  |
| FHSA-002 | Lifetime Contribution Limit        | $40,000                                 |
| FHSA-003 | Tax Treatment - Contribution       | Deductible from taxable income          |
| FHSA-004 | Tax Treatment - Growth             | Tax-free                                |
| FHSA-005 | Tax Treatment - Withdrawal (Home)  | Tax-free if qualifying home purchase    |
| FHSA-006 | Tax Treatment - Withdrawal (Other) | Taxable as income                       |
| FHSA-007 | Transfer to RRSP                   | Permitted without affecting RRSP room   |
| FHSA-008 | Account Closure                    | Must close within 15 years or by age 71 |

### Data Model

```
FHSAAccount {
  balance: Currency
  lifetime_contributions: Currency
  owner: 'primary' | 'spouse'
}
```

### Retirement Planning Note

For retirement planning purposes, assume FHSA either:

1. Has been used for home purchase (balance = 0)
2. Will be transferred to RRSP at retirement (model as RRSP contribution)

---

## Account Summary Matrix

| Account | Contribution Tax | Growth Tax | Withdrawal Tax | Limits        | OAS Impact |
| ------- | ---------------- | ---------- | -------------- | ------------- | ---------- |
| RRSP    | Deductible       | Deferred   | 100% taxable   | Annual + Room | Yes        |
| RRIF    | N/A              | Deferred   | 100% taxable   | Min required  | Yes        |
| TFSA    | Not deductible   | Tax-free   | Tax-free       | Annual + Room | No         |
| Non-Reg | Not deductible   | Annual tax | CG on sale     | None          | Yes        |
| LIRA    | N/A              | Deferred   | N/A            | Locked        | N/A        |
| LIF     | N/A              | Deferred   | 100% taxable   | Min + Max     | Yes        |
| FHSA    | Deductible       | Tax-free   | Varies         | $8k/$40k      | Varies     |

---

## Test Cases

### TC-ACCT-001: RRSP Contribution After 71

**Input:**

- Owner age: 72
- Proposed RRSP contribution: $10,000

**Expected:**

- Validation error: "RRSP contributions not permitted after age 71"

### TC-ACCT-002: RRIF Minimum Withdrawal

**Input:**

- RRIF balance: $400,000
- Owner age: 75

**Expected:**

- Minimum withdrawal = $400,000 × 5.82% = $23,280

### TC-ACCT-003: RRIF with Younger Spouse

**Input:**

- RRIF balance: $400,000
- Owner age: 75
- Spouse age: 68
- use_younger_spouse_age: true

**Expected:**

- Minimum withdrawal = $400,000 × 4.55% = $18,200

### TC-ACCT-004: TFSA Withdrawal Does Not Affect OAS

**Input:**

- OAS eligible individual
- TFSA withdrawal: $50,000
- Other income: $80,000

**Expected:**

- OAS clawback calculation uses $80,000 only
- TFSA withdrawal excluded from clawback calculation

### TC-ACCT-005: Non-Registered Capital Gains

**Input:**

- Account balance: $100,000
- Adjusted cost base: $60,000
- Unrealized gains: $40,000
- Withdrawal: $25,000

**Expected:**

- Realized gain = $25,000 × ($40,000 / $100,000) = $10,000
- Taxable capital gain = $10,000 × 50% = $5,000
- Remaining ACB = $60,000 - ($25,000 × $60,000/$100,000) = $45,000
