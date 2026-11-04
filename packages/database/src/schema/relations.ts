import { relations } from 'drizzle-orm';
import { users, workspaces, oauthAccounts, sessions, workspaceMembers, workspaceInvitations } from './identity.js';
import { agents, agentVersions, agentEvaluationSuites, agentEvaluationCases, agentEvaluationResults } from './agents.js';
import { toolDefinitions, agentVersionTools } from './tools.js';
import { integrationConnections, encryptedCredentials } from './integrations.js';
import { deployments, deploymentOrigins, deploymentReleases } from './deployments.js';
import { apiKeys, widgetSessions } from './access.js';
import { conversations, messages, runs, runSteps, runEvents, toolOperations } from './runtime.js';
import { approvals, approvalEvents } from './approvals.js';
import { workflows, workflowVersions, workflowTriggers, workflowRuns } from './workflows.js';
import { knowledgeSources, knowledgeChunks } from './knowledge.js';
import { creditAccounts, creditLedgerEntries, creditReservations, usageEvents } from './billing.js';
import { paymentOrders, paymentEvents } from './payments.js';
import { webhookEndpoints, webhookDeliveries } from './webhooks.js';
import { auditEvents, notifications } from './audit.js';
import { fdeImplementationRecords, deploymentReadinessReports, deploymentReadinessChecks, supportAccessGrants } from './fde.js';

export const usersRelations = relations(users, ({ many }) => ({
  oauthAccounts: many(oauthAccounts),
  sessions: many(sessions),
  memberships: many(workspaceMembers),
  ownedWorkspaces: many(workspaces),
  createdAgents: many(agents),
  createdDeployments: many(deployments),
  publishedReleases: many(deploymentReleases),
  createdWorkflows: many(workflows),
  createdPaymentOrders: many(paymentOrders),
  notifications: many(notifications)
}));

export const oauthAccountsRelations = relations(oauthAccounts, ({ one }) => ({
  user: one(users, { fields: [oauthAccounts.userId], references: [users.id] })
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
  workspace: one(workspaces, { fields: [sessions.workspaceId], references: [workspaces.id] })
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, { fields: [workspaces.ownerId], references: [users.id] }),
  members: many(workspaceMembers),
  invitations: many(workspaceInvitations),
  agents: many(agents),
  agentVersions: many(agentVersions),
  integrationConnections: many(integrationConnections),
  deployments: many(deployments),
  apiKeys: many(apiKeys),
  widgetSessions: many(widgetSessions),
  conversations: many(conversations),
  runs: many(runs),
  approvals: many(approvals),
  workflows: many(workflows),
  knowledgeSources: many(knowledgeSources),
  creditAccounts: many(creditAccounts),
  paymentOrders: many(paymentOrders),
  webhookEndpoints: many(webhookEndpoints),
  auditEvents: many(auditEvents),
  notifications: many(notifications),
  fdeRecords: many(fdeImplementationRecords),
  supportAccessGrants: many(supportAccessGrants)
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, { fields: [workspaceMembers.workspaceId], references: [workspaces.id] }),
  user: one(users, { fields: [workspaceMembers.userId], references: [users.id] })
}));

export const workspaceInvitationsRelations = relations(workspaceInvitations, ({ one }) => ({
  workspace: one(workspaces, { fields: [workspaceInvitations.workspaceId], references: [workspaces.id] }),
  inviter: one(users, { fields: [workspaceInvitations.invitedBy], references: [users.id] }),
  acceptor: one(users, { fields: [workspaceInvitations.acceptedBy], references: [users.id] })
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [agents.workspaceId], references: [workspaces.id] }),
  creator: one(users, { fields: [agents.createdBy], references: [users.id] }),
  versions: many(agentVersions),
  evaluationSuites: many(agentEvaluationSuites),
  deployments: many(deployments),
  conversations: many(conversations),
  runs: many(runs),
  knowledgeSources: many(knowledgeSources)
}));

export const agentVersionsRelations = relations(agentVersions, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [agentVersions.workspaceId], references: [workspaces.id] }),
  agent: one(agents, { fields: [agentVersions.agentId], references: [agents.id] }),
  publisher: one(users, { fields: [agentVersions.publishedBy], references: [users.id] }),
  tools: many(agentVersionTools),
  deployments: many(deployments),
  releases: many(deploymentReleases),
  evaluationResults: many(agentEvaluationResults),
  runs: many(runs)
}));

export const agentEvaluationSuitesRelations = relations(agentEvaluationSuites, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [agentEvaluationSuites.workspaceId], references: [workspaces.id] }),
  agent: one(agents, { fields: [agentEvaluationSuites.agentId], references: [agents.id] }),
  creator: one(users, { fields: [agentEvaluationSuites.createdBy], references: [users.id] }),
  cases: many(agentEvaluationCases),
  results: many(agentEvaluationResults)
}));

export const agentEvaluationCasesRelations = relations(agentEvaluationCases, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [agentEvaluationCases.workspaceId], references: [workspaces.id] }),
  suite: one(agentEvaluationSuites, { fields: [agentEvaluationCases.suiteId], references: [agentEvaluationSuites.id] }),
  results: many(agentEvaluationResults)
}));

export const agentEvaluationResultsRelations = relations(agentEvaluationResults, ({ one }) => ({
  workspace: one(workspaces, { fields: [agentEvaluationResults.workspaceId], references: [workspaces.id] }),
  suite: one(agentEvaluationSuites, { fields: [agentEvaluationResults.suiteId], references: [agentEvaluationSuites.id] }),
  agentVersion: one(agentVersions, { fields: [agentEvaluationResults.agentVersionId], references: [agentVersions.id] }),
  case: one(agentEvaluationCases, { fields: [agentEvaluationResults.caseId], references: [agentEvaluationCases.id] })
}));

export const toolDefinitionsRelations = relations(toolDefinitions, ({ one, many }) => ({
  creator: one(users, { fields: [toolDefinitions.createdBy], references: [users.id] }),
  agentVersionTools: many(agentVersionTools)
}));

export const agentVersionToolsRelations = relations(agentVersionTools, ({ one }) => ({
  workspace: one(workspaces, { fields: [agentVersionTools.workspaceId], references: [workspaces.id] }),
  agentVersion: one(agentVersions, { fields: [agentVersionTools.agentVersionId], references: [agentVersions.id] }),
  toolDefinition: one(toolDefinitions, { fields: [agentVersionTools.toolDefinitionId], references: [toolDefinitions.id] })
}));

export const integrationConnectionsRelations = relations(integrationConnections, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [integrationConnections.workspaceId], references: [workspaces.id] }),
  connectedByUser: one(users, { fields: [integrationConnections.connectedBy], references: [users.id] }),
  credentials: many(encryptedCredentials)
}));

export const encryptedCredentialsRelations = relations(encryptedCredentials, ({ one }) => ({
  workspace: one(workspaces, { fields: [encryptedCredentials.workspaceId], references: [workspaces.id] }),
  connection: one(integrationConnections, { fields: [encryptedCredentials.connectionId], references: [integrationConnections.id] })
}));

export const deploymentsRelations = relations(deployments, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [deployments.workspaceId], references: [workspaces.id] }),
  agent: one(agents, { fields: [deployments.agentId], references: [agents.id] }),
  activeVersion: one(agentVersions, { fields: [deployments.activeVersionId], references: [agentVersions.id] }),
  creator: one(users, { fields: [deployments.createdBy], references: [users.id] }),
  origins: many(deploymentOrigins),
  releases: many(deploymentReleases),
  apiKeys: many(apiKeys),
  widgetSessions: many(widgetSessions),
  conversations: many(conversations),
  runs: many(runs)
}));

export const deploymentOriginsRelations = relations(deploymentOrigins, ({ one }) => ({
  workspace: one(workspaces, { fields: [deploymentOrigins.workspaceId], references: [workspaces.id] }),
  deployment: one(deployments, { fields: [deploymentOrigins.deploymentId], references: [deployments.id] })
}));

export const deploymentReleasesRelations = relations(deploymentReleases, ({ one }) => ({
  workspace: one(workspaces, { fields: [deploymentReleases.workspaceId], references: [workspaces.id] }),
  deployment: one(deployments, { fields: [deploymentReleases.deploymentId], references: [deployments.id] }),
  agentVersion: one(agentVersions, { fields: [deploymentReleases.agentVersionId], references: [agentVersions.id] }),
  publisher: one(users, { fields: [deploymentReleases.publishedBy], references: [users.id] })
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  workspace: one(workspaces, { fields: [apiKeys.workspaceId], references: [workspaces.id] }),
  deployment: one(deployments, { fields: [apiKeys.deploymentId], references: [deployments.id] }),
  creator: one(users, { fields: [apiKeys.createdBy], references: [users.id] })
}));

export const widgetSessionsRelations = relations(widgetSessions, ({ one }) => ({
  workspace: one(workspaces, { fields: [widgetSessions.workspaceId], references: [workspaces.id] }),
  deployment: one(deployments, { fields: [widgetSessions.deploymentId], references: [deployments.id] })
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [conversations.workspaceId], references: [workspaces.id] }),
  agent: one(agents, { fields: [conversations.agentId], references: [agents.id] }),
  deployment: one(deployments, { fields: [conversations.deploymentId], references: [deployments.id] }),
  creator: one(users, { fields: [conversations.createdBy], references: [users.id] }),
  messages: many(messages),
  runs: many(runs)
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  workspace: one(workspaces, { fields: [messages.workspaceId], references: [workspaces.id] }),
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] })
}));

export const runsRelations = relations(runs, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [runs.workspaceId], references: [workspaces.id] }),
  agent: one(agents, { fields: [runs.agentId], references: [agents.id] }),
  agentVersion: one(agentVersions, { fields: [runs.agentVersionId], references: [agentVersions.id] }),
  deployment: one(deployments, { fields: [runs.deploymentId], references: [deployments.id] }),
  conversation: one(conversations, { fields: [runs.conversationId], references: [conversations.id] }),
  steps: many(runSteps),
  events: many(runEvents),
  toolOperations: many(toolOperations),
  approvals: many(approvals),
  reservations: many(creditReservations),
  usageEvents: many(usageEvents)
}));

export const runStepsRelations = relations(runSteps, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [runSteps.workspaceId], references: [workspaces.id] }),
  run: one(runs, { fields: [runSteps.runId], references: [runs.id] }),
  toolOperations: many(toolOperations)
}));

export const runEventsRelations = relations(runEvents, ({ one }) => ({
  workspace: one(workspaces, { fields: [runEvents.workspaceId], references: [workspaces.id] }),
  run: one(runs, { fields: [runEvents.runId], references: [runs.id] })
}));

export const toolOperationsRelations = relations(toolOperations, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [toolOperations.workspaceId], references: [workspaces.id] }),
  run: one(runs, { fields: [toolOperations.runId], references: [runs.id] }),
  step: one(runSteps, { fields: [toolOperations.stepId], references: [runSteps.id] }),
  approvals: many(approvals)
}));

export const approvalsRelations = relations(approvals, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [approvals.workspaceId], references: [workspaces.id] }),
  run: one(runs, { fields: [approvals.runId], references: [runs.id] }),
  toolOperation: one(toolOperations, { fields: [approvals.toolOperationId], references: [toolOperations.id] }),
  resolver: one(users, { fields: [approvals.resolvedBy], references: [users.id] }),
  consumer: one(users, { fields: [approvals.consumedBy], references: [users.id] }),
  events: many(approvalEvents)
}));

export const approvalEventsRelations = relations(approvalEvents, ({ one }) => ({
  workspace: one(workspaces, { fields: [approvalEvents.workspaceId], references: [workspaces.id] }),
  approval: one(approvals, { fields: [approvalEvents.approvalId], references: [approvals.id] })
}));

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [workflows.workspaceId], references: [workspaces.id] }),
  creator: one(users, { fields: [workflows.createdBy], references: [users.id] }),
  versions: many(workflowVersions),
  triggers: many(workflowTriggers),
  runs: many(workflowRuns)
}));

export const workflowVersionsRelations = relations(workflowVersions, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [workflowVersions.workspaceId], references: [workspaces.id] }),
  workflow: one(workflows, { fields: [workflowVersions.workflowId], references: [workflows.id] }),
  publisher: one(users, { fields: [workflowVersions.publishedBy], references: [users.id] }),
  runs: many(workflowRuns)
}));

export const workflowTriggersRelations = relations(workflowTriggers, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [workflowTriggers.workspaceId], references: [workspaces.id] }),
  workflow: one(workflows, { fields: [workflowTriggers.workflowId], references: [workflows.id] }),
  runs: many(workflowRuns)
}));

export const workflowRunsRelations = relations(workflowRuns, ({ one }) => ({
  workspace: one(workspaces, { fields: [workflowRuns.workspaceId], references: [workspaces.id] }),
  workflow: one(workflows, { fields: [workflowRuns.workflowId], references: [workflows.id] }),
  workflowVersion: one(workflowVersions, { fields: [workflowRuns.workflowVersionId], references: [workflowVersions.id] }),
  trigger: one(workflowTriggers, { fields: [workflowRuns.triggerId], references: [workflowTriggers.id] })
}));

export const knowledgeSourcesRelations = relations(knowledgeSources, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [knowledgeSources.workspaceId], references: [workspaces.id] }),
  agent: one(agents, { fields: [knowledgeSources.agentId], references: [agents.id] }),
  creator: one(users, { fields: [knowledgeSources.createdBy], references: [users.id] }),
  chunks: many(knowledgeChunks)
}));

export const knowledgeChunksRelations = relations(knowledgeChunks, ({ one }) => ({
  workspace: one(workspaces, { fields: [knowledgeChunks.workspaceId], references: [workspaces.id] }),
  source: one(knowledgeSources, { fields: [knowledgeChunks.sourceId], references: [knowledgeSources.id] })
}));

export const creditAccountsRelations = relations(creditAccounts, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [creditAccounts.workspaceId], references: [workspaces.id] }),
  ledgerEntries: many(creditLedgerEntries),
  reservations: many(creditReservations)
}));

export const creditLedgerEntriesRelations = relations(creditLedgerEntries, ({ one }) => ({
  workspace: one(workspaces, { fields: [creditLedgerEntries.workspaceId], references: [workspaces.id] }),
  account: one(creditAccounts, { fields: [creditLedgerEntries.accountId], references: [creditAccounts.id] }),
  creator: one(users, { fields: [creditLedgerEntries.createdBy], references: [users.id] })
}));

export const creditReservationsRelations = relations(creditReservations, ({ one }) => ({
  workspace: one(workspaces, { fields: [creditReservations.workspaceId], references: [workspaces.id] }),
  account: one(creditAccounts, { fields: [creditReservations.accountId], references: [creditAccounts.id] }),
  run: one(runs, { fields: [creditReservations.runId], references: [runs.id] })
}));

export const usageEventsRelations = relations(usageEvents, ({ one }) => ({
  workspace: one(workspaces, { fields: [usageEvents.workspaceId], references: [workspaces.id] }),
  run: one(runs, { fields: [usageEvents.runId], references: [runs.id] })
}));

export const paymentOrdersRelations = relations(paymentOrders, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [paymentOrders.workspaceId], references: [workspaces.id] }),
  creator: one(users, { fields: [paymentOrders.createdBy], references: [users.id] }),
  events: many(paymentEvents)
}));

export const paymentEventsRelations = relations(paymentEvents, ({ one }) => ({
  workspace: one(workspaces, { fields: [paymentEvents.workspaceId], references: [workspaces.id] }),
  order: one(paymentOrders, { fields: [paymentEvents.paymentOrderId], references: [paymentOrders.id] })
}));

export const webhookEndpointsRelations = relations(webhookEndpoints, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [webhookEndpoints.workspaceId], references: [workspaces.id] }),
  creator: one(users, { fields: [webhookEndpoints.createdBy], references: [users.id] }),
  deliveries: many(webhookDeliveries)
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  workspace: one(workspaces, { fields: [webhookDeliveries.workspaceId], references: [workspaces.id] }),
  endpoint: one(webhookEndpoints, { fields: [webhookDeliveries.endpointId], references: [webhookEndpoints.id] })
}));

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
  workspace: one(workspaces, { fields: [auditEvents.workspaceId], references: [workspaces.id] })
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  workspace: one(workspaces, { fields: [notifications.workspaceId], references: [workspaces.id] }),
  recipient: one(users, { fields: [notifications.recipientUserId], references: [users.id] })
}));

export const fdeImplementationRecordsRelations = relations(fdeImplementationRecords, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [fdeImplementationRecords.workspaceId], references: [workspaces.id] }),
  creator: one(users, { fields: [fdeImplementationRecords.createdBy], references: [users.id] }),
  reports: many(deploymentReadinessReports)
}));

export const deploymentReadinessReportsRelations = relations(deploymentReadinessReports, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [deploymentReadinessReports.workspaceId], references: [workspaces.id] }),
  implementation: one(fdeImplementationRecords, { fields: [deploymentReadinessReports.implementationId], references: [fdeImplementationRecords.id] }),
  deployment: one(deployments, { fields: [deploymentReadinessReports.deploymentId], references: [deployments.id] }),
  generator: one(users, { fields: [deploymentReadinessReports.generatedBy], references: [users.id] }),
  checks: many(deploymentReadinessChecks)
}));

export const deploymentReadinessChecksRelations = relations(deploymentReadinessChecks, ({ one }) => ({
  workspace: one(workspaces, { fields: [deploymentReadinessChecks.workspaceId], references: [workspaces.id] }),
  report: one(deploymentReadinessReports, { fields: [deploymentReadinessChecks.reportId], references: [deploymentReadinessReports.id] })
}));

export const supportAccessGrantsRelations = relations(supportAccessGrants, ({ one }) => ({
  workspace: one(workspaces, { fields: [supportAccessGrants.workspaceId], references: [workspaces.id] }),
  requester: one(users, { fields: [supportAccessGrants.requestedBy], references: [users.id] }),
  approver: one(users, { fields: [supportAccessGrants.approvedBy], references: [users.id] })
}));
