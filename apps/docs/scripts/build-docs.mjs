import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const distDir = resolve(rootDir, 'dist');

console.log('[docs] Compiling TypeScript source...');
execSync('tsc --project tsconfig.json', { cwd: rootDir, stdio: 'inherit' });

console.log('[docs] Generating static documentation manifest...');
mkdirSync(distDir, { recursive: true });

const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'AgentFlow OS REST API',
    version: '1.0.0',
    description: 'Developer REST API for AgentFlow OS platform'
  },
  paths: {
    '/health': {
      get: {
        summary: 'Service health check',
        responses: {
          '200': { description: 'Service operational' }
        }
      }
    },
    '/api/v1/runs': {
      post: {
        summary: 'Submit an asynchronous agent run',
        responses: {
          '200': { description: 'Run queued successfully' },
          '400': { description: 'Invalid run configuration' }
        }
      }
    }
  }
};

writeFileSync(
  resolve(distDir, 'openapi.json'),
  JSON.stringify(openApiSpec, null, 2),
  'utf8'
);

console.log('[docs] Documentation build completed successfully.');
