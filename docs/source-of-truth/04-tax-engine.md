# 04 - Tax Engine Specification

## Overview

The tax engine is the most critical component of the retirement planning software. It must accurately compute Canadian federal and provincial income taxes, applying all relevant credits, deductions, and special rules.

---

## Federal Tax Brackets (2024)

| Bracket | Income Range        | Marginal Rate |
| ------- | ------------------- | ------------- |
| 1       | $0 - $55,867        | 15.00%        |
| 2       | $55,867 - $111,733  | 20.50%        |
| 3       | $111,733 - $173,205 | 26.00%        |
| 4       | $173,205 - $246,752 | 29.00%        |
| 5       | Over $246,752       | 33.00%        |

**Federal Basic Personal Amount (2024):** $15,705
**Federal Basic Personal Amount (2025):** $16,129 (projected)

---

## Provincial Tax Brackets (2024)

### Ontario

| Bracket | Income Range        | Marginal Rate |
| ------- | ------------------- | ------------- |
| 1       | $0 - $51,446        | 5.05%         |
| 2       | $51,446 - $102,894  | 9.15%         |
| 3       | $102,894 - $150,000 | 11.16%        |
| 4       | $150,000 - $220,000 | 12.16%        |
| 5       | Over $220,000       | 13.16%        |

**Ontario Basic Personal Amount:** $12,399
**Ontario Surtax:** 20% on provincial tax > $5,554; additional 36% on tax > $7,108

### British Columbia

| Bracket | Income Range        | Marginal Rate |
| ------- | ------------------- | ------------- |
| 1       | $0 - $47,937        | 5.06%         |
| 2       | $47,937 - $95,875   | 7.70%         |
| 3       | $95,875 - $110,076  | 10.50%        |
| 4       | $110,076 - $133,664 | 12.29%        |
| 5       | $133,664 - $181,232 | 14.70%        |
| 6       | Over $181,232       | 20.50%        |

**BC Basic Personal Amount:** $12,580

### Alberta

| Bracket | Income Range        | Marginal Rate |
| ------- | ------------------- | ------------- |
| 1       | $0 - $148,269       | 10.00%        |
| 2       | $148,269 - $177,922 | 12.00%        |
| 3       | $177,922 - $237,230 | 13.00%        |
| 4       | $237,230 - $355,845 | 14.00%        |
| 5       | Over $355,845       | 15.00%        |

**Alberta Basic Personal Amount:** $21,003

### Quebec

| Bracket | Income Range        | Marginal Rate |
| ------- | ------------------- | ------------- |
| 1       | $0 - $51,780        | 14.00%        |
| 2       | $51,780 - $103,545  | 19.00%        |
| 3       | $103,545 - $126,000 | 24.00%        |
| 4       | Over $126,000       | 25.75%        |

**Quebec Basic Personal Amount:** $18,056
**Note:** Quebec has separate tax system; federal tax reduced by 16.5% abatement

### Saskatchewan

| Bracket | Income Range       | Marginal Rate |
| ------- | ------------------ | ------------- |
| 1       | $0 - $52,057       | 10.50%        |
| 2       | $52,057 - $148,734 | 12.50%        |
| 3       | Over $148,734      | 14.50%        |

**Saskatchewan Basic Personal Amount:** $18,491

### Manitoba

| Bracket | Income Range       | Marginal Rate |
| ------- | ------------------ | ------------- |
| 1       | $0 - $47,000       | 10.80%        |
| 2       | $47,000 - $100,000 | 12.75%        |
| 3       | Over $100,000      | 17.40%        |

**Manitoba Basic Personal Amount:** $15,780

### Nova Scotia

| Bracket | Income Range       | Marginal Rate |
| ------- | ------------------ | ------------- |
| 1       | $0 - $29,590       | 8.79%         |
| 2       | $29,590 - $59,180  | 14.95%        |
| 3       | $59,180 - $93,000  | 16.67%        |
| 4       | $93,000 - $150,000 | 17.50%        |
| 5       | Over $150,000      | 21.00%        |

**Nova Scotia Basic Personal Amount:** $8,481

### New Brunswick

| Bracket | Income Range       | Marginal Rate |
| ------- | ------------------ | ------------- |
| 1       | $0 - $49,958       | 9.40%         |
| 2       | $49,958 - $99,916  | 14.00%        |
| 3       | $99,916 - $185,064 | 16.00%        |
| 4       | Over $185,064      | 19.50%        |

**New Brunswick Basic Personal Amount:** $13,044

### Prince Edward Island

| Bracket | Income Range        | Marginal Rate |
| ------- | ------------------- | ------------- |
| 1       | $0 - $32,656        | 9.65%         |
| 2       | $32,656 - $64,313   | 13.63%        |
| 3       | $64,313 - $105,000  | 16.65%        |
| 4       | $105,000 - $140,000 | 18.00%        |
| 5       | Over $140,000       | 18.75%        |

**PEI Basic Personal Amount:** $13,500

### Newfoundland and Labrador

| Bracket | Income Range        | Marginal Rate |
| ------- | ------------------- | ------------- |
| 1       | $0 - $43,198        | 8.70%         |
| 2       | $43,198 - $86,395   | 14.50%        |
| 3       | $86,395 - $154,244  | 15.80%        |
| 4       | $154,244 - $215,943 | 17.80%        |
| 5       | $215,943 - $275,870 | 19.80%        |
| 6       | $275,870 - $551,739 | 20.80%        |
| 7       | Over $551,739       | 21.80%        |

**NL Basic Personal Amount:** $10,818

### Big-Three Rule Blocks

Ontario, British Columbia, and Alberta each anchor a K009-shaped rule block
covering the federal+provincial tax computation for a 65+ pension-income
fixture. Each block pairs a Mechanism subsection (citing the shared bracket
tables, age-credit and pension-credit constants, and the
`calculateProvincialTax` callers) with a Worked Example table whose values are
reproduced cent-exactly by
`packages/calculation-engine/src/tax/cra-validation-harness.test.ts`. The
canonical fixture is the same across all three provinces: age 65, $70,000
annual pension income, claim code 1 (basic), no other income or deductions —
identical to the Atlantic/Prairie-North/Quebec fixtures so the harness can
compare all 13 jurisdictions under one canonical input.

```
VR-TAX-PROV-ON-001: Ontario provincial income tax for 2024
IF taxYear == 2024 AND province == 'ON' THEN
  federal tax + provincial tax (brackets, BPA, age credit, pension income credit, Ontario surtax) match CRA PDOC within 1%
  for a 65+ pension-income fixture; the canonical fixture is $70,000 pension income, age 65, claim code 1.
```

#### VR-TAX-PROV-ON-001 Mechanism

- `packages/shared/src/constants/tax-tables.ts` — `ONTARIO_TAX_2024`
  (lines 62–75) supplies the five-bracket table starting at 5.05% with a
  $12,399 basic personal amount; `ONTARIO_SURTAX` (lines 100–105) supplies
  `tier1Threshold: 5554`, `tier1Rate: 0.20`, `tier2Threshold: 7108`,
  `tier2Rate: 0.36`; `AGE_CREDIT_2024.ON` (lines 619–624) supplies
  `ageAmount: 6026`, `incomeThreshold: 44325`, `creditRate: 0.0505`;
  `PENSION_INCOME_CREDIT_2024.ON` (lines 705–708) supplies `maxAmount: 1671`,
  `creditRate: 0.0505`.
- `packages/calculation-engine/src/tax/provincial-tax.ts` —
  `calculateProvincialTax` applies the bracket table, then subtracts credits
  computed by `calculateProvincialAgeCredit` (lines 94–122) and
  `calculateProvincialPensionCredit` (lines 127–147). Ontario has a
  province-specific surtax branch: after net tax is computed,
  `calculateProvincialTax` adds `calculateOntarioSurtax(netTax)` (lines
  238–241 in `provincial-tax.ts`, implementation at lines 60–65 via
  `calculateOntarioSurtax`). Because `ON` is a key of `AGE_CREDIT_2024` and
  `PENSION_INCOME_CREDIT_2024`, the province-specific parameters are used
  directly — not the `0.7 × federal` fallback that applies to provinces
  without an entry.

#### VR-TAX-PROV-ON-001 Worked Example (2024 tax year, Ontario)

Fixture: age 65, province 'ON', $70,000 pension income, no other income/deductions,
basic claim code. CRA PDOC cross-check deferred (autonomous run had no browser
access to apps.cra-arc.gc.ca); the engine-captured values below are the
source-of-truth pin and will be reconciled against PDOC in a follow-up task.

| Field                           | Value      |
| ------------------------------- | ---------- |
| Pension income (input)          | $70,000.00 |
| Federal tax (net of credits)    | $7,880.75  |
| Provincial tax (net of credits) | $3,475.35  |
| Total tax                       | $11,356.11 |

Parity: every row of this VR-TAX-PROV-ON-001 Worked Example is reproduced to the
cent by
`packages/calculation-engine/src/tax/cra-validation-harness.test.ts`.
Drift between the engine (federal BPA $15,705, ON BPA $12,399, ON age amount
$6,026, ON pension credit rate 5.05%, ON surtax tiers $5,554 / $7,108 at
20% / 36%) and this table will fail that test with expected-vs-actual cents
on the drifting row.

```
VR-TAX-PROV-BC-001: British Columbia provincial income tax for 2024
IF taxYear == 2024 AND province == 'BC' THEN
  federal tax + provincial tax (brackets, BPA, age credit, pension income credit) match CRA PDOC within 1%
  for a 65+ pension-income fixture; the canonical fixture is $70,000 pension income, age 65, claim code 1.
```

#### VR-TAX-PROV-BC-001 Mechanism

- `packages/shared/src/constants/tax-tables.ts` — `BC_TAX_2024`
  (lines 111–125) supplies the six-bracket table starting at 5.06% with a
  $12,580 basic personal amount; `AGE_CREDIT_2024.BC` (lines 625–630)
  supplies `ageAmount: 6090`, `incomeThreshold: 42723`, `creditRate: 0.0506`;
  `PENSION_INCOME_CREDIT_2024.BC` (lines 709–712) supplies `maxAmount: 1000`,
  `creditRate: 0.0506`.
- `packages/calculation-engine/src/tax/provincial-tax.ts` —
  `calculateProvincialTax` applies the bracket table, then subtracts credits
  computed by `calculateProvincialAgeCredit` (lines 94–122) and
  `calculateProvincialPensionCredit` (lines 127–147). Because `BC` is a key
  of `AGE_CREDIT_2024` and `PENSION_INCOME_CREDIT_2024`, the
  province-specific parameters are used directly — not the `0.7 × federal`
  fallback that applies to provinces without an entry. British Columbia has
  no province-specific surtax branch in `calculateProvincialTax` — the
  surtax branch at lines 238–241 applies only to `province === 'ON'`; BC
  returns `max(0, taxBeforeCredits − credits)` unaltered.

#### VR-TAX-PROV-BC-001 Worked Example (2024 tax year, British Columbia)

Fixture: age 65, province 'BC', $70,000 pension income, no other income/deductions,
basic claim code. CRA PDOC cross-check deferred (autonomous run had no browser
access to apps.cra-arc.gc.ca); the engine-captured values below are the
source-of-truth pin and will be reconciled against PDOC in a follow-up task.

| Field                           | Value      |
| ------------------------------- | ---------- |
| Pension income (input)          | $70,000.00 |
| Federal tax (net of credits)    | $7,880.75  |
| Provincial tax (net of credits) | $3,336.19  |
| Total tax                       | $11,216.95 |

Parity: every row of this VR-TAX-PROV-BC-001 Worked Example is reproduced to the
cent by
`packages/calculation-engine/src/tax/cra-validation-harness.test.ts`.
Drift between the engine (federal BPA $15,705, BC BPA $12,580, BC age amount
$6,090, BC pension credit rate 5.06%) and this table will fail that test with
expected-vs-actual cents on the drifting row.

```
VR-TAX-PROV-AB-001: Alberta provincial income tax for 2024
IF taxYear == 2024 AND province == 'AB' THEN
  federal tax + provincial tax (brackets, BPA, age credit, pension income credit) match CRA PDOC within 1%
  for a 65+ pension-income fixture; the canonical fixture is $70,000 pension income, age 65, claim code 1.
```

#### VR-TAX-PROV-AB-001 Mechanism

- `packages/shared/src/constants/tax-tables.ts` — `ALBERTA_TAX_2024`
  (lines 151–164) supplies the five-bracket table starting at 10.00% with a
  $21,003 basic personal amount (the highest provincial BPA in Canada for
  2024). Alberta has **no** entry in `AGE_CREDIT_2024` (keys present:
  federal/ON/BC/NL/NS/NB/PE/MB/SK/YT/NT/NU — AB is absent) and **no** entry
  in `PENSION_INCOME_CREDIT_2024`; both credits therefore fall through to
  the `0.7 × federal` approximation branch in `calculateProvincialAgeCredit`
  (lines 108–118) and the `maxAmount: 1000` generic branch in
  `calculateProvincialPensionCredit` (lines 141–147), each multiplied by
  `getProvincialCreditRate('AB')` (the 10% lowest-bracket rate).
- `packages/calculation-engine/src/tax/provincial-tax.ts` —
  `calculateProvincialTax` applies the bracket table, then subtracts credits
  computed by `calculateProvincialAgeCredit` (lines 94–122) and
  `calculateProvincialPensionCredit` (lines 127–147). Alberta has no
  province-specific surtax branch in `calculateProvincialTax` — the surtax
  branch at lines 238–241 applies only to `province === 'ON'`; AB returns
  `max(0, taxBeforeCredits − credits)` unaltered.

#### VR-TAX-PROV-AB-001 Worked Example (2024 tax year, Alberta)

Fixture: age 65, province 'AB', $70,000 pension income, no other income/deductions,
basic claim code. CRA PDOC cross-check deferred (autonomous run had no browser
access to apps.cra-arc.gc.ca); the engine-captured values below are the
source-of-truth pin and will be reconciled against PDOC in a follow-up task.

| Field                           | Value      |
| ------------------------------- | ---------- |
| Pension income (input)          | $70,000.00 |
| Federal tax (net of credits)    | $7,880.75  |
| Provincial tax (net of credits) | $4,453.99  |
| Total tax                       | $12,334.74 |

Parity: every row of this VR-TAX-PROV-AB-001 Worked Example is reproduced to the
cent by
`packages/calculation-engine/src/tax/cra-validation-harness.test.ts`.
Drift between the engine (federal BPA $15,705, AB BPA $21,003, AB age credit
via `0.7 × federal` fallback at 10% provincial rate, AB pension credit via
generic $1,000 cap at 10% provincial rate) and this table will fail that test
with expected-vs-actual cents on the drifting row.

### Provincial Rule Blocks

The four Atlantic provinces each anchor a K009-shaped rule block covering the
federal+provincial tax computation for a 65+ pension-income fixture. Each block
pairs a Mechanism subsection (citing the shared bracket tables, age-credit and
pension-credit constants, and the `calculateProvincialTax` callers) with a
Worked Example table whose values are reproduced cent-exactly by
`packages/calculation-engine/src/tax/atlantic-provinces-worked-example.test.ts`.
The canonical fixture is the same across all four provinces: age 65, $70,000
annual pension income, claim code 1 (basic), no other income or deductions.

```
VR-TAX-PROV-NL-001: Newfoundland and Labrador provincial income tax for 2024
IF taxYear == 2024 AND province == 'NL' THEN
  federal tax + provincial tax (brackets, BPA, age credit, pension income credit) match CRA PDOC within 1%
  for a 65+ pension-income fixture; the canonical fixture is $70,000 pension income, age 65, claim code 1.
```

#### VR-TAX-PROV-NL-001 Mechanism

- `packages/shared/src/constants/tax-tables.ts` — `NEWFOUNDLAND_TAX_2024`
  (lines 303–318) supplies the seven-bracket table starting at 8.70% with a
  $10,818 basic personal amount; `AGE_CREDIT_2024.NL` (lines 631–636) supplies
  `ageAmount: 6905`, `incomeThreshold: 37842`, `creditRate: 0.087`;
  `PENSION_INCOME_CREDIT_2024.NL` (lines 677–680) supplies `maxAmount: 1000`,
  `creditRate: 0.087`.
- `packages/calculation-engine/src/tax/provincial-tax.ts` —
  `calculateProvincialTax` applies the bracket table, then subtracts credits
  computed by `calculateProvincialAgeCredit` (lines 94–122) and
  `calculateProvincialPensionCredit` (lines 127–147). Because `NL` is a key of
  `AGE_CREDIT_2024`, the province-specific parameters are used directly — not
  the `0.7 × federal` fallback that applies to provinces without an entry.

#### VR-TAX-PROV-NL-001 Worked Example (2024 tax year, Newfoundland and Labrador)

Fixture: age 65, province 'NL', $70,000 pension income, no other income/deductions,
basic claim code. CRA PDOC cross-check deferred (autonomous run had no browser
access to apps.cra-arc.gc.ca); the engine-captured values below are the
source-of-truth pin and will be reconciled against PDOC in a follow-up task.

| Field                           | Value      |
| ------------------------------- | ---------- |
| Pension income (input)          | $70,000.00 |
| Federal tax (net of credits)    | $7,880.75  |
| Provincial tax (net of credits) | $6,435.28  |
| Total tax                       | $14,316.03 |

Parity: every row of this VR-TAX-PROV-NL-001 Worked Example is reproduced to the
cent by
`packages/calculation-engine/src/tax/atlantic-provinces-worked-example.test.ts`.
Drift between the engine (federal BPA $15,705, NL BPA $10,818, NL age amount
$6,905, NL pension credit rate 8.70%) and this table will fail that test with
expected-vs-actual cents on the drifting row.

```
VR-TAX-PROV-NS-001: Nova Scotia provincial income tax for 2024
IF taxYear == 2024 AND province == 'NS' THEN
  federal tax + provincial tax (brackets, BPA, age credit, pension income credit) match CRA PDOC within 1%
  for a 65+ pension-income fixture; the canonical fixture is $70,000 pension income, age 65, claim code 1.
```

#### VR-TAX-PROV-NS-001 Mechanism

- `packages/shared/src/constants/tax-tables.ts` — `NOVA_SCOTIA_TAX_2024`
  (lines 247–260) supplies the five-bracket table starting at 8.79% with an
  $8,481 basic personal amount; `AGE_CREDIT_2024.NS` (lines 637–644) supplies
  `ageAmount: 4141`, `incomeThreshold: 30828`, `creditRate: 0.0879`;
  `PENSION_INCOME_CREDIT_2024.NS` (lines 681–684) supplies `maxAmount: 1173`,
  `creditRate: 0.0879`.
- `packages/calculation-engine/src/tax/provincial-tax.ts` — same dispatch as
  NL: `calculateProvincialTax` → `calculateProvincialAgeCredit` (lines 94–122)
  → `calculateProvincialPensionCredit` (lines 127–147). Province-specific
  parameters are used directly, not the `0.7 × federal` fallback.
- NS note: the `ageAmount: 4141` value combines the 2024-only Nova Scotia
  low-income age supplement ($1,465) with the $2,676 base age amount. The
  supplement was eliminated for 2025; the 2025 NS age amount reverts to a
  $5,734 base and this line must be re-derived, not copied, for
  `AGE_CREDIT_2025`.

#### VR-TAX-PROV-NS-001 Worked Example (2024 tax year, Nova Scotia)

Fixture: age 65, province 'NS', $70,000 pension income, no other income/deductions,
basic claim code. CRA PDOC cross-check deferred (autonomous run had no browser
access to apps.cra-arc.gc.ca); the engine-captured values below are the
source-of-truth pin and will be reconciled against PDOC in a follow-up task.

| Field                           | Value      |
| ------------------------------- | ---------- |
| Pension income (input)          | $70,000.00 |
| Federal tax (net of credits)    | $7,880.75  |
| Provincial tax (net of credits) | $7,979.77  |
| Total tax                       | $15,860.53 |

Parity: every row of this VR-TAX-PROV-NS-001 Worked Example is reproduced to the
cent by
`packages/calculation-engine/src/tax/atlantic-provinces-worked-example.test.ts`.
Drift between the engine (federal BPA $15,705, NS BPA $8,481, NS age amount
$4,141 including the 2024-only supplement, NS pension credit $1,173) and this
table will fail that test with expected-vs-actual cents on the drifting row.

```
VR-TAX-PROV-NB-001: New Brunswick provincial income tax for 2024
IF taxYear == 2024 AND province == 'NB' THEN
  federal tax + provincial tax (brackets, BPA, age credit, pension income credit) match CRA PDOC within 1%
  for a 65+ pension-income fixture; the canonical fixture is $70,000 pension income, age 65, claim code 1.
```

#### VR-TAX-PROV-NB-001 Mechanism

- `packages/shared/src/constants/tax-tables.ts` — `NEW_BRUNSWICK_TAX_2024`
  (lines 266–278) supplies the four-bracket table starting at 9.40% with a
  $13,044 basic personal amount; `AGE_CREDIT_2024.NB` (lines 645–650) supplies
  `ageAmount: 5878`, `incomeThreshold: 43763`, `creditRate: 0.094`;
  `PENSION_INCOME_CREDIT_2024.NB` (lines 685–688) supplies `maxAmount: 1000`,
  `creditRate: 0.094`.
- `packages/calculation-engine/src/tax/provincial-tax.ts` — same dispatch as
  NL/NS: `calculateProvincialTax` → `calculateProvincialAgeCredit`
  (lines 94–122) → `calculateProvincialPensionCredit` (lines 127–147).
  Province-specific parameters are used directly, not the `0.7 × federal`
  fallback.

#### VR-TAX-PROV-NB-001 Worked Example (2024 tax year, New Brunswick)

Fixture: age 65, province 'NB', $70,000 pension income, no other income/deductions,
basic claim code. CRA PDOC cross-check deferred (autonomous run had no browser
access to apps.cra-arc.gc.ca); the engine-captured values below are the
source-of-truth pin and will be reconciled against PDOC in a follow-up task.

| Field                           | Value      |
| ------------------------------- | ---------- |
| Pension income (input)          | $70,000.00 |
| Federal tax (net of credits)    | $7,880.75  |
| Provincial tax (net of credits) | $5,999.21  |
| Total tax                       | $13,879.96 |

Parity: every row of this VR-TAX-PROV-NB-001 Worked Example is reproduced to the
cent by
`packages/calculation-engine/src/tax/atlantic-provinces-worked-example.test.ts`.
Drift between the engine (federal BPA $15,705, NB BPA $13,044, NB age amount
$5,878, NB pension credit rate 9.40%) and this table will fail that test with
expected-vs-actual cents on the drifting row.

```
VR-TAX-PROV-PE-001: Prince Edward Island provincial income tax for 2024
IF taxYear == 2024 AND province == 'PE' THEN
  federal tax + provincial tax (brackets, BPA, age credit, pension income credit) match CRA PDOC within 1%
  for a 65+ pension-income fixture; the canonical fixture is $70,000 pension income, age 65, claim code 1.
```

#### VR-TAX-PROV-PE-001 Mechanism

- `packages/shared/src/constants/tax-tables.ts` — `PEI_TAX_2024` (lines
  284–297) supplies the five-bracket table starting at 9.65% with a $13,500
  basic personal amount; `AGE_CREDIT_2024.PE` (lines 651–656) supplies
  `ageAmount: 5595`, `incomeThreshold: 33740`, `creditRate: 0.0965`;
  `PENSION_INCOME_CREDIT_2024.PE` (lines 689–692) supplies `maxAmount: 1000`,
  `creditRate: 0.0965`.
- `packages/calculation-engine/src/tax/provincial-tax.ts` — same dispatch as
  NL/NS/NB: `calculateProvincialTax` → `calculateProvincialAgeCredit`
  (lines 94–122) → `calculateProvincialPensionCredit` (lines 127–147).
  Province-specific parameters are used directly, not the `0.7 × federal`
  fallback.
- PE note: PEI's historical 10% surtax on provincial tax above $12,500 was
  eliminated effective the 2024 tax year (EY Tax Alert 2023 Issue No. 22), so
  `calculateProvincialTax` does not apply a PEI surtax branch. The 2024 PEI
  bracket table above replaces the previous two-bracket surtax-bearing schedule.

#### VR-TAX-PROV-PE-001 Worked Example (2024 tax year, Prince Edward Island)

Fixture: age 65, province 'PE', $70,000 pension income, no other income/deductions,
basic claim code. CRA PDOC cross-check deferred (autonomous run had no browser
access to apps.cra-arc.gc.ca); the engine-captured values below are the
source-of-truth pin and will be reconciled against PDOC in a follow-up task.

| Field                           | Value      |
| ------------------------------- | ---------- |
| Pension income (input)          | $70,000.00 |
| Federal tax (net of credits)    | $7,880.75  |
| Provincial tax (net of credits) | $6,998.73  |
| Total tax                       | $14,879.49 |

Parity: every row of this VR-TAX-PROV-PE-001 Worked Example is reproduced to the
cent by
`packages/calculation-engine/src/tax/atlantic-provinces-worked-example.test.ts`.
Drift between the engine (federal BPA $15,705, PE BPA $13,500, PE age amount
$5,595, PE pension credit rate 9.65%, no surtax branch) and this table will fail
that test with expected-vs-actual cents on the drifting row.

### Prairie-North Rule Blocks

The three Prairie provinces (Manitoba, Saskatchewan) and three Northern
territories (Yukon, Northwest Territories, Nunavut) each anchor a K009-shaped
rule block mirroring the Atlantic pattern above. Each block pairs a Mechanism
subsection (citing the shared bracket tables, age-credit and pension-credit
constants, and the `calculateProvincialTax` callers) with a Worked Example table
whose values are reproduced cent-exactly by
`packages/calculation-engine/src/tax/prairie-north-worked-example.test.ts`. The
canonical fixture is identical to the Atlantic blocks: age 65, $70,000 annual
pension income, claim code 1 (basic), no other income or deductions.

```
VR-TAX-PROV-MB-001: Manitoba provincial income tax for 2024
IF taxYear == 2024 AND province == 'MB' THEN
  federal tax + provincial tax (brackets, BPA, age credit, pension income credit) match CRA PDOC within 1%
  for a 65+ pension-income fixture; the canonical fixture is $70,000 pension income, age 65, claim code 1.
```

#### VR-TAX-PROV-MB-001 Mechanism

- `packages/shared/src/constants/tax-tables.ts` — `MANITOBA_TAX_2024`
  (lines 230–241) supplies the three-bracket table starting at 10.80% with a
  $15,780 basic personal amount; `AGE_CREDIT_2024.MB` (lines 657–662) supplies
  `ageAmount: 3728`, `incomeThreshold: 27749`, `creditRate: 0.108`;
  `PENSION_INCOME_CREDIT_2024.MB` (lines 729–732) supplies `maxAmount: 1000`,
  `creditRate: 0.108`.
- `packages/calculation-engine/src/tax/provincial-tax.ts` — same dispatch as the
  Atlantic blocks: `calculateProvincialTax` applies the bracket table, then
  subtracts credits computed by `calculateProvincialAgeCredit` (lines 94–122)
  and `calculateProvincialPensionCredit` (lines 127–147). Because `MB` is a key
  of `AGE_CREDIT_2024`, the province-specific parameters are used directly —
  not the `0.7 × federal` fallback that applies to provinces without an entry.

#### VR-TAX-PROV-MB-001 Worked Example (2024 tax year, Manitoba)

Fixture: age 65, province 'MB', $70,000 pension income, no other income/deductions,
basic claim code. CRA PDOC cross-check deferred (autonomous run had no browser
access to apps.cra-arc.gc.ca); the engine-captured values below are the
source-of-truth pin and will be reconciled against PDOC in a follow-up task.

| Field                           | Value      |
| ------------------------------- | ---------- |
| Pension income (input)          | $70,000.00 |
| Federal tax (net of credits)    | $7,880.75  |
| Provincial tax (net of credits) | $6,196.26  |
| Total tax                       | $14,077.01 |

Parity: every row of this VR-TAX-PROV-MB-001 Worked Example is reproduced to the
cent by
`packages/calculation-engine/src/tax/prairie-north-worked-example.test.ts`.
Drift between the engine (federal BPA $15,705, MB BPA $15,780, MB age amount
$3,728, MB pension credit rate 10.80%) and this table will fail that test with
expected-vs-actual cents on the drifting row.

```
VR-TAX-PROV-SK-001: Saskatchewan provincial income tax for 2024
IF taxYear == 2024 AND province == 'SK' THEN
  federal tax + provincial tax (brackets, BPA, age credit, pension income credit) match CRA PDOC within 1%
  for a 65+ pension-income fixture; the canonical fixture is $70,000 pension income, age 65, claim code 1.
```

#### VR-TAX-PROV-SK-001 Mechanism

- `packages/shared/src/constants/tax-tables.ts` — `SASKATCHEWAN_TAX_2024`
  (lines 213–224) supplies the three-bracket table starting at 10.50% with a
  $18,491 basic personal amount; `AGE_CREDIT_2024.SK` (lines 663–669) supplies
  `ageAmount: 5633`, `incomeThreshold: 41933`, `creditRate: 0.105`;
  `PENSION_INCOME_CREDIT_2024.SK` (lines 733–736) supplies `maxAmount: 1000`,
  `creditRate: 0.105`.
- `packages/calculation-engine/src/tax/provincial-tax.ts` — same dispatch as
  MB: `calculateProvincialTax` → `calculateProvincialAgeCredit` (lines 94–122)
  → `calculateProvincialPensionCredit` (lines 127–147). Province-specific
  parameters are used directly, not the `0.7 × federal` fallback.
- SK note: the `ageAmount: 5633` value was derived from the 2024 CRA-mirror
  TD1SK table cross-checked against an indexation pass (5380 × 1.047 ≈ 5633).
  T01 preferred this over the $5,380 / $40,051 prep values because those were
  2023 numbers; the inline source comment in `AGE_CREDIT_2024.SK` records the
  cross-check.

#### VR-TAX-PROV-SK-001 Worked Example (2024 tax year, Saskatchewan)

Fixture: age 65, province 'SK', $70,000 pension income, no other income/deductions,
basic claim code. CRA PDOC cross-check deferred (autonomous run had no browser
access to apps.cra-arc.gc.ca); the engine-captured values below are the
source-of-truth pin and will be reconciled against PDOC in a follow-up task.

| Field                           | Value      |
| ------------------------------- | ---------- |
| Pension income (input)          | $70,000.00 |
| Federal tax (net of credits)    | $7,880.75  |
| Provincial tax (net of credits) | $5,512.90  |
| Total tax                       | $13,393.65 |

Parity: every row of this VR-TAX-PROV-SK-001 Worked Example is reproduced to the
cent by
`packages/calculation-engine/src/tax/prairie-north-worked-example.test.ts`.
Drift between the engine (federal BPA $15,705, SK BPA $18,491, SK age amount
$5,633, SK pension credit rate 10.50%) and this table will fail that test with
expected-vs-actual cents on the drifting row.

```
VR-TAX-PROV-YT-001: Yukon territorial income tax for 2024
IF taxYear == 2024 AND province == 'YT' THEN
  federal tax + territorial tax (brackets, BPA, age credit, pension income credit) match CRA PDOC within 1%
  for a 65+ pension-income fixture; the canonical fixture is $70,000 pension income, age 65, claim code 1.
```

#### VR-TAX-PROV-YT-001 Mechanism

- `packages/shared/src/constants/tax-tables.ts` — `YUKON_TAX_2024`
  (lines 324–337) supplies the five-bracket table starting at 6.40% with a
  $15,705 basic personal amount (federally-matching); `AGE_CREDIT_2024.YT`
  (lines 670–676) supplies `ageAmount: 8790`, `incomeThreshold: 44325`,
  `creditRate: 0.064`; `PENSION_INCOME_CREDIT_2024.YT` (lines 737–741) supplies
  `maxAmount: 2000`, `creditRate: 0.064`.
- `packages/calculation-engine/src/tax/provincial-tax.ts` — same dispatch as
  the Prairie blocks: `calculateProvincialTax` → `calculateProvincialAgeCredit`
  (lines 94–122) → `calculateProvincialPensionCredit` (lines 127–147).
  Territory-specific parameters are used directly, not the `0.7 × federal`
  fallback.
- YT note: Yukon's non-refundable credit parameters (age amount $8,790, pension
  amount $2,000, age threshold $44,325) track federal values — the YT key in
  `AGE_CREDIT_2024` supplies the federally-matching numbers rather than the
  `0.7 × federal` fallback of $6,153 that would otherwise apply. An inline
  source comment in `AGE_CREDIT_2024.YT` records this alignment.

#### VR-TAX-PROV-YT-001 Worked Example (2024 tax year, Yukon)

Fixture: age 65, province 'YT', $70,000 pension income, no other income/deductions,
basic claim code. CRA PDOC cross-check deferred (autonomous run had no browser
access to apps.cra-arc.gc.ca); the engine-captured values below are the
source-of-truth pin and will be reconciled against PDOC in a follow-up task.

| Field                           | Value      |
| ------------------------------- | ---------- |
| Pension income (input)          | $70,000.00 |
| Federal tax (net of credits)    | $7,880.75  |
| Provincial tax (net of credits) | $3,398.26  |
| Total tax                       | $11,279.01 |

Parity: every row of this VR-TAX-PROV-YT-001 Worked Example is reproduced to the
cent by
`packages/calculation-engine/src/tax/prairie-north-worked-example.test.ts`.
Drift between the engine (federal BPA $15,705, YT BPA $15,705, YT age amount
$8,790 federally-matching, YT pension amount $2,000 federally-matching, YT
lowest rate 6.40%) and this table will fail that test with expected-vs-actual
cents on the drifting row.

```
VR-TAX-PROV-NT-001: Northwest Territories territorial income tax for 2024
IF taxYear == 2024 AND province == 'NT' THEN
  federal tax + territorial tax (brackets, BPA, age credit, pension income credit) match CRA PDOC within 1%
  for a 65+ pension-income fixture; the canonical fixture is $70,000 pension income, age 65, claim code 1.
```

#### VR-TAX-PROV-NT-001 Mechanism

- `packages/shared/src/constants/tax-tables.ts` — `NWT_TAX_2024`
  (lines 343–355) supplies the four-bracket table starting at 5.90% with a
  $16,593 basic personal amount; `AGE_CREDIT_2024.NT` (lines 677–684) supplies
  `ageAmount: 8498`, `incomeThreshold: 44324`, `creditRate: 0.059`;
  `PENSION_INCOME_CREDIT_2024.NT` (lines 742–745) supplies `maxAmount: 1000`,
  `creditRate: 0.059`.
- `packages/calculation-engine/src/tax/provincial-tax.ts` — same dispatch as
  the Prairie blocks: `calculateProvincialTax` → `calculateProvincialAgeCredit`
  (lines 94–122) → `calculateProvincialPensionCredit` (lines 127–147).
  Territory-specific parameters are used directly, not the `0.7 × federal`
  fallback.
- NT note: `ageAmount: 8498` is single-source (TaxTips.ca 2024 base credits
  table) because CRA 5012-PC blocks automated fetch in the autonomous
  execution environment. The indexation pattern and NT lowest-rate alignment
  (5.90%) were corroborated; an inline source comment in `AGE_CREDIT_2024.NT`
  records the single-source caveat so a follow-up PDOC pass can re-verify.

#### VR-TAX-PROV-NT-001 Worked Example (2024 tax year, Northwest Territories)

Fixture: age 65, province 'NT', $70,000 pension income, no other income/deductions,
basic claim code. CRA PDOC cross-check deferred (autonomous run had no browser
access to apps.cra-arc.gc.ca); the engine-captured values below are the
source-of-truth pin and will be reconciled against PDOC in a follow-up task.

| Field                           | Value      |
| ------------------------------- | ---------- |
| Pension income (input)          | $70,000.00 |
| Federal tax (net of credits)    | $7,880.75  |
| Provincial tax (net of credits) | $3,341.74  |
| Total tax                       | $11,222.50 |

Parity: every row of this VR-TAX-PROV-NT-001 Worked Example is reproduced to the
cent by
`packages/calculation-engine/src/tax/prairie-north-worked-example.test.ts`.
Drift between the engine (federal BPA $15,705, NT BPA $16,593, NT age amount
$8,498 single-source, NT pension credit rate 5.90%) and this table will fail
that test with expected-vs-actual cents on the drifting row.

```
VR-TAX-PROV-NU-001: Nunavut territorial income tax for 2024
IF taxYear == 2024 AND province == 'NU' THEN
  federal tax + territorial tax (brackets, BPA, age credit, pension income credit) match CRA PDOC within 1%
  for a 65+ pension-income fixture; the canonical fixture is $70,000 pension income, age 65, claim code 1.
```

#### VR-TAX-PROV-NU-001 Mechanism

- `packages/shared/src/constants/tax-tables.ts` — `NUNAVUT_TAX_2024`
  (lines 361–373) supplies the four-bracket table starting at 4.00% with a
  $17,925 basic personal amount; `AGE_CREDIT_2024.NU` (lines 685–692) supplies
  `ageAmount: 11980`, `incomeThreshold: 44325`, `creditRate: 0.04`;
  `PENSION_INCOME_CREDIT_2024.NU` (lines 746–750) supplies `maxAmount: 2000`,
  `creditRate: 0.04`.
- `packages/calculation-engine/src/tax/provincial-tax.ts` — same dispatch as
  the Prairie blocks: `calculateProvincialTax` → `calculateProvincialAgeCredit`
  (lines 94–122) → `calculateProvincialPensionCredit` (lines 127–147).
  Territory-specific parameters are used directly, not the `0.7 × federal`
  fallback.
- NU note: Nunavut's 2024 age amount ($11,980) is the highest of any Canadian
  jurisdiction, reflecting the northern cost-of-living adjustment; the pension
  amount ($2,000) matches federal. Like NT, the age amount is single-source
  (TaxTips.ca) because CRA 5014-PC blocks automated fetch — an inline source
  comment in `AGE_CREDIT_2024.NU` records the single-source caveat.

#### VR-TAX-PROV-NU-001 Worked Example (2024 tax year, Nunavut)

Fixture: age 65, province 'NU', $70,000 pension income, no other income/deductions,
basic claim code. CRA PDOC cross-check deferred (autonomous run had no browser
access to apps.cra-arc.gc.ca); the engine-captured values below are the
source-of-truth pin and will be reconciled against PDOC in a follow-up task.

| Field                           | Value      |
| ------------------------------- | ---------- |
| Pension income (input)          | $70,000.00 |
| Federal tax (net of credits)    | $7,880.75  |
| Provincial tax (net of credits) | $2,179.81  |
| Total tax                       | $10,060.56 |

Parity: every row of this VR-TAX-PROV-NU-001 Worked Example is reproduced to the
cent by
`packages/calculation-engine/src/tax/prairie-north-worked-example.test.ts`.
Drift between the engine (federal BPA $15,705, NU BPA $17,925, NU age amount
$11,980 highest-in-Canada single-source, NU pension amount $2,000
federally-matching, NU lowest rate 4.00%) and this table will fail that test
with expected-vs-actual cents on the drifting row.

### Quebec Rule Block

Quebec is structurally unique in Canadian income tax: a dedicated provincial
Revenu Québec administration, the 16.5% refundable federal abatement under ITA
s.120(2), and the combined AREL credit (TP-752.0.14) which folds the age
amount and retirement-income amount into a single provincial non-refundable
credit. The two rule blocks below pin this divergence: VR-TAX-PROV-QC-001 for
the full tax pipeline and VR-BEN-QPP-001 for QPP/CPP benefit parity. The
canonical fixture remains age 65, $70,000 annual pension income, claim code 1,
no other income or deductions.

```
VR-TAX-PROV-QC-001: Quebec 2024 provincial income tax with combined AREL credit and federal abatement
produces totalTax within 1% of Revenu Québec canonical computation for a 65+/$70K pension fixture.
```

#### VR-TAX-PROV-QC-001 Mechanism

- `packages/shared/src/constants/tax-tables.ts` — `QUEBEC_TAX_2024`
  (lines 189–201) supplies the four-bracket table starting at 14.00% with an
  $18,056 basic personal amount; `QUEBEC_FEDERAL_ABATEMENT` (line 207)
  supplies the 16.5% refundable abatement constant; `AREL_2024` (lines 780+)
  supplies the combined age-amount + retirement-income-amount parameters
  (T01 of this slice).
- `packages/calculation-engine/src/tax/provincial-tax.ts` —
  `calculateQuebecAREL` (line 168) computes the combined credit, invoked from
  the QC branch inside `calculateProvincialNonRefundableCredits`
  (lines 190–204). Lines 101 and 135 explicitly short-circuit the standard
  age-credit and pension-credit paths for Quebec because both are folded into
  AREL — callers must never double-count.
- `packages/calculation-engine/src/tax/federal-tax.ts` —
  `calculateFederalTax` applies the 16.5% Quebec abatement at lines 182–185
  (`netTax = netTax * (1 - 0.165)`), folding it into the single
  `federalTaxGross` return field before provincial tax is added.
- Living-alone AREL component is deferred: no `maritalStatus` / `livesAlone`
  input exists on `TaxCalculationInput` yet, so AREL currently uses the
  age + retirement-income components only. Flagged as a pre-M003-close
  follow-up by T01.
- Revenu Québec PDOC cross-check is deferred: the autonomous execution that
  pinned these values had no browser access to apps.cra-arc.gc.ca or
  revenuquebec.ca. The engine-captured values below are the source-of-truth
  pin per the slice plan's contingency clause; a follow-up PDOC + RQ
  reconciliation will confirm Quebec stays within the 1% slice acceptance
  bar.

#### VR-TAX-PROV-QC-001 Worked Example (2024 tax year, Quebec)

Fixture: age 65, province 'QC', $70,000 pension income, no other
income/deductions, basic claim code. The abatement row is split out
explicitly (one more row than non-QC blocks) so drift between the engine and
this table is attributable to a specific pipeline stage. CRA PDOC + Revenu
Québec cross-check deferred per the Mechanism note above.

| Field                              | Value      |
| ---------------------------------- | ---------- |
| Pension income (input)             | $70,000.00 |
| Federal tax (gross of abatement)   | $7,880.75  |
| Quebec abatement (−16.5%)          | −$1,300.32 |
| Federal tax (net of abatement)     | $6,580.43  |
| Provincial tax (net of AREL + BPA) | $8,070.01  |
| Total tax                          | $14,650.44 |

Parity: every row of this VR-TAX-PROV-QC-001 Worked Example is reproduced to
the cent by
`packages/calculation-engine/src/tax/quebec-worked-example.test.ts`. Drift
between the engine (federal BPA $15,705, QC BPA $18,056, AREL combined
age+retirement-income credit at 14.00%, Quebec abatement 16.5%) and this
table will fail that test with expected-vs-actual cents on the drifting row.
The K014 federal-uniformity guard also asserts that the engine's
post-abatement `federalTaxGross` of $6,580.43 algebraically recovers the
12-jurisdiction shared pre-abatement value of $7,880.75 (6580.4283 / 0.835 =
7880.7525), catching any QC-specific input that leaks into the federal side
before provincial tax is applied.

```
VR-BEN-QPP-001: QPP retirement benefit equals CPP retirement benefit at RRQ 2024 maximum rates
and identical adjustment factors; the `isQPP` label distinguishes jurisdiction for display
while benefit math is shared.
```

#### VR-BEN-QPP-001 Mechanism

- `packages/shared/src/constants/rates.ts` — `BENEFIT_AMOUNTS_2024.cpp`
  (lines 113–117) supplies `maxMonthlyAt65: 1364.6`, `maxAnnualAt65: 16375`,
  `averageMonthly: 815`. RRQ 2024 maximum matches the CRA/Service Canada 2024
  CPP maximum to the dollar; the engine intentionally uses a single shared
  constant rather than duplicating into a separate `qpp` key.
- `packages/shared/src/types/benefits.ts` — `CPP_ADJUSTMENT_FACTORS`
  (lines 52–54) supplies `EARLY_REDUCTION_PER_MONTH: 0.006` (0.6% per month
  before age 65) and `LATE_INCREASE_PER_MONTH: 0.007` (0.7% per month after
  age 65). RRQ 2024 uses the identical table, so the `calculateCPPBenefit`
  adjustment path is shared.
- `packages/calculation-engine/src/benefits/cpp.ts` —
  `calculateCPPBenefit` (lines 43–46) applies the adjustment factor;
  `indexCPPBenefit` (lines 52–54) applies inflation indexing from the start
  age. Both functions are province-agnostic.
- `packages/calculation-engine/src/benefits/index.ts` — `calculateCPP...`
  branch around line 98 sets `isQPP: isQuebec` on the returned `CPPBenefit`
  record. This is the _only_ jurisdiction-differentiating signal in the
  benefit payload; `adjustedAmount`, `estimatedAmountAt65`, and `startAge`
  are identical across QC and non-QC inputs given identical parameters.
- **Out of scope:** QPP survivor-benefit formula divergence. Per
  `docs/source-of-truth/05-government-benefits.md:260` ("Survivor benefits:
  Slightly different calculation"), retirement-benefit parity does not
  extend to survivor benefits — QPP survivor math is tracked separately and
  not asserted by VR-BEN-QPP-001.

#### VR-BEN-QPP-001 Worked Example (2024 tax year, Quebec/Ontario)

Fixture: age 65, $16,375 expectedCPPAt65, cppStartAge 65, yearsOfResidence 40,
inflationRate 0, yearsFromStart 0. Two invocations: `isQuebec: true` (QC)
and `isQuebec: false` (non-QC). The adjustedAmount and totalAnnual must match
to 4 decimals; only the `isQPP` label flips.

| Field                                    | Value      |
| ---------------------------------------- | ---------- |
| Expected CPP/QPP at 65 (input)           | $16,375.00 |
| startAge                                 | 65         |
| Adjustment factor                        | 1.0        |
| adjustedAmount                           | $16,375.00 |
| isQPP (QC fixture `isQuebec: true`)      | `true`     |
| isQPP (non-QC fixture `isQuebec: false`) | `false`    |

Parity: every row of this VR-BEN-QPP-001 Worked Example is reproduced to the
cent by the two QPP-equivalence `it()` cases in
`packages/calculation-engine/src/tax/quebec-worked-example.test.ts`. Drift
between the shared `BENEFIT_AMOUNTS_2024.cpp` + `CPP_ADJUSTMENT_FACTORS`
constants and this table will fail those tests with a QC-vs-non-QC mismatch
on `adjustedAmount` or an `isQPP` label inversion.

### Territories

**Yukon:** Similar to federal structure with lowest rate 6.40%
**Northwest Territories:** Lowest rate 5.90%
**Nunavut:** Lowest rate 4.00%

---

## Tax Calculation Algorithm

### Step 1: Calculate Gross Income

```
gross_income = SUM(
  employment_income,
  self_employment_income,
  rental_income,
  pension_income,
  rrif_withdrawals,
  lif_withdrawals,
  cpp_income,
  opp_income,
  taxable_capital_gains,
  grossed_up_dividends,
  interest_income,
  other_taxable_income
)

// Note: TFSA withdrawals are NOT included
```

### Step 2: Calculate Net Income

```
net_income = gross_income - deductions

deductions = SUM(
  rrsp_contributions,
  union_dues,
  child_care_expenses,
  moving_expenses,
  employment_expenses,
  other_deductions
)
```

### Step 3: Calculate Taxable Income

```
taxable_income = net_income - additional_deductions

additional_deductions = SUM(
  capital_gains_exemption,
  loss_carryforwards,
  other_exemptions
)
```

### Step 4: Calculate Federal Tax

```
federal_tax_before_credits = calculate_bracket_tax(taxable_income, federal_brackets)

// Apply non-refundable credits
federal_credits = SUM(
  basic_personal_amount × 15%,
  age_amount_credit,
  pension_income_credit,
  spouse_amount_credit,
  disability_credit,
  medical_expenses_credit,
  donation_credit,
  dividend_tax_credit
)

federal_tax = MAX(0, federal_tax_before_credits - federal_credits)
```

### Step 5: Calculate Provincial Tax

```
provincial_tax_before_credits = calculate_bracket_tax(taxable_income, provincial_brackets)

provincial_credits = SUM(
  provincial_basic_personal × provincial_credit_rate,
  provincial_age_credit,
  provincial_pension_credit,
  other_provincial_credits
)

provincial_tax = MAX(0, provincial_tax_before_credits - provincial_credits)

// Apply surtax if applicable (Ontario)
IF province == 'ON':
  provincial_tax = apply_ontario_surtax(provincial_tax)

// Apply Quebec abatement if applicable
IF province == 'QC':
  federal_tax = federal_tax × (1 - 0.165)  // 16.5% abatement
```

### Step 6: Calculate Total Tax

```
total_tax = federal_tax + provincial_tax

effective_rate = total_tax / gross_income
marginal_rate = federal_marginal + provincial_marginal
```

---

## Tax Credits Detail

### Age Credit (Age 65+)

| Jurisdiction | Age Amount | Income Threshold | Reduction Rate |
| ------------ | ---------- | ---------------- | -------------- |
| Federal      | $8,790     | $44,325          | 15% of excess  |
| Ontario      | $6,026     | $44,325          | 15% of excess  |
| BC           | $6,090     | $42,723          | 15% of excess  |

**Calculation:**

```
IF age >= 65:
  reduction = MAX(0, (net_income - threshold) × 0.15)
  age_credit_amount = MAX(0, age_amount - reduction)
  tax_credit = age_credit_amount × credit_rate
```

### Pension Income Credit

| Jurisdiction | Maximum Amount | Credit Rate    |
| ------------ | -------------- | -------------- |
| Federal      | $2,000         | 15% = $300 max |
| Ontario      | $1,671         | 5.05%          |
| BC           | $1,000         | 5.06%          |

**Eligible Pension Income:**

- RRIF withdrawals (any age)
- Life annuity from pension plan (any age)
- Other pension income (if age 65+)

**Note:** CPP/OAS do NOT qualify for pension income credit

---

## Dividend Tax Treatment

### Eligible Dividends (Public Corporations)

```
grossed_up_dividend = actual_dividend × 1.38
dividend_tax_credit_federal = grossed_up_dividend × 0.150198
dividend_tax_credit_provincial = varies by province
```

### Non-Eligible Dividends (Private Corporations)

```
grossed_up_dividend = actual_dividend × 1.15
dividend_tax_credit_federal = grossed_up_dividend × 0.090301
dividend_tax_credit_provincial = varies by province
```

### Effective Dividend Tax Rates (2024, Ontario)

| Income Level | Eligible Dividend | Non-Eligible Dividend | Interest |
| ------------ | ----------------- | --------------------- | -------- |
| $50,000      | -6.86%            | 9.24%                 | 20.05%   |
| $100,000     | 25.38%            | 32.77%                | 37.91%   |
| $200,000     | 39.34%            | 47.39%                | 49.53%   |

---

## Capital Gains Tax

### Inclusion Rate

```
// Standard (2024)
taxable_capital_gain = capital_gain × 0.50

// Enhanced rate for gains over $250,000 annually (effective June 25, 2024)
IF annual_capital_gains > $250,000:
  taxable_capital_gain = ($250,000 × 0.50) + ((capital_gains - $250,000) × 0.6667)
```

### Principal Residence Exemption

```
IF property_type == 'principal_residence':
  taxable_capital_gain = 0  // Fully exempt
```

---

## OAS Clawback (Recovery Tax)

### Rules

| Parameter      | Value (2024)                      |
| -------------- | --------------------------------- |
| Threshold      | $90,997                           |
| Full Clawback  | ~$148,000                         |
| Recovery Rate  | 15% of net income above threshold |
| Max OAS Annual | ~$8,560                           |

### Calculation

```
IF net_income > oas_threshold:
  clawback = (net_income - oas_threshold) × 0.15
  oas_received = MAX(0, max_oas_annual - clawback)
```

### Important Notes

- TFSA withdrawals do NOT count toward net income for clawback
- Dividend gross-up DOES count (even though credits offset tax)
- RRIF withdrawals count toward net income
- Capital gains (taxable portion) count toward net income

---

## Pension Income Splitting

```
VR-TAX-PSPLIT-001: Eligible pension income splitting between spouses
IF both spouses age 65+ AND married/common-law at year end THEN
  allocate up to 50% of eligible pension income from higher-taxable to lower-taxable spouse
  to minimize combined household tax, subject to the OAS-clawback guard on the receiver.
```

#### VR-TAX-PSPLIT-001 Mechanism

Eligibility and the optimizer are implemented as two cooperating pieces in the
calculation engine. The helper decides how much income is splittable for a
given person-year; the orchestrator sweeps split percentages and picks the
combination that minimizes household tax.

- `packages/calculation-engine/src/projection/pension-splitting-eligibility.ts` —
  `getEligiblePensionIncomeForSplitting(person, age)`:
  - **Under 65:** returns `person.pensionIncome` only (CRA T1032 allows lifetime
    RPP annuities at any age; RRIF/LIF are not eligible until 65). The engine
    models `pensionIncome` as an RPP life annuity (D006), so it is returned
    unconditionally in this branch.
  - **65 and over:** returns `rrifWithdrawal + (lifWithdrawal ?? 0) + pensionIncome`.
- `packages/calculation-engine/src/projection/couple-calculator.ts` —
  `calculateCoupleYear` orchestrator:
  - **Outer age gate (~line 103):** both spouses must be 65+ at year end or the
    optimizer is skipped entirely.
  - **findOptimalSplit sweep (~lines 125–172):** iterates split percentage from
    0% to 50% in 1% steps, recomputing both spouses' tax at each step.
  - **OAS-clawback guard (~line 152):** skips any iteration where the receiver
    would cross the OAS clawback threshold while already receiving OAS.
  - **Savings safety check (~line 171):** only returns a non-zero split when
    `bestTotalCost < totalCostBefore` — an optimal split must strictly improve
    household tax or the optimizer returns 0%.
  - **Fixed-split override (~lines 307–354):** when the user specifies a
    `fixedPensionSplit` (TAX-03 D-08/D-09/D-10), the optimizer is bypassed and
    the helper above still defines the eligibility cap.
- `packages/calculation-engine/src/projection/multi-year.ts` —
  - **Spouse-death degradation (~line 891):** `optimizePensionSplitting` is
    forced `false` starting the year a spouse dies; the survivor year no longer
    contributes splitting.
  - **Aggregation (~lines 1102–1127):** total `pensionSplitTaxSavings` is
    summed across years where `pensionSplitPercentage > 0`; the reported
    average `pensionSplitPercentage` is taken across the same filtered set.

**Scope note.** Quebec diverges from the CRA rule: provincial Line 123/Schedule Q
requires both spouses to be 65+ for Quebec purposes. This provincial-split
divergence is out of scope for the engine today; the rule above applies to the
federal election on T1032 and to provinces that follow the federal rule.

#### VR-TAX-PSPLIT-001 Worked Example (2026 tax year, Ontario)

Fixture: both spouses born 1961-01-01 (age 65 at end of 2026), Ontario,
married, `optimizePensionSplitting = true`. Primary has RPP pension income
$80,000 and expected CPP-at-65 $14,000; spouse has RPP pension income $5,000
and expected CPP-at-65 $8,000; both take OAS at 65; all other inputs zero or
default. Running `calculateCoupleYear` twice — once with the optimizer enabled
(`withSplit`), once disabled (`withoutSplit`) — produces:

| Field                                       | Value       |
| ------------------------------------------- | ----------- |
| Primary pensionIncome (input)               | $80,000.00  |
| Spouse pensionIncome (input)                | $5,000.00   |
| Primary pre-split taxable income            | $101,770.25 |
| Primary post-split taxable income           | $65,770.25  |
| Spouse pre-split taxable income             | $21,908.00  |
| Spouse post-split taxable income            | $57,908.00  |
| Split amount transferred (primary → spouse) | $36,000.00  |
| Split percentage                            | 45%         |
| Household tax (no split)                    | $21,236.95  |
| Household tax (optimal split)               | $16,279.46  |
| Total savings (tax + OAS clawback)          | $5,924.58   |

Parity: every row of this VR-TAX-PSPLIT-001 Worked Example is reproduced to the
cent by
`packages/calculation-engine/src/projection/pension-splitting-worked-example.test.ts`.
Drift between the engine (federal BPA $16,129, OAS clawback threshold $95,323,
bracket indexing) and this table will fail that test with expected-vs-actual
cents on the drifting row.

### T1 Reporting

| Field / Form                                 | T1 Line                                     | Party               | Treatment                                                                                                |
| -------------------------------------------- | ------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------- |
| T1032 Joint Election to Split Pension Income | n/a (joint form)                            | Both spouses        | Both spouses sign; the election carries the split amount onto each return.                               |
| `pensionIncomeReceived`                      | 11600 (Elected split-pension amount)        | Receiving spouse    | Adds the transferred amount to the receiving spouse's taxable income.                                    |
| `pensionIncomeTransferred`                   | 21000 (Deduction for elected split-pension) | Transferring spouse | Deducts the transferred amount from the higher-income spouse's taxable income.                           |
| Net effect on household net income           | Schedule 1 / Line 23500                     | Both                | Split shifts income across returns and therefore changes the OAS clawback (`social_benefits_repayment`). |
| `pensionSplitPercentage`                     | — (diagnostic)                              | Couple aggregate    | Reported for diagnostics only; no direct T1 line.                                                        |
| `pensionSplitTaxSavings`                     | — (diagnostic)                              | Couple aggregate    | Reported for diagnostics only; no direct T1 line.                                                        |

---

## Tax Calculation Data Model

```typescript
interface TaxCalculation {
  year: number;
  owner: 'primary' | 'spouse';

  // Income components
  employment_income: number;
  pension_income: number;
  rrif_income: number;
  cpp_income: number;
  oas_income: number;
  investment_income: number;
  capital_gains: number;
  dividend_income_eligible: number;
  dividend_income_non_eligible: number;

  // Calculated amounts
  gross_income: number;
  deductions: number;
  net_income: number;
  taxable_income: number;

  // Tax amounts
  federal_tax_gross: number;
  federal_credits: number;
  federal_tax_net: number;
  provincial_tax_gross: number;
  provincial_credits: number;
  provincial_tax_net: number;
  total_tax: number;

  // Rates
  marginal_rate_federal: number;
  marginal_rate_provincial: number;
  marginal_rate_combined: number;
  effective_rate: number;

  // Special calculations
  oas_clawback: number;
  age_credit: number;
  pension_credit: number;
}
```

---

## Test Cases

### TC-TAX-001: Basic Federal Tax Calculation

**Input:**

- Province: Ontario
- Taxable income: $80,000
- No credits except basic personal

**Expected:**

- Federal tax bracket: 20.50% marginal
- Federal tax: $55,867 × 15% + ($80,000 - $55,867) × 20.50% = $8,380 + $4,947 = $13,327
- Less basic personal credit: $15,705 × 15% = $2,356
- Federal tax net: $10,971

### TC-TAX-002: Age Credit Calculation

**Input:**

- Age: 68
- Net income: $60,000
- Province: Ontario

**Expected:**

- Federal age amount: $8,790
- Reduction: ($60,000 - $44,325) × 15% = $2,351
- Net age amount: $8,790 - $2,351 = $6,439
- Federal age credit: $6,439 × 15% = $966

### TC-TAX-003: OAS Clawback

**Input:**

- Net income: $110,000
- Full OAS entitlement: $8,560

**Expected:**

- Excess over threshold: $110,000 - $90,997 = $19,003
- Clawback: $19,003 × 15% = $2,850
- OAS received: $8,560 - $2,850 = $5,710

### TC-TAX-004: Pension Income Splitting Benefit

**Input:**

- Spouse A: $100,000 pension income (age 70)
- Spouse B: $20,000 other income (age 68)
- Province: Ontario

**Expected without splitting:**

- Spouse A tax: ~$25,000
- Spouse B tax: ~$1,500
- Combined: ~$26,500

**Expected with 50% split:**

- Spouse A: $50,000 pension
- Spouse B: $70,000 ($20k + $50k pension)
- Spouse A tax: ~$8,000
- Spouse B tax: ~$13,000
- Combined: ~$21,000
- Savings: ~$5,500

### TC-TAX-005: Dividend vs Interest Comparison

**Input:**

- $10,000 investment income
- Marginal rate: 40% combined
- Province: Ontario

**Expected:**

- Interest: $10,000 × 40% = $4,000 tax
- Eligible dividend: After gross-up and credits ≈ $2,500 tax
- Non-eligible dividend: After gross-up and credits ≈ $3,300 tax

---

## Implementation Notes

1. **Tax table updates:** Brackets and amounts are indexed annually. Store in configuration files for easy updates.

2. **Rounding:** Follow CRA rounding rules (generally round to nearest dollar for final amounts).

3. **Quebec special handling:** Remember the 16.5% federal abatement and separate provincial system.

4. **Order of operations:** Credits must be applied in correct order; some are refundable, others are not.

5. **Carry-forwards:** Capital losses can be carried forward indefinitely; track separately.
