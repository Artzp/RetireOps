import { describe, expect, it } from 'vitest';
import { applyScenarioDecisions } from './scenario-decisions.js';
import type { FrontendInputData } from './projection-transformer.js';
import type { ScenarioDecisions } from '@retireops/shared';

function makeBase(): FrontendInputData {
  return {
    personalInfo: { retirementAge: 65, birthYear: 1960, province: 'ON' },
    governmentBenefits: { cppStartAge: 65, oasStartAge: 65 },
    accounts: [],
    expenses: { retirementAnnualExpenses: 50000 },
    investmentAssumptions: { rateOfReturn: 0.05, inflationRate: 0.02 },
  } as unknown as FrontendInputData;
}

describe('applyScenarioDecisions — bracketFill', () => {
  it('applies bracketFill with all fields', () => {
    const decisions: ScenarioDecisions = {
      bracketFill: { enabled: true, bracketTarget: 'current', annualCap: 50000 },
    };
    const result = applyScenarioDecisions(makeBase(), decisions);
    expect(result.bracketFill).toEqual({
      enabled: true,
      bracketTarget: 'current',
      annualCap: 50000,
    });
  });

  it('applies bracketFill with only enabled', () => {
    const decisions: ScenarioDecisions = {
      bracketFill: { enabled: true },
    };
    const result = applyScenarioDecisions(makeBase(), decisions);
    expect(result.bracketFill).toEqual({ enabled: true });
  });

  it('does not add bracketFill when decisions omit it', () => {
    const decisions: ScenarioDecisions = {};
    const result = applyScenarioDecisions(makeBase(), decisions);
    expect(result.bracketFill).toBeUndefined();
  });
});
