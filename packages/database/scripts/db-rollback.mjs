import { assertSafeEnvironment } from './db-common.mjs';

try {
  assertSafeEnvironment();
  console.error('Automatic rollback is intentionally disabled. Use a reviewed forward-fix migration.');
  console.error('For disposable development databases, drop and recreate the database explicitly, then run db:migrate.');
  process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Rollback blocked.');
  process.exitCode = 1;
}
