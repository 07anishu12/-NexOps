import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/*',
  'apps/*',
  {
    test: {
      name: 'architecture',
      include: ['tests/**/*.test.ts']
    }
  }
]);
