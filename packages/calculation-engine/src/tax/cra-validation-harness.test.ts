/**
 * VR-TAX-PROV-NL-001 / VR-TAX-PROV-NS-001 / VR-TAX-PROV-NB-001 / VR-TAX-PROV-PE-001 /
 * VR-TAX-PROV-ON-001 / VR-TAX-PROV-QC-001 / VR-TAX-PROV-MB-001 / VR-TAX-PROV-SK-001 /
 * VR-TAX-PROV-AB-001 / VR-TAX-PROV-BC-001 / VR-TAX-PROV-YT-001 / VR-TAX-PROV-NT-001 /
 * VR-TAX-PROV-NU-001 / VR-BEN-QPP-001
 *
 * CRA validation harness — 13-jurisdiction cent-exact pin (M003/S04)
 *
 * Single canonical fixture — a 65-year-old with $70,000 annual pension income,
 * claim code 1, no other income or deductions — exercised across all 13
 * Canadian jurisdictions. The Atlantic (NL/NS/NB/PE), Prairie+North
 * (MB/SK/YT/NT/NU), and Quebec (QC) jurisdictions are also pinned in their
 * sibling test files; this harness adds the three remaining ON/BC/AB pins and
 * consolidates all 13 into one reviewer-friendly artifact alongside a
 * human-readable CRA-VALIDATION-REPORT.md.
 *
 * Expected values in EXPECTED_BY_JURISDICTION are typed digit-for-digit from
 * the K009 Worked Example tables in docs/source-of-truth/04-tax-engine.md —
 * the doc is the single source of truth. Drift between the engine and any
 * expected value surfaces as a toBeCloseTo assertion failure naming the
 * exact jurisdiction and row, plus a non-zero Δ column in
 * CRA-VALIDATION-REPORT.md.
 *
 * PDOC cross-check source: https://apps.cra-arc.gc.ca/ebci/rhpd/startLanguage.do
 *   - Year: 2024
 *   - Pay period: annual (1 per year)
 *   - Pension income: $70,000
 *   - Claim code: 1 (basic)
 *   - Age 65+ (age amount + pension income amount boxes checked)
 *   - Province: all 13 jurisdictions
 *
 * PDOC cross-check status: DEFERRED. The autonomous execution that produced
 * these pinned values had no browser access to apps.cra-arc.gc.ca. The engine
 * numbers are the source-of-truth pin per the slice plan's contingency clause;
 * a follow-up PDOC reconciliation will confirm each province stays within the
 * 1% slice acceptance bar. NT/NU age amounts are single-source (TaxTips.ca —
 * CRA 5012-PC/5014-PC block automated fetch). AREL living-alone component is
 * deferred for QC pending maritalStatus/livesAlone inputs on TaxCalculationInput.
 *
 * @see docs/source-of-truth/04-tax-engine.md — VR-TAX-PROV-{ON,BC,AB,...}-001
 * @see packages/shared/src/constants/tax-tables.ts — AGE_CREDIT_2024, PENSION_INCOME_CREDIT_2024
 */
import { afterAll, describe, it, expect, test } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateTotalTax } from './index.js';
import type { TaxCalculationInput } from './index.js';
import { PROVINCE_CODES, PROVINCES } from '@retireops/shared';
import type { ProvinceCode } from '@retireops/shared';

const TAX_YEAR = 2024;

function createCanonicalFixture(province: ProvinceCode): TaxCalculationInput {
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

/**
 * Every cent below is typed digit-for-digit from the K009 Worked Example
 * tables in docs/source-of-truth/04-tax-engine.md — the doc is the single
 * source of truth. For QC, federalTaxNet is post-abatement (the Quebec
 * abatement row on the QC Worked Example table is the −$1,300.32 applied to
 * the pre-abatement $7,880.75).
 */
const EXPECTED_BY_JURISDICTION: Record<
  ProvinceCode,
  {
    federalTaxNet: number;
    provincialTaxNet: number;
    totalTax: number;
    sourceRuleId: string;
  }
> = {
  ON: {
    federalTaxNet: 7880.75,
    provincialTaxNet: 3475.35,
    totalTax: 11356.11,
    sourceRuleId: 'VR-TAX-PROV-ON-001',
  },
  BC: {
    federalTaxNet: 7880.75,
    provincialTaxNet: 3336.19,
    totalTax: 11216.95,
    sourceRuleId: 'VR-TAX-PROV-BC-001',
  },
  AB: {
    federalTaxNet: 7880.75,
    provincialTaxNet: 4453.99,
    totalTax: 12334.74,
    sourceRuleId: 'VR-TAX-PROV-AB-001',
  },
  NL: {
    federalTaxNet: 7880.75,
    provincialTaxNet: 6435.28,
    totalTax: 14316.03,
    sourceRuleId: 'VR-TAX-PROV-NL-001',
  },
  NS: {
    federalTaxNet: 7880.75,
    provincialTaxNet: 7979.77,
    totalTax: 15860.53,
    sourceRuleId: 'VR-TAX-PROV-NS-001',
  },
  NB: {
    federalTaxNet: 7880.75,
    provincialTaxNet: 5999.21,
    totalTax: 13879.96,
    sourceRuleId: 'VR-TAX-PROV-NB-001',
  },
  PE: {
    federalTaxNet: 7880.75,
    provincialTaxNet: 6998.73,
    totalTax: 14879.49,
    sourceRuleId: 'VR-TAX-PROV-PE-001',
  },
  MB: {
    federalTaxNet: 7880.75,
    provincialTaxNet: 6196.26,
    totalTax: 14077.01,
    sourceRuleId: 'VR-TAX-PROV-MB-001',
  },
  SK: {
    federalTaxNet: 7880.75,
    provincialTaxNet: 5512.9,
    totalTax: 13393.65,
    sourceRuleId: 'VR-TAX-PROV-SK-001',
  },
  YT: {
    federalTaxNet: 7880.75,
    provincialTaxNet: 3398.26,
    totalTax: 11279.01,
    sourceRuleId: 'VR-TAX-PROV-YT-001',
  },
  NT: {
    federalTaxNet: 7880.75,
    provincialTaxNet: 3341.74,
    totalTax: 11222.5,
    sourceRuleId: 'VR-TAX-PROV-NT-001',
  },
  NU: {
    federalTaxNet: 7880.75,
    provincialTaxNet: 2179.81,
    totalTax: 10060.56,
    sourceRuleId: 'VR-TAX-PROV-NU-001',
  },
  QC: {
    federalTaxNet: 6580.43,
    provincialTaxNet: 8070.01,
    totalTax: 14650.44,
    sourceRuleId: 'VR-TAX-PROV-QC-001',
  },
};

describe('CRA validation harness — ON/BC/AB cent-exact pins', () => {
  it('ON: 65+ with $70,000 pension income (VR-TAX-PROV-ON-001)', () => {
    const result = calculateTotalTax(createCanonicalFixture('ON'));
    expect(result.federalTaxNet).toBeCloseTo(7880.75, 2);
    expect(result.provincialTaxNet).toBeCloseTo(3475.35, 2);
    expect(result.totalTax).toBeCloseTo(11356.11, 2);
  });

  it('BC: 65+ with $70,000 pension income (VR-TAX-PROV-BC-001)', () => {
    const result = calculateTotalTax(createCanonicalFixture('BC'));
    expect(result.federalTaxNet).toBeCloseTo(7880.75, 2);
    expect(result.provincialTaxNet).toBeCloseTo(3336.19, 2);
    expect(result.totalTax).toBeCloseTo(11216.95, 2);
  });

  it('AB: 65+ with $70,000 pension income (VR-TAX-PROV-AB-001)', () => {
    const result = calculateTotalTax(createCanonicalFixture('AB'));
    expect(result.federalTaxNet).toBeCloseTo(7880.75, 2);
    expect(result.provincialTaxNet).toBeCloseTo(4453.99, 2);
    expect(result.totalTax).toBeCloseTo(12334.74, 2);
  });
});

describe('CRA validation harness — all 13 jurisdictions', () => {
  test.each(PROVINCE_CODES)('%s matches K009 Worked Example cents', (code) => {
    const expected = EXPECTED_BY_JURISDICTION[code];
    // Loud failure if a future jurisdiction is added to PROVINCE_CODES
    // without a matching EXPECTED_BY_JURISDICTION entry — prevents the
    // silent-skip drift class that provincial-tax.test.ts:329 has.
    expect(expected).toBeDefined();

    const result = calculateTotalTax(createCanonicalFixture(code));
    expect(result.federalTaxNet).toBeCloseTo(expected.federalTaxNet, 2);
    expect(result.provincialTaxNet).toBeCloseTo(expected.provincialTaxNet, 2);
    expect(result.totalTax).toBeCloseTo(expected.totalTax, 2);

    if (code === 'QC') {
      // K014 algebraic-recovery guard: the post-abatement federalTaxGross
      // must recover the 12-jurisdiction shared pre-abatement value of
      // $7,880.7525 via division by (1 − 0.165). Catches any QC-specific
      // input that leaks into the federal side before provincial tax.
      expect(result.federalTaxGross / (1 - 0.165)).toBeCloseTo(7880.7525, 2);
    }
  });
});

// afterAll report-writer — runs unconditionally on every invocation so the
// report is always current (no env gating, no stale-report risk). Engine
// source stays side-effect-free; fs.writeFileSync only fires inside this
// test file's vitest process context.
afterAll(() => {
  const round2 = (n: number): number => Math.round(n * 100) / 100;
  const fmt = (n: number): string => n.toFixed(2);

  const rows = PROVINCE_CODES.map((code) => {
    const expected = EXPECTED_BY_JURISDICTION[code];
    const result = calculateTotalTax(createCanonicalFixture(code));
    const deltaFederal = round2(result.federalTaxNet - expected.federalTaxNet);
    const deltaProvincial = round2(result.provincialTaxNet - expected.provincialTaxNet);
    const deltaTotal = round2(result.totalTax - expected.totalTax);
    const anchor = expected.sourceRuleId.toLowerCase();
    const source = `[${expected.sourceRuleId}](../../../../../docs/source-of-truth/04-tax-engine.md#${anchor})`;
    return `| ${code} | ${PROVINCES[code]} | ${fmt(expected.federalTaxNet)} | ${fmt(result.federalTaxNet)} | ${fmt(deltaFederal)} | ${fmt(expected.provincialTaxNet)} | ${fmt(result.provincialTaxNet)} | ${fmt(deltaProvincial)} | ${fmt(expected.totalTax)} | ${fmt(result.totalTax)} | ${fmt(deltaTotal)} | ${source} |`;
  });

  const header = [
    '| Code | Jurisdiction | Expected federal | Computed federal | Δ federal | Expected provincial | Computed provincial | Δ provincial | Expected total | Computed total | Δ total | Source |',
    '| ---- | ------------ | ---------------- | ---------------- | --------- | ------------------- | ------------------- | ------------ | -------------- | -------------- | ------- | ------ |',
  ];

  const preamble = [
    '# CRA Validation Report — M003/S04',
    '',
    'Canonical fixture: age 65, $70,000 pension income, claim code 1, no other',
    'income or deductions, 2024 tax year. All expected values typed digit-for-digit',
    'from the K009 Worked Example tables in docs/source-of-truth/04-tax-engine.md.',
    'Every Δ column should read `0.00` in steady state; any non-zero Δ signals a',
    'silent engine drift that slipped through the `toBeCloseTo(_, 2)` gate.',
    '',
    'PDOC cross-check DEFERRED (autonomous run had no browser access to',
    'apps.cra-arc.gc.ca). NT/NU age amounts are single-source (TaxTips.ca).',
    'QC AREL living-alone component deferred pending maritalStatus/livesAlone',
    'inputs on TaxCalculationInput.',
    '',
  ];

  const markdown = [...preamble, ...header, ...rows, ''].join('\n');

  // Test file lives at packages/calculation-engine/src/tax/...
  // Report lives at .gsd/milestones/M003/slices/S04/CRA-VALIDATION-REPORT.md
  // Resolve repo root from the test file directory to keep path independent of CWD.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..', '..', '..', '..');
  const outPath = path.join(
    repoRoot,
    '.gsd',
    'milestones',
    'M003',
    'slices',
    'S04',
    'CRA-VALIDATION-REPORT.md'
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, markdown, 'utf8');
});
