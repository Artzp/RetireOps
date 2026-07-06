import type { Request, Response, NextFunction } from 'express';
import { z, type ZodSchema } from 'zod';
import { ValidationError } from './error-handler.js';

interface ValidateOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validate(schemas: ValidateOptions) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        // Express 5 makes `req.query` a getter-only property, so a direct
        // `req.query = ...` throws "Cannot set property query of
        // #<IncomingMessage> which has only a getter" and 500s every
        // query-validated route. Redefine the property on the request instance
        // instead so downstream handlers still read the parsed/coerced value.
        const parsedQuery = (await schemas.query.parseAsync(req.query)) as typeof req.query;
        Object.defineProperty(req, 'query', {
          value: parsedQuery,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      if (schemas.params) {
        req.params = (await schemas.params.parseAsync(req.params)) as typeof req.params;
      }
      next();
      return;
    } catch (error) {
      // Audit C-12: explicit return after next() — Express 5 best practice to
      // guarantee no code runs after the request has been handed off.
      if (error instanceof z.ZodError) {
        next(new ValidationError('Validation failed', error.issues));
        return;
      }
      next(error);
      return;
    }
  };
}

// Common validation schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
