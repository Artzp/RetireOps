/**
 * Sample HouseholdProfile fixtures for buildLongReportData tests.
 *
 * Hand-authored TypeScript `const` declarations — NOT derived at import time
 * from any runtime engine. `@retireops/shared` has zero dependency on
 * `@retireops/calculation-engine`.
 *
 * Used by:
 * - ./single-scenario.ts (singleProfile)
 * - ./couple-scenario.ts (coupleProfile)
 * - ../build-long-report-data.test.ts
 *
 * @see ../../../../../.planning/phases/18-report-data-foundation/18-03-PLAN.md
 */
import type { HouseholdProfile } from '../../types/user.js';

/**
 * Ontario single, retired at 65, life expectancy 90.
 */
export const singleProfile: HouseholdProfile = {
  primary: {
    id: 'profile-single-fixture',
    birthdate: new Date('1961-01-01T00:00:00.000Z'),
    province: 'ON',
    maritalStatus: 'single',
    lifeExpectancy: 90,
    plannedRetirementAge: 65,
  },
};

/**
 * Ontario couple, both retired, with spousal-RRSP scenario relevance.
 * Primary born 1961 (age 65 in 2026), spouse born 1963 (age 63 in 2026).
 */
export const coupleProfile: HouseholdProfile = {
  primary: {
    id: 'profile-couple-primary-fixture',
    birthdate: new Date('1961-01-01T00:00:00.000Z'),
    province: 'ON',
    maritalStatus: 'married',
    lifeExpectancy: 90,
    plannedRetirementAge: 65,
  },
  spouse: {
    birthdate: new Date('1963-06-15T00:00:00.000Z'),
    lifeExpectancy: 92,
    plannedRetirementAge: 65,
  },
};
