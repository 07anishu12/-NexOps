import type { FastifyPluginAsync } from 'fastify';
import { CreateRunRequestSchema } from '@agentflow/contracts';
import { createSuccessResponse } from '../../lib/responses.js';

export const runRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/runs/validate: Validate durable run execution payload against contracts schema
  fastify.post(
    '/validate',
    {
      preHandler: [fastify.requireTenantAuth()],
      schema: {
        description: 'Validate run submission parameters against schema contracts',
        tags: ['Runs'],
        security: [{ apiKeyAuth: [] }, { bearerApiKey: [] }, { sessionAuth: [] }]
      }
    },
    async (request, reply) => {
      const parsed = CreateRunRequestSchema.parse(request.body);
      return reply.send(
        createSuccessResponse(
          {
            valid: true,
            run: parsed
          },
          request
        )
      );
    }
  );
};
