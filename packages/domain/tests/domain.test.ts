import { describe, it, expect } from 'vitest';
import {
  canonicalizeJson,
  computeCanonicalPayloadHash,
  createAgentVersionSnapshot,
  isAllowedOrigin
} from '../src/index.js';

describe('Domain Package Tests', () => {
  it('canonicalizes JSON deterministically regardless of key order', () => {
    const objA = { b: 2, a: 1, nested: { y: 'hello', x: 'world' } };
    const objB = { nested: { x: 'world', y: 'hello' }, a: 1, b: 2 };

    const canonA = canonicalizeJson(objA);
    const canonB = canonicalizeJson(objB);

    expect(canonA).toBe(canonB);
    expect(computeCanonicalPayloadHash(objA)).toBe(computeCanonicalPayloadHash(objB));
  });

  it('generates immutable agent version with 64-character hex hash', () => {
    const version = createAgentVersionSnapshot({
      id: '11111111-1111-4111-a111-111111111111',
      agentId: '22222222-2222-4222-a222-222222222222',
      workspaceId: '33333333-3333-4333-a333-333333333333',
      versionNumber: 1,
      config: {
        name: 'Support Agent',
        description: 'Customer support',
        systemPrompt: 'Be concise.',
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.5,
        maxTokens: 1024,
        allowedTools: ['gmail_send'],
        environmentVariables: {}
      },
      publishedBy: '44444444-4444-4444-a444-444444444444'
    });

    expect(version.versionNumber).toBe(1);
    expect(version.snapshotHash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(version.snapshotHash)).toBe(true);
  });

  it('validates allowed origins accurately', () => {
    const allowed = ['https://example.com', 'https://app.customer.io'];
    expect(isAllowedOrigin('https://example.com', allowed)).toBe(true);
    expect(isAllowedOrigin('https://example.com/path/child', allowed)).toBe(true);
    expect(isAllowedOrigin('https://evil.com', allowed)).toBe(false);
    expect(isAllowedOrigin('http://example.com', allowed)).toBe(false); // different protocol
  });
});
