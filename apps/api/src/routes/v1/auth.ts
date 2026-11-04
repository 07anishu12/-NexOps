import type { FastifyPluginAsync } from 'fastify';
import type { DatabaseClient, WorkspaceUserContext } from '@agentflow/database';
import { IdentityRepository, SessionRepository } from '@agentflow/database';
import type { EnvConfig } from '@agentflow/config';
import {
  generatePkcePair,
  generateNonce,
  signOAuthState,
  verifyOAuthState,
  getSessionCookieConfig
} from '@agentflow/auth';
import { createSuccessResponse } from '../../lib/responses.js';
import { HttpError } from '../../lib/errors.js';
import { GoogleOAuthService, type IGoogleOAuthService } from '../../services/google-oauth.js';

interface AuthRouteOptions {
  config?: EnvConfig;
  dbClient?: DatabaseClient;
  googleOAuthService?: IGoogleOAuthService;
}

export const authRoutes: FastifyPluginAsync<AuthRouteOptions> = async (
  fastify,
  options
) => {
  const config = options.config ?? (fastify as any).config;
  const isProduction = config?.NODE_ENV === 'production';
  const cookieName = config?.SESSION_COOKIE_NAME ?? 'af_session';
  const signingSecret = config?.OAUTH_STATE_SIGNING_KEY_REFERENCE ?? 'dev-oauth-state-signing-key-min-32-chars';

  // Instantiate Google OAuth service (with test injection support)
  const googleOAuthService: IGoogleOAuthService =
    options.googleOAuthService ??
    new GoogleOAuthService({
      clientId: config?.GOOGLE_OAUTH_CLIENT_ID ?? 'mock-client-id',
      clientSecret: config?.GOOGLE_OAUTH_CLIENT_SECRET ?? 'mock-secret',
      redirectUri: config?.GOOGLE_OAUTH_REDIRECT_URI ?? 'http://localhost:4000/v1/auth/google/callback'
    });

  // Repositories
  const identityRepo = options.dbClient ? new IdentityRepository(options.dbClient) : null;
  const sessionRepo = options.dbClient ? new SessionRepository(options.dbClient) : null;

  // ============================================================================
  // 1. GET /v1/auth/google/start - Initiate Google Authorization Code Flow
  // ============================================================================
  fastify.get<{
    Querystring: { returnTo?: string; prompt?: string };
  }>(
    '/google/start',
    {
      schema: {
        description: 'Initiate Google OpenID Connect authorization code flow with PKCE',
        tags: ['Auth'],
        querystring: {
          type: 'object',
          properties: {
            returnTo: { type: 'string', description: 'Relative path to redirect to after authentication' },
            prompt: { type: 'string', enum: ['select_account', 'consent'] }
          }
        }
      }
    },
    async (request, reply) => {
      // 1. Validate returnTo to prevent open redirects
      const rawReturnTo = request.query.returnTo;
      let returnTo: string | undefined;
      if (rawReturnTo) {
        if (rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//')) {
          returnTo = rawReturnTo;
        } else {
          throw new HttpError(400, 'VALIDATION_ERROR', 'returnTo parameter must be a valid relative URL path');
        }
      }

      // 2. Generate PKCE verifier + S256 challenge and nonce
      const pkce = generatePkcePair();
      const nonce = generateNonce();

      // 3. Generate signed HMAC-SHA256 state containing security payload
      const signedState = signOAuthState(
        {
          nonce,
          codeVerifier: pkce.verifier,
          returnTo,
          createdAt: Date.now()
        },
        signingSecret
      );

      // 4. Store state in short-lived HTTP-only cookie for CSRF/double-submit validation
      reply.setCookie('af_oauth_state', signedState, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: 600 // 10 minutes
      });

      // 5. Generate authorization consent URL
      const authUrl = googleOAuthService.generateAuthUrl({
        state: signedState,
        codeChallenge: pkce.challenge,
        nonce,
        prompt: request.query.prompt
      });

      return reply.status(302).redirect(authUrl);
    }
  );

  // ============================================================================
  // 2. GET /v1/auth/google/callback - Process Google OAuth Callback
  // ============================================================================
  fastify.get<{
    Querystring: { code?: string; state?: string; error?: string };
  }>(
    '/google/callback',
    {
      schema: {
        description: 'Google OAuth callback handler: exchanges authorization code, verifies ID token, and establishes session',
        tags: ['Auth'],
        querystring: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            state: { type: 'string' },
            error: { type: 'string' }
          }
        }
      }
    },
    async (request, reply) => {
      const appUrl = config?.APP_URL ?? 'http://localhost:3000';

      // 1. Handle error reported by Google authorization server
      if (request.query.error) {
        request.log?.warn?.({ error: request.query.error }, 'Google OAuth consent rejected or failed');
        return reply.status(302).redirect(`${appUrl}/login?error=${encodeURIComponent(request.query.error)}`);
      }

      const { code, state } = request.query;
      if (!code || !state) {
        return reply.status(302).redirect(`${appUrl}/login?error=missing_code_or_state`);
      }

      // 2. Validate and verify HMAC signature on OAuth state
      let statePayload;
      try {
        statePayload = verifyOAuthState(state, signingSecret);
      } catch (err) {
        request.log?.warn?.({ err }, 'OAuth state verification failed');
        return reply.status(302).redirect(`${appUrl}/login?error=invalid_or_expired_state`);
      }

      // 3. Double-submit cookie verification against state replay/theft
      const cookieState = request.cookies?.['af_oauth_state'];
      if (!cookieState || cookieState !== state) {
        request.log?.warn?.('OAuth state cookie mismatch or missing');
        return reply.status(302).redirect(`${appUrl}/login?error=state_cookie_mismatch`);
      }

      // 4. Server-side code exchange and cryptographic ID token verification
      let identityProfile;
      try {
        identityProfile = await googleOAuthService.exchangeCodeAndVerify({
          code,
          codeVerifier: statePayload.codeVerifier,
          expectedNonce: statePayload.nonce
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Google token exchange failed';
        request.log?.error?.({ err }, 'Google ID token verification failed');
        return reply.status(302).redirect(`${appUrl}/login?error=${encodeURIComponent(errorMsg)}`);
      }

      if (!identityRepo || !sessionRepo) {
        throw new HttpError(500, 'INTERNAL_ERROR', 'Database repositories not available for session provisioning');
      }

      // 5. Idempotent user resolution and account provisioning
      let resolved;
      try {
        resolved = await identityRepo.findOrCreateUserFromGoogle(identityProfile);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Identity provisioning failed';
        return reply.status(302).redirect(`${appUrl}/login?error=${encodeURIComponent(msg)}`);
      }

      // 6. Establish and rotate session (session fixation defense)
      const existingToken =
        request.cookies?.[`__Host-${cookieName}`] ??
        request.cookies?.[cookieName] ??
        request.cookies?.['af_session'];

      const ttlSeconds = config?.SESSION_TTL_SECONDS ?? 7 * 24 * 3600;
      const { rawToken } = await sessionRepo.rotateSession(existingToken, {
        userId: resolved.user.id,
        workspaceId: resolved.defaultWorkspaceId,
        ttlSeconds
      });

      // 7. Set HTTP-only, Secure session cookie
      const cookieConfig = getSessionCookieConfig({
        isProduction,
        ttlSeconds,
        customDomain: config?.SESSION_COOKIE_DOMAIN,
        cookieName: config?.SESSION_COOKIE_NAME
      });

      reply.setCookie(cookieConfig.name, rawToken, {
        httpOnly: cookieConfig.httpOnly,
        secure: cookieConfig.secure,
        sameSite: cookieConfig.sameSite,
        path: cookieConfig.path,
        maxAge: cookieConfig.maxAge,
        domain: cookieConfig.domain
      });

      // Clear OAuth state cookie
      reply.clearCookie('af_oauth_state', { path: '/' });

      // 8. Redirect to validated returnTo path or default console
      const safeReturnTo =
        statePayload.returnTo && statePayload.returnTo.startsWith('/') && !statePayload.returnTo.startsWith('//')
          ? statePayload.returnTo
          : '/app';

      return reply.status(302).redirect(`${appUrl}${safeReturnTo}`);
    }
  );

  // ============================================================================
  // 3. GET /v1/auth/me - Introspect Authenticated Principal & Session
  // ============================================================================
  fastify.get(
    '/me',
    {
      preHandler: [fastify.requireTenantAuth()],
      schema: {
        description: 'Get verified tenant context and profile for current authenticated user or API key',
        tags: ['Auth'],
        security: [{ apiKeyAuth: [] }, { bearerApiKey: [] }, { sessionAuth: [] }]
      }
    },
    async (request, reply) => {
      const tenant = request.tenantContext!;

      if (tenant.principalType === 'user' && identityRepo) {
        const userRecord = await identityRepo.findUserById(tenant.userId);
        const workspacesList = await identityRepo.getUserWorkspaces(tenant.userId);

        return reply.send(
          createSuccessResponse(
            {
              principalType: 'user',
              user: userRecord
                ? {
                    id: userRecord.id,
                    name: userRecord.name,
                    email: userRecord.email,
                    avatarUrl: userRecord.avatarUrl
                  }
                : { id: tenant.userId, email: tenant.email },
              activeWorkspace: {
                workspaceId: tenant.workspaceId,
                role: tenant.role
              },
              workspaces: workspacesList,
              authMethod: tenant.authMethod,
              sessionId: tenant.sessionId,
              correlationId: tenant.correlationId
            },
            request
          )
        );
      }

      // API Key / Service Principal
      return reply.send(
        createSuccessResponse(
          {
            principalType: tenant.principalType,
            principalId: tenant.principalId,
            workspaceId: tenant.workspaceId,
            authMethod: tenant.authMethod,
            correlationId: tenant.correlationId
          },
          request
        )
      );
    }
  );

  // ============================================================================
  // 4. POST /v1/auth/logout - Revoke Current Session & Clear Cookie
  // ============================================================================
  fastify.post(
    '/logout',
    {
      preHandler: [fastify.requireTenantAuth()],
      schema: {
        description: 'Terminate and revoke current server-side session and clear session cookie',
        tags: ['Auth'],
        security: [{ sessionAuth: [] }, { bearerApiKey: [] }]
      }
    },
    async (request, reply) => {
      const token =
        request.cookies?.[`__Host-${cookieName}`] ??
        request.cookies?.[cookieName] ??
        request.cookies?.['af_session'];

      if (sessionRepo && token) {
        await sessionRepo.revokeSession(token);
      }

      // Clear session cookie across possible names
      reply.clearCookie(cookieName, { path: '/' });
      reply.clearCookie(`__Host-${cookieName}`, { path: '/' });
      reply.clearCookie('af_session', { path: '/' });

      return reply.send(
        createSuccessResponse(
          {
            revoked: true,
            message: 'Session revoked successfully'
          },
          request
        )
      );
    }
  );

  // ============================================================================
  // 5. POST /v1/auth/logout-all - Revoke All Active Sessions for User
  // ============================================================================
  fastify.post(
    '/logout-all',
    {
      preHandler: [fastify.requireTenantAuth()],
      schema: {
        description: 'Revoke all active sessions across all devices for authenticated user',
        tags: ['Auth'],
        security: [{ sessionAuth: [] }]
      }
    },
    async (request, reply) => {
      if (request.tenantContext?.principalType !== 'user') {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Logout-all is only available for user sessions');
      }

      let revokedCount = 0;
      if (sessionRepo) {
        revokedCount = await sessionRepo.revokeAllUserSessions(request.tenantContext.userId);
      }

      reply.clearCookie(cookieName, { path: '/' });
      reply.clearCookie(`__Host-${cookieName}`, { path: '/' });
      reply.clearCookie('af_session', { path: '/' });

      return reply.send(
        createSuccessResponse(
          {
            revokedCount,
            message: 'All active sessions have been revoked'
          },
          request
        )
      );
    }
  );

  // ============================================================================
  // 6. GET /v1/auth/sessions - List Active User Sessions
  // ============================================================================
  fastify.get(
    '/sessions',
    {
      preHandler: [fastify.requireTenantAuth()],
      schema: {
        description: 'List active sessions for authenticated user',
        tags: ['Auth'],
        security: [{ sessionAuth: [] }]
      }
    },
    async (request, reply) => {
      if (request.tenantContext?.principalType !== 'user') {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Session listing is only available for user accounts');
      }

      let sessionList: Array<{
        id: string;
        createdAt: Date;
        expiresAt: Date;
        lastSeenAt: Date | null;
        workspaceId: string | null;
        isCurrent: boolean;
      }> = [];

      if (sessionRepo) {
        const userContext = request.tenantContext as WorkspaceUserContext;
        const rawSessions = await sessionRepo.listUserSessions(userContext.userId);
        sessionList = rawSessions.map((s) => ({
          ...s,
          isCurrent: s.id === userContext.sessionId
        }));
      }

      return reply.send(createSuccessResponse({ sessions: sessionList }, request));
    }
  );

  // ============================================================================
  // 7. DELETE /v1/auth/sessions/:sessionId - Revoke Specific Session
  // ============================================================================
  fastify.delete<{
    Params: { sessionId: string };
  }>(
    '/sessions/:sessionId',
    {
      preHandler: [fastify.requireTenantAuth()],
      schema: {
        description: 'Revoke a specific session by ID',
        tags: ['Auth'],
        params: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', format: 'uuid' }
          },
          required: ['sessionId']
        },
        security: [{ sessionAuth: [] }]
      }
    },
    async (request, reply) => {
      if (request.tenantContext?.principalType !== 'user') {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Session revocation is only available for user accounts');
      }

      const { sessionId } = request.params;
      let revoked = false;

      if (sessionRepo) {
        revoked = await sessionRepo.revokeSessionById(request.tenantContext.userId, sessionId);
      }

      if (!revoked) {
        throw new HttpError(404, 'NOT_FOUND', `Session '${sessionId}' not found or already revoked`);
      }

      // If the revoked session is current session, clear cookie
      if (sessionId === request.tenantContext.sessionId) {
        reply.clearCookie(cookieName, { path: '/' });
        reply.clearCookie(`__Host-${cookieName}`, { path: '/' });
        reply.clearCookie('af_session', { path: '/' });
      }

      return reply.send(
        createSuccessResponse(
          {
            revoked: true,
            sessionId
          },
          request
        )
      );
    }
  );
};
