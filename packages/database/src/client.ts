import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema/index.js';

export interface DatabaseConfig extends Pick<PoolConfig, 'max' | 'idleTimeoutMillis' | 'connectionTimeoutMillis'> {
  databaseUrl: string;
}

export type Database = NodePgDatabase<typeof schema>;

export interface DatabaseClient {
  readonly db: Database;
  readonly pool: Pool;
  readonly schema: typeof schema;
  readonly isConfigured: boolean;
  readonly isConnected: boolean;
  close(): Promise<void>;
}

export function createDatabaseClient(config: DatabaseConfig): DatabaseClient {
  if (!config.databaseUrl || (!config.databaseUrl.startsWith('postgres://') && !config.databaseUrl.startsWith('postgresql://'))) {
    throw new Error('databaseUrl must be a PostgreSQL connection URL');
  }

  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: config.max ?? 10,
    idleTimeoutMillis: config.idleTimeoutMillis ?? 30_000,
    connectionTimeoutMillis: config.connectionTimeoutMillis ?? 5_000,
    application_name: 'agentflow-os'
  });

  const db = drizzle(pool, { schema });
  return {
    db,
    pool,
    schema,
    isConfigured: true,
    isConnected: true,
    close: () => pool.end()
  };
}

export async function checkDatabaseConnection(client: DatabaseClient): Promise<void> {
  await client.pool.query('SELECT 1');
}
