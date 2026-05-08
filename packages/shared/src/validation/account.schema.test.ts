/**
 * Account Validation Schema Tests
 * @see docs/source-of-truth/02-account-types.md
 */
import { describe, it, expect } from 'vitest';
import {
  accountTypeSchema,
  baseAccountSchema,
  rrspAccountSchema,
  rrifAccountSchema,
  tfsaAccountSchema,
  nonRegisteredAccountSchema,
  accountSchema,
  validateRRSPContribution,
  validateTFSAContribution,
} from './account.schema.js';

describe('Account Validation Schemas', () => {
  describe('accountTypeSchema', () => {
    it('should accept valid account types', () => {
      expect(accountTypeSchema.parse('rrsp')).toBe('rrsp');
      expect(accountTypeSchema.parse('rrif')).toBe('rrif');
      expect(accountTypeSchema.parse('tfsa')).toBe('tfsa');
      expect(accountTypeSchema.parse('non_registered')).toBe('non_registered');
      expect(accountTypeSchema.parse('lira')).toBe('lira');
      expect(accountTypeSchema.parse('lif')).toBe('lif');
      expect(accountTypeSchema.parse('fhsa')).toBe('fhsa');
    });

    it('should reject invalid account types', () => {
      expect(() => accountTypeSchema.parse('401k')).toThrow();
      expect(() => accountTypeSchema.parse('ira')).toThrow();
      expect(() => accountTypeSchema.parse('')).toThrow();
    });
  });

  describe('baseAccountSchema', () => {
    const validBase = {
      name: 'My RRSP',
      type: 'rrsp',
      balance: 100000,
      owner: 'primary' as const,
    };

    it('should accept valid base account', () => {
      const result = baseAccountSchema.parse(validBase);
      expect(result.name).toBe('My RRSP');
      expect(result.type).toBe('rrsp');
      expect(result.balance).toBe(100000);
      expect(result.owner).toBe('primary');
    });

    it('should accept optional fields', () => {
      const result = baseAccountSchema.parse({
        ...validBase,
        institution: 'TD Bank',
        accountNumber: '12345678',
      });
      expect(result.institution).toBe('TD Bank');
      expect(result.accountNumber).toBe('12345678');
    });

    it('should reject empty name', () => {
      expect(() =>
        baseAccountSchema.parse({
          ...validBase,
          name: '',
        })
      ).toThrow();
    });

    it('should reject negative balance', () => {
      expect(() =>
        baseAccountSchema.parse({
          ...validBase,
          balance: -1000,
        })
      ).toThrow();
    });

    it('should accept zero balance', () => {
      const result = baseAccountSchema.parse({
        ...validBase,
        balance: 0,
      });
      expect(result.balance).toBe(0);
    });

    it('should reject missing owner', () => {
      const { owner: _omitted, ...withoutOwner } = validBase;
      expect(() => baseAccountSchema.parse(withoutOwner)).toThrow();
    });

    it('should reject invalid owner', () => {
      expect(() =>
        baseAccountSchema.parse({
          ...validBase,
          owner: 'joint',
        })
      ).toThrow();
    });
  });

  describe('rrspAccountSchema', () => {
    const validRRSP = {
      name: 'My RRSP',
      type: 'rrsp' as const,
      balance: 200000,
      owner: 'primary' as const,
      contributionRoom: 50000,
    };

    it('should accept valid RRSP account', () => {
      const result = rrspAccountSchema.parse(validRRSP);
      expect(result.type).toBe('rrsp');
      expect(result.balance).toBe(200000);
      expect(result.contributionRoom).toBe(50000);
    });

    it('should default isSpousal to false', () => {
      const result = rrspAccountSchema.parse(validRRSP);
      expect(result.isSpousal).toBe(false);
    });

    it('should accept isSpousal flag (owner=spouse, contributor=primary)', () => {
      const result = rrspAccountSchema.parse({
        ...validRRSP,
        owner: 'spouse',
        isSpousal: true,
        contributor: 'primary',
      });
      expect(result.isSpousal).toBe(true);
    });

    describe('contributor field', () => {
      it('should accept explicit contributor=primary on spousal RRSP (owner=spouse)', () => {
        const result = rrspAccountSchema.parse({
          ...validRRSP,
          owner: 'spouse',
          isSpousal: true,
          contributor: 'primary',
        });
        expect(result.contributor).toBe('primary');
      });

      it('should default contributor to primary when isSpousal=true and contributor omitted', () => {
        const result = rrspAccountSchema.parse({
          ...validRRSP,
          owner: 'spouse',
          isSpousal: true,
        });
        expect(result.contributor).toBe('primary');
      });

      it('should default contributor to owner when isSpousal=false (owner=primary)', () => {
        const result = rrspAccountSchema.parse(validRRSP);
        expect(result.contributor).toBe('primary');
      });

      it('should default contributor to owner when isSpousal=false and owner=spouse', () => {
        const result = rrspAccountSchema.parse({
          ...validRRSP,
          owner: 'spouse',
        });
        expect(result.contributor).toBe('spouse');
      });
    });

    describe('spousal RRSP contributor refinement', () => {
      it('should reject spousal RRSP where contributor === owner', () => {
        expect(() =>
          rrspAccountSchema.parse({
            ...validRRSP,
            owner: 'spouse',
            isSpousal: true,
            contributor: 'spouse',
          })
        ).toThrow(/contributor.*annuitant\/owner/i);
      });

      it('should accept spousal RRSP where contributor !== owner', () => {
        const result = rrspAccountSchema.parse({
          ...validRRSP,
          owner: 'spouse',
          isSpousal: true,
          contributor: 'primary',
        });
        expect(result.contributor).toBe('primary');
        expect(result.owner).toBe('spouse');
      });

      it('should accept non-spousal RRSP where contributor === owner', () => {
        const result = rrspAccountSchema.parse({
          ...validRRSP,
          owner: 'primary',
          isSpousal: false,
          contributor: 'primary',
        });
        expect(result.contributor).toBe('primary');
      });
    });
  });

  describe('rrifAccountSchema', () => {
    const validRRIF = {
      name: 'My RRIF',
      type: 'rrif' as const,
      balance: 500000,
      owner: 'primary' as const,
      conversionYear: 2024,
    };

    it('should accept valid RRIF account', () => {
      const result = rrifAccountSchema.parse(validRRIF);
      expect(result.type).toBe('rrif');
      expect(result.balance).toBe(500000);
      expect(result.conversionYear).toBe(2024);
    });

    it('should reject invalid conversion year', () => {
      expect(() =>
        rrifAccountSchema.parse({
          ...validRRIF,
          conversionYear: 1999,
        })
      ).toThrow();
    });
  });

  describe('tfsaAccountSchema', () => {
    const validTFSA = {
      name: 'My TFSA',
      type: 'tfsa' as const,
      balance: 80000,
      owner: 'primary' as const,
      contributionRoom: 15000,
    };

    it('should accept valid TFSA account', () => {
      const result = tfsaAccountSchema.parse(validTFSA);
      expect(result.type).toBe('tfsa');
      expect(result.balance).toBe(80000);
      expect(result.contributionRoom).toBe(15000);
    });
  });

  describe('nonRegisteredAccountSchema', () => {
    const validNonReg = {
      name: 'Investment Account',
      type: 'non_registered' as const,
      balance: 150000,
      owner: 'primary' as const,
      adjustedCostBase: 100000,
    };

    it('should accept valid non-registered account', () => {
      const result = nonRegisteredAccountSchema.parse(validNonReg);
      expect(result.type).toBe('non_registered');
      expect(result.balance).toBe(150000);
      expect(result.adjustedCostBase).toBe(100000);
    });

    it('should default adjustedCostBase to 0', () => {
      const { adjustedCostBase: _, ...withoutACB } = validNonReg;
      const result = nonRegisteredAccountSchema.parse(withoutACB);
      expect(result.adjustedCostBase).toBe(0);
    });

    it('should default unrealizedGains to 0', () => {
      const result = nonRegisteredAccountSchema.parse(validNonReg);
      expect(result.unrealizedGains).toBe(0);
    });
  });

  describe('accountSchema (discriminated union)', () => {
    it('should accept RRSP account', () => {
      const result = accountSchema.parse({
        name: 'My RRSP',
        type: 'rrsp',
        balance: 100000,
        owner: 'primary',
      });
      expect(result.type).toBe('rrsp');
    });

    it('should accept RRIF account', () => {
      const result = accountSchema.parse({
        name: 'My RRIF',
        type: 'rrif',
        balance: 200000,
        owner: 'primary',
      });
      expect(result.type).toBe('rrif');
    });

    it('should accept TFSA account', () => {
      const result = accountSchema.parse({
        name: 'My TFSA',
        type: 'tfsa',
        balance: 50000,
        owner: 'primary',
      });
      expect(result.type).toBe('tfsa');
    });

    it('should accept non-registered account', () => {
      const result = accountSchema.parse({
        name: 'My Non-Reg',
        type: 'non_registered',
        balance: 75000,
        owner: 'primary',
      });
      expect(result.type).toBe('non_registered');
    });
  });

  describe('validateRRSPContribution', () => {
    it('should accept valid contribution within room', () => {
      const result = validateRRSPContribution.parse({
        contributionAmount: 10000,
        contributionRoom: 20000,
        age: 50,
        year: 2024,
      });
      expect(result.contributionAmount).toBe(10000);
    });

    it('should reject contribution exceeding room', () => {
      expect(() =>
        validateRRSPContribution.parse({
          contributionAmount: 25000,
          contributionRoom: 20000,
          age: 50,
          year: 2024,
        })
      ).toThrow('exceeds available RRSP room');
    });

    it('should reject contribution after age 71', () => {
      expect(() =>
        validateRRSPContribution.parse({
          contributionAmount: 5000,
          contributionRoom: 20000,
          age: 72,
          year: 2024,
        })
      ).toThrow('after age 71');
    });

    it('should accept contribution at age 71', () => {
      const result = validateRRSPContribution.parse({
        contributionAmount: 5000,
        contributionRoom: 20000,
        age: 71,
        year: 2024,
      });
      expect(result.age).toBe(71);
    });
  });

  describe('validateTFSAContribution', () => {
    it('should accept valid contribution within room', () => {
      const result = validateTFSAContribution.parse({
        contributionAmount: 5000,
        contributionRoom: 10000,
        year: 2024,
      });
      expect(result.contributionAmount).toBe(5000);
    });

    it('should reject contribution exceeding room', () => {
      expect(() =>
        validateTFSAContribution.parse({
          contributionAmount: 15000,
          contributionRoom: 10000,
          year: 2024,
        })
      ).toThrow('exceeds available TFSA room');
    });
  });
});
