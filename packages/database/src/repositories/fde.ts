import { and, desc, eq } from 'drizzle-orm';
import {
  deploymentReadinessChecks,
  deploymentReadinessReports,
  fdeImplementationRecords,
  supportAccessGrants
} from '../schema/index.js';
import { isWorkspaceUser, WorkspaceContext } from '../tenant-context.js';
import { BaseRepository, normalizePagination, PaginationOptions } from './base.js';

export type DeploymentEnvironment = 'development' | 'staging' | 'production';
export type FdeStatus = 'discovery' | 'onboarding' | 'staging' | 'production' | 'handover' | 'closed';
export type ReadinessStatus = 'ready' | 'blocked' | 'ready_with_warnings';
export type ReadinessCheckStatus = 'passed' | 'blocked' | 'warning' | 'not_run';
export type SupportAccessStatus = 'requested' | 'approved' | 'active' | 'expired' | 'revoked';

export class FdeRepository extends BaseRepository {
  async listRecords(
    context: WorkspaceContext,
    options?: PaginationOptions & { environment?: DeploymentEnvironment; status?: FdeStatus }
  ) {
    return this.withScopedTransaction(context, 'workspace:read', async (tx) => {
      const { limit, offset } = normalizePagination(options);
      const conditions = [eq(fdeImplementationRecords.workspaceId, context.workspaceId)];

      if (options?.environment) {
        conditions.push(eq(fdeImplementationRecords.environment, options.environment));
      }
      if (options?.status) {
        conditions.push(eq(fdeImplementationRecords.status, options.status));
      }

      return tx
        .select()
        .from(fdeImplementationRecords)
        .where(and(...conditions))
        .orderBy(desc(fdeImplementationRecords.createdAt))
        .limit(limit)
        .offset(offset);
    });
  }

  async findRecordById(context: WorkspaceContext, id: string) {
    return this.withScopedTransaction(context, 'workspace:read', async (tx) => {
      const [record] = await tx
        .select()
        .from(fdeImplementationRecords)
        .where(
          and(
            eq(fdeImplementationRecords.workspaceId, context.workspaceId),
            eq(fdeImplementationRecords.id, id)
          )
        )
        .limit(1);

      return this.notFoundIfNull(record, 'FdeImplementationRecord', id);
    });
  }

  async createRecord(
    context: WorkspaceContext,
    input: {
      customerName: string;
      siteReference?: string;
      environment: DeploymentEnvironment;
      status?: FdeStatus;
      businessObjective?: string;
      successCriteria?: string[];
      dataClassification?: string;
      acceptanceOwner?: string;
      createdBy?: string;
    }
  ) {
    return this.withScopedTransaction(context, 'workspace:update', async (tx) => {
      const createdBy =
        input.createdBy ?? (isWorkspaceUser(context) ? context.principalId : null);
      if (!createdBy) {
        throw new Error('A valid user principal is required to create an FDE record');
      }

      const [record] = await tx
        .insert(fdeImplementationRecords)
        .values({
          workspaceId: context.workspaceId,
          customerName: input.customerName,
          siteReference: input.siteReference ?? null,
          environment: input.environment,
          status: input.status ?? 'discovery',
          businessObjective: input.businessObjective ?? null,
          successCriteria: input.successCriteria ?? [],
          dataClassification: input.dataClassification ?? null,
          acceptanceOwner: input.acceptanceOwner ?? null,
          createdBy
        })
        .returning();

      return record;
    });
  }

  async createReadinessReport(
    context: WorkspaceContext,
    input: {
      implementationId: string;
      deploymentId: string;
      status: ReadinessStatus;
      checkerVersion: string;
      evidenceReference?: string;
      generatedBy?: string;
    }
  ) {
    return this.withScopedTransaction(context, 'workspace:update', async (tx) => {
      // Validate implementation record belongs to this workspace
      const [impl] = await tx
        .select({ id: fdeImplementationRecords.id })
        .from(fdeImplementationRecords)
        .where(
          and(
            eq(fdeImplementationRecords.workspaceId, context.workspaceId),
            eq(fdeImplementationRecords.id, input.implementationId)
          )
        )
        .limit(1);

      this.notFoundIfNull(impl, 'FdeImplementationRecord', input.implementationId);

      const generatedBy =
        input.generatedBy ?? (isWorkspaceUser(context) ? context.principalId : null);

      const [report] = await tx
        .insert(deploymentReadinessReports)
        .values({
          workspaceId: context.workspaceId,
          implementationId: input.implementationId,
          deploymentId: input.deploymentId,
          status: input.status,
          checkerVersion: input.checkerVersion,
          evidenceReference: input.evidenceReference ?? null,
          generatedBy
        })
        .returning();

      return report;
    });
  }

  async addReadinessCheck(
    context: WorkspaceContext,
    input: {
      reportId: string;
      checkKey: string;
      status: ReadinessCheckStatus;
      blocking?: boolean;
      evidenceReference?: string;
      remediationInstruction?: string;
    }
  ) {
    return this.withScopedTransaction(context, 'workspace:update', async (tx) => {
      // Validate report belongs to this workspace
      const [report] = await tx
        .select({ id: deploymentReadinessReports.id })
        .from(deploymentReadinessReports)
        .where(
          and(
            eq(deploymentReadinessReports.workspaceId, context.workspaceId),
            eq(deploymentReadinessReports.id, input.reportId)
          )
        )
        .limit(1);

      this.notFoundIfNull(report, 'DeploymentReadinessReport', input.reportId);

      const [check] = await tx
        .insert(deploymentReadinessChecks)
        .values({
          workspaceId: context.workspaceId,
          reportId: input.reportId,
          checkKey: input.checkKey,
          status: input.status,
          blocking: input.blocking ?? true,
          evidenceReference: input.evidenceReference ?? null,
          remediationInstruction: input.remediationInstruction ?? null
        })
        .returning();

      return check;
    });
  }

  async listReadinessReports(
    context: WorkspaceContext,
    implementationId?: string,
    options?: PaginationOptions
  ) {
    return this.withScopedTransaction(context, 'workspace:read', async (tx) => {
      const { limit, offset } = normalizePagination(options);
      const conditions = [eq(deploymentReadinessReports.workspaceId, context.workspaceId)];

      if (implementationId) {
        conditions.push(eq(deploymentReadinessReports.implementationId, implementationId));
      }

      return tx
        .select()
        .from(deploymentReadinessReports)
        .where(and(...conditions))
        .orderBy(desc(deploymentReadinessReports.generatedAt))
        .limit(limit)
        .offset(offset);
    });
  }

  async grantSupportAccess(
    context: WorkspaceContext,
    input: {
      requestedBy?: string;
      approvedBy?: string;
      reasonCode: string;
      scope: Record<string, unknown>;
      status?: SupportAccessStatus;
      startsAt?: Date;
      expiresAt: Date;
      approvalReference?: string;
    }
  ) {
    return this.withScopedTransaction(context, 'workspace:update', async (tx) => {
      const requestedBy =
        input.requestedBy ?? (isWorkspaceUser(context) ? context.principalId : null);
      if (!requestedBy) {
        throw new Error('A valid user principal is required for requestedBy');
      }

      const [grant] = await tx
        .insert(supportAccessGrants)
        .values({
          workspaceId: context.workspaceId,
          requestedBy,
          approvedBy: input.approvedBy ?? null,
          reasonCode: input.reasonCode,
          scope: input.scope,
          status: input.status ?? 'requested',
          startsAt: input.startsAt ?? null,
          expiresAt: input.expiresAt,
          approvalReference: input.approvalReference ?? null
        })
        .returning();

      return grant;
    });
  }
}
