/**
 * Tax Brackets and Basic Personal Amounts
 * @see docs/source-of-truth/04-tax-engine.md
 */
import type { TaxTable } from '../types/tax.js';

/**
 * Federal Tax Brackets (2024)
 * @see docs/source-of-truth/04-tax-engine.md - Federal Tax Brackets
 */
export const FEDERAL_TAX_2024: TaxTable = {
  year: 2024,
  jurisdiction: 'federal',
  brackets: [
    { min: 0, max: 55867, rate: 0.15 },
    { min: 55867, max: 111733, rate: 0.205 },
    { min: 111733, max: 173205, rate: 0.26 },
    { min: 173205, max: 246752, rate: 0.29 },
    { min: 246752, max: Infinity, rate: 0.33 },
  ],
  basicPersonalAmount: 15705,
};

/**
 * Federal Tax Brackets (2025) - Indexed for inflation (~2.7%)
 * @see docs/source-of-truth/04-tax-engine.md - Federal Tax Brackets
 */
export const FEDERAL_TAX_2025: TaxTable = {
  year: 2025,
  jurisdiction: 'federal',
  brackets: [
    { min: 0, max: 57375, rate: 0.145 },
    { min: 57375, max: 114750, rate: 0.205 },
    { min: 114750, max: 177882, rate: 0.26 },
    { min: 177882, max: 253414, rate: 0.29 },
    { min: 253414, max: Infinity, rate: 0.33 },
  ],
  basicPersonalAmount: 16129,
};

/**
 * Federal Tax Brackets (2026)
 *
 * Bracket thresholds = 2025 thresholds indexed by the 2.0% federal indexation
 * factor, rounded to the nearest dollar (CRA convention):
 *   57375×1.02→58522, 114750×1.02→117045, 177882×1.02→181440, 253414×1.02→258482.
 * Cross-check: the third/fifth indexed thresholds (181440 / 258482) land exactly
 * on the doc-19 BPA phase-out start/end anchors, corroborating the factor.
 * Lowest rate 0.14 per #2026-fed-lowest-rate (already correct, unchanged).
 * BPA = max value 16452 (16129×1.02→16452, matches the doc exactly). The engine
 * does not model the high-income BPA phase-out (16452→14829 between $181,440 and
 * $258,482); only the max value is fixed here per audit scope (no new mechanics).
 *
 * @see docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-fed-indexation
 * @see docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-fed-lowest-rate
 * @see docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-fed-bpa-max
 * @see docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-fed-bpa-phaseout-start
 * @see docs/source-of-truth/04-tax-engine.md - Federal Tax Brackets
 */
export const FEDERAL_TAX_2026: TaxTable = {
  year: 2026,
  jurisdiction: 'federal',
  brackets: [
    { min: 0, max: 58522, rate: 0.14 },
    { min: 58522, max: 117045, rate: 0.205 },
    { min: 117045, max: 181440, rate: 0.26 },
    { min: 181440, max: 258482, rate: 0.29 },
    { min: 258482, max: Infinity, rate: 0.33 },
  ],
  basicPersonalAmount: 16452,
};

/**
 * Ontario Tax Brackets (2024)
 * @see docs/source-of-truth/04-tax-engine.md - Ontario Section
 */
export const ONTARIO_TAX_2024: TaxTable = {
  year: 2024,
  jurisdiction: 'ON',
  brackets: [
    { min: 0, max: 51446, rate: 0.0505 },
    { min: 51446, max: 102894, rate: 0.0915 },
    { min: 102894, max: 150000, rate: 0.1116 },
    { min: 150000, max: 220000, rate: 0.1216 },
    { min: 220000, max: Infinity, rate: 0.1316 },
  ],
  basicPersonalAmount: 12399,
  eligibleDividendCreditRate: 0.1,
  nonEligibleDividendCreditRate: 0.029863,
};

/**
 * Ontario Tax Brackets (2025) - Indexed for inflation (~2.7%)
 * @see docs/source-of-truth/04-tax-engine.md - Ontario Section
 */
export const ONTARIO_TAX_2025: TaxTable = {
  year: 2025,
  jurisdiction: 'ON',
  brackets: [
    { min: 0, max: 52835, rate: 0.0505 },
    { min: 52835, max: 105672, rate: 0.0915 },
    { min: 105672, max: 154050, rate: 0.1116 },
    { min: 154050, max: 225940, rate: 0.1216 },
    { min: 225940, max: Infinity, rate: 0.1316 },
  ],
  basicPersonalAmount: 12734,
  eligibleDividendCreditRate: 0.1,
  nonEligibleDividendCreditRate: 0.029863,
};

/**
 * Ontario Surtax Thresholds
 * @see docs/source-of-truth/04-tax-engine.md - Ontario Section
 */
export const ONTARIO_SURTAX = {
  tier1Threshold: 5554,
  tier1Rate: 0.2,
  tier2Threshold: 7108,
  tier2Rate: 0.36,
} as const;

/**
 * British Columbia Tax Brackets (2024)
 * @see docs/source-of-truth/04-tax-engine.md - British Columbia Section
 */
export const BC_TAX_2024: TaxTable = {
  year: 2024,
  jurisdiction: 'BC',
  brackets: [
    { min: 0, max: 47937, rate: 0.0506 },
    { min: 47937, max: 95875, rate: 0.077 },
    { min: 95875, max: 110076, rate: 0.105 },
    { min: 110076, max: 133664, rate: 0.1229 },
    { min: 133664, max: 181232, rate: 0.147 },
    { min: 181232, max: Infinity, rate: 0.205 },
  ],
  basicPersonalAmount: 12580,
  eligibleDividendCreditRate: 0.12,
  nonEligibleDividendCreditRate: 0.0196,
};

/**
 * British Columbia Tax Brackets (2025) - Indexed for inflation (~2.7%)
 * @see docs/source-of-truth/04-tax-engine.md - British Columbia Section
 */
export const BC_TAX_2025: TaxTable = {
  year: 2025,
  jurisdiction: 'BC',
  brackets: [
    { min: 0, max: 49231, rate: 0.0506 },
    { min: 49231, max: 98463, rate: 0.077 },
    { min: 98463, max: 113048, rate: 0.105 },
    { min: 113048, max: 137273, rate: 0.1229 },
    { min: 137273, max: 186125, rate: 0.147 },
    { min: 186125, max: Infinity, rate: 0.205 },
  ],
  basicPersonalAmount: 12920,
  eligibleDividendCreditRate: 0.12,
  nonEligibleDividendCreditRate: 0.0196,
};

/**
 * Alberta Tax Brackets (2024)
 * @see docs/source-of-truth/04-tax-engine.md - Alberta Section
 */
export const ALBERTA_TAX_2024: TaxTable = {
  year: 2024,
  jurisdiction: 'AB',
  brackets: [
    { min: 0, max: 148269, rate: 0.1 },
    { min: 148269, max: 177922, rate: 0.12 },
    { min: 177922, max: 237230, rate: 0.13 },
    { min: 237230, max: 355845, rate: 0.14 },
    { min: 355845, max: Infinity, rate: 0.15 },
  ],
  basicPersonalAmount: 21003,
  eligibleDividendCreditRate: 0.0812,
  nonEligibleDividendCreditRate: 0.0218,
};

/**
 * Alberta Tax Brackets (2025) - Indexed for inflation (~2.7%)
 * @see docs/source-of-truth/04-tax-engine.md - Alberta Section
 */
export const ALBERTA_TAX_2025: TaxTable = {
  year: 2025,
  jurisdiction: 'AB',
  brackets: [
    { min: 0, max: 152272, rate: 0.1 },
    { min: 152272, max: 182726, rate: 0.12 },
    { min: 182726, max: 243635, rate: 0.13 },
    { min: 243635, max: 365453, rate: 0.14 },
    { min: 365453, max: Infinity, rate: 0.15 },
  ],
  basicPersonalAmount: 21570,
  eligibleDividendCreditRate: 0.0812,
  nonEligibleDividendCreditRate: 0.0218,
};

/**
 * Quebec Tax Brackets (2024)
 * @see docs/source-of-truth/04-tax-engine.md - Quebec Section
 */
export const QUEBEC_TAX_2024: TaxTable = {
  year: 2024,
  jurisdiction: 'QC',
  brackets: [
    { min: 0, max: 51780, rate: 0.14 },
    { min: 51780, max: 103545, rate: 0.19 },
    { min: 103545, max: 126000, rate: 0.24 },
    { min: 126000, max: Infinity, rate: 0.2575 },
  ],
  basicPersonalAmount: 18056,
  eligibleDividendCreditRate: 0.117,
  nonEligibleDividendCreditRate: 0.0342,
};

/**
 * Quebec Federal Abatement
 * @see docs/source-of-truth/04-tax-engine.md - Quebec special handling
 */
export const QUEBEC_FEDERAL_ABATEMENT = 0.165; // 16.5%

/**
 * Saskatchewan Tax Brackets (2024)
 * @see docs/source-of-truth/04-tax-engine.md - Saskatchewan Section
 */
export const SASKATCHEWAN_TAX_2024: TaxTable = {
  year: 2024,
  jurisdiction: 'SK',
  brackets: [
    { min: 0, max: 52057, rate: 0.105 },
    { min: 52057, max: 148734, rate: 0.125 },
    { min: 148734, max: Infinity, rate: 0.145 },
  ],
  basicPersonalAmount: 18491,
  eligibleDividendCreditRate: 0.11,
  nonEligibleDividendCreditRate: 0.02519,
};

/**
 * Manitoba Tax Brackets (2024)
 * @see docs/source-of-truth/04-tax-engine.md - Manitoba Section
 */
export const MANITOBA_TAX_2024: TaxTable = {
  year: 2024,
  jurisdiction: 'MB',
  brackets: [
    { min: 0, max: 47000, rate: 0.108 },
    { min: 47000, max: 100000, rate: 0.1275 },
    { min: 100000, max: Infinity, rate: 0.174 },
  ],
  basicPersonalAmount: 15780,
  eligibleDividendCreditRate: 0.08,
  nonEligibleDividendCreditRate: 0.007835,
};

/**
 * Nova Scotia Tax Brackets (2024)
 * @see docs/source-of-truth/04-tax-engine.md - Nova Scotia Section
 */
export const NOVA_SCOTIA_TAX_2024: TaxTable = {
  year: 2024,
  jurisdiction: 'NS',
  brackets: [
    { min: 0, max: 29590, rate: 0.0879 },
    { min: 29590, max: 59180, rate: 0.1495 },
    { min: 59180, max: 93000, rate: 0.1667 },
    { min: 93000, max: 150000, rate: 0.175 },
    { min: 150000, max: Infinity, rate: 0.21 },
  ],
  basicPersonalAmount: 8481,
  eligibleDividendCreditRate: 0.0885,
  nonEligibleDividendCreditRate: 0.0299,
};

/**
 * New Brunswick Tax Brackets (2024)
 * @see docs/source-of-truth/04-tax-engine.md - New Brunswick Section
 */
export const NEW_BRUNSWICK_TAX_2024: TaxTable = {
  year: 2024,
  jurisdiction: 'NB',
  brackets: [
    { min: 0, max: 49958, rate: 0.094 },
    { min: 49958, max: 99916, rate: 0.14 },
    { min: 99916, max: 185064, rate: 0.16 },
    { min: 185064, max: Infinity, rate: 0.195 },
  ],
  basicPersonalAmount: 13044,
  eligibleDividendCreditRate: 0.14,
  nonEligibleDividendCreditRate: 0.0275,
};

/**
 * Prince Edward Island Tax Brackets (2024)
 * @see docs/source-of-truth/04-tax-engine.md - PEI Section
 */
export const PEI_TAX_2024: TaxTable = {
  year: 2024,
  jurisdiction: 'PE',
  brackets: [
    { min: 0, max: 32656, rate: 0.0965 },
    { min: 32656, max: 64313, rate: 0.1363 },
    { min: 64313, max: 105000, rate: 0.1665 },
    { min: 105000, max: 140000, rate: 0.18 },
    { min: 140000, max: Infinity, rate: 0.1875 },
  ],
  basicPersonalAmount: 13500,
  eligibleDividendCreditRate: 0.105,
  nonEligibleDividendCreditRate: 0.013,
};

/**
 * Newfoundland and Labrador Tax Brackets (2024)
 * @see docs/source-of-truth/04-tax-engine.md - NL Section
 */
export const NEWFOUNDLAND_TAX_2024: TaxTable = {
  year: 2024,
  jurisdiction: 'NL',
  brackets: [
    { min: 0, max: 43198, rate: 0.087 },
    { min: 43198, max: 86395, rate: 0.145 },
    { min: 86395, max: 154244, rate: 0.158 },
    { min: 154244, max: 215943, rate: 0.178 },
    { min: 215943, max: 275870, rate: 0.198 },
    { min: 275870, max: 551739, rate: 0.208 },
    { min: 551739, max: Infinity, rate: 0.218 },
  ],
  basicPersonalAmount: 10818,
  eligibleDividendCreditRate: 0.063,
  nonEligibleDividendCreditRate: 0.032,
};

/**
 * Yukon Tax Brackets (2024)
 * @see docs/source-of-truth/04-tax-engine.md - Territory Tax Tables
 */
export const YUKON_TAX_2024: TaxTable = {
  year: 2024,
  jurisdiction: 'YT',
  brackets: [
    { min: 0, max: 55867, rate: 0.064 },
    { min: 55867, max: 111733, rate: 0.09 },
    { min: 111733, max: 173205, rate: 0.109 },
    { min: 173205, max: 500000, rate: 0.128 },
    { min: 500000, max: Infinity, rate: 0.15 },
  ],
  basicPersonalAmount: 15705,
  eligibleDividendCreditRate: 0.1202,
  nonEligibleDividendCreditRate: 0.0067,
};

/**
 * Northwest Territories Tax Brackets (2024)
 * @see docs/source-of-truth/04-tax-engine.md - Territory Tax Tables
 */
export const NWT_TAX_2024: TaxTable = {
  year: 2024,
  jurisdiction: 'NT',
  brackets: [
    { min: 0, max: 50597, rate: 0.059 },
    { min: 50597, max: 101198, rate: 0.086 },
    { min: 101198, max: 164525, rate: 0.122 },
    { min: 164525, max: Infinity, rate: 0.1405 },
  ],
  basicPersonalAmount: 16593,
  eligibleDividendCreditRate: 0.115,
  nonEligibleDividendCreditRate: 0.06,
};

/**
 * Nunavut Tax Brackets (2024)
 * @see docs/source-of-truth/04-tax-engine.md - Territory Tax Tables
 */
export const NUNAVUT_TAX_2024: TaxTable = {
  year: 2024,
  jurisdiction: 'NU',
  brackets: [
    { min: 0, max: 53268, rate: 0.04 },
    { min: 53268, max: 106537, rate: 0.07 },
    { min: 106537, max: 173205, rate: 0.09 },
    { min: 173205, max: Infinity, rate: 0.115 },
  ],
  basicPersonalAmount: 17925,
  eligibleDividendCreditRate: 0.0551,
  nonEligibleDividendCreditRate: 0.0261,
};

/**
 * All Provincial Tax Tables (2024)
 */
export const PROVINCIAL_TAX_TABLES_2024: Record<string, TaxTable> = {
  ON: ONTARIO_TAX_2024,
  BC: BC_TAX_2024,
  AB: ALBERTA_TAX_2024,
  QC: QUEBEC_TAX_2024,
  SK: SASKATCHEWAN_TAX_2024,
  MB: MANITOBA_TAX_2024,
  NS: NOVA_SCOTIA_TAX_2024,
  NB: NEW_BRUNSWICK_TAX_2024,
  PE: PEI_TAX_2024,
  NL: NEWFOUNDLAND_TAX_2024,
  YT: YUKON_TAX_2024,
  NT: NWT_TAX_2024,
  NU: NUNAVUT_TAX_2024,
};

/**
 * Quebec Tax Brackets (2025)
 * @see docs/source-of-truth/04-tax-engine.md - Quebec Section
 */
export const QUEBEC_TAX_2025: TaxTable = {
  year: 2025,
  jurisdiction: 'QC',
  brackets: [
    { min: 0, max: 53255, rate: 0.14 },
    { min: 53255, max: 106495, rate: 0.19 },
    { min: 106495, max: 129590, rate: 0.24 },
    { min: 129590, max: Infinity, rate: 0.2575 },
  ],
  basicPersonalAmount: 18571,
  eligibleDividendCreditRate: 0.117,
  nonEligibleDividendCreditRate: 0.0342,
};

/**
 * Saskatchewan Tax Brackets (2025)
 * @see docs/source-of-truth/04-tax-engine.md - Saskatchewan Section
 */
export const SASKATCHEWAN_TAX_2025: TaxTable = {
  year: 2025,
  jurisdiction: 'SK',
  brackets: [
    { min: 0, max: 53463, rate: 0.105 },
    { min: 53463, max: 152750, rate: 0.125 },
    { min: 152750, max: Infinity, rate: 0.145 },
  ],
  basicPersonalAmount: 19491,
  eligibleDividendCreditRate: 0.11,
  nonEligibleDividendCreditRate: 0.02519,
};

/**
 * Manitoba Tax Brackets (2025)
 * Brackets identical to 2024 (frozen per provincial budget)
 * @see docs/source-of-truth/04-tax-engine.md - Manitoba Section
 */
export const MANITOBA_TAX_2025: TaxTable = {
  year: 2025,
  jurisdiction: 'MB',
  brackets: [
    { min: 0, max: 47000, rate: 0.108 },
    { min: 47000, max: 100000, rate: 0.1275 },
    { min: 100000, max: Infinity, rate: 0.174 },
  ],
  basicPersonalAmount: 15780,
  eligibleDividendCreditRate: 0.08,
  nonEligibleDividendCreditRate: 0.007835,
};

/**
 * Nova Scotia Tax Brackets (2025)
 * @see docs/source-of-truth/04-tax-engine.md - Nova Scotia Section
 */
export const NOVA_SCOTIA_TAX_2025: TaxTable = {
  year: 2025,
  jurisdiction: 'NS',
  brackets: [
    { min: 0, max: 30507, rate: 0.0879 },
    { min: 30507, max: 61015, rate: 0.1495 },
    { min: 61015, max: 95883, rate: 0.1667 },
    { min: 95883, max: 154650, rate: 0.175 },
    { min: 154650, max: Infinity, rate: 0.21 },
  ],
  basicPersonalAmount: 11744,
  eligibleDividendCreditRate: 0.0885,
  nonEligibleDividendCreditRate: 0.0299,
};

/**
 * New Brunswick Tax Brackets (2025)
 * @see docs/source-of-truth/04-tax-engine.md - New Brunswick Section
 */
export const NEW_BRUNSWICK_TAX_2025: TaxTable = {
  year: 2025,
  jurisdiction: 'NB',
  brackets: [
    { min: 0, max: 51306, rate: 0.094 },
    { min: 51306, max: 102614, rate: 0.14 },
    { min: 102614, max: 190060, rate: 0.16 },
    { min: 190060, max: Infinity, rate: 0.195 },
  ],
  basicPersonalAmount: 13396,
  eligibleDividendCreditRate: 0.14,
  nonEligibleDividendCreditRate: 0.0275,
};

/**
 * Prince Edward Island Tax Brackets (2025)
 * @see docs/source-of-truth/04-tax-engine.md - PEI Section
 */
export const PEI_TAX_2025: TaxTable = {
  year: 2025,
  jurisdiction: 'PE',
  brackets: [
    { min: 0, max: 33328, rate: 0.095 },
    { min: 33328, max: 64656, rate: 0.1347 },
    { min: 64656, max: 105000, rate: 0.166 },
    { min: 105000, max: 140000, rate: 0.1762 },
    { min: 140000, max: Infinity, rate: 0.19 },
  ],
  basicPersonalAmount: 14650,
  eligibleDividendCreditRate: 0.105,
  nonEligibleDividendCreditRate: 0.013,
};

/**
 * Newfoundland and Labrador Tax Brackets (2025)
 * @see docs/source-of-truth/04-tax-engine.md - NL Section
 */
export const NEWFOUNDLAND_TAX_2025: TaxTable = {
  year: 2025,
  jurisdiction: 'NL',
  brackets: [
    { min: 0, max: 44192, rate: 0.087 },
    { min: 44192, max: 88382, rate: 0.145 },
    { min: 88382, max: 157792, rate: 0.158 },
    { min: 157792, max: 220910, rate: 0.178 },
    { min: 220910, max: 282214, rate: 0.198 },
    { min: 282214, max: 564429, rate: 0.208 },
    { min: 564429, max: 1128858, rate: 0.213 },
    { min: 1128858, max: Infinity, rate: 0.218 },
  ],
  basicPersonalAmount: 11067,
  eligibleDividendCreditRate: 0.063,
  nonEligibleDividendCreditRate: 0.032,
};

/**
 * Yukon Tax Brackets (2025)
 * @see docs/source-of-truth/04-tax-engine.md - Territory Tax Tables
 */
export const YUKON_TAX_2025: TaxTable = {
  year: 2025,
  jurisdiction: 'YT',
  brackets: [
    { min: 0, max: 57375, rate: 0.064 },
    { min: 57375, max: 114750, rate: 0.09 },
    { min: 114750, max: 177882, rate: 0.109 },
    { min: 177882, max: 500000, rate: 0.128 },
    { min: 500000, max: Infinity, rate: 0.15 },
  ],
  basicPersonalAmount: 16129,
  eligibleDividendCreditRate: 0.1202,
  nonEligibleDividendCreditRate: 0.0067,
};

/**
 * Northwest Territories Tax Brackets (2025)
 * @see docs/source-of-truth/04-tax-engine.md - Territory Tax Tables
 */
export const NWT_TAX_2025: TaxTable = {
  year: 2025,
  jurisdiction: 'NT',
  brackets: [
    { min: 0, max: 51964, rate: 0.059 },
    { min: 51964, max: 103930, rate: 0.086 },
    { min: 103930, max: 168967, rate: 0.122 },
    { min: 168967, max: Infinity, rate: 0.1405 },
  ],
  basicPersonalAmount: 17042,
  eligibleDividendCreditRate: 0.115,
  nonEligibleDividendCreditRate: 0.06,
};

/**
 * Nunavut Tax Brackets (2025)
 * @see docs/source-of-truth/04-tax-engine.md - Territory Tax Tables
 */
export const NUNAVUT_TAX_2025: TaxTable = {
  year: 2025,
  jurisdiction: 'NU',
  brackets: [
    { min: 0, max: 54707, rate: 0.04 },
    { min: 54707, max: 109413, rate: 0.07 },
    { min: 109413, max: 177882, rate: 0.09 },
    { min: 177882, max: Infinity, rate: 0.115 },
  ],
  basicPersonalAmount: 18410,
  eligibleDividendCreditRate: 0.0551,
  nonEligibleDividendCreditRate: 0.0261,
};

/**
 * All Provincial Tax Tables (2025)
 */
export const PROVINCIAL_TAX_TABLES_2025: Record<string, TaxTable> = {
  ON: ONTARIO_TAX_2025,
  BC: BC_TAX_2025,
  AB: ALBERTA_TAX_2025,
  QC: QUEBEC_TAX_2025,
  SK: SASKATCHEWAN_TAX_2025,
  MB: MANITOBA_TAX_2025,
  NS: NOVA_SCOTIA_TAX_2025,
  NB: NEW_BRUNSWICK_TAX_2025,
  PE: PEI_TAX_2025,
  NL: NEWFOUNDLAND_TAX_2025,
  YT: YUKON_TAX_2025,
  NT: NWT_TAX_2025,
  NU: NUNAVUT_TAX_2025,
};

/**
 * All Provincial Tax Tables (2026)
 *
 * DOC GAP — carried forward from 2025. Source-of-truth doc 19
 * (19-benefits-tax-credits-2026.md §5) tables provincial AGE AMOUNTS, PENSION
 * INCOME AMOUNTS, and DTC BASES for 2026, but does NOT publish 2026 provincial
 * tax BRACKETS, RATES, BPAs, or SURTAX thresholds for any province. Doc 04
 * (04-tax-engine.md) only carries provincial brackets/BPA for 2024. With no
 * authoritative 2026 provincial bracket/BPA values available, every province's
 * 2025 table is carried forward verbatim here (year stamp updated to 2026).
 *
 * These carried-forward 2026 tables are the BASE for the calculation-engine's
 * inflation-extrapolation path (tax/indexing.ts buildTaxYearParams): years
 * beyond 2026 scale these thresholds/BPAs by the projection inflation rate, so
 * long-horizon provincial tax no longer freezes at 2025 thresholds in
 * perpetuity (the A-10 defect). 2026 itself equals the 2025 figures until the
 * authoritative 2026 provincial bracket/BPA values are published.
 *
 * @see docs/audit/AUDIT-2026-06-10.internal.md A-10
 * @see docs/source-of-truth/19-benefits-tax-credits-2026.md §5 (credits only; no brackets)
 */
export const PROVINCIAL_TAX_TABLES_2026: Record<string, TaxTable> = {
  // TODO: doc 19 lacks 2026 brackets/BPA for ON — carried 2025 forward
  ON: { ...ONTARIO_TAX_2025, year: 2026 },
  // TODO: doc 19 lacks 2026 brackets/BPA for BC — carried 2025 forward
  BC: { ...BC_TAX_2025, year: 2026 },
  // TODO: doc 19 lacks 2026 brackets/BPA for AB — carried 2025 forward
  AB: { ...ALBERTA_TAX_2025, year: 2026 },
  // TODO: doc 19 lacks 2026 brackets/BPA for QC — carried 2025 forward
  QC: { ...QUEBEC_TAX_2025, year: 2026 },
  // TODO: doc 19 lacks 2026 brackets/BPA for SK — carried 2025 forward
  SK: { ...SASKATCHEWAN_TAX_2025, year: 2026 },
  // TODO: doc 19 lacks 2026 brackets/BPA for MB — carried 2025 forward
  MB: { ...MANITOBA_TAX_2025, year: 2026 },
  // TODO: doc 19 lacks 2026 brackets/BPA for NS — carried 2025 forward
  NS: { ...NOVA_SCOTIA_TAX_2025, year: 2026 },
  // TODO: doc 19 lacks 2026 brackets/BPA for NB — carried 2025 forward
  NB: { ...NEW_BRUNSWICK_TAX_2025, year: 2026 },
  // TODO: doc 19 lacks 2026 brackets/BPA for PE — carried 2025 forward
  PE: { ...PEI_TAX_2025, year: 2026 },
  // TODO: doc 19 lacks 2026 brackets/BPA for NL — carried 2025 forward
  NL: { ...NEWFOUNDLAND_TAX_2025, year: 2026 },
  // TODO: doc 19 lacks 2026 brackets/BPA for YT — carried 2025 forward
  YT: { ...YUKON_TAX_2025, year: 2026 },
  // TODO: doc 19 lacks 2026 brackets/BPA for NT — carried 2025 forward
  NT: { ...NWT_TAX_2025, year: 2026 },
  // TODO: doc 19 lacks 2026 brackets/BPA for NU — carried 2025 forward
  NU: { ...NUNAVUT_TAX_2025, year: 2026 },
};

/**
 * Get provincial tax tables for a given year
 * Falls back to 2024 tables for earlier years
 */
export function getProvincialTaxTables(year: number): Record<string, TaxTable> {
  if (year >= 2026) return PROVINCIAL_TAX_TABLES_2026;
  if (year >= 2025) return PROVINCIAL_TAX_TABLES_2025;
  return PROVINCIAL_TAX_TABLES_2024;
}

/**
 * Age Credit Parameters
 * @see docs/source-of-truth/04-tax-engine.md - Age Credit Section
 */
export const AGE_CREDIT_2024 = {
  federal: {
    ageAmount: 8790,
    incomeThreshold: 44325,
    reductionRate: 0.15,
    creditRate: 0.15,
  },
  ON: {
    ageAmount: 6026,
    incomeThreshold: 44325,
    reductionRate: 0.15,
    creditRate: 0.0505,
  },
  BC: {
    ageAmount: 6090,
    incomeThreshold: 42723,
    reductionRate: 0.15,
    creditRate: 0.0506,
  },
  NL: {
    ageAmount: 6905,
    incomeThreshold: 37842,
    reductionRate: 0.15,
    creditRate: 0.087,
  },
  NS: {
    // ageAmount 4141 = $2,676 base + $1,465 low-income supplement (2024-only;
    // supplement eliminated in 2025 — do not copy this number into AGE_CREDIT_2025).
    ageAmount: 4141,
    incomeThreshold: 30828,
    reductionRate: 0.15,
    creditRate: 0.0879,
  },
  NB: {
    ageAmount: 5878,
    incomeThreshold: 43763,
    reductionRate: 0.15,
    creditRate: 0.094,
  },
  PE: {
    ageAmount: 5595,
    incomeThreshold: 33740,
    reductionRate: 0.15,
    creditRate: 0.0965,
  },
  MB: {
    ageAmount: 3728,
    incomeThreshold: 27749,
    reductionRate: 0.15,
    creditRate: 0.108,
  },
  SK: {
    // Indexation cross-check: 5380 (2023) × 1.047 = 5632.86 → 5633.
    ageAmount: 5633,
    incomeThreshold: 41933,
    reductionRate: 0.15,
    creditRate: 0.105,
  },
  YT: {
    // Yukon tracks federal age amount, threshold, and pension amount for 2024.
    ageAmount: 8790,
    incomeThreshold: 44325,
    reductionRate: 0.15,
    creditRate: 0.064,
  },
  NT: {
    // Single-source (TaxTips.ca 2024 base credits table); CRA 5012-PC blocks
    // automated fetch. Indexation pattern + lowest rate (5.9%) corroborated.
    ageAmount: 8498,
    incomeThreshold: 44324,
    reductionRate: 0.15,
    creditRate: 0.059,
  },
  NU: {
    // Highest provincial age amount in Canada for 2024. Single-source
    // (TaxTips.ca); CRA 5014-PC blocks automated fetch.
    ageAmount: 11980,
    incomeThreshold: 44325,
    reductionRate: 0.15,
    creditRate: 0.04,
  },
} as const;

/**
 * Pension Income Credit Parameters
 * @see docs/source-of-truth/04-tax-engine.md - Pension Income Credit
 */
export const PENSION_INCOME_CREDIT_2024 = {
  federal: {
    maxAmount: 2000,
    creditRate: 0.15,
    maxCredit: 300,
  },
  ON: {
    maxAmount: 1671,
    creditRate: 0.0505,
  },
  BC: {
    maxAmount: 1000,
    creditRate: 0.0506,
  },
  NL: {
    maxAmount: 1000,
    creditRate: 0.087,
  },
  NS: {
    maxAmount: 1173,
    creditRate: 0.0879,
  },
  NB: {
    maxAmount: 1000,
    creditRate: 0.094,
  },
  PE: {
    maxAmount: 1000,
    creditRate: 0.0965,
  },
  MB: {
    maxAmount: 1000,
    creditRate: 0.108,
  },
  SK: {
    maxAmount: 1000,
    creditRate: 0.105,
  },
  YT: {
    // Yukon tracks federal $2,000 pension amount.
    maxAmount: 2000,
    creditRate: 0.064,
  },
  NT: {
    maxAmount: 1000,
    creditRate: 0.059,
  },
  NU: {
    // Nunavut tracks federal $2,000 pension amount.
    maxAmount: 2000,
    creditRate: 0.04,
  },
} as const;

/**
 * Quebec Age, Retirement Income, and Living-Alone Credit (AREL) — 2024
 *
 * Structural divergence from AGE_CREDIT/PENSION_INCOME_CREDIT: QC folds the
 * age amount (65+), the retirement-income amount, and a living-alone amount
 * into a single combined credit with a unified family-net-income phase-out.
 * Formula per Revenu Québec guide TP-752.0.14:
 *   base     = (age >= 65 ? ageAmount : 0)
 *            + min(eligiblePensionIncome, retirementIncomeAmount)
 *            + (livesAlone ? livingAloneAmount : 0)   // DEFERRED — see below
 *   phaseOut = max(0, (netIncome - threshold) * reductionRate)
 *   credit   = max(0, base - phaseOut) * creditRate
 *
 * livingAloneAmount is defined here for completeness but is NOT yet wired
 * into the engine — there is no maritalStatus / livesAlone input surface
 * in the current profile model. Deferred to a later slice; reconciliation
 * with the maritalStatus plumbing is a pre-M003-close follow-up.
 *
 * Provenance: TaxTips.ca Quebec 2024 non-refundable credit table cross-
 * checked against Revenu Québec guide TP-752.0.14 / IN-112. creditRate
 * (0.14) is Quebec's lowest bracket rate (2024). CRA PDOC has no Quebec
 * support; Revenu Québec's own calculator is the third-party parity
 * target and its reconciliation is deferred per M003 autonomous-run
 * contingency.
 *
 * @see docs/source-of-truth/04-tax-engine.md - Quebec AREL credit
 */
export const AREL_2024 = {
  QC: {
    ageAmount: 3614,
    retirementIncomeAmount: 3017,
    livingAloneAmount: 2128, // DEFERRED — no livesAlone input surface yet
    threshold: 38945,
    reductionRate: 0.1875,
    creditRate: 0.14,
  },
} as const;

/**
 * Age Credit Parameters (2026)
 *
 * Age-amount and federal-threshold DOLLAR values are updated to the doc-19
 * 2026 figures (§5 provincial age-amount table + §3 federal age-amount
 * anchors). Per-province phase-out incomeThreshold and reductionRate are a
 * DOC GAP — doc 19 §5 gives only an approximate intro note ("ON ~$45,522,
 * BC ~$40,000, AB ~$45,000") and no anchored per-province thresholds or
 * reduction rates, so those are carried forward verbatim from AGE_CREDIT_2024.
 * creditRate is each province's lowest-bracket rate (unchanged from 2025).
 *
 * Federal: ageAmount 9208 (#2026-fed-age-amount), incomeThreshold 45522
 * (#2026-fed-age-amount-phaseout-start, doc value ~$45,522). The federal
 * non-refundable credit rate dropped to 14% in 2026 (#2026-fed-lowest-rate);
 * the engine derives that rate from the federal bracket table, so creditRate
 * here stays the structural 0.15 marker the engine divides out (see
 * federal-tax.ts getFederalNonRefundableCreditRate / creditRate-ratio math).
 *
 * @see docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-fed-age-amount
 * @see docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-fed-age-amount-phaseout-start
 * @see docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-bc-age-amount
 * @see docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-on-age-amount
 * @see docs/source-of-truth/04-tax-engine.md - Age Credit Section
 */
export const AGE_CREDIT_2026 = {
  federal: {
    // #2026-fed-age-amount = $9,208; threshold #2026-fed-age-amount-phaseout-start ≈ $45,522.
    ageAmount: 9208,
    incomeThreshold: 45522,
    reductionRate: 0.15,
    creditRate: 0.15,
  },
  ON: {
    // #2026-on-age-amount = $6,342. threshold/reductionRate carried from 2024 (DOC GAP).
    ageAmount: 6342,
    incomeThreshold: 44325,
    reductionRate: 0.15,
    creditRate: 0.0505,
  },
  BC: {
    // #2026-bc-age-amount = $5,824. threshold/reductionRate carried from 2024 (DOC GAP).
    ageAmount: 5824,
    incomeThreshold: 42723,
    reductionRate: 0.15,
    creditRate: 0.0506,
  },
  AB: {
    // #2026-ab-age-amount = $6,151. threshold ~$45,000 per doc-19 §5 intro note
    // (approximate, not anchored) → use the federal threshold as a stand-in (DOC GAP).
    ageAmount: 6151,
    incomeThreshold: 45522,
    reductionRate: 0.15,
    creditRate: 0.1,
  },
  NL: {
    // #2026-nl-age-amount = $7,109 (1.1% indexation 2026). threshold/reductionRate carried (DOC GAP).
    ageAmount: 7109,
    incomeThreshold: 37842,
    reductionRate: 0.15,
    creditRate: 0.087,
  },
  NS: {
    // #2026-ns-age-amount = $4,141. threshold/reductionRate carried from 2024 (DOC GAP).
    ageAmount: 4141,
    incomeThreshold: 30828,
    reductionRate: 0.15,
    creditRate: 0.0879,
  },
  NB: {
    // #2026-nb-age-amount = $5,978. threshold/reductionRate carried from 2024 (DOC GAP).
    ageAmount: 5978,
    incomeThreshold: 43763,
    reductionRate: 0.15,
    creditRate: 0.094,
  },
  PE: {
    // #2026-pe-age-amount = $4,679. threshold/reductionRate carried from 2024 (DOC GAP).
    ageAmount: 4679,
    incomeThreshold: 33740,
    reductionRate: 0.15,
    creditRate: 0.0965,
  },
  MB: {
    // #2026-mb-age-amount = $3,728 (not indexed since 2025). threshold/reductionRate carried (DOC GAP).
    ageAmount: 3728,
    incomeThreshold: 27749,
    reductionRate: 0.15,
    creditRate: 0.108,
  },
  SK: {
    // #2026-sk-age-amount = $5,727 (federal-style indexation). threshold/reductionRate carried (DOC GAP).
    ageAmount: 5727,
    incomeThreshold: 41933,
    reductionRate: 0.15,
    creditRate: 0.105,
  },
  YT: {
    // #2026-yt-age-amount = follows federal $9,208. threshold/reductionRate carried (DOC GAP).
    ageAmount: 9208,
    incomeThreshold: 45522,
    reductionRate: 0.15,
    creditRate: 0.064,
  },
  NT: {
    // #2026-nt-age-amount = $7,956 (2.0% indexation 2026). threshold/reductionRate carried (DOC GAP).
    ageAmount: 7956,
    incomeThreshold: 44324,
    reductionRate: 0.15,
    creditRate: 0.059,
  },
  NU: {
    // #2026-nu-age-amount = $14,068 (highest in Canada). threshold/reductionRate carried (DOC GAP).
    ageAmount: 14068,
    incomeThreshold: 45522,
    reductionRate: 0.15,
    creditRate: 0.04,
  },
} as const;

/**
 * Pension Income Credit Parameters (2026)
 *
 * maxAmount DOLLAR values updated to doc-19 §5 provincial pension-income
 * amounts. creditRate is each province's lowest-bracket rate (unchanged from
 * 2025). Provinces not enumerated in doc-19 §5 keep the $1,000 default the
 * engine already falls back to.
 *
 * @see docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-on-pension-income-amount
 * @see docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-ab-pension-income-amount
 * @see docs/source-of-truth/04-tax-engine.md - Pension Income Credit
 */
export const PENSION_INCOME_CREDIT_2026 = {
  federal: {
    // #2026-fed-pension-income-amount = $2,000 (unchanged base; value @14% = $280).
    maxAmount: 2000,
    creditRate: 0.15,
    maxCredit: 300,
  },
  ON: {
    // #2026-on-pension-income-amount = $1,796.
    maxAmount: 1796,
    creditRate: 0.0505,
  },
  BC: {
    // #2026-bc-pension-income-amount = $1,000.
    maxAmount: 1000,
    creditRate: 0.0506,
  },
  AB: {
    // #2026-ab-pension-income-amount = $1,667.
    maxAmount: 1667,
    creditRate: 0.1,
  },
  NL: {
    // #2026-nl-pension-income-amount = $1,000.
    maxAmount: 1000,
    creditRate: 0.087,
  },
  NS: {
    // #2026-ns-pension-income-amount = $1,173.
    maxAmount: 1173,
    creditRate: 0.0879,
  },
  NB: {
    // #2026-nb-pension-income-amount = $1,000.
    maxAmount: 1000,
    creditRate: 0.094,
  },
  PE: {
    // #2026-pe-pension-income-amount = $1,000.
    maxAmount: 1000,
    creditRate: 0.0965,
  },
  MB: {
    // #2026-mb-pension-income-amount = $1,000.
    maxAmount: 1000,
    creditRate: 0.108,
  },
  SK: {
    // #2026-sk-pension-income-amount = $1,000.
    maxAmount: 1000,
    creditRate: 0.105,
  },
  YT: {
    // #2026-yt-pension-income-amount = follows federal $2,000.
    maxAmount: 2000,
    creditRate: 0.064,
  },
  NT: {
    // #2026-nt-pension-income-amount = $1,000.
    maxAmount: 1000,
    creditRate: 0.059,
  },
  NU: {
    // #2026-nu-pension-income-amount = $2,000.
    maxAmount: 2000,
    creditRate: 0.04,
  },
} as const;

/**
 * Quebec Age, Retirement Income, and Living-Alone Credit (AREL) — 2026
 *
 * Dollar amounts updated to doc-19 §5 Quebec figures: ageAmount $3,470,
 * retirementIncomeAmount (Quebec pension amount) $3,470, living-alone (age-65)
 * supplement $1,225. creditRate 14% per doc-19 §5 (Quebec lowest bracket rate,
 * Schedule B). threshold/reductionRate are a DOC GAP — doc 19 does not table
 * the 2026 AREL family-net-income phase-out threshold or reduction rate, so
 * both are carried forward from AREL_2024. livingAloneAmount remains DEFERRED
 * (no livesAlone input surface in the engine).
 *
 * @see docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-qc-age-amount
 * @see docs/source-of-truth/19-benefits-tax-credits-2026.md#2026-qc-pension-income-amount
 * @see docs/source-of-truth/04-tax-engine.md - Quebec AREL credit
 */
export const AREL_2026 = {
  QC: {
    ageAmount: 3470, // #2026-qc-age-amount
    retirementIncomeAmount: 3470, // #2026-qc-pension-income-amount
    livingAloneAmount: 1225, // #2026-qc-age-amount living-alone supplement; DEFERRED
    threshold: 38945, // DOC GAP — carried from AREL_2024
    reductionRate: 0.1875, // DOC GAP — carried from AREL_2024
    creditRate: 0.14,
  },
} as const;

/**
 * Structural shapes for the year-aware credit accessors. The 2024 and 2026
 * tables share a per-province shape but differ in which provinces they
 * enumerate (2026 adds AB), so the accessors return an indexable record rather
 * than `typeof <const>` to keep every enumerated province honestly accessible.
 */
export interface AgeCreditEntry {
  ageAmount: number;
  incomeThreshold: number;
  reductionRate: number;
  creditRate: number;
}
export interface PensionCreditEntry {
  maxAmount: number;
  creditRate: number;
  maxCredit?: number;
}
export interface ARELEntry {
  ageAmount: number;
  retirementIncomeAmount: number;
  livingAloneAmount: number;
  threshold: number;
  reductionRate: number;
  creditRate: number;
}

/**
 * Year-aware accessors for credit tables. 2026+ returns the doc-19 2026 set;
 * earlier years return the 2024 set (the only prior-tabled credit set).
 */
export function getAgeCreditTable(year: number): Record<string, AgeCreditEntry> {
  if (year >= 2026) return AGE_CREDIT_2026;
  return AGE_CREDIT_2024;
}

export function getPensionIncomeCreditTable(year: number): Record<string, PensionCreditEntry> {
  if (year >= 2026) return PENSION_INCOME_CREDIT_2026;
  return PENSION_INCOME_CREDIT_2024;
}

export function getARELTable(year: number): { QC: ARELEntry } {
  if (year >= 2026) return AREL_2026;
  return AREL_2024;
}
