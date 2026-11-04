import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/*',
  'apps/*',
  {
    test: {
      name: 'architecture',
      include: ['tests/architecture/**/*.test.ts']
    }
  },
  {
    test: {
      name: 'infrastructure',
      include: ['tests/infrastructure/**/*.test.ts']
    }
  }
]);
