import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT ?? 3003);

const server = createServer(async (request, response) => {
  if (request.method !== 'GET') {
    response.statusCode = 405;
    response.end('Method Not Allowed');
    return;
  }

  if (request.url === '/health') {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ status: 'ok', service: 'docs' }));
    return;
  }

  if (request.url === '/openapi.json') {
    try {
      const openApi = await readFile(resolve(root, 'dist/openapi.json'), 'utf8');
      response.setHeader('Content-Type', 'application/json');
      response.end(openApi);
    } catch {
      response.statusCode = 503;
      response.end('Documentation build has not been run');
    }
    return;
  }

  if (request.url === '/docs' || request.url === '/') {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(
      '<!doctype html><html><head><title>AgentFlow OS Docs</title></head><body><h1>AgentFlow OS Documentation</h1><p>OpenAPI: <a href="/openapi.json">/openapi.json</a></p></body></html>'
    );
    return;
  }

  response.statusCode = 404;
  response.end('Not Found');
});

server.listen(port, () => {
  console.log(`AgentFlow documentation server listening on port ${port}`);
});
