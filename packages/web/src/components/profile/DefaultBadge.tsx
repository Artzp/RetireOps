import { Badge } from '@/components/ui/badge';

interface DefaultBadgeProps {
  value: string | number | undefined;
  format?: (v: string | number) => string;
}

export function DefaultBadge({ value, format }: DefaultBadgeProps) {
  if (value === undefined) return null;
  const display = format ? format(value) : String(value);
  return (
    <Badge variant="secondary" className="text-xs text-muted-foreground font-normal">
      Default: {display}
    </Badge>
  );
}
