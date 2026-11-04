import { sql } from 'drizzle-orm';
import { check, foreignKey, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { toolRisk, toolSideEffect, toolStatus } from './enums.js';
import { agentVersions } from './agents.js';
import { users, workspaces } from './identity.js';

export const toolDefinitions = pgTable(
  'tool_definitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    toolKey: varchar('tool_key', { length: 120 }).notNull(),
    version: integer('version').notNull(),
    name: varchar('name', { length: 150 }).notNull(),
    description: text('description').notNull(),
    inputSchema: jsonb('input_schema').$type<Record<string, unknown>>().notNull(),
    outputSchema: jsonb('output_schema').$type<Record<string, unknown>>().notNull(),
    risk: toolRisk('risk').notNull(),
    sideEffect: toolSideEffect('side_effect').default('none').notNull(),
    requiredPermissions: jsonb('required_permissions').$type<string[]>().default([]).notNull(),
    timeoutMs: integer('timeout_ms').default(30_000).notNull(),
    status: toolStatus('status').default('active').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    keyVersionUnique: uniqueIndex('tool_definitions_key_version_unique').on(table.toolKey, table.version),
    activeIndex: index('tool_definitions_status_idx').on(table.status),
    versionPositive: check('tool_definitions_version_positive', sql`${table.version} > 0`),
    timeoutPositive: check('tool_definitions_timeout_positive', sql`${table.timeoutMs} BETWEEN 100 AND 900000`)
  })
);

export const agentVersionTools = pgTable(
  'agent_version_tools',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    agentVersionId: uuid('agent_version_id').notNull(),
    toolDefinitionId: uuid('tool_definition_id').notNull(),
    configuration: jsonb('configuration').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    assignmentUnique: uniqueIndex('agent_version_tools_version_tool_unique').on(table.workspaceId, table.agentVersionId, table.toolDefinitionId),
    versionForeignKey: foreignKey({
      columns: [table.workspaceId, table.agentVersionId],
      foreignColumns: [agentVersions.workspaceId, agentVersions.id],
      name: 'agent_version_tools_workspace_version_fk'
    }),
    workspaceIndex: index('agent_version_tools_workspace_idx').on(table.workspaceId)
  })
);
