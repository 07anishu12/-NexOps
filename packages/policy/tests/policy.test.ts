import { describe, it, expect } from 'vitest';
import { defaultPolicyEngine, requiresHumanApproval } from '../src/index.js';

describe('Policy Package Tests', () => {
  it('correctly evaluates risk approval requirements', () => {
    expect(requiresHumanApproval('read', 'production')).toBe(false);
    expect(requiresHumanApproval('high_impact', 'production')).toBe(true);
    expect(requiresHumanApproval('external_side_effect', 'production')).toBe(true);
    expect(requiresHumanApproval('external_side_effect', 'development', true)).toBe(false);
  });

  it('rejects tools not in the allowedTools list', () => {
    const decision = defaultPolicyEngine.evaluateToolCall('gmail_send', 'external_side_effect', {
      workspaceId: 'w-1',
      agentId: 'a-1',
      callerType: 'user',
      allowedTools: ['calendar_create']
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('not enabled in this deployment allowlist');
  });

  it('blocks public widget from calling high_impact tools even if in allowlist', () => {
    const decision = defaultPolicyEngine.evaluateToolCall('database_drop', 'high_impact', {
      workspaceId: 'w-1',
      agentId: 'a-1',
      callerType: 'widget',
      allowedTools: ['database_drop']
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('Public widget sessions are strictly forbidden');
  });

  it('allows authorized tool call with human approval requirement', () => {
    const decision = defaultPolicyEngine.evaluateToolCall('gmail_send', 'external_side_effect', {
      workspaceId: 'w-1',
      agentId: 'a-1',
      callerType: 'user',
      allowedTools: ['gmail_send'],
      environment: 'production'
    });
    expect(decision.allowed).toBe(true);
    expect(decision.requiresApproval).toBe(true);
  });
});
