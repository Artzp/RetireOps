# Canadian Retirement Planning Software - Source of Truth

This directory contains the authoritative specifications for the Canadian Retirement Planning Software. These documents define the expected behavior, calculations, and rules that the software must implement.

## Document Structure

| Document                                                             | Description                                                                                                                                  |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [00-design-philosophy.md](./00-design-philosophy.md)                 | Design principles, integration thesis, and project positioning                                                                               |
| [01-user-profile.md](./01-user-profile.md)                           | User profile data requirements and validation rules                                                                                          |
| [02-account-types.md](./02-account-types.md)                         | Canadian account types, rules, and constraints                                                                                               |
| [03-income-sources.md](./03-income-sources.md)                       | Income modeling specifications                                                                                                               |
| [04-tax-engine.md](./04-tax-engine.md)                               | Canadian tax calculation rules and formulas                                                                                                  |
| [05-government-benefits.md](./05-government-benefits.md)             | CPP/QPP, OAS, GIS rules and calculations                                                                                                     |
| [06-investment-engine.md](./06-investment-engine.md)                 | Investment growth and return calculations                                                                                                    |
| [07-withdrawal-strategies.md](./07-withdrawal-strategies.md)         | Decumulation logic and withdrawal order rules                                                                                                |
| [08-projection-engine.md](./08-projection-engine.md)                 | Year-by-year cash flow projection specifications                                                                                             |
| [09-success-metrics.md](./09-success-metrics.md)                     | Plan evaluation and success measurement                                                                                                      |
| [10-scenarios.md](./10-scenarios.md)                                 | Scenario comparison and what-if analysis                                                                                                     |
| [11-development-roadmap.md](./11-development-roadmap.md)             | Phased development plan and milestones                                                                                                       |
| [12-advanced-accounts.md](./12-advanced-accounts.md)                 | Cash/HISA and corporate investment account (CCPC) specifications                                                                             |
| [13-compliance-scope.md](./13-compliance-scope.md)                   | Regulatory boundaries, disclaimers, and scope limitations                                                                                    |
| [14-visualization-ux.md](./14-visualization-ux.md)                   | Chart specifications, color system, layout, and PDF report format                                                                            |
| [15-real-estate-modeling.md](./15-real-estate-modeling.md)           | Principal residence, rental property, mortgage, and downsizing modeling                                                                      |
| [16-feature-roadmap-31.md](./16-feature-roadmap-31.md)               | Feature roadmap v3.1 (delta from the main roadmap)                                                                                           |
| [17-contribution-room.md](./17-contribution-room.md)                 | RRSP / TFSA / FHSA / RRIF contribution-room tracking specifications                                                                          |
| [18-pensions-2026.md](./18-pensions-2026.md)                         | 2026 CPP / QPP / OAS / GIS / Allowance / AfS / FP Canada PAG parameter values (dated; refreshes annually)                                    |
| [19-benefits-tax-credits-2026.md](./19-benefits-tax-credits-2026.md) | 2026 federal & provincial tax credits, EI, CDB, CDCP, CWB, GST-HST/CGEB, VAC, senior supplement parameter values (dated; refreshes annually) |

## Purpose

These documents serve as:

1. **Specification** - Define what the software must do
2. **Validation Reference** - Test cases and expected behaviors
3. **Development Guide** - Clear requirements for implementation
4. **Change Control** - Authoritative source for rule changes

## How to cite from engine code

Every financial calculation in the calculation engine MUST cite the specific source-of-truth document and (where applicable) the 2026 parameter anchor that the calculation relies on. Citations use **markdown-link-in-comment style** — clickable in VS Code, no special tooling needed, no JSDoc machinery.

### Citing a dated 2026 parameter

For values that refresh annually (CPP rates, OAS amounts, tax credits, provincial supplements), cite the anchored parameter in the 2026 dated file:

```ts
// CPP 2026 YMPE per docs/source-of-truth/18-pensions-2026.md#2026-cpp-ympe
const CPP_YMPE_2026 = 74_600;

// OAS 2026 clawback threshold per docs/source-of-truth/18-pensions-2026.md#2026-oas-clawback-threshold
const OAS_CLAWBACK_THRESHOLD_2026 = 95_323;

// Federal 2026 Basic Personal Amount per docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-fed-bpa-max
const FED_BPA_2026_MAX = 16_452;
```

Anchor IDs follow the pattern `<year>-<topic>-<param>` (lowercase-dashes). See the existing anchors in `18-pensions-2026.md` and `19-benefits-tax-credits-2026.md` for the full list.

### Citing a formula or rule

For values that are formula-derived or rule-based (eligibility checks, age-adjustment math, drop-out logic), cite the rules-layer doc — typically `05-government-benefits.md` or `04-tax-engine.md` — by section heading (which GitHub auto-anchors):

```ts
// Apply CPP early-take-up reduction per docs/source-of-truth/05-government-benefits.md#early-late-adjustment-factors
const adjustedCpp = baseCpp * (1 + monthsBefore65 * -0.006);
```

### Citation discipline

1. **One citation per constant or rule application.** Don't bury citations in long function-level docstrings — put them on the line that uses the value.
2. **Cite the most specific anchor available.** Prefer `#2026-cpp-ympe` over `#cpp-2026-parameters`.
3. **When in doubt, cite both.** A complex calculation can cite the rules-layer doc for the formula AND the dated-parameter file for the numeric inputs.
4. **Annual refresh discipline.** When the 2027 parameter files land (`20-pensions-2027.md`, `21-benefits-tax-credits-2027.md`), engine code citing 2026 anchors needs to be re-pointed. The `<year>-<topic>-<param>` anchor pattern makes this greppable: `grep -r '#2026-' src/` finds every annual-refresh citation in the engine.

Engine code currently (v4.5) does NOT yet have these citation comments — they will be added in v4.6+ once the calculation engine itself is touched. v4.5 establishes the anchor convention and the citation style.

## Version

- Document Version: 1.2.0
- Tax Year Reference: 2024 / 2025 / 2026
- Last Updated: 2026-05-10

## Scope

This software is a **decision-support tool** for retirement planning. It is:

- A cash flow forecasting and strategy planning tool
- Based on publicly available Canadian tax law and benefit rules

It is **NOT**:

- Personalized financial advice
- Portfolio management or investment advice
- A robo-advisor or trading platform
- Tax filing software
