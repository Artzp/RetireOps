/**
 * User Profile Types
 * @see docs/source-of-truth/01-user-profile.md
 */
import type { ProvinceCode } from './province.js';

export type MaritalStatus = 'single' | 'married' | 'common_law';

export interface UserProfile {
  id: string;
  birthdate: Date;
  province: ProvinceCode;
  maritalStatus: MaritalStatus;
  lifeExpectancy: number;
  plannedRetirementAge: number;
}

export interface SpouseProfile {
  birthdate: Date;
  lifeExpectancy: number;
  plannedRetirementAge: number;
}

export interface HouseholdProfile {
  primary: UserProfile;
  spouse?: SpouseProfile;
}

/**
 * Age-Based Event Triggers
 * @see docs/source-of-truth/01-user-profile.md - Age-Based Event Triggers
 */
export const AGE_MILESTONES = {
  CPP_EARLIEST: 60,
  CPP_STANDARD: 65,
  CPP_LATEST: 70,
  OAS_EARLIEST: 65,
  OAS_LATEST: 70,
  AGE_CREDIT_ELIGIBLE: 65,
  PENSION_SPLITTING_ELIGIBLE: 65,
  RRSP_CONTRIBUTION_DEADLINE_AGE: 71,
  RRSP_TO_RRIF_CONVERSION_AGE: 71,
  RRIF_MINIMUM_WITHDRAWAL_START_AGE: 72,
} as const;
