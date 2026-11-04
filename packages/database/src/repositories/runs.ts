import { and, asc, desc, eq } from 'drizzle-orm';
import { runs, runEvents, toolOperations } from '../schema/index.js';
import { WorkspaceContext } from '../tenant-context.js';
import { BaseRepository, normalizePagination, PaginationOptions } from './base.js';

export class RunRepository extends BaseRepository {
  async findById(context: WorkspaceContext, id: string) {
    return this.withScopedTransaction(context, 'run:read', async (tx) => {
      const [run] = await tx
        .select()
        .from(runs)
        .where(and(eq(runs.workspaceId, context.workspaceId), eq(runs.id, id)))
        .limit(1);

      return this.notFoundIfNull(run, 'Run', id);
    });
  }

  async list(
    context: WorkspaceContext,
    options?: PaginationOptions & { agentId?: string; state?: any }
  ) {
    return this.withScopedTransaction(context, 'run:read', async (tx) => {
      const { limit, offset } = normalizePagination(options);
      const conditions = [eq(runs.workspaceId, context.workspaceId)];

      if (options?.agentId) conditions.push(eq(runs.agentId, options.agentId));
      if (options?.state) conditions.push(eq(runs.state, options.state));

      return tx
        .select()
        .from(runs)
        .where(and(...conditions))
        .orderBy(desc(runs.createdAt))
        .limit(limit)
        .offset(offset);
    });
  }

  async create(
    context: WorkspaceContext,
    input: {
      agentId: string;
      agentVersionId: string;
      deploymentId?: string;
      conversationId?: string;
      inputPrompt: string;
      idempotencyKey: string;
      correlationId: string;
      initiatorType: 'user' | 'api_key' | 'widget' | 'webhook' | 'scheduler';
      initiatorId: string;
      traceId?: string;
    }
  ) {
    return this.withScopedTransaction(context, 'run:create', async (tx) => {
      const [created] = await tx
        .insert(runs)
        .values({
          workspaceId: context.workspaceId,
          agentId: input.agentId,
          agentVersionId: input.agentVersionId,
          deploymentId: input.deploymentId,
          conversationId: input.conversationId,
          inputPrompt: input.inputPrompt,
          idempotencyKey: input.idempotencyKey,
          correlationId: input.correlationId,
          initiatorType: input.initiatorType,
          initiatorId: input.initiatorId,
          traceId: input.traceId,
          state: 'queued'
        })
        .returning();

      return created;
    });
  }

  async updateState(
    context: WorkspaceContext,
    id: string,
    input: {
      state: any;
      outputSummary?: string;
      errorClass?: string;
      errorMessage?: string;
      completedAt?: Date;
    }
  ) {
    return this.withScopedTransaction(context, null, async (tx) => {
      const [updated] = await tx
        .update(runs)
        .set({
          state: input.state,
          ...(input.outputSummary ? { outputSummary: input.outputSummary } : {}),
          ...(input.errorClass ? { errorClass: input.errorClass } : {}),
          ...(input.errorMessage ? { errorMessage: input.errorMessage } : {}),
          ...(input.completedAt ? { completedAt: input.completedAt } : {}),
          updatedAt: new Date()
        })
        .where(and(eq(runs.workspaceId, context.workspaceId), eq(runs.id, id)))
        .returning();

      return this.notFoundIfNull(updated, 'Run', id);
    });
  }

  async addEvent(
    context: WorkspaceContext,
    input: {
      runId: string;
      correlationId: string;
      eventType: string;
      sequence: number;
      data: Record<string, unknown>;
      visibility?: string;
    }
  ) {
    return this.withScopedTransaction(context, null, async (tx) => {
      // Verify run ownership
      await this.findById(context, input.runId);

      const [event] = await tx
        .insert(runEvents)
        .values({
          workspaceId: context.workspaceId,
          runId: input.runId,
          correlationId: input.correlationId,
          eventType: input.eventType,
          sequence: input.sequence,
          data: input.data,
          visibility: input.visibility ?? 'operator'
        })
        .returning();

      return event;
    });
  }

  async listEvents(context: WorkspaceContext, runId: string) {
    return this.withScopedTransaction(context, 'run:read', async (tx) => {
      await this.findById(context, runId);

      return tx
        .select()
        .from(runEvents)
        .where(and(eq(runEvents.workspaceId, context.workspaceId), eq(runEvents.runId, runId)))
        .orderBy(asc(runEvents.sequence));
    });
  }

  async createToolOperation(
    context: WorkspaceContext,
    input: {
      runId: string;
      stepId?: string;
      operationKey: string;
      toolKey: string;
      payload: Record<string, unknown>;
      payloadHash: string;
    }
  ) {
    return this.withScopedTransaction(context, null, async (tx) => {
      await this.findById(context, input.runId);

      const [operation] = await tx
        .insert(toolOperations)
        .values({
          workspaceId: context.workspaceId,
          runId: input.runId,
          stepId: input.stepId,
          operationKey: input.operationKey,
          toolKey: input.toolKey,
          payload: input.payload,
          payloadHash: input.payloadHash,
          status: 'proposed'
        })
        .returning();

      return operation;
    });
  }
}
