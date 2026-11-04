# AgentFlow OS — Database Schema Reference

## Document Information
- **Package**: `@agentflow/database`
- **Target Engine**: PostgreSQL 16.4+
- **ORM / Migrator**: Drizzle ORM / Drizzle Kit
- **Status**: Production Baseline (Stage 04)

---

## 1. Architectural Foundations

### 1.1 PostgreSQL as Source of Truth
PostgreSQL owns all platform entities: identities, workspaces, logical agents, immutable versions, tool contracts, integrations, deployments, conversations, runs, approval records, workflows, knowledge metadata, credit accounting, payment logs, audit trails, and Forward Deployed Engineering (FDE) operational records.
- Redis is reserved for transient BullMQ worker queues, locks, rate limits, and caching.
- MinIO / S3 owns binary media and large payloads; database stores content hashes and storage keys.
- LangGraph checkpoints synchronize into PostgreSQL checkpointer tables, anchored by workspace and run ownership.

### 1.2 Tenancy and Composite Keys
Every tenant-owned table features `workspace_id UUID NOT NULL` (or `id` on `workspaces`). All child records reference parent resources using tenant-aware composite foreign keys:
`(workspace_id, parent_id) REFERENCES parent_table(workspace_id, id)`.
This prevents cross-tenant references at the foreign key level.

### 1.3 Immutability Safeguards
Critical audit, version, and financial evidence cannot be mutated or deleted:
- `agent_versions`
- `workflow_versions`
- `approval_events`
- `credit_ledger_entries`
- `payment_events`
- `audit_events`
- `run_events`

PostgreSQL triggers (`prevent_agentflow_append_only_mutation()`) intercept any `UPDATE` or `DELETE` on these tables and raise an exception (`55000: Append-only evidence table cannot be updated or deleted`).

### 1.4 Vector Storage & pgvector Migration Path
Currently, `knowledge_chunks.embedding` stores embeddings as `jsonb` array of floats (`number[]`) to allow clean developer startup without requiring the optional `pgvector` extension.
**Migration path to pgvector**:
1. When enabling semantic vector indexing in production, execute `CREATE EXTENSION IF NOT EXISTS vector;`.
2. Issue migration: `ALTER TABLE knowledge_chunks ADD COLUMN embedding_vec vector(1536);`.
3. Backfill: `UPDATE knowledge_chunks SET embedding_vec = embedding::text::vector;`.
4. Create HNSW or IVFFlat index: `CREATE INDEX knowledge_chunks_vec_idx ON knowledge_chunks USING hnsw (embedding_vec vector_cosine_ops) WHERE deleted_at IS NULL;`.

### 1.5 Administrative Data Retention & Compliance Erasure
Standard application roles (`agentflow_app`) cannot delete or update append-only evidence. For legal GDPR/CCPA erasure or scheduled data lifecycle purges, an authorized compliance administrator running with superuser privileges executes:
```sql
BEGIN;
SET session_replication_role = 'replica';
-- Targeted compliance erasure
DELETE FROM audit_events WHERE workspace_id = $target_workspace;
SET session_replication_role = 'origin';
COMMIT;
```

---

## 2. Table Inventory (48 Tables)

### Domain 1: Identity and Workspace Management (6 tables)
- `users`: Global platform user identity. Primary key `id UUID`. Unique `email`.
- `workspaces`: Tenant root. Primary key `id UUID`. Unique `slug`. Owner foreign key to `users(id) ON DELETE RESTRICT`. Plan enum: `free`, `pro`, `team`, `enterprise`.
- `oauth_accounts`: Third-party identity bindings (Google OAuth). Foreign key to `users(id) ON DELETE CASCADE`. Unique on `(provider, provider_subject)`.
- `sessions`: Authenticated user sessions. Stores `session_token_hash` (SHA-256), `user_id`, optional active `workspace_id`, `expires_at`, `revoked_at`.
- `workspace_members`: Workspace memberships and RBAC. Composite unique on `(workspace_id, user_id)` and `(workspace_id, id)`. Roles: `owner`, `admin`, `member`, `viewer`.
- `workspace_invitations`: Team invitations. Stores `token_hash` (SHA-256), `email`, `role`, `expires_at`, `accepted_at`. Composite foreign key to `workspace_members(workspace_id, user_id)`.

### Domain 2: Agents and Immutable Versions (5 tables)
- `agents`: Logical agent definition. Scoped to `workspace_id`. Draft configuration stored in `current_draft JSONB`. Status: `draft`, `published`, `archived`. Soft-deletable via `archived_at`.
- `agent_versions`: Immutable published snapshots. Composite unique on `(workspace_id, agent_id, version_number)`. Stores canonical JSON snapshot `config_snapshot` and SHA-256 `snapshot_hash`. Append-only trigger protected.
- `agent_evaluation_suites`: Test suites for prompt and model validation. Scoped to workspace and agent.
- `agent_evaluation_cases`: Input/expected test cases for evaluation suites.
- `agent_evaluation_results`: Historical test run outcomes. Foreign keys to suite, version, and case. Check constraint `score BETWEEN 0 AND 100`.

### Domain 3: Tool Registry (2 tables)
- `tool_definitions`: Global tool catalogue. Primary key `id UUID`. Unique `(tool_key, version)`. Risk classification enum (`read`, `write`, `external_side_effect`, `high_impact`), side-effect enum, input/output JSON schemas, timeout metadata.
- `agent_version_tools`: Tool assignment to immutable agent versions. Composite unique on `(workspace_id, agent_version_id, tool_definition_id)`.

### Domain 4: Integrations and Secret Metadata (2 tables)
- `integration_connections`: Workspace-connected external accounts (Google, Meta, Razorpay). Stores `external_account_ref`, `granted_scopes`, connection status, health check timestamps.
- `encrypted_credentials`: AES-256-GCM encrypted secrets. Stores `ciphertext`, `iv`, `auth_tag`, `key_reference`, `key_version`, rotation timestamps. Secrets are never stored in plaintext.

### Domain 5: Deployments and Releases (3 tables)
- `deployments`: Published runtime channels (`web`, `widget`, `api`, `webhook`, `scheduler`) across environments (`development`, `staging`, `production`). References `active_version_id`.
- `deployment_origins`: Verified allowed CORS/embedding origins for widget sessions. Unique on `(workspace_id, origin)`.
- `deployment_releases`: Immutable historical release log with configuration and policy snapshots. Supports zero-downtime rollback by pointing deployments to prior versions.

### Domain 6: API Keys and Widget Sessions (2 tables)
- `api_keys`: Workspace programmatic keys. Stores SHA-256 `secret_hash`, `display_prefix`, scopes, expiration, and revocation dates.
- `widget_sessions`: Ephemeral browser visitor sessions. Stores SHA-256 `session_token_hash`, verified `origin`, expiration, and deployment linkage.

### Domain 7: Runtime Execution & Conversations (6 tables)
- `conversations`: Chat sessions with end-users or external systems. Scoped to workspace, agent, and deployment.
- `messages`: Chronological conversation messages with sequence numbering, message roles (`system`, `user`, `assistant`, `tool`), model metadata, and tool call traces.
- `runs`: Durable execution records for background worker tasks. States: `queued`, `initializing`, `running`, `waiting_for_approval`, `succeeded`, `failed`, `cancelled`, `expired`, `blocked`, `reconciliation_required`, `dead_lettered`. Stores idempotency key, correlation ID, trace ID, worker lease locks, and checkpoint thread references.
- `run_steps`: Granular execution steps (planning, model call, policy gate, connector execution). Sequence numbered with timestamps.
- `run_events`: Append-only event stream for client SSE updates and historical execution replay. Unique `(workspace_id, run_id, sequence)`.
- `tool_operations`: Side-effect execution ledger. Stores SHA-256 `payload_hash`, operation key, tool key, and provider operation reference.

### Domain 8: Approvals Engine (2 tables)
- `approvals`: Human-in-the-loop approval gate. Holds paused tool operations until approved, rejected, expired, or consumed. Single-use consumption enforced via `consumed_at`.
- `approval_events`: Append-only decision log recording actor, decision, reason, and timestamps.

### Domain 9: Workflows (4 tables)
- `workflows`: Multi-step DAG orchestration definitions.
- `workflow_versions`: Immutable published DAG graph snapshots with content hashes.
- `workflow_triggers`: Webhook, schedule, API, or manual triggers.
- `workflow_runs`: Execution runs linked to immutable workflow versions.

### Domain 10: Knowledge Management (2 tables)
- `knowledge_sources`: Ingested documents, FAQs, and URLs.
- `knowledge_chunks`: Parsed and chunked text passages with embedding representations and source citations.

### Domain 11: Billing & Usage (4 tables)
- `credit_accounts`: Workspace currency accounts. Stores cached balance; ledger entries remain authoritative.
- `credit_ledger_entries`: Double-entry append-only transaction ledger (`grant`, `purchase`, `hold`, `consume`, `release`, `refund`, `adjustment`). Unique idempotency keys per workspace.
- `credit_reservations`: Pre-run holds (`held_amount`) with atomic settlement (`settled_amount <= held_amount`).
- `usage_events`: Raw resource metering facts (model tokens, tool calls, storage).

### Domain 12: Payments (2 tables)
- `payment_orders`: Checkout orders created for Razorpay gateway.
- `payment_events`: Idempotent webhook event inbox with raw payloads, HMAC signature verification status, and unique `provider_event_id` constraint.

### Domain 13: Webhooks (2 tables)
- `webhook_endpoints`: Customer outbound webhook destinations with secret hashes and event subscriptions.
- `webhook_deliveries`: Outbound delivery attempt history with backoff scheduling and status codes.

### Domain 14: Audit & Notifications (2 tables)
- `audit_events`: Permanent compliance audit trail recording actor, action, resource, and metadata. Protected against deletion.
- `notifications`: Workspace member notification inbox with read/unread statuses.

### Domain 15: Forward Deployed Engineering (FDE) (4 tables)
- `fde_implementation_records`: Customer enterprise onboarding and site implementation tracking (FR-FDE-001).
- `deployment_readiness_reports`: Automated readiness evaluation reports across staging and production (FR-FDE-002, FR-FDE-003, FR-FDE-005).
- `deployment_readiness_checks`: Granular blocking and warning checks with diagnostic evidence and remediation steps (FR-FDE-003).
- `support_access_grants`: Time-limited, approved, reason-coded customer support access grants with full audit trail (FR-FDE-007).
