import type { FastifyPluginAsync } from 'fastify';
import { createSuccessResponse } from '../../lib/responses.js';

export const workspaceRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/workspaces/current: Tenant-scoped workspace metadata
  fastify.get(
    '/current',
    {
      preHandler: [fastify.requireTenantAuth()],
      schema: {
        description: 'Get active workspace context for the authenticated principal',
        tags: ['Workspaces'],
        security: [{ apiKeyAuth: [] }, { bearerApiKey: [] }, { sessionAuth: [] }]
      }
    },
    async (request, reply) => {
      const tenant = request.tenantContext!;
      return reply.send(
        createSuccessResponse(
          {
            workspaceId: tenant.workspaceId,
            principalType: tenant.principalType,
            principalId: tenant.principalId
          },
          request
        )
      );
    }
  );
};
