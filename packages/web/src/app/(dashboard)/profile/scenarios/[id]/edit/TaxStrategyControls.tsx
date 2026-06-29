'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { DefaultBadge } from '@/components/profile/DefaultBadge';
import { numVal } from '@/lib/coerce';
import type { TaxState } from './editor-types';

interface TaxStrategyControlsProps {
  state: TaxState;
  setState: Dispatch<SetStateAction<TaxState>>;
  setDirty: (dirty: boolean) => void;
  hasSpouse: boolean;
  saving: boolean;
  saveError: boolean;
  onSave: () => void;
}

/** Tax-strategy toggle controls (RRSP meltdown, income splitting, OAS clawback,
 * bracket fill) + Save, extracted from the Tax section of the scenario decisions
 * editor. State stays owned by the parent page and flows down via props. The
 * complex withdrawal-plan/preset/preview/comparison block stays in the parent. */
export function TaxStrategyControls({
  state,
  setState,
  setDirty,
  hasSpouse,
  saving,
  saveError,
  onSave,
}: TaxStrategyControlsProps) {
  return (
    <>
      {/* RRSP Meltdown */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ds-on-surface">RRSP Meltdown</span>
          <DefaultBadge value="Off" />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="rrspMeltdownEnabled"
            checked={state.rrspMeltdown.enabled}
            onCheckedChange={(checked) => {
              setState((prev) => ({
                ...prev,
                rrspMeltdown: { ...prev.rrspMeltdown, enabled: checked === true },
              }));
              setDirty(true);
            }}
          />
          <Label htmlFor="rrspMeltdownEnabled" className="text-sm">
            Enable RRSP meltdown
          </Label>
        </div>
        {state.rrspMeltdown.enabled && (
          <div className="space-y-3 pl-6">
            <div className="space-y-1">
              <Label htmlFor="rrspAnnualAmount" className="text-sm font-semibold">
                Annual withdrawal amount
              </Label>
              <Input
                id="rrspAnnualAmount"
                type="number"
                min={0}
                value={state.rrspMeltdown.annualAmount}
                onChange={(e) => {
                  setState((prev) => ({
                    ...prev,
                    rrspMeltdown: {
                      ...prev.rrspMeltdown,
                      annualAmount: numVal(e.target.value, 0),
                    },
                  }));
                  setDirty(true);
                }}
              />
            </div>
            <div className="flex gap-4">
              <div className="space-y-1">
                <Label htmlFor="rrspStartYear" className="text-sm font-semibold">
                  Start year
                </Label>
                <Input
                  id="rrspStartYear"
                  type="number"
                  className="w-28"
                  value={state.rrspMeltdown.startYear}
                  onChange={(e) => {
                    setState((prev) => ({
                      ...prev,
                      rrspMeltdown: {
                        ...prev.rrspMeltdown,
                        startYear: numVal(e.target.value, 2025),
                      },
                    }));
                    setDirty(true);
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rrspEndYear" className="text-sm font-semibold">
                  End year
                </Label>
                <Input
                  id="rrspEndYear"
                  type="number"
                  className="w-28"
                  value={state.rrspMeltdown.endYear}
                  onChange={(e) => {
                    setState((prev) => ({
                      ...prev,
                      rrspMeltdown: {
                        ...prev.rrspMeltdown,
                        endYear: numVal(e.target.value, 2030),
                      },
                    }));
                    setDirty(true);
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Income Splitting — hidden when no spouse */}
      {hasSpouse && (
        <>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ds-on-surface">Income Splitting</span>
              <DefaultBadge value="Off" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="incomeSplittingEnabled"
                checked={state.incomeSplitting.enabled}
                onCheckedChange={(checked) => {
                  setState((prev) => ({
                    ...prev,
                    incomeSplitting: {
                      ...prev.incomeSplitting,
                      enabled: checked === true,
                    },
                  }));
                  setDirty(true);
                }}
              />
              <Label htmlFor="incomeSplittingEnabled" className="text-sm">
                Enable income splitting
              </Label>
            </div>
            {state.incomeSplitting.enabled && (
              <div className="space-y-1 pl-6">
                <Label htmlFor="splitPercent" className="text-sm font-semibold">
                  Split percentage (0–50%)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="splitPercent"
                    type="number"
                    min={0}
                    max={50}
                    step={1}
                    className="w-24"
                    value={state.incomeSplitting.splitPercent}
                    onChange={(e) => {
                      setState((prev) => ({
                        ...prev,
                        incomeSplitting: {
                          ...prev.incomeSplitting,
                          splitPercent: numVal(e.target.value, 50),
                        },
                      }));
                      setDirty(true);
                    }}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
            )}
          </div>
          <Separator />
        </>
      )}

      {/* OAS Clawback Avoidance */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ds-on-surface">OAS Clawback Avoidance</span>
          <DefaultBadge value="Off" />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="oasClawbackEnabled"
            checked={state.oasClawbackAvoidance.enabled}
            onCheckedChange={(checked) => {
              setState((prev) => ({
                ...prev,
                oasClawbackAvoidance: {
                  ...prev.oasClawbackAvoidance,
                  enabled: checked === true,
                },
              }));
              setDirty(true);
            }}
          />
          <Label htmlFor="oasClawbackEnabled" className="text-sm">
            Enable OAS clawback avoidance
          </Label>
        </div>
        {state.oasClawbackAvoidance.enabled && (
          <div className="space-y-1 pl-6">
            <Label htmlFor="oasNetIncomeThreshold" className="text-sm font-semibold">
              Target net income threshold
            </Label>
            <Input
              id="oasNetIncomeThreshold"
              type="number"
              min={0}
              value={state.oasClawbackAvoidance.incomeThreshold}
              onChange={(e) => {
                setState((prev) => ({
                  ...prev,
                  oasClawbackAvoidance: {
                    ...prev.oasClawbackAvoidance,
                    incomeThreshold: numVal(e.target.value, 90000),
                  },
                }));
                setDirty(true);
              }}
            />
          </div>
        )}
      </div>

      <Separator />

      {/* Bracket Fill (Tax Bracket Smoothing) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ds-on-surface">Tax Bracket Smoothing</span>
          <DefaultBadge value="Off" />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="bracketFillEnabled"
            checked={state.bracketFill.enabled}
            onCheckedChange={(checked) => {
              setState((prev) => ({
                ...prev,
                bracketFill: { ...prev.bracketFill, enabled: checked === true },
              }));
              setDirty(true);
            }}
          />
          <Label htmlFor="bracketFillEnabled" className="text-sm">
            Proactively fill low tax brackets from RRSP
          </Label>
        </div>
        {state.bracketFill.enabled && (
          <div className="space-y-3 pl-6">
            <div className="space-y-1">
              <Label htmlFor="bracketFillTarget" className="text-sm font-semibold">
                Target federal bracket
              </Label>
              <select
                id="bracketFillTarget"
                className="flex h-9 w-full rounded-md border border-ds-outline bg-ds-surface px-3 py-1 text-sm shadow-sm"
                value={state.bracketFill.bracketTarget}
                onChange={(e) => {
                  setState((prev) => ({
                    ...prev,
                    bracketFill: {
                      ...prev.bracketFill,
                      bracketTarget: e.target.value as 'current' | 'next',
                    },
                  }));
                  setDirty(true);
                }}
              >
                <option value="current">Current bracket (fill to ceiling)</option>
                <option value="next">Next bracket (fill one above)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Withdraws from RRSP to fill unused space in the target federal tax bracket during
                retirement years (before age 71).
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="bracketFillCap" className="text-sm font-semibold">
                Annual cap ($)
              </Label>
              <Input
                id="bracketFillCap"
                type="number"
                min={0}
                placeholder="Leave empty = unlimited"
                value={state.bracketFill.annualCap ?? ''}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  const parsed = raw === '' ? undefined : Number(raw);
                  // Treat empty, NaN, and non-positive values as "no cap" (undefined) —
                  // the engine interprets a literal 0 as "withdraw nothing", which is the
                  // opposite of the user's intent.
                  const next =
                    parsed === undefined || Number.isNaN(parsed) || parsed <= 0
                      ? undefined
                      : parsed;
                  setState((prev) => ({
                    ...prev,
                    bracketFill: {
                      ...prev.bracketFill,
                      annualCap: next,
                    },
                  }));
                  setDirty(true);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Maximum annual RRSP withdrawal for bracket smoothing. Leave empty for unlimited
                (engine fills to bracket ceiling).
              </p>
            </div>
            <p className="text-xs text-muted-foreground italic">
              Includes OAS clawback protection — the engine will not fill a bracket if the 15% OAS
              recovery tax exceeds the marginal tax savings.
            </p>
          </div>
        )}
      </div>

      {/* Save Tax Strategy */}
      <div className="pt-2">
        <Button
          className="bg-ds-primary text-ds-on-primary rounded-button"
          disabled={saving}
          onClick={onSave}
        >
          {saving ? 'Saving...' : 'Save Tax Strategy'}
        </Button>
        {saveError && (
          <p className="text-sm text-destructive mt-2">Failed to save. Please try again.</p>
        )}
      </div>
    </>
  );
}
