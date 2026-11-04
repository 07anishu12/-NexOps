import { sql } from 'drizzle-orm';
import { check, foreignKey, index, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { apiKeyStatus } from './enums.js';
import { deployments } from './deployments.js';
import { users, workspaces } from './identity.js';

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    displayPrefix: varchar('display_prefix', { length: 32 }).notNull(),
    secretHash: varchar('secret_hash', { length: 64 }).notNull(),
    scopes: jsonb('scopes').$type<string[]>().default([]).notNull(),
    deploymentId: uuid('deployment_id'),
    status: apiKeyStatus('status').default('active').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'date' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    secretHashUnique: uniqueIndex('api_keys_secret_hash_unique').on(table.secretHash),
    displayPrefixUnique: uniqueIndex('api_keys_workspace_prefix_unique').on(table.workspaceId, table.displayPrefix),
    deploymentForeignKey: foreignKey({
      columns: [table.workspaceId, table.deploymentId],
      foreignColumns: [deployments.workspaceId, deployments.id],
      name: 'api_keys_workspace_deployment_fk'
    }),
    hashFormat: check('api_keys_hash_format', sql`${table.secretHash} ~ '^[0-9a-f]{64}$'`),
    activeIndex: index('api_keys_active_idx').on(table.workspaceId, table.status).where(sql`${table.status} = 'active'`)
  })
);

export const widgetSessions = pgTable(
  'widget_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    deploymentId: uuid('deployment_id').notNull(),
    sessionTokenHash: varchar('session_token_hash', { length: 64 }).notNull(),
    origin: varchar('origin', { length: 500 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    sessionHashUnique: uniqueIndex('widget_sessions_token_hash_unique').on(table.sessionTokenHash),
    deploymentForeignKey: foreignKey({
      columns: [table.workspaceId, table.deploymentId],
      foreignColumns: [deployments.workspaceId, deployments.id],
      name: 'widget_sessions_workspace_deployment_fk'
    }),
    hashFormat: check('widget_sessions_hash_format', sql`${table.sessionTokenHash} ~ '^[0-9a-f]{64}$'`),
    expiryIndex: index('widget_sessions_expiry_idx').on(table.workspaceId, table.expiresAt).where(sql`${table.revokedAt} IS NULL`)
  })
);
