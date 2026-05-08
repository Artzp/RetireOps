import { OAuth2Client } from 'google-auth-library';
import { config } from '../config/index.js';
import { db } from '../db/connection.js';
import { generateTokenPair, type TokenPair } from '../auth/jwt.js';
import { AuthenticationError, ValidationError } from '../middleware/error-handler.js';
import { logger } from '../utils/logger.js';

// Initialize OAuth2 client
function getOAuth2Client(): OAuth2Client {
  if (!config.GOOGLE_CLIENT_ID) {
    throw new ValidationError('Google OAuth is not configured');
  }
  return new OAuth2Client(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    config.GOOGLE_REDIRECT_URI
  );
}

export interface GoogleUserInfo {
  googleId: string;
  email: string;
  name: string;
  picture: string | undefined;
  emailVerified: boolean;
}

export interface GoogleAuthResult {
  user: {
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
  };
  tokens: TokenPair;
  isNewUser: boolean;
}

/**
 * Verify a Google ID token and extract user information
 */
async function verifyGoogleIdToken(idToken: string): Promise<GoogleUserInfo> {
  const client = getOAuth2Client();

  if (!config.GOOGLE_CLIENT_ID) {
    throw new ValidationError('Google OAuth is not configured');
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: config.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new AuthenticationError('Invalid Google ID token');
    }

    const email = payload.email ?? '';
    return {
      googleId: payload.sub,
      email,
      name: payload.name ?? email.split('@')[0] ?? 'User',
      picture: payload.picture,
      emailVerified: payload.email_verified ?? false,
    };
  } catch (error) {
    logger.error('Google token verification failed', { error });
    throw new AuthenticationError('Failed to verify Google ID token');
  }
}

/**
 * Generate the Google OAuth authorization URL
 */
export function getGoogleAuthUrl(state?: string): string {
  const client = getOAuth2Client();

  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'openid',
  ];

  const options: {
    access_type: 'offline';
    scope: string[];
    prompt: 'consent';
    state?: string;
  } = {
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  };

  if (state) {
    options.state = state;
  }

  return client.generateAuthUrl(options);
}

/**
 * Exchange authorization code for tokens and user info
 */
async function exchangeCodeForTokens(code: string): Promise<{
  userInfo: GoogleUserInfo;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}> {
  const client = getOAuth2Client();

  try {
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    if (!tokens.id_token) {
      throw new AuthenticationError('No ID token received from Google');
    }

    const userInfo = await verifyGoogleIdToken(tokens.id_token);

    return {
      userInfo,
      accessToken: tokens.access_token ?? '',
      refreshToken: tokens.refresh_token ?? null,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    logger.error('Google code exchange failed', { error });
    throw new AuthenticationError('Failed to exchange Google authorization code');
  }
}

/**
 * Sign in or register a user with Google OAuth
 */
export async function signInWithGoogle(idToken: string): Promise<GoogleAuthResult> {
  const userInfo = await verifyGoogleIdToken(idToken);

  // Check if OAuth provider entry exists
  const existingProvider = await db
    .selectFrom('oauth_providers')
    .innerJoin('users', 'users.id', 'oauth_providers.user_id')
    .select(['users.id', 'users.email', 'users.name', 'users.email_verified'])
    .where('oauth_providers.provider', '=', 'google')
    .where('oauth_providers.provider_user_id', '=', userInfo.googleId)
    .where('users.deleted_at', 'is', null)
    .executeTakeFirst();

  if (existingProvider) {
    // Existing user - generate tokens
    const tokens = await generateTokenPair(existingProvider.id, existingProvider.email);

    return {
      user: {
        id: existingProvider.id,
        email: existingProvider.email,
        name: existingProvider.name,
        emailVerified: existingProvider.email_verified,
      },
      tokens,
      isNewUser: false,
    };
  }

  // Check if a user with this email already exists
  const existingUser = await db
    .selectFrom('users')
    .selectAll()
    .where('email', '=', userInfo.email.toLowerCase())
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (existingUser) {
    // Link Google account to existing user
    await db
      .insertInto('oauth_providers')
      .values({
        user_id: existingUser.id,
        provider: 'google',
        provider_user_id: userInfo.googleId,
      })
      .execute();

    // Update email verification status if Google verified the email
    if (userInfo.emailVerified && !existingUser.email_verified) {
      await db
        .updateTable('users')
        .set({
          email_verified: true,
          email_verified_at: new Date(),
          updated_at: new Date(),
        })
        .where('id', '=', existingUser.id)
        .execute();
    }

    const tokens = await generateTokenPair(existingUser.id, existingUser.email);

    return {
      user: {
        id: existingUser.id,
        email: existingUser.email,
        name: existingUser.name,
        emailVerified: userInfo.emailVerified || existingUser.email_verified,
      },
      tokens,
      isNewUser: false,
    };
  }

  // Create new user
  // Disclaimer acceptance is gated by the register-page checkbox before the
  // Google sign-up button is enabled, so any new Google user has accepted it.
  const newUser = await db
    .insertInto('users')
    .values({
      email: userInfo.email.toLowerCase(),
      password_hash: null, // OAuth users don't have passwords
      name: userInfo.name,
      email_verified: userInfo.emailVerified,
      email_verified_at: userInfo.emailVerified ? new Date() : null,
      disclaimer_accepted_at: new Date(),
    })
    .returning(['id', 'email', 'name', 'email_verified'])
    .executeTakeFirstOrThrow();

  // Create OAuth provider entry
  await db
    .insertInto('oauth_providers')
    .values({
      user_id: newUser.id,
      provider: 'google',
      provider_user_id: userInfo.googleId,
    })
    .execute();

  // Create default user settings
  await db
    .insertInto('user_settings')
    .values({
      user_id: newUser.id,
      province: 'ON', // Default to Ontario
    })
    .execute();

  const tokens = await generateTokenPair(newUser.id, newUser.email);

  return {
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      emailVerified: newUser.email_verified,
    },
    tokens,
    isNewUser: true,
  };
}

/**
 * Sign in with Google using authorization code (for OAuth redirect flow)
 */
export async function signInWithGoogleCode(code: string): Promise<GoogleAuthResult> {
  const { userInfo, accessToken, refreshToken, expiresAt } = await exchangeCodeForTokens(code);

  // Check if OAuth provider entry exists
  const existingProvider = await db
    .selectFrom('oauth_providers')
    .innerJoin('users', 'users.id', 'oauth_providers.user_id')
    .select([
      'oauth_providers.id as provider_id',
      'users.id',
      'users.email',
      'users.name',
      'users.email_verified',
    ])
    .where('oauth_providers.provider', '=', 'google')
    .where('oauth_providers.provider_user_id', '=', userInfo.googleId)
    .where('users.deleted_at', 'is', null)
    .executeTakeFirst();

  if (existingProvider) {
    // Update tokens
    await db
      .updateTable('oauth_providers')
      .set({
        access_token: accessToken,
        refresh_token: refreshToken ?? null,
        token_expires_at: expiresAt ?? null,
        updated_at: new Date(),
      })
      .where('id', '=', existingProvider.provider_id)
      .execute();

    const tokens = await generateTokenPair(existingProvider.id, existingProvider.email);

    return {
      user: {
        id: existingProvider.id,
        email: existingProvider.email,
        name: existingProvider.name,
        emailVerified: existingProvider.email_verified,
      },
      tokens,
      isNewUser: false,
    };
  }

  // Check if a user with this email already exists
  const existingUser = await db
    .selectFrom('users')
    .selectAll()
    .where('email', '=', userInfo.email.toLowerCase())
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (existingUser) {
    // Link Google account to existing user
    await db
      .insertInto('oauth_providers')
      .values({
        user_id: existingUser.id,
        provider: 'google',
        provider_user_id: userInfo.googleId,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expires_at: expiresAt,
      })
      .execute();

    // Update email verification status if Google verified the email
    if (userInfo.emailVerified && !existingUser.email_verified) {
      await db
        .updateTable('users')
        .set({
          email_verified: true,
          email_verified_at: new Date(),
          updated_at: new Date(),
        })
        .where('id', '=', existingUser.id)
        .execute();
    }

    const tokens = await generateTokenPair(existingUser.id, existingUser.email);

    return {
      user: {
        id: existingUser.id,
        email: existingUser.email,
        name: existingUser.name,
        emailVerified: userInfo.emailVerified || existingUser.email_verified,
      },
      tokens,
      isNewUser: false,
    };
  }

  // Create new user (redirect/code-exchange flow). Disclaimer is gated by the
  // register-page checkbox before this OAuth flow can start.
  const newUser = await db
    .insertInto('users')
    .values({
      email: userInfo.email.toLowerCase(),
      password_hash: null,
      name: userInfo.name,
      email_verified: userInfo.emailVerified,
      email_verified_at: userInfo.emailVerified ? new Date() : null,
      disclaimer_accepted_at: new Date(),
    })
    .returning(['id', 'email', 'name', 'email_verified'])
    .executeTakeFirstOrThrow();

  // Create OAuth provider entry
  await db
    .insertInto('oauth_providers')
    .values({
      user_id: newUser.id,
      provider: 'google',
      provider_user_id: userInfo.googleId,
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expires_at: expiresAt,
    })
    .execute();

  // Create default user settings
  await db
    .insertInto('user_settings')
    .values({
      user_id: newUser.id,
      province: 'ON',
    })
    .execute();

  const tokens = await generateTokenPair(newUser.id, newUser.email);

  return {
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      emailVerified: newUser.email_verified,
    },
    tokens,
    isNewUser: true,
  };
}

/**
 * Unlink Google account from user
 */
export async function unlinkGoogleAccount(userId: string): Promise<void> {
  // Check if user has a password (can unlink OAuth)
  const user = await db
    .selectFrom('users')
    .select(['password_hash'])
    .where('id', '=', userId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!user) {
    throw new AuthenticationError('User not found');
  }

  // Count OAuth providers
  const providers = await db
    .selectFrom('oauth_providers')
    .select(['id'])
    .where('user_id', '=', userId)
    .execute();

  // Cannot unlink if it's the only auth method
  if (!user.password_hash && providers.length <= 1) {
    throw new ValidationError(
      'Cannot unlink Google account. Please set a password first or link another OAuth provider.'
    );
  }

  await db
    .deleteFrom('oauth_providers')
    .where('user_id', '=', userId)
    .where('provider', '=', 'google')
    .execute();
}
