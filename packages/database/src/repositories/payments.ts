import { and, desc, eq } from 'drizzle-orm';
import { paymentOrders, paymentEvents } from '../schema/index.js';
import { isWorkspaceUser, WorkspaceContext } from '../tenant-context.js';
import { BaseRepository, normalizePagination, PaginationOptions } from './base.js';

export class PaymentRepository extends BaseRepository {
  async createOrder(
    context: WorkspaceContext,
    input: {
      provider: string;
      externalOrderId: string;
      amount: string;
      currency: string;
      checkoutMetadata?: Record<string, unknown>;
    }
  ) {
    return this.withScopedTransaction(context, 'billing:manage', async (tx) => {
      const creatorId = isWorkspaceUser(context) ? context.userId : context.workspaceId;

      const [order] = await tx
        .insert(paymentOrders)
        .values({
          workspaceId: context.workspaceId,
          provider: input.provider,
          externalOrderId: input.externalOrderId,
          amount: input.amount,
          currency: input.currency,
          checkoutMetadata: input.checkoutMetadata ?? {},
          createdBy: creatorId
        })
        .returning();

      return order;
    });
  }

  async findOrderById(context: WorkspaceContext, id: string) {
    return this.withScopedTransaction(context, 'billing:manage', async (tx) => {
      const [order] = await tx
        .select()
        .from(paymentOrders)
        .where(
          and(
            eq(paymentOrders.workspaceId, context.workspaceId),
            eq(paymentOrders.id, id)
          )
        )
        .limit(1);

      return this.notFoundIfNull(order, 'PaymentOrder', id);
    });
  }

  async listOrders(context: WorkspaceContext, options?: PaginationOptions) {
    return this.withScopedTransaction(context, 'billing:manage', async (tx) => {
      const { limit, offset } = normalizePagination(options);

      return tx
        .select()
        .from(paymentOrders)
        .where(eq(paymentOrders.workspaceId, context.workspaceId))
        .orderBy(desc(paymentOrders.createdAt))
        .limit(limit)
        .offset(offset);
    });
  }

  async recordEvent(
    context: WorkspaceContext,
    input: {
      paymentOrderId?: string;
      provider: string;
      providerEventId: string;
      signatureVerified: boolean;
      payloadHash: string;
      rawPayload: Record<string, unknown>;
      signatureAlgorithm?: string;
    }
  ) {
    return this.withScopedTransaction(context, null, async (tx) => {
      const [event] = await tx
        .insert(paymentEvents)
        .values({
          workspaceId: context.workspaceId,
          paymentOrderId: input.paymentOrderId,
          provider: input.provider,
          providerEventId: input.providerEventId,
          signatureVerified: input.signatureVerified,
          signatureAlgorithm: input.signatureAlgorithm,
          payloadHash: input.payloadHash,
          rawPayload: input.rawPayload,
          status: 'received'
        })
        .returning();

      return event;
    });
  }
}
