import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, isAccessTokenBlacklisted } from './jwt.js';
import { AuthenticationError } from '../middleware/error-handler.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);

  if (!token) {
    next(new AuthenticationError('No token provided'));
    return;
  }

  // Check if token is blacklisted
  const isBlacklisted = await isAccessTokenBlacklisted(token);
  if (isBlacklisted) {
    next(new AuthenticationError('Token has been revoked'));
    return;
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    next(new AuthenticationError('Invalid or expired token'));
    return;
  }

  req.user = {
    id: payload.userId,
    email: payload.email,
  };

  next();
}

export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractToken(req);

  if (!token) {
    next();
    return;
  }

  const isBlacklisted = await isAccessTokenBlacklisted(token);
  if (isBlacklisted) {
    next();
    return;
  }

  const payload = verifyAccessToken(token);
  if (payload) {
    req.user = {
      id: payload.userId,
      email: payload.email,
    };
  }

  next();
}
