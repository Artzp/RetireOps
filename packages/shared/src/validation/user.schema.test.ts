/**
 * User Profile Validation Schema Tests
 * @see docs/source-of-truth/01-user-profile.md
 */
import { describe, it, expect } from 'vitest';
import {
  userProfileSchema,
  spouseProfileSchema,
  householdProfileSchema,
  provinceSchema,
  maritalStatusSchema,
} from './user.schema.js';

describe('User Profile Validation Schemas', () => {
  describe('provinceSchema', () => {
    it('should accept valid province codes', () => {
      expect(provinceSchema.parse('ON')).toBe('ON');
      expect(provinceSchema.parse('BC')).toBe('BC');
      expect(provinceSchema.parse('AB')).toBe('AB');
      expect(provinceSchema.parse('QC')).toBe('QC');
    });

    it('should reject invalid province codes', () => {
      expect(() => provinceSchema.parse('XX')).toThrow();
      expect(() => provinceSchema.parse('Ontario')).toThrow();
      expect(() => provinceSchema.parse('')).toThrow();
    });
  });

  describe('maritalStatusSchema', () => {
    it('should accept valid marital statuses', () => {
      expect(maritalStatusSchema.parse('single')).toBe('single');
      expect(maritalStatusSchema.parse('married')).toBe('married');
      expect(maritalStatusSchema.parse('common_law')).toBe('common_law');
    });

    it('should reject invalid marital statuses', () => {
      expect(() => maritalStatusSchema.parse('divorced')).toThrow();
      expect(() => maritalStatusSchema.parse('')).toThrow();
    });
  });

  describe('userProfileSchema', () => {
    const validProfile = {
      birthdate: new Date(1970, 0, 1),
      province: 'ON',
      maritalStatus: 'single',
      lifeExpectancy: 90,
      plannedRetirementAge: 65,
    };

    it('should accept valid user profile', () => {
      const result = userProfileSchema.parse(validProfile);
      expect(result.province).toBe('ON');
      expect(result.maritalStatus).toBe('single');
      expect(result.lifeExpectancy).toBe(90);
      expect(result.plannedRetirementAge).toBe(65);
    });

    it('should coerce date strings to Date objects', () => {
      const result = userProfileSchema.parse({
        ...validProfile,
        birthdate: '1970-01-01',
      });
      expect(result.birthdate).toBeInstanceOf(Date);
    });

    it('should apply default life expectancy', () => {
      const { lifeExpectancy: _, ...profileWithoutLifeExpectancy } = validProfile;
      const result = userProfileSchema.parse(profileWithoutLifeExpectancy);
      expect(result.lifeExpectancy).toBe(95);
    });

    it('should reject user under 18 years old', () => {
      const youngUser = {
        ...validProfile,
        birthdate: new Date(), // Today - too young
      };
      expect(() => userProfileSchema.parse(youngUser)).toThrow('at least 18');
    });

    it('should reject life expectancy below 65', () => {
      expect(() =>
        userProfileSchema.parse({
          ...validProfile,
          lifeExpectancy: 60,
        })
      ).toThrow('at least 65');
    });

    it('should reject life expectancy above 110', () => {
      expect(() =>
        userProfileSchema.parse({
          ...validProfile,
          lifeExpectancy: 120,
        })
      ).toThrow('cannot exceed 110');
    });

    it('should reject retirement age below 18', () => {
      expect(() =>
        userProfileSchema.parse({
          ...validProfile,
          plannedRetirementAge: 15,
        })
      ).toThrow('at least 18');
    });

    it('should reject retirement age above 75', () => {
      expect(() =>
        userProfileSchema.parse({
          ...validProfile,
          plannedRetirementAge: 80,
        })
      ).toThrow('cannot exceed 75');
    });

    it('should reject retirement age earlier than current age', () => {
      expect(() =>
        userProfileSchema.parse({
          ...validProfile,
          birthdate: new Date(1960, 0, 1), // ~64 years old
          plannedRetirementAge: 55, // Already passed
        })
      ).toThrow('earlier than current age');
    });

    it('should reject life expectancy not greater than retirement age', () => {
      expect(() =>
        userProfileSchema.parse({
          ...validProfile,
          lifeExpectancy: 65,
          plannedRetirementAge: 65,
        })
      ).toThrow('greater than retirement age');
    });
  });

  describe('spouseProfileSchema', () => {
    const validSpouse = {
      birthdate: new Date(1972, 5, 15),
      lifeExpectancy: 92,
      plannedRetirementAge: 63,
    };

    it('should accept valid spouse profile', () => {
      const result = spouseProfileSchema.parse(validSpouse);
      expect(result.birthdate).toBeInstanceOf(Date);
      expect(result.lifeExpectancy).toBe(92);
      expect(result.plannedRetirementAge).toBe(63);
    });

    it('should apply default life expectancy', () => {
      const { lifeExpectancy: _, ...spouseWithoutLifeExpectancy } = validSpouse;
      const result = spouseProfileSchema.parse(spouseWithoutLifeExpectancy);
      expect(result.lifeExpectancy).toBe(95);
    });
  });

  describe('householdProfileSchema', () => {
    const validPrimary = {
      birthdate: new Date(1970, 0, 1),
      province: 'ON',
      maritalStatus: 'single',
      lifeExpectancy: 90,
      plannedRetirementAge: 65,
    };

    const validSpouse = {
      birthdate: new Date(1972, 5, 15),
      lifeExpectancy: 92,
      plannedRetirementAge: 63,
    };

    it('should accept single person without spouse', () => {
      const result = householdProfileSchema.parse({
        primary: validPrimary,
      });
      expect(result.primary.maritalStatus).toBe('single');
      expect(result.spouse).toBeUndefined();
    });

    it('should accept married person with spouse', () => {
      const result = householdProfileSchema.parse({
        primary: { ...validPrimary, maritalStatus: 'married' },
        spouse: validSpouse,
      });
      expect(result.primary.maritalStatus).toBe('married');
      expect(result.spouse).toBeDefined();
    });

    it('should accept common-law with spouse', () => {
      const result = householdProfileSchema.parse({
        primary: { ...validPrimary, maritalStatus: 'common_law' },
        spouse: validSpouse,
      });
      expect(result.primary.maritalStatus).toBe('common_law');
      expect(result.spouse).toBeDefined();
    });

    it('should require spouse for married status', () => {
      expect(() =>
        householdProfileSchema.parse({
          primary: { ...validPrimary, maritalStatus: 'married' },
        })
      ).toThrow('Spouse profile is required');
    });

    it('should require spouse for common-law status', () => {
      expect(() =>
        householdProfileSchema.parse({
          primary: { ...validPrimary, maritalStatus: 'common_law' },
        })
      ).toThrow('Spouse profile is required');
    });
  });
});
