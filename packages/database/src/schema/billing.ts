import { sql } from 'drizzle-orm';
import { check, foreignKey, index, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { creditLedgerType, creditReservationStatus } from './enums.js';
import { runs } from './runtime.js';
import { users, workspaces } from './identity.js';

export const creditAccounts = pgTable(
  'credit_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
    currency: varchar('currency', { length: 20 }).default('credits').notNull(),
    cachedBalance: numeric('cached_balance', { precision: 20, scale: 6 }).default('0').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    workspaceIdUnique: uniqueIndex('credit_accounts_workspace_id_unique').on(table.workspaceId, table.id),
    workspaceCurrencyUnique: uniqueIndex('credit_accounts_workspace_currency_unique').on(table.workspaceId, table.currency),
    balanceNonNegative: check('credit_accounts_cached_balance_non_negative', sql`${table.cachedBalance} >= 0`)
  })
);

export const creditLedgerEntries = pgTable(
  'credit_ledger_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
    accountId: uuid('account_id').notNull(),
    type: creditLedgerType('type').notNull(),
    amount: numeric('amount', { precision: 20, scale: 6 }).notNull(),
    balanceAfter: numeric('balance_after', { precision: 20, scale: 6 }).notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
    referenceType: varchar('reference_type', { length: 80 }).notNull(),
    referenceId: varchar('reference_id', { length: 255 }).notNull(),
    description: text('description').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    idempotencyUnique: uniqueIndex('credit_ledger_workspace_idempotency_unique').on(table.workspaceId, table.idempotencyKey),
    accountForeignKey: foreignKey({
      columns: [table.workspaceId, table.accountId],
      foreignColumns: [creditAccounts.workspaceId, creditAccounts.id],
      name: 'credit_ledger_workspace_account_fk'
    }),
    amountNonZero: check('credit_ledger_amount_non_zero', sql`${table.amount} <> 0`),
    balanceNonNegative: check('credit_ledger_balance_non_negative', sql`${table.balanceAfter} >= 0`),
    accountIndex: index('credit_ledger_account_created_idx').on(table.workspaceId, table.accountId, table.createdAt)
  })
);

export const creditReservations = pgTable(
  'credit_reservations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
    accountId: uuid('account_id').notNull(),
    runId: uuid('run_id'),
    reservationKey: varchar('reservation_key', { length: 128 }).notNull(),
    heldAmount: numeric('held_amount', { precision: 20, scale: 6 }).notNull(),
    settledAmount: numeric('settled_amount', { precision: 20, scale: 6 }),
    status: creditReservationStatus('status').default('held').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    settledAt: timestamp('settled_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    reservationUnique: uniqueIndex('credit_reservations_workspace_key_unique').on(table.workspaceId, table.reservationKey),
    accountForeignKey: foreignKey({
      columns: [table.workspaceId, table.accountId],
      foreignColumns: [creditAccounts.workspaceId, creditAccounts.id],
      name: 'credit_reservations_workspace_account_fk'
    }),
    runForeignKey: foreignKey({
      columns: [table.workspaceId, table.runId],
      foreignColumns: [runs.workspaceId, runs.id],
      name: 'credit_reservations_workspace_run_fk'
    }),
    amountsValid: check('credit_reservations_amounts_valid', sql`${table.heldAmount} > 0 AND (${table.settledAmount} IS NULL OR ${table.settledAmount} >= 0)`),
    settledWithinHold: check('credit_reservations_settled_within_hold', sql`${table.settledAmount} IS NULL OR ${table.settledAmount} <= ${table.heldAmount}`),
    accountStatusIndex: index('credit_reservations_account_status_idx').on(table.workspaceId, table.accountId, table.status)
  })
);

export const usageEvents = pgTable(
  'usage_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
    runId: uuid('run_id'),
    metric: varchar('metric', { length: 100 }).notNull(),
    quantity: numeric('quantity', { precision: 20, scale: 6 }).notNull(),
    unit: varchar('unit', { length: 50 }).notNull(),
    provider: varchar('provider', { length: 100 }),
    model: varchar('model', { length: 150 }),
    costMetadata: jsonb('cost_metadata').$type<Record<string, unknown>>().default({}).notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    idempotencyUnique: uniqueIndex('usage_events_workspace_idempotency_unique').on(table.workspaceId, table.idempotencyKey),
    runForeignKey: foreignKey({
      columns: [table.workspaceId, table.runId],
      foreignColumns: [runs.workspaceId, runs.id],
      name: 'usage_events_workspace_run_fk'
    }),
    quantityNonNegative: check('usage_events_quantity_non_negative', sql`${table.quantity} >= 0`),
    workspaceOccurredIndex: index('usage_events_workspace_occurred_idx').on(table.workspaceId, table.occurredAt)
  })
);
