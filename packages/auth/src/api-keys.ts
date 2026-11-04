import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export interface GeneratedApiKey {
  plaintextKey: string;
  keyHash: string;
  prefix: string;
  lastFour: string;
}

export function generateApiKey(environment: 'live' | 'test' = 'live'): GeneratedApiKey {
  const prefix = `af_${environment}_`;
  const randomPart = randomBytes(24).toString('hex');
  const plaintextKey = `${prefix}${randomPart}`;
  const keyHash = hashApiKey(plaintextKey);
  const lastFour = plaintextKey.slice(-4);

  return {
    plaintextKey,
    keyHash,
    prefix,
    lastFour
  };
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

export function verifyApiKey(plaintextKey: string, storedHash: string): boolean {
  const computed = hashApiKey(plaintextKey);
  const bufA = Buffer.from(computed, 'utf8');
  const bufB = Buffer.from(storedHash, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
