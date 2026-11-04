import type { FastifyPluginAsync } from 'fastify';
import { createSuccessResponse } from '../../lib/responses.js';

export const integrationRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/integrations/providers: Supported integration providers
  fastify.get(
    '/providers',
    {
      preHandler: [fastify.requireTenantAuth()],
      schema: {
        description: 'List supported platform integration providers',
        tags: ['Integrations'],
        security: [{ apiKeyAuth: [] }, { bearerApiKey: [] }, { sessionAuth: [] }]
      }
    },
    async (request, reply) => {
      return reply.send(
        createSuccessResponse(
          {
            providers: [
              { id: 'meta', name: 'Meta / Instagram Graph API', status: 'supported' },
              { id: 'razorpay', name: 'Razorpay Payment Gateway', status: 'supported' },
              { id: 'google', name: 'Google OAuth & Drive', status: 'supported' }
            ]
          },
          request
        )
      );
    }
  );
};
