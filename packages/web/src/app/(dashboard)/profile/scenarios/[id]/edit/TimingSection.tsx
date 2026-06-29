'use client';

import type { Dispatch, SetStateAction } from 'react';
import { X } from 'lucide-react';
import { CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { FieldLabelHelp } from '@/components/ui/field-help';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DefaultBadge } from '@/components/profile/DefaultBadge';
import { cppAdjustment, oasAdjustment } from '@/lib/profile-utils';
import type { PropertyCardInfo } from '@/lib/profile-utils';
import { numVal } from '@/lib/coerce';
import type { TimingState } from './editor-types';

interface TimingSectionProps {
  state: TimingState;
  setState: Dispatch<SetStateAction<TimingState>>;
  setDirty: (dirty: boolean) => void;
  saving: boolean;
  saveError: boolean;
  onSave: () => void;
  hasSpouse: boolean;
  hasDbPensions: boolean;
  propertyCards: PropertyCardInfo[];
  defaultCppAge: number | undefined;
  defaultOasAge: number | undefined;
  defaultRetirementAge: number | undefined;
  defaultSpouseRetirementAge: number | undefined;
}

function adjustmentClass(pct: number) {
  if (pct < 0) return 'text-xs font-semibold text-destructive';
  if (pct > 0) return 'text-xs font-semibold text-success';
  return 'text-xs text-muted-foreground';
}

/** Timing section body of the scenario decisions editor (CPP/OAS/retirement
 * ages, DB pension, property sales). State stays owned by the parent page and
 * flows down via props; the CPP/OAS adjustment hints derive from state here. */
export function TimingSection({
  state,
  setState,
  setDirty,
  saving,
  saveError,
  onSave,
  hasSpouse,
  hasDbPensions,
  propertyCards,
  defaultCppAge,
  defaultOasAge,
  defaultRetirementAge,
  defaultSpouseRetirementAge,
}: TimingSectionProps) {
  const cppAdj = cppAdjustment(state.cppStartAge);
  const spouseCppAdj = cppAdjustment(state.spouseCppStartAge);
  const oasAdj = oasAdjustment(state.oasStartAge);
  const spouseOasAdj = oasAdjustment(state.spouseOasStartAge);

  return (
    <CardContent className="p-6 pt-0 space-y-6">
      {/* CPP Start Age */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <FieldLabelHelp
            htmlFor="cppStartAge"
            className="text-sm font-semibold"
            helpId="cppStartAge-help"
            help="The age CPP begins in this scenario. If unsure, use 65 and compare ages 60 to 70."
          >
            CPP Start Age
          </FieldLabelHelp>
          <DefaultBadge value={defaultCppAge} />
        </div>
        <Input
          id="cppStartAge"
          type="number"
          min={60}
          max={70}
          step={1}
          value={state.cppStartAge}
          aria-describedby="cppStartAge-help"
          onChange={(e) => {
            setState((prev) => ({
              ...prev,
              cppStartAge: numVal(e.target.value, 65),
            }));
            setDirty(true);
          }}
        />
        <p className={adjustmentClass(cppAdj.pct)} aria-live="polite">
          {cppAdj.label}
        </p>
      </div>

      {hasSpouse && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <FieldLabelHelp
              htmlFor="spouseCppStartAge"
              className="text-sm font-semibold"
              helpId="spouseCppStartAge-help"
              help="The age your spouse or partner starts CPP. If unsure, use 65 and compare ages 60 to 70."
            >
              Spouse CPP Start Age
            </FieldLabelHelp>
            <DefaultBadge value={defaultCppAge} />
          </div>
          <Input
            id="spouseCppStartAge"
            type="number"
            min={60}
            max={70}
            step={1}
            value={state.spouseCppStartAge}
            aria-describedby="spouseCppStartAge-help"
            onChange={(e) => {
              setState((prev) => ({
                ...prev,
                spouseCppStartAge: numVal(e.target.value, 65),
              }));
              setDirty(true);
            }}
          />
          <p className={adjustmentClass(spouseCppAdj.pct)} aria-live="polite">
            {spouseCppAdj.label}
          </p>
        </div>
      )}

      <Separator />

      {/* OAS Start Age */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <FieldLabelHelp
            htmlFor="oasStartAge"
            className="text-sm font-semibold"
            helpId="oasStartAge-help"
            help="The age OAS begins in this scenario. If unsure, use 65 and compare delaying up to age 70."
          >
            OAS Start Age
          </FieldLabelHelp>
          <DefaultBadge value={defaultOasAge} />
        </div>
        <Input
          id="oasStartAge"
          type="number"
          min={65}
          max={70}
          step={1}
          value={state.oasStartAge}
          aria-describedby="oasStartAge-help"
          onChange={(e) => {
            setState((prev) => ({
              ...prev,
              oasStartAge: numVal(e.target.value, 65),
            }));
            setDirty(true);
          }}
        />
        <p className={adjustmentClass(oasAdj.pct)} aria-live="polite">
          {oasAdj.label}
        </p>
      </div>

      {hasSpouse && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <FieldLabelHelp
              htmlFor="spouseOasStartAge"
              className="text-sm font-semibold"
              helpId="spouseOasStartAge-help"
              help="The age your spouse or partner starts OAS. If unsure, use 65 and compare delaying up to age 70."
            >
              Spouse OAS Start Age
            </FieldLabelHelp>
            <DefaultBadge value={defaultOasAge} />
          </div>
          <Input
            id="spouseOasStartAge"
            type="number"
            min={65}
            max={70}
            step={1}
            value={state.spouseOasStartAge}
            aria-describedby="spouseOasStartAge-help"
            onChange={(e) => {
              setState((prev) => ({
                ...prev,
                spouseOasStartAge: numVal(e.target.value, 65),
              }));
              setDirty(true);
            }}
          />
          <p className={adjustmentClass(spouseOasAdj.pct)} aria-live="polite">
            {spouseOasAdj.label}
          </p>
        </div>
      )}

      <Separator />

      {/* Retirement Age Override */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <FieldLabelHelp
            htmlFor="retirementAge"
            className="text-sm font-semibold"
            helpId="scenario-retirementAge-help"
            help="Overrides the profile retirement age for this scenario. If unsure, keep the default and test earlier or later ages."
          >
            Retirement Age Override
          </FieldLabelHelp>
          <DefaultBadge value={defaultRetirementAge} />
        </div>
        <Input
          id="retirementAge"
          type="number"
          min={50}
          max={75}
          step={1}
          value={state.retirementAge}
          aria-describedby="scenario-retirementAge-help"
          onChange={(e) => {
            setState((prev) => ({
              ...prev,
              retirementAge: numVal(e.target.value, 65),
            }));
            setDirty(true);
          }}
        />
      </div>

      {hasSpouse && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <FieldLabelHelp
              htmlFor="spouseRetirementAge"
              className="text-sm font-semibold"
              helpId="scenario-spouseRetirementAge-help"
              help="Overrides your spouse or partner's retirement age for this scenario. If unsure, keep the default."
            >
              Spouse Retirement Age Override
            </FieldLabelHelp>
            <DefaultBadge value={defaultSpouseRetirementAge} />
          </div>
          <Input
            id="spouseRetirementAge"
            type="number"
            min={50}
            max={75}
            step={1}
            value={state.spouseRetirementAge}
            aria-describedby="scenario-spouseRetirementAge-help"
            onChange={(e) => {
              setState((prev) => ({
                ...prev,
                spouseRetirementAge: numVal(e.target.value, 65),
              }));
              setDirty(true);
            }}
          />
        </div>
      )}

      {/* DB Pension Start Age */}
      {hasDbPensions && (
        <>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <FieldLabelHelp
                htmlFor="dbPensionStartAge"
                className="text-sm font-semibold"
                helpId="dbPensionStartAge-help"
                help="The age modeled DB pension payments begin. If unsure, use the normal start age from your pension statement."
              >
                DB pension start age (applies to all DB pensions)
              </FieldLabelHelp>
              <DefaultBadge value={65} />
            </div>
            <Input
              id="dbPensionStartAge"
              type="number"
              min={55}
              max={75}
              step={1}
              value={state.dbPensionStartAge}
              aria-describedby="dbPensionStartAge-help"
              onChange={(e) => {
                setState((prev) => ({
                  ...prev,
                  dbPensionStartAge: numVal(e.target.value, 65),
                }));
                setDirty(true);
              }}
            />
          </div>
        </>
      )}

      {/* Property Sale Decisions */}
      {propertyCards.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ds-on-surface">
                Property Sale Decisions
              </span>
            </div>
            <div className="space-y-2">
              {state.propertySaleDecisions.map((row, i) => (
                <div key={i} className="flex items-center gap-2 min-h-[44px] flex-wrap">
                  <Select
                    value={row.propertyId}
                    onValueChange={(val) => {
                      setState((prev) => {
                        const rows = [...prev.propertySaleDecisions];
                        rows[i] = { ...rows[i], propertyId: val };
                        return { ...prev, propertySaleDecisions: rows };
                      });
                      setDirty(true);
                    }}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select property" />
                    </SelectTrigger>
                    <SelectContent>
                      {propertyCards.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    <Label className="text-xs text-muted-foreground">Sale Year</Label>
                    <Input
                      type="number"
                      className="w-24"
                      value={row.saleYear}
                      onChange={(e) => {
                        setState((prev) => {
                          const rows = [...prev.propertySaleDecisions];
                          rows[i] = {
                            ...rows[i],
                            saleYear: numVal(e.target.value, 2030),
                          };
                          return { ...prev, propertySaleDecisions: rows };
                        });
                        setDirty(true);
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Label className="text-xs text-muted-foreground">Selling Costs %</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      className="w-24"
                      value={row.sellingCostsPercent}
                      onChange={(e) => {
                        setState((prev) => {
                          const rows = [...prev.propertySaleDecisions];
                          rows[i] = {
                            ...rows[i],
                            sellingCostsPercent: numVal(e.target.value, 0),
                          };
                          return { ...prev, propertySaleDecisions: rows };
                        });
                        setDirty(true);
                      }}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove"
                    onClick={() => {
                      setState((prev) => ({
                        ...prev,
                        propertySaleDecisions: prev.propertySaleDecisions.filter(
                          (_, idx) => idx !== i
                        ),
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
                  propertySaleDecisions: [
                    ...prev.propertySaleDecisions,
                    {
                      propertyId: propertyCards[0]?.id ?? '',
                      saleYear: 2030,
                      sellingCostsPercent: 5,
                    },
                  ],
                }));
                setDirty(true);
              }}
            >
              + Add Property Sale
            </Button>
          </div>
        </>
      )}

      {/* Save Timing */}
      <div className="pt-2">
        <Button
          className="bg-ds-primary text-ds-on-primary rounded-button"
          disabled={saving}
          onClick={onSave}
        >
          {saving ? 'Saving...' : 'Save Timing'}
        </Button>
        {saveError && (
          <p className="text-sm text-destructive mt-2">Failed to save. Please try again.</p>
        )}
      </div>
    </CardContent>
  );
}
