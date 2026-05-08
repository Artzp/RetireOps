import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';
import { isProduction } from '../config/index.js';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export class AppError extends Error implements ApiError {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 422, 'UNPROCESSABLE_ENTITY', details);
    this.name = 'UnprocessableEntityError';
  }
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    stack?: string;
  };
  correlationId?: string;
}

export function errorHandler(
  err: Error | ApiError,
  req: Request,
  res: Response,

  _next: NextFunction
): void {
  const correlationId = req.correlationId;

  // Log error
  logger.error('Error occurred', {
    correlationId,
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
      correlationId,
    };
    res.status(400).json(response);
    return;
  }

  // Handle known application errors
  if ('statusCode' in err && 'code' in err) {
    const apiError = err;
    const response: ErrorResponse = {
      success: false,
      error: {
        code: apiError.code ?? 'ERROR',
        message: apiError.message,
        details: apiError.details,
        ...(!isProduction && { stack: err.stack }),
      },
      correlationId,
    };
    res.status(apiError.statusCode ?? 500).json(response);
    return;
  }

  // Handle unknown errors
  const response: ErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction ? 'An unexpected error occurred' : err.message,
      ...(!isProduction && { stack: err.stack }),
    },
    correlationId,
  };
  res.status(500).json(response);
}
