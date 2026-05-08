import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GlossaryLinkProps {
  anchor: string;
  term: string;
  className?: string;
}

export function GlossaryLink({ anchor, term, className }: GlossaryLinkProps) {
  return (
    <Link
      href={`/glossary#${anchor}`}
      className={cn(
        'inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-ds-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-primary',
        className
      )}
      aria-label={`Open glossary entry for ${term}`}
      title={`Glossary: ${term}`}
    >
      <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  );
}
