import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createPool, migrationDirectory } from './db-common.mjs';

const pool = createPool();
try {
  await migrate(drizzle(pool), { migrationsFolder: migrationDirectory() });
  console.log('Database migrations applied successfully.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Database migration failed.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
