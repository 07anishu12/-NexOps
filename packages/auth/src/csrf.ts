import { randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Generate a cryptographically random CSRF token.
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Validate a submitted CSRF token against an expected session CSRF token.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyCsrfToken(submittedToken: string, expectedToken: string): boolean {
  if (!submittedToken || !expectedToken) return false;
  const bufSubmitted = Buffer.from(submittedToken, 'utf8');
  const bufExpected = Buffer.from(expectedToken, 'utf8');

  if (bufSubmitted.length !== bufExpected.length) return false;
  return timingSafeEqual(bufSubmitted, bufExpected);
}

/**
 * HTTP methods considered idempotent and safe by RFC 7231 (do not modify server state).
 */
export function isSafeHttpMethod(method: string): boolean {
  const upper = method.toUpperCase();
  return upper === 'GET' || upper === 'HEAD' || upper === 'OPTIONS';
}

/**
 * Validates that an incoming Origin or Referer header matches configured trusted web origins.
 */
export function isTrustedOrigin(originOrReferer: string | undefined, trustedOrigins: string[]): boolean {
  if (!originOrReferer) return false;

  try {
    const origin = new URL(originOrReferer).origin;
    return trustedOrigins.some((trusted) => {
      try {
        return new URL(trusted).origin === origin;
      } catch {
        return trusted === origin;
      }
    });
  } catch {
    return false;
  }
}
