import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import {
  createDatabaseClient,
  createRepositories,
  resolveSessionContext,
  resolveApiKeyContext,
  resolveWidgetSessionContext,
  resolveWorkerContext,
  withWorkspaceAppTransaction,
  resetWorkspaceContext,
  assertContextPermission,
  TenantNotFoundError,
  AuthenticationError,
  AuthorizationError,
  TenantSecurityError,
  WorkspaceUserContext,
  ApiKeyContext,
  WidgetSessionContext,
  type DatabaseClient,
  type Repositories
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

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

describe('Stage 05: Database Access Layer, Tenant Context and RLS Hardening (24 Security Scenarios)', () => {
  let pool: Pool;
  let client: DatabaseClient;
  let repos: Repositories;

  // Test Workspace & User UUIDs
  const wsAlphaId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const wsBetaId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const userAlphaId = '11111111-1111-4111-8111-111111111111';
  const userBetaId = '22222222-2222-4222-8222-222222222222';
  const userCharlieId = '33333333-3333-4333-8333-333333333333';

  // Verified Tenant Contexts
  let contextAlpha: WorkspaceUserContext;
  let contextBeta: WorkspaceUserContext;

  // Shared test entity IDs
  let agentAlphaId: string;
  let deploymentAlphaId: string;
  let conversationAlphaId: string;
  let approvalAlphaId: string;
  let connectionAlphaId: string;
  let runAlphaId: string;

  beforeAll(async () => {
    const url = getDatabaseUrl();
    pool = new Pool({ connectionString: url, max: 10 });
    client = createDatabaseClient({ databaseUrl: url });
    repos = createRepositories(client);

    await cleanupTestData();

    // 1. Seed base users
    await pool.query(
      `INSERT INTO users (id, email, name) VALUES
       ($1, 'alpha-sec@example.invalid', 'Sec Alpha'),
       ($2, 'beta-sec@example.invalid', 'Sec Beta'),
       ($3, 'charlie-sec@example.invalid', 'Sec Charlie')
       ON CONFLICT (id) DO NOTHING`,
      [userAlphaId, userBetaId, userCharlieId]
    );

    // 2. Seed workspaces
    await pool.query(
      `INSERT INTO workspaces (id, name, slug, owner_id, plan) VALUES
       ($1, 'Workspace Security Alpha', 'ws-sec-alpha', $2, 'team'),
       ($3, 'Workspace Security Beta', 'ws-sec-beta', $4, 'pro')
       ON CONFLICT (id) DO NOTHING`,
      [wsAlphaId, userAlphaId, wsBetaId, userBetaId]
    );

    // 3. Seed memberships
    await pool.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
       ($1, $2, 'owner'),
       ($3, $4, 'owner')
       ON CONFLICT (workspace_id, user_id) DO NOTHING`,
      [wsAlphaId, userAlphaId, wsBetaId, userBetaId]
    );

    contextAlpha = {
      principalType: 'user',
      authMethod: 'session_cookie',
      workspaceId: wsAlphaId,
      principalId: userAlphaId,
      userId: userAlphaId,
      email: 'alpha-sec@example.invalid',
      role: 'owner',
      sessionId: 'sess-alpha-001',
      correlationId: 'corr-alpha-001',
      createdAt: new Date()
    };

    contextBeta = {
      principalType: 'user',
      authMethod: 'session_cookie',
      workspaceId: wsBetaId,
      principalId: userBetaId,
      userId: userBetaId,
      email: 'beta-sec@example.invalid',
      role: 'owner',
      sessionId: 'sess-beta-001',
      correlationId: 'corr-beta-001',
      createdAt: new Date()
    };

    // 4. Create initial entities in Workspace Alpha via repositories under contextAlpha
    const agent = await repos.agents.create(contextAlpha, {
      name: 'Alpha Confidential Agent',
      description: 'Agent belonging solely to Workspace Alpha',
      currentDraft: { model: 'gpt-4o', temperature: 0.2 }
    });
    agentAlphaId = agent.id;

    const deployment = await repos.deployments.create(contextAlpha, {
      agentId: agentAlphaId,
      name: 'Alpha Production Web',
      environment: 'production',
      channel: 'web'
    });
    deploymentAlphaId = deployment.id;

    const conversation = await repos.conversations.create(contextAlpha, {
      agentId: agentAlphaId,
      deploymentId: deploymentAlphaId,
      metadata: { classification: 'top-secret' }
    });
    conversationAlphaId = conversation.id;

    const validHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const version = await repos.agents.createVersion(contextAlpha, {
      agentId: agentAlphaId,
      versionNumber: 1,
      configSnapshot: { model: 'gpt-4o', temperature: 0.2 },
      snapshotHash: validHash,
      changelog: 'Initial v1'
    });

    const run = await repos.runs.create(contextAlpha, {
      agentId: agentAlphaId,
      agentVersionId: version.id,
      deploymentId: deploymentAlphaId,
      conversationId: conversationAlphaId,
      inputPrompt: 'Explain quantum computing',
      idempotencyKey: 'idem-run-alpha-001',
      correlationId: 'corr-run-alpha-001',
      initiatorType: 'user',
      initiatorId: userAlphaId
    });
    runAlphaId = run.id;

    const toolOp = await repos.runs.createToolOperation(contextAlpha, {
      runId: runAlphaId,
      operationKey: 'op-alpha-001',
      toolKey: 'fund_transfer',
      payload: { amount: 50000, recipient: 'Acme Corp' },
      payloadHash: validHash
    });

    const approval = await repos.approvals.create(contextAlpha, {
      runId: runAlphaId,
      toolOperationId: toolOp.id,
      toolName: 'fund_transfer',
      riskLevel: 'high_impact',
      payload: { amount: 50000, recipient: 'Acme Corp' },
      payloadHash: validHash,
      expiresAt: new Date(Date.now() + 3600000)
    });
    approvalAlphaId = approval.id;

    const connection = await repos.integrations.createConnection(contextAlpha, {
      provider: 'custom',
      externalAccountRef: 'alpha-bank-acc-001',
      displayName: 'Alpha Bank Integration',
      status: 'connected'
    });
    connectionAlphaId = connection.id;

    await repos.integrations.storeEncryptedCredentials(contextAlpha, {
      connectionId: connectionAlphaId,
      keyReference: 'kms-key-1',
      ciphertext: 'deadbeef12345678',
      iv: 'aabbccddeeff001122334455',
      authTag: '11223344556677889900aabbccddeeff',
      keyVersion: 'v1'
    });

    const account = await repos.billing.getOrCreateAccount(contextAlpha);
    await repos.billing.recordLedgerEntry(contextAlpha, {
      accountId: account.id,
      type: 'grant',
      amount: '1000.0000',
      balanceAfter: '1000.0000',
      idempotencyKey: 'idem-ledger-alpha-001',
      referenceType: 'initial_grant',
      referenceId: wsAlphaId,
      description: 'Initial grant'
    });

    await repos.audit.recordEvent(contextAlpha, {
      action: 'agent.create',
      resourceType: 'agent',
      resourceId: agentAlphaId,
      metadata: { initiator: 'Sec Alpha' }
    });
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
      await pool.query(`DELETE FROM approval_events WHERE workspace_id IN ($1, $2)`, [wsAlphaId, wsBetaId]);
      await pool.query(`DELETE FROM approvals WHERE workspace_id IN ($1, $2)`, [wsAlphaId, wsBetaId]);
      await pool.query(`DELETE FROM run_events WHERE workspace_id IN ($1, $2)`, [wsAlphaId, wsBetaId]);
      await pool.query(`DELETE FROM runs WHERE workspace_id IN ($1, $2)`, [wsAlphaId, wsBetaId]);
      await pool.query(`DELETE FROM messages WHERE workspace_id IN ($1, $2)`, [wsAlphaId, wsBetaId]);
      await pool.query(`DELETE FROM conversations WHERE workspace_id IN ($1, $2)`, [wsAlphaId, wsBetaId]);
      await pool.query(`DELETE FROM encrypted_credentials WHERE workspace_id IN ($1, $2)`, [wsAlphaId, wsBetaId]);
      await pool.query(`DELETE FROM integration_connections WHERE workspace_id IN ($1, $2)`, [wsAlphaId, wsBetaId]);
      await pool.query(`DELETE FROM deployment_origins WHERE workspace_id IN ($1, $2)`, [wsAlphaId, wsBetaId]);
      await pool.query(`DELETE FROM widget_sessions WHERE workspace_id IN ($1, $2)`, [wsAlphaId, wsBetaId]);
      await pool.query(`DELETE FROM api_keys WHERE workspace_id IN ($1, $2)`, [wsAlphaId, wsBetaId]);
      await pool.query(`DELETE FROM deployments WHERE workspace_id IN ($1, $2)`, [wsAlphaId, wsBetaId]);
      await pool.query(`DELETE FROM agent_version_tools WHERE workspace_id IN ($1, $2)`, [wsAlphaId, wsBetaId]);
      await pool.query(`DELETE FROM agent_versions WHERE workspace_id IN ($1, $2)`, [wsAlphaId, wsBetaId]);
      await pool.query(`DELETE FROM agents WHERE workspace_id IN ($1, $2)`, [wsAlphaId, wsBetaId]);
      await pool.query(`DELETE FROM sessions WHERE user_id IN ($1, $2, $3)`, [userAlphaId, userBetaId, userCharlieId]);
      await pool.query(`DELETE FROM workspace_members WHERE workspace_id IN ($1, $2)`, [wsAlphaId, wsBetaId]);
      await pool.query(`DELETE FROM workspaces WHERE id IN ($1, $2)`, [wsAlphaId, wsBetaId]);
      await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3)`, [userAlphaId, userBetaId, userCharlieId]);
    } finally {
      await pool.query(`SET session_replication_role = 'origin'`);
    }
  }

  // ============================================================================
  // Scenario 1: Cross-workspace agent reads
  // ============================================================================
  it('Scenario 1: Cross-workspace agent reads are completely invisible to other tenants', async () => {
    const betaList = await repos.agents.list(contextBeta);
    expect(betaList.some((a) => a.id === agentAlphaId)).toBe(false);

    await expect(repos.agents.findById(contextBeta, agentAlphaId)).rejects.toThrow(TenantNotFoundError);
  });

  // ============================================================================
  // Scenario 2: Cross-workspace deployment reads
  // ============================================================================
  it('Scenario 2: Cross-workspace deployment reads fail and return TenantNotFoundError', async () => {
    const betaDeployments = await repos.deployments.list(contextBeta);
    expect(betaDeployments.some((d) => d.id === deploymentAlphaId)).toBe(false);

    await expect(repos.deployments.findById(contextBeta, deploymentAlphaId)).rejects.toThrow(TenantNotFoundError);
  });

  // ============================================================================
  // Scenario 3: Cross-workspace conversation reads
  // ============================================================================
  it('Scenario 3: Cross-workspace conversation reads fail closed with TenantNotFoundError', async () => {
    const betaConversations = await repos.conversations.list(contextBeta);
    expect(betaConversations.some((c) => c.id === conversationAlphaId)).toBe(false);

    await expect(repos.conversations.findById(contextBeta, conversationAlphaId)).rejects.toThrow(TenantNotFoundError);
  });

  // ============================================================================
  // Scenario 4: Cross-workspace approval access
  // ============================================================================
  it('Scenario 4: Cross-workspace approval query and resolution are rejected', async () => {
    const betaApprovals = await repos.approvals.list(contextBeta);
    expect(betaApprovals.some((ap) => ap.id === approvalAlphaId)).toBe(false);

    await expect(repos.approvals.findById(contextBeta, approvalAlphaId)).rejects.toThrow(TenantNotFoundError);

    await expect(
      repos.approvals.resolve(contextBeta, approvalAlphaId, {
        status: 'approved',
        reason: 'Attempted cross-tenant approval hijack'
      })
    ).rejects.toThrow(TenantNotFoundError);
  });

  // ============================================================================
  // Scenario 5: Cross-workspace integration access
  // ============================================================================
  it('Scenario 5: Cross-workspace integration connections cannot be viewed or accessed', async () => {
    const betaConnections = await repos.integrations.listConnections(contextBeta);
    expect(betaConnections.some((c) => c.id === connectionAlphaId)).toBe(false);

    await expect(repos.integrations.findConnectionById(contextBeta, connectionAlphaId)).rejects.toThrow(TenantNotFoundError);
  });

  // ============================================================================
  // Scenario 6: Cross-workspace credential metadata access
  // ============================================================================
  it('Scenario 6: Cross-workspace encrypted credentials cannot be retrieved', async () => {
    await expect(
      repos.integrations.findEncryptedCredentials(contextBeta, connectionAlphaId)
    ).rejects.toThrow(TenantNotFoundError);
  });

  // ============================================================================
  // Scenario 7: Cross-workspace credit and ledger access
  // ============================================================================
  it('Scenario 7: Cross-workspace billing ledgers and accounts are segregated', async () => {
    const betaEntries = await repos.billing.listLedgerEntries(contextBeta);
    expect(betaEntries.length).toBe(0);

    // Alpha should see its grant
    const alphaEntries = await repos.billing.listLedgerEntries(contextAlpha);
    expect(alphaEntries.length).toBe(1);
    expect(Number(alphaEntries[0]?.amount)).toBe(1000);
  });

  // ============================================================================
  // Scenario 8: Cross-workspace audit access
  // ============================================================================
  it('Scenario 8: Cross-workspace audit log events remain strictly segregated', async () => {
    const betaEvents = await repos.audit.listEvents(contextBeta);
    expect(betaEvents.length).toBe(0);

    const alphaEvents = await repos.audit.listEvents(contextAlpha);
    expect(alphaEvents.length).toBe(1);
    expect(alphaEvents[0]?.action).toBe('agent.create');
  });

  // ============================================================================
  // Scenario 9: Cross-workspace parent-child insertion rejection
  // ============================================================================
  it('Scenario 9: Attempting to insert child records against a cross-workspace parent is rejected', async () => {
    // Attempt to add a message to Alpha's conversation using Beta context
    await expect(
      repos.conversations.addMessage(contextBeta, {
        conversationId: conversationAlphaId,
        role: 'user',
        content: 'Cross-tenant message injection'
      })
    ).rejects.toThrow(TenantNotFoundError);

    // Attempt to create an agent version for Alpha's agent using Beta context
    const validHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    await expect(
      repos.agents.createVersion(contextBeta, {
        agentId: agentAlphaId,
        versionNumber: 2,
        configSnapshot: { test: true },
        snapshotHash: validHash
      })
    ).rejects.toThrow();
  });

  // ============================================================================
  // Scenario 10: Cross-workspace update and deletion rejection
  // ============================================================================
  it('Scenario 10: Cross-workspace entity updates and deletions fail closed', async () => {
    await expect(
      repos.agents.update(contextBeta, agentAlphaId, {
        name: 'Hacked Alpha Name'
      })
    ).rejects.toThrow(TenantNotFoundError);

    await expect(
      repos.agents.archive(contextBeta, agentAlphaId)
    ).rejects.toThrow(TenantNotFoundError);
  });

  // ============================================================================
  // Scenario 11: Missing/invalid context fails closed
  // ============================================================================
  it('Scenario 11: Malformed or unverified context fails immediately before DB query', async () => {
    const invalidContext = {
      workspaceId: 'not-a-uuid',
      role: 'owner'
    } as any;

    await expect(repos.agents.list(invalidContext)).rejects.toThrow(TenantSecurityError);
  });

  // ============================================================================
  // Scenario 12: Revoked session rejection (401)
  // ============================================================================
  it('Scenario 12: Revoked browser session credentials are rejected with 401 AuthenticationError', async () => {
    const rawToken = 'sess_token_revoked_test_123';
    const tokenHash = sha256(rawToken);

    await pool.query(
      `INSERT INTO sessions (id, user_id, workspace_id, session_token_hash, expires_at, revoked_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 hour', NOW())
       ON CONFLICT (id) DO NOTHING`,
      ['51111111-1111-4111-8111-111111111111', userAlphaId, wsAlphaId, tokenHash]
    );

    await expect(
      resolveSessionContext(client, { sessionToken: rawToken })
    ).rejects.toThrow('Session has been revoked');
  });

  // ============================================================================
  // Scenario 13: Expired session rejection (401)
  // ============================================================================
  it('Scenario 13: Expired browser session credentials are rejected with 401 AuthenticationError', async () => {
    const rawToken = 'sess_token_expired_test_456';
    const tokenHash = sha256(rawToken);

    await pool.query(
      `INSERT INTO sessions (id, user_id, workspace_id, session_token_hash, expires_at, revoked_at)
       VALUES ($1, $2, $3, $4, NOW() - INTERVAL '10 minutes', NULL)
       ON CONFLICT (id) DO NOTHING`,
      ['52222222-2222-4222-8222-222222222222', userAlphaId, wsAlphaId, tokenHash]
    );

    await expect(
      resolveSessionContext(client, { sessionToken: rawToken })
    ).rejects.toThrow('Session has expired');
  });

  // ============================================================================
  // Scenario 14: Removed workspace membership rejection (403)
  // ============================================================================
  it('Scenario 14: Valid user session requesting unauthorized workspace is rejected with 403 AuthorizationError', async () => {
    const rawToken = 'sess_token_valid_charlie_789';
    const tokenHash = sha256(rawToken);

    await pool.query(
      `INSERT INTO sessions (id, user_id, workspace_id, session_token_hash, expires_at, revoked_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 hour', NULL)
       ON CONFLICT (id) DO NOTHING`,
      ['53333333-3333-4333-8333-333333333333', userCharlieId, wsAlphaId, tokenHash]
    );

    // Charlie has a valid session token, but has NO membership in Workspace Alpha
    await expect(
      resolveSessionContext(client, {
        sessionToken: rawToken,
        requestedWorkspaceId: wsAlphaId
      })
    ).rejects.toThrow('User is not an active member of the requested workspace');
  });

  // ============================================================================
  // Scenario 15: Invalid API key rejection (401)
  // ============================================================================
  it('Scenario 15: Unknown or malformed API key is rejected with 401 AuthenticationError', async () => {
    await expect(
      resolveApiKeyContext(client, { plaintextApiKey: 'invalid-prefix-key' })
    ).rejects.toThrow(AuthenticationError);

    await expect(
      resolveApiKeyContext(client, { plaintextApiKey: 'af_live_unregistered_key_999999999999' })
    ).rejects.toThrow('Invalid API key');
  });

  // ============================================================================
  // Scenario 16: Revoked API key rejection (401)
  // ============================================================================
  it('Scenario 16: Revoked API key is rejected with 401 AuthenticationError', async () => {
    const rawKey = `af_live_${randomBytes(24).toString('hex')}`;
    const keyHash = sha256(rawKey);

    await pool.query(
      `INSERT INTO api_keys (id, workspace_id, display_prefix, secret_hash, scopes, status, created_by, revoked_at)
       VALUES ($1, $2, 'af_live_rev', $3, '["run:create"]'::jsonb, 'revoked', $4, NOW())`,
      ['a1111111-1111-4111-8111-111111111111', wsAlphaId, keyHash, userAlphaId]
    );

    await expect(
      resolveApiKeyContext(client, { plaintextApiKey: rawKey })
    ).rejects.toThrow('API key has been revoked');
  });

  // ============================================================================
  // Scenario 17: Insufficient API key scope rejection (403)
  // ============================================================================
  it('Scenario 17: API key with narrow scopes is blocked from unauthorized actions (403)', async () => {
    const rawKey = `af_live_${randomBytes(24).toString('hex')}`;
    const keyHash = sha256(rawKey);

    await pool.query(
      `INSERT INTO api_keys (id, workspace_id, display_prefix, secret_hash, scopes, status, created_by)
       VALUES ($1, $2, 'af_live_ro', $3, '["agent:read", "run:read"]'::jsonb, 'active', $4)`,
      ['a2222222-2222-4222-8222-222222222222', wsAlphaId, keyHash, userAlphaId]
    );

    const apiKeyCtx = await resolveApiKeyContext(client, { plaintextApiKey: rawKey });
    expect(apiKeyCtx.scopes).toContain('agent:read');

    // Attempting to create an agent requires 'agent:create'
    expect(() => assertContextPermission(apiKeyCtx, 'agent:create')).toThrow(AuthorizationError);

    // Repository operation requiring 'agent:create' should fail
    await expect(
      repos.agents.create(apiKeyCtx, {
        name: 'Unauthorized Agent Via API Key',
        currentDraft: {}
      })
    ).rejects.toThrow(AuthorizationError);
  });

  // ============================================================================
  // Scenario 18: Forged deployment session rejection (401)
  // ============================================================================
  it('Scenario 18: Forged or non-existent widget session token is rejected with 401', async () => {
    await expect(
      resolveWidgetSessionContext(client, {
        sessionToken: 'forged_widget_token_99999',
        origin: 'https://example.com'
      })
    ).rejects.toThrow('Invalid widget session token');
  });

  // ============================================================================
  // Scenario 19: Expired widget session rejection (401)
  // ============================================================================
  it('Scenario 19: Expired widget session is rejected with 401 AuthenticationError', async () => {
    const rawToken = 'widget_token_expired_123';
    const tokenHash = sha256(rawToken);

    await pool.query(
      `INSERT INTO widget_sessions (id, workspace_id, deployment_id, session_token_hash, origin, expires_at)
       VALUES ($1, $2, $3, $4, 'https://alpha.example.com', NOW() - INTERVAL '10 minutes')`,
      ['c1111111-1111-4111-8111-111111111111', wsAlphaId, deploymentAlphaId, tokenHash]
    );

    await expect(
      resolveWidgetSessionContext(client, {
        sessionToken: rawToken,
        origin: 'https://alpha.example.com'
      })
    ).rejects.toThrow('Widget session has expired');
  });

  // ============================================================================
  // Scenario 20: Unauthorized deployment capability rejection (403)
  // ============================================================================
  it('Scenario 20: Widget session with unapproved origin or attempting unauthorized operations is rejected (403)', async () => {
    const rawToken = 'widget_token_valid_456';
    const tokenHash = sha256(rawToken);

    // Ensure Alpha deployment is active
    await pool.query(`UPDATE deployments SET status = 'active' WHERE id = $1`, [deploymentAlphaId]);

    // Register verified origin for Alpha deployment
    await pool.query(
      `INSERT INTO deployment_origins (id, workspace_id, deployment_id, origin, status)
       VALUES ($1, $2, $3, 'https://approved-site.example.com', 'verified')`,
      ['d1111111-1111-4111-8111-111111111111', wsAlphaId, deploymentAlphaId]
    );

    await pool.query(
      `INSERT INTO widget_sessions (id, workspace_id, deployment_id, session_token_hash, origin, expires_at)
       VALUES ($1, $2, $3, $4, 'https://approved-site.example.com', NOW() + INTERVAL '1 hour')`,
      ['c2222222-2222-4222-8222-222222222222', wsAlphaId, deploymentAlphaId, tokenHash]
    );

    // Origin spoofing / unauthorized origin rejection
    await expect(
      resolveWidgetSessionContext(client, {
        sessionToken: rawToken,
        origin: 'https://malicious-site.example.com'
      })
    ).rejects.toThrow(/is not authorized for this deployment/i);

    // Valid origin succeeds
    const widgetCtx = await resolveWidgetSessionContext(client, {
      sessionToken: rawToken,
      origin: 'https://approved-site.example.com'
    });
    expect(widgetCtx.principalType).toBe('widget_session');

    // Attempting privileged workspace permission as widget visitor is strictly forbidden
    expect(() => assertContextPermission(widgetCtx, 'workspace:delete')).toThrow(AuthorizationError);
    expect(() => assertContextPermission(widgetCtx, 'billing:manage')).toThrow(AuthorizationError);
  });

  // ============================================================================
  // Scenario 21: Queue payload forged workspace ID rejected (worker resolves from durable run)
  // ============================================================================
  it('Scenario 21: Worker context strictly anchors to durable run in PostgreSQL and ignores forged queue workspaceId', async () => {
    // Forged queue payload claiming runAlphaId belongs to Workspace Beta
    const forgedQueueMessage = {
      runId: runAlphaId,
      workspaceId: wsBetaId, // Spoofed workspace
      actor: 'malicious-worker'
    };

    // System resolves context from durable PostgreSQL run record
    const workerCtx = await resolveWorkerContext(client, {
      runId: forgedQueueMessage.runId,
      leaseOwner: 'worker-node-101'
    });

    // The verified workspaceId MUST be wsAlphaId, ignoring the forged wsBetaId
    expect(workerCtx.workspaceId).toBe(wsAlphaId);
    expect(workerCtx.workspaceId).not.toBe(forgedQueueMessage.workspaceId);
    expect(workerCtx.principalType).toBe('worker');
    expect(workerCtx.runId).toBe(runAlphaId);
  });

  // ============================================================================
  // Scenario 22: Connection pool tenant context leakage test
  // ============================================================================
  it('Scenario 22: RLS tenant session variables never leak across pooled connections', async () => {
    // Execute transaction under Workspace Alpha
    await withWorkspaceAppTransaction(client, contextAlpha, async (tx) => {
      const res = await tx.execute('SELECT current_setting(\'app.current_workspace_id\', true) AS ws_id');
      expect((res.rows[0] as any)?.ws_id).toBe(wsAlphaId);
    });

    // Inspect direct pool connection immediately afterwards
    const poolRes = await pool.query(`SELECT current_setting('app.current_workspace_id', true) AS ws_id`);
    const leakedId = poolRes.rows[0]?.ws_id;
    expect(leakedId === '' || leakedId === null || leakedId === undefined).toBe(true);
  });

  // ============================================================================
  // Scenario 23: Transaction rollback test after failed query
  // ============================================================================
  it('Scenario 23: Transaction rolls back completely on error and leaves no dirty state', async () => {
    let abortedAgentId: string | undefined;

    const attemptTx = withWorkspaceAppTransaction(client, contextAlpha, async (tx) => {
      const [newAgent] = await tx
        .insert(client.schema.agents)
        .values({
          workspaceId: wsAlphaId,
          name: 'Agent That Will Abort',
          currentDraft: {},
          createdBy: userAlphaId
        })
        .returning();

      abortedAgentId = newAgent?.id;
      throw new Error('Simulated transaction abortion');
    });

    await expect(attemptTx).rejects.toThrow('Simulated transaction abortion');

    // Verify aborted agent does NOT exist in the database
    if (abortedAgentId) {
      const checkRes = await pool.query(`SELECT id FROM agents WHERE id = $1`, [abortedAgentId]);
      expect(checkRes.rows.length).toBe(0);
    }

    // Pool state remains clean
    const poolCheck = await pool.query(`SELECT current_setting('app.current_workspace_id', true) AS ws_id`);
    expect(poolCheck.rows[0]?.ws_id).toBeFalsy();
  });

  // ============================================================================
  // Scenario 24: Attempt to use reset helpers from wrong path
  // ============================================================================
  it('Scenario 24: Calling resetWorkspaceContext restores default pool state and clears RLS role', async () => {
    await resetWorkspaceContext(client);

    const checkRes = await client.db.execute(
      `SELECT current_setting('app.current_workspace_id', true) AS ws_id, current_user AS active_role`
    );

    const row = checkRes.rows[0] as any;
    expect(row?.ws_id === '' || row?.ws_id === null).toBe(true);
    expect(row?.active_role).not.toBe('agentflow_app');
  });
});
