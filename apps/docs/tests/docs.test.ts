import { describe, it, expect } from 'vitest';
import { DOCUMENTATION_INDEX, getDocSection } from '../src/index.js';

describe('Docs App Tests', () => {
  it('exposes comprehensive documentation section index', () => {
    expect(DOCUMENTATION_INDEX.length).toBeGreaterThanOrEqual(5);
    const apiDoc = getDocSection('api-v1');
    expect(apiDoc).toBeDefined();
    expect(apiDoc?.title).toBe('REST API Reference');
  });

  it('returns undefined for non-existent documentation sections', () => {
    expect(getDocSection('non-existent')).toBeUndefined();
  });
});
