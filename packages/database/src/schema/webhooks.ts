import { sql } from 'drizzle-orm';
import { check, foreignKey, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { endpointStatus, webhookDeliveryStatus } from './enums.js';
import { users, workspaces } from './identity.js';

export const webhookEndpoints = pgTable(
  'webhook_endpoints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    secretHash: varchar('secret_hash', { length: 64 }).notNull(),
    eventSubscriptions: jsonb('event_subscriptions').$type<string[]>().default([]).notNull(),
    status: endpointStatus('status').default('active').notNull(),
    createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    workspaceIdUnique: uniqueIndex('webhook_endpoints_workspace_id_unique').on(table.workspaceId, table.id),
    workspaceUrlUnique: uniqueIndex('webhook_endpoints_workspace_url_unique').on(table.workspaceId, table.url),
    secretHashFormat: check('webhook_endpoints_secret_hash_format', sql`${table.secretHash} ~ '^[0-9a-f]{64}$'`),
    workspaceStatusIndex: index('webhook_endpoints_workspace_status_idx').on(table.workspaceId, table.status)
  })
);

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
    endpointId: uuid('endpoint_id').notNull(),
    eventId: varchar('event_id', { length: 255 }).notNull(),
    eventType: varchar('event_type', { length: 120 }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: webhookDeliveryStatus('status').default('pending').notNull(),
    attemptCount: integer('attempt_count').default(0).notNull(),
    responseStatus: integer('response_status'),
    responseBodyRedacted: text('response_body_redacted'),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true, mode: 'date' }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    eventEndpointUnique: uniqueIndex('webhook_deliveries_endpoint_event_unique').on(table.workspaceId, table.endpointId, table.eventId),
    endpointForeignKey: foreignKey({
      columns: [table.workspaceId, table.endpointId],
      foreignColumns: [webhookEndpoints.workspaceId, webhookEndpoints.id],
      name: 'webhook_deliveries_workspace_endpoint_fk'
    }),
    attemptNonNegative: check('webhook_deliveries_attempt_non_negative', sql`${table.attemptCount} >= 0`),
    responseStatusValid: check('webhook_deliveries_response_status_valid', sql`${table.responseStatus} IS NULL OR ${table.responseStatus} BETWEEN 100 AND 599`),
    pendingIndex: index('webhook_deliveries_pending_idx').on(table.workspaceId, table.nextAttemptAt).where(sql`${table.status} IN ('pending', 'retrying')`)
  })
);
