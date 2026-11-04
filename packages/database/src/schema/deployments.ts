import { sql } from 'drizzle-orm';
import { check, foreignKey, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { deploymentChannel, deploymentEnvironment, deploymentStatus, originStatus } from './enums.js';
import { agentVersions, agents } from './agents.js';
import { users, workspaces } from './identity.js';

export const deployments = pgTable(
  'deployments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id').notNull(),
    environment: deploymentEnvironment('environment').notNull(),
    channel: deploymentChannel('channel').notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    status: deploymentStatus('status').default('draft').notNull(),
    activeVersionId: uuid('active_version_id'),
    configOverrides: jsonb('config_overrides').$type<Record<string, unknown>>().default({}).notNull(),
    enabledTools: jsonb('enabled_tools').$type<string[]>().default([]).notNull(),
    rateLimitPerMinute: integer('rate_limit_per_minute').default(60).notNull(),
    createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'date' })
  },
  (table) => ({
    workspaceIdUnique: uniqueIndex('deployments_workspace_id_unique').on(table.workspaceId, table.id),
    nameEnvironmentUnique: uniqueIndex('deployments_workspace_name_environment_channel_unique').on(
      table.workspaceId,
      table.name,
      table.environment,
      table.channel
    ),
    agentForeignKey: foreignKey({
      columns: [table.workspaceId, table.agentId],
      foreignColumns: [agents.workspaceId, agents.id],
      name: 'deployments_workspace_agent_fk'
    }),
    activeVersionForeignKey: foreignKey({
      columns: [table.workspaceId, table.activeVersionId],
      foreignColumns: [agentVersions.workspaceId, agentVersions.id],
      name: 'deployments_workspace_active_version_fk'
    }),
    activeIndex: index('deployments_active_idx').on(table.workspaceId, table.environment).where(sql`${table.status} = 'active'`),
    statusIndex: index('deployments_status_idx').on(table.workspaceId, table.status),
    rateLimitPositive: check('deployments_rate_limit_positive', sql`${table.rateLimitPerMinute} > 0`)
  })
);

export const deploymentOrigins = pgTable(
  'deployment_origins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    deploymentId: uuid('deployment_id').notNull(),
    origin: varchar('origin', { length: 500 }).notNull(),
    status: originStatus('status').default('pending').notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    originUnique: uniqueIndex('deployment_origins_origin_unique').on(table.workspaceId, table.origin),
    deploymentOriginUnique: uniqueIndex('deployment_origins_deployment_origin_unique').on(table.workspaceId, table.deploymentId, table.origin),
    deploymentForeignKey: foreignKey({
      columns: [table.workspaceId, table.deploymentId],
      foreignColumns: [deployments.workspaceId, deployments.id],
      name: 'deployment_origins_workspace_deployment_fk'
    }),
    deploymentIndex: index('deployment_origins_deployment_idx').on(table.workspaceId, table.deploymentId)
  })
);

export const deploymentReleases = pgTable(
  'deployment_releases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
    deploymentId: uuid('deployment_id').notNull(),
    agentVersionId: uuid('agent_version_id').notNull(),
    releaseNumber: integer('release_number').notNull(),
    configSnapshot: jsonb('config_snapshot').$type<Record<string, unknown>>().notNull(),
    policySnapshot: jsonb('policy_snapshot').$type<Record<string, unknown>>().notNull(),
    publishedBy: uuid('published_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    rollbackOf: uuid('rollback_of'),
    notes: text('notes')
  },
  (table) => ({
    releaseUnique: uniqueIndex('deployment_releases_deployment_number_unique').on(table.workspaceId, table.deploymentId, table.releaseNumber),
    deploymentForeignKey: foreignKey({
      columns: [table.workspaceId, table.deploymentId],
      foreignColumns: [deployments.workspaceId, deployments.id],
      name: 'deployment_releases_workspace_deployment_fk'
    }),
    versionForeignKey: foreignKey({
      columns: [table.workspaceId, table.agentVersionId],
      foreignColumns: [agentVersions.workspaceId, agentVersions.id],
      name: 'deployment_releases_workspace_version_fk'
    }),
    releaseNumberPositive: check('deployment_releases_number_positive', sql`${table.releaseNumber} > 0`),
    deploymentIndex: index('deployment_releases_deployment_idx').on(table.workspaceId, table.deploymentId, table.publishedAt)
  })
);
