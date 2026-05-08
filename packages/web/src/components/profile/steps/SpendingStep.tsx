'use client';

import Link from 'next/link';
import { useFormContext } from 'react-hook-form';
import { AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { FieldLabelHelp } from '@/components/ui/field-help';

const INPUT_STYLE =
  'border-0 border-b-2 border-ds-outline-variant bg-transparent rounded-none focus-visible:ring-0 focus-visible:border-b-ds-primary transition-[border-color] duration-200';

export function SpendingStep() {
  const { register } = useFormContext();

  return (
    <div className="space-y-6">
      <div
        role="note"
        className="flex gap-3 rounded-md border-l-4 border-ds-primary bg-ds-surface-raised p-4"
      >
        <AlertTriangle className="h-5 w-5 shrink-0 text-ds-primary mt-0.5" aria-hidden />
        <div className="space-y-1">
          <p className="text-sm font-bold text-ds-on-background">
            The single biggest driver of your plan
          </p>
          <p className="text-sm text-muted-foreground">
            How much you spend in retirement matters more than the market return you earn or the
            inflation rate you assume. A 10% miss on returns shifts your plan by a few years; a 10%
            miss on spending compounds every year you&rsquo;re retired and can change the answer
            entirely. Take your time with the next field &mdash; and revisit it after you see your
            first projection.
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Both numbers are in today&rsquo;s dollars — the projection inflates them for you. Need a
        refresher on terms?{' '}
        <Link href="/glossary" className="underline underline-offset-2 hover:text-ds-primary">
          Open the glossary
        </Link>
        .
      </p>

      <div className="space-y-2">
        <FieldLabelHelp
          htmlFor="currentAnnualSpending"
          help="Your total household after-tax spending today, in today's dollars. Include everything: housing, food, transport, travel, hobbies — but exclude savings and tax. A rough way to estimate it: take-home pay minus what you save."
          learnMoreHref="/glossary#nominal-vs-real"
        >
          Current annual spending
        </FieldLabelHelp>
        <Input
          id="currentAnnualSpending"
          type="number"
          inputMode="decimal"
          min={0}
          step={1000}
          placeholder="e.g. 75000"
          className={INPUT_STYLE}
          {...register('spending.currentAnnualSpending', { valueAsNumber: true })}
        />
      </div>

      <div className="space-y-2">
        <FieldLabelHelp
          htmlFor="retirementAnnualSpending"
          help="Total household after-tax spending you expect each year in retirement, in today's dollars. We'll inflate it for you. Most Canadians land between 60% and 90% of their pre-retirement spending — lower if the mortgage is gone, higher if you plan to travel."
          learnMoreHref="/glossary#nominal-vs-real"
        >
          Retirement annual spending
        </FieldLabelHelp>
        <Input
          id="retirementAnnualSpending"
          type="number"
          inputMode="decimal"
          min={0}
          step={1000}
          placeholder="e.g. 65000"
          className={INPUT_STYLE}
          {...register('spending.retirementAnnualSpending', { valueAsNumber: true })}
        />
      </div>
    </div>
  );
}
