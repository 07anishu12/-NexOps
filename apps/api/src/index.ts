import { createApiServer } from './server.js';
import { createLogger } from '@agentflow/observability';
import { loadApplicationConfig } from '@agentflow/config';

const logger = createLogger('api-service');
const config = loadApplicationConfig();
const PORT = 4000;

const server = createApiServer();

server.listen(PORT, () => {
  logger.info(`AgentFlow REST API service listening on port ${PORT}`, {
    port: PORT,
    nodeEnv: config.NODE_ENV
  });
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, gracefully closing API server');
  server.close(() => {
    process.exit(0);
  });
});
