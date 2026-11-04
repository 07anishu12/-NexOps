import { OAuth2Client, type LoginTicket, type TokenPayload } from 'google-auth-library';
import type { GoogleIdentityProfile } from '@agentflow/database';
import { AuthenticationError } from '@agentflow/database';

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GoogleAuthUrlParams {
  state: string;
  codeChallenge: string;
  nonce: string;
  prompt?: string;
}

export interface ExchangeCodeParams {
  code: string;
  codeVerifier: string;
  expectedNonce?: string;
}

export interface IGoogleOAuthService {
  generateAuthUrl(params: GoogleAuthUrlParams): string;
  exchangeCodeAndVerify(params: ExchangeCodeParams): Promise<GoogleIdentityProfile>;
}

export class GoogleOAuthService implements IGoogleOAuthService {
  private readonly client: OAuth2Client;
  private readonly clientId: string;

  constructor(config: GoogleOAuthConfig, clientOverride?: OAuth2Client) {
    this.clientId = config.clientId;
    this.client =
      clientOverride ??
      new OAuth2Client({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri
      });
  }

  generateAuthUrl(params: GoogleAuthUrlParams): string {
    return this.client.generateAuthUrl({
      access_type: 'online',
      scope: ['openid', 'email', 'profile'],
      state: params.state,
      code_challenge: params.codeChallenge,
      code_challenge_method: 'S256',
      nonce: params.nonce,
      prompt: params.prompt ?? 'select_account'
    } as any);
  }

  async exchangeCodeAndVerify(params: ExchangeCodeParams): Promise<GoogleIdentityProfile> {
    if (!params.code || params.code.trim().length === 0) {
      throw new AuthenticationError('Authorization code is missing from OAuth callback');
    }

    if (!params.codeVerifier || params.codeVerifier.trim().length === 0) {
      throw new AuthenticationError('PKCE code verifier is missing');
    }

    // 1. Server-side token exchange with PKCE verification
    let idToken: string | null | undefined;
    try {
      const response = await this.client.getToken({
        code: params.code,
        codeVerifier: params.codeVerifier
      });
      idToken = response.tokens.id_token;
    } catch (err) {
      throw new AuthenticationError(
        `Failed to exchange authorization code with Google: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (!idToken) {
      throw new AuthenticationError('Google OAuth token response did not contain an ID token');
    }

    // 2. Cryptographic ID Token Verification against Google JWKS certificates
    let ticket: LoginTicket;
    try {
      ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientId
      });
    } catch (err) {
      throw new AuthenticationError(
        `Google ID token cryptographic signature verification failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const payload: TokenPayload | undefined = ticket.getPayload();
    if (!payload) {
      throw new AuthenticationError('Failed to read verified payload from Google ID token');
    }

    // 3. Issuer Validation (RFC 7519 & OpenID Connect Core)
    const validIssuers = ['https://accounts.google.com', 'accounts.google.com'];
    if (!payload.iss || !validIssuers.includes(payload.iss)) {
      throw new AuthenticationError(`Invalid ID token issuer '${payload.iss}'`);
    }

    // 4. Audience Validation
    if (payload.aud !== this.clientId) {
      throw new AuthenticationError(`Invalid ID token audience '${payload.aud}'`);
    }

    // 5. Expiration Validation
    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp <= nowSec) {
      throw new AuthenticationError('Google ID token has expired');
    }

    // 6. Nonce Validation
    if (params.expectedNonce && (payload as unknown as Record<string, unknown>)['nonce'] !== params.expectedNonce) {
      throw new AuthenticationError('ID token nonce does not match original authentication request');
    }

    // 7. Email Verification Validation
    if (!payload.email) {
      throw new AuthenticationError('Google ID token does not contain an email address');
    }

    if (!payload.email_verified) {
      throw new AuthenticationError('Google account email address is not verified');
    }

    if (!payload.sub) {
      throw new AuthenticationError('Google ID token missing stable subject identifier (sub)');
    }

    return {
      providerSubject: payload.sub,
      email: payload.email,
      name: payload.name || payload.email.split('@')[0] || 'User',
      avatarUrl: payload.picture,
      emailVerified: Boolean(payload.email_verified)
    };
  }
}
