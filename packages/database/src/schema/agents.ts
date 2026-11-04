import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from 'drizzle-orm/pg-core';
import { agentStatus, evaluationStatus } from './enums.js';
import { users, workspaces } from './identity.js';

export const agents = pgTable(
  'agents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description').default('').notNull(),
    status: agentStatus('status').default('draft').notNull(),
    currentDraft: jsonb('current_draft').$type<Record<string, unknown>>().notNull(),
    activeVersionId: uuid('active_version_id'),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'date' }),
    createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    workspaceIdUnique: uniqueIndex('agents_workspace_id_unique').on(table.workspaceId, table.id),
    workspaceNameUnique: uniqueIndex('agents_workspace_name_unique').on(table.workspaceId, table.name),
    workspaceCreatedIndex: index('agents_workspace_created_idx').on(table.workspaceId, table.createdAt),
    activeStatusIndex: index('agents_active_status_idx').on(table.workspaceId, table.status).where(sql`${table.archivedAt} IS NULL`)
  })
);

export const agentVersions = pgTable(
  'agent_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
    agentId: uuid('agent_id').notNull(),
    versionNumber: integer('version_number').notNull(),
    configSnapshot: jsonb('config_snapshot').$type<Record<string, unknown>>().notNull(),
    snapshotHash: varchar('snapshot_hash', { length: 64 }).notNull(),
    publishedBy: uuid('published_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    changelog: text('changelog')
  },
  (table) => ({
    workspaceIdUnique: uniqueIndex('agent_versions_workspace_id_unique').on(table.workspaceId, table.id),
    agentVersionUnique: uniqueIndex('agent_versions_workspace_agent_version_unique').on(
      table.workspaceId,
      table.agentId,
      table.versionNumber
    ),
    snapshotHashUnique: uniqueIndex('agent_versions_workspace_snapshot_hash_unique').on(table.workspaceId, table.snapshotHash),
    workspaceCreatedIndex: index('agent_versions_workspace_published_idx').on(table.workspaceId, table.publishedAt),
    agentForeignKey: foreignKey({
      columns: [table.workspaceId, table.agentId],
      foreignColumns: [agents.workspaceId, agents.id],
      name: 'agent_versions_workspace_agent_fk'
    }),
    versionNumberPositive: check('agent_versions_version_number_positive', sql`${table.versionNumber} > 0`),
    hashFormat: check('agent_versions_hash_format', sql`${table.snapshotHash} ~ '^[0-9a-f]{64}$'`)
  })
);

export const agentEvaluationSuites = pgTable(
  'agent_evaluation_suites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id').notNull(),
    name: varchar('name', { length: 150 }).notNull(),
    description: text('description'),
    createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    workspaceIdUnique: uniqueIndex('agent_evaluation_suites_workspace_id_unique').on(table.workspaceId, table.id),
    nameUnique: uniqueIndex('agent_evaluation_suites_workspace_name_unique').on(table.workspaceId, table.agentId, table.name),
    agentForeignKey: foreignKey({
      columns: [table.workspaceId, table.agentId],
      foreignColumns: [agents.workspaceId, agents.id],
      name: 'agent_evaluation_suites_workspace_agent_fk'
    })
  })
);

export const agentEvaluationCases = pgTable(
  'agent_evaluation_cases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    suiteId: uuid('suite_id').notNull(),
    name: varchar('name', { length: 150 }).notNull(),
    input: jsonb('input').$type<Record<string, unknown>>().notNull(),
    expected: jsonb('expected').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    workspaceIdUnique: uniqueIndex('agent_evaluation_cases_workspace_id_unique').on(table.workspaceId, table.id),
    suiteForeignKey: foreignKey({
      columns: [table.workspaceId, table.suiteId],
      foreignColumns: [agentEvaluationSuites.workspaceId, agentEvaluationSuites.id],
      name: 'agent_evaluation_cases_workspace_suite_fk'
    }),
    suiteNameUnique: uniqueIndex('agent_evaluation_cases_suite_name_unique').on(table.workspaceId, table.suiteId, table.name),
    suiteIndex: index('agent_evaluation_cases_suite_idx').on(table.workspaceId, table.suiteId)
  })
);

export const agentEvaluationResults = pgTable(
  'agent_evaluation_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
    suiteId: uuid('suite_id').notNull(),
    agentVersionId: uuid('agent_version_id').notNull(),
    caseId: uuid('case_id').notNull(),
    status: evaluationStatus('status').notNull(),
    score: integer('score'),
    output: jsonb('output').$type<Record<string, unknown>>(),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    suiteForeignKey: foreignKey({
      columns: [table.workspaceId, table.suiteId],
      foreignColumns: [agentEvaluationSuites.workspaceId, agentEvaluationSuites.id],
      name: 'agent_evaluation_results_workspace_suite_fk'
    }),
    versionForeignKey: foreignKey({
      columns: [table.workspaceId, table.agentVersionId],
      foreignColumns: [agentVersions.workspaceId, agentVersions.id],
      name: 'agent_evaluation_results_workspace_version_fk'
    }),
    caseForeignKey: foreignKey({
      columns: [table.workspaceId, table.caseId],
      foreignColumns: [agentEvaluationCases.workspaceId, agentEvaluationCases.id],
      name: 'agent_evaluation_results_workspace_case_fk'
    }),
    completedAfterStarted: check(
      'agent_evaluation_results_completed_after_started',
      sql`${table.completedAt} IS NULL OR ${table.startedAt} IS NULL OR ${table.completedAt} >= ${table.startedAt}`
    ),
    scoreRange: check('agent_evaluation_results_score_range', sql`${table.score} IS NULL OR (${table.score} >= 0 AND ${table.score} <= 100)`)
  })
);
