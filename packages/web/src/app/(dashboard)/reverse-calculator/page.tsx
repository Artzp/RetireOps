/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
'use client';

import { useState, useEffect } from 'react';
import { SolverForm } from '@/components/reverse-calculator/SolverForm';
import { SolverResultCard } from '@/components/reverse-calculator/SolverResultCard';
import { getSolverPrefill, postSolver } from '@/lib/api/solver';
import type { SolverPrefillData } from '@/lib/api/solver';
import type { SolverInput, SolverResult } from '@retireops/shared';

export default function ReverseCalculatorPage() {
  const [prefillData, setPrefillData] = useState<SolverPrefillData | null>(null);
  const [result, setResult] = useState<SolverResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const data = await getSolverPrefill();
      if (data) setPrefillData(data);
    })();
  }, []);

  async function handleSubmit(input: SolverInput): Promise<void> {
    setIsSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const solverResult = await postSolver(input);
      setResult(solverResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-ds-on-background">Reverse Calculator</h1>
      <p className="text-sm text-muted-foreground mb-6">Work backward from your goal</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <SolverForm
            prefillData={prefillData}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            error={error}
          />
        </div>

        <div>
          {result !== null ? (
            <div className="animate-in fade-in-0 duration-300">
              <SolverResultCard result={result} />
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-medium text-muted-foreground mb-2">
                Select a mode to get started
              </h2>
              <p className="text-sm text-muted-foreground">
                Choose one of the four calculation modes above, fill in your details, and click
                Calculate to see your answer.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
