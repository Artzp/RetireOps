// Local state shapes for the scenario decisions editor. Extracted from page.tsx
// so the per-section components (SpendingSection, …) can share the same types.

export interface PropertySaleRow {
  propertyId: string;
  saleYear: number;
  sellingCostsPercent: number; // display: 0–100
}

export interface TimingState {
  cppStartAge: number;
  spouseCppStartAge: number;
  oasStartAge: number;
  spouseOasStartAge: number;
  retirementAge: number;
  spouseRetirementAge: number;
  dbPensionStartAge: number;
  propertySaleDecisions: PropertySaleRow[];
}

export interface RrspMeltdown {
  enabled: boolean;
  annualAmount: number;
  startYear: number;
  endYear: number;
}

export interface IncomeSplitting {
  enabled: boolean;
  splitPercent: number; // display: 0–50
}

export interface OasClawback {
  enabled: boolean;
  incomeThreshold: number;
}

export interface BracketFill {
  enabled: boolean;
  bracketTarget: 'current' | 'next';
  // Undefined = unlimited (engine fills to bracket ceiling). A literal 0 would instruct the
  // engine to withdraw nothing, so callers must use undefined, not 0, to mean "no cap".
  annualCap: number | undefined;
}

export interface TaxState {
  drawdownOrder: string[];
  rrspMeltdown: RrspMeltdown;
  incomeSplitting: IncomeSplitting;
  oasClawbackAvoidance: OasClawback;
  bracketFill: BracketFill;
}

export interface ContributionOverrideRow {
  accountId: string;
  annualAmount: number;
  startYear: number;
  endYear: number;
}

export interface SavingsState {
  contributionOverrides: ContributionOverrideRow[];
}

export interface AgeBandReductionRow {
  fromAge: number;
  reductionPercent: number; // display: 0–100
}

export interface SpendingState {
  targetRetirementSpending: number;
  inflationRate: number; // display: 0–20
  ageBandReductions: AgeBandReductionRow[];
  legacyTarget: number;
}
