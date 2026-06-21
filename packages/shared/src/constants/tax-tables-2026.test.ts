/**
 * Unit tests for the 2026 federal & provincial tax-table refresh (audit A-09 / A-10).
 *
 * Every pinned 2026 number is justified against
 * docs/source-of-truth/19-benefits-tax-credits-2026.md:
 *   - Federal thresholds = 2025 × 1.02 (#2026-fed-indexation), round-to-dollar.
 *   - Federal BPA = 16452 (#2026-fed-bpa-max).
 *   - Provincial 2026 tax tables are carried forward from 2025 (DOC GAP — doc 19
 *     §5 has no 2026 provincial brackets/BPA).
 *   - Provincial age/pension amounts = doc-19 §5 (e.g. ON age 6342, ON pension 1796).
 */
import { describe, it, expect } from 'vitest';
import {
  FEDERAL_TAX_2026,
  PROVINCIAL_TAX_TABLES_2025,
  PROVINCIAL_TAX_TABLES_2026,
  getProvincialTaxTables,
  AGE_CREDIT_2026,
  PENSION_INCOME_CREDIT_2026,
  AREL_2026,
  getAgeCreditTable,
  getPensionIncomeCreditTable,
  getARELTable,
} from './tax-tables.js';

describe('FEDERAL_TAX_2026 (audit A-09)', () => {
  it('indexes the 2025 bracket thresholds by the 2.0% federal factor (round to dollar)', () => {
    // 57375×1.02=58522.5→58522, 114750×1.02=117045, 177882×1.02=181439.6→181440,
    // 253414×1.02=258482.3→258482  (#2026-fed-indexation)
    expect(FEDERAL_TAX_2026.brackets.map((b) => b.max)).toEqual([
      58522,
      117045,
      181440,
      258482,
      Infinity,
    ]);
    expect(FEDERAL_TAX_2026.brackets.map((b) => b.min)).toEqual([0, 58522, 117045, 181440, 258482]);
  });

  it('keeps the 0.14 lowest rate (#2026-fed-lowest-rate)', () => {
    expect(FEDERAL_TAX_2026.brackets[0]?.rate).toBe(0.14);
    expect(FEDERAL_TAX_2026.brackets.map((b) => b.rate)).toEqual([0.14, 0.205, 0.26, 0.29, 0.33]);
  });

  it('sets the BPA to the doc-19 max value 16452 (#2026-fed-bpa-max)', () => {
    // 16129 (2025) × 1.02 = 16451.58 → 16452, matching the doc exactly.
    expect(FEDERAL_TAX_2026.basicPersonalAmount).toBe(16452);
  });

  it('cross-check: the third/fifth indexed thresholds land on the doc BPA phase-out start/end', () => {
    // #2026-fed-bpa-phaseout-start = 181440, #2026-fed-bpa-phaseout-end = 258482.
    expect(FEDERAL_TAX_2026.brackets[2]?.max).toBe(181440);
    expect(FEDERAL_TAX_2026.brackets[4]?.min).toBe(258482);
  });
});

describe('PROVINCIAL_TAX_TABLES_2026 + getProvincialTaxTables (audit A-10)', () => {
  it('getProvincialTaxTables returns the 2026 record for year >= 2026', () => {
    expect(getProvincialTaxTables(2026)).toBe(PROVINCIAL_TAX_TABLES_2026);
    expect(getProvincialTaxTables(2030)).toBe(PROVINCIAL_TAX_TABLES_2026);
  });

  it('getProvincialTaxTables returns the 2025 record for 2025', () => {
    expect(getProvincialTaxTables(2025)).toBe(PROVINCIAL_TAX_TABLES_2025);
  });

  it('covers all 13 provinces/territories with a 2026 year stamp', () => {
    const codes = Object.keys(PROVINCIAL_TAX_TABLES_2026).sort();
    expect(codes).toEqual(
      ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'].sort()
    );
    for (const table of Object.values(PROVINCIAL_TAX_TABLES_2026)) {
      expect(table.year).toBe(2026);
    }
  });

  it('carries 2025 brackets/BPA forward verbatim (DOC GAP — doc 19 has no 2026 provincial brackets)', () => {
    // ON brackets/BPA must equal the 2025 set (only year stamp differs).
    expect(PROVINCIAL_TAX_TABLES_2026.ON?.brackets).toEqual(
      PROVINCIAL_TAX_TABLES_2025.ON?.brackets
    );
    expect(PROVINCIAL_TAX_TABLES_2026.ON?.basicPersonalAmount).toBe(
      PROVINCIAL_TAX_TABLES_2025.ON?.basicPersonalAmount
    );
    expect(PROVINCIAL_TAX_TABLES_2026.QC?.brackets).toEqual(
      PROVINCIAL_TAX_TABLES_2025.QC?.brackets
    );
  });
});

describe('Provincial credit tables (2026) — doc-19 §5 values', () => {
  it('Ontario age amount = 6342, pension amount = 1796 (#2026-on-age-amount / #2026-on-pension-income-amount)', () => {
    expect(AGE_CREDIT_2026.ON.ageAmount).toBe(6342);
    expect(PENSION_INCOME_CREDIT_2026.ON.maxAmount).toBe(1796);
  });

  it('BC age amount = 5824, Alberta age amount = 6151, Alberta pension = 1667', () => {
    expect(AGE_CREDIT_2026.BC.ageAmount).toBe(5824);
    expect(AGE_CREDIT_2026.AB.ageAmount).toBe(6151);
    expect(PENSION_INCOME_CREDIT_2026.AB.maxAmount).toBe(1667);
  });

  it('federal 2026 age amount = 9208, threshold = 45522', () => {
    expect(AGE_CREDIT_2026.federal.ageAmount).toBe(9208);
    expect(AGE_CREDIT_2026.federal.incomeThreshold).toBe(45522);
  });

  it('Quebec AREL 2026: age 3470, retirement 3470, creditRate 0.14', () => {
    expect(AREL_2026.QC.ageAmount).toBe(3470);
    expect(AREL_2026.QC.retirementIncomeAmount).toBe(3470);
    expect(AREL_2026.QC.creditRate).toBe(0.14);
  });

  it('year-aware getters return the 2026 set for 2026+ and the 2024 set otherwise', () => {
    expect(getAgeCreditTable(2026).ON.ageAmount).toBe(6342);
    expect(getAgeCreditTable(2024).ON.ageAmount).toBe(6026);
    expect(getPensionIncomeCreditTable(2026).ON.maxAmount).toBe(1796);
    expect(getPensionIncomeCreditTable(2025).ON.maxAmount).toBe(1671);
    expect(getARELTable(2026).QC.ageAmount).toBe(3470);
    expect(getARELTable(2024).QC.ageAmount).toBe(3614);
  });
});
