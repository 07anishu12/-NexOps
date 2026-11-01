import { describe, it, expect } from 'vitest';
import {
  createWorkspaceContext,
  enforceTenantIsolation,
  createDatabaseClient,
  users,
  workspaces,
  agents,
  runs,
  approvals
} from '../src/index.js';

describe('Database Package Tests', () => {
  it('creates valid workspace context and enforces tenant filtering', () => {
    const ctx = createWorkspaceContext('ws-100', 'usr-1', 'admin');
    expect(ctx.workspaceId).toBe('ws-100');
    expect(ctx.role).toBe('admin');

    const rawRecords = [
      { id: '1', workspaceId: 'ws-100', data: 'alpha' },
      { id: '2', workspaceId: 'ws-200', data: 'beta' },
      { id: '3', workspaceId: 'ws-100', data: 'gamma' }
    ];

    const filtered = enforceTenantIsolation(rawRecords, ctx);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((r) => r.id)).toEqual(['1', '3']);
  });

  it('rejects empty workspaceId in createWorkspaceContext', () => {
    expect(() => createWorkspaceContext('')).toThrow(
      'WorkspaceContext requires a valid, non-empty workspaceId'
    );
  });

  it('verifies Drizzle schema tables are properly declared', () => {
    expect(users).toBeDefined();
    expect(workspaces).toBeDefined();
    expect(agents).toBeDefined();
    expect(runs).toBeDefined();
    expect(approvals).toBeDefined();
  });

  it('initializes client with valid databaseUrl', () => {
    const client = createDatabaseClient({ databaseUrl: 'postgresql://localhost:5432/test' });
    expect(client.isConnected).toBe(true);
    expect(client.schema.workspaces).toBeDefined();
  });
});
