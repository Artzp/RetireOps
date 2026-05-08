import { describe, expect, it } from 'vitest';
import { runProjection } from '@retireops/calculation-engine';
import { demoHousehold2026FrontendInput } from '../test/fixtures/demo-household-2026.js';
import { transformToFrontendOutput, transformToProjectionInput } from './projection-transformer.js';

describe('demo household 2026 projection regression', () => {
  it('routes personal and spousal RRSP contributions through the fresh full pipeline', () => {
    const calcInput = transformToProjectionInput(demoHousehold2026FrontendInput);

    expect(calcInput.rrspAnnualContribution).toBe(26250);
    expect(calcInput.spousalRrspContribution).toBe(19000);

    const calcOutput = runProjection(calcInput);
    const frontendOutput = transformToFrontendOutput(calcOutput, 90);
    const y2026 = frontendOutput.projectionRows.find((row) => row.year === 2026);

    expect(y2026).toBeDefined();
    expect(Math.round(y2026!.rrspBalance)).toBe(7721);
    expect(Math.round(y2026!.spouseRrspBalance ?? 0)).toBe(16241);
  });
});
