import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  API_BASE_URL: z.string().url().default('http://localhost:4000'),
  WIDGET_CDN_URL: z.string().url().default('http://localhost:3002'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters').default(
    'dev-insecure-session-secret-change-in-production-min-32-chars'
  ),
  ENCRYPTION_KEY_REFERENCE: z.string().min(32).default(
    'dev-encryption-key-00000000000000000000000000000000'
  ),
  DATABASE_URL: z.string().min(1).default('postgresql://agentflow:agentflow_secret@localhost:5432/agentflow_dev'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  // Object Storage
  OBJECT_STORAGE_ENDPOINT: z.string().url().default('http://localhost:9000'),
  OBJECT_STORAGE_BUCKET: z.string().default('agentflow-assets'),
  OBJECT_STORAGE_ACCESS_KEY: z.string().default('minioadmin'),
  OBJECT_STORAGE_SECRET_KEY: z.string().default('minioadmin'),

  // OAuth
  GOOGLE_OAUTH_CLIENT_ID: z.string().default('mock-google-client-id'),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().default('mock-google-client-secret'),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().default('http://localhost:3000/api/auth/callback/google'),
  OAUTH_STATE_SIGNING_KEY_REFERENCE: z.string().min(16).default('dev-oauth-state-signing-key-min-32-chars'),

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

export function loadConfig(customEnv?: Record<string, string | undefined>): EnvConfig {
  const envSource = customEnv ?? (typeof process !== 'undefined' ? process.env : {});
  const result = EnvSchema.safeParse(envSource);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Environment configuration validation failed:\n${errorDetails}`);
  }

  return result.data;
}
