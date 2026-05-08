/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
import { ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LegalLinks } from '@/components/LegalLinks';

interface LegalNoticeProps {
  className?: string;
  compact?: boolean;
}

export function LegalNotice({ className, compact = false }: LegalNoticeProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-amber-200 bg-amber-50 text-amber-950',
        compact ? 'p-3' : 'p-4',
        className
      )}
    >
      <div className="flex gap-3">
        <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div className="space-y-2">
          <p className={cn('font-medium', compact ? 'text-sm' : 'text-sm')}>Important notice</p>
          <p className={cn('text-amber-900/90', compact ? 'text-xs' : 'text-sm')}>
            RetireOps provides planning estimates only. It is not financial, tax, or legal advice.
            Some calculations and beta features may be incomplete or rely on older assumptions.
          </p>
          <p className={cn('text-amber-900/80', compact ? 'text-xs' : 'text-sm')}>
            If you use the hosted service, review how we handle data and the limits of the service
            before relying on any result.
          </p>
          <LegalLinks
            className={cn('justify-start text-xs text-amber-900/80', compact && 'pt-1')}
          />
        </div>
      </div>
    </div>
  );
}
