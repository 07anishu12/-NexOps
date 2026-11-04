import type { FastifyPluginAsync } from 'fastify';
import { createSuccessResponse } from '../../lib/responses.js';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/auth/me: Retrieve authenticated principal and active workspace profile
  fastify.get(
    '/me',
    {
      preHandler: [fastify.requireTenantAuth()],
      schema: {
        description: 'Get verified tenant context and authorization claims for current session or API key',
        tags: ['Auth'],
        security: [{ apiKeyAuth: [] }, { bearerApiKey: [] }, { sessionAuth: [] }]
      }
    },
    async (request, reply) => {
      const tenant = request.tenantContext!;
      return reply.send(
        createSuccessResponse(
          {
            principalType: tenant.principalType,
            principalId: tenant.principalId,
            workspaceId: tenant.workspaceId,
            authMethod: tenant.authMethod,
            correlationId: tenant.correlationId
          },
          request
        )
      );
    }
  );
};
