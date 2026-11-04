import { createPool } from './db-common.mjs';

const pool = createPool();
try {
  const result = await pool.query(
    `SELECT id, hash, created_at
       FROM drizzle.__drizzle_migrations
      ORDER BY created_at ASC`
  );
  if (result.rows.length === 0) {
    console.log('No migrations have been applied.');
  } else {
    for (const row of result.rows) {
      const formattedDate = !isNaN(Number(row.created_at))
        ? new Date(Number(row.created_at)).toISOString()
        : new Date(row.created_at).toISOString();
      console.log(`${row.id}\t${formattedDate}\t${row.hash}`);
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Unable to read migration status.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
