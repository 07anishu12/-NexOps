export interface WidgetConfig {
  deploymentId: string;
  apiBaseUrl?: string;
  theme?: 'dark' | 'light';
  title?: string;
  initialMessage?: string;
}

export interface WidgetSession {
  sessionId: string;
  deploymentId: string;
  createdAt: number;
}

export class AgentFlowWidget {
  private session?: WidgetSession;

  constructor(private readonly config: WidgetConfig) {
    if (!config.deploymentId) {
      throw new Error('AgentFlowWidget requires a valid deploymentId');
    }
  }

  initSession(): WidgetSession {
    this.session = {
      sessionId: `ws_${Math.random().toString(36).substring(2, 12)}`,
      deploymentId: this.config.deploymentId,
      createdAt: Date.now()
    };
    return this.session;
  }

  getSession(): WidgetSession | undefined {
    return this.session;
  }

  renderToDom(container: { innerHTML: string }): void {
    container.innerHTML = `
      <div id="agentflow-widget-root" data-theme="${this.config.theme ?? 'dark'}">
        <div class="agentflow-widget-bubble">
          <span>${this.config.title ?? 'Chat with AI'}</span>
        </div>
      </div>
    `;
  }
}
