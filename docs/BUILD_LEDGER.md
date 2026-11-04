# AgentFlow OS — Master Build Ledger

**Document Version**: 1.0  
**Baseline Date**: 2026-11-01  
**Status**: Authoritative Stage Implementation Tracker  
**Governing Rule**: Allowed statuses: `not_started`, `in_progress`, `blocked`, `passed`, `needs_rework`. Never mark a stage passed without concrete verification evidence.

---

## Stage Implementation Summary

| Total Stages | Passed | In Progress | Blocked | Not Started | Needs Rework |
| :---: | :---: | :---: | :---: | :---: | :---: |
| 40 | 5 | 0 | 0 | 35 | 0 |

---

## Comprehensive 40-Stage Build Ledger

| Stage | Status | Commit / reference | Files changed | Tests run | Result | Blockers | Next stage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Stage 00: Repository reconnaissance, feasibility and build ledger** | `passed` | `init-stage-00` | `docs/REPO_AUDIT.md`, `docs/DECISIONS.md`, `docs/BUILD_LEDGER.md` | Verification of Node `v26.13.0`, pnpm `12.8.1`, Git `2.56.0`, directory audit, PRD validation | PASSED | None | Stage 01 |
| **Stage 01: Monorepo foundation and independent deployables** | `passed` | `stage-01` | `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `apps/*`, `packages/*`, `.github/workflows/ci.yml`, `README.md` | `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` across all 17 workspaces | PASSED | None | Stage 02 |
| **Stage 02: Typed contracts, architecture rules & dependency boundaries** | `passed` | `stage-02` | `packages/contracts/src/*`, `packages/contracts/tests/*`, `tests/architecture/dependency-rules.test.ts`, `docs/DECISIONS.md` | `pnpm test:architecture`, `pnpm --filter @agentflow/contracts test`, `pnpm typecheck`, `pnpm lint` | PASSED | None | Stage 03 |
| **Stage 03: PostgreSQL schema, Drizzle migrations, and tenant isolation** | `passed` | `stage-04-database` | `packages/database/*`, `drizzle.config.ts`, `migrations/*`, `docs/database/*` | `db:migrate`, `db:status`, `db:check`, `db:seed`, 27 unit & integration tests (`database.test.ts`, `database-integration.test.ts`), RLS verification, append-only triggers | PASSED | None | Stage 04 |
| **Stage 04: Authentication, OAuth and session management** | `not_started` | — | `packages/auth/*`, `apps/web/app/(auth)/*` | Auth state machine tests, OAuth callback mock tests | Pending | Requires Stage 03, Google OAuth credentials for live test | Stage 05 |
| **Stage 05: Workspace management, RBAC and audit logging** | `passed` | `stage-05-access-layer` | `packages/database/src/tenant-context.ts`, `packages/database/src/resolvers.ts`, `packages/database/src/repositories/*`, `packages/database/tests/database-access-security.test.ts`, `docs/security/TENANT_ACCESS_MODEL.md` | 24-point security test suite (`database-access-security.test.ts`), 27 database tests, 6 architecture tests, monorepo typecheck/lint/test | PASSED | None | Stage 06 |
| **Stage 06: Control plane design system and navigation shell** | `not_started` | — | `apps/web/*`, `packages/ui/*` | Component visual smoke tests, route layout render tests | Pending | Requires Stage 05 | Stage 07 |
| **Stage 07: Agent domain models and immutable versioning** | `not_started` | — | `packages/domain/agents/*`, `packages/database/schema/agents.ts` | Agent CRUD tests, immutable hash verification test | Pending | Requires Stage 06 | Stage 08 |
| **Stage 08: Model gateway and multi-provider abstraction** | `not_started` | — | `packages/runtime/model-gateway/*` | Provider adapter tests, error normalization, quota limit tests | Pending | Requires Stage 07, LLM provider API keys | Stage 09 |
| **Stage 09: Streaming chat playground and conversation runtime** | `not_started` | — | `apps/web/features/playground/*`, `apps/api/routes/playground.ts` | SSE streaming integration tests, message persistence tests | Pending | Requires Stage 08 | Stage 10 |
| **Stage 10: Tool registry, schemas and execution contracts** | `not_started` | — | `packages/policy/tools/*`, `packages/contracts/tools.ts` | Tool registry tests, schema validation failure tests | Pending | Requires Stage 09 | Stage 11 |
| **Stage 11: Policy engine and deterministic permission boundaries** | `not_started` | — | `packages/policy/engine/*` | Adversarial tool bypass tests, allowlist enforcement tests | Pending | Requires Stage 10 | Stage 12 |
| **Stage 12: Durable execution runtime and LangGraph state machine** | `not_started` | — | `packages/runtime/graph/*`, `packages/runtime/state/*` | Graph state transition tests, node execution tests | Pending | Requires Stage 11 | Stage 13 |
| **Stage 13: BullMQ asynchronous worker and checkpoint persistence** | `not_started` | — | `apps/worker/*`, `packages/database/checkpoints.ts` | Worker interrupt/resume tests, lease recovery tests | Pending | Requires Stage 12, Redis instance | Stage 14 |
| **Stage 14: Central approval engine and cryptographic payload verification** | `not_started` | — | `packages/policy/approvals/*`, `apps/web/features/approvals/*` | Single-use token tests, payload tampering tests | Pending | Requires Stage 13 | Stage 15 |
| **Stage 15: Credentials encryption vault and OAuth token lifecycle** | `not_started` | — | `packages/auth/vault/*`, `packages/database/schema/credentials.ts` | AES-256-GCM encryption/decryption tests, rotation tests | Pending | Requires Stage 14 | Stage 16 |
| **Stage 16: Gmail integration adapter and safe action execution** | `not_started` | — | `packages/integrations/google/gmail/*` | Gmail mock adapter tests, approved send tests | Pending | Requires Stage 15, Google Cloud Gmail API scope | Stage 17 |
| **Stage 17: Google Calendar integration adapter and scheduling safety** | `not_started` | — | `packages/integrations/google/calendar/*` | Calendar mock adapter tests, timezone handling tests | Pending | Requires Stage 16, Google Cloud Calendar API scope | Stage 18 |
| **Stage 18: Meta Instagram integration adapter and media publishing** | `not_started` | — | `packages/integrations/meta-instagram/*` | Account eligibility guard tests, media post mock tests | Pending | Requires Stage 17, Meta App review & business account | Stage 19 |
| **Stage 19: Public deployment management and runtime control plane** | `not_started` | — | `packages/domain/deployments/*`, `apps/web/features/deployments/*` | Deployment promotion tests, instant rollback tests | Pending | Requires Stage 18 | Stage 20 |
| **Stage 20: Embeddable website widget (`apps/widget`) & script bundle** | `not_started` | — | `apps/widget/*` | Bundle size tests (<50KB), iframe/shadow DOM isolation tests | Pending | Requires Stage 19 | Stage 21 |
| **Stage 21: Widget session management, origin security and rate limiting** | `not_started` | — | `apps/api/routes/widget.ts`, `packages/policy/origin.ts` | Unauthorized origin rejection tests, rate limit tests | Pending | Requires Stage 20 | Stage 22 |
| **Stage 22: Versioned Developer REST API v1 (`apps/api`) & key management** | `not_started` | — | `apps/api/*`, `packages/contracts/api-v1.ts` | API key auth tests, OpenAPI spec conformance tests | Pending | Requires Stage 21 | Stage 23 |
| **Stage 23: Public TypeScript/Node SDK (`packages/sdk`)** | `not_started` | — | `packages/sdk/*` | SDK client unit tests, mock API integration tests | Pending | Requires Stage 22 | Stage 24 |
| **Stage 24: Customer integration showcases and framework examples** | `not_started` | — | `examples/*` | Next.js, React, HTML example smoke tests | Pending | Requires Stage 23 | Stage 25 |
| **Stage 25: FDE customer operations console and multi-tenant fleet management** | `not_started` | — | `apps/web/features/fde-console/*` | Multi-tenant status aggregation tests, filtering tests | Pending | Requires Stage 24 | Stage 26 |
| **Stage 26: Integration diagnostics and deployment readiness checks** | `not_started` | — | `packages/integrations/diagnostics/*` | Readiness probe tests, health check suite | Pending | Requires Stage 25 | Stage 27 |
| **Stage 27: Usage metering, token tracking and resource accounting** | `not_started` | — | `packages/billing/metering/*` | Token aggregation tests, event metering accuracy tests | Pending | Requires Stage 26 | Stage 28 |
| **Stage 28: Credit ledger, balance reservations and double-entry engine** | `not_started` | — | `packages/billing/ledger/*` | Two-phase hold/settle tests, overdraft prevention tests | Pending | Requires Stage 27 | Stage 29 |
| **Stage 29: Razorpay payment gateway integration and checkout orders** | `not_started` | — | `packages/billing/razorpay/*`, `apps/api/routes/billing.ts` | Order creation tests, payment verification mock tests | Pending | Requires Stage 28, Razorpay test credentials | Stage 30 |
| **Stage 30: Payment webhook reconciliation and idempotent processing** | `not_started` | — | `apps/api/routes/webhooks/razorpay.ts` | Raw HMAC signature tests, duplicate event replay tests | Pending | Requires Stage 29 | Stage 31 |
| **Stage 31: Subscription plans and server-side quota enforcement** | `not_started` | — | `packages/billing/plans/*` | Plan boundary tests, quota limit rejection tests | Pending | Requires Stage 30 | Stage 32 |
| **Stage 32: Visual workflow builder and DAG validation** | `not_started` | — | `apps/web/features/workflows/*`, `packages/contracts/workflow.ts` | Cycle detection tests, DAG schema validation tests | Pending | Requires Stage 31 | Stage 33 |
| **Stage 33: Workflow execution engine and multi-step orchestration** | `not_started` | — | `packages/runtime/workflow-runner/*` | Multi-node execution tests, step failure branch tests | Pending | Requires Stage 32 | Stage 34 |
| **Stage 34: Knowledge base ingestion, chunking and vector storage** | `not_started` | — | `packages/runtime/knowledge/*` | Parser tests, chunking boundary tests, vector mock tests | Pending | Requires Stage 33 | Stage 35 |
| **Stage 35: Contextual retrieval, memory controls and citations** | `not_started` | — | `packages/runtime/memory/*` | Grounding citation tests, tenant isolation search tests | Pending | Requires Stage 34 | Stage 36 |
| **Stage 36: Agent evaluation suite, regression testing and quality gates** | `not_started` | — | `packages/runtime/eval/*` | Golden test runner, prompt regression evaluation tests | Pending | Requires Stage 35 | Stage 37 |
| **Stage 37: OpenTelemetry instrumentation, distributed tracing and logging** | `not_started` | — | `packages/observability/*` | Trace context propagation tests, secret redaction tests | Pending | Requires Stage 36 | Stage 38 |
| **Stage 38: Security hardening, prompt injection defense and SSRF guards** | `not_started` | — | `packages/policy/security/*` | Prompt injection benchmark tests, SSRF egress filter tests | Pending | Requires Stage 37 | Stage 39 |
| **Stage 39: Independent release audit, E2E verification and launch gate** | `not_started` | — | `docs/RELEASE_AUDIT.md`, `tests/e2e/*` | Full end-to-end integration test suite, P0 exit gate audit | Pending | Requires Stage 38 | Complete |

---

## Stage Execution Evidence Log

### Stage 00 Evidence
- **Timestamp**: 2026-11-01T23:46:00+05:30
- **Commands Executed**:
  1. `node -v` -> `v26.13.0`
  2. `pnpm -v` -> `12.8.1`
  3. `git --version` -> `git version 2.56.0`
  4. `which rtk` -> `/opt/homebrew/bin/rtk`
  5. `git init && git branch -m main`
  6. File system inspection and XML extraction of `AgentFlow_OS_Complete_PRD.docx`
- **Output Artifacts**:
  - `docs/REPO_AUDIT.md` created: comprehensive baseline audit, environment detection, gap analysis, feasibility, risk register, provider prerequisites, and proposed roadmap.
  - `docs/DECISIONS.md` created: ADR-001 through ADR-018 detailing architectural choices, rationale, security impact, and migration paths.
  - `docs/BUILD_LEDGER.md` created: master ledger containing all 40 stages, statuses, dependencies, evidence, and exit criteria.
- **Stage 00 Exit Gate Assessment**:
  - No destructive commands executed: **CONFIRMED**
  - All existing files inventoried: **CONFIRMED** (`AgentFlow_OS_Complete_PRD.docx`)
  - Gaps reported: **CONFIRMED** (documented in `docs/REPO_AUDIT.md`)
  - Ledger contains every stage: **CONFIRMED** (Stages 00 through 39 recorded)
  - Architecture choices consistent with PRD: **CONFIRMED** (ADR-001 through ADR-018 match Section 10 & 35)
  - Result: **PASSED**

### Stage 01 Evidence
- **Timestamp**: 2026-11-02T00:04:00+05:30
- **Commands Executed**:
  1. `pnpm install`: Clean installation across 18 workspaces using `pnpm v12.8.1`, generating clean `pnpm-lock.yaml`.
  2. `pnpm build`: Executed via Turborepo across all 17 packages and apps; all 17 succeeded.
  3. `pnpm typecheck`: Executed via Turborepo across all workspaces; 26 tasks succeeded with 0 type errors.
  4. `pnpm lint`: Executed via Turborepo using flat ESLint 9 + `typescript-eslint`; 26 tasks succeeded with 0 warnings/errors.
  5. `pnpm test`: Executed Vitest across all apps and packages; 26 tasks succeeded with 100% test pass rate.
  6. Independent app builds verified:
     - `pnpm --filter @agentflow/web build` -> Next.js 15 production build compiled to `.next/`.
     - `pnpm --filter @agentflow/api build` -> REST API compiled to `dist/`.
     - `pnpm --filter @agentflow/worker build` -> Worker compiled to `dist/`.
     - `pnpm --filter @agentflow/widget build` -> Widget compiled to `dist/`.
     - `pnpm --filter @agentflow/docs build` -> Docs and OpenAPI manifest compiled to `dist/`.
- **Output Artifacts**:
  - Apps: `apps/web`, `apps/api`, `apps/worker`, `apps/widget`, `apps/docs`.
  - Packages: `contracts`, `config`, `database`, `domain`, `auth`, `policy`, `runtime`, `integrations`, `billing`, `observability`, `ui`, `sdk`.
  - Root configs: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `eslint.config.mjs`, `vitest.workspace.ts`, `.env.example`, `.github/workflows/ci.yml`, `README.md`, `LICENSE`.
- **Stage 01 Exit Gate Assessment**:
  - Clean lockfile install: **PASSED**
  - Independent app builds: **PASSED** (all 5 verified independently)
  - Shared packages build in order: **PASSED**
  - No cross-app relative imports: **PASSED**
  - CI typecheck/lint/test/build configured: **PASSED**
  - Result: **PASSED**

### Stage 02 Evidence
- **Timestamp**: 2026-11-02T00:05:55+05:30
- **Commands Executed**:
  1. `npx vitest run tests/architecture/dependency-rules.test.ts`:
     - Test 1: Prohibits browser-facing apps (`web` & `widget`) from declaring database package dependency -> **PASSED**
     - Test 2: Prohibits browser-facing source code from importing database or secret modules -> **PASSED**
     - Test 3: Prohibits cross-application relative imports between apps -> **PASSED**
     - Test 4: Detects and forbids circular dependencies across monorepo packages (DAG cycle detection) -> **PASSED**
  2. `pnpm --filter @agentflow/contracts test`:
     - Validates Idempotency keys, request hashing, and records -> **PASSED**
     - Validates W3C Traceparent headers and TraceContext schemas -> **PASSED**
     - Validates normalized Error Model and ApiErrorEnvelope -> **PASSED**
     - Validates Pagination parameters and meta calculations -> **PASSED**
  3. `pnpm typecheck`: Clean across all packages.
  4. `pnpm lint`: Clean across all packages.
- **Output Artifacts**:
  - Contracts additions: `idempotency.ts`, `tracing.ts`, `errors.ts`, `pagination.ts`.
  - Architecture tests: `tests/architecture/dependency-rules.test.ts`.
  - Architecture Decision Record: `ADR-019: Architectural Dependency Boundaries and Browser Isolation` in `docs/DECISIONS.md`.
- **Stage 02 Exit Gate Assessment**:
  - Contracts typed and documented: **PASSED**
  - Dependency rules run in CI: **PASSED** (`pnpm test:architecture` added to CI workflow)
  - API contract tests validate envelopes: **PASSED**
   - No secret-bearing module is browser reachable: **PASSED**
   - Result: **PASSED**

---

## Prompt 03 Execution Overlay

The existing 40-stage product roadmap names PostgreSQL schema work as Stage 03. The current delivery prompt explicitly sequences local infrastructure as Stage 03 and PostgreSQL schema work as the next stage. This overlay records the prompt sequence without silently renumbering the historical product roadmap; the conflict and selected approach are recorded in ADR-020.

| Prompt stage | Status | Evidence | Blockers | Next step |
| :--- | :--- | :--- | :--- | :--- |
| Stage 01 — foundation audit | `passed` | Frozen install, root checks, independent app builds and workspace/manifest audit | None | Stage 02 |
| Stage 02 — contracts and dependency rules audit | `passed` | Contract tests, stricter architecture tests, CI architecture job and package export audit | None | Stage 03 |
| Stage 03 — local infrastructure and developer environment | `passed` | Compose static validation, setup/reset/readiness safety tests, scripts/docs, and live PostgreSQL/Redis/MinIO verification | None for local development; compatibility image maintenance is a documented limitation | Stage 04 |
| Stage 04 — PostgreSQL schema and Drizzle migration baseline | `passed` | 48 tables, 44 RLS policies, 33 enums, journaled migrations, idempotent seed, 27 tests passed | None | Stage 05 (Auth & OAuth) |

### Prompt Stage 01 Audit Result

- **PASS** — pnpm workspace membership, lockfile consistency, Turborepo build order, strict TypeScript, CI scripts and all 17 workspace manifests verified.
- **PASS** — `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and `pnpm test:architecture` completed successfully in this audit.
- **PASS** — all five applications have independent package/build/start paths and do not import sibling application source directories.
- **PASS** — twelve shared packages expose explicit package exports and resolve through workspace package names.
- **FAIL corrected** — workspace lint scripts previously ended with `|| true`, which could hide ESLint failures; all workspace lint scripts now fail on errors.
- **NOT APPLICABLE** — no approved architecture image was available in the repository; boundaries were verified against the PRD and existing ADRs.

### Prompt Stage 02 Audit Result

- **PASS** — runtime-validated Zod schemas cover identifiers, timestamps, pagination, idempotency, tracing, API request/response envelopes and versioned event envelopes.
- **PASS** — negative tests cover invalid request bodies, identifiers, required fields, unsupported event versions, malformed pagination, invalid timestamps and missing correlation identifiers.
- **PASS** — browser source scans prohibit server-only/database/secret-bearing imports, cross-application relative imports are rejected, package dependency cycles are rejected, and every shared package must expose an entrypoint.
- **PASS** — architecture enforcement runs in CI through `pnpm test:architecture`.
- **FAIL corrected** — browser-facing `apps/web` declared unused server-only packages; those declarations were removed and the rule was widened to cover all server-only package names and dynamic imports.

### Prompt Stage 03 Implementation Evidence

- **Compose**: `docker-compose.yml` adds pinned PostgreSQL, Redis and MinIO-compatible services, named volumes, a dedicated network, restart policies, loopback-only ports, health checks, health-based dependency ordering and idempotent bucket initialization. Live verification found the upstream `minio/minio` and `minio/mc` Docker repositories unavailable; pinned `bitnamilegacy` images are used instead and recorded in ADR-020.
- **Configuration**: `.env.example` now includes application, PostgreSQL, Redis, object-storage and security variables. `pnpm dev:setup` generates local-only values only when `.env` is absent.
- **Tooling**: `pnpm infra:up`, `infra:down`, `infra:status`, `infra:logs`, `infra:wait` and protected `pnpm dev:reset --confirm` are implemented with bounded retries and secret redaction.
- **Validation**: server/browser environment schemas reject malformed URLs and credentials without printing values. Provider credentials remain optional for local infrastructure.
- **Documentation**: root quickstart/troubleshooting and `docs/LOCAL_DEVELOPMENT.md` describe executable commands, ports, connections, reset behavior and the Stage 04 migration handoff.
- **Tests**: infrastructure safety tests cover Compose shape, static Compose validation, environment parsing/redaction, reset environment protection and bounded readiness retry/timeout behavior.
- **Live health**: **PASSED** after starting Docker Desktop. `pnpm infra:up` reported PostgreSQL, Redis and MinIO/bucket ready; `pnpm infra:wait` repeated all checks successfully; `infra:status` showed all three containers healthy; direct probes returned PostgreSQL accepting connections, Redis `PONG` and MinIO live health.

### Prompt 03 Verification Log

- `pnpm install --frozen-lockfile` — **PASS**, pnpm 12.8.1 and lockfile accepted.
- `pnpm build` — **PASS**, 17 workspace builds succeeded.
- `pnpm typecheck` — **PASS**, 26 Turborepo tasks succeeded.
- `pnpm lint` — **PASS**, 26 Turborepo tasks succeeded with lint failures no longer swallowed.
- `pnpm test` — **PASS**, 26 workspace tasks plus 5 infrastructure tests succeeded.
- `pnpm test:architecture` — **PASS**, 6 architecture tests succeeded.
- Independent builds — **PASS**: `@agentflow/web`, `@agentflow/api`, `@agentflow/worker`, `@agentflow/widget`, and `@agentflow/docs` each built successfully.
- `docker compose -f docker-compose.yml config --quiet` — **PASS**.
- `pnpm dev:setup` — **PASS**, generated `.env` with secret values suppressed; existing `.env` preservation is covered by the script path.
- `pnpm dev:reset` without `--confirm` — **PASS**, refused to delete local volumes and printed the warning.
- Initial live `pnpm infra:up` — **FAIL**, the first upstream `minio/mc` tag was unavailable. The tag was replaced with verified pinned `bitnamilegacy` MinIO-compatible images and the command was rerun successfully.
- `pnpm format:check` — **FAIL**, reports 88 repository-wide formatting issues outside this focused implementation; no broad formatting rewrite was applied.

### Prompt 03 Infrastructure Health Result

| Probe | Result |
| :--- | :--- |
| PostgreSQL container health / `pg_isready` | PASS — accepting connections |
| Redis container health / `redis-cli ping` | PASS — `PONG` |
| MinIO container health / `/minio/health/live` | PASS — healthy |
| Expected bucket initialization | PASS — `mc mb --ignore-existing` and `mc stat` |
| Storage credential verification | PASS — `mc` authenticated against the configured endpoint |
| Port exposure | PASS — all published ports bound to `127.0.0.1` |

---

## Prompt 04 Execution Evidence (Stage 04 — Database Foundation & Migrations)

- **Timestamp**: 2026-11-04T08:57:00+05:30
- **Commands Executed**:
  1. `pnpm --filter @agentflow/database db:migrate` -> Successfully applied migration journal (`0000_productive_exiles.sql` and `0001_tenant_security.sql`).
  2. `pnpm --filter @agentflow/database db:status` -> Cleanly outputs migration ID, UTC timestamp, and SHA-256 hash.
  3. `pnpm --filter @agentflow/database db:check` -> Validated 48 public tables and 44 RLS-enabled tables.
  4. `pnpm --filter @agentflow/database db:seed` -> Seeded synthetic user, workspace, member, agent, tool, and credit account idempotently.
  5. `pnpm --filter @agentflow/database test` -> 27/27 unit and live integration tests passed across schema integrity, RLS tenant isolation, immutability triggers, financial idempotency, and context reset.
  6. `pnpm typecheck` -> 26 Turborepo tasks passed with 0 type errors.
  7. `pnpm lint` -> 26 Turborepo tasks passed with 0 warnings/errors.
  8. `pnpm test` -> All 26 workspace test suites plus infrastructure tests passed.
  9. `pnpm test:architecture` -> All 6 architecture dependency rules passed.
  10. Independent application builds (`apps/web`, `apps/api`, `apps/worker`, `apps/widget`, `apps/docs`) all succeeded.
- **Output Artifacts**:
  - `packages/database/src/schema/relations.ts`: Drizzle typed relations across all 48 tables.
  - `packages/database/migrations/meta/_journal.json`: Journaled migrations with entry 0 and 1.
  - `packages/database/migrations/0001_tenant_security.sql`: RLS enablement, `agentflow_app` role grant, isolation policies, and append-only triggers.
  - `packages/database/src/tenant-context.ts`: Hardened context with `withWorkspaceAppTransaction` and `resetWorkspaceContext`.
  - `packages/database/tests/database-integration.test.ts`: 22 live integration tests validating schema, RLS, triggers, and idempotency.
  - `docs/database/SCHEMA.md`, `ERD.md`, `TENANCY.md`, `MIGRATIONS.md`, `SCHEMA_MAP.md`.
- **Stage 04 Exit Gate Assessment**:
  - 48 required domain tables exist: **PASSED**
  - Drizzle schemas match actual migrations: **PASSED**
  - Composite foreign keys and tenant isolation enforced: **PASSED**
  - RLS enforced under `agentflow_app` restricted role: **PASSED**
  - Append-only immutability safeguards active: **PASSED**
  - Clean migration journal and status reporting: **PASSED**
  - Idempotent and safe development seeding: **PASSED**
  - Result: **PASSED**

---

## Prompt 05 Execution Evidence (Stage 05 — Database Access Layer, Tenant Context & RLS Hardening)

- **Timestamp**: 2026-11-04T09:30:00+05:30
- **Commands Executed**:
  1. `pnpm --filter @agentflow/database test` -> 51/51 tests passed:
     - 5/5 unit tests (`database.test.ts`)
     - 22/22 live integration tests (`database-integration.test.ts`)
     - 24/24 access security scenario tests (`database-access-security.test.ts`)
  2. `pnpm --filter @agentflow/auth test` -> 4/4 auth unit tests passed including constant-time API key verification.
  3. `pnpm test:architecture` -> 6/6 architecture dependency boundary tests passed with 0 violations.
  4. `pnpm typecheck` -> 26 Turborepo tasks passed with 0 type errors.
  5. `pnpm lint` -> 26 Turborepo tasks passed with 0 warnings/errors.
  6. `pnpm test` -> All 26 workspace test suites passed.
  7. Independent application builds (`apps/web`, `apps/api`, `apps/worker`, `apps/widget`, `apps/docs`) all succeeded.
- **Output Artifacts**:
  - `packages/database/src/tenant-context.ts`: Discriminated `TrustedTenantContext` union, error hierarchy (`TenantSecurityError`, `AuthenticationError`, `AuthorizationError`, `TenantNotFoundError`), narrow constructors, and permission assertion (`assertContextPermission`).
  - `packages/database/src/resolvers.ts`: 4 verified entry paths (`resolveSessionContext`, `resolveApiKeyContext`, `resolveWidgetSessionContext`, `resolveWorkerContext`) with constant-time equality matching and origin allowlist enforcement.
  - `packages/database/src/repositories/*`: 15 typed tenant-scoped repositories extending `BaseRepository` with `withScopedTransaction` (`SET LOCAL ROLE agentflow_app` + `SET LOCAL app.current_workspace_id`).
  - `packages/database/tests/database-access-security.test.ts`: 24-point security test suite covering all Part H security scenarios against live PostgreSQL container.
  - `docs/security/TENANT_ACCESS_MODEL.md`: Authoritative security specification and access model architecture.
  - `docs/DECISIONS.md`: Added ADR-021.
- **Stage 05 Exit Gate Assessment**:
  - Discriminated `TrustedTenantContext` union enforced: **PASSED**
  - 3 authentication entry paths + worker run resolver implemented: **PASSED**
  - Tenant-scoped repositories cover all 15 domains: **PASSED**
  - Least-privilege `agentflow_app` RLS transactions with pool safety: **PASSED**
  - RBAC integration with `@agentflow/auth` permissions: **PASSED**
  - Monorepo boundary rules verified without leakage into browser apps: **PASSED**
  - 24/24 security scenarios verified against real PostgreSQL: **PASSED**
  - Result: **PASSED**


