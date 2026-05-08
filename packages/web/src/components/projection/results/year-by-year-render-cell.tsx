'use client';

import { type ReactNode, type ComponentType } from 'react';
import type { ProjectionYearRow } from '@retireops/shared';
import type { ProvenanceCellMetadata } from '@retireops/shared';
import { isMergedRrifCell, type ColumnDef, type PersonOwner } from './year-by-year-columns';
import type { OverrideField, SecondaryField } from './OverrideCellPopover';

/**
 * year-by-year-render-cell — Phase 12 / Plan 12-05.
 *
 * Factored-out renderCell dispatcher (was inline in YearByYearTab.tsx, ~230 LOC).
 * Returns a render-prop closure that dispatches per-cell rendering by `col.key`,
 * delegating to caller-supplied `EditableCell` and `ReadOnlyCell` components.
 *
 * Preserves:
 * - Merged RRIF/RRSP cell (primary owner has dual-input secondary RRSP; spouse does not)
 * - Editable cell variants (LIF / TFSA / NonReg / Spending) with owner-tagged overrides
 * - In-scope read-only cells (federalTax, provincialTax, totalTax, totalGrossIncome)
 *   with provenance — primary owner only
 * - OC-penalty default formatter pass-through ("—" for zero)
 * - Spouse provenance left undefined (mirrors pre-refactor behavior)
 *
 * @see .planning/phases/12-yearbyyear-column-registry/12-05-PLAN.md
 * @see .planning/phases/12-yearbyyear-column-registry/12-04-SUMMARY.md
 */

// ---------------------------------------------------------------------------
// Component-prop types — caller provides EditableCell + ReadOnlyCell. Typed as
// ComponentType so consumers can pass the lexically-scoped inner components
// from YearByYearTab.tsx without exporting their prop interfaces.
// ---------------------------------------------------------------------------

export interface EditableCellProps {
  year: number;
  field: OverrideField;
  label: string;
  value: number;
  activeOverride?: { amount: number; applyForward: boolean } | undefined;
  clampInfo?: { requestedReal: number; clampedTo: number } | undefined;
  secondaryField?: SecondaryField | undefined;
  provenance?: ProvenanceCellMetadata | undefined;
  owner?: 'primary' | 'spouse';
}

export interface ReadOnlyCellProps {
  year: number;
  field: string;
  displayValue: string;
  label: string;
  provenance?: ProvenanceCellMetadata | undefined;
  inScope: boolean;
}

// ---------------------------------------------------------------------------
// Editor surface used by the dispatcher (slim subset of useOverrideEditor).
// ---------------------------------------------------------------------------

export interface RenderCellEditor {
  getActiveWithdrawalOverride: (
    year: number,
    field: Exclude<OverrideField, 'spending'>,
    owner?: 'primary' | 'spouse'
  ) => { amount: number; applyForward: boolean } | undefined;
  getActiveSpendingOverride: (
    year: number,
    owner?: 'primary' | 'spouse'
  ) => { amount: number; applyForward: boolean } | undefined;
}

// ---------------------------------------------------------------------------
// Lookup tables — pure data, hoisted out of the closure so they aren't
// reallocated on every render.
// ---------------------------------------------------------------------------

const EDITABLE_FIELD_BY_KEY: Record<string, OverrideField | undefined> = {
  lifWithdrawal: 'lif',
  tfsaWithdrawal: 'tfsa',
  spouseTfsaWithdrawal: 'tfsa',
  nonRegWithdrawal: 'nonreg',
  spouseNonRegWithdrawal: 'nonreg',
  livingExpenses: 'spending',
  spouseLivingExpenses: 'spending',
};

const EDITABLE_LABEL_BY_KEY: Record<string, string> = {
  lifWithdrawal: 'LIF Withdrawal',
  tfsaWithdrawal: 'TFSA Withdrawal',
  spouseTfsaWithdrawal: 'Sp. TFSA Withdrawal',
  nonRegWithdrawal: 'Non-Reg Withdrawal',
  spouseNonRegWithdrawal: 'Sp. Non-Reg Withdrawal',
  livingExpenses: 'Living Expenses',
  spouseLivingExpenses: 'Sp. Living Expenses',
};

/** Spouse-side check for editable-field cells (primary otherwise). */
const SPOUSE_EDITABLE_KEYS = new Set([
  'spouseTfsaWithdrawal',
  'spouseNonRegWithdrawal',
  'spouseLivingExpenses',
]);

/** Withdrawal-style clamp lookup (spending uses a different surface). */
const CLAMP_SOURCE_BY_FIELD: Record<
  string,
  'lifWithdrawal' | 'tfsaWithdrawal' | 'nonRegWithdrawal'
> = {
  lif: 'lifWithdrawal',
  tfsa: 'tfsaWithdrawal',
  nonreg: 'nonRegWithdrawal',
};

const IN_SCOPE_LABEL_BY_KEY: Record<string, string> = {
  federalTax: 'Federal Tax',
  provincialTax: 'Provincial Tax',
  totalTax: 'Total Tax',
  totalGrossIncome: 'Total Inc.',
};

const OUT_OF_SCOPE_LABEL_BY_KEY: Record<string, string> = {
  employmentIncome: 'Employment',
  pensionIncome: 'Pension',
  cppIncome: 'CPP',
  oasIncome: 'OAS',
  gisIncome: 'GIS',
  spouseEmploymentIncome: 'Spouse Employment',
  spousePensionIncome: 'Spouse Pension',
  spouseCppIncome: 'Spouse CPP',
  spouseOasIncome: 'Spouse OAS',
  pensionIncomeReceived: 'Pension Received',
  pensionIncomeTransferred: 'Pension Transferred',
  pensionSplitPercentage: 'Split %',
  pensionSplitTaxSavings: 'Split Tax Savings',
  bracketFillWithdrawal: 'Bracket-Fill Withdrawal',
  spouseBracketFillWithdrawal: 'Spouse Bracket-Fill',
  oasClawback: 'OAS Clawback',
  effectiveTaxRate: 'Effective Tax Rate',
  spouseFederalTax: 'Spouse Federal Tax',
  spouseProvincialTax: 'Spouse Provincial Tax',
  spouseTotalTax: 'Spouse Total Tax',
  spouseEffectiveTaxRate: 'Spouse Tax Rate',
  overContributionPenalty: 'Over-Contribution Penalty',
  netCashFlow: 'Net Cash Flow',
  spouseNetCashFlow: 'Spouse Net Cash Flow',
  householdNetCashFlow: 'Household Net Cash Flow',
  rrspBalance: 'RRSP Balance',
  rrifBalance: 'RRIF Balance',
  liraBalance: 'LIRA',
  lifBalance: 'LIF Balance',
  tfsaBalance: 'TFSA Balance',
  nonRegBalance: 'Non-Reg Balance',
  totalNetWorth: 'Net Worth',
  spouseRrspBalance: 'Spouse RRSP',
  spouseRrifBalance: 'Spouse RRIF',
  spouseTfsaBalance: 'Spouse TFSA',
  spouseNonRegBalance: 'Spouse Non-Reg',
  householdNetWorth: 'Household Net Worth',
};

/** In-scope provenance lookup keys. */
const IN_SCOPE_PROVENANCE_FIELDS = new Set([
  'federalTax',
  'provincialTax',
  'totalTax',
  'totalGrossIncome',
]);

// ---------------------------------------------------------------------------
// Factory: createRenderCell(deps) → renderCell closure
// ---------------------------------------------------------------------------

export interface CreateRenderCellDeps {
  editor: RenderCellEditor;
  EditableCell: ComponentType<EditableCellProps>;
  ReadOnlyCell: ComponentType<ReadOnlyCellProps>;
}

export function createRenderCell({
  editor,
  EditableCell,
  ReadOnlyCell,
}: CreateRenderCellDeps): (
  col: ColumnDef,
  row: ProjectionYearRow,
  owner: PersonOwner
) => ReactNode {
  return (col, row, owner) => {
    const ovr = owner === 'spouse' ? row.spouseOverrides : row.overrides;
    const provenanceMap = row.provenance ?? {};

    // ---- Merged RRIF/RRSP cell (primary or spouse) ----
    if (isMergedRrifCell(col)) {
      const isSpouse = owner === 'spouse';
      const balanceField = isSpouse ? 'spouseRrifBalance' : 'rrifBalance';
      const altBalance = isSpouse ? 'spouseRrspBalance' : 'rrspBalance';
      const hasRrifBal = (row[balanceField] ?? 0) > 0;
      const hasRrspBal = (row[altBalance] ?? 0) > 0;
      const cellField: OverrideField = hasRrifBal ? 'rrif' : 'rrsp';
      const value = (isSpouse ? row.spouseRrifWithdrawal : row.rrifWithdrawal) ?? 0;
      const label = hasRrifBal
        ? isSpouse
          ? 'Sp. RRIF Withdrawal'
          : 'RRIF Withdrawal'
        : isSpouse
          ? 'Sp. RRSP Withdrawal'
          : 'RRSP Withdrawal';
      // Secondary RRSP input only when both balances exist on the primary owner side.
      // Pre-refactor: only the primary RRIF cell offered the dual-input. Preserve.
      const secondaryField: SecondaryField | undefined =
        !isSpouse && hasRrifBal && hasRrspBal
          ? {
              field: 'rrsp',
              label: 'RRSP Withdrawal',
              activeOverride: editor.getActiveWithdrawalOverride(row.year, 'rrsp'),
              clampInfo: ovr?.rrspWithdrawal?.clamped
                ? {
                    requestedReal: ovr.rrspWithdrawal.requestedReal,
                    clampedTo: ovr.rrspWithdrawal.actual,
                  }
                : undefined,
            }
          : undefined;
      const clampInfo =
        cellField === 'rrif' && ovr?.rrifWithdrawal?.clamped
          ? {
              requestedReal: ovr.rrifWithdrawal.requestedReal,
              clampedTo: ovr.rrifWithdrawal.actual,
            }
          : cellField === 'rrsp' && ovr?.rrspWithdrawal?.clamped
            ? {
                requestedReal: ovr.rrspWithdrawal.requestedReal,
                clampedTo: ovr.rrspWithdrawal.actual,
              }
            : undefined;
      // Provenance: primary path looks up in row.provenance; spouse provenance
      // surface in the existing code was undefined (per pre-refactor source), so
      // we mirror that — pass `undefined` for spouse owner.
      const provenance = isSpouse
        ? undefined
        : cellField === 'rrif'
          ? provenanceMap.rrifWithdrawal
          : provenanceMap.rrspWithdrawal;
      return (
        <EditableCell
          year={row.year}
          field={cellField}
          label={label}
          value={value}
          activeOverride={editor.getActiveWithdrawalOverride(
            row.year,
            cellField,
            isSpouse ? 'spouse' : 'primary'
          )}
          clampInfo={clampInfo}
          secondaryField={secondaryField}
          provenance={provenance}
          owner={isSpouse ? 'spouse' : 'primary'}
        />
      );
    }

    // ---- Other editable cells: LIF / TFSA / NonReg / Spending ----
    const editableField = EDITABLE_FIELD_BY_KEY[col.key];
    if (editableField !== undefined) {
      const isSpouse = SPOUSE_EDITABLE_KEYS.has(col.key);
      const ownerForCell: 'primary' | 'spouse' = isSpouse ? 'spouse' : 'primary';
      const value = (col.accessor(row) as number | null | undefined) ?? 0;
      const ownerOverrides = isSpouse ? row.spouseOverrides : row.overrides;
      // Spending uses a different lookup path (no clamp surface today).
      if (editableField === 'spending') {
        return (
          <EditableCell
            year={row.year}
            field="spending"
            label={EDITABLE_LABEL_BY_KEY[col.key]}
            value={value}
            activeOverride={editor.getActiveSpendingOverride(
              row.year,
              isSpouse ? 'spouse' : undefined
            )}
            clampInfo={undefined}
            provenance={isSpouse ? undefined : provenanceMap.livingExpenses}
            owner={ownerForCell}
          />
        );
      }
      // Withdrawal-style editable cells share the same clamp + provenance lookup.
      const clampKey = CLAMP_SOURCE_BY_FIELD[editableField];
      const clampedRow = ownerOverrides?.[clampKey];
      const clampInfo = clampedRow?.clamped
        ? { requestedReal: clampedRow.requestedReal, clampedTo: clampedRow.actual }
        : undefined;
      const provenanceByField: Record<string, ProvenanceCellMetadata | undefined> = {
        lif: provenanceMap.lifWithdrawal,
        tfsa: provenanceMap.tfsaWithdrawal,
        nonreg: provenanceMap.nonRegWithdrawal,
      };
      return (
        <EditableCell
          year={row.year}
          field={editableField}
          label={EDITABLE_LABEL_BY_KEY[col.key]}
          value={value}
          activeOverride={editor.getActiveWithdrawalOverride(row.year, editableField, ownerForCell)}
          clampInfo={clampInfo}
          provenance={isSpouse ? undefined : provenanceByField[editableField]}
          owner={ownerForCell}
        />
      );
    }

    // ---- In-scope read-only cells with provenance (primary only) ----
    if (IN_SCOPE_PROVENANCE_FIELDS.has(col.key) && owner !== 'spouse') {
      const value = col.accessor(row);
      const inScopeProvenanceByKey: Record<string, ProvenanceCellMetadata | undefined> = {
        federalTax: provenanceMap.federalTax,
        provincialTax: provenanceMap.provincialTax,
        totalTax: provenanceMap.totalTaxes,
        totalGrossIncome: provenanceMap.totalIncome,
      };
      return (
        <ReadOnlyCell
          year={row.year}
          field={col.key}
          displayValue={col.formatter(value)}
          label={IN_SCOPE_LABEL_BY_KEY[col.key]}
          provenance={inScopeProvenanceByKey[col.key]}
          inScope={true}
        />
      );
    }

    // ---- Default: out-of-scope read-only placeholder ----
    // (col.formatter already produces "—" for OC-penalty zero — pass-through.)
    const value = col.accessor(row);
    return (
      <ReadOnlyCell
        year={row.year}
        field={col.key}
        displayValue={col.formatter(value)}
        label={OUT_OF_SCOPE_LABEL_BY_KEY[col.key] ?? col.label}
        inScope={false}
      />
    );
  };
}
