import { and, desc, eq } from 'drizzle-orm';
import { deployments, deploymentOrigins, agentVersions } from '../schema/index.js';
import { isWorkspaceUser, WorkspaceContext } from '../tenant-context.js';
import { BaseRepository, normalizePagination, PaginationOptions } from './base.js';

export class DeploymentRepository extends BaseRepository {
  async list(
    context: WorkspaceContext,
    options?: PaginationOptions & {
      environment?: 'development' | 'staging' | 'production';
      channel?: 'web' | 'widget' | 'api' | 'webhook' | 'scheduler';
    }
  ) {
    return this.withScopedTransaction(context, 'workspace:read', async (tx) => {
      const { limit, offset } = normalizePagination(options);
      const conditions = [eq(deployments.workspaceId, context.workspaceId)];

      if (options?.environment) conditions.push(eq(deployments.environment, options.environment));
      if (options?.channel) conditions.push(eq(deployments.channel, options.channel));

      return tx
        .select()
        .from(deployments)
        .where(and(...conditions))
        .orderBy(desc(deployments.createdAt))
        .limit(limit)
        .offset(offset);
    });
  }

  async findById(context: WorkspaceContext, id: string) {
    return this.withScopedTransaction(context, 'workspace:read', async (tx) => {
      const [deployment] = await tx
        .select()
        .from(deployments)
        .where(and(eq(deployments.workspaceId, context.workspaceId), eq(deployments.id, id)))
        .limit(1);

      return this.notFoundIfNull(deployment, 'Deployment', id);
    });
  }

  async create(
    context: WorkspaceContext,
    input: {
      agentId: string;
      environment: 'development' | 'staging' | 'production';
      channel: 'web' | 'widget' | 'api' | 'webhook' | 'scheduler';
      name: string;
      configOverrides?: Record<string, unknown>;
      enabledTools?: string[];
      rateLimitPerMinute?: number;
    }
  ) {
    return this.withScopedTransaction(context, 'workspace:update', async (tx) => {
      const creatorId = isWorkspaceUser(context) ? context.userId : context.workspaceId;

      const [created] = await tx
        .insert(deployments)
        .values({
          workspaceId: context.workspaceId,
          agentId: input.agentId,
          environment: input.environment,
          channel: input.channel,
          name: input.name,
          configOverrides: input.configOverrides ?? {},
          enabledTools: input.enabledTools ?? [],
          rateLimitPerMinute: input.rateLimitPerMinute ?? 60,
          createdBy: creatorId
        })
        .returning();

      return created;
    });
  }

  async promoteVersion(context: WorkspaceContext, deploymentId: string, versionId: string) {
    return this.withScopedTransaction(context, 'workspace:update', async (tx) => {
      // Verify version belongs to same workspace
      const [version] = await tx
        .select()
        .from(agentVersions)
        .where(and(eq(agentVersions.workspaceId, context.workspaceId), eq(agentVersions.id, versionId)))
        .limit(1);

      this.notFoundIfNull(version, 'AgentVersion', versionId);

      const [deployment] = await tx
        .update(deployments)
        .set({
          activeVersionId: versionId,
          status: 'active',
          updatedAt: new Date()
        })
        .where(and(eq(deployments.workspaceId, context.workspaceId), eq(deployments.id, deploymentId)))
        .returning();

      return this.notFoundIfNull(deployment, 'Deployment', deploymentId);
    });
  }

  async addOrigin(
    context: WorkspaceContext,
    input: { deploymentId: string; origin: string; status?: 'pending' | 'verified' | 'rejected' | 'revoked' }
  ) {
    return this.withScopedTransaction(context, 'workspace:update', async (tx) => {
      await this.findById(context, input.deploymentId);

      const [created] = await tx
        .insert(deploymentOrigins)
        .values({
          workspaceId: context.workspaceId,
          deploymentId: input.deploymentId,
          origin: input.origin,
          status: input.status ?? 'verified',
          verifiedAt: input.status === 'verified' ? new Date() : null
        })
        .returning();

      return created;
    });
  }

  async listOrigins(context: WorkspaceContext, deploymentId: string) {
    return this.withScopedTransaction(context, 'workspace:read', async (tx) => {
      return tx
        .select()
        .from(deploymentOrigins)
        .where(
          and(
            eq(deploymentOrigins.workspaceId, context.workspaceId),
            eq(deploymentOrigins.deploymentId, deploymentId)
          )
        );
    });
  }
}
