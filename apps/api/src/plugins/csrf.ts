import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import type { EnvConfig } from '@agentflow/config';
import { isSafeHttpMethod, isTrustedOrigin } from '@agentflow/auth';
import { HttpError } from '../lib/errors.js';

interface CsrfPluginOptions {
  config?: EnvConfig;
}

const csrfPluginCallback: FastifyPluginAsync<CsrfPluginOptions> = async (
  fastify,
  options
) => {
  const config = options.config;
  const isDevOrTest = !config?.NODE_ENV || config.NODE_ENV === 'development' || config.NODE_ENV === 'test';

  const trustedOrigins: string[] = [];
  if (config?.APP_URL) {
    try {
      trustedOrigins.push(new URL(config.APP_URL).origin);
    } catch {
      trustedOrigins.push(config.APP_URL);
    }
  }
  if (config?.AUTH_ALLOWED_REDIRECT_ORIGINS) {
    for (const origin of config.AUTH_ALLOWED_REDIRECT_ORIGINS.split(',')) {
      const trimmed = origin.trim();
      if (trimmed) {
        try {
          trustedOrigins.push(new URL(trimmed).origin);
        } catch {
          trustedOrigins.push(trimmed);
        }
      }
    }
  }

  // Hook on every request before handler execution
  fastify.addHook('preHandler', async (request) => {
    // 1. Safe HTTP methods (GET, HEAD, OPTIONS) do not alter server state
    if (isSafeHttpMethod(request.method)) return;

    // 2. Pure API key / Server-to-server requests are not vulnerable to browser cross-site request forgery
    if (request.tenantContext?.authMethod === 'api_key_header' || request.tenantContext?.authMethod === 'worker_lease') {
      return;
    }

    // 3. Inspect if request is cookie-authenticated
    const cookieName = config?.SESSION_COOKIE_NAME ?? 'af_session';
    const hostCookieName = `__Host-${cookieName}`;
    const hasSessionCookie = Boolean(
      request.cookies?.[cookieName] ||
      request.cookies?.[hostCookieName] ||
      (typeof request.headers.cookie === 'string' && request.headers.cookie.includes(cookieName))
    );

    if (!hasSessionCookie) {
      // Unauthenticated or not cookie-based
      return;
    }

    // 4. Origin & Referer Validation for Cookie-Authenticated State-Changing Requests
    const origin = typeof request.headers.origin === 'string' ? request.headers.origin : undefined;
    const referer = typeof request.headers.referer === 'string' ? request.headers.referer : undefined;

    // In dev/test environments, allow localhost on any port
    if (isDevOrTest) {
      if (origin && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
        return;
      }
      if (referer && (referer.startsWith('http://localhost:') || referer.startsWith('http://127.0.0.1:'))) {
        return;
      }
    }

    if (origin && isTrustedOrigin(origin, trustedOrigins)) {
      return;
    }

    if (referer && isTrustedOrigin(referer, trustedOrigins)) {
      return;
    }

    // If both origin and referer are missing or disallowed on a cookie-authenticated mutation
    throw new HttpError(
      403,
      'FORBIDDEN',
      'CSRF protection: request origin is untrusted or missing on state-changing request'
    );
  });
};

export const csrfPlugin = fp(csrfPluginCallback, {
  name: 'agentflow-csrf',
  fastify: '5.x'
});
