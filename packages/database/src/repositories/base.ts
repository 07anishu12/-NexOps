import type { Database, DatabaseClient } from '../client.js';
import {
  assertContextPermission,
  TenantNotFoundError,
  withWorkspaceAppTransaction,
  WorkspaceContext
} from '../tenant-context.js';
import type { Permission } from '@agentflow/auth';

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export function normalizePagination(options?: PaginationOptions): { limit: number; offset: number } {
  const limit = Math.max(1, Math.min(100, options?.limit ?? 50));
  const offset = Math.max(0, options?.offset ?? 0);
  return { limit, offset };
}

export abstract class BaseRepository {
  constructor(protected readonly client: DatabaseClient) {}

  /**
   * Executes a database operation within a hardened RLS transaction handle.
   * Enforces least-privilege role `agentflow_app` and transaction-local `app.current_workspace_id`.
   */
  protected async withScopedTransaction<T>(
    context: WorkspaceContext,
    requiredPermission: Permission | null,
    operation: (tx: Database) => Promise<T>
  ): Promise<T> {
    if (requiredPermission) {
      assertContextPermission(context, requiredPermission);
    }
    return withWorkspaceAppTransaction(this.client, context, operation);
  }

  protected notFoundIfNull<T>(item: T | null | undefined, resourceName: string, id: string): T {
    if (!item) {
      throw new TenantNotFoundError(`${resourceName} '${id}' not found within tenant scope`);
    }
    return item;
  }
}
