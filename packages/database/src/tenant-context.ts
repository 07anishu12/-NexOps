import { WorkspaceRole } from '@agentflow/contracts';
import { sql } from 'drizzle-orm';
import type { DatabaseClient, Database } from './client.js';

export interface WorkspaceContext {
  readonly workspaceId: string;
  readonly userId?: string;
  readonly role?: WorkspaceRole;
}

export function createWorkspaceContext(
  workspaceId: string,
  userId?: string,
  role?: WorkspaceRole
): WorkspaceContext {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceId)) {
    throw new Error('WorkspaceContext requires a valid workspace UUID');
  }
  return {
    workspaceId,
    userId,
    role
  };
}

export async function withWorkspaceTransaction<T>(
  client: DatabaseClient,
  context: WorkspaceContext,
  callback: (transaction: Database) => Promise<T>
): Promise<T> {
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
  return client.db.transaction(async (transaction) => {
    await transaction.execute(sql`SET LOCAL ROLE agentflow_app`);
    await transaction.execute(sql`SELECT set_config('app.current_workspace_id', ${context.workspaceId}, true)`);
    return callback(transaction as Database);
  });
}

export async function setWorkspaceContext(client: DatabaseClient, context: WorkspaceContext): Promise<void> {
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
