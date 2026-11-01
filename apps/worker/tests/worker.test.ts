import { describe, it, expect } from 'vitest';
import { RunJobProcessor } from '../src/processor.js';
import { createWorkerHealthServer } from '../src/health.js';
import { AddressInfo } from 'net';

describe('Worker App Tests', () => {
  it('processes run jobs through valid state transitions', async () => {
    const processor = new RunJobProcessor();
    expect(processor.getActiveJobsCount()).toBe(0);

    const result = await processor.processRunJob({
      jobId: 'job-1',
      runId: 'run-100',
      workspaceId: 'ws-100'
    });

    expect(result.success).toBe(true);
    expect(result.runId).toBe('run-100');
    expect(processor.getActiveJobsCount()).toBe(0);
  });

  it('exposes health probe endpoint with active job count', async () => {
    const server = createWorkerHealthServer(() => ({
      status: 'ok',
      service: 'worker',
      activeJobs: 0,
      uptime: 42
    }));

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const addr = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${addr.port}/health`);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.service).toBe('worker');
    expect(data.activeJobs).toBe(0);

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
