/* eslint-disable @typescript-eslint/no-misused-promises, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-non-null-assertion */
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
  type Router as RouterType,
} from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation.js';
import { createAuthRateLimiter } from '../middleware/rate-limiter.js';
import { requireAuth } from '../auth/middleware.js';
import { decodeAccessToken } from '../auth/jwt.js';
import { AuthenticationError } from '../middleware/error-handler.js';
import * as authService from '../services/auth.service.js';
import * as googleOAuthService from '../services/google-oauth.service.js';
import { config } from '../config/index.js';

export const authRoutes: RouterType = Router();

// Apply stricter rate limiting to auth routes
authRoutes.use(createAuthRateLimiter());

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  // Optional ISO timestamp captured client-side when the disclaimer checkbox was accepted.
  // The service falls back to NOW() if absent — the UI gates registration on the checkbox,
  // so any successful registration implies acceptance.
  disclaimerAcceptedAt: z.string().datetime().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const setPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// POST /auth/register
authRoutes.post(
  '/register',
  validate({ body: registerSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.register(req.body);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /auth/login
authRoutes.post(
  '/login',
  validate({ body: loginSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.login(req.body);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /auth/refresh
// Note: This route does NOT use requireAuth because the access token may be expired.
// Instead, we decode the expired access token to get the userId, then verify the refresh token.
authRoutes.post(
  '/refresh',
  validate({ body: refreshSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;

      // Extract token from Authorization header (even if expired)
      const authHeader = req.headers.authorization;
      const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

      if (!accessToken) {
        throw new AuthenticationError('Access token is required in Authorization header');
      }

      // Decode (not verify) to get userId - the refresh token is the actual authentication
      const payload = decodeAccessToken(accessToken);
      if (!payload) {
        throw new AuthenticationError('Invalid access token format');
      }

      const tokens = await authService.refreshTokens(payload.userId, refreshToken);
      res.json({
        success: true,
        data: { tokens },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /auth/logout
authRoutes.post('/logout', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accessToken = req.headers.authorization?.replace('Bearer ', '') ?? '';
    const refreshToken = req.body.refreshToken;
    await authService.logout(req.user!.id, accessToken, refreshToken);
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/logout-all
authRoutes.post(
  '/logout-all',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accessToken = req.headers.authorization?.replace('Bearer ', '') ?? '';
      await authService.logoutAllDevices(req.user!.id, accessToken);
      res.json({
        success: true,
        message: 'Logged out from all devices successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /auth/password
authRoutes.put(
  '/password',
  validate({ body: changePasswordSchema }),
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { currentPassword, newPassword } = req.body;
      await authService.changePassword(req.user!.id, currentPassword, newPassword);
      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /auth/password - Set password (for OAuth users without password)
authRoutes.post(
  '/password',
  validate({ body: setPasswordSchema }),
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { password } = req.body;
      await authService.setPassword(req.user!.id, password);
      res.status(201).json({
        success: true,
        message: 'Password set successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== Google OAuth Routes ====================

const googleIdTokenSchema = z.object({
  idToken: z.string().min(1, 'Google ID token is required'),
});

const googleCodeSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
});

// GET /auth/google/url - Get Google OAuth authorization URL
authRoutes.get('/google/url', (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!config.GOOGLE_CLIENT_ID) {
      res.status(501).json({
        success: false,
        error: { message: 'Google OAuth is not configured' },
      });
      return;
    }

    const state = req.query.state as string | undefined;
    const url = googleOAuthService.getGoogleAuthUrl(state);

    res.json({
      success: true,
      data: { url },
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/google/token - Sign in with Google ID token (for mobile/SPA)
authRoutes.post(
  '/google/token',
  validate({ body: googleIdTokenSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!config.GOOGLE_CLIENT_ID) {
        res.status(501).json({
          success: false,
          error: { message: 'Google OAuth is not configured' },
        });
        return;
      }

      const { idToken } = req.body;
      const result = await googleOAuthService.signInWithGoogle(idToken);

      res.status(result.isNewUser ? 201 : 200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /auth/google/callback - Exchange authorization code for tokens (for redirect flow)
authRoutes.post(
  '/google/callback',
  validate({ body: googleCodeSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!config.GOOGLE_CLIENT_ID) {
        res.status(501).json({
          success: false,
          error: { message: 'Google OAuth is not configured' },
        });
        return;
      }

      const { code } = req.body;
      const result = await googleOAuthService.signInWithGoogleCode(code);

      res.status(result.isNewUser ? 201 : 200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /auth/google - Unlink Google account
authRoutes.delete(
  '/google',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await googleOAuthService.unlinkGoogleAccount(req.user!.id);
      res.json({
        success: true,
        message: 'Google account unlinked successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);
