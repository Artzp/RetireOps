'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { listProfileScenarios } from '@/lib/api/profile-scenarios';
import type { ProfileScenarioListItem } from '@/types/profile-scenario';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function ReportsPage() {
  const [scenarios, setScenarios] = useState<ProfileScenarioListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await listProfileScenarios();
        if (!cancelled) setScenarios(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load scenarios');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="bg-ds-surface rounded-card p-12 flex flex-col items-center justify-center gap-4">
        <AlertCircle className="h-12 w-12 text-ds-error" />
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (scenarios === null) {
    return (
      <div className="bg-ds-surface rounded-card p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-ds-primary" />
      </div>
    );
  }

  const ready = scenarios.filter((s) => s.status === 'completed');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold font-display text-ds-on-background">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Open a scenario to generate a printable report you can save as a PDF.
        </p>
      </div>

      {ready.length === 0 ? (
        <div className="bg-ds-surface rounded-card p-12 flex flex-col items-center justify-center gap-3 text-center">
          <FileText className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No completed scenarios yet. Run a scenario from the Scenarios page first.
          </p>
          <Link href="/profile/scenarios">
            <Button variant="outline" size="sm">
              Go to Scenarios
            </Button>
          </Link>
        </div>
      ) : (
        <ul className="bg-ds-surface rounded-card divide-y divide-ds-outline-variant/40">
          {ready.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-ds-surface-raised"
            >
              <div className="min-w-0">
                <p className="font-medium text-ds-on-background truncate">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.calculated_at ? `Last run ${formatDate(s.calculated_at)}` : 'Never run'}
                </p>
              </div>
              <Link href={`/reports/${s.id}`}>
                <Button variant="outline" size="sm">
                  <FileText className="mr-2 h-4 w-4" />
                  Open report
                </Button>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
