/**
 * 2026 Tier-A provincial / territorial senior supplements lookup table.
 *
 * Tier-A = direct cash-transfer programs only (Phase 19 scope per
 * REQUIREMENTS.md PARAM-02). Tier-B programs (property-tax credits,
 * pharmacare, fuel subsidies) are surfaced as info link-out tiles in
 * Phase 25 (PROV-06) and are NOT in this table.
 *
 * Every program carries:
 *   - `confidence`: how reliable the 2026 value is (D-07)
 *   - `accounting`: drives Phase 25 row display — perCouple = 1 row,
 *      perPerson = 2 rows for couples (D-08)
 *   - `citationAnchor`: the anchor fragment from
 *      docs/source-of-truth/19-benefits-tax-credits-2026.md (D-09).
 *      The SourceCitationLink component (Phase 20, WIZ-04) composes
 *      the GitHub blob URL from the anchor fragment.
 *
 * All 13 ProvinceCode jurisdictions are present (D-10), even where no
 * Tier-A program exists (QC: []). The sanity-check test in Phase 19
 * plan 03 (PARAM-05) verifies presence + absence-of-duplicates.
 *
 * @see docs/source-of-truth/19-benefits-tax-credits-2026.md
 * @see .planning/phases/19-parameter-consolidation/19-CONTEXT.md (D-05 through D-10)
 */

import type { ProvinceCode } from '../types/province.js';

export interface ProvincialSupplementProgram {
  /** Program name as shown in source-of-truth doc. */
  name: string;
  /** Province/territory code. Redundant with the table key but useful when
   *  a program record is passed by value to a component. */
  province: ProvinceCode;
  /**
   * Maximum annual benefit in CAD (dollars, not cents).
   * For `perPerson` programs: the per-person maximum.
   * For `perCouple` programs: the combined couple maximum.
   */
  maxAnnualAmount: number;
  /** Plain-text income test description, for Phase 25 tooltip. */
  incomeTest: string;
  /** Plain-text eligibility summary. */
  eligibility: string;
  /** Confidence in the 2026 value (D-07). */
  confidence: 'confirmed' | 'estimated' | 'frozen-since-2023' | 'not-yet-confirmed-for-2026';
  /**
   * Whether the amount is per individual or per couple (D-08).
   * - `perPerson`: Phase 25 renders TWO rows for couples (one per spouse).
   * - `perCouple`: Phase 25 renders ONE row for the couple.
   */
  accounting: 'perPerson' | 'perCouple';
  /**
   * Anchor fragment from docs/source-of-truth/19-benefits-tax-credits-2026.md
   * (e.g., `2026-on-gains-single`). The SourceCitationLink component in
   * Phase 20 composes the full GitHub blob URL. (D-09)
   */
  citationAnchor: string;
  /** Optional free-text notes for Phase 25 display. */
  notes?: string;
}

export const PROVINCIAL_SUPPLEMENTS_2026: Readonly<
  Record<ProvinceCode, readonly ProvincialSupplementProgram[]>
> = {
  ON: [
    {
      name: 'Guaranteed Annual Income System (GAINS)',
      province: 'ON',
      maxAnnualAmount: 1_080,
      incomeTest: 'Private income < $4,320/year (single); GIS receipt required',
      eligibility: 'Age 65+; OAS+GIS recipient; Ontario resident',
      confidence: 'not-yet-confirmed-for-2026',
      accounting: 'perPerson',
      // per docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-on-gains-single
      citationAnchor: '2026-on-gains-single',
      notes:
        '2026-27 benefit-year amount not yet published; using July 2025-June 2026 rate ($90/mo)',
    },
  ],
  QC: [],
  BC: [
    {
      name: "BC Senior's Supplement (single)",
      province: 'BC',
      maxAnnualAmount: 1_191.6,
      incomeTest: 'GIS receipt required; provincial income test atop federal',
      eligibility: 'Age 65+; OAS+GIS recipient; BC resident',
      confidence: 'confirmed',
      accounting: 'perPerson',
      // per docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-bc-senior-supplement-single
      citationAnchor: '2026-bc-senior-supplement-single',
      notes: '$99.30/month single rate (2026)',
    },
    {
      name: "BC Senior's Supplement (couple, each)",
      province: 'BC',
      maxAnnualAmount: 1_323,
      incomeTest: 'GIS receipt required; provincial income test atop federal',
      eligibility: 'Age 65+ both spouses; OAS+GIS recipients; BC resident',
      confidence: 'confirmed',
      accounting: 'perPerson',
      // per docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-bc-senior-supplement-couple-each
      citationAnchor: '2026-bc-senior-supplement-couple-each',
      notes: '$110.25/month per spouse rate (2026)',
    },
  ],
  AB: [
    {
      name: 'Alberta Seniors Benefit (single)',
      province: 'AB',
      maxAnnualAmount: 3_936,
      incomeTest:
        'Income-tested; phased out above 2025 threshold (2026 threshold proposed, not yet Royal Assent)',
      eligibility: 'Age 65+; Alberta resident; OAS recipient',
      confidence: 'confirmed',
      accounting: 'perPerson',
      // per docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-ab-seniors-benefit-single-monthly
      citationAnchor: '2026-ab-seniors-benefit-single-monthly',
      notes: '$328/month (2026)',
    },
    {
      name: 'Alberta Seniors Benefit (couple)',
      province: 'AB',
      maxAnnualAmount: 5_916,
      incomeTest:
        'Income-tested; phased out above 2025 threshold (2026 threshold proposed, not yet Royal Assent)',
      eligibility: 'Age 65+ one or both spouses; Alberta resident; OAS recipient',
      confidence: 'confirmed',
      accounting: 'perCouple',
      // per docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-ab-seniors-benefit-couple-monthly
      citationAnchor: '2026-ab-seniors-benefit-couple-monthly',
      notes: '$493/month combined (2026)',
    },
  ],
  MB: [
    {
      name: '55 PLUS Income Supplement (single)',
      province: 'MB',
      maxAnnualAmount: 647,
      incomeTest: 'Net income below junior cutoff (per anchor 2026-mb-55plus-junior-cutoff-single)',
      eligibility: 'Age 55+; Manitoba resident',
      confidence: 'confirmed',
      accounting: 'perPerson',
      // per docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-mb-55plus-single-quarterly
      citationAnchor: '2026-mb-55plus-single-quarterly',
      notes: '$161.80/quarter (2026)',
    },
    {
      name: '55 PLUS Income Supplement (couple, each)',
      province: 'MB',
      maxAnnualAmount: 695.6,
      incomeTest:
        'Net combined income below junior cutoff (per anchor 2026-mb-55plus-junior-cutoff-couple)',
      eligibility: 'Age 55+ either spouse; Manitoba resident',
      confidence: 'confirmed',
      accounting: 'perPerson',
      // per docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-mb-55plus-couple-each-quarterly
      citationAnchor: '2026-mb-55plus-couple-each-quarterly',
      notes: '$173.90/quarter per spouse (2026)',
    },
  ],
  SK: [
    {
      name: 'Saskatchewan Income Plan (SIP) — single',
      province: 'SK',
      maxAnnualAmount: 4_320,
      incomeTest: 'GIS receipt required; provincial income test atop federal',
      eligibility: 'Age 65+; OAS+GIS recipient; Saskatchewan resident',
      confidence: 'frozen-since-2023',
      accounting: 'perPerson',
      // per docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-sk-sip-single
      citationAnchor: '2026-sk-sip-single',
      notes: 'Frozen at July 2023 rate ($360/mo); no 2026 change announced',
    },
    {
      name: 'Saskatchewan Income Plan (SIP) — couple',
      province: 'SK',
      maxAnnualAmount: 7_800,
      incomeTest: 'GIS receipt required; provincial income test atop federal',
      eligibility: 'Age 65+ both spouses; OAS+GIS recipients; Saskatchewan resident',
      confidence: 'frozen-since-2023',
      accounting: 'perCouple',
      // per docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-sk-sip-couple-each
      citationAnchor: '2026-sk-sip-couple-each',
      notes: 'Frozen at July 2023 rate ($325/mo each); no 2026 change announced',
    },
  ],
  NS: [
    {
      name: 'Seniors Care Grant',
      province: 'NS',
      maxAnnualAmount: 750,
      incomeTest: 'Net income below provincial threshold (per source doc)',
      eligibility: 'Age 65+; Nova Scotia resident; filed prior-year tax return',
      confidence: 'estimated',
      accounting: 'perPerson',
      // per docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-ns-seniors-care-grant
      citationAnchor: '2026-ns-seniors-care-grant',
      notes: '2025-26 amount; check Nova Scotia for 2026-27 update',
    },
  ],
  NB: [
    {
      name: "Low-Income Seniors' Benefit",
      province: 'NB',
      maxAnnualAmount: 629,
      incomeTest: 'GIS receipt or equivalent provincial low-income status',
      eligibility: 'Age 60+; New Brunswick resident',
      confidence: 'confirmed',
      accounting: 'perPerson',
      // per docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-nb-low-income-seniors-benefit
      citationAnchor: '2026-nb-low-income-seniors-benefit',
    },
  ],
  PE: [
    {
      name: 'Seniors Independence Initiative',
      province: 'PE',
      maxAnnualAmount: 1_800,
      incomeTest: 'Income-tested per provincial criteria',
      eligibility: 'Age 65+; PEI resident; able to live at home',
      confidence: 'confirmed',
      accounting: 'perPerson',
      // per docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-pe-seniors-independence
      citationAnchor: '2026-pe-seniors-independence',
    },
  ],
  NL: [
    {
      name: "NL Seniors' Benefit",
      province: 'NL',
      maxAnnualAmount: 1_551,
      incomeTest: 'Net income below ~$30,078 for maximum; phase-out at 11.66% to ~$43,380',
      eligibility: 'Age 65+; NL resident; filed tax return',
      confidence: 'not-yet-confirmed-for-2026',
      accounting: 'perPerson',
      // per docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-nl-seniors-benefit-max
      citationAnchor: '2026-nl-seniors-benefit-max',
      notes: '2025-26 amount $1,551; 2026-27 not yet published; CPI-indexed from July 2025',
    },
    {
      name: 'NL Income Supplement (NLIS)',
      province: 'NL',
      maxAnnualAmount: 520,
      incomeTest: 'Income-tested per provincial criteria',
      eligibility: 'Age 19+ low-income (senior single max shown); NL resident',
      confidence: 'confirmed',
      accounting: 'perPerson',
      // per docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-nl-income-supplement-single-max
      citationAnchor: '2026-nl-income-supplement-single-max',
    },
  ],
  YT: [
    {
      name: 'Yukon Seniors Income Supplement',
      province: 'YT',
      maxAnnualAmount: 3_276.6,
      incomeTest: 'GIS receipt required',
      eligibility: 'Age 65+; OAS+GIS recipient; Yukon resident',
      confidence: 'estimated',
      accounting: 'perPerson',
      // per docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-yt-seniors-income-supplement
      citationAnchor: '2026-yt-seniors-income-supplement',
      notes: '2025 value $273.05/month; 2026 indexed amount not yet announced',
    },
  ],
  NT: [
    {
      name: 'Senior Citizen Supplementary Benefit (SCSB)',
      province: 'NT',
      maxAnnualAmount: 2_352,
      incomeTest: 'GIS receipt required; provincial income test atop federal',
      eligibility: 'Age 60+; NT resident; OAS+GIS recipient',
      confidence: 'estimated',
      accounting: 'perPerson',
      // per docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-nt-scsb
      citationAnchor: '2026-nt-scsb',
      notes: '~$196/month (2026 estimate)',
    },
  ],
  NU: [
    {
      name: 'Senior Citizen Supplementary Benefit (SCSB)',
      province: 'NU',
      maxAnnualAmount: 3_600,
      incomeTest: 'GIS receipt required',
      eligibility: 'Age 60+; Nunavut resident; OAS+GIS recipient',
      confidence: 'confirmed',
      accounting: 'perPerson',
      // per docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-nu-scsb
      citationAnchor: '2026-nu-scsb',
      notes: '$300/month (2026)',
    },
  ],
} as const;
