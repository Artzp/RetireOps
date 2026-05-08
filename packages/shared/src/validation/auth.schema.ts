/**
 * Authentication Validation Schemas
 * @see docs/source-of-truth/01-user-profile.md
 */
import { z } from 'zod';

/**
 * Email validation schema
 */
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .max(255, 'Email must be at most 255 characters')
  .transform((email) => email.toLowerCase());

/**
 * Password validation schema with strength requirements
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine(
    (password) => /[a-z]/.test(password),
    'Password must contain at least one lowercase letter'
  )
  .refine(
    (password) => /[A-Z]/.test(password),
    'Password must contain at least one uppercase letter'
  )
  .refine((password) => /[0-9]/.test(password), 'Password must contain at least one digit')
  .refine(
    (password) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password),
    'Password must contain at least one special character'
  );

/**
 * Simple password schema (for basic validation before strength check)
 */
export const simplePasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

/**
 * Name validation schema
 */
export const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name must be at most 100 characters')
  .trim();

/**
 * User registration input schema
 */
export const registerInputSchema = z.object({
  email: emailSchema,
  password: simplePasswordSchema, // Basic validation, strength checked in service
  name: nameSchema,
});

export type RegisterInput = z.infer<typeof registerInputSchema>;

/**
 * Login input schema
 */
export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

/**
 * Refresh token input schema
 */
export const refreshTokenInputSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenInputSchema>;

/**
 * Change password input schema
 */
export const changePasswordInputSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: simplePasswordSchema,
});

export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;

/**
 * Set password input schema (for OAuth users)
 */
export const setPasswordInputSchema = z.object({
  password: simplePasswordSchema,
});

export type SetPasswordInput = z.infer<typeof setPasswordInputSchema>;

/**
 * OAuth provider enum
 */
export const oauthProviderSchema = z.enum(['google', 'github', 'microsoft']);

export type OAuthProvider = z.infer<typeof oauthProviderSchema>;

/**
 * Google ID token input schema
 */
export const googleIdTokenInputSchema = z.object({
  idToken: z.string().min(1, 'Google ID token is required'),
});

export type GoogleIdTokenInput = z.infer<typeof googleIdTokenInputSchema>;

/**
 * OAuth authorization code input schema
 */
export const oauthCodeInputSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().optional(),
});

export type OAuthCodeInput = z.infer<typeof oauthCodeInputSchema>;

/**
 * Auth result user schema
 */
export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  emailVerified: z.boolean(),
});

export type AuthUser = z.infer<typeof authUserSchema>;

/**
 * Token pair schema
 */
export const tokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  accessTokenExpiresAt: z.coerce.date(),
  refreshTokenExpiresAt: z.coerce.date(),
});

export type TokenPair = z.infer<typeof tokenPairSchema>;

/**
 * Auth result schema
 */
export const authResultSchema = z.object({
  user: authUserSchema,
  tokens: tokenPairSchema,
});

export type AuthResult = z.infer<typeof authResultSchema>;

/**
 * OAuth auth result schema (includes isNewUser flag)
 */
export const oauthAuthResultSchema = authResultSchema.extend({
  isNewUser: z.boolean(),
});

export type OAuthAuthResult = z.infer<typeof oauthAuthResultSchema>;
