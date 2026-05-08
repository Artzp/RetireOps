import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { redis } from '../utils/redis.js';
import { db } from '../db/connection.js';
import { hashPassword, verifyPassword } from './password.js';
import { logger } from '../utils/logger.js';

export interface TokenPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

function parseExpiration(exp: string): number {
  const match = exp.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid expiration format: ${exp}`);

  const value = parseInt(match[1] ?? '0', 10);
  const unit = match[2] ?? 's';

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 60 * 60 * 24;
    default:
      throw new Error(`Invalid time unit: ${unit}`);
  }
}

function generateAccessToken(userId: string, email: string): string {
  const payload: TokenPayload = {
    userId,
    email,
    type: 'access',
  };

  const expiresInSeconds = parseExpiration(config.JWT_ACCESS_TOKEN_EXPIRES_IN);
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: expiresInSeconds });
}

function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

export async function generateTokenPair(userId: string, email: string): Promise<TokenPair> {
  const accessToken = generateAccessToken(userId, email);
  const refreshToken = generateRefreshToken();

  const accessTokenExpiresIn = parseExpiration(config.JWT_ACCESS_TOKEN_EXPIRES_IN);
  const refreshTokenExpiresIn = parseExpiration(config.JWT_REFRESH_TOKEN_EXPIRES_IN);

  const accessTokenExpiresAt = new Date(Date.now() + accessTokenExpiresIn * 1000);
  const refreshTokenExpiresAt = new Date(Date.now() + refreshTokenExpiresIn * 1000);

  // Store refresh token hash in database
  const tokenHash = await hashPassword(refreshToken);
  await db
    .insertInto('refresh_tokens')
    .values({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: refreshTokenExpiresAt,
    })
    .execute();

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
  };
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as TokenPayload;
    if (payload.type !== 'access') {
      logger.warn('Token type mismatch', { expected: 'access', got: payload.type });
      return null;
    }
    return payload;
  } catch (error) {
    logger.error('JWT verification failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      tokenLength: token.length,
      secretLength: config.JWT_SECRET.length,
    });
    return null;
  }
}

/**
 * Decode an access token without verifying it.
 * Used for token refresh when the access token has expired.
 */
export function decodeAccessToken(token: string): TokenPayload | null {
  try {
    const payload = jwt.decode(token) as TokenPayload | null;
    if (!payload || payload.type !== 'access') {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
  const tokens = await db
    .selectFrom('refresh_tokens')
    .selectAll()
    .where('user_id', '=', userId)
    .where('revoked_at', 'is', null)
    .where('expires_at', '>', new Date())
    .execute();

  for (const token of tokens) {
    const isValid = await verifyPassword(refreshToken, token.token_hash);
    if (isValid) {
      return true;
    }
  }

  return false;
}

export async function revokeRefreshToken(userId: string, refreshToken: string): Promise<void> {
  const tokens = await db
    .selectFrom('refresh_tokens')
    .selectAll()
    .where('user_id', '=', userId)
    .where('revoked_at', 'is', null)
    .execute();

  for (const token of tokens) {
    const isValid = await verifyPassword(refreshToken, token.token_hash);
    if (isValid) {
      await db
        .updateTable('refresh_tokens')
        .set({ revoked_at: new Date() })
        .where('id', '=', token.id)
        .execute();
      return;
    }
  }
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await db
    .updateTable('refresh_tokens')
    .set({ revoked_at: new Date() })
    .where('user_id', '=', userId)
    .where('revoked_at', 'is', null)
    .execute();
}

// Blacklist an access token (for logout)
const BLACKLIST_PREFIX = 'token:blacklist:';

export async function blacklistAccessToken(token: string): Promise<void> {
  try {
    const decoded = jwt.decode(token) as { exp?: number } | null;
    if (decoded?.exp) {
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await redis.setex(`${BLACKLIST_PREFIX}${token}`, ttl, '1');
      }
    }
  } catch {
    // Token is invalid, no need to blacklist
  }
}

export async function isAccessTokenBlacklisted(token: string): Promise<boolean> {
  const result = await redis.get(`${BLACKLIST_PREFIX}${token}`);
  return result !== null;
}
