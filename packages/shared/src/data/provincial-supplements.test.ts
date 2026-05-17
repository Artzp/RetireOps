/**
 * Provincial supplements sanity check (Phase 19, PARAM-05).
 *
 * Verifies PROVINCIAL_SUPPLEMENTS_2026 has exactly the 13 ProvinceCode keys —
 * no missing, no duplicates, no extras. Set equality test against PROVINCE_CODES.
 *
 * @see .planning/phases/19-parameter-consolidation/19-CONTEXT.md (D-13, D-10)
 */
import { describe, it, expect } from 'vitest';
import { PROVINCIAL_SUPPLEMENTS_2026 } from './provincial-supplements.js';
import { PROVINCE_CODES, type ProvinceCode } from '../types/province.js';

describe('PROVINCIAL_SUPPLEMENTS_2026 sanity check (PARAM-05)', () => {
  it('covers all 13 ProvinceCode jurisdictions — no missing, no extras', () => {
    const tableKeys = (Object.keys(PROVINCIAL_SUPPLEMENTS_2026) as ProvinceCode[]).sort();
    const canonicalKeys = [...PROVINCE_CODES].sort();
    expect(tableKeys).toEqual(canonicalKeys);
  });

  it('has no duplicate province keys', () => {
    const keys = Object.keys(PROVINCIAL_SUPPLEMENTS_2026);
    expect(keys.length).toBe(new Set(keys).size);
  });

  it('QC is present as an empty array (no Tier-A cash supplements; D-10)', () => {
    expect(PROVINCIAL_SUPPLEMENTS_2026.QC).toEqual([]);
  });

  it('every program record carries both confidence and accounting discriminators (PARAM-02)', () => {
    const allPrograms = Object.values(PROVINCIAL_SUPPLEMENTS_2026).flat();
    for (const program of allPrograms) {
      expect(
        ['confirmed', 'estimated', 'frozen-since-2023', 'not-yet-confirmed-for-2026'],
        `program ${program.name} (${program.province}) has invalid confidence: ${program.confidence}`
      ).toContain(program.confidence);
      expect(
        ['perPerson', 'perCouple'],
        `program ${program.name} (${program.province}) has invalid accounting: ${program.accounting}`
      ).toContain(program.accounting);
      expect(program.citationAnchor, `program ${program.name} missing citationAnchor`).toBeTruthy();
    }
  });

  it('every program record citation anchor matches 2026-<province>-<topic> pattern (parser sanity)', () => {
    // Mechanical check: every program's citationAnchor value should match the
    // 2026-<province>-<topic> pattern. The citation-roundtrip test (PARAM-03)
    // verifies each anchor exists in the source doc — this test just ensures
    // the data file is internally consistent.
    const allPrograms = Object.values(PROVINCIAL_SUPPLEMENTS_2026).flat();
    const anchorPattern = /^2026-[a-z]{2}-[a-z0-9-]+$/;
    for (const program of allPrograms) {
      expect(
        program.citationAnchor.match(anchorPattern),
        `program ${program.name} citationAnchor "${program.citationAnchor}" does not match 2026-<province>-<topic> pattern`
      ).toBeTruthy();
    }
  });
});
