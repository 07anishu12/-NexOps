import { z } from 'zod';
import { IdSchema, TimestampSchema } from './common.js';
import { CorrelationIdSchema } from './api.js';

export const EventVersionSchema = z.literal(1);

export const EventTypeSchema = z.enum([
  'run.queued',
  'run.started',
  'run.completed',
  'run.failed',
  'run.cancelled',
  'run.step.started',
  'run.step.completed',
  'run.step.failed',
  'assistant.delta',
  'assistant.message.completed',
  'tool.proposed',
  'tool.denied',
  'tool.started',
  'tool.completed',
  'tool.failed',
  'approval.requested',
  'approval.approved',
  'approval.rejected',
  'approval.expired',
  'deployment.published',
  'deployment.rolled_back',
  'deployment.health_changed',
  'usage.reserved',
  'usage.settled',
  'usage.released'
]);

export const EventEnvelopeSchema = z.object({
  version: EventVersionSchema,
  id: IdSchema,
  workspaceId: IdSchema,
  runId: IdSchema,
  correlationId: CorrelationIdSchema,
  type: EventTypeSchema,
  sequence: z.number().int().nonnegative(),
  timestamp: TimestampSchema,
  data: z.record(z.unknown())
});

export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
