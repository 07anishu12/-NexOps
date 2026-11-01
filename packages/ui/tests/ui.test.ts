import { describe, it, expect } from 'vitest';
import { cn, getButtonClassName, getBadgeClassName, designTokens } from '../src/index.js';

describe('UI Package Tests', () => {
  it('merges Tailwind classes correctly without collisions', () => {
    const merged = cn('px-2 py-1', 'px-4', { 'bg-red-500': true, 'bg-blue-500': false });
    expect(merged).toContain('px-4');
    expect(merged).not.toContain('px-2');
    expect(merged).toContain('bg-red-500');
  });

  it('generates button variant classes accurately', () => {
    const primary = getButtonClassName('primary', 'md');
    expect(primary).toContain('bg-blue-600');
    expect(primary).toContain('px-4 py-2');

    const danger = getButtonClassName('danger', 'sm');
    expect(danger).toContain('bg-red-600');
    expect(danger).toContain('px-2.5 py-1.5');
  });

  it('generates badge variant classes accurately', () => {
    const success = getBadgeClassName('success');
    expect(success).toContain('text-emerald-400');

    const error = getBadgeClassName('error');
    expect(error).toContain('text-rose-400');
  });

  it('exposes defined design tokens', () => {
    expect(designTokens.colors.brand.primary).toBe('#2563eb');
    expect(designTokens.typography.fontSans).toBeDefined();
  });
});
