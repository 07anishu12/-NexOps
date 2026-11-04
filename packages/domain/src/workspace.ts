import { randomBytes } from 'node:crypto';

export const RESERVED_WORKSPACE_SLUGS = new Set([
  'app',
  'api',
  'admin',
  'auth',
  'login',
  'logout',
  'dashboard',
  'settings',
  'workspace',
  'workspaces',
  'health',
  'ready',
  'docs',
  'invite',
  'invitations',
  'billing',
  'root',
  'system',
  'null',
  'undefined',
  'static',
  'assets',
  'public',
  'favicon',
  'robots',
  'sitemap'
]);

/**
 * Normalizes input name into a URL-friendly, safe workspace slug.
 * If the resulting slug is reserved or too short, an alphanumeric random suffix is appended.
 */
export function generateWorkspaceSlug(input: string, customSuffix?: string): string {
  let cleaned = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (cleaned.length < 3) {
    const randomPad = customSuffix ?? randomBytes(3).toString('hex');
    cleaned = cleaned.length === 0 ? `ws-${randomPad}` : `${cleaned}-${randomPad}`;
  }

  if (RESERVED_WORKSPACE_SLUGS.has(cleaned)) {
    const suffix = customSuffix ?? randomBytes(3).toString('hex');
    cleaned = `${cleaned}-${suffix}`;
  }

  // Enforce max 100 characters
  if (cleaned.length > 100) {
    cleaned = cleaned.slice(0, 100).replace(/-+$/, '');
  }

  // Ensure trailing character is alphanumeric
  if (!/^[a-z0-9]/.test(cleaned)) {
    cleaned = `ws-${cleaned}`;
  }
  if (!/[a-z0-9]$/.test(cleaned)) {
    cleaned = `${cleaned}0`;
  }

  return cleaned;
}

/**
 * Validates whether a candidate slug complies with strict format and reserved-word policies.
 */
export function validateWorkspaceSlug(slug: string): { valid: boolean; reason?: string } {
  if (typeof slug !== 'string') {
    return { valid: false, reason: 'Slug must be a string' };
  }

  if (slug.length < 3) {
    return { valid: false, reason: 'Slug must be at least 3 characters long' };
  }

  if (slug.length > 100) {
    return { valid: false, reason: 'Slug must not exceed 100 characters' };
  }

  if (!/^[a-z0-9][a-z0-9-]{1,98}[a-z0-9]$/.test(slug)) {
    return {
      valid: false,
      reason: 'Slug must start and end with an alphanumeric character and contain only lowercase letters, numbers, and hyphens'
    };
  }

  if (RESERVED_WORKSPACE_SLUGS.has(slug)) {
    return { valid: false, reason: `Slug '${slug}' is a reserved system path` };
  }

  return { valid: true };
}
