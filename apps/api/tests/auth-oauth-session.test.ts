import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createDatabaseClient, type DatabaseClient } from '@agentflow/database';
import { loadApplicationConfig } from '@agentflow/config';
import { signOAuthState, generatePkcePair, generateNonce } from '@agentflow/auth';
import { buildApp } from '../src/app.js';
import type {
  IGoogleOAuthService,
  GoogleAuthUrlParams,
  ExchangeCodeParams
} from '../src/services/google-oauth.js';
import type { GoogleIdentityProfile } from '@agentflow/database';
import { AuthenticationError } from '@agentflow/database';

class MockGoogleOAuthService implements IGoogleOAuthService {
  constructor(
    public profileOverride?: Partial<GoogleIdentityProfile>,
    public failExchange = false
  ) {}

  generateAuthUrl(params: GoogleAuthUrlParams): string {
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=mock-client-id&state=${encodeURIComponent(
      params.state
    )}&code_challenge=${params.codeChallenge}&nonce=${params.nonce}`;
  }

  async exchangeCodeAndVerify(params: ExchangeCodeParams): Promise<GoogleIdentityProfile> {
    if (this.failExchange || params.code === 'invalid_code') {
      throw new AuthenticationError('Invalid authorization code');
    }

    if (this.profileOverride?.emailVerified === false) {
      throw new AuthenticationError('Google account email address is not verified');
    }

    return {
      providerSubject: this.profileOverride?.providerSubject ?? 'google-subject-10001',
      email: this.profileOverride?.email ?? 'alice@agentflow.io',
      name: this.profileOverride?.name ?? 'Alice Test',
      avatarUrl: this.profileOverride?.avatarUrl ?? 'https://lh3.googleusercontent.com/avatar.png',
      emailVerified: this.profileOverride?.emailVerified ?? true
    };
  }
}

describe('Stage 07: Google OAuth, Sessions, and CSRF Security', () => {
  let app: FastifyInstance;
  let dbClient: DatabaseClient;
  let mockOAuth: MockGoogleOAuthService;
  const config = loadApplicationConfig();

  beforeAll(async () => {
    dbClient = createDatabaseClient({ databaseUrl: config.DATABASE_URL });
    mockOAuth = new MockGoogleOAuthService();

    app = await buildApp({
      enableRateLimit: false,
      config,
      dbClient,
      googleOAuthService: mockOAuth
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await dbClient.close();
  });

  // ============================================================================
  // PART B: OAuth Initiation & PKCE
  // ============================================================================
  it('GET /v1/auth/google/start redirects to Google with PKCE, S256 challenge, and signed state', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/google/start?returnTo=/dashboard'
    });

    expect(res.statusCode).toBe(302);
    const redirectUrl = res.headers.location!;
    expect(redirectUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(redirectUrl).toContain('client_id=mock-client-id');
    expect(redirectUrl).toContain('code_challenge=');
    expect(redirectUrl).toContain('state=');

    // Verify state cookie set
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const cookieStr = Array.isArray(cookies) ? cookies.join(';') : (cookies as string);
    expect(cookieStr).toContain('af_oauth_state=');
    expect(cookieStr).toContain('HttpOnly');
    expect(cookieStr).toContain('SameSite=Lax');
  });

  it('GET /v1/auth/google/start rejects open redirect URLs with 400 VALIDATION_ERROR', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/google/start?returnTo=https://malicious-site.com'
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toContain('relative');
  });

  // ============================================================================
  // PART C: OAuth Callback, User Provisioning & Session Establishment
  // ============================================================================
  it('GET /v1/auth/google/callback provisions new user, workspace, and sets session cookie', async () => {
    const uniqueSub = `google-sub-${Date.now()}`;
    const uniqueEmail = `newuser-${Date.now()}@agentflow.io`;

    mockOAuth.profileOverride = {
      providerSubject: uniqueSub,
      email: uniqueEmail,
      name: 'New User',
      emailVerified: true
    };

    const pkce = generatePkcePair();
    const nonce = generateNonce();
    const signedState = signOAuthState(
      {
        nonce,
        codeVerifier: pkce.verifier,
        returnTo: '/app',
        createdAt: Date.now()
      },
      config.OAUTH_STATE_SIGNING_KEY_REFERENCE
    );

    const res = await app.inject({
      method: 'GET',
      url: `/v1/auth/google/callback?code=valid_auth_code&state=${encodeURIComponent(signedState)}`,
      headers: {
        cookie: `af_oauth_state=${encodeURIComponent(signedState)}`
      }
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(`${config.APP_URL}/app`);

    // Verify session cookie set
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookieHeader = Array.isArray(setCookie) ? setCookie.join(';') : (setCookie as string);
    expect(cookieHeader).toContain('af_session=');
    expect(cookieHeader).toContain('HttpOnly');

    // Extract raw session token
    const match = cookieHeader.match(/af_session=([^;]+)/);
    expect(match).toBeDefined();
    const rawSessionToken = decodeURIComponent(match![1]);

    // Verify authenticated session via /v1/auth/me
    const meRes = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: {
        cookie: `af_session=${encodeURIComponent(rawSessionToken)}`
      }
    });

    expect(meRes.statusCode).toBe(200);
    const meBody = meRes.json();
    expect(meBody.success).toBe(true);
    expect(meBody.data.user.email).toBe(uniqueEmail);
    expect(meBody.data.activeWorkspace.role).toBe('owner');
    expect(meBody.data.workspaces.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /v1/auth/google/callback idempotently logs in returning user without duplicate records', async () => {
    const returningSub = `google-sub-returning-${Date.now()}`;
    const returningEmail = `returning-${Date.now()}@agentflow.io`;

    mockOAuth.profileOverride = {
      providerSubject: returningSub,
      email: returningEmail,
      name: 'Returning User',
      emailVerified: true
    };

    const pkce = generatePkcePair();
    const nonce = generateNonce();
    const signedState = signOAuthState(
      {
        nonce,
        codeVerifier: pkce.verifier,
        returnTo: '/app',
        createdAt: Date.now()
      },
      config.OAUTH_STATE_SIGNING_KEY_REFERENCE
    );

    // First login
    await app.inject({
      method: 'GET',
      url: `/v1/auth/google/callback?code=code_1&state=${encodeURIComponent(signedState)}`,
      headers: { cookie: `af_oauth_state=${encodeURIComponent(signedState)}` }
    });

    // Second login with fresh state
    const pkce2 = generatePkcePair();
    const nonce2 = generateNonce();
    const signedState2 = signOAuthState(
      {
        nonce: nonce2,
        codeVerifier: pkce2.verifier,
        returnTo: '/app',
        createdAt: Date.now()
      },
      config.OAUTH_STATE_SIGNING_KEY_REFERENCE
    );

    const res2 = await app.inject({
      method: 'GET',
      url: `/v1/auth/google/callback?code=code_2&state=${encodeURIComponent(signedState2)}`,
      headers: { cookie: `af_oauth_state=${encodeURIComponent(signedState2)}` }
    });

    expect(res2.statusCode).toBe(302);
    expect(res2.headers.location).toBe(`${config.APP_URL}/app`);
  });

  it('rejects OAuth callback when email is unverified with redirect error', async () => {
    mockOAuth.profileOverride = {
      providerSubject: 'unverified-sub',
      email: 'unverified@agentflow.io',
      emailVerified: false
    };

    const pkce = generatePkcePair();
    const signedState = signOAuthState(
      {
        nonce: generateNonce(),
        codeVerifier: pkce.verifier,
        createdAt: Date.now()
      },
      config.OAUTH_STATE_SIGNING_KEY_REFERENCE
    );

    const res = await app.inject({
      method: 'GET',
      url: `/v1/auth/google/callback?code=valid_code&state=${encodeURIComponent(signedState)}`,
      headers: { cookie: `af_oauth_state=${encodeURIComponent(signedState)}` }
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('error=');
    expect(res.headers.location).toContain('verified');
  });

  it('rejects callback with mismatched state cookie to prevent CSRF state theft', async () => {
    const pkce = generatePkcePair();
    const signedState = signOAuthState(
      {
        nonce: generateNonce(),
        codeVerifier: pkce.verifier,
        createdAt: Date.now()
      },
      config.OAUTH_STATE_SIGNING_KEY_REFERENCE
    );

    const res = await app.inject({
      method: 'GET',
      url: `/v1/auth/google/callback?code=valid_code&state=${encodeURIComponent(signedState)}`,
      headers: { cookie: `af_oauth_state=tampered-or-different-state` }
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('error=state_cookie_mismatch');
  });

  // ============================================================================
  // PART D: Session Management, Rotation, and Revocation
  // ============================================================================
  it('supports session listing, individual revocation, and logout', async () => {
    const userSub = `google-sub-session-${Date.now()}`;
    const userEmail = `session-user-${Date.now()}@agentflow.io`;

    mockOAuth.profileOverride = {
      providerSubject: userSub,
      email: userEmail,
      name: 'Session User',
      emailVerified: true
    };

    const pkce = generatePkcePair();
    const signedState = signOAuthState(
      {
        nonce: generateNonce(),
        codeVerifier: pkce.verifier,
        createdAt: Date.now()
      },
      config.OAUTH_STATE_SIGNING_KEY_REFERENCE
    );

    // Login
    const loginRes = await app.inject({
      method: 'GET',
      url: `/v1/auth/google/callback?code=valid_code&state=${encodeURIComponent(signedState)}`,
      headers: { cookie: `af_oauth_state=${encodeURIComponent(signedState)}` }
    });

    const setCookie = loginRes.headers['set-cookie'] as string[];
    const match = setCookie.join(';').match(/af_session=([^;]+)/);
    const sessionToken = decodeURIComponent(match![1]);

    // 1. List Sessions: GET /v1/auth/sessions
    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/auth/sessions',
      headers: { cookie: `af_session=${encodeURIComponent(sessionToken)}` }
    });

    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json();
    expect(listBody.success).toBe(true);
    expect(listBody.data.sessions.length).toBeGreaterThanOrEqual(1);
    expect(listBody.data.sessions[0].isCurrent).toBe(true);

    // 2. Logout: POST /v1/auth/logout
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: {
        cookie: `af_session=${encodeURIComponent(sessionToken)}`,
        origin: 'http://localhost:3000'
      }
    });

    expect(logoutRes.statusCode).toBe(200);
    const logoutBody = logoutRes.json();
    expect(logoutBody.success).toBe(true);
    expect(logoutBody.data.revoked).toBe(true);

    // 3. Verify revoked session cannot access protected endpoints
    const meAfterLogout = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { cookie: `af_session=${encodeURIComponent(sessionToken)}` }
    });

    expect(meAfterLogout.statusCode).toBe(401);
  });

  it('POST /v1/auth/logout-all revokes all sessions across devices', async () => {
    const userSub = `google-sub-all-${Date.now()}`;
    const userEmail = `all-devices-${Date.now()}@agentflow.io`;

    mockOAuth.profileOverride = {
      providerSubject: userSub,
      email: userEmail,
      name: 'Multi Device User',
      emailVerified: true
    };

    // Device 1 login
    const pkce1 = generatePkcePair();
    const state1 = signOAuthState(
      { nonce: generateNonce(), codeVerifier: pkce1.verifier, createdAt: Date.now() },
      config.OAUTH_STATE_SIGNING_KEY_REFERENCE
    );
    const dev1Res = await app.inject({
      method: 'GET',
      url: `/v1/auth/google/callback?code=code_dev1&state=${encodeURIComponent(state1)}`,
      headers: { cookie: `af_oauth_state=${encodeURIComponent(state1)}` }
    });
    const match1 = (dev1Res.headers['set-cookie'] as string[]).join(';').match(/af_session=([^;]+)/);
    const token1 = decodeURIComponent(match1![1]);

    // Device 2 login
    const pkce2 = generatePkcePair();
    const state2 = signOAuthState(
      { nonce: generateNonce(), codeVerifier: pkce2.verifier, createdAt: Date.now() },
      config.OAUTH_STATE_SIGNING_KEY_REFERENCE
    );
    const dev2Res = await app.inject({
      method: 'GET',
      url: `/v1/auth/google/callback?code=code_dev2&state=${encodeURIComponent(state2)}`,
      headers: { cookie: `af_oauth_state=${encodeURIComponent(state2)}` }
    });
    const match2 = (dev2Res.headers['set-cookie'] as string[]).join(';').match(/af_session=([^;]+)/);
    const token2 = decodeURIComponent(match2![1]);

    // Logout all from Device 2
    const logoutAllRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout-all',
      headers: {
        cookie: `af_session=${encodeURIComponent(token2)}`,
        origin: 'http://localhost:3000'
      }
    });

    expect(logoutAllRes.statusCode).toBe(200);
    expect(logoutAllRes.json().data.revokedCount).toBeGreaterThanOrEqual(2);

    // Both sessions should now be rejected
    const me1 = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { cookie: `af_session=${encodeURIComponent(token1)}` }
    });
    expect(me1.statusCode).toBe(401);

    const me2 = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { cookie: `af_session=${encodeURIComponent(token2)}` }
    });
    expect(me2.statusCode).toBe(401);
  });

  // ============================================================================
  // PART E: CSRF Protection
  // ============================================================================
  it('rejects cookie-authenticated mutations from untrusted origins with 403 FORBIDDEN', async () => {
    // Valid user session
    const uniqueSub = `google-sub-csrf-${Date.now()}`;
    const uniqueEmail = `csrf-test-${Date.now()}@agentflow.io`;

    mockOAuth.profileOverride = {
      providerSubject: uniqueSub,
      email: uniqueEmail,
      name: 'CSRF Tester',
      emailVerified: true
    };

    const pkce = generatePkcePair();
    const state = signOAuthState(
      { nonce: generateNonce(), codeVerifier: pkce.verifier, createdAt: Date.now() },
      config.OAUTH_STATE_SIGNING_KEY_REFERENCE
    );

    const loginRes = await app.inject({
      method: 'GET',
      url: `/v1/auth/google/callback?code=csrf_code&state=${encodeURIComponent(state)}`,
      headers: { cookie: `af_oauth_state=${encodeURIComponent(state)}` }
    });
    const match = (loginRes.headers['set-cookie'] as string[]).join(';').match(/af_session=([^;]+)/);
    const sessionToken = decodeURIComponent(match![1]);

    // Post request from malicious origin
    const csrfRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: {
        cookie: `af_session=${encodeURIComponent(sessionToken)}`,
        origin: 'https://evil-hacker-site.com'
      }
    });

    expect(csrfRes.statusCode).toBe(403);
    const body = csrfRes.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toMatch(/(CSRF|CORS)/);
  });
});
