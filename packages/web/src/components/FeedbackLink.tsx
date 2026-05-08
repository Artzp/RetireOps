import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const DEFAULT_FEEDBACK_URL = 'https://github.com/Artzp/RetireOps/issues/new';

export function getFeedbackUrl(): string {
  return process.env['NEXT_PUBLIC_FEEDBACK_URL'] ?? DEFAULT_FEEDBACK_URL;
}

interface FeedbackLinkProps {
  className?: string;
  label?: string;
  showIcon?: boolean;
}

export function FeedbackLink({
  className,
  label = 'Send feedback or report a bug',
  showIcon = true,
}: FeedbackLinkProps) {
  const url = getFeedbackUrl();
  const isExternal = url.startsWith('http');
  return (
    <a
      href={url}
      className={cn(
        'inline-flex items-center gap-1 hover:text-foreground hover:underline',
        className
      )}
      {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {showIcon && <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />}
      <span>{label}</span>
    </a>
  );
}
