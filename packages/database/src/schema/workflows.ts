import { sql } from 'drizzle-orm';
import { check, foreignKey, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { workflowRunStatus, workflowStatus, workflowTriggerStatus, workflowTriggerType } from './enums.js';
import { users, workspaces } from './identity.js';

export const workflows = pgTable(
  'workflows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 150 }).notNull(),
    description: text('description').default('').notNull(),
    status: workflowStatus('status').default('draft').notNull(),
    activeVersionId: uuid('active_version_id'),
    createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'date' })
  },
  (table) => ({
    workspaceIdUnique: uniqueIndex('workflows_workspace_id_unique').on(table.workspaceId, table.id),
    nameUnique: uniqueIndex('workflows_workspace_name_unique').on(table.workspaceId, table.name),
    workspaceStatusIndex: index('workflows_workspace_status_idx').on(table.workspaceId, table.status)
  })
);

export const workflowVersions = pgTable(
  'workflow_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
    workflowId: uuid('workflow_id').notNull(),
    versionNumber: integer('version_number').notNull(),
    graphSnapshot: jsonb('graph_snapshot').$type<Record<string, unknown>>().notNull(),
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    publishedBy: uuid('published_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    changelog: text('changelog')
  },
  (table) => ({
    workspaceIdUnique: uniqueIndex('workflow_versions_workspace_id_unique').on(table.workspaceId, table.id),
    versionUnique: uniqueIndex('workflow_versions_workspace_workflow_version_unique').on(table.workspaceId, table.workflowId, table.versionNumber),
    hashUnique: uniqueIndex('workflow_versions_workspace_hash_unique').on(table.workspaceId, table.contentHash),
    workflowForeignKey: foreignKey({
      columns: [table.workspaceId, table.workflowId],
      foreignColumns: [workflows.workspaceId, workflows.id],
      name: 'workflow_versions_workspace_workflow_fk'
    }),
    versionPositive: check('workflow_versions_version_positive', sql`${table.versionNumber} > 0`),
    hashFormat: check('workflow_versions_hash_format', sql`${table.contentHash} ~ '^[0-9a-f]{64}$'`)
  })
);

export const workflowTriggers = pgTable(
  'workflow_triggers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    workflowId: uuid('workflow_id').notNull(),
    type: workflowTriggerType('type').notNull(),
    configuration: jsonb('configuration').$type<Record<string, unknown>>().notNull(),
    status: workflowTriggerStatus('status').default('active').notNull(),
    secretHash: varchar('secret_hash', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    workspaceIdUnique: uniqueIndex('workflow_triggers_workspace_id_unique').on(table.workspaceId, table.id),
    workflowForeignKey: foreignKey({
      columns: [table.workspaceId, table.workflowId],
      foreignColumns: [workflows.workspaceId, workflows.id],
      name: 'workflow_triggers_workspace_workflow_fk'
    }),
    secretHashFormat: check('workflow_triggers_secret_hash_format', sql`${table.secretHash} IS NULL OR ${table.secretHash} ~ '^[0-9a-f]{64}$'`),
    workflowIndex: index('workflow_triggers_workflow_status_idx').on(table.workspaceId, table.workflowId, table.status)
  })
);

export const workflowRuns = pgTable(
  'workflow_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
    workflowId: uuid('workflow_id').notNull(),
    workflowVersionId: uuid('workflow_version_id').notNull(),
    triggerId: uuid('trigger_id'),
    status: workflowRunStatus('status').default('queued').notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
    correlationId: varchar('correlation_id', { length: 128 }).notNull(),
    input: jsonb('input').$type<Record<string, unknown>>().default({}).notNull(),
    output: jsonb('output').$type<Record<string, unknown>>(),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    idempotencyUnique: uniqueIndex('workflow_runs_workspace_idempotency_unique').on(table.workspaceId, table.idempotencyKey),
    workflowForeignKey: foreignKey({
      columns: [table.workspaceId, table.workflowId],
      foreignColumns: [workflows.workspaceId, workflows.id],
      name: 'workflow_runs_workspace_workflow_fk'
    }),
    versionForeignKey: foreignKey({
      columns: [table.workspaceId, table.workflowVersionId],
      foreignColumns: [workflowVersions.workspaceId, workflowVersions.id],
      name: 'workflow_runs_workspace_version_fk'
    }),
    triggerForeignKey: foreignKey({
      columns: [table.workspaceId, table.triggerId],
      foreignColumns: [workflowTriggers.workspaceId, workflowTriggers.id],
      name: 'workflow_runs_workspace_trigger_fk'
    }),
    completedAfterStarted: check('workflow_runs_completed_after_started', sql`${table.completedAt} IS NULL OR ${table.startedAt} IS NULL OR ${table.completedAt} >= ${table.startedAt}`),
    statusIndex: index('workflow_runs_status_idx').on(table.workspaceId, table.status, table.createdAt)
  })
);
