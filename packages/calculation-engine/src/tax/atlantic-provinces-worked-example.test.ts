/**
 * VR-TAX-PROV-NL-001 / VR-TAX-PROV-NS-001 / VR-TAX-PROV-NB-001 / VR-TAX-PROV-PE-001
 * Atlantic-provinces 65+ pension-income worked example — engine parity test (T03)
 *
 * Reproduces the Worked Example fixture for Newfoundland & Labrador, Nova Scotia,
 * New Brunswick, and Prince Edward Island to the cent. The fixture — a 65-year-old
 * with $70,000 annual pension income, claim code 1, no other income or deductions —
 * is the canonical PDOC scenario for locking Atlantic age-amount and
 * pension-income-amount credits against drift.
 *
 * Each expected value below MUST match the corresponding row of the
 * VR-TAX-PROV-{NL,NS,NB,PE}-001 Worked Example table in
 * docs/source-of-truth/04-tax-engine.md digit-for-digit. The whole point of
 * K012/K009 parity is that the engine, this test, and the doc table share a
 * single source of captured output — any drift fails this test with
 * expected-vs-actual cents on the drifting row.
 *
 * PDOC cross-check source: https://apps.cra-arc.gc.ca/ebci/rhpd/startLanguage.do
 *   - Year: 2024
 *   - Pay period: annual (1 per year)
 *   - Pension income: $70,000
 *   - Claim code: 1 (basic)
 *   - Age 65+ (age amount + pension income amount boxes checked)
 *   - Province: NL / NS / NB / PE
 *
 * PDOC cross-check status: DEFERRED. The autonomous execution that produced
 * these pinned values had no browser access to apps.cra-arc.gc.ca. The engine
 * numbers are the source-of-truth pin per the slice plan's contingency clause;
 * a follow-up PDOC reconciliation will confirm each province stays within the
 * 1% slice acceptance bar.
 *
 * @see docs/source-of-truth/04-tax-engine.md — VR-TAX-PROV-{NL,NS,NB,PE}-001
 * @see packages/shared/src/constants/tax-tables.ts — AGE_CREDIT_2024, PENSION_INCOME_CREDIT_2024
 */
import { describe, it, expect } from 'vitest';
import { calculateTotalTax } from './index.js';
import type { TaxCalculationInput } from './index.js';
import type { ProvinceCode } from '@retireops/shared';

const TAX_YEAR = 2024;

function createAtlanticFixture(province: ProvinceCode): TaxCalculationInput {
  return {
    year: TAX_YEAR,
    owner: 'primary',
    province,
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

describe('Atlantic provinces worked example (2024)', () => {
  // VR-TAX-PROV-NL-001 — values pinned from docs/source-of-truth/04-tax-engine.md Worked Example
  it('NL: 65+ with $70,000 pension income', () => {
    const result = calculateTotalTax(createAtlanticFixture('NL'));
    expect(result.federalTaxNet).toBeCloseTo(7880.75, 2);
    expect(result.provincialTaxNet).toBeCloseTo(6435.28, 2);
    expect(result.totalTax).toBeCloseTo(14316.03, 2);
  });

  // VR-TAX-PROV-NS-001 — values pinned from docs/source-of-truth/04-tax-engine.md Worked Example
  it('NS: 65+ with $70,000 pension income', () => {
    const result = calculateTotalTax(createAtlanticFixture('NS'));
    expect(result.federalTaxNet).toBeCloseTo(7880.75, 2);
    expect(result.provincialTaxNet).toBeCloseTo(7979.77, 2);
    expect(result.totalTax).toBeCloseTo(15860.53, 2);
  });

  // VR-TAX-PROV-NB-001 — values pinned from docs/source-of-truth/04-tax-engine.md Worked Example
  it('NB: 65+ with $70,000 pension income', () => {
    const result = calculateTotalTax(createAtlanticFixture('NB'));
    expect(result.federalTaxNet).toBeCloseTo(7880.75, 2);
    expect(result.provincialTaxNet).toBeCloseTo(5999.21, 2);
    expect(result.totalTax).toBeCloseTo(13879.96, 2);
  });

  // VR-TAX-PROV-PE-001 — values pinned from docs/source-of-truth/04-tax-engine.md Worked Example
  it('PE: 65+ with $70,000 pension income', () => {
    const result = calculateTotalTax(createAtlanticFixture('PE'));
    expect(result.federalTaxNet).toBeCloseTo(7880.75, 2);
    expect(result.provincialTaxNet).toBeCloseTo(6998.73, 2);
    expect(result.totalTax).toBeCloseTo(14879.49, 2);
  });
});
