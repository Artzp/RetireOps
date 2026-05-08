/**
 * Monte Carlo Input Zod Schema — v1.13
 *
 * Validates MonteCarloInput payloads at API boundaries.
 *
 * @see specs/009-monte-carlo-simulation/data-model.md - Validation Rules Summary
 * @see packages/shared/src/types/monte-carlo.ts
 */
import { z } from 'zod';

export const monteCarloInputSchema = z.object({
  projectionId: z.string().uuid(),
  numSimulations: z.number().int().min(1000).max(10000),
  expectedReturn: z.number().min(-0.5).max(0.5),
  volatility: z.number().min(0).max(1.0),
  seed: z.number().int().optional(),
});

export type MonteCarloInputSchema = z.infer<typeof monteCarloInputSchema>;
