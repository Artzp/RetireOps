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
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CollapsibleCard } from '@/components/profile/CollapsibleCard';
import { GlossaryLink } from '@/components/glossary/GlossaryLink';
import {
  ACCOUNT_TYPES,
  END_CONDITION_OPTIONS,
  type AccountCard,
} from '@/components/profile/lib/profile-constants';
import { DEFAULT_ASSUMPTION_COPY, getWizardAssumptionDefaults } from '@/lib/settings-assumptions';

const INPUT_STYLE =
  'border-0 border-b-2 border-ds-outline-variant bg-transparent rounded-none focus-visible:ring-0 focus-visible:border-b-ds-primary transition-[border-color] duration-200';
const SELECT_TRIGGER_STYLE =
  'border-0 border-b-2 border-ds-outline-variant rounded-none focus:ring-0 focus-visible:ring-0 focus-visible:border-b-ds-primary transition-[border-color] duration-200';

export function AccountsStep() {
  const { control, watch, register, setValue } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'accounts',
    keyName: 'rhfKey',
  });

  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  function handleAddType(type: string) {
    const assumptionDefaults = getWizardAssumptionDefaults();
    append({
      _serverId: undefined,
      type,
      label: type,
      belongsTo: 'primary',
      currentBalance: '',
      expectedReturn: String(assumptionDefaults.investmentReturnRate),
      annualContribution: '',
      contributionEndCondition: 'at-retirement',
      contributionEndYear: undefined,
      contributionRoom: '',
      adjustedCostBase: '',
      annualInterestIncome: '',
      annualEligibleDividends: '',
      annualNonEligibleDividends: '',
      annualRealizedCapitalGains: '',
      employerMatch: '',
    } satisfies AccountCard);
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

  const accountCards = watch('accounts') as AccountCard[];
  const includeSpouse = watch('about_you.includeSpouse') as boolean;
  const total = (accountCards ?? []).reduce((s, c) => s + (Number(c?.currentBalance) || 0), 0);
  const primaryTotal = (accountCards ?? [])
    .filter((c) => c?.belongsTo !== 'spouse')
    .reduce((s, c) => s + (Number(c?.currentBalance) || 0), 0);
  const spouseTotal = total - primaryTotal;
  const fmt = (n: number) => `$${n.toLocaleString('en-CA')}`;

  return (
    <div className="space-y-4">
      {fields.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-sm font-bold text-ds-on-background">No accounts yet</p>
          <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
            Add your RRSP, TFSA, or other accounts to model your savings growth.
            <GlossaryLink anchor="account-types" term="account types" />
          </p>
        </div>
      )}

      {fields.length > 0 && (
        <div className="space-y-4 mt-8">
          {fields.map((field, i) => {
            const cardType = watch(`accounts.${i}.type`) as string;
            const isRRSPorTFSA = cardType === 'RRSP' || cardType === 'TFSA';
            const isNonRegistered = cardType === 'Non-Registered';
            const isESPP = cardType === 'ESPP';
            const isRESP = cardType === 'RESP';

            return (
              <div
                key={field.rhfKey}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
              >
                <CollapsibleCard
                  typeBadge={cardType}
                  label={(watch(`accounts.${i}.label`) as string) ?? cardType}
                  summaryAmount={fmt(Number(watch(`accounts.${i}.currentBalance`) as string) || 0)}
                  isExpanded={expandedIndices.has(i)}
                  onToggle={() => toggleExpanded(i)}
                  onDelete={() => handleDelete(i)}
                  deleteDialog={{
                    title: 'Remove this account?',
                    description:
                      'This account will be removed from your household profile. This action cannot be undone.',
                    confirmLabel: 'Remove Account',
                    cancelLabel: 'Keep Account',
                  }}
                >
                  <div className="space-y-6">
                    {/* Label */}
                    <div>
                      <Label className="text-sm font-bold">Label</Label>
                      <Input className={INPUT_STYLE} {...register(`accounts.${i}.label`)} />
                    </div>

                    {/* Belongs-to — hidden when no spouse (D-09); RESP: primary only */}
                    {includeSpouse && (
                      <div>
                        <Label className="text-sm font-bold">Belongs to</Label>
                        <Select
                          value={watch(`accounts.${i}.belongsTo`) as string}
                          onValueChange={(v) => setValue(`accounts.${i}.belongsTo`, v)}
                        >
                          <SelectTrigger className={SELECT_TRIGGER_STYLE}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="primary">Primary</SelectItem>
                            {!isRESP && <SelectItem value="spouse">Spouse</SelectItem>}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Two-column grid: Current Balance + Expected Return */}
                    <div className="grid gap-6 md:grid-cols-2">
                      <div>
                        <Label className="text-sm font-bold">Current balance ($)</Label>
                        <Input
                          type="number"
                          className={INPUT_STYLE}
                          {...register(`accounts.${i}.currentBalance`)}
                        />
                      </div>
                      <div>
                        <FieldLabelHelp
                          helpId={`account-${i}-expectedReturn-help`}
                          help="Your assumed average annual return before inflation. If unsure, use a conservative default and test lower-return scenarios."
                        >
                          Expected return (%)
                        </FieldLabelHelp>
                        <Input
                          type="number"
                          step="0.1"
                          className={INPUT_STYLE}
                          aria-describedby={`account-${i}-expectedReturn-help account-${i}-expectedReturn-default`}
                          {...register(`accounts.${i}.expectedReturn`)}
                        />
                        <p
                          id={`account-${i}-expectedReturn-default`}
                          className="mt-1 text-xs text-muted-foreground"
                        >
                          {DEFAULT_ASSUMPTION_COPY}
                        </p>
                      </div>
                    </div>

                    {/* Two-column grid: Annual Contribution + Contribution End Condition */}
                    <div className="grid gap-6 md:grid-cols-2">
                      <div>
                        <Label className="text-sm font-bold">Annual contribution ($)</Label>
                        <Input
                          type="number"
                          className={INPUT_STYLE}
                          {...register(`accounts.${i}.annualContribution`)}
                        />
                      </div>
                      <div>
                        <FieldLabelHelp
                          helpId={`account-${i}-contributionEndCondition-help`}
                          help="When contributions stop for this account. If unsure, choose retirement age and adjust later."
                        >
                          Contribution end condition
                        </FieldLabelHelp>
                        <Select
                          value={watch(`accounts.${i}.contributionEndCondition`) as string}
                          onValueChange={(v) =>
                            setValue(`accounts.${i}.contributionEndCondition`, v)
                          }
                        >
                          <SelectTrigger
                            className={SELECT_TRIGGER_STYLE}
                            aria-describedby={`account-${i}-contributionEndCondition-help`}
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
                    </div>

                    {/* Conditional contribution end year */}
                    {(watch(`accounts.${i}.contributionEndCondition`) as string) ===
                      'specific-year' && (
                      <div>
                        <Label className="text-sm font-bold">Contribution end year</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 2035"
                          className={INPUT_STYLE}
                          {...register(`accounts.${i}.contributionEndYear`, {
                            valueAsNumber: true,
                          })}
                        />
                      </div>
                    )}

                    {/* Type-specific extras (D-12, D-13) */}
                    {isRRSPorTFSA && (
                      <>
                        <Separator className="my-4" />
                        <p className="text-xs text-muted-foreground mb-4">{cardType} details</p>
                        <div>
                          <FieldLabelHelp
                            helpId={`account-${i}-contributionRoom-help`}
                            help={`${cardType} room available before future contributions. If unsure, enter the latest amount from CRA My Account or leave blank.`}
                          >
                            Contribution room ($)
                          </FieldLabelHelp>
                          <Input
                            type="number"
                            className={INPUT_STYLE}
                            aria-describedby={`account-${i}-contributionRoom-help`}
                            {...register(`accounts.${i}.contributionRoom`)}
                          />
                        </div>
                      </>
                    )}

                    {isNonRegistered && (
                      <>
                        <Separator className="my-4" />
                        <p className="text-xs text-muted-foreground mb-4">Non-registered details</p>
                        <div className="grid gap-6 md:grid-cols-2">
                          <div>
                            <FieldLabelHelp
                              helpId={`account-${i}-annualInterestIncome-help`}
                              help="Interest is usually fully taxable. Use expected annual taxable interest from this account."
                            >
                              Interest income ($/yr)
                            </FieldLabelHelp>
                            <Input
                              type="number"
                              className={INPUT_STYLE}
                              aria-describedby={`account-${i}-annualInterestIncome-help account-${i}-nonRegTaxNotice`}
                              {...register(`accounts.${i}.annualInterestIncome`)}
                            />
                          </div>
                          <div>
                            <FieldLabelHelp
                              helpId={`account-${i}-annualEligibleDividends-help`}
                              help="Canadian eligible dividends may receive dividend tax credit treatment."
                            >
                              Canadian eligible dividends ($/yr)
                            </FieldLabelHelp>
                            <Input
                              type="number"
                              className={INPUT_STYLE}
                              aria-describedby={`account-${i}-annualEligibleDividends-help account-${i}-nonRegTaxNotice`}
                              {...register(`accounts.${i}.annualEligibleDividends`)}
                            />
                          </div>
                          <div>
                            <FieldLabelHelp
                              helpId={`account-${i}-annualNonEligibleDividends-help`}
                              help="Canadian non-eligible dividends may receive different gross-up and dividend tax credit treatment."
                            >
                              Canadian non-eligible dividends ($/yr)
                            </FieldLabelHelp>
                            <Input
                              type="number"
                              className={INPUT_STYLE}
                              aria-describedby={`account-${i}-annualNonEligibleDividends-help account-${i}-nonRegTaxNotice`}
                              {...register(`accounts.${i}.annualNonEligibleDividends`)}
                            />
                          </div>
                          <div>
                            <FieldLabelHelp
                              helpId={`account-${i}-annualRealizedCapitalGains-help`}
                              help="Enter recurring realized capital gains that are separate from withdrawals or sales modeled through adjusted cost base."
                            >
                              Realized capital gains ($/yr)
                            </FieldLabelHelp>
                            <Input
                              type="number"
                              className={INPUT_STYLE}
                              aria-describedby={`account-${i}-annualRealizedCapitalGains-help account-${i}-nonRegTaxNotice`}
                              {...register(`accounts.${i}.annualRealizedCapitalGains`)}
                            />
                          </div>
                        </div>
                        <div>
                          <FieldLabelHelp
                            helpId={`account-${i}-adjustedCostBase-help`}
                            help="ACB is used to estimate capital gains. If unsure, use your broker's book cost or leave blank."
                            learnMoreHref="/glossary#acb"
                          >
                            Adjusted cost base ($)
                          </FieldLabelHelp>
                          <Input
                            type="number"
                            className={INPUT_STYLE}
                            aria-describedby={`account-${i}-adjustedCostBase-help`}
                            {...register(`accounts.${i}.adjustedCostBase`)}
                          />
                        </div>
                        <p
                          id={`account-${i}-nonRegTaxNotice`}
                          className="text-xs text-muted-foreground"
                        >
                          Educational planning estimate only; not tax advice.
                        </p>
                      </>
                    )}

                    {isESPP && (
                      <>
                        <Separator className="my-4" />
                        <p className="text-xs text-muted-foreground mb-4">ESPP details</p>
                        <div>
                          <Label className="text-sm font-bold">Employer match (%)</Label>
                          <Input
                            type="number"
                            step="0.1"
                            className={INPUT_STYLE}
                            {...register(`accounts.${i}.employerMatch`)}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </CollapsibleCard>
              </div>
            );
          })}
        </div>
      )}

      {/* "+ Add Account" button */}
      <div className="mt-4 flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="bg-ds-primary text-ds-on-primary">
              <Plus className="h-4 w-4 mr-1" /> Add Account
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {ACCOUNT_TYPES.map((type) => (
              <DropdownMenuItem key={type} onSelect={() => handleAddType(type)}>
                {type}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <GlossaryLink anchor="account-types" term="account types" />
      </div>

      {/* Summary bar */}
      {fields.length > 0 && (
        <div
          className="sticky bottom-0 bg-ds-surface border-t border-ds-outline-variant px-8 py-4 mt-8"
          aria-live="polite"
        >
          <span className="text-sm text-ds-on-surface font-bold">Total balances: {fmt(total)}</span>
          {includeSpouse && (
            <span className="text-sm text-muted-foreground ml-3">
              Primary: {fmt(primaryTotal)} &middot; Spouse: {fmt(spouseTotal)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
