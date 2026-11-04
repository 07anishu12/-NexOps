import { describe, it, expect } from 'vitest';
import { loadBrowserConfig, loadConfig, loadServerConfig, EnvSchema } from '../src/index.js';

describe('Config Package Tests', () => {
  it('loads valid default development configuration', () => {
    const config = loadConfig({});
    expect(config.NODE_ENV).toBe('development');
    expect(config.APP_URL).toBe('http://localhost:3000');
    expect(config.WORKER_CONCURRENCY).toBe(5);
    expect(config.DEFAULT_RUN_TIMEOUT_SECONDS).toBe(120);
  });

  it('coerces numeric environment variables correctly', () => {
    const config = loadConfig({
      WORKER_CONCURRENCY: '10',
      DEFAULT_RUN_TIMEOUT_SECONDS: '300',
      PUBLIC_WIDGET_SESSION_TTL_SECONDS: '7200'
    });
    expect(config.WORKER_CONCURRENCY).toBe(10);
    expect(config.DEFAULT_RUN_TIMEOUT_SECONDS).toBe(300);
    expect(config.PUBLIC_WIDGET_SESSION_TTL_SECONDS).toBe(7200);
  });

  it('rejects invalid NODE_ENV values', () => {
    expect(() => {
      loadConfig({
        NODE_ENV: 'invalid_env' as any
      });
    }).toThrow(/Environment configuration validation failed/);
  });

  it('rejects SESSION_SECRET shorter than 32 characters', () => {
    expect(() => {
      loadConfig({
        SESSION_SECRET: 'short-secret'
      });
    }).toThrow(/SESSION_SECRET must be at least 32 characters/);
  });

  it('correctly validates model provider enum', () => {
    const parsed = EnvSchema.safeParse({
      DEFAULT_MODEL_PROVIDER: 'gemini'
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.DEFAULT_MODEL_PROVIDER).toBe('gemini');
    }
  });

  it('rejects missing server variables when strict startup validation is requested', () => {
    expect(() => loadServerConfig({ NODE_ENV: 'development' })).toThrow(
      /POSTGRES_PASSWORD.*Required server environment variable is missing/
    );
  });

  it('rejects malformed database and Redis connection URLs', () => {
    expect(() => loadConfig({ DATABASE_URL: 'not-a-database-url' })).toThrow(/DATABASE_URL/);
    expect(() => loadConfig({ REDIS_URL: 'https://localhost:6379' })).toThrow(/REDIS_URL/);
  });

  it('rejects malformed object-storage credentials without exposing their values', () => {
    const secret = 'visible-only-in-test-input';
    let error = '';
    try {
      loadConfig({ OBJECT_STORAGE_SECRET_KEY: 'short', SESSION_SECRET: secret });
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }

    expect(error).toMatch(/OBJECT_STORAGE_SECRET_KEY/);
    expect(error).not.toContain(secret);
  });

  it('exposes only non-secret values through browser configuration', () => {
    const browserConfig = loadBrowserConfig({
      APP_URL: 'http://localhost:3000',
      API_BASE_URL: 'http://localhost:4000',
      WIDGET_CDN_URL: 'http://localhost:3002'
    });

    expect(browserConfig).toEqual({
      NODE_ENV: 'development',
      APP_URL: 'http://localhost:3000',
      API_BASE_URL: 'http://localhost:4000',
      WIDGET_CDN_URL: 'http://localhost:3002'
    });
    expect(browserConfig).not.toHaveProperty('SESSION_SECRET');
    expect(browserConfig).not.toHaveProperty('DATABASE_URL');
  });
});
