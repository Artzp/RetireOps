/**
 * Pure derivation of per-card metadata for the Withdrawal Plan UI (Phase 28).
 *
 * Inputs:
 *  - accountCards: from extractAccountCards(profile.stepData)
 *  - stepData: raw profile.stepData (for currentBalance lookup)
 *  - projectionRows: scenario.result_data.projectionRows (ProjectionYearRow[])
 *
 * Outputs: Record<accountId, AccountCardMetadata>.
 *
 * IMPORTANT (documented limitation): ProjectionYearRow exposes withdrawal
 * totals by TYPE (rrif/lif/tfsa/nonReg), not by individual account-card ID.
 * When a profile has TWO accounts of the same type (e.g. two TFSAs), the
 * firstWithdrawalYear and lifetimeWithdrawals values are TYPE-SUMMED and
 * shown identically on every card of that type. Per-card-id attribution
 * is deferred — the engine does not emit it today.
 *
 * RRSP/RRIF combined card (PRESET-06): both RRSP-typed and RRIF-typed cards
 * read from row.rrifWithdrawal. The engine emits all registered-withdrawal
 * dollars (pre-71 RRSP and post-71 RRIF alike) as rrifWithdrawal.
 *
 * Architecture Principle IV preserved: this file does NOT import from
 * @retireops/calculation-engine.
 */

import type { AccountCardInfo } from '@/lib/profile-utils';
import type { ProjectionYearRow } from '@retireops/shared';
import type { AccountCardMetadata } from './types';

const TYPE_LABEL: Record<string, string> = {
  RRSP: 'Tax-deferred (RRSP/RRIF)',
  RRIF: 'Tax-deferred (RRSP/RRIF)',
  TFSA: 'Tax-free (TFSA)',
  NonReg: 'Taxable (Non-Registered)',
  LIF: 'Locked-in (LIF/LIRA)',
  LIRA: 'Locked-in (LIF/LIRA)',
};

export function taxTreatmentLabel(type: string): string {
  return TYPE_LABEL[type] ?? 'Account';
}

/**
 * Pulls the withdrawal field on a ProjectionYearRow that corresponds to a card type.
 * Returns 0 when the field is undefined (e.g. lifWithdrawal on non-LIF profiles).
 */
function withdrawalFieldForType(row: ProjectionYearRow, type: string): number {
  switch (type) {
    case 'RRSP':
    case 'RRIF':
      return row.rrifWithdrawal;
    case 'TFSA':
      return row.tfsaWithdrawal;
    case 'NonReg':
      return row.nonRegWithdrawal;
    case 'LIF':
    case 'LIRA':
      return row.lifWithdrawal ?? 0;
    default:
      return 0;
  }
}

/**
 * Looks up the current balance for an account from stepData.accounts.
 * stepData.accounts may be the raw array or a { cards: [...] } wrapper, mirroring
 * extractAccountCards()'s tolerance.
 */
function balanceForAccount(stepData: Record<string, unknown>, accountId: string): number {
  const accountsData = stepData['accounts'];
  if (!accountsData) return 0;
  const cards: unknown[] = Array.isArray(accountsData)
    ? accountsData
    : Array.isArray((accountsData as Record<string, unknown>).cards)
      ? ((accountsData as Record<string, unknown>).cards as unknown[])
      : [];
  for (const card of cards) {
    const c = card as Record<string, unknown>;
    const id = String(c['_serverId'] ?? c['id'] ?? '');
    if (id === accountId) {
      const raw = c['currentBalance'];
      const n = Number(raw);
      return isNaN(n) ? 0 : n;
    }
  }
  return 0;
}

export function deriveAccountCardMetadata(
  accountCards: AccountCardInfo[],
  stepData: Record<string, unknown>,
  projectionRows: ProjectionYearRow[]
): Record<string, AccountCardMetadata> {
  const out: Record<string, AccountCardMetadata> = {};
  for (const account of accountCards) {
    let firstYear: number | undefined = undefined;
    let lifetime = 0;
    for (const row of projectionRows) {
      const w = withdrawalFieldForType(row, account.type);
      if (w > 0) {
        if (firstYear === undefined || row.year < firstYear) firstYear = row.year;
        lifetime += w;
      }
    }
    out[account.id] = {
      balance: balanceForAccount(stepData, account.id),
      taxTreatmentLabel: taxTreatmentLabel(account.type),
      firstWithdrawalYear: firstYear,
      lifetimeWithdrawals: lifetime,
    };
  }
  return out;
}
