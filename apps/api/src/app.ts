import Fastify, { type FastifyInstance } from 'fastify';
import { loadApplicationConfig } from '@agentflow/config';
import { createLogger } from '@agentflow/observability';
import type { AppOptions } from './types.js';
import { globalErrorHandler, notFoundHandler } from './lib/errors.js';
import { requestContextPlugin } from './plugins/request-context.js';
import { securityPlugin } from './plugins/security.js';
import { corsPlugin } from './plugins/cors.js';
import { rateLimitPlugin } from './plugins/rate-limit.js';
import { openapiPlugin } from './plugins/openapi.js';
import { tenantContextPlugin } from './plugins/tenant-context.js';
import { healthRoutes } from './routes/health.js';
import { readyRoutes } from './routes/ready.js';
import { v1Routes } from './routes/v1/index.js';

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadApplicationConfig();
  const logger = options.logger ?? createLogger('api-service', config.LOG_LEVEL);

  const bodyLimit = config.MAX_ATTACHMENT_BYTES ?? 10 * 1024 * 1024;
  const requestTimeout = (config.DEFAULT_RUN_TIMEOUT_SECONDS ?? 120) * 1000;

  const app = Fastify({
    bodyLimit,
    requestTimeout,
    logger: false // We use @agentflow/observability JsonLogger through lifecycle hooks
  });

  // Global Error & 404 Handlers
  app.setErrorHandler(globalErrorHandler);
  app.setNotFoundHandler(notFoundHandler);

  // Core Security & Observability Plugins
  await app.register(securityPlugin, { enableCsp: config.NODE_ENV === 'production' });
  await app.register(corsPlugin, { config });
  await app.register(requestContextPlugin, { logger });

  // Rate Limiting (Redis-backed or in-memory)
  if (options.enableRateLimit !== false) {
    await app.register(rateLimitPlugin, {
      config,
      redisClient: options.redisClient,
      max: config.DEFAULT_PUBLIC_RATE_LIMIT
    });
  }

  // OpenAPI Documentation (Swagger & UI at /docs)
  await app.register(openapiPlugin);

  // Authentication & Tenant Context Middleware
  await app.register(tenantContextPlugin, { dbClient: options.dbClient });

  // Root Service Metadata
  app.get(
    '/',
    {
      schema: {
        description: 'Root service discovery information',
        tags: ['System'],
        response: {
          200: {
            type: 'object',
            properties: {
              service: { type: 'string' },
              version: { type: 'string' },
              docs: { type: 'string' }
            }
          }
        }
      }
    },
    async (_request, reply) => {
      return reply.send({
        service: 'AgentFlow OS REST API',
        version: 'v1',
        docs: '/docs'
      });
    }
  );

  // Operational Probes (Liveness & Readiness)
  await app.register(healthRoutes);
  await app.register(readyRoutes, {
    dbClient: options.dbClient,
    redisClient: options.redisClient
  });

  // Legacy health alias for backward compatibility
  app.get('/api/v1/health', { schema: { hide: true } }, async (_request, reply) => {
    return reply.status(200).send({
      status: 'ok',
      service: 'api',
      version: '0.1.0',
      environment: config.NODE_ENV,
      timestamp: new Date().toISOString()
    });
  });

  // Versioned V1 API
  await app.register(v1Routes, { prefix: '/v1', config });

  return app;
}
