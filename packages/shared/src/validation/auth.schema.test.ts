/**
 * Authentication Schema Tests
 */
import { describe, it, expect } from 'vitest';
import {
  emailSchema,
  passwordSchema,
  simplePasswordSchema,
  nameSchema,
  registerInputSchema,
  loginInputSchema,
  refreshTokenInputSchema,
  changePasswordInputSchema,
  setPasswordInputSchema,
  oauthProviderSchema,
  googleIdTokenInputSchema,
  oauthCodeInputSchema,
  authUserSchema,
  tokenPairSchema,
  authResultSchema,
  oauthAuthResultSchema,
} from './auth.schema.js';

describe('Auth Schema', () => {
  describe('emailSchema', () => {
    it('should accept valid email', () => {
      const result = emailSchema.safeParse('user@example.com');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('user@example.com');
      }
    });

    it('should lowercase email', () => {
      const result = emailSchema.safeParse('User@EXAMPLE.COM');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('user@example.com');
      }
    });

    it('should reject invalid email', () => {
      const result = emailSchema.safeParse('not-an-email');
      expect(result.success).toBe(false);
    });

    it('should reject email longer than 255 characters', () => {
      const longEmail = 'a'.repeat(250) + '@b.com';
      const result = emailSchema.safeParse(longEmail);
      expect(result.success).toBe(false);
    });
  });

  describe('passwordSchema', () => {
    it('should accept valid password with all requirements', () => {
      const result = passwordSchema.safeParse('Password123!');
      expect(result.success).toBe(true);
    });

    it('should reject password shorter than 8 characters', () => {
      const result = passwordSchema.safeParse('Pass1!');
      expect(result.success).toBe(false);
    });

    it('should reject password without lowercase', () => {
      const result = passwordSchema.safeParse('PASSWORD123!');
      expect(result.success).toBe(false);
    });

    it('should reject password without uppercase', () => {
      const result = passwordSchema.safeParse('password123!');
      expect(result.success).toBe(false);
    });

    it('should reject password without digit', () => {
      const result = passwordSchema.safeParse('Password!!!');
      expect(result.success).toBe(false);
    });

    it('should reject password without special character', () => {
      const result = passwordSchema.safeParse('Password123');
      expect(result.success).toBe(false);
    });

    it('should reject password longer than 128 characters', () => {
      const longPassword = 'Aa1!' + 'a'.repeat(130);
      const result = passwordSchema.safeParse(longPassword);
      expect(result.success).toBe(false);
    });
  });

  describe('simplePasswordSchema', () => {
    it('should accept password with minimum length', () => {
      const result = simplePasswordSchema.safeParse('12345678');
      expect(result.success).toBe(true);
    });

    it('should reject password shorter than 8 characters', () => {
      const result = simplePasswordSchema.safeParse('1234567');
      expect(result.success).toBe(false);
    });
  });

  describe('nameSchema', () => {
    it('should accept valid name', () => {
      const result = nameSchema.safeParse('John Doe');
      expect(result.success).toBe(true);
    });

    it('should trim whitespace', () => {
      const result = nameSchema.safeParse('  John Doe  ');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('John Doe');
      }
    });

    it('should reject empty name', () => {
      const result = nameSchema.safeParse('');
      expect(result.success).toBe(false);
    });

    it('should reject name longer than 100 characters', () => {
      const longName = 'a'.repeat(101);
      const result = nameSchema.safeParse(longName);
      expect(result.success).toBe(false);
    });
  });

  describe('registerInputSchema', () => {
    it('should accept valid registration input', () => {
      const result = registerInputSchema.safeParse({
        email: 'user@example.com',
        password: 'password123',
        name: 'John Doe',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing email', () => {
      const result = registerInputSchema.safeParse({
        password: 'password123',
        name: 'John Doe',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing password', () => {
      const result = registerInputSchema.safeParse({
        email: 'user@example.com',
        name: 'John Doe',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing name', () => {
      const result = registerInputSchema.safeParse({
        email: 'user@example.com',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('loginInputSchema', () => {
    it('should accept valid login input', () => {
      const result = loginInputSchema.safeParse({
        email: 'user@example.com',
        password: 'password123',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty password', () => {
      const result = loginInputSchema.safeParse({
        email: 'user@example.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('refreshTokenInputSchema', () => {
    it('should accept valid refresh token', () => {
      const result = refreshTokenInputSchema.safeParse({
        refreshToken: 'some-refresh-token',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty refresh token', () => {
      const result = refreshTokenInputSchema.safeParse({
        refreshToken: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('changePasswordInputSchema', () => {
    it('should accept valid change password input', () => {
      const result = changePasswordInputSchema.safeParse({
        currentPassword: 'oldPassword123',
        newPassword: 'newPassword456',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty current password', () => {
      const result = changePasswordInputSchema.safeParse({
        currentPassword: '',
        newPassword: 'newPassword456',
      });
      expect(result.success).toBe(false);
    });

    it('should reject short new password', () => {
      const result = changePasswordInputSchema.safeParse({
        currentPassword: 'oldPassword123',
        newPassword: 'short',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('setPasswordInputSchema', () => {
    it('should accept valid set password input', () => {
      const result = setPasswordInputSchema.safeParse({
        password: 'newPassword123',
      });
      expect(result.success).toBe(true);
    });

    it('should reject short password', () => {
      const result = setPasswordInputSchema.safeParse({
        password: 'short',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('oauthProviderSchema', () => {
    it('should accept google provider', () => {
      const result = oauthProviderSchema.safeParse('google');
      expect(result.success).toBe(true);
    });

    it('should accept github provider', () => {
      const result = oauthProviderSchema.safeParse('github');
      expect(result.success).toBe(true);
    });

    it('should accept microsoft provider', () => {
      const result = oauthProviderSchema.safeParse('microsoft');
      expect(result.success).toBe(true);
    });

    it('should reject invalid provider', () => {
      const result = oauthProviderSchema.safeParse('facebook');
      expect(result.success).toBe(false);
    });
  });

  describe('googleIdTokenInputSchema', () => {
    it('should accept valid id token', () => {
      const result = googleIdTokenInputSchema.safeParse({
        idToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty id token', () => {
      const result = googleIdTokenInputSchema.safeParse({
        idToken: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('oauthCodeInputSchema', () => {
    it('should accept valid code', () => {
      const result = oauthCodeInputSchema.safeParse({
        code: 'authorization-code-123',
      });
      expect(result.success).toBe(true);
    });

    it('should accept code with state', () => {
      const result = oauthCodeInputSchema.safeParse({
        code: 'authorization-code-123',
        state: 'csrf-state-token',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty code', () => {
      const result = oauthCodeInputSchema.safeParse({
        code: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('authUserSchema', () => {
    it('should accept valid auth user', () => {
      const result = authUserSchema.safeParse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        name: 'John Doe',
        emailVerified: true,
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid uuid', () => {
      const result = authUserSchema.safeParse({
        id: 'not-a-uuid',
        email: 'user@example.com',
        name: 'John Doe',
        emailVerified: true,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('tokenPairSchema', () => {
    it('should accept valid token pair', () => {
      const result = tokenPairSchema.safeParse({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
        accessTokenExpiresAt: new Date(),
        refreshTokenExpiresAt: new Date(),
      });
      expect(result.success).toBe(true);
    });

    it('should coerce string dates', () => {
      const result = tokenPairSchema.safeParse({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
        accessTokenExpiresAt: '2024-01-01T00:00:00Z',
        refreshTokenExpiresAt: '2024-01-08T00:00:00Z',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.accessTokenExpiresAt).toBeInstanceOf(Date);
        expect(result.data.refreshTokenExpiresAt).toBeInstanceOf(Date);
      }
    });
  });

  describe('authResultSchema', () => {
    const validAuthResult = {
      user: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        name: 'John Doe',
        emailVerified: true,
      },
      tokens: {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
        accessTokenExpiresAt: new Date(),
        refreshTokenExpiresAt: new Date(),
      },
    };

    it('should accept valid auth result', () => {
      const result = authResultSchema.safeParse(validAuthResult);
      expect(result.success).toBe(true);
    });

    it('should reject missing user', () => {
      const result = authResultSchema.safeParse({
        tokens: validAuthResult.tokens,
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing tokens', () => {
      const result = authResultSchema.safeParse({
        user: validAuthResult.user,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('oauthAuthResultSchema', () => {
    const validOAuthResult = {
      user: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        name: 'John Doe',
        emailVerified: true,
      },
      tokens: {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
        accessTokenExpiresAt: new Date(),
        refreshTokenExpiresAt: new Date(),
      },
      isNewUser: true,
    };

    it('should accept valid OAuth auth result', () => {
      const result = oauthAuthResultSchema.safeParse(validOAuthResult);
      expect(result.success).toBe(true);
    });

    it('should reject missing isNewUser', () => {
      const { isNewUser: _isNewUser, ...withoutIsNewUser } = validOAuthResult;
      const result = oauthAuthResultSchema.safeParse(withoutIsNewUser);
      expect(result.success).toBe(false);
    });
  });
});
