export interface DocSection {
  id: string;
  title: string;
  path: string;
  summary: string;
}

export const DOCUMENTATION_INDEX: DocSection[] = [
  {
    id: 'overview',
    title: 'Platform Overview',
    path: '/docs/overview',
    summary: 'Introduction to AgentFlow OS architecture, tenancy, and agent execution models.'
  },
  {
    id: 'api-v1',
    title: 'REST API Reference',
    path: '/docs/api/v1',
    summary: 'Public REST API v1 endpoints for agents, runs, deployments, and approvals.'
  },
  {
    id: 'sdk-node',
    title: 'Node.js SDK Guide',
    path: '/docs/sdk/node',
    summary: 'Installing and integrating the AgentFlow Node.js SDK into backend systems.'
  },
  {
    id: 'widget-embed',
    title: 'Website Widget Integration',
    path: '/docs/widget/embed',
    summary: 'Embedding the public website chat widget, configuring themes, and origin security.'
  },
  {
    id: 'fde-playbook',
    title: 'FDE Customer Playbook',
    path: '/docs/fde/playbook',
    summary: 'Forward deployed engineering checklists for customer onboarding and readiness validation.'
  }
];

export function getDocSection(id: string): DocSection | undefined {
  return DOCUMENTATION_INDEX.find((doc) => doc.id === id);
}
