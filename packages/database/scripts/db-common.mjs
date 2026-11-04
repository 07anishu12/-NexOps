import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';

const root = resolve(new URL('.', import.meta.url).pathname, '..');

function parseEnvFile() {
  const filePath = resolve(root, '../../.env');
  try {
    const values = {};
    for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const separator = trimmed.indexOf('=');
      if (separator < 1) continue;
      values[trimmed.slice(0, separator)] = trimmed.slice(separator + 1).replace(/^(['"])(.*)\1$/, '$2');
    }
    return values;
  } catch {
    return {};
  }
}

export function databaseUrl() {
  const env = { ...parseEnvFile(), ...process.env };
  const value = env.DATABASE_URL;
  if (!value) throw new Error('DATABASE_URL is required for database commands');
  if (!value.startsWith('postgres://') && !value.startsWith('postgresql://')) {
    throw new Error('DATABASE_URL must use postgres:// or postgresql://');
  }
  return value;
}

export function createPool(connectionString = databaseUrl()) {
  return new Pool({ connectionString, max: 5, connectionTimeoutMillis: 5_000, application_name: 'agentflow-db-cli' });
}

export function migrationDirectory() {
  return resolve(root, 'migrations');
}

export function assertSafeEnvironment() {
  const environment = process.env.NODE_ENV ?? parseEnvFile().NODE_ENV ?? 'development';
  if (environment === 'production' || environment === 'staging') {
    throw new Error(`Database development command blocked for ${environment} environment`);
  }
  return environment;
}
