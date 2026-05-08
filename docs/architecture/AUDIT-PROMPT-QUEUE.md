# Audit Prompt Queue

Use these prompts in order. Each prompt is intentionally narrow so work happens in small, testable slices.

## Prompt 1

```text
Action the first small slice of the Tax and Benefit Audit Pass.

Target slice:
- OAS threshold escalation and year handling
- Only fix one narrow part first: make OAS clawback thresholds year-aware for 2024, 2025, and 2026

Read first:
- docs/architecture/TAX-BENEFIT-AUDIT-PASS.md
- docs/architecture/TODO.md
- docs/architecture/BLUEPRINT-GAP-ANALYSIS.md

Inspect first:
- packages/calculation-engine/src/tax/oas-clawback.ts
- packages/calculation-engine/src/tax/oas-clawback.test.ts
- packages/shared/src/constants/rates.ts

Instructions:
- Confirm how year is currently ignored
- Implement the smallest safe fix for threshold lookup only
- Do not change OAS benefit amounts yet
- Add/update targeted tests for 2024, 2025, and 2026 threshold behavior
- Run the narrowest relevant test command
- Report:
  1. files inspected
  2. files changed
  3. tests run
  4. remaining follow-up
```

## Prompt 2

```text
Action the next small slice of the Tax and Benefit Audit Pass.

Target slice:
- OAS year handling
- Only fix OAS full-clawback thresholds for ages 65-74 vs 75+ across 2024, 2025, and 2026

Read first:
- docs/architecture/TAX-BENEFIT-AUDIT-PASS.md

Inspect first:
- packages/calculation-engine/src/tax/oas-clawback.ts
- packages/calculation-engine/src/tax/oas-clawback.test.ts
- packages/shared/src/constants/rates.ts

Instructions:
- Keep scope limited to full-clawback threshold lookup
- Do not change OAS benefit amount logic
- Add precise tests for age split and year split
- Run only targeted tests
- Summarize with exact file references
```

## Prompt 3

```text
Action the next small slice of the Tax and Benefit Audit Pass.

Target slice:
- OAS benefit year handling
- Only make OAS annual benefit amounts year-aware for 2024, 2025, and 2026

Read first:
- docs/architecture/TAX-BENEFIT-AUDIT-PASS.md
- docs/architecture/BLUEPRINT-GAP-ANALYSIS.md

Inspect first:
- packages/calculation-engine/src/benefits/oas.ts
- packages/calculation-engine/src/benefits/oas.test.ts
- packages/shared/src/constants/rates.ts

Instructions:
- Confirm where the year parameter is ignored
- Implement the smallest safe year-based amount lookup
- Do not change age-75 bonus logic yet
- Add/update narrow tests only for year-aware amount selection
- Run targeted tests
- Report remaining ambiguity separately
```

## Prompt 4

```text
Action the next small slice of the Tax and Benefit Audit Pass.

Target slice:
- OAS 10% top-up at age 75
- Determine whether the current implementation double-counts the top-up

Read first:
- docs/architecture/TAX-BENEFIT-AUDIT-PASS.md
- docs/architecture/TODO.md

Inspect first:
- packages/calculation-engine/src/benefits/oas.ts
- packages/calculation-engine/src/benefits/oas.test.ts
- packages/shared/src/constants/rates.ts
- any source-of-truth doc referenced in oas.ts

Instructions:
- Do not widen scope beyond age-75 top-up modeling
- Identify whether `maxAnnualAge75Plus` already includes the top-up
- If the current code is wrong, fix it minimally
- Update tests to reflect one explicit model only
- Report the chosen model clearly
```

## Prompt 5

```text
Action the next small slice of the Tax and Benefit Audit Pass.

Target slice:
- 2025 blended 14.5% lowest-bracket federal handling
- First audit only: confirm current behavior and add failing or passing tests before changing code

Read first:
- docs/architecture/TAX-BENEFIT-AUDIT-PASS.md
- docs/architecture/BLUEPRINT-GAP-ANALYSIS.md

Inspect first:
- packages/calculation-engine/src/tax/federal-tax.ts
- packages/calculation-engine/src/tax/federal-tax.test.ts
- packages/shared/src/constants/tax-tables.ts

Instructions:
- Establish whether 2025 bracket and credit behavior matches intended rule
- Add narrow tests for a first-bracket 2025 case and a 2026 case
- Only change implementation if the test evidence shows a real mismatch
- Keep the slice limited to lowest-bracket federal handling
```

## Prompt 6

```text
Action the next small slice of the Tax and Benefit Audit Pass.

Target slice:
- 2025 blended 14.5% rule
- Fix only the specific federal tax or credit-rate issue identified by the prior audit slice

Read first:
- docs/architecture/TAX-BENEFIT-AUDIT-PASS.md

Inspect first:
- packages/calculation-engine/src/tax/federal-tax.ts
- packages/calculation-engine/src/tax/federal-tax.test.ts
- packages/shared/src/constants/tax-tables.ts

Instructions:
- Implement the smallest change needed
- Do not refactor unrelated federal tax code
- Update only directly relevant tests
- Run targeted tests and summarize impact on 2025 vs 2026 behavior
```

## Prompt 7

```text
Action the next small slice of the Tax and Benefit Audit Pass.

Target slice:
- Younger spouse RRIF election
- Audit full projection-path support, not just helper math

Read first:
- docs/architecture/TAX-BENEFIT-AUDIT-PASS.md

Inspect first:
- packages/calculation-engine/src/accounts/rrif.ts
- packages/calculation-engine/src/accounts/rrif.test.ts
- packages/calculation-engine/src/projection/yearly-calculator.ts
- packages/calculation-engine/src/projection/couple-calculator.ts
- packages/calculation-engine/src/projection/couple-projection.test.ts
- packages/shared/src/types/projection.ts

Instructions:
- Verify the flag flows from projection input to yearly result
- Add or tighten one integration-style test proving the election changes the RRIF minimum
- Do not change LIF behavior in this slice
```

## Prompt 8

```text
Action the next small slice of the Tax and Benefit Audit Pass.

Target slice:
- TFSA re-contribution room after withdrawal
- First audit only: confirm whether projection state tracks TFSA room year over year

Read first:
- docs/architecture/TAX-BENEFIT-AUDIT-PASS.md

Inspect first:
- packages/calculation-engine/src/accounts/tfsa.ts
- packages/calculation-engine/src/accounts/tfsa.test.ts
- packages/calculation-engine/src/projection/yearly-calculator.ts
- packages/calculation-engine/src/projection/multi-year.ts
- packages/calculation-engine/src/projection/projection.test.ts

Instructions:
- Do not implement a full room-tracking refactor yet
- Determine whether current projection logic loses restored room
- Add a narrow test that exposes the current behavior
- If the behavior is missing, report the smallest safe next implementation slice
```

## Prompt 9

```text
Action the next small slice of the Tax and Benefit Audit Pass.

Target slice:
- TFSA re-contribution room after withdrawal
- Implement only the minimal projection-state change needed to carry restored room into the next year

Read first:
- docs/architecture/TAX-BENEFIT-AUDIT-PASS.md

Inspect first:
- packages/calculation-engine/src/accounts/tfsa.ts
- packages/calculation-engine/src/projection/yearly-calculator.ts
- packages/calculation-engine/src/projection/multi-year.ts
- related tests

Instructions:
- Keep scope to room restoration only
- Do not redesign all account state
- Add one projection test for withdraw in year N, restored room in year N+1, and valid re-contribution
- Run the narrowest relevant tests
```

## Prompt 10

```text
Action the next small slice of the Tax and Benefit Audit Pass.

Target slice:
- Bridge benefit termination at age 65
- First audit only: confirm that projection code does not currently model bridge benefit timing

Read first:
- docs/architecture/TAX-BENEFIT-AUDIT-PASS.md
- docs/architecture/BLUEPRINT-GAP-ANALYSIS.md

Inspect first:
- packages/shared/src/types/income.ts
- packages/shared/src/validation/income.schema.ts
- packages/calculation-engine/src/projection/yearly-calculator.ts
- packages/calculation-engine/src/projection/multi-year.ts
- any pension-related tests

Instructions:
- Keep this slice to discovery plus a narrow failing test if appropriate
- Do not implement bridge logic yet unless the missing hook is trivial
- Report the smallest viable implementation shape for a follow-up slice
```

## Prompt 11

```text
Action the next small slice of the Tax and Benefit Audit Pass.

Target slice:
- Bridge benefit termination at age 65
- Implement the smallest viable annualized bridge benefit model

Read first:
- docs/architecture/TAX-BENEFIT-AUDIT-PASS.md

Inspect first:
- projection and shared income files identified in the prior slice

Instructions:
- Keep scope to bridge benefit add/remove timing only
- Do not redesign pension modeling broadly
- Add tests for age 64, 65, and 66 behavior
- State clearly whether the annual model is an approximation of the monthly blueprint rule
```

## Prompt 12

```text
Action the next small slice of the Tax and Benefit Audit Pass.

Target slice:
- LIF multi-jurisdiction rules
- First audit only: identify exactly which jurisdiction differences are real in code versus placeholder scaffolding

Read first:
- docs/architecture/TAX-BENEFIT-AUDIT-PASS.md

Inspect first:
- packages/calculation-engine/src/accounts/lif.ts
- packages/calculation-engine/src/accounts/lif.test.ts
- packages/shared/src/constants/lif-rates.ts

Instructions:
- Do not implement all jurisdiction differences in one pass
- Produce one narrow conclusion: which supported jurisdictions currently behave identically and which should differ first
- Add or update one test that proves current identical behavior where it should likely differ
- Recommend the smallest next implementation slice
```

## Prompt 13

```text
Action the next small slice of the Tax and Benefit Audit Pass.

Target slice:
- LIF "greater of statutory % or prior-year return" logic
- Implement only the minimum design needed to support this rule for one jurisdiction

Read first:
- docs/architecture/TAX-BENEFIT-AUDIT-PASS.md

Inspect first:
- packages/calculation-engine/src/accounts/lif.ts
- packages/calculation-engine/src/accounts/lif.test.ts
- packages/shared/src/constants/lif-rates.ts

Instructions:
- Limit scope to one jurisdiction first
- Add the smallest API/state change needed to provide prior-year return input
- Add focused tests for the "greater of" rule
- Do not broaden to every jurisdiction in the same pass
```

## Prompt 14

```text
Action the next small slice of the Tax and Benefit Audit Pass.

Target slice:
- Provincial seniors' credits coverage
- First audit only: define and document exactly which seniors' credits are currently supported by the actual tax engine

Read first:
- docs/architecture/TAX-BENEFIT-AUDIT-PASS.md
- docs/architecture/BLUEPRINT-GAP-ANALYSIS.md

Inspect first:
- packages/calculation-engine/src/tax/index.ts
- packages/calculation-engine/src/tax/provincial-tax.ts
- packages/calculation-engine/src/tax/credits.ts
- related tax tests

Instructions:
- Do not implement new credits in this slice
- Produce a support matrix grounded in actual integrated code paths
- Update the audit doc if needed
- Call out unsupported blueprint credits explicitly
```

## Prompt 15

```text
Action the next small slice of the Tax and Benefit Audit Pass.

Target slice:
- Provincial seniors' credits coverage
- Implement one narrowly scoped integrated seniors' credit that is already intended to be in scope

Read first:
- docs/architecture/TAX-BENEFIT-AUDIT-PASS.md

Inspect first:
- tax files identified in the previous slice

Instructions:
- Choose exactly one credit
- Wire it into the actual total-tax path
- Add narrow tests proving the credit affects the end result
- Do not add multiple credits in one pass
```

## Shared Prompt Template

```text
Work on RetireOps in very small, testable slices.

Context:
- Main execution plan: docs/architecture/TODO.md
- Audit execution spec: docs/architecture/TAX-BENEFIT-AUDIT-PASS.md
- Gap inventory: docs/architecture/BLUEPRINT-GAP-ANALYSIS.md

Rules:
- Pick exactly one narrow sub-task from the current epic.
- Do not work on multiple audit items in one pass.
- Before editing, inspect the relevant implementation and test files.
- State the exact files you will touch and why.
- Make the smallest change that moves the audit item forward.
- Add or update tests in the same pass.
- Run only the narrowest relevant test command first, then broader tests only if needed.
- After changes, report:
  1. what changed
  2. what was verified
  3. what remains open
  4. any assumptions or risks

Definition of done for each slice:
- one narrow behavior clarified, fixed, or explicitly deferred
- tests added or updated
- relevant docs updated if behavior/support claims changed

Start with this workflow:
1. Read the matching section in docs/architecture/TAX-BENEFIT-AUDIT-PASS.md
2. Inspect the implementation and current tests
3. Propose the smallest next slice
4. Implement it
5. Run targeted tests
6. Summarize with file references

When giving file references, include the exact files inspected or changed.
When blocked, stop and explain the blocker precisely instead of widening scope.
```
