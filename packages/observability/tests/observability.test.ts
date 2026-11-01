import { describe, it, expect, vi } from 'vitest';
import { redactValue, createLogger, generateTraceId, generateSpanId } from '../src/index.js';

describe('Observability Package Tests', () => {
  it('redacts sensitive keys in objects', () => {
    const input = {
      username: 'john_doe',
      password: 'super-secret-password-123',
      apiKey: 'sk-123456789012345678901234',
      token: 'eyJhbGciOi...',
      nested: {
        clientSecret: 'secret_value',
        normalField: 'ok'
      }
    };
    const redacted = redactValue(input) as Record<string, any>;
    expect(redacted.username).toBe('john_doe');
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.apiKey).toBe('[REDACTED]');
    expect(redacted.token).toBe('[REDACTED]');
    expect(redacted.nested.clientSecret).toBe('[REDACTED]');
    expect(redacted.nested.normalField).toBe('ok');
  });

  it('redacts bearer tokens in raw strings', () => {
    const message = 'Authorization header: Bearer abc123xyz.token.signature';
    expect(redactValue(message)).toBe('[REDACTED_BEARER_TOKEN]');
  });

  it('generates valid hex trace and span IDs', () => {
    const traceId = generateTraceId();
    const spanId = generateSpanId();
    expect(traceId).toHaveLength(32);
    expect(/^[0-9a-f]{32}$/.test(traceId)).toBe(true);
    expect(spanId).toHaveLength(16);
    expect(/^[0-9a-f]{16}$/.test(spanId)).toBe(true);
  });

  it('logs structured messages with redaction', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger('test-service', 'info');

    logger.info('Test log event', {
      workspaceId: '123',
      apiKey: 'secret-key'
    });

    expect(consoleSpy).toHaveBeenCalled();
    const callArgs = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(callArgs.service).toBe('test-service');
    expect(callArgs.message).toBe('Test log event');
    expect(callArgs.context.workspaceId).toBe('123');
    expect(callArgs.context.apiKey).toBe('[REDACTED]');
    consoleSpy.mockRestore();
  });
});
