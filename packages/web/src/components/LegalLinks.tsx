import Link from 'next/link';
import { Github } from 'lucide-react';
import { cn } from '@/lib/utils';

const SOURCE_URL = 'https://github.com/Artzp/RetireOps';

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
      <a
        href={SOURCE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
      >
        <Github className="h-3.5 w-3.5" aria-hidden="true" />
        <span>View on GitHub</span>
      </a>
    </div>
  );
}
