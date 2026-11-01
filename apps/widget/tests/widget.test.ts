import { describe, it, expect } from 'vitest';
import { AgentFlowWidget } from '../src/index.js';

describe('Widget App Tests', () => {
  it('initializes session with unique session ID and deployment ID', () => {
    const widget = new AgentFlowWidget({
      deploymentId: 'dep-999',
      title: 'Support Bot'
    });

    const session = widget.initSession();
    expect(session.deploymentId).toBe('dep-999');
    expect(session.sessionId.startsWith('ws_')).toBe(true);
    expect(widget.getSession()?.sessionId).toBe(session.sessionId);
  });

  it('rejects widget initialization without deploymentId', () => {
    expect(() => new AgentFlowWidget({ deploymentId: '' })).toThrow(
      'AgentFlowWidget requires a valid deploymentId'
    );
  });

  it('renders widget HTML structure into target container', () => {
    const widget = new AgentFlowWidget({
      deploymentId: 'dep-999',
      title: 'Customer Assistant'
    });
    const mockContainer = { innerHTML: '' };
    widget.renderToDom(mockContainer);

    expect(mockContainer.innerHTML).toContain('agentflow-widget-root');
    expect(mockContainer.innerHTML).toContain('Customer Assistant');
  });
});
