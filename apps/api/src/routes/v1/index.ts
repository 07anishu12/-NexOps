import type { FastifyPluginAsync } from 'fastify';
import type { EnvConfig } from '@agentflow/config';
import { authRoutes } from './auth.js';
import { workspaceRoutes } from './workspaces.js';
import { agentRoutes } from './agents.js';
import { runRoutes } from './runs.js';
import { integrationRoutes } from './integrations.js';

interface V1RouterOptions {
  config?: EnvConfig;
}

export const v1Routes: FastifyPluginAsync<V1RouterOptions> = async (
  fastify,
  options
) => {
  const env = options.config?.NODE_ENV ?? process.env.NODE_ENV ?? 'development';

  // GET /v1: Versioned root metadata
  fastify.get(
    '/',
    {
      schema: {
        description: 'V1 API root discovery metadata',
        tags: ['System'],
        response: {
          200: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              version: { type: 'string' },
              status: { type: 'string' },
              docs: { type: 'string' },
              environment: { type: 'string' }
            }
          }
        }
      }
    },
    async (_request, reply) => {
      return reply.send({
        name: 'AgentFlow OS REST API',
        version: 'v1',
        status: 'active',
        docs: '/docs',
        environment: env
      });
    }
  );

  // GET /v1/health: Backward compatibility alias for operational monitoring
  fastify.get(
    '/health',
    {
      schema: {
        description: 'V1 Health status probe',
        tags: ['System']
      }
    },
    async (_request, reply) => {
      return reply.send({
        status: 'ok',
        service: 'api',
        version: '0.1.0',
        environment: env,
        timestamp: new Date().toISOString()
      });
    }
  );

  // Modular Domain Route Registration
  await fastify.register(authRoutes, { prefix: '/auth' });
  await fastify.register(workspaceRoutes, { prefix: '/workspaces' });
  await fastify.register(agentRoutes, { prefix: '/agents' });
  await fastify.register(runRoutes, { prefix: '/runs' });
  await fastify.register(integrationRoutes, { prefix: '/integrations' });
};
