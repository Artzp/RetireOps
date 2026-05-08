/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */

/**
 * Auth Routes Tests
 *
 * Tests for authentication endpoints including register, login, logout,
 * token refresh, and password management.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import request from 'supertest';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';

// Mock the modules BEFORE importing them
vi.mock('../services/auth.service.js');
vi.mock('../services/google-oauth.service.js');
vi.mock('../middleware/rate-limiter.js', () => ({
  createAuthRateLimiter: () => (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../auth/middleware.js', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    // Simulate authenticated user for protected routes
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  },
}));
vi.mock('../auth/jwt.js', () => ({
  decodeAccessToken: (token: string) => {
    // Return valid payload for 'valid-token', null otherwise
    if (token === 'valid-token') {
      return { userId: 'test-user-id', email: 'test@example.com', type: 'access' };
    }
    return null;
  },
}));
vi.mock('../config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: 'test-google-secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:3000/callback',
  },
  isProduction: false,
  isDevelopment: false,
  isTest: true,
}));
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    http: vi.fn(),
  },
}));

// Import after mocking
import { authRoutes } from './auth.routes.js';
import * as authService from '../services/auth.service.js';
import * as googleOAuthService from '../services/google-oauth.service.js';

// Custom error classes for testing (need to match the structure expected by error handler)
class TestValidationError extends Error {
  statusCode = 400;
  code = 'VALIDATION_ERROR';
  details?: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.details = details;
    this.name = 'ValidationError';
  }
}

class TestAuthenticationError extends Error {
  statusCode = 401;
  code = 'AUTHENTICATION_ERROR';
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

class TestConflictError extends Error {
  statusCode = 409;
  code = 'CONFLICT';
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

// Simple error handler for tests
function testErrorHandler(
  err: Error & { statusCode?: number; code?: string; details?: unknown; issues?: unknown[] },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Handle Zod validation errors
  if (err.name === 'ZodError' && err.issues) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.issues,
      },
    });
    return;
  }

  const statusCode = err.statusCode ?? 500;
  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code ?? 'INTERNAL_ERROR',
      message: err.message,
      details: err.details,
    },
  });
}

// Helper to create test app
function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use(testErrorHandler);
  return app;
}

describe('Auth Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    const validRegisterData = {
      email: 'test@example.com',
      password: 'Password123!',
      name: 'Test User',
    };

    it('should register a new user successfully', async () => {
      const mockResult = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          emailVerified: false,
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          accessTokenExpiresAt: new Date(),
          refreshTokenExpiresAt: new Date(),
        },
      };

      (authService.register as Mock).mockResolvedValue(mockResult);

      const response = await request(app).post('/api/auth/register').send(validRegisterData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(authService.register).toHaveBeenCalledWith(validRegisterData);
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...validRegisterData, email: 'not-an-email' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for short password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...validRegisterData, password: 'short' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for missing name', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'Password123!' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 409 for duplicate email', async () => {
      (authService.register as Mock).mockRejectedValue(
        new TestConflictError('A user with this email already exists')
      );

      const response = await request(app).post('/api/auth/register').send(validRegisterData);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for weak password', async () => {
      (authService.register as Mock).mockRejectedValue(
        new TestValidationError('Password does not meet requirements', [])
      );

      const response = await request(app).post('/api/auth/register').send(validRegisterData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    it('should login successfully', async () => {
      const mockResult = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          emailVerified: true,
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          accessTokenExpiresAt: new Date(),
          refreshTokenExpiresAt: new Date(),
        },
      };

      (authService.login as Mock).mockResolvedValue(mockResult);

      const response = await request(app).post('/api/auth/login').send(validLoginData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(authService.login).toHaveBeenCalledWith(validLoginData);
    });

    it('should return 401 for invalid credentials', async () => {
      (authService.login as Mock).mockRejectedValue(
        new TestAuthenticationError('Invalid email or password')
      );

      const response = await request(app).post('/api/auth/login').send(validLoginData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 for OAuth-only user', async () => {
      (authService.login as Mock).mockRejectedValue(
        new TestAuthenticationError('Please sign in using Google')
      );

      const response = await request(app).post('/api/auth/login').send(validLoginData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: 'password' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for empty password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh tokens successfully', async () => {
      const mockTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        accessTokenExpiresAt: new Date(),
        refreshTokenExpiresAt: new Date(),
      };

      (authService.refreshTokens as Mock).mockResolvedValue(mockTokens);

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', 'Bearer valid-token')
        .send({ refreshToken: 'valid-refresh-token' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.tokens.accessToken).toBe('new-access-token');
    });

    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 for invalid refresh token', async () => {
      (authService.refreshTokens as Mock).mockRejectedValue(
        new TestAuthenticationError('Invalid refresh token')
      );

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', 'Bearer valid-token')
        .send({ refreshToken: 'invalid-refresh-token' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 for missing Authorization header', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'valid-refresh-token' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 for invalid access token format', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', 'Bearer invalid-token')
        .send({ refreshToken: 'valid-refresh-token' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      (authService.logout as Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer valid-token')
        .send({ refreshToken: 'refresh-token' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');
    });

    it('should logout without refresh token', async () => {
      (authService.logout as Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/auth/logout-all', () => {
    it('should logout from all devices successfully', async () => {
      (authService.logoutAllDevices as Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/auth/logout-all')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out from all devices successfully');
    });
  });

  describe('PUT /api/auth/password', () => {
    it('should change password successfully', async () => {
      (authService.changePassword as Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', 'Bearer valid-token')
        .send({
          currentPassword: 'oldPassword123!',
          newPassword: 'newPassword456!',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password changed successfully');
    });

    it('should return 400 for missing current password', async () => {
      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', 'Bearer valid-token')
        .send({ newPassword: 'newPassword456!' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for short new password', async () => {
      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', 'Bearer valid-token')
        .send({
          currentPassword: 'oldPassword123!',
          newPassword: 'short',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 for incorrect current password', async () => {
      (authService.changePassword as Mock).mockRejectedValue(
        new TestAuthenticationError('Current password is incorrect')
      );

      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', 'Bearer valid-token')
        .send({
          currentPassword: 'wrongPassword!',
          newPassword: 'newPassword456!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/password', () => {
    it('should set password for OAuth user successfully', async () => {
      (authService.setPassword as Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/auth/password')
        .set('Authorization', 'Bearer valid-token')
        .send({ password: 'newPassword456!' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password set successfully');
    });

    it('should return 400 for short password', async () => {
      const response = await request(app)
        .post('/api/auth/password')
        .set('Authorization', 'Bearer valid-token')
        .send({ password: 'short' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 if user already has password', async () => {
      (authService.setPassword as Mock).mockRejectedValue(
        new TestValidationError('User already has a password. Use change password instead.')
      );

      const response = await request(app)
        .post('/api/auth/password')
        .set('Authorization', 'Bearer valid-token')
        .send({ password: 'newPassword456!' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/google/url', () => {
    it('should return Google auth URL', async () => {
      (googleOAuthService.getGoogleAuthUrl as Mock).mockReturnValue(
        'https://accounts.google.com/o/oauth2/v2/auth?...'
      );

      const response = await request(app).get('/api/auth/google/url');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.url).toContain('https://accounts.google.com');
    });

    it('should pass state parameter', async () => {
      (googleOAuthService.getGoogleAuthUrl as Mock).mockReturnValue(
        'https://accounts.google.com/o/oauth2/v2/auth?state=test-state'
      );

      const response = await request(app)
        .get('/api/auth/google/url')
        .query({ state: 'test-state' });

      expect(response.status).toBe(200);
      expect(googleOAuthService.getGoogleAuthUrl).toHaveBeenCalledWith('test-state');
    });
  });

  describe('POST /api/auth/google/token', () => {
    it('should sign in with Google ID token successfully', async () => {
      const mockResult = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          emailVerified: true,
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          accessTokenExpiresAt: new Date(),
          refreshTokenExpiresAt: new Date(),
        },
        isNewUser: false,
      };

      (googleOAuthService.signInWithGoogle as Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/auth/google/token')
        .send({ idToken: 'valid-google-id-token' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.isNewUser).toBe(false);
    });

    it('should return 201 for new user', async () => {
      const mockResult = {
        user: {
          id: 'user-123',
          email: 'new@example.com',
          name: 'New User',
          emailVerified: true,
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          accessTokenExpiresAt: new Date(),
          refreshTokenExpiresAt: new Date(),
        },
        isNewUser: true,
      };

      (googleOAuthService.signInWithGoogle as Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/auth/google/token')
        .send({ idToken: 'valid-google-id-token' });

      expect(response.status).toBe(201);
      expect(response.body.data.isNewUser).toBe(true);
    });

    it('should return 400 for missing ID token', async () => {
      const response = await request(app).post('/api/auth/google/token').send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 for invalid Google token', async () => {
      (googleOAuthService.signInWithGoogle as Mock).mockRejectedValue(
        new TestAuthenticationError('Failed to verify Google ID token')
      );

      const response = await request(app)
        .post('/api/auth/google/token')
        .send({ idToken: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/google/callback', () => {
    it('should exchange authorization code successfully', async () => {
      const mockResult = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          emailVerified: true,
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          accessTokenExpiresAt: new Date(),
          refreshTokenExpiresAt: new Date(),
        },
        isNewUser: false,
      };

      (googleOAuthService.signInWithGoogleCode as Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/auth/google/callback')
        .send({ code: 'valid-auth-code' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 for missing code', async () => {
      const response = await request(app).post('/api/auth/google/callback').send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 for invalid code', async () => {
      (googleOAuthService.signInWithGoogleCode as Mock).mockRejectedValue(
        new TestAuthenticationError('Failed to exchange Google authorization code')
      );

      const response = await request(app)
        .post('/api/auth/google/callback')
        .send({ code: 'invalid-code' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/auth/google', () => {
    it('should unlink Google account successfully', async () => {
      (googleOAuthService.unlinkGoogleAccount as Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/auth/google')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Google account unlinked successfully');
    });

    it('should return 400 if cannot unlink (no other auth method)', async () => {
      (googleOAuthService.unlinkGoogleAccount as Mock).mockRejectedValue(
        new TestValidationError('Cannot unlink Google account. Please set a password first.')
      );

      const response = await request(app)
        .delete('/api/auth/google')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
