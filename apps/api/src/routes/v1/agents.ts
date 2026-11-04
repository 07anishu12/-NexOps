import type { FastifyPluginAsync } from 'fastify';
import { CreateAgentRequestSchema } from '@agentflow/contracts';
import { createSuccessResponse } from '../../lib/responses.js';

export const agentRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/agents/validate: Validate agent configuration payload against contracts schema
  fastify.post(
    '/validate',
    {
      preHandler: [fastify.requireTenantAuth()],
      schema: {
        description: 'Validate an agent definition payload against system contracts',
        tags: ['Agents'],
        security: [{ apiKeyAuth: [] }, { bearerApiKey: [] }, { sessionAuth: [] }]
      }
    },
    async (request, reply) => {
      // Validate body using Zod contract schema
      const parsed = CreateAgentRequestSchema.parse(request.body);
      return reply.send(
        createSuccessResponse(
          {
            valid: true,
            agent: parsed
          },
          request
        )
      );
    }
  );
};
