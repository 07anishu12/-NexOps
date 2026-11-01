import { describe, it, expect } from 'vitest';
import { GET } from '../app/api/health/route.js';

describe('Web App Tests', () => {
  it('health endpoint returns valid JSON response with status ok', async () => {
    const response = await GET();
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.service).toBe('web');
    expect(data.timestamp).toBeDefined();
  });
});
