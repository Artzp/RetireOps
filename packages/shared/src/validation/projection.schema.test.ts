/**
 * Projection Input Validation Schema Tests
 * @see docs/source-of-truth/11-development-roadmap.md - Phase 1 Data Inputs
 */
import { describe, it, expect } from 'vitest';
import { projectionInputSchema, scenarioModificationSchema } from './projection.schema.js';

describe('Projection Validation Schemas', () => {
  describe('projectionInputSchema', () => {
    const validInput = {
      birthdate: new Date(1970, 0, 1),
      province: 'ON',
      retirementAge: 65,
      lifeExpectancy: 90,
      employmentIncome: 100000,
      employmentGrowthRate: 0.02,
      rrspBalance: 200000,
      rrspAnnualContribution: 15000,
      tfsaBalance: 80000,
      tfsaAnnualContribution: 7000,
      nonRegBalance: 50000,
      retirementSpending: 55000,
      investmentReturn: 0.05,
      inflationRate: 0.025,
    };

    it('should accept valid projection input', () => {
      const result = projectionInputSchema.parse(validInput);
      expect(result.province).toBe('ON');
      expect(result.retirementAge).toBe(65);
      expect(result.employmentIncome).toBe(100000);
    });

    it('should coerce date strings to Date objects', () => {
      const result = projectionInputSchema.parse({
        ...validInput,
        birthdate: '1970-01-01',
      });
      expect(result.birthdate).toBeInstanceOf(Date);
    });

    it('should apply default values', () => {
      const minimalInput = {
        birthdate: new Date(1970, 0, 1),
        province: 'ON',
        retirementAge: 65,
        employmentIncome: 80000,
        retirementSpending: 50000,
      };
      const result = projectionInputSchema.parse(minimalInput);
      expect(result.lifeExpectancy).toBe(95);
      expect(result.employmentGrowthRate).toBe(0.02);
      expect(result.rrspBalance).toBe(0);
      expect(result.tfsaBalance).toBe(0);
      expect(result.nonRegBalance).toBe(0);
      expect(result.investmentReturn).toBe(0.05);
      expect(result.inflationRate).toBe(0.025);
    });

    it('should accept all valid provinces', () => {
      const provinces = ['ON', 'BC', 'AB', 'QC', 'SK', 'MB', 'NS', 'NB', 'PE', 'NL'];
      for (const province of provinces) {
        const result = projectionInputSchema.parse({
          ...validInput,
          province,
        });
        expect(result.province).toBe(province);
      }
    });

    it('should reject invalid province', () => {
      expect(() =>
        projectionInputSchema.parse({
          ...validInput,
          province: 'XX',
        })
      ).toThrow();
    });

    it('should reject retirement age below 18', () => {
      expect(() =>
        projectionInputSchema.parse({
          ...validInput,
          retirementAge: 15,
        })
      ).toThrow();
    });

    it('should reject retirement age above 75', () => {
      expect(() =>
        projectionInputSchema.parse({
          ...validInput,
          retirementAge: 80,
        })
      ).toThrow();
    });

    it('should reject retirement age earlier than current age', () => {
      expect(() =>
        projectionInputSchema.parse({
          ...validInput,
          birthdate: new Date(1960, 0, 1), // ~64 years old
          retirementAge: 55, // Already passed
        })
      ).toThrow('earlier than current age');
    });

    it('should reject life expectancy not greater than retirement age', () => {
      expect(() =>
        projectionInputSchema.parse({
          ...validInput,
          lifeExpectancy: 65,
          retirementAge: 65,
        })
      ).toThrow('greater than retirement age');
    });

    it('should reject negative employment income', () => {
      expect(() =>
        projectionInputSchema.parse({
          ...validInput,
          employmentIncome: -10000,
        })
      ).toThrow();
    });

    it('should reject negative account balances', () => {
      expect(() =>
        projectionInputSchema.parse({
          ...validInput,
          rrspBalance: -1000,
        })
      ).toThrow();
    });

    it('should reject negative retirement spending', () => {
      expect(() =>
        projectionInputSchema.parse({
          ...validInput,
          retirementSpending: -5000,
        })
      ).toThrow();
    });

    it('should reject investment return above 15%', () => {
      expect(() =>
        projectionInputSchema.parse({
          ...validInput,
          investmentReturn: 0.2,
        })
      ).toThrow();
    });

    it('should reject inflation rate above 10%', () => {
      expect(() =>
        projectionInputSchema.parse({
          ...validInput,
          inflationRate: 0.15,
        })
      ).toThrow();
    });

    it('should accept CPP start age between 60-70', () => {
      const result = projectionInputSchema.parse({
        ...validInput,
        cppStartAge: 60,
      });
      expect(result.cppStartAge).toBe(60);
    });

    it('should accept optional bridge pension fields', () => {
      const result = projectionInputSchema.parse({
        ...validInput,
        pensionIncome: 40000,
        bridgeBenefit: 10000,
        bridgeEndAge: 65,
      });
      expect(result.pensionIncome).toBe(40000);
      expect(result.bridgeBenefit).toBe(10000);
      expect(result.bridgeEndAge).toBe(65);
    });

    it('should reject CPP start age below 60', () => {
      expect(() =>
        projectionInputSchema.parse({
          ...validInput,
          cppStartAge: 55,
        })
      ).toThrow();
    });

    it('should accept OAS start age between 65-70', () => {
      const result = projectionInputSchema.parse({
        ...validInput,
        oasStartAge: 70,
      });
      expect(result.oasStartAge).toBe(70);
    });

    it('should reject OAS start age below 65', () => {
      expect(() =>
        projectionInputSchema.parse({
          ...validInput,
          oasStartAge: 60,
        })
      ).toThrow();
    });

    it('should default CPP start age to 65', () => {
      const result = projectionInputSchema.parse(validInput);
      expect(result.cppStartAge).toBe(65);
    });

    it('should default OAS start age to 65', () => {
      const result = projectionInputSchema.parse(validInput);
      expect(result.oasStartAge).toBe(65);
    });

    // M005/S02 T01: pensionAdjustment + spousalRrspContribution
    it('should accept pensionAdjustment of 0', () => {
      const result = projectionInputSchema.parse({ ...validInput, pensionAdjustment: 0 });
      expect(result.pensionAdjustment).toBe(0);
    });

    it('should accept pensionAdjustment of 10000', () => {
      const result = projectionInputSchema.parse({ ...validInput, pensionAdjustment: 10000 });
      expect(result.pensionAdjustment).toBe(10000);
    });

    it('should accept spousalRrspContribution of 5000', () => {
      const result = projectionInputSchema.parse({
        ...validInput,
        spousalRrspContribution: 5000,
      });
      expect(result.spousalRrspContribution).toBe(5000);
    });

    it('should default pensionAdjustment and spousalRrspContribution to 0 when omitted', () => {
      const result = projectionInputSchema.parse(validInput);
      expect(result.pensionAdjustment).toBe(0);
      expect(result.spousalRrspContribution).toBe(0);
    });

    it('should reject negative pensionAdjustment', () => {
      expect(() => projectionInputSchema.parse({ ...validInput, pensionAdjustment: -1 })).toThrow();
    });

    it('should reject negative spousalRrspContribution', () => {
      expect(() =>
        projectionInputSchema.parse({ ...validInput, spousalRrspContribution: -1 })
      ).toThrow();
    });

    // M005/S04 T01: FHSA input fields
    it('should round-trip FHSA input fields at valid boundaries', () => {
      const result = projectionInputSchema.parse({
        ...validInput,
        fhsaAnnualContribution: 8000,
        fhsaLifetimeContributedSeed: 16000,
      });
      expect(result.fhsaAnnualContribution).toBe(8000);
      expect(result.fhsaLifetimeContributedSeed).toBe(16000);
    });

    it('should accept FHSA seed exactly at the 40000 lifetime cap', () => {
      const result = projectionInputSchema.parse({
        ...validInput,
        fhsaLifetimeContributedSeed: 40000,
      });
      expect(result.fhsaLifetimeContributedSeed).toBe(40000);
    });

    it('should reject negative fhsaAnnualContribution', () => {
      expect(() =>
        projectionInputSchema.parse({ ...validInput, fhsaAnnualContribution: -1 })
      ).toThrow();
    });

    it('should reject fhsaLifetimeContributedSeed above the 40000 lifetime cap', () => {
      expect(() =>
        projectionInputSchema.parse({ ...validInput, fhsaLifetimeContributedSeed: 40001 })
      ).toThrow();
    });
  });

  describe('scenarioModificationSchema', () => {
    it('should accept valid scenario modification', () => {
      const result = scenarioModificationSchema.parse({
        name: 'Retire Early',
        description: 'What if I retire at 60 instead of 65?',
        modifications: {
          retirementAge: 60,
        },
      });
      expect(result.name).toBe('Retire Early');
      expect(result.modifications.retirementAge).toBe(60);
    });

    it('should accept scenario with multiple modifications', () => {
      const result = scenarioModificationSchema.parse({
        name: 'Conservative Growth',
        modifications: {
          investmentReturn: 0.03,
          inflationRate: 0.03,
          retirementSpending: 60000,
        },
      });
      expect(result.modifications.investmentReturn).toBe(0.03);
      expect(result.modifications.inflationRate).toBe(0.03);
      expect(result.modifications.retirementSpending).toBe(60000);
    });

    it('should reject empty name', () => {
      expect(() =>
        scenarioModificationSchema.parse({
          name: '',
          modifications: {},
        })
      ).toThrow();
    });

    it('should accept empty modifications', () => {
      const result = scenarioModificationSchema.parse({
        name: 'Base Case',
        modifications: {},
      });
      expect(result.modifications).toEqual({});
    });
  });

  describe('Real-world projection scenarios', () => {
    it('should validate typical pre-retiree input', () => {
      const input = {
        birthdate: new Date(1969, 5, 15),
        province: 'BC',
        retirementAge: 60,
        lifeExpectancy: 92,
        employmentIncome: 120000,
        employmentGrowthRate: 0.015,
        rrspBalance: 450000,
        rrspAnnualContribution: 25000,
        tfsaBalance: 95000,
        tfsaAnnualContribution: 7000,
        nonRegBalance: 75000,
        retirementSpending: 70000,
        investmentReturn: 0.045,
        inflationRate: 0.02,
        expectedCPPAt65: 13000,
        cppStartAge: 65,
        oasStartAge: 65,
      };
      const result = projectionInputSchema.parse(input);
      expect(result.province).toBe('BC');
      expect(result.retirementAge).toBe(60);
    });

    it('should validate late retirement scenario', () => {
      const input = {
        birthdate: new Date(1960, 0, 1),
        province: 'AB',
        retirementAge: 70,
        lifeExpectancy: 95,
        employmentIncome: 90000,
        retirementSpending: 45000,
        cppStartAge: 70,
        oasStartAge: 70,
      };
      const result = projectionInputSchema.parse(input);
      expect(result.retirementAge).toBe(70);
      expect(result.cppStartAge).toBe(70);
      expect(result.oasStartAge).toBe(70);
    });

    it('should validate minimal savings scenario', () => {
      const input = {
        birthdate: new Date(1975, 3, 20),
        province: 'QC',
        retirementAge: 67,
        employmentIncome: 55000,
        retirementSpending: 35000,
        rrspBalance: 25000,
        tfsaBalance: 10000,
      };
      const result = projectionInputSchema.parse(input);
      expect(result.rrspBalance).toBe(25000);
      expect(result.tfsaBalance).toBe(10000);
    });
  });
});
