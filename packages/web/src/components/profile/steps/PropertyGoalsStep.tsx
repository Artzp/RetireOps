/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unsafe-argument */
'use client';

import { useRef, useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CollapsibleCard } from '@/components/profile/CollapsibleCard';
import {
  type PropertyCard,
  type GoalCard,
  PROPERTY_TYPES,
} from '@/components/profile/lib/profile-constants';

const INPUT_STYLE =
  'border-0 border-b-2 border-ds-outline-variant bg-transparent rounded-none focus-visible:ring-0 focus-visible:border-b-ds-primary transition-[border-color] duration-200';

export function PropertyGoalsStep() {
  const { register, watch, setValue, control } = useFormContext();

  const {
    fields: propertyFields,
    append: propertyAppend,
    remove: propertyRemove,
  } = useFieldArray({ control, name: 'property_goals.properties', keyName: 'rhfKey' });

  const {
    fields: goalFields,
    append: goalAppend,
    remove: goalRemove,
  } = useFieldArray({ control, name: 'property_goals.goals', keyName: 'rhfKey' });

  const [expandedPropertyIndices, setExpandedPropertyIndices] = useState<Set<number>>(new Set());
  const [expandedGoalIndices, setExpandedGoalIndices] = useState<Set<number>>(new Set());
  const propertyCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const goalCardRefs = useRef<(HTMLDivElement | null)[]>([]);

  function handleAddProperty(
    type: 'Primary Residence' | 'Investment Property' | 'Vacation Property'
  ) {
    propertyAppend({
      _serverId: undefined,
      type,
      label: type,
      currentValue: '',
      appreciationRate: '3.0',
    } satisfies PropertyCard);
    setExpandedPropertyIndices((prev) => new Set([...prev, propertyFields.length]));
    setTimeout(() => {
      propertyCardRefs.current[propertyFields.length]?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  function handleAddGoal() {
    goalAppend({
      _serverId: undefined,
      name: '',
      targetYear: String(new Date().getFullYear() + 5),
      estimatedCost: '',
      adjustForInflation: false,
    } satisfies GoalCard);
    setExpandedGoalIndices((prev) => new Set([...prev, goalFields.length]));
    setTimeout(() => {
      goalCardRefs.current[goalFields.length]?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  function handleDeleteProperty(index: number) {
    propertyRemove(index);
    setExpandedPropertyIndices((prev) => {
      const next = new Set<number>();
      for (const idx of prev) {
        if (idx < index) next.add(idx);
        if (idx > index) next.add(idx - 1);
      }
      return next;
    });
  }

  function handleDeleteGoal(index: number) {
    goalRemove(index);
    setExpandedGoalIndices((prev) => {
      const next = new Set<number>();
      for (const idx of prev) {
        if (idx < index) next.add(idx);
        if (idx > index) next.add(idx - 1);
      }
      return next;
    });
  }

  function togglePropertyExpanded(index: number) {
    setExpandedPropertyIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function toggleGoalExpanded(index: number) {
    setExpandedGoalIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  const propertyTotal = propertyFields.reduce(
    (sum, _, i) => sum + (Number(watch(`property_goals.properties.${i}.currentValue`)) || 0),
    0
  );

  const legacyEnabled = watch('property_goals.legacy.enabled') as boolean;

  return (
    <div className="space-y-4">
      {/* Property section */}
      <div>
        {propertyFields.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm font-bold text-ds-on-background">No properties yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add real estate assets to include property values and appreciation in your projection.
            </p>
          </div>
        )}

        {propertyFields.length > 0 && (
          <div className="space-y-4 mt-8">
            {propertyFields.map((field, i) => (
              <div
                key={field.rhfKey}
                ref={(el) => {
                  propertyCardRefs.current[i] = el;
                }}
              >
                <CollapsibleCard
                  typeBadge={watch(`property_goals.properties.${i}.type`) as string}
                  label={
                    (watch(`property_goals.properties.${i}.label`) as string) ??
                    (watch(`property_goals.properties.${i}.type`) as string)
                  }
                  summaryAmount={`$${(Number(watch(`property_goals.properties.${i}.currentValue`)) || 0).toLocaleString('en-CA')}`}
                  isExpanded={expandedPropertyIndices.has(i)}
                  onToggle={() => togglePropertyExpanded(i)}
                  onDelete={() => handleDeleteProperty(i)}
                  deleteDialog={{
                    title: 'Remove this property?',
                    description:
                      'This property will be removed from your household profile. This action cannot be undone.',
                    confirmLabel: 'Remove Property',
                    cancelLabel: 'Keep Property',
                  }}
                >
                  <div className="space-y-6">
                    <div>
                      <Label className="text-sm font-bold">Label</Label>
                      <Input
                        className={INPUT_STYLE}
                        {...register(`property_goals.properties.${i}.label`)}
                      />
                    </div>
                    <div className="grid gap-6 md:grid-cols-2">
                      <div>
                        <Label className="text-sm font-bold">Current value ($)</Label>
                        <Input
                          type="number"
                          className={INPUT_STYLE}
                          {...register(`property_goals.properties.${i}.currentValue`)}
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-bold">Appreciation rate (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          className={INPUT_STYLE}
                          {...register(`property_goals.properties.${i}.appreciationRate`)}
                        />
                      </div>
                    </div>
                  </div>
                </CollapsibleCard>
              </div>
            ))}
          </div>
        )}

        {/* Add Property button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" className="bg-ds-primary text-ds-on-primary mt-4">
              <Plus className="h-4 w-4 mr-1" />
              Add Property
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {PROPERTY_TYPES.map((pType) => (
              <DropdownMenuItem key={pType} onSelect={() => handleAddProperty(pType)}>
                {pType}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Goal section */}
      <div className="mt-8">
        {goalFields.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm font-bold text-ds-on-background">No goals yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add one-time expenses like home renovations or travel to plan for future spending.
            </p>
          </div>
        )}

        {goalFields.length > 0 && (
          <div className="space-y-4 mt-8">
            {goalFields.map((field, i) => (
              <div
                key={field.rhfKey}
                ref={(el) => {
                  goalCardRefs.current[i] = el;
                }}
              >
                <CollapsibleCard
                  typeBadge="Goal"
                  label={(watch(`property_goals.goals.${i}.name`) as string) || 'Untitled goal'}
                  summaryAmount={`$${(Number(watch(`property_goals.goals.${i}.estimatedCost`)) || 0).toLocaleString('en-CA')}`}
                  isExpanded={expandedGoalIndices.has(i)}
                  onToggle={() => toggleGoalExpanded(i)}
                  onDelete={() => handleDeleteGoal(i)}
                  deleteDialog={{
                    title: 'Remove this goal?',
                    description:
                      'This goal will be removed from your household profile. This action cannot be undone.',
                    confirmLabel: 'Remove Goal',
                    cancelLabel: 'Keep Goal',
                  }}
                >
                  <div className="space-y-6">
                    <div>
                      <Label className="text-sm font-bold">Goal name</Label>
                      <Input
                        placeholder="e.g. New car, home renovation"
                        className={INPUT_STYLE}
                        {...register(`property_goals.goals.${i}.name`)}
                      />
                    </div>
                    <div className="grid gap-6 md:grid-cols-2">
                      <div>
                        <Label className="text-sm font-bold">Target year</Label>
                        <Input
                          type="number"
                          placeholder={String(new Date().getFullYear() + 5)}
                          className={INPUT_STYLE}
                          {...register(`property_goals.goals.${i}.targetYear`)}
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-bold">Estimated cost ($)</Label>
                        <Input
                          type="number"
                          className={INPUT_STYLE}
                          {...register(`property_goals.goals.${i}.estimatedCost`)}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`inflation-${i}`}
                        checked={watch(`property_goals.goals.${i}.adjustForInflation`) as boolean}
                        onCheckedChange={(checked) =>
                          setValue(`property_goals.goals.${i}.adjustForInflation`, checked === true)
                        }
                      />
                      <Label htmlFor={`inflation-${i}`}>Adjust for inflation</Label>
                    </div>
                  </div>
                </CollapsibleCard>
              </div>
            ))}
          </div>
        )}

        {/* Add Goal button */}
        <Button
          type="button"
          onClick={handleAddGoal}
          className="bg-ds-primary text-ds-on-primary mt-4"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Goal
        </Button>
      </div>

      {/* Legacy section */}
      <Separator className="my-6" />
      <div className="rounded-lg border border-ds-outline-variant p-6">
        <h2 className="text-base font-bold text-ds-on-background">Legacy</h2>
        <div className="flex items-center gap-2 mt-4">
          <Checkbox
            id="legacyEnabled"
            checked={legacyEnabled}
            onCheckedChange={(checked) =>
              setValue('property_goals.legacy.enabled', checked === true)
            }
          />
          <Label htmlFor="legacyEnabled">Leave a legacy</Label>
        </div>
        {legacyEnabled && (
          <div className="mt-4">
            <Label className="text-sm font-bold">Target inheritance amount ($)</Label>
            <Input
              type="number"
              className={INPUT_STYLE}
              {...register('property_goals.legacy.targetAmount')}
            />
          </div>
        )}
      </div>

      {/* Summary bar */}
      {(propertyFields.length > 0 || goalFields.length > 0) && (
        <div
          className="sticky bottom-0 bg-ds-surface border-t border-ds-outline-variant px-8 py-4 mt-8"
          aria-live="polite"
        >
          <span className="text-sm font-bold text-ds-on-surface">
            Properties: ${propertyTotal.toLocaleString('en-CA')} total | {goalFields.length} goal
            {goalFields.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
