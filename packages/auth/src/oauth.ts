import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export interface PkcePair {
  verifier: string;
  challenge: string;
  method: 'S256';
}

/**
 * Generate a cryptographically random PKCE code verifier (RFC 7636).
 * Uses URL-safe characters with length between 43 and 128 (default: 64).
 */
export function generatePkceVerifier(length = 64): string {
  const byteCount = Math.ceil(length * 0.75);
  return randomBytes(byteCount)
    .toString('base64url')
    .slice(0, length);
}

/**
 * Generate the SHA-256 PKCE code challenge from a code verifier.
 */
export function generatePkceChallenge(verifier: string): string {
  return createHash('sha256')
    .update(verifier, 'utf8')
    .digest('base64url');
}

/**
 * Generate complete PKCE verifier and S256 challenge pair.
 */
export function generatePkcePair(): PkcePair {
  const verifier = generatePkceVerifier();
  const challenge = generatePkceChallenge(verifier);
  return {
    verifier,
    challenge,
    method: 'S256'
  };
}

/**
 * Generate a high-entropy OIDC nonce.
 */
export function generateNonce(length = 32): string {
  return randomBytes(length).toString('hex');
}

export interface OAuthStatePayload {
  nonce: string;
  codeVerifier: string;
  returnTo?: string;
  createdAt: number;
}

/**
 * Sign OAuth state using HMAC-SHA256 to ensure authenticity and prevent tampering/CSRF.
 * Format: `${base64urlPayload}.${base64urlHmacSignature}`
 */
export function signOAuthState(payload: OAuthStatePayload, secret: string): string {
  const serialized = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const hmac = createHmac('sha256', secret)
    .update(serialized)
    .digest('base64url');
  return `${serialized}.${hmac}`;
}

/**
 * Verify and decode HMAC-signed OAuth state.
 * Validates cryptographic signature and expiration window (default: 10 minutes).
 */
export function verifyOAuthState(
  state: string,
  secret: string,
  maxAgeMs = 10 * 60 * 1000 // 10 minutes
): OAuthStatePayload {
  if (!state || typeof state !== 'string') {
    throw new Error('Invalid OAuth state: state parameter missing');
  }

  const parts = state.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('Invalid OAuth state format: malformed state structure');
  }

  const [encodedPayload, submittedHmac] = parts;
  const expectedHmac = createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');

  const bufSubmitted = Buffer.from(submittedHmac, 'utf8');
  const bufExpected = Buffer.from(expectedHmac, 'utf8');

  if (bufSubmitted.length !== bufExpected.length || !timingSafeEqual(bufSubmitted, bufExpected)) {
    throw new Error('OAuth state verification failed: invalid HMAC signature');
  }

  try {
    const jsonStr = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const payload = JSON.parse(jsonStr) as OAuthStatePayload;

    if (!payload.createdAt || !payload.nonce || !payload.codeVerifier) {
      throw new Error('OAuth state payload missing required security attributes');
    }

    const age = Date.now() - payload.createdAt;
    if (age < 0 || age > maxAgeMs) {
      throw new Error(`OAuth state has expired (age: ${Math.round(age / 1000)}s, limit: ${maxAgeMs / 1000}s)`);
    }

    return payload;
  } catch (err) {
    if (err instanceof Error && err.message.includes('expired')) {
      throw err;
    }
    throw new Error(`Invalid OAuth state payload: ${err instanceof Error ? err.message : 'JSON parse failure'}`);
  }
}
