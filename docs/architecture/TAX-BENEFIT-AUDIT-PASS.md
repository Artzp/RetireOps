# Tax And Benefit Audit Pass

This document turns the `P0. Tax and Benefit Audit Pass` epic into a concrete implementation and verification checklist.

It is based on the current code in the repository, not just the blueprint. Status values here are an initial assessment and should be updated as the audit proceeds.

## Status Legend

- `PASS`: behavior appears implemented and covered well enough to verify formally
- `PARTIAL`: some implementation exists, but integration or edge-case coverage is incomplete
- `FAIL`: implementation appears missing or materially inconsistent with the blueprint
- `OPEN`: not enough evidence yet; requires direct verification

## Audit Matrix

| Item                                                        | Initial Status | Why                                                                                                                                                                   |
| ----------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bridge benefit termination at age 65                        | `FAIL`         | Schema fields exist, but projection calculators only consume a flat `pensionIncome` number and do not model bridge timing                                             |
| Provincial seniors' credits coverage                        | `PARTIAL`      | Generic provincial age and pension credits exist, but targeted seniors' credits from the blueprint are not integrated into total tax calculation                      |
| 2025 blended 14.5% lowest-bracket federal handling          | `FAIL`         | Federal tax code switches to 2025 brackets, but credit-rate and bracket treatment do not clearly implement the 2025 blended rule                                      |
| OAS 10% top-up at age 75                                    | `OPEN`         | OAS code applies both an age-75 base amount and a separate 10% bonus factor; this may be correct only if the base amount is pre-top-up                                |
| Partial OAS residency logic                                 | `PASS`         | OAS residency factor is implemented as a 40-year prorating model with test coverage                                                                                   |
| OAS threshold escalation / year handling                    | `FAIL`         | OAS clawback thresholds and benefit amounts are effectively hardcoded to 2024 in the calculation layer                                                                |
| Younger spouse RRIF election                                | `PARTIAL`      | Core functions and spouse-aware yearly calculator support it, but full projection/UI-path verification is still needed                                                |
| TFSA re-contribution room after withdrawal                  | `PARTIAL`      | TFSA account module supports restored room next year, but projection flow does not appear to track contribution room across years                                     |
| LIF multi-jurisdiction rules and "greater of" maximum logic | `FAIL`         | Jurisdiction scaffolding exists, but all jurisdictions use the same formula and the blueprint's "greater of statutory % or prior-year return" rule is not implemented |

## Code Targets

These are the primary files that matter for this audit:

- Benefits:
  - `packages/calculation-engine/src/benefits/oas.ts`
  - `packages/calculation-engine/src/benefits/oas.test.ts`
- Tax:
  - `packages/calculation-engine/src/tax/index.ts`
  - `packages/calculation-engine/src/tax/federal-tax.ts`
  - `packages/calculation-engine/src/tax/federal-tax.test.ts`
  - `packages/calculation-engine/src/tax/provincial-tax.ts`
  - `packages/calculation-engine/src/tax/oas-clawback.ts`
  - `packages/calculation-engine/src/tax/credits.ts`
- Projection:
  - `packages/calculation-engine/src/projection/yearly-calculator.ts`
  - `packages/calculation-engine/src/projection/multi-year.ts`
  - `packages/calculation-engine/src/projection/projection.test.ts`
  - `packages/calculation-engine/src/projection/couple-projection.test.ts`
  - `packages/calculation-engine/src/projection/couple-calculator.ts`
- Accounts:
  - `packages/calculation-engine/src/accounts/tfsa.ts`
  - `packages/calculation-engine/src/accounts/tfsa.test.ts`
  - `packages/calculation-engine/src/accounts/rrif.ts`
  - `packages/calculation-engine/src/accounts/rrif.test.ts`
  - `packages/calculation-engine/src/accounts/lif.ts`
  - `packages/calculation-engine/src/accounts/lif.test.ts`
- Shared constants and schemas:
  - `packages/shared/src/constants/rates.ts`
  - `packages/shared/src/constants/lif-rates.ts`
  - `packages/shared/src/constants/tax-tables.ts`
  - `packages/shared/src/validation/income.schema.ts`
  - `packages/shared/src/types/income.ts`

## Rule-By-Rule Checklist

### 1. Bridge Benefit Termination At Age 65

Current evidence:

- `bridgeBenefit` and `bridgeEndAge` exist in shared income schema and types.
- Projection code now applies bridge timing in `multi-year.ts`.
- The yearly engine does not run a true month-by-month cash-flow model.

Assessment:

- `PARTIAL`: bridge timing is now modeled in the projection layer as annual month-proration
  in the year the user reaches `bridgeEndAge`, but the engine still remains yearly rather
  than fully monthly.

Audit steps:

- Confirm whether any separate DB pension pipeline exists outside `yearly-calculator.ts`.
- Verify whether bridge termination is supposed to occur at calendar year end or by birthday/month boundary.
- Decide whether yearly granularity can approximate the blueprint's "first day of the month following age 65" rule or whether a monthly sub-model is required.

Required tests:

- User retires before 65 and receives a prorated bridge benefit in the year they turn 65.
- CPP start age before 65 does not end bridge benefit early.
- Bridge benefit ends on schedule without affecting base pension income.

Definition of done:

- Projection code explicitly models bridge benefit timing.
- Tests cover age 64, 65, and 66 transitions.
- Remaining gap of no full monthly cash-flow engine is documented.

### 2. Provincial Seniors' Credits Coverage

Current evidence:

- `provincial-tax.ts` includes provincial age and pension credits.
- `credits.ts` contains extra credit helpers, but `tax/index.ts` does not integrate most of them into total tax.
- Blueprint examples include credits like OEPTC and BC Renter's credit.
- Integrated today through `calculateTotalTax()`: federal age amount, federal pension income amount, provincial age credits, and provincial pension credits.
- Not integrated into `calculateTotalTax()` today: OEPTC and helper-only credit calculations in `credits.ts` such as home accessibility.
- Newly integrated in a narrow slice: B.C. renter's credit through explicit BC-specific tax inputs.
- Newly integrated in a narrow slice: Ontario Seniors' Public Transit Tax Credit through an
  Ontario-specific eligible-expenses tax input.
- Current support boundary for the B.C. renter's credit: tax-engine only. The projection UI schema,
  API projection payload schema, and `projection-transformer.ts` do not surface or forward
  `bcRentersCreditEligible` / `bcRentersCreditAdjustedIncome`, so end-to-end projection inputs
  cannot currently trigger the credit.

Assessment:

- Core age-based credits exist, but targeted seniors' credits are not broadly wired into the actual tax calculation path.

Audit steps:

- Define which seniors' credits are in scope for v1.
- Map each supported province to implemented credits.
- Distinguish non-refundable credits from refundable benefits so they are not mixed incorrectly.

Required tests:

- Ontario senior with qualifying inputs gets documented ON-specific credits if in scope.
- BC renter credit behavior is covered if in scope.
- Unsupported credits are explicitly documented rather than silently omitted.

Definition of done:

- Supported provincial seniors' credits are enumerated.
- Tax engine behavior matches that support list.

### 3. 2025 Blended 14.5% Lowest-Bracket Federal Handling

Current evidence:

- `federal-tax.ts` routes year 2025 and later to `FEDERAL_TAX_2025`.
- Basic personal amount credit still uses a fixed 15% credit rate.
- Audit has not confirmed whether the 2025 table itself encodes the blended lowest rate correctly for tax and credit calculations.

Assessment:

- This remains a likely correctness gap until the 2025 rule is explicitly verified end to end.

Audit steps:

- Confirm the exact 2025 federal lowest bracket and credit-rate treatment intended by the product.
- Verify `packages/shared/src/constants/tax-tables.ts` and any related federal constants.
- Decide whether 2026 should still inherit 2025 data or have its own table.

Required tests:

- 2025 low-income return reflects the blended rule.
- 2025 tax for a simple first-bracket income case matches expected manual calculation.
- 2026 does not accidentally inherit 2025-specific transitional behavior unless intended.

Definition of done:

- 2025 and 2026 federal handling are both explicit in code and tests.

### 4. OAS 10% Top-Up At Age 75

Current evidence:

- `oas.ts` uses an age-75-specific base amount and also multiplies by `calculateAge75Bonus()`.
- Existing tests assert the double application behavior.

Assessment:

- This may be correct or may be double counting depending on whether the shared age-75 base amount already includes the top-up.

Audit steps:

- Verify the meaning of `BENEFIT_AMOUNTS_2024.oas.maxAnnualAge75Plus`.
- Decide whether age-75 handling should be represented as:
  - separate base amounts only, or
  - one base amount plus a 10% multiplier.

Required tests:

- Age 74 to 75 transition case.
- Age 75 with no deferral.
- Age 75 with deferral, ensuring no double count.

Definition of done:

- One clear model for the top-up is chosen and documented.
- Tests reflect that model instead of reinforcing an accidental implementation.

### 5. Partial OAS Residency Logic

Current evidence:

- `calculateOASResidencyFactor()` prorates years of residence over 40 years.
- OAS tests cover under-10-year ineligibility and partial factors.

Assessment:

- The core residency calculation appears present and test-covered.

Audit steps:

- Confirm whether any year-specific or treaty-specific residency variants are intentionally out of scope.
- Verify whether the rest of the OAS calculation uses the residency factor consistently after any year-handling fixes.

Required tests:

- Keep existing partial residency tests.
- Add one integration test where partial residency flows through a full yearly calculation.

Definition of done:

- Residency logic remains correct after OAS year-handling fixes.

### 6. OAS Threshold Escalation And Year Handling

Current evidence:

- `oas-clawback.ts` always reads 2024 thresholds regardless of input year.
- `rates.ts` only defines OAS clawback thresholds for 2024.
- `oas.ts` uses `BENEFIT_AMOUNTS_2024` regardless of year.

Assessment:

- This is an active correctness failure for any projection year after 2024.

Audit steps:

- Add explicit year-keyed OAS thresholds and benefit amounts.
- Decide whether future-year projections use fixed known values, indexed values, or a documented approximation rule.
- Audit any optimizer or withdrawal logic that also reads 2024-only thresholds.

Required tests:

- 2024, 2025, and 2026 clawback thresholds return different expected values where appropriate.
- OAS benefit calculations respect year-specific amount tables or documented indexation logic.
- Projection tests confirm threshold behavior changes over time.

Definition of done:

- All year-sensitive OAS logic stops defaulting to 2024.

### 7. Younger Spouse RRIF Election

Current evidence:

- `rrif.ts` implements younger-spouse minimum logic.
- `yearly-calculator.ts` supports `useYoungerSpouseForRRIF`.
- Couple projection code passes spouse age into calculations.
- Existing tests focus mostly on module-level behavior.

Assessment:

- The core logic exists, but full path verification is incomplete.

Audit steps:

- Confirm UI input path and persistence for the election.
- Verify that single-person flows cannot accidentally set spouse-based reductions.
- Confirm minimum-withdrawal behavior at ages below 72 is consistent with product rules.

Required tests:

- Couple projection uses younger spouse election when enabled.
- Same data with election off produces a higher RRIF minimum.
- Saved projection inputs preserve the election flag.

Definition of done:

- The election is verified from input to yearly result, not just in isolated account math.

### 8. TFSA Re-Contribution Room After Withdrawal

Current evidence:

- `tfsa.ts` returns `roomRestoredNextYear`.
- TFSA tests cover basic restoration math.
- Projection code uses TFSA balances directly and does not appear to track year-over-year room restoration.

Assessment:

- Account math exists, but full projection integration appears incomplete.

Audit steps:

- Decide whether contribution room belongs in the projection state for single and couple flows.
- Verify whether pre-retirement annual contributions can overrun restored room in later years.
- Confirm no tax or clawback calculations mistakenly include TFSA withdrawals.

Required tests:

- Withdraw from TFSA in year N and confirm room increases in year N+1.
- Re-contribute in year N+1 without exceeding restored room.
- Projection test covers withdrawal, restoration, and re-contribution sequence.

Definition of done:

- TFSA room is tracked as part of the actual projection state, not just in isolated helper functions.

### 9. LIF Multi-Jurisdiction Rules And "Greater Of" Maximum Logic

Current evidence:

- `lif-rates.ts` defines multiple jurisdictions.
- `lif.ts` reads jurisdiction config, but all jurisdictions currently rely on the same maximum formula and reference rate.
- No prior-year-return-based "greater of" rule was found in the LIF maximum calculation path.

Assessment:

- Jurisdiction structure exists, but the actual regulatory differences are mostly not modeled yet.

Audit steps:

- Decide which jurisdictions are fully supported now versus deferred.
- Encode explicit jurisdiction differences instead of a shared placeholder formula.
- Design how prior-year return data should be carried into LIF max calculations.

Required tests:

- Ontario and at least one non-Ontario jurisdiction produce different results when rules differ.
- Prior-year-return rule is covered for jurisdictions that require it.
- Projection engine respects LIF maximums in multi-year runs.

Definition of done:

- Supported jurisdictions have distinct, tested behavior.
- "Greater of" logic is implemented where required, or explicitly deferred and documented.

## Initial Findings Worth Fixing Early

These are the highest-signal findings from the initial code review:

1. `packages/calculation-engine/src/tax/oas-clawback.ts` is effectively 2024-only even though the API accepts any year.
2. `packages/calculation-engine/src/benefits/oas.ts` ignores the `year` parameter for entitlement amounts.
3. `packages/calculation-engine/src/projection/yearly-calculator.ts` does not appear to model bridge benefit timing at all.
4. `packages/calculation-engine/src/projection/yearly-calculator.ts` does not appear to track TFSA contribution room state across years.
5. `packages/calculation-engine/src/accounts/lif.ts` and `packages/shared/src/constants/lif-rates.ts` provide jurisdiction scaffolding, but not the blueprint's more specific maximum rules.

## Suggested Execution Order Inside This Epic

1. Fix year-sensitive OAS data flow first.
2. Resolve OAS age-75 modeling ambiguity next.
3. Audit and lock down 2025 and 2026 federal tax handling.
4. Verify RRIF younger spouse election through full projection tests.
5. Add TFSA room tracking to projection state if still missing.
6. Implement or explicitly defer bridge benefit timing.
7. Tighten LIF support boundaries and rules by jurisdiction.
8. Document the exact list of supported provincial seniors' credits.

## Exit Criteria

This epic is complete only when:

- Every item in the matrix is marked `PASS` or explicitly deferred with a documented reason.
- Code paths and tests match the support claims in `BLUEPRINT-GAP-ANALYSIS.md`.
- Year-sensitive tax and benefit logic no longer silently falls back to 2024 behavior.
