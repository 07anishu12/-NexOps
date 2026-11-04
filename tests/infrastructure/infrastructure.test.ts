import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  isResetEnvironmentAllowed,
  parseDotEnv,
  redactSecrets,
  retryWithBackoff
} from '../../scripts/infra.mjs';

const compose = readFileSync('docker-compose.yml', 'utf8');

describe('Local infrastructure configuration', () => {
  it('defines pinned services, local-only ports, health checks and persistent storage', () => {
    expect(compose).toContain('postgres:16.4-alpine');
    expect(compose).toContain('redis:7.4.1-alpine');
    expect(compose).toContain('bitnamilegacy/minio:2024.10.29');
    expect(compose).toContain('bitnamilegacy/minio-client:2024.10.29');
    expect(compose).toContain('postgres_data:');
    expect(compose).toContain('redis_data:');
    expect(compose).toContain('minio_data:');
    expect(compose).toContain('name: agentflow-local');
    expect(compose).toContain('pg_isready');
    expect(compose).toContain('redis-cli');
    expect(compose).toContain('/minio/health/live');
    expect(compose).toContain('mc mb --ignore-existing');
    expect(compose).not.toMatch(/image:\s+[^\n]*:latest\b/);
    expect(compose).toMatch(/127\.0\.0\.1:\$\{POSTGRES_PORT/);
    expect(compose).toMatch(/127\.0\.0\.1:\$\{REDIS_PORT/);
  });

  it('passes Docker Compose static validation when the Docker CLI is available', () => {
    const result = spawnSync('docker', ['compose', '-f', 'docker-compose.yml', 'config', '--quiet'], {
      encoding: 'utf8'
    });

    if (result.error) {
      expect(result.error.message).toMatch(/docker/i);
      return;
    }

    expect(result.status, result.stderr).toBe(0);
  });

  it('parses local environment values without logging their contents', () => {
    expect(parseDotEnv('TOKEN="private-value"\n# comment\nPORT=5432')).toEqual({
      TOKEN: 'private-value',
      PORT: '5432'
    });
    expect(redactSecrets('postgresql://user:private-value@localhost/db', ['private-value'])).toContain(
      '[REDACTED]'
    );
    expect(redactSecrets('Authorization: Bearer super-secret-token')).not.toContain('super-secret-token');
  });

  it('protects persistent data from an unconfirmed reset', () => {
    expect(isResetEnvironmentAllowed('development')).toBe(true);
    expect(isResetEnvironmentAllowed('test')).toBe(true);
    expect(isResetEnvironmentAllowed('staging')).toBe(false);
    expect(isResetEnvironmentAllowed('production')).toBe(false);
  });

  it('retries dependency readiness with bounded attempts and reports timeout', async () => {
    let attempts = 0;
    await expect(
      retryWithBackoff(
        () => {
          attempts += 1;
          if (attempts < 3) throw new Error('dependency unavailable');
          return 'ready';
        },
        { attempts: 3, initialDelayMs: 0, maxDelayMs: 0 }
      )
    ).resolves.toBe('ready');
    expect(attempts).toBe(3);

    await expect(
      retryWithBackoff(() => {
        throw new Error('dependency unavailable');
      }, { attempts: 2, initialDelayMs: 0, maxDelayMs: 0 })
    ).rejects.toThrow(/readiness timed out/);
  });
});
