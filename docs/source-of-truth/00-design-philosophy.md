# 00 - Design Philosophy

## Overview

RetireOps exists because Canadian retirement planning is unreasonably opaque. Commercial tools hide their calculations behind proprietary engines, making it impossible for users to verify the math that drives their most important financial decisions. This document defines the guiding principles behind every design and implementation choice in the project.

---

## Why RetireOps Exists

Canadian retirement planning involves the interaction of dozens of interconnected rules: federal and provincial tax brackets, CPP/QPP benefit calculations, OAS clawback thresholds, RRSP-to-RRIF conversion timing, TFSA contribution room, GIS eligibility, and withdrawal ordering — all changing annually. No single rule is particularly complex in isolation. The complexity lies in their **integration**.

RetireOps is not novel in any individual calculation. Its value is in:

1. **Tested integration** — every rule is implemented, tested, and verified against its source document
2. **Full transparency** — every output can be traced back to a specific formula in a specific source-of-truth document
3. **Open methodology** — no proprietary "black box" stands between the user and the math

---

## Comparison Positioning

| Feature                        | RetireOps                                 | Commercial Tools     | Spreadsheets                                |
| ------------------------------ | ----------------------------------------- | -------------------- | ------------------------------------------- |
| Calculation transparency       | Full (every calc traced to source doc)    | Opaque / proprietary | Partial (formulas visible but unstructured) |
| Canadian tax accuracy          | Federal + all provinces, annually updated | Varies widely        | User-maintained                             |
| CPP/QPP early/late adjustments | Yes, with source references               | Usually              | Manual                                      |
| OAS clawback / GIS             | Yes                                       | Some tools           | Rarely                                      |
| Couple/spouse planning         | Yes                                       | Premium tiers        | Complex to build                            |
| Scenario comparison            | Side-by-side, up to 3                     | Limited or premium   | Manual duplication                          |
| Source of truth docs           | Every rule documented                     | Not available        | N/A                                         |
| Test suite                     | Automated, referencing rule IDs           | Unknown              | None                                        |
| Cost                           | Open source                               | $500-$5,000+/year    | Free but high effort                        |
| Maintenance burden             | Community / automated                     | Vendor-dependent     | Entirely on user                            |

---

## Design Principles

### 1. Accuracy Over Approximation

Every calculation must implement the actual CRA/Service Canada formula, not a simplified version. Where simplification is unavoidable (e.g., monthly vs. annual granularity), the simplification must be documented in the relevant source-of-truth document with its expected margin of error.

### 2. Transparency as a Feature

Every number shown to the user must be traceable to a calculation, and every calculation must reference its source-of-truth document. This is not a documentation nicety — it is a core product feature. If a user asks "why is my tax $X?", the system should be able to answer by pointing to the exact rule, bracket, and formula.

```typescript
/**
 * Calculate federal tax for a given taxable income.
 * @see docs/source-of-truth/04-tax-engine.md - FED-TAX-001
 */
```

### 3. Separation of Concerns

The calculation engine must have **zero dependencies** on UI, database, or API layers. It receives typed inputs and returns typed outputs. This ensures:

- Calculations can be unit-tested in isolation
- The engine can be used in CLI tools, workers, or other contexts
- UI changes never accidentally break financial logic

### 4. Conservative Defaults

When the user does not specify a value, defaults must be conservative (i.e., they should underestimate wealth, not overestimate it):

- Default inflation: 2.0% (not lower)
- Default investment return: 4.0% real (not higher)
- Default life expectancy: 95 (not lower)
- CPP benefit: use actual contribution history or conservative estimate

### 5. Canadian-First, Canadian-Only

RetireOps targets Canadian residents using Canadian financial products and Canadian tax law. There is no internationalization layer. US Social Security, 401(k), IRA, or cross-border tax treaties are explicitly out of scope (see [13-compliance-scope.md](./13-compliance-scope.md) SCOPE-005).

---

## What This Software Is Not

RetireOps is a planning and projection tool. It is explicitly not:

- A replacement for a qualified financial advisor
- A portfolio management or robo-advisory platform
- Tax preparation or filing software
- An insurance or annuity recommendation engine

See [13-compliance-scope.md](./13-compliance-scope.md) for the complete list of regulatory exclusions and required disclaimers.

---

## Integration Thesis

The core thesis of this project is that **Canadian retirement planning is an integration problem, not an algorithm problem**. The individual rules (tax brackets, CPP formulas, RRIF minimums) are publicly available. What is missing — and what this software provides — is:

1. A single codebase that implements all the rules together
2. A test suite that verifies the rules against source documents
3. A projection engine that runs them in the correct order, year by year
4. A visualization layer that makes the results understandable

The value is not in any secret formula. The value is in the **tested, documented, integrated whole**.

---

## Cross-References

- [08-projection-engine.md](./08-projection-engine.md) — The core integration loop
- [11-development-roadmap.md](./11-development-roadmap.md) — Phased delivery plan
- [13-compliance-scope.md](./13-compliance-scope.md) — Regulatory boundaries and disclaimers
