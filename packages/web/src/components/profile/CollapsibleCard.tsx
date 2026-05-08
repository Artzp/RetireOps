/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
'use client';

import * as React from 'react';
import { useState } from 'react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { cn } from '@/lib/utils';

interface CollapsibleCardProps {
  /** Card type shown as Badge (e.g. "RRSP", "Employment Salary") */
  typeBadge: string;
  /** User-editable label */
  label: string;
  /** Formatted amount for collapsed summary (e.g. "$113,000/yr") */
  summaryAmount: string;
  /** Whether this card is expanded */
  isExpanded: boolean;
  /** Toggle expand/collapse */
  onToggle: () => void;
  /** Delete handler — called after AlertDialog confirmation */
  onDelete: () => void;
  /** AlertDialog copy — title, description, confirm label, cancel label */
  deleteDialog: {
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel: string;
  };
  /** Expanded form content (children) */
  children: React.ReactNode;
  /** Optional className for outer Card */
  className?: string;
}

export const CollapsibleCard = React.forwardRef<HTMLDivElement, CollapsibleCardProps>(
  (
    {
      typeBadge,
      label,
      summaryAmount,
      isExpanded,
      onToggle,
      onDelete,
      deleteDialog,
      children,
      className,
    },
    ref
  ) => {
    const [dialogOpen, setDialogOpen] = useState(false);

    return (
      <>
        <Card ref={ref} className={cn('border border-ds-outline-variant shadow-sm', className)}>
          {/* Header row — always visible */}
          <div
            className="flex items-center gap-2 p-4 cursor-pointer"
            onClick={onToggle}
            role="button"
            aria-expanded={isExpanded}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggle();
              }
            }}
          >
            <Badge variant="secondary">{typeBadge}</Badge>
            <span className="text-sm flex-1 truncate">{label}</span>
            <span className="text-sm text-muted-foreground whitespace-nowrap">{summaryAmount}</span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Delete ${label}`}
              onClick={(e) => {
                e.stopPropagation();
                setDialogOpen(true);
              }}
              className="text-destructive p-3"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Collapsible body */}
          <Collapsible open={isExpanded}>
            <CollapsibleContent>
              <CardContent className="p-6 pt-0 space-y-6">{children}</CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Delete confirmation dialog */}
        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{deleteDialog.title}</AlertDialogTitle>
              <AlertDialogDescription>{deleteDialog.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{deleteDialog.cancelLabel}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={onDelete}
              >
                {deleteDialog.confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }
);

CollapsibleCard.displayName = 'CollapsibleCard';
