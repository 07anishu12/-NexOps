import { eq } from 'drizzle-orm';
import { workspaces, workspaceMembers, users } from '../schema/index.js';
import { WorkspaceContext } from '../tenant-context.js';
import { BaseRepository } from './base.js';

export class WorkspaceRepository extends BaseRepository {
  async getWorkspace(context: WorkspaceContext) {
    return this.withScopedTransaction(context, 'workspace:read', async (tx) => {
      const [workspace] = await tx
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, context.workspaceId))
        .limit(1);

      return this.notFoundIfNull(workspace, 'Workspace', context.workspaceId);
    });
  }

  async listMembers(context: WorkspaceContext) {
    return this.withScopedTransaction(context, 'workspace:read', async (tx) => {
      return tx
        .select({
          id: workspaceMembers.id,
          workspaceId: workspaceMembers.workspaceId,
          userId: workspaceMembers.userId,
          role: workspaceMembers.role,
          name: users.name,
          email: users.email,
          createdAt: workspaceMembers.createdAt
        })
        .from(workspaceMembers)
        .innerJoin(users, eq(workspaceMembers.userId, users.id))
        .where(eq(workspaceMembers.workspaceId, context.workspaceId));
    });
  }

  async updateWorkspace(context: WorkspaceContext, input: { name?: string }) {
    return this.withScopedTransaction(context, 'workspace:update', async (tx) => {
      const [updated] = await tx
        .update(workspaces)
        .set({
          ...(input.name ? { name: input.name } : {}),
          updatedAt: new Date()
        })
        .where(eq(workspaces.id, context.workspaceId))
        .returning();

      return this.notFoundIfNull(updated, 'Workspace', context.workspaceId);
    });
  }
}
