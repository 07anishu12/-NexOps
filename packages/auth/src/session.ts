import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { WorkspaceRole } from '@agentflow/contracts';

export interface UserSession {
  userId: string;
  email: string;
  activeWorkspaceId: string;
  role: WorkspaceRole;
  createdAt: number;
  expiresAt: number;
}

/**
 * Generate a cryptographically random, high-entropy raw session token.
 * Yields 32 bytes of secure entropy formatted as a 64-character hex string.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Compute SHA-256 digest of raw session token for database persistence.
 * Raw session tokens are never stored in plaintext in the database.
 */
export function hashSessionToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

/**
 * Perform constant-time verification of raw session token against stored hash.
 */
export function verifySessionToken(rawToken: string, storedHash: string): boolean {
  const computed = hashSessionToken(rawToken);
  const bufA = Buffer.from(computed, 'utf8');
  const bufB = Buffer.from(storedHash, 'utf8');

  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Check whether a session has surpassed its expiration timestamp.
 */
export function isSessionExpired(sessionOrExpiry: UserSession | Date | number): boolean {
  const now = Date.now();
  if (typeof sessionOrExpiry === 'number') {
    return now >= sessionOrExpiry;
  }
  if (sessionOrExpiry instanceof Date) {
    return now >= sessionOrExpiry.getTime();
  }
  return now >= sessionOrExpiry.expiresAt;
}

export interface SessionCookieConfig {
  name: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  maxAge: number; // in seconds
  domain?: string;
}

export interface CookieConfigOptions {
  isProduction: boolean;
  ttlSeconds?: number;
  customDomain?: string;
  cookieName?: string;
  sameSite?: 'lax' | 'strict' | 'none';
}

/**
 * Generate secure session cookie configuration.
 * Uses '__Host-af_session' in production when no custom domain is specified (RFC 6265bis).
 */
export function getSessionCookieConfig(options: CookieConfigOptions): SessionCookieConfig {
  const { isProduction, ttlSeconds = 7 * 24 * 3600, customDomain, cookieName, sameSite = 'lax' } = options;

  let name = cookieName ?? 'af_session';
  // Use __Host- prefix only in production when domain is omitted and secure is true
  if (isProduction && !customDomain && !name.startsWith('__Host-')) {
    name = `__Host-${name}`;
  }

  return {
    name,
    httpOnly: true,
    secure: isProduction,
    sameSite,
    path: '/',
    maxAge: ttlSeconds,
    ...(customDomain ? { domain: customDomain } : {})
  };
}

/**
 * Legacy in-memory helper preserved for backward compatibility.
 */
export function createSession(params: {
  userId: string;
  email: string;
  workspaceId: string;
  role: WorkspaceRole;
  ttlSeconds?: number;
}): UserSession {
  const now = Date.now();
  const ttl = (params.ttlSeconds ?? 86400) * 1000;
  return {
    userId: params.userId,
    email: params.email,
    activeWorkspaceId: params.workspaceId,
    role: params.role,
    createdAt: now,
    expiresAt: now + ttl
  };
}
