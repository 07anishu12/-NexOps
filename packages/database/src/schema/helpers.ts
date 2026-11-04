import { timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const createdAt = () => timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull();
export const updatedAt = () => timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull();
export const workspaceId = () => uuid('workspace_id').notNull();
export const hashColumn = (name: string) => varchar(name, { length: 64 }).notNull();
