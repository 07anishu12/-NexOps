import { ToolRisk } from '@agentflow/contracts';
import { requiresHumanApproval } from './risk.js';

export interface PolicyEvaluationContext {
  workspaceId: string;
  agentId: string;
  deploymentId?: string;
  environment?: 'development' | 'staging' | 'production';
  callerType: 'user' | 'api_key' | 'widget' | 'scheduler';
  allowedTools: string[];
}

export interface PolicyDecision {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
}

export class PolicyEngine {
  evaluateToolCall(
    toolName: string,
    toolRisk: ToolRisk,
    context: PolicyEvaluationContext
  ): PolicyDecision {
    // Rule 1: Tool must be explicitly in the agent / deployment allowlist
    if (!context.allowedTools.includes(toolName)) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: `Tool '${toolName}' is not enabled in this deployment allowlist`
      };
    }

    // Rule 2: Public widget callers can never invoke high_impact tools
    if (context.callerType === 'widget' && toolRisk === 'high_impact') {
      return {
        allowed: false,
        requiresApproval: false,
        reason: `Public widget sessions are strictly forbidden from calling high-impact tool '${toolName}'`
      };
    }

    // Rule 3: Check human approval requirement
    const needsApproval = requiresHumanApproval(
      toolRisk,
      context.environment ?? 'production'
    );

    return {
      allowed: true,
      requiresApproval: needsApproval
    };
  }
}

export const defaultPolicyEngine = new PolicyEngine();
