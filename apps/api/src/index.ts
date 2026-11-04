import { startServer } from './server.js';
import { createLogger } from '@agentflow/observability';

export * from './app.js';
export * from './server.js';
export * from './types.js';
export * from './lib/errors.js';
export * from './lib/responses.js';

const logger = createLogger('api-service');
const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';

startServer(PORT, HOST, logger).catch((err) => {
  logger.error('Fatal error during API service startup', err);
  process.exit(1);
});
