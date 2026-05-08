# Follow-up: wire strategyId to UI, verify scenario, decide default

## Context (carry-in from a prior session)

The calculation engine now supports a `strategyId` selector on `ProjectionInput`
— the catalog in `packages/calculation-engine/src/withdrawals/strategy.ts`
(`standard`, `tfsaFirst`, `oasProtection`, `bracketFilling`) is reachable via
`resolveDrawdownOrder()` at line ~210 of that file, consumed in
`packages/calculation-engine/src/projection/yearly-calculator.ts:515` and
threaded through `packages/calculation-engine/src/projection/multi-year.ts` for
single + couple paths.

Merged on `main` (tip `738e8a8`):

- PR #86 — Ultraplan strategy refactor (strategyId adapter + catalog source-of-
  truth)
- PR #83 — OAS clawback indexed threshold fix (#82)
- PR #87 — RRIF balance honored in single-person projection
- 1141 calc-engine tests pass; API 135 tests pass; lint/prettier clean.

API layer already accepts `strategyId`:

- `packages/shared/src/types/scenario.ts:35` — Zod validator includes
  `strategyId: z.enum([...]).optional()`.
- `packages/api/src/services/scenario-decisions.ts` — passes `strategyId`
  through to the engine.

The Web form does **not** yet surface a strategy selector; the API accepts the
field but end users can't reach it through the UI.

## Background: why this matters

TC-SCEN-019 (external scenario harness) showed a single filer with RRSP $40k
/ TFSA $90k / Non-Reg $5k, $30k/yr spending from 65 to 90, only collecting
$35,210 cumulative GIS under the hardcoded default order
`['nonReg', 'rrif', 'rrsp', 'tfsa']`. With `strategyId: 'tfsaFirst'` the same
fixture now produces strictly more GIS (locked in by
`packages/calculation-engine/src/projection/gis-strategy-selection.test.ts`).

End users can't benefit until the UI lets them pick. And the default — still
`'standard'` — is a policy decision, not a correctness bug.

## Three follow-ups (independent; pick any order)

### 1. Web UI strategy selector

**Investigate first**, then implement. Goal: let a user pick one of the four
named presets from the scenario edit form, or fall back to a free-form
`drawdownOrder` (power-user escape hatch — already works).

Critical files:

- `packages/web/src/app/(dashboard)/profile/scenarios/[id]/edit/page.tsx`
  — `TaxState` interface around line 87 already has `drawdownOrder: string[]`;
  add `strategyId?: 'standard' | 'tfsaFirst' | 'oasProtection' |
'bracketFilling'` next to it. Render a select control in the "Tax Strategy"
  collapsible section.
- Whatever component emits `updateDecisions()` — thread `strategyId` through.
- Any Zod/form schema on the client side matching
  `packages/shared/src/types/scenario.ts:35`.

UX questions to resolve before wiring:

- Does the selector override or coexist with the existing manual
  `drawdownOrder` control? (Engine precedence: explicit `drawdownOrder` >
  `strategyId` > default. Decide whether UI mirrors that or hides the manual
  array when a preset is picked.)
- Copy for each preset — short enough to fit a dropdown, honest about the
  trade-offs (tfsaFirst ≠ "best", it's "maximizes GIS access").
- Default value in the form for a new scenario — undefined (= engine default
  `standard`), or an explicit pick?

Tests:

- Add a Playwright smoke test for the selector: set `tfsaFirst`, save, confirm
  the saved scenario's decisions payload contains
  `strategyId: 'tfsaFirst'`.
- Add a Vitest for the form component's state transitions between preset and
  manual array modes.

Out of scope: redesigning the whole Tax Strategy section. Just surface the
selector.

### 2. Re-run TC-SCEN-019 on external test harness

Prerequisite: you have the test platform repo (private, separate). Re-run
TC-SCEN-019 against RetireOps `main` at commit `738e8a8` (or later), sending
`strategyId: 'tfsaFirst'` in the ProjectionInput. Expected:

- Cumulative GIS under `tfsaFirst` > $35,210 (strictly higher than hardcoded
  default).
- Eligible GIS years > 10 (prior baseline under hardcoded default).
- Engine math still matches CRA formula at age 80 within ±$0.01 (sanity
  regression).

Report back the new cumulative GIS number + eligible year count under each
strategy option (`standard`, `tfsaFirst`, `bracketFilling`, `oasProtection`).

If the harness can't send `strategyId` yet, first update the harness's
scenario fixture schema to include it.

### 3. Default-strategy policy decision

**Do not implement yet.** This is a brainstorm-first task. Question: should
the engine default change from `'standard'` to something else?

Inputs for the decision:

- Current default reproduces TC-SCEN-019's GIS-hostile outcome.
- Changing it is a behavior break for every existing caller that omits
  `strategyId`. Every scenario currently in the database that the projection
  will re-run at next request would get different results silently.
- The 2.2 Tax Optimization Engine (worktree `specs/005-tax-optimization-engine/`)
  produces `InsightCard` recommendations — arguably the "right" place to tell
  a user "you'd do better on tfsaFirst" rather than silently changing the
  default.

Report options, not an implementation. Consider:

- (a) Keep `standard` default, rely on 2.2 analyzer to surface better options.
- (b) Switch default to a per-profile heuristic (low-income retiree →
  tfsaFirst; high-income → standard). Needs a rule.
- (c) Make `strategyId` required on `ProjectionInput` at the API boundary —
  force every caller to choose explicitly.

Each has breakage and migration implications; name them.

## Out of scope for all three

- Same-year-income GIS simplification (engine uses current-year net income;
  CRA uses year N-1) — documented, separate task.
- Indexing 2024 GIS constants year-over-year — separate task.
- Redesigning the catalog itself. The catalog is now the single source of
  truth for named presets; don't re-invent it.
- The full 2.2 Tax Optimization Engine build (worktree
  `specs/005-tax-optimization-engine/`) — separate milestone.

## Engine constraints (from CLAUDE.md)

- `calculation-engine` must remain side-effect free: no `Date.now()`,
  `Math.random()`, or I/O.
- Every financial rule must cite a specific ID in `docs/source-of-truth/*.md`.
- All imports use `.js` extensions (ESM strict).
- Build order: `shared` → `calculation-engine` → others.

## Two quick notes on pasting this

- Assumes the receiving session is inside the RetireOps repo at
  `~/projects/RetireOps` with a clean `main` at `738e8a8` or later. If it's a
  web chat without repo access, results will be weaker — prefer a Claude Code
  session.
- If you want the receiving agent to go straight to implementation for the UI
  task without the investigate gate, replace "Investigate first" with
  "Proceed directly; the data model is already wired — this is pure UI
  plumbing." But the gate is recommended for the UX/copy decisions.
