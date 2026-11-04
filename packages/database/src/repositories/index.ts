import type { DatabaseClient } from '../client.js';
import { WorkspaceRepository } from './workspaces.js';
import { AgentRepository } from './agents.js';
import { DeploymentRepository } from './deployments.js';
import { ConversationRepository } from './conversations.js';
import { RunRepository } from './runs.js';
import { ApprovalRepository } from './approvals.js';
import { IntegrationRepository } from './integrations.js';
import { BillingRepository } from './billing.js';
import { PaymentRepository } from './payments.js';
import { KnowledgeRepository } from './knowledge.js';
import { WebhookRepository } from './webhooks.js';
import { FdeRepository } from './fde.js';
import { AuditRepository } from './audit.js';
import { ToolRepository } from './tools.js';

export * from './base.js';
export * from './workspaces.js';
export * from './agents.js';
export * from './deployments.js';
export * from './conversations.js';
export * from './runs.js';
export * from './approvals.js';
export * from './integrations.js';
export * from './billing.js';
export * from './payments.js';
export * from './knowledge.js';
export * from './webhooks.js';
export * from './fde.js';
export * from './audit.js';
export * from './tools.js';

export interface Repositories {
  workspaces: WorkspaceRepository;
  agents: AgentRepository;
  deployments: DeploymentRepository;
  conversations: ConversationRepository;
  runs: RunRepository;
  approvals: ApprovalRepository;
  integrations: IntegrationRepository;
  billing: BillingRepository;
  payments: PaymentRepository;
  knowledge: KnowledgeRepository;
  webhooks: WebhookRepository;
  fde: FdeRepository;
  audit: AuditRepository;
  tools: ToolRepository;
}

export function createRepositories(client: DatabaseClient): Repositories {
  return {
    workspaces: new WorkspaceRepository(client),
    agents: new AgentRepository(client),
    deployments: new DeploymentRepository(client),
    conversations: new ConversationRepository(client),
    runs: new RunRepository(client),
    approvals: new ApprovalRepository(client),
    integrations: new IntegrationRepository(client),
    billing: new BillingRepository(client),
    payments: new PaymentRepository(client),
    knowledge: new KnowledgeRepository(client),
    webhooks: new WebhookRepository(client),
    fde: new FdeRepository(client),
    audit: new AuditRepository(client),
    tools: new ToolRepository(client)
  };
}
