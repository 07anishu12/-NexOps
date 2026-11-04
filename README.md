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
| **REST API Service** | `@agentflow/api` | `4000` | `GET /health` (liveness), `GET /ready` (readiness), `GET /docs` (OpenAPI UI) | `dist/` |
| **Background Worker** | `@agentflow/worker` | `4001` (health) | `GET /health` | `dist/` |
| **Website Widget** | `@agentflow/widget` | `3002` (demo) | Self-verifying bundle test | `dist/` |
| **Documentation** | `@agentflow/docs` | `3003` | `GET /docs` | `dist/` |

---

## 4. Local Developer Workflow

### Prerequisites
- **Node.js**: `>= 20.x` (Recommended: `v22.x` or `v26.x`)
- **pnpm**: `>= 9.x` (Host verified: `12.8.1`)
- **Docker Desktop** (or a compatible Docker Engine with Compose v2): for PostgreSQL, Redis and MinIO

### Quickstart

1. **Clone and enter the repository**:
   ```bash
   git clone https://github.com/agentflow-os/agentflow-os.git
   cd agentflow-os
   ```

2. **Install dependencies**:
    ```bash
   pnpm install --frozen-lockfile
    ```

3. **Create a local environment** (generates unique local-only secrets and never overwrites an existing `.env`):
    ```bash
   pnpm dev:setup
    ```

4. **Start and verify PostgreSQL, Redis and MinIO**:
    ```bash
   pnpm infra:up
    ```

   MinIO is available at http://localhost:9001 and the `agentflow-assets` bucket is created idempotently.

5. **Apply database migrations and seed synthetic development data**:
    ```bash
   pnpm --filter @agentflow/database db:migrate
   pnpm --filter @agentflow/database db:seed
   pnpm --filter @agentflow/database db:check
    ```

6. **Build all packages and apps**:
    ```bash
   pnpm build
    ```

7. **Run the quality checks**:
    ```bash
   pnpm test
   pnpm typecheck
   pnpm lint
   ```

See [`docs/LOCAL_DEVELOPMENT.md`](docs/LOCAL_DEVELOPMENT.md) for service details and troubleshooting.

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

# Inspect or stop local infrastructure
pnpm infra:status
pnpm infra:logs
pnpm infra:down

# Delete local infrastructure data only with explicit confirmation
pnpm dev:reset --confirm
```

### Starting applications

After `pnpm build`, start deployables independently in separate terminals:

```bash
pnpm --filter @agentflow/web dev
pnpm --filter @agentflow/api start
pnpm --filter @agentflow/worker start
pnpm --filter @agentflow/docs start
pnpm --filter @agentflow/widget start
```

The widget is built as a standalone bundle with `pnpm --filter @agentflow/widget build` and can be previewed at `http://localhost:3002/agentflow-widget.js`.

## 6. Troubleshooting

- **Docker unavailable**: start Docker Desktop, then run `pnpm infra:wait`. The scripts report daemon and port failures without printing credentials.
- **Port occupied**: change `POSTGRES_PORT`, `REDIS_PORT`, `MINIO_API_PORT` or `MINIO_CONSOLE_PORT` in `.env`, then recreate the services with `pnpm infra:down` and `pnpm infra:up`.
- **Bucket missing**: run `pnpm infra:wait`; bucket initialization is safe to repeat.
- **Fresh local data**: use `pnpm dev:reset --confirm`. This is restricted to `development` and `test` environments and removes named volumes.

---

## 7. Architecture Decisions & Implementation Ledger

- **Architecture Decision Records**: Consult [`docs/DECISIONS.md`](docs/DECISIONS.md) for ADR-001 through ADR-018 covering tenancy, immutability, queues, policy, approvals, and secrets.
- **Master Build Ledger**: Track stage-by-stage implementation evidence and exit gates in [`docs/BUILD_LEDGER.md`](docs/BUILD_LEDGER.md).
- **Baseline Audit**: Review repository feasibility and external provider prerequisites in [`docs/REPO_AUDIT.md`](docs/REPO_AUDIT.md).

---

## 8. License

Licensed under the [Apache License, Version 2.0](LICENSE).
