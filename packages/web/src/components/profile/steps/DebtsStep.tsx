/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/restrict-plus-operands, @typescript-eslint/no-unsafe-argument */
'use client';

import { useRef, useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CollapsibleCard } from '@/components/profile/CollapsibleCard';
import {
  DEBT_TYPES,
  PAYMENT_FREQUENCY_OPTIONS,
  type DebtCard,
} from '@/components/profile/lib/profile-constants';

const INPUT_STYLE =
  'border-0 border-b-2 border-ds-outline-variant bg-transparent rounded-none focus-visible:ring-0 focus-visible:border-b-ds-primary transition-[border-color] duration-200';
const SELECT_TRIGGER_STYLE =
  'border-0 border-b-2 border-ds-outline-variant rounded-none focus:ring-0 focus-visible:ring-0 focus-visible:border-b-ds-primary transition-[border-color] duration-200';

export function DebtsStep() {
  const { control, watch, register, setValue } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: 'debts', keyName: 'rhfKey' });

  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  function handleAddType(type: string) {
    append({
      _serverId: undefined,
      type,
      label: type,
      balance: '',
      interestRate: '',
      monthlyPayment: '',
      amortizationYears: '',
      paymentFrequency: 'monthly',
      linkedProperty: '',
    } satisfies DebtCard);
    setExpandedIndices((prev) => new Set([...prev, fields.length]));
    setTimeout(() => {
      cardRefs.current[fields.length]?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  function handleDelete(index: number) {
    remove(index);
    setExpandedIndices((prev) => {
      const next = new Set<number>();
      for (const idx of prev) {
        if (idx < index) next.add(idx);
        if (idx > index) next.add(idx - 1);
      }
      return next;
    });
  }

  function toggleExpanded(index: number) {
    setExpandedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  const debtCards = watch('debts') as DebtCard[];
  const total = (debtCards ?? []).reduce((s, c) => s + (Number(c?.balance) || 0), 0);
  const fmt = (n: number) => `$${n.toLocaleString('en-CA')}`;

  return (
    <div className="space-y-4">
      {fields.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-sm font-bold text-ds-on-background">No debts yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add any mortgages, loans, or other debts to include them in your cash flow projection.
          </p>
        </div>
      )}

      {fields.length > 0 && (
        <div className="space-y-4 mt-8">
          {fields.map((field, i) => (
            <div
              key={field.rhfKey}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
            >
              <CollapsibleCard
                typeBadge={watch(`debts.${i}.type`) as string}
                label={
                  (watch(`debts.${i}.label`) as string) ?? (watch(`debts.${i}.type`) as string)
                }
                summaryAmount={fmt(Number(watch(`debts.${i}.balance`) as string) || 0)}
                isExpanded={expandedIndices.has(i)}
                onToggle={() => toggleExpanded(i)}
                onDelete={() => handleDelete(i)}
                deleteDialog={{
                  title: 'Remove this debt?',
                  description:
                    'This debt will be removed from your household profile. This action cannot be undone.',
                  confirmLabel: 'Remove Debt',
                  cancelLabel: 'Keep Debt',
                }}
              >
                <div className="space-y-6">
                  {/* Label */}
                  <div>
                    <Label className="text-sm font-bold">Label</Label>
                    <Input className={INPUT_STYLE} {...register(`debts.${i}.label`)} />
                  </div>

                  {/* Two-column grid: Balance + Interest Rate */}
                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <Label className="text-sm font-bold">Balance ($)</Label>
                      <Input
                        type="number"
                        className={INPUT_STYLE}
                        {...register(`debts.${i}.balance`)}
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-bold">Interest rate (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        className={INPUT_STYLE}
                        {...register(`debts.${i}.interestRate`)}
                      />
                    </div>
                  </div>

                  {/* Monthly payment */}
                  <div>
                    <Label className="text-sm font-bold">Monthly payment ($)</Label>
                    <Input
                      type="number"
                      className={INPUT_STYLE}
                      {...register(`debts.${i}.monthlyPayment`)}
                    />
                  </div>

                  {/* Mortgage-specific extras (D-12) */}
                  {(watch(`debts.${i}.type`) as string) === 'Mortgage' && (
                    <>
                      <Separator className="my-4" />
                      <p className="text-xs text-muted-foreground mb-4">Mortgage details</p>
                      <div className="space-y-6">
                        <div>
                          <Label className="text-sm font-bold">Amortization years</Label>
                          <Input
                            type="number"
                            className={INPUT_STYLE}
                            {...register(`debts.${i}.amortizationYears`)}
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-bold">Payment frequency</Label>
                          <Select
                            value={watch(`debts.${i}.paymentFrequency`) as string}
                            onValueChange={(v) => setValue(`debts.${i}.paymentFrequency`, v)}
                          >
                            <SelectTrigger className={SELECT_TRIGGER_STYLE}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PAYMENT_FREQUENCY_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-sm font-bold">Linked property</Label>
                          <Input
                            className={INPUT_STYLE}
                            placeholder="e.g. Primary Residence"
                            {...register(`debts.${i}.linkedProperty`)}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CollapsibleCard>
            </div>
          ))}
        </div>
      )}

      {/* "+ Add Debt" button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="bg-ds-primary text-ds-on-primary mt-4">
            <Plus className="h-4 w-4 mr-1" /> Add Debt
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {DEBT_TYPES.map((type) => (
            <DropdownMenuItem key={type} onSelect={() => handleAddType(type)}>
              {type}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Summary bar — no per-person split (D-16) */}
      {fields.length > 0 && (
        <div
          className="sticky bottom-0 bg-ds-surface border-t border-ds-outline-variant px-8 py-4 mt-8"
          aria-live="polite"
        >
          <span className="text-sm text-ds-on-surface font-bold">Total debts: {fmt(total)}</span>
        </div>
      )}
    </div>
  );
}
