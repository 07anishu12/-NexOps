import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import {
  createApiErrorEnvelope,
  type ApiErrorEnvelope,
  type ErrorCode,
  type FieldErrorDetail
} from '@agentflow/contracts';
import {
  AuthenticationError,
  AuthorizationError,
  TenantNotFoundError,
  TenantConflictError
} from '@agentflow/database';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: FieldErrorDetail[],
    public readonly helpUrl?: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function formatApiError(
  error: unknown,
  requestId: string,
  correlationId?: string,
  traceId?: string
): { statusCode: number; envelope: ApiErrorEnvelope } {
  // 1. Explicit HttpError
  if (error instanceof HttpError) {
    return {
      statusCode: error.statusCode,
      envelope: createApiErrorEnvelope({
        code: error.code,
        message: error.message,
        details: error.details,
        helpUrl: error.helpUrl,
        requestId,
        correlationId,
        traceId
      })
    };
  }

  // 2. Tenant & Auth Errors from @agentflow/database
  if (error instanceof AuthenticationError) {
    return {
      statusCode: 401,
      envelope: createApiErrorEnvelope({
        code: 'UNAUTHORIZED',
        message: error.message,
        requestId,
        correlationId,
        traceId
      })
    };
  }

  if (error instanceof AuthorizationError) {
    return {
      statusCode: 403,
      envelope: createApiErrorEnvelope({
        code: 'FORBIDDEN',
        message: error.message,
        requestId,
        correlationId,
        traceId
      })
    };
  }

  if (error instanceof TenantNotFoundError) {
    return {
      statusCode: 404,
      envelope: createApiErrorEnvelope({
        code: 'NOT_FOUND',
        message: error.message,
        requestId,
        correlationId,
        traceId
      })
    };
  }

  if (error instanceof TenantConflictError || (error instanceof Error && error.name === 'TenantConflictError')) {
    return {
      statusCode: 409,
      envelope: createApiErrorEnvelope({
        code: 'CONFLICT',
        message: error.message,
        requestId,
        correlationId,
        traceId
      })
    };
  }

  // 3. CORS rejection
  if (error instanceof Error && error.message.includes('not allowed by CORS')) {
    return {
      statusCode: 403,
      envelope: createApiErrorEnvelope({
        code: 'FORBIDDEN',
        message: error.message,
        requestId,
        correlationId,
        traceId
      })
    };
  }

  // 3. Zod Validation Error
  if (error instanceof ZodError) {
    const details: FieldErrorDetail[] = error.issues.map((issue) => ({
      field: issue.path.join('.'),
      code: issue.code,
      message: issue.message
    }));

    return {
      statusCode: 400,
      envelope: createApiErrorEnvelope({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details,
        requestId,
        correlationId,
        traceId
      })
    };
  }

  // 4. Fastify Validation Error
  const fastifyErr = error as FastifyError;
  if (fastifyErr.validation && Array.isArray(fastifyErr.validation)) {
    const details: FieldErrorDetail[] = fastifyErr.validation.map((v) => ({
      field: (v.instancePath ? v.instancePath.replace(/^\//, '') : (v.params?.missingProperty as string | undefined)) ?? 'unknown',
      code: v.keyword ?? 'validation_error',
      message: v.message ?? 'Invalid parameter'
    }));

    return {
      statusCode: 400,
      envelope: createApiErrorEnvelope({
        code: 'VALIDATION_ERROR',
        message: fastifyErr.message || 'Request validation failed',
        details,
        requestId,
        correlationId,
        traceId
      })
    };
  }

  // 5. Fastify Payload Too Large (413)
  if (fastifyErr.statusCode === 413 || fastifyErr.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
    return {
      statusCode: 413,
      envelope: createApiErrorEnvelope({
        code: 'VALIDATION_ERROR',
        message: 'Request payload exceeded maximum permitted size',
        requestId,
        correlationId,
        traceId
      })
    };
  }

  // 6. Fastify Rate Limit Exceeded (429)
  if (fastifyErr.statusCode === 429) {
    return {
      statusCode: 429,
      envelope: createApiErrorEnvelope({
        code: 'RATE_LIMIT_EXCEEDED',
        message: fastifyErr.message || 'Too many requests, please try again later',
        requestId,
        correlationId,
        traceId
      })
    };
  }

  // 7. Generic Not Found (404)
  if (fastifyErr.statusCode === 404) {
    return {
      statusCode: 404,
      envelope: createApiErrorEnvelope({
        code: 'NOT_FOUND',
        message: fastifyErr.message || 'Resource not found',
        requestId,
        correlationId,
        traceId
      })
    };
  }

  // 8. Fallback / Internal Error (500)
  const isProd = process.env.NODE_ENV === 'production';
  const errorMessage = isProd
    ? 'An unexpected internal error occurred'
    : (error instanceof Error ? error.message : 'An unexpected internal error occurred');

  return {
    statusCode: fastifyErr.statusCode && fastifyErr.statusCode >= 400 && fastifyErr.statusCode < 500
      ? fastifyErr.statusCode
      : 500,
    envelope: createApiErrorEnvelope({
      code: 'INTERNAL_ERROR',
      message: errorMessage,
      requestId,
      correlationId,
      traceId
    })
  };
}

export async function globalErrorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const requestId = request.requestId || 'req-unknown';
  const correlationId = request.correlationId || requestId;
  const traceId = request.traceContext?.traceId;

  const { statusCode, envelope } = formatApiError(error, requestId, correlationId, traceId);

  // Set correlation headers on error responses
  reply.header('x-request-id', requestId);
  reply.header('x-correlation-id', correlationId);

  // Log 5xx errors with details; 4xx at warn level
  if (statusCode >= 500) {
    request.log?.error
      ? request.log.error({ err: error, requestId, correlationId }, 'Unhandled server error')
      : console.error('Unhandled server error', error);
  } else if (statusCode >= 400) {
    request.log?.warn
      ? request.log.warn({ statusCode, code: envelope.error.code, message: envelope.error.message, requestId }, 'Client request rejected')
      : undefined;
  }

  await reply.status(statusCode).send(envelope);
}

export async function notFoundHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const requestId = request.requestId || 'req-unknown';
  const correlationId = request.correlationId || requestId;
  const traceId = request.traceContext?.traceId;

  const envelope = createApiErrorEnvelope({
    code: 'NOT_FOUND',
    message: `Endpoint '${request.method} ${request.url}' not found`,
    requestId,
    correlationId,
    traceId
  });

  reply.header('x-request-id', requestId);
  reply.header('x-correlation-id', correlationId);

  await reply.status(404).send(envelope);
}
