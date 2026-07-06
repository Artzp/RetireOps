'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { MonteCarloJobResult, MonteCarloJobStatusValue } from '@retireops/shared';
import {
  submitMonteCarloJob,
  getMonteCarloJobStatus,
  cancelMonteCarloJob,
  submitScenarioMonteCarloJob,
  getScenarioMonteCarloJobStatus,
  cancelScenarioMonteCarloJob,
} from '@/lib/api/monte-carlo';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FieldLabelHelp } from '@/components/ui/field-help';
import { useToast } from '@/components/ui/use-toast';

const MonteCarloFanChartDynamic = dynamic(
  () => import('./MonteCarloFanChart').then((m) => ({ default: m.MonteCarloFanChart })),
  { ssr: false, loading: () => <div className="h-80 w-full rounded-card bg-muted animate-pulse" /> }
);

interface MonteCarloProps {
  ownerType: 'projection' | 'scenario';
  ownerId: string;
  /**
   * Optional cached result (e.g. from sessionStorage) used to rehydrate the
   * panel after a tab switch. The panel still allows running a new simulation,
   * which will replace this result.
   */
  initialResult?: MonteCarloJobResult | null;
  /**
   * Notified whenever the displayed result changes — pass null on reset, the
   * latest value on completion. The parent uses this to mirror the result
   * into sessionStorage so the Summary tab can read it.
   */
  onResultChange?: (result: MonteCarloJobResult | null) => void;
}

export function MonteCarloPanel({
  ownerType,
  ownerId,
  initialResult = null,
  onResultChange,
}: MonteCarloProps) {
  const submitJob = ownerType === 'scenario' ? submitScenarioMonteCarloJob : submitMonteCarloJob;
  const getStatus =
    ownerType === 'scenario' ? getScenarioMonteCarloJobStatus : getMonteCarloJobStatus;
  const cancelJob = ownerType === 'scenario' ? cancelScenarioMonteCarloJob : cancelMonteCarloJob;
  // Control values stored as display percentages (converted to decimals at submit)
  const [meanReturnPct, setMeanReturnPct] = useState(6.5);
  const [stdDevPct, setStdDevPct] = useState(11);
  const [numTrials, setNumTrials] = useState(1000);

  // Job lifecycle state. When initialResult is provided, the panel boots in a
  // pseudo-completed state so the fan chart and stats render immediately.
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<MonteCarloJobStatusValue | 'idle'>(
    initialResult ? 'completed' : 'idle'
  );
  const [progress, setProgress] = useState(initialResult ? 100 : 0);
  const [result, setResult] = useState<MonteCarloJobResult | null>(initialResult);
  const [error, setError] = useState<string | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  // Derived: are we actively running?
  const isRunning = status === 'pending' || status === 'processing';

  // stopPolling: clears the recursive setTimeout chain
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // Cleanup on unmount — prevents state updates after component is gone
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // schedulePoll: recursive setTimeout that polls every 1000ms
  // Takes projId + jId as params to avoid stale closure over state
  const schedulePoll = useCallback(
    (projId: string, jId: string) => {
      pollTimerRef.current = setTimeout(() => {
        void (async () => {
          try {
            const jobStatus = await getStatus(projId, jId);
            setProgress(jobStatus.progress);
            setStatus(jobStatus.status);

            if (jobStatus.status === 'completed') {
              const completed = jobStatus.result ?? null;
              setResult(completed);
              onResultChange?.(completed);
              stopPolling();
            } else if (jobStatus.status === 'failed') {
              setError(jobStatus.error ?? 'Unknown error');
              stopPolling();
            } else if (jobStatus.status === 'cancelled') {
              stopPolling();
            } else {
              // pending or processing — schedule next poll
              schedulePoll(projId, jId);
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Polling error';
            setStatus('failed');
            setError(message);
            stopPolling();
          }
        })();
      }, 1000);
    },
    [stopPolling, getStatus]
  );

  const handleRun = async () => {
    // Reset all job state before starting new job
    setResult(null);
    onResultChange?.(null);
    setError(null);
    setProgress(0);
    setStatus('pending');
    setJobId(null);
    stopPolling();

    try {
      // Convert percentage display values to decimal fractions for the API
      const expectedReturn = meanReturnPct / 100;
      const volatility = stdDevPct / 100;

      const response = await submitJob(ownerId, {
        numSimulations: numTrials,
        expectedReturn,
        volatility,
      });

      setJobId(response.jobId);
      schedulePoll(ownerId, response.jobId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start simulation';
      setStatus('failed');
      setError(message);
      toast({
        variant: 'destructive',
        title: 'Simulation error',
        description: message,
      });
    }
  };

  const handleCancel = async () => {
    if (jobId === null) return;
    try {
      await cancelJob(ownerId, jobId);
      stopPolling();
      setStatus('cancelled');
    } catch {
      toast({
        variant: 'destructive',
        title: 'Cancel failed',
        description: 'Cancel failed — try again.',
      });
    }
  };

  // Worst-case trials: sorted by earliest depletionYear ascending, nulls last, top 3
  const sortedWorstCaseTrials =
    result !== null
      ? [...result.worstCaseTrials]
          .sort((a, b) => {
            if (a.depletionYear === null && b.depletionYear === null) return 0;
            if (a.depletionYear === null) return 1;
            if (b.depletionYear === null) return -1;
            return a.depletionYear - b.depletionYear;
          })
          .slice(0, 3)
      : [];

  return (
    <Card className="bg-ds-surface rounded-card border-0">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Monte Carlo Simulation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Controls section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Mean Return input */}
          <div className="space-y-2">
            <FieldLabelHelp
              htmlFor="mc-mean-return"
              helpId="mc-mean-return-help"
              help="The average yearly investment return (before inflation) the simulation centres on. The risk-profile presets set this for you."
              className="font-medium"
            >
              Mean Return (%)
            </FieldLabelHelp>
            <Input
              id="mc-mean-return"
              aria-describedby="mc-mean-return-help"
              type="number"
              min={0}
              max={20}
              step={0.1}
              value={meanReturnPct}
              onChange={(e) => setMeanReturnPct(Number(e.target.value))}
              disabled={isRunning}
            />
          </div>
          {/* Standard Deviation input */}
          <div className="space-y-2">
            <FieldLabelHelp
              htmlFor="mc-std-dev"
              helpId="mc-std-dev-help"
              help="How much returns swing from year to year — higher means wilder markets in the simulation. Stock-heavy portfolios are typically 10–20%; the presets pick a sensible value."
              className="font-medium"
            >
              Standard Deviation (%)
            </FieldLabelHelp>
            <Input
              id="mc-std-dev"
              aria-describedby="mc-std-dev-help"
              type="number"
              min={1}
              max={50}
              step={0.1}
              value={stdDevPct}
              onChange={(e) => setStdDevPct(Number(e.target.value))}
              disabled={isRunning}
            />
          </div>
          {/* Trial Count input */}
          <div className="space-y-2">
            <FieldLabelHelp
              htmlFor="mc-trials"
              helpId="mc-trials-help"
              help="How many random market futures to simulate. More trials give a steadier success rate but take longer — 1,000 is plenty for most plans."
              className="font-medium"
            >
              Number of Trials
            </FieldLabelHelp>
            <Input
              id="mc-trials"
              aria-describedby="mc-trials-help"
              type="number"
              min={100}
              max={10000}
              step={100}
              value={numTrials}
              onChange={(e) => setNumTrials(Number(e.target.value))}
              disabled={isRunning}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {!isRunning && (
            <Button
              onClick={() => void handleRun()}
              className="bg-ds-primary text-ds-on-primary rounded-button"
            >
              {status === 'idle' ? 'Run Simulation' : 'Run Again'}
            </Button>
          )}
          {isRunning && (
            <Button
              variant="outline"
              onClick={() => void handleCancel()}
              className="border-ds-outline-variant"
            >
              Cancel
            </Button>
          )}
        </div>

        {/* Progress bar — visible during active run */}
        {isRunning && (
          <div className="space-y-2">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-muted-foreground">{progress}% complete</p>
          </div>
        )}

        {/* Error state */}
        {status === 'failed' && error !== null && (
          <div className="bg-ds-error-container border border-ds-error/30 rounded-card p-4 space-y-2">
            <p className="text-sm text-ds-on-error-container">Simulation failed: {error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleRun()}
              className="border-ds-outline-variant"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Cancelled state */}
        {status === 'cancelled' && (
          <div className="bg-ds-tertiary-container border border-ds-tertiary/30 rounded-card p-4">
            <p className="text-sm text-ds-on-tertiary-container">Simulation cancelled.</p>
          </div>
        )}

        {/* Results — visible after successful completion */}
        {status === 'completed' && result !== null && (
          <div className="space-y-6">
            {/* Success rate — large prominent display per MC-RES-01 */}
            <div>
              <p className="text-2xl font-bold text-ds-on-background">
                {result.successRate}% success rate
              </p>
              <p className="text-sm text-muted-foreground">
                ({Math.round((result.successRate * result.numSimulations) / 100)} of{' '}
                {result.numSimulations} trials ended without depletion)
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                This answers a different question than the Summary tab&apos;s &ldquo;years
                funded&rdquo; figure: that one follows a single steady-return path, while this
                counts the share of simulated volatile-market paths that never ran out of money.
              </p>
            </div>

            {/* Worst-case trials table per MC-RES-03 */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-ds-on-background">
                Worst-Case Trials
              </h3>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-ds-outline-variant text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Trial #</th>
                    <th className="pb-2 pr-4">Depletion Year</th>
                    <th className="pb-2 pr-4">Final Balance</th>
                    <th className="pb-2">Returns (first 3 yrs)</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedWorstCaseTrials.map((trial) => (
                    <tr key={trial.trialId} className="border-b border-ds-outline-variant/50">
                      <td className="py-2 pr-4">{trial.trialId}</td>
                      <td className="py-2 pr-4">{trial.depletionYear ?? 'Safe'}</td>
                      <td className="py-2 pr-4">
                        $
                        {trial.finalBalance.toLocaleString('en-CA', {
                          maximumFractionDigits: 0,
                        })}
                      </td>
                      <td className="py-2">
                        {trial.returnSequence
                          .slice(0, 3)
                          .map(
                            (r) =>
                              `${r.returnRate >= 0 ? '+' : ''}${(r.returnRate * 100).toFixed(1)}%`
                          )
                          .join(' / ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Fan chart — percentile bands per MC-VIZ-01/02/03 */}
            {result.percentileBands.length > 0 && (
              <MonteCarloFanChartDynamic data={result.percentileBands} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
