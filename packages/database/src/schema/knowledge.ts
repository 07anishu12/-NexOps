import { sql } from 'drizzle-orm';
import { check, foreignKey, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { ingestionStatus, knowledgeSourceType } from './enums.js';
import { agents } from './agents.js';
import { users, workspaces } from './identity.js';

export const knowledgeSources = pgTable(
  'knowledge_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id'),
    type: knowledgeSourceType('type').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    sourceReference: text('source_reference'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    status: ingestionStatus('status').default('pending').notNull(),
    contentHash: varchar('content_hash', { length: 64 }),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    workspaceIdUnique: uniqueIndex('knowledge_sources_workspace_id_unique').on(table.workspaceId, table.id),
    sourceHashUnique: uniqueIndex('knowledge_sources_workspace_hash_unique')
      .on(table.workspaceId, table.contentHash)
      .where(sql`${table.deletedAt} IS NULL AND ${table.contentHash} IS NOT NULL`),
    agentForeignKey: foreignKey({
      columns: [table.workspaceId, table.agentId],
      foreignColumns: [agents.workspaceId, agents.id],
      name: 'knowledge_sources_workspace_agent_fk'
    }),
    hashFormat: check('knowledge_sources_hash_format', sql`${table.contentHash} IS NULL OR ${table.contentHash} ~ '^[0-9a-f]{64}$'`),
    statusIndex: index('knowledge_sources_status_idx').on(table.workspaceId, table.status, table.createdAt)
  })
);

export const knowledgeChunks = pgTable(
  'knowledge_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id').notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    embedding: jsonb('embedding').$type<number[]>().notNull(),
    embeddingModel: varchar('embedding_model', { length: 150 }).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    sourceChunkUnique: uniqueIndex('knowledge_chunks_source_index_unique').on(table.workspaceId, table.sourceId, table.chunkIndex),
    sourceForeignKey: foreignKey({
      columns: [table.workspaceId, table.sourceId],
      foreignColumns: [knowledgeSources.workspaceId, knowledgeSources.id],
      name: 'knowledge_chunks_workspace_source_fk'
    }),
    chunkIndexNonNegative: check('knowledge_chunks_index_non_negative', sql`${table.chunkIndex} >= 0`),
    sourceIndex: index('knowledge_chunks_source_idx').on(table.workspaceId, table.sourceId)
  })
);
