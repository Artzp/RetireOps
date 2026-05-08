/**
 * Date Utilities
 * @see docs/source-of-truth/01-user-profile.md - VR-PROFILE-001: Age Calculation
 */

/**
 * Calculate age from birthdate
 * @see docs/source-of-truth/01-user-profile.md - VR-PROFILE-001
 */
export function calculateAge(birthdate: Date, asOfDate: Date = new Date()): number {
  const birthYear = birthdate.getFullYear();
  const birthMonth = birthdate.getMonth();
  const birthDay = birthdate.getDate();

  const currentYear = asOfDate.getFullYear();
  const currentMonth = asOfDate.getMonth();
  const currentDay = asOfDate.getDate();

  let age = currentYear - birthYear;

  // Adjust if birthday hasn't occurred yet this year
  if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < birthDay)) {
    age--;
  }

  return age;
}

/**
 * Calculate age at end of a specific year
 */
export function ageAtEndOfYear(birthdate: Date, year: number): number {
  const endOfYear = new Date(year, 11, 31);
  return calculateAge(birthdate, endOfYear);
}

/**
 * Get retirement year based on birthdate and retirement age
 */
export function getRetirementYear(birthdate: Date, retirementAge: number): number {
  return birthdate.getFullYear() + retirementAge;
}

/**
 * Check if eligible for OAS (age 65+)
 * @see docs/source-of-truth/05-government-benefits.md - OAS Eligibility
 */
export function isEligibleForOAS(age: number): boolean {
  return age >= 65;
}

/**
 * Check if eligible for CPP (age 60+)
 * @see docs/source-of-truth/05-government-benefits.md - CPP Eligibility
 */
export function isEligibleForCPP(age: number): boolean {
  return age >= 60;
}

/**
 * Check if must convert RRSP to RRIF (end of year turning 71)
 * @see docs/source-of-truth/02-account-types.md - RRSP-007
 */
export function mustConvertToRRIF(age: number): boolean {
  return age >= 71;
}

/**
 * Check if RRIF minimum withdrawal applies (age 72+)
 * @see docs/source-of-truth/02-account-types.md - RRIF-001
 */
export function hasRRIFMinimumWithdrawal(age: number): boolean {
  return age >= 72;
}

/**
 * Get current year
 */
export function getCurrentYear(): number {
  return new Date().getFullYear();
}

/**
 * Get years between two dates
 */
export function getYearsBetween(startDate: Date, endDate: Date): number {
  return endDate.getFullYear() - startDate.getFullYear();
}
