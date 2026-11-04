import { z } from 'zod';
import { IdSchema, TimestampSchema } from './common.js';
import { createHash } from 'crypto';

export const IdempotencyKeySchema = z
  .string()
  .min(16, 'Idempotency key must be at least 16 characters')
  .max(128, 'Idempotency key must not exceed 128 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Idempotency key can only contain alphanumeric characters, underscores, and dashes');

export type IdempotencyKey = z.infer<typeof IdempotencyKeySchema>;

export const IdempotencyStatusSchema = z.enum(['pending', 'completed', 'failed']);
export type IdempotencyStatus = z.infer<typeof IdempotencyStatusSchema>;

export const IdempotencyRecordSchema = z.object({
  key: IdempotencyKeySchema,
  workspaceId: IdSchema,
  operationId: z.string().min(1),
  requestHash: z
    .string()
    .length(64, 'Request hash must be 64-char SHA-256 hex')
    .regex(/^[0-9a-f]{64}$/, 'Request hash must be lowercase SHA-256 hex'),
  status: IdempotencyStatusSchema,
  statusCode: z.number().int().min(100).max(599).optional(),
  responseBody: z.record(z.unknown()).optional(),
  createdAt: TimestampSchema,
  expiresAt: TimestampSchema
});

export type IdempotencyRecord = z.infer<typeof IdempotencyRecordSchema>;

export function computeRequestHash(method: string, path: string, body?: unknown): string {
  const normalizedMethod = method.toUpperCase();
  const normalizedPath = path.toLowerCase();
  const serializedBody = body ? JSON.stringify(body) : '';
  const payload = `${normalizedMethod}:${normalizedPath}:${serializedBody}`;
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}
