import { createServer, Server } from 'http';
import { createLogger } from '@agentflow/observability';

const logger = createLogger('worker-health');

export interface WorkerHealthStatus {
  status: 'ok' | 'degraded' | 'unhealthy';
  service: 'worker';
  activeJobs: number;
  uptime: number;
}

export function createWorkerHealthServer(getStatus: () => WorkerHealthStatus): Server {
  return createServer((req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json');
      const status = getStatus();
      logger.debug('Worker health probe handled', { status: status.status });
      res.statusCode = status.status === 'ok' ? 200 : 503;
      res.end(JSON.stringify(status));
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  });
}
