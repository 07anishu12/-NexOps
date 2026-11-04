import { and, desc, eq } from 'drizzle-orm';
import { agentVersions, agentVersionTools, toolDefinitions } from '../schema/index.js';
import { WorkspaceContext } from '../tenant-context.js';
import { BaseRepository, normalizePagination, PaginationOptions } from './base.js';

export type ToolRisk = 'read' | 'write' | 'external_side_effect' | 'high_impact';
export type ToolSideEffect = 'none' | 'internal_write' | 'external_write';
export type ToolStatus = 'active' | 'deprecated' | 'disabled';

export class ToolRepository extends BaseRepository {
  /**
   * Reads from the global tool definitions catalogue.
   */
  async listActiveTools(options?: PaginationOptions) {
    const { limit, offset } = normalizePagination(options);

    return this.client.db
      .select()
      .from(toolDefinitions)
      .where(eq(toolDefinitions.status, 'active'))
      .orderBy(toolDefinitions.toolKey, desc(toolDefinitions.version))
      .limit(limit)
      .offset(offset);
  }

  async findToolByKey(toolKey: string, version?: number) {
    const conditions = [eq(toolDefinitions.toolKey, toolKey)];
    if (version !== undefined) {
      conditions.push(eq(toolDefinitions.version, version));
    }

    const [tool] = await this.client.db
      .select()
      .from(toolDefinitions)
      .where(and(...conditions))
      .orderBy(desc(toolDefinitions.version))
      .limit(1);

    return this.notFoundIfNull(tool, 'ToolDefinition', `${toolKey}@${version ?? 'latest'}`);
  }

  async registerTool(input: {
    toolKey: string;
    version: number;
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    outputSchema: Record<string, unknown>;
    risk: ToolRisk;
    sideEffect?: ToolSideEffect;
    requiredPermissions?: string[];
    timeoutMs?: number;
    createdBy?: string;
  }) {
    const [tool] = await this.client.db
      .insert(toolDefinitions)
      .values({
        toolKey: input.toolKey,
        version: input.version,
        name: input.name,
        description: input.description,
        inputSchema: input.inputSchema,
        outputSchema: input.outputSchema,
        risk: input.risk,
        sideEffect: input.sideEffect ?? 'none',
        requiredPermissions: input.requiredPermissions ?? [],
        timeoutMs: input.timeoutMs ?? 30_000,
        status: 'active',
        createdBy: input.createdBy ?? null
      })
      .returning();

    return tool;
  }

  /**
   * Binds a global tool to an immutable agent version within tenant scope.
   */
  async bindToolToVersion(
    context: WorkspaceContext,
    input: {
      agentVersionId: string;
      toolDefinitionId: string;
      configuration?: Record<string, unknown>;
    }
  ) {
    return this.withScopedTransaction(context, 'agent:update', async (tx) => {
      // Ensure agent version belongs to this workspace
      const [version] = await tx
        .select({ id: agentVersions.id })
        .from(agentVersions)
        .where(
          and(
            eq(agentVersions.workspaceId, context.workspaceId),
            eq(agentVersions.id, input.agentVersionId)
          )
        )
        .limit(1);

      this.notFoundIfNull(version, 'AgentVersion', input.agentVersionId);

      const [binding] = await tx
        .insert(agentVersionTools)
        .values({
          workspaceId: context.workspaceId,
          agentVersionId: input.agentVersionId,
          toolDefinitionId: input.toolDefinitionId,
          configuration: input.configuration ?? {}
        })
        .returning();

      return binding;
    });
  }

  async listVersionTools(context: WorkspaceContext, agentVersionId: string) {
    return this.withScopedTransaction(context, 'agent:read', async (tx) => {
      return tx
        .select({
          id: agentVersionTools.id,
          workspaceId: agentVersionTools.workspaceId,
          agentVersionId: agentVersionTools.agentVersionId,
          toolDefinitionId: agentVersionTools.toolDefinitionId,
          configuration: agentVersionTools.configuration,
          createdAt: agentVersionTools.createdAt,
          tool: toolDefinitions
        })
        .from(agentVersionTools)
        .innerJoin(
          toolDefinitions,
          eq(agentVersionTools.toolDefinitionId, toolDefinitions.id)
        )
        .where(
          and(
            eq(agentVersionTools.workspaceId, context.workspaceId),
            eq(agentVersionTools.agentVersionId, agentVersionId)
          )
        );
    });
  }

  async unbindToolFromVersion(
    context: WorkspaceContext,
    agentVersionId: string,
    toolDefinitionId: string
  ) {
    return this.withScopedTransaction(context, 'agent:update', async (tx) => {
      const [deleted] = await tx
        .delete(agentVersionTools)
        .where(
          and(
            eq(agentVersionTools.workspaceId, context.workspaceId),
            eq(agentVersionTools.agentVersionId, agentVersionId),
            eq(agentVersionTools.toolDefinitionId, toolDefinitionId)
          )
        )
        .returning();

      return this.notFoundIfNull(deleted, 'AgentVersionTool', `${agentVersionId}/${toolDefinitionId}`);
    });
  }
}
