import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const examplePath = resolve(root, '.env.example');
const envPath = resolve(root, '.env');

function setEnvValue(contents, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  return pattern.test(contents) ? contents.replace(pattern, line) : `${contents.trimEnd()}\n${line}\n`;
}

function createLocalEnvironment() {
  if (existsSync(envPath)) {
    console.log('.env already exists; preserving the existing developer environment.');
    return;
  }

  if (!existsSync(examplePath)) {
    throw new Error('Missing .env.example; cannot create a local environment.');
  }

  const postgresPassword = randomBytes(24).toString('hex');
  const sessionSecret = randomBytes(32).toString('base64url');
  const encryptionReference = `local-${randomBytes(24).toString('hex')}`;
  const objectStorageSecret = randomBytes(24).toString('hex');

  let contents = readFileSync(examplePath, 'utf8');
  contents = setEnvValue(contents, 'POSTGRES_PASSWORD', postgresPassword);
  contents = setEnvValue(
    contents,
    'DATABASE_URL',
    `postgresql://agentflow:${postgresPassword}@localhost:5432/agentflow_dev`
  );
  contents = setEnvValue(contents, 'SESSION_SECRET', sessionSecret);
  contents = setEnvValue(contents, 'ENCRYPTION_KEY_REFERENCE', encryptionReference);
  contents = setEnvValue(contents, 'OBJECT_STORAGE_ACCESS_KEY', 'agentflowlocal');
  contents = setEnvValue(contents, 'OBJECT_STORAGE_SECRET_KEY', objectStorageSecret);
  writeFileSync(envPath, contents, { mode: 0o600 });
  console.log('Created .env with unique local-only credentials. Secret values were not printed.');
}

try {
  createLocalEnvironment();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Unable to create .env');
  process.exitCode = 1;
}
