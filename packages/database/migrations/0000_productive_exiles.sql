CREATE TYPE "public"."actor_type" AS ENUM('user', 'api_key', 'widget', 'worker', 'system', 'support');--> statement-breakpoint
CREATE TYPE "public"."agent_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."api_key_status" AS ENUM('active', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."approval_event_type" AS ENUM('requested', 'approved', 'rejected', 'expired', 'consumed');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected', 'expired', 'consumed');--> statement-breakpoint
CREATE TYPE "public"."connection_status" AS ENUM('pending', 'connected', 'degraded', 'revoked', 'error');--> statement-breakpoint
CREATE TYPE "public"."conversation_status" AS ENUM('active', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."credit_ledger_type" AS ENUM('grant', 'purchase', 'hold', 'consume', 'release', 'refund', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."credit_reservation_status" AS ENUM('held', 'settled', 'released', 'expired');--> statement-breakpoint
CREATE TYPE "public"."deployment_channel" AS ENUM('web', 'widget', 'api', 'webhook', 'scheduler');--> statement-breakpoint
CREATE TYPE "public"."deployment_environment" AS ENUM('development', 'staging', 'production');--> statement-breakpoint
CREATE TYPE "public"."deployment_status" AS ENUM('draft', 'active', 'paused', 'disabled', 'archived');--> statement-breakpoint
CREATE TYPE "public"."endpoint_status" AS ENUM('active', 'paused', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."evaluation_status" AS ENUM('pending', 'running', 'passed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."fde_status" AS ENUM('discovery', 'onboarding', 'staging', 'production', 'handover', 'closed');--> statement-breakpoint
CREATE TYPE "public"."ingestion_status" AS ENUM('pending', 'processing', 'ready', 'failed', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."knowledge_source_type" AS ENUM('upload', 'url', 'text', 'integration');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('system', 'user', 'assistant', 'tool');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('unread', 'read', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."origin_status" AS ENUM('pending', 'verified', 'rejected', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."payment_event_status" AS ENUM('received', 'processing', 'processed', 'ignored', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('created', 'authorized', 'captured', 'failed', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."integration_provider" AS ENUM('google', 'meta', 'razorpay', 'custom');--> statement-breakpoint
CREATE TYPE "public"."readiness_check_status" AS ENUM('passed', 'blocked', 'warning', 'not_run');--> statement-breakpoint
CREATE TYPE "public"."readiness_status" AS ENUM('ready', 'blocked', 'ready_with_warnings');--> statement-breakpoint
CREATE TYPE "public"."run_initiator_type" AS ENUM('user', 'api_key', 'widget', 'webhook', 'scheduler');--> statement-breakpoint
CREATE TYPE "public"."run_state" AS ENUM('queued', 'initializing', 'running', 'waiting_for_approval', 'succeeded', 'failed', 'cancelled', 'expired', 'blocked', 'reconciliation_required', 'dead_lettered');--> statement-breakpoint
CREATE TYPE "public"."run_step_status" AS ENUM('pending', 'running', 'succeeded', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."support_access_status" AS ENUM('requested', 'approved', 'active', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."tool_operation_status" AS ENUM('proposed', 'approved', 'rejected', 'running', 'succeeded', 'failed', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."tool_risk" AS ENUM('read', 'write', 'external_side_effect', 'high_impact');--> statement-breakpoint
CREATE TYPE "public"."tool_side_effect" AS ENUM('none', 'internal_write', 'external_write');--> statement-breakpoint
CREATE TYPE "public"."tool_status" AS ENUM('active', 'deprecated', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin', 'member', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."webhook_delivery_status" AS ENUM('pending', 'delivered', 'retrying', 'failed');--> statement-breakpoint
CREATE TYPE "public"."workflow_run_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."workflow_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."workflow_trigger_status" AS ENUM('active', 'paused', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."workflow_trigger_type" AS ENUM('manual', 'schedule', 'webhook', 'api');--> statement-breakpoint
CREATE TYPE "public"."workspace_plan" AS ENUM('free', 'pro', 'team', 'enterprise');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"display_prefix" varchar(32) NOT NULL,
	"secret_hash" varchar(64) NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deployment_id" uuid,
	"status" "api_key_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_hash_format" CHECK ("api_keys"."secret_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "widget_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"deployment_id" uuid NOT NULL,
	"session_token_hash" varchar(64) NOT NULL,
	"origin" varchar(500) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "widget_sessions_hash_format" CHECK ("widget_sessions"."session_token_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "agent_evaluation_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"suite_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"input" jsonb NOT NULL,
	"expected" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_evaluation_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"suite_id" uuid NOT NULL,
	"agent_version_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"status" "evaluation_status" NOT NULL,
	"score" integer,
	"output" jsonb,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_evaluation_results_completed_after_started" CHECK ("agent_evaluation_results"."completed_at" IS NULL OR "agent_evaluation_results"."started_at" IS NULL OR "agent_evaluation_results"."completed_at" >= "agent_evaluation_results"."started_at"),
	CONSTRAINT "agent_evaluation_results_score_range" CHECK ("agent_evaluation_results"."score" IS NULL OR ("agent_evaluation_results"."score" >= 0 AND "agent_evaluation_results"."score" <= 100))
);
--> statement-breakpoint
CREATE TABLE "agent_evaluation_suites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"config_snapshot" jsonb NOT NULL,
	"snapshot_hash" varchar(64) NOT NULL,
	"published_by" uuid NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"changelog" text,
	CONSTRAINT "agent_versions_version_number_positive" CHECK ("agent_versions"."version_number" > 0),
	CONSTRAINT "agent_versions_hash_format" CHECK ("agent_versions"."snapshot_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" "agent_status" DEFAULT 'draft' NOT NULL,
	"current_draft" jsonb NOT NULL,
	"active_version_id" uuid,
	"archived_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"approval_id" uuid NOT NULL,
	"event_type" "approval_event_type" NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" varchar(255),
	"reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"tool_operation_id" uuid NOT NULL,
	"tool_name" varchar(120) NOT NULL,
	"risk_level" "tool_risk" NOT NULL,
	"payload" jsonb NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"decision_reason" text,
	"consumed_at" timestamp with time zone,
	"consumed_by" uuid,
	CONSTRAINT "approvals_payload_hash_format" CHECK ("approvals"."payload_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "approvals_expiry_after_request" CHECK ("approvals"."expires_at" > "approvals"."requested_at"),
	CONSTRAINT "approvals_consumed_requires_decision" CHECK ("approvals"."consumed_at" IS NULL OR "approvals"."status" = 'consumed')
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" varchar(255),
	"action" varchar(120) NOT NULL,
	"resource_type" varchar(120) NOT NULL,
	"resource_id" varchar(255),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"type" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "notification_status" DEFAULT 'unread' NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"currency" varchar(20) DEFAULT 'credits' NOT NULL,
	"cached_balance" numeric(20, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_accounts_cached_balance_non_negative" CHECK ("credit_accounts"."cached_balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "credit_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"type" "credit_ledger_type" NOT NULL,
	"amount" numeric(20, 6) NOT NULL,
	"balance_after" numeric(20, 6) NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"reference_type" varchar(80) NOT NULL,
	"reference_id" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_ledger_amount_non_zero" CHECK ("credit_ledger_entries"."amount" <> 0),
	CONSTRAINT "credit_ledger_balance_non_negative" CHECK ("credit_ledger_entries"."balance_after" >= 0)
);
--> statement-breakpoint
CREATE TABLE "credit_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"run_id" uuid,
	"reservation_key" varchar(128) NOT NULL,
	"held_amount" numeric(20, 6) NOT NULL,
	"settled_amount" numeric(20, 6),
	"status" "credit_reservation_status" DEFAULT 'held' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_reservations_amounts_valid" CHECK ("credit_reservations"."held_amount" > 0 AND ("credit_reservations"."settled_amount" IS NULL OR "credit_reservations"."settled_amount" >= 0)),
	CONSTRAINT "credit_reservations_settled_within_hold" CHECK ("credit_reservations"."settled_amount" IS NULL OR "credit_reservations"."settled_amount" <= "credit_reservations"."held_amount")
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"run_id" uuid,
	"metric" varchar(100) NOT NULL,
	"quantity" numeric(20, 6) NOT NULL,
	"unit" varchar(50) NOT NULL,
	"provider" varchar(100),
	"model" varchar(150),
	"cost_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_events_quantity_non_negative" CHECK ("usage_events"."quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "deployment_origins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"deployment_id" uuid NOT NULL,
	"origin" varchar(500) NOT NULL,
	"status" "origin_status" DEFAULT 'pending' NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deployment_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"deployment_id" uuid NOT NULL,
	"agent_version_id" uuid NOT NULL,
	"release_number" integer NOT NULL,
	"config_snapshot" jsonb NOT NULL,
	"policy_snapshot" jsonb NOT NULL,
	"published_by" uuid NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rollback_of" uuid,
	"notes" text,
	CONSTRAINT "deployment_releases_number_positive" CHECK ("deployment_releases"."release_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"environment" "deployment_environment" NOT NULL,
	"channel" "deployment_channel" NOT NULL,
	"name" varchar(100) NOT NULL,
	"status" "deployment_status" DEFAULT 'draft' NOT NULL,
	"active_version_id" uuid,
	"config_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled_tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rate_limit_per_minute" integer DEFAULT 60 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "deployments_rate_limit_positive" CHECK ("deployments"."rate_limit_per_minute" > 0)
);
--> statement-breakpoint
CREATE TABLE "deployment_readiness_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"check_key" varchar(120) NOT NULL,
	"status" "readiness_check_status" NOT NULL,
	"blocking" boolean DEFAULT true NOT NULL,
	"evidence_reference" text,
	"remediation_instruction" text,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deployment_readiness_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"implementation_id" uuid NOT NULL,
	"deployment_id" uuid NOT NULL,
	"status" "readiness_status" NOT NULL,
	"checker_version" varchar(100) NOT NULL,
	"evidence_reference" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"generated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "fde_implementation_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"customer_name" varchar(255) NOT NULL,
	"site_reference" text,
	"environment" "deployment_environment" NOT NULL,
	"status" "fde_status" DEFAULT 'discovery' NOT NULL,
	"business_objective" text,
	"success_criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"data_classification" varchar(80),
	"acceptance_owner" varchar(255),
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"approved_by" uuid,
	"reason_code" varchar(100) NOT NULL,
	"scope" jsonb NOT NULL,
	"status" "support_access_status" DEFAULT 'requested' NOT NULL,
	"starts_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"approval_reference" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_access_grants_expiry_after_start" CHECK ("support_access_grants"."starts_at" IS NULL OR "support_access_grants"."expires_at" > "support_access_grants"."starts_at"),
	CONSTRAINT "support_access_grants_approved_requires_actor" CHECK ("support_access_grants"."status" IN ('requested', 'expired', 'revoked') OR "support_access_grants"."approved_by" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_subject" varchar(255) NOT NULL,
	"provider_email" varchar(255),
	"granted_scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token_hash" varchar(64) NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workspace_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"invited_by" uuid NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "user_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"owner_id" uuid NOT NULL,
	"plan" "workspace_plan" DEFAULT 'free' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_slug_format" CHECK ("workspaces"."slug" ~ '^[a-z0-9][a-z0-9-]{1,98}[a-z0-9]$')
);
--> statement-breakpoint
CREATE TABLE "agent_version_tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"agent_version_id" uuid NOT NULL,
	"tool_definition_id" uuid NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_key" varchar(120) NOT NULL,
	"version" integer NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text NOT NULL,
	"input_schema" jsonb NOT NULL,
	"output_schema" jsonb NOT NULL,
	"risk" "tool_risk" NOT NULL,
	"side_effect" "tool_side_effect" DEFAULT 'none' NOT NULL,
	"required_permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"timeout_ms" integer DEFAULT 30000 NOT NULL,
	"status" "tool_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tool_definitions_version_positive" CHECK ("tool_definitions"."version" > 0),
	CONSTRAINT "tool_definitions_timeout_positive" CHECK ("tool_definitions"."timeout_ms" BETWEEN 100 AND 900000)
);
--> statement-breakpoint
CREATE TABLE "encrypted_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" varchar(128) NOT NULL,
	"auth_tag" varchar(128) NOT NULL,
	"key_reference" varchar(255) NOT NULL,
	"key_version" varchar(100) NOT NULL,
	"encrypted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rotated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "integration_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"external_account_ref" varchar(255) NOT NULL,
	"display_name" varchar(255),
	"granted_scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "connection_status" DEFAULT 'pending' NOT NULL,
	"token_expires_at" timestamp with time zone,
	"last_health_check_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"connected_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"deployment_id" uuid,
	"external_session_ref" varchar(255),
	"status" "conversation_status" DEFAULT 'active' NOT NULL,
	"title" varchar(255),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"sequence" integer NOT NULL,
	"model_metadata" jsonb,
	"tool_call_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_sequence_non_negative" CHECK ("messages"."sequence" >= 0)
);
--> statement-breakpoint
CREATE TABLE "run_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"correlation_id" varchar(128) NOT NULL,
	"event_version" integer DEFAULT 1 NOT NULL,
	"event_type" varchar(120) NOT NULL,
	"sequence" integer NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"visibility" varchar(50) DEFAULT 'operator' NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_events_sequence_non_negative" CHECK ("run_events"."sequence" >= 0),
	CONSTRAINT "run_events_version_positive" CHECK ("run_events"."event_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "run_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"step_type" varchar(80) NOT NULL,
	"status" "run_step_status" DEFAULT 'pending' NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"error_class" varchar(100),
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_steps_sequence_non_negative" CHECK ("run_steps"."sequence" >= 0),
	CONSTRAINT "run_steps_completed_after_started" CHECK ("run_steps"."completed_at" IS NULL OR "run_steps"."started_at" IS NULL OR "run_steps"."completed_at" >= "run_steps"."started_at")
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"agent_version_id" uuid NOT NULL,
	"deployment_id" uuid,
	"conversation_id" uuid,
	"state" "run_state" DEFAULT 'queued' NOT NULL,
	"initiator_type" "run_initiator_type" NOT NULL,
	"initiator_id" varchar(255) NOT NULL,
	"input_prompt" text NOT NULL,
	"output_summary" text,
	"error_class" varchar(100),
	"error_message" text,
	"idempotency_key" varchar(128) NOT NULL,
	"correlation_id" varchar(128) NOT NULL,
	"trace_id" varchar(32),
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"lease_owner" varchar(255),
	"lease_expires_at" timestamp with time zone,
	"checkpoint_namespace" varchar(255),
	"checkpoint_thread_id" varchar(255),
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "runs_retry_count_valid" CHECK ("runs"."retry_count" >= 0 AND "runs"."max_retries" >= 0 AND "runs"."retry_count" <= "runs"."max_retries"),
	CONSTRAINT "runs_completed_after_started" CHECK ("runs"."completed_at" IS NULL OR "runs"."started_at" IS NULL OR "runs"."completed_at" >= "runs"."started_at")
);
--> statement-breakpoint
CREATE TABLE "tool_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"step_id" uuid,
	"operation_key" varchar(255) NOT NULL,
	"tool_key" varchar(120) NOT NULL,
	"status" "tool_operation_status" DEFAULT 'proposed' NOT NULL,
	"payload" jsonb NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"provider_operation_ref" varchar(255),
	"error_class" varchar(100),
	"error_message" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "tool_operations_payload_hash_format" CHECK ("tool_operations"."payload_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"workflow_id" uuid NOT NULL,
	"workflow_version_id" uuid NOT NULL,
	"trigger_id" uuid,
	"status" "workflow_run_status" DEFAULT 'queued' NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"correlation_id" varchar(128) NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output" jsonb,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_runs_completed_after_started" CHECK ("workflow_runs"."completed_at" IS NULL OR "workflow_runs"."started_at" IS NULL OR "workflow_runs"."completed_at" >= "workflow_runs"."started_at")
);
--> statement-breakpoint
CREATE TABLE "workflow_triggers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"workflow_id" uuid NOT NULL,
	"type" "workflow_trigger_type" NOT NULL,
	"configuration" jsonb NOT NULL,
	"status" "workflow_trigger_status" DEFAULT 'active' NOT NULL,
	"secret_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_triggers_secret_hash_format" CHECK ("workflow_triggers"."secret_hash" IS NULL OR "workflow_triggers"."secret_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "workflow_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"workflow_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"graph_snapshot" jsonb NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"published_by" uuid NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"changelog" text,
	CONSTRAINT "workflow_versions_version_positive" CHECK ("workflow_versions"."version_number" > 0),
	CONSTRAINT "workflow_versions_hash_format" CHECK ("workflow_versions"."content_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" "workflow_status" DEFAULT 'draft' NOT NULL,
	"active_version_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"embedding" jsonb NOT NULL,
	"embedding_model" varchar(150) NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_chunks_index_non_negative" CHECK ("knowledge_chunks"."chunk_index" >= 0)
);
--> statement-breakpoint
CREATE TABLE "knowledge_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"agent_id" uuid,
	"type" "knowledge_source_type" NOT NULL,
	"name" varchar(255) NOT NULL,
	"source_reference" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "ingestion_status" DEFAULT 'pending' NOT NULL,
	"content_hash" varchar(64),
	"deleted_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_sources_hash_format" CHECK ("knowledge_sources"."content_hash" IS NULL OR "knowledge_sources"."content_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"payment_order_id" uuid,
	"provider" varchar(50) NOT NULL,
	"provider_event_id" varchar(255) NOT NULL,
	"signature_verified" boolean NOT NULL,
	"signature_algorithm" varchar(50),
	"payload_hash" varchar(64) NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"status" "payment_event_status" DEFAULT 'received' NOT NULL,
	"processing_error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "payment_events_payload_hash_format" CHECK ("payment_events"."payload_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "payment_events_signature_rule" CHECK ("payment_events"."status" = 'received' OR "payment_events"."signature_verified" = true)
);
--> statement-breakpoint
CREATE TABLE "payment_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"external_order_id" varchar(255) NOT NULL,
	"amount" numeric(20, 6) NOT NULL,
	"currency" varchar(10) NOT NULL,
	"status" "payment_status" DEFAULT 'created' NOT NULL,
	"checkout_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_orders_amount_positive" CHECK ("payment_orders"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"event_id" varchar(255) NOT NULL,
	"event_type" varchar(120) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "webhook_delivery_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"response_status" integer,
	"response_body_redacted" text,
	"next_attempt_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_deliveries_attempt_non_negative" CHECK ("webhook_deliveries"."attempt_count" >= 0),
	CONSTRAINT "webhook_deliveries_response_status_valid" CHECK ("webhook_deliveries"."response_status" IS NULL OR "webhook_deliveries"."response_status" BETWEEN 100 AND 599)
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"url" text NOT NULL,
	"secret_hash" varchar(64) NOT NULL,
	"event_subscriptions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "endpoint_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_endpoints_secret_hash_format" CHECK ("webhook_endpoints"."secret_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_secret_hash_unique" ON "api_keys" USING btree ("secret_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_workspace_prefix_unique" ON "api_keys" USING btree ("workspace_id","display_prefix");--> statement-breakpoint
CREATE UNIQUE INDEX "widget_sessions_token_hash_unique" ON "widget_sessions" USING btree ("session_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_evaluation_cases_workspace_id_unique" ON "agent_evaluation_cases" USING btree ("workspace_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_evaluation_cases_suite_name_unique" ON "agent_evaluation_cases" USING btree ("workspace_id","suite_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_evaluation_suites_workspace_id_unique" ON "agent_evaluation_suites" USING btree ("workspace_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_evaluation_suites_workspace_name_unique" ON "agent_evaluation_suites" USING btree ("workspace_id","agent_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_versions_workspace_id_unique" ON "agent_versions" USING btree ("workspace_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_versions_workspace_agent_version_unique" ON "agent_versions" USING btree ("workspace_id","agent_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_versions_workspace_snapshot_hash_unique" ON "agent_versions" USING btree ("workspace_id","snapshot_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "agents_workspace_id_unique" ON "agents" USING btree ("workspace_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "agents_workspace_name_unique" ON "agents" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "approvals_workspace_id_unique" ON "approvals" USING btree ("workspace_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "approvals_operation_unique" ON "approvals" USING btree ("workspace_id","tool_operation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_accounts_workspace_id_unique" ON "credit_accounts" USING btree ("workspace_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_accounts_workspace_currency_unique" ON "credit_accounts" USING btree ("workspace_id","currency");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_workspace_idempotency_unique" ON "credit_ledger_entries" USING btree ("workspace_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_reservations_workspace_key_unique" ON "credit_reservations" USING btree ("workspace_id","reservation_key");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_events_workspace_idempotency_unique" ON "usage_events" USING btree ("workspace_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "deployment_origins_origin_unique" ON "deployment_origins" USING btree ("workspace_id","origin");--> statement-breakpoint
CREATE UNIQUE INDEX "deployment_origins_deployment_origin_unique" ON "deployment_origins" USING btree ("workspace_id","deployment_id","origin");--> statement-breakpoint
CREATE UNIQUE INDEX "deployment_releases_deployment_number_unique" ON "deployment_releases" USING btree ("workspace_id","deployment_id","release_number");--> statement-breakpoint
CREATE UNIQUE INDEX "deployments_workspace_id_unique" ON "deployments" USING btree ("workspace_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "deployments_workspace_name_environment_channel_unique" ON "deployments" USING btree ("workspace_id","name","environment","channel");--> statement-breakpoint
CREATE UNIQUE INDEX "deployment_readiness_checks_report_key_unique" ON "deployment_readiness_checks" USING btree ("workspace_id","report_id","check_key");--> statement-breakpoint
CREATE UNIQUE INDEX "deployment_readiness_reports_workspace_id_unique" ON "deployment_readiness_reports" USING btree ("workspace_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "fde_implementation_records_workspace_id_unique" ON "fde_implementation_records" USING btree ("workspace_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_accounts_provider_subject_unique" ON "oauth_accounts" USING btree ("provider","provider_subject");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_accounts_user_provider_unique" ON "oauth_accounts" USING btree ("user_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("session_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invitations_token_hash_unique" ON "workspace_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_members_workspace_user_unique" ON "workspace_members" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_members_workspace_id_unique" ON "workspace_members" USING btree ("workspace_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_slug_unique" ON "workspaces" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_version_tools_version_tool_unique" ON "agent_version_tools" USING btree ("workspace_id","agent_version_id","tool_definition_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tool_definitions_key_version_unique" ON "tool_definitions" USING btree ("tool_key","version");--> statement-breakpoint
CREATE UNIQUE INDEX "encrypted_credentials_active_connection_unique" ON "encrypted_credentials" USING btree ("workspace_id","connection_id") WHERE "encrypted_credentials"."revoked_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "integration_connections_workspace_id_unique" ON "integration_connections" USING btree ("workspace_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_connections_provider_account_unique" ON "integration_connections" USING btree ("workspace_id","provider","external_account_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_workspace_id_unique" ON "conversations" USING btree ("workspace_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_workspace_session_unique" ON "conversations" USING btree ("workspace_id","external_session_ref") WHERE "conversations"."external_session_ref" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "messages_conversation_sequence_unique" ON "messages" USING btree ("workspace_id","conversation_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "run_events_run_sequence_unique" ON "run_events" USING btree ("workspace_id","run_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "run_steps_workspace_id_unique" ON "run_steps" USING btree ("workspace_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "run_steps_run_sequence_unique" ON "run_steps" USING btree ("workspace_id","run_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "runs_workspace_id_unique" ON "runs" USING btree ("workspace_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "runs_workspace_id_idempotency_unique" ON "runs" USING btree ("workspace_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "tool_operations_workspace_id_unique" ON "tool_operations" USING btree ("workspace_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "tool_operations_run_operation_key_unique" ON "tool_operations" USING btree ("workspace_id","run_id","operation_key");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_runs_workspace_idempotency_unique" ON "workflow_runs" USING btree ("workspace_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_triggers_workspace_id_unique" ON "workflow_triggers" USING btree ("workspace_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_versions_workspace_id_unique" ON "workflow_versions" USING btree ("workspace_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_versions_workspace_workflow_version_unique" ON "workflow_versions" USING btree ("workspace_id","workflow_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_versions_workspace_hash_unique" ON "workflow_versions" USING btree ("workspace_id","content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "workflows_workspace_id_unique" ON "workflows" USING btree ("workspace_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflows_workspace_name_unique" ON "workflows" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_chunks_source_index_unique" ON "knowledge_chunks" USING btree ("workspace_id","source_id","chunk_index");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_sources_workspace_id_unique" ON "knowledge_sources" USING btree ("workspace_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_sources_workspace_hash_unique" ON "knowledge_sources" USING btree ("workspace_id","content_hash") WHERE "knowledge_sources"."deleted_at" IS NULL AND "knowledge_sources"."content_hash" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_events_provider_event_unique" ON "payment_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_orders_workspace_id_unique" ON "payment_orders" USING btree ("workspace_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_orders_provider_order_unique" ON "payment_orders" USING btree ("provider","external_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_deliveries_endpoint_event_unique" ON "webhook_deliveries" USING btree ("workspace_id","endpoint_id","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_endpoints_workspace_id_unique" ON "webhook_endpoints" USING btree ("workspace_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_endpoints_workspace_url_unique" ON "webhook_endpoints" USING btree ("workspace_id","url");--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_workspace_deployment_fk" FOREIGN KEY ("workspace_id","deployment_id") REFERENCES "public"."deployments"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "widget_sessions" ADD CONSTRAINT "widget_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "widget_sessions" ADD CONSTRAINT "widget_sessions_workspace_deployment_fk" FOREIGN KEY ("workspace_id","deployment_id") REFERENCES "public"."deployments"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_evaluation_cases" ADD CONSTRAINT "agent_evaluation_cases_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_evaluation_cases" ADD CONSTRAINT "agent_evaluation_cases_workspace_suite_fk" FOREIGN KEY ("workspace_id","suite_id") REFERENCES "public"."agent_evaluation_suites"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_evaluation_results" ADD CONSTRAINT "agent_evaluation_results_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_evaluation_results" ADD CONSTRAINT "agent_evaluation_results_workspace_suite_fk" FOREIGN KEY ("workspace_id","suite_id") REFERENCES "public"."agent_evaluation_suites"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_evaluation_results" ADD CONSTRAINT "agent_evaluation_results_workspace_version_fk" FOREIGN KEY ("workspace_id","agent_version_id") REFERENCES "public"."agent_versions"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_evaluation_results" ADD CONSTRAINT "agent_evaluation_results_workspace_case_fk" FOREIGN KEY ("workspace_id","case_id") REFERENCES "public"."agent_evaluation_cases"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_evaluation_suites" ADD CONSTRAINT "agent_evaluation_suites_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_evaluation_suites" ADD CONSTRAINT "agent_evaluation_suites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_evaluation_suites" ADD CONSTRAINT "agent_evaluation_suites_workspace_agent_fk" FOREIGN KEY ("workspace_id","agent_id") REFERENCES "public"."agents"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_versions" ADD CONSTRAINT "agent_versions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_versions" ADD CONSTRAINT "agent_versions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_versions" ADD CONSTRAINT "agent_versions_workspace_agent_fk" FOREIGN KEY ("workspace_id","agent_id") REFERENCES "public"."agents"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_workspace_approval_fk" FOREIGN KEY ("workspace_id","approval_id") REFERENCES "public"."approvals"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_consumed_by_users_id_fk" FOREIGN KEY ("consumed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_workspace_run_fk" FOREIGN KEY ("workspace_id","run_id") REFERENCES "public"."runs"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_workspace_operation_fk" FOREIGN KEY ("workspace_id","tool_operation_id") REFERENCES "public"."tool_operations"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_recipient_fk" FOREIGN KEY ("workspace_id","recipient_user_id") REFERENCES "public"."workspace_members"("workspace_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_accounts" ADD CONSTRAINT "credit_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_workspace_account_fk" FOREIGN KEY ("workspace_id","account_id") REFERENCES "public"."credit_accounts"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_reservations" ADD CONSTRAINT "credit_reservations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_reservations" ADD CONSTRAINT "credit_reservations_workspace_account_fk" FOREIGN KEY ("workspace_id","account_id") REFERENCES "public"."credit_accounts"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_reservations" ADD CONSTRAINT "credit_reservations_workspace_run_fk" FOREIGN KEY ("workspace_id","run_id") REFERENCES "public"."runs"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_workspace_run_fk" FOREIGN KEY ("workspace_id","run_id") REFERENCES "public"."runs"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_origins" ADD CONSTRAINT "deployment_origins_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_origins" ADD CONSTRAINT "deployment_origins_workspace_deployment_fk" FOREIGN KEY ("workspace_id","deployment_id") REFERENCES "public"."deployments"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_releases" ADD CONSTRAINT "deployment_releases_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_releases" ADD CONSTRAINT "deployment_releases_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_releases" ADD CONSTRAINT "deployment_releases_workspace_deployment_fk" FOREIGN KEY ("workspace_id","deployment_id") REFERENCES "public"."deployments"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_releases" ADD CONSTRAINT "deployment_releases_workspace_version_fk" FOREIGN KEY ("workspace_id","agent_version_id") REFERENCES "public"."agent_versions"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_workspace_agent_fk" FOREIGN KEY ("workspace_id","agent_id") REFERENCES "public"."agents"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_workspace_active_version_fk" FOREIGN KEY ("workspace_id","active_version_id") REFERENCES "public"."agent_versions"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_readiness_checks" ADD CONSTRAINT "deployment_readiness_checks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_readiness_checks" ADD CONSTRAINT "deployment_readiness_checks_workspace_report_fk" FOREIGN KEY ("workspace_id","report_id") REFERENCES "public"."deployment_readiness_reports"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_readiness_reports" ADD CONSTRAINT "deployment_readiness_reports_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_readiness_reports" ADD CONSTRAINT "deployment_readiness_reports_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_readiness_reports" ADD CONSTRAINT "deployment_readiness_reports_workspace_implementation_fk" FOREIGN KEY ("workspace_id","implementation_id") REFERENCES "public"."fde_implementation_records"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_readiness_reports" ADD CONSTRAINT "deployment_readiness_reports_workspace_deployment_fk" FOREIGN KEY ("workspace_id","deployment_id") REFERENCES "public"."deployments"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fde_implementation_records" ADD CONSTRAINT "fde_implementation_records_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fde_implementation_records" ADD CONSTRAINT "fde_implementation_records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_access_grants" ADD CONSTRAINT "support_access_grants_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_access_grants" ADD CONSTRAINT "support_access_grants_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_access_grants" ADD CONSTRAINT "support_access_grants_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_accepted_member_fk" FOREIGN KEY ("workspace_id","accepted_by") REFERENCES "public"."workspace_members"("workspace_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_version_tools" ADD CONSTRAINT "agent_version_tools_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_version_tools" ADD CONSTRAINT "agent_version_tools_workspace_version_fk" FOREIGN KEY ("workspace_id","agent_version_id") REFERENCES "public"."agent_versions"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_definitions" ADD CONSTRAINT "tool_definitions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encrypted_credentials" ADD CONSTRAINT "encrypted_credentials_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encrypted_credentials" ADD CONSTRAINT "encrypted_credentials_workspace_connection_fk" FOREIGN KEY ("workspace_id","connection_id") REFERENCES "public"."integration_connections"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_connected_by_users_id_fk" FOREIGN KEY ("connected_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspace_agent_fk" FOREIGN KEY ("workspace_id","agent_id") REFERENCES "public"."agents"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspace_deployment_fk" FOREIGN KEY ("workspace_id","deployment_id") REFERENCES "public"."deployments"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_workspace_conversation_fk" FOREIGN KEY ("workspace_id","conversation_id") REFERENCES "public"."conversations"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_events" ADD CONSTRAINT "run_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_events" ADD CONSTRAINT "run_events_workspace_run_fk" FOREIGN KEY ("workspace_id","run_id") REFERENCES "public"."runs"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_workspace_run_fk" FOREIGN KEY ("workspace_id","run_id") REFERENCES "public"."runs"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_workspace_agent_fk" FOREIGN KEY ("workspace_id","agent_id") REFERENCES "public"."agents"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_workspace_version_fk" FOREIGN KEY ("workspace_id","agent_version_id") REFERENCES "public"."agent_versions"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_workspace_deployment_fk" FOREIGN KEY ("workspace_id","deployment_id") REFERENCES "public"."deployments"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_workspace_conversation_fk" FOREIGN KEY ("workspace_id","conversation_id") REFERENCES "public"."conversations"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_operations" ADD CONSTRAINT "tool_operations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_operations" ADD CONSTRAINT "tool_operations_workspace_run_fk" FOREIGN KEY ("workspace_id","run_id") REFERENCES "public"."runs"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_operations" ADD CONSTRAINT "tool_operations_workspace_step_fk" FOREIGN KEY ("workspace_id","step_id") REFERENCES "public"."run_steps"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workspace_workflow_fk" FOREIGN KEY ("workspace_id","workflow_id") REFERENCES "public"."workflows"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workspace_version_fk" FOREIGN KEY ("workspace_id","workflow_version_id") REFERENCES "public"."workflow_versions"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workspace_trigger_fk" FOREIGN KEY ("workspace_id","trigger_id") REFERENCES "public"."workflow_triggers"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_workspace_workflow_fk" FOREIGN KEY ("workspace_id","workflow_id") REFERENCES "public"."workflows"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_workspace_workflow_fk" FOREIGN KEY ("workspace_id","workflow_id") REFERENCES "public"."workflows"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_workspace_source_fk" FOREIGN KEY ("workspace_id","source_id") REFERENCES "public"."knowledge_sources"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_workspace_agent_fk" FOREIGN KEY ("workspace_id","agent_id") REFERENCES "public"."agents"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_workspace_order_fk" FOREIGN KEY ("workspace_id","payment_order_id") REFERENCES "public"."payment_orders"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_workspace_endpoint_fk" FOREIGN KEY ("workspace_id","endpoint_id") REFERENCES "public"."webhook_endpoints"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_active_idx" ON "api_keys" USING btree ("workspace_id","status") WHERE "api_keys"."status" = 'active';--> statement-breakpoint
CREATE INDEX "widget_sessions_expiry_idx" ON "widget_sessions" USING btree ("workspace_id","expires_at") WHERE "widget_sessions"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "agent_evaluation_cases_suite_idx" ON "agent_evaluation_cases" USING btree ("workspace_id","suite_id");--> statement-breakpoint
CREATE INDEX "agent_versions_workspace_published_idx" ON "agent_versions" USING btree ("workspace_id","published_at");--> statement-breakpoint
CREATE INDEX "agents_workspace_created_idx" ON "agents" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "agents_active_status_idx" ON "agents" USING btree ("workspace_id","status") WHERE "agents"."archived_at" IS NULL;--> statement-breakpoint
CREATE INDEX "approval_events_approval_created_idx" ON "approval_events" USING btree ("workspace_id","approval_id","created_at");--> statement-breakpoint
CREATE INDEX "approvals_pending_idx" ON "approvals" USING btree ("workspace_id","expires_at") WHERE "approvals"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "approvals_status_idx" ON "approvals" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "audit_events_workspace_occurred_idx" ON "audit_events" USING btree ("workspace_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_resource_idx" ON "audit_events" USING btree ("workspace_id","resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "notifications_recipient_idx" ON "notifications" USING btree ("workspace_id","recipient_user_id","status");--> statement-breakpoint
CREATE INDEX "notifications_workspace_member_idx" ON "notifications" USING btree ("workspace_id","recipient_user_id");--> statement-breakpoint
CREATE INDEX "credit_ledger_account_created_idx" ON "credit_ledger_entries" USING btree ("workspace_id","account_id","created_at");--> statement-breakpoint
CREATE INDEX "credit_reservations_account_status_idx" ON "credit_reservations" USING btree ("workspace_id","account_id","status");--> statement-breakpoint
CREATE INDEX "usage_events_workspace_occurred_idx" ON "usage_events" USING btree ("workspace_id","occurred_at");--> statement-breakpoint
CREATE INDEX "deployment_origins_deployment_idx" ON "deployment_origins" USING btree ("workspace_id","deployment_id");--> statement-breakpoint
CREATE INDEX "deployment_releases_deployment_idx" ON "deployment_releases" USING btree ("workspace_id","deployment_id","published_at");--> statement-breakpoint
CREATE INDEX "deployments_active_idx" ON "deployments" USING btree ("workspace_id","environment") WHERE "deployments"."status" = 'active';--> statement-breakpoint
CREATE INDEX "deployments_status_idx" ON "deployments" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "deployment_readiness_checks_blocking_idx" ON "deployment_readiness_checks" USING btree ("workspace_id","status") WHERE "deployment_readiness_checks"."blocking" = true;--> statement-breakpoint
CREATE INDEX "deployment_readiness_reports_deployment_generated_idx" ON "deployment_readiness_reports" USING btree ("workspace_id","deployment_id","generated_at");--> statement-breakpoint
CREATE INDEX "fde_implementation_records_workspace_environment_idx" ON "fde_implementation_records" USING btree ("workspace_id","environment","status");--> statement-breakpoint
CREATE INDEX "support_access_grants_active_idx" ON "support_access_grants" USING btree ("workspace_id","expires_at") WHERE "support_access_grants"."status" IN ('approved', 'active');--> statement-breakpoint
CREATE INDEX "sessions_user_expiry_idx" ON "sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "sessions_active_idx" ON "sessions" USING btree ("user_id","expires_at") WHERE "sessions"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "workspace_invitations_workspace_email_idx" ON "workspace_invitations" USING btree ("workspace_id","email");--> statement-breakpoint
CREATE INDEX "workspace_invitations_pending_idx" ON "workspace_invitations" USING btree ("workspace_id","email","expires_at") WHERE "workspace_invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "workspace_members_workspace_idx" ON "workspace_members" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_members_user_idx" ON "workspace_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workspaces_owner_idx" ON "workspaces" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "agent_version_tools_workspace_idx" ON "agent_version_tools" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "tool_definitions_status_idx" ON "tool_definitions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "encrypted_credentials_workspace_idx" ON "encrypted_credentials" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "integration_connections_provider_idx" ON "integration_connections" USING btree ("workspace_id","provider");--> statement-breakpoint
CREATE INDEX "integration_connections_status_idx" ON "integration_connections" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "integration_connections_active_idx" ON "integration_connections" USING btree ("workspace_id","provider") WHERE "integration_connections"."status" IN ('connected', 'degraded');--> statement-breakpoint
CREATE INDEX "conversations_workspace_created_idx" ON "conversations" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_conversation_created_idx" ON "messages" USING btree ("workspace_id","conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "run_events_run_occurred_idx" ON "run_events" USING btree ("workspace_id","run_id","occurred_at");--> statement-breakpoint
CREATE INDEX "run_steps_run_idx" ON "run_steps" USING btree ("workspace_id","run_id","sequence");--> statement-breakpoint
CREATE INDEX "runs_correlation_idx" ON "runs" USING btree ("workspace_id","correlation_id");--> statement-breakpoint
CREATE INDEX "runs_state_idx" ON "runs" USING btree ("workspace_id","state");--> statement-breakpoint
CREATE INDEX "runs_created_idx" ON "runs" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "runs_queued_idx" ON "runs" USING btree ("workspace_id","created_at") WHERE "runs"."state" = 'queued';--> statement-breakpoint
CREATE INDEX "tool_operations_run_status_idx" ON "tool_operations" USING btree ("workspace_id","run_id","status");--> statement-breakpoint
CREATE INDEX "workflow_runs_status_idx" ON "workflow_runs" USING btree ("workspace_id","status","created_at");--> statement-breakpoint
CREATE INDEX "workflow_triggers_workflow_status_idx" ON "workflow_triggers" USING btree ("workspace_id","workflow_id","status");--> statement-breakpoint
CREATE INDEX "workflows_workspace_status_idx" ON "workflows" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_source_idx" ON "knowledge_chunks" USING btree ("workspace_id","source_id");--> statement-breakpoint
CREATE INDEX "knowledge_sources_status_idx" ON "knowledge_sources" USING btree ("workspace_id","status","created_at");--> statement-breakpoint
CREATE INDEX "payment_events_provider_status_idx" ON "payment_events" USING btree ("provider","status");--> statement-breakpoint
CREATE INDEX "payment_orders_workspace_status_idx" ON "payment_orders" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_pending_idx" ON "webhook_deliveries" USING btree ("workspace_id","next_attempt_at") WHERE "webhook_deliveries"."status" IN ('pending', 'retrying');--> statement-breakpoint
CREATE INDEX "webhook_endpoints_workspace_status_idx" ON "webhook_endpoints" USING btree ("workspace_id","status");