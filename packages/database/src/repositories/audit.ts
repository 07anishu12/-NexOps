import { and, desc, eq } from 'drizzle-orm';
import { auditEvents, notifications } from '../schema/index.js';
import {
  isApiKey,
  isWidgetSession,
  isWorker,
  isSystem,
  WorkspaceContext
} from '../tenant-context.js';
import { BaseRepository, normalizePagination, PaginationOptions } from './base.js';

export type ActorType = 'user' | 'api_key' | 'widget' | 'worker' | 'system' | 'support';
export type NotificationStatus = 'unread' | 'read' | 'dismissed';

export class AuditRepository extends BaseRepository {
  async recordEvent(
    context: WorkspaceContext,
    input: {
      actorType?: ActorType;
      actorId?: string;
      action: string;
      resourceType: string;
      resourceId?: string;
      metadata?: Record<string, unknown>;
    }
  ) {
    return this.withScopedTransaction(context, null, async (tx) => {
      let resolvedActorType: ActorType = 'user';
      let resolvedActorId: string | undefined;

      if (input.actorType) {
        resolvedActorType = input.actorType;
      } else if (isWidgetSession(context)) {
        resolvedActorType = 'widget';
      } else if (isWorker(context)) {
        resolvedActorType = 'worker';
      } else if (isApiKey(context)) {
        resolvedActorType = 'api_key';
      } else if (isSystem(context)) {
        resolvedActorType = 'system';
      }

      if (input.actorId) {
        resolvedActorId = input.actorId;
      } else if ('principalId' in context) {
        resolvedActorId = context.principalId;
      } else if ('userId' in context && context.userId) {
        resolvedActorId = context.userId;
      }

      const [event] = await tx
        .insert(auditEvents)
        .values({
          workspaceId: context.workspaceId,
          actorType: resolvedActorType,
          actorId: resolvedActorId ?? null,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId ?? null,
          metadata: input.metadata ?? {}
        })
        .returning();

      return event;
    });
  }

  async listEvents(
    context: WorkspaceContext,
    options?: PaginationOptions & { resourceType?: string; action?: string }
  ) {
    return this.withScopedTransaction(context, 'workspace:read', async (tx) => {
      const { limit, offset } = normalizePagination(options);
      const conditions = [eq(auditEvents.workspaceId, context.workspaceId)];

      if (options?.resourceType) {
        conditions.push(eq(auditEvents.resourceType, options.resourceType));
      }
      if (options?.action) {
        conditions.push(eq(auditEvents.action, options.action));
      }

      return tx
        .select()
        .from(auditEvents)
        .where(and(...conditions))
        .orderBy(desc(auditEvents.occurredAt))
        .limit(limit)
        .offset(offset);
    });
  }

  async createNotification(
    context: WorkspaceContext,
    input: {
      recipientUserId: string;
      type: string;
      title: string;
      body: string;
      metadata?: Record<string, unknown>;
    }
  ) {
    return this.withScopedTransaction(context, null, async (tx) => {
      const [notification] = await tx
        .insert(notifications)
        .values({
          workspaceId: context.workspaceId,
          recipientUserId: input.recipientUserId,
          type: input.type,
          title: input.title,
          body: input.body,
          metadata: input.metadata ?? {},
          status: 'unread'
        })
        .returning();

      return notification;
    });
  }

  async listNotifications(
    context: WorkspaceContext,
    options?: PaginationOptions & { recipientUserId?: string; status?: NotificationStatus }
  ) {
    return this.withScopedTransaction(context, 'workspace:read', async (tx) => {
      const { limit, offset } = normalizePagination(options);
      const conditions = [eq(notifications.workspaceId, context.workspaceId)];

      if (options?.recipientUserId) {
        conditions.push(eq(notifications.recipientUserId, options.recipientUserId));
      }
      if (options?.status) {
        conditions.push(eq(notifications.status, options.status));
      }

      return tx
        .select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);
    });
  }

  async markNotificationRead(context: WorkspaceContext, id: string) {
    return this.withScopedTransaction(context, 'workspace:read', async (tx) => {
      const [updated] = await tx
        .update(notifications)
        .set({
          status: 'read',
          readAt: new Date()
        })
        .where(
          and(
            eq(notifications.workspaceId, context.workspaceId),
            eq(notifications.id, id)
          )
        )
        .returning();

      return this.notFoundIfNull(updated, 'Notification', id);
    });
  }
}
