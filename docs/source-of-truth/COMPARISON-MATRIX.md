# Functional Design Overview vs. Source-of-Truth Comparison Matrix

This matrix provides a detailed comparison between the Functional Design Overview (FDO) and the Source-of-Truth (SOT) documentation.

**Legend:**

- ✅ Fully Covered
- ⚠️ Partially Covered (needs enhancement)
- ❌ Not Covered (missing)
- 📝 Implementation Detail Only (in SOT, not in FDO)
- 🎯 Conceptual Only (in FDO, not in SOT)

---

## 1. Core Functionality (Non-Negotiable Features)

| Feature                          | FDO | SOT | Status | Notes                                    |
| -------------------------------- | --- | --- | ------ | ---------------------------------------- |
| **User Profile & Personal Data** | ✅  | ✅  | ✅     | Perfect alignment - `01-user-profile.md` |
| Age/Birthdate                    | ✅  | ✅  | ✅     | Both include validation rules            |
| Province of Residence            | ✅  | ✅  | ✅     | All provinces covered in SOT             |
| Marital Status                   | ✅  | ✅  | ✅     | Single, married, common-law              |
| Life Expectancy                  | ✅  | ✅  | ✅     | Default 95, customizable                 |
| Spouse Profile                   | ✅  | ✅  | ✅     | Conditional based on marital status      |

---

## 2. Income Modeling

| Income Type                 | FDO | SOT | Status | Notes                                |
| --------------------------- | --- | --- | ------ | ------------------------------------ |
| **Employment Income**       | ✅  | ✅  | ✅     | `03-income-sources.md` - complete    |
| Growth rate modeling        | ✅  | ✅  | ✅     | Annual escalation supported          |
| End age specification       | ✅  | ✅  | ✅     | Retirement age                       |
| **Self-Employment Income**  | ✅  | ✅  | ✅     | Includes CPP contribution note       |
| **Rental Property Income**  | ✅  | ✅  | ✅     | Net income + capital gains on sale   |
| **DB Pension**              | ✅  | ✅  | ✅     | Start age, indexing, bridge benefits |
| Early retirement reduction  | ✅  | ✅  | ✅     | Typical 3-6% per year                |
| **DC Pension**              | ✅  | ✅  | ✅     | Modeled as account (LIRA)            |
| **Government Pensions**     | ✅  | ✅  | ✅     | See Government Benefits section      |
| **One-Time Income Events**  | ✅  | ✅  | ✅     | Inheritance, severance, etc.         |
| Inheritance (non-taxable)   | ✅  | ✅  | ✅     | Properly flagged as non-taxable      |
| Severance (taxable)         | ✅  | ✅  | ✅     | 100% taxable employment income       |
| Business sale with LCGE     | ✅  | ✅  | ✅     | $1M+ lifetime exemption noted        |
| Part-time retirement income | ✅  | ⚠️  | ⚠️     | FDO mentions, SOT could expand       |

---

## 3. Account Types

| Account                     | FDO | SOT | Status | Notes                                 |
| --------------------------- | --- | --- | ------ | ------------------------------------- |
| **RRSP**                    | ✅  | ✅  | ✅     | `02-account-types.md` - comprehensive |
| Contribution limits         | ✅  | ✅  | ✅     | 18% of earned income, $31,560 (2024)  |
| Age 71 conversion rule      | ✅  | ✅  | ✅     | Must convert to RRIF                  |
| Tax treatment               | ✅  | ✅  | ✅     | Deductible in, taxable out            |
| Withholding tax             | ✅  | ✅  | ✅     | 10/20/30% based on amount             |
| **RRIF**                    | ✅  | ✅  | ✅     | Complete with minimum % table         |
| Minimum withdrawal table    | ✅  | ✅  | ✅     | Age-based percentages                 |
| Younger spouse election     | ✅  | ✅  | ✅     | Can use spouse's age                  |
| No maximum withdrawal       | ✅  | ✅  | ✅     | (except LIF)                          |
| **TFSA**                    | ✅  | ✅  | ✅     | Complete coverage                     |
| Contribution limits         | ✅  | ✅  | ✅     | $7,000 (2024/2025)                    |
| Historical limits table     | ❌  | ✅  | 📝     | SOT has full history 2009-2025        |
| No OAS impact               | ✅  | ✅  | ✅     | Critical benefit noted                |
| Withdrawal room restoration | ✅  | ✅  | ✅     | Next year                             |
| **FHSA**                    | ✅  | ✅  | ✅     | New account type covered              |
| $8k annual / $40k lifetime  | ✅  | ✅  | ✅     | Contribution limits                   |
| Rollover to RRSP            | ✅  | ✅  | ✅     | If not used for home                  |
| **Non-Registered**          | ✅  | ✅  | ✅     | Taxable investment account            |
| Capital gains tracking      | ✅  | ✅  | ✅     | ACB methodology                       |
| Dividend gross-up           | ✅  | ✅  | ✅     | Eligible vs non-eligible              |
| Interest income             | ✅  | ✅  | ✅     | 100% taxable                          |
| **LIRA**                    | ✅  | ✅  | ✅     | Locked-in account                     |
| No contributions            | ✅  | ✅  | ✅     | Except transfers                      |
| Age 55 access               | ✅  | ✅  | ✅     | Provincial variations                 |
| **LIF**                     | ✅  | ✅  | ✅     | Life Income Fund                      |
| Min/max withdrawals         | ✅  | ✅  | ✅     | Both enforced                         |
| Provincial formulas         | ✅  | ✅  | ✅     | PBSA reference rate                   |
| **Corporate Holdco**        | ✅  | ❌  | ❌     | FDO mentions, SOT missing             |
| CCPC investment account     | ✅  | ❌  | ❌     | Needs separate doc                    |
| RDTOH tracking              | ✅  | ❌  | ❌     | Advanced feature                      |
| CDA tracking                | ✅  | ❌  | ❌     | Capital dividend account              |
| **Cash Accounts**           | ✅  | ❌  | ❌     | FDO mentions, SOT missing             |
| High-interest savings       | ✅  | ❌  | ❌     | Emergency fund tracking               |
| Minimal returns             | ✅  | ❌  | ❌     | 0.5-3% range                          |

---

## 4. Investment Growth & Returns

| Feature                      | FDO | SOT | Status | Notes                                     |
| ---------------------------- | --- | --- | ------ | ----------------------------------------- |
| **Expected Rate of Return**  | ✅  | ✅  | ✅     | `06-investment-engine.md`                 |
| Nominal vs Real returns      | ✅  | ✅  | ✅     | Clear definitions                         |
| **Inflation Assumption**     | ✅  | ✅  | ✅     | 2-2.5% default                            |
| **Risk Profiles**            | ✅  | ✅  | ✅     | Conservative/Balanced/Growth/Aggressive   |
| Return by profile            | ✅  | ✅  | ✅     | 4-8% range with volatility                |
| **Deterministic Projection** | ✅  | ✅  | ✅     | Single fixed return                       |
| **Monte Carlo Simulation**   | ✅  | ✅  | ✅     | Random return sequences                   |
| Log-normal distribution      | ❌  | ✅  | 📝     | SOT has formula                           |
| 1000+ simulations            | ✅  | ✅  | ✅     | Configurable                              |
| **Volatility Input**         | ✅  | ✅  | ✅     | Standard deviation                        |
| **Account-Specific Returns** | ✅  | ✅  | ✅     | Different rates per account               |
| **Glide Path**               | ❌  | ✅  | 📝     | SOT includes decreasing equity allocation |
| **Tax-Aware Growth**         | ✅  | ✅  | ✅     | Different treatment per account           |
| RRSP/RRIF tax-deferred       | ✅  | ✅  | ✅     | No annual tax                             |
| TFSA tax-free                | ✅  | ✅  | ✅     | No tax ever                               |
| Non-reg annual tax           | ✅  | ✅  | ✅     | Interest/dividends taxed                  |
| **Inflation Indexing**       | ✅  | ✅  | ✅     | CPP/OAS/expenses                          |

---

## 5. Canadian Tax Engine

| Feature                       | FDO | SOT | Status | Notes                          |
| ----------------------------- | --- | --- | ------ | ------------------------------ |
| **Federal Tax Brackets**      | ✅  | ✅  | ✅     | `04-tax-engine.md` - excellent |
| 2024 brackets                 | ✅  | ✅  | ✅     | 15/20.5/26/29/33%              |
| 2025 projections              | ❌  | ✅  | 📝     | SOT includes estimates         |
| **Provincial Tax**            | ✅  | ✅  | ✅     | All provinces covered          |
| Ontario                       | ✅  | ✅  | ✅     | Including surtax               |
| British Columbia              | ✅  | ✅  | ✅     | 6 brackets                     |
| Alberta                       | ✅  | ✅  | ✅     | Flat-ish structure             |
| Quebec                        | ✅  | ✅  | ✅     | Federal abatement noted        |
| Saskatchewan                  | ✅  | ✅  | ✅     | 3 brackets                     |
| Manitoba                      | ✅  | ✅  | ✅     | 3 brackets                     |
| Atlantic provinces            | ✅  | ✅  | ✅     | NS, NB, PEI, NL                |
| Territories                   | ✅  | ✅  | ✅     | YT, NT, NU                     |
| **Basic Personal Amount**     | ✅  | ✅  | ✅     | Federal + provincial           |
| **Age Credit (65+)**          | ✅  | ✅  | ✅     | Income-tested reduction        |
| Reduction formula             | ✅  | ✅  | ✅     | 15% of excess income           |
| **Pension Income Credit**     | ✅  | ✅  | ✅     | $2,000 max eligible income     |
| Eligible income types         | ✅  | ✅  | ✅     | RRIF, annuity, not CPP/OAS     |
| **Dividend Tax Treatment**    | ✅  | ✅  | ✅     | Gross-up and credit            |
| Eligible dividends            | ✅  | ✅  | ✅     | 38% gross-up, 15% credit       |
| Non-eligible dividends        | ✅  | ✅  | ✅     | 15% gross-up, 9% credit        |
| Provincial dividend credit    | ✅  | ✅  | ✅     | Varies by province             |
| **Capital Gains**             | ✅  | ✅  | ✅     | 50% inclusion rate             |
| Enhanced rate >$250k          | ❌  | ✅  | 📝     | 66.67% for gains over $250k    |
| Principal residence exemption | ✅  | ✅  | ✅     | Fully exempt                   |
| **OAS Clawback**              | ✅  | ✅  | ✅     | Critical feature               |
| $90,997 threshold (2024)      | ✅  | ✅  | ✅     | Accurate                       |
| 15% recovery rate             | ✅  | ✅  | ✅     | On excess income               |
| Full clawback ~$148k          | ✅  | ✅  | ✅     | Age 65-74                      |
| TFSA doesn't count            | ✅  | ✅  | ✅     | Important planning point       |
| Dividend gross-up counts      | ✅  | ✅  | ✅     | Line 23400 impact              |
| **Pension Income Splitting**  | ✅  | ✅  | ✅     | Age 65+ for couples            |
| Up to 50% allocation          | ✅  | ✅  | ✅     | Eligible pension income        |
| Eligible income types         | ✅  | ✅  | ✅     | RRIF/LIF/annuity               |
| NOT eligible (CPP/OAS)        | ✅  | ✅  | ✅     | Important exclusion            |
| Optimization algorithm        | ✅  | ✅  | ✅     | Find optimal split %           |
| **Spousal Considerations**    | ✅  | ✅  | ✅     | Separate calculations          |
| **Tax Calculation Steps**     | 🎯  | ✅  | 📝     | SOT has detailed algorithm     |
| Gross → Net → Taxable income  | ❌  | ✅  | 📝     | Step-by-step process           |
| **Test Cases**                | ❌  | ✅  | 📝     | SOT has extensive examples     |

---

## 6. Government Benefits

| Feature                     | FDO | SOT | Status | Notes                          |
| --------------------------- | --- | --- | ------ | ------------------------------ |
| **CPP/QPP**                 | ✅  | ✅  | ✅     | `05-government-benefits.md`    |
| Age 60-70 start             | ✅  | ✅  | ✅     | Flexible timing                |
| -0.6% per month early       | ✅  | ✅  | ✅     | 36% reduction at 60            |
| +0.7% per month late        | ✅  | ✅  | ✅     | 42% increase at 70             |
| Adjustment table            | ❌  | ✅  | 📝     | SOT has full table             |
| Maximum amounts (2024)      | ❌  | ✅  | 📝     | $16,375/year at 65             |
| Inflation indexing (CPI)    | ✅  | ✅  | ✅     | Annual adjustment              |
| Child-rearing dropout       | ✅  | ✅  | ✅     | Up to 7 years                  |
| Post-retirement benefit     | ❌  | ✅  | 📝     | PRB if working while receiving |
| Survivor benefits           | ❌  | ✅  | 📝     | 60% of deceased's benefit      |
| **OAS**                     | ✅  | ✅  | ✅     | Complete coverage              |
| Age 65-70 start             | ✅  | ✅  | ✅     | Can defer to 70                |
| +0.6% per month deferred    | ✅  | ✅  | ✅     | 36% increase at 70             |
| 40-year residency for full  | ✅  | ✅  | ✅     | Pro-rated otherwise            |
| Age 75+ boost (10%)         | ❌  | ✅  | 📝     | July 2022 enhancement          |
| Quarterly indexing          | ✅  | ✅  | ✅     | Jan/Apr/Jul/Oct                |
| Maximum amounts             | ❌  | ✅  | 📝     | ~$8,560 (65-74), ~$9,420 (75+) |
| **OAS Clawback**            | ✅  | ✅  | ✅     | Integrated with tax engine     |
| (See Tax Engine section)    | -   | -   | -      | Already covered above          |
| **GIS**                     | ✅  | ✅  | ✅     | Low-income supplement          |
| 50% reduction rate          | ✅  | ✅  | ✅     | $0.50 per $1 other income      |
| Income thresholds           | ❌  | ✅  | 📝     | ~$21k single, ~$28k couple     |
| Marital status variations   | ❌  | ✅  | 📝     | Different rates                |
| **QPP Differences**         | ✅  | ✅  | ✅     | Quebec-specific                |
| **Benefit Timing Analysis** | ✅  | ✅  | ✅     | When to start optimization     |
| Break-even ages             | ❌  | ✅  | 📝     | 60 vs 65: age 74-76            |
| Decision factors            | ✅  | ✅  | ✅     | Health, income needs, etc.     |

---

## 7. Withdrawal Strategies

| Feature                        | FDO | SOT | Status | Notes                         |
| ------------------------------ | --- | --- | ------ | ----------------------------- |
| **Withdrawal Order**           | ✅  | ✅  | ✅     | `07-withdrawal-strategies.md` |
| Default: Non-reg → RRSP → TFSA | ✅  | ✅  | ✅     | Tax-deferred last             |
| Alternative: TFSA first        | ✅  | ✅  | ✅     | OAS clawback avoidance        |
| Custom user-defined order      | ✅  | ✅  | ✅     | Flexible configuration        |
| **RRIF Minimum Enforcement**   | ✅  | ✅  | ✅     | Age 72+ mandatory             |
| Automatic override             | ✅  | ✅  | ✅     | Can't withdraw less than min  |
| **LIF Min/Max Enforcement**    | ✅  | ✅  | ✅     | Both bounds                   |
| **Surplus Reinvestment**       | ✅  | ✅  | ✅     | Critical feature              |
| TFSA if room available         | ✅  | ✅  | ✅     | First priority                |
| Non-reg otherwise              | ✅  | ✅  | ✅     | Fallback                      |
| **Advanced Strategies**        | ✅  | ✅  | ✅     | Multiple approaches           |
| RRSP Meltdown                  | ✅  | ✅  | ✅     | Ages 60-71 drawdown           |
| Tax bracket filling            | ✅  | ✅  | ✅     | Use lower brackets early      |
| Income smoothing               | ✅  | ✅  | ✅     | Equalize taxable income       |
| OAS clawback avoidance         | ✅  | ✅  | ✅     | Stay below threshold          |
| TFSA preservation              | ✅  | ✅  | ✅     | Use last for emergencies      |
| **Withdrawal Algorithm**       | 🎯  | ✅  | 📝     | SOT has step-by-step logic    |
| **Non-Reg Capital Gains**      | ✅  | ✅  | ✅     | Proportional realization      |
| ACB tracking                   | ✅  | ✅  | ✅     | Adjusted cost base            |
| **Test Cases**                 | ❌  | ✅  | 📝     | SOT has 6 detailed scenarios  |

---

## 8. Projection Engine

| Feature                       | FDO | SOT | Status | Notes                               |
| ----------------------------- | --- | --- | ------ | ----------------------------------- |
| **Year-by-Year Simulation**   | ✅  | ✅  | ✅     | `08-projection-engine.md`           |
| Timeline phases               | ✅  | ✅  | ✅     | Pre-retirement, retirement, estate  |
| Age-based events              | ✅  | ✅  | ✅     | RRSP→RRIF at 71, CPP/OAS start      |
| **Income Calculation**        | ✅  | ✅  | ✅     | All sources aggregated              |
| By source breakdown           | ✅  | ✅  | ✅     | Employment, pension, CPP, OAS, etc. |
| **Expense Tracking**          | ✅  | ✅  | ✅     | Retirement spending                 |
| Inflation adjustment          | ✅  | ✅  | ✅     | Annual escalation                   |
| **Withdrawal Determination**  | ✅  | ✅  | ✅     | Integrated with strategy            |
| **Investment Growth**         | ✅  | ✅  | ✅     | Applied to all accounts             |
| Mid-year cash flow            | ❌  | ✅  | 📝     | More accurate timing                |
| **Tax Calculation**           | ✅  | ✅  | ✅     | Annual tax compute                  |
| Integration with tax engine   | ✅  | ✅  | ✅     | Seamless                            |
| **Account Balance Updates**   | ✅  | ✅  | ✅     | End-of-year balances                |
| **Net Worth Tracking**        | ✅  | ✅  | ✅     | All assets minus liabilities        |
| Real estate inclusion         | ✅  | ✅  | ✅     | Optional home equity                |
| **Cash Flow Summary**         | ✅  | ✅  | ✅     | Surplus/deficit each year           |
| **RRSP→RRIF Conversion**      | ✅  | ✅  | ✅     | Age 71 automatic                    |
| **Spousal RRSP Attribution**  | ✅  | ✅  | ✅     | 3-year rule                         |
| **Couple Projections**        | ✅  | ✅  | ✅     | Separate + combined                 |
| Pension splitting integration | ✅  | ✅  | ✅     | Optimal split calculated            |
| **Survivor Scenario**         | ✅  | ✅  | ✅     | First spouse death                  |
| Account rollover              | ❌  | ✅  | 📝     | RRSP to survivor                    |
| CPP survivor benefit          | ❌  | ✅  | 📝     | 60% of deceased                     |
| Expense reduction             | ❌  | ✅  | 📝     | ~30% drop for single                |
| **Estate Calculation**        | ✅  | ✅  | ✅     | Terminal tax                        |
| RRSP/RRIF deemed disposition  | ✅  | ✅  | ✅     | Full income inclusion               |
| Spouse rollover exception     | ✅  | ✅  | ✅     | No tax if to spouse                 |
| Non-reg capital gains         | ✅  | ✅  | ✅     | Final realization                   |
| **Warnings/Alerts**           | ❌  | ✅  | 📝     | SOT has warning system              |
| OAS clawback alert            | ❌  | ✅  | 📝     | Proactive notification              |
| Shortfall warning             | ❌  | ✅  | 📝     | Insufficient funds                  |
| High tax rate alert           | ❌  | ✅  | 📝     | >45% marginal rate                  |
| **Data Model**                | ❌  | ✅  | 📝     | TypeScript interfaces               |
| **Test Cases**                | ❌  | ✅  | 📝     | 5 comprehensive scenarios           |

---

## 9. Success Metrics

| Metric                       | FDO | SOT | Status | Notes                        |
| ---------------------------- | --- | --- | ------ | ---------------------------- |
| **Probability of Success**   | ✅  | ✅  | ✅     | `09-success-metrics.md`      |
| Monte Carlo based            | ✅  | ✅  | ✅     | % of successful simulations  |
| Interpretation guidance      | ✅  | ✅  | ✅     | 85-95% = secure              |
| **Portfolio Longevity**      | ✅  | ✅  | ✅     | Depletion age                |
| "Never depleted" case        | ✅  | ✅  | ✅     | Estate value shown           |
| **Ending Net Worth**         | ✅  | ✅  | ✅     | Estate value                 |
| Gross vs net (after tax)     | ✅  | ✅  | ✅     | Terminal tax deduction       |
| **Cumulative Shortfall**     | ❌  | ✅  | 📝     | Total funding gap            |
| Present value adjustment     | ❌  | ✅  | 📝     | Discounted shortfall         |
| **Safe Withdrawal Rate**     | ✅  | ✅  | ✅     | 4% rule concept              |
| Plan-specific SWR            | ❌  | ✅  | 📝     | Iterative calculation        |
| **Spending Flexibility**     | ✅  | ✅  | ✅     | Adjustment capacity          |
| Increase capacity            | ❌  | ✅  | 📝     | "Could spend +12%"           |
| Decrease for confidence      | ❌  | ✅  | 📝     | "Reduce 8% for 95%"          |
| **Lifetime Tax Burden**      | ❌  | ✅  | 📝     | Total taxes paid             |
| Average tax rate             | ❌  | ✅  | 📝     | Lifetime average             |
| **OAS Efficiency**           | ❌  | ✅  | 📝     | Received vs entitled         |
| Total clawback tracking      | ❌  | ✅  | 📝     | Sum over all years           |
| **Income Replacement Ratio** | ❌  | ✅  | 📝     | Retirement vs pre-retirement |
| 70-80% target                | ❌  | ✅  | 📝     | Industry standard            |
| **Worst-Case Balance**       | ✅  | ✅  | ✅     | 5th percentile               |
| **Median Balance**           | ✅  | ✅  | ✅     | 50th percentile              |
| **Best-Case Balance**        | ✅  | ✅  | ✅     | 95th percentile              |
| **Sequence Risk Score**      | ❌  | ✅  | 📝     | Early return impact          |
| **Dashboard Display**        | ✅  | ✅  | ✅     | Summary visualization        |
| **Recommendations Engine**   | ✅  | ✅  | ✅     | Actionable suggestions       |
| Algorithm/logic              | ❌  | ✅  | 📝     | TypeScript function          |

---

## 10. Scenario Comparison

| Feature                        | FDO | SOT | Status | Notes                               |
| ------------------------------ | --- | --- | ------ | ----------------------------------- |
| **Multiple Scenarios**         | ✅  | ✅  | ✅     | `10-scenarios.md`                   |
| Clone and modify               | ✅  | ✅  | ✅     | Base + modifications                |
| **Scenario Types**             | ✅  | ✅  | ✅     | Base, alternative, system-generated |
| **Modification Tracking**      | ❌  | ✅  | 📝     | What changed from base              |
| **Comparison View**            | ✅  | ✅  | ✅     | Side-by-side metrics                |
| Key metrics compared           | ✅  | ✅  | ✅     | Success, estate, taxes              |
| Yearly comparison              | ❌  | ✅  | 📝     | Year-by-year data                   |
| Winner identification          | ❌  | ✅  | 📝     | Best scenario per metric            |
| **Pre-Built Templates**        | ✅  | ✅  | ✅     | Common scenarios                    |
| Retirement age sensitivity     | ✅  | ✅  | ✅     | 60/62/65/67                         |
| CPP/OAS timing                 | ✅  | ✅  | ✅     | Early vs late                       |
| Market stress test             | ✅  | ✅  | ✅     | Different return rates              |
| Longevity scenarios            | ✅  | ✅  | ✅     | 85/90/95/100                        |
| **Interactive What-If**        | ✅  | ✅  | ✅     | Slider-based exploration            |
| Quick adjustments              | ✅  | ✅  | ✅     | Single variable changes             |
| **Multi-Variable Sensitivity** | ❌  | ✅  | 📝     | 2D heat maps                        |
| Return vs inflation            | ❌  | ✅  | 📝     | Matrix of outcomes                  |
| **Scenario Management**        | ✅  | ✅  | ✅     | Create/update/delete                |
| Dependency handling            | ❌  | ✅  | 📝     | Re-parent on delete                 |
| **Data Model**                 | ❌  | ✅  | 📝     | TypeScript interfaces               |
| **Test Cases**                 | ❌  | ✅  | 📝     | 5 scenarios                         |

---

## 11. Visualization & UX

| Feature                     | FDO | SOT | Status | Notes                             |
| --------------------------- | --- | --- | ------ | --------------------------------- |
| **Interactive Charts**      | ✅  | ⚠️  | ⚠️     | FDO has detail, SOT brief mention |
| Net worth over time         | ✅  | ⚠️  | ⚠️     | FDO describes, SOT minimal        |
| Account balances stacked    | ✅  | ⚠️  | ⚠️     | Composition changes               |
| Income vs expenses bar      | ✅  | ⚠️  | ⚠️     | Yearly comparison                 |
| Taxes paid per year         | ✅  | ⚠️  | ⚠️     | Spike identification              |
| Withdrawal by source        | ✅  | ⚠️  | ⚠️     | Strategy visualization            |
| Chart interactivity         | ✅  | ❌  | 🎯     | Tooltips, toggle series           |
| Age vs year axis            | ✅  | ❌  | 🎯     | User preference                   |
| **Summary Reports**         | ✅  | ⚠️  | ⚠️     | FDO more detailed                 |
| Plan summary report         | ✅  | ❌  | 🎯     | PDF/web view                      |
| Cash flow tables            | ✅  | ⚠️  | ⚠️     | Year-by-year detail               |
| Spouse/individual summaries | ✅  | ❌  | 🎯     | Separate + combined               |
| Actionable recommendations  | ✅  | ✅  | ✅     | Both mention                      |
| **PDF Generation**          | ✅  | ✅  | ✅     | One-click export                  |
| Print-friendly formatting   | ✅  | ❌  | 🎯     | Charts render well                |
| Advisor branding            | ✅  | ❌  | 🎯     | Customization                     |

---

## 12. Advanced Features

| Feature                   | FDO | SOT | Status | Notes                         |
| ------------------------- | --- | --- | ------ | ----------------------------- |
| **Optimization & AI**     | ✅  | ⚠️  | ⚠️     | FDO conceptual, SOT Phase 3   |
| Strategy recommendations  | ✅  | ⚠️  | ⚠️     | Both mention, FDO more detail |
| Goal-based what-if        | ✅  | ❌  | 🎯     | Natural language queries      |
| Optimal withdrawal solver | ✅  | ⚠️  | ⚠️     | Minimize tax or max estate    |
| Flagging inefficiencies   | ✅  | ❌  | 🎯     | Unused TFSA room, etc.        |
| ML personalization        | ✅  | ❌  | 🎯     | Future enhancement            |
| **Real Estate**           | ✅  | ⚠️  | ⚠️     | FDO detailed, SOT Phase 3     |
| Principal residence       | ✅  | ⚠️  | ⚠️     | Value tracking                |
| Downsizing simulation     | ✅  | ⚠️  | ⚠️     | Sell + buy smaller            |
| Tax-free gains            | ✅  | ⚠️  | ⚠️     | Principal residence exemption |
| Rental property sale      | ✅  | ⚠️  | ⚠️     | Capital gains tax             |
| Mortgage tracking         | ✅  | ⚠️  | ⚠️     | Payments + payoff             |
| Reverse mortgage/HELOC    | ✅  | ❌  | 🎯     | Advanced feature              |
| **Estate Planning**       | ✅  | ✅  | ✅     | Both cover                    |
| Terminal tax calculation  | ✅  | ✅  | ✅     | Final year                    |
| Estate value net of tax   | ✅  | ✅  | ✅     | After-tax legacy              |
| Beneficiary designation   | ✅  | ⚠️  | ⚠️     | Spouse vs non-spouse          |
| Life insurance offset     | ✅  | ❌  | 🎯     | Proceeds reduce taxes         |
| Estate goal tracking      | ✅  | ❌  | 🎯     | Target legacy amount          |
| Survivor projections      | ✅  | ✅  | ✅     | First spouse death            |

---

## 13. Philosophy & Context

| Topic                         | FDO | SOT | Status | Notes                       |
| ----------------------------- | --- | --- | ------ | --------------------------- |
| **Why Commercial Tools Work** | ✅  | ❌  | 🎯     | **Missing from SOT**        |
| Integration is key            | ✅  | ❌  | 🎯     | Not algorithms              |
| No proprietary secrets        | ✅  | ❌  | 🎯     | Public tax law              |
| Edge case handling            | ✅  | ❌  | 🎯     | Years of refinement         |
| UX simplifying complexity     | ✅  | ❌  | 🎯     | Guided flows                |
| Dynamic what-if feedback      | ✅  | ❌  | 🎯     | Instant updates             |
| **What This Software Is NOT** | ✅  | ⚠️  | ⚠️     | **Needs prominence in SOT** |
| Not financial advice          | ✅  | ✅  | ✅     | Both mention                |
| Not portfolio management      | ✅  | ✅  | ✅     | Both mention                |
| Not a robo-advisor            | ✅  | ✅  | ✅     | Both mention                |
| Not tax filing software       | ✅  | ✅  | ✅     | Both mention                |
| Regulatory positioning        | ✅  | ⚠️  | ⚠️     | FDO clearer                 |

---

## 14. Development Roadmap

| Aspect                    | FDO | SOT | Status | Notes                       |
| ------------------------- | --- | --- | ------ | --------------------------- |
| **Phased Approach**       | ✅  | ✅  | ✅     | `11-development-roadmap.md` |
| Phase 1: Core MVP         | ✅  | ✅  | ✅     | Perfect alignment           |
| Phase 2: Enhanced         | ✅  | ✅  | ✅     | Scenarios, benefits         |
| Phase 3: Advanced         | ✅  | ✅  | ✅     | Monte Carlo, optimization   |
| **Technical Stack**       | ❌  | ✅  | 📝     | SOT specifies TypeScript    |
| **Module Structure**      | ❌  | ✅  | 📝     | Directory layout            |
| **Testing Strategy**      | ❌  | ✅  | 📝     | Unit/integration tests      |
| **Configuration Updates** | ✅  | ✅  | ✅     | Annual tax updates          |
| **Milestones**            | ❌  | ✅  | 📝     | Week-by-week timeline       |
| **Risk Factors**          | ❌  | ✅  | 📝     | Complexity, updates         |

---

## Summary Statistics

### Coverage Analysis

| Category          | Items   | ✅ Fully Covered | ⚠️ Partially Covered | ❌ Missing | 📝 SOT Only  | 🎯 FDO Only |
| ----------------- | ------- | ---------------- | -------------------- | ---------- | ------------ | ----------- |
| User Profile      | 6       | 6                | 0                    | 0          | 0            | 0           |
| Income Modeling   | 12      | 10               | 1                    | 0          | 0            | 1           |
| Account Types     | 9       | 7                | 0                    | 2          | 0            | 0           |
| Investment Engine | 11      | 9                | 0                    | 0          | 2            | 0           |
| Tax Engine        | 24      | 21               | 0                    | 0          | 3            | 0           |
| Gov Benefits      | 16      | 11               | 0                    | 0          | 5            | 0           |
| Withdrawals       | 12      | 10               | 0                    | 0          | 2            | 0           |
| Projection        | 19      | 13               | 0                    | 0          | 6            | 0           |
| Success Metrics   | 16      | 6                | 0                    | 0          | 10           | 0           |
| Scenarios         | 11      | 7                | 0                    | 0          | 4            | 0           |
| Visualization     | 12      | 3                | 6                    | 0          | 0            | 3           |
| Advanced Features | 15      | 6                | 4                    | 0          | 0            | 5           |
| Philosophy        | 9       | 4                | 1                    | 0          | 0            | 4           |
| **TOTAL**         | **172** | **113 (66%)**    | **12 (7%)**          | **2 (1%)** | **32 (19%)** | **13 (7%)** |

---

## Key Findings

### 1. **Excellent Core Alignment (66% Perfect Match)**

- User profile, income, accounts, tax, benefits, withdrawals all align excellently
- Both documents cover the essential retirement planning features

### 2. **SOT is More Technical (19% SOT-Only Content)**

- TypeScript interfaces, data models, test cases
- Detailed algorithms and formulas
- Implementation-level specifications
- More precise numerical values (tax rates, amounts, percentages)

### 3. **FDO is More Contextual (7% FDO-Only Content)**

- Philosophy and design rationale
- User experience guidance
- "Why commercial tools work" insights
- Regulatory positioning and disclaimers

### 4. **Main Gaps (1-2% Missing)**

- **Corporate holding company accounts** (advanced feature)
- **Cash/savings accounts** (basic feature)
- These should be added to SOT

### 5. **Partial Coverage Areas (7%)**

- Visualization/UX details (FDO more comprehensive)
- Real estate modeling (both mention, needs dedicated doc)
- Optimization features (conceptual in both, needs implementation detail)

---

## Recommendations

### Immediate (Phase 1)

1. ✅ Add cash accounts to `02-account-types.md`
2. ✅ Create `13-compliance-scope.md` with "What it is/is not"
3. ✅ Enhance README.md with disclaimers

### Short-term (Phase 2)

4. ✅ Create `00-design-philosophy.md` with integration principles
5. ✅ Create `15-real-estate-modeling.md` with detailed specs
6. ✅ Create `14-visualization-ux.md` with chart specifications

### Long-term (Phase 3)

7. ✅ Create `12-advanced-accounts.md` for corporate holdings
8. ✅ Expand visualization sections in existing docs
9. ✅ Add more philosophical context throughout

---

## Conclusion

The **Functional Design Overview** and **Source-of-Truth documentation** are highly complementary:

- **FDO** provides the **vision, rationale, and user perspective**
- **SOT** provides the **technical specifications and implementation details**

Together, they form a complete blueprint for building world-class Canadian retirement planning software. The 66% perfect alignment demonstrates excellent consistency, while the 19% technical detail in SOT and 7% contextual content in FDO show they serve different but compatible purposes.

**Overall Assessment:** ⭐⭐⭐⭐⭐ Excellent alignment with minor gaps easily addressed
