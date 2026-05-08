/* eslint-disable @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unnecessary-condition */
'use client';

import { useRef, useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldLabelHelp } from '@/components/ui/field-help';
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
  INCOME_TYPES,
  END_CONDITION_OPTIONS,
  type IncomeCard,
} from '@/components/profile/lib/profile-constants';

const INPUT_STYLE =
  'border-0 border-b-2 border-ds-outline-variant bg-transparent rounded-none focus-visible:ring-0 focus-visible:border-b-ds-primary transition-[border-color] duration-200';
const SELECT_TRIGGER_STYLE =
  'border-0 border-b-2 border-ds-outline-variant rounded-none focus:ring-0 focus-visible:ring-0 focus-visible:border-b-ds-primary transition-[border-color] duration-200';

export function IncomeStep() {
  const { control, watch, register, setValue } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: 'income', keyName: 'rhfKey' });

  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  function handleAddType(type: string) {
    append({
      _serverId: undefined,
      type,
      label: type,
      belongsTo: 'primary',
      annualAmount: '',
      growthRate: '',
      endCondition: 'at-retirement',
      endYear: undefined,
    } satisfies IncomeCard);
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

  const incomeCards = watch('income') as IncomeCard[];
  const includeSpouse = watch('about_you.includeSpouse') as boolean;
  const total = (incomeCards ?? []).reduce((s, c) => s + (Number(c?.annualAmount) || 0), 0);
  const primaryTotal = (incomeCards ?? [])
    .filter((c) => c?.belongsTo !== 'spouse')
    .reduce((s, c) => s + (Number(c?.annualAmount) || 0), 0);
  const spouseTotal = total - primaryTotal;
  const fmt = (n: number) => `$${n.toLocaleString('en-CA')}`;

  return (
    <div className="space-y-4">
      {fields.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-sm font-bold text-ds-on-background">No income sources yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add employment salary, rental income, or other income sources to include them in your
            projection.
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
                typeBadge={watch(`income.${i}.type`) as string}
                label={
                  (watch(`income.${i}.label`) as string) ?? (watch(`income.${i}.type`) as string)
                }
                summaryAmount={`${fmt(Number(watch(`income.${i}.annualAmount`) as string) || 0)}/yr`}
                isExpanded={expandedIndices.has(i)}
                onToggle={() => toggleExpanded(i)}
                onDelete={() => handleDelete(i)}
                deleteDialog={{
                  title: 'Remove this income source?',
                  description:
                    'This income source will be removed from your household profile. This action cannot be undone.',
                  confirmLabel: 'Remove Income Source',
                  cancelLabel: 'Keep Income Source',
                }}
              >
                <div className="space-y-6">
                  {/* Label */}
                  <div>
                    <Label className="text-sm font-bold">Label</Label>
                    <Input className={INPUT_STYLE} {...register(`income.${i}.label`)} />
                  </div>

                  {/* Belongs-to — hidden when no spouse (D-09) */}
                  {includeSpouse && (
                    <div>
                      <Label className="text-sm font-bold">Belongs to</Label>
                      <Select
                        value={watch(`income.${i}.belongsTo`) as string}
                        onValueChange={(v) => setValue(`income.${i}.belongsTo`, v)}
                      >
                        <SelectTrigger className={SELECT_TRIGGER_STYLE}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="primary">Primary</SelectItem>
                          <SelectItem value="spouse">Spouse</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Two-column grid: Annual Amount + Growth Rate */}
                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <Label className="text-sm font-bold">Annual amount ($)</Label>
                      <Input
                        type="number"
                        className={INPUT_STYLE}
                        {...register(`income.${i}.annualAmount`)}
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-bold">Growth rate (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        className={INPUT_STYLE}
                        {...register(`income.${i}.growthRate`)}
                      />
                    </div>
                  </div>

                  {/* End condition */}
                  <div>
                    <FieldLabelHelp
                      helpId={`income-${i}-endCondition-help`}
                      help="When this income stops. If unsure, choose retirement age for employment income or ongoing for income that continues."
                    >
                      End condition
                    </FieldLabelHelp>
                    <Select
                      value={watch(`income.${i}.endCondition`) as string}
                      onValueChange={(v) => setValue(`income.${i}.endCondition`, v)}
                    >
                      <SelectTrigger
                        className={SELECT_TRIGGER_STYLE}
                        aria-describedby={`income-${i}-endCondition-help`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {END_CONDITION_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Conditional year input (D-12 end condition pattern) */}
                  {(watch(`income.${i}.endCondition`) as string) === 'specific-year' && (
                    <div>
                      <Label className="text-sm font-bold">End year</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 2035"
                        className={INPUT_STYLE}
                        {...register(`income.${i}.endYear`, { valueAsNumber: true })}
                      />
                    </div>
                  )}
                </div>
              </CollapsibleCard>
            </div>
          ))}
        </div>
      )}

      {/* "+ Add Income Source" button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="bg-ds-primary text-ds-on-primary mt-4">
            <Plus className="h-4 w-4 mr-1" /> Add Income Source
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {INCOME_TYPES.map((type) => (
            <DropdownMenuItem key={type} onSelect={() => handleAddType(type)}>
              {type}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Summary bar */}
      {fields.length > 0 && (
        <div
          className="sticky bottom-0 bg-ds-surface border-t border-ds-outline-variant px-8 py-4 mt-8"
          aria-live="polite"
        >
          <span className="text-sm text-ds-on-surface font-bold">
            Total household income: {fmt(total)}/yr
          </span>
          {includeSpouse && (
            <span className="text-sm text-muted-foreground ml-3">
              Primary: {fmt(primaryTotal)}/yr &middot; Spouse: {fmt(spouseTotal)}/yr
            </span>
          )}
        </div>
      )}
    </div>
  );
}
