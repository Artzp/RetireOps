import { describe, it, expect } from 'vitest';
import { asString } from './coerce';

describe('asString', () => {
  it('returns strings unchanged, including the empty string', () => {
    expect(asString('hello')).toBe('hello');
    expect(asString('')).toBe('');
  });

  it('coerces numbers, booleans, and bigints', () => {
    expect(asString(0)).toBe('0');
    expect(asString(42)).toBe('42');
    expect(asString(true)).toBe('true');
    expect(asString(10n)).toBe('10');
  });

  it('returns the fallback for null and undefined', () => {
    expect(asString(null)).toBe('');
    expect(asString(undefined)).toBe('');
    expect(asString(undefined, 'Account')).toBe('Account');
  });

  it('never leaks "[object Object]" for objects or arrays', () => {
    expect(asString({})).toBe('');
    expect(asString({ id: 1 }, 'Property')).toBe('Property');
    expect(asString([1, 2, 3])).toBe('');
  });

  it('preserves "first defined wins" when paired with a nullish chain', () => {
    const card: Record<string, unknown> = { id: 'a1', label: 'My RRSP' };
    expect(asString(card._serverId ?? card.id)).toBe('a1');
    expect(asString(card.label ?? card.name, 'Account')).toBe('My RRSP');
    expect(asString(card.missing ?? card.alsoMissing, 'Account')).toBe('Account');
  });
});
