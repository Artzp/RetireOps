import { db } from '../db/connection.js';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../auth/password.js';
import {
  generateTokenPair,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
  blacklistAccessToken,
  type TokenPair,
} from '../auth/jwt.js';
import {
  ValidationError,
  AuthenticationError,
  ConflictError,
  NotFoundError,
} from '../middleware/error-handler.js';

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  // ISO timestamp captured at the moment the user accepted the educational-only
  // disclaimer in the UI. Optional in the input — falls back to NOW() at insert.
  disclaimerAcceptedAt?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
  };
  tokens: TokenPair;
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  // Validate password strength
  const passwordStrength = validatePasswordStrength(input.password);
  if (!passwordStrength.isValid) {
    throw new ValidationError('Password does not meet requirements', passwordStrength.errors);
  }

  // Check if user already exists
  const existingUser = await db
    .selectFrom('users')
    .select('id')
    .where('email', '=', input.email.toLowerCase())
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (existingUser) {
    throw new ConflictError('A user with this email already exists');
  }

  // Hash password
  const passwordHash = await hashPassword(input.password);

  // Create user
  const disclaimerAcceptedAt = input.disclaimerAcceptedAt
    ? new Date(input.disclaimerAcceptedAt)
    : new Date();
  const user = await db
    .insertInto('users')
    .values({
      email: input.email.toLowerCase(),
      password_hash: passwordHash,
      name: input.name,
      disclaimer_accepted_at: disclaimerAcceptedAt,
    })
    .returning(['id', 'email', 'name', 'email_verified'])
    .executeTakeFirstOrThrow();

  // Create default user settings
  await db
    .insertInto('user_settings')
    .values({
      user_id: user.id,
      province: 'ON', // Default to Ontario
    })
    .execute();

  // Generate tokens
  const tokens = await generateTokenPair(user.id, user.email);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.email_verified,
    },
    tokens,
  };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  // Find user by email
  const user = await db
    .selectFrom('users')
    .selectAll()
    .where('email', '=', input.email.toLowerCase())
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!user) {
    throw new AuthenticationError('Invalid email or password');
  }

  // Check if user has a password (OAuth-only users cannot log in with password)
  if (!user.password_hash) {
    throw new AuthenticationError('Please sign in using Google');
  }

  // Verify password
  const isValidPassword = await verifyPassword(input.password, user.password_hash);
  if (!isValidPassword) {
    throw new AuthenticationError('Invalid email or password');
  }

  // Generate tokens
  const tokens = await generateTokenPair(user.id, user.email);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.email_verified,
    },
    tokens,
  };
}

export async function refreshTokens(userId: string, refreshToken: string): Promise<TokenPair> {
  // Verify the refresh token
  const isValid = await verifyRefreshToken(userId, refreshToken);
  if (!isValid) {
    throw new AuthenticationError('Invalid refresh token');
  }

  // Get user
  const user = await db
    .selectFrom('users')
    .select(['id', 'email'])
    .where('id', '=', userId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!user) {
    throw new AuthenticationError('User not found');
  }

  // Revoke old refresh token
  await revokeRefreshToken(userId, refreshToken);

  // Generate new token pair
  return generateTokenPair(user.id, user.email);
}

export async function logout(
  userId: string,
  accessToken: string,
  refreshToken?: string
): Promise<void> {
  // Blacklist the access token
  await blacklistAccessToken(accessToken);

  // Revoke the refresh token if provided
  if (refreshToken) {
    await revokeRefreshToken(userId, refreshToken);
  }
}

export async function logoutAllDevices(userId: string, accessToken: string): Promise<void> {
  // Blacklist current access token
  await blacklistAccessToken(accessToken);

  // Revoke all refresh tokens
  await revokeAllRefreshTokens(userId);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  // Validate new password strength
  const passwordStrength = validatePasswordStrength(newPassword);
  if (!passwordStrength.isValid) {
    throw new ValidationError('New password does not meet requirements', passwordStrength.errors);
  }

  // Get user
  const user = await db
    .selectFrom('users')
    .select(['id', 'password_hash'])
    .where('id', '=', userId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!user) {
    throw new NotFoundError('User');
  }

  // If user has a password, verify current password
  if (user.password_hash) {
    const isValidPassword = await verifyPassword(currentPassword, user.password_hash);
    if (!isValidPassword) {
      throw new AuthenticationError('Current password is incorrect');
    }
  }
  // OAuth users setting password for first time don't need current password verification

  // Hash and update password
  const newPasswordHash = await hashPassword(newPassword);
  await db
    .updateTable('users')
    .set({
      password_hash: newPasswordHash,
      updated_at: new Date(),
    })
    .where('id', '=', userId)
    .execute();

  // Revoke all refresh tokens (force re-login on all devices)
  await revokeAllRefreshTokens(userId);
}

/**
 * Set password for OAuth user (who doesn't have one yet)
 */
export async function setPassword(userId: string, newPassword: string): Promise<void> {
  // Validate new password strength
  const passwordStrength = validatePasswordStrength(newPassword);
  if (!passwordStrength.isValid) {
    throw new ValidationError('Password does not meet requirements', passwordStrength.errors);
  }

  // Get user
  const user = await db
    .selectFrom('users')
    .select(['id', 'password_hash'])
    .where('id', '=', userId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!user) {
    throw new NotFoundError('User');
  }

  // Only allow setting password if user doesn't have one
  if (user.password_hash) {
    throw new ValidationError('User already has a password. Use change password instead.');
  }

  // Hash and set password
  const passwordHash = await hashPassword(newPassword);
  await db
    .updateTable('users')
    .set({
      password_hash: passwordHash,
      updated_at: new Date(),
    })
    .where('id', '=', userId)
    .execute();
}
