# Source-of-Truth Enhancement Checklist

This document tracks additions and enhancements needed to align the source-of-truth documentation with the Functional Design Overview.

---

## Files to Create (New)

### ✅ High Priority

- [ ] `00-design-philosophy.md` - Why this software works, integration principles, comparison to commercial tools
- [ ] `12-advanced-accounts.md` - Corporate holding companies, cash accounts, advanced scenarios
- [ ] `13-compliance-scope.md` - What the software is/is not, regulatory disclaimers

### ✅ Medium Priority

- [ ] `14-visualization-ux.md` - Detailed UX guidelines, chart specifications, interactive elements
- [ ] `15-real-estate-modeling.md` - Principal residence, rental properties, mortgages, downsizing

---

## Enhancements to Existing Files

### 01-user-profile.md

**Current Status:** ✅ Complete - No major additions needed

**Minor Enhancements:**

- [ ] Add more context about "why" each field matters (currently focuses on "what")
- [ ] Add example user journeys (single vs. married profiles)

---

### 02-account-types.md

**Current Status:** ⚠️ Missing 2 account types

**Additions Needed:**

#### Cash Accounts

- [ ] Add section for "Cash / High-Interest Savings Account"
  - Description: Non-investment cash holdings
  - Rules: Minimal returns (0.5-3%), fully taxable interest
  - Use case: Emergency fund, liquidity planning
  - Data model: Simple balance tracking

#### Corporate Holding Company Account (Advanced)

- [ ] Add section for "Corporate Investment Account"
  - Description: CCPC investment holdings
  - Rules:
    - Corporate tax on investment income
    - RDTOH (Refundable Dividend Tax On Hand)
    - CDA (Capital Dividend Account)
    - Dividend payments to owner
  - Tax treatment: Complex - corporate tax + personal dividend tax
  - Data model:
    ```typescript
    CorporateAccount {
      balance: Currency
      rdtoh_balance: Currency
      cda_balance: Currency
      investment_income_annual: Currency
    }
    ```
  - Test cases: Corporate dividend withdrawal, RDTOH tracking

**Enhancements:**

- [ ] Expand RRSP withholding tax section with examples
- [ ] Add visual comparison table (currently text-only)

---

### 03-income-sources.md

**Current Status:** ✅ Complete - Comprehensive coverage

**Minor Enhancements:**

- [ ] Add section on "Part-Time Income During Retirement"
  - Semi-retirement scenarios
  - Bridge income between 60-65
- [ ] Expand "Business Sale" one-time event with LCGE details
- [ ] Add examples of income timeline visualization

---

### 04-tax-engine.md

**Current Status:** ✅ Excellent - Very comprehensive

**Minor Enhancements:**

- [ ] Add section on "Why Tax Accuracy Matters" (philosophical context)
- [ ] Add note about tax law changes requiring annual config updates
- [ ] Expand Quebec-specific handling (currently brief)
- [ ] Add section on "Tax Optimization Goals" linking to withdrawal strategies

---

### 05-government-benefits.md

**Current Status:** ✅ Complete - Thorough coverage

**Minor Enhancements:**

- [ ] Add visual decision tree for "When to take CPP/OAS"
- [ ] Expand survivor benefit calculations with examples
- [ ] Add section on "Common Misconceptions" about CPP/OAS timing
- [ ] Note about quarterly OAS updates and how software handles them

---

### 06-investment-engine.md

**Current Status:** ✅ Complete

**Enhancements:**

- [ ] Add section on "Communicating Uncertainty to Users"
  - How to present Monte Carlo results
  - Avoiding false precision
- [ ] Expand glide path examples with visual charts
- [ ] Add section on "Historical Returns vs. Assumptions"
- [ ] Performance optimization notes for Monte Carlo (web workers, etc.)

---

### 07-withdrawal-strategies.md

**Current Status:** ✅ Very comprehensive

**Minor Enhancements:**

- [ ] Add visual flowchart of withdrawal decision logic
- [ ] Expand "Income Smoothing" with step-by-step calculation
- [ ] Add section on "Common Mistakes in Withdrawal Planning"
- [ ] Link to optimization features (Phase 3)

---

### 08-projection-engine.md

**Current Status:** ✅ Excellent

**Enhancements:**

- [ ] Add section on "Handling Complexity" - how all pieces integrate
- [ ] Expand "Couple Projections" with more detail on separate vs. combined calculations
- [ ] Add examples of edge case handling:
  - RRSP contribution to younger spouse's account after 71
  - Early RRSP withdrawal penalties
  - Spousal RRSP attribution (expand current brief mention)
- [ ] Add section on "Performance Considerations" for 40+ year projections

---

### 09-success-metrics.md

**Current Status:** ✅ Complete

**Enhancements:**

- [ ] Add section on "Communicating Results to Non-Technical Users"
- [ ] Expand recommendations engine with more examples
- [ ] Add "Plan Score" or letter grade concept (A/B/C/D/F)
- [ ] Visual dashboard mockup examples

---

### 10-scenarios.md

**Current Status:** ✅ Comprehensive

**Minor Enhancements:**

- [ ] Add section on "Scenario Naming Best Practices"
- [ ] Expand multi-variable sensitivity with heat map example
- [ ] Add guidance on "How Many Scenarios is Too Many?"
- [ ] Performance considerations for large scenario sets

---

### 11-development-roadmap.md

**Current Status:** ✅ Excellent roadmap

**Enhancements to Consider:**

- [ ] Add section on "What Makes This Different from Commercial Tools"
  - Open-source advantages
  - Community-driven development
  - Transparency in calculations
- [ ] Expand "Why Existing Tools Are Special" section
  - Integration is the hard part, not algorithms
  - No proprietary secrets
  - Emphasis on polish and UX
- [ ] Add section on "Contributing Guidelines" (for source-available development and delayed open-source licensing)
- [ ] Add "Non-Goals" section (what we won't build)

---

### README.md

**Current Status:** ✅ Good foundation

**Enhancements:**

- [ ] Add prominent disclaimer section:
  - "What This Software Is"
  - "What This Software Is NOT"
  - Not financial advice
  - Not portfolio management
  - Not a robo-advisor
  - Not tax filing software
- [ ] Add "Philosophy" section or link to new design-philosophy.md
- [ ] Add links to all new documents
- [ ] Add "Quick Start" guide for developers
- [ ] Add comparison to commercial tools (high-level)

---

## New Sections to Add Across Files

### Cross-Cutting Enhancements

#### 1. Integration Emphasis (Multiple Files)

Add notes in each module about how it integrates with others:

- [ ] Tax engine ← pulls from all income sources
- [ ] Withdrawal engine ← triggers tax calculations
- [ ] Projection engine ← orchestrates everything

#### 2. Edge Case Documentation

Each file should include "Edge Cases & Special Situations":

- [ ] 02-account-types: Locked-in account unlocking rules
- [ ] 03-income-sources: Multiple DB pensions from different employers
- [ ] 04-tax-engine: Alternative Minimum Tax (AMT) consideration
- [ ] 05-government-benefits: CPP disability converting to retirement benefit

#### 3. User Experience Guidance

Add to relevant files:

- [ ] 01-user-profile: How to ask for inputs without overwhelming users
- [ ] 07-withdrawal-strategies: How to present strategy choices
- [ ] 09-success-metrics: How to visualize probability of success

#### 4. Configuration Update Process

- [ ] 04-tax-engine: Detailed steps for annual tax bracket updates
- [ ] 05-government-benefits: Quarterly OAS update process
- [ ] 06-investment-engine: When/how to update default return assumptions

---

## Priority Ranking

### Phase 1 (MVP) - Critical Additions

1. ✅ Cash accounts in 02-account-types.md
2. ✅ Disclaimer section in README.md
3. ✅ Edge case handling in 08-projection-engine.md

### Phase 2 (Enhanced) - Important Additions

1. ✅ Design philosophy document (00-design-philosophy.md)
2. ✅ Real estate modeling document (15-real-estate-modeling.md)
3. ✅ UX/Visualization guidelines (14-visualization-ux.md)

### Phase 3 (Advanced) - Nice-to-Have

1. ✅ Corporate accounts in 12-advanced-accounts.md
2. ✅ Compliance scope document (13-compliance-scope.md)
3. ✅ All "minor enhancements" listed above

---

## Tracking Progress

- **Total Items:** ~60 enhancements identified
- **Critical (Phase 1):** 12 items
- **Important (Phase 2):** 18 items
- **Nice-to-Have (Phase 3):** 30 items

---

## Notes

- Most source-of-truth files are already excellent and comprehensive
- Main gaps are:
  1. Advanced/edge-case account types (corporate, cash)
  2. Philosophical context about integration and design
  3. Regulatory disclaimers and scope boundaries
  4. UX and visualization guidelines (implementation-level detail)
- The functional design overview has more narrative/explanatory content
- The source-of-truth has more technical precision and test cases
- Both are complementary and valuable

---

## Review Dates

- Created: 2025-12-15
- Last Updated: 2025-12-15
- Next Review: Before Phase 2 development begins

---

## Sign-Off

This checklist should be reviewed and prioritized by the development team before beginning each phase of implementation.
