import { describe, it, expect } from 'vitest';
import {
  UserSchema,
  WorkspaceSchema,
  AgentConfigSchema,
  RunSchema,
  ApprovalRequestSchema,
  ToolDefinitionSchema,
  CreditLedgerEntrySchema,
  EventEnvelopeSchema
} from '../src/index.js';

describe('Contracts Package Tests', () => {
  it('validates a correct User entity', () => {
    const validUser = {
      id: '11111111-1111-4111-a111-111111111111',
      email: 'engineer@agentflow.io',
      name: 'AgentFlow Engineer',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const parsed = UserSchema.parse(validUser);
    expect(parsed.email).toBe('engineer@agentflow.io');
  });

  it('rejects invalid email in User entity', () => {
    const invalidUser = {
      id: '11111111-1111-4111-a111-111111111111',
      email: 'not-an-email',
      name: 'Bad Email',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    expect(() => UserSchema.parse(invalidUser)).toThrow();
  });

  it('validates Workspace with slug format', () => {
    const validWorkspace = {
      id: '22222222-2222-4222-a222-222222222222',
      name: 'Acme Corp',
      slug: 'acme-corp',
      ownerId: '11111111-1111-4111-a111-111111111111',
      plan: 'pro' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    expect(WorkspaceSchema.parse(validWorkspace).slug).toBe('acme-corp');

    const invalidSlug = { ...validWorkspace, slug: 'Acme Corp With Spaces' };
    expect(() => WorkspaceSchema.parse(invalidSlug)).toThrow();
  });

  it('validates Agent configuration and default options', () => {
    const config = {
      name: 'Customer Support Agent',
      systemPrompt: 'You are a helpful customer support agent.',
      allowedTools: ['gmail_send', 'calendar_create']
    };
    const parsed = AgentConfigSchema.parse(config);
    expect(parsed.provider).toBe('openai');
    expect(parsed.model).toBe('gpt-4o');
    expect(parsed.temperature).toBe(0.7);
    expect(parsed.allowedTools).toHaveLength(2);
  });

  it('validates ApprovalRequest schema and hash constraints', () => {
    const approval = {
      id: '33333333-3333-4333-a333-333333333333',
      workspaceId: '22222222-2222-4222-a222-222222222222',
      runId: '44444444-4444-4444-a444-444444444444',
      toolName: 'gmail_send',
      riskLevel: 'external_side_effect' as const,
      payload: { to: 'customer@example.com', subject: 'Follow up' },
      payloadHash: 'a'.repeat(64),
      status: 'pending' as const,
      requestedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    };
    expect(ApprovalRequestSchema.parse(approval).riskLevel).toBe('external_side_effect');
  });

  it('rejects an invalid 32-character hash where 64-char SHA256 is required', () => {
    const badHashApproval = {
      id: '33333333-3333-4333-a333-333333333333',
      workspaceId: '22222222-2222-4222-a222-222222222222',
      runId: '44444444-4444-4444-a444-444444444444',
      toolName: 'gmail_send',
      riskLevel: 'external_side_effect' as const,
      payload: { to: 'customer@example.com' },
      payloadHash: 'short-md5-hash',
      requestedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    };
    expect(() => ApprovalRequestSchema.parse(badHashApproval)).toThrow();
  });
});
