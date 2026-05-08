/**
 * VR-TAX-PROV-QC-001 / VR-BEN-QPP-001
 * Quebec 65+ pension-income worked example — engine parity test
 *
 * Mirrors atlantic-provinces-worked-example.test.ts and
 * prairie-north-worked-example.test.ts. The QC-tax case pins federalTaxGross,
 * federalTaxNet, provincialTaxNet, and totalTax to the cent against the
 * Worked Example table in docs/source-of-truth/04-tax-engine.md (K012:
 * atomic doc/test pin, no transcription drift).
 *
 * The QPP-equivalence cases (VR-BEN-QPP-001) prove QPP amount parity with
 * CPP at equivalent RRQ 2024 rates and the isQPP label flip.
 *
 * K014 federal-uniformity guard: Quebec's underlying federal tax must equal
 * the 12 prior jurisdictions' value of 7880.7525 before Quebec's 16.5%
 * abatement (ITA s.120(2)) is applied. The engine folds the abatement into
 * the single federalTaxGross return field (see federal-tax.ts
 * calculateFederalTax), so this guard is asserted indirectly:
 * federalTaxGross × (1/0.835) must equal 7880.7525, i.e. federalTaxGross
 * must equal 7880.7525 × 0.835 = 6580.4283. A QC-specific input leaking
 * into the federal side fails this assertion early and loudly.
 *
 * PDOC/Revenu-Québec cross-check status: DEFERRED. The autonomous execution
 * that pinned these values had no browser access to apps.cra-arc.gc.ca or
 * revenuquebec.ca. The engine numbers are the source-of-truth pin per the
 * slice plan's contingency clause; a follow-up PDOC + RQ reconciliation
 * will confirm Quebec stays within the 1% slice acceptance bar.
 *   - Federal: https://apps.cra-arc.gc.ca/ebci/rhpd/startLanguage.do (post-abatement)
 *   - Quebec provincial: https://www.revenuquebec.ca/en/ (TP-1015.TI + TP-752.0.14)
 *   - Year: 2024 / pay period: annual / claim code: 1 / age 65 / $70,000 pension / province QC
 *
 * @see docs/source-of-truth/04-tax-engine.md — VR-TAX-PROV-QC-001
 * @see docs/source-of-truth/05-government-benefits.md — VR-BEN-QPP-001
 * @see packages/shared/src/constants/tax-tables.ts — QUEBEC_TAX_2024, AREL_2024
 * @see packages/calculation-engine/src/tax/provincial-tax.ts — calculateQuebecAREL
 */
import { describe, it, expect } from 'vitest';
import { calculateTotalTax } from './index.js';
import type { TaxCalculationInput } from './index.js';
import { calculateGovernmentBenefits } from '../benefits/index.js';
import type { BenefitsCalculationInput } from '../benefits/index.js';

const TAX_YEAR = 2024;

function createQuebecFixture(): TaxCalculationInput {
  return {
    year: TAX_YEAR,
    owner: 'primary',
    province: 'QC',
    age: 65,

    employmentIncome: 0,
    pensionIncome: 70000,
    rrifIncome: 0,
    cppIncome: 0,
    oasIncome: 0,
    otherIncome: 0,

    interestIncome: 0,
    eligibleDividends: 0,
    nonEligibleDividends: 0,
    capitalGains: 0,

    rrspContribution: 0,
    otherDeductions: 0,
  };
}

function createBenefitsFixture(isQuebec: boolean): BenefitsCalculationInput {
  return {
    year: TAX_YEAR,
    owner: 'primary',
    age: 65,
    yearsOfResidence: 40,
    maritalStatus: 'single',

    expectedCPPAt65: 16375,
    cppStartAge: 65,
    isQuebec,

    oasStartAge: 65,

    netIncome: 70000,
    employmentIncome: 0,

    yearsFromStart: 0,
    inflationRate: 0,
  };
}

describe('Quebec worked example (2024) — VR-TAX-PROV-QC-001', () => {
  // VR-TAX-PROV-QC-001 — cent-exact parity with the Worked Example table in
  // docs/source-of-truth/04-tax-engine.md. K014 federal-uniformity guard:
  // federalTaxGross MUST equal 7880.7525 (the shared pre-abatement value
  // across all 12 prior jurisdictions) before Quebec's 16.5% refundable
  // abatement (ITA s.120(2)). The engine folds the abatement into
  // federalTaxGross, so the pinned value is the post-abatement
  // 7880.7525 × 0.835 = 6580.4283.
  it('VR-TAX-PROV-QC-001 — 2024 $70K pension age 65', () => {
    const result = calculateTotalTax(createQuebecFixture());

    // Row-by-row parity against the doc Worked Example table:
    //   Federal tax (gross of abatement)  $7,880.75  ← recovered algebraically
    //   Quebec abatement (−16.5%)         −$1,300.32
    //   Federal tax (net of abatement)    $6,580.43
    //   Provincial tax (net of AREL+BPA)  $8,070.01
    //   Total tax                         $14,650.44
    expect(result.federalTaxGross).toBeCloseTo(6580.4283, 2);

    // K014 abatement-consistency: federalTaxGross / 0.835 must recover the
    // uniform pre-abatement value used by all 12 non-QC jurisdictions.
    expect(result.federalTaxGross / (1 - 0.165)).toBeCloseTo(7880.7525, 2);

    // In this fixture there are no dividend credits, so federalTaxNet === federalTaxGross.
    expect(result.federalTaxNet).toBeCloseTo(6580.4283, 2);

    expect(result.provincialTaxNet).toBeCloseTo(8070.0138, 2);
    expect(result.totalTax).toBeCloseTo(14650.4421, 2);
  });
});

describe('Quebec QPP equivalence — VR-BEN-QPP-001', () => {
  // VR-BEN-QPP-001 — QPP amount uses the same adjustment table as CPP at RRQ 2024 rates.
  // Same expectedAmountAt65 + startAge + inflation must produce the same adjustedAmount.
  it('VR-BEN-QPP-001 — QPP amount equals CPP amount at RRQ 2024 rates', () => {
    const qcResult = calculateGovernmentBenefits(createBenefitsFixture(true));
    const onResult = calculateGovernmentBenefits(createBenefitsFixture(false));

    expect(qcResult.cpp.adjustedAmount).toBeCloseTo(onResult.cpp.adjustedAmount, 4);
    expect(qcResult.totalAnnual).toBeCloseTo(onResult.totalAnnual, 4);
  });

  // VR-BEN-QPP-001 — isQPP label must flip on isQuebec=true so downstream UI/reports
  // can render "QPP" vs "CPP" without re-deriving jurisdiction.
  it('VR-BEN-QPP-001 — isQPP label is true for QC and false otherwise', () => {
    const qcResult = calculateGovernmentBenefits(createBenefitsFixture(true));
    const onResult = calculateGovernmentBenefits(createBenefitsFixture(false));

    expect(qcResult.cpp.isQPP).toBe(true);
    expect(onResult.cpp.isQPP).toBe(false);
  });
});
