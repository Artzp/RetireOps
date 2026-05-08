import Link from 'next/link';
import { cn } from '@/lib/utils';

interface LegalLinksProps {
  className?: string;
}

export function LegalLinks({ className }: LegalLinksProps) {
  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-x-4 gap-y-1', className)}>
      <Link href="/privacy" className="hover:text-foreground hover:underline">
        Privacy
      </Link>
      <Link href="/terms" className="hover:text-foreground hover:underline">
        Terms
      </Link>
      <Link href="/glossary" className="hover:text-foreground hover:underline">
        Glossary
      </Link>
    </div>
  );
}
