# NexOps — AgentFlow OS

> **Enterprise multi-tenant agentic AI platform, workflow automation runtime, and forward deployed engineering (FDE) control plane.**

[![CI](https://github.com/agentflow-os/agentflow-os/actions/workflows/ci.yml/badge.svg)](https://github.com/agentflow-os/agentflow-os/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-12.8-orange)](https://pnpm.io/)

---

## 1. Overview & Architectural Vision

AgentFlow OS is a unified platform for creating, testing, publishing, deploying, and operating AI agents and AI-powered workflows. It connects a browser-based control plane with a durable execution runtime, allowing teams to build an agent once and deploy it across web chat widgets, developer APIs, webhooks, and background scheduled tasks with cryptographic safety and deterministic security boundaries.

### Core Architectural Principles
1. **Multi-Tenancy by Design**: Row-Level Security (RLS) and explicit `WorkspaceContext` prevent cross-tenant data leakage.
2. **Immutable Version Snapshots**: Agent releases are snapshotted with SHA-256 hashes; rollbacks are instant version pointer swaps.
3. **Decoupled Asynchronous Execution**: Web requests never hold long-running AI execution open; durable background workers handle LangGraph runs.
4. **Deterministic Policy Gate**: Untrusted model outputs cannot bypass strict tool allowlists, risk tiers, or human approval gates.
5. **Double-Entry Credit Accounting**: Usage reservations (Hold -> Settle / Release) protect workspaces from negative balance overdrafts.

---

## 2. Monorepo Structure

The repository is organized as a **pnpm + Turborepo** workspace with strict TypeScript boundaries:

```
agentflow-os/
├── apps/
│   ├── web/                         # Next.js App Router control plane & dashboard
│   ├── api/                         # Standalone Developer REST API v1 service
│   ├── worker/                      # BullMQ background worker & durable graph processor
│   ├── widget/                      # Standalone embeddable website widget bundle & runtime
│   └── docs/                        # Static documentation & OpenAPI spec explorer
├── packages/
│   ├── contracts/                   # Shared Zod schemas, API contracts, event envelopes
│   ├── config/                      # Strict runtime environment validation via Zod
│   ├── database/                    # PostgreSQL Drizzle ORM schema, tenant RLS, client
│   ├── domain/                      # Domain entities, immutable version hashing logic
│   ├── auth/                        # RBAC role matrix, API key hashing, session security
│   ├── policy/                      # Tool risk tiers, policy rules & deterministic allowlists
│   ├── runtime/                     # Run lifecycle state machine & LangGraph node interfaces
│   ├── integrations/                # Connectors (Gmail, Calendar, Instagram, Razorpay)
│   ├── billing/                     # Credit ledger, two-phase holds, subscription plans
│   ├── observability/               # Structured JSON logging, secret redaction, telemetry
│   ├── ui/                          # Shared design tokens, primitives, CSS utilities
│   └── sdk/                         # Public TypeScript/Node & Browser SDK client
├── docs/
│   ├── BUILD_LEDGER.md              # Authoritative 40-stage implementation ledger
│   ├── DECISIONS.md                 # Architecture Decision Records (ADR-001 - ADR-018)
│   └── REPO_AUDIT.md                # Initial reconnaissance, feasibility, and risk analysis
├── .github/workflows/ci.yml         # Continuous integration pipeline
├── package.json                     # Monorepo root scripts & dev dependencies
├── pnpm-workspace.yaml              # Workspace membership configuration
├── turbo.json                       # Turborepo task pipeline & cache declarations
└── tsconfig.base.json               # Shared strict TypeScript compiler configuration
```

---

## 3. Independent Deployable Applications

Every application in `apps/` is independently buildable, testable, and deployable:

| Application | Package Name | Default Port | Health Check Route | Build Output |
| :--- | :--- | :--- | :--- | :--- |
| **Control Plane Web** | `@agentflow/web` | `3000` | `GET /api/health` | `.next/` |
| **REST API Service** | `@agentflow/api` | `4000` | `GET /health`, `GET /api/v1/health` | `dist/` |
| **Background Worker** | `@agentflow/worker` | `4001` (health) | `GET /health` | `dist/` |
| **Website Widget** | `@agentflow/widget` | `3002` (demo) | Self-verifying bundle test | `dist/` |
| **Documentation** | `@agentflow/docs` | `3003` | `GET /docs` | `dist/` |

---

## 4. Local Developer Workflow

### Prerequisites
- **Node.js**: `>= 20.x` (Recommended: `v22.x` or `v26.x`)
- **pnpm**: `>= 9.x` (Host verified: `12.8.1`)
- **Docker**: (For local PostgreSQL and Redis dependencies)

### Quickstart

1. **Clone and enter the repository**:
   ```bash
   git clone https://github.com/agentflow-os/agentflow-os.git
   cd agentflow-os
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```

4. **Run build across all packages and apps**:
   ```bash
   pnpm build
   ```

5. **Run test suite**:
   ```bash
   pnpm test
   ```

6. **Run typechecking and linting**:
   ```bash
   pnpm typecheck
   pnpm lint
   ```

---

## 5. Working with Specific Applications

Turborepo and pnpm filters allow targeted execution without building unrelated projects:

```bash
# Run web control plane in development mode
pnpm --filter @agentflow/web dev

# Build only the REST API service
pnpm --filter @agentflow/api build

# Start the background worker
pnpm --filter @agentflow/worker start

# Run unit tests only for shared contracts
pnpm --filter @agentflow/contracts test
```

---

## 6. Architecture Decisions & Implementation Ledger

- **Architecture Decision Records**: Consult [`docs/DECISIONS.md`](docs/DECISIONS.md) for ADR-001 through ADR-018 covering tenancy, immutability, queues, policy, approvals, and secrets.
- **Master Build Ledger**: Track stage-by-stage implementation evidence and exit gates in [`docs/BUILD_LEDGER.md`](docs/BUILD_LEDGER.md).
- **Baseline Audit**: Review repository feasibility and external provider prerequisites in [`docs/REPO_AUDIT.md`](docs/REPO_AUDIT.md).

---

## 7. License

Licensed under the [Apache License, Version 2.0](LICENSE).
