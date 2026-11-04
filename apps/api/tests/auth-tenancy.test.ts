import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';
import type { DatabaseClient, ApiKeyContext } from '@agentflow/database';
import { AuthenticationError } from '@agentflow/database';

describe('Authentication & Tenant Context Middleware', () => {
  it('rejects unauthenticated requests to protected endpoints with 401 UNAUTHORIZED', async () => {
    const app = await buildApp({ enableRateLimit: false });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/me'
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(body.error.message).toContain('Authentication required');
    expect(body.meta.requestId).toBeDefined();

    await app.close();
  });

  it('rejects invalid API key header with 401 UNAUTHORIZED', async () => {
    // Mock dbClient whose resolvers reject invalid keys
    const mockDb: Partial<DatabaseClient> = {
      db: {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [] // Key not found
            })
          })
        })
      } as any,
      pool: { query: async () => ({ rows: [] }) } as any
    };

    const app = await buildApp({
      enableRateLimit: false,
      dbClient: mockDb as DatabaseClient
    });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: {
        'x-api-key': 'af_live_invalidkey12345678901234567890'
      }
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');

    await app.close();
  });

  it('populates trusted tenant context on valid API key authentication', async () => {
    const mockApiKeyContext: ApiKeyContext = {
      principalType: 'api_key',
      authMethod: 'api_key_header',
      workspaceId: '11111111-2222-3333-4444-555555555555',
      principalId: 'key-record-id-1234',
      apiKeyId: 'key-record-id-1234',
      displayPrefix: 'af_live_test',
      scopes: ['read', 'write'],
      correlationId: 'req-test-corr-1',
      createdAt: new Date()
    };

    const app = await buildApp({ enableRateLimit: false });

    // Simulate tenant resolution hook decorating request
    app.addHook('preHandler', async (req) => {
      if (req.headers['x-api-key'] === 'af_live_valid_key_12345678') {
        req.tenantContext = mockApiKeyContext;
      }
    });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: {
        'x-api-key': 'af_live_valid_key_12345678'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.workspaceId).toBe(mockApiKeyContext.workspaceId);
    expect(body.data.principalType).toBe('api_key');
    expect(body.data.principalId).toBe(mockApiKeyContext.principalId);

    await app.close();
  });

  it('enforces RBAC role requirement and returns 403 FORBIDDEN when user role is insufficient', async () => {
    const app = await buildApp({ enableRateLimit: false });

    // Register a test route requiring 'admin' or 'owner' role
    app.get('/test-admin-only', {
      preHandler: [app.requireTenantAuth(['admin', 'owner'])],
      handler: async (_req, reply) => reply.send({ success: true })
    });

    // Provide a user with 'viewer' role
    app.addHook('preHandler', async (req) => {
      req.tenantContext = {
        principalType: 'user',
        authMethod: 'session_cookie',
        workspaceId: '11111111-1111-1111-1111-111111111111',
        principalId: 'user-id-viewer',
        userId: 'user-id-viewer',
        email: 'viewer@example.com',
        role: 'viewer',
        sessionId: 'sess-1234',
        correlationId: 'corr-rbac',
        createdAt: new Date()
      };
    });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/test-admin-only'
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toContain('Insufficient workspace permissions');

    await app.close();
  });
});
