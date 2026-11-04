import { createHash, timingSafeEqual } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { Database, DatabaseClient } from './client.js';
import {
  apiKeys,
  deployments,
  deploymentOrigins,
  runs,
  sessions,
  users,
  widgetSessions,
  workspaceMembers
} from './schema/index.js';
import {
  ApiKeyContext,
  AuthenticationError,
  AuthorizationError,
  TenantNotFoundError,
  WidgetSessionContext,
  WorkerContext,
  WorkspaceUserContext
} from './tenant-context.js';

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function timingSafeMatch(computed: string, expected: string): boolean {
  const bufA = Buffer.from(computed, 'utf8');
  const bufB = Buffer.from(expected, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function normalizeOrigin(origin: string): string {
  try {
    return new URL(origin).origin;
  } catch {
    return origin.toLowerCase().trim();
  }
}

function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  if (allowedOrigins.length === 0) return false;
  if (allowedOrigins.includes('*')) return true;

  const target = normalizeOrigin(origin);
  return allowedOrigins.some((allowed) => {
    try {
      return new URL(allowed).origin === target;
    } catch {
      return allowed.toLowerCase().trim() === target;
    }
  });
}

function getQueryHandle(target: DatabaseClient | Database): Database {
  return 'db' in target ? target.db : target;
}

// ==============================================================================
// 1. Browser User Session Resolver
// ==============================================================================

export interface ResolveSessionParams {
  sessionToken: string;
  requestedWorkspaceId?: string;
  correlationId?: string;
}

export async function resolveSessionContext(
  target: DatabaseClient | Database,
  params: ResolveSessionParams
): Promise<WorkspaceUserContext> {
  if (!params.sessionToken || params.sessionToken.trim().length === 0) {
    throw new AuthenticationError('Session token is required');
  }

  const db = getQueryHandle(target);
  const tokenHash = sha256(params.sessionToken);
  const now = new Date();

  // 1. Resolve session
  const [sessionRecord] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.sessionTokenHash, tokenHash))
    .limit(1);

  if (!sessionRecord) {
    throw new AuthenticationError('Invalid session token');
  }

  if (sessionRecord.revokedAt !== null) {
    throw new AuthenticationError('Session has been revoked');
  }

  if (sessionRecord.expiresAt <= now) {
    throw new AuthenticationError('Session has expired');
  }

  // 2. Resolve user
  const [userRecord] = await db
    .select()
    .from(users)
    .where(eq(users.id, sessionRecord.userId))
    .limit(1);

  if (!userRecord) {
    throw new AuthenticationError('User account associated with session not found');
  }

  // 3. Resolve active workspace
  const targetWorkspaceId = params.requestedWorkspaceId ?? sessionRecord.workspaceId;
  if (!targetWorkspaceId) {
    throw new AuthenticationError('No active workspace selected for this session');
  }

  // 4. Verify workspace membership and effective role
  const [memberRecord] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, targetWorkspaceId),
        eq(workspaceMembers.userId, userRecord.id)
      )
    )
    .limit(1);

  if (!memberRecord) {
    throw new AuthorizationError('User is not an active member of the requested workspace');
  }

  return {
    principalType: 'user',
    authMethod: 'session_cookie',
    workspaceId: targetWorkspaceId,
    principalId: userRecord.id,
    userId: userRecord.id,
    email: userRecord.email,
    role: memberRecord.role,
    sessionId: sessionRecord.id,
    correlationId: params.correlationId ?? `corr-user-${Date.now()}`,
    createdAt: new Date()
  };
}

// ==============================================================================
// 2. Server API Key Resolver
// ==============================================================================

export interface ResolveApiKeyParams {
  plaintextApiKey: string;
  correlationId?: string;
}

export async function resolveApiKeyContext(
  target: DatabaseClient | Database,
  params: ResolveApiKeyParams
): Promise<ApiKeyContext> {
  const rawKey = params.plaintextApiKey?.trim();
  if (!rawKey || (!rawKey.startsWith('af_live_') && !rawKey.startsWith('af_test_'))) {
    throw new AuthenticationError('Invalid API key format');
  }

  const db = getQueryHandle(target);
  const keyHash = sha256(rawKey);
  const now = new Date();

  // Find by hash
  const [keyRecord] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.secretHash, keyHash))
    .limit(1);

  if (!keyRecord || !timingSafeMatch(keyHash, keyRecord.secretHash)) {
    throw new AuthenticationError('Invalid API key');
  }

  // Check revocation, status, and expiration
  if (keyRecord.revokedAt !== null || keyRecord.status === 'revoked') {
    throw new AuthenticationError('API key has been revoked');
  }

  if (keyRecord.status !== 'active') {
    throw new AuthenticationError('API key is inactive or disabled');
  }

  if (keyRecord.expiresAt && keyRecord.expiresAt <= now) {
    throw new AuthenticationError('API key has expired');
  }

  return {
    principalType: 'api_key',
    authMethod: 'api_key_header',
    workspaceId: keyRecord.workspaceId,
    principalId: keyRecord.id,
    apiKeyId: keyRecord.id,
    displayPrefix: keyRecord.displayPrefix,
    scopes: keyRecord.scopes,
    deploymentId: keyRecord.deploymentId ?? undefined,
    correlationId: params.correlationId ?? `corr-api-${Date.now()}`,
    createdAt: new Date()
  };
}

// ==============================================================================
// 3. Public Widget Deployment Session Resolver
// ==============================================================================

export interface ResolveWidgetSessionParams {
  sessionToken: string;
  origin: string;
  correlationId?: string;
}

export async function resolveWidgetSessionContext(
  target: DatabaseClient | Database,
  params: ResolveWidgetSessionParams
): Promise<WidgetSessionContext> {
  if (!params.sessionToken || params.sessionToken.trim().length === 0) {
    throw new AuthenticationError('Widget session token is required');
  }

  if (!params.origin || params.origin.trim().length === 0) {
    throw new AuthorizationError('Origin header is required for widget session authorization');
  }

  const db = getQueryHandle(target);
  const tokenHash = sha256(params.sessionToken);
  const now = new Date();

  // 1. Resolve widget session record
  const [widgetSessionRecord] = await db
    .select()
    .from(widgetSessions)
    .where(eq(widgetSessions.sessionTokenHash, tokenHash))
    .limit(1);

  if (!widgetSessionRecord) {
    throw new AuthenticationError('Invalid widget session token');
  }

  if (widgetSessionRecord.revokedAt !== null) {
    throw new AuthenticationError('Widget session has been revoked');
  }

  if (widgetSessionRecord.expiresAt <= now) {
    throw new AuthenticationError('Widget session has expired');
  }

  // 2. Resolve deployment and ensure active status
  const [deploymentRecord] = await db
    .select()
    .from(deployments)
    .where(
      and(
        eq(deployments.id, widgetSessionRecord.deploymentId),
        eq(deployments.workspaceId, widgetSessionRecord.workspaceId)
      )
    )
    .limit(1);

  if (!deploymentRecord || deploymentRecord.status !== 'active') {
    throw new AuthorizationError('Deployment is inactive, paused, or unavailable');
  }

  // 3. Verify origin against deployment allowlist
  const origins = await db
    .select({ origin: deploymentOrigins.origin })
    .from(deploymentOrigins)
    .where(
      and(
        eq(deploymentOrigins.deploymentId, deploymentRecord.id),
        eq(deploymentOrigins.workspaceId, deploymentRecord.workspaceId),
        eq(deploymentOrigins.status, 'verified')
      )
    );

  const allowedOriginsList = origins.map((o) => o.origin);
  if (!isOriginAllowed(params.origin, allowedOriginsList)) {
    throw new AuthorizationError(`Origin '${params.origin}' is not authorized for this deployment`);
  }

  return {
    principalType: 'widget_session',
    authMethod: 'widget_session_token',
    workspaceId: deploymentRecord.workspaceId,
    principalId: widgetSessionRecord.id,
    widgetSessionId: widgetSessionRecord.id,
    deploymentId: deploymentRecord.id,
    origin: params.origin,
    capabilities: ['run:create', 'run:read', 'conversation:read', 'conversation:write'],
    correlationId: params.correlationId ?? `corr-widget-${Date.now()}`,
    createdAt: new Date()
  };
}

// ==============================================================================
// 4. Internal Worker Run Ownership Resolver
// ==============================================================================

export interface ResolveWorkerParams {
  runId: string;
  leaseOwner?: string;
  correlationId?: string;
}

export async function resolveWorkerContext(
  target: DatabaseClient | Database,
  params: ResolveWorkerParams
): Promise<WorkerContext> {
  if (!params.runId) {
    throw new TenantNotFoundError('runId is required for worker context resolution');
  }

  const db = getQueryHandle(target);

  // Directly resolve workspace from durable PostgreSQL runs table
  const [runRecord] = await db
    .select({
      id: runs.id,
      workspaceId: runs.workspaceId,
      correlationId: runs.correlationId
    })
    .from(runs)
    .where(eq(runs.id, params.runId))
    .limit(1);

  if (!runRecord) {
    throw new TenantNotFoundError(`Durable run record '${params.runId}' not found`);
  }

  return {
    principalType: 'worker',
    authMethod: 'worker_lease',
    workspaceId: runRecord.workspaceId,
    principalId: params.leaseOwner ?? 'worker-node',
    runId: runRecord.id,
    leaseOwner: params.leaseOwner ?? 'worker-node',
    correlationId: params.correlationId ?? runRecord.correlationId,
    createdAt: new Date()
  };
}
