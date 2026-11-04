import { pgEnum } from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['owner', 'admin', 'member', 'viewer']);
export const workspacePlan = pgEnum('workspace_plan', ['free', 'pro', 'team', 'enterprise']);
export const invitationStatus = pgEnum('invitation_status', ['pending', 'accepted', 'expired', 'revoked']);
export const agentStatus = pgEnum('agent_status', ['draft', 'published', 'archived']);
export const evaluationStatus = pgEnum('evaluation_status', ['pending', 'running', 'passed', 'failed', 'cancelled']);
export const toolRisk = pgEnum('tool_risk', ['read', 'write', 'external_side_effect', 'high_impact']);
export const toolSideEffect = pgEnum('tool_side_effect', ['none', 'internal_write', 'external_write']);
export const toolStatus = pgEnum('tool_status', ['active', 'deprecated', 'disabled']);
export const provider = pgEnum('integration_provider', ['google', 'meta', 'razorpay', 'custom']);
export const connectionStatus = pgEnum('connection_status', ['pending', 'connected', 'degraded', 'revoked', 'error']);
export const deploymentEnvironment = pgEnum('deployment_environment', ['development', 'staging', 'production']);
export const deploymentChannel = pgEnum('deployment_channel', ['web', 'widget', 'api', 'webhook', 'scheduler']);
export const deploymentStatus = pgEnum('deployment_status', ['draft', 'active', 'paused', 'disabled', 'archived']);
export const originStatus = pgEnum('origin_status', ['pending', 'verified', 'rejected', 'revoked']);
export const apiKeyStatus = pgEnum('api_key_status', ['active', 'revoked', 'expired']);
export const conversationStatus = pgEnum('conversation_status', ['active', 'closed', 'archived']);
export const messageRole = pgEnum('message_role', ['system', 'user', 'assistant', 'tool']);
export const runState = pgEnum('run_state', [
  'queued',
  'initializing',
  'running',
  'waiting_for_approval',
  'succeeded',
  'failed',
  'cancelled',
  'expired',
  'blocked',
  'reconciliation_required',
  'dead_lettered'
]);
export const runInitiatorType = pgEnum('run_initiator_type', ['user', 'api_key', 'widget', 'webhook', 'scheduler']);
export const runStepStatus = pgEnum('run_step_status', ['pending', 'running', 'succeeded', 'failed', 'skipped']);
export const toolOperationStatus = pgEnum('tool_operation_status', [
  'proposed',
  'approved',
  'rejected',
  'running',
  'succeeded',
  'failed',
  'unknown'
]);
export const approvalStatus = pgEnum('approval_status', ['pending', 'approved', 'rejected', 'expired', 'consumed']);
export const approvalEventType = pgEnum('approval_event_type', [
  'requested',
  'approved',
  'rejected',
  'expired',
  'consumed'
]);
export const workflowStatus = pgEnum('workflow_status', ['draft', 'published', 'archived']);
export const workflowTriggerType = pgEnum('workflow_trigger_type', ['manual', 'schedule', 'webhook', 'api']);
export const workflowTriggerStatus = pgEnum('workflow_trigger_status', ['active', 'paused', 'disabled']);
export const workflowRunStatus = pgEnum('workflow_run_status', ['queued', 'running', 'succeeded', 'failed', 'cancelled']);
export const knowledgeSourceType = pgEnum('knowledge_source_type', ['upload', 'url', 'text', 'integration']);
export const ingestionStatus = pgEnum('ingestion_status', ['pending', 'processing', 'ready', 'failed', 'deleted']);
export const creditLedgerType = pgEnum('credit_ledger_type', [
  'grant',
  'purchase',
  'hold',
  'consume',
  'release',
  'refund',
  'adjustment'
]);
export const creditReservationStatus = pgEnum('credit_reservation_status', [
  'held',
  'settled',
  'released',
  'expired'
]);
export const paymentStatus = pgEnum('payment_status', ['created', 'authorized', 'captured', 'failed', 'refunded', 'cancelled']);
export const paymentEventStatus = pgEnum('payment_event_status', ['received', 'processing', 'processed', 'ignored', 'failed']);
export const endpointStatus = pgEnum('endpoint_status', ['active', 'paused', 'disabled']);
export const webhookDeliveryStatus = pgEnum('webhook_delivery_status', ['pending', 'delivered', 'retrying', 'failed']);
export const actorType = pgEnum('actor_type', ['user', 'api_key', 'widget', 'worker', 'system', 'support']);
export const notificationStatus = pgEnum('notification_status', ['unread', 'read', 'dismissed']);
export const fdeStatus = pgEnum('fde_status', ['discovery', 'onboarding', 'staging', 'production', 'handover', 'closed']);
export const readinessStatus = pgEnum('readiness_status', ['ready', 'blocked', 'ready_with_warnings']);
export const readinessCheckStatus = pgEnum('readiness_check_status', ['passed', 'blocked', 'warning', 'not_run']);
export const supportAccessStatus = pgEnum('support_access_status', ['requested', 'approved', 'active', 'expired', 'revoked']);
