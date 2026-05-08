/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle } from 'lucide-react';
import { ComparisonView } from '@/components/projection/results/scenarios/ComparisonView';
import { compareProfileScenarios } from '@/lib/api/profile-scenarios';
import type { ScenarioComparison } from '@/types/scenario';

function ComparisonContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const idsParam = searchParams.get('ids') ?? '';
  const ids = idsParam.split(',').filter(Boolean);

  const [comparison, setComparison] = useState<ScenarioComparison | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ids.length < 2) {
      setError('Select at least 2 scenarios to compare.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    compareProfileScenarios(ids)
      .then(setComparison)
      .catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : 'One or more scenarios have not been run. Run all selected scenarios and try again.'
        );
      })
      .finally(() => setIsLoading(false));
  }, [idsParam]); // depend on the string to avoid array reference issues

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-ds-primary" />
      </div>
    );
  }

  if (error ?? !comparison) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="h-12 w-12 text-ds-error mx-auto mb-4" />
        <p className="text-ds-on-error-container mb-4">
          {error ??
            'One or more scenarios have not been run. Run all selected scenarios and try again.'}
        </p>
        <Button
          variant="outline"
          className="border-ds-outline-variant"
          onClick={() => router.push('/profile/scenarios')}
        >
          Back to Scenarios
        </Button>
      </div>
    );
  }

  return <ComparisonView data={comparison} onBack={() => router.push('/profile/scenarios')} />;
}

export default function ComparisonPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-ds-primary" />
        </div>
      }
    >
      <ComparisonContent />
    </Suspense>
  );
}
