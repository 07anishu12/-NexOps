import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { TrustedTenantContext } from '@agentflow/database';
import type { TraceContext, WorkspaceRole } from '@agentflow/contracts';
import type { EnvConfig } from '@agentflow/config';
import type { Logger } from '@agentflow/observability';
import type { DatabaseClient } from '@agentflow/database';
import type { Redis } from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    requireTenantAuth: (allowedRoles?: WorkspaceRole[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireApiKeyAuth: () => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    requestId: string;
    correlationId: string;
    traceContext?: TraceContext;
    tenantContext?: TrustedTenantContext;
  }
}

export interface AppOptions {
  config?: EnvConfig;
  logger?: Logger;
  dbClient?: DatabaseClient;
  redisClient?: Redis;
  enableRateLimit?: boolean;
}

export type { FastifyInstance, FastifyRequest, FastifyReply };
