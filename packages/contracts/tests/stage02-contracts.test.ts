import { describe, it, expect } from 'vitest';
import {
  IdempotencyKeySchema,
  IdempotencyRecordSchema,
  computeRequestHash,
  TraceIdSchema,
  SpanIdSchema,
  W3cTraceparentSchema,
  parseTraceparent,
  formatTraceparent,
  ErrorCodeSchema,
  ApiErrorEnvelopeSchema,
  createApiErrorEnvelope,
  PaginationParamsSchema,
  createPaginationMeta,
  PaginatedResultSchema,
  UserSchema
} from '../src/index.js';

describe('Stage 02 Contracts & Architecture Primitives', () => {
  describe('Idempotency Contracts', () => {
    it('accepts valid alphanumeric and hyphenated idempotency keys >= 16 chars', () => {
      const validKey = 'idem_req_abc1234567890';
      expect(IdempotencyKeySchema.parse(validKey)).toBe(validKey);
    });

    it('rejects keys that are too short (< 16 chars) or contain special characters', () => {
      expect(() => IdempotencyKeySchema.parse('short_key')).toThrow();
      expect(() => IdempotencyKeySchema.parse('invalid@key!with#special$chars')).toThrow();
    });

    it('computes deterministic SHA-256 request hashes', () => {
      const hash1 = computeRequestHash('POST', '/api/v1/runs', { agentId: 'a1', prompt: 'test' });
      const hash2 = computeRequestHash('post', '/api/v1/runs', { agentId: 'a1', prompt: 'test' });
      const hashDiff = computeRequestHash('POST', '/api/v1/runs', { agentId: 'a1', prompt: 'other' });

      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2); // Method and path case normalization
      expect(hash1).not.toBe(hashDiff);
    });

    it('validates a complete IdempotencyRecord DTO', () => {
      const record = {
        key: 'idem_long_key_1234567890',
        workspaceId: '11111111-1111-4111-a111-111111111111',
        operationId: 'op-001',
        requestHash: 'a'.repeat(64),
        status: 'completed' as const,
        statusCode: 200,
        responseBody: { success: true },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString()
      };
      expect(IdempotencyRecordSchema.parse(record).status).toBe('completed');
    });
  });

  describe('Tracing Contracts & W3C Traceparent', () => {
    it('validates 32-hex traceId and 16-hex spanId', () => {
      const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
      const spanId = '00f067aa0ba902b7';
      expect(TraceIdSchema.parse(traceId)).toBe(traceId);
      expect(SpanIdSchema.parse(spanId)).toBe(spanId);
      expect(() => TraceIdSchema.parse('short')).toThrow();
    });

    it('formats and parses W3C traceparent headers correctly', () => {
      const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
      const spanId = '00f067aa0ba902b7';

      const formatted = formatTraceparent({ traceId, spanId, sampled: true });
      expect(formatted).toBe(`00-${traceId}-${spanId}-01`);
      expect(W3cTraceparentSchema.parse(formatted)).toBe(formatted);

      const parsed = parseTraceparent(formatted);
      expect(parsed).not.toBeNull();
      expect(parsed?.traceId).toBe(traceId);
      expect(parsed?.spanId).toBe(spanId);
      expect(parsed?.sampled).toBe(true);
    });

    it('returns null on invalid traceparent format', () => {
      expect(parseTraceparent('invalid-header')).toBeNull();
      expect(parseTraceparent('00-badtraceid-badspan-01')).toBeNull();
    });
  });

  describe('Error Model & Normalized Envelopes', () => {
    it('validates error codes and creates normalized error envelopes', () => {
      expect(ErrorCodeSchema.parse('UNAUTHORIZED')).toBe('UNAUTHORIZED');
      expect(ErrorCodeSchema.parse('RATE_LIMIT_EXCEEDED')).toBe('RATE_LIMIT_EXCEEDED');
      expect(() => ErrorCodeSchema.parse('RANDOM_CODE')).toThrow();

      const envelope = createApiErrorEnvelope({
        code: 'VALIDATION_ERROR',
        message: 'Invalid input payload',
        requestId: 'req-12345',
        details: [{ field: 'email', code: 'INVALID_FORMAT', message: 'Must be an email' }]
      });

      expect(envelope.success).toBe(false);
      expect(envelope.error.code).toBe('VALIDATION_ERROR');
      expect(envelope.error.details).toHaveLength(1);
      expect(ApiErrorEnvelopeSchema.parse(envelope).meta.requestId).toBe('req-12345');
    });
  });

  describe('Pagination Contracts', () => {
    it('parses pagination parameters and applies defaults', () => {
      const parsed = PaginationParamsSchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(20);
      expect(parsed.sortOrder).toBe('desc');
    });

    it('calculates pagination metadata correctly (hasNext, hasPrev, totalPages)', () => {
      const page1 = createPaginationMeta({ page: 1, limit: 10, totalItems: 25 });
      expect(page1.totalPages).toBe(3);
      expect(page1.hasNext).toBe(true);
      expect(page1.hasPrev).toBe(false);

      const page2 = createPaginationMeta({ page: 2, limit: 10, totalItems: 25 });
      expect(page2.hasNext).toBe(true);
      expect(page2.hasPrev).toBe(true);

      const page3 = createPaginationMeta({ page: 3, limit: 10, totalItems: 25 });
      expect(page3.hasNext).toBe(false);
      expect(page3.hasPrev).toBe(true);
    });

    it('validates PaginatedResult generic schema envelope', () => {
      const schema = PaginatedResultSchema(UserSchema);
      const data = {
        items: [
          {
            id: '11111111-1111-4111-a111-111111111111',
            email: 'admin@agentflow.io',
            name: 'Admin',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        pagination: createPaginationMeta({ page: 1, limit: 10, totalItems: 1 })
      };
      expect(schema.parse(data).items).toHaveLength(1);
    });
  });
});
