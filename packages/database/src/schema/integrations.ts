import { sql } from 'drizzle-orm';
import { foreignKey, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { connectionStatus, provider } from './enums.js';
import { users, workspaces } from './identity.js';

export const integrationConnections = pgTable(
  'integration_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    provider: provider('provider').notNull(),
    externalAccountRef: varchar('external_account_ref', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: 255 }),
    grantedScopes: jsonb('granted_scopes').$type<string[]>().default([]).notNull(),
    status: connectionStatus('status').default('pending').notNull(),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true, mode: 'date' }),
    lastHealthCheckAt: timestamp('last_health_check_at', { withTimezone: true, mode: 'date' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    connectedBy: uuid('connected_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    workspaceIdUnique: uniqueIndex('integration_connections_workspace_id_unique').on(table.workspaceId, table.id),
    providerAccountUnique: uniqueIndex('integration_connections_provider_account_unique').on(
      table.workspaceId,
      table.provider,
      table.externalAccountRef
    ),
    providerIndex: index('integration_connections_provider_idx').on(table.workspaceId, table.provider),
    statusIndex: index('integration_connections_status_idx').on(table.workspaceId, table.status),
    activeIndex: index('integration_connections_active_idx')
      .on(table.workspaceId, table.provider)
      .where(sql`${table.status} IN ('connected', 'degraded')`)
  })
);

export const encryptedCredentials = pgTable(
  'encrypted_credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    connectionId: uuid('connection_id').notNull(),
    ciphertext: text('ciphertext').notNull(),
    iv: varchar('iv', { length: 128 }).notNull(),
    authTag: varchar('auth_tag', { length: 128 }).notNull(),
    keyReference: varchar('key_reference', { length: 255 }).notNull(),
    keyVersion: varchar('key_version', { length: 100 }).notNull(),
    encryptedAt: timestamp('encrypted_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    rotatedAt: timestamp('rotated_at', { withTimezone: true, mode: 'date' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' })
  },
  (table) => ({
    connectionForeignKey: foreignKey({
      columns: [table.workspaceId, table.connectionId],
      foreignColumns: [integrationConnections.workspaceId, integrationConnections.id],
      name: 'encrypted_credentials_workspace_connection_fk'
    }),
    activeConnectionUnique: uniqueIndex('encrypted_credentials_active_connection_unique')
      .on(table.workspaceId, table.connectionId)
      .where(sql`${table.revokedAt} IS NULL`),
    workspaceIndex: index('encrypted_credentials_workspace_idx').on(table.workspaceId)
  })
);
