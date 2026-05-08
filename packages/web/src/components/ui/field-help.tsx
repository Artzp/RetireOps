'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface FieldLabelHelpProps {
  children: ReactNode;
  help: string;
  htmlFor?: string;
  helpId?: string;
  className?: string;
  learnMoreHref?: string;
}

export function FieldLabelHelp({
  children,
  help,
  htmlFor,
  helpId,
  className,
  learnMoreHref,
}: FieldLabelHelpProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor} className={cn('text-sm font-bold', className)}>
        {children}
      </Label>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-ds-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-primary"
              aria-label={`${children?.toString() ?? 'Field'} help: ${help}`}
            >
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs leading-snug">
            <p>{help}</p>
            {learnMoreHref && (
              <Link
                href={learnMoreHref}
                className="mt-1 inline-block underline hover:text-ds-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-primary"
                onPointerDownCapture={(e) => e.stopPropagation()}
              >
                Learn more →
              </Link>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {helpId !== undefined && (
        <span id={helpId} className="sr-only">
          {help}
        </span>
      )}
    </div>
  );
}
