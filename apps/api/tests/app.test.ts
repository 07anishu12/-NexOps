import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { formatTraceparent } from '@agentflow/contracts';

describe('Fastify Server Core Lifecycle & Middleware', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ enableRateLimit: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET / returns root service discovery metadata', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/'
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.service).toBe('AgentFlow OS REST API');
    expect(body.version).toBe('v1');
    expect(body.docs).toBe('/docs');
  });

  it('GET /unmatched-route returns standard 404 ApiErrorEnvelope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/non-existent-route-404'
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toContain('not found');
    expect(body.meta).toBeDefined();
    expect(body.meta.requestId).toBeDefined();
    expect(body.meta.correlationId).toBeDefined();
    expect(body.meta.timestamp).toBeDefined();
  });

  it('generates unique requestId when omitted, and echoes it in headers and envelope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/'
    });

    const headerReqId = res.headers['x-request-id'];
    const headerCorrId = res.headers['x-correlation-id'];

    expect(headerReqId).toBeDefined();
    expect(headerCorrId).toBeDefined();
    expect(headerCorrId).toBe(headerReqId);
  });

  it('preserves client-supplied x-request-id and x-correlation-id', async () => {
    const customReqId = 'req-client-test-12345';
    const customCorrId = 'corr-client-trace-67890';

    const res = await app.inject({
      method: 'GET',
      url: '/',
      headers: {
        'x-request-id': customReqId,
        'x-correlation-id': customCorrId
      }
    });

    expect(res.headers['x-request-id']).toBe(customReqId);
    expect(res.headers['x-correlation-id']).toBe(customCorrId);
  });

  it('parses and propagates W3C traceparent header', async () => {
    const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    const spanId = '00f067aa0ba902b7';
    const traceparent = formatTraceparent({ traceId, spanId, sampled: true });

    const res = await app.inject({
      method: 'GET',
      url: '/',
      headers: {
        traceparent
      }
    });

    expect(res.headers['traceparent']).toBe(traceparent);
  });

  it('sets secure HTTP response headers via Helmet', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/'
    });

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['strict-transport-security']).toBeDefined();
  });

  it('handles CORS preflight and allowlist correctly', async () => {
    // 1. Preflight OPTIONS request
    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'GET'
      }
    });

    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(preflight.headers['access-control-allow-credentials']).toBe('true');

    // 2. Direct GET with origin header
    const getRes = await app.inject({
      method: 'GET',
      url: '/',
      headers: {
        origin: 'http://localhost:3000'
      }
    });

    expect(getRes.statusCode).toBe(200);
    expect(getRes.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('enforces payload size limits and returns standard error envelope when exceeded', async () => {
    // Build a dedicated app with 1KB limit for fast deterministic test
    const limitedApp = await buildApp({
      enableRateLimit: false,
      config: {
        ...app,
        MAX_ATTACHMENT_BYTES: 1024 // 1KB
      } as any
    });
    await limitedApp.ready();

    const oversizedPayload = 'x'.repeat(2048);
    const res = await limitedApp.inject({
      method: 'POST',
      url: '/v1/agents/validate',
      headers: {
        'content-type': 'application/json'
      },
      payload: JSON.stringify({ data: oversizedPayload })
    });

    expect(res.statusCode).toBe(413);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toContain('exceeded');

    await limitedApp.close();
  });
});
