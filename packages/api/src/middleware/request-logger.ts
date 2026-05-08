import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

// Extend Express Request to include correlationId
declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      startTime: number;
    }
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // Generate or use existing correlation ID
  const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
  req.correlationId = correlationId;
  req.startTime = Date.now();

  // Set correlation ID in response headers
  res.setHeader('X-Correlation-ID', correlationId);

  // Log request
  logger.http('Incoming request', {
    correlationId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    logger.http('Request completed', {
      correlationId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${String(duration)}ms`,
    });
  });

  next();
}
