import { z } from 'zod';
import { TimestampSchema } from './common.js';

export const ErrorCodeSchema = z.enum([
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_ERROR',
  'CONFLICT',
  'RATE_LIMIT_EXCEEDED',
  'QUOTA_EXCEEDED',
  'APPROVAL_REQUIRED',
  'PROVIDER_ERROR',
  'INTERNAL_ERROR'
]);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const FieldErrorDetailSchema = z.object({
  field: z.string(),
  code: z.string(),
  message: z.string()
});

export type FieldErrorDetail = z.infer<typeof FieldErrorDetailSchema>;

export const ApiErrorEnvelopeSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.array(FieldErrorDetailSchema).optional(),
    helpUrl: z.string().url().optional()
  }),
  meta: z.object({
    requestId: z.string(),
    correlationId: z.string().min(1),
    timestamp: TimestampSchema,
    traceId: z.string().optional()
  })
});

export type ApiErrorEnvelope = z.infer<typeof ApiErrorEnvelopeSchema>;

export function createApiErrorEnvelope(params: {
  code: ErrorCode;
  message: string;
  requestId: string;
  correlationId?: string;
  details?: FieldErrorDetail[];
  traceId?: string;
  helpUrl?: string;
}): ApiErrorEnvelope {
  return {
    success: false,
    error: {
      code: params.code,
      message: params.message,
      details: params.details,
      helpUrl: params.helpUrl
    },
    meta: {
      requestId: params.requestId,
      correlationId: params.correlationId ?? params.requestId,
      timestamp: new Date().toISOString(),
      traceId: params.traceId
    }
  };
}
