import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertDockerAvailable,
  isResetEnvironmentAllowed,
  readLocalEnvironment,
  waitForInfrastructure,
  ROOT_DIR
} from './infra.mjs';
import { spawnSync } from 'node:child_process';

const confirmed = process.argv.includes('--confirm');
const environment = readLocalEnvironment();

if (!confirmed) {
  console.error('This deletes local PostgreSQL, Redis and MinIO persistent volumes.');
  console.error('Re-run `pnpm dev:reset --confirm` only when that data can be destroyed.');
  process.exitCode = 1;
} else if (!isResetEnvironmentAllowed(environment.NODE_ENV)) {
  console.error('Refusing to reset staging or production environments.');
  process.exitCode = 1;
} else if (!existsSync(resolve(ROOT_DIR, 'docker-compose.yml'))) {
  console.error('Missing docker-compose.yml; cannot reset local infrastructure.');
  process.exitCode = 1;
} else {
  try {
    assertDockerAvailable();
    const result = spawnSync(
      'docker',
      ['compose', '-f', resolve(ROOT_DIR, 'docker-compose.yml'), 'down', '--volumes', '--remove-orphans'],
      { cwd: ROOT_DIR, env: { ...environment, ...process.env }, encoding: 'utf8', stdio: 'inherit' }
    );
    if (result.status !== 0) throw new Error('Docker Compose failed while removing local volumes.');

    const start = spawnSync(
      'docker',
      ['compose', '-f', resolve(ROOT_DIR, 'docker-compose.yml'), 'up', '-d'],
      { cwd: ROOT_DIR, env: { ...environment, ...process.env }, encoding: 'utf8', stdio: 'inherit' }
    );
    if (start.status !== 0) throw new Error('Docker Compose failed while restarting local infrastructure.');
    await waitForInfrastructure();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Local reset failed.');
    process.exitCode = 1;
  }
}
