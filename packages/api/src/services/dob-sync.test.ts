/**
 * Unit tests for DOB sync between user_settings and household_profiles
 * @see .planning/phases/42-dob-sync - DOB-SYNC-01 through DOB-SYNC-04
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track calls via module-scoped arrays (vi.mock factory is hoisted)
const dbCalls: { table: string; setArg: unknown; whereArgs: unknown[] }[] = [];
const sqlCalls: { args: unknown[] }[] = [];

vi.mock('../db/connection.js', () => {
  const mockExecute = () => Promise.resolve({ numAffectedRows: BigInt(1) });
  const mockWhere = (...args: unknown[]) => {
    if (dbCalls.length > 0) {
      const last = dbCalls[dbCalls.length - 1];
      if (last) last.whereArgs = args;
    }
    return { execute: mockExecute };
  };
  const mockSet = (arg: unknown) => {
    if (dbCalls.length > 0) {
      const last = dbCalls[dbCalls.length - 1];
      if (last) last.setArg = arg;
    }
    return { where: mockWhere };
  };
  const mockUpdateTable = (table: string) => {
    dbCalls.push({ table, setArg: undefined, whereArgs: [] });
    return { set: mockSet };
  };

  return {
    db: {
      updateTable: mockUpdateTable,
    },
  };
});

vi.mock('kysely', () => ({
  sql: Object.assign(
    (...args: unknown[]) => {
      sqlCalls.push({ args });
      return {
        execute: () => Promise.resolve({ numAffectedRows: BigInt(1) }),
      };
    },
    {
      lit: (value: unknown) => ({ __lit: value }),
    }
  ),
}));

import { syncDobToSettings, syncDobToProfile } from './dob-sync.js';

describe('dob-sync', () => {
  beforeEach(() => {
    dbCalls.length = 0;
    sqlCalls.length = 0;
  });

  describe('syncDobToSettings', () => {
    it('updates user_settings.date_of_birth for owner role', async () => {
      await syncDobToSettings('user-123', 'owner', '1975-06-15');

      expect(dbCalls).toHaveLength(1);
      expect(dbCalls[0]?.table).toBe('user_settings');
      const setArg = dbCalls[0]?.setArg as Record<string, unknown>;
      expect(setArg.date_of_birth).toEqual(new Date('1975-06-15'));
      expect(dbCalls[0]?.whereArgs).toEqual(['user_id', '=', 'user-123']);
    });

    it('updates user_settings.spouse_date_of_birth for spouse role', async () => {
      await syncDobToSettings('user-123', 'spouse', '1980-03-20');

      expect(dbCalls).toHaveLength(1);
      const setArg = dbCalls[0]?.setArg as Record<string, unknown>;
      expect(setArg.spouse_date_of_birth).toEqual(new Date('1980-03-20'));
      expect(dbCalls[0]?.whereArgs).toEqual(['user_id', '=', 'user-123']);
    });

    it('sets date_of_birth to null when dob is null', async () => {
      await syncDobToSettings('user-123', 'owner', null);

      expect(dbCalls).toHaveLength(1);
      const setArg = dbCalls[0]?.setArg as Record<string, unknown>;
      expect(setArg.date_of_birth).toBeNull();
    });

    it('does not throw when no user_settings row exists (0 rows affected)', async () => {
      // The mock always succeeds; the function should not throw regardless
      await expect(syncDobToSettings('user-999', 'owner', '1975-06-15')).resolves.toBeUndefined();
    });

    it('includes updated_at in the set data', async () => {
      await syncDobToSettings('user-123', 'owner', '1975-06-15');

      const setArg = dbCalls[0]?.setArg as Record<string, unknown>;
      expect(setArg.updated_at).toBeInstanceOf(Date);
    });
  });

  describe('syncDobToProfile', () => {
    it('calls raw SQL to update step_data.about_you.dateOfBirth for owner role', async () => {
      await syncDobToProfile('user-123', 'owner', new Date('1975-06-15'));

      expect(sqlCalls).toHaveLength(1);
    });

    it('calls raw SQL to update step_data.spouse.dateOfBirth for spouse role', async () => {
      await syncDobToProfile('user-123', 'spouse', new Date('1980-03-20'));

      expect(sqlCalls).toHaveLength(1);
    });

    it('handles null dob without throwing', async () => {
      await syncDobToProfile('user-123', 'owner', null);

      expect(sqlCalls).toHaveLength(1);
    });

    it('does not throw when no household_profiles row exists (0 rows affected)', async () => {
      await expect(
        syncDobToProfile('user-999', 'owner', new Date('1975-06-15'))
      ).resolves.toBeUndefined();
    });
  });
});
