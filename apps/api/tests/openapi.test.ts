import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

describe('OpenAPI & Swagger Documentation', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ enableRateLimit: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /docs returns 200 or 302 Swagger UI endpoint', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/docs'
    });

    expect([200, 302]).toContain(res.statusCode);
  });

  it('GET /docs/json returns valid OpenAPI 3.0 specification', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/docs/json'
    });

    expect(res.statusCode).toBe(200);
    const spec = res.json();
    expect(spec.openapi).toMatch(/^3\.0\./);
    expect(spec.info.title).toBe('AgentFlow OS REST API');
    expect(spec.info.version).toBe('0.1.0');
    expect(spec.paths).toBeDefined();

    // Verify system endpoints documented
    expect(spec.paths['/health']).toBeDefined();
    expect(spec.paths['/ready']).toBeDefined();
    expect(spec.paths['/v1/']).toBeDefined();

    // Verify security schemes
    expect(spec.components?.securitySchemes?.apiKeyAuth).toBeDefined();
    expect(spec.components?.securitySchemes?.bearerApiKey).toBeDefined();
    expect(spec.components?.securitySchemes?.sessionAuth).toBeDefined();
  });
});
