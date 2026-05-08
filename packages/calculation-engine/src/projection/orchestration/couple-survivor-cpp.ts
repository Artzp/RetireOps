/**
 * Couple-path survivor CPP override computation.
 *
 * Extracted from multi-year.ts (Phase 10 plan 10-04 LOC cleanup, ENG-05).
 *
 * For survivor mode, computes the override expectedCPPAt65 that, when the
 * engine applies its normal calculateCPPBenefit(expectedAt65, startAge)
 * formula, produces the correct combined CPP (own + survivor benefit).
 * Formula: overrideAt65 = combinedCPP / adjustmentFactor(startAge).
 * This preserves all other CPP logic (indexing, OAS clawback) correctly.
 *
 * @see docs/source-of-truth/05-government-benefits.md - CPP Survivor Benefits
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 */

import type { ProjectionInput } from '@retireops/shared';
import { ageAtEndOfYear } from '@retireops/shared';
import {
  calculateCPPSurvivorBenefit,
  calculateCombinedCPP,
  calculateCPPBenefit,
  calculateCPPAdjustmentFactor,
  indexCPPBenefit,
} from '../../benefits/cpp.js';

/**
 * Calculate the base annual CPP amount for a person at a given projection year.
 * Used to determine the survivor's own CPP for combined-benefit calculations.
 * @see docs/source-of-truth/05-government-benefits.md - CPP Survivor Benefits
 */
export function calculateBaseCPP(
  person: { expectedCPPAt65: number; cppStartAge?: number; birthdate: Date },
  year: number
): number {
  const startAge = person.cppStartAge ?? 65;
  const age = ageAtEndOfYear(person.birthdate, year);
  if (age < startAge) return 0;
  const baseCPP = calculateCPPBenefit(person.expectedCPPAt65, startAge);
  return indexCPPBenefit(baseCPP, 0, Math.max(0, age - startAge));
}

export interface SurvivorCPPArgs {
  input: ProjectionInput;
  spouse: NonNullable<ProjectionInput['spouse']>;
  year: number;
  primaryDeceased: boolean;
  spouseDeceased: boolean;
  lastKnownPrimaryCPP: number;
  lastKnownSpouseCPP: number;
}

export interface SurvivorCPPResult {
  survivorCPPAt65ForPrimary?: number;
  survivorCPPAt65ForSpouse?: number;
}

export function computeSurvivorCPPOverrides(args: SurvivorCPPArgs): SurvivorCPPResult {
  const {
    input,
    spouse,
    year,
    primaryDeceased,
    spouseDeceased,
    lastKnownPrimaryCPP,
    lastKnownSpouseCPP,
  } = args;
  const result: SurvivorCPPResult = {};

  if (primaryDeceased && lastKnownPrimaryCPP > 0) {
    // Primary is deceased — spouse receives survivor benefit
    const survivorBenefit = calculateCPPSurvivorBenefit(lastKnownPrimaryCPP);
    const spouseOwnCPP = calculateBaseCPP(spouse, year);
    const combinedCPP = calculateCombinedCPP(spouseOwnCPP, survivorBenefit);
    const spouseStartAge = spouse.cppStartAge ?? 65;
    const factor = calculateCPPAdjustmentFactor(Math.min(Math.max(spouseStartAge, 60), 70));
    result.survivorCPPAt65ForSpouse = factor > 0 ? combinedCPP / factor : combinedCPP;
  }

  if (spouseDeceased && lastKnownSpouseCPP > 0) {
    // Spouse is deceased — primary receives survivor benefit
    const survivorBenefit = calculateCPPSurvivorBenefit(lastKnownSpouseCPP);
    const primaryOwnCPP = calculateBaseCPP(
      {
        expectedCPPAt65: input.expectedCPPAt65 ?? 12000,
        cppStartAge: input.cppStartAge ?? 65,
        birthdate: input.birthdate,
      },
      year
    );
    const combinedCPP = calculateCombinedCPP(primaryOwnCPP, survivorBenefit);
    const primaryStartAge = input.cppStartAge ?? 65;
    const factor = calculateCPPAdjustmentFactor(Math.min(Math.max(primaryStartAge, 60), 70));
    result.survivorCPPAt65ForPrimary = factor > 0 ? combinedCPP / factor : combinedCPP;
  }

  return result;
}
