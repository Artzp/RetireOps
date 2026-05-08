# RetireOps Execution TODO

This document turns the blueprint gap analysis into an execution plan.

It is intentionally narrower than `DEVELOPMENT-PLAN.md`. The goal here is to reduce planning mistakes by making each major work item small enough to reason about, verify, and ship safely.

## How To Use This Document

- Treat `BLUEPRINT-GAP-ANALYSIS.md` as the gap inventory.
- Treat this file as the ordered execution plan.
- Do not start an epic until its dependencies, acceptance criteria, and validation steps are understood.
- When an epic starts, break it into a short implementation spec or issue set that preserves the same scope and non-goals.

## Prioritization Rules

Work is ordered by this rule set:

1. Correctness first: anything that can make user outcomes wrong or misleading.
2. Model realism second: anything that materially changes retirement projections.
3. Decision support third: anything that turns outputs into usable advice.
4. Delivery polish last: exports, packaging, and convenience features.

## Current Focus

The current recommended sequence is:

1. Tax and benefit audit pass
2. Stochastic inflation
3. Phased retirement spending
4. Real estate and downsizing
5. Scenario comparison completion
6. Recommendations engine v1
7. Withdrawal methodology expansion
8. Results UX and PDF export

## Now

### P0. Tax and Benefit Audit Pass

Why:
Several areas are marked as partial where the code appears to exist but behavioral accuracy is not yet confirmed. This is the highest-risk category because the product can look complete while still producing wrong answers.

Scope:

- Audit and verify:
  - bridge benefit termination at age 65
  - provincial seniors' credits coverage
  - 2025 blended 14.5 percent lowest-bracket federal handling
  - OAS 10 percent top-up at age 75
  - partial OAS residency logic
  - OAS threshold escalation behavior
  - younger spouse RRIF election
  - TFSA re-contribution room after withdrawal
  - LIF multi-jurisdiction rules and "greater of" maximum logic
- Add missing tests for each audited rule
- Update documentation where the implementation differs from the blueprint

Non-goals:

- Full QPP implementation
- New benefits or new account types
- Rules-as-code migration

Dependencies:

- Read current calculation modules and existing test coverage
- Confirm tax year constants and source references already used in the repo

Acceptance criteria:

- Each audited rule has an explicit pass/fail conclusion
- Failing or missing behavior is either fixed or recorded as a blocked gap
- Each verified rule has automated coverage
- The gap analysis can be updated with fewer "needs audit" notes

Validation:

- Unit tests for each audited rule
- Cross-check sample scenarios against CRA or Service Canada examples where available
- Manual review of a small set of edge-case timelines: age 64 to 66, age 71 RRIF conversion, TFSA withdrawal and next-year room

Risks:

- Silent off-by-one age behavior around birthdays and calendar-year logic
- Double-indexing thresholds if escalation logic already exists elsewhere

Execution doc:

- See `docs/architecture/TAX-BENEFIT-AUDIT-PASS.md` for the concrete checklist, code targets, and initial rule-by-rule assessment

### P0. Stochastic Inflation

Why:
The blueprint explicitly calls this out, and the current Monte Carlo engine keeps inflation fixed. That materially weakens the projection model.

Scope:

- Add inflation volatility input to simulation configuration
- Generate yearly inflation paths per Monte Carlo trial
- Apply inflation paths to spending and indexed thresholds where appropriate
- Surface the assumptions used in results and scenario comparisons
- Keep deterministic projections unchanged unless stochastic inflation is explicitly enabled

Non-goals:

- Correlated inflation and asset-return model
- Asset-class-specific inflation hedging logic
- Client-side WASM execution

Dependencies:

- Audit current Monte Carlo path generation
- Confirm where expense indexation and threshold indexation happen today

Acceptance criteria:

- Monte Carlo paths vary inflation year by year and trial by trial
- Fixed-inflation behavior still works for deterministic mode
- Seeded runs are reproducible in tests
- Results clearly distinguish fixed versus stochastic inflation assumptions

Validation:

- Unit tests for inflation path generation
- Integration tests comparing fixed and stochastic runs
- Manual sanity checks on expense growth and threshold behavior over long horizons

Risks:

- Applying inflation both in the simulation path and again in downstream calculators
- Producing realistic randomness but unrealistic long-run averages because drift is misconfigured

### P1. Phased Retirement Spending

Why:
The current model uses a single retirement expense level. That is too coarse for decumulation planning and does not match the blueprint's "go-go / slow-go / no-go" model.

Scope:

- Extend the schema to support phased spending inputs
- Add projection logic for phase transitions by age or year
- Update UI inputs and review screens
- Show phased spending assumptions in results

Non-goals:

- Long-term care actuarial modeling
- Per-category household budgeting
- Country-specific healthcare cost datasets

Dependencies:

- Confirm where expense inputs are stored and how they flow into yearly calculations
- Align phase naming and defaults across shared types and UI

Acceptance criteria:

- Users can define at least three retirement spending phases
- Projection engine applies the right spending level in the right years
- Existing plans migrate safely to a single-phase default
- Results make phase transitions visible

Validation:

- Unit tests for phase switching
- Migration tests for legacy saved inputs
- Manual scenario checks for early retirement and late-life cost increase cases

Risks:

- Breaking existing saved plans with schema changes
- Ambiguous phase boundaries when retirement age and spending phase start ages conflict

## Next

### P1. Real Estate and Downsizing

Why:
The blueprint expects principal residence and downsizing support, and the gap analysis shows this area is effectively unimplemented. This is a large planning blind spot for many Canadian households.

Scope:

- Add real estate assets to the data model
- Support principal residence designation
- Model a future sale event with transaction costs and net proceeds injection
- Apply PRE treatment for simple principal residence cases

Non-goals:

- Mixed-use and rental-period PRE proration in v1
- Renovation cost modeling
- Reverse mortgages or HELOC strategies

Dependencies:

- Review `docs/source-of-truth/15-real-estate-modeling.md`
- Confirm how asset balances and sale events are represented in yearly projections

Acceptance criteria:

- Users can add a home and optionally model a downsizing sale
- Sale proceeds appear in the right year after transaction costs
- Principal residence sales do not create taxable capital gains in the simple PRE case
- The feature is visible in results and scenario comparison

Validation:

- Unit tests for sale proceeds and timing
- Integration tests for a downsizing scenario
- Manual checks on principal residence exempt versus non-exempt outcomes

Risks:

- Confusing real estate net worth with liquid portfolio balances
- Incorrect sale timing relative to annual cash flow processing

### P1. Scenario Comparison Completion

Why:
Scenario planning is core to the product, but the current implementation is partial. This creates a mismatch between the visible UI and actual decision-making capability.

Scope:

- Complete backend scenario persistence
- Support plan duplication and isolated modifications
- Improve comparison output for key deltas: success rate, depletion age, taxes, estate balance
- Make scenario assumptions visible and auditable

Non-goals:

- Real-time collaborative editing
- Complex branching or merge semantics
- Unlimited scenario history

Dependencies:

- Audit current `ScenariosTab` behavior and backend storage model
- Confirm stable identifiers and comparison API shape

Acceptance criteria:

- Users can duplicate a baseline plan and save scenario-specific changes
- Results can compare scenarios side by side on agreed summary metrics
- Scenario changes do not mutate the baseline plan
- Scenario assumptions are visible in the UI

Validation:

- Integration tests for create, duplicate, edit, and compare flows
- Manual regression checks on baseline plan persistence

Risks:

- Shared references causing accidental mutation of baseline data
- Comparison views that hide material assumption differences

### P1. Recommendations Engine v1

Why:
The product already computes complex outcomes, but low success scores currently stop at display. Users need concrete next actions.

Scope:

- Define a small set of recommendation rules driven by existing outputs
- Start with high-confidence cases only:
  - low probability of success
  - OAS clawback exposure
  - RRSP meltdown opportunity
  - GIS eligibility / TFSA-first opportunity
  - overly early depletion age
- Include impact estimates and explanation text

Non-goals:

- Machine learning or black-box ranking
- One-click automatic plan rewrites
- Advice beyond what the current engine can justify

Dependencies:

- Tax and benefit audit pass
- Agreement on which recommendation types are safe enough to expose

Acceptance criteria:

- Recommendations appear only when trigger conditions are met
- Each recommendation has a human-readable rationale
- Each recommendation references the metric or rule that triggered it
- False-positive rates are low in test scenarios

Validation:

- Rule-level unit tests
- Snapshot or integration tests for representative scenarios
- Manual review to ensure recommendations do not overstate certainty

Risks:

- Advice tone implying certainty where there is only heuristic guidance
- Conflicting recommendations if rule precedence is not defined

## Later

### P2. Withdrawal Methodology Expansion

Why:
Current sequencing is useful but narrow. The blueprint expects additional withdrawal methodologies, and they should be added only after correctness-critical items are stable.

Scope:

- Add explicit withdrawal modes:
  - constant dollar
  - constant percentage
  - variable with floor and ceiling
- Evaluate whether bucket strategy belongs in the same epic or a follow-up

Non-goals:

- Full dynamic programming optimizer
- Advisor-grade custom rule scripting

Dependencies:

- Stable scenario comparison
- Recommendations engine definitions for comparing methods

Acceptance criteria:

- Withdrawal method is an explicit plan setting
- Each method produces distinct, testable yearly behavior
- Results and comparison views show which methodology was used

Validation:

- Unit tests for each methodology
- Manual scenario checks for edge cases near depletion and near minimum withdrawals

Risks:

- Interactions with RRIF/LIF minimums and OAS/GIS optimization logic

### P2. Monte Carlo Realism Improvements

Why:
After stochastic inflation is added, the next realism gap is multi-asset modeling and correlation handling.

Scope:

- Move from single-portfolio mu/sigma to asset-class-level assumptions
- Add a correlation matrix
- Update path generation and portfolio aggregation

Non-goals:

- Full institutional capital markets assumptions framework
- Regime-switching models

Dependencies:

- Stochastic inflation shipped cleanly
- Agreement on asset class taxonomy and default assumptions

Acceptance criteria:

- Simulation accepts asset-class assumptions and a correlation matrix
- Legacy single-portfolio plans still have a migration path
- Results remain understandable to end users

Validation:

- Unit tests for matrix validation and path generation
- Sanity tests on covariance behavior

Risks:

- Complexity increase without enough UX explanation
- Invalid correlation matrices causing unstable outputs

### P2. CPP / QPP Accuracy Expansion

Why:
QPP and CPP dropout provisions are important for correctness, but they require careful rule and data design.

Scope:

- Implement CPP dropout provisions
- Add QPP variant handling
- Clarify user inputs required for higher-fidelity estimates

Non-goals:

- Full contribution-history import
- Government account integrations
- Automated breakeven planner in the same epic

Dependencies:

- Tax and benefit audit pass
- Decision on whether user inputs remain estimate-driven or become history-driven

Acceptance criteria:

- Quebec users are not forced through CPP-only logic
- Dropout rules are represented transparently
- Documentation explains assumptions and limitations

Validation:

- Unit tests for early-retiree and Quebec cases
- Manual checks against public examples where available

Risks:

- False precision if required historical inputs are not available

## Delivery Polish

### P2. Results UX and METR

Why:
More of the engine's reasoning should be visible to users before more advanced optimizations are added.

Scope:

- Add METR visualization
- Improve explanation of success score, depletion age, and key assumptions
- Make important thresholds visible in results

Non-goals:

- Full advisor dashboard redesign

Dependencies:

- Recommendation rules defined

Acceptance criteria:

- Results explain major risk drivers more clearly
- METR output is visible and tied to user-relevant actions

Validation:

- UI regression checks
- Manual readability review on desktop and mobile

### P2. PDF Report Export

Why:
This is expected by the blueprint, but it should come after the core model and recommendation outputs are stable enough to export confidently.

Scope:

- Export a report containing assumptions, summary metrics, charts, and scenario comparison
- Define a stable report structure that mirrors on-screen results

Non-goals:

- White-label theming
- Email workflows

Dependencies:

- Scenario comparison completion
- Results UX stabilization

Acceptance criteria:

- PDF export matches current results content
- Reports include assumptions and clear disclaimers
- Export works reliably across representative plans

Validation:

- Snapshot or visual regression checks for exported reports
- Manual verification of pagination and chart rendering

Risks:

- Freezing unstable metrics into a polished artifact before correctness work is done

## Blocked Or Deferred

These are important, but should remain explicitly deferred until the above work is stable:

- Privacy-preserving client-side WASM execution
- Rules-as-code / OpenFisca integration
- Formal governance model and contribution policy
- Automated SCA, SBOM, and VEX reporting
- GIS Allowance / Allowance for Survivor
- Full principal residence proration for mixed-use or rental periods
- Bucket strategy if simpler withdrawal methods are not yet stable

## Decisions Needed

These decisions should be made before broad implementation work resumes:

1. What is the target quality bar for tax and benefit correctness before adding new surface area?
2. Do we want to optimize for a strong single-person planner first, or keep investing in partial couple support?
3. Should scenario comparison be considered a core platform capability that all new features must support on day one?
4. How much user-configurable complexity is acceptable before the UI becomes too technical for the intended audience?
5. Is the roadmap optimizing for financial modeling accuracy first, or for advisor-ready deliverables first?

## Definition Of Done For Any Epic

Do not mark an epic complete until all of the following are true:

- Scope and non-goals were respected
- Acceptance criteria are met
- Automated tests cover the new behavior
- Existing plan behavior was regression-checked
- User-visible assumptions are documented
- Any remaining limitations are written down in the relevant doc
