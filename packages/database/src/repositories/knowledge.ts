import { and, desc, eq, isNull } from 'drizzle-orm';
import { knowledgeChunks, knowledgeSources } from '../schema/index.js';
import { isWorkspaceUser, WorkspaceContext } from '../tenant-context.js';
import { BaseRepository, normalizePagination, PaginationOptions } from './base.js';

export type IngestionStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'deleted';
export type KnowledgeSourceType = 'upload' | 'url' | 'text' | 'integration';

export class KnowledgeRepository extends BaseRepository {
  async listSources(
    context: WorkspaceContext,
    options?: PaginationOptions & { agentId?: string; status?: IngestionStatus }
  ) {
    return this.withScopedTransaction(context, 'agent:read', async (tx) => {
      const { limit, offset } = normalizePagination(options);
      const conditions = [
        eq(knowledgeSources.workspaceId, context.workspaceId),
        isNull(knowledgeSources.deletedAt)
      ];

      if (options?.agentId) {
        conditions.push(eq(knowledgeSources.agentId, options.agentId));
      }
      if (options?.status) {
        conditions.push(eq(knowledgeSources.status, options.status));
      }

      return tx
        .select()
        .from(knowledgeSources)
        .where(and(...conditions))
        .orderBy(desc(knowledgeSources.createdAt))
        .limit(limit)
        .offset(offset);
    });
  }

  async findSourceById(context: WorkspaceContext, id: string) {
    return this.withScopedTransaction(context, 'agent:read', async (tx) => {
      const [source] = await tx
        .select()
        .from(knowledgeSources)
        .where(
          and(
            eq(knowledgeSources.workspaceId, context.workspaceId),
            eq(knowledgeSources.id, id),
            isNull(knowledgeSources.deletedAt)
          )
        )
        .limit(1);

      return this.notFoundIfNull(source, 'KnowledgeSource', id);
    });
  }

  async createSource(
    context: WorkspaceContext,
    input: {
      agentId?: string;
      type: KnowledgeSourceType;
      name: string;
      sourceReference?: string;
      metadata?: Record<string, unknown>;
      contentHash?: string;
      createdBy?: string;
    }
  ) {
    return this.withScopedTransaction(context, 'agent:update', async (tx) => {
      const createdBy =
        input.createdBy ?? (isWorkspaceUser(context) ? context.principalId : null);
      if (!createdBy) {
        throw new Error('A valid user principal is required as createdBy for knowledge source');
      }

      const [source] = await tx
        .insert(knowledgeSources)
        .values({
          workspaceId: context.workspaceId,
          agentId: input.agentId ?? null,
          type: input.type,
          name: input.name,
          sourceReference: input.sourceReference ?? null,
          metadata: input.metadata ?? {},
          contentHash: input.contentHash ?? null,
          status: 'pending',
          createdBy
        })
        .returning();

      return source;
    });
  }

  async updateSourceStatus(
    context: WorkspaceContext,
    id: string,
    status: IngestionStatus,
    contentHash?: string
  ) {
    return this.withScopedTransaction(context, 'agent:update', async (tx) => {
      const updateData: { status: IngestionStatus; contentHash?: string; updatedAt: Date } = {
        status,
        updatedAt: new Date()
      };
      if (contentHash) {
        updateData.contentHash = contentHash;
      }

      const [updated] = await tx
        .update(knowledgeSources)
        .set(updateData)
        .where(
          and(
            eq(knowledgeSources.workspaceId, context.workspaceId),
            eq(knowledgeSources.id, id),
            isNull(knowledgeSources.deletedAt)
          )
        )
        .returning();

      return this.notFoundIfNull(updated, 'KnowledgeSource', id);
    });
  }

  async addChunks(
    context: WorkspaceContext,
    sourceId: string,
    chunks: Array<{
      chunkIndex: number;
      content: string;
      metadata?: Record<string, unknown>;
      embedding: number[];
      embeddingModel: string;
    }>
  ) {
    return this.withScopedTransaction(context, 'agent:update', async (tx) => {
      // Verify source exists in tenant scope
      const [source] = await tx
        .select({ id: knowledgeSources.id })
        .from(knowledgeSources)
        .where(
          and(
            eq(knowledgeSources.workspaceId, context.workspaceId),
            eq(knowledgeSources.id, sourceId),
            isNull(knowledgeSources.deletedAt)
          )
        )
        .limit(1);

      this.notFoundIfNull(source, 'KnowledgeSource', sourceId);

      if (chunks.length === 0) {
        return [];
      }

      return tx
        .insert(knowledgeChunks)
        .values(
          chunks.map((chunk) => ({
            workspaceId: context.workspaceId,
            sourceId,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            metadata: chunk.metadata ?? {},
            embedding: chunk.embedding,
            embeddingModel: chunk.embeddingModel
          }))
        )
        .returning();
    });
  }

  async listChunks(
    context: WorkspaceContext,
    sourceId: string,
    options?: PaginationOptions
  ) {
    return this.withScopedTransaction(context, 'agent:read', async (tx) => {
      const { limit, offset } = normalizePagination(options);

      return tx
        .select()
        .from(knowledgeChunks)
        .where(
          and(
            eq(knowledgeChunks.workspaceId, context.workspaceId),
            eq(knowledgeChunks.sourceId, sourceId),
            isNull(knowledgeChunks.deletedAt)
          )
        )
        .orderBy(knowledgeChunks.chunkIndex)
        .limit(limit)
        .offset(offset);
    });
  }

  async deleteSource(context: WorkspaceContext, id: string) {
    return this.withScopedTransaction(context, 'agent:update', async (tx) => {
      const [deleted] = await tx
        .update(knowledgeSources)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date()
        })
        .where(
          and(
            eq(knowledgeSources.workspaceId, context.workspaceId),
            eq(knowledgeSources.id, id),
            isNull(knowledgeSources.deletedAt)
          )
        )
        .returning();

      return this.notFoundIfNull(deleted, 'KnowledgeSource', id);
    });
  }
}
