/**
 * Predefined scenario decision templates — pre-filled `ScenarioDecisions`
 * payloads that users can apply when creating a new profile scenario.
 *
 * Successor to the legacy `scenarioTemplates` array in
 * `validation/scenario.schema.ts`, which targeted the deprecated
 * `modifications` shape on the legacy `scenarios` table. These templates
 * target `profile_scenarios.decisions` (the ScenarioDecisions schema).
 *
 * Only templates that translate cleanly to the modern decisions schema
 * are included. The legacy "aggressive-savings" and "market-downturn"
 * templates referenced `rrspAnnualContribution` / `investmentReturn`,
 * neither of which exists in ScenarioDecisions (contributions need a
 * per-account ID and investment return is a profile assumption, not a
 * decision), so they are not carried over.
 */
import type { ScenarioDecisions } from '../types/scenario.js';

export interface ScenarioDecisionTemplate {
  id: string;
  name: string;
  description: string;
  decisions: ScenarioDecisions;
}

export const scenarioDecisionTemplates: ScenarioDecisionTemplate[] = [
  {
    id: 'early-retirement-60',
    name: 'Early Retirement at 60',
    description: 'Retire at age 60 with CPP starting immediately and OAS at 65.',
    decisions: {
      retirementAge: 60,
      cppStartAge: 60,
      oasStartAge: 65,
    },
  },
  {
    id: 'delayed-retirement-67',
    name: 'Delayed Retirement at 67',
    description: 'Work two extra years and defer CPP and OAS to 67 to boost benefits.',
    decisions: {
      retirementAge: 67,
      cppStartAge: 67,
      oasStartAge: 67,
    },
  },
  {
    id: 'reduced-spending-later',
    name: 'Reduced Spending in Later Years',
    description: 'Step down spending by 15% from age 75 and 25% from age 85.',
    decisions: {
      ageBandReductions: [
        { fromAge: 75, reductionPercent: 0.15 },
        { fromAge: 85, reductionPercent: 0.25 },
      ],
    },
  },
];
