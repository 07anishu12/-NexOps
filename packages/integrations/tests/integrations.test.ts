import { describe, it, expect } from 'vitest';
import {
  MockGmailConnector,
  MockCalendarConnector,
  IntegrationAuthError,
  IntegrationRateLimitError
} from '../src/index.js';

describe('Integrations Package Tests', () => {
  const context = {
    workspaceId: 'w-1',
    runId: 'r-1',
    operationId: 'op-12345'
  };

  it('validates and executes mock Gmail connector successfully', async () => {
    const connector = new MockGmailConnector();
    const result = await connector.execute(
      {
        to: 'lead@customer.com',
        subject: 'Meeting follow up',
        body: 'Thank you for your time.'
      },
      context
    );

    expect(result.messageId).toBe('msg_op-12345');
    expect(result.sentAt).toBeDefined();

    const health = await connector.healthCheck(context);
    expect(health.healthy).toBe(true);
  });

  it('rejects invalid email inputs in mock Gmail connector', async () => {
    const connector = new MockGmailConnector();
    await expect(
      connector.execute(
        {
          to: 'invalid-email',
          subject: 'Hello',
          body: 'World'
        },
        context
      )
    ).rejects.toThrow("Invalid recipient email address 'to'");
  });

  it('validates and executes mock Calendar connector successfully', async () => {
    const connector = new MockCalendarConnector();
    const result = await connector.execute(
      {
        summary: 'Product Demo',
        startTime: '2026-11-02T10:00:00Z',
        endTime: '2026-11-02T11:00:00Z'
      },
      context
    );

    expect(result.eventId).toBe('event_op-12345');
    expect(result.status).toBe('confirmed');
  });

  it('normalizes error classes with retry classification', () => {
    const authErr = new IntegrationAuthError('google');
    expect(authErr.retryable).toBe(false);
    expect(authErr.code).toBe('AUTH_INVALID');

    const rateErr = new IntegrationRateLimitError('meta');
    expect(rateErr.retryable).toBe(true);
    expect(rateErr.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
