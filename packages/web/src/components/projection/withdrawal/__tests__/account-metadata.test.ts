import { describe, it, expect } from 'vitest';
import { deriveAccountCardMetadata, taxTreatmentLabel } from '../account-metadata.js';
import type { AccountCardInfo } from '@/lib/profile-utils';
import type { ProjectionYearRow } from '@retireops/shared';

const accounts: AccountCardInfo[] = [
  { id: 'acc-tfsa', label: 'TFSA Main', type: 'TFSA' },
  { id: 'acc-rrsp', label: 'RRSP Main', type: 'RRSP' },
  { id: 'acc-nonreg', label: 'Brokerage', type: 'NonReg' },
  { id: 'acc-lif', label: 'LIF', type: 'LIF' },
];

const stepData: Record<string, unknown> = {
  accounts: [
    { _serverId: 'acc-tfsa', type: 'TFSA', currentBalance: '50000' },
    { _serverId: 'acc-rrsp', type: 'RRSP', currentBalance: '200000' },
    { _serverId: 'acc-nonreg', type: 'NonReg', currentBalance: '100000' },
    { _serverId: 'acc-lif', type: 'LIF', currentBalance: '75000' },
  ],
};

function row(overrides: Partial<ProjectionYearRow> & { year: number }): ProjectionYearRow {
  return {
    age: 65,
    employmentIncome: 0,
    pensionIncome: 0,
    cppIncome: 0,
    oasIncome: 0,
    rrifWithdrawal: 0,
    tfsaWithdrawal: 0,
    nonRegWithdrawal: 0,
    totalGrossIncome: 0,
    federalTax: 0,
    provincialTax: 0,
    oasClawback: 0,
    totalTax: 0,
    effectiveTaxRate: 0,
    livingExpenses: 0,
    netCashFlow: 0,
    rrspBalance: 0,
    rrifBalance: 0,
    tfsaBalance: 0,
    nonRegBalance: 0,
    totalNetWorth: 0,
    ...overrides,
  } as ProjectionYearRow;
}

describe('taxTreatmentLabel', () => {
  it('maps RRSP and RRIF to the same combined label', () => {
    expect(taxTreatmentLabel('RRSP')).toBe('Tax-deferred (RRSP/RRIF)');
    expect(taxTreatmentLabel('RRIF')).toBe('Tax-deferred (RRSP/RRIF)');
  });
  it('maps TFSA, NonReg, LIF correctly', () => {
    expect(taxTreatmentLabel('TFSA')).toBe('Tax-free (TFSA)');
    expect(taxTreatmentLabel('NonReg')).toBe('Taxable (Non-Registered)');
    expect(taxTreatmentLabel('LIF')).toBe('Locked-in (LIF/LIRA)');
    expect(taxTreatmentLabel('LIRA')).toBe('Locked-in (LIF/LIRA)');
  });
  it('falls back to Account for unknown types', () => {
    expect(taxTreatmentLabel('FHSA')).toBe('Account');
    expect(taxTreatmentLabel('')).toBe('Account');
  });
});

describe('deriveAccountCardMetadata', () => {
  it('returns balances read from stepData.accounts[*].currentBalance', () => {
    const md = deriveAccountCardMetadata(accounts, stepData, []);
    expect(md['acc-tfsa']?.balance).toBe(50000);
    expect(md['acc-rrsp']?.balance).toBe(200000);
    expect(md['acc-nonreg']?.balance).toBe(100000);
    expect(md['acc-lif']?.balance).toBe(75000);
  });

  it('returns balance 0 when account is missing from stepData', () => {
    const md = deriveAccountCardMetadata(accounts, {}, []);
    expect(md['acc-tfsa']?.balance).toBe(0);
  });

  it('tolerates the { cards: [...] } wrapper shape from useFieldArray', () => {
    const wrapped = {
      accounts: { cards: [{ _serverId: 'acc-tfsa', type: 'TFSA', currentBalance: '12345' }] },
    };
    const md = deriveAccountCardMetadata(accounts, wrapped, []);
    expect(md['acc-tfsa']?.balance).toBe(12345);
  });

  it('returns firstWithdrawalYear = undefined and lifetime = 0 when no withdrawals', () => {
    const md = deriveAccountCardMetadata(accounts, stepData, [row({ year: 2030 })]);
    expect(md['acc-tfsa']?.firstWithdrawalYear).toBeUndefined();
    expect(md['acc-tfsa']?.lifetimeWithdrawals).toBe(0);
  });

  it('detects firstWithdrawalYear from the earliest non-zero typed withdrawal', () => {
    const rows = [
      row({ year: 2030, tfsaWithdrawal: 0 }),
      row({ year: 2031, tfsaWithdrawal: 5000 }),
      row({ year: 2032, tfsaWithdrawal: 5000 }),
    ];
    const md = deriveAccountCardMetadata(accounts, stepData, rows);
    expect(md['acc-tfsa']?.firstWithdrawalYear).toBe(2031);
    expect(md['acc-tfsa']?.lifetimeWithdrawals).toBe(10000);
  });

  it('sums RRSP/RRIF withdrawals from row.rrifWithdrawal for both RRSP and RRIF cards', () => {
    const rows = [
      row({ year: 2030, rrifWithdrawal: 20000 }),
      row({ year: 2031, rrifWithdrawal: 22000 }),
    ];
    const md = deriveAccountCardMetadata(accounts, stepData, rows);
    expect(md['acc-rrsp']?.firstWithdrawalYear).toBe(2030);
    expect(md['acc-rrsp']?.lifetimeWithdrawals).toBe(42000);
  });

  it('uses lifWithdrawal ?? 0 for LIF cards (older rows omit the field)', () => {
    const rows = [
      row({ year: 2030 }), // lifWithdrawal absent
      row({ year: 2031, lifWithdrawal: 3000 }),
    ];
    const md = deriveAccountCardMetadata(accounts, stepData, rows);
    expect(md['acc-lif']?.firstWithdrawalYear).toBe(2031);
    expect(md['acc-lif']?.lifetimeWithdrawals).toBe(3000);
  });
});
