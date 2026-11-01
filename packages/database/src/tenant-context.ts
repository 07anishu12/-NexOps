import { WorkspaceRole } from '@agentflow/contracts';

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
  if (!workspaceId) {
    throw new Error('WorkspaceContext requires a valid, non-empty workspaceId');
  }
  return {
    workspaceId,
    userId,
    role
  };
}

export function enforceTenantIsolation<T extends { workspaceId: string }>(
  records: T[],
  context: WorkspaceContext
): T[] {
  return records.filter((r) => r.workspaceId === context.workspaceId);
}
