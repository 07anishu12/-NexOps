import { and, desc, eq } from 'drizzle-orm';
import { approvals, approvalEvents } from '../schema/index.js';
import { isWorkspaceUser, WorkspaceContext } from '../tenant-context.js';
import { BaseRepository, normalizePagination, PaginationOptions } from './base.js';

export class ApprovalRepository extends BaseRepository {
  async findById(context: WorkspaceContext, id: string) {
    return this.withScopedTransaction(context, 'run:read', async (tx) => {
      const [approval] = await tx
        .select()
        .from(approvals)
        .where(and(eq(approvals.workspaceId, context.workspaceId), eq(approvals.id, id)))
        .limit(1);

      return this.notFoundIfNull(approval, 'Approval', id);
    });
  }

  async list(
    context: WorkspaceContext,
    options?: PaginationOptions & { runId?: string; status?: any }
  ) {
    return this.withScopedTransaction(context, 'run:read', async (tx) => {
      const { limit, offset } = normalizePagination(options);
      const conditions = [eq(approvals.workspaceId, context.workspaceId)];

      if (options?.runId) conditions.push(eq(approvals.runId, options.runId));
      if (options?.status) conditions.push(eq(approvals.status, options.status));

      return tx
        .select()
        .from(approvals)
        .where(and(...conditions))
        .orderBy(desc(approvals.requestedAt))
        .limit(limit)
        .offset(offset);
    });
  }

  async create(
    context: WorkspaceContext,
    input: {
      runId: string;
      toolOperationId: string;
      toolName: string;
      riskLevel: any;
      payload: Record<string, unknown>;
      payloadHash: string;
      expiresAt: Date;
    }
  ) {
    return this.withScopedTransaction(context, null, async (tx) => {
      const [created] = await tx
        .insert(approvals)
        .values({
          workspaceId: context.workspaceId,
          runId: input.runId,
          toolOperationId: input.toolOperationId,
          toolName: input.toolName,
          riskLevel: input.riskLevel,
          payload: input.payload,
          payloadHash: input.payloadHash,
          expiresAt: input.expiresAt,
          status: 'pending'
        })
        .returning();

      return created;
    });
  }

  async resolve(
    context: WorkspaceContext,
    id: string,
    input: {
      status: 'approved' | 'rejected';
      reason?: string;
    }
  ) {
    return this.withScopedTransaction(context, 'approval:resolve', async (tx) => {
      const resolverId = isWorkspaceUser(context) ? context.userId : null;

      const [resolved] = await tx
        .update(approvals)
        .set({
          status: input.status,
          decisionReason: input.reason,
          resolvedBy: resolverId,
          resolvedAt: new Date()
        })
        .where(
          and(
            eq(approvals.workspaceId, context.workspaceId),
            eq(approvals.id, id),
            eq(approvals.status, 'pending')
          )
        )
        .returning();

      return this.notFoundIfNull(resolved, 'Approval', id);

      // Record immutable approval event
      await tx.insert(approvalEvents).values({
        workspaceId: context.workspaceId,
        approvalId: id,
        eventType: input.status,
        actorType: 'user',
        actorId: resolverId,
        reason: input.reason
      });

      return resolved;
    });
  }

  async consume(context: WorkspaceContext, id: string) {
    return this.withScopedTransaction(context, null, async (tx) => {
      const consumerId = isWorkspaceUser(context) ? context.userId : null;

      const [consumed] = await tx
        .update(approvals)
        .set({
          status: 'consumed',
          consumedBy: consumerId,
          consumedAt: new Date()
        })
        .where(
          and(
            eq(approvals.workspaceId, context.workspaceId),
            eq(approvals.id, id),
            eq(approvals.status, 'approved')
          )
        )
        .returning();

      if (!consumed) {
        throw new Error(`Approval '${id}' is not in approved state or has already been consumed`);
      }

      await tx.insert(approvalEvents).values({
        workspaceId: context.workspaceId,
        approvalId: id,
        eventType: 'consumed',
        actorType: 'user',
        actorId: consumerId
      });

      return consumed;
    });
  }
}
