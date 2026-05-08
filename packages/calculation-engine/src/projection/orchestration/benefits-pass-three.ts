/**
 * Pass-3 OAS / GIS recalculation.
 *
 * Extracted from yearly-calculator.ts (Phase 9 plan 09-07 LOC cleanup).
 * Re-runs the benefits engine after Step-8 discretionary withdrawals are
 * known so the OAS clawback in line 23500 reflects the full net income
 * (line 23600). GROSS OAS feeds into the netIncome term, not the already-
 * netted pass-2 amount.
 *
 * @see docs/source-of-truth/05-government-benefits.md - GIS Calculation
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 */

import type { AccountOwner, MaritalStatus } from '@retireops/shared';

import { calculateGovernmentBenefits } from '../../benefits/index.js';

/** Inputs to compute pass-3 OAS / GIS. */
export interface BenefitsPass3Input {
  year: number;
  owner: AccountOwner;
  age: number;
  oasStartAge: number;
  yearsOfResidence: number;
  maritalStatus: MaritalStatus;
  expectedCPPAt65: number;
  cppStartAge: number;
  yearsFromProjectionStart: number;
  inflationRate: number;
  oasClawbackThreshold: number;
  spouseReceivingOAS?: boolean;

  // Income components for finalNetIncome assembly
  isRetired: boolean;
  employmentIncome: number;
  pensionIncome: number;
  cppIncome: number;
  oasGross: number;
  rrifWithdrawal: number; // mandatory minimum
  additionalRRIFWithdrawal: number;
  rrspWithdrawal: number;
  meltdownRRSPWithdrawal: number;
  bracketFillWithdrawal: number;
  nonRegTaxableGain: number;
  otherIncome: number;
  /** Couple path passes totalLIFWithdrawal; single path passes 0. */
  totalLIFWithdrawal: number;
}

export interface BenefitsPass3Result {
  oasGrossIncome: number;
  oasIncome: number;
  oasClawback: number;
  gisIncome: number;
}

/**
 * Run pass-3 OAS clawback + GIS recalc. Returns updated oasIncome / gisIncome.
 * If the gating condition (age < 65 || age < oasStartAge) fails, returns the
 * inputs `defaultOAS` and `defaultGIS` unchanged (caller passes the pass-2
 * values as defaults).
 */
export function recalcBenefitsPass3(
  input: BenefitsPass3Input,
  defaultOAS: number,
  defaultGIS: number
): BenefitsPass3Result {
  if (input.age < 65 || input.age < input.oasStartAge) {
    return {
      oasGrossIncome: input.oasGross,
      oasIncome: defaultOAS,
      oasClawback: 0,
      gisIncome: defaultGIS,
    };
  }

  const finalNetIncome =
    (input.isRetired ? 0 : input.employmentIncome) +
    input.pensionIncome +
    input.cppIncome +
    input.oasGross +
    input.rrifWithdrawal +
    input.additionalRRIFWithdrawal +
    input.totalLIFWithdrawal +
    input.rrspWithdrawal +
    input.meltdownRRSPWithdrawal +
    input.bracketFillWithdrawal +
    input.nonRegTaxableGain +
    input.otherIncome;

  const benefits = calculateGovernmentBenefits({
    year: input.year,
    owner: input.owner,
    age: input.age,
    yearsOfResidence: input.yearsOfResidence,
    maritalStatus: input.maritalStatus,
    expectedCPPAt65: input.expectedCPPAt65,
    cppStartAge: input.cppStartAge,
    oasStartAge: input.oasStartAge,
    netIncome: finalNetIncome,
    employmentIncome: input.isRetired ? 0 : input.employmentIncome,
    yearsFromStart: input.yearsFromProjectionStart,
    inflationRate: input.inflationRate,
    oasClawbackThreshold: input.oasClawbackThreshold,
    ...(input.spouseReceivingOAS !== undefined && {
      spouseReceivingOAS: input.spouseReceivingOAS,
    }),
  });

  return {
    oasGrossIncome: benefits.oas.baseAmount,
    oasIncome: benefits.oas.netAmount,
    oasClawback: benefits.oas.clawbackAmount,
    gisIncome: benefits.gis?.amount ?? 0,
  };
}
