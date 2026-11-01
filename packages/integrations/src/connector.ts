import { ToolRisk } from '@agentflow/contracts';

export interface ToolExecutionContext {
  workspaceId: string;
  runId: string;
  operationId: string;
  connectionId?: string;
  timeoutMs?: number;
}

export interface ConnectionHealth {
  healthy: boolean;
  status: 'connected' | 'disconnected' | 'expired' | 'rate_limited';
  latencyMs?: number;
  message?: string;
}

export interface IntegrationConnector<TInput = unknown, TOutput = unknown> {
  readonly id: string;
  readonly provider: string;
  readonly name: string;
  readonly risk: ToolRisk;

  validate(input: TInput, context: ToolExecutionContext): Promise<void>;
  execute(input: TInput, context: ToolExecutionContext): Promise<TOutput>;
  healthCheck(context: ToolExecutionContext): Promise<ConnectionHealth>;
}
