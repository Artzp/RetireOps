/**
 * Single-projection terminal-return event builder.
 *
 * Extracted from multi-year.ts (Phase 10 plan 10-04 LOC cleanup, ENG-05).
 * Single path has no spouse by construction, so the deemed-disposition event
 * fires once at endYear with hasSurvivingSpouse=false. Pure spike at marginal
 * rates with ordinary-income inputs = 0 (non-overlapping with accumulated
 * totalTaxesPaid).
 *
 * @see docs/source-of-truth/04-tax-engine.md - Terminal Return / Deemed Disposition
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 */

import type { ProjectionInput, TerminalReturnResult } from '@retireops/shared';
import { calculateTerminalReturn } from '../../tax/terminal-return.js';

export interface SingleTerminalEventArgs {
  input: ProjectionInput;
  startYear: number;
  endYear: number;
  rrspBalance: number;
  rrifBalance: number;
  tfsaBalance: number;
  nonRegBalance: number;
  nonRegACB: number;
}

export function buildSingleTerminalEvent(args: SingleTerminalEventArgs): TerminalReturnResult {
  const {
    input,
    startYear,
    endYear,
    rrspBalance,
    rrifBalance,
    tfsaBalance,
    nonRegBalance,
    nonRegACB,
  } = args;
  const terminalEventInput: Parameters<typeof calculateTerminalReturn>[0] = {
    year: endYear,
    owner: 'primary',
    province: input.province,
    age: input.lifeExpectancy,
    ordinaryIncomeInDeathYear: 0,
    pensionIncome: 0,
    cppIncome: 0,
    oasIncome: 0,
    otherIncome: 0,
    rrspBalance,
    rrifBalance,
    liraBalance: 0,
    lifBalance: 0,
    tfsaBalance,
    nonRegBalance,
    nonRegACB,
    hasSurvivingSpouse: false,
  };
  terminalEventInput.inflationRate = input.inflationRate;
  terminalEventInput.indexingBaseYear = startYear;
  return calculateTerminalReturn(terminalEventInput);
}
