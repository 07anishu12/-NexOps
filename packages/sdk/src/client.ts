import { ApiResponseEnvelope, Run } from '@agentflow/contracts';

export interface AgentFlowClientOptions {
  apiKey?: string;
  baseUrl?: string;
  workspaceId?: string;
}

export interface CreateRunRequest {
  agentId: string;
  inputPrompt: string;
  deploymentId?: string;
}

export class AgentFlowClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly workspaceId?: string;

  constructor(options: AgentFlowClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? 'http://localhost:4000';
    this.apiKey = options.apiKey;
    this.workspaceId = options.workspaceId;
  }

  getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    if (this.workspaceId) {
      headers['X-Workspace-Id'] = this.workspaceId;
    }
    return headers;
  }

  async createRun(request: CreateRunRequest): Promise<ApiResponseEnvelope<Run>> {
    const url = `${this.baseUrl}/api/v1/runs`;
    // For local mock verification when network is not running
    if (typeof fetch === 'undefined') {
      throw new Error('fetch is not available in runtime environment');
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request)
      });
      return (await response.json()) as ApiResponseEnvelope<Run>;
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: err instanceof Error ? err.message : 'Unknown network error'
        }
      };
    }
  }
}
