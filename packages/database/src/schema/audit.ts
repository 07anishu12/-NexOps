import { foreignKey, index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { actorType, notificationStatus } from './enums.js';
import { workspaceMembers, workspaces } from './identity.js';

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
    actorType: actorType('actor_type').notNull(),
    actorId: varchar('actor_id', { length: 255 }),
    action: varchar('action', { length: 120 }).notNull(),
    resourceType: varchar('resource_type', { length: 120 }).notNull(),
    resourceId: varchar('resource_id', { length: 255 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    workspaceOccurredIndex: index('audit_events_workspace_occurred_idx').on(table.workspaceId, table.occurredAt),
    resourceIndex: index('audit_events_resource_idx').on(table.workspaceId, table.resourceType, table.resourceId)
  })
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    recipientUserId: uuid('recipient_user_id').notNull(),
    type: varchar('type', { length: 100 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    body: text('body').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    status: notificationStatus('status').default('unread').notNull(),
    readAt: timestamp('read_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    recipientForeignKey: index('notifications_recipient_idx').on(table.workspaceId, table.recipientUserId, table.status),
    workspaceMemberIndex: index('notifications_workspace_member_idx').on(table.workspaceId, table.recipientUserId),
    recipientMemberForeignKey: foreignKey({
      columns: [table.workspaceId, table.recipientUserId],
      foreignColumns: [workspaceMembers.workspaceId, workspaceMembers.userId],
      name: 'notifications_workspace_recipient_fk'
    })
  })
);
