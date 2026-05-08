'use client';

import { Check, Loader2, AlertCircle } from 'lucide-react';
import type { SaveState } from './lib/profile-constants';

interface ProfileSaveIndicatorProps {
  saveState: SaveState;
}

export function ProfileSaveIndicator({ saveState }: ProfileSaveIndicatorProps) {
  if (saveState === 'idle') return null;

  if (saveState === 'saving') {
    return (
      <div
        className="flex items-center text-xs px-2 py-1 rounded-full bg-ds-surface-raised text-muted-foreground"
        aria-live="polite"
      >
        <Loader2 className="h-3 w-3 animate-spin mr-1" />
        Saving...
      </div>
    );
  }

  if (saveState === 'saved') {
    return (
      <div
        className="flex items-center text-xs px-2 py-1 rounded-full bg-ds-primary-container text-ds-on-primary-container"
        aria-live="polite"
      >
        <Check className="h-3 w-3 mr-1" />
        Saved
      </div>
    );
  }

  return (
    <div
      className="flex items-center text-xs px-2 py-1 rounded-full bg-ds-error-container text-ds-on-error-container"
      aria-live="polite"
    >
      <AlertCircle className="h-3 w-3 mr-1" />
      Error saving
    </div>
  );
}
