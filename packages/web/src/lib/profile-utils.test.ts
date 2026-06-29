import { describe, it, expect } from 'vitest';
import {
  cppAdjustment,
  oasAdjustment,
  extractAccountCardArray,
  extractAccountCards,
  extractPropertyCards,
  getHasSpouse,
  getProfileDefault,
} from './profile-utils';

describe('cppAdjustment', () => {
  it('returns -36.0% for age 60 (maximum early penalty)', () => {
    const result = cppAdjustment(60);
    expect(result.pct).toBeCloseTo(-36.0, 1);
    expect(result.months).toBe(60);
  });

  it('returns -21.6% for age 62 (36 months early)', () => {
    const result = cppAdjustment(62);
    expect(result.pct).toBeCloseTo(-21.6, 1);
    expect(result.months).toBe(36);
  });

  it('returns 0% for age 65 (standard)', () => {
    const result = cppAdjustment(65);
    expect(result.pct).toBe(0);
    expect(result.months).toBe(0);
  });

  it('returns +42.0% for age 70 (maximum deferral bonus)', () => {
    const result = cppAdjustment(70);
    expect(result.pct).toBeCloseTo(42.0, 1);
    expect(result.months).toBe(60);
  });
});

describe('oasAdjustment', () => {
  it('returns 0% for age 65 (no deferral)', () => {
    const result = oasAdjustment(65);
    expect(result.pct).toBe(0);
    expect(result.months).toBe(0);
  });

  it('returns +14.4% for age 67 (24 months deferred)', () => {
    const result = oasAdjustment(67);
    expect(result.pct).toBeCloseTo(14.4, 1);
    expect(result.months).toBe(24);
  });

  it('returns +36.0% for age 70 (maximum deferral)', () => {
    const result = oasAdjustment(70);
    expect(result.pct).toBeCloseTo(36.0, 1);
    expect(result.months).toBe(60);
  });
});

describe('extractAccountCardArray', () => {
  it('returns empty array when accounts is absent', () => {
    expect(extractAccountCardArray({})).toEqual([]);
  });

  it('returns the bare array shape unchanged', () => {
    const cards = [{ id: 'a1' }];
    expect(extractAccountCardArray({ accounts: cards })).toBe(cards);
  });

  it('unwraps the { cards: [...] } wrapper shape', () => {
    const cards = [{ id: 'a1' }];
    expect(extractAccountCardArray({ accounts: { cards } })).toBe(cards);
  });

  it('returns empty array for a malformed accounts value', () => {
    expect(extractAccountCardArray({ accounts: { notCards: 1 } })).toEqual([]);
  });
});

describe('extractAccountCards', () => {
  it('returns empty array for empty stepData', () => {
    expect(extractAccountCards({})).toEqual([]);
  });

  it('extracts cards from raw array shape', () => {
    const result = extractAccountCards({
      accounts: [{ id: 'a1', type: 'RRSP', label: 'My RRSP' }],
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe('RRSP');
  });

  it('extracts cards from the { cards: [...] } wrapper shape', () => {
    const result = extractAccountCards({
      accounts: { cards: [{ _serverId: 's1', type: 'TFSA', name: 'My TFSA' }] },
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('s1');
    expect(result[0]?.label).toBe('My TFSA');
    expect(result[0]?.type).toBe('TFSA');
  });

  it('drops cards with no stable id (missing both _serverId and id)', () => {
    const result = extractAccountCards({
      accounts: [
        { type: 'RRSP', label: 'No id' },
        { id: 'a1', type: 'TFSA', label: 'Has id' },
      ],
    });
    // An id-less card is unreferenceable and would render an invalid empty-value
    // <Select.Item> in the override dropdown, so it is filtered out.
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('a1');
  });
});

describe('getHasSpouse', () => {
  it('returns true when includeSpouse is true', () => {
    expect(getHasSpouse({ about_you: { includeSpouse: true } })).toBe(true);
  });

  it('returns false when includeSpouse is false', () => {
    expect(getHasSpouse({ about_you: { includeSpouse: false } })).toBe(false);
  });

  it('returns false when about_you is missing', () => {
    expect(getHasSpouse({})).toBe(false);
  });
});

describe('getProfileDefault', () => {
  it('resolves nested paths', () => {
    expect(getProfileDefault({ about_you: { retirementAge: 65 } }, 'about_you.retirementAge')).toBe(
      65
    );
  });

  it('returns undefined for missing paths', () => {
    expect(getProfileDefault({}, 'missing.path')).toBeUndefined();
  });
});

describe('extractPropertyCards', () => {
  it('returns empty array for empty stepData', () => {
    expect(extractPropertyCards({})).toEqual([]);
  });

  it('extracts property cards from properties array', () => {
    const result = extractPropertyCards({
      property_goals: { properties: [{ id: 'p1', address: '123 Main St', propertyType: 'house' }] },
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.label).toBe('123 Main St');
  });

  it('drops property cards with no stable id', () => {
    const result = extractPropertyCards({
      property_goals: {
        properties: [{ address: 'No id property' }, { id: 'p1', address: '123 Main St' }],
      },
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('p1');
  });
});
