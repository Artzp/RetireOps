'use client';

import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SourceCitationLink } from '@/components/citations/SourceCitationLink';
import { CppEstimatorCard } from './government-pensions/CppEstimatorCard';
import { OasEstimatorCard } from './government-pensions/OasEstimatorCard';
import { GisEstimatorCard } from './government-pensions/GisEstimatorCard';

/**
 * Government Pensions step (WIZ-03, Phase 20 scaffold → Phase 21 CPP/QPP → Phase 22 OAS → Phase 23 GIS).
 *
 * Phase 23 (this iteration) mounts GisEstimatorCard inside PersonPanel below
 * the OAS card. CPP + OAS cards are unchanged.
 *
 * Plan = QPP iff `about_you.province === 'QC'`; otherwise CPP. The card
 * derives its citation anchor + statement label from this prop and remains
 * pure-via-props for testability (no direct province read inside the card).
 *
 * The discriminated-union `kind` discriminator (D-01 from Phase 20 CONTEXT)
 * is purely a SAVE-time concept — the form holds both `cpp_spouse` and
 * `oas_spouse` keys unconditionally; the assembler (Phase 24 INTG-01)
 * selects the branch at save based on `about_you.includeSpouse`.
 */
const PROVINCE_LABELS: Record<string, string> = {
  ON: 'Ontario',
  QC: 'Quebec',
  BC: 'British Columbia',
  AB: 'Alberta',
  MB: 'Manitoba',
  SK: 'Saskatchewan',
  NS: 'Nova Scotia',
  NB: 'New Brunswick',
  PE: 'Prince Edward Island',
  NL: 'Newfoundland and Labrador',
  YT: 'Yukon',
  NT: 'Northwest Territories',
  NU: 'Nunavut',
};

export function GovernmentPensionsStep() {
  const { watch } = useFormContext();

  const [activeTab, setActiveTab] = useState<'primary' | 'spouse'>('primary');

  const includeSpouse = watch('about_you.includeSpouse') as boolean;
  const primaryName = (watch('about_you.firstName') as string) || 'Primary';
  const spouseName = (watch('spouse.firstName') as string) || 'Spouse';

  // Province-driven CPP vs QPP routing (D-17, D-18). QC → QPP; else CPP.
  const province = (watch('about_you.province') as string) || 'ON';
  const plan: 'CPP' | 'QPP' = province === 'QC' ? 'QPP' : 'CPP';
  const provinceLabel = PROVINCE_LABELS[province] ?? province;

  // D-09: Spouse tab snap-back — copied verbatim from BenefitsStep.tsx:39-42.
  useEffect(() => {
    if (!includeSpouse) setActiveTab('primary');
  }, [includeSpouse]);

  return (
    <div className="space-y-6">
      {/* Section header with the first SourceCitationLink chip on the wizard */}
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-ds-on-background">Government Pensions</h2>
          <SourceCitationLink
            doc="05-government-benefits.md"
            anchor="government-pensions"
            label="Rules"
          />
          <SourceCitationLink
            doc="18-pensions-2026.md"
            anchor="2026-cpp-max-retirement-pension"
            label="2026 parameters"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          CPP/QPP, OAS, and GIS. Estimates only — every dollar amount is cited to source-of-truth.
          Provincial supplements remain backlog for v4.8+.
        </p>
      </header>

      {/* Primary/Spouse tab pattern (mirrors BenefitsStep.tsx). When
          spouse is not included, only the Primary tab is rendered and
          the snap-back useEffect above keeps activeTab on 'primary'. */}
      {includeSpouse ? (
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'primary' | 'spouse')}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="primary">{primaryName}</TabsTrigger>
            <TabsTrigger value="spouse">{spouseName}</TabsTrigger>
          </TabsList>
          <TabsContent value="primary" className="mt-4">
            <PersonPanel person="primary" plan={plan} provinceLabel={provinceLabel} />
          </TabsContent>
          <TabsContent value="spouse" className="mt-4">
            <PersonPanel person="spouse" plan={plan} provinceLabel={provinceLabel} />
          </TabsContent>
        </Tabs>
      ) : (
        <PersonPanel person="primary" plan={plan} provinceLabel={provinceLabel} />
      )}
    </div>
  );
}

/**
 * Per-person CPP (Phase 21 CppEstimatorCard) + OAS (Phase 22 OasEstimatorCard) + GIS (Phase 23 GisEstimatorCard).
 */
function PersonPanel({
  person,
  plan,
  provinceLabel,
}: {
  person: 'primary' | 'spouse';
  plan: 'CPP' | 'QPP';
  provinceLabel: string;
}) {
  return (
    <div className="space-y-6">
      {/* CPP / QPP — Phase 21 full estimator card */}
      <CppEstimatorCard person={person} plan={plan} provinceLabel={provinceLabel} />

      {/* OAS — Phase 22 full estimator card */}
      <OasEstimatorCard person={person} provinceLabel={provinceLabel} />

      {/* GIS — Phase 23 full estimator card */}
      <GisEstimatorCard person={person} provinceLabel={provinceLabel} />
    </div>
  );
}
