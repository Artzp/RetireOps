/**
 * Aggregate estate figures from terminal-return events.
 *
 * Extracted from multi-year.ts (Phase 10 plan 10-04 LOC cleanup, ENG-05).
 * grossEstate excludes rollover events (wasSpouseRolloverApplied=true) to avoid
 * double-counting the first decedent's pre-rollover balance, which is rolled
 * into the survivor's balances and already reflected in the survivor's event.
 * terminalTaxes sums all events (rollover events emit 0).
 *
 * @see docs/source-of-truth/04-tax-engine.md - terminal return / deemed disposition
 *
 * CRITICAL: This module is pure. No wall-clock reads, no PRNG, no I/O.
 */

import type { TerminalReturnResult } from '@retireops/shared';

export function aggregateEstateFromEvents(
  events: TerminalReturnResult[]
): { grossEstate: number; terminalTaxes: number; netEstate: number } | undefined {
  if (events.length === 0) return undefined;
  const grossEstate = events
    .filter((e) => !e.wasSpouseRolloverApplied)
    .reduce((acc, e) => acc + e.grossEstate, 0);
  const terminalTaxes = events.reduce((acc, e) => acc + e.terminalTaxes, 0);
  return { grossEstate, terminalTaxes, netEstate: grossEstate - terminalTaxes };
}
