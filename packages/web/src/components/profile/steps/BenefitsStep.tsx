/* eslint-disable @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unnecessary-condition */
'use client';

import { useEffect, useRef, useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldLabelHelp } from '@/components/ui/field-help';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CollapsibleCard } from '@/components/profile/CollapsibleCard';
import { GlossaryLink } from '@/components/glossary/GlossaryLink';
import { type PensionCard } from '@/components/profile/lib/profile-constants';
import { DEFAULT_ASSUMPTION_COPY, getWizardAssumptionDefaults } from '@/lib/settings-assumptions';

const INPUT_STYLE =
  'border-0 border-b-2 border-ds-outline-variant bg-transparent rounded-none focus-visible:ring-0 focus-visible:border-b-ds-primary transition-[border-color] duration-200';

export function BenefitsStep() {
  const { register, watch, setValue, control } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'benefits.pensions',
    keyName: 'rhfKey',
  });

  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeTab, setActiveTab] = useState<'primary' | 'spouse'>('primary');

  const includeSpouse = watch('about_you.includeSpouse') as boolean;
  const primaryName = (watch('about_you.firstName') as string) || 'Primary';
  const spouseName = (watch('spouse.firstName') as string) || 'Spouse';

  // D-03: Spouse tab snap-back
  useEffect(() => {
    if (!includeSpouse) setActiveTab('primary');
  }, [includeSpouse]);

  function handleAddDbPension(person: 'primary' | 'spouse') {
    const assumptionDefaults = getWizardAssumptionDefaults();
    append({
      _serverId: undefined,
      type: 'DB Pension',
      belongsTo: person,
      label: 'DB Pension',
      annualPension: '',
      indexed: false,
      indexingRate: String(assumptionDefaults.indexingRate),
      bridgeBenefit: false,
      bridgeAmount: '',
      bridgeEndsAtAge: '',
      survivorBenefit: '',
    } satisfies PensionCard);
    setExpandedIndices((prev) => new Set([...prev, fields.length]));
    setTimeout(() => {
      cardRefs.current[fields.length]?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  function handleAddDcPension(person: 'primary' | 'spouse') {
    const assumptionDefaults = getWizardAssumptionDefaults();
    append({
      _serverId: undefined,
      type: 'DC Pension',
      belongsTo: person,
      label: 'DC Pension',
      currentBalance: '',
      contributionRate: '',
      employerMatchRate: '',
      expectedReturn: String(assumptionDefaults.investmentReturnRate),
    } satisfies PensionCard);
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

  // Summary bar values
  const fmt = (n: number) => `$${n.toLocaleString('en-CA')}`;
  const cppPrimary = Number(watch('benefits.cpp_primary.estimatedAnnual')) || 0;
  const oasPrimary = Number(watch('benefits.oas_primary.estimatedAnnual')) || 0;
  const cppSpouse = Number(watch('benefits.cpp_spouse.estimatedAnnual')) || 0;
  const oasSpouse = Number(watch('benefits.oas_spouse.estimatedAnnual')) || 0;

  function renderPersonBenefitsSection(person: 'primary' | 'spouse') {
    const survivorEnabled = watch(`benefits.cpp_${person}.survivorsPensionEnabled`) as boolean;
    const isIndexed = (i: number) => watch(`benefits.pensions.${i}.indexed`) as boolean;
    const hasBridge = (i: number) => watch(`benefits.pensions.${i}.bridgeBenefit`) as boolean;

    // Filter pensions for this person, preserving original index
    const personPensions = fields
      .map((f, i) => ({ ...f, originalIndex: i }))
      .filter(
        (f) => (f as unknown as PensionCard & { originalIndex: number }).belongsTo === person
      );

    return (
      <div className="space-y-6">
        {/* CPP section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-ds-on-background">CPP Estimate</h2>
            <GlossaryLink anchor="cpp" term="CPP" />
          </div>
          <div>
            <FieldLabelHelp
              helpId={`cpp-${person}-estimated-help`}
              help="Your estimated annual CPP if you started at age 65 (Service Canada's online statement shows this number). The projection adjusts automatically if you start earlier or later."
              learnMoreHref="/glossary#cpp"
            >
              Estimated annual CPP at 65 ($)
            </FieldLabelHelp>
            <Input
              type="number"
              className={INPUT_STYLE}
              aria-describedby={`cpp-${person}-estimated-help cpp-${person}-estimator-hint`}
              {...register(`benefits.cpp_${person}.estimatedAnnual`)}
            />
            <p id={`cpp-${person}-estimator-hint`} className="mt-1 text-xs text-muted-foreground">
              Don&apos;t know this number? Leave it blank — the next step (Government Pensions) has
              an estimator that works it out from your work history.
            </p>
          </div>
          {/* Survivor toggle (D-06). Disabled: the projection does not consume
              survivorsPensionEnabled/Amount yet (assembler never reads them) —
              collecting the input silently would be a trust-eroding no-op.
              Re-enable when the engine models CPP survivor benefits from the
              profile (bug-milestone backlog). */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Checkbox id={`cpp_survivor_${person}`} checked={survivorEnabled} disabled />
              <Label htmlFor={`cpp_survivor_${person}`} className="text-muted-foreground">
                Include survivor&apos;s pension
              </Label>
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              A CPP survivor&apos;s pension is a monthly benefit paid to a surviving spouse or
              common-law partner. Not yet included in projections — coming soon.
            </p>
          </div>
        </div>

        <Separator className="my-6" />

        {/* OAS section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-ds-on-background">OAS Estimate</h2>
            <GlossaryLink anchor="oas" term="OAS" />
          </div>
          <div>
            <FieldLabelHelp
              helpId={`oas-${person}-estimated-help`}
              help="Your estimated annual OAS at age 65 (currently ~$8,560 for someone with 40+ years of Canadian residence). Defer up to age 70 for a +0.6%/month boost; high incomes face the OAS clawback."
              learnMoreHref="/glossary#oas"
            >
              Estimated annual OAS at 65 ($)
            </FieldLabelHelp>
            <Input
              type="number"
              className={INPUT_STYLE}
              aria-describedby={`oas-${person}-estimated-help oas-${person}-estimator-hint`}
              {...register(`benefits.oas_${person}.estimatedAnnual`)}
            />
            <p id={`oas-${person}-estimator-hint`} className="mt-1 text-xs text-muted-foreground">
              Don&apos;t know this number? Leave it blank — the next step (Government Pensions) has
              an estimator based on your years in Canada.
            </p>
          </div>
          <div>
            <FieldLabelHelp
              helpId={`oas-${person}-residencyYears-help`}
              help="Used for OAS eligibility and partial OAS. Enter years lived in Canada after age 18; if unsure, use your best estimate."
              learnMoreHref="/glossary#oas"
            >
              Years of Canadian residence
            </FieldLabelHelp>
            <Input
              type="number"
              className={INPUT_STYLE}
              aria-describedby={`oas-${person}-residencyYears-help oas-${person}-residencyYears-default`}
              {...register(`benefits.oas_${person}.residencyYears`)}
            />
            <p
              id={`oas-${person}-residencyYears-default`}
              className="text-xs text-muted-foreground"
            >
              (defaults to 40 for full OAS)
            </p>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Pension cards section */}
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold">Not sure which you have?</span> Check your pension
            statement: a <span className="font-semibold">DB (defined benefit)</span> plan promises a
            set income for life — common in government, education, and healthcare. A{' '}
            <span className="font-semibold">DC (defined contribution)</span> plan shows an account
            balance that you and your employer pay into, like an investment account.
          </p>
          {/* Honest-status note: wizard DC pensions (benefits.pensions with
              type='DC Pension') are not consumed by the assembler yet — only DB
              pensions feed the projection. Don't let users assume otherwise. */}
          <p className="text-xs text-muted-foreground">
            Heads up: DB pension income is included in projections, but DC pension balances
            aren&apos;t yet — coming soon. To model a DC plan today, add its balance as an account
            on the Accounts step.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => handleAddDbPension(person)}
              className="bg-ds-primary text-ds-on-primary"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add DB Pension
            </Button>
            <Button
              type="button"
              onClick={() => handleAddDcPension(person)}
              className="bg-ds-primary text-ds-on-primary"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add DC Pension
            </Button>
          </div>

          {personPensions.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm font-bold text-ds-on-background">No pension plans yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add a DB or DC pension plan to include employer pensions in your projection.
              </p>
            </div>
          )}

          {personPensions.length > 0 && (
            <div className="space-y-4 mt-4">
              {personPensions.map((f) => {
                const origIdx = (f as unknown as { originalIndex: number }).originalIndex;
                const cardType = (f as unknown as PensionCard).type;
                const cardLabel =
                  (watch(`benefits.pensions.${origIdx}.label`) as string) ?? cardType;
                const summaryAmount =
                  cardType === 'DB Pension'
                    ? `$${(Number(watch(`benefits.pensions.${origIdx}.annualPension`)) || 0).toLocaleString('en-CA')}/yr`
                    : `$${(Number(watch(`benefits.pensions.${origIdx}.currentBalance`)) || 0).toLocaleString('en-CA')}`;

                return (
                  <div
                    key={f.rhfKey}
                    ref={(el) => {
                      cardRefs.current[origIdx] = el;
                    }}
                  >
                    <CollapsibleCard
                      typeBadge={cardType}
                      label={cardLabel}
                      summaryAmount={summaryAmount}
                      isExpanded={expandedIndices.has(origIdx)}
                      onToggle={() => toggleExpanded(origIdx)}
                      onDelete={() => handleDelete(origIdx)}
                      deleteDialog={{
                        title: 'Remove this pension?',
                        description:
                          'This pension plan will be removed from your household profile. This action cannot be undone.',
                        confirmLabel: 'Remove Pension',
                        cancelLabel: 'Keep Pension',
                      }}
                    >
                      <div className="space-y-6">
                        {/* Label field — shared by DB and DC */}
                        <div>
                          <Label className="text-sm font-bold">Label</Label>
                          <Input
                            className={INPUT_STYLE}
                            {...register(`benefits.pensions.${origIdx}.label`)}
                          />
                        </div>

                        {cardType === 'DB Pension' && (
                          <>
                            <div>
                              <Label className="text-sm font-bold">
                                Annual pension at retirement ($)
                              </Label>
                              <Input
                                type="number"
                                className={INPUT_STYLE}
                                {...register(`benefits.pensions.${origIdx}.annualPension`)}
                              />
                            </div>

                            {/* Indexed toggle */}
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`pension_indexed_${origIdx}`}
                                checked={isIndexed(origIdx)}
                                aria-describedby={`pension-${origIdx}-indexed-help`}
                                onCheckedChange={(v) =>
                                  setValue(`benefits.pensions.${origIdx}.indexed`, v === true)
                                }
                              />
                              <FieldLabelHelp
                                htmlFor={`pension_indexed_${origIdx}`}
                                helpId={`pension-${origIdx}-indexed-help`}
                                help="Whether the pension rises after it starts. If unsure, check your pension statement or leave it off."
                                className="text-sm font-normal"
                              >
                                Indexed to inflation
                              </FieldLabelHelp>
                            </div>
                            {isIndexed(origIdx) && (
                              <div>
                                <FieldLabelHelp
                                  helpId={`pension-${origIdx}-indexingRate-help`}
                                  help="How much this pension increases each year. If unsure, use the rate from your pension statement or leave blank."
                                >
                                  Indexing rate (%)
                                </FieldLabelHelp>
                                <Input
                                  type="number"
                                  step="0.1"
                                  className={INPUT_STYLE}
                                  aria-describedby={`pension-${origIdx}-indexingRate-help pension-${origIdx}-indexingRate-default`}
                                  {...register(`benefits.pensions.${origIdx}.indexingRate`)}
                                />
                                <p
                                  id={`pension-${origIdx}-indexingRate-default`}
                                  className="mt-1 text-xs text-muted-foreground"
                                >
                                  {DEFAULT_ASSUMPTION_COPY}
                                </p>
                              </div>
                            )}

                            {/* Bridge benefit toggle */}
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`pension_bridge_${origIdx}`}
                                checked={hasBridge(origIdx)}
                                onCheckedChange={(v) =>
                                  setValue(`benefits.pensions.${origIdx}.bridgeBenefit`, v === true)
                                }
                              />
                              <Label htmlFor={`pension_bridge_${origIdx}`}>
                                Has bridge benefit
                              </Label>
                            </div>
                            {hasBridge(origIdx) && (
                              <div className="grid gap-6 md:grid-cols-2">
                                <div>
                                  <Label className="text-sm font-bold">Bridge amount ($/yr)</Label>
                                  <Input
                                    type="number"
                                    className={INPUT_STYLE}
                                    {...register(`benefits.pensions.${origIdx}.bridgeAmount`)}
                                  />
                                </div>
                                <div>
                                  <Label className="text-sm font-bold">Bridge ends at age</Label>
                                  <Input
                                    type="number"
                                    className={INPUT_STYLE}
                                    {...register(`benefits.pensions.${origIdx}.bridgeEndsAtAge`)}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Survivor benefit */}
                            <div>
                              <FieldLabelHelp
                                helpId={`pension-${origIdx}-survivorBenefit-help`}
                                help="The portion paid to a surviving spouse or partner. If unsure, use the percentage from your pension statement or leave blank."
                              >
                                Survivor benefit (%)
                              </FieldLabelHelp>
                              <Input
                                type="number"
                                step="0.1"
                                className={INPUT_STYLE}
                                placeholder="e.g. 60"
                                aria-describedby={`pension-${origIdx}-survivorBenefit-help`}
                                {...register(`benefits.pensions.${origIdx}.survivorBenefit`)}
                              />
                            </div>
                          </>
                        )}

                        {cardType === 'DC Pension' && (
                          <>
                            <div>
                              <Label className="text-sm font-bold">Current balance ($)</Label>
                              <Input
                                type="number"
                                className={INPUT_STYLE}
                                {...register(`benefits.pensions.${origIdx}.currentBalance`)}
                              />
                            </div>
                            <div>
                              <FieldLabelHelp
                                helpId={`pension-${origIdx}-contributionRate-help`}
                                help="Percent of your gross salary you put into the plan each year — check your pay stub or pension statement (e.g. 5 means 5% of salary)."
                              >
                                Contribution rate (%)
                              </FieldLabelHelp>
                              <Input
                                type="number"
                                step="0.1"
                                className={INPUT_STYLE}
                                aria-describedby={`pension-${origIdx}-contributionRate-help`}
                                {...register(`benefits.pensions.${origIdx}.contributionRate`)}
                              />
                            </div>
                            <div>
                              <FieldLabelHelp
                                helpId={`pension-${origIdx}-employerMatchRate-help`}
                                help="Percent of your gross salary your employer adds on top of your own contributions — from your plan booklet or HR."
                              >
                                Employer match rate (%)
                              </FieldLabelHelp>
                              <Input
                                type="number"
                                step="0.1"
                                className={INPUT_STYLE}
                                aria-describedby={`pension-${origIdx}-employerMatchRate-help`}
                                {...register(`benefits.pensions.${origIdx}.employerMatchRate`)}
                              />
                            </div>
                            <div>
                              <FieldLabelHelp
                                helpId={`pension-${origIdx}-expectedReturn-help`}
                                help="Your assumed average annual return before inflation. If unsure, use a conservative default and test lower-return scenarios."
                              >
                                Expected return (%)
                              </FieldLabelHelp>
                              <Input
                                type="number"
                                step="0.1"
                                className={INPUT_STYLE}
                                aria-describedby={`pension-${origIdx}-expectedReturn-help pension-${origIdx}-expectedReturn-default`}
                                {...register(`benefits.pensions.${origIdx}.expectedReturn`)}
                              />
                              <p
                                id={`pension-${origIdx}-expectedReturn-default`}
                                className="mt-1 text-xs text-muted-foreground"
                              >
                                {DEFAULT_ASSUMPTION_COPY}
                              </p>
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
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {includeSpouse ? (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'primary' | 'spouse')}>
          <TabsList>
            <TabsTrigger value="primary">{primaryName}</TabsTrigger>
            <TabsTrigger value="spouse">{spouseName}</TabsTrigger>
          </TabsList>
          <TabsContent value="primary" className="pt-6">
            {renderPersonBenefitsSection('primary')}
          </TabsContent>
          <TabsContent value="spouse" className="pt-6">
            {renderPersonBenefitsSection('spouse')}
          </TabsContent>
        </Tabs>
      ) : (
        renderPersonBenefitsSection('primary')
      )}

      {/* Summary bar (D-11) */}
      <div
        className="sticky bottom-0 bg-ds-surface border-t border-ds-outline-variant px-8 py-4 mt-8"
        aria-live="polite"
      >
        <span className="text-sm font-bold text-ds-on-surface">
          {includeSpouse
            ? `Primary: ${fmt(cppPrimary)} CPP + ${fmt(oasPrimary)} OAS | Spouse: ${fmt(cppSpouse)} CPP + ${fmt(oasSpouse)} OAS | ${fields.length} pension plans`
            : `${fmt(cppPrimary)} CPP + ${fmt(oasPrimary)} OAS | ${fields.length} pension plans`}
        </span>
      </div>
    </div>
  );
}
