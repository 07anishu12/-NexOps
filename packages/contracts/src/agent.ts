import { z } from 'zod';
import { IdSchema, TimestampSchema } from './common.js';

export const ModelProviderSchema = z.enum(['openai', 'anthropic', 'gemini', 'groq', 'mock']);
export type ModelProvider = z.infer<typeof ModelProviderSchema>;

export const AgentConfigSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).default(''),
  systemPrompt: z.string().min(1, 'System prompt cannot be empty'),
  provider: ModelProviderSchema.default('openai'),
  model: z.string().min(1).default('gpt-4o'),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(1).max(32000).default(2048),
  allowedTools: z.array(z.string()).default([]),
  environmentVariables: z.record(z.string()).default({})
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export const AgentSchema = z.object({
  id: IdSchema,
  workspaceId: IdSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  activeVersionId: IdSchema.optional(),
  currentDraft: AgentConfigSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema
});

export type Agent = z.infer<typeof AgentSchema>;

export const AgentVersionSchema = z.object({
  id: IdSchema,
  agentId: IdSchema,
  workspaceId: IdSchema,
  versionNumber: z.number().int().positive(),
  configSnapshot: AgentConfigSchema,
  snapshotHash: z.string().length(64, 'SHA-256 hash must be 64 characters hex'),
  publishedBy: IdSchema,
  publishedAt: TimestampSchema
});

export type AgentVersion = z.infer<typeof AgentVersionSchema>;

export const DeploymentEnvironmentSchema = z.enum(['development', 'staging', 'production']);
export type DeploymentEnvironment = z.infer<typeof DeploymentEnvironmentSchema>;

export const DeploymentSchema = z.object({
  id: IdSchema,
  workspaceId: IdSchema,
  agentId: IdSchema,
  agentVersionId: IdSchema,
  environment: DeploymentEnvironmentSchema,
  name: z.string().min(1).max(100),
  allowedOrigins: z.array(z.string()).default([]),
  enabledTools: z.array(z.string()).default([]),
  rateLimitPerMinute: z.number().int().positive().default(60),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema
});

export type Deployment = z.infer<typeof DeploymentSchema>;
