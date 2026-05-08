/**
 * Canadian Province and Territory Codes
 * @see docs/source-of-truth/01-user-profile.md
 */
export const PROVINCES = {
  AB: 'Alberta',
  BC: 'British Columbia',
  MB: 'Manitoba',
  NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador',
  NS: 'Nova Scotia',
  NT: 'Northwest Territories',
  NU: 'Nunavut',
  ON: 'Ontario',
  PE: 'Prince Edward Island',
  QC: 'Quebec',
  SK: 'Saskatchewan',
  YT: 'Yukon',
} as const;

export type ProvinceCode = keyof typeof PROVINCES;

export const PROVINCE_CODES = Object.keys(PROVINCES) as ProvinceCode[];

export function isValidProvince(code: string): code is ProvinceCode {
  return code in PROVINCES;
}
