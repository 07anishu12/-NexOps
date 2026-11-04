import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import type { Redis } from 'ioredis';
import type { EnvConfig } from '@agentflow/config';

interface RateLimitPluginOptions {
  config?: EnvConfig;
  redisClient?: Redis;
  max?: number;
  timeWindow?: number;
}

const rateLimitPluginCallback: FastifyPluginAsync<RateLimitPluginOptions> = async (
  fastify,
  options
) => {
  const maxLimit = options.max ?? options.config?.DEFAULT_PUBLIC_RATE_LIMIT ?? 60;
  const timeWindow = options.timeWindow ?? 60_000; // 1 minute

  await fastify.register(rateLimit, {
    max: (req) => {
      // Authenticated workspace users / API keys get higher rate limits if desired
      if (req.tenantContext) {
        if (req.tenantContext.principalType === 'api_key') return maxLimit * 10;
        if (req.tenantContext.principalType === 'user') return maxLimit * 5;
        if (req.tenantContext.principalType === 'worker') return maxLimit * 20;
      }
      return maxLimit;
    },
    timeWindow,
    redis: options.redisClient,
    keyGenerator: (req) => {
      if (req.tenantContext) {
        return `tenant:${req.tenantContext.workspaceId}:${req.tenantContext.principalId}`;
      }
      const apiKeyHeader = req.headers['x-api-key'];
      if (typeof apiKeyHeader === 'string' && apiKeyHeader.trim().length > 0) {
        return `key:${apiKeyHeader.slice(0, 16)}`;
      }
      return `ip:${req.ip}`;
    },
    errorResponseBuilder: (_req, context) => {
      const err = new Error('Too many requests, please slow down and retry later') as Error & { statusCode: number };
      err.statusCode = context.statusCode ?? 429;
      return err;
    },
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true
    }
  });
};

export const rateLimitPlugin = fp(rateLimitPluginCallback, {
  name: 'agentflow-rate-limit',
  fastify: '5.x'
});
