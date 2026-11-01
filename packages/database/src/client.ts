import * as schema from './schema/index.js';

export interface DatabaseConfig {
  databaseUrl: string;
}

export interface MockDatabaseClient {
  readonly isConnected: boolean;
  readonly schema: typeof schema;
}

export function createDatabaseClient(config: DatabaseConfig): MockDatabaseClient {
  if (!config.databaseUrl) {
    throw new Error('databaseUrl is required to initialize database client');
  }
  return {
    isConnected: true,
    schema
  };
}
