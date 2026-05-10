# RetireOps

[![License: Source Available](https://img.shields.io/badge/license-source--available-orange)](./LICENSE)

RetireOps is source-available Canadian retirement planning software built for individuals who want to understand their own retirement numbers. It runs year-by-year cash flow projections across RRSP, RRIF, TFSA, LIRA, LIF, and non-registered accounts — accounting for federal and provincial taxes, CPP/OAS/GIS benefits, OAS clawback, and configurable withdrawal strategies.

The goal: numbers Canadians can trust, without locking people into expensive software.

## Why RetireOps Exists

RetireOps started because I was trying to understand my own retirement.

I wanted a tool where a regular Canadian could log in, enter their own numbers, and see a clear projection for retirement income, taxes, CPP, OAS, GIS, registered accounts, and long-term cash flow.

Most serious tools I found were built for advisors, locked behind expensive workflows, or too generic to answer personal questions. Paying thousands of dollars before even understanding the basics did not feel right, and general YouTube videos could not answer my specific numbers.

RetireOps is built for individuals first.

The goal is to make retirement planning more transparent, understandable, and accessible for regular people.

## Why RetireOps Is Source-Available

RetireOps is source-available so people can inspect the code, understand the calculations, and self-host it for personal use.

At the same time, the project is not intended to be taken by companies, advisors, or paid platforms, rebranded, placed behind a paywall, and sold back to the people it was built to help without supporting the project.

Individuals should be able to use RetireOps for personal planning.

Commercial use requires a separate license so the project can remain sustainable and continue improving.

You can use it in two ways:

- Try the public beta at https://retireops.ca.
- Self-host it for your own personal retirement planning under the RetireOps Source Available License.

## Project Status

RetireOps is actively being built. Core projection, Monte Carlo, solver, and scenario comparison flows are functional. Historical backtesting data is in place with engine integration in progress.

This project is provided for education and planning support only. It is **not financial advice**, tax advice, or legal advice.

## License

RetireOps is licensed under the RetireOps Source Available License. See [LICENSE](./LICENSE).

Summary:

- Individuals may use, copy, modify, and self-host RetireOps for personal retirement planning.
- The source code is available for transparency, learning, review, and personal self-hosting.
- Commercial use requires a separate commercial license.
- Commercial use includes, but is not limited to:
  - offering RetireOps as a hosted service to third parties
  - using RetireOps with paying clients
  - using RetireOps in an advisor, accounting, tax, employer-benefit, or financial-planning workflow
  - white-labeling RetireOps
  - embedding RetireOps into a paid product
  - selling access to RetireOps or derivative services
  - using RetireOps inside a business workflow to serve customers

The goal is to keep RetireOps accessible for individuals while preventing the project from being taken, rebranded, and sold as a commercial product without permission.

For commercial licensing, contact: info@retireops.ca.

> This summary is informational only. The full license text in [LICENSE](./LICENSE) governs.

## Features

### Calculation Engine

- **Tax engine** — Federal and provincial income tax for all 13 provinces/territories with 2024 and 2025 brackets, marginal/effective rates, non-refundable credits, age amount, pension income credit.
- **OAS clawback** — Full recovery-tax calculation with age-split thresholds (65–74 vs 75+) on net income including dividend gross-ups and taxable capital gains.
- **Government benefits** — CPP/QPP with early (60–64) and late (66–70) adjustment factors, OAS with deferral bonus and 75+ top-up, GIS means-tested supplement.
- **Account handling** — RRSP contributions and room tracking, automatic RRSP→RRIF conversion at age 71, RRIF minimum withdrawal schedule, TFSA contribution room, LIRA/LIF with max withdrawal limits, non-registered accounts with ACB tracking and capital gains.
- **Withdrawal strategies** — Tax-efficient drawdown order, RRIF minimum enforcement, tax-bracket-aware withdrawals.
- **Investment engine** — Deterministic growth with configurable glide-path asset allocation (pre/during/post-retirement equity ratios).
- **Couple / spousal projections** — Joint household modeling with survivor benefits.

### Monte Carlo Simulation

1,000+ log-normal return simulations producing probability of success, percentile balance bands, and median depletion age. Runs asynchronously via a BullMQ worker (`POST /api/projections/:id/monte-carlo`).

### Reverse Calculator / Solver

Four goal-seek modes via binary search:

1. Required monthly savings to meet a retirement spending target
2. Sustainable retirement spending given current savings
3. Earliest feasible retirement age
4. Required total portfolio size at retirement

Exposed at `/reverse-calculator` in the web UI and `POST /api/solver`.

### Funded Status Indicator

Red / yellow / green classification based on whether the portfolio survives to life expectancy with a buffer, plus an automatic remediation plan (savings / spending / retirement-age levers).

### Tax Optimization Insights

Analyzer suite that produces prioritized `InsightCard`s for:

- Income splitting (pension splitting, spousal RRSP)
- CPP / OAS start-age sequencing
- RRSP meltdown strategies
- Drawdown order optimization

### Scenario Comparison

Compare 2–4 scenario variants of a household profile side by side with metric deltas and year-aligned charts. Available at `/profile/scenarios/compare`.

### Historical Backtesting

1990–2025 blended TSX/S&P 500 60/40 annual return dataset bundled in `@retireops/shared`. Engine integration in progress ([spec 010](./specs/010-historical-backtesting/)).

### Profile Wizard

Guided onboarding flow at `/profile` that captures household demographics, accounts, income sources, and retirement goals before running the first projection.

### Reports & Visualization

Year-by-year cash flow tables, net worth charts, tax breakdown per year, and PDF-ready report views.

## Repository Layout

```
packages/
├── shared/              Types, Zod schemas, Canadian constants, historical data
├── calculation-engine/  Pure retirement + tax math (tax, benefits, accounts,
│                        projection, withdrawals, investments, optimization)
├── api/                 Express REST API gateway
├── worker/              BullMQ workers (Monte Carlo, async projections)
└── web/                 Next.js 14 App Router frontend (shadcn/ui)

docs/                    Architecture, roadmap, source-of-truth specs
specs/                   Feature specifications (001–010)
```

### Source-of-Truth Docs

`docs/source-of-truth/` contains the canonical specifications the engine implements — tax rules, benefit formulas, account constraints, withdrawal strategies, projection logic, real estate modeling, and compliance scope. All calculation code references the relevant document.

## Quick Start

### Prerequisites

- Node.js 20+
- Corepack enabled (pnpm 8.15.0)
- Docker and Docker Compose

### Local Development

```bash
corepack enable
corepack pnpm install
cp .env.example .env
docker-compose -f docker-compose.dev.yml up -d
corepack pnpm --filter @retireops/api db:migrate
corepack pnpm dev
```

PowerShell:

```powershell
corepack enable
corepack pnpm install
Copy-Item .env.example .env
docker-compose -f docker-compose.dev.yml up -d
corepack pnpm --filter @retireops/api db:migrate
corepack pnpm dev
```

Default local services:

- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- Health check: `http://localhost:3001/health`
- Metrics (Prometheus): `http://localhost:3001/metrics`

## Environment

Start from [.env.example](./.env.example). The API accepts both newer variable names and older documented aliases for:

- `DATABASE_POOL_MIN` / `DB_POOL_MIN`
- `DATABASE_POOL_MAX` / `DB_POOL_MAX`
- `JWT_ACCESS_TOKEN_EXPIRES_IN` / `JWT_EXPIRES_IN`
- `JWT_REFRESH_TOKEN_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN`
- `CORS_ORIGIN` / `ALLOWED_ORIGINS`

Required env vars are validated by a Zod schema at startup; the API exits on invalid config.

## Common Commands

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build

# Per-package tests
corepack pnpm --filter @retireops/calculation-engine test
corepack pnpm --filter @retireops/api test

# Database
corepack pnpm --filter @retireops/api db:migrate
corepack pnpm --filter @retireops/api db:seed
```

E2E tests use Playwright (`packages/web/e2e/`).

## Tech Stack

- **Language**: TypeScript 5.3+ (strict mode, ES2022, ESM)
- **Backend**: Express 4, PostgreSQL 16, Redis 7, BullMQ 5, Kysely
- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS, shadcn/ui, Recharts
- **Validation**: Zod
- **Auth**: JWT access tokens (15m) + hashed refresh tokens; Google OAuth
- **Testing**: Vitest (unit + integration), Playwright (E2E), supertest
- **Observability**: Winston logging, Prometheus metrics, Grafana/Loki in prod compose

## Self-Hosting

Individuals may self-host RetireOps for their own personal retirement planning under the RetireOps Source Available License.

Organizations, advisors, consultants, financial planners, accounting firms, employers, or commercial platforms must obtain a commercial license before using RetireOps in a business or client-service context.

If you self-host for personal use, review:

- Security settings and secrets management
- Backup and restore procedures (production compose includes a daily `pg_dump` service)
- Tax-data freshness
- Your local legal and privacy obligations

The production compose file (`docker-compose.yml`) includes Nginx with SSL, replicated web/api/worker containers, and the full observability stack.

## Hosted Service

The official hosted RetireOps service may be offered for free or with paid features to help keep the project sustainable.

Running your own hosted RetireOps service for other users, clients, customers, employees, or the public requires a commercial license unless you have written permission from the maintainers.

## Current Limitations

- Historical backtesting engine integration is in progress (dataset is in place)
- Some 2026+ tax tables are not yet projected
- Real estate modeling (principal residence, rental, mortgages, downsizing) is specified but not yet fully implemented in the engine
- Corporate / CCPC investment accounts are specified but not yet implemented

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Security

Please report suspected vulnerabilities privately. See [SECURITY.md](./SECURITY.md).
