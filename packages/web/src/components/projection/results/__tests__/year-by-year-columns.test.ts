/**
 * Unit tests for the year-by-year column registry.
 *
 * @see ../year-by-year-columns.ts
 * @see .planning/phases/12-yearbyyear-column-registry/12-03-PLAN.md
 */

import { describe, it, expect } from 'vitest';
import {
  COLUMN_REGISTRY,
  selectVisibleColumns,
  selectVisibleSuperGroupColumns,
  SUPER_GROUP_ORDER,
  INCOME_SUB_GROUP_ORDER,
  IDENTITY_AND_RATE_EXEMPTIONS,
  tdClassNameFor,
  isMergedRrifCell,
  type ColumnDef,
  type SparseFlags,
  type ColumnGroup,
  type PersonOwner,
  type SuperGroup,
  type SubGroup,
} from '../year-by-year-columns';
import { MONETARY_FIELDS } from '@retireops/shared';

const SPARSE_OFF: SparseFlags = {
  hasGis: false,
  hasLif: false,
  hasLiraBalance: false,
  hasLifBalance: false,
  hasPensionSplit: false,
  hasBracketFill: false,
  hasOverContributionPenalty: false,
};

const SPARSE_ON: SparseFlags = {
  hasGis: true,
  hasLif: true,
  hasLiraBalance: true,
  hasLifBalance: true,
  hasPensionSplit: true,
  hasBracketFill: true,
  hasOverContributionPenalty: true,
};

const ALL_GROUPS = new Set<Exclude<ColumnGroup, 'identity'>>([
  'income',
  'taxes',
  'spending',
  'balances',
]);

function args(overrides: {
  visibleGroups?: Set<Exclude<ColumnGroup, 'identity'>>;
  effectiveOwner: PersonOwner;
  isCouple: boolean;
  sparseFlags?: SparseFlags;
}) {
  return {
    visibleGroups: overrides.visibleGroups ?? ALL_GROUPS,
    effectiveOwner: overrides.effectiveOwner,
    isCouple: overrides.isCouple,
    sparseFlags: overrides.sparseFlags ?? SPARSE_OFF,
  };
}

describe('COLUMN_REGISTRY shape', () => {
  it('every entry has key, group, label, showFor, accessor, formatter', () => {
    for (const col of COLUMN_REGISTRY) {
      expect(typeof col.key).toBe('string');
      expect(['identity', 'income', 'taxes', 'spending', 'balances']).toContain(col.group);
      expect(typeof col.label).toBe('string');
      expect(Array.isArray(col.showFor)).toBe(true);
      expect(typeof col.accessor).toBe('function');
      expect(typeof col.formatter).toBe('function');
    }
  });

  it('keys are unique', () => {
    const keys = COLUMN_REGISTRY.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every monetary key is present in MONETARY_FIELDS (or is an explicit identity/rate exemption)', () => {
    const monetaryFieldsSet = new Set(MONETARY_FIELDS);
    const exemptions = new Set(IDENTITY_AND_RATE_EXEMPTIONS);
    for (const col of COLUMN_REGISTRY) {
      if (exemptions.has(col.key)) continue;
      expect(
        monetaryFieldsSet.has(col.key as (typeof MONETARY_FIELDS)[number]),
        `Registry key '${col.key}' is not in MONETARY_FIELDS and not in IDENTITY_AND_RATE_EXEMPTIONS`
      ).toBe(true);
    }
  });
});

describe('selectVisibleColumns — visibility scenarios', () => {
  it('single, sparse all-off → 23 columns (year, age + 8 income + 5 taxes + 3 spending + 5 balances)', () => {
    const cols = selectVisibleColumns(
      undefined,
      args({ effectiveOwner: 'primary', isCouple: false })
    );
    expect(cols.length).toBe(23);
    const keys = cols.map((c) => c.key);
    expect(keys).toContain('year');
    expect(keys).toContain('age');
    expect(keys).toContain('debtPayments');
    expect(keys).not.toContain('spouseAge');
    expect(keys).not.toContain('gisIncome');
    expect(keys).not.toContain('lifWithdrawal');
    expect(keys).not.toContain('overContributionPenalty');
    expect(keys).not.toContain('liraBalance');
    expect(keys).not.toContain('lifBalance');
  });

  it('couple-household, sparse all-off → 43 columns', () => {
    const cols = selectVisibleColumns(
      undefined,
      args({ effectiveOwner: 'household', isCouple: true })
    );
    // identity 3 + income 8+7 (no pension-split, no bracket-fill) + taxes 5+4 + spending 3+2+1 + balances 5+4+1 = 43
    expect(cols.length).toBe(43);
    const keys = cols.map((c) => c.key);
    expect(keys).toContain('spouseAge');
    expect(keys).toContain('householdNetCashFlow');
    expect(keys).toContain('householdNetWorth');
  });

  it('couple-primary view, sparse all-off → 23 columns (spouse hidden, household hidden)', () => {
    const cols = selectVisibleColumns(
      undefined,
      args({ effectiveOwner: 'primary', isCouple: true })
    );
    // identity year+age (spouseAge requires spouse/household effectiveOwner) + 8 income + 5 taxes + 3 spending + 5 balances = 23
    expect(cols.length).toBe(23);
    const keys = cols.map((c) => c.key);
    expect(keys).not.toContain('spouseAge');
    expect(keys).not.toContain('householdNetCashFlow');
    expect(keys).not.toContain('spouseEmploymentIncome');
  });

  it('couple-spouse view, sparse all-off → 20 columns (year, age, spouseAge + 7 income + 4 taxes + 2 spending + 4 balances)', () => {
    const cols = selectVisibleColumns(
      undefined,
      args({ effectiveOwner: 'spouse', isCouple: true })
    );
    expect(cols.length).toBe(20);
    const keys = cols.map((c) => c.key);
    expect(keys).toContain('spouseAge');
    expect(keys).toContain('spouseEmploymentIncome');
    expect(keys).not.toContain('employmentIncome');
    expect(keys).not.toContain('householdNetCashFlow');
  });

  it('couple-household, sparse all-on → 54 columns', () => {
    const cols = selectVisibleColumns(
      undefined,
      args({ effectiveOwner: 'household', isCouple: true, sparseFlags: SPARSE_ON })
    );
    // 43 baseline + 8 income (gis, lif, 4 pension-split, 2 bracket-fill) + 1 OC penalty + 2 balances (lira, lif) = 54
    expect(cols.length).toBe(54);
    const keys = cols.map((c) => c.key);
    expect(keys).toContain('gisIncome');
    expect(keys).toContain('lifWithdrawal');
    expect(keys).toContain('pensionIncomeReceived');
    expect(keys).toContain('pensionIncomeTransferred');
    expect(keys).toContain('pensionSplitPercentage');
    expect(keys).toContain('pensionSplitTaxSavings');
    expect(keys).toContain('bracketFillWithdrawal');
    expect(keys).toContain('spouseBracketFillWithdrawal');
    expect(keys).toContain('overContributionPenalty');
    expect(keys).toContain('liraBalance');
    expect(keys).toContain('lifBalance');
  });

  it('visibleGroups gating: only "income" → identity + income only', () => {
    const cols = selectVisibleColumns(undefined, {
      visibleGroups: new Set(['income']),
      effectiveOwner: 'household',
      isCouple: true,
      sparseFlags: SPARSE_OFF,
    });
    const groups = new Set(cols.map((c) => c.group));
    expect(groups.has('identity')).toBe(true);
    expect(groups.has('income')).toBe(true);
    expect(groups.has('taxes')).toBe(false);
    expect(groups.has('spending')).toBe(false);
    expect(groups.has('balances')).toBe(false);
  });

  it('group="income" filter → only income columns (no identity, no other groups)', () => {
    const cols = selectVisibleColumns(
      'income',
      args({ effectiveOwner: 'household', isCouple: true })
    );
    for (const c of cols) {
      expect(c.group).toBe('income');
    }
    expect(cols.length).toBeGreaterThan(0);
  });
});

describe('tdClassNameFor', () => {
  function colWith(overrides: Partial<ColumnDef> & Pick<ColumnDef, 'key' | 'group'>): ColumnDef {
    return {
      label: 'Test',
      showFor: ['primary'],
      accessor: () => 0,
      formatter: (v) => String(v ?? ''),
      // Phase 13 / HDR-grouping — superGroup is now required on ColumnDef. tdClassNameFor
      // does not read it, so this default keeps the existing fixtures typing-clean.
      superGroup: 'Tax',
      ...overrides,
    };
  }

  it('Year cell includes sticky-left + bg-inherit', () => {
    const cls = tdClassNameFor(colWith({ key: 'year', group: 'identity' }));
    expect(cls).toContain('sticky left-0 z-10');
    expect(cls).toContain('bg-inherit');
    expect(cls).toContain('tabular-nums');
  });

  it('Age and Sp. Age use plain identity className (no text-right)', () => {
    expect(tdClassNameFor(colWith({ key: 'age', group: 'identity' }))).toBe(
      'py-2 px-2 tabular-nums'
    );
    expect(tdClassNameFor(colWith({ key: 'spouseAge', group: 'identity' }))).toBe(
      'py-2 px-2 tabular-nums'
    );
  });

  it('federalTax (taxes group) includes text-ds-error but not font-medium', () => {
    const cls = tdClassNameFor(colWith({ key: 'federalTax', group: 'taxes' }));
    expect(cls).toContain('text-ds-error');
    expect(cls).not.toContain('font-medium');
  });

  it('totalTax includes text-ds-error font-medium', () => {
    const cls = tdClassNameFor(colWith({ key: 'totalTax', group: 'taxes' }));
    expect(cls).toContain('text-ds-error');
    expect(cls).toContain('font-medium');
  });

  it('overContributionPenalty includes text-ds-error font-medium', () => {
    const cls = tdClassNameFor(colWith({ key: 'overContributionPenalty', group: 'taxes' }));
    expect(cls).toContain('text-ds-error');
    expect(cls).toContain('font-medium');
  });

  it('pensionSplitTaxSavings uses text-ds-primary', () => {
    const cls = tdClassNameFor(colWith({ key: 'pensionSplitTaxSavings', group: 'income' }));
    expect(cls).toContain('text-ds-primary');
  });

  it('totalGrossIncome and totalNetWorth use font-medium', () => {
    expect(tdClassNameFor(colWith({ key: 'totalGrossIncome', group: 'income' }))).toContain(
      'font-medium'
    );
    expect(tdClassNameFor(colWith({ key: 'totalNetWorth', group: 'balances' }))).toContain(
      'font-medium'
    );
  });

  it('householdNetWorth uses font-bold', () => {
    expect(tdClassNameFor(colWith({ key: 'householdNetWorth', group: 'balances' }))).toContain(
      'font-bold'
    );
  });

  it('default monetary cell (e.g. gisIncome) returns base text-right tabular-nums', () => {
    expect(tdClassNameFor(colWith({ key: 'gisIncome', group: 'income' }))).toBe(
      'py-2 px-2 text-right tabular-nums'
    );
  });

  it('effectiveTaxRate (taxes group) does NOT add text-ds-error', () => {
    const cls = tdClassNameFor(colWith({ key: 'effectiveTaxRate', group: 'taxes' }));
    expect(cls).not.toContain('text-ds-error');
  });
});

describe('isMergedRrifCell', () => {
  it('returns true for rrifWithdrawal', () => {
    expect(isMergedRrifCell({ key: 'rrifWithdrawal' } as ColumnDef)).toBe(true);
  });

  it('returns true for spouseRrifWithdrawal', () => {
    expect(isMergedRrifCell({ key: 'spouseRrifWithdrawal' } as ColumnDef)).toBe(true);
  });

  it('returns false for non-RRIF withdrawal columns', () => {
    expect(isMergedRrifCell({ key: 'tfsaWithdrawal' } as ColumnDef)).toBe(false);
    expect(isMergedRrifCell({ key: 'lifWithdrawal' } as ColumnDef)).toBe(false);
    expect(isMergedRrifCell({ key: 'rrifBalance' } as ColumnDef)).toBe(false);
  });
});

// -----------------------------------------------------------------------
// Phase 13 / HDR-grouping — super-group + sub-group taxonomy assertions.
// Mirrors the locked bucket assignments in 13-CONTEXT.md §Decisions.
// -----------------------------------------------------------------------

const VALID_SUPER_GROUPS: ReadonlyArray<SuperGroup> = [
  'Age',
  'Income',
  'Tax',
  'Capital Assets',
  'Balance',
];

const VALID_SUB_GROUPS: ReadonlyArray<SubGroup> = ['Active', 'Passive', 'Non-Taxable'];

const EXPECTED_SUPER_GROUP_COUNTS: Record<SuperGroup, number> = {
  Age: 3,
  Income: 23,
  Tax: 10,
  'Capital Assets': 10,
  Balance: 8,
};

const EXPECTED_SUB_GROUP_COUNTS: Record<SubGroup, number> = {
  Active: 2,
  Passive: 18,
  'Non-Taxable': 3,
};

describe('COLUMN_REGISTRY super-group / sub-group taxonomy', () => {
  it('every entry has a valid superGroup', () => {
    for (const col of COLUMN_REGISTRY) {
      expect(VALID_SUPER_GROUPS).toContain(col.superGroup);
    }
  });

  it('every Income entry has a valid subGroup', () => {
    for (const col of COLUMN_REGISTRY) {
      if (col.superGroup === 'Income') {
        expect(col.subGroup).toBeDefined();
        expect(VALID_SUB_GROUPS).toContain(col.subGroup as SubGroup);
      }
    }
  });

  it('every non-Income entry has subGroup undefined', () => {
    for (const col of COLUMN_REGISTRY) {
      if (col.superGroup !== 'Income') {
        expect(col.subGroup).toBeUndefined();
      }
    }
  });

  it('super-group bucket counts match the locked spec (total 54)', () => {
    const counts: Record<SuperGroup, number> = {
      Age: 0,
      Income: 0,
      Tax: 0,
      'Capital Assets': 0,
      Balance: 0,
    };
    for (const col of COLUMN_REGISTRY) {
      counts[col.superGroup] += 1;
    }
    expect(counts).toEqual(EXPECTED_SUPER_GROUP_COUNTS);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(54);
  });

  it('Income sub-group bucket counts match the locked spec (total 23)', () => {
    const counts: Record<SubGroup, number> = {
      Active: 0,
      Passive: 0,
      'Non-Taxable': 0,
    };
    for (const col of COLUMN_REGISTRY) {
      if (col.superGroup === 'Income' && col.subGroup !== undefined) {
        counts[col.subGroup] += 1;
      }
    }
    expect(counts).toEqual(EXPECTED_SUB_GROUP_COUNTS);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(23);
  });

  it('legacy group field is preserved on every entry (Phase 14 migration runway)', () => {
    // Phase 13 keeps `group` alongside `superGroup`; Phase 14 migrates rendering.
    for (const col of COLUMN_REGISTRY) {
      expect(['identity', 'income', 'taxes', 'spending', 'balances']).toContain(col.group);
    }
  });
});

// -----------------------------------------------------------------------
// Phase 14 / HDR-grouping — render-order constants + super-group helper.
// Covers the new exports added in Plan 14-01 to drive the 3-row sticky
// header in YearByYearTab.tsx (Plan 14-02 is the consumer).
// -----------------------------------------------------------------------

describe('SUPER_GROUP_ORDER', () => {
  it('contains the five super-groups in render order', () => {
    expect([...SUPER_GROUP_ORDER]).toEqual(['Age', 'Income', 'Tax', 'Capital Assets', 'Balance']);
  });

  it('covers every superGroup value present in COLUMN_REGISTRY', () => {
    const present = new Set(COLUMN_REGISTRY.map((c) => c.superGroup));
    for (const sg of present) {
      expect(SUPER_GROUP_ORDER).toContain(sg);
    }
  });
});

describe('INCOME_SUB_GROUP_ORDER', () => {
  it('contains the three Income sub-groups in render order', () => {
    expect([...INCOME_SUB_GROUP_ORDER]).toEqual(['Active', 'Passive', 'Non-Taxable']);
  });

  it('covers every subGroup value used by Income entries in COLUMN_REGISTRY', () => {
    const present = new Set(
      COLUMN_REGISTRY.filter((c) => c.superGroup === 'Income' && c.subGroup !== undefined).map(
        (c) => c.subGroup as SubGroup
      )
    );
    for (const sg of present) {
      expect(INCOME_SUB_GROUP_ORDER).toContain(sg);
    }
  });
});

describe('selectVisibleSuperGroupColumns', () => {
  it('returns identity columns for the Age super-group (household couple, sparse OFF)', () => {
    const a = args({ effectiveOwner: 'household', isCouple: true });
    const fromHelper = selectVisibleSuperGroupColumns('Age', a).map((c) => c.key);
    const fromLegacy = selectVisibleColumns('identity', a).map((c) => c.key);
    expect(fromHelper).toEqual(fromLegacy);
  });

  it('returns the same Income column SET as selectVisibleColumns("income") (order differs — see CR-02)', () => {
    // Phase 14 / CR-02 fix: Income super-group is now sorted sub-group-first
    // (Active → Passive → Non-Taxable) so Row 2 sub-group <th colSpan> values
    // align with the columns they label. The legacy selectVisibleColumns('income',
    // ...) preserves registry order. The two helpers must therefore produce the
    // same SET of columns but NOT the same order.
    const a = args({ effectiveOwner: 'household', isCouple: true });
    const fromHelper = selectVisibleSuperGroupColumns('Income', a).map((c) => c.key);
    const fromLegacy = selectVisibleColumns('income', a).map((c) => c.key);
    expect(new Set(fromHelper)).toEqual(new Set(fromLegacy));
    expect(fromHelper.length).toBe(fromLegacy.length);
  });

  it('Income columns are sub-group-contiguous in INCOME_SUB_GROUP_ORDER (CR-02 fix)', () => {
    const a = args({ effectiveOwner: 'household', isCouple: true, sparseFlags: SPARSE_ON });
    const cols = selectVisibleSuperGroupColumns('Income', a);
    // Build the run-length-encoded sub-group sequence and assert each sub-group
    // appears at most once (i.e. no interleaving) and in the order declared by
    // INCOME_SUB_GROUP_ORDER.
    const seen: SubGroup[] = [];
    let prev: SubGroup | undefined;
    for (const col of cols) {
      const sg = col.subGroup as SubGroup;
      if (sg !== prev) {
        seen.push(sg);
        prev = sg;
      }
    }
    // No sub-group repeats (each appears once)
    expect(new Set(seen).size).toBe(seen.length);
    // Every observed sub-group is in INCOME_SUB_GROUP_ORDER and in declared order
    const expectedRanks = seen.map((sg) => INCOME_SUB_GROUP_ORDER.indexOf(sg));
    for (let i = 1; i < expectedRanks.length; i++) {
      expect(expectedRanks[i]).toBeGreaterThan(expectedRanks[i - 1] as number);
    }
  });

  it('respects the visibleGroups gate — Income hidden returns empty', () => {
    const a = args({
      effectiveOwner: 'household',
      isCouple: true,
      visibleGroups: new Set<Exclude<ColumnGroup, 'identity'>>(['taxes']),
    });
    expect(selectVisibleSuperGroupColumns('Income', a)).toEqual([]);
  });

  it('respects the sparse-flag gate — GIS only when hasGis is true', () => {
    const off = args({ effectiveOwner: 'household', isCouple: true, sparseFlags: SPARSE_OFF });
    const on = args({ effectiveOwner: 'household', isCouple: true, sparseFlags: SPARSE_ON });
    const offKeys = selectVisibleSuperGroupColumns('Income', off).map((c) => c.key);
    const onKeys = selectVisibleSuperGroupColumns('Income', on).map((c) => c.key);
    expect(offKeys).not.toContain('gisIncome');
    expect(onKeys).toContain('gisIncome');
  });

  it('respects the owner gate — primary view drops spouse-only Income columns', () => {
    const a = args({ effectiveOwner: 'primary', isCouple: true });
    const keys = selectVisibleSuperGroupColumns('Income', a).map((c) => c.key);
    expect(keys).not.toContain('spouseEmploymentIncome');
    expect(keys).not.toContain('spouseCppIncome');
  });

  it('non-Income super-groups return columns in registry order (indices strictly increasing)', () => {
    // Income is sub-group-sorted (CR-02 fix); the other super-groups stay in pure
    // registry order. Verify monotonic registry indices for each non-Income
    // super-group under SPARSE_ON household-couple.
    const a = args({ effectiveOwner: 'household', isCouple: true, sparseFlags: SPARSE_ON });
    for (const sg of SUPER_GROUP_ORDER.filter((s) => s !== 'Income')) {
      const cols = selectVisibleSuperGroupColumns(sg, a);
      const indices = cols.map((c) => COLUMN_REGISTRY.findIndex((r) => r.key === c.key));
      for (let i = 1; i < indices.length; i++) {
        expect(indices[i]).toBeGreaterThan(indices[i - 1] as number);
      }
    }
  });

  it('Income columns: registry indices are strictly increasing within each sub-group', () => {
    // Phase 14 / CR-02: Income is sub-group-first sorted; within each sub-group
    // the secondary sort is original registry index (preserves owner ordering).
    const a = args({ effectiveOwner: 'household', isCouple: true, sparseFlags: SPARSE_ON });
    const cols = selectVisibleSuperGroupColumns('Income', a);
    const bySg = new Map<SubGroup, number[]>();
    for (const col of cols) {
      const sg = col.subGroup as SubGroup;
      const idx = COLUMN_REGISTRY.findIndex((r) => r.key === col.key);
      const list = bySg.get(sg) ?? [];
      list.push(idx);
      bySg.set(sg, list);
    }
    for (const [, indices] of bySg) {
      for (let i = 1; i < indices.length; i++) {
        expect(indices[i]).toBeGreaterThan(indices[i - 1] as number);
      }
    }
  });

  // -----------------------------------------------------------------------
  // Phase 14 / WR-01 — divergence test for Capital Assets + Balance vs the
  // legacy spending + balances groups. selectVisibleSuperGroupColumns and
  // selectVisibleColumns should yield the SAME SET of columns under those
  // labels but in DIFFERENT orders, because livingExpenses / netCashFlow live
  // in group:'spending' but superGroup:'Balance' (and totalNetWorth /
  // householdNetWorth live in group:'balances' but superGroup:'Balance').
  //
  // This test would have caught CR-01 at unit-test time: when the body still
  // iterated by legacy `group` while the header iterated by `superGroup`, the
  // two key sequences diverged across the spending/balances boundary, producing
  // misaligned labels in the rendered DOM.
  // -----------------------------------------------------------------------
  it('Capital Assets + Balance super-groups have a different concatenated key order than spending + balances legacy groups (CR-01 regression guard)', () => {
    const a = args({ effectiveOwner: 'household', isCouple: true });
    const fromSuper = [
      ...selectVisibleSuperGroupColumns('Capital Assets', a),
      ...selectVisibleSuperGroupColumns('Balance', a),
    ].map((c) => c.key);
    const fromLegacy = [
      ...selectVisibleColumns('spending', a),
      ...selectVisibleColumns('balances', a),
    ].map((c) => c.key);
    expect(fromSuper).not.toEqual(fromLegacy);
    expect(new Set(fromSuper)).toEqual(new Set(fromLegacy));
  });
});
