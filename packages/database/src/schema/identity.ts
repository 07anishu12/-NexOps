import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from 'drizzle-orm/pg-core';
import { invitationStatus, userRole, workspacePlan } from './enums.js';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
});

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    plan: workspacePlan('plan').default('free').notNull(),
    timezone: varchar('timezone', { length: 50 }).default('UTC').notNull(),
    locale: varchar('locale', { length: 20 }).default('en').notNull(),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    onboardingCompleted: boolean('onboarding_completed').default(false).notNull(),
    onboardingIntent: jsonb('onboarding_intent').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    slugUnique: uniqueIndex('workspaces_slug_unique').on(table.slug),
    ownerIndex: index('workspaces_owner_idx').on(table.ownerId),
    slugFormat: check('workspaces_slug_format', sql`${table.slug} ~ '^[a-z0-9][a-z0-9-]{1,98}[a-z0-9]$'`)
  })
);

export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 50 }).notNull(),
    providerSubject: varchar('provider_subject', { length: 255 }).notNull(),
    providerEmail: varchar('provider_email', { length: 255 }),
    grantedScopes: jsonb('granted_scopes').$type<string[]>().default([]).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    providerIdentityUnique: uniqueIndex('oauth_accounts_provider_subject_unique').on(table.provider, table.providerSubject),
    userProviderUnique: uniqueIndex('oauth_accounts_user_provider_unique').on(table.userId, table.provider)
  })
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionTokenHash: varchar('session_token_hash', { length: 64 }).notNull(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true, mode: 'date' })
  },
  (table) => ({
    tokenUnique: uniqueIndex('sessions_token_hash_unique').on(table.sessionTokenHash),
    userExpiryIndex: index('sessions_user_expiry_idx').on(table.userId, table.expiresAt),
    activeIndex: index('sessions_active_idx').on(table.userId, table.expiresAt).where(sql`${table.revokedAt} IS NULL`)
  })
);

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: userRole('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    workspaceUserUnique: uniqueIndex('workspace_members_workspace_user_unique').on(table.workspaceId, table.userId),
    workspaceIdUnique: uniqueIndex('workspace_members_workspace_id_unique').on(table.workspaceId, table.id),
    workspaceIndex: index('workspace_members_workspace_idx').on(table.workspaceId),
    userIndex: index('workspace_members_user_idx').on(table.userId)
  })
);

export const workspaceInvitations = pgTable(
  'workspace_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    role: userRole('role').default('viewer').notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    invitedBy: uuid('invited_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    status: invitationStatus('status').default('pending').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true, mode: 'date' }),
    acceptedBy: uuid('accepted_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    tokenUnique: uniqueIndex('workspace_invitations_token_hash_unique').on(table.tokenHash),
    workspaceEmailIndex: index('workspace_invitations_workspace_email_idx').on(table.workspaceId, table.email),
    pendingIndex: index('workspace_invitations_pending_idx')
      .on(table.workspaceId, table.email, table.expiresAt)
      .where(sql`${table.status} = 'pending'`),
    acceptedByWorkspace: foreignKey({
      columns: [table.workspaceId, table.acceptedBy],
      foreignColumns: [workspaceMembers.workspaceId, workspaceMembers.userId],
      name: 'workspace_invitations_accepted_member_fk'
    })
  })
);
