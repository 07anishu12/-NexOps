import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

const openapiPluginCallback: FastifyPluginAsync = async (fastify) => {
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'AgentFlow OS REST API',
        description:
          'Production REST API for AgentFlow OS / NexOps multi-tenant agent execution platform, durable runs, and FDE operations.',
        version: '0.1.0'
      },
      servers: [
        {
          url: '/',
          description: 'Local development server'
        }
      ],
      components: {
        securitySchemes: {
          apiKeyAuth: {
            type: 'apiKey',
            name: 'x-api-key',
            in: 'header',
            description: 'API key authentication via x-api-key header (format: af_live_... or af_test_...)'
          },
          bearerApiKey: {
            type: 'http',
            scheme: 'bearer',
            description: 'API key authentication via Authorization header (Bearer af_live_...)'
          },
          sessionAuth: {
            type: 'apiKey',
            name: 'af_session',
            in: 'cookie',
            description: 'Web session cookie'
          },
          widgetSession: {
            type: 'apiKey',
            name: 'x-widget-session',
            in: 'header',
            description: 'Public widget session token'
          }
        }
      },
      tags: [
        { name: 'System', description: 'Operational health, liveness, and readiness probes' },
        { name: 'Auth', description: 'Authentication and session verification' },
        { name: 'Workspaces', description: 'Multi-tenant workspace operations' },
        { name: 'Agents', description: 'Agent lifecycle and configuration' },
        { name: 'Runs', description: 'Durable workflow and agent execution runs' },
        { name: 'Integrations', description: 'External tool integrations and credentials' }
      ]
    }
  });

  // Swagger UI automatically provides /docs (UI) and /docs/json (raw spec)
  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true
    },
    staticCSP: false
  });
};

export const openapiPlugin = fp(openapiPluginCallback, {
  name: 'agentflow-openapi',
  fastify: '5.x'
});
