import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { DatabaseClient } from '@agentflow/database';
import {
  resolveApiKeyContext,
  resolveSessionContext,
  resolveWidgetSessionContext,
  resolveWorkerContext,
  AuthenticationError,
  AuthorizationError
} from '@agentflow/database';
import type { WorkspaceRole } from '@agentflow/contracts';

interface TenantContextPluginOptions {
  dbClient?: DatabaseClient;
}

export type TenantAuthHook = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<void>;

export function createRequireTenantAuth(allowedRoles?: WorkspaceRole[]): TenantAuthHook {
  return async (request: FastifyRequest) => {
    if (!request.tenantContext) {
      throw new AuthenticationError('Authentication required: Valid session or API key must be provided');
    }

    if (allowedRoles && allowedRoles.length > 0) {
      if (request.tenantContext.principalType === 'user') {
        const userRole = request.tenantContext.role;
        if (!allowedRoles.includes(userRole)) {
          throw new AuthorizationError(`Insufficient workspace permissions. Required one of: ${allowedRoles.join(', ')}`);
        }
      } else if (request.tenantContext.principalType === 'api_key') {
        // API keys have full programmatic or scoped access; verify scopes if needed in future
      }
    }
  };
}

export function createRequireApiKeyAuth(): TenantAuthHook {
  return async (request: FastifyRequest) => {
    if (!request.tenantContext || request.tenantContext.principalType !== 'api_key') {
      throw new AuthenticationError('API key authentication required');
    }
  };
}

const tenantContextPluginCallback: FastifyPluginAsync<TenantContextPluginOptions> = async (
  fastify,
  options
) => {
  const dbClient = options.dbClient;

  // Decorate fastify with helper pre-handlers
  fastify.decorate('requireTenantAuth', createRequireTenantAuth);
  fastify.decorate('requireApiKeyAuth', createRequireApiKeyAuth);

  // Global preHandler hook to attempt credential resolution on every request
  fastify.addHook('preHandler', async (request) => {
    // If no dbClient provided (e.g. unit tests without DB), skip resolution
    if (!dbClient) return;

    // 1. API Key Header: x-api-key or Authorization: Bearer af_...
    const apiKeyHeader = request.headers['x-api-key'];
    const authHeader = request.headers.authorization;

    let plaintextApiKey: string | undefined;
    if (typeof apiKeyHeader === 'string' && apiKeyHeader.trim().length > 0) {
      plaintextApiKey = apiKeyHeader.trim();
    } else if (typeof authHeader === 'string' && authHeader.startsWith('Bearer af_')) {
      plaintextApiKey = authHeader.slice(7).trim();
    }

    if (plaintextApiKey) {
      request.tenantContext = await resolveApiKeyContext(dbClient, {
        plaintextApiKey,
        correlationId: request.correlationId
      });
      return;
    }

    // 2. Widget Session Token: x-widget-session or x-widget-token
    const widgetToken = request.headers['x-widget-session'] ?? request.headers['x-widget-token'];
    if (typeof widgetToken === 'string' && widgetToken.trim().length > 0) {
      const origin = typeof request.headers.origin === 'string' ? request.headers.origin : '';
      request.tenantContext = await resolveWidgetSessionContext(dbClient, {
        sessionToken: widgetToken.trim(),
        origin,
        correlationId: request.correlationId
      });
      return;
    }

    // 3. User Session Cookie or Authorization: Bearer sess_...
    let sessionToken: string | undefined;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer sess_')) {
      sessionToken = authHeader.slice(7).trim();
    } else if (typeof request.headers.cookie === 'string') {
      const match = request.headers.cookie.match(/(?:^|;\s*)af_session=([^;]+)/);
      if (match && match[1]) {
        sessionToken = decodeURIComponent(match[1]);
      }
    }

    if (sessionToken) {
      const requestedWorkspaceId = typeof request.headers['x-workspace-id'] === 'string'
        ? request.headers['x-workspace-id'].trim()
        : undefined;

      request.tenantContext = await resolveSessionContext(dbClient, {
        sessionToken,
        requestedWorkspaceId,
        correlationId: request.correlationId
      });
      return;
    }

    // 4. Internal Worker Lease Header: x-worker-run-id
    const workerRunId = request.headers['x-worker-run-id'];
    if (typeof workerRunId === 'string' && workerRunId.trim().length > 0) {
      const leaseOwner = typeof request.headers['x-worker-lease-owner'] === 'string'
        ? request.headers['x-worker-lease-owner'].trim()
        : undefined;

      request.tenantContext = await resolveWorkerContext(dbClient, {
        runId: workerRunId.trim(),
        leaseOwner,
        correlationId: request.correlationId
      });
      return;
    }
  });
};

export const tenantContextPlugin = fp(tenantContextPluginCallback, {
  name: 'agentflow-tenant-context',
  fastify: '5.x'
});
