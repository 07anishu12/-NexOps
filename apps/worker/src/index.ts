import { createWorkerHealthServer } from './health.js';
import { RunJobProcessor } from './processor.js';
import { createLogger } from '@agentflow/observability';
import { loadConfig } from '@agentflow/config';

const logger = createLogger('worker-service');
const config = loadConfig();
const HEALTH_PORT = 4001;

const processor = new RunJobProcessor();
const startTime = Date.now();

const healthServer = createWorkerHealthServer(() => ({
  status: 'ok',
  service: 'worker',
  activeJobs: processor.getActiveJobsCount(),
  uptime: Math.floor((Date.now() - startTime) / 1000)
}));

healthServer.listen(HEALTH_PORT, () => {
  logger.info(`AgentFlow Worker health server listening on port ${HEALTH_PORT}`, {
    concurrency: config.WORKER_CONCURRENCY,
    queue: config.RUN_QUEUE_NAME
  });
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, closing worker health server');
  healthServer.close(() => process.exit(0));
});
