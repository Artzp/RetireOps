# RetireOps

[![Live demo](https://img.shields.io/badge/live-retireops.ca-2ea44f)](https://retireops.ca)
[![License: AGPL v3.0](https://img.shields.io/badge/license-AGPL--3.0--only-blue)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933?logo=node.js&logoColor=white)](https://nodejs.org)

RetireOps is open source Canadian retirement planning software. It runs year-by-year cash flow projections across RRSP, RRIF, TFSA, LIRA, LIF, and non-registered accounts — accounting for federal and provincial taxes, CPP/OAS/GIS benefits, OAS clawback, and configurable withdrawal strategies.

**Live demo:** <https://retireops.ca>

The goal: numbers Canadians can trust, without locking people into expensive software.

You can use it in two ways:

- Use the hosted app at <https://retireops.ca>.
- Self-host it for free for your own personal use.

## Project Status

RetireOps is actively being built. Core projection, Monte Carlo, solver, and scenario comparison flows are functional. Historical backtesting data is in place with engine integration in progress.

This project is provided for education and planning support only. It is **not financial advice**, tax advice, or legal advice.

## License

RetireOps is licensed under the GNU Affero General Public License v3.0 only. See [LICENSE](./LICENSE).

Why AGPL-3.0-only:

- People can use, study, modify, self-host, and contribute to RetireOps as open source software.
- Commercial use is allowed under the AGPL.
- If someone modifies RetireOps and runs it as a hosted network service, they must make the corresponding source code for that modified version available to those users.
- The AGPL text is included at [LICENSE-AGPL-3.0.txt](./LICENSE-AGPL-3.0.txt).

The project maintainers may also offer hosted services, support, consulting, or separate commercial licensing for organizations that need different terms.

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

Individuals and organizations can self-host RetireOps under AGPL-3.0-only. If you deploy it publicly for other users, review:

- Security settings and secrets management
- Backup and restore procedures (production compose includes a daily `pg_dump` service)
- Tax-data freshness
- Your local legal and privacy obligations

The production compose file (`docker-compose.yml`) includes Nginx with SSL, replicated web/api/worker containers, and the full observability stack.

## Hosted Service

A hosted version of this codebase can be offered under AGPL-3.0-only. The main condition: if you modify RetireOps and let users interact with it over a network, those users must be able to obtain the corresponding source for the modified version you are running.

## Current Limitations

- Historical backtesting engine integration is in progress (dataset is in place)
- Some 2026+ tax tables are not yet projected
- Real estate modeling (principal residence, rental, mortgages, downsizing) is specified but not yet fully implemented in the engine
- Corporate / CCPC investment accounts are specified but not yet implemented

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Security

Please report suspected vulnerabilities privately. See [SECURITY.md](./SECURITY.md).
