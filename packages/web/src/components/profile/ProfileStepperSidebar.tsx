'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StepConfig } from './lib/profile-constants';

interface ProfileStepperSidebarProps {
  steps: StepConfig[];
  currentStepIndex: number;
  visitedSteps: Set<number>;
  onStepClick: (index: number) => void;
}

export function ProfileStepperSidebar({
  steps,
  currentStepIndex,
  visitedSteps,
  onStepClick,
}: ProfileStepperSidebarProps) {
  return (
    <>
      {/* Mobile progress bar — full-width strip above the content */}
      <div className="md:hidden shrink-0 border-b border-ds-outline-variant bg-ds-surface px-4 pt-3 pb-3">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="whitespace-nowrap text-xs font-semibold text-ds-primary">
            Step {currentStepIndex + 1} of {steps.length}
          </span>
          <span className="truncate text-xs font-medium text-ds-on-background">
            {steps[currentStepIndex]?.label}
          </span>
        </div>
        <nav aria-label="Profile steps" className="flex items-center gap-1.5">
          {steps.map((step, index) => {
            const isCurrent = index === currentStepIndex;
            const isCompleted =
              index < currentStepIndex || (index !== currentStepIndex && visitedSteps.has(index));
            const isReachable = isCompleted;
            return (
              <button
                key={step.id}
                type="button"
                onClick={isReachable ? () => onStepClick(index) : undefined}
                disabled={!isReachable}
                aria-label={`Step ${index + 1}: ${step.label}`}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'group flex-1 rounded py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-primary',
                  isReachable ? 'cursor-pointer' : 'cursor-default'
                )}
              >
                <span
                  className={cn(
                    'block h-1.5 rounded-full transition-colors',
                    isCurrent || index < currentStepIndex
                      ? 'bg-ds-primary'
                      : isCompleted
                        ? 'bg-ds-primary-container'
                        : 'bg-ds-outline-variant',
                    isReachable && 'group-hover:bg-ds-primary'
                  )}
                />
              </button>
            );
          })}
        </nav>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:block w-56 shrink-0 border-r border-ds-outline-variant bg-ds-surface pt-6 pb-8 px-4">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 px-2">
          Your Profile
        </h2>
        <nav aria-label="Profile steps">
          <ol className="space-y-1">
            {steps.map((step, index) => {
              const isCurrent = index === currentStepIndex;
              const isCompleted =
                index < currentStepIndex || (index !== currentStepIndex && visitedSteps.has(index));

              return (
                <li key={step.id}>
                  {isCompleted ? (
                    <button
                      type="button"
                      onClick={() => onStepClick(index)}
                      className="flex items-center gap-3 w-full py-2 px-2 rounded-lg hover:bg-ds-surface-raised transition-colors cursor-pointer"
                      aria-label={`${step.label}, completed`}
                    >
                      <div className="w-7 h-7 rounded-full bg-ds-primary-container flex items-center justify-center shrink-0">
                        <Check className="h-4 w-4 text-ds-primary" />
                      </div>
                      <span className="text-sm font-semibold text-ds-on-background">
                        {step.label}
                      </span>
                    </button>
                  ) : isCurrent ? (
                    <div
                      className="flex items-center gap-3 w-full py-2 px-2 rounded-lg"
                      aria-current="step"
                    >
                      <div className="w-7 h-7 rounded-full border-2 border-ds-primary flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-ds-primary">{index + 1}</span>
                      </div>
                      <span className="text-sm font-semibold text-ds-primary">{step.label}</span>
                    </div>
                  ) : (
                    <div
                      className="flex items-center gap-3 w-full py-2 px-2 rounded-lg opacity-60 cursor-not-allowed"
                      aria-disabled="true"
                    >
                      <div className="w-7 h-7 rounded-full border-2 border-ds-outline-variant flex items-center justify-center shrink-0">
                        <span className="text-xs text-muted-foreground">{index + 1}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{step.label}</span>
                    </div>
                  )}
                  {index < steps.length - 1 && (
                    <div className="w-px h-4 bg-ds-outline-variant ml-[22px]" />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </aside>
    </>
  );
}
