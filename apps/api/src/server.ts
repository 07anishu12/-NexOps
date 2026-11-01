import { createServer, IncomingMessage, ServerResponse } from 'http';
import { createLogger } from '@agentflow/observability';
import { loadConfig } from '@agentflow/config';

const logger = createLogger('api-service');
const config = loadConfig();

export function createApiServer() {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const method = req.method ?? 'GET';

    res.setHeader('Content-Type', 'application/json');
    logger.debug(`Incoming request: ${method} ${url.pathname}`);

    // Health probe
    if ((url.pathname === '/health' || url.pathname === '/api/v1/health') && method === 'GET') {
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          status: 'ok',
          service: 'api',
          version: '0.1.0',
          environment: config.NODE_ENV,
          timestamp: new Date().toISOString()
        })
      );
      return;
    }

    // Default route
    if (url.pathname === '/' && method === 'GET') {
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          service: 'AgentFlow OS REST API',
          version: 'v1',
          docs: '/docs'
        })
      );
      return;
    }

    // Not found
    res.statusCode = 404;
    res.end(
      JSON.stringify({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Endpoint '${method} ${url.pathname}' not found`
        }
      })
    );
  });

  return server;
}
