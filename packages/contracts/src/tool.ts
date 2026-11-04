import { z } from 'zod';
import { IdSchema, TimestampSchema } from './common.js';
import { ToolRiskSchema } from './run.js';

export const ToolDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  risk: ToolRiskSchema,
  category: z.enum(['productivity', 'social', 'communication', 'system', 'custom']),
  inputSchema: z.record(z.unknown()),
  outputSchema: z.record(z.unknown()),
  requiresApproval: z.boolean().default(false),
  enabledByDefault: z.boolean().default(false)
});
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

export const ToolCallRequestSchema = z.object({
  callId: z.string().min(1),
  toolName: z.string().min(1),
  arguments: z.record(z.unknown()),
  operationId: z.string().min(1)
});
export type ToolCallRequest = z.infer<typeof ToolCallRequestSchema>;

export const CreditTransactionTypeSchema = z.enum([
  'grant',
  'purchase',
  'hold',
  'consume',
  'release',
  'refund',
  'adjustment'
]);
export type CreditTransactionType = z.infer<typeof CreditTransactionTypeSchema>;

export const CreditLedgerEntrySchema = z.object({
  id: IdSchema,
  workspaceId: IdSchema,
  type: CreditTransactionTypeSchema,
  amount: z.number().int(),
  balanceAfter: z.number().int(),
  referenceType: z.enum(['run', 'invoice', 'manual', 'subscription']),
  referenceId: z.string(),
  description: z.string(),
  createdAt: TimestampSchema
});
export type CreditLedgerEntry = z.infer<typeof CreditLedgerEntrySchema>;
