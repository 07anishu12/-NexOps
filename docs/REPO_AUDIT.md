# AgentFlow OS — Repository Reconnaissance, Feasibility & Baseline Audit (Stage 00)

**Date**: 2026-11-01  
**Author**: Forward Deployed Engineering / Senior Product Engineering Agent  
**Status**: Completed  
**Reference Document**: `AgentFlow_OS_Complete_PRD.docx` (v1.0, 1 November 2026)  
**Governing Authority**: Master Operating Contract & AgentFlow OS PRD  

---

## 1. Executive Summary

This repository audit establishes the empirical baseline for **AgentFlow OS**, an enterprise multi-tenant agentic AI platform, workflow automation runtime, and forward deployed engineering (FDE) deployment control plane.

The audit verified the existing disk state, discovered no pre-existing legacy code, evaluated development tooling on the host machine, performed a detailed gap analysis against the target monorepo architecture outlined in Section 17 & 18 of the PRD, assessed feasibility across all five core product pillars, and mapped out provider prerequisites and risky assumptions.

---

## 2. Environment & Tooling Reconnaissance

The local operating environment on this host (macOS Darwin arm64) was audited with the following findings:

| Tool / Runtime | Detected Version | Target Specification | Status / Compatibility |
| :--- | :--- | :--- | :--- |
| **Node.js** | `v26.13.0` | Node.js LTS (>= 20.x, compatible with ES2022/NodeNext) | Compatible |
| **pnpm** | `12.8.1` | pnpm (>= 9.x) workspace manager | Compatible |
| **Git** | `2.56.0` | Git version control | Active (`main` branch initialized) |
| **RTK (Rust Terminal Kit)** | `/opt/homebrew/bin/rtk` | Terminal verbosity compressor | Available |
| **Python** | `3.9.6` | Auxiliary script execution | Available |
| **Docker Engine** | Host environment | Containerized Postgres/Redis execution | Target dependency |

---

## 3. Baseline Repository Inventory

Inspection of `/Users/anny/Desktop/NexOps` before changes:

```
NexOps/
├── .git/                                 # Initialized git repository (main branch)
└── AgentFlow_OS_Complete_PRD.docx        # Approved Source of Truth PRD (111,190 bytes)
```

### Findings:
1. **Existing Product Code**: None. There is no legacy or scaffolded code in the repository.
2. **Existing Package Manager & Manifests**: None (`package.json`, `pnpm-workspace.yaml`, and `turbo.json` do not yet exist).
3. **Existing CI/CD Pipelines**: None (`.github/workflows/` does not yet exist).
4. **Existing Database Migrations**: None (Drizzle config and SQL migrations not present).
5. **Reusable Code Assets**: The sole input artifact is `AgentFlow_OS_Complete_PRD.docx`, which defines comprehensive functional, architectural, security, database, API, and UI requirements.

---

## 4. Gap Analysis Against PRD Target Architecture

The target architecture specified in PRD Section 17 ("Repository structure and file-level implementation map") and Section 10 ("System architecture") requires a clean, modular monorepo partitioned into 5 independent deployable applications and 12 shared domain/infrastructure packages:

### 4.1 Applications (`apps/`)

| Target Application | Expected Purpose | Current State | Gap |
| :--- | :--- | :--- | :--- |
| `apps/web` | Next.js App Router control plane, dashboard, marketing & route handlers | Missing | Full setup needed (Next.js 15+, Tailwind, Lucide, App Router) |
| `apps/api` | Standalone Developer REST API v1 (`/api/v1/`), auth, webhooks, rate limiting | Missing | Full setup needed (Express / Fastify / Node HTTP route service) |
| `apps/worker` | BullMQ background worker, LangGraph durable agent executor, scheduled jobs | Missing | Full setup needed (Node worker, BullMQ queue consumers, checkpoint store) |
| `apps/widget` | Embeddable standalone chat widget runtime bundle & customer test harness | Missing | Full setup needed (Vite / micro-bundle, zero external DOM footprint) |
| `apps/docs` | Developer and FDE documentation site (OpenAPI spec, SDK guides, runbooks) | Missing | Full setup needed (Static documentation site / Markdown knowledge base) |

### 4.2 Shared Packages (`packages/`)

| Target Package | Expected Responsibilities | Current State | Gap |
| :--- | :--- | :--- | :--- |
| `packages/contracts` | Zod schemas, typed API request/response contracts, event envelopes | Missing | Needs definition of all domain schemas & validation logic |
| `packages/config` | Strict runtime environment variable parsing and validation via Zod | Missing | Needs schema for all required server/client env vars |
| `packages/database` | PostgreSQL client, Drizzle ORM schemas, migration scripts, tenant RLS | Missing | Needs core tables (users, workspaces, agents, runs, etc.) |
| `packages/domain` | Business domain models, entity logic, immutable version hashing | Missing | Needs domain abstractions and state invariants |
| `packages/auth` | Session validation, OAuth handshake helpers, API key hashing, RBAC | Missing | Needs token signing, role guards, and OAuth lifecycle helpers |
| `packages/policy` | Deterministic permission evaluation, tool risk tiers, rate limits | Missing | Needs policy rule engine and tool execution allowlists |
| `packages/runtime` | LangGraph state machine, graph factory, run lifecycle, checkpointing | Missing | Needs node definitions and state transition rules |
| `packages/integrations` | Provider adapters (Gmail, Calendar, Instagram, Razorpay) | Missing | Needs connector interface, error normalization, retry handlers |
| `packages/billing` | Double-entry credit ledger, usage metering, subscription plan tiers | Missing | Needs reservation ledger, hold/settle transactions |
| `packages/observability` | OpenTelemetry tracing, structured JSON logging, secret redaction | Missing | Needs tracer initialization, log redaction pipeline |
| `packages/ui` | Shared UI tokens, primitives, layout components, and design system | Missing | Needs core UI components (buttons, badges, dialogs, cards) |
| `packages/sdk` | Public TypeScript/JavaScript Node SDK and Browser Widget SDK | Missing | Needs typed client classes, request signers, event handlers |

---

## 5. Feasibility Assessment Across Core Pillars

| Pillar | PRD Scope | Feasibility Rating | Key Implementation Consideration |
| :--- | :--- | :--- | :--- |
| **1. Platform Foundation** | Multi-tenancy, immutable agent versioning, environment promotion, REST API v1 | **High** | Requires composite primary keys (`workspace_id`, `id`) and strict Drizzle schema boundaries. |
| **2. Agent Intelligence** | LangGraph durable runs, model gateway, tool registry, evaluation suite | **High** | Abstract model provider calls; persist checkpoints in PostgreSQL; keep tool execution server-side. |
| **3. Security & Reliability** | Central approval engine, deterministic tool policy, AES-256 secret vault, RLS | **High** | Deterministic SHA-256 payload canonicalization; atomic consume-once approval tokens; no secrets in browser. |
| **4. FDE Operations** | Multi-tenant customer console, readiness checks, diagnostic health probes, runbooks | **High** | Standardized readiness check interface across integrations, origin verification, and audit logs. |
| **5. Monetisation & Public** | Double-entry credit ledger, Razorpay webhooks, quota enforcement, public embed widget | **High** | Append-only ledger; two-phase credit reservations; raw-body HMAC webhook signature validation. |

---

## 6. Risky Assumptions & Mitigations

The PRD explicitly identifies critical risk boundaries (Sections 19, 20, 32, and 34). The following assumptions must be continuously mitigated during implementation:

1. **Model Cost & Latency Volatility**:
   - *Risk*: Unbounded LLM loops or large token inputs could exhaust credits and cause timeouts.
   - *Mitigation*: Hard token budgets, per-run caps, two-phase credit reservation before run initiation, server-side timeout boundaries (default 120s).
2. **Third-Party Provider Policy & Scope Approvals**:
   - *Risk*: Google restricted scopes (`gmail.send`) and Meta App Review requirements could delay live production approval.
   - *Mitigation*: Implement provider mock test adapters; separate local automated verification from live provider credentials; request minimum required scopes (`gmail.compose` vs `gmail.send`).
3. **Public Widget Untrusted Boundary**:
   - *Risk*: Malicious actors could embed the widget on unauthorized domains or attempt prompt injection to invoke internal tools.
   - *Mitigation*: Strict Origin/Referer header validation against deployment domain allowlist; ephemeral scoped tokens (`PUBLIC_WIDGET_SESSION_TTL_SECONDS`); public sessions are barred by default from executing high-impact tools without human approval.
4. **Idempotency & Double Execution of Side Effects**:
   - *Risk*: Worker retries could re-send emails, re-create calendar events, or double-charge accounts.
   - *Mitigation*: Unique deterministic `operation_id` per side-effect step; provider deduplication keys; transactional outbox pattern.
5. **Approval Tampering & Replay Attacks**:
   - *Risk*: A human approver payload could be tampered with between interruption and resumption.
   - *Mitigation*: Cryptographic SHA-256 canonical JSON hashing of approval payloads; single-use approval tokens; server-side role validation.

---

## 7. Provider Prerequisites & Environment Matrix

To transition from local mock/sandbox verification to live deployment, the following external accounts and credentials will be required:

| Provider | Purpose | Required Credentials / Resources | Status in Repo |
| :--- | :--- | :--- | :--- |
| **Google Cloud Platform** | OAuth Login, Gmail API, Calendar API | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, Approved Redirect URIs | Pending Staging Config |
| **Meta for Developers** | Instagram Graph API | `META_APP_ID`, `META_APP_SECRET`, Business Verification, `pages_manage_posts` scope | Pending Staging Config |
| **Razorpay** | Payment processing & subscriptions | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, Webhook Secret | Pending Staging Config |
| **PostgreSQL 16+** | Relational data & LangGraph checkpointer | `DATABASE_URL` with connection pooling | Local Docker / Cloud DB |
| **Redis 7+** | BullMQ task queue & transient caching | `REDIS_URL` | Local Docker / Cloud Redis |
| **Model Providers** | LLM Gateway (OpenAI, Anthropic, Gemini) | `MODEL_PROVIDER_KEY_REFERENCE` | Env-based key references |
| **Object Storage** | Uploads, attachments, knowledge docs | `OBJECT_STORAGE_ENDPOINT`, `OBJECT_STORAGE_BUCKET`, Access/Secret Keys | Local MinIO / AWS S3 |

*Policy Enforcement*: If external live credentials are unavailable during a stage, the stage will implement full production code with verified mock/test adapters, cleanly separating local test completion from blocked live verification.

---

## 8. Proposed 40-Stage Phased Implementation Plan

The project will proceed across 40 strictly sequenced stages from `Stage 00` through `Stage 39`:

- **Phase 1: Foundation & Infrastructure (Stages 00–06)**
  - Stage 00: Repository Reconnaissance, Feasibility & Build Ledger
  - Stage 01: Monorepo Foundation and Independent Deployables
  - Stage 02: Typed Contracts, Zod Schemas & Config Validation
  - Stage 03: PostgreSQL Schema, Drizzle Migrations, Tenant RLS
  - Stage 04: Authentication, OAuth Handshake & Session Management
  - Stage 05: Workspace Context, Multi-Tenancy Controls & Audit Trail
  - Stage 06: Control Plane Design System & Global Navigation Shell
- **Phase 2: Agent Core & Runtime (Stages 07–14)**
  - Stage 07: Agent Domain Service, Draft Validation & Immutable Versions
  - Stage 08: Model Gateway, Provider Abstraction & Token Budgeting
  - Stage 09: Streaming Chat Playground & Conversation Runtime
  - Stage 10: Tool Registry, Schemas & Risk Tiers
  - Stage 11: Policy Engine & Deterministic Capability Boundaries
  - Stage 12: Durable Execution Runtime & LangGraph State Machine
  - Stage 13: BullMQ Asynchronous Worker & Checkpoint Persistence
  - Stage 14: Central Approval Engine & Cryptographic Payload Verification
- **Phase 3: Integration Adapters (Stages 15–18)**
  - Stage 15: Secret Encryption Vault & OAuth Token Lifecycle
  - Stage 16: Gmail Integration Adapter & Safe Message Dispatch
  - Stage 17: Google Calendar Adapter & Scheduling Safety
  - Stage 18: Meta Instagram Adapter & Professional Account Publishing
- **Phase 4: Deployments, Widget & SDKs (Stages 19–24)**
  - Stage 19: Public Deployment Management & Environment Promotion
  - Stage 20: Embeddable Website Widget (`apps/widget`) & Script Bundle
  - Stage 21: Widget Session Security, Origin Verification & Rate Limiting
  - Stage 22: Versioned Developer REST API v1 (`apps/api`) & Key Management
  - Stage 23: Public TypeScript/Node SDK (`packages/sdk`)
  - Stage 24: Customer Integration Showcase & Framework Examples
- **Phase 5: FDE Operations & Monetisation (Stages 25–31)**
  - Stage 25: FDE Customer Operations Console & Fleet Management
  - Stage 26: Integration Diagnostics & Pre-Flight Readiness Probes
  - Stage 27: Usage Metering, Token Tracking & Resource Accounting
  - Stage 28: Credit Ledger, Balance Holds & Double-Entry Accounting
  - Stage 29: Razorpay Payment Gateway & Checkout Flow
  - Stage 30: Payment Webhook Reconciliation & Idempotent Processing
  - Stage 31: Subscription Plans & Server-Side Quota Enforcement
- **Phase 6: Advanced Capabilities & Workflows (Stages 32–36)**
  - Stage 32: Visual Workflow Builder & DAG Schema Validation
  - Stage 33: Workflow Execution Engine & Multi-Agent Coordination
  - Stage 34: Knowledge Base Ingestion, Chunking & Vector Storage
  - Stage 35: Contextual Retrieval, Citations & Memory Controls
  - Stage 36: Agent Evaluation Suite, Golden Benchmarks & Quality Gates
- **Phase 7: Hardening, Observability & Release (Stages 37–39)**
  - Stage 37: OpenTelemetry Instrumentation, Distributed Tracing & Metrics
  - Stage 38: Security Hardening, Prompt Injection Defense & SSRF Egress Guards
  - Stage 39: Independent Release Audit, E2E Verification & Launch Gate
