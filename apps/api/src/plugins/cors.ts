import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import type { EnvConfig } from '@agentflow/config';

interface CorsPluginOptions {
  config?: EnvConfig;
  allowedOrigins?: string[];
}

const corsPluginCallback: FastifyPluginAsync<CorsPluginOptions> = async (
  fastify,
  options
) => {
  const config = options.config;
  const isDevOrTest = !config?.NODE_ENV || config.NODE_ENV === 'development' || config.NODE_ENV === 'test';

  const defaultOrigins: string[] = [];
  if (config?.APP_URL) {
    try {
      defaultOrigins.push(new URL(config.APP_URL).origin);
    } catch {
      defaultOrigins.push(config.APP_URL);
    }
  }
  if (config?.WIDGET_CDN_URL) {
    try {
      defaultOrigins.push(new URL(config.WIDGET_CDN_URL).origin);
    } catch {
      defaultOrigins.push(config.WIDGET_CDN_URL);
    }
  }

  const explicitOrigins = options.allowedOrigins ?? defaultOrigins;

  await fastify.register(cors, {
    origin: (origin, callback) => {
      // 1. Allow non-browser requests (curl, server-to-server, no origin header)
      if (!origin) {
        callback(null, true);
        return;
      }

      // 2. Exact match against configured allowlist
      if (explicitOrigins.includes(origin) || explicitOrigins.includes('*')) {
        callback(null, true);
        return;
      }

      // 3. In dev/test, permit localhost on any port
      if (isDevOrTest) {
        try {
          const parsed = new URL(origin);
          if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
            callback(null, true);
            return;
          }
        } catch {
          // invalid url
        }
      }

      // Disallowed origin
      callback(new Error(`Origin '${origin}' not allowed by CORS`), false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-api-key',
      'x-widget-session',
      'x-widget-token',
      'x-request-id',
      'x-correlation-id',
      'traceparent'
    ],
    exposedHeaders: [
      'x-request-id',
      'x-correlation-id',
      'traceparent',
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset'
    ],
    maxAge: 86400
  });
};

export const corsPlugin = fp(corsPluginCallback, {
  name: 'agentflow-cors',
  fastify: '5.x'
});
