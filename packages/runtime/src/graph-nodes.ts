export type GraphNodeName =
  | 'receive_input'
  | 'resolve_context'
  | 'plan'
  | 'evaluate_policy'
  | 'execute_tool'
  | 'await_approval'
  | 'synthesize_response';

export interface GraphState {
  runId: string;
  workspaceId: string;
  agentId: string;
  inputPrompt: string;
  contextData?: Record<string, unknown>;
  plannedSteps: string[];
  pendingToolCall?: {
    toolName: string;
    payload: Record<string, unknown>;
    approvalId?: string;
  };
  outputTokens: number;
  finalResponse?: string;
  error?: string;
}

export interface GraphNode {
  name: GraphNodeName;
  execute(state: GraphState): Promise<Partial<GraphState>>;
}
