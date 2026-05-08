/**
 * Account Types and Rules
 * @see docs/source-of-truth/02-account-types.md
 */

export type AccountType = 'rrsp' | 'rrif' | 'tfsa' | 'non_registered' | 'lira' | 'lif' | 'fhsa';

export type AccountOwner = 'primary' | 'spouse';

export interface BaseAccount {
  id: string;
  type: AccountType;
  balance: number;
  owner: AccountOwner;
}

/**
 * RRSP Account
 * @see docs/source-of-truth/02-account-types.md - RRSP Section
 */
export interface RRSPAccount extends BaseAccount {
  type: 'rrsp';
  contributionRoom: number;
  annualContribution: number;
  isSpousal: boolean;
  /**
   * Who contributed to this RRSP. Required for spousal-RRSP 3-year attribution.
   * For spousal RRSPs (`isSpousal: true`), `contributor` is the contributing
   * spouse and must differ from `owner` (the annuitant). For non-spousal RRSPs,
   * `contributor === owner`.
   * @see docs/source-of-truth/02-account-types.md - RRSP Section
   */
  contributor: AccountOwner;
}

/**
 * RRIF Account
 * @see docs/source-of-truth/02-account-types.md - RRIF Section
 */
export interface RRIFAccount extends BaseAccount {
  type: 'rrif';
  useYoungerSpouseAge: boolean;
  convertedFromRRSPYear: number;
}

/**
 * TFSA Account
 * @see docs/source-of-truth/02-account-types.md - TFSA Section
 */
export interface TFSAAccount extends BaseAccount {
  type: 'tfsa';
  contributionRoom: number;
  annualContribution: number;
}

/**
 * Non-Registered Account
 * @see docs/source-of-truth/02-account-types.md - Non-Registered Section
 */
export interface NonRegisteredAccount extends BaseAccount {
  type: 'non_registered';
  adjustedCostBase: number;
  unrealizedGains: number;
  annualContribution: number;
  annualInterestIncome?: number;
  annualEligibleDividends?: number;
  annualNonEligibleDividends?: number;
  annualRealizedCapitalGains?: number;
  incomeAllocation: {
    interestPct: number;
    canadianDividendPct: number;
    capitalGainsPct: number;
  };
}

/**
 * LIRA Account
 * @see docs/source-of-truth/02-account-types.md - LIRA Section
 */
export interface LIRAAccount extends BaseAccount {
  type: 'lira';
  sourceProvince: string;
}

/**
 * LIF Account
 * @see docs/source-of-truth/02-account-types.md - LIF Section
 */
export interface LIFAccount extends BaseAccount {
  type: 'lif';
  governingJurisdiction: string;
  convertedFromLIRAYear: number;
  useYoungerSpouseAge: boolean;
  hasUsedOneTimeUnlock: boolean;
}

/**
 * FHSA Account
 * @see docs/source-of-truth/02-account-types.md - FHSA Section
 */
export interface FHSAAccount extends BaseAccount {
  type: 'fhsa';
  lifetimeContributed: number;
}

export type Account =
  | RRSPAccount
  | RRIFAccount
  | TFSAAccount
  | NonRegisteredAccount
  | LIRAAccount
  | LIFAccount
  | FHSAAccount;

/**
 * A single year's spousal RRSP contribution record for FIFO attribution tracking.
 * @see docs/source-of-truth/02-account-types.md - RRSP Spousal Attribution
 */
export interface SpousalRRSPContributionEntry {
  year: number;
  annuitant: AccountOwner;
  contributor: AccountOwner;
  amount: number;
}

/**
 * Ordered history of spousal RRSP contributions, keyed by (annuitant, contributor).
 * Used by S03's FIFO attribution engine.
 */
export type SpousalRRSPLedger = SpousalRRSPContributionEntry[];

export interface AccountSummary {
  totalRRSP: number;
  totalRRIF: number;
  totalTFSA: number;
  totalNonRegistered: number;
  totalLocked: number;
  totalNetWorth: number;
}
