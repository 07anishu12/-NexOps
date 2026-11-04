import { WorkspaceRole } from '@agentflow/contracts';
import { hasPermission, Permission } from '@agentflow/auth';
import { sql } from 'drizzle-orm';
import type { DatabaseClient, Database } from './client.js';

// ==============================================================================
// 1. Errors and Security Normalization
// ==============================================================================

export class TenantSecurityError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'TenantSecurityError';
    this.statusCode = statusCode;
  }
}

export class AuthenticationError extends TenantSecurityError {
  constructor(message = 'Authentication required') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends TenantSecurityError {
  constructor(message = 'Access forbidden: Insufficient permissions') {
    super(message, 403);
    this.name = 'AuthorizationError';
  }
}

export class TenantNotFoundError extends TenantSecurityError {
  constructor(message = 'Requested resource not found within tenant scope') {
    super(message, 404);
    this.name = 'TenantNotFoundError';
  }
}

export class TenantConflictError extends TenantSecurityError {
  constructor(message = 'Tenant resource conflict or duplicate idempotency key') {
    super(message, 409);
    this.name = 'TenantConflictError';
  }
}

// ==============================================================================
// 2. Discriminated Principal Context Architecture
// ==============================================================================

export type PrincipalType = 'user' | 'api_key' | 'widget_session' | 'worker' | 'system';

export type AuthMethod =
  | 'session_cookie'
  | 'bearer_token'
  | 'api_key_header'
  | 'widget_session_token'
  | 'worker_lease'
  | 'system_internal';

export interface BaseTenantContext {
  readonly workspaceId: string;
  readonly correlationId: string;
  readonly createdAt: Date;
}

export interface WorkspaceUserContext extends BaseTenantContext {
  readonly principalType: 'user';
  readonly authMethod: 'session_cookie' | 'bearer_token';
  readonly principalId: string; // userId
  readonly userId: string;
  readonly email: string;
  readonly role: WorkspaceRole;
  readonly sessionId: string;
}

export interface ApiKeyContext extends BaseTenantContext {
  readonly principalType: 'api_key';
  readonly authMethod: 'api_key_header';
  readonly principalId: string; // apiKeyId
  readonly apiKeyId: string;
  readonly displayPrefix: string;
  readonly scopes: readonly string[];
  readonly deploymentId?: string;
}

export interface WidgetSessionContext extends BaseTenantContext {
  readonly principalType: 'widget_session';
  readonly authMethod: 'widget_session_token';
  readonly principalId: string; // widgetSessionId
  readonly widgetSessionId: string;
  readonly deploymentId: string;
  readonly origin: string;
  readonly capabilities: readonly string[];
}

export interface WorkerContext extends BaseTenantContext {
  readonly principalType: 'worker';
  readonly authMethod: 'worker_lease';
  readonly principalId: string; // workerNodeId
  readonly runId: string;
  readonly leaseOwner: string;
}

export interface SystemContext extends BaseTenantContext {
  readonly principalType: 'system';
  readonly authMethod: 'system_internal';
  readonly principalId: string;
  readonly reason: string;
}

export type TrustedTenantContext =
  | WorkspaceUserContext
  | ApiKeyContext
  | WidgetSessionContext
  | WorkerContext
  | SystemContext;

// Legacy compatibility interface
export interface LegacyWorkspaceContext {
  readonly workspaceId: string;
  readonly userId?: string;
  readonly role?: WorkspaceRole;
}

export type WorkspaceContext = TrustedTenantContext | LegacyWorkspaceContext;

// ==============================================================================
// 3. Type Guards
// ==============================================================================

export function isWorkspaceUser(context: WorkspaceContext): context is WorkspaceUserContext {
  return 'principalType' in context && context.principalType === 'user';
}

export function isApiKey(context: WorkspaceContext): context is ApiKeyContext {
  return 'principalType' in context && context.principalType === 'api_key';
}

export function isWidgetSession(context: WorkspaceContext): context is WidgetSessionContext {
  return 'principalType' in context && context.principalType === 'widget_session';
}

export function isWorker(context: WorkspaceContext): context is WorkerContext {
  return 'principalType' in context && context.principalType === 'worker';
}

export function isSystem(context: WorkspaceContext): context is SystemContext {
  return 'principalType' in context && context.principalType === 'system';
}

// ==============================================================================
// 4. Narrow Context Constructors
// ==============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertValidUuid(id: string, fieldName = 'UUID'): void {
  if (!id || !UUID_REGEX.test(id)) {
    throw new TenantSecurityError(`${fieldName} requires a valid UUID`, 400);
  }
}

export function createWorkspaceContext(
  workspaceId: string,
  userId?: string,
  role?: WorkspaceRole
): LegacyWorkspaceContext {
  if (!workspaceId || !UUID_REGEX.test(workspaceId)) {
    throw new TenantSecurityError('WorkspaceContext requires a valid workspace UUID', 400);
  }
  if (userId) assertValidUuid(userId, 'userId');
  return {
    workspaceId,
    userId,
    role
  };
}

export function createTrustedWorkerContext(params: {
  runId: string;
  workspaceId: string;
  leaseOwner?: string;
  correlationId?: string;
}): WorkerContext {
  assertValidUuid(params.runId, 'runId');
  assertValidUuid(params.workspaceId, 'workspaceId');
  return {
    principalType: 'worker',
    authMethod: 'worker_lease',
    workspaceId: params.workspaceId,
    principalId: params.leaseOwner ?? 'worker-node',
    runId: params.runId,
    leaseOwner: params.leaseOwner ?? 'worker-node',
    correlationId: params.correlationId ?? `corr-worker-${params.runId}`,
    createdAt: new Date()
  };
}

export function createTrustedSystemContext(params: {
  workspaceId: string;
  systemActorId: string;
  reason: string;
  correlationId?: string;
}): SystemContext {
  assertValidUuid(params.workspaceId, 'workspaceId');
  if (!params.reason) {
    throw new TenantSecurityError('SystemContext requires an explicit reason', 400);
  }
  return {
    principalType: 'system',
    authMethod: 'system_internal',
    workspaceId: params.workspaceId,
    principalId: params.systemActorId,
    reason: params.reason,
    correlationId: params.correlationId ?? `corr-sys-${Date.now()}`,
    createdAt: new Date()
  };
}

// ==============================================================================
// 5. Role & Scope Authorization Enforcement
// ==============================================================================

export function assertContextPermission(context: WorkspaceContext, permission: Permission): void {
  if (isSystem(context)) {
    return; // System context has explicit administrative clearance
  }

  if (isWorkspaceUser(context)) {
    if (!hasPermission(context.role, permission)) {
      throw new AuthorizationError(
        `Forbidden: Role '${context.role}' lacks permission '${permission}'`
      );
    }
    return;
  }

  if (isApiKey(context)) {
    const isAllowed =
      context.scopes.includes('*') ||
      context.scopes.includes('admin') ||
      context.scopes.includes(permission);
    if (!isAllowed) {
      throw new AuthorizationError(
        `Forbidden: API key lacks required scope '${permission}'`
      );
    }
    return;
  }

  if (isWidgetSession(context)) {
    // Widget sessions are restricted to public interactive actions only
    const publicAllowed = ['run:create', 'run:read', 'conversation:read', 'conversation:write'];
    if (!publicAllowed.includes(permission)) {
      throw new AuthorizationError(
        `Forbidden: Widget sessions cannot perform administrative action '${permission}'`
      );
    }
    return;
  }

  if (isWorker(context)) {
    const workerAllowed = ['run:read', 'run:create', 'agent:read'];
    if (!workerAllowed.includes(permission)) {
      throw new AuthorizationError(
        `Forbidden: Worker leases cannot execute arbitrary management action '${permission}'`
      );
    }
    return;
  }

  // Legacy context fallback
  if ('role' in context && context.role) {
    if (!hasPermission(context.role, permission)) {
      throw new AuthorizationError(
        `Forbidden: Role '${context.role}' lacks permission '${permission}'`
      );
    }
    return;
  }

  throw new AuthorizationError('Forbidden: Unrecognized or unverified tenant context');
}

// ==============================================================================
// 6. Hardened Transaction and RLS Execution
// ==============================================================================

export async function withWorkspaceTransaction<T>(
  client: DatabaseClient,
  context: WorkspaceContext,
  callback: (transaction: Database) => Promise<T>
): Promise<T> {
  assertValidUuid(context.workspaceId, 'workspaceId');
  return client.db.transaction(async (transaction) => {
    await transaction.execute(sql`SELECT set_config('app.current_workspace_id', ${context.workspaceId}, true)`);
    return callback(transaction as Database);
  });
}

export async function withWorkspaceAppTransaction<T>(
  client: DatabaseClient,
  context: WorkspaceContext,
  callback: (transaction: Database) => Promise<T>
): Promise<T> {
  assertValidUuid(context.workspaceId, 'workspaceId');
  return client.db.transaction(async (transaction) => {
    // 1. Establish least-privilege non-login application role
    await transaction.execute(sql`SET LOCAL ROLE agentflow_app`);
    // 2. Set transaction-local workspace ID
    await transaction.execute(sql`SELECT set_config('app.current_workspace_id', ${context.workspaceId}, true)`);
    // 3. Set correlation ID if available
    if ('correlationId' in context && context.correlationId) {
      await transaction.execute(sql`SELECT set_config('app.current_correlation_id', ${context.correlationId}, true)`);
    }
    return callback(transaction as Database);
  });
}

/**
 * @deprecated Use withWorkspaceAppTransaction for safe, transaction-local tenant context.
 */
export async function setWorkspaceContext(client: DatabaseClient, context: WorkspaceContext): Promise<void> {
  assertValidUuid(context.workspaceId, 'workspaceId');
  await client.db.execute(sql`SELECT set_config('app.current_workspace_id', ${context.workspaceId}, false)`);
}

export async function resetWorkspaceContext(client: DatabaseClient): Promise<void> {
  await client.db.execute(sql`SELECT set_config('app.current_workspace_id', '', false)`);
  await client.db.execute(sql`RESET ROLE`);
}

export function enforceTenantIsolation<T extends { workspaceId: string }>(
  records: T[],
  context: WorkspaceContext
): T[] {
  return records.filter((r) => r.workspaceId === context.workspaceId);
}
