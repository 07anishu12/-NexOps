import { sql } from 'drizzle-orm';
import { check, foreignKey, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { approvalEventType, approvalStatus, actorType, toolRisk } from './enums.js';
import { runs, toolOperations } from './runtime.js';
import { users, workspaces } from './identity.js';

export const approvals = pgTable(
  'approvals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
    runId: uuid('run_id').notNull(),
    toolOperationId: uuid('tool_operation_id').notNull(),
    toolName: varchar('tool_name', { length: 120 }).notNull(),
    riskLevel: toolRisk('risk_level').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    payloadHash: varchar('payload_hash', { length: 64 }).notNull(),
    status: approvalStatus('status').default('pending').notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'date' }),
    resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'restrict' }),
    decisionReason: text('decision_reason'),
    consumedAt: timestamp('consumed_at', { withTimezone: true, mode: 'date' }),
    consumedBy: uuid('consumed_by').references(() => users.id, { onDelete: 'restrict' })
  },
  (table) => ({
    workspaceIdUnique: uniqueIndex('approvals_workspace_id_unique').on(table.workspaceId, table.id),
    operationUnique: uniqueIndex('approvals_operation_unique').on(table.workspaceId, table.toolOperationId),
    runForeignKey: foreignKey({
      columns: [table.workspaceId, table.runId],
      foreignColumns: [runs.workspaceId, runs.id],
      name: 'approvals_workspace_run_fk'
    }),
    operationForeignKey: foreignKey({
      columns: [table.workspaceId, table.toolOperationId],
      foreignColumns: [toolOperations.workspaceId, toolOperations.id],
      name: 'approvals_workspace_operation_fk'
    }),
    pendingIndex: index('approvals_pending_idx').on(table.workspaceId, table.expiresAt).where(sql`${table.status} = 'pending'`),
    statusIndex: index('approvals_status_idx').on(table.workspaceId, table.status),
    payloadHashFormat: check('approvals_payload_hash_format', sql`${table.payloadHash} ~ '^[0-9a-f]{64}$'`),
    expiryAfterRequest: check('approvals_expiry_after_request', sql`${table.expiresAt} > ${table.requestedAt}`),
    consumedRequiresDecision: check('approvals_consumed_requires_decision', sql`${table.consumedAt} IS NULL OR ${table.status} = 'consumed'`)
  })
);

export const approvalEvents = pgTable(
  'approval_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
    approvalId: uuid('approval_id').notNull(),
    eventType: approvalEventType('event_type').notNull(),
    actorType: actorType('actor_type').notNull(),
    actorId: varchar('actor_id', { length: 255 }),
    reason: text('reason'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    approvalForeignKey: foreignKey({
      columns: [table.workspaceId, table.approvalId],
      foreignColumns: [approvals.workspaceId, approvals.id],
      name: 'approval_events_workspace_approval_fk'
    }),
    approvalIndex: index('approval_events_approval_created_idx').on(table.workspaceId, table.approvalId, table.createdAt)
  })
);
