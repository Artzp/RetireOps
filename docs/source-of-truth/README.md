# Canadian Retirement Planning Software - Source of Truth

This directory contains the authoritative specifications for the Canadian Retirement Planning Software. These documents define the expected behavior, calculations, and rules that the software must implement.

## Document Structure

| Document                                                     | Description                                                             |
| ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| [00-design-philosophy.md](./00-design-philosophy.md)         | Design principles, integration thesis, and project positioning          |
| [01-user-profile.md](./01-user-profile.md)                   | User profile data requirements and validation rules                     |
| [02-account-types.md](./02-account-types.md)                 | Canadian account types, rules, and constraints                          |
| [03-income-sources.md](./03-income-sources.md)               | Income modeling specifications                                          |
| [04-tax-engine.md](./04-tax-engine.md)                       | Canadian tax calculation rules and formulas                             |
| [05-government-benefits.md](./05-government-benefits.md)     | CPP/QPP, OAS, GIS rules and calculations                                |
| [06-investment-engine.md](./06-investment-engine.md)         | Investment growth and return calculations                               |
| [07-withdrawal-strategies.md](./07-withdrawal-strategies.md) | Decumulation logic and withdrawal order rules                           |
| [08-projection-engine.md](./08-projection-engine.md)         | Year-by-year cash flow projection specifications                        |
| [09-success-metrics.md](./09-success-metrics.md)             | Plan evaluation and success measurement                                 |
| [10-scenarios.md](./10-scenarios.md)                         | Scenario comparison and what-if analysis                                |
| [11-development-roadmap.md](./11-development-roadmap.md)     | Phased development plan and milestones                                  |
| [12-advanced-accounts.md](./12-advanced-accounts.md)         | Cash/HISA and corporate investment account (CCPC) specifications        |
| [13-compliance-scope.md](./13-compliance-scope.md)           | Regulatory boundaries, disclaimers, and scope limitations               |
| [14-visualization-ux.md](./14-visualization-ux.md)           | Chart specifications, color system, layout, and PDF report format       |
| [15-real-estate-modeling.md](./15-real-estate-modeling.md)   | Principal residence, rental property, mortgage, and downsizing modeling |

## Purpose

These documents serve as:

1. **Specification** - Define what the software must do
2. **Validation Reference** - Test cases and expected behaviors
3. **Development Guide** - Clear requirements for implementation
4. **Change Control** - Authoritative source for rule changes

## Version

- Document Version: 1.1.0
- Tax Year Reference: 2024/2025
- Last Updated: 2026-03-05

## Scope

This software is a **decision-support tool** for retirement planning. It is:

- A cash flow forecasting and strategy planning tool
- Based on publicly available Canadian tax law and benefit rules

It is **NOT**:

- Personalized financial advice
- Portfolio management or investment advice
- A robo-advisor or trading platform
- Tax filing software
