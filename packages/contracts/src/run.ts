import { z } from 'zod';
import { IdSchema, TimestampSchema } from './common.js';

export const RunStateSchema = z.enum([
  'queued',
  'initializing',
  'running',
  'waiting_for_approval',
  'succeeded',
  'failed',
  'cancelled',
  'expired',
  'blocked',
  'reconciliation_required',
  'dead_lettered'
]);
export type RunState = z.infer<typeof RunStateSchema>;

export const RunStepTypeSchema = z.enum([
  'input',
  'context_resolution',
  'model_call',
  'tool_call',
  'approval_request',
  'output',
  'error'
]);
export type RunStepType = z.infer<typeof RunStepTypeSchema>;

export const RunStepSchema = z.object({
  id: IdSchema,
  runId: IdSchema,
  sequence: z.number().int().nonnegative(),
  type: RunStepTypeSchema,
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  error: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  createdAt: TimestampSchema
});
export type RunStep = z.infer<typeof RunStepSchema>;

export const RunSchema = z.object({
  id: IdSchema,
  workspaceId: IdSchema,
  agentId: IdSchema,
  agentVersionId: IdSchema,
  deploymentId: IdSchema.optional(),
  state: RunStateSchema,
  initiatorType: z.enum(['user', 'api_key', 'widget', 'webhook', 'scheduler']),
  initiatorId: z.string(),
  inputPrompt: z.string(),
  outputSummary: z.string().optional(),
  errorMessage: z.string().optional(),
  totalTokens: z.number().int().nonnegative().default(0),
  totalDurationMs: z.number().int().nonnegative().default(0),
  checkpointId: z.string().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema
});
export type Run = z.infer<typeof RunSchema>;

export const ToolRiskSchema = z.enum(['read', 'write', 'external_side_effect', 'high_impact']);
export type ToolRisk = z.infer<typeof ToolRiskSchema>;

export const ApprovalStatusSchema = z.enum(['pending', 'approved', 'rejected', 'expired']);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const ApprovalRequestSchema = z.object({
  id: IdSchema,
  workspaceId: IdSchema,
  runId: IdSchema,
  toolName: z.string().min(1),
  riskLevel: ToolRiskSchema,
  payload: z.record(z.unknown()),
  payloadHash: z.string().length(64, 'SHA-256 payload hash must be 64 characters hex'),
  status: ApprovalStatusSchema.default('pending'),
  requestedAt: TimestampSchema,
  expiresAt: TimestampSchema,
  resolvedAt: TimestampSchema.optional(),
  resolvedBy: IdSchema.optional(),
  rejectionReason: z.string().optional()
});
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;
