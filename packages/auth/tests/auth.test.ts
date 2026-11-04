import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  assertPermission,
  generateApiKey,
  verifyApiKey,
  createSession,
  isSessionExpired,
  generatePkcePair,
  generatePkceChallenge,
  generateNonce,
  signOAuthState,
  verifyOAuthState,
  generateSessionToken,
  hashSessionToken,
  verifySessionToken,
  generateCsrfToken,
  verifyCsrfToken,
  getSessionCookieConfig,
  isSafeHttpMethod,
  isTrustedOrigin,
  generateInvitationToken,
  hashInvitationToken,
  verifyInvitationTokenHash,
  requireWorkspacePermission
} from '../src/index.js';

describe('Auth Package Tests', () => {
  it('correctly evaluates permissions for roles', () => {
    // Owner
    expect(hasPermission('owner', 'workspace:delete')).toBe(true);
    expect(hasPermission('owner', 'workspace:transfer_ownership')).toBe(true);
    expect(hasPermission('owner', 'billing:manage')).toBe(true);

    // Admin
    expect(hasPermission('admin', 'workspace:delete')).toBe(false);
    expect(hasPermission('admin', 'workspace:transfer_ownership')).toBe(false);
    expect(hasPermission('admin', 'agent:publish')).toBe(true);
    expect(hasPermission('admin', 'member:invite')).toBe(true);

    // Developer
    expect(hasPermission('developer', 'agent:create')).toBe(true);
    expect(hasPermission('developer', 'workflow:create')).toBe(true);
    expect(hasPermission('developer', 'deployment:publish')).toBe(true);
    expect(hasPermission('developer', 'member:invite')).toBe(false);
    expect(hasPermission('developer', 'billing:manage')).toBe(false);

    // Operator
    expect(hasPermission('operator', 'run:retry')).toBe(true);
    expect(hasPermission('operator', 'run:cancel')).toBe(true);
    expect(hasPermission('operator', 'approval:resolve')).toBe(true);
    expect(hasPermission('operator', 'agent:create')).toBe(false);
    expect(hasPermission('operator', 'billing:manage')).toBe(false);

    // Viewer
    expect(hasPermission('viewer', 'agent:create')).toBe(false);
    expect(hasPermission('viewer', 'agent:read')).toBe(true);
    expect(hasPermission('viewer', 'run:retry')).toBe(false);
    expect(hasPermission('viewer', 'approval:resolve')).toBe(false);

    // Historical Member
    expect(hasPermission('member', 'billing:manage')).toBe(false);
    expect(hasPermission('member', 'agent:create')).toBe(true);
    expect(hasPermission('member', 'workspace:delete')).toBe(false);
  });

  it('throws when assertPermission or requireWorkspacePermission fails', () => {
    expect(() => assertPermission('viewer', 'agent:create')).toThrow(
      /Forbidden: Role 'viewer' lacks permission 'agent:create'/
    );
    const guard = requireWorkspacePermission('member:invite');
    expect(() => guard('developer')).toThrow(
      /Forbidden: Role 'developer' lacks permission 'member:invite'/
    );
    expect(() => guard('admin')).not.toThrow();
  });

  it('generates high-entropy invitation tokens and verifies SHA-256 hashes', () => {
    const token = generateInvitationToken();
    expect(token).toHaveLength(43);
    const hash = hashInvitationToken(token);
    expect(hash).toHaveLength(64);
    expect(verifyInvitationTokenHash(hash, hash)).toBe(true);
    expect(verifyInvitationTokenHash(hash, hashInvitationToken('other-token'))).toBe(false);
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

  it('generates valid PKCE pair with S256 challenge', () => {
    const pair = generatePkcePair();
    expect(pair.method).toBe('S256');
    expect(pair.verifier).toHaveLength(64);
    expect(pair.challenge).toBeDefined();

    // Challenge should be reproducible from verifier
    const recalculated = generatePkceChallenge(pair.verifier);
    expect(recalculated).toBe(pair.challenge);
  });

  it('signs and verifies OAuth state with expiration', () => {
    const secret = 'super-secret-signing-key-min-32-chars';
    const nonce = generateNonce();
    const pkce = generatePkcePair();

    const signedState = signOAuthState(
      {
        nonce,
        codeVerifier: pkce.verifier,
        returnTo: '/dashboard',
        createdAt: Date.now()
      },
      secret
    );

    const verified = verifyOAuthState(signedState, secret);
    expect(verified.nonce).toBe(nonce);
    expect(verified.codeVerifier).toBe(pkce.verifier);
    expect(verified.returnTo).toBe('/dashboard');

    // Rejects tampered state
    expect(() => verifyOAuthState(signedState + 'bad', secret)).toThrow(/HMAC signature/);

    // Rejects state signed with different secret
    expect(() => verifyOAuthState(signedState, 'wrong-secret-key-123456789012345678')).toThrow(/HMAC signature/);

    // Rejects expired state
    const expiredState = signOAuthState(
      {
        nonce,
        codeVerifier: pkce.verifier,
        createdAt: Date.now() - 15 * 60 * 1000 // 15 mins ago
      },
      secret
    );
    expect(() => verifyOAuthState(expiredState, secret, 10 * 60 * 1000)).toThrow(/expired/);
  });

  it('generates high-entropy session tokens and computes SHA-256 hashes', () => {
    const rawToken = generateSessionToken();
    expect(rawToken).toHaveLength(64);

    const hash = hashSessionToken(rawToken);
    expect(hash).toHaveLength(64);
    expect(verifySessionToken(rawToken, hash)).toBe(true);
    expect(verifySessionToken('wrong-raw-token', hash)).toBe(false);
  });

  it('generates and verifies CSRF tokens', () => {
    const csrfToken = generateCsrfToken();
    expect(csrfToken).toHaveLength(64);
    expect(verifyCsrfToken(csrfToken, csrfToken)).toBe(true);
    expect(verifyCsrfToken(csrfToken, 'invalid-csrf-token')).toBe(false);
  });

  it('configures secure cookies correctly for development and production', () => {
    const devCookie = getSessionCookieConfig({ isProduction: false });
    expect(devCookie.name).toBe('af_session');
    expect(devCookie.httpOnly).toBe(true);
    expect(devCookie.secure).toBe(false);
    expect(devCookie.sameSite).toBe('lax');
    expect(devCookie.path).toBe('/');

    const prodCookie = getSessionCookieConfig({ isProduction: true });
    expect(prodCookie.name).toBe('__Host-af_session');
    expect(prodCookie.httpOnly).toBe(true);
    expect(prodCookie.secure).toBe(true);
  });

  it('identifies safe HTTP methods and trusted origins', () => {
    expect(isSafeHttpMethod('GET')).toBe(true);
    expect(isSafeHttpMethod('HEAD')).toBe(true);
    expect(isSafeHttpMethod('OPTIONS')).toBe(true);
    expect(isSafeHttpMethod('POST')).toBe(false);
    expect(isSafeHttpMethod('DELETE')).toBe(false);

    const trusted = ['http://localhost:3000', 'https://agentflow.io'];
    expect(isTrustedOrigin('http://localhost:3000', trusted)).toBe(true);
    expect(isTrustedOrigin('http://localhost:3000/subpath', trusted)).toBe(true);
    expect(isTrustedOrigin('http://malicious.com', trusted)).toBe(false);
    expect(isTrustedOrigin(undefined, trusted)).toBe(false);
  });
});
