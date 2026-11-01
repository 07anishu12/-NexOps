import { describe, it, expect, vi } from 'vitest';
import { AgentFlowClient } from '../src/index.js';

describe('SDK Package Tests', () => {
  it('initializes client and constructs proper auth headers', () => {
    const client = new AgentFlowClient({
      apiKey: 'af_live_secret123',
      workspaceId: 'ws-777',
      baseUrl: 'https://api.agentflow.io'
    });

    const headers = client.getHeaders();
    expect(headers['Authorization']).toBe('Bearer af_live_secret123');
    expect(headers['X-Workspace-Id']).toBe('ws-777');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('handles fetch network error safely', async () => {
    const client = new AgentFlowClient({
      baseUrl: 'http://127.0.0.1:54321' // non-existent host
    });

    // Mock global fetch returning error or throwing
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const result = await client.createRun({
      agentId: 'a-1',
      inputPrompt: 'Hello'
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('FETCH_ERROR');

    global.fetch = originalFetch;
  });
});
