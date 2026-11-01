import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApiServer } from '../src/server.js';
import { Server } from 'http';
import { AddressInfo } from 'net';

describe('API App Tests', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createApiServer();
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('GET /health returns 200 with status ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.service).toBe('api');
  });

  it('GET /api/v1/health returns 200 with version metadata', async () => {
    const res = await fetch(`${baseUrl}/api/v1/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.version).toBe('0.1.0');
  });

  it('GET /unmatched-route returns 404 NOT_FOUND JSON', async () => {
    const res = await fetch(`${baseUrl}/non-existent`);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
  });
});
