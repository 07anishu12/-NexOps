import { describe, it, expect } from 'vitest';
import {
  createWorkspaceContext,
  enforceTenantIsolation,
  createDatabaseClient,
  users,
  workspaces,
  agents,
  runs,
  approvals,
  workspacesRelations,
  agentsRelations
} from '../src/index.js';

describe('Database Package Unit Tests', () => {
  it('creates valid workspace context and enforces tenant filtering', () => {
    const wsId = '22222222-2222-4222-a222-222222222222';
    const ctx = createWorkspaceContext(wsId, '11111111-1111-4111-a111-111111111111', 'admin');
    expect(ctx.workspaceId).toBe(wsId);
    expect(ctx.role).toBe('admin');

    const rawRecords = [
      { id: '1', workspaceId: wsId, data: 'alpha' },
      { id: '2', workspaceId: '99999999-9999-4999-a999-999999999999', data: 'beta' },
      { id: '3', workspaceId: wsId, data: 'gamma' }
    ];

    const filtered = enforceTenantIsolation(rawRecords, ctx);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((r) => r.id)).toEqual(['1', '3']);
  });

  it('rejects invalid or empty workspaceId in createWorkspaceContext', () => {
    expect(() => createWorkspaceContext('')).toThrow('WorkspaceContext requires a valid workspace UUID');
    expect(() => createWorkspaceContext('non-uuid')).toThrow('WorkspaceContext requires a valid workspace UUID');
  });

  it('verifies Drizzle schema tables and relations are properly declared', () => {
    expect(users).toBeDefined();
    expect(workspaces).toBeDefined();
    expect(agents).toBeDefined();
    expect(runs).toBeDefined();
    expect(approvals).toBeDefined();
    expect(workspacesRelations).toBeDefined();
    expect(agentsRelations).toBeDefined();
  });

  it('initializes client with valid databaseUrl', async () => {
    const client = createDatabaseClient({ databaseUrl: 'postgresql://localhost:5432/test' });
    expect(client.isConnected).toBe(true);
    expect(client.isConfigured).toBe(true);
    expect(client.schema.workspaces).toBeDefined();
    await client.close();
  });

  it('assertSafeEnvironment blocks execution when NODE_ENV is production or staging', async () => {
    const { assertSafeEnvironment } = await import('../scripts/db-common.mjs');
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      expect(() => assertSafeEnvironment()).toThrow(/Database development command blocked for production environment/i);

      process.env.NODE_ENV = 'staging';
      expect(() => assertSafeEnvironment()).toThrow(/Database development command blocked for staging environment/i);

      process.env.NODE_ENV = 'development';
      expect(assertSafeEnvironment()).toBe('development');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
