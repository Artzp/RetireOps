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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        req.query = await schemas.query.parseAsync(req.query);
      }
      if (schemas.params) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        req.params = await schemas.params.parseAsync(req.params);
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new ValidationError('Validation failed', error.errors));
      } else {
        next(error);
      }
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
