import { z } from 'zod';
import { IdSchema, TimestampSchema } from './common.js';
import { IdempotencyKeySchema } from './idempotency.js';
import { TraceIdSchema, W3cTraceparentSchema } from './tracing.js';

export const CorrelationIdSchema = z.string().min(1).max(128);

export const ApiRequestContextSchema = z.object({
  requestId: z.string().min(1).max(128),
  correlationId: CorrelationIdSchema,
  traceparent: W3cTraceparentSchema.optional(),
  idempotencyKey: IdempotencyKeySchema.optional()
});

export type ApiRequestContext = z.infer<typeof ApiRequestContextSchema>;

export const ApiResponseMetaSchema = z.object({
  requestId: z.string().min(1),
  correlationId: CorrelationIdSchema,
  timestamp: TimestampSchema,
  traceId: TraceIdSchema.optional()
});

export const ApiSuccessEnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: ApiResponseMetaSchema
  });

export type ApiSuccessEnvelope<T> = {
  success: true;
  data: T;
  meta: z.infer<typeof ApiResponseMetaSchema>;
};

export const CreateAgentRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  systemPrompt: z.string().min(1),
  provider: z.enum(['openai', 'anthropic', 'gemini', 'groq', 'mock']).optional(),
  model: z.string().min(1).optional(),
  allowedTools: z.array(z.string().min(1)).optional()
});

export type CreateAgentRequest = z.infer<typeof CreateAgentRequestSchema>;

export const CreateRunRequestSchema = z.object({
  agentId: IdSchema,
  deploymentId: IdSchema.optional(),
  inputPrompt: z.string().min(1).max(100_000),
  idempotencyKey: IdempotencyKeySchema
});

export type CreateRunRequest = z.infer<typeof CreateRunRequestSchema>;
