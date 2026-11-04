import { sql } from 'drizzle-orm';
import { check, foreignKey, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { messageRole, conversationStatus, runInitiatorType, runState, runStepStatus, toolOperationStatus } from './enums.js';
import { agentVersions, agents } from './agents.js';
import { deployments } from './deployments.js';
import { users, workspaces } from './identity.js';

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id').notNull(),
    deploymentId: uuid('deployment_id'),
    externalSessionRef: varchar('external_session_ref', { length: 255 }),
    status: conversationStatus('status').default('active').notNull(),
    title: varchar('title', { length: 255 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'date' })
  },
  (table) => ({
    workspaceIdUnique: uniqueIndex('conversations_workspace_id_unique').on(table.workspaceId, table.id),
    agentForeignKey: foreignKey({
      columns: [table.workspaceId, table.agentId],
      foreignColumns: [agents.workspaceId, agents.id],
      name: 'conversations_workspace_agent_fk'
    }),
    deploymentForeignKey: foreignKey({
      columns: [table.workspaceId, table.deploymentId],
      foreignColumns: [deployments.workspaceId, deployments.id],
      name: 'conversations_workspace_deployment_fk'
    }),
    sessionUnique: uniqueIndex('conversations_workspace_session_unique')
      .on(table.workspaceId, table.externalSessionRef)
      .where(sql`${table.externalSessionRef} IS NOT NULL`),
    workspaceCreatedIndex: index('conversations_workspace_created_idx').on(table.workspaceId, table.createdAt)
  })
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id').notNull(),
    role: messageRole('role').notNull(),
    content: text('content').notNull(),
    sequence: integer('sequence').notNull(),
    modelMetadata: jsonb('model_metadata').$type<Record<string, unknown>>(),
    toolCallMetadata: jsonb('tool_call_metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    conversationSequenceUnique: uniqueIndex('messages_conversation_sequence_unique').on(table.workspaceId, table.conversationId, table.sequence),
    conversationForeignKey: foreignKey({
      columns: [table.workspaceId, table.conversationId],
      foreignColumns: [conversations.workspaceId, conversations.id],
      name: 'messages_workspace_conversation_fk'
    }),
    sequenceNonNegative: check('messages_sequence_non_negative', sql`${table.sequence} >= 0`),
    conversationIndex: index('messages_conversation_created_idx').on(table.workspaceId, table.conversationId, table.createdAt)
  })
);

export const runs = pgTable(
  'runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
    agentId: uuid('agent_id').notNull(),
    agentVersionId: uuid('agent_version_id').notNull(),
    deploymentId: uuid('deployment_id'),
    conversationId: uuid('conversation_id'),
    state: runState('state').default('queued').notNull(),
    initiatorType: runInitiatorType('initiator_type').notNull(),
    initiatorId: varchar('initiator_id', { length: 255 }).notNull(),
    inputPrompt: text('input_prompt').notNull(),
    outputSummary: text('output_summary'),
    errorClass: varchar('error_class', { length: 100 }),
    errorMessage: text('error_message'),
    idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
    correlationId: varchar('correlation_id', { length: 128 }).notNull(),
    traceId: varchar('trace_id', { length: 32 }),
    retryCount: integer('retry_count').default(0).notNull(),
    maxRetries: integer('max_retries').default(3).notNull(),
    leaseOwner: varchar('lease_owner', { length: 255 }),
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true, mode: 'date' }),
    checkpointNamespace: varchar('checkpoint_namespace', { length: 255 }),
    checkpointThreadId: varchar('checkpoint_thread_id', { length: 255 }),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    workspaceIdUnique: uniqueIndex('runs_workspace_id_unique').on(table.workspaceId, table.id),
    idempotencyUnique: uniqueIndex('runs_workspace_id_idempotency_unique').on(table.workspaceId, table.idempotencyKey),
    correlationIndex: index('runs_correlation_idx').on(table.workspaceId, table.correlationId),
    stateIndex: index('runs_state_idx').on(table.workspaceId, table.state),
    createdIndex: index('runs_created_idx').on(table.workspaceId, table.createdAt),
    queuedIndex: index('runs_queued_idx').on(table.workspaceId, table.createdAt).where(sql`${table.state} = 'queued'`),
    agentForeignKey: foreignKey({
      columns: [table.workspaceId, table.agentId],
      foreignColumns: [agents.workspaceId, agents.id],
      name: 'runs_workspace_agent_fk'
    }),
    versionForeignKey: foreignKey({
      columns: [table.workspaceId, table.agentVersionId],
      foreignColumns: [agentVersions.workspaceId, agentVersions.id],
      name: 'runs_workspace_version_fk'
    }),
    deploymentForeignKey: foreignKey({
      columns: [table.workspaceId, table.deploymentId],
      foreignColumns: [deployments.workspaceId, deployments.id],
      name: 'runs_workspace_deployment_fk'
    }),
    conversationForeignKey: foreignKey({
      columns: [table.workspaceId, table.conversationId],
      foreignColumns: [conversations.workspaceId, conversations.id],
      name: 'runs_workspace_conversation_fk'
    }),
    retryCountValid: check('runs_retry_count_valid', sql`${table.retryCount} >= 0 AND ${table.maxRetries} >= 0 AND ${table.retryCount} <= ${table.maxRetries}`),
    completedAfterStarted: check('runs_completed_after_started', sql`${table.completedAt} IS NULL OR ${table.startedAt} IS NULL OR ${table.completedAt} >= ${table.startedAt}`)
  })
);

export const runSteps = pgTable(
  'run_steps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
    runId: uuid('run_id').notNull(),
    sequence: integer('sequence').notNull(),
    stepType: varchar('step_type', { length: 80 }).notNull(),
    status: runStepStatus('status').default('pending').notNull(),
    input: jsonb('input').$type<Record<string, unknown>>(),
    output: jsonb('output').$type<Record<string, unknown>>(),
    errorClass: varchar('error_class', { length: 100 }),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    workspaceIdUnique: uniqueIndex('run_steps_workspace_id_unique').on(table.workspaceId, table.id),
    runSequenceUnique: uniqueIndex('run_steps_run_sequence_unique').on(table.workspaceId, table.runId, table.sequence),
    runForeignKey: foreignKey({
      columns: [table.workspaceId, table.runId],
      foreignColumns: [runs.workspaceId, runs.id],
      name: 'run_steps_workspace_run_fk'
    }),
    sequenceNonNegative: check('run_steps_sequence_non_negative', sql`${table.sequence} >= 0`),
    completedAfterStarted: check('run_steps_completed_after_started', sql`${table.completedAt} IS NULL OR ${table.startedAt} IS NULL OR ${table.completedAt} >= ${table.startedAt}`),
    runIndex: index('run_steps_run_idx').on(table.workspaceId, table.runId, table.sequence)
  })
);

export const runEvents = pgTable(
  'run_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
    runId: uuid('run_id').notNull(),
    correlationId: varchar('correlation_id', { length: 128 }).notNull(),
    eventVersion: integer('event_version').default(1).notNull(),
    eventType: varchar('event_type', { length: 120 }).notNull(),
    sequence: integer('sequence').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    visibility: varchar('visibility', { length: 50 }).default('operator').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    runSequenceUnique: uniqueIndex('run_events_run_sequence_unique').on(table.workspaceId, table.runId, table.sequence),
    runForeignKey: foreignKey({
      columns: [table.workspaceId, table.runId],
      foreignColumns: [runs.workspaceId, runs.id],
      name: 'run_events_workspace_run_fk'
    }),
    sequenceNonNegative: check('run_events_sequence_non_negative', sql`${table.sequence} >= 0`),
    versionPositive: check('run_events_version_positive', sql`${table.eventVersion} > 0`),
    runIndex: index('run_events_run_occurred_idx').on(table.workspaceId, table.runId, table.occurredAt)
  })
);

export const toolOperations = pgTable(
  'tool_operations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
    runId: uuid('run_id').notNull(),
    stepId: uuid('step_id'),
    operationKey: varchar('operation_key', { length: 255 }).notNull(),
    toolKey: varchar('tool_key', { length: 120 }).notNull(),
    status: toolOperationStatus('status').default('proposed').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    payloadHash: varchar('payload_hash', { length: 64 }).notNull(),
    providerOperationRef: varchar('provider_operation_ref', { length: 255 }),
    errorClass: varchar('error_class', { length: 100 }),
    errorMessage: text('error_message'),
    requestedAt: timestamp('requested_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' })
  },
  (table) => ({
    workspaceIdUnique: uniqueIndex('tool_operations_workspace_id_unique').on(table.workspaceId, table.id),
    operationUnique: uniqueIndex('tool_operations_run_operation_key_unique').on(table.workspaceId, table.runId, table.operationKey),
    payloadHashFormat: check('tool_operations_payload_hash_format', sql`${table.payloadHash} ~ '^[0-9a-f]{64}$'`),
    runForeignKey: foreignKey({
      columns: [table.workspaceId, table.runId],
      foreignColumns: [runs.workspaceId, runs.id],
      name: 'tool_operations_workspace_run_fk'
    }),
    stepForeignKey: foreignKey({
      columns: [table.workspaceId, table.stepId],
      foreignColumns: [runSteps.workspaceId, runSteps.id],
      name: 'tool_operations_workspace_step_fk'
    }),
    runIndex: index('tool_operations_run_status_idx').on(table.workspaceId, table.runId, table.status)
  })
);
