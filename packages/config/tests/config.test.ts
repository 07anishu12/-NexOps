import { describe, it, expect } from 'vitest';
import { loadConfig, EnvSchema } from '../src/index.js';

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
});
