/**
 * VR-TAX-PROV-MB-001 / VR-TAX-PROV-SK-001 / VR-TAX-PROV-YT-001 / VR-TAX-PROV-NT-001 / VR-TAX-PROV-NU-001
 * Prairie + North 65+ pension-income worked example — engine parity test (T03)
 *
 * Reproduces the Worked Example fixture for Manitoba, Saskatchewan, Yukon,
 * Northwest Territories, and Nunavut to the cent. The fixture — a 65-year-old
 * with $70,000 annual pension income, claim code 1, no other income or deductions —
 * is the canonical PDOC scenario for locking Prairie + North age-amount and
 * pension-income-amount credits against drift.
 *
 * Each expected value below MUST match the corresponding row of the
 * VR-TAX-PROV-{MB,SK,YT,NT,NU}-001 Worked Example table in
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
 *   - Province: MB / SK / YT / NT / NU
 *
 * PDOC cross-check status: DEFERRED. The autonomous execution that produced
 * these pinned values had no browser access to apps.cra-arc.gc.ca. The engine
 * numbers are the source-of-truth pin per the slice plan's contingency clause;
 * a follow-up PDOC reconciliation will confirm each province stays within the
 * 1% slice acceptance bar.
 *
 * @see docs/source-of-truth/04-tax-engine.md — VR-TAX-PROV-{MB,SK,YT,NT,NU}-001
 * @see packages/shared/src/constants/tax-tables.ts — AGE_CREDIT_2024, PENSION_INCOME_CREDIT_2024
 */
import { describe, it, expect } from 'vitest';
import { calculateTotalTax } from './index.js';
import type { TaxCalculationInput } from './index.js';
import type { ProvinceCode } from '@retireops/shared';

const TAX_YEAR = 2024;

function createPrairieNorthFixture(province: ProvinceCode): TaxCalculationInput {
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

describe('Prairie + North worked example (2024)', () => {
  // VR-TAX-PROV-MB-001 — values pinned from docs/source-of-truth/04-tax-engine.md Worked Example
  it('MB: 65+ with $70,000 pension income', () => {
    const result = calculateTotalTax(createPrairieNorthFixture('MB'));
    expect(result.federalTaxNet).toBeCloseTo(7880.75, 2);
    expect(result.provincialTaxNet).toBeCloseTo(6196.26, 2);
    expect(result.totalTax).toBeCloseTo(14077.01, 2);
  });

  // VR-TAX-PROV-SK-001 — values pinned from docs/source-of-truth/04-tax-engine.md Worked Example
  it('SK: 65+ with $70,000 pension income', () => {
    const result = calculateTotalTax(createPrairieNorthFixture('SK'));
    expect(result.federalTaxNet).toBeCloseTo(7880.75, 2);
    expect(result.provincialTaxNet).toBeCloseTo(5512.9, 2);
    expect(result.totalTax).toBeCloseTo(13393.65, 2);
  });

  // VR-TAX-PROV-YT-001 — values pinned from docs/source-of-truth/04-tax-engine.md Worked Example
  it('YT: 65+ with $70,000 pension income', () => {
    const result = calculateTotalTax(createPrairieNorthFixture('YT'));
    expect(result.federalTaxNet).toBeCloseTo(7880.75, 2);
    expect(result.provincialTaxNet).toBeCloseTo(3398.26, 2);
    expect(result.totalTax).toBeCloseTo(11279.01, 2);
  });

  // VR-TAX-PROV-NT-001 — values pinned from docs/source-of-truth/04-tax-engine.md Worked Example
  it('NT: 65+ with $70,000 pension income', () => {
    const result = calculateTotalTax(createPrairieNorthFixture('NT'));
    expect(result.federalTaxNet).toBeCloseTo(7880.75, 2);
    expect(result.provincialTaxNet).toBeCloseTo(3341.74, 2);
    expect(result.totalTax).toBeCloseTo(11222.5, 2);
  });

  // VR-TAX-PROV-NU-001 — values pinned from docs/source-of-truth/04-tax-engine.md Worked Example
  it('NU: 65+ with $70,000 pension income', () => {
    const result = calculateTotalTax(createPrairieNorthFixture('NU'));
    expect(result.federalTaxNet).toBeCloseTo(7880.75, 2);
    expect(result.provincialTaxNet).toBeCloseTo(2179.81, 2);
    expect(result.totalTax).toBeCloseTo(10060.56, 2);
  });
});
