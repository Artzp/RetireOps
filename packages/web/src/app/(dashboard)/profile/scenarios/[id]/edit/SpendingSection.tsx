'use client';

import type { Dispatch, SetStateAction } from 'react';
import { X } from 'lucide-react';
import { CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { FieldLabelHelp } from '@/components/ui/field-help';
import { DefaultBadge } from '@/components/profile/DefaultBadge';
import { numVal } from '@/lib/coerce';
import type { SpendingState } from './editor-types';

interface SpendingSectionProps {
  state: SpendingState;
  setState: Dispatch<SetStateAction<SpendingState>>;
  setDirty: (dirty: boolean) => void;
  saving: boolean;
  saveError: boolean;
  onSave: () => void;
  /** Profile default annual expenses, narrowed to a number by the parent. */
  defaultExpenses: number | undefined;
}

/** Spending section body of the scenario decisions editor. State stays owned by
 * the parent page; this component renders the inputs and mutates via setState. */
export function SpendingSection({
  state,
  setState,
  setDirty,
  saving,
  saveError,
  onSave,
  defaultExpenses,
}: SpendingSectionProps) {
  return (
    <CardContent className="p-6 pt-0 space-y-6">
      {/* Target Retirement Spending */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="targetRetirementSpending" className="text-sm font-semibold">
            Annual retirement spending (after-tax, today&apos;s dollars)
          </Label>
          <DefaultBadge value={defaultExpenses} />
        </div>
        <Input
          id="targetRetirementSpending"
          type="number"
          min={0}
          value={state.targetRetirementSpending}
          onChange={(e) => {
            setState((prev) => ({
              ...prev,
              targetRetirementSpending: numVal(e.target.value, 0),
            }));
            setDirty(true);
          }}
        />
      </div>

      <Separator />

      {/* Inflation Rate Override */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <FieldLabelHelp
            htmlFor="inflationRate"
            className="text-sm font-semibold"
            helpId="inflationRate-help"
            help="Used to estimate how prices rise over time. If unsure, keep the default and test higher-inflation scenarios."
          >
            Inflation rate override
          </FieldLabelHelp>
          <DefaultBadge value={undefined} />
        </div>
        <div className="flex items-center gap-2">
          <Input
            id="inflationRate"
            type="number"
            min={0}
            max={20}
            step={0.1}
            className="w-28"
            value={state.inflationRate}
            aria-describedby="inflationRate-help"
            onChange={(e) => {
              setState((prev) => ({
                ...prev,
                inflationRate: numVal(e.target.value, 2.0),
              }));
              setDirty(true);
            }}
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </div>

      <Separator />

      {/* Age-Band Spending Reductions */}
      <div className="space-y-3">
        <span className="text-sm font-semibold text-ds-on-surface">
          Age-based spending reductions
        </span>
        <div className="space-y-2">
          {state.ageBandReductions.map((row, i) => (
            <div key={i} className="flex items-center gap-2 min-h-[44px] flex-wrap">
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">Age threshold</Label>
                <Input
                  type="number"
                  min={60}
                  max={100}
                  step={1}
                  className="w-24"
                  value={row.fromAge}
                  onChange={(e) => {
                    setState((prev) => {
                      const rows = [...prev.ageBandReductions];
                      rows[i] = {
                        ...rows[i],
                        fromAge: numVal(e.target.value, 75),
                      };
                      return { ...prev, ageBandReductions: rows };
                    });
                    setDirty(true);
                  }}
                />
              </div>
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">Reduction</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  className="w-24"
                  value={row.reductionPercent}
                  onChange={(e) => {
                    setState((prev) => {
                      const rows = [...prev.ageBandReductions];
                      rows[i] = {
                        ...rows[i],
                        reductionPercent: numVal(e.target.value, 0),
                      };
                      return { ...prev, ageBandReductions: rows };
                    });
                    setDirty(true);
                  }}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove"
                onClick={() => {
                  setState((prev) => ({
                    ...prev,
                    ageBandReductions: prev.ageBandReductions.filter((_, idx) => idx !== i),
                  }));
                  setDirty(true);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setState((prev) => ({
              ...prev,
              ageBandReductions: [...prev.ageBandReductions, { fromAge: 75, reductionPercent: 20 }],
            }));
            setDirty(true);
          }}
        >
          + Add Reduction
        </Button>
      </div>

      <Separator />

      {/* Legacy Target */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="legacyTarget" className="text-sm font-semibold">
            Legacy target (estate value)
          </Label>
          <DefaultBadge value={undefined} />
        </div>
        <Input
          id="legacyTarget"
          type="number"
          min={0}
          value={state.legacyTarget}
          onChange={(e) => {
            setState((prev) => ({
              ...prev,
              legacyTarget: numVal(e.target.value, 0),
            }));
            setDirty(true);
          }}
        />
      </div>

      {/* Save Spending */}
      <div className="pt-2">
        <Button
          className="bg-ds-primary text-ds-on-primary rounded-button"
          disabled={saving}
          onClick={onSave}
        >
          {saving ? 'Saving...' : 'Save Spending'}
        </Button>
        {saveError && (
          <p className="text-sm text-destructive mt-2">Failed to save. Please try again.</p>
        )}
      </div>
    </CardContent>
  );
}
