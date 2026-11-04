import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import type { DatabaseClient } from '@agentflow/database';
import type { Redis } from 'ioredis';

describe('Health & Readiness Probes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ enableRateLimit: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200 OK liveness metadata', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health'
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('api');
    expect(body.version).toBe('0.1.0');
    expect(body.timestamp).toBeDefined();
  });

  it('GET /v1/health returns 200 with matching liveness payload', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/health'
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('api');
  });

  it('GET /api/v1/health backward compatibility route returns 200', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health'
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('api');
  });

  it('GET /ready returns 200 ready when mock dependencies succeed', async () => {
    const mockDb: Partial<DatabaseClient> = {
      pool: {
        query: async () => ({ rows: [{ healthy: 1 }] })
      } as any
    };

    const mockRedis: Partial<Redis> = {
      ping: async () => 'PONG'
    };

    const readyApp = await buildApp({
      enableRateLimit: false,
      dbClient: mockDb as DatabaseClient,
      redisClient: mockRedis as Redis
    });
    await readyApp.ready();

    const res = await readyApp.inject({
      method: 'GET',
      url: '/ready'
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ready');
    expect(body.dependencies.database).toBe('up');
    expect(body.dependencies.redis).toBe('up');

    await readyApp.close();
  });

  it('GET /ready returns 503 degraded when database connectivity fails', async () => {
    const brokenDb: Partial<DatabaseClient> = {
      pool: {
        query: async () => {
          throw new Error('Connection refused to PostgreSQL host:5432');
        }
      } as any
    };

    const mockRedis: Partial<Redis> = {
      ping: async () => 'PONG'
    };

    const degradedApp = await buildApp({
      enableRateLimit: false,
      dbClient: brokenDb as DatabaseClient,
      redisClient: mockRedis as Redis
    });
    await degradedApp.ready();

    const res = await degradedApp.inject({
      method: 'GET',
      url: '/ready'
    });

    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.status).toBe('degraded');
    expect(body.dependencies.database).toBe('down');
    expect(body.dependencies.redis).toBe('up');
    expect(body.errors.database).toContain('Connection refused');

    await degradedApp.close();
  });

  it('GET /ready returns 503 degraded when Redis connectivity fails', async () => {
    const mockDb: Partial<DatabaseClient> = {
      pool: {
        query: async () => ({ rows: [{ healthy: 1 }] })
      } as any
    };

    const brokenRedis: Partial<Redis> = {
      ping: async () => {
        throw new Error('Redis connection timed out');
      }
    };

    const degradedApp = await buildApp({
      enableRateLimit: false,
      dbClient: mockDb as DatabaseClient,
      redisClient: brokenRedis as Redis
    });
    await degradedApp.ready();

    const res = await degradedApp.inject({
      method: 'GET',
      url: '/ready'
    });

    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.status).toBe('degraded');
    expect(body.dependencies.database).toBe('up');
    expect(body.dependencies.redis).toBe('down');
    expect(body.errors.redis).toContain('timed out');

    await degradedApp.close();
  });
});
