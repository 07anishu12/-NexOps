# AgentFlow OS — Architecture Decision Records (ADRs)

**Document Version**: 1.0  
**Baseline Date**: 2026-11-01  
**Status**: Binding Architectural Decisions  
**Governing Authority**: Master Operating Contract & AgentFlow OS PRD (Section 10 & 35)  

---

## Index of Decisions

- [ADR-001: Monorepo and Package Manager Strategy](#adr-001-monorepo-and-package-manager-strategy)
- [ADR-002: Workspace Tenancy and Database Enforcement Strategy](#adr-002-workspace-tenancy-and-database-enforcement-strategy)
- [ADR-003: Authentication, Session Management, and OAuth Account Model](#adr-003-authentication-session-management-and-oauth-account-model)
- [ADR-004: Agent Version Immutability and Deployment Release Semantics](#adr-004-agent-version-immutability-and-deployment-release-semantics)
- [ADR-005: LangGraph Adapter and Checkpoint Persistence](#adr-005-langgraph-adapter-and-checkpoint-persistence)
- [ADR-006: Queue, Outbox, and Worker Lease Strategy](#adr-006-queue-outbox-and-worker-lease-strategy)
- [ADR-007: Public Widget Session and Origin Security Model](#adr-007-public-widget-session-and-origin-security-model)
- [ADR-008: Tool Schema, Registry, and Policy Enforcement](#adr-008-tool-schema-registry-and-policy-enforcement)
- [ADR-009: Approval Payload Canonicalization and Consume-Once Mechanism](#adr-009-approval-payload-canonicalization-and-consume-once-mechanism)
- [ADR-010: Provider Secret Encryption and Key Rotation](#adr-010-provider-secret-encryption-and-key-rotation)
- [ADR-011: Usage Measurement, Reservation, and Credit Ledger](#adr-011-usage-measurement-reservation-and-credit-ledger)
- [ADR-012: Webhook Signature, Transactional Inbox, and Retry Semantics](#adr-012-webhook-signature-transactional-inbox-and-retry-semantics)
- [ADR-013: Event Stream Transport and Retention](#adr-013-event-stream-transport-and-retention)
- [ADR-014: Knowledge Retrieval Storage and Tenant Isolation](#adr-014-knowledge-retrieval-storage-and-tenant-isolation)
- [ADR-015: Observability, Secret Redaction, and Data Retention](#adr-015-observability-secret-redaction-and-data-retention)
- [ADR-016: Deployment Rollback and Environment Promotion](#adr-016-deployment-rollback-and-environment-promotion)
- [ADR-017: Public SDK Compatibility and Semantic Versioning](#adr-017-public-sdk-compatibility-and-semantic-versioning)
- [ADR-018: Public Repository License and Contribution Policy](#adr-018-public-repository-license-and-contribution-policy)
- [ADR-019: Architectural Dependency Boundaries and Browser Isolation](#adr-019-architectural-dependency-boundaries-and-browser-isolation)
- [ADR-020: Local Infrastructure and Stage Sequencing](#adr-020-local-infrastructure-and-stage-sequencing)
- [ADR-021: Database Access Layer, Discriminated Tenant Context, and RLS Hardening](#adr-021-database-access-layer-discriminated-tenant-context-and-rls-hardening)
- [ADR-022: Standalone Fastify API Architecture and Production Operational Middleware](#adr-022-standalone-fastify-api-architecture-and-production-operational-middleware)
- [ADR-023: Production Authentication, Google OAuth, and Session Management](#adr-023-production-authentication-google-oauth-and-session-management)
- [ADR-024: Multi-Tenant Workspace Management, 5-Role RBAC Model, and Secure Single-Use Invitations](#adr-024-multi-tenant-workspace-management-5-role-rbac-model-and-secure-single-use-invitations)

---

## ADR-001: Monorepo and Package Manager Strategy

### Context
AgentFlow OS comprises 5 independent deployable applications (`web`, `api`, `worker`, `widget`, `docs`) and 12 shared packages (`contracts`, `config`, `database`, `domain`, `auth`, `policy`, `runtime`, `integrations`, `billing`, `observability`, `ui`, `sdk`). We need deterministic builds, dependency isolation, shared type definitions without cross-app relative imports, and independent deployability for each application.

### Decision
Adopt **pnpm workspaces** orchestrated by **Turborepo** with strict TypeScript (`strict: true`, `NodeNext`/`bundler` module resolution) across all packages and apps.
- Internal packages are named under `@agentflow/*` (e.g. `@agentflow/contracts`, `@agentflow/config`, `@agentflow/database`).
- Applications consume internal packages via `workspace:*` references.
- No application may directly import code from another application via relative paths.
- Each application (`apps/web`, `apps/api`, `apps/worker`, `apps/widget`, `apps/docs`) retains independent build scripts (`pnpm --filter <app> build`) and Dockerfiles.

### Consequences
- Build caching is managed deterministically through `turbo.json`.
- Package dependency order is enforced during compilation and testing.
- Type errors in shared contracts immediately propagate across both frontend and backend consumers.

### Security Impact
Prevents bundle pollution and credential leakage across server-only worker packages and browser widget bundles.

### Migration Path
Standard pnpm workspace tooling allows migrating individual packages or apps to separate repositories in the future if team boundaries require it, without altering code contracts.

---

## ADR-002: Workspace Tenancy and Database Enforcement Strategy

### Context
AgentFlow OS is a multi-tenant platform where workspace isolation is critical. Accidental cross-tenant leakage of runs, agents, chat history, or credentials is a catastrophic failure.

### Decision
Enforce a defense-in-depth tenancy model combining PostgreSQL schema design and application-level authorization:
1. Every tenant-owned table includes a non-nullable `workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE`.
2. Composite primary or unique keys incorporate `workspace_id` (e.g. `PRIMARY KEY (workspace_id, id)`).
3. Database queries in repositories require an explicit `WorkspaceContext` containing the verified tenant identifier.
4. Row-Level Security (RLS) policies are configured at the database tier using `SET LOCAL app.current_workspace_id`.
5. API middleware verifies user membership in the requested workspace before invoking any service layer.

### Consequences
- Direct primary-key lookups without `workspace_id` are prohibited by repository interfaces.
- Cross-tenant queries are blocked both at the ORM/repository level and database engine level.

### Security Impact
Guarantees absolute data isolation between competing tenant organizations.

---

## ADR-003: Authentication, Session Management, and OAuth Account Model

### Context
Users sign in via Google OAuth. The system must support multi-workspace memberships, workspace switching, secure API key access, and prevent credential exposure to browser storage.

### Decision
- Browser control plane uses HTTP-only, `Secure`, `SameSite=Lax` encrypted session cookies.
- Provider OAuth access/refresh tokens are never stored in browser cookies or LocalStorage; they are encrypted server-side in the credentials vault.
- Workspace context is stored in the authenticated session state; switching workspaces issues an authenticated context refresh verified against `workspace_members`.
- Programmatic API access uses cryptographically generated API keys (`af_live_...` / `af_test_...`) hashed with SHA-256 before storage in PostgreSQL.

### Consequences
- Browser clients cannot access raw OAuth tokens or API secrets.
- Session hijacking risk is minimized through rotating session identifiers and secure cookie attributes.

---

## ADR-004: Agent Version Immutability and Deployment Release Semantics

### Context
Changes to agent prompts, models, tool allowlists, or system instructions must not mutate active production deployments unpredictably.

### Decision
- An agent has an active editable `draft` state and an append-only collection of immutable `published_versions`.
- Publishing an agent calculates a deterministic SHA-256 hash of the complete canonical configuration JSON (instructions, model parameters, tool IDs, policies, environment variables).
- Published versions are strictly immutable: `UPDATE` and `DELETE` on published records are prohibited by database constraints.
- Deployments (`apps/widget`, API endpoints, webhooks) reference a specific `version_id`, not an editable draft.
- Rollback is accomplished instantaneously by updating the deployment pointer to a prior immutable `version_id`.

### Consequences
- Auditability is mathematically guaranteed.
- Production incidents can be remediated in seconds by reverting deployment version pointers.

---

## ADR-005: LangGraph Adapter and Checkpoint Persistence

### Context
Agent execution involves multi-step reasoning, external tool calls, and human-in-the-loop approval pauses. Runs must survive process restarts and worker crashes without losing state.

### Decision
- Encapsulate the execution engine behind an internal `@agentflow/runtime` adapter using **LangGraph.js**.
- Define an explicit graph topology: `receive_input -> resolve_context -> plan -> evaluate_policy -> execute_tool -> human_approval_interrupt -> synthesize_response`.
- Persist thread checkpoints in PostgreSQL using a dedicated checkpointer table (`checkpoints` and `checkpoint_blobs`).
- Long-running execution runs inside `apps/worker` via background queues, completely decoupled from HTTP request lifecycles.

### Consequences
- Runs interrupted for human approval can safely hibernate for hours or days without consuming memory or worker resources.
- Worker process crashes allow the next worker to resume from the last persisted checkpoint.

---

## ADR-006: Queue, Outbox, and Worker Lease Strategy

### Context
Asynchronous jobs (agent runs, webhook deliveries, scheduled tasks) must be delivered reliably without silent message loss or unbounded duplicate execution.

### Decision
- Use **Redis + BullMQ** for fast, resilient job queues with concurrency limits and backoff retries.
- Implement a **Transactional Outbox** pattern in PostgreSQL: operations that initiate jobs write an `outbox` record in the same database transaction as the business state change.
- Workers acquire short-lived distributed leases (heartbeats) on active runs. If a worker dies without completing or updating heartbeat within `JOB_LOCK_DURATION_MS`, the run is marked for stale reconciliation.
- Terminal run states (`succeeded`, `failed`, `cancelled`, `expired`) cannot be overwritten by stale workers.

### Consequences
- Decouples API response latency from background worker execution.
- Eliminates ghost runs and zombie worker locks.

---

## ADR-007: Public Widget Session and Origin Security Model

### Context
The website widget (`apps/widget`) is embedded on customer websites and is exposed to the public internet. It must not have access to workspace owner secrets or privileged tools.

### Decision
- Public widget communication requires an ephemeral runtime session token generated against a specific `deployment_id`.
- The API gateway validates incoming requests against the customer's registered `allowed_origins` using strict `Origin` and `Referer` matching.
- Public sessions are restricted to a locked tool allowlist configured explicitly for that deployment. Privileged owner tools (e.g. Gmail send, database mutate) are denied by default.
- Per-session and per-IP rate limits are enforced via Redis sliding window counters.

### Consequences
- Compromise of a browser widget token cannot compromise the workspace control plane or private integrations.
- Cross-origin embedding is controlled strictly by customer configuration.

---

## ADR-008: Tool Schema, Registry, and Policy Enforcement

### Context
AI agents propose tool calls based on model reasoning. Untrusted model outputs must never directly invoke external APIs without deterministic backend authorization.

### Decision
- All tools must be registered in `@agentflow/policy` with typed Zod schemas for `inputSchema` and `outputSchema`.
- Every tool is tagged with a mandatory risk classification: `read`, `write`, `external_side_effect`, or `high_impact`.
- Tool invocation flows through a deterministic Policy Engine:
  `LLM Proposed Tool -> Policy Gate (Check Deployment Allowlist & Quota) -> Risk Check -> Approval Interruption (if required) -> Connector Execution`.
- Models have zero ability to execute arbitrary code or bypass policy rules.

### Consequences
- Prevents prompt injection attacks from triggering unreviewed external actions.
- Enforces uniform logging, parameter validation, and rate limiting across all tools.

---

## ADR-009: Approval Payload Canonicalization and Consume-Once Mechanism

### Context
Sensitive operations (sending emails, modifying calendars, publishing posts, initiating payments) require human-in-the-loop approval. The approval process must prevent payload tampering, double approvals, and replay attacks.

### Decision
- When an agent requests an action requiring approval, the runtime pauses execution and creates an append-only `approval_requests` record.
- The approval payload is serialized into canonical JSON and hashed with SHA-256 (`payload_hash`).
- Approvals use a strict state machine: `pending -> approved | rejected | expired`.
- Single-use consumption is enforced atomically in PostgreSQL:
  `UPDATE approval_requests SET status = 'approved', consumed_at = NOW(), resolved_by = $user WHERE id = $id AND status = 'pending' AND payload_hash = $expected_hash`.
- Replayed approval clicks or modified parameters fail immediately.

### Consequences
- Guaranteed protection against race conditions and concurrent double-execution.
- Full cryptographic audit trail of what was approved and by whom.

---

## ADR-010: Provider Secret Encryption and Key Rotation

### Context
AgentFlow OS stores sensitive third-party tokens (Google OAuth refresh tokens, Meta access tokens, Razorpay API secrets). Plaintext storage in PostgreSQL is unacceptable.

### Decision
- Secrets are encrypted at rest using AES-256-GCM envelope encryption.
- The encryption key is sourced from `ENCRYPTION_KEY_REFERENCE` (KMS or secure environment configuration).
- Encrypted payloads store the ciphertext, initialization vector (IV), authentication tag, and a `key_version` identifier:
  `{ ciphertext, iv, auth_tag, key_version }`.
- Key rotation is supported by decrypting with the matching `key_version` and re-encrypting with the active key.
- Decrypted secrets exist only in server memory within the connector execution boundary; they are never sent to the browser or logged.

### Consequences
- Database dumps or read-only SQL access will not expose external provider secrets.
- Cryptographic integrity checks prevent ciphertext tampering.

---

## ADR-011: Usage Measurement, Reservation, and Credit Ledger

### Context
AI model calls and external tool executions incur real financial costs. A customer must not exceed their credit balance or incur unauthorized overdrafts.

### Decision
- Implement an append-only, double-entry `credit_ledger` in PostgreSQL.
- Two-phase credit reservation model:
  1. **Hold**: Before an agent run starts, the system calculates estimated maximum cost and places a `HOLD` on workspace credits.
  2. **Settle**: When the run completes, actual token and tool usage is calculated, the exact credit amount is `CONSUMED`, and any unused hold is released.
  3. **Release**: If a run fails or is aborted before invoking models, the hold is released in full.
- Insufficient balance rejects the run immediately at the API gateway before worker scheduling.

### Consequences
- Eliminates race conditions where concurrent runs overdraft an account.
- Provides customers with an itemized, auditable billing history.

---

## ADR-012: Webhook Signature, Transactional Inbox, and Retry Semantics

### Context
Incoming webhooks (e.g. Razorpay payment confirmations, Meta messaging events) must be processed reliably without duplicate side effects or fake payloads.

### Decision
- Webhook routes capture the **raw binary request body** before JSON parsing to compute HMAC signatures.
- Webhook payloads are written to a PostgreSQL `webhook_inbox` table with status `received` and unique provider event ID constraint (`provider_event_id UNIQUE`).
- Duplicate deliveries with the same provider event ID are acknowledged with HTTP 200 and ignored.
- Processing occurs asynchronously via BullMQ workers with exponential backoff retries.

### Consequences
- Replay attacks and provider duplicate dispatches do not result in double crediting or duplicate processing.
- Webhook ingestion cannot be blocked by slow downstream processing.

---

## ADR-013: Event Stream Transport and Retention

### Context
Users require real-time updates during agent runs (thinking steps, tool calls, streaming text tokens, approval requests).

### Decision
- Use **Server-Sent Events (SSE)** over HTTP/2 for client event streaming (`apps/web` and `apps/widget`).
- Event envelopes conform to a strict schema: `{ id, runId, type, sequence, timestamp, data }`.
- Events are persisted to PostgreSQL in the `run_events` table for historical audit, playback, and FDE diagnostics.
- Clients can reconnect and resume streaming from a specific `last_event_id`.

### Consequences
- Lightweight, firewall-friendly streaming without WebSocket state management overhead.
- Historical run traces can be inspected post-facto identically to real-time execution.

---

## ADR-014: Knowledge Retrieval Storage and Tenant Isolation

### Context
Agent knowledge bases include ingested private documents, FAQs, and domain guides. Search results must never cross tenant boundaries.

### Decision
- Document ingestion extracts text, generates chunks, and stores embeddings using pgvector or a dedicated vector database with mandatory `workspace_id` metadata.
- All vector search queries strictly enforce `WHERE workspace_id = $workspace_id AND agent_id = $agent_id`.
- Knowledge chunks include source citations (filename, page/section, excerpt) returned to the agent for grounded responses.

### Consequences
- Vector queries cannot leak data across workspaces even in cases of fuzzy embedding collisions.
- Citations provide explainability for AI responses.

---

## ADR-015: Observability, Secret Redaction, and Data Retention

### Context
Production operations and forward deployed engineering require deep diagnostic traces, but traces must never leak PII, OAuth tokens, or confidential prompts.

### Decision
- Standardize on **OpenTelemetry (OTel)** for traces and metrics across `apps/web`, `apps/api`, and `apps/worker`.
- Implement a centralized structured JSON logging pipeline with a strict **secret redaction filter** that automatically masks patterns matching API keys, JWTs, bearer tokens, passwords, and authorization headers.
- Establish configurable retention policies: raw run events and debug traces expire after 30 days; immutable audit records and billing transactions are retained indefinitely.

### Consequences
- Unified telemetry across distributed components without compromising security or regulatory compliance.

---

## ADR-016: Deployment Rollback and Environment Promotion

### Context
Forward deployed engineers manage customer deployments across `development`, `staging`, and `production` environments. Bugs in new prompt versions must be instantaneously reversible.

### Decision
- Deployments decouple configuration from agent version:
  `Deployment = { id, workspace_id, environment, agent_version_id, config_overrides, status }`.
- Promoting an agent from Staging to Production updates the Production deployment's `agent_version_id` to the validated version.
- Instant rollback simply points `agent_version_id` back to the previous known good version ID without rebuilding code or restarting processes.

### Consequences
- Zero-downtime, instantaneous rollbacks with complete audit trails of who promoted or rolled back each release.

---

## ADR-017: Public SDK Compatibility and Semantic Versioning

### Context
External developers and enterprise customers integrate AgentFlow OS into their existing systems via Node and Browser SDKs. Breaking changes to SDK interfaces damage trust and developer experience.

### Decision
- The public REST API (`/api/v1/`) and SDKs (`@agentflow/sdk-node`, `@agentflow/sdk-browser`) adhere to strict **Semantic Versioning (SemVer 2.0.0)**.
- All API request and response bodies are defined in `@agentflow/contracts` using Zod and exported as OpenAPI 3.1 specifications.
- SDK clients are typed directly against these shared contracts. Breaking changes require a major version bump (`/api/v2/`).

### Consequences
- Enterprise customers receive stable, predictable interfaces with automated compile-time type safety.

---

## ADR-018: Public Repository License and Contribution Policy

### Context
AgentFlow OS is developed as a public, production-grade engineering showcase and open ecosystem platform.

### Decision
- License repository under the **Apache License 2.0**, allowing commercial adoption while providing explicit patent grants.
- Establish standard community hygiene files: `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, and `LICENSE`.
- Security vulnerabilities must be reported through private advisory channels specified in `SECURITY.md`, never public issues.

### Consequences
- Encourages external developer contributions and public verification while protecting platform integrity.

---

## ADR-019: Architectural Dependency Boundaries and Browser Isolation

### Context
In a multi-tenant monorepo serving web frontends (`apps/web`), embeddable public widgets (`apps/widget`), and backend worker runtimes (`apps/worker`), improper package dependencies could allow database credentials, direct SQL drivers (`pg`, `drizzle-orm`), or third-party secret decryption routines to be bundled into client-side browser bundles. Furthermore, uncontrolled inter-package imports risk circular dependency deadlocks and brittle builds.

### Decision
1. **Strict Client-Side Isolation**:
   - `apps/web` and `apps/widget` are strictly forbidden from declaring dependencies on `@agentflow/database` or direct database drivers (`pg`, `mysql2`, `drizzle-orm`).
   - Browser applications may only interact with database state via HTTP API Route Handlers or Server Actions that invoke domain/application layers.
2. **Circular Dependency Prohibition**:
   - The monorepo dependency graph must form a strict Directed Acyclic Graph (DAG).
   - Core contracts (`@agentflow/contracts`) and configuration (`@agentflow/config`) must never depend on higher-level domain, runtime, or integration packages.
3. **Cross-App Import Prohibition**:
   - Applications (`apps/*`) must never import code from sibling applications via relative paths (e.g. `../../apps/web/...`). All shared logic must live in `@agentflow/*` packages.
4. **Automated Continuous Enforcement**:
   - Architecture boundary rules are verified continuously in CI via `pnpm test:architecture` (`tests/architecture/dependency-rules.test.ts`).

### Consequences
- Prevents database connection strings, encryption keys, and provider secrets from leaking to the browser.
- Guarantees modular, independent deployability for all 5 applications.
- Enforces strict unidirectional dependency flow across all 12 shared packages.

### Security Impact
Critical mitigation against credential leakage, bundle bloat, and unauthorized client-side SQL execution.

### Migration Path
Any package or app requiring shared functionality must extract it into an existing or new `@agentflow/*` workspace package rather than coupling directly across application boundaries.

## ADR-020: Local Infrastructure and Stage Sequencing

### Context
The approved application boundaries are five independent deployables (`apps/web`, `apps/api`, `apps/worker`, `apps/widget`, and `apps/docs`) plus the twelve existing shared packages. The current 40-stage product ledger names the PostgreSQL schema as Stage 03, while the current implementation prompt names reproducible local infrastructure as Stage 03 and PostgreSQL schema work as the next stage. Local development also needs PostgreSQL, Redis and S3-compatible storage without requiring external provider credentials.

### Decision
- Preserve all existing application and shared-package boundaries; local infrastructure is repository-level and is not an application.
- Keep the original 40-stage product ledger as historical/product roadmap evidence and add a prompt-execution overlay for this delivery sequence. The next implementation step after this work is the PostgreSQL schema and Drizzle migration baseline.
- Use a root Docker Compose project named `agentflow-local` with pinned PostgreSQL 16.4 Alpine, Redis 7.4.1 Alpine, and pinned `bitnamilegacy/minio:2024.10.29` / `bitnamilegacy/minio-client:2024.10.29` MinIO-compatible images. The dedicated bridge network, named volumes, health-based dependencies and loopback-only host ports remain explicit.
- Initialize the configured MinIO bucket in a separate idempotent `minio-init` service. Applications use the host-compatible `OBJECT_STORAGE_ENDPOINT`; containers use the predictable `minio` service name.
- Generate unique local-only database, session, encryption-reference and object-storage values only when `.env` does not exist. Never overwrite `.env`, print secret values, or commit it.
- Validate server configuration at startup and expose a separate public browser configuration shape. Optional provider credentials are not required for local infrastructure.

### Consequences
- A new developer can start the three local dependencies with one command and repeat readiness checks without arbitrary sleeps.
- Named volumes make normal shutdown non-destructive; reset requires an explicit confirmation flag and refuses staging/production environments.
- Live health evidence still depends on a running Docker daemon; static Compose validation and readiness logic can be checked without one.

### Security Impact
- Database and storage ports bind to localhost only, and browser configuration cannot contain database URLs, session secrets, provider credentials or integration modules.
- Setup and error messages redact credential-bearing values. Local generated credentials are not suitable for staging or production.
- The upstream `minio/minio` and `minio/mc` repositories were unavailable to anonymous pulls during live verification. The pinned Bitnami legacy images preserve the MinIO API, console and `mc` initialization flow; replace them with an internally mirrored/pinned image if a maintained image source is required later.

### Migration Path
Stage 04 can add Drizzle migrations and schema readiness checks using `DATABASE_URL` without changing the Compose service names, volumes or environment contract.

---

## ADR-021: Database Access Layer, Discriminated Tenant Context, and RLS Hardening

### Context
Stage 04 established the PostgreSQL 16.4 schema, 44 RLS policies, and append-only triggers. However, backend applications (`apps/api`, `apps/worker`) require a hardened, typed data access layer that makes it difficult for application developers to accidentally perform an unscoped query or accept unverified tenant parameters from untrusted clients. Tenant identity must be anchored exclusively to verified credentials across browser sessions, server API keys, public widget deployment tokens, and durable worker run leases.

### Decision
1. **Discriminated Tenant Context (`TrustedTenantContext`)**: Define a strict union covering `WorkspaceUserContext`, `ApiKeyContext`, `WidgetSessionContext`, `WorkerContext`, and `SystemContext`. Every context constructor validates UUIDs and rejects fabricated claims.
2. **Four Authentication Resolvers**:
   - `resolveSessionContext`: Validates session token hash, verifies expiry/revocation, resolves user, and checks active workspace membership.
   - `resolveApiKeyContext`: Extracts bearer token, performs constant-time SHA-256 hash match (`crypto.timingSafeEqual`), validates active status, expiry, and scopes.
   - `resolveWidgetSessionContext`: Verifies session token, checks active deployment status, and strictly validates the caller's origin against `deployment_origins` where `status = 'verified'`.
   - `resolveWorkerContext`: Resolves workspace ownership directly from the durable PostgreSQL `runs` row (`runs.workspaceId`), ignoring queue payload claims.
3. **Tenant-Scoped Repositories**: Encapsulate all database queries in 15 typed repositories extending `BaseRepository.withScopedTransaction()`. Repositories assert `@agentflow/auth` permissions and execute under `SET LOCAL ROLE agentflow_app` and transaction-local `SET LOCAL app.current_workspace_id`.
4. **Connection Pool Safety**: Enforce `is_local = true` on `set_config('app.current_workspace_id', ..., true)` ensuring that PostgreSQL automatically clears tenant variables upon transaction completion with zero pool leakage.

### Consequences
- Unscoped database queries are impossible through the repository layer.
- Unauthenticated or forged tenant requests fail closed before hitting database records.
- 24-point security integration test suite verifies isolation across all domains and entry paths.


---

## ADR-022: Standalone Fastify API Architecture and Production Operational Middleware

### Context
`apps/api` previously utilized a basic Node.js `http.createServer` prototype. To support high-throughput multi-tenant agent execution, distributed tracing, runtime schema validation, OpenAPI generation, rate limiting, and zero-downtime operations, a robust, standalone HTTP framework was required. Fastify v5 was selected for its high performance, rich ecosystem of security plugins, declarative schema compilation, and native in-process test injection (`inject()`).

### Decision
1. **Fastify v5 Standalone Architecture**: Migrate `apps/api` completely to Fastify v5. Decouple application compilation (`buildApp()`) from network binding (`startServer()`) to permit fast, isolated test injection without dynamic TCP sockets.
2. **Distributed Tracing & Correlation**: Implement `requestContextPlugin` extracting or generating `x-request-id`, `x-correlation-id`, and W3C `traceparent` (`parseTraceparent`). Echo tracing headers on all responses and attach high-resolution request duration to structured log events.
3. **Operational Probes**:
   - `GET /health`: Immediate liveness probe.
   - `GET /ready`: Readiness probe actively testing PostgreSQL (`SELECT 1`) and Redis (`PING`), returning 200 when healthy and 503 Service Unavailable when degraded.
   - `GET /v1/health` and `GET /api/v1/health`: Backward compatibility aliases.
4. **Tenant Context Integration**: Connect Stage 05 cryptographic resolvers (`resolveApiKeyContext`, `resolveSessionContext`, `resolveWidgetSessionContext`, `resolveWorkerContext`) in `tenantContextPlugin` pre-handler hook. Expose `requireTenantAuth(allowedRoles?)` to enforce tenancy boundaries and RBAC permissions.
5. **Standardized Contracts**: Enforce `@agentflow/contracts` schema models (`ApiSuccessEnvelope<T>` and `ApiErrorEnvelope`). Global error handler translates Zod validation errors, Fastify errors, auth failures, and rate limits into unified envelopes.
6. **Security & Operational Middleware**:
   - `@fastify/helmet` with strict security headers (nosniff, frameguard DENY, HSTS).
   - `@fastify/cors` with configurable origin allowlists derived from environment.
   - Distributed Redis rate-limiting plugin with fail-open fallback and standard 429 response formatting.
   - Automatic OpenAPI 3.0 generation at `/docs` (Swagger UI) and `/docs/json`.
7. **Graceful Shutdown**: Intercept `SIGTERM` and `SIGINT` signals, drain active Fastify requests, and gracefully terminate Redis and PostgreSQL connection pools.

### Consequences
- Fast, deterministic test suite (24 unit/integration tests running in ~2s via in-memory injection).
- Production-ready observability, security hardening, and rate limiting active out of the box.
- All future domain endpoints have clean, modular registration points without code duplication.

---

## ADR-023: Production Authentication, Google OAuth, and Session Management

### Context
Stage 06 provided the Fastify v5 foundation and Stage 05 provided the database tenant resolvers. However, control plane user authentication required an end-to-end, production-grade identity pipeline. We needed:
1. Google OpenID Connect authentication using Authorization Code Flow with PKCE and signed HMAC state.
2. Cryptographic ID token verification via official Google PKI libraries (`google-auth-library`).
3. Transactional identity provisioning, default workspace creation, and anti-account-takeover rules on email collisions.
4. Server-side session management storing only SHA-256 token hashes in PostgreSQL, supporting atomic session rotation on login, individual device revocation, and instant global revocation across all devices (`logout-all`).
5. Secure HTTP-only cookie delivery with `__Host-` prefix protection in production.
6. Cross-Site Request Forgery (CSRF) defenses validating Origin/Referer on cookie-authenticated mutations.
7. Next.js 15 server-side route protection for `/app` and clean redirection to `/login`.

### Decision
1. **Google OIDC with PKCE & HMAC-Signed State**:
   - Implemented `generatePkcePair` (RFC 7636) generating a 32-byte `base64url` verifier and SHA-256 `code_challenge`.
   - Implemented `signOAuthState` and `verifyOAuthState` using HMAC-SHA256 with `SESSION_SECRET`, embedding a 32-byte nonce, the PKCE verifier, return path, and a 10-minute expiry timestamp.
   - Dual-state validation: the state is verified cryptographically and compared in constant time (`timingSafeEqual`) against a temporary HTTP-only cookie (`af_oauth_state`).
2. **Cryptographic Google ID Token Verification**:
   - Integrated `google-auth-library` `OAuth2Client.verifyIdToken()` validating Google's RSA-256 signature against Google JWKS certs, checking audience, issuer, expiration, nonce match, and requiring `payload.email_verified === true`.
   - Dependency-injected `GoogleOAuthService` to permit isolated unit/integration testing with mock adapters without dynamic network calls.
3. **Transactional Identity Provisioning & Account Linking Safety**:
   - Implemented `IdentityRepository.findOrCreateUserFromGoogle` executing inside an atomic transaction.
   - For new users: creates `users` record, creates `oauth_accounts` record linked to the Google subject ID (`sub`), creates default personal workspace, and provisions `workspace_memberships` with role `owner`.
   - For returning users: updates display name, avatar, and OAuth access/refresh tokens.
   - **Anti-Account-Takeover Defense**: If a user record with the incoming email exists but has no linked Google account, automatic email-only merging is strictly forbidden. The system throws a 409 `ConflictError` to prevent unauthenticated account takeover.
4. **Server-Side Session Store & Token Hashing**:
   - Implemented `SessionRepository` and `packages/auth/src/session.ts`.
   - Raw tokens are 256-bit entropy `base64url` strings. Raw tokens are never stored in the database.
   - Database stores only `token_hash = sha256(rawToken)`.
   - Atomic session rotation on login (`rotateSession` revokes previous cookie session and creates fresh session).
   - Throttled sliding touch (`touchSession` updates `last_active_at` at most once every 5 minutes).
   - Global revocation (`POST /v1/auth/logout-all`) invalidates all active sessions for a user instantly.
5. **Cookie Security**:
   - Uses `__Host-af_session` in production (`af_session` in development), enforcing `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/`.
6. **CSRF Protection**:
   - Implemented Fastify `csrfPlugin` validating `Origin` and `Referer` headers against `AUTH_ALLOWED_REDIRECT_ORIGINS` for cookie-authenticated mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`).
7. **Control Plane Route Protection**:
   - Implemented Next.js App Router server-side session resolution (`apps/web/lib/session.ts`) forwarding cookies to `/v1/auth/me`. Protected route `/app` redirects unauthenticated visitors to `/login?error=session_expired`.

### Consequences
- True enterprise-grade authentication with zero dummy buttons or client-side trust.
- Immunity to session fixation, token exposure via XSS (`HttpOnly`), and CSRF.
- Clean Next.js 15 App Router integration without exposing session secrets or database packages to client bundles.
- 100% test coverage across OAuth state validation, PKCE verification, login, rotation, single logout, logout-all, and CSRF rejection.

---

## ADR-024: Multi-Tenant Workspace Management, 5-Role RBAC Model, and Secure Single-Use Invitations

### Context
Stage 07 established production Google OIDC authentication and server-side sessions. Stage 08 requires a comprehensive multi-tenant workspace management layer allowing users to create workspaces, switch active tenant context, invite team members, enforce granular authorization, and prevent privilege escalation.
Key requirements:
1. Multi-tenant workspace lifecycle: atomic creation, slug normalization, reserved routes protection, and collision resolution.
2. 5 explicit workspace roles (`owner`, `admin`, `developer`, `operator`, `viewer`) plus legacy `member` backwards compatibility.
3. Centralized 35-permission matrix across 10 security domains enforced via route pre-handlers and scoped database transactions.
4. Member management with last-owner protection (cannot demote or remove the last remaining owner) and anti-self-escalation guards.
5. Secure invitation system: single-use 256-bit cryptographically strong token, blind storage via SHA-256 hash, 7-day expiration, and anti-hijacking email matching against Google OIDC verified email.
6. Server-side session active workspace selection and switching.
7. Next.js 15 Web Control Plane integration: workspace switcher, creation wizard, 3-step onboarding flow, team members & invitations settings, and invitation acceptance flow.

### Decision
1. **Database Schema Enhancements (Migration `0002_workspace_rbac_invitations.sql`)**:
   - Added `developer` and `operator` to PostgreSQL `user_role` enum.
   - Added `role` column to `workspace_invitations` defaulting to `'viewer'`.
   - Added `timezone`, `locale`, `status`, `onboarding_completed`, and `onboarding_intent` columns to `workspaces`.
2. **Slug Architecture & Collision Retry**:
   - Implemented `generateWorkspaceSlug` and `validateWorkspaceSlug` in `@agentflow/domain`. Enforces lowercase ASCII, numbers, and hyphens (`3-48` chars), rejects 26 reserved platform routes.
   - In `WorkspaceRepository.createWorkspace`, an atomic pre-insert collision check runs inside the transaction, retrying with cryptographic random suffix up to 5 times.
3. **5-Role RBAC Engine**:
   - Implemented `packages/auth/src/rbac.ts` defining 35 granular permissions across 10 domains (`workspace`, `member`, `agent`, `workflow`, `integration`, `credential`, `execution`, `audit`, `billing`, `invitation`).
   - Fastify route guard `fastify.requireWorkspacePermission(permission)` checks `hasPermission(role, permission)` before executing handlers.
   - Repository-level guards enforce last-owner protection (`SELECT COUNT(*) WHERE role = 'owner' <= 1`) and prevent non-owners from assigning `owner` or elevating their own role.
4. **Cryptographic Single-Use Invitations**:
   - Implemented `generateInvitationToken` (256-bit base64url) and `hashInvitationToken` (SHA-256) in `@agentflow/auth`.
   - Stored only SHA-256 `token_hash` in PostgreSQL. Raw token is never persisted.
   - `acceptInvitation` executes inside an atomic transaction: verifies unconsumed token, checks 7-day expiration, verifies anti-hijacking constraint (`user.email === invitation.email`), creates membership, sets `accepted_at = NOW()`, `accepted_by = user.id`, and writes immutable audit record.
5. **Session Active Workspace Selection**:
   - `POST /v1/workspaces/:workspaceId/select` validates user membership in target workspace and persists `active_workspace_id` in PostgreSQL `sessions` table.
6. **Web Control Plane Architecture**:
   - Implemented `WorkspaceSwitcher` dropdown component, workspace creation page (`/app/workspaces/new`), multi-step onboarding wizard (`/onboarding`), workspace settings with Team Members & Invitations tabs (`/app/settings`), and public invitation acceptance page (`/invite`).

### Consequences
- Full multi-tenant workspace operational capabilities with hardened RLS isolation.
- Complete protection against privilege escalation, rogue token redemption, and accidental workspace abandonment (last-owner guard).
- All 15 workspace endpoints fully tested and verified against live PostgreSQL container.
- Next.js Web Control Plane builds with zero errors and passes all test suites.
