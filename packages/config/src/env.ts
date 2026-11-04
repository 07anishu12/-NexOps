import { z } from 'zod';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const NodeEnvironmentSchema = z.enum(['development', 'test', 'staging', 'production']);
const UrlSchema = z.string().url('Must be a valid URL');
const DatabaseUrlSchema = UrlSchema.refine(
  (value) => value.startsWith('postgres://') || value.startsWith('postgresql://'),
  'DATABASE_URL must use the postgres:// or postgresql:// scheme'
);
const RedisUrlSchema = UrlSchema.refine(
  (value) => value.startsWith('redis://') || value.startsWith('rediss://'),
  'REDIS_URL must use the redis:// or rediss:// scheme'
);
const BucketNameSchema = z
  .string()
  .min(3)
  .max(63)
  .regex(/^[a-z0-9][a-z0-9.-]+[a-z0-9]$/, 'Bucket name must be S3-compatible');

export const EnvSchema = z.object({
  NODE_ENV: NodeEnvironmentSchema.default('development'),
  APP_URL: UrlSchema.default('http://localhost:3000'),
  API_BASE_URL: UrlSchema.default('http://localhost:4000'),
  WIDGET_CDN_URL: UrlSchema.default('http://localhost:3002'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters').default(
    'dev-insecure-session-secret-change-in-production-min-32-chars'
  ),
  ENCRYPTION_KEY_REFERENCE: z.string().min(32).default(
    'dev-encryption-key-00000000000000000000000000000000'
  ),
  POSTGRES_DB: z.string().min(1).default('agentflow_dev'),
  POSTGRES_USER: z.string().min(1).default('agentflow'),
  POSTGRES_PASSWORD: z.string().min(8).default('agentflow_secret'),
  DATABASE_URL: DatabaseUrlSchema.default('postgresql://agentflow:agentflow_secret@localhost:5432/agentflow_dev'),
  REDIS_URL: RedisUrlSchema.default('redis://localhost:6379/0'),

  // Object Storage
  OBJECT_STORAGE_ENDPOINT: UrlSchema.default('http://localhost:9000'),
  OBJECT_STORAGE_BUCKET: BucketNameSchema.default('agentflow-assets'),
  OBJECT_STORAGE_ACCESS_KEY: z.string().min(3).default('agentflowlocal'),
  OBJECT_STORAGE_SECRET_KEY: z.string().min(8).default('agentflowlocal-secret'),

  // OAuth & Session
  GOOGLE_OAUTH_CLIENT_ID: z.string().default('mock-google-client-id'),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().default('mock-google-client-secret'),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().default('http://localhost:4000/v1/auth/google/callback'),
  OAUTH_STATE_SIGNING_KEY_REFERENCE: z.string().min(16).default('dev-oauth-state-signing-key-min-32-chars'),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
  SESSION_COOKIE_NAME: z.string().default('af_session'),
  SESSION_COOKIE_DOMAIN: z.string().optional(),
  AUTH_ALLOWED_REDIRECT_ORIGINS: z.string().default('http://localhost:3000'),

  // Models
  DEFAULT_MODEL_PROVIDER: z.enum(['openai', 'anthropic', 'gemini', 'groq', 'mock']).default('openai'),
  MODEL_PROVIDER_KEY_REFERENCE: z.string().default('sk-mock-key-for-local-testing'),

  // Meta / Instagram
  META_APP_ID: z.string().default('mock-meta-app-id'),
  META_APP_SECRET: z.string().default('mock-meta-app-secret'),
  META_OAUTH_REDIRECT_URI: z.string().default('http://localhost:3000/api/integrations/instagram/callback'),
  META_WEBHOOK_VERIFY_TOKEN: z.string().default('mock-meta-verify-token'),
  META_API_VERSION: z.string().default('v19.0'),

  // Razorpay
  RAZORPAY_KEY_ID: z.string().default('rzp_test_mockkeyid123'),
  RAZORPAY_KEY_SECRET: z.string().default('rzp_test_mocksecret123'),
  RAZORPAY_WEBHOOK_SECRET_REFERENCE: z.string().default('mock_razorpay_webhook_secret'),

  // Queue / Worker
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  RUN_QUEUE_NAME: z.string().default('agentflow-run-queue'),
  WEBHOOK_QUEUE_NAME: z.string().default('agentflow-webhook-queue'),
  SCHEDULER_QUEUE_NAME: z.string().default('agentflow-scheduler-queue'),
  JOB_LOCK_DURATION_MS: z.coerce.number().int().positive().default(30000),

  // Observability
  OTEL_SERVICE_NAME: z.string().default('agentflow-monorepo'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default('http://localhost:4318'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Limits
  PUBLIC_WIDGET_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  DEFAULT_RUN_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(120),
  MAX_ATTACHMENT_BYTES: z.coerce.number().int().positive().default(10485760),
  DEFAULT_PUBLIC_RATE_LIMIT: z.coerce.number().int().positive().default(60),
  ALLOWED_UPLOAD_MIME_TYPES: z.string().default(
    'image/jpeg,image/png,image/webp,application/pdf,text/plain,text/csv'
  )
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export const BrowserEnvSchema = EnvSchema.pick({
  NODE_ENV: true,
  APP_URL: true,
  API_BASE_URL: true,
  WIDGET_CDN_URL: true
});

export type BrowserEnvConfig = z.infer<typeof BrowserEnvSchema>;

const REQUIRED_SERVER_VARIABLES = [
  'APP_URL',
  'API_BASE_URL',
  'WIDGET_CDN_URL',
  'SESSION_SECRET',
  'ENCRYPTION_KEY_REFERENCE',
  'POSTGRES_DB',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'DATABASE_URL',
  'REDIS_URL',
  'OBJECT_STORAGE_ENDPOINT',
  'OBJECT_STORAGE_BUCKET',
  'OBJECT_STORAGE_ACCESS_KEY',
  'OBJECT_STORAGE_SECRET_KEY'
] as const;

export interface LoadConfigOptions {
  /** Require infrastructure and security variables instead of local defaults. */
  requireInfrastructure?: boolean;
}

function formatValidationError(issues: z.ZodIssue[]): Error {
  const errorDetails = issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  return new Error(`Environment configuration validation failed:\n${errorDetails}`);
}

function readEnvironmentFile(): Record<string, string> {
  if (typeof process === 'undefined') return {};

  let directory = process.cwd();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const filePath = join(directory, '.env');
    if (existsSync(filePath)) {
      const values: Record<string, string> = {};
      for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const separator = trimmed.indexOf('=');
        if (separator < 1) continue;
        const key = trimmed.slice(0, separator).trim();
        const value = trimmed.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
        values[key] = value;
      }
      return values;
    }

    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return {};
}

export function loadConfig(
  customEnv?: Record<string, string | undefined>,
  options: LoadConfigOptions = {}
): EnvConfig {
  const envSource = customEnv ?? {
    ...readEnvironmentFile(),
    ...(typeof process !== 'undefined' ? process.env : {})
  };
  const result = EnvSchema.safeParse(envSource);

  if (!result.success) {
    throw formatValidationError(result.error.issues);
  }

  const nodeEnv = envSource.NODE_ENV ?? result.data.NODE_ENV;
  const requireInfrastructure =
    options.requireInfrastructure === true || nodeEnv === 'staging' || nodeEnv === 'production';

  if (requireInfrastructure) {
    const missingVariables = REQUIRED_SERVER_VARIABLES.filter((key) => !envSource[key]?.trim());
    if (missingVariables.length > 0) {
      throw formatValidationError(
        missingVariables.map((path) => ({
          code: 'custom',
          path: [path],
          message: 'Required server environment variable is missing'
        }))
      );
    }
  }

  return result.data;
}

export function loadServerConfig(
  customEnv?: Record<string, string | undefined>,
  options: LoadConfigOptions = {}
): EnvConfig {
  return loadConfig(customEnv, { ...options, requireInfrastructure: true });
}

export function loadApplicationConfig(
  customEnv?: Record<string, string | undefined>
): EnvConfig {
  const environment = customEnv?.NODE_ENV ?? process.env.NODE_ENV ?? 'development';
  return loadConfig(customEnv, { requireInfrastructure: environment !== 'test' });
}

export function loadBrowserConfig(
  customEnv?: Record<string, string | undefined>
): BrowserEnvConfig {
  const result = BrowserEnvSchema.safeParse(customEnv ?? (typeof process !== 'undefined' ? process.env : {}));
  if (!result.success) {
    throw formatValidationError(result.error.issues);
  }
  return result.data;
}
