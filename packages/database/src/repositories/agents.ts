import { and, desc, eq, isNull } from 'drizzle-orm';
import { agents, agentVersions } from '../schema/index.js';
import { isWorkspaceUser, WorkspaceContext } from '../tenant-context.js';
import { BaseRepository, normalizePagination, PaginationOptions } from './base.js';

export class AgentRepository extends BaseRepository {
  async list(
    context: WorkspaceContext,
    options?: PaginationOptions & { status?: 'draft' | 'published' | 'archived' }
  ) {
    return this.withScopedTransaction(context, 'agent:read', async (tx) => {
      const { limit, offset } = normalizePagination(options);
      const conditions = [eq(agents.workspaceId, context.workspaceId)];

      if (options?.status) {
        conditions.push(eq(agents.status, options.status));
      } else {
        conditions.push(isNull(agents.archivedAt));
      }

      return tx
        .select()
        .from(agents)
        .where(and(...conditions))
        .orderBy(desc(agents.createdAt))
        .limit(limit)
        .offset(offset);
    });
  }

  async findById(context: WorkspaceContext, id: string) {
    return this.withScopedTransaction(context, 'agent:read', async (tx) => {
      const [agent] = await tx
        .select()
        .from(agents)
        .where(and(eq(agents.workspaceId, context.workspaceId), eq(agents.id, id)))
        .limit(1);

      return this.notFoundIfNull(agent, 'Agent', id);
    });
  }

  async create(
    context: WorkspaceContext,
    input: {
      name: string;
      description?: string;
      currentDraft: Record<string, unknown>;
    }
  ) {
    return this.withScopedTransaction(context, 'agent:create', async (tx) => {
      const creatorId = isWorkspaceUser(context) ? context.userId : context.workspaceId;

      const [created] = await tx
        .insert(agents)
        .values({
          workspaceId: context.workspaceId,
          name: input.name,
          description: input.description ?? '',
          currentDraft: input.currentDraft,
          createdBy: creatorId
        })
        .returning();

      return created;
    });
  }

  async update(
    context: WorkspaceContext,
    id: string,
    input: {
      name?: string;
      description?: string;
      currentDraft?: Record<string, unknown>;
      activeVersionId?: string;
    }
  ) {
    return this.withScopedTransaction(context, 'agent:update', async (tx) => {
      const [updated] = await tx
        .update(agents)
        .set({
          ...(input.name ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.currentDraft ? { currentDraft: input.currentDraft } : {}),
          ...(input.activeVersionId ? { activeVersionId: input.activeVersionId } : {}),
          updatedAt: new Date()
        })
        .where(and(eq(agents.workspaceId, context.workspaceId), eq(agents.id, id)))
        .returning();

      return this.notFoundIfNull(updated, 'Agent', id);
    });
  }

  async archive(context: WorkspaceContext, id: string) {
    return this.withScopedTransaction(context, 'agent:delete', async (tx) => {
      const [archived] = await tx
        .update(agents)
        .set({
          status: 'archived',
          archivedAt: new Date(),
          updatedAt: new Date()
        })
        .where(and(eq(agents.workspaceId, context.workspaceId), eq(agents.id, id)))
        .returning();

      return this.notFoundIfNull(archived, 'Agent', id);
    });
  }

  async createVersion(
    context: WorkspaceContext,
    input: {
      agentId: string;
      versionNumber: number;
      configSnapshot: Record<string, unknown>;
      snapshotHash: string;
      changelog?: string;
    }
  ) {
    return this.withScopedTransaction(context, 'agent:publish', async (tx) => {
      // 1. Verify agent ownership in active workspace
      await this.findById(context, input.agentId);

      const publisherId = isWorkspaceUser(context) ? context.userId : context.workspaceId;

      const [version] = await tx
        .insert(agentVersions)
        .values({
          workspaceId: context.workspaceId,
          agentId: input.agentId,
          versionNumber: input.versionNumber,
          configSnapshot: input.configSnapshot,
          snapshotHash: input.snapshotHash,
          changelog: input.changelog,
          publishedBy: publisherId
        })
        .returning();

      if (!version) {
        throw new Error('Failed to create agent version');
      }

      // Update active version pointer on agent
      await tx
        .update(agents)
        .set({
          activeVersionId: version.id,
          status: 'published',
          updatedAt: new Date()
        })
        .where(and(eq(agents.workspaceId, context.workspaceId), eq(agents.id, input.agentId)));

      return version;
    });
  }

  async listVersions(context: WorkspaceContext, agentId: string) {
    return this.withScopedTransaction(context, 'agent:read', async (tx) => {
      return tx
        .select()
        .from(agentVersions)
        .where(
          and(
            eq(agentVersions.workspaceId, context.workspaceId),
            eq(agentVersions.agentId, agentId)
          )
        )
        .orderBy(desc(agentVersions.versionNumber));
    });
  }

  async findVersionById(context: WorkspaceContext, versionId: string) {
    return this.withScopedTransaction(context, 'agent:read', async (tx) => {
      const [version] = await tx
        .select()
        .from(agentVersions)
        .where(
          and(
            eq(agentVersions.workspaceId, context.workspaceId),
            eq(agentVersions.id, versionId)
          )
        )
        .limit(1);

      return this.notFoundIfNull(version, 'AgentVersion', versionId);
    });
  }
}
