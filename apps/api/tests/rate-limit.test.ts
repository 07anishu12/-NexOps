import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';

describe('Distributed Rate Limiting Plugin', () => {
  it('enforces rate limits and returns standard 429 ApiErrorEnvelope on limit exhaustion', async () => {
    // Configure an app with max 2 requests per minute
    const app = await buildApp({
      enableRateLimit: true,
      config: {
        DEFAULT_PUBLIC_RATE_LIMIT: 2
      } as any
    });
    await app.ready();

    // Request 1: Permitted
    const res1 = await app.inject({
      method: 'GET',
      url: '/health'
    });
    expect(res1.statusCode).toBe(200);
    expect(Number(res1.headers['x-ratelimit-remaining'])).toBe(1);

    // Request 2: Permitted, exhaustion reached
    const res2 = await app.inject({
      method: 'GET',
      url: '/health'
    });
    expect(res2.statusCode).toBe(200);
    expect(Number(res2.headers['x-ratelimit-remaining'])).toBe(0);

    // Request 3: Exceeded -> 429
    const res3 = await app.inject({
      method: 'GET',
      url: '/health'
    });
    expect(res3.statusCode).toBe(429);
    expect(Number(res3.headers['x-ratelimit-remaining'])).toBe(0);
    expect(res3.headers['retry-after']).toBeDefined();

    const body = res3.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(body.error.message).toContain('retry');
    expect(body.meta).toBeDefined();
    expect(body.meta.requestId).toBeDefined();

    await app.close();
  });
});
