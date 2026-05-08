/**
 * Account Rules Module
 * @see docs/source-of-truth/02-account-types.md
 */
import type { Account, AccountType } from '@retireops/shared';
import { futureValue } from '@retireops/shared';

// Re-export all account modules
export * from './rrsp.js';
export * from './rrif.js';
export * from './tfsa.js';
export * from './non-registered.js';
export * from './lira.js';
export * from './lif.js';

/**
 * Get the tax-efficiency order for withdrawals
 * @see docs/source-of-truth/07-withdrawal-strategies.md
 *
 * Default order (can be customized):
 * 1. Non-registered (already taxed, may have capital gains)
 * 2. TFSA (tax-free, no impact on benefits)
 * 3. RRIF/RRSP (fully taxable, may affect OAS)
 */
export function getDefaultWithdrawalOrder(): AccountType[] {
  return ['non_registered', 'tfsa', 'rrif', 'rrsp'];
}

/**
 * Calculate total net worth from all accounts
 */
export function calculateTotalNetWorth(accounts: Account[]): number {
  return accounts.reduce((total, account) => total + account.balance, 0);
}

/**
 * Calculate registered vs non-registered breakdown
 */
export interface AccountBreakdown {
  registered: number;
  nonRegistered: number;
  taxFree: number;
  total: number;
}

export function calculateAccountBreakdown(accounts: Account[]): AccountBreakdown {
  let registered = 0;
  let nonRegistered = 0;
  let taxFree = 0;

  for (const account of accounts) {
    switch (account.type) {
      case 'rrsp':
      case 'rrif':
      case 'lira':
      case 'lif':
        registered += account.balance;
        break;
      case 'tfsa':
      case 'fhsa':
        taxFree += account.balance;
        break;
      case 'non_registered':
        nonRegistered += account.balance;
        break;
    }
  }

  return {
    registered,
    nonRegistered,
    taxFree,
    total: registered + nonRegistered + taxFree,
  };
}

/**
 * Project account balance with contributions and growth
 */
export function projectAccountBalance(
  startingBalance: number,
  annualContribution: number,
  investmentReturn: number,
  years: number
): number {
  return futureValue(startingBalance, annualContribution, investmentReturn, years);
}

/**
 * Apply investment growth to an account
 */
export function applyGrowth(balance: number, investmentReturn: number): number {
  return balance * (1 + investmentReturn);
}

/**
 * Process end-of-year account updates
 */
export interface YearEndAccountUpdate {
  accountId: string;
  previousBalance: number;
  contributions: number;
  withdrawals: number;
  growth: number;
  newBalance: number;
}

export function processYearEndUpdate(
  account: Account,
  contributions: number,
  withdrawals: number,
  investmentReturn: number
): YearEndAccountUpdate {
  const balanceAfterContributions = account.balance + contributions;
  const balanceAfterWithdrawals = balanceAfterContributions - withdrawals;
  const growth = balanceAfterWithdrawals * investmentReturn;
  const newBalance = Math.max(0, balanceAfterWithdrawals + growth);

  return {
    accountId: account.id,
    previousBalance: account.balance,
    contributions,
    withdrawals,
    growth,
    newBalance,
  };
}
