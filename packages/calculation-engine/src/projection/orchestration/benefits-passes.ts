/**
 * Benefits passes 1 + 2 helper.
 *
 * Extracted from yearly-calculator.ts (Phase 9 plan 09-07 LOC cleanup).
 * Pass 1 supplies a placeholder netIncome=0 (CPP/OAS amounts only depend on
 * age). Pass 2 supplies preliminaryNetIncome (income known so far including
 * RRIF + LIF minimums but excluding Step-8 discretionary withdrawals) so OAS
 * clawback fires. Pass 3 lives separately (recalcBenefitsPass3) because it
 * runs much later in the pipeline.
 *
 * @see docs/source-of-truth/05-government-benefits.md
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 */

import type { AccountOwner, MaritalStatus } from '@retireops/shared';

import { calculateGovernmentBenefits } from '../../benefits/index.js';
import { getOASIndexationYears } from '../../tax/indexing.js';

export interface BenefitsPasses12Input {
  year: number;
  owner: AccountOwner;
  age: number;
  yearsOfResidence: number;
  maritalStatus: MaritalStatus;
  expectedCPPAt65: number;
  cppStartAge: number;
  oasStartAge: number;
  isRetired: boolean;
  employmentIncome: number;
  yearsFromProjectionStart: number;
  inflationRate: number;
  oasClawbackThreshold: number;
  spouseReceivingOAS?: boolean;

  // Pass 2 inputs (preliminaryNetIncome assembly)
  pensionIncome: number;
  rrifWithdrawal: number;
  lifWithdrawal: number;
  otherIncome: number;
}

export interface BenefitsPasses12Result {
  cppIncome: number;
  oasGross: number;
  /** Pass-2 netAmount (provisional; pass-3 may overwrite). */
  oasIncome: number;
  /** Pass-2 GIS (provisional; pass-3 may overwrite). */
  gisIncome: number;
}

/**
 * Run benefits pass 1 (CPP/OAS amounts) and pass 2 (provisional clawback)
 * back-to-back. Returns the four values the orchestrator needs to thread
 * forward into Step 6 / Step 8 / pass 3.
 */
export function runBenefitsPasses12(input: BenefitsPasses12Input): BenefitsPasses12Result {
  const sharedBase = {
    year: input.year,
    owner: input.owner,
    age: input.age,
    yearsOfResidence: input.yearsOfResidence,
    maritalStatus: input.maritalStatus,
    expectedCPPAt65: input.expectedCPPAt65,
    cppStartAge: input.cppStartAge,
    oasStartAge: input.oasStartAge,
    employmentIncome: input.isRetired ? 0 : input.employmentIncome,
    yearsFromStart: input.yearsFromProjectionStart,
    inflationRate: input.inflationRate,
    oasClawbackThreshold: input.oasClawbackThreshold,
    // Calendar-anchored OAS gross indexation (audit A-08): same 2026 base anchor
    // as the clawback threshold, derived from the projection start year.
    oasIndexationYears: getOASIndexationYears(
      input.year,
      input.year - input.yearsFromProjectionStart
    ),
    ...(input.spouseReceivingOAS !== undefined && {
      spouseReceivingOAS: input.spouseReceivingOAS,
    }),
  };

  const pass1 = calculateGovernmentBenefits({
    ...sharedBase,
    netIncome: 0, // Placeholder — pass 2 supplies the real value.
  });

  const cppIncome = input.age >= input.cppStartAge ? pass1.cpp.adjustedAmount : 0;
  const oasGross = input.age >= input.oasStartAge ? pass1.oas.baseAmount : 0;

  const preliminaryNetIncome =
    (input.isRetired ? 0 : input.employmentIncome) +
    input.pensionIncome +
    cppIncome +
    oasGross +
    input.rrifWithdrawal +
    input.lifWithdrawal +
    input.otherIncome;

  const pass2 = calculateGovernmentBenefits({
    ...sharedBase,
    netIncome: preliminaryNetIncome,
  });

  return {
    cppIncome,
    oasGross,
    oasIncome: input.age >= input.oasStartAge ? pass2.oas.netAmount : 0,
    gisIncome: pass2.gis?.amount ?? 0,
  };
}
