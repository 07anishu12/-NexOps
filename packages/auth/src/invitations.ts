import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Generate a high-entropy, cryptographically random, URL-safe invitation token.
 * 256 bits of entropy encoded as base64url.
 */
export function generateInvitationToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Compute the SHA-256 hex digest of an invitation token for database storage and lookup.
 * Plaintext invitation tokens must never be persisted.
 */
export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Timing-safe comparison between a computed hash and expected hash.
 */
export function verifyInvitationTokenHash(computedHash: string, expectedHash: string): boolean {
  const bufA = Buffer.from(computedHash, 'utf8');
  const bufB = Buffer.from(expectedHash, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
