import type { FastifyPluginAsync } from 'fastify';
import type { EnvConfig } from '@agentflow/config';

interface HealthRouteOptions {
  config?: EnvConfig;
}

export const healthRoutes: FastifyPluginAsync<HealthRouteOptions> = async (
  fastify,
  options
) => {
  const env = options.config?.NODE_ENV ?? process.env.NODE_ENV ?? 'development';

  fastify.get(
    '/health',
    {
      schema: {
        description: 'Liveness probe to verify that the Fastify API process is healthy and receiving traffic',
        tags: ['System'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'ok' },
              service: { type: 'string', example: 'api' },
              version: { type: 'string', example: '0.1.0' },
              environment: { type: 'string', example: 'development' },
              timestamp: { type: 'string', format: 'date-time' }
            },
            required: ['status', 'service', 'version', 'environment', 'timestamp']
          }
        }
      }
    },
    async (_request, reply) => {
      return reply.status(200).send({
        status: 'ok',
        service: 'api',
        version: '0.1.0',
        environment: env,
        timestamp: new Date().toISOString()
      });
    }
  );
};
