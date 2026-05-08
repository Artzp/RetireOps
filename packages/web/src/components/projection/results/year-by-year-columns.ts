/**
 * year-by-year-columns — Phase 12 / UI-04 column registry.
 *
 * Single source of truth for the YearByYearTab column metadata. Header rendering
 * and column-count math both consume this registry; body rendering uses it for
 * cell visibility lookup while keeping per-cell richness (provenance, overrides,
 * clamp, badges) in YearByYearTab.tsx.
 *
 * Monetary `key` values must align with `MONETARY_FIELDS` from `@retireops/shared`
 * (the canonical inflation/display contract). Identity, rate, and OC-penalty keys
 * are explicit exemptions documented in IDENTITY_AND_RATE_EXEMPTIONS below.
 *
 * @see .planning/phases/12-yearbyyear-column-registry/12-CONTEXT.md
 * @see packages/shared/src/constants/inflation-display.ts (MONETARY_FIELDS)
 */

import type { ProjectionYearRow } from '@retireops/shared';
import { formatCurrency } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ColumnGroup = 'identity' | 'income' | 'taxes' | 'spending' | 'balances';
export type PersonOwner = 'primary' | 'spouse' | 'household';

// Phase 13 / HDR-grouping — v4.4 super-group taxonomy. Drives the 3-row sticky header
// colSpan math in YearByYearTab.tsx (Phase 14 consumes; Phase 13 only adds metadata).
export type SuperGroup = 'Age' | 'Income' | 'Tax' | 'Capital Assets' | 'Balance';

// Phase 13 / HDR-grouping — Income sub-group taxonomy. Present only on Income entries.
export type SubGroup = 'Active' | 'Passive' | 'Non-Taxable';

export interface SparseFlags {
  hasGis: boolean;
  hasLif: boolean;
  hasLiraBalance: boolean;
  hasLifBalance: boolean;
  hasPensionSplit: boolean;
  hasBracketFill: boolean;
  hasOverContributionPenalty: boolean;
}

export interface ColumnDef {
  /** Stable identifier — for monetary columns this MUST be a key from MONETARY_FIELDS. */
  key: string;
  /** Which group's <thead> this lives under (drives colSpan math). */
  group: ColumnGroup;
  /** Phase 13 / HDR-grouping — super-group taxonomy for the v4.4 grouped header. */
  superGroup: SuperGroup;
  /**
   * Phase 13 / HDR-grouping — Income sub-group; present only when superGroup === 'Income'.
   * v4.4 keeps Age / Tax / Capital Assets / Balance flat (no sub-groups).
   */
  subGroup?: SubGroup;
  /** Header text rendered in the column header row. */
  label: string;
  /** Optional title attribute on <th> (used today for pension-split + bracket-fill columns). */
  title?: string;
  /** Owner-axis visibility — column is visible only when effectiveOwner ∈ showFor. */
  showFor: ReadonlyArray<PersonOwner>;
  /** Pure read of value from a row — null for identity-only columns. */
  accessor: (row: ProjectionYearRow) => number | string | null | undefined;
  /** Pure formatter for the accessor's value. Returns the display string used by header tooling/legends. */
  formatter: (value: number | string | null | undefined) => string;
  /** When defined, column is conditionally visible based on sparse flags. */
  sparseCheck?: (flags: SparseFlags) => boolean;
}

export interface SelectVisibleColumnsArgs {
  visibleGroups: Set<Exclude<ColumnGroup, 'identity'>>;
  effectiveOwner: PersonOwner;
  isCouple: boolean;
  sparseFlags: SparseFlags;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

const fmtMoney = (v: number | string | null | undefined): string =>
  formatCurrency(typeof v === 'number' ? v : 0);

const fmtIdentity = (v: number | string | null | undefined): string =>
  v === null || v === undefined ? '—' : String(v);

const fmtPercent = (v: number | string | null | undefined): string => {
  const n = typeof v === 'number' ? v : 0;
  return `${(n * 100).toFixed(1)}%`;
};

const fmtOcPenalty = (v: number | string | null | undefined): string => {
  const n = typeof v === 'number' ? v : 0;
  return n > 0 ? formatCurrency(n) : '—';
};

// ---------------------------------------------------------------------------
// Identity / rate / penalty keys that are NOT in MONETARY_FIELDS
// (test #2 in year-by-year-columns.test.ts uses this list as the exemption set)
// ---------------------------------------------------------------------------

export const IDENTITY_AND_RATE_EXEMPTIONS: ReadonlyArray<string> = [
  'year',
  'age',
  'spouseAge',
  'effectiveTaxRate',
  'spouseEffectiveTaxRate',
  'pensionSplitPercentage',
  'overContributionPenalty',
];

// ---------------------------------------------------------------------------
// Registry
//
// Order MUST mirror the existing render order in YearByYearTab.tsx <thead>
// so that downstream colSpan math via selectVisibleColumns(group).length
// matches the legacy header output.
// ---------------------------------------------------------------------------

export const COLUMN_REGISTRY: ReadonlyArray<ColumnDef> = [
  // ---- Identity ----
  {
    key: 'year',
    group: 'identity',
    superGroup: 'Age',
    label: 'Year',
    showFor: ['primary', 'spouse', 'household'],
    accessor: (r) => r.year,
    formatter: fmtIdentity,
  },
  {
    key: 'age',
    group: 'identity',
    superGroup: 'Age',
    label: 'Age',
    showFor: ['primary', 'spouse', 'household'],
    accessor: (r) => r.age,
    formatter: fmtIdentity,
  },
  {
    key: 'spouseAge',
    group: 'identity',
    superGroup: 'Age',
    label: 'Spouse Age',
    showFor: ['spouse', 'household'],
    accessor: (r) => r.spouseAge,
    formatter: fmtIdentity,
  },

  // ---- Income — primary ----
  {
    key: 'employmentIncome',
    group: 'income',
    superGroup: 'Income',
    subGroup: 'Active',
    label: 'Employment',
    showFor: ['primary', 'household'],
    accessor: (r) => r.employmentIncome,
    formatter: fmtMoney,
  },
  {
    key: 'pensionIncome',
    group: 'income',
    superGroup: 'Income',
    subGroup: 'Passive',
    label: 'Pension',
    showFor: ['primary', 'household'],
    accessor: (r) => r.pensionIncome,
    formatter: fmtMoney,
  },
  {
    key: 'cppIncome',
    group: 'income',
    superGroup: 'Income',
    subGroup: 'Passive',
    label: 'CPP',
    showFor: ['primary', 'household'],
    accessor: (r) => r.cppIncome,
    formatter: fmtMoney,
  },
  {
    key: 'oasIncome',
    group: 'income',
    superGroup: 'Income',
    subGroup: 'Passive',
    label: 'OAS Net',
    title: 'OAS retained after recovery tax',
    showFor: ['primary', 'household'],
    accessor: (r) => r.oasIncome,
    formatter: fmtMoney,
  },
  {
    key: 'gisIncome',
    group: 'income',
    superGroup: 'Income',
    subGroup: 'Non-Taxable',
    label: 'GIS',
    showFor: ['primary', 'household'],
    accessor: (r) => r.gisIncome ?? 0,
    formatter: fmtMoney,
    sparseCheck: (f) => f.hasGis,
  },
  {
    key: 'lifWithdrawal',
    group: 'income',
    superGroup: 'Income',
    subGroup: 'Passive',
    label: 'LIF Withdrawal',
    showFor: ['primary', 'household'],
    accessor: (r) => r.lifWithdrawal ?? 0,
    formatter: fmtMoney,
    sparseCheck: (f) => f.hasLif,
  },
  {
    key: 'rrifWithdrawal',
    group: 'income',
    superGroup: 'Income',
    subGroup: 'Passive',
    label: 'RRIF Withdrawal',
    showFor: ['primary', 'household'],
    accessor: (r) => r.rrifWithdrawal,
    formatter: fmtMoney,
  },
  {
    key: 'tfsaWithdrawal',
    group: 'income',
    superGroup: 'Income',
    subGroup: 'Non-Taxable',
    label: 'TFSA Withdrawal',
    showFor: ['primary', 'household'],
    accessor: (r) => r.tfsaWithdrawal,
    formatter: fmtMoney,
  },
  {
    key: 'nonRegWithdrawal',
    group: 'income',
    superGroup: 'Income',
    subGroup: 'Passive',
    label: 'Non-Reg Withdrawal',
    showFor: ['primary', 'household'],
    accessor: (r) => r.nonRegWithdrawal,
    formatter: fmtMoney,
  },
  {
    key: 'totalGrossIncome',
    group: 'income',
    superGroup: 'Income',
    subGroup: 'Passive',
    label: 'Total Income',
    showFor: ['primary', 'household'],
    accessor: (r) => r.totalGrossIncome,
    formatter: fmtMoney,
  },

  // ---- Income — spouse ----
  {
    key: 'spouseEmploymentIncome',
    group: 'income',
    superGroup: 'Income',
    subGroup: 'Active',
    label: 'Spouse Employment',
    showFor: ['spouse', 'household'],
    accessor: (r) => r.spouseEmploymentIncome ?? 0,
    formatter: fmtMoney,
  },
  {
    key: 'spousePensionIncome',
    group: 'income',
    superGroup: 'Income',
    subGroup: 'Passive',
    label: 'Spouse Pension',
    showFor: ['spouse', 'household'],
    accessor: (r) => r.spousePensionIncome ?? 0,
    formatter: fmtMoney,
  },
  {
    key: 'spouseCppIncome',
    group: 'income',
    superGroup: 'Income',
    subGroup: 'Passive',
    label: 'Spouse CPP',
    showFor: ['spouse', 'household'],
    accessor: (r) => r.spouseCppIncome ?? 0,
    formatter: fmtMoney,
  },
  {
    key: 'spouseOasIncome',
    group: 'income',
    superGroup: 'Income',
    subGroup: 'Passive',
    label: 'Spouse OAS Net',
    title: 'Spouse OAS retained after recovery tax',
    showFor: ['spouse', 'household'],
    accessor: (r) => r.spouseOasIncome ?? 0,
    formatter: fmtMoney,
  },
  {
    key: 'spouseRrifWithdrawal',
    group: 'income',
    superGroup: 'Income',
    subGroup: 'Passive',
    label: 'Spouse RRIF Withdrawal',
    showFor: ['spouse', 'household'],
    accessor: (r) => r.spouseRrifWithdrawal ?? 0,
    formatter: fmtMoney,
  },
  {
    key: 'spouseTfsaWithdrawal',
    group: 'income',
    superGroup: 'Income',
    subGroup: 'Non-Taxable',
    label: 'Spouse TFSA Withdrawal',
    showFor: ['spouse', 'household'],
    accessor: (r) => r.spouseTfsaWithdrawal ?? 0,
    formatter: fmtMoney,
  },
  {
    key: 'spouseNonRegWithdrawal',
    group: 'income',
    superGroup: 'Income',
    subGroup: 'Passive',
    label: 'Spouse Non-Reg Withdrawal',
    showFor: ['spouse', 'household'],
    accessor: (r) => r.spouseNonRegWithdrawal ?? 0,
    formatter: fmtMoney,
  },

  // ---- Income — household pension-split (sparse) ----
  {
    key: 'pensionIncomeReceived',
    group: 'income',
    superGroup: 'Income',
    subGroup: 'Passive',
    label: 'Pension Received',
    title: 'Primary: pension income received from spouse after splitting',
    showFor: ['household'],
    accessor: (r) => r.pensionIncomeReceived ?? 0,
    formatter: fmtMoney,
    sparseCheck: (f) => f.hasPensionSplit,
  },
  {
    key: 'pensionIncomeTransferred',
    group: 'income',
    superGroup: 'Income',
    subGroup: 'Passive',
    label: 'Pension Transferred',
    title: 'Primary: pension income transferred to spouse after splitting',
    showFor: ['household'],
    accessor: (r) => r.pensionIncomeTransferred ?? 0,
    formatter: fmtMoney,
    sparseCheck: (f) => f.hasPensionSplit,
  },
  {
    key: 'pensionSplitPercentage',
    group: 'income',
    superGroup: 'Income',
    subGroup: 'Passive',
    label: 'Split %',
    title: 'Share of eligible pension income split from higher earner to lower',
    showFor: ['household'],
    accessor: (r) => r.pensionSplitPercentage ?? 0,
    formatter: fmtPercent,
    sparseCheck: (f) => f.hasPensionSplit,
  },
  {
    key: 'pensionSplitTaxSavings',
    group: 'income',
    superGroup: 'Income',
    subGroup: 'Passive',
    label: 'Split Tax Savings',
    title: "Household tax savings attributable to the year's pension split",
    showFor: ['household'],
    accessor: (r) => r.pensionSplitTaxSavings ?? 0,
    formatter: fmtMoney,
    sparseCheck: (f) => f.hasPensionSplit,
  },

  // ---- Income — bracket-fill (sparse) ----
  {
    key: 'bracketFillWithdrawal',
    group: 'income',
    superGroup: 'Income',
    subGroup: 'Passive',
    label: 'Bracket-Fill Withdrawal',
    title: 'Bracket-fill voluntary RRSP/RRIF withdrawal this year',
    showFor: ['primary', 'household'],
    accessor: (r) => r.bracketFillWithdrawal ?? 0,
    formatter: fmtMoney,
    sparseCheck: (f) => f.hasBracketFill,
  },
  {
    key: 'spouseBracketFillWithdrawal',
    group: 'income',
    superGroup: 'Income',
    subGroup: 'Passive',
    label: 'Spouse Bracket-Fill',
    title: 'Spouse: bracket-fill voluntary RRSP/RRIF withdrawal this year',
    showFor: ['spouse', 'household'],
    accessor: (r) => r.spouseBracketFillWithdrawal ?? 0,
    formatter: fmtMoney,
    sparseCheck: (f) => f.hasBracketFill,
  },

  // ---- Taxes — primary ----
  {
    key: 'federalTax',
    group: 'taxes',
    superGroup: 'Tax',
    label: 'Federal Tax',
    showFor: ['primary', 'household'],
    accessor: (r) => r.federalTax,
    formatter: fmtMoney,
  },
  {
    key: 'provincialTax',
    group: 'taxes',
    superGroup: 'Tax',
    label: 'Provincial Tax',
    showFor: ['primary', 'household'],
    accessor: (r) => r.provincialTax,
    formatter: fmtMoney,
  },
  {
    key: 'oasClawback',
    group: 'taxes',
    superGroup: 'Tax',
    label: 'OAS Clawback',
    title: 'OAS recovery tax; OAS Net is already reduced by this amount',
    showFor: ['primary', 'household'],
    accessor: (r) => r.oasClawback,
    formatter: fmtMoney,
  },
  {
    key: 'totalTax',
    group: 'taxes',
    superGroup: 'Tax',
    label: 'Income Tax',
    title: 'Federal plus provincial income tax; excludes OAS recovery tax',
    showFor: ['primary', 'household'],
    accessor: (r) => r.totalTax,
    formatter: fmtMoney,
  },
  {
    key: 'effectiveTaxRate',
    group: 'taxes',
    superGroup: 'Tax',
    label: 'Effective Tax Rate',
    showFor: ['primary', 'household'],
    accessor: (r) => r.effectiveTaxRate,
    formatter: fmtPercent,
  },

  // ---- Taxes — spouse ----
  {
    key: 'spouseFederalTax',
    group: 'taxes',
    superGroup: 'Tax',
    label: 'Spouse Federal Tax',
    showFor: ['spouse', 'household'],
    accessor: (r) => r.spouseFederalTax ?? 0,
    formatter: fmtMoney,
  },
  {
    key: 'spouseProvincialTax',
    group: 'taxes',
    superGroup: 'Tax',
    label: 'Spouse Provincial Tax',
    showFor: ['spouse', 'household'],
    accessor: (r) => r.spouseProvincialTax ?? 0,
    formatter: fmtMoney,
  },
  {
    key: 'spouseTotalTax',
    group: 'taxes',
    superGroup: 'Tax',
    label: 'Spouse Income Tax',
    title: 'Spouse federal plus provincial income tax; excludes OAS recovery tax',
    showFor: ['spouse', 'household'],
    accessor: (r) => r.spouseTotalTax ?? 0,
    formatter: fmtMoney,
  },
  {
    key: 'spouseEffectiveTaxRate',
    group: 'taxes',
    superGroup: 'Tax',
    label: 'Spouse Tax Rate',
    showFor: ['spouse', 'household'],
    accessor: (r) => r.spouseEffectiveTaxRate ?? 0,
    formatter: fmtPercent,
  },

  // ---- Taxes — primary OC penalty (sparse) ----
  {
    key: 'overContributionPenalty',
    group: 'taxes',
    superGroup: 'Tax',
    label: 'Over-Contrib. Penalty',
    title: 'CRA over-contribution penalty (RRSP + TFSA + FHSA)',
    showFor: ['primary', 'household'],
    accessor: (r) => {
      const p = r.overContributionPenalty;
      return p ? p.rrsp + p.tfsa + p.fhsa : 0;
    },
    formatter: fmtOcPenalty,
    sparseCheck: (f) => f.hasOverContributionPenalty,
  },

  // ---- Spending — primary ----
  {
    key: 'livingExpenses',
    group: 'spending',
    superGroup: 'Balance',
    label: 'Living Expenses',
    showFor: ['primary', 'household'],
    accessor: (r) => r.livingExpenses,
    formatter: fmtMoney,
  },
  {
    key: 'debtPayments',
    group: 'spending',
    superGroup: 'Balance',
    label: 'Debt Payments',
    showFor: ['primary', 'household'],
    accessor: (r) => r.debtPayments ?? 0,
    formatter: fmtMoney,
  },
  {
    key: 'netCashFlow',
    group: 'spending',
    superGroup: 'Balance',
    label: 'Net Cash Flow',
    showFor: ['primary', 'household'],
    accessor: (r) => r.netCashFlow,
    formatter: fmtMoney,
  },

  // ---- Spending — spouse ----
  {
    key: 'spouseLivingExpenses',
    group: 'spending',
    superGroup: 'Balance',
    label: 'Spouse Living Expenses',
    showFor: ['spouse', 'household'],
    accessor: (r) => r.spouseLivingExpenses ?? 0,
    formatter: fmtMoney,
  },
  {
    key: 'spouseNetCashFlow',
    group: 'spending',
    superGroup: 'Balance',
    label: 'Spouse Net Cash Flow',
    showFor: ['spouse', 'household'],
    accessor: (r) => r.spouseNetCashFlow ?? 0,
    formatter: fmtMoney,
  },

  // ---- Spending — household ----
  {
    key: 'householdNetCashFlow',
    group: 'spending',
    superGroup: 'Balance',
    label: 'Household Net Cash Flow',
    showFor: ['household'],
    accessor: (r) => r.householdNetCashFlow,
    formatter: fmtMoney,
  },

  // ---- Balances — primary ----
  {
    key: 'rrspBalance',
    group: 'balances',
    superGroup: 'Capital Assets',
    label: 'RRSP',
    showFor: ['primary', 'household'],
    accessor: (r) => r.rrspBalance,
    formatter: fmtMoney,
  },
  {
    key: 'rrifBalance',
    group: 'balances',
    superGroup: 'Capital Assets',
    label: 'RRIF',
    showFor: ['primary', 'household'],
    accessor: (r) => r.rrifBalance,
    formatter: fmtMoney,
  },
  {
    key: 'liraBalance',
    group: 'balances',
    superGroup: 'Capital Assets',
    label: 'LIRA',
    showFor: ['primary', 'household'],
    accessor: (r) => r.liraBalance ?? 0,
    formatter: fmtMoney,
    sparseCheck: (f) => f.hasLiraBalance,
  },
  {
    key: 'lifBalance',
    group: 'balances',
    superGroup: 'Capital Assets',
    label: 'LIF',
    showFor: ['primary', 'household'],
    accessor: (r) => r.lifBalance ?? 0,
    formatter: fmtMoney,
    sparseCheck: (f) => f.hasLifBalance,
  },
  {
    key: 'tfsaBalance',
    group: 'balances',
    superGroup: 'Capital Assets',
    label: 'TFSA',
    showFor: ['primary', 'household'],
    accessor: (r) => r.tfsaBalance,
    formatter: fmtMoney,
  },
  {
    key: 'nonRegBalance',
    group: 'balances',
    superGroup: 'Capital Assets',
    label: 'Non-Registered',
    showFor: ['primary', 'household'],
    accessor: (r) => r.nonRegBalance,
    formatter: fmtMoney,
  },
  {
    key: 'totalNetWorth',
    group: 'balances',
    superGroup: 'Balance',
    label: 'Net Worth',
    showFor: ['primary', 'household'],
    accessor: (r) => r.totalNetWorth,
    formatter: fmtMoney,
  },

  // ---- Balances — spouse ----
  {
    key: 'spouseRrspBalance',
    group: 'balances',
    superGroup: 'Capital Assets',
    label: 'Spouse RRSP',
    showFor: ['spouse', 'household'],
    accessor: (r) => r.spouseRrspBalance ?? 0,
    formatter: fmtMoney,
  },
  {
    key: 'spouseRrifBalance',
    group: 'balances',
    superGroup: 'Capital Assets',
    label: 'Spouse RRIF',
    showFor: ['spouse', 'household'],
    accessor: (r) => r.spouseRrifBalance ?? 0,
    formatter: fmtMoney,
  },
  {
    key: 'spouseTfsaBalance',
    group: 'balances',
    superGroup: 'Capital Assets',
    label: 'Spouse TFSA',
    showFor: ['spouse', 'household'],
    accessor: (r) => r.spouseTfsaBalance ?? 0,
    formatter: fmtMoney,
  },
  {
    key: 'spouseNonRegBalance',
    group: 'balances',
    superGroup: 'Capital Assets',
    label: 'Spouse Non-Reg',
    showFor: ['spouse', 'household'],
    accessor: (r) => r.spouseNonRegBalance ?? 0,
    formatter: fmtMoney,
  },

  // ---- Balances — household ----
  {
    key: 'householdNetWorth',
    group: 'balances',
    superGroup: 'Balance',
    label: 'Household Net Worth',
    showFor: ['household'],
    accessor: (r) => r.householdNetWorth,
    formatter: fmtMoney,
  },
];

// ---------------------------------------------------------------------------
// selectVisibleColumns
// ---------------------------------------------------------------------------

/**
 * Filter the column registry by group, owner, sparse-flags and visibleGroups.
 *
 * Identity columns are always shown (visibleGroups gating only applies to
 * income/taxes/spending/balances). When `group` is `undefined` the entire
 * registry is filtered; otherwise only that group's columns are considered.
 *
 * Returned order matches registry order — i.e. render order.
 */
export function selectVisibleColumns(
  group: ColumnGroup | undefined,
  args: SelectVisibleColumnsArgs
): ColumnDef[] {
  const { visibleGroups, effectiveOwner, isCouple, sparseFlags } = args;

  return COLUMN_REGISTRY.filter((col) => {
    // Group filter
    if (group !== undefined && col.group !== group) return false;

    // visibleGroups gate (identity is always shown)
    if (col.group !== 'identity' && !visibleGroups.has(col.group)) return false;

    // Owner-axis visibility
    if (!col.showFor.includes(effectiveOwner)) return false;

    // isCouple defensive filter — drop columns whose showFor is spouse/household-only when single
    if (!isCouple && !col.showFor.includes('primary')) return false;

    // Sparse-flag gate
    if (col.sparseCheck && !col.sparseCheck(sparseFlags)) return false;

    return true;
  });
}

// ---------------------------------------------------------------------------
// Phase 14 / HDR-grouping — render-order constants for the 3-row sticky header.
// SUPER_GROUP_ORDER drives Row 1 iteration order AND display labels.
// INCOME_SUB_GROUP_ORDER drives Row 2 iteration order under the Income super-group.
// ---------------------------------------------------------------------------

export const SUPER_GROUP_ORDER: ReadonlyArray<SuperGroup> = [
  'Age',
  'Income',
  'Tax',
  'Capital Assets',
  'Balance',
] as const;

export const INCOME_SUB_GROUP_ORDER: ReadonlyArray<SubGroup> = [
  'Active',
  'Passive',
  'Non-Taxable',
] as const;

// ---------------------------------------------------------------------------
// selectVisibleSuperGroupColumns — Phase 14 / HDR-grouping helper.
//
// Filters the registry by super-group + the same visibility axes used by
// selectVisibleColumns (visibleGroups, owner, isCouple, sparse). Used by the
// 3-row sticky header in YearByYearTab.tsx to drive super-group + sub-group
// colSpan math without hand-coded constants.
//
// NOTE: legacy `selectVisibleColumns(group, args)` is left intact — body code
// in YearByYearTab.tsx still consumes it.
// ---------------------------------------------------------------------------

export function selectVisibleSuperGroupColumns(
  superGroup: SuperGroup,
  args: SelectVisibleColumnsArgs
): ColumnDef[] {
  const { visibleGroups, effectiveOwner, isCouple, sparseFlags } = args;

  // Capture each entry's original registry index so we can apply a stable secondary
  // sort by registry order after the (Income-only) sub-group primary sort below.
  const filtered = COLUMN_REGISTRY.map((col, idx) => ({ col, idx })).filter(({ col }) => {
    // Super-group filter
    if (col.superGroup !== superGroup) return false;

    // visibleGroups gate (identity is always shown — same rule as selectVisibleColumns)
    if (col.group !== 'identity' && !visibleGroups.has(col.group)) return false;

    // Owner-axis visibility
    if (!col.showFor.includes(effectiveOwner)) return false;

    // isCouple defensive filter
    if (!isCouple && !col.showFor.includes('primary')) return false;

    // Sparse-flag gate
    if (col.sparseCheck && !col.sparseCheck(sparseFlags)) return false;

    return true;
  });

  // Phase 14 / CR-02 fix — Income super-group renders sub-group-contiguous so that
  // Row 2 sub-group <th colSpan> values align with the columns they label. Sort
  // primarily by INCOME_SUB_GROUP_ORDER, secondarily by original registry index
  // (preserves owner ordering within each sub-group). All other super-groups are
  // flat (no sub-groups in v4.4) and retain pure registry order.
  if (superGroup === 'Income') {
    filtered.sort((a, b) => {
      const aSg = a.col.subGroup;
      const bSg = b.col.subGroup;
      const aRank =
        aSg === undefined ? INCOME_SUB_GROUP_ORDER.length : INCOME_SUB_GROUP_ORDER.indexOf(aSg);
      const bRank =
        bSg === undefined ? INCOME_SUB_GROUP_ORDER.length : INCOME_SUB_GROUP_ORDER.indexOf(bSg);
      if (aRank !== bRank) return aRank - bRank;
      return a.idx - b.idx;
    });
  }

  return filtered.map(({ col }) => col);
}

// ---------------------------------------------------------------------------
// tdClassNameFor — Plan 12-04 helper.
// Derives the existing per-cell <td> className from a ColumnDef, mirroring
// the rule table extracted from the legacy YearByYearTab body.
// ---------------------------------------------------------------------------

export function tdClassNameFor(col: ColumnDef): string {
  // Sticky Year cell — UI-06 invariant
  if (col.key === 'year') {
    return 'py-2 px-2 sticky left-0 z-10 bg-inherit tabular-nums';
  }
  // Identity (age, spouseAge) — left-aligned tabular-nums
  if (col.key === 'age' || col.key === 'spouseAge') {
    return 'py-2 px-2 tabular-nums';
  }
  // OC penalty + Total Tax — error red, medium weight
  if (col.key === 'overContributionPenalty' || col.key === 'totalTax') {
    return 'py-2 px-2 text-right tabular-nums text-ds-error font-medium';
  }
  // Other taxes-group dollar cells (federalTax, provincialTax, oasClawback,
  // spouseFederalTax, spouseProvincialTax, spouseTotalTax) — error red.
  // Effective rates stay default formatting.
  if (
    col.group === 'taxes' &&
    col.key !== 'effectiveTaxRate' &&
    col.key !== 'spouseEffectiveTaxRate'
  ) {
    return 'py-2 px-2 text-right tabular-nums text-ds-error';
  }
  // Pension-split tax savings — primary brand color
  if (col.key === 'pensionSplitTaxSavings') {
    return 'py-2 px-2 text-right tabular-nums text-ds-primary';
  }
  // Total income / total net worth — medium weight
  if (col.key === 'totalGrossIncome' || col.key === 'totalNetWorth') {
    return 'py-2 px-2 text-right tabular-nums font-medium';
  }
  // Household net worth — bold
  if (col.key === 'householdNetWorth') {
    return 'py-2 px-2 text-right tabular-nums font-bold';
  }
  // Default money cell
  return 'py-2 px-2 text-right tabular-nums';
}

// ---------------------------------------------------------------------------
// isMergedRrifCell — Plan 12-04 helper.
// Predicate for the merged RRIF/RRSP cell. Body code switches between rrif and
// rrsp display based on which balance is present in the row. The merged cell
// covers both the primary `rrifWithdrawal` column and the spouse equivalent.
// ---------------------------------------------------------------------------

export function isMergedRrifCell(col: ColumnDef): boolean {
  return col.key === 'rrifWithdrawal' || col.key === 'spouseRrifWithdrawal';
}
