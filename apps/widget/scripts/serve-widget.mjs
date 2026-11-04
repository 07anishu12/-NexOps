import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT ?? 3002);

const server = createServer(async (request, response) => {
  if (request.method !== 'GET') {
    response.statusCode = 405;
    response.end('Method Not Allowed');
    return;
  }

  if (request.url === '/health') {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ status: 'ok', service: 'widget' }));
    return;
  }

  if (request.url === '/agentflow-widget.js' || request.url === '/') {
    try {
      const bundle = await readFile(resolve(root, 'dist/index.js'), 'utf8');
      response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
      response.end(bundle);
    } catch {
      response.statusCode = 503;
      response.end('Widget build has not been run');
    }
    return;
  }

  response.statusCode = 404;
  response.end('Not Found');
});

server.listen(port, () => {
  console.log(`AgentFlow widget bundle server listening on port ${port}`);
});
