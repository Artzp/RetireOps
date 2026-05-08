RetireOps - Calc-Engine Test Scenarios
This document contains realistic, structured scenarios designed to stress-test the RETIREOPS Canadian tax and financial projection engine. It is divided into standard personas, age-based edge cases, and couple-based edge cases.
Part 1: Standard Individual Personas
Persona 1: The Corporate Professional (Baseline "On-Track")
Testing Goal: Verify standard compounding growth, steady contributions, and basic withdrawal phase logic resulting in a "Funded" status.
• Profile: Mid-career, solid salary, balanced portfolio.
• Current Age: 42
• Planned Retirement Age: 60
• Life Expectancy: 92
• Current Income: $135,000/yr
• Current Savings:
• RRSP: $250,000
• TFSA: $85,000
• Non-Registered: $20,000
• Expected Contributions (Annual): RRSP ($12,000), TFSA ($7,000)
• Expected Return: 6.5%
• Inflation Rate: 2.5%
• Spending Needs (Retirement): $75,000/yr (today's dollars)
Persona 2: The Entrepreneur (Tax Optimization & Non-Reg Heavy)
Testing Goal: Stress-test the Tax Optimization engine for capital gains and eligible dividends.
• Profile: Self-employed/business owner, heavily weighted outside of RRSPs.
• Current Age: 36
• Planned Retirement Age: 55
• Life Expectancy: 95
• Current Income: $90,000/yr (Mixed salary/dividends)
• Current Savings:
• RRSP: $45,000
• TFSA: $50,000
• Non-Registered: $350,000
• Expected Contributions (Annual): TFSA ($7,000), Non-Reg ($15,000)
• Expected Return: 7.0%
• Inflation Rate: 2.5%
• Spending Needs (Retirement): $80,000/yr
Persona 3: The Pre-Retiree (RRIF Conversion & OAS Clawback)
Testing Goal: Verify forced RRIF conversion minimums at age 71 and ensure the resulting high taxable income accurately triggers the OAS clawback threshold.
• Profile: Close to retirement, highly concentrated in tax-deferred accounts.
• Current Age: 63
• Planned Retirement Age: 65
• Life Expectancy: 90
• Current Income: $160,000/yr
• Current Savings:
• RRSP: $1,100,000
• TFSA: $110,000
• Non-Registered: $50,000
• Expected Contributions (Annual): RRSP ($15,000 until 65)
• Expected Return: 5.0%
• Inflation Rate: 2.5%
• Spending Needs (Retirement): $95,000/yr
Persona 4: The "Squeezed" Household ("Not Funded" & Reverse Calc)
Testing Goal: Trigger a "Not Funded" status and provide a baseline for the Reverse Calculator (goal-seek tool) to determine required savings rate or retirement delay.
• Profile: Late starter, high current income but low accumulated assets.
• Current Age: 48
• Planned Retirement Age: 60
• Life Expectancy: 90
• Current Income: $110,000/yr
• Current Savings:
• RRSP: $60,000
• TFSA: $25,000
• Non-Registered: $0
• Expected Contributions (Annual): RRSP ($5,000)
• Expected Return: 6.0%
• Inflation Rate: 3.0%
• Spending Needs (Retirement): $65,000/yr
Part 2: Individual Age-Based Edge Cases
Edge Case 1: The GIS Optimization Trap
Testing Goal: Ensure the engine prioritizes TFSA/Non-Reg withdrawals over RRSP/RRIF withdrawals to keep taxable income near zero, preserving the Guaranteed Income Supplement (GIS).
• Current Age: 64
• Planned Retirement Age: 65
• Life Expectancy: 90
• Current Savings: RRSP ($40,000), TFSA ($90,000), Non-Reg ($5,000)
• Expected Return: 5.0%
• Spending Needs: $30,000/yr
Edge Case 2: The CPP/OAS "Bridge" Strategy
Testing Goal: Test dynamic withdrawal adjustments. The engine must model heavy portfolio withdrawals from age 60-69, followed by a sharp drop in withdrawals at age 70 when deferred, supercharged CPP/OAS benefits kick in.
• Current Age: 58
• Planned Retirement Age: 60
• Life Expectancy: 95
• Current Savings: RRSP ($600,000), TFSA ($80,000), Non-Reg ($150,000)
• Expected Return: 6.0%
• Spending Needs: $60,000/yr
Edge Case 3: The Age 65 Pension Tax Credit Hack
Testing Goal: Check if the tax engine simulates converting exactly enough RRSP to RRIF at age 65 to generate $2,000/year of "eligible pension income" to claim the federal pension tax credit, even though forced conversion isn't until 71.
• Current Age: 63
• Planned Retirement Age: 65
• Life Expectancy: 92
• Current Savings: RRSP ($400,000), TFSA ($50,000)
• Expected Return: 5.5%
• Spending Needs: $45,000/yr
Edge Case 4: The Non-Reg Adjusted Cost Base (ACB) Spiral
Testing Goal: Ensure the engine calculates the changing ratio of unrealized capital gains to principal over time. A withdrawal at age 80 should have a vastly different tax impact than the same withdrawal at age 60.
• Current Age: 50
• Planned Retirement Age: 60
• Current Savings: RRSP ($200,000), TFSA ($50,000), Non-Reg ($500,000 with current ACB of $300,000)
• Expected Return: 7.0%
• Spending Needs: $85,000/yr
Part 3: Couples / Household Edge Cases
Couple Edge Case 1: The Pension Income Splitting Optimizer
Testing Goal: At age 65, the engine should automatically allocate up to 50% of the high-earner's RRIF withdrawals to the low-earner to equalize marginal tax rates.
• Spouse A (High Earner): Age 64, RRSP ($1,500,000), TFSA ($0)
• Spouse B (Low Earner): Age 64, RRSP ($0), TFSA ($0)
• Planned Retirement Age: 65
• Life Expectancy: 90 (both)
• Spending Needs: $90,000/yr combined
Couple Edge Case 2: The "Widow's Tax Penalty" (Survivor Rollover)
Testing Goal: At Year 10 (when Spouse A dies), merge A's RRSP into B's RRSP tax-free. At Year 11, calculate B's new, doubled minimum RRIF withdrawal and correctly apply single-filer OAS clawbacks.
• Spouse A: Age 65, Life Expectancy 75, RRSP ($600,000)
• Spouse B: Age 65, Life Expectancy 95, RRSP ($600,000)
• Planned Retirement Age: 65 (Current)
• Spending Needs: $80,000/yr combined (drops to $60,000/yr after Spouse A passes)
Couple Edge Case 3: The Spousal RRSP 3-Year Attribution Trap
Testing Goal: Ensure withdrawals from a Spousal RRSP within 3 years of a contribution are taxed in the hands of the contributor (high earner), not the owner (low earner).
• Spouse A (Contributor): Age 52, Income ($150,000)
• Spouse B (Owner): Age 52, Income ($40,000)
• Account: Spousal RRSP ($200,000 balance)
• Recent Activity: Spouse A contributed $20,000 at age 53 and $20,000 at age 54.
• Retirement Event: Retiring at age 55 and withdrawing $40,000 from the Spousal RRSP.
