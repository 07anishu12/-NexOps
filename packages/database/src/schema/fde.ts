import { sql } from 'drizzle-orm';
import { boolean, check, foreignKey, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { deploymentEnvironment, fdeStatus, readinessCheckStatus, readinessStatus, supportAccessStatus } from './enums.js';
import { deployments } from './deployments.js';
import { users, workspaces } from './identity.js';

export const fdeImplementationRecords = pgTable(
  'fde_implementation_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
    customerName: varchar('customer_name', { length: 255 }).notNull(),
    siteReference: text('site_reference'),
    environment: deploymentEnvironment('environment').notNull(),
    status: fdeStatus('status').default('discovery').notNull(),
    businessObjective: text('business_objective'),
    successCriteria: jsonb('success_criteria').$type<string[]>().default([]).notNull(),
    dataClassification: varchar('data_classification', { length: 80 }),
    acceptanceOwner: varchar('acceptance_owner', { length: 255 }),
    createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    workspaceIdUnique: uniqueIndex('fde_implementation_records_workspace_id_unique').on(table.workspaceId, table.id),
    workspaceEnvironmentIndex: index('fde_implementation_records_workspace_environment_idx').on(table.workspaceId, table.environment, table.status)
  })
);

export const deploymentReadinessReports = pgTable(
  'deployment_readiness_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
    implementationId: uuid('implementation_id').notNull(),
    deploymentId: uuid('deployment_id').notNull(),
    status: readinessStatus('status').notNull(),
    checkerVersion: varchar('checker_version', { length: 100 }).notNull(),
    evidenceReference: text('evidence_reference'),
    generatedAt: timestamp('generated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    generatedBy: uuid('generated_by').references(() => users.id, { onDelete: 'set null' })
  },
  (table) => ({
    workspaceIdUnique: uniqueIndex('deployment_readiness_reports_workspace_id_unique').on(table.workspaceId, table.id),
    implementationForeignKey: foreignKey({
      columns: [table.workspaceId, table.implementationId],
      foreignColumns: [fdeImplementationRecords.workspaceId, fdeImplementationRecords.id],
      name: 'deployment_readiness_reports_workspace_implementation_fk'
    }),
    deploymentForeignKey: foreignKey({
      columns: [table.workspaceId, table.deploymentId],
      foreignColumns: [deployments.workspaceId, deployments.id],
      name: 'deployment_readiness_reports_workspace_deployment_fk'
    }),
    reportIndex: index('deployment_readiness_reports_deployment_generated_idx').on(table.workspaceId, table.deploymentId, table.generatedAt)
  })
);

export const deploymentReadinessChecks = pgTable(
  'deployment_readiness_checks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
    reportId: uuid('report_id').notNull(),
    checkKey: varchar('check_key', { length: 120 }).notNull(),
    status: readinessCheckStatus('status').notNull(),
    blocking: boolean('blocking').default(true).notNull(),
    evidenceReference: text('evidence_reference'),
    remediationInstruction: text('remediation_instruction'),
    checkedAt: timestamp('checked_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    reportCheckUnique: uniqueIndex('deployment_readiness_checks_report_key_unique').on(table.workspaceId, table.reportId, table.checkKey),
    reportForeignKey: foreignKey({
      columns: [table.workspaceId, table.reportId],
      foreignColumns: [deploymentReadinessReports.workspaceId, deploymentReadinessReports.id],
      name: 'deployment_readiness_checks_workspace_report_fk'
    }),
    blockingIndex: index('deployment_readiness_checks_blocking_idx').on(table.workspaceId, table.status).where(sql`${table.blocking} = true`)
  })
);

export const supportAccessGrants = pgTable(
  'support_access_grants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
    requestedBy: uuid('requested_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'restrict' }),
    reasonCode: varchar('reason_code', { length: 100 }).notNull(),
    scope: jsonb('scope').$type<Record<string, unknown>>().notNull(),
    status: supportAccessStatus('status').default('requested').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    approvalReference: uuid('approval_reference'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
  },
  (table) => ({
    activeIndex: index('support_access_grants_active_idx').on(table.workspaceId, table.expiresAt).where(sql`${table.status} IN ('approved', 'active')`),
    expiryAfterStart: check('support_access_grants_expiry_after_start', sql`${table.startsAt} IS NULL OR ${table.expiresAt} > ${table.startsAt}`),
    approvalRequired: check('support_access_grants_approved_requires_actor', sql`${table.status} IN ('requested', 'expired', 'revoked') OR ${table.approvedBy} IS NOT NULL`)
  })
);
