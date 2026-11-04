import { and, asc, desc, eq } from 'drizzle-orm';
import { conversations, messages } from '../schema/index.js';
import { isWorkspaceUser, WorkspaceContext } from '../tenant-context.js';
import { BaseRepository, normalizePagination, PaginationOptions } from './base.js';

export class ConversationRepository extends BaseRepository {
  async findById(context: WorkspaceContext, id: string) {
    return this.withScopedTransaction(context, 'run:read', async (tx) => {
      const [conversation] = await tx
        .select()
        .from(conversations)
        .where(and(eq(conversations.workspaceId, context.workspaceId), eq(conversations.id, id)))
        .limit(1);

      return this.notFoundIfNull(conversation, 'Conversation', id);
    });
  }

  async list(
    context: WorkspaceContext,
    options?: PaginationOptions & { agentId?: string; deploymentId?: string }
  ) {
    return this.withScopedTransaction(context, 'run:read', async (tx) => {
      const { limit, offset } = normalizePagination(options);
      const conditions = [eq(conversations.workspaceId, context.workspaceId)];

      if (options?.agentId) conditions.push(eq(conversations.agentId, options.agentId));
      if (options?.deploymentId) conditions.push(eq(conversations.deploymentId, options.deploymentId));

      return tx
        .select()
        .from(conversations)
        .where(and(...conditions))
        .orderBy(desc(conversations.createdAt))
        .limit(limit)
        .offset(offset);
    });
  }

  async create(
    context: WorkspaceContext,
    input: {
      agentId: string;
      deploymentId?: string;
      externalSessionRef?: string;
      title?: string;
      metadata?: Record<string, unknown>;
    }
  ) {
    return this.withScopedTransaction(context, 'run:create', async (tx) => {
      const creatorId = isWorkspaceUser(context) ? context.userId : null;

      const [created] = await tx
        .insert(conversations)
        .values({
          workspaceId: context.workspaceId,
          agentId: input.agentId,
          deploymentId: input.deploymentId,
          externalSessionRef: input.externalSessionRef,
          title: input.title ?? 'New Conversation',
          metadata: input.metadata ?? {},
          createdBy: creatorId
        })
        .returning();

      return created;
    });
  }

  async addMessage(
    context: WorkspaceContext,
    input: {
      conversationId: string;
      role: 'system' | 'user' | 'assistant' | 'tool';
      content: string;
      sequence: number;
      modelMetadata?: Record<string, unknown>;
      toolCallMetadata?: Record<string, unknown>;
    }
  ) {
    return this.withScopedTransaction(context, 'run:create', async (tx) => {
      // Verify conversation ownership
      await this.findById(context, input.conversationId);

      const [message] = await tx
        .insert(messages)
        .values({
          workspaceId: context.workspaceId,
          conversationId: input.conversationId,
          role: input.role,
          content: input.content,
          sequence: input.sequence,
          modelMetadata: input.modelMetadata,
          toolCallMetadata: input.toolCallMetadata
        })
        .returning();

      return message;
    });
  }

  async listMessages(context: WorkspaceContext, conversationId: string) {
    return this.withScopedTransaction(context, 'run:read', async (tx) => {
      // Verify conversation ownership
      await this.findById(context, conversationId);

      return tx
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.workspaceId, context.workspaceId),
            eq(messages.conversationId, conversationId)
          )
        )
        .orderBy(asc(messages.sequence));
    });
  }
}
