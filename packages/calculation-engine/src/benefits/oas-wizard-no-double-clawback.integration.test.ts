/**
 * OAS-09 integration test: engine + wizard agree on recovery-tax accounting.
 *
 * The wizard (packages/shared/src/benefits/estimators/oas-estimator.ts) outputs
 * GROSS OAS only. The engine (packages/calculation-engine/src/tax/oas-clawback.ts)
 * computes the recovery-tax subtraction. This test proves that for a $120k
 * high-income scenario:
 *
 *   engine_net = wizard_gross - engine_clawback
 *
 * with no double-subtraction. The static-source assertion in Describe 4
 * enforces Pitfall §6 at the file level: the shared estimator MUST contain
 * no clawback math.
 *
 * @see docs/source-of-truth/PITFALLS.md §6 (no double-clawback)
 * @see docs/source-of-truth/05-government-benefits.md OAS Clawback section
 * @see .planning/REQUIREMENTS.md OAS-09
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateOASClawback, getOASClawbackThreshold } from '../tax/oas-clawback.js';
import { estimateOAS, OAS_2026 } from '@retireops/shared/benefits';

const __dirname = dirname(fileURLToPath(import.meta.url));

// per docs/source-of-truth/18-pensions-2026.md#2026-oas-q2-amount-65to74
const MAX_AT_65 = OAS_2026.q2.maxMonthlyAge65To74 * 12; // ≈ 8916.60

describe('OAS-09: $120k scenario — engine_OAS = wizard_gross − engine_clawback', () => {
  const wizardGross = estimateOAS({
    kind: 'oas-helper',
    startAge: 65,
    residenceYearsAfter18: 40,
  }).annualGross;

  it('wizard estimateOAS returns full GROSS pension at 40 years, startAge 65', () => {
    // per docs/source-of-truth/18-pensions-2026.md#2026-oas-q2-amount-65to74
    expect(wizardGross).toBeCloseTo(MAX_AT_65, 6);
  });

  it('engine clawback at $120k income matches 15% × (income − threshold)', () => {
    // per docs/source-of-truth/05-government-benefits.md OAS Clawback (Recovery Tax) section
    // per docs/source-of-truth/04-tax-engine.md OAS Clawback Calculation
    const threshold = getOASClawbackThreshold(2026);
    const engineClawback = calculateOASClawback(120_000, wizardGross, 2026);
    const excess = 120_000 - threshold;
    const expectedClawback = Math.min(excess * 0.15, wizardGross);
    expect(engineClawback).toBeCloseTo(expectedClawback, 2);
    expect(engineClawback).toBeGreaterThan(0); // sanity: this scenario actually clawbacks
    expect(engineClawback).toBeLessThan(wizardGross); // sanity: not full clawback at $120k
  });

  it('engine_net = wizard_gross − engine_clawback is positive (some OAS survives at $120k)', () => {
    const engineClawback = calculateOASClawback(120_000, wizardGross, 2026);
    const engineNet = wizardGross - engineClawback;
    expect(engineNet).toBeGreaterThan(0);
    expect(engineNet).toBeLessThan(wizardGross);
  });
});

describe('OAS-09 boundary: below threshold ⇒ no clawback', () => {
  it('$80k income < $95,323 threshold ⇒ engine_clawback = 0; net = wizard_gross', () => {
    // per docs/source-of-truth/18-pensions-2026.md#2026-oas-clawback-threshold
    const wizardGross = estimateOAS({
      kind: 'oas-helper',
      startAge: 65,
      residenceYearsAfter18: 40,
    }).annualGross;
    const engineClawback = calculateOASClawback(80_000, wizardGross, 2026);
    expect(engineClawback).toBe(0);
    expect(wizardGross - engineClawback).toBeCloseTo(wizardGross, 6);
  });
});

describe('OAS-09 boundary: above full-clawback ceiling ⇒ full clawback (net = 0)', () => {
  it('$170k income ⇒ 15% × ($170k − threshold) > wizard_gross ⇒ engine caps clawback at wizard_gross; net = 0', () => {
    // per docs/source-of-truth/18-pensions-2026.md#2026-oas-full-clawback-65to74
    // $170k > $154,753 full-clawback ceiling for ages 65–74
    // excess = 170,000 − 95,323 = 74,677; 15% × 74,677 = 11,201.55 > wizard_gross ≈ 8,916.60
    const wizardGross = estimateOAS({
      kind: 'oas-helper',
      startAge: 65,
      residenceYearsAfter18: 40,
    }).annualGross;
    const engineClawback = calculateOASClawback(170_000, wizardGross, 2026);
    expect(engineClawback).toBeCloseTo(wizardGross, 6); // capped at wizard_gross
    expect(wizardGross - engineClawback).toBeCloseTo(0, 6); // net OAS = 0
  });
});

describe('OAS-09 static-source guard: shared estimator has zero clawback MATH (Pitfall §6)', () => {
  // @see docs/source-of-truth/PITFALLS.md §6 (no double-clawback)
  // This static-source assertion is a redundant trip-wire: if a future contributor adds
  // clawback LOGIC to the shared estimator, BOTH the numeric integration test above AND
  // this static grep gate fail. Two independent gates must be subverted simultaneously
  // to introduce double-clawback silently.
  //
  // NOTE: Informational JSDoc comments in oas-estimator.ts that mention the word "clawback"
  // to document where clawback math lives are NOT violations — they are correct architecture
  // documentation. The guard checks for FUNCTIONAL clawback indicators (imports, rate
  // usage, threshold comparisons) that would indicate actual clawback computation.

  const estimatorPath = resolve(
    __dirname,
    '../../../shared/src/benefits/estimators/oas-estimator.ts'
  );
  if (!existsSync(estimatorPath)) {
    throw new Error(
      `OAS-09 static guard: cannot find oas-estimator.ts at expected path.\n` +
        `Expected: ${estimatorPath}\n` +
        `If the file moved, update this path AND Architecture Principle IV documentation.\n` +
        `See docs/source-of-truth/PITFALLS.md §6.`
    );
  }
  const estimatorSource = readFileSync(estimatorPath, 'utf8');

  const adjustPath = resolve(
    __dirname,
    '../../../shared/src/benefits/estimators/adjust-oas-for-start-age.ts'
  );
  if (!existsSync(adjustPath)) {
    throw new Error(
      `OAS-09 static guard: cannot find adjust-oas-for-start-age.ts at expected path.\n` +
        `Expected: ${adjustPath}\n` +
        `If the file moved, update this path AND Architecture Principle IV documentation.\n` +
        `See docs/source-of-truth/PITFALLS.md §6.`
    );
  }
  const adjustSource = readFileSync(adjustPath, 'utf8');

  it('source of oas-estimator.ts does not import clawback constants (OAS_CLAWBACK_THRESHOLDS, OAS_RATES)', () => {
    // Importing the engine's threshold map or rate constants would indicate clawback logic.
    // Architecture: clawback constants belong in @retireops/calculation-engine only.
    // @see docs/source-of-truth/PITFALLS.md §6
    const importMatch = estimatorSource.match(
      /OAS_CLAWBACK_THRESHOLDS|calculateOASClawback|clawbackRate|clawbackThreshold/
    );
    if (importMatch !== null) {
      const start = Math.max(0, (importMatch.index ?? 0) - 80);
      const end = (importMatch.index ?? 0) + 80;
      expect(
        importMatch,
        `Pitfall §6 violation: the shared OAS estimator imports or references a clawback constant:\n` +
          `${estimatorSource.slice(start, end)}\n` +
          `Clawback math belongs in @retireops/calculation-engine, NOT in the wizard estimator.\n` +
          `See docs/source-of-truth/PITFALLS.md §6.`
      ).toBeNull();
    }
    expect(importMatch).toBeNull();
  });

  it('source of oas-estimator.ts does not contain recovery-tax synonym identifiers', () => {
    // Checks for engineering disguises of the clawback concept as identifier names
    // (as opposed to mention in JSDoc comments, which are permitted documentation).
    // recoveryTax / recovery_tax appearing as an identifier (not in a comment or string)
    // would indicate functional clawback logic.
    expect(estimatorSource.match(/recoveryTax|recovery_tax/i)).toBeNull();
  });

  it('source of adjust-oas-for-start-age.ts contains no functional clawback references', () => {
    // The deferral-adjustment helper has no business touching clawback logic.
    const clawbackFunctional = adjustSource.match(
      /OAS_CLAWBACK_THRESHOLDS|calculateOASClawback|clawbackRate|clawbackThreshold|recoveryTax|recovery_tax/i
    );
    expect(clawbackFunctional).toBeNull();
  });
});
