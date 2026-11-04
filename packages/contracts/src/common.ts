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
  z.union([
    z.object({
      success: z.literal(true),
      data: dataSchema,
      meta: z.object({
        timestamp: TimestampSchema,
        requestId: z.string().min(1),
        correlationId: z.string().min(1)
      })
    }),
    z.object({
      success: z.literal(false),
      error: z.object({
        code: z.string().min(1),
        message: z.string().min(1),
        details: z.record(z.unknown()).optional()
      }),
      meta: z.object({
        timestamp: TimestampSchema,
        requestId: z.string().min(1),
        correlationId: z.string().min(1)
      })
    })
  ]);

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
    correlationId: string;
  };
};
