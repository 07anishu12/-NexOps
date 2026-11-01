import { z } from 'zod';

export const TraceIdSchema = z.string().length(32).regex(/^[0-9a-f]{32}$/, 'Trace ID must be 32 hex characters');
export const SpanIdSchema = z.string().length(16).regex(/^[0-9a-f]{16}$/, 'Span ID must be 16 hex characters');

export const W3cTraceparentSchema = z
  .string()
  .regex(/^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/, 'Invalid W3C traceparent format (00-traceId-spanId-flags)');

export const TraceContextSchema = z.object({
  traceId: TraceIdSchema,
  spanId: SpanIdSchema,
  parentSpanId: SpanIdSchema.optional(),
  sampled: z.boolean().default(true),
  correlationId: z.string().optional()
});

export type TraceContext = z.infer<typeof TraceContextSchema>;

export function parseTraceparent(header: string): TraceContext | null {
  const match = header.trim().match(/^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/);
  if (!match) return null;

  const [, traceId, spanId, flags] = match;
  if (!traceId || !spanId || !flags) return null;

  return {
    traceId,
    spanId,
    sampled: flags === '01'
  };
}

export function formatTraceparent(context: { traceId: string; spanId: string; sampled?: boolean }): string {
  const flags = context.sampled !== false ? '01' : '00';
  return `00-${context.traceId}-${context.spanId}-${flags}`;
}
