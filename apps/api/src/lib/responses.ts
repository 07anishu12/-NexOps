import type { FastifyRequest } from 'fastify';
import type { ApiSuccessEnvelope } from '@agentflow/contracts';

export function createSuccessResponse<T>(
  data: T,
  request: FastifyRequest
): ApiSuccessEnvelope<T> {
  const requestId = request.requestId || 'req-unknown';
  const correlationId = request.correlationId || requestId;
  const traceId = request.traceContext?.traceId;

  return {
    success: true,
    data,
    meta: {
      requestId,
      correlationId,
      timestamp: new Date().toISOString(),
      traceId
    }
  };
}
