/**
 * Withdrawal Strategy Definitions
 * @see docs/source-of-truth/07-withdrawal-strategies.md
 */

import type { AccountType } from '@retireops/shared';

/**
 * Withdrawal strategy configuration
 * @see docs/source-of-truth/07-withdrawal-strategies.md - WithdrawalStrategy interface
 */
export interface WithdrawalStrategy {
  name: string;
  description: string;

  /** Priority order (1 = first to withdraw) */
  accountPriority: Record<AccountType, number>;

  /** Surplus handling priority */
  surplusPriority: Array<'tfsa' | 'non_registered' | 'mortgage'>;
}

/**
 * Predefined withdrawal strategies
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Default Withdrawal Order
 */
export const WITHDRAWAL_STRATEGIES = {
  /**
   * Standard strategy: Non-registered first, preserve tax-sheltered growth.
   * @see docs/source-of-truth/07-withdrawal-strategies.md §1
   */
  standard: {
    name: 'Standard',
    description: 'Use taxable accounts first, preserve tax-sheltered growth as long as possible',
    accountPriority: {
      non_registered: 1,
      rrsp: 3,
      rrif: 2,
      tfsa: 4,
      lira: 5,
      lif: 2,
      fhsa: 6,
    },
    surplusPriority: ['tfsa', 'non_registered'],
  },

  /**
   * TFSA-first strategy: Minimize income reported for benefit eligibility.
   * @see docs/source-of-truth/07-withdrawal-strategies.md §4 (TFSA-First Alternative)
   */
  tfsaFirst: {
    name: 'TFSA First',
    description: 'Withdraw from TFSA first to minimize taxable income and OAS clawback',
    accountPriority: {
      tfsa: 1,
      non_registered: 2,
      rrsp: 4,
      rrif: 3,
      lira: 5,
      lif: 3,
      fhsa: 6,
    },
    surplusPriority: ['tfsa', 'non_registered'],
  },

  /**
   * OAS Protection strategy: Keep income below clawback threshold.
   * @see docs/source-of-truth/07-withdrawal-strategies.md §4 (OAS Clawback Avoidance)
   */
  oasProtection: {
    name: 'OAS Protection',
    description: 'Manage withdrawals to stay below OAS clawback threshold',
    accountPriority: {
      tfsa: 1,
      non_registered: 2,
      rrsp: 4,
      rrif: 3,
      lira: 5,
      lif: 3,
      fhsa: 6,
    },
    surplusPriority: ['tfsa', 'non_registered'],
  },

  /**
   * Bracket-filling strategy: Canonical order paired with bracket-fill behavior
   * enabled separately via ProjectionInput.bracketFill.
   * @see docs/source-of-truth/07-withdrawal-strategies.md §2 (Bracket Optimization)
   * @see specs/005-tax-optimization-engine/spec.md FR-013
   */
  bracketFilling: {
    name: 'Bracket Filling',
    description:
      'Canonical drawdown order; pair with ProjectionInput.bracketFill to fill lower tax brackets with RRSP withdrawals',
    accountPriority: {
      non_registered: 1,
      rrsp: 3,
      rrif: 2,
      tfsa: 4,
      lira: 5,
      lif: 2,
      fhsa: 6,
    },
    surplusPriority: ['tfsa', 'non_registered'],
  },
} as const satisfies Record<string, WithdrawalStrategy>;

/** Strategy names */
export type WithdrawalStrategyName = keyof typeof WITHDRAWAL_STRATEGIES;

/**
 * Get withdrawal strategy by name
 * @param strategyName Name of the strategy
 * @returns Withdrawal strategy or undefined
 */
export function getWithdrawalStrategy(strategyName: string): WithdrawalStrategy | undefined {
  if (strategyName in WITHDRAWAL_STRATEGIES) {
    return WITHDRAWAL_STRATEGIES[strategyName as WithdrawalStrategyName];
  }
  return undefined;
}

/**
 * Get ordered list of accounts for withdrawal
 * @param strategy Withdrawal strategy
 * @returns Array of account types in withdrawal order
 */
export function getWithdrawalOrder(strategy: WithdrawalStrategy): AccountType[] {
  const entries = Object.entries(strategy.accountPriority) as Array<[AccountType, number]>;
  return entries.sort(([, a], [, b]) => a - b).map(([type]) => type);
}

/**
 * Check if an account is available for withdrawal based on priority
 * @param accountType Type of account
 * @param strategy Withdrawal strategy
 * @param accountsWithBalance Account types that have available balance
 * @returns Whether this account should be used
 */
export function shouldWithdrawFromAccount(
  accountType: AccountType,
  strategy: WithdrawalStrategy,
  accountsWithBalance: AccountType[]
): boolean {
  if (!accountsWithBalance.includes(accountType)) {
    return false;
  }

  const order = getWithdrawalOrder(strategy);
  const thisIndex = order.indexOf(accountType);

  // Check if higher priority accounts still have balance
  for (let i = 0; i < thisIndex; i++) {
    const account = order[i];
    if (account && accountsWithBalance.includes(account)) {
      return false; // Higher priority account still has funds
    }
  }

  return true;
}

/**
 * Create custom withdrawal strategy
 * @param name Strategy name
 * @param description Strategy description
 * @param accountPriority Priority order for accounts
 * @returns Withdrawal strategy
 */
export function createCustomStrategy(
  name: string,
  description: string,
  accountPriority: Partial<Record<AccountType, number>>
): WithdrawalStrategy {
  const defaultPriority: Record<AccountType, number> = {
    non_registered: 1,
    rrsp: 3,
    rrif: 2,
    tfsa: 4,
    lira: 5,
    lif: 2,
    fhsa: 6,
  };

  return {
    name,
    description,
    accountPriority: { ...defaultPriority, ...accountPriority },
    surplusPriority: ['tfsa', 'non_registered'],
  };
}

/**
 * Filter-and-map catalog priority buckets to the engine's drawdown keys.
 * Drops keys the per-year drawdown loop doesn't handle: lif is handled
 * separately at yearly-calculator.ts (LIF max logic after the gap-fill loop);
 * lira and fhsa are not drawn in the gap-fill loop.
 * non_registered → nonReg. Sorted ascending by priority; ties resolved by the
 * insertion order of Object.entries.
 */
export function accountPriorityToDrawdownOrder(priority: Record<AccountType, number>): string[] {
  const entries = Object.entries(priority) as Array<[AccountType, number]>;
  const sorted = entries
    .map(([type, prio], index) => ({ type, prio, index }))
    .sort((a, b) => a.prio - b.prio || a.index - b.index);

  const result: string[] = [];
  for (const { type } of sorted) {
    if (type === 'non_registered') result.push('nonReg');
    else if (type === 'rrif') result.push('rrif');
    else if (type === 'rrsp') result.push('rrsp');
    else if (type === 'tfsa') result.push('tfsa');
    // lif / lira / fhsa intentionally dropped — not consumed by drawdown loop
  }
  return result;
}

/**
 * Resolves final drawdown order for the yearly calculator.
 * Precedence: explicit drawdownOrder > strategyId preset > default 'standard' preset.
 * No hardcoded literal fallback — the default sources from the catalog so the
 * catalog remains the single source of truth for named presets.
 */
export function resolveDrawdownOrder(args: {
  drawdownOrder?: string[] | undefined;
  strategyId?: WithdrawalStrategyName | undefined;
}): string[] {
  if (args.drawdownOrder && args.drawdownOrder.length > 0) {
    return args.drawdownOrder;
  }
  const preset = args.strategyId
    ? WITHDRAWAL_STRATEGIES[args.strategyId]
    : WITHDRAWAL_STRATEGIES.standard;
  return accountPriorityToDrawdownOrder(preset.accountPriority);
}

/**
 * Resolves the effective strategy name for provenance emission.
 *
 * When the caller passes an explicit drawdownOrder, it overrides any strategyId
 * (resolveDrawdownOrder ignores strategyId in that case). The provenance must
 * reflect the actual effective strategy — if the explicit order matches a known
 * preset, return that preset's name so consumers can identify it; otherwise
 * fall back to 'standard' (custom orders aren't a named preset).
 *
 * Without this, `{strategyId:'standard', drawdownOrder:[...tfsaFirst order]}`
 * would emit `strategyId:'standard'` in provenance even though behavior matches
 * 'tfsaFirst' — diverging from `{strategyId:'tfsaFirst'}` despite identical
 * yearly results.
 */
export function resolveStrategyId(args: {
  drawdownOrder?: string[] | undefined;
  strategyId?: WithdrawalStrategyName | undefined;
}): WithdrawalStrategyName {
  if (args.drawdownOrder && args.drawdownOrder.length > 0) {
    const userOrder = args.drawdownOrder;
    const presetNames = Object.keys(WITHDRAWAL_STRATEGIES) as WithdrawalStrategyName[];
    for (const name of presetNames) {
      const presetOrder = accountPriorityToDrawdownOrder(
        WITHDRAWAL_STRATEGIES[name].accountPriority
      );
      if (
        presetOrder.length === userOrder.length &&
        presetOrder.every((tier, i) => tier === userOrder[i])
      ) {
        return name;
      }
    }
    return 'standard';
  }
  return args.strategyId ?? 'standard';
}
