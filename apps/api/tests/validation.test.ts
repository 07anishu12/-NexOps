import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import type { WorkspaceUserContext } from '@agentflow/database';

describe('API Request Validation & Error Envelopes', () => {
  let app: FastifyInstance;

  // Mock authenticated tenant context for validation tests
  const mockTenantContext: WorkspaceUserContext = {
    principalType: 'user',
    authMethod: 'session_cookie',
    workspaceId: '11111111-1111-1111-1111-111111111111',
    principalId: '22222222-2222-2222-2222-222222222222',
    userId: '22222222-2222-2222-2222-222222222222',
    email: 'developer@example.com',
    role: 'owner',
    sessionId: '33333333-3333-3333-3333-333333333333',
    correlationId: 'test-corr-id',
    createdAt: new Date()
  };

  beforeAll(async () => {
    app = await buildApp({ enableRateLimit: false });
    // Hook in test tenant context for these validation tests
    app.addHook('preHandler', async (req) => {
      req.tenantContext = mockTenantContext;
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /v1/agents/validate returns 200 with ApiSuccessEnvelope on valid agent payload', async () => {
    const validPayload = {
      name: 'Customer Support Lead',
      description: 'Handles support inquiries',
      systemPrompt: 'You are a courteous support agent.',
      provider: 'openai',
      model: 'gpt-4o',
      allowedTools: ['knowledge_search', 'create_ticket']
    };

    const res = await app.inject({
      method: 'POST',
      url: '/v1/agents/validate',
      headers: {
        'content-type': 'application/json'
      },
      payload: JSON.stringify(validPayload)
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.valid).toBe(true);
    expect(body.data.agent.name).toBe(validPayload.name);
    expect(body.meta).toBeDefined();
    expect(body.meta.requestId).toBeDefined();
  });

  it('POST /v1/agents/validate returns 400 VALIDATION_ERROR with field details on invalid payload', async () => {
    const invalidPayload = {
      // missing 'name' and 'systemPrompt'
      provider: 'invalid-provider-xyz'
    };

    const res = await app.inject({
      method: 'POST',
      url: '/v1/agents/validate',
      headers: {
        'content-type': 'application/json'
      },
      payload: JSON.stringify(invalidPayload)
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Request validation failed');
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details.length).toBeGreaterThan(0);

    const fieldNames = body.error.details.map((d: any) => d.field);
    expect(fieldNames).toContain('name');
    expect(fieldNames).toContain('systemPrompt');
  });

  it('POST /v1/runs/validate returns 400 when UUID fields are malformed', async () => {
    const malformedRunPayload = {
      agentId: 'not-a-valid-uuid',
      inputPrompt: 'Run prompt here',
      idempotencyKey: 'valid-idemp-key-12345'
    };

    const res = await app.inject({
      method: 'POST',
      url: '/v1/runs/validate',
      headers: {
        'content-type': 'application/json'
      },
      payload: JSON.stringify(malformedRunPayload)
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    const agentIdDetail = body.error.details.find((d: any) => d.field === 'agentId');
    expect(agentIdDetail).toBeDefined();
    expect(agentIdDetail.message).toContain('UUID');
  });
});
