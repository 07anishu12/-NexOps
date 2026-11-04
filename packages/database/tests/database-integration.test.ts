import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import {
  createDatabaseClient,
  createWorkspaceContext,
  withWorkspaceTransaction,
  withWorkspaceAppTransaction,
  resetWorkspaceContext,
  type DatabaseClient
} from '../src/index.js';

function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const envPath = resolve(process.cwd(), '../../.env');
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed.startsWith('DATABASE_URL=')) {
        return trimmed.slice('DATABASE_URL='.length).replace(/^(['"])(.*)\1$/, '$2');
      }
    }
  } catch {
    // fallback
  }
  return 'postgresql://agentflow:agentflow_password@127.0.0.1:5432/agentflow_dev';
}

describe('PostgreSQL Schema, Migration and Security Integration Tests', () => {
  let pool: Pool;
  let client: DatabaseClient;

  // Test UUIDs
  const userAlphaId = 'a1111111-1111-4111-8111-111111111111';
  const userBetaId = 'b1111111-1111-4111-8111-111111111111';
  const wsAlphaId = 'a0000000-0000-4000-8000-000000000001';
  const wsBetaId = 'b0000000-0000-4000-8000-000000000002';
  const agentAlphaId = 'a2222222-2222-4222-8222-222222222222';
  const agentBetaId = 'b2222222-2222-4222-8222-222222222222';
  const versionAlphaId = 'a3333333-3333-4333-8333-333333333333';
  const accountAlphaId = 'a4444444-4444-4444-8444-444444444444';
  const accountBetaId = 'b4444444-4444-4444-8444-444444444444';
  const validHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  beforeAll(async () => {
    const url = getDatabaseUrl();
    pool = new Pool({ connectionString: url, max: 5 });
    client = createDatabaseClient({ databaseUrl: url });

    // Ensure clean state before tests
    await cleanupTestData();

    // Create baseline users and workspaces
    await pool.query(
      `INSERT INTO users (id, email, name) VALUES
       ($1, 'alpha-owner@example.invalid', 'Alpha Owner'),
       ($2, 'beta-owner@example.invalid', 'Beta Owner')
       ON CONFLICT (id) DO NOTHING`,
      [userAlphaId, userBetaId]
    );

    await pool.query(
      `INSERT INTO workspaces (id, name, slug, owner_id, plan) VALUES
       ($1, 'Workspace Alpha', 'ws-alpha-test', $2, 'team'),
       ($3, 'Workspace Beta', 'ws-beta-test', $4, 'pro')
       ON CONFLICT (id) DO NOTHING`,
      [wsAlphaId, userAlphaId, wsBetaId, userBetaId]
    );

    await pool.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
       ($1, $2, 'owner'),
       ($3, $4, 'owner')
       ON CONFLICT (workspace_id, user_id) DO NOTHING`,
      [wsAlphaId, userAlphaId, wsBetaId, userBetaId]
    );
  });

  afterAll(async () => {
    await cleanupTestData();
    await client.close();
    await pool.end();
  });

  async function cleanupTestData() {
    await pool.query(`SET session_replication_role = 'replica'`);
    try {
      await pool.query(`DELETE FROM audit_events WHERE workspace_id IN ($1, $2)`, [wsAlphaId, wsBetaId]);
      await pool.query(`DELETE FROM payment_events WHERE workspace_id IN ($1, $2)`, [wsAlphaId, wsBetaId]);
      await pool.query(`DELETE FROM credit_ledger_entries WHERE workspace_id IN ($1, $2)`, [wsAlphaId, wsBetaId]);
      await pool.query(`DELETE FROM credit_reservations WHERE workspace_id IN ($1, $2)`, [wsAlphaId, wsBetaId]);
      await pool.query(`DELETE FROM credit_accounts WHERE workspace_id IN ($1, $2)`, [wsAlphaId, wsBetaId]);
      await pool.query(`DELETE FROM agent_versions WHERE workspace_id IN ($1, $2)`, [wsAlphaId, wsBetaId]);
      await pool.query(`DELETE FROM agents WHERE workspace_id IN ($1, $2)`, [wsAlphaId, wsBetaId]);
      await pool.query(`DELETE FROM workspace_members WHERE workspace_id IN ($1, $2)`, [wsAlphaId, wsBetaId]);
      await pool.query(`DELETE FROM workspaces WHERE id IN ($1, $2)`, [wsAlphaId, wsBetaId]);
      await pool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [userAlphaId, userBetaId]);
    } finally {
      await pool.query(`SET session_replication_role = 'origin'`);
    }
  }

  describe('1. Schema Integrity & Table Existence', () => {
    it('verifies all 48 required public tables exist', async () => {
      const res = await pool.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
      );
      const tables = new Set(res.rows.map((r) => r.table_name));

      const expected = [
        'users', 'oauth_accounts', 'sessions', 'workspaces', 'workspace_members', 'workspace_invitations',
        'agents', 'agent_versions', 'agent_evaluation_suites', 'agent_evaluation_cases', 'agent_evaluation_results',
        'tool_definitions', 'agent_version_tools', 'integration_connections', 'encrypted_credentials',
        'deployments', 'deployment_origins', 'deployment_releases', 'api_keys', 'widget_sessions',
        'conversations', 'messages', 'runs', 'run_steps', 'run_events', 'tool_operations', 'approvals', 'approval_events',
        'workflows', 'workflow_versions', 'workflow_triggers', 'workflow_runs', 'knowledge_sources', 'knowledge_chunks',
        'credit_accounts', 'credit_ledger_entries', 'credit_reservations', 'usage_events', 'payment_orders', 'payment_events',
        'webhook_endpoints', 'webhook_deliveries', 'audit_events', 'notifications', 'fde_implementation_records',
        'deployment_readiness_reports', 'deployment_readiness_checks', 'support_access_grants'
      ];

      for (const table of expected) {
        expect(tables.has(table), `Table ${table} should exist`).toBe(true);
      }
    });

    it('verifies 44 workspace-owned tables have Row Level Security enabled', async () => {
      const res = await pool.query(
        `SELECT count(*)::int AS count FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relrowsecurity = true`
      );
      expect(res.rows[0].count).toBe(44);
    });

    it('enforces workspace slug format constraint', async () => {
      const invalidSlug = 'INVALID_SLUG!';
      await expect(
        pool.query(
          `INSERT INTO workspaces (name, slug, owner_id) VALUES ('Invalid', $1, $2)`,
          [invalidSlug, userAlphaId]
        )
      ).rejects.toThrow(/check constraint "workspaces_slug_format"/i);
    });

    it('enforces positive agent version numbers', async () => {
      await expect(
        pool.query(
          `INSERT INTO agent_versions (workspace_id, agent_id, version_number, config_snapshot, snapshot_hash, published_by)
           VALUES ($1, $2, 0, '{}', $3, $4)`,
          [wsAlphaId, agentAlphaId, validHash, userAlphaId]
        )
      ).rejects.toThrow(/check constraint "agent_versions_version_number_positive"/i);
    });

    it('enforces SHA-256 snapshot hash regex format', async () => {
      await expect(
        pool.query(
          `INSERT INTO agent_versions (workspace_id, agent_id, version_number, config_snapshot, snapshot_hash, published_by)
           VALUES ($1, $2, 1, '{}', 'not-a-valid-sha256-hash', $3)`,
          [wsAlphaId, agentAlphaId, userAlphaId]
        )
      ).rejects.toThrow(/check constraint "agent_versions_hash_format"/i);
    });
  });

  describe('2. Row-Level Security & Tenant Isolation', () => {
    beforeAll(async () => {
      // Seed test agents for both workspaces
      await pool.query(
        `INSERT INTO agents (id, workspace_id, name, description, current_draft, created_by) VALUES
         ($1, $2, 'Agent Alpha', 'Alpha agent description', '{"prompt":"alpha"}', $3),
         ($4, $5, 'Agent Beta', 'Beta agent description', '{"prompt":"beta"}', $6)`,
        [agentAlphaId, wsAlphaId, userAlphaId, agentBetaId, wsBetaId, userBetaId]
      );
    });

    it('allows Workspace Alpha to read its own agents under agentflow_app role', async () => {
      const ctx = createWorkspaceContext(wsAlphaId, userAlphaId, 'owner');
      const rows = await withWorkspaceAppTransaction(client, ctx, async (tx) => {
        const res = await tx.execute(sql`SELECT id, name, workspace_id FROM agents`);
        return res.rows;
      });

      expect(rows.length).toBe(1);
      expect((rows[0] as { id: string }).id).toBe(agentAlphaId);
    });

    it('prohibits Workspace Alpha from reading Workspace Beta agents', async () => {
      const ctx = createWorkspaceContext(wsAlphaId, userAlphaId, 'owner');
      const rows = await withWorkspaceAppTransaction(client, ctx, async (tx) => {
        // Specifically try to query Beta's agent ID
        const res = await tx.execute(sql`SELECT * FROM agents WHERE id = ${agentBetaId}`);
        return res.rows;
      });

      expect(rows.length).toBe(0);
    });

    it('prohibits Workspace Alpha from updating Workspace Beta agents', async () => {
      const ctx = createWorkspaceContext(wsAlphaId, userAlphaId, 'owner');
      const updatedCount = await withWorkspaceAppTransaction(client, ctx, async (tx) => {
        const res = await tx.execute(
          sql`UPDATE agents SET name = 'Hacked Agent' WHERE id = ${agentBetaId}`
        );
        return res.rowCount;
      });

      expect(updatedCount).toBe(0);

      // Verify Beta's agent remains untouched in raw query
      const check = await pool.query(`SELECT name FROM agents WHERE id = $1`, [agentBetaId]);
      expect(check.rows[0].name).toBe('Agent Beta');
    });

    it('prohibits Workspace Alpha from deleting Workspace Beta agents', async () => {
      const ctx = createWorkspaceContext(wsAlphaId, userAlphaId, 'owner');
      const deletedCount = await withWorkspaceAppTransaction(client, ctx, async (tx) => {
        const res = await tx.execute(sql`DELETE FROM agents WHERE id = ${agentBetaId}`);
        return res.rowCount;
      });

      expect(deletedCount).toBe(0);

      // Verify Beta's agent still exists
      const check = await pool.query(`SELECT id FROM agents WHERE id = $1`, [agentBetaId]);
      expect(check.rows.length).toBe(1);
    });

    it('fails closed when tenant context is empty or unconfigured under agentflow_app', async () => {
      const result = await client.db.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL ROLE agentflow_app`);
        await tx.execute(sql`SELECT set_config('app.current_workspace_id', '', true)`);
        const res = await tx.execute(sql`SELECT * FROM agents`);
        return res.rows;
      });

      expect(result.length).toBe(0);
    });

    it('blocks cross-tenant foreign key linkage via composite foreign key', async () => {
      // Attempt to link a version in Workspace Alpha to an agent in Workspace Beta
      const crossVersionId = 'a9999999-9999-4999-8999-999999999999';
      await expect(
        pool.query(
          `INSERT INTO agent_versions (id, workspace_id, agent_id, version_number, config_snapshot, snapshot_hash, published_by)
           VALUES ($1, $2, $3, 1, '{"prompt":"cross"}', $4, $5)`,
          [crossVersionId, wsAlphaId, agentBetaId, validHash, userAlphaId]
        )
      ).rejects.toThrow(/agent_versions_workspace_agent_fk/i);
    });
  });

  describe('3. Immutability & Append-Only Triggers', () => {
    beforeAll(async () => {
      // Create published version in Workspace Alpha
      await pool.query(
        `INSERT INTO agent_versions (id, workspace_id, agent_id, version_number, config_snapshot, snapshot_hash, published_by)
         VALUES ($1, $2, $3, 1, '{"model":"gpt-4o"}', $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [versionAlphaId, wsAlphaId, agentAlphaId, validHash, userAlphaId]
      );
    });

    it('blocks UPDATE on published agent_versions with 55000 exception', async () => {
      await expect(
        pool.query(
          `UPDATE agent_versions SET changelog = 'Tampered' WHERE id = $1`,
          [versionAlphaId]
        )
      ).rejects.toThrow(/Append-only evidence table .*agent_versions cannot be updated or deleted/i);
    });

    it('blocks DELETE on published agent_versions with 55000 exception', async () => {
      await expect(
        pool.query(`DELETE FROM agent_versions WHERE id = $1`, [versionAlphaId])
      ).rejects.toThrow(/Append-only evidence table .*agent_versions cannot be updated or deleted/i);
    });

    it('blocks UPDATE on audit_events with 55000 exception', async () => {
      const auditId = 'a5555555-5555-4555-8555-555555555555';
      await pool.query(
        `INSERT INTO audit_events (id, workspace_id, actor_type, actor_id, action, resource_type, resource_id)
         VALUES ($1, $2, 'user', $3, 'agent.create', 'agent', $4)`,
        [auditId, wsAlphaId, userAlphaId, agentAlphaId]
      );

      await expect(
        pool.query(`UPDATE audit_events SET action = 'tampered' WHERE id = $1`, [auditId])
      ).rejects.toThrow(/Append-only evidence table .*audit_events cannot be updated or deleted/i);
    });
  });

  describe('4. Financial Integrity & Idempotency Constraints', () => {
    beforeAll(async () => {
      await pool.query(
        `INSERT INTO credit_accounts (id, workspace_id, currency, cached_balance) VALUES
         ($1, $2, 'credits', 500.000000),
         ($3, $4, 'credits', 250.000000)
         ON CONFLICT (id) DO NOTHING`,
        [accountAlphaId, wsAlphaId, accountBetaId, wsBetaId]
      );
    });

    it('rejects duplicate credit_ledger_entries idempotency key within workspace', async () => {
      const entryId1 = 'a6666666-6666-4666-8666-666666666661';
      const entryId2 = 'a6666666-6666-4666-8666-666666666662';
      const sharedKey = 'idem-grant-alpha-001';

      await pool.query(
        `INSERT INTO credit_ledger_entries
         (id, workspace_id, account_id, type, amount, balance_after, idempotency_key, reference_type, reference_id, description)
         VALUES ($1, $2, $3, 'grant', 100.000000, 600.000000, $4, 'manual_grant', 'ref-01', 'Initial grant')`,
        [entryId1, wsAlphaId, accountAlphaId, sharedKey]
      );

      // Attempt second insert with same idempotency key
      await expect(
        pool.query(
          `INSERT INTO credit_ledger_entries
           (id, workspace_id, account_id, type, amount, balance_after, idempotency_key, reference_type, reference_id, description)
           VALUES ($1, $2, $3, 'grant', 50.000000, 650.000000, $4, 'manual_grant', 'ref-02', 'Second grant')`,
          [entryId2, wsAlphaId, accountAlphaId, sharedKey]
        )
      ).rejects.toThrow(/credit_ledger_workspace_idempotency_unique/i);
    });

    it('rejects duplicate payment_events provider_event_id globally', async () => {
      const eventId1 = 'a7777777-7777-4777-8777-777777777771';
      const eventId2 = 'a7777777-7777-4777-8777-777777777772';
      const providerEventRef = 'pay_evt_razorpay_99999';

      await pool.query(
        `INSERT INTO payment_events
         (id, workspace_id, provider, provider_event_id, signature_verified, payload_hash, raw_payload, status)
         VALUES ($1, $2, 'razorpay', $3, true, $4, '{"event":"payment.captured"}', 'received')`,
        [eventId1, wsAlphaId, providerEventRef, validHash]
      );

      await expect(
        pool.query(
          `INSERT INTO payment_events
           (id, workspace_id, provider, provider_event_id, signature_verified, payload_hash, raw_payload, status)
           VALUES ($1, $2, 'razorpay', $3, true, $4, '{"event":"payment.captured"}', 'received')`,
          [eventId2, wsBetaId, providerEventRef, validHash]
        )
      ).rejects.toThrow(/payment_events_provider_event_unique/i);
    });

    it('rejects non-positive credit reservation amounts', async () => {
      const resId = 'a8888888-8888-4888-8888-888888888888';
      await expect(
        pool.query(
          `INSERT INTO credit_reservations
           (id, workspace_id, account_id, reservation_key, held_amount, status, expires_at)
           VALUES ($1, $2, $3, 'hold-zero', 0, 'held', NOW() + INTERVAL '1 hour')`,
          [resId, wsAlphaId, accountAlphaId]
        )
      ).rejects.toThrow(/credit_reservations_amounts_valid/i);
    });

    it('rejects negative balance in credit_accounts', async () => {
      await expect(
        pool.query(
          `UPDATE credit_accounts SET cached_balance = -10.000000 WHERE id = $1`,
          [accountAlphaId]
        )
      ).rejects.toThrow(/credit_accounts_cached_balance_non_negative/i);
    });
  });

  describe('5. Transaction Rollback & Pool Context Reset', () => {
    it('rolls back all writes when a multi-table transaction errors', async () => {
      const rollbackAgentId = 'a9999999-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const ctx = createWorkspaceContext(wsAlphaId, userAlphaId, 'owner');

      await expect(
        withWorkspaceTransaction(client, ctx, async (tx) => {
          await tx.execute(
            sql`INSERT INTO agents (id, workspace_id, name, description, current_draft, created_by)
                VALUES (${rollbackAgentId}, ${wsAlphaId}, 'Will Rollback', 'Desc', '{"draft":1}'::jsonb, ${userAlphaId})`
          );
          // Intentional failure: invalid slug
          await tx.execute(
            sql`INSERT INTO workspaces (id, name, slug, owner_id) VALUES (gen_random_uuid(), 'Fail', 'BAD_SLUG!', ${userAlphaId})`
          );
        })
      ).rejects.toThrow();

      // Verify agent was NOT persisted
      const check = await pool.query(`SELECT id FROM agents WHERE id = $1`, [rollbackAgentId]);
      expect(check.rows.length).toBe(0);
    });

    it('resets tenant context safely using resetWorkspaceContext', async () => {
      const ctx = createWorkspaceContext(wsAlphaId, userAlphaId, 'owner');
      // Set session context
      await client.db.execute(sql`SELECT set_config('app.current_workspace_id', ${ctx.workspaceId}, false)`);

      const before = await client.db.execute(sql`SELECT current_setting('app.current_workspace_id', true) AS ws`);
      expect((before.rows[0] as { ws: string }).ws).toBe(wsAlphaId);

      // Reset
      await resetWorkspaceContext(client);

      const after = await client.db.execute(sql`SELECT current_setting('app.current_workspace_id', true) AS ws`);
      expect((after.rows[0] as { ws: string }).ws).toBe('');
    });
  });

  describe('6. Foreign Key Deletion Policies and Safety Invariants', () => {
    it('blocks deletion of workspace owner via ON DELETE RESTRICT on workspaces', async () => {
      await expect(
        pool.query(`DELETE FROM users WHERE id = $1`, [userAlphaId])
      ).rejects.toThrow(/update or delete on table "users" violates foreign key constraint/i);
    });

    it('rejects settled_amount greater than held_amount in credit_reservations', async () => {
      const resId = 'a8888888-8888-4888-8888-888888888889';
      await expect(
        pool.query(
          `INSERT INTO credit_reservations
           (id, workspace_id, account_id, reservation_key, held_amount, settled_amount, status, expires_at)
           VALUES ($1, $2, $3, 'hold-oversettle', 10.000000, 20.000000, 'settled', NOW() + INTERVAL '1 hour')`,
          [resId, wsAlphaId, accountAlphaId]
        )
      ).rejects.toThrow(/credit_reservations_settled_within_hold/i);
    });
  });
});
