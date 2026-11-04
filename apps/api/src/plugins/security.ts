import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';

interface SecurityPluginOptions {
  enableCsp?: boolean;
}

const securityPluginCallback: FastifyPluginAsync<SecurityPluginOptions> = async (
  fastify,
  options
) => {
  await fastify.register(helmet, {
    // Enable CSP for production API endpoints; allow inline scripts for Swagger UI at /docs
    contentSecurityPolicy: options.enableCsp
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'validator.swagger.io'],
            connectSrc: ["'self'"]
          }
        }
      : false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    frameguard: { action: 'deny' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    noSniff: true
  });
};

export const securityPlugin = fp(securityPluginCallback, {
  name: 'agentflow-security',
  fastify: '5.x'
});
