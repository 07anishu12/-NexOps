import { describe, it, expect } from 'vitest';
import { generateWorkspaceSlug, validateWorkspaceSlug, RESERVED_WORKSPACE_SLUGS } from '../src/index.js';

describe('Workspace Domain Slug Utilities', () => {
  it('generates clean, lowercase, hyphenated slugs', () => {
    expect(generateWorkspaceSlug('Acme Corporation')).toBe('acme-corporation');
    expect(generateWorkspaceSlug('  My Awesome Team! 2026 ')).toBe('my-awesome-team-2026');
    expect(generateWorkspaceSlug('foo---bar___baz')).toBe('foo-bar-baz');
  });

  it('appends suffix when slug is too short or reserved', () => {
    const slugA = generateWorkspaceSlug('a', 'test1');
    expect(slugA).toBe('a-test1');

    const reservedSlug = generateWorkspaceSlug('app', '123');
    expect(reservedSlug).toBe('app-123');
    expect(RESERVED_WORKSPACE_SLUGS.has('app')).toBe(true);
  });

  it('validates compliant slugs', () => {
    expect(validateWorkspaceSlug('valid-workspace-slug-1').valid).toBe(true);
    expect(validateWorkspaceSlug('acme-corp').valid).toBe(true);
    expect(validateWorkspaceSlug('team-42').valid).toBe(true);
  });

  it('rejects invalid or reserved slugs', () => {
    expect(validateWorkspaceSlug('ab').valid).toBe(false);
    expect(validateWorkspaceSlug('admin').valid).toBe(false);
    expect(validateWorkspaceSlug('api').valid).toBe(false);
    expect(validateWorkspaceSlug('-leading-hyphen').valid).toBe(false);
    expect(validateWorkspaceSlug('trailing-hyphen-').valid).toBe(false);
    expect(validateWorkspaceSlug('has space').valid).toBe(false);
    expect(validateWorkspaceSlug('HasCapital').valid).toBe(false);
  });
});
