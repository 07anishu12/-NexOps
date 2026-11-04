import { Redis } from 'ioredis';
import { loadApplicationConfig } from '@agentflow/config';
import { createDatabaseClient, type DatabaseClient } from '@agentflow/database';
import { createLogger, type Logger } from '@agentflow/observability';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';

export interface RunningServer {
  app: FastifyInstance;
  address: string;
  close: () => Promise<void>;
}

export async function startServer(
  port = 4000,
  host = '0.0.0.0',
  customLogger?: Logger
): Promise<RunningServer> {
  const config = loadApplicationConfig();
  const logger = customLogger ?? createLogger('api-service', config.LOG_LEVEL);

  // 1. Initialize Database Client
  let dbClient: DatabaseClient | undefined;
  try {
    dbClient = createDatabaseClient({ databaseUrl: config.DATABASE_URL });
    logger.info('Database client initialized successfully');
  } catch (err) {
    logger.warn('Failed to initialize database client during server bootstrap', {
      error: err instanceof Error ? err.message : String(err)
    });
  }

  // 2. Initialize Redis Client
  let redisClient: Redis | undefined;
  try {
    redisClient = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false
    });
    await redisClient.connect().catch((err) => {
      logger.warn('Redis connection failed during startup (rate limiter running in memory)', {
        error: err instanceof Error ? err.message : String(err)
      });
    });
  } catch (err) {
    logger.warn('Failed to construct Redis client', {
      error: err instanceof Error ? err.message : String(err)
    });
  }

  // 3. Build Fastify Application
  const app = await buildApp({
    config,
    logger,
    dbClient,
    redisClient
  });

  // 4. Start HTTP Listener
  const address = await app.listen({ port, host });
  logger.info(`AgentFlow REST API service listening at ${address}`, {
    port,
    host,
    nodeEnv: config.NODE_ENV,
    docsUrl: `${address}/docs`
  });

  // 5. Encapsulated Close Routine
  let isClosing = false;
  const close = async () => {
    if (isClosing) return;
    isClosing = true;

    logger.info('Gracefully closing AgentFlow REST API server...');
    try {
      await app.close();
    } catch (err) {
      logger.error('Error during Fastify server close', err);
    }

    if (redisClient) {
      try {
        await redisClient.quit();
      } catch {
        redisClient.disconnect();
      }
    }

    if (dbClient) {
      try {
        await dbClient.pool.end();
      } catch (err) {
        logger.error('Error closing database pool', err);
      }
    }

    logger.info('Graceful shutdown completed successfully');
  };

  // 6. Signal Handlers
  const signalHandler = async (signal: string) => {
    logger.info(`Received ${signal}, initiating shutdown`);
    await close();
    process.exit(0);
  };

  process.once('SIGTERM', () => void signalHandler('SIGTERM'));
  process.once('SIGINT', () => void signalHandler('SIGINT'));

  return { app, address, close };
}
