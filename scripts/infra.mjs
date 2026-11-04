import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const ROOT_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
export const COMPOSE_FILE = resolve(ROOT_DIR, 'docker-compose.yml');
export const ENV_FILE = resolve(ROOT_DIR, '.env');

export function parseDotEnv(contents) {
  const values = {};
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    values[key] = rawValue.replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

export function readLocalEnvironment() {
  if (!existsSync(ENV_FILE)) return {};
  return parseDotEnv(readFileSync(ENV_FILE, 'utf8'));
}

export function redactSecrets(message, secrets = []) {
  let redacted = String(message);
  for (const secret of secrets) {
    if (secret && secret.length >= 4) redacted = redacted.split(secret).join('[REDACTED]');
  }
  return redacted
    .replace(/(postgres(?:ql)?:\/\/[^:]+:)[^@]+(@)/gi, '$1[REDACTED]$2')
    .replace(/(redis(?:s)?:\/\/[^:]+:)[^@]+(@)/gi, '$1[REDACTED]$2')
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,]+/gi, '$1[REDACTED]');
}

export function isResetEnvironmentAllowed(environment) {
  return environment === undefined || environment === 'development' || environment === 'test';
}

export async function retryWithBackoff(check, options = {}) {
  const attempts = options.attempts ?? 12;
  const initialDelayMs = options.initialDelayMs ?? 250;
  const maxDelayMs = options.maxDelayMs ?? 2000;
  let lastError = new Error('Readiness check failed');

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await check(attempt);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === attempts) break;
      const delay = Math.min(initialDelayMs * 2 ** (attempt - 1), maxDelayMs);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
    }
  }

  throw new Error(`Infrastructure readiness timed out: ${lastError.message}`);
}

function compose(args, options = {}) {
  const result = spawnSync('docker', ['compose', '-f', COMPOSE_FILE, ...args], {
    cwd: ROOT_DIR,
    env: { ...readLocalEnvironment(), ...process.env },
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe'
  });

  if (result.error) {
    throw new Error(`Docker Compose is unavailable: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const output = `${result.stderr ?? ''}${result.stdout ?? ''}`.trim();
    throw new Error(
      redactSecrets(output || `docker compose exited with code ${result.status}`, Object.values(readLocalEnvironment()))
    );
  }
  return result.stdout ?? '';
}

export function assertDockerAvailable() {
  const result = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], {
    encoding: 'utf8'
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      'Docker is installed but the daemon is unavailable. Start Docker Desktop (or the configured Docker daemon) and retry.'
    );
  }
}

async function checkPostgres(environment) {
  compose([
    'exec',
    '-T',
    'postgres',
    'pg_isready',
    '-U',
    environment.POSTGRES_USER ?? 'agentflow',
    '-d',
    environment.POSTGRES_DB ?? 'agentflow_dev'
  ]);
}

async function checkRedis() {
  const output = compose(['exec', '-T', 'redis', 'redis-cli', 'ping']);
  if (output.trim() !== 'PONG') throw new Error('Redis health check did not return PONG');
}

async function checkMinio(environment) {
  const endpoint = new URL(environment.OBJECT_STORAGE_ENDPOINT ?? 'http://localhost:9000');
  endpoint.pathname = '/minio/health/live';
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`MinIO health endpoint returned HTTP ${response.status}`);
  compose(['run', '--rm', '--no-deps', 'minio-init']);
}

export async function waitForInfrastructure() {
  assertDockerAvailable();
  const environment = readLocalEnvironment();
  const checks = [
    ['PostgreSQL', () => checkPostgres(environment)],
    ['Redis', () => checkRedis()],
    ['MinIO and bucket', () => checkMinio(environment)]
  ];

  for (const [name, check] of checks) {
    await retryWithBackoff(check, { attempts: 18, initialDelayMs: 500, maxDelayMs: 3000 }).catch((error) => {
      throw new Error(`${name} readiness failed. ${redactSecrets(error.message)}`);
    });
    console.log(`${name}: ready`);
  }
}

async function run(command, args = []) {
  if (command === 'up') {
    if (!existsSync(ENV_FILE)) {
      throw new Error('Missing .env. Run `pnpm dev:setup` before starting local infrastructure.');
    }
    assertDockerAvailable();
    compose(['up', '-d']);
    await waitForInfrastructure();
    return;
  }

  if (command === 'wait') {
    await waitForInfrastructure();
    return;
  }

  assertDockerAvailable();
  if (command === 'down') {
    compose(['down', '--remove-orphans'], { stdio: 'inherit' });
    return;
  }
  if (command === 'status') {
    compose(['ps'], { stdio: 'inherit' });
    return;
  }
  if (command === 'logs') {
    compose(['logs', '--tail', '100', ...args], { stdio: 'inherit' });
    return;
  }

  throw new Error(`Unknown infrastructure command: ${command}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command = 'status', ...args] = process.argv.slice(2).filter((arg) => arg !== '--');
  run(command, args).catch((error) => {
    console.error(redactSecrets(error instanceof Error ? error.message : error));
    process.exitCode = 1;
  });
}
