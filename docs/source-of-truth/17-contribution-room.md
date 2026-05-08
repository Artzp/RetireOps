# 17 - Contribution Room Ledger (M005/S05)

## Overview

This document specifies the four contribution-room validation rules implemented in M005.
Numbers in every Worked Example table are pinned cent-exact against the parity tests in
`packages/calculation-engine/src/projection/vr-*-001-worked-example.test.ts` (K012 workflow).
A discrepancy between a table and the test is a doc bug — fix the table, not the engine.

---

## VR-RRSP-PA-001

**Rule:** RRSP annual room accrual equals 18% of the prior year's earned income (capped at the CRA
annual maximum), **reduced by the pension adjustment (PA) with a zero floor**.

> **D025 Simplification:** This engine applies a single scalar PA value uniformly to every
> projection year. Per-year PA schedules, pension adjustment reversals (PARs), and past service
> pension adjustments (PSPAs) are out of scope. The PA scalar is supplied by the user at
> projection start and applied identically in every year.

```
accrual_net_PA = max(0, min(earnedIncome × 0.18, annualMax) − pensionAdjustment)
rrspRoom_year  = priorCarry + accrual_net_PA
```

**Worked Example**

Scenario: couple projection, primary born 1980-01-01, `earnedIncome = $100,000/yr`,
`pensionAdjustment = $10,000/yr`, `rrspAnnualContribution = 0` (room accumulates).
Annual max defaults to $32,490 (2025 cap applied to 2026+ per engine fallback).
Net accrual per year = max(0, 18,000 − 10,000) = **$8,000**.

| Year | With PA=10k (rrspContributionRoom) | No PA baseline (rrspContributionRoom) | PA reduction (cumulative) |
| ---- | ---------------------------------- | ------------------------------------- | ------------------------- |
| 2026 | 8,000.00                           | 18,000.00                             | 10,000.00                 |
| 2031 | 48,000.00                          | 108,000.00                            | 60,000.00                 |
| 2036 | 88,000.00                          | 198,000.00                            | 110,000.00                |
| 2041 | 128,000.00                         | 288,000.00                            | 160,000.00                |
| 2046 | 168,000.00                         | 378,000.00                            | 210,000.00                |

Parity test: `packages/calculation-engine/src/projection/vr-rrsp-pa-001-worked-example.test.ts`

---

## VR-TFSA-RESIDENCY-001

**Rule:** TFSA cumulative room for immigrants (or any holder who was not a Canadian resident
at age 18) is sliced to begin in the `residencyStartYear` rather than the year the holder
turned 18. The engine seeds the TFSA ledger with:

```
baseline = sum(TFSA_ANNUAL_LIMITS, residencyStartYear .. startYear − 1)
year0Room = baseline + TFSA_ANNUAL_LIMITS[startYear]  (before any contributions)
```

When `residencyStartYear` is omitted, the engine assumes the holder has been a resident since
age 18 and uses the full cumulative baseline from that year forward.

**Worked Example**

Scenario: couple projection, primary born 1997-01-01, `residencyStartYear = 2021`,
projection starts in 2026, `tfsaAnnualContribution = 0`.

| Component                          | Amount        |
| ---------------------------------- | ------------- |
| Limit 2021                         | 6,000.00      |
| Limit 2022                         | 6,000.00      |
| Limit 2023                         | 6,500.00      |
| Limit 2024                         | 7,000.00      |
| Limit 2025                         | 7,000.00      |
| Baseline (2021–2025)               | 32,500.00     |
| Limit 2026 (year 0)                | 7,000.00      |
| **tfsaContributionRoom year 2026** | **39,500.00** |

Parity test: `packages/calculation-engine/src/projection/vr-tfsa-residency-001-worked-example.test.ts`

---

## VR-FHSA-CARRY-001

**Rule:** Unused FHSA annual room carries forward into the following year, capped at
$8,000. The effective single-year contribution ceiling is:

```
participationRoom = min(singleYearCap, annualLimit + carryForwardAvailable)
                  = min($16,000,      $8,000      + carryForward)
effectiveRoom     = min(participationRoom, lifetimeLimit − lifetimeContributed)
```

An over-contribution penalty applies when `fhsaContribution > effectiveRoom`:

```
overAmount = fhsaContribution − effectiveRoom
penalty    = overAmount × 1%/month × 12 months
```

The warning `kind` is `'lifetime-cap-exceeded'` when `lifetimeContributed + fhsaContribution > $40,000`,
otherwise `'over-contribution'`.

> Cross-reference: FHSA-001 ($8,000 annual limit), FHSA-002 ($40,000 lifetime limit) defined in
> `docs/source-of-truth/02-account-types.md`. This rule covers the carry-forward mechanic only.

**Worked Example — (c1a) Annual Absorb**

Scenario: fresh start (carryForwardAvailable=0, lifetimeContributed=0), contribute $8,000.

| Field                 | Value    |
| --------------------- | -------- |
| participationRoom     | 8,000.00 |
| effectiveRoom         | 8,000.00 |
| fhsaContribution      | 8,000.00 |
| overAmount            | 0.00     |
| penalty.fhsa          | 0.00     |
| annualRoomRemaining   | 0.00     |
| carryForwardAvailable | 0.00     |
| lifetimeContributed   | 8,000.00 |

**Worked Example — (c1b) Carry-Forward Absorb**

Scenario: year-0 contribution=$0 (builds carry=$8,000); year-1 contribution=$16,000.

| Year | carryForwardIn | fhsaContribution | participationRoom | overAmount | penalty.fhsa | annualRoomRemaining |
| ---- | -------------- | ---------------- | ----------------- | ---------- | ------------ | ------------------- |
| 0    | 0.00           | 0.00             | 8,000.00          | 0.00       | 0.00         | 8,000.00            |
| 1    | 8,000.00       | 16,000.00        | 16,000.00         | 0.00       | 0.00         | 0.00                |

**Worked Example — (c2) Over-Contribution**

Scenario: year-0 contribution=$0 (carry=$8,000); year-1 contribution=$16,001.

| Field            | Value             |
| ---------------- | ----------------- |
| effectiveRoom    | 16,000.00         |
| fhsaContribution | 16,001.00         |
| overAmount       | 1.00              |
| penalty.fhsa     | 0.12              |
| kind             | over-contribution |

**Worked Example — (c3) Lifetime Cap Exceeded**

Scenario: carryForwardAvailable=0, lifetimeContributed=$36,000, contribute $8,000.

| Field               | Value                 |
| ------------------- | --------------------- |
| lifetimeRemaining   | 4,000.00              |
| effectiveRoom       | 4,000.00              |
| fhsaContribution    | 8,000.00              |
| overAmount          | 4,000.00              |
| penalty.fhsa        | 480.00                |
| kind                | lifetime-cap-exceeded |
| lifetimeContributed | 40,000.00             |

Parity test: `packages/calculation-engine/src/projection/vr-fhsa-carry-001-worked-example.test.ts`

---

## VR-ROOM-PENALTY-001

**Rule:** When contributions exceed available room (plus the $2,000 RRSP buffer), the CRA
1%/month over-contribution penalty applies independently per account type:

```
penalty_account = overAmount_account × 0.01 × 12
```

Each account type's penalty is computed independently in the same ledger year; all three
may fire simultaneously. Each violation also appends one `LedgerWarning` entry to the
return value (MEM001: diagnostics ride on return-value shape, never logged).

**Worked Example — Composite Scenario C**

Scenario: single ledger year 2026, primary `earnedIncome=$100,000`, `pensionAdjustment=0`,
fresh ledger (all prior room = 0).

| Account | Year 2026 Room            | Contribution | Over-Amount | Penalty |
| ------- | ------------------------- | ------------ | ----------- | ------- |
| RRSP    | 18,000.00 + $2,000 buffer | 25,000.00    | 5,000.00    | 600.00  |
| TFSA    | 7,000.00                  | 8,000.00     | 1,000.00    | 120.00  |
| FHSA    | 8,000.00                  | 8,001.00     | 1.00        | 0.12    |

> RRSP buffer: the $2,000 lifetime over-contribution buffer reduces the over-amount
> before the penalty is assessed. Only contributions exceeding `room + $2,000` are penalised.

ledgerWarnings[] for this scenario (3 entries, one per accountType):

| year | person  | accountType | kind              | penaltyAmount |
| ---- | ------- | ----------- | ----------------- | ------------- |
| 2026 | primary | rrsp        | over-contribution | 600.00        |
| 2026 | primary | tfsa        | over-contribution | 120.00        |
| 2026 | primary | fhsa        | over-contribution | 0.12          |

Parity test: `packages/calculation-engine/src/projection/vr-room-penalty-001-worked-example.test.ts`
