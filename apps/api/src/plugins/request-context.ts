import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { parseTraceparent, formatTraceparent } from '@agentflow/contracts';
import type { Logger } from '@agentflow/observability';

interface RequestContextPluginOptions {
  logger?: Logger;
}

const requestContextPluginCallback: FastifyPluginAsync<RequestContextPluginOptions> = async (
  fastify,
  options
) => {
  const logger = options.logger;

  fastify.decorateRequest('requestId', '');
  fastify.decorateRequest('correlationId', '');
  fastify.decorateRequest('traceContext', undefined);
  fastify.decorateRequest('tenantContext', undefined);

  // Symbol for high-precision request timing
  const startTimeSym = Symbol('agentflow.requestStartTime');

  fastify.addHook('onRequest', async (request) => {
    // 1. Establish Request ID
    const incomingReqId = request.headers['x-request-id'];
    request.requestId = typeof incomingReqId === 'string' && incomingReqId.trim().length > 0
      ? incomingReqId.trim()
      : `req-${randomUUID()}`;

    // 2. Establish Correlation ID
    const incomingCorrId = request.headers['x-correlation-id'];
    request.correlationId = typeof incomingCorrId === 'string' && incomingCorrId.trim().length > 0
      ? incomingCorrId.trim()
      : request.requestId;

    // 3. Parse W3C Distributed Tracing header
    const traceparentHeader = request.headers['traceparent'];
    if (typeof traceparentHeader === 'string') {
      const parsed = parseTraceparent(traceparentHeader);
      if (parsed) {
        request.traceContext = parsed;
      }
    }

    // 4. Mark high-res start time
    (request as unknown as Record<symbol, bigint>)[startTimeSym] = process.hrtime.bigint();
  });

  fastify.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.requestId);
    reply.header('x-correlation-id', request.correlationId);

    if (request.traceContext) {
      reply.header(
        'traceparent',
        formatTraceparent({
          traceId: request.traceContext.traceId,
          spanId: request.traceContext.spanId,
          sampled: request.traceContext.sampled
        })
      );
    }
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const start = (request as unknown as Record<symbol, bigint>)[startTimeSym];
    const durationMs = start
      ? Number(process.hrtime.bigint() - start) / 1_000_000
      : 0;

    const statusCode = reply.statusCode;
    const logData = {
      method: request.method,
      url: request.url,
      statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      requestId: request.requestId,
      correlationId: request.correlationId,
      traceId: request.traceContext?.traceId,
      workspaceId: request.tenantContext?.workspaceId,
      principalId: request.tenantContext?.principalId,
      principalType: request.tenantContext?.principalType
    };

    if (logger) {
      if (statusCode >= 500) {
        logger.error(`HTTP ${request.method} ${request.url} - ${statusCode} (${logData.durationMs}ms)`, undefined, logData);
      } else if (statusCode >= 400) {
        logger.warn(`HTTP ${request.method} ${request.url} - ${statusCode} (${logData.durationMs}ms)`, logData);
      } else {
        logger.info(`HTTP ${request.method} ${request.url} - ${statusCode} (${logData.durationMs}ms)`, logData);
      }
    }
  });
};

export const requestContextPlugin = fp(requestContextPluginCallback, {
  name: 'agentflow-request-context',
  fastify: '5.x'
});
