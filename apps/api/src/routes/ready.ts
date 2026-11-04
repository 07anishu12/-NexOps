import type { FastifyPluginAsync } from 'fastify';
import { checkDatabaseConnection, type DatabaseClient } from '@agentflow/database';
import type { Redis } from 'ioredis';

interface ReadyRouteOptions {
  dbClient?: DatabaseClient;
  redisClient?: Redis;
}

export const readyRoutes: FastifyPluginAsync<ReadyRouteOptions> = async (
  fastify,
  options
) => {
  const { dbClient, redisClient } = options;

  fastify.get(
    '/ready',
    {
      schema: {
        description: 'Readiness probe to verify that backing dependencies (PostgreSQL, Redis) are healthy',
        tags: ['System'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'ready' },
              dependencies: {
                type: 'object',
                properties: {
                  database: { type: 'string', example: 'up' },
                  redis: { type: 'string', example: 'up' }
                }
              },
              timestamp: { type: 'string', format: 'date-time' }
            }
          },
          503: {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'degraded' },
              dependencies: {
                type: 'object',
                properties: {
                  database: { type: 'string' },
                  redis: { type: 'string' }
                }
              },
              errors: {
                type: 'object',
                additionalProperties: { type: 'string' }
              },
              timestamp: { type: 'string', format: 'date-time' }
            }
          }
        }
      }
    },
    async (_request, reply) => {
      const dependencies: Record<string, string> = {};
      const errors: Record<string, string> = {};
      let isDegraded = false;

      // 1. Check PostgreSQL Dependency
      if (dbClient) {
        try {
          const dbProbePromise = checkDatabaseConnection(dbClient);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Database probe timed out after 2000ms')), 2000)
          );
          await Promise.race([dbProbePromise, timeoutPromise]);
          dependencies.database = 'up';
        } catch (err) {
          isDegraded = true;
          dependencies.database = 'down';
          errors.database = err instanceof Error ? err.message : 'Database ping failed';
        }
      } else {
        dependencies.database = 'not_configured';
      }

      // 2. Check Redis Dependency
      if (redisClient) {
        try {
          const redisProbePromise = redisClient.ping();
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Redis probe timed out after 2000ms')), 2000)
          );
          const pong = await Promise.race([redisProbePromise, timeoutPromise]);
          if (pong === 'PONG') {
            dependencies.redis = 'up';
          } else {
            isDegraded = true;
            dependencies.redis = 'down';
            errors.redis = `Unexpected response: ${String(pong)}`;
          }
        } catch (err) {
          isDegraded = true;
          dependencies.redis = 'down';
          errors.redis = err instanceof Error ? err.message : 'Redis ping failed';
        }
      } else {
        dependencies.redis = 'not_configured';
      }

      const timestamp = new Date().toISOString();

      if (isDegraded) {
        return reply.status(503).send({
          status: 'degraded',
          dependencies,
          errors,
          timestamp
        });
      }

      return reply.status(200).send({
        status: 'ready',
        dependencies,
        timestamp
      });
    }
  );
};
