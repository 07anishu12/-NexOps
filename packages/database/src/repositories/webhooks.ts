import { and, desc, eq } from 'drizzle-orm';
import { webhookDeliveries, webhookEndpoints } from '../schema/index.js';
import { isWorkspaceUser, WorkspaceContext } from '../tenant-context.js';
import { BaseRepository, normalizePagination, PaginationOptions } from './base.js';

export type EndpointStatus = 'active' | 'disabled' | 'paused';
export type WebhookDeliveryStatus = 'pending' | 'retrying' | 'delivered' | 'failed';

export class WebhookRepository extends BaseRepository {
  async listEndpoints(
    context: WorkspaceContext,
    options?: PaginationOptions & { status?: EndpointStatus }
  ) {
    return this.withScopedTransaction(context, 'integration:manage', async (tx) => {
      const { limit, offset } = normalizePagination(options);
      const conditions = [eq(webhookEndpoints.workspaceId, context.workspaceId)];

      if (options?.status) {
        conditions.push(eq(webhookEndpoints.status, options.status));
      }

      return tx
        .select()
        .from(webhookEndpoints)
        .where(and(...conditions))
        .orderBy(desc(webhookEndpoints.createdAt))
        .limit(limit)
        .offset(offset);
    });
  }

  async findEndpointById(context: WorkspaceContext, id: string) {
    return this.withScopedTransaction(context, 'integration:manage', async (tx) => {
      const [endpoint] = await tx
        .select()
        .from(webhookEndpoints)
        .where(
          and(
            eq(webhookEndpoints.workspaceId, context.workspaceId),
            eq(webhookEndpoints.id, id)
          )
        )
        .limit(1);

      return this.notFoundIfNull(endpoint, 'WebhookEndpoint', id);
    });
  }

  async createEndpoint(
    context: WorkspaceContext,
    input: {
      url: string;
      secretHash: string;
      eventSubscriptions: string[];
      createdBy?: string;
    }
  ) {
    return this.withScopedTransaction(context, 'integration:manage', async (tx) => {
      const createdBy =
        input.createdBy ?? (isWorkspaceUser(context) ? context.principalId : null);
      if (!createdBy) {
        throw new Error('A valid user principal is required to create a webhook endpoint');
      }

      const [endpoint] = await tx
        .insert(webhookEndpoints)
        .values({
          workspaceId: context.workspaceId,
          url: input.url,
          secretHash: input.secretHash,
          eventSubscriptions: input.eventSubscriptions,
          status: 'active',
          createdBy
        })
        .returning();

      return endpoint;
    });
  }

  async updateEndpointStatus(
    context: WorkspaceContext,
    id: string,
    status: EndpointStatus
  ) {
    return this.withScopedTransaction(context, 'integration:manage', async (tx) => {
      const [updated] = await tx
        .update(webhookEndpoints)
        .set({
          status,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(webhookEndpoints.workspaceId, context.workspaceId),
            eq(webhookEndpoints.id, id)
          )
        )
        .returning();

      return this.notFoundIfNull(updated, 'WebhookEndpoint', id);
    });
  }

  async recordDelivery(
    context: WorkspaceContext,
    input: {
      endpointId: string;
      eventId: string;
      eventType: string;
      payload: Record<string, unknown>;
      status?: WebhookDeliveryStatus;
      attemptCount?: number;
      responseStatus?: number;
      responseBodyRedacted?: string;
      nextAttemptAt?: Date;
      deliveredAt?: Date;
    }
  ) {
    return this.withScopedTransaction(context, 'integration:manage', async (tx) => {
      // Validate endpoint exists in workspace
      const [endpoint] = await tx
        .select({ id: webhookEndpoints.id })
        .from(webhookEndpoints)
        .where(
          and(
            eq(webhookEndpoints.workspaceId, context.workspaceId),
            eq(webhookEndpoints.id, input.endpointId)
          )
        )
        .limit(1);

      this.notFoundIfNull(endpoint, 'WebhookEndpoint', input.endpointId);

      const [delivery] = await tx
        .insert(webhookDeliveries)
        .values({
          workspaceId: context.workspaceId,
          endpointId: input.endpointId,
          eventId: input.eventId,
          eventType: input.eventType,
          payload: input.payload,
          status: input.status ?? 'pending',
          attemptCount: input.attemptCount ?? 0,
          responseStatus: input.responseStatus ?? null,
          responseBodyRedacted: input.responseBodyRedacted ?? null,
          nextAttemptAt: input.nextAttemptAt ?? null,
          deliveredAt: input.deliveredAt ?? null
        })
        .returning();

      return delivery;
    });
  }

  async listDeliveries(
    context: WorkspaceContext,
    endpointId?: string,
    options?: PaginationOptions
  ) {
    return this.withScopedTransaction(context, 'integration:manage', async (tx) => {
      const { limit, offset } = normalizePagination(options);
      const conditions = [eq(webhookDeliveries.workspaceId, context.workspaceId)];

      if (endpointId) {
        conditions.push(eq(webhookDeliveries.endpointId, endpointId));
      }

      return tx
        .select()
        .from(webhookDeliveries)
        .where(and(...conditions))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(limit)
        .offset(offset);
    });
  }
}
