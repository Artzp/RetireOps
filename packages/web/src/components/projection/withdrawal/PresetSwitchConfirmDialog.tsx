/**
 * PresetSwitchConfirmDialog — PRESET-05 overwrite-with-confirm dialog (Phase 28).
 *
 * Shown when the user picks a non-custom preset while currentPresetId === 'custom'
 * (i.e. their drawdownOrder doesn't match any preset). Confirming applies the
 * preset; canceling preserves the existing custom order.
 *
 * Mounted under the page's existing DOM tree — no hover-popover provider needed
 * (no popover JSX here, per Pitfall 6).
 *
 * @see .planning/phases/27-preset-mapping-infrastructure/27-DECISIONS.md (PRESET-05)
 */
'use client';

import { useEffect, useRef } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface PresetSwitchConfirmDialogProps {
  open: boolean;
  /** User-facing name of the preset about to be applied (e.g. "Preserve TFSA longest"). */
  presetName: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function PresetSwitchConfirmDialog({
  open,
  presetName,
  onOpenChange,
  onConfirm,
}: PresetSwitchConfirmDialogProps): JSX.Element {
  // A8 fix (Phase 34.1-01): Radix's default focus-restore relies on a Trigger
  // ref that doesn't exist when `open` is driven by a parent state flag (here:
  // pendingPresetId !== null). Capture document.activeElement on the open
  // rising edge so we can hand focus back via onCloseAutoFocus on close.
  const triggerRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const active = document.activeElement;
      triggerRef.current = active instanceof HTMLElement ? active : null;
    }
    wasOpenRef.current = open;
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        data-testid="preset-switch-confirm-dialog"
        onCloseAutoFocus={(event) => {
          const target = triggerRef.current;
          if (target && document.body.contains(target)) {
            event.preventDefault();
            target.focus();
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Switch to {presetName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will replace your custom drawdown order with the {presetName} preset. You can
            re-customize the order afterward.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Apply preset</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
