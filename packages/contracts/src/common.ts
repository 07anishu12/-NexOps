import { z } from 'zod';

export const IdSchema = z.string().uuid({ message: 'Must be a valid UUID' });
export const TimestampSchema = z.string().datetime({ message: 'Must be an ISO 8601 datetime' });

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional()
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const ApiResponseEnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        details: z.record(z.unknown()).optional()
      })
      .optional(),
    meta: z
      .object({
        timestamp: TimestampSchema,
        requestId: z.string()
      })
      .optional()
  });

export type ApiResponseEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    timestamp: string;
    requestId: string;
  };
};
