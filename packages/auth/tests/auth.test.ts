import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  assertPermission,
  generateApiKey,
  verifyApiKey,
  createSession,
  isSessionExpired
} from '../src/index.js';

describe('Auth Package Tests', () => {
  it('correctly evaluates permissions for roles', () => {
    expect(hasPermission('owner', 'workspace:delete')).toBe(true);
    expect(hasPermission('admin', 'workspace:delete')).toBe(false);
    expect(hasPermission('admin', 'agent:publish')).toBe(true);
    expect(hasPermission('member', 'billing:manage')).toBe(false);
    expect(hasPermission('viewer', 'agent:create')).toBe(false);
    expect(hasPermission('viewer', 'agent:read')).toBe(true);
  });

  it('throws when assertPermission fails', () => {
    expect(() => assertPermission('viewer', 'agent:create')).toThrow(
      /Forbidden: Role 'viewer' lacks permission 'agent:create'/
    );
  });

  it('generates and verifies API keys securely', () => {
    const liveKey = generateApiKey('live');
    expect(liveKey.plaintextKey.startsWith('af_live_')).toBe(true);
    expect(liveKey.keyHash).toHaveLength(64);
    expect(verifyApiKey(liveKey.plaintextKey, liveKey.keyHash)).toBe(true);
    expect(verifyApiKey('af_live_wrong_key', liveKey.keyHash)).toBe(false);

    const testKey = generateApiKey('test');
    expect(testKey.plaintextKey.startsWith('af_test_')).toBe(true);
  });

  it('manages session lifecycle and expiration', () => {
    const session = createSession({
      userId: 'u-1',
      email: 'user@agentflow.io',
      workspaceId: 'w-1',
      role: 'admin',
      ttlSeconds: 10
    });
    expect(isSessionExpired(session)).toBe(false);

    const expiredSession = {
      ...session,
      expiresAt: Date.now() - 1000
    };
    expect(isSessionExpired(expiredSession)).toBe(true);
  });
});
