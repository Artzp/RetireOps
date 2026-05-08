import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const execute = vi.fn();
  const updateExecute = vi.fn();
  const where = vi.fn();
  const selectAll = vi.fn();
  const selectFrom = vi.fn();
  const updateWhere = vi.fn();
  const updateSet = vi.fn();
  const updateTable = vi.fn();
  const verifyPassword = vi.fn();

  where.mockImplementation(() => ({ where, execute }));
  selectAll.mockImplementation(() => ({ where }));
  selectFrom.mockImplementation(() => ({ selectAll }));
  updateWhere.mockImplementation(() => ({ execute: updateExecute }));
  updateSet.mockImplementation(() => ({ where: updateWhere }));
  updateTable.mockImplementation(() => ({ set: updateSet }));

  return {
    execute,
    updateExecute,
    where,
    selectAll,
    selectFrom,
    updateWhere,
    updateSet,
    updateTable,
    verifyPassword,
  };
});

vi.mock('../db/connection.js', () => ({
  db: {
    selectFrom: mocks.selectFrom,
    updateTable: mocks.updateTable,
  },
}));

vi.mock('./password.js', async () => {
  const actual = await vi.importActual<typeof import('./password.js')>('./password.js');

  return {
    ...actual,
    verifyPassword: mocks.verifyPassword,
  };
});

import { revokeRefreshToken, verifyRefreshToken } from './jwt.js';

describe('refresh token helpers', () => {
  beforeEach(() => {
    mocks.execute.mockReset();
    mocks.updateExecute.mockReset();
    mocks.verifyPassword.mockReset();
    mocks.selectFrom.mockClear();
    mocks.selectAll.mockClear();
    mocks.where.mockClear();
    mocks.updateTable.mockClear();
    mocks.updateSet.mockClear();
    mocks.updateWhere.mockClear();
  });

  it('verifies refresh tokens through the shared password helper', async () => {
    mocks.execute.mockResolvedValue([
      { id: 'token-1', token_hash: 'hash-1' },
      { id: 'token-2', token_hash: 'hash-2' },
    ]);
    mocks.verifyPassword.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await expect(verifyRefreshToken('user-1', 'refresh-token')).resolves.toBe(true);

    expect(mocks.verifyPassword).toHaveBeenNthCalledWith(1, 'refresh-token', 'hash-1');
    expect(mocks.verifyPassword).toHaveBeenNthCalledWith(2, 'refresh-token', 'hash-2');
  });

  it('revokes the matching refresh token', async () => {
    mocks.execute.mockResolvedValue([{ id: 'token-2', token_hash: 'hash-2' }]);
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.updateExecute.mockResolvedValue({ numUpdatedRows: 1n });

    await revokeRefreshToken('user-1', 'refresh-token');

    expect(mocks.verifyPassword).toHaveBeenCalledWith('refresh-token', 'hash-2');
    expect(mocks.updateTable).toHaveBeenCalledWith('refresh_tokens');
    expect(mocks.updateWhere).toHaveBeenCalledWith('id', '=', 'token-2');
  });
});
