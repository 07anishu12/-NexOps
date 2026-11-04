import { sql } from 'drizzle-orm';
import { boolean, check, foreignKey, index, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { paymentEventStatus, paymentStatus } from './enums.js';
import { users, workspaces } from './identity.js';

export const paymentOrders = pgTable(
  'payment_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
    provider: varchar('provider', { length: 50 }).notNull(),
    externalOrderId: varchar('external_order_id', { length: 255 }).notNull(),
    amount: numeric('amount', { precision: 20, scale: 6 }).notNull(),
    currency: varchar('currency', { length: 10 }).notNull(),
    status: paymentStatus('status').default('created').notNull(),
    checkoutMetadata: jsonb('checkout_metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    workspaceIdUnique: uniqueIndex('payment_orders_workspace_id_unique').on(table.workspaceId, table.id),
    providerOrderUnique: uniqueIndex('payment_orders_provider_order_unique').on(table.provider, table.externalOrderId),
    amountPositive: check('payment_orders_amount_positive', sql`${table.amount} > 0`),
    workspaceStatusIndex: index('payment_orders_workspace_status_idx').on(table.workspaceId, table.status)
  })
);

export const paymentEvents = pgTable(
  'payment_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
    paymentOrderId: uuid('payment_order_id'),
    provider: varchar('provider', { length: 50 }).notNull(),
    providerEventId: varchar('provider_event_id', { length: 255 }).notNull(),
    signatureVerified: boolean('signature_verified').notNull(),
    signatureAlgorithm: varchar('signature_algorithm', { length: 50 }),
    payloadHash: varchar('payload_hash', { length: 64 }).notNull(),
    rawPayload: jsonb('raw_payload').$type<Record<string, unknown>>().notNull(),
    status: paymentEventStatus('status').default('received').notNull(),
    processingError: text('processing_error'),
    receivedAt: timestamp('received_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true, mode: 'date' })
  },
  (table) => ({
    providerEventUnique: uniqueIndex('payment_events_provider_event_unique').on(table.provider, table.providerEventId),
    orderForeignKey: foreignKey({
      columns: [table.workspaceId, table.paymentOrderId],
      foreignColumns: [paymentOrders.workspaceId, paymentOrders.id],
      name: 'payment_events_workspace_order_fk'
    }),
    payloadHashFormat: check('payment_events_payload_hash_format', sql`${table.payloadHash} ~ '^[0-9a-f]{64}$'`),
    signatureRule: check('payment_events_signature_rule', sql`${table.status} = 'received' OR ${table.signatureVerified} = true`),
    providerIndex: index('payment_events_provider_status_idx').on(table.provider, table.status)
  })
);
