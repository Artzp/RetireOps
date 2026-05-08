/**
 * Pure helpers for Phase 2 cell provenance emission.
 *
 * Mirrors the Phase 1 sibling pattern in overrides.ts. Each emission helper returns a
 * ProvenanceCellMetadata or undefined; undefined signals "field is out of scope or has
 * no value this year" (D-41). Callers chain helpers into a ProvenanceMetadata object
 * and attach it to the per-year result row only if hasAnyProvenance returns true (D-36).
 *
 * @see .planning/phases/02-cell-provenance/02-CONTEXT.md - D-32, D-33, D-38, D-40, D-41
 * @see docs/source-of-truth/04-tax-engine.md - federalTax/provincialTax/totalTaxes docRef targets
 * @see docs/source-of-truth/07-withdrawal-strategies.md - withdrawal cells + #user-overrides (D-40)
 * @see docs/source-of-truth/02-account-types.md - RRIF mandatory minimum
 *
 * CRITICAL: This module is pure. No Date.now, no Math.random, no I/O.
 * All temporal reasoning derives from year values passed in by the caller.
 */

import type { ProvenanceCellMetadata, ProvenanceMetadata } from '@retireops/shared';

export type { ProvenanceCellMetadata, ProvenanceMetadata };

// ─────────────────────────────────────────────────────────────────────────────
// Rule registry — frozen catalog of (ruleId, ruleName, docRef) tuples.
// Every literal docRef MUST resolve to a real heading slug in
// docs/source-of-truth/*.md (validated by provenance-doc-refs.test.ts, D-51).
// ─────────────────────────────────────────────────────────────────────────────

interface RuleDescriptor {
  ruleId: string;
  ruleName: string;
  docRef: string;
}

export const PROVENANCE_RULES = Object.freeze({
  // Withdrawal — engine source per tier (D-38, D-33)
  withdrawalRrspEngine: {
    ruleId: 'withdrawal-waterfall-rrsp',
    ruleName: 'Waterfall strategy — RRSP tier',
    docRef:
      'docs/source-of-truth/07-withdrawal-strategies.md#step-4-source-additional-withdrawals-by-priority',
  },
  withdrawalRrifEngine: {
    ruleId: 'withdrawal-waterfall-rrif',
    ruleName: 'Waterfall strategy — RRIF tier',
    docRef:
      'docs/source-of-truth/07-withdrawal-strategies.md#step-4-source-additional-withdrawals-by-priority',
  },
  withdrawalTfsaEngine: {
    ruleId: 'withdrawal-waterfall-tfsa',
    ruleName: 'Waterfall strategy — TFSA tier',
    docRef:
      'docs/source-of-truth/07-withdrawal-strategies.md#step-4-source-additional-withdrawals-by-priority',
  },
  withdrawalNonRegEngine: {
    ruleId: 'withdrawal-waterfall-nonreg',
    ruleName: 'Waterfall strategy — Non-registered tier',
    docRef:
      'docs/source-of-truth/07-withdrawal-strategies.md#step-4-source-additional-withdrawals-by-priority',
  },
  withdrawalLifEngine: {
    ruleId: 'withdrawal-waterfall-lif',
    ruleName: 'Waterfall strategy — LIF tier',
    docRef:
      'docs/source-of-truth/07-withdrawal-strategies.md#step-4-source-additional-withdrawals-by-priority',
  },

  // Override — single rule identity for all overridden cells (D-40)
  overrideUser: {
    ruleId: 'override-user',
    ruleName: 'User override',
    docRef: 'docs/source-of-truth/07-withdrawal-strategies.md#user-overrides',
  },

  // Spending
  livingExpensesEngine: {
    ruleId: 'spending-target',
    ruleName: 'Annual spending target with age-band reductions',
    docRef:
      'docs/source-of-truth/07-withdrawal-strategies.md#step-1-determine-annual-spending-need',
  },

  // RRIF mandatory minimum
  rrifMinimumEngine: {
    ruleId: 'rrif-mandatory-minimum',
    ruleName: 'RRIF mandatory minimum withdrawal',
    docRef: 'docs/source-of-truth/07-withdrawal-strategies.md#rrif-minimums',
  },

  // Total income (aggregate of withdrawals + benefits + employment)
  totalIncomeEngine: {
    ruleId: 'income-aggregate',
    ruleName: 'Total gross income — sum of sources',
    docRef:
      'docs/source-of-truth/07-withdrawal-strategies.md#step-1-determine-annual-spending-need',
  },

  // Tax
  federalTaxEngine: {
    ruleId: 'tax-federal-bracket',
    ruleName: 'Federal tax — bracket schedule',
    docRef: 'docs/source-of-truth/04-tax-engine.md#step-4-calculate-federal-tax',
  },
  provincialTaxEngine: {
    ruleId: 'tax-provincial-bracket',
    ruleName: 'Provincial tax — bracket schedule',
    docRef: 'docs/source-of-truth/04-tax-engine.md#step-5-calculate-provincial-tax',
  },
  totalTaxesEngine: {
    ruleId: 'tax-total',
    ruleName: 'Total taxes — federal + provincial',
    docRef: 'docs/source-of-truth/04-tax-engine.md#tax-calculation-algorithm',
  },
} as const satisfies Record<string, RuleDescriptor>);

// ─────────────────────────────────────────────────────────────────────────────
// Emission helpers — each returns ProvenanceCellMetadata | undefined.
// Return undefined when value === 0 (D-41 — no provenance for unused fields).
// ─────────────────────────────────────────────────────────────────────────────

/** Withdrawal field keys matching D-38 in-scope set. */
export type WithdrawalField = 'rrsp' | 'rrif' | 'tfsa' | 'nonreg' | 'lif';

const ENGINE_RULE_BY_WITHDRAWAL_FIELD: Record<WithdrawalField, keyof typeof PROVENANCE_RULES> = {
  rrsp: 'withdrawalRrspEngine',
  rrif: 'withdrawalRrifEngine',
  tfsa: 'withdrawalTfsaEngine',
  nonreg: 'withdrawalNonRegEngine',
  lif: 'withdrawalLifEngine',
};

/**
 * Withdrawal-cell provenance (D-33, D-38, D-40).
 * Returns undefined when value === 0 (D-41 — no provenance for unused fields).
 * Returns source='override' with literal override identity when isOverride===true (D-40).
 * Otherwise returns source='engine' with the tier-specific waterfall rule.
 *
 * @see .planning/phases/02-cell-provenance/02-CONTEXT.md - D-33, D-38, D-40, D-41
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Step 4: Source Additional Withdrawals
 */
export function buildWithdrawalProvenance(args: {
  field: WithdrawalField;
  value: number;
  isOverride: boolean;
  overrideInputs?: {
    requestedReal: number;
    requestedNominal: number;
    actualNominal: number;
    anchorYear: number;
    applyForward: boolean;
  };
  engineInputs?: Record<string, number | string | boolean>;
}): ProvenanceCellMetadata | undefined {
  if (args.value === 0) return undefined;

  if (args.isOverride && args.overrideInputs) {
    const r = PROVENANCE_RULES.overrideUser;
    return {
      source: 'override',
      ruleId: r.ruleId,
      ruleName: r.ruleName,
      docRef: r.docRef,
      inputs: {
        requestedReal: args.overrideInputs.requestedReal,
        requestedNominal: args.overrideInputs.requestedNominal,
        actualNominal: args.overrideInputs.actualNominal,
        anchorYear: args.overrideInputs.anchorYear,
        applyForward: args.overrideInputs.applyForward,
      },
    };
  }

  const ruleKey = ENGINE_RULE_BY_WITHDRAWAL_FIELD[args.field];
  const r = PROVENANCE_RULES[ruleKey];
  return {
    source: 'engine',
    ruleId: r.ruleId,
    ruleName: r.ruleName,
    docRef: r.docRef,
    inputs: args.engineInputs ?? {},
  };
}

/**
 * Spending-cell provenance for livingExpenses (D-33, D-38, D-40).
 * Returns undefined when value === 0 (D-41).
 *
 * @see .planning/phases/02-cell-provenance/02-CONTEXT.md - D-33, D-38, D-40, D-41
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Step 1: Determine Annual Spending Need
 */
export function buildSpendingProvenance(args: {
  value: number;
  isOverride: boolean;
  overrideInputs?: {
    requestedReal: number;
    requestedNominal: number;
    anchorYear: number;
    applyForward: boolean;
  };
  engineInputs?: Record<string, number | string | boolean>;
}): ProvenanceCellMetadata | undefined {
  if (args.value === 0) return undefined;

  if (args.isOverride && args.overrideInputs) {
    const r = PROVENANCE_RULES.overrideUser;
    return {
      source: 'override',
      ruleId: r.ruleId,
      ruleName: r.ruleName,
      docRef: r.docRef,
      inputs: {
        requestedReal: args.overrideInputs.requestedReal,
        requestedNominal: args.overrideInputs.requestedNominal,
        anchorYear: args.overrideInputs.anchorYear,
        applyForward: args.overrideInputs.applyForward,
      },
    };
  }

  const r = PROVENANCE_RULES.livingExpensesEngine;
  return {
    source: 'engine',
    ruleId: r.ruleId,
    ruleName: r.ruleName,
    docRef: r.docRef,
    inputs: args.engineInputs ?? {},
  };
}

/**
 * RRIF mandatory minimum provenance (D-33, D-38).
 * Returns undefined when value === 0 (D-41 — no minimum this year).
 *
 * @see .planning/phases/02-cell-provenance/02-CONTEXT.md - D-33, D-38, D-41
 * @see docs/source-of-truth/07-withdrawal-strategies.md - RRIF Minimums
 */
export function buildRRIFMinimumProvenance(args: {
  value: number;
  age: number;
  rrifBalance: number;
  withdrawalFactor: number;
}): ProvenanceCellMetadata | undefined {
  if (args.value === 0) return undefined;
  const r = PROVENANCE_RULES.rrifMinimumEngine;
  return {
    source: 'engine',
    ruleId: r.ruleId,
    ruleName: r.ruleName,
    docRef: r.docRef,
    inputs: {
      age: args.age,
      rrifBalance: args.rrifBalance,
      withdrawalFactor: args.withdrawalFactor,
    },
  };
}

/**
 * Total income provenance — sum of all income sources (D-33, D-38).
 * Returns undefined when value === 0 (D-41).
 * Filters zero-valued sources to keep the popover concise.
 *
 * WR-04: `args.value` MUST be the fully-aggregated total gross income for the
 * year (e.g. `totalGrossIncome` / `totalIncome` from the yearly calculator),
 * NOT a partial sub-component such as a single withdrawal field. Passing a
 * sub-component would produce a false `undefined` return in CPP/OAS-only years
 * where the sub-component is zero but total income is non-zero. Both call
 * sites in yearly-calculator.ts have been verified to pass the aggregated
 * value (`totalIncome` for the single-person path, `totalGrossIncome` for the
 * couple path).
 *
 * @see .planning/phases/02-cell-provenance/02-CONTEXT.md - D-33, D-38, D-41
 * @see docs/source-of-truth/07-withdrawal-strategies.md - Step 1: Determine Annual Spending Need
 */
export function buildTotalIncomeProvenance(args: {
  /** Fully-aggregated total gross income for the year — NOT a sub-component. */
  value: number;
  sources: Record<string, number>;
}): ProvenanceCellMetadata | undefined {
  if (args.value === 0) return undefined;
  const r = PROVENANCE_RULES.totalIncomeEngine;
  // Filter zero-valued sources to keep the popover concise (D-34).
  const inputs: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(args.sources)) {
    if (Number.isFinite(v) && v !== 0) inputs[k] = v;
  }
  return {
    source: 'engine',
    ruleId: r.ruleId,
    ruleName: r.ruleName,
    docRef: r.docRef,
    inputs,
  };
}

/**
 * Tax-cell provenance for federalTax, provincialTax, and totalTaxes (D-33, D-38).
 * Returns undefined when value === 0 (D-41).
 * Emits bracket label and marginal rate when available (ROADMAP criterion #2).
 *
 * @see .planning/phases/02-cell-provenance/02-CONTEXT.md - D-33, D-38, D-41
 * @see docs/source-of-truth/04-tax-engine.md - Step 4, Step 5, Tax Calculation Algorithm
 */
export function buildTaxProvenance(args: {
  field: 'federalTax' | 'provincialTax' | 'totalTaxes';
  value: number;
  totalTaxableIncome: number;
  federalBracket?: string | undefined;
  federalMarginalRate?: number | undefined;
  provincialBracket?: string | undefined;
  provincialMarginalRate?: number | undefined;
  province?: string | undefined;
}): ProvenanceCellMetadata | undefined {
  if (args.value === 0) return undefined;

  const inputs: Record<string, number | string> = {
    totalTaxableIncome: args.totalTaxableIncome,
  };
  let ruleKey: keyof typeof PROVENANCE_RULES;
  switch (args.field) {
    case 'federalTax':
      ruleKey = 'federalTaxEngine';
      if (args.federalBracket) inputs.federalBracket = args.federalBracket;
      if (typeof args.federalMarginalRate === 'number')
        inputs.marginalRate = args.federalMarginalRate;
      break;
    case 'provincialTax':
      ruleKey = 'provincialTaxEngine';
      if (args.province) inputs.province = args.province;
      if (args.provincialBracket) inputs.provincialBracket = args.provincialBracket;
      if (typeof args.provincialMarginalRate === 'number')
        inputs.marginalRate = args.provincialMarginalRate;
      break;
    case 'totalTaxes':
      ruleKey = 'totalTaxesEngine';
      if (args.federalBracket) inputs.federalBracket = args.federalBracket;
      if (args.provincialBracket) inputs.provincialBracket = args.provincialBracket;
      if (args.province) inputs.province = args.province;
      break;
  }
  const r = PROVENANCE_RULES[ruleKey];
  return {
    source: 'engine',
    ruleId: r.ruleId,
    ruleName: r.ruleName,
    docRef: r.docRef,
    inputs,
  };
}

/**
 * Returns true when at least one D-38 in-scope field has a populated provenance entry.
 * Mirrors hasAnyOverride() in overrides.ts (D-32 — sibling pattern).
 *
 * @see .planning/phases/02-cell-provenance/02-CONTEXT.md - D-32, D-36
 */
export function hasAnyProvenance(meta: ProvenanceMetadata): boolean {
  return (
    meta.rrspWithdrawal !== undefined ||
    meta.rrifWithdrawal !== undefined ||
    meta.tfsaWithdrawal !== undefined ||
    meta.nonRegWithdrawal !== undefined ||
    meta.lifWithdrawal !== undefined ||
    meta.livingExpenses !== undefined ||
    meta.rrifMandatoryMinimum !== undefined ||
    meta.totalIncome !== undefined ||
    meta.federalTax !== undefined ||
    meta.provincialTax !== undefined ||
    meta.totalTaxes !== undefined
  );
}
