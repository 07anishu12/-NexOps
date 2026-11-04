import { and, desc, eq } from 'drizzle-orm';
import { creditAccounts, creditLedgerEntries, creditReservations, usageEvents } from '../schema/index.js';
import { isWorkspaceUser, WorkspaceContext } from '../tenant-context.js';
import { BaseRepository, normalizePagination, PaginationOptions } from './base.js';

export class BillingRepository extends BaseRepository {
  async getOrCreateAccount(context: WorkspaceContext, currency = 'credits') {
    return this.withScopedTransaction(context, 'billing:manage', async (tx) => {
      const [existing] = await tx
        .select()
        .from(creditAccounts)
        .where(
          and(
            eq(creditAccounts.workspaceId, context.workspaceId),
            eq(creditAccounts.currency, currency)
          )
        )
        .limit(1);

      if (existing) return existing;

      const [created] = await tx
        .insert(creditAccounts)
        .values({
          workspaceId: context.workspaceId,
          currency,
          cachedBalance: '0.000000'
        })
        .returning();

      return created;
    });
  }

  async recordLedgerEntry(
    context: WorkspaceContext,
    input: {
      accountId: string;
      type: 'grant' | 'purchase' | 'hold' | 'consume' | 'release' | 'refund' | 'adjustment';
      amount: string;
      balanceAfter: string;
      idempotencyKey: string;
      referenceType: string;
      referenceId: string;
      description: string;
      metadata?: Record<string, unknown>;
    }
  ) {
    return this.withScopedTransaction(context, 'billing:manage', async (tx) => {
      const creatorId = isWorkspaceUser(context) ? context.userId : null;

      const [entry] = await tx
        .insert(creditLedgerEntries)
        .values({
          workspaceId: context.workspaceId,
          accountId: input.accountId,
          type: input.type,
          amount: input.amount,
          balanceAfter: input.balanceAfter,
          idempotencyKey: input.idempotencyKey,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          description: input.description,
          metadata: input.metadata ?? {},
          createdBy: creatorId
        })
        .returning();

      // Update cached balance on account
      await tx
        .update(creditAccounts)
        .set({
          cachedBalance: input.balanceAfter,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(creditAccounts.workspaceId, context.workspaceId),
            eq(creditAccounts.id, input.accountId)
          )
        );

      return entry;
    });
  }

  async createReservation(
    context: WorkspaceContext,
    input: {
      accountId: string;
      runId?: string;
      reservationKey: string;
      heldAmount: string;
      expiresAt: Date;
    }
  ) {
    return this.withScopedTransaction(context, 'billing:manage', async (tx) => {
      const [reservation] = await tx
        .insert(creditReservations)
        .values({
          workspaceId: context.workspaceId,
          accountId: input.accountId,
          runId: input.runId,
          reservationKey: input.reservationKey,
          heldAmount: input.heldAmount,
          expiresAt: input.expiresAt,
          status: 'held'
        })
        .returning();

      return reservation;
    });
  }

  async settleReservation(
    context: WorkspaceContext,
    reservationKey: string,
    settledAmount: string
  ) {
    return this.withScopedTransaction(context, 'billing:manage', async (tx) => {
      const [settled] = await tx
        .update(creditReservations)
        .set({
          status: 'settled',
          settledAmount,
          settledAt: new Date()
        })
        .where(
          and(
            eq(creditReservations.workspaceId, context.workspaceId),
            eq(creditReservations.reservationKey, reservationKey),
            eq(creditReservations.status, 'held')
          )
        )
        .returning();

      return this.notFoundIfNull(settled, 'CreditReservation', reservationKey);
    });
  }

  async releaseReservation(context: WorkspaceContext, reservationKey: string) {
    return this.withScopedTransaction(context, 'billing:manage', async (tx) => {
      const [released] = await tx
        .update(creditReservations)
        .set({
          status: 'released',
          settledAt: new Date()
        })
        .where(
          and(
            eq(creditReservations.workspaceId, context.workspaceId),
            eq(creditReservations.reservationKey, reservationKey),
            eq(creditReservations.status, 'held')
          )
        )
        .returning();

      return this.notFoundIfNull(released, 'CreditReservation', reservationKey);
    });
  }

  async recordUsage(
    context: WorkspaceContext,
    input: {
      runId?: string;
      metric: string;
      quantity: string;
      unit: string;
      provider?: string;
      model?: string;
      idempotencyKey: string;
      costMetadata?: Record<string, unknown>;
    }
  ) {
    return this.withScopedTransaction(context, null, async (tx) => {
      const [usage] = await tx
        .insert(usageEvents)
        .values({
          workspaceId: context.workspaceId,
          runId: input.runId,
          metric: input.metric,
          quantity: input.quantity,
          unit: input.unit,
          provider: input.provider,
          model: input.model,
          idempotencyKey: input.idempotencyKey,
          costMetadata: input.costMetadata ?? {}
        })
        .returning();

      return usage;
    });
  }

  async listLedgerEntries(context: WorkspaceContext, options?: PaginationOptions) {
    return this.withScopedTransaction(context, 'billing:manage', async (tx) => {
      const { limit, offset } = normalizePagination(options);

      return tx
        .select()
        .from(creditLedgerEntries)
        .where(eq(creditLedgerEntries.workspaceId, context.workspaceId))
        .orderBy(desc(creditLedgerEntries.createdAt))
        .limit(limit)
        .offset(offset);
    });
  }
}
